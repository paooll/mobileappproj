import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * How the session survived.
 *   local       IndexedDB, survives closing the browser for weeks
 *   session     this tab only, storage is blocked (private windows, storage
 *               pressure, or a browser that refuses IndexedDB)
 *   unavailable nothing persisted, so closing the tab signs the athlete out
 */
export type PersistenceMode = "local" | "session" | "unavailable";

/**
 * Firebase keeps the session in IndexedDB by default, so coming back after a
 * reload signs you straight in. That default is relied on rather than asked
 * for, which leaves two ways to quietly lose the session: auth initialising
 * before persistence is applied, and storage being blocked with no signal that
 * it happened. Both are handled here instead.
 *
 * Must be awaited before anything subscribes to auth state, otherwise a
 * restored session can be missed.
 */
/**
 * Waiting for persistence is only worth it if it actually finishes. A blocked
 * IndexedDB can leave the promise unsettled, and every route guard waits on this
 * before it subscribes, so a hang here would park the whole app on the splash
 * screen forever. Failing open keeps the old behaviour instead.
 */
const PERSISTENCE_TIMEOUT_MS = 3000;

function bounded<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), PERSISTENCE_TIMEOUT_MS)),
  ]);
}

async function applyPersistence(): Promise<PersistenceMode> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return "local";
  } catch (err) {
    console.warn("auth: IndexedDB persistence unavailable", err);
  }
  try {
    await setPersistence(auth, browserSessionPersistence);
    console.warn("auth: fell back to tab-only persistence");
    return "session";
  } catch (err) {
    console.warn("auth: no persistence available, sessions end with the tab", err);
    return "unavailable";
  }
}

export const persistenceReady: Promise<PersistenceMode> = bounded(
  applyPersistence(),
  "unavailable"
);
