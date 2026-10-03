import { REP_WINDOW, weightStep } from "./coach";
import type { Experience, Goal } from "./profile";
import type { Unit } from "./units";

export const MIN_REPS = 1;
export const MAX_REPS = 60;

/**
 * The smallest jump that means something on the bar, expressed in the unit the
 * athlete actually reads. Barbells move in 2.5 kg, dumbbells in 2, and pounds
 * round to whatever a real plate stack offers.
 */
export function loadStep(
  equipment: string | undefined,
  experience: Experience,
  unit: Unit
): number {
  const kg = weightStep(equipment, experience);
  if (unit === "kg") return kg ?? 1;
  // No bar to load (bodyweight, bands) still nudges by a pair of small plates
  const lb = kg == null ? 2.5 : kg * 2.20462262;
  if (lb >= 20) return Math.round(lb / 5) * 5;
  return Math.max(2.5, Math.round(lb / 2.5) * 2.5);
}

/** One tap of a stepper button, rounded to two decimals so 2.5 stays 2.5. */
export function stepValue(current: number, step: number, direction: 1 | -1): number {
  const size = step > 0 ? step : 1;
  const next = current + direction * size;
  return Math.max(0, Math.round(next * 100) / 100);
}

export function clampReps(reps: number): number {
  if (!isFinite(reps)) return MIN_REPS;
  return Math.min(MAX_REPS, Math.max(MIN_REPS, Math.round(reps)));
}

/**
 * Rep counts worth one tap. Drawn from the athlete's goal window so the chips
 * are the numbers that would actually count as work.
 */
export function quickReps(goal: Goal): number[] {
  const window = REP_WINDOW[goal] ?? REP_WINDOW.general;
  return [...new Set([window.min, window.target, window.max])];
}

/** 40, 42.5, never 42.50 and never a trailing dot mid typing. */
export function formatEntryValue(value: number): string {
  if (!isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Typed weight, or null when the field cannot be read as a number. */
export function parseWeight(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? n : null;
}

/** Typed reps, or null when the field cannot be read as a whole number. */
export function parseReps(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  const whole = Math.round(n);
  return whole >= MIN_REPS ? Math.min(MAX_REPS, whole) : null;
}