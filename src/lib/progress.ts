import type { Workout, WorkoutSet } from "./data";
import { estimate1RM } from "./coach";

/* ---------- Dates ---------- */

/** Local midnight of a YYYY-MM-DD string. Never new Date(iso), which shifts days by timezone. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Monday of the week containing d. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

/** "12 Sep", for axis labels where space is tight. */
export function shortDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/* ---------- Strength ---------- */

export interface StrengthPoint {
  date: string;
  /** Best estimated one rep max of that day, in kg. */
  e1rm: number;
  /** The set that produced it. */
  weight: number;
  reps: number;
}

function completedInOrder(workouts: Workout[]): Workout[] {
  return workouts
    .filter((w) => w.completed)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.date.localeCompare(b.date));
}

/**
 * Best estimated one rep max per day for one exercise, oldest first. Days with
 * two sessions collapse to the stronger of the two so the line stays readable.
 */
export function strengthSeries(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>,
  exerciseName: string
): StrengthPoint[] {
  const byDate = new Map<string, StrengthPoint>();

  for (const w of completedInOrder(workouts)) {
    let best: StrengthPoint | null = null;
    for (const s of setsByWorkout.get(w.id) ?? []) {
      if (s.exerciseName !== exerciseName || s.weight <= 0) continue;
      const e = estimate1RM(s.weight, s.reps);
      if (!best || e > best.e1rm) {
        best = { date: w.date, e1rm: e, weight: s.weight, reps: s.reps };
      }
    }
    if (!best) continue;
    const existing = byDate.get(best.date);
    if (!existing || best.e1rm > existing.e1rm) byDate.set(best.date, best);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExerciseSummary {
  exerciseName: string;
  /** Heaviest estimated one rep max ever, in kg. */
  best: number;
  bestDate: string;
  /** First time the lift was logged, in kg. */
  first: number;
  /** Percent gained since that first session. */
  changePct: number;
  sessions: number;
}

/** Every exercise with load on it, strongest first. */
export function exerciseSummaries(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>
): ExerciseSummary[] {
  const names = new Set<string>();
  for (const sets of setsByWorkout.values()) {
    for (const s of sets) {
      if (s.weight > 0 && s.exerciseName) names.add(s.exerciseName);
    }
  }

  const summaries: ExerciseSummary[] = [];
  for (const name of names) {
    const series = strengthSeries(workouts, setsByWorkout, name);
    if (series.length === 0) continue;
    const first = series[0];
    const best = series.reduce((b, p) => (p.e1rm > b.e1rm ? p : b));
    summaries.push({
      exerciseName: name,
      best: best.e1rm,
      bestDate: best.date,
      first: first.e1rm,
      changePct: first.e1rm > 0 ? ((best.e1rm - first.e1rm) / first.e1rm) * 100 : 0,
      sessions: series.length,
    });
  }
  return summaries.sort((a, b) => b.best - a.best);
}

export function formatChange(pct: number): string {
  if (Math.abs(pct) < 0.5) return "level";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

/* ---------- Weekly volume ---------- */

export interface VolumePoint {
  /** Monday of that week, YYYY-MM-DD. */
  weekStart: string;
  volume: number; // kg
  sets: number;
  workouts: number;
}

/**
 * Training volume bucketed into whole weeks, oldest first, including empty weeks
 * so the chart shows real gaps instead of quietly compressing time.
 */
export function weeklyVolume(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>,
  weeks = 8,
  today = new Date()
): VolumePoint[] {
  const currentWeekStart = startOfWeek(today);
  const buckets: VolumePoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ weekStart: toISODate(start), volume: 0, sets: 0, workouts: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const w of completedInOrder(workouts)) {
    const key = toISODate(startOfWeek(parseISODate(w.date)));
    const i = index.get(key);
    if (i === undefined) continue; // older than the window we are drawing
    const bucket = buckets[i];
    bucket.workouts += 1;
    for (const s of setsByWorkout.get(w.id) ?? []) {
      bucket.sets += 1;
      bucket.volume += s.weight * s.reps;
    }
  }

  return buckets;
}

export function totalVolume(points: VolumePoint[]): number {
  return points.reduce((sum, p) => sum + p.volume, 0);
}