import type { Workout, WorkoutSet } from "./data";
import type { UserProfile } from "./profile";
import { estimate1RM, suggestNext, type CoachSession } from "./coach";
import {
  parseISODate,
  shortDate,
  strengthSeries,
  weeklyVolume,
  type StrengthPoint,
} from "./progress";
import { formatVolume, toDisplay, type Unit } from "./units";

/* ---------- Shape ---------- */

export type BrainIntent =
  | "stall"
  | "increase"
  | "today"
  | "neglect"
  | "strongest"
  | "volume"
  | "consistency"
  | "last"
  | "unknown";

export interface BrainFact {
  label: string;
  value: string;
}

export interface BrainChart {
  kind: "trend" | "bars";
  points: { label: string; value: number }[];
  caption: string;
}

export interface BrainAnswer {
  intent: BrainIntent;
  /** The direct answer, in one sentence. */
  headline: string;
  facts: BrainFact[];
  /** Supporting evidence, most important first. */
  points: string[];
  chart?: BrainChart;
  action?: { label: string; to: string };
}

export interface CatalogEntry {
  muscleGroup: string;
  equipment: string;
}

/** Resolves logged exercise names against the shared catalog. */
export interface Catalog {
  of: (exerciseName: string) => CatalogEntry | undefined;
  /** Every muscle group the catalog knows about, so untouched ones can be named. */
  groups: () => string[];
  /** Catalog lifts for a group, used when the athlete has never trained it. */
  picksFor: (group: string) => string[];
}

export interface AskInput {
  question: string;
  workouts: Workout[];
  setsByWorkout: Map<string, WorkoutSet[]>;
  profile: UserProfile;
  unit: Unit;
  today: Date;
  catalog: Catalog;
}

/* ---------- Helpers ---------- */

const DAY = 86_400_000;

function kg(value: number, unit: Unit): string {
  return `${toDisplay(value, unit)} ${unit}`;
}

function vol(value: number, unit: Unit): string {
  const v = formatVolume(value, unit);
  return `${v.value} ${v.suffix}`;
}

function daysBetween(from: string, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - parseISODate(from).getTime()) / DAY));
}

function completed(workouts: Workout[]): Workout[] {
  return workouts
    .filter((w) => w.completed)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.date.localeCompare(b.date));
}

function round(value: number): number {
  return Math.round(value);
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function pctChange(from: number, to: number): number {
  return from > 0 ? ((to - from) / from) * 100 : 0;
}

/* ---------- Understanding the question ---------- */

const STOP = new Set([
  "my", "the", "on", "for", "should", "what", "why", "how", "much", "did", "does", "do",
  "am", "are", "me", "to", "of", "in", "it", "this", "that", "can", "could", "would",
  "please", "help", "was", "were", "been", "have", "has", "had", "with", "about",
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
}

const INTENT_PATTERNS: { intent: BrainIntent; patterns: RegExp[] }[] = [
  {
    intent: "stall",
    patterns: [
      /not (progress|going|improv|moving)/,
      /no progress/,
      /plateau/,
      /stuck/,
      /stalled/,
      /why.*(progress|stronger)/,
      /not going up/,
    ],
  },
  {
    intent: "increase",
    patterns: [
      /increase/,
      /add (more )?(weight|kg|kilo|load)/,
      /heavier/,
      /go up/,
      /add weight/,
      /more weight/,
      /should i (lift|add)/,
    ],
  },
  {
    intent: "today",
    patterns: [
      /what (should|do) i (train|do)/,
      /what.*today/,
      /next (workout|session|lift)/,
      /train (today|next)/,
      /what now/,
      /what should i be doing/,
      /today.*train/,
    ],
  },
  {
    intent: "neglect",
    patterns: [
      /neglect/,
      /ignor/,
      /undertrain/,
      /missing/,
      /skipping/,
      /which muscle/,
      /haven'?t (trained|hit|touched)/,
      /what am i missing/,
    ],
  },
  {
    intent: "strongest",
    patterns: [
      /strongest/,
      /best (workout|session|month)/,
      /biggest/,
      /heaviest workout/,
      /best session/,
      /most impressive/,
      /best day/,
    ],
  },
  {
    intent: "volume",
    patterns: [/volume/, /tonnage/, /how much (have|did|am)/, /total load/, /how heavy/],
  },
  {
    intent: "consistency",
    patterns: [/streak/, /how often/, /consisten/, /frequency/, /how many (times|workouts|sessions)/],
  },
  {
    intent: "last",
    patterns: [/what did i (do|last)/, /last (workout|session|time|thing)/, /most recent/, /yesterday/],
  },
];

/** Picks the intent with the strongest keyword evidence, not just the first hit. */
export function parseIntent(question: string): BrainIntent {
  const q = question.toLowerCase();
  let best: { intent: BrainIntent; score: number } | null = null;
  for (const { intent, patterns } of INTENT_PATTERNS) {
    const score = patterns.reduce((n, p) => (p.test(q) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  return best?.intent ?? "unknown";
}

/**
 * Finds the lift the athlete means. Matches whole words so "bench" lands on
 * "Bench Press" rather than "Incline Bench Press", and prefers the name whose
 * words the question actually covered.
 */
export function extractExercise(
  question: string,
  candidates: string[]
): string | null {
  const tokens = new Set(normalize(question));
  let best: { name: string; score: number } | null = null;

  for (const name of candidates) {
    const parts = normalize(name);
    if (parts.length === 0) continue;
    const hits = parts.filter((t) => tokens.has(t)).length;
    if (hits === 0) continue;
    // Coverage first, so a question naming every word of a lift wins outright,
    // then raw hits, then the shorter name as the less speculative guess
    const score = (hits / parts.length) * 100 + hits * 2 - parts.length * 0.1;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

/* ---------- Per-exercise picture ---------- */

interface LiftStats {
  name: string;
  sessions: number;
  firstDate: string;
  lastDate: string;
  daysSince: number;
  avgGapDays: number;
  /** Per-session averages, oldest first. */
  setsPerSession: number[];
  repsPerSet: number[];
  volumePerSession: number[];
  topSetPerSession: { weight: number; reps: number }[];
  series: StrengthPoint[];
  bestE1rm: number;
}

/** Everything the diagnostics need about one lift, computed once. */
export function liftStats(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>,
  name: string,
  today: Date
): LiftStats | null {
  const days: LiftStats["topSetPerSession"] extends never ? never : { date: string; sets: WorkoutSet[] }[] = [];

  for (const w of completed(workouts)) {
    const mine = (setsByWorkout.get(w.id) ?? []).filter((s) => s.exerciseName === name);
    if (mine.length > 0) days.push({ date: w.date, sets: mine });
  }
  if (days.length === 0) return null;

  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) {
    gaps.push(
      Math.round((parseISODate(days[i].date).getTime() - parseISODate(days[i - 1].date).getTime()) / DAY)
    );
  }

  const series = strengthSeries(workouts, setsByWorkout, name);

  return {
    name,
    sessions: days.length,
    firstDate: days[0].date,
    lastDate: days[days.length - 1].date,
    daysSince: daysBetween(days[days.length - 1].date, today),
    avgGapDays: avg(gaps),
    setsPerSession: days.map((d) => d.sets.length),
    repsPerSet: days.map((d) => avg(d.sets.map((s) => s.reps))),
    volumePerSession: days.map((d) => d.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)),
    topSetPerSession: days.map((d) => {
      const top = d.sets.reduce((best, s) =>
        estimate1RM(s.weight, s.reps) > estimate1RM(best.weight, best.reps) ? s : best
      );
      return { weight: top.weight, reps: top.reps };
    }),
    series,
    bestE1rm: series.length ? Math.max(...series.map((p) => p.e1rm)) : 0,
  };
}

function recentMean(values: number[], count: number): number {
  return avg(values.slice(-count));
}

function earlierMean(values: number[], count: number): number {
  return avg(values.slice(Math.max(0, values.length - count * 2), Math.max(0, values.length - count)));
}

/* ---------- Diagnostics ---------- */

/**
 * Works out the most likely reason a lift has stalled, and shows the numbers
 * behind it. Fatigue, falling volume and low frequency all look identical from
 * the outside, so the rules are ordered by how actionable each cause is.
 */
function diagnoseStall(
  stats: LiftStats,
  profile: UserProfile,
  unit: Unit,
  today: Date
): BrainAnswer {
  const facts: BrainFact[] = [
    { label: "Best est 1RM", value: kg(stats.bestE1rm, unit) },
    { label: "Sessions", value: String(stats.sessions) },
    { label: "Days since", value: `${stats.daysSince}d` },
  ];
  const points: string[] = [];

  if (stats.sessions < 3) {
    return {
      intent: "stall",
      headline: `Only ${stats.sessions} ${stats.sessions === 1 ? "session" : "sessions"} of ${stats.name} on record, which is not enough to call it a plateau.`,
      facts,
      points: [
        `First logged ${shortDate(stats.firstDate)}, most recent ${shortDate(stats.lastDate)}.`,
        "Three or more sessions gives a trend worth reading.",
      ],
      action: { label: "See the trend", to: "/app/progress" },
    };
  }

  const series = stats.series;
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const overall = pctChange(series[0].e1rm, stats.bestE1rm);

  let headline: string;
  let verdict: "fatigue" | "volume" | "frequency" | "reps" | "plateau" | "progressing";

  const dropped = previous.e1rm > 0 && latest.e1rm < previous.e1rm * 0.95;
  const volumeDown =
    earlierMean(stats.volumePerSession, 2) > 0 &&
    recentMean(stats.volumePerSession, 2) < earlierMean(stats.volumePerSession, 2) * 0.8;
  const repsDown = recentMean(stats.repsPerSet, 2) < earlierMean(stats.repsPerSet, 2) - 1;
  const flat = Math.abs(overall) < 2;
  const slow = stats.avgGapDays >= 5;

  if (dropped) verdict = "fatigue";
  else if (volumeDown) verdict = "volume";
  else if (repsDown) verdict = "reps";
  // Only blame frequency when the numbers are actually flat, otherwise a weekly
  // session that is going up would get scolded for being weekly
  else if (flat && slow && profile.goal === "strength") verdict = "frequency";
  else if (flat) verdict = "plateau";
  else verdict = "progressing";

  switch (verdict) {
    case "fatigue":
      headline = `${stats.name} looks like fatigue rather than a lack of effort: your last session came in below the one before it.`;
      points.push(
        `Last session peaked at ${kg(latest.e1rm, unit)} estimated, against ${kg(previous.e1rm, unit)} the session before.`,
        `Your best ever is still ${kg(stats.bestE1rm, unit)}, so nothing has been lost, it just was not on the day.`
      );
      points.push(
        stats.daysSince >= 3
          ? `It has been ${stats.daysSince} days since you trained it, which is long enough to come back fresh.`
          : `Only ${stats.daysSince} days of rest. Coming straight back at the same weight would repeat the mistake.`
      );
      break;
    case "volume":
      headline = `You are doing less work per session on ${stats.name} than you were, and volume is what drives the adaptation.`;
      points.push(
        `Volume per session dropped from ${vol(earlierMean(stats.volumePerSession, 2), unit)} to ${vol(recentMean(stats.volumePerSession, 2), unit)}.`,
        `Sets per session: ${recentMean(stats.setsPerSession, 2).toFixed(1)} recently, ${earlierMean(stats.setsPerSession, 2).toFixed(1)} before.`
      );
      break;
    case "reps":
      headline = `Your reps per set are sliding on ${stats.name} while the weight stays put, which is the classic sign you are out of recovery.`;
      points.push(
        `Reps per set went from ${earlierMean(stats.repsPerSet, 2).toFixed(1)} to ${recentMean(stats.repsPerSet, 2).toFixed(1)}.`,
        `Estimated 1RM is roughly flat at ${kg(stats.bestE1rm, unit)}, so this is fatigue, not a strength ceiling.`
      );
      break;
    case "frequency":
      headline = `${stats.name} is moving too slowly to adapt: about every ${stats.avgGapDays.toFixed(1)} days.`;
      points.push(
        `You have trained it ${stats.sessions} times over ${Math.max(1, daysBetween(stats.firstDate, today))} days.`,
        "Two sessions a week is the usual minimum for real progress on a lift."
      );
      break;
    case "plateau":
      headline = `${stats.name} is genuinely plateaued at ${kg(stats.bestE1rm, unit)}: the volume and reps are consistent, the number just is not moving.`;
      points.push(
        `Volume per session has held around ${vol(avg(stats.volumePerSession.slice(-2)), unit)}.`,
        "Consistent effort with no change usually means the load is too light for the target."
      );
      points.push("Adding a little weight and dropping back to the bottom of your rep range is the usual next move.");
      break;
    case "progressing":
      headline = `You are progressing on ${stats.name}: up ${round(overall)}% on estimated 1RM since you started.`;
      points.push(
        `From ${kg(series[0].e1rm, unit)} on ${shortDate(series[0].date)} to a best of ${kg(stats.bestE1rm, unit)}.`,
        `The most recent session sat at ${kg(latest.e1rm, unit)}, so there may still be room to push.`
      );
      break;
  }

  return {
    intent: "stall",
    headline,
    facts,
    points,
    chart: {
      kind: "trend",
      points: series.map((p) => ({ label: shortDate(p.date), value: p.e1rm })),
      caption: "Estimated one rep max",
    },
    action: { label: "Open progress", to: "/app/progress" },
  };
}

function answerIncrease(
  stats: LiftStats,
  profile: UserProfile,
  equipment: string | undefined,
  unit: Unit
): BrainAnswer {
  const history: CoachSession[] = [];
  // Rebuild the per-session history the coach expects from the same stats
  for (let i = 0; i < stats.sessions; i++) {
    history.push({
      date: stats.series[i]?.date ?? stats.firstDate,
      sets: [{ weight: stats.topSetPerSession[i].weight, reps: stats.topSetPerSession[i].reps }],
    });
  }
  const suggestion = suggestNext({
    history,
    goal: profile.goal,
    experience: profile.experience,
    equipment,
  });

  const facts: BrainFact[] = [
    { label: "Best est 1RM", value: kg(stats.bestE1rm, unit) },
    { label: "Days since", value: `${stats.daysSince}d` },
  ];

  if (!suggestion) {
    return {
      intent: "increase",
      headline: `Not enough history on ${stats.name} to call the weight yet.`,
      facts,
      points: ["Log a few sessions at a weight you can control and the call gets much sharper."],
    };
  }

  const trend = stats.series.length > 1
    ? {
        kind: "trend" as const,
        points: stats.series.map((p) => ({ label: shortDate(p.date), value: p.e1rm })),
        caption: "Estimated one rep max",
      }
    : undefined;

  if (suggestion.kind === "increase") {
    facts.push({ label: "Next attempt", value: `${kg(suggestion.weight, unit)} × ${suggestion.reps}` });
    return {
      intent: "increase",
      headline: `Yes. Go to ${kg(suggestion.weight, unit)} for ${suggestion.reps} reps.`,
      facts,
      points: [
        suggestion.reason,
        stats.daysSince >= 2
          ? `${stats.daysSince} days since the last session, so you are recovered enough to try it.`
          : `Only ${stats.daysSince} day since the last session. Coming in fresh would make this weight likelier to land.`,
      ],
      chart: trend,
      action: { label: "Open progress", to: "/app/progress" },
    };
  }

  if (suggestion.kind === "deload") {
    facts.push({ label: "Suggested", value: `${kg(suggestion.weight, unit)} × ${suggestion.reps}` });
    return {
      intent: "increase",
      headline: `Not yet. Ease back to ${kg(suggestion.weight, unit)} for a session or two before adding anything.`,
      facts,
      points: [suggestion.reason, "Deloading now is what keeps the next progression from stalling."],
      chart: trend,
      action: { label: "Open progress", to: "/app/progress" },
    };
  }

  facts.push({ label: "Hold at", value: `${kg(suggestion.weight, unit)} × ${suggestion.reps}` });
  return {
    intent: "increase",
    headline: `Not yet. Hold ${kg(suggestion.weight, unit)} and chase ${suggestion.reps} reps instead.`,
    facts,
    points: [
      suggestion.reason,
      stats.daysSince >= 4
        ? `It has been ${stats.daysSince} days, so the limit is reps rather than recovery.`
        : `At ${stats.daysSince} days rest, the honest call is more reps at the same weight.`,
    ],
    chart: trend,
  };
}

/* ---------- Muscle picture ---------- */

interface GroupStats {
  group: string;
  sessions: number;
  /** null when the group has never been trained at all. */
  daysSince: number | null;
  setsPerWeek: number;
  lastDate: string;
}

function groupStats(
  workouts: Workout[],
  setsByWorkout: Map<string, WorkoutSet[]>,
  catalog: Catalog,
  today: Date
): GroupStats[] {
  const byGroup = new Map<string, { dates: Set<string>; last: string; sets: number }>();

  for (const w of completed(workouts)) {
    for (const s of setsByWorkout.get(w.id) ?? []) {
      const catalogEntry = catalog.of(s.exerciseName);
      if (!catalogEntry) continue;
      const group = canonicalGroup(catalogEntry.muscleGroup);
      const stats = byGroup.get(group) ?? { dates: new Set<string>(), last: "", sets: 0 };
      stats.dates.add(w.date);
      stats.sets += 1;
      if (w.date > stats.last) stats.last = w.date;
      byGroup.set(group, stats);
    }
  }

  const spanWeeks = Math.max(1, (today.getTime() - parseISODate(earliest(byGroup)).getTime()) / DAY / 7);

  const trained = [...byGroup.entries()].map(([group, e]) => ({
    group,
    sessions: e.dates.size,
    daysSince: daysBetween(e.last, today),
    setsPerWeek: e.sets / spanWeeks,
    lastDate: e.last,
  }));

  // Groups the catalog knows about but the log never touches are the clearest
  // possible answer to "what am I neglecting"
  const untouched = catalog
    .groups()
    .map(canonicalGroup)
    .filter((g) => !byGroup.has(g) && g !== "Other")
    .map((group) => ({ group, sessions: 0, daysSince: null, setsPerWeek: 0, lastDate: "" }));

  return [...untouched, ...trained].sort(
    (a, b) => (b.daysSince ?? Number.MAX_SAFE_INTEGER) - (a.daysSince ?? Number.MAX_SAFE_INTEGER)
  );
}

function earliest(byGroup: Map<string, { last: string }>): string {
  let min = "";
  for (const e of byGroup.values()) if (min === "" || e.last < min) min = e.last;
  return min || new Date().toISOString().slice(0, 10);
}

function answerNeglect(groups: GroupStats[], input: AskInput): BrainAnswer {
  if (groups.length === 0) {
    return {
      intent: "neglect",
      headline: "No muscle group can be mapped yet, because none of your exercises match the catalog.",
      facts: [],
      points: ["Once a few lifts are logged against known exercises, this answer fills itself in."],
    };
  }

  const stalest = groups[0];
  const stalestAge = stalest.daysSince === null ? "never trained" : `${stalest.daysSince} days since you last trained it`;
  const weekly = weeklyVolume(input.workouts, input.setsByWorkout, 4, input.today);
  const trainedRecently = weekly.reduce((n, w) => n + w.workouts, 0);

  return {
    intent: "neglect",
    headline: `${stalest.group} is your most neglected group: ${stalestAge}.`,
    facts: groups.slice(0, 3).map((g) => ({
      label: g.group,
      value: g.daysSince === null ? "never" : `${g.daysSince}d`,
    })),
    points: [
      ...groups
        .slice(0, 3)
        .map((g) =>
          g.daysSince === null
            ? `${g.group}: no sets logged at all.`
            : `${g.group}: ${g.daysSince} days out, ${g.setsPerWeek.toFixed(1)} sets a week on average.`
        ),
      trainedRecently === 0
        ? "Nothing logged in the last four weeks, so every group is equally cold."
        : `${trainedRecently} ${trainedRecently === 1 ? "session" : "sessions"} in the last four weeks across all groups.`,
    ],
    action: { label: "Start a workout", to: "/app" },
  };
}

function answerToday(groups: GroupStats[], input: AskInput): BrainAnswer {
  const { workouts, setsByWorkout, profile, catalog } = input;

  if (groups.length === 0) {
    return {
      intent: "today",
      headline: "There is not enough history to plan from yet.",
      facts: [],
      points: ["Log one session and this will start recommending from what you actually respond to."],
      action: { label: "Start a workout", to: "/app" },
    };
  }

  const target = groups[0];
  const equipment = new Set(profile.equipment);

  // Offer lifts from the athlete's own log, least recently trained first, so the
  // plan is built from movements they have actually done before
  const logged = new Map<string, { last: string; volume: number }>();
  for (const w of completed(workouts)) {
    for (const s of setsByWorkout.get(w.id) ?? []) {
      const entry = logged.get(s.exerciseName) ?? { last: "", volume: 0 };
      if (w.date > entry.last) entry.last = w.date;
      entry.volume += s.weight * s.reps;
      logged.set(s.exerciseName, entry);
    }
  }

  const matchesTarget = (name: string) => {
    const entry = catalog.of(name);
    return entry !== undefined && canonicalGroup(entry.muscleGroup) === target.group;
  };
  const ownedBy = (name: string) => {
    const entry = catalog.of(name);
    return equipment.size === 0 || equipmentMatches(entry?.equipment ?? "", equipment);
  };

  // For a group never trained there is nothing of the athlete's own to reuse,
  // so fall back to catalog picks that match their equipment
  const suggestions =
    [...logged.entries()].filter(([name]) => matchesTarget(name) && ownedBy(name)).length > 0
      ? [...logged.entries()]
          .filter(([name]) => matchesTarget(name) && ownedBy(name))
          .sort((a, b) => a[1].last.localeCompare(b[1].last))
          .slice(0, 3)
          .map(([name]) => name)
      : [...catalog.picksFor(target.group)]
          .filter(ownedBy)
          .slice(0, 3);

  return {
    intent: "today",
    headline:
      target.daysSince === null
        ? `Train ${target.group} today. You have never logged a set for it.`
        : `Train ${target.group} today. It is your longest untouched group at ${target.daysSince} days.`,
    facts: [
      { label: "Focus", value: target.group },
      { label: "Days since", value: target.daysSince === null ? "never" : `${target.daysSince}d` },
      { label: "Avg sets/week", value: target.setsPerWeek.toFixed(1) },
    ],
    points: [
      suggestions.length > 0
        ? target.sessions === 0
          ? `You have not trained ${target.group} yet, so start with ${suggestions.join(", ")}.`
          : `Work from your own log: ${suggestions.join(", ")}.`
        : "Nothing in the catalog matches your equipment for that group, so pick from the library.",
      equipment.size > 0
        ? `Filtered to what you said you have: ${[...equipment].join(", ")}.`
        : "You have not listed equipment, so nothing was filtered out.",
      profile.goal === "strength"
        ? "Strength goal: take the heaviest of these first while you are fresh."
        : profile.goal === "endurance"
          ? "Endurance goal: keep the rest short and the tempo honest."
          : "Add a set or two rather than adding weight today.",
    ],
    action: { label: "Start a workout", to: "/app" },
  };
}

/** Hips is trained with legs as far as an athlete is concerned. */
function canonicalGroup(group: string): string {
  return group === "Hips" ? "Legs" : group;
}

/** Loose match: the athlete said "Dumbbell" and the catalog says the same. */
function equipmentMatches(catalogEquipment: string, owned: Set<string>): boolean {
  const lower = catalogEquipment.toLowerCase();
  if (!lower) return false;
  for (const item of owned) {
    const key = item.toLowerCase();
    if (key.includes("dumbbell") && lower.includes("dumbbell")) return true;
    if (key.includes("barbell") && lower.includes("barbell")) return true;
    if (key.includes("kettlebell") && lower.includes("kettlebell")) return true;
    if (key.includes("machine") && lower.includes("machine")) return true;
    if (key.includes("cable") && (lower.includes("cable") || lower.includes("machine")))
      return true;
    if (key.includes("body") && (lower.includes("body") || lower.includes("body only")))
      return true;
  }
  return false;
}

/* ---------- Workout level questions ---------- */

function workoutVolume(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

function answerStrongest(input: AskInput): BrainAnswer {
  const { workouts, setsByWorkout, unit, today } = input;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const done = completed(workouts);

  const rank = (list: Workout[]) =>
    list
      .map((w) => {
        const sets = setsByWorkout.get(w.id) ?? [];
        return { w, volume: workoutVolume(sets), sets };
      })
      .filter((x) => x.sets.length > 0)
      .sort((a, b) => b.volume - a.volume);

  const thisMonth = rank(done.filter((w) => w.date >= monthStart));
  const scope = thisMonth.length > 0 ? thisMonth : rank(done);
  const scopeLabel = thisMonth.length > 0 ? "this month" : "on record";

  if (scope.length === 0) {
    return {
      intent: "strongest",
      headline: "No completed sessions to compare yet.",
      facts: [],
      points: ["Finish a workout and this will rank your best sessions by total volume."],
      action: { label: "Start a workout", to: "/app" },
    };
  }

  const best = scope[0];
  const average = avg(scope.map((s) => s.volume));
  const topSet = best.sets.reduce((b, s) =>
    estimate1RM(s.weight, s.reps) > estimate1RM(b.weight, b.reps) ? s : b
  );
  const comparedToAverage = pctChange(average, best.volume);

  return {
    intent: "strongest",
    headline: `Your strongest session ${scopeLabel} was ${best.w.name} on ${shortDate(best.w.date)}, at ${vol(best.volume, unit)} of total volume.`,
    facts: [
      { label: "Total volume", value: vol(best.volume, unit) },
      { label: "Sets", value: String(best.sets.length) },
      { label: "vs average", value: `${comparedToAverage > 0 ? "+" : ""}${round(comparedToAverage)}%` },
    ],
    points: [
      `Best single set was ${kg(topSet.weight, unit)} × ${topSet.reps}, worth about ${kg(estimate1RM(topSet.weight, topSet.reps), unit)} on the 1RM estimate.`,
      thisMonth.length === 0
        ? `You have not trained this month, so this is your best of all time.`
        : `${thisMonth.length} ${thisMonth.length === 1 ? "session" : "sessions"} logged this month.`,
    ],
    chart: {
      kind: "bars",
      points: weeklyVolume(workouts, setsByWorkout, 8, today).map((w) => ({
        label: shortDate(w.weekStart),
        value: w.volume,
      })),
      caption: "Weekly volume",
    },
    action: { label: "See history", to: "/app/history" },
  };
}

function answerVolume(input: AskInput): BrainAnswer {
  const { workouts, setsByWorkout, unit, today } = input;
  const weeks = weeklyVolume(workouts, setsByWorkout, 8, today);
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const total = weeks.reduce((sum, w) => sum + w.volume, 0);
  const active = weeks.filter((w) => w.workouts > 0);

  return {
    intent: "volume",
    headline: `You have moved ${vol(total, unit)} in the last eight weeks across ${active.length} training ${active.length === 1 ? "week" : "weeks"}.`,
    facts: [
      { label: "This week", value: vol(thisWeek.volume, unit) },
      { label: "Last week", value: vol(lastWeek.volume, unit) },
      { label: "Per session", value: vol(avg(active.map((w) => w.volume)), unit) },
    ],
    points: [
      `That is ${thisWeek.sets} sets logged this week.`,
      pctChange(lastWeek.volume, thisWeek.volume) === 0
        ? "Nothing logged yet this week."
        : `Volume is ${pctChange(lastWeek.volume, thisWeek.volume) > 0 ? "up" : "down"} ${Math.abs(round(pctChange(lastWeek.volume, thisWeek.volume)))}% on last week.`,
    ],
    chart: {
      kind: "bars",
      points: weeks.map((w) => ({ label: shortDate(w.weekStart), value: w.volume })),
      caption: "Weekly volume",
    },
    action: { label: "Open progress", to: "/app/progress" },
  };
}

function answerConsistency(input: AskInput): BrainAnswer {
  const { workouts, setsByWorkout, profile, today } = input;
  const done = completed(workouts);
  const weeks = weeklyVolume(workouts, setsByWorkout, 8, today);
  const last4 = weeks.slice(-4);
  const sessions = last4.reduce((n, w) => n + w.workouts, 0);
  const perWeek = sessions / 4;
  const target = Math.max(1, profile.daysPerWeek);
  const daysSince = done.length > 0 ? daysBetween(done[done.length - 1].date, today) : 0;
  const onTarget = perWeek >= target * 0.8;

  return {
    intent: "consistency",
    headline: onTarget
      ? `You are averaging ${perWeek.toFixed(1)} sessions a week, which matches your target of ${target}.`
      : `You are averaging ${perWeek.toFixed(1)} sessions a week against a target of ${target}.`,
    facts: [
      { label: "Per week", value: perWeek.toFixed(1) },
      { label: "Target", value: String(target) },
      { label: "Days since", value: `${daysSince}d` },
    ],
    points: [
      `${sessions} ${sessions === 1 ? "session" : "sessions"} across the last four weeks.`,
      daysSince > target * 2
        ? `It has been ${daysSince} days since your last session, which is longer than your own target allows.`
        : "You are inside your usual rhythm.",
    ],
    chart: {
      kind: "bars",
      points: last4.map((w) => ({ label: shortDate(w.weekStart), value: w.volume })),
      caption: "Volume by week",
    },
    action: { label: "Open progress", to: "/app/progress" },
  };
}

function answerLast(input: AskInput): BrainAnswer {
  const { workouts, setsByWorkout, unit, today } = input;
  const done = completed(workouts);
  if (done.length === 0) {
    return {
      intent: "last",
      headline: "Nothing completed yet.",
      facts: [],
      points: ["Finish a session and this will summarise it."],
      action: { label: "Start a workout", to: "/app" },
    };
  }
  const last = done[done.length - 1];
  const sets = setsByWorkout.get(last.id) ?? [];
  const top = sets.reduce((b, s) =>
    estimate1RM(s.weight, s.reps) > estimate1RM(b.weight, b.reps) ? s : b
  );
  return {
    intent: "last",
    headline: `Your last session was ${last.name} on ${shortDate(last.date)}, ${daysBetween(last.date, today)} days ago.`,
    facts: [
      { label: "Volume", value: vol(workoutVolume(sets), unit) },
      { label: "Sets", value: String(sets.length) },
      { label: "Best set", value: `${kg(top.weight, unit)} × ${top.reps}` },
    ],
    points: [...new Set(sets.map((s) => s.exerciseName))].slice(0, 6).map((n) => `Trained ${n}.`),
    action: { label: "See history", to: "/app/history" },
  };
}

/* ---------- Entry point ---------- */

const NO_DATA = (question: string): BrainAnswer => ({
  intent: "unknown",
  headline: "There is no completed workout history to answer that from yet.",
  facts: [],
  points: [
    `You asked: "${question.trim()}"`,
    "Every answer here is computed from your own logged sets, so it needs at least one finished session.",
  ],
  action: { label: "Start a workout", to: "/app" },
});

export const SUGGESTED_QUESTIONS = [
  "Why am I not progressing on bench?",
  "What should I train today?",
  "Which muscle am I neglecting?",
  "What was my strongest workout this month?",
  "Should I increase my squat weight?",
  "How consistent have I been?",
];

/**
 * Answers a question from the athlete's own history. Every branch reads the
 * archive through the same pure helpers the rest of the app uses, so nothing
 * here can disagree with the coach or the progress charts.
 */
export function ask(input: AskInput): BrainAnswer {
  const { question, workouts, setsByWorkout, today } = input;
  const done = completed(workouts);
  if (done.length === 0) return NO_DATA(question);

  const loggedNames = [...new Set([...input.setsByWorkout.values()].flat().map((s) => s.exerciseName))];
  const intent = parseIntent(question);

  if (intent === "unknown") {
    return {
      intent,
      headline: "I can answer that from your training history, but not that particular question yet.",
      facts: [],
      points: [
        "Try asking why a lift has stalled, what to train, what you are neglecting, or how your volume and consistency look.",
      ],
    };
  }

  // Which lift did they mean? Fall back to their strongest when unspecified
  const asked = extractExercise(question, loggedNames);
  const fallback = strengthSeriesAll(workouts, setsByWorkout)[0]?.exerciseName ?? loggedNames[0];
  const name = asked ?? fallback;

  if (intent === "today" || intent === "neglect") {
    const groups = groupStats(workouts, setsByWorkout, input.catalog, today);
    return intent === "today" ? answerToday(groups, input) : answerNeglect(groups, input);
  }

  if (intent === "volume") return answerVolume(input);
  if (intent === "consistency") return answerConsistency(input);
  if (intent === "strongest") return answerStrongest(input);
  if (intent === "last") return answerLast(input);

  if (!name) return NO_DATA(question);
  const stats = liftStats(workouts, setsByWorkout, name, today);
  if (!stats) return NO_DATA(question);

  if (intent === "stall") return diagnoseStall(stats, input.profile, input.unit, today);
  return answerIncrease(stats, input.profile, input.catalog.of(name)?.equipment, input.unit);
}

function strengthSeriesAll(workouts: Workout[], setsByWorkout: Map<string, WorkoutSet[]>) {
  const names = [...new Set([...setsByWorkout.values()].flat().map((s) => s.exerciseName))];
  return names
    .map((exerciseName) => {
      const series = strengthSeries(workouts, setsByWorkout, exerciseName);
      return { exerciseName, best: series.length ? Math.max(...series.map((p) => p.e1rm)) : 0 };
    })
    .filter((x) => x.best > 0)
    .sort((a, b) => b.best - a.best);
}