import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, persistenceReady } from "../lib/firebase";

export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Subscribing before persistence resolves can miss a restored session,
    // which shows up as a signed-out user who has to type their password again.
    persistenceReady.then(() => {
      if (cancelled) return;
      let wasSignedIn = false;
      unsubscribe = onAuthStateChanged(auth, (next) => {
        if (next) {
          wasSignedIn = true;
          console.info("auth: signed in", next.uid);
        } else if (wasSignedIn) {
          // Nothing in this app signs anyone out on its own, so reaching here
          // means the browser dropped the stored session or the token was
          // revoked. That is the difference worth recording.
          console.warn(
            "auth: session ended without a sign out. The browser most likely evicted its storage."
          );
        }
        setUser(next);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  return user;
}
