import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  deleteUser,
} from "firebase/auth";
import { collection, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "./firebase";
import { deleteProfile } from "./profile";

/** How this account signs in. Decides which controls make sense. */
export type AuthMethod = "password" | "google";

export function authMethodOf(user: { providerData: { providerId: string }[] }): AuthMethod {
  return user.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID)
    ? "google"
    : "password";
}

/**
 * Changes the password on an email account. Firebase requires a recent sign-in
 * for anything this sensitive, so a stale session re-prompts for the password
 * instead of failing with an opaque error.
 */
export async function changePassword(currentPassword: string, nextPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("no-account");
  if (nextPassword.length < 6) throw new Error("weak-password");

  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code.includes("wrong-password") || code.includes("invalid-credential")) {
      throw new Error("wrong-password");
    }
    if (code.includes("user-not-found")) throw new Error("no-account");
    throw new Error("reauth-failed");
  }
  await updatePassword(user, nextPassword);
}

/** Sends the "reset your password" mail. Safe to call for unknown addresses. */
export async function sendReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Removes the account and everything attached to it. Sessions and their sets
 * go first, so an interruption part-way through can never leave a live account
 * with orphaned training data behind it.
 */
export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("no-account");

  const workouts = await getDocs(
    query(collection(db, "workouts"), where("userId", "==", user.uid))
  );
  await Promise.all(
    workouts.docs.map(async (w) => {
      const sets = await getDocs(collection(db, "workouts", w.id, "sets"));
      await Promise.all(sets.docs.map((s) => deleteDoc(s.ref)));
      await deleteDoc(w.ref);
    })
  );

  // Best effort: a leftover preferences doc is inert once the account is gone,
  // and losing the whole delete over it would be the worse outcome.
  await deleteProfile(user.uid).catch(() => undefined);
  await deleteUser(user);
}

/** Turns a Firebase auth failure into something worth reading. */
export function friendlyAccountError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  const code = (err as { code?: string })?.code ?? "";
  switch (message || code) {
    case "no-account":
      return "Sign in again to make this change.";
    case "weak-password":
      return "Password must be at least 6 characters.";
    case "wrong-password":
      return "That current password doesn't match.";
    case "reauth-failed":
      return "Couldn't verify that password. Sign out and back in, then try again.";
    case "auth/requires-recent-login":
      return "Sign out and back in to make this change.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection.";
    case "auth/user-not-found":
      return "That account no longer exists.";
    case "auth/missing-password":
      return "Enter your current password.";
    default:
      return "Couldn't complete that. Try again.";
  }
}