import { useCallback, useEffect, useRef, useState } from "react";
import {
  REST_IDLE,
  addRestTime,
  pauseRest,
  resumeRest,
  startRest,
  tickRest,
  type RestState,
} from "../lib/restTimer";

const TICK_MS = 250;
/** Below this the display would not change anyway, so skip the re-render. */
const MIN_VISIBLE_DELTA = 150;

const STORAGE_KEY = "reprange.rest.v1";

/**
 * Restoring what was running when the page went away.
 *
 * The timer lives in this page's state, and moving between tabs in the app
 * unmounts the page, which used to take a running rest with it: coming back
 * showed nothing at all. Keeping `endsAt` is what makes this correct rather
 * than merely present, because it is an absolute time, so the number on screen
 * is the number that is genuinely left however long the athlete was away. It
 * also survives a reload, which the in-memory version did not.
 */
function loadRest(): RestState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return REST_IDLE;
    const parsed = JSON.parse(raw) as Partial<RestState>;
    if (typeof parsed.totalMs !== "number" || typeof parsed.remainingMs !== "number") {
      return REST_IDLE;
    }
    if (parsed.endsAt !== null && typeof parsed.endsAt !== "number") return REST_IDLE;
    // A rest that ran out while the page was gone is not news. Reset quietly
    // rather than firing the finished callback for something that ended
    // minutes ago while the athlete was somewhere else in the app.
    if (parsed.endsAt !== null && parsed.endsAt <= Date.now()) return REST_IDLE;
    return { totalMs: parsed.totalMs, remainingMs: parsed.remainingMs, endsAt: parsed.endsAt ?? null };
  } catch {
    // Blocked storage, or something unreadable in there. The timer simply
    // starts fresh, which is what happened before this existed.
    return REST_IDLE;
  }
}

/** Idle is the absence of a rest, so it is stored as an absence. */
function saveRest(state: RestState) {
  try {
    if (state.totalMs === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Nothing useful to do here, and a timer that cannot persist is still a
    // working timer for as long as the page stays mounted.
  }
}

export interface RestTimer {
  running: boolean;
  remainingMs: number;
  totalMs: number;
  start: (seconds?: number) => void;
  pause: () => void;
  resume: () => void;
  addSeconds: (seconds: number) => void;
  dismiss: () => void;
}

/**
 * Drives the countdown from an absolute end time, so a backgrounded tab or a
 * throttled interval can never leave the athlete reading a stale number.
 */
export function useRestTimer(defaultSeconds: number, onDone: () => void): RestTimer {
  const [state, setState] = useState<RestState>(loadRest);
  const endsAt = state.endsAt;

  // Written on every change rather than on the way out, because the page is
  // unmounted by a tab switch without getting a chance to clean up.
  useEffect(() => {
    saveRest(state);
  }, [state]);

  // Refs let the interval read current state without being rebuilt every tick
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (endsAt === null) return;

    const tick = () => {
      const result = tickRest(stateRef.current, Date.now());
      if (result.done) {
        stateRef.current = REST_IDLE;
        setState(REST_IDLE);
        doneRef.current();
        return;
      }
      if (Math.abs(stateRef.current.remainingMs - result.state.remainingMs) >= MIN_VISIBLE_DELTA) {
        stateRef.current = result.state;
        setState(result.state);
      }
    };

    const id = window.setInterval(tick, TICK_MS);
    // A tab that slept through part of the rest catches up the moment it returns
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endsAt]);

  const start = useCallback(
    (seconds?: number) => setState(startRest(seconds ?? defaultSeconds, Date.now())),
    [defaultSeconds]
  );
  const pause = useCallback(() => setState((prev) => pauseRest(prev, Date.now())), []);
  const resume = useCallback(() => setState((prev) => resumeRest(prev, Date.now())), []);
  const addSeconds = useCallback(
    (seconds: number) => setState((prev) => addRestTime(prev, seconds, Date.now())),
    []
  );
  const dismiss = useCallback(() => setState(REST_IDLE), []);

  return {
    running: endsAt !== null,
    remainingMs: state.remainingMs,
    totalMs: state.totalMs,
    start,
    pause,
    resume,
    addSeconds,
    dismiss,
  };
}
