import { estimate1RM } from "./coach";
import type { WorkoutSet } from "./data";

/**
 * Ranks, from the plainest life upward.
 *
 * The ladder climbs out of the underworld and keeps going: what you are, then
 * what you were remembered as, then what you were born as, then what you became,
 * then what you were always going to be.
 */
export const RANKS = [
  { name: "Mortal", blurb: "Lifting things. Everyone starts here." },
  { name: "Shade", blurb: "You go back to the bar." },
  { name: "Hero", blurb: "Named in a song somebody else writes." },
  { name: "Demigod", blurb: "Half of you will not stay down." },
  { name: "Titan", blurb: "Carried a world. Your arms know it." },
  { name: "Olympian", blurb: "You belong on the hill with the others." },
  { name: "God", blurb: "The weight moved for you." },
  { name: "Primordial", blurb: "Before gods. Before names." },
] as const;

export interface RankedLift {
  /** Canonical label shown in the UI. */
  name: string;
  /**
   * Exact exercise names as they exist in free-exercise-db, the dataset this
   * app seeds its catalog from. Matching on the real strings rather than a
   * pattern is deliberate: there is no exercise called "Bench Press" or "Squat"
   * in that dataset, they are "Barbell Bench Press - Medium Grip" and
   * "Barbell Squat", so a loose pattern would silently rank almost nobody.
   */
  names: string[];
  /** Estimated 1RM in kg needed for each rank, ascending. Same length as RANKS. */
  thresholds: number[];
}

/**
 * Popular compound lifts only, and only the loaded ones.
 *
 * A rank per muscle group was deliberately not done: it rewards training a
 * body part for its own sake, and it says nothing about strength. A squat, a
 * bench and a deadlift all mean the same thing when they move, so they share one
 * ladder and only the thresholds differ.
 *
 * Variations of the same barbell lift are listed together, so a wide-stance
 * squat still counts towards the squat. Pull-ups and dips are left out on
 * purpose: they are bodyweight movements, so a kilogram ladder would be
 * measuring the person, not the lift.
 *
 * Thresholds are calibrated against common intermediate and advanced strength
 * standards. They are a starting point rather than a verdict, and this file is
 * meant to be edited.
 */
export const RANKED_LIFTS: RankedLift[] = [
  {
    name: "Deadlift",
    names: [
      "Barbell Deadlift",
      "Deficit Deadlift",
      "Sumo Deadlift",
      "Sumo Deadlift with Chains",
      "Rickshaw Deadlift",
      "Trap Bar Deadlift",
    ],
    thresholds: [80, 120, 160, 190, 220, 250, 280, 320],
  },
  {
    name: "Squat",
    names: [
      "Barbell Squat",
      "Barbell Full Squat",
      "Wide Stance Barbell Squat",
      "Narrow Stance Squats",
      "Barbell Squat To A Bench",
    ],
    thresholds: [60, 100, 140, 170, 200, 225, 260, 300],
  },
  {
    name: "Bench Press",
    names: [
      "Barbell Bench Press - Medium Grip",
      "Bench Press - Powerlifting",
      "Wide-Grip Barbell Bench Press",
      "Close-Grip Barbell Bench Press",
    ],
    thresholds: [50, 80, 100, 120, 140, 160, 180, 205],
  },
  {
    name: "Front Squat",
    names: ["Front Barbell Squat", "Front Squat (Clean Grip)"],
    thresholds: [50, 80, 110, 140, 170, 195, 220, 250],
  },
  {
    name: "Overhead Press",
    names: [
      "Barbell Shoulder Press",
      "Standing Military Press",
      "Seated Barbell Military Press",
      "Standing Barbell Press Behind Neck",
      "Smith Machine Overhead Shoulder Press",
    ],
    thresholds: [30, 50, 65, 80, 92, 105, 120, 135],
  },
  {
    name: "Bent Over Row",
    names: [
      "Bent Over Barbell Row",
      "Bent Over Two-Arm Long Bar Row",
      "Bent Over One-Arm Long Bar Row",
    ],
    thresholds: [40, 70, 95, 115, 135, 155, 175, 200],
  },
  {
    name: "Romanian Deadlift",
    names: [
      "Romanian Deadlift",
      "Romanian Deadlift from Deficit",
      "Stiff-Legged Barbell Deadlift",
      "Smith Machine Stiff-Legged Deadlift",
    ],
    thresholds: [60, 100, 130, 160, 185, 210, 240, 270],
  },
  {
    name: "Power Clean",
    names: ["Power Clean", "Power Clean from Blocks", "Smith Machine Hang Power Clean"],
    thresholds: [50, 70, 90, 110, 125, 145, 165, 185],
  },
  {
    name: "Incline Bench Press",
    names: [
      "Barbell Incline Bench Press - Medium Grip",
      "Smith Machine Incline Bench Press",
      "Leverage Incline Chest Press",
    ],
    thresholds: [40, 70, 95, 115, 130, 150, 170, 190],
  },
];

/** Trims and folds case and spacing, so a stray double space cannot miss. */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Catalog name to canonical lift, built once. */
const LOOKUP = new Map<string, string>();
for (const lift of RANKED_LIFTS) {
  for (const n of lift.names) LOOKUP.set(normalise(n), lift.name);
}

/** Which ranked lift, if any, a catalog exercise is. */
export function rankedLiftFor(exerciseName: string): RankedLift | null {
  const hit = LOOKUP.get(normalise(exerciseName));
  return hit ? (RANKED_LIFTS.find((l) => l.name === hit) ?? null) : null;
}

export interface LiftRank {
  lift: string;
  /** Best estimated 1RM in kg, or null when the lift has never been logged. */
  e1rm: number | null;
  /** Zero based index into RANKS. */
  tier: number;
  rank: string;
  blurb: string;
  /** kg still needed for the next rank, or null at the top. */
  remainingKg: number | null;
  nextRank: string | null;
}

/** Progress towards the next rung, 0 to 1. Null when the lift is unstarted. */
export function rankProgress(lift: LiftRank): number | null {
  if (lift.e1rm === null) return null;
  if (lift.remainingKg === null) return 1;
  const floor = lift.tier === 0 ? 0 : (RANKED_LIFTS.find((l) => l.name === lift.lift)?.thresholds[
    lift.tier - 1
  ] ?? 0);
  const ceiling = RANKED_LIFTS.find((l) => l.name === lift.lift)?.thresholds[lift.tier] ?? 1;
  const span = Math.max(1, ceiling - floor);
  return Math.min(1, Math.max(0, (lift.e1rm - floor) / span));
}

function rankForE1rm(liftDef: RankedLift, e1rm: number | null): Pick<LiftRank, "tier" | "rank" | "blurb" | "remainingKg" | "nextRank"> {
  if (e1rm === null) {
    return {
      tier: -1,
      rank: "Unranked",
      blurb: "Log a set to earn a place on the ladder.",
      remainingKg: liftDef.thresholds[0],
      nextRank: RANKS[0].name,
    };
  }
  let tier = 0;
  for (let i = 0; i < liftDef.thresholds.length; i++) {
    if (e1rm >= liftDef.thresholds[i]) tier = i;
  }
  const nextRank = tier + 1 < RANKS.length ? RANKS[tier + 1].name : null;
  return {
    tier,
    rank: RANKS[tier].name,
    blurb: RANKS[tier].blurb,
    remainingKg: nextRank ? liftDef.thresholds[tier + 1] - e1rm : null,
    nextRank,
  };
}

/**
 * Best estimated 1RM per ranked lift, taken from everything ever logged.
 *
 * Reps below one are dropped: a zero or negative rep count would inflate the
 * estimate into nonsense rather than fail loudly.
 */
export function buildRanks(sets: Iterable<WorkoutSet>): LiftRank[] {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.reps < 1 || s.weight <= 0) continue;
    const def = rankedLiftFor(s.exerciseName);
    if (!def) continue;
    const e = estimate1RM(s.weight, s.reps);
    const current = best.get(def.name);
    if (current === undefined || e > current) best.set(def.name, e);
  }
  // Lifts never touched still deserve a row, so the ladder reads as a whole.
  return RANKED_LIFTS.map((def) => {
    const e1rm = best.get(def.name) ?? null;
    return {
      lift: def.name,
      e1rm,
      ...rankForE1rm(def, e1rm),
    };
  });
}
