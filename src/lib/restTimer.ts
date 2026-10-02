import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/* ---------- Defaults and presets ---------- */

export const DEFAULT_REST_SECONDS = 90;
export const REST_PRESETS = [45, 60, 90, 120, 180];

export interface RestSettings {
  /** How long the timer runs after a set is logged. */
  seconds: number;
  /** Start automatically on every logged set. */
  autoStart: boolean;
}

export const DEFAULT_REST: RestSettings = {
  seconds: DEFAULT_REST_SECONDS,
  autoStart: true,
};

/** mm:ss, and h:mm:ss only if someone really parks on a five minute rest. */
export function formatRest(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function clampSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : DEFAULT_REST_SECONDS;
  if (!Number.isFinite(n)) return DEFAULT_REST_SECONDS;
  return Math.min(600, Math.max(15, Math.round(n)));
}

/* ---------- Countdown state, as pure transitions ---------- */

export interface RestState {
  /** Full length of the current rest, 0 when idle. */
  totalMs: number;
  remainingMs: number;
  /** Absolute wall clock time the rest ends at, null when idle or paused. */
  endsAt: number | null;
}

export const REST_IDLE: RestState = { totalMs: 0, remainingMs: 0, endsAt: null };

export function startRest(seconds: number, now: number): RestState {
  const ms = Math.max(1, seconds) * 1000;
  return { totalMs: ms, remainingMs: ms, endsAt: now + ms };
}

export function pauseRest(state: RestState, now: number): RestState {
  if (state.endsAt === null) return state;
  return { ...state, remainingMs: Math.max(0, state.endsAt - now), endsAt: null };
}

export function resumeRest(state: RestState, now: number): RestState {
  if (state.endsAt !== null || state.remainingMs <= 0) return state;
  return { ...state, endsAt: now + state.remainingMs };
}

/** Adds time whether the clock is running, paused or not yet started. */
export function addRestTime(state: RestState, seconds: number, now: number): RestState {
  const ms = seconds * 1000;
  if (state.totalMs === 0) return startRest(seconds, now);
  if (state.endsAt !== null) {
    return {
      totalMs: state.totalMs + ms,
      remainingMs: state.remainingMs + ms,
      endsAt: state.endsAt + ms,
    };
  }
  return { ...state, totalMs: state.totalMs + ms, remainingMs: state.remainingMs + ms };
}

/**
 * Counts down from the absolute end time rather than decrementing, so a
 * backgrounded tab or a throttled interval can never leave a stale number.
 */
export function tickRest(state: RestState, now: number): { state: RestState; done: boolean } {
  if (state.endsAt === null) return { state, done: false };
  const left = state.endsAt - now;
  if (left <= 0) return { state: REST_IDLE, done: true };
  return { state: { ...state, remainingMs: left }, done: false };
}

/* ---------- Persistence: merged into users/{uid} ---------- */

let cache: { uid: string; settings: RestSettings } | null = null;
let inflight: Promise<RestSettings> | null = null;

/**
 * Rest preferences live on the profile doc, but as their own fields rather than
 * part of UserProfile, so re-running onboarding never resets them. Results are
 * cached per uid because the timer asks on mount and after every change.
 */
export async function loadRestSettings(uid: string): Promise<RestSettings> {
  if (cache?.uid === uid) return cache.settings;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const d = snap.exists() ? snap.data() : {};
      const settings: RestSettings = {
        seconds: clampSeconds(d?.restSeconds),
        autoStart: d?.restAutoStart !== false,
      };
      cache = { uid, settings };
      return settings;
    } catch {
      // Defaults are a fine answer to a failed read. Never block a workout on it.
      const settings = { ...DEFAULT_REST };
      cache = { uid, settings };
      return settings;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function saveRestSettings(
  uid: string,
  patch: Partial<RestSettings>
): Promise<RestSettings> {
  const next: RestSettings = {
    seconds: clampSeconds(patch.seconds ?? cache?.settings.seconds),
    autoStart: patch.autoStart ?? cache?.settings.autoStart ?? DEFAULT_REST.autoStart,
  };
  // Write first so a failed write never leaves the UI claiming a setting stuck
  await setDoc(doc(db, "users", uid), { restSeconds: next.seconds, restAutoStart: next.autoStart }, { merge: true });
  cache = { uid, settings: next };
  return next;
}