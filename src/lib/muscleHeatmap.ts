import type { Workout, WorkoutSet, Exercise } from "./data";

export type MuscleZone = "Chest" | "Back" | "Shoulders" | "Arms" | "Abs" | "Legs";

export interface ZoneActivity {
  zone: MuscleZone;
  sets: number;
  level: "untrained" | "light" | "moderate" | "high";
  color: string;
}

const MUSCLE_TO_ZONE: Record<string, MuscleZone> = {
  Chest: "Chest",
  Back: "Back",
  Shoulders: "Shoulders",
  Arms: "Arms",
  Abs: "Abs",
  Legs: "Legs",
  Hips: "Legs",
};

/**
 * Calculates muscle volume and heat level for the past 7 days.
 */
export function calculateMuscleHeat(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>,
  exercises: Exercise[],
  nowMs: number = Date.now()
): Record<MuscleZone, ZoneActivity> {
  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const catalogMap = new Map<string, MuscleZone>();
  for (const ex of exercises) {
    const zone = MUSCLE_TO_ZONE[ex.muscleGroup] ?? "Arms";
    catalogMap.set(ex.name.toLowerCase(), zone);
  }

  const counts: Record<MuscleZone, number> = {
    Chest: 0,
    Back: 0,
    Shoulders: 0,
    Arms: 0,
    Abs: 0,
    Legs: 0,
  };

  for (const w of workouts) {
    if (w.date < sevenDaysAgo) continue;
    const sets = setsByWorkout.get(w.id) ?? [];
    for (const s of sets) {
      const zone = catalogMap.get(s.exerciseName.toLowerCase());
      if (zone && counts[zone] !== undefined) {
        counts[zone] += 1;
      }
    }
  }

  const result: Partial<Record<MuscleZone, ZoneActivity>> = {};
  const zones: MuscleZone[] = ["Chest", "Back", "Shoulders", "Arms", "Abs", "Legs"];

  for (const zone of zones) {
    const sets = counts[zone];
    let level: ZoneActivity["level"] = "untrained";
    let color = "var(--line)";

    if (sets >= 10) {
      level = "high";
      color = "#f97316"; // Bright amber/orange
    } else if (sets >= 5) {
      level = "moderate";
      color = "#eab308"; // Warm gold
    } else if (sets >= 1) {
      level = "light";
      color = "#0ea5e9"; // Fresh blue
    }

    result[zone] = {
      zone,
      sets,
      level,
      color,
    };
  }

  return result as Record<MuscleZone, ZoneActivity>;
}
