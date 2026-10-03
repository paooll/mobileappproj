/**
 * The weekly digest's arithmetic, kept free of Firebase and Knock so it can be
 * reasoned about and tested on its own.
 *
 * Lives in the app source rather than in the job that runs it, because the job
 * is a script executed by GitHub Actions and this way both sides share one copy.
 * Nothing in the app imports it, so it never reaches the bundle.
 *
 * Dates here are UTC `YYYY-MM-DD` strings, because that is exactly what the
 * client writes to `workouts.date`. Anything else would drift by a day for
 * athletes in far-off timezones.
 */

export interface WorkoutLite {
  id: string;
  name: string;
  date: string;
  completed: boolean;
}

export interface SetLite {
  exerciseName: string;
  weight: number;
  reps: number;
}

export interface TopSet {
  exercise: string;
  weightKg: number;
  reps: number;
}

export interface WeekDigest {
  weekFrom: string;
  weekTo: string;
  sessions: number;
  sets: number;
  volumeKg: number;
  previousVolumeKg: number;
  /** Change against the week before, or null when there is nothing to compare. */
  changePct: number | null;
  headline: string;
  subline: string;
  topSets: TopSet[];
}

/** `YYYY-MM-DD`, n days before `now`, in UTC. */
export function isoDaysAgo(n: number, now: Date = new Date()): string {
  return new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Day of the week (0 = Sunday) where the athlete actually lives, not where the
 * server does. `tzHours` is hours east of UTC.
 *
 * Computed from whole days since the Unix epoch, which was a Thursday, so a
 * half-day offset from a DST change only matters on the day it happens.
 */
export function dayOfWeekInZone(now: Date, tzHours: number): number {
  const localDays = now.getTime() / 86_400_000 + tzHours / 24;
  return (((Math.floor(localDays) + 4) % 7) + 7) % 7;
}

export function isDigestDay(now: Date, digestDay: number, tzHours: number): boolean {
  if (!Number.isFinite(digestDay)) return false;
  return dayOfWeekInZone(now, tzHours) === Math.round(digestDay);
}

/** 12480 -> "12.5t", 940 -> "940kg" */
function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

function volumeOf(sets: SetLite[]): number {
  return sets.reduce((total, s) => total + s.weight * s.reps, 0);
}

/**
 * Turns two weeks of training into the handful of numbers an email can carry.
 * A week with nothing in it still summarises cleanly; deciding not to mail
 * someone is the caller's policy, not the summariser's.
 */
export function summarize(
  workouts: WorkoutLite[],
  setsByWorkout: Map<string, SetLite[]>,
  fromISO: string,
  toISO: string,
  previousFromISO: string
): WeekDigest {
  const done = workouts.filter((w) => w.completed);

  const thisWeek = done.filter((w) => w.date >= fromISO && w.date <= toISO);
  const lastWeek = done.filter((w) => w.date >= previousFromISO && w.date < fromISO);

  const setsOf = (list: WorkoutLite[]) => list.flatMap((w) => setsByWorkout.get(w.id) ?? []);

  const weekSets = setsOf(thisWeek);
  const volumeKg = volumeOf(weekSets);
  const previousVolumeKg = volumeOf(setsOf(lastWeek));

  const changePct =
    previousVolumeKg > 0
      ? Math.round(((volumeKg - previousVolumeKg) / previousVolumeKg) * 100)
      : null;

  const sessions = thisWeek.length;

  // Heaviest first, ties broken by reps, so the email opens on the set that
  // actually earned the week its headline.
  const topSets: TopSet[] = [...weekSets]
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)
    .slice(0, 3)
    .map((s) => ({
      exercise: s.exerciseName,
      weightKg: Math.round(s.weight * 10) / 10,
      reps: s.reps,
    }));

  let subline: string;
  if (sessions === 0) {
    subline = "Nothing logged in the last seven days. Rest days count as training.";
  } else if (changePct === null) {
    subline = "Your first tracked week, so there is nothing to compare it against yet.";
  } else if (changePct > 0) {
    subline = `${changePct}% more volume than the week before.`;
  } else if (changePct < 0) {
    subline = `${Math.abs(changePct)}% less volume than the week before.`;
  } else {
    subline = "Exactly the same volume as the week before.";
  }

  return {
    weekFrom: fromISO,
    weekTo: toISO,
    sessions,
    sets: weekSets.length,
    volumeKg: Math.round(volumeKg),
    previousVolumeKg: Math.round(previousVolumeKg),
    changePct,
    headline:
      sessions === 0 ? "A quiet week" : `${sessions} session${sessions === 1 ? "" : "s"} logged`,
    subline: `${formatVolume(volumeKg)} lifted. ${subline}`,
    topSets,
  };
}