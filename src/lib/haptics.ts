/**
 * One place to fire haptics, so the athlete's preference is respected
 * everywhere and no caller has to remember the guard.
 */
let enabled = true;

export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

/** A short tick for a completed action: a logged set, a finished rest. */
export function tick(pattern: number | number[] = 8) {
  if (!enabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety. Never let it break the thing that asked for it.
  }
}