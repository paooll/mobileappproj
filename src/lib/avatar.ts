import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * The profile photo lives in Firestore rather than Cloud Storage.
 *
 * Cloud Storage has required a billing-enabled project since February 2026, and
 * this app is meant to run entirely on the free plan. A 256px JPEG at quality
 * 0.82 is roughly 15 to 25 KB, comfortably inside Firestore's 1 MiB document
 * limit, and a document read is billed once regardless of its size.
 *
 * It sits in its own document at users/{uid}/avatar rather than on the profile
 * itself, so the profile that the route guard reads on every navigation does not
 * carry a few hundred kilobytes of image behind it.
 */

/** Long edge of the stored image. Enough for a 56px avatar at any density. */
const EDGE = 256;
/** Anything larger than this is a raw camera file, not a picture meant to be sent. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Firestore's hard per-document ceiling. A resize bug must never reach the write. */
const MAX_STORED_BYTES = 400 * 1024;

const AVATAR_DOC = "avatar";

export type AvatarReason =
  | "too-large-source"
  | "too-large-stored"
  | "not-an-image"
  | "unsupported-format"
  | "save-failed"
  | "not-allowed";

function mb(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
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

export class AvatarError extends Error {
  reason: AvatarReason;
  constructor(reason: AvatarReason, message: string) {
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
async function downscale(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
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
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (blob) return blob;
  } catch (err) {
    console.warn("avatar: could not decode", file.type || file.name, err);
  }
  return null;
}

/**
 * Saves a new photo, replacing any previous one. Returns the stored bytes so the
 * caller can render it straight away.
 *
 * Every rejection names its own cause. One "too large" message used to cover a
 * 30 MB raw file, a HEIC this browser cannot decode, and a refused write, which
 * made the real problem impossible to act on.
 */
export async function uploadAvatar(uid: string, file: File): Promise<Uint8Array> {
  const label = file.name || file.type || "photo";
  console.info(
    `avatar: ${label} type=${file.type || "(none)"} size=${mb(file.size)} ua=${navigator.userAgent}`
  );

  if (isHeic(file)) {
    throw new AvatarError(
      "unsupported-format",
      "That's an iPhone HEIC photo, which only Safari can read. Open it on your phone, or export it as a JPEG first."
    );
  }
  if (!file.type.startsWith("image/")) {
    throw new AvatarError(
      "not-an-image",
      `That file isn't an image${file.type ? ` (${file.type})` : ""}. Pick a JPEG or PNG.`
    );
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarError(
      "too-large-source",
      `That photo is ${mb(file.size)}. Pick one under 25 MB.`
    );
  }

  const resized = await downscale(file);
  // Only usable if it was already small; otherwise the browser simply could not
  // read it, and saying "too large" would send the athlete hunting the wrong fix.
  const blob = resized ?? (file.size <= MAX_STORED_BYTES ? file : null);
  if (!blob) {
    throw new AvatarError(
      "unsupported-format",
      "This browser couldn't read that image. Try a JPEG or PNG, or pick it on a different device."
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch (err) {
    console.error(err);
    throw new AvatarError("unsupported-format", "Couldn't read that file. Try another image.");
  }

  if (bytes.byteLength > MAX_STORED_BYTES) {
    console.warn(`avatar: stored ${bytes.byteLength} bytes exceeds cap for ${label}`);
    throw new AvatarError(
      "too-large-stored",
      `That photo didn't shrink enough (${Math.round(bytes.byteLength / 1024)} KB). Try a smaller or simpler image.`
    );
  }

  try {
    await saveAvatarBytes(uid, bytes);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    console.error("avatar: write failed", code, err);
    if (code === "permission-denied") {
      throw new AvatarError(
        "not-allowed",
        "This account isn't allowed to store a photo. Try signing out and back in."
      );
    }
    throw new AvatarError(
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