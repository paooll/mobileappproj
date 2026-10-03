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

export type AvatarReason = "too-large" | "not-an-image" | "save-failed";

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
 * Falls back to the original when the browser cannot decode the format:
 * createImageBitmap is missing on older Safari and rejects some valid files, and
 * re-encoding is what makes the result small enough to store.
 */
async function downscale(file: File): Promise<Blob> {
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
  } catch {
    // Fall through to the original file below.
  }
  return file;
}

/**
 * Saves a new photo, replacing any previous one. Returns the stored bytes so the
 * caller can render it straight away.
 */
export async function uploadAvatar(uid: string, file: File): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) {
    throw new AvatarError("not-an-image", "Pick an image file.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarError("too-large", "That image is too large. Pick a smaller one.");
  }

  let bytes: Uint8Array;
  try {
    const blob = await downscale(file);
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch (err) {
    console.error(err);
    throw new AvatarError("save-failed", "Couldn't read that image. Try another one.");
  }

  if (bytes.byteLength > MAX_STORED_BYTES) {
    throw new AvatarError("too-large", "That image is too large. Pick a smaller one.");
  }

  try {
    await saveAvatarBytes(uid, bytes);
  } catch (err) {
    console.error(err);
    throw new AvatarError("save-failed", "Couldn't save that photo. Try again.");
  }
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