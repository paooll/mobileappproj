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
  const [state, setState] = useState<RestState>(REST_IDLE);
  const endsAt = state.endsAt;

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