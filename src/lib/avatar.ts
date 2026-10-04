import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Resizing images, in one place.
 *
 * Cloud Storage has required a billing-enabled project since February 2026, and
 * this app is meant to run entirely on the free plan, so every image is
 * resized in the browser and written to Firestore as bytes. Firestore's hard
 * per-document ceiling is 1 MiB, which means the resize has to happen before
 * the write and never after it.
 *
 * Two callers share the pipeline below, and only the sizes differ: a profile
 * photo, and a post photo that is stored twice at two resolutions. Keeping one
 * implementation is what keeps the guard honest, because a second resizer would
 * be a second chance to forget the ceiling.
 */

/** Long edge of a profile photo. Enough for a 56px avatar at any density. */
const EDGE = 256;
/** Anything larger than this is a raw camera file, not a picture meant to be sent. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Firestore's hard per-document ceiling. A resize bug must never reach the write. */
const MAX_STORED_BYTES = 400 * 1024;

/** Long edge of the inline feed thumbnail. */
export const THUMB_EDGE = 160;
/**
 * Long edge of the full image behind posts/{postId}/photo. 1024 is enough to
 * fill a phone screen at any density and still lands inside the guard below.
 */
export const FULL_EDGE = 1024;

/**
 * The rules cap an inline thumbnail well below Firestore's 1 MiB ceiling,
 * because a thumbnail rides on every one of the feed's 25 rows. 24 KB is
 * roughly triple the size a 160px JPEG actually lands at, so this is headroom
 * for a noisy image rather than a budget the encoder usually reaches.
 */
export const THUMB_MAX_BYTES = 24 * 1024;

/**
 * Quality is stepped down rather than the image being rejected, so a difficult
 * photo still makes it into the post instead of failing at the last step. The
 * ladder ends at a floor that is visibly soft rather than at a size it cannot
 * meet: below this the image stops being worth sending.
 */
const QUALITY_LADDER = [0.82, 0.7, 0.58, 0.46];

const AVATAR_DOC = "avatar";

export type PhotoReason =
  | "too-large-source"
  | "too-large-stored"
  | "not-an-image"
  | "unsupported-format"
  | "save-failed"
  | "not-allowed";

function mb(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * HEIC is the iPhone default and only Safari can decode it: it needs the HEVC
 * codec, which Chrome, Firefox and Edge deliberately do not license. Every other
 * browser can be handed one and have it silently fail to resize, which used to
 * surface as a confusing "too large" error. Naming the format up front is the
 * difference between a fixable instruction and a dead end.
 */
function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  // Some pickers hand over an empty type for these.
  return /\.(heic|heif)$/i.test(file.name);
}

export class PhotoError extends Error {
  reason: PhotoReason;
  constructor(reason: PhotoReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Phone cameras produce 4 to 12 MB files. Downscaling in the browser first keeps
 * the write to a few KB, which matters on gym wifi.
 *
 * Returns null when this browser cannot decode or re-encode the file, rather
 * than quietly handing back the original. The caller decides what to do with
 * that, and can say so plainly instead of blaming the wrong thing.
 */
async function downscale(file: File, edge: number, quality: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (blob) return blob;
  } catch (err) {
    console.warn("photo: could not decode", file.type || file.name, err);
  }
  return null;
}

async function toBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Rejects everything that is not a picture this browser can reasonably handle,
 * before a pixel is decoded. Every rejection names its own cause, because one
 * "too large" message covering a 30 MB raw file, a HEIC this browser cannot
 * decode, and a refused write makes the real problem impossible to act on.
 */
function checkSource(file: File): void {
  if (isHeic(file)) {
    throw new PhotoError(
      "unsupported-format",
      "That's an iPhone HEIC photo, which only Safari can read. Open it on your phone, or export it as a JPEG first."
    );
  }
  if (!file.type.startsWith("image/")) {
    throw new PhotoError(
      "not-an-image",
      `That file isn't an image${file.type ? ` (${file.type})` : ""}. Pick a JPEG or PNG.`
    );
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoError(
      "too-large-source",
      `That photo is ${mb(file.size)}. Pick one under 25 MB.`
    );
  }
}

/**
 * Encodes one size, walking down the quality ladder until the result fits under
 * `maxBytes`. Throws only when no rung of the ladder fits, which is the point
 * at which the honest answer is that this image cannot be stored rather than a
 * picture that quietly loses detail forever.
 */
async function encodeWithin(
  file: File,
  edge: number,
  maxBytes: number
): Promise<Uint8Array> {
  let decoded = false;
  for (const quality of QUALITY_LADDER) {
    const blob = await downscale(file, edge, quality);
    if (!blob) continue;
    decoded = true;
    const bytes = await toBytes(blob);
    if (bytes.byteLength <= maxBytes) return bytes;
    console.info(`photo: ${edge}px at q${quality} was ${kb(bytes.byteLength)}, stepping down`);
  }
  // Never decoded at all is a different problem from never small enough, and
  // telling somebody their photo did not shrink when the browser could not read
  // it sends them hunting the wrong fix.
  if (!decoded) {
    throw new PhotoError(
      "unsupported-format",
      "This browser couldn't read that image. Try a JPEG or PNG, or pick it on a different device."
    );
  }
  throw new PhotoError(
    "too-large-stored",
    `That photo didn't shrink enough under ${kb(maxBytes)}. Try a smaller or simpler image.`
  );
}

/** The two resolutions a post photo is stored at. */
export interface PostPhoto {
  /** 160px JPEG, small enough to ride inline on the post document. */
  thumb: Uint8Array;
  /** 1024px JPEG, read from posts/{postId}/photo only when the post is opened. */
  full: Uint8Array;
}

/**
 * Resizes one picked file into the pair a post carries. The thumbnail is
 * produced first because it is the one that has to fit the feed's budget, and a
 * failure there should surface before the expensive one is encoded.
 *
 * The two encodings are independent, so a browser that can only manage the
 * small one still produces a post rather than nothing.
 */
export async function resizeForPost(file: File): Promise<PostPhoto> {
  checkSource(file);
  const thumb = await encodeWithin(file, THUMB_EDGE, THUMB_MAX_BYTES);
  const full = await encodeWithin(file, FULL_EDGE, MAX_STORED_BYTES);
  return { thumb, full };
}

/**
 * Saves a new profile photo, replacing any previous one. Returns the stored
 * bytes so the caller can render it straight away.
 *
 * A 256px JPEG at quality 0.82 is roughly 15 to 25 KB, comfortably inside the
 * document limit, and a document read is billed once regardless of its size.
 * It sits in its own document at users/{uid}/avatar rather than on the profile
 * itself, so the profile that the route guard reads on every navigation does
 * not carry a few hundred kilobytes of image behind it.
 */
export async function uploadAvatar(uid: string, file: File): Promise<Uint8Array> {
  const label = file.name || file.type || "photo";
  console.info(
    `avatar: ${label} type=${file.type || "(none)"} size=${mb(file.size)} ua=${navigator.userAgent}`
  );

  checkSource(file);

  // A browser that cannot decode a file this small can still keep the original
  // rather than losing the photo over an encoder quirk.
  let bytes: Uint8Array;
  try {
    bytes = await encodeWithin(file, EDGE, MAX_STORED_BYTES);
  } catch (err) {
    if (err instanceof PhotoError && err.reason === "unsupported-format") {
      if (file.size > MAX_STORED_BYTES) throw err;
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      throw err;
    }
  }

  try {
    await saveAvatarBytes(uid, bytes);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    console.error("avatar: write failed", code, err);
    if (code === "permission-denied") {
      throw new PhotoError(
        "not-allowed",
        "This account isn't allowed to store a photo. Try signing out and back in."
      );
    }
    throw new PhotoError(
      "save-failed",
      `Couldn't save that photo${code ? ` (${code})` : ""}. Check your connection and try again.`
    );
  }
  console.info(`avatar: stored ${bytes.byteLength} bytes`);
  return bytes;
}

/** Writes the image. Kept separate so uploadAvatar can report a save failure. */
export async function saveAvatarBytes(uid: string, bytes: Uint8Array) {
  await setDoc(doc(db, "users", uid, AVATAR_DOC), { bytes }, { merge: true });
}

/** Reads the stored photo. Returns null when there is none or the read fails. */
export async function loadAvatar(uid: string): Promise<Uint8Array | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid, AVATAR_DOC));
    if (!snap.exists()) return null;
    const bytes = snap.data().bytes;
    return bytes instanceof Uint8Array ? bytes : null;
  } catch {
    // A missing or unreadable photo is not worth interrupting the screen for.
    return null;
  }
}

/** Best effort: a failed cleanup must never block the UI from dropping the photo. */
export async function removeAvatar(uid: string) {
  await deleteDoc(doc(db, "users", uid, AVATAR_DOC)).catch(() => undefined);
}