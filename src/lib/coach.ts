import type { Experience, Goal } from "./profile";

/* ---------- Shapes the coach reads out of Firestore ---------- */

export interface CoachSet {
  exerciseName: string;
  weight: number; // kg
  reps: number;
}

export interface RecentWorkout {
  id: string;
  date: string;
  completedAt: number | null;
}

export interface RecentArchive {
  workouts: RecentWorkout[];
  setsByWorkout: Map<string, CoachSet[]>;
}

/** One workout's sets for a single exercise, ordered as they were logged. */
export interface CoachSession {
  date: string;
  sets: { weight: number; reps: number }[];
}

/* ---------- Estimates ---------- */

/**
 * Epley one rep max estimate. Used to compare sessions against each other,
 * never shown as an absolute number.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + Math.min(reps, 12) / 30);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------- Index: one pass over the recent archive ---------- */

export interface CoachIndex {
  /** Heaviest set ever logged per exercise, used to prefill the inputs. */
  last: Map<string, { weight: number; reps: number }>;
  /** Completed sessions per exercise, most recent first. */
  history: Map<string, CoachSession[]>;
}

/**
 * Groups the recent archive by exercise so the coach and the prefill never
 * rescan Firestore data. Only completed workouts count as history.
 */
export function buildCoachIndex(archive: RecentArchive | null): CoachIndex {
  const index: CoachIndex = { last: new Map(), history: new Map() };
  if (!archive) return index;

  const ordered = [...archive.workouts]
    .filter((w) => archive.setsByWorkout.has(w.id))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  for (const w of ordered) {
    // Group this workout's sets by exercise so a session stays one session
    const byExercise = new Map<string, { weight: number; reps: number }[]>();
    for (const s of archive.setsByWorkout.get(w.id) ?? []) {
      if (!s.exerciseName) continue;

      const heaviest = index.last.get(s.exerciseName);
      if (!heaviest || s.weight > heaviest.weight) {
        index.last.set(s.exerciseName, { weight: s.weight, reps: s.reps });
      }

      const arr = byExercise.get(s.exerciseName) ?? [];
      arr.push({ weight: s.weight, reps: s.reps });
      byExercise.set(s.exerciseName, arr);
    }
    for (const [exerciseName, sets] of byExercise) {
      const sessions = index.history.get(exerciseName) ?? [];
      sessions.push({ date: w.date, sets });
      index.history.set(exerciseName, sessions);
    }
  }
  return index;
}

/** Weight the suggestion is measured against: the top set of the newest session. */
export function referenceWeight(history: CoachSession[]): number | null {
  const current = history[0];
  if (!current || current.sets.length === 0) return null;
  return bestSet(current.sets).weight;
}

/* ---------- Rep windows ---------- */

interface RepWindow {
  /** Below this and the set did not count as work. */
  min: number;
  /** Hit this on the top set and the coach adds load. */
  target: number;
  /** Hard ceiling, so a rep-only suggestion never walks backwards. */
  max: number;
}

/** Where the athlete wants to sit for a working set, by stated goal. */
export const REP_WINDOW: Record<Goal, RepWindow> = {
  strength: { min: 3, target: 5, max: 8 },
  muscle: { min: 8, target: 12, max: 20 },
  endurance: { min: 12, target: 20, max: 30 },
  general: { min: 6, target: 10, max: 15 },
};

/* ---------- Loadable increments ---------- */

/**
 * Smallest jump the equipment can actually make. Barbell plates come in 2.5 kg
 * jumps, dumbbells and kettlebells in 2 kg, machines in bigger steps. Returns
 * null when there is no bar to load, which turns the coach into a rep coach.
 */
export function weightStep(
  equipment: string | undefined,
  experience: Experience
): number | null {
  const eq = (equipment ?? "").toLowerCase();
  if (!eq || eq.includes("body") || eq.includes("band")) return null;

  let base: number;
  if (eq.includes("dumbbell") || eq.includes("kettlebell")) base = 2;
  else base = 2.5; // barbell, machine, cable

  if (experience === "years") base *= 2;
  else if (experience === "new") base = Math.max(1, base / 2);

  return Math.round(base * 100) / 100;
}

/* ---------- Suggestion ---------- */

export type CoachKind = "increase" | "reps" | "hold" | "deload";

export interface CoachSuggestion {
  weight: number; // kg
  reps: number;
  kind: CoachKind;
  /** Short sentence explaining the call, shown under the number. */
  reason: string;
  /** How many past sessions the call is based on. */
  basis: number;
}

function bestSet(sets: { weight: number; reps: number }[]): { weight: number; reps: number } {
  return sets.reduce((best, s) => {
    const a = estimate1RM(s.weight, s.reps);
    const b = estimate1RM(best.weight, best.reps);
    if (a > b) return s;
    if (a === b && s.weight > best.weight) return s;
    return best;
  });
}

/**
 * Progressive overload, double progression style:
 * hit the top of the rep window and every working set counts, so add weight and
 * drop back to the bottom of the window. Fall short and the weight stays put.
 * A dip in estimated strength across two sessions reads as fatigue, so back off.
 */
export function suggestNext(input: {
  history: CoachSession[]; // most recent first, current session included
  goal: Goal;
  experience: Experience;
  equipment?: string;
}): CoachSuggestion | null {
  const { history, goal, experience, equipment } = input;
  const current = history[0];
  if (!current || current.sets.length === 0) return null;

  const window = REP_WINDOW[goal] ?? REP_WINDOW.general;
  const top = bestSet(current.sets);
  const basis = history.length;
  const step = weightStep(equipment, experience);

  // Reps only, nothing to load.
  if (step === null) {
    const reps = Math.min(window.max, top.reps + 2);
    return {
      weight: top.weight,
      reps,
      kind: "reps",
      reason:
        top.reps >= window.target
          ? `You cleared ${top.reps} bodyweight reps. Aim for ${reps} next.`
          : `Same movement, aim for ${reps} reps.`,
      basis,
    };
  }

  // Two sessions in a row going backwards on estimated strength: deload.
  const previous = history[1];
  if (previous && previous.sets.length > 0) {
    const prevTop = bestSet(previous.sets);
    const now = estimate1RM(top.weight, top.reps);
    const before = estimate1RM(prevTop.weight, prevTop.reps);
    if (before > 0 && now < before * 0.95) {
      const eased = Math.max(step, round2(top.weight - step * 2));
      return {
        weight: eased,
        reps: window.min,
        kind: "deload",
        reason: `Estimated strength dipped since last time. Ease back to ${eased} kg and rebuild.`,
        basis,
      };
    }
  }

  const everySetCounted = current.sets.every((s) => s.reps >= window.min);
  const clearedTarget = top.reps >= window.target && everySetCounted;

  if (clearedTarget) {
    const next = round2(top.weight + step);
    return {
      weight: next,
      reps: window.min,
      kind: "increase",
      reason: `Every set cleared ${window.target}+. Add ${step} kg and start at ${window.min}.`,
      basis,
    };
  }

  if (top.reps < window.min) {
    const reps = Math.min(window.max, top.reps + 2);
    return {
      weight: top.weight,
      reps,
      kind: "reps",
      reason:
        basis > 1
          ? `Same weight, chase ${reps} reps before adding load.`
          : `First time on this lift. Start light and settle on ${reps} clean reps.`,
      basis,
    };
  }

  const reps = Math.min(window.max, top.reps + 1);
  return {
    weight: top.weight,
    reps,
    kind: "hold",
    reason:
      basis > 1
        ? "Mid range. Repeat the weight and add a rep."
        : "First time logged. Repeat this weight to get a baseline.",
    basis,
  };
}