import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { loadRoutines, routinesForDay, type Routine } from "../lib/routines";
import { Play, CaretRight, ChartLine, Brain as BrainIcon, UsersThree } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import {
  subscribeActiveWorkout,
  subscribeWorkouts,
  subscribeSets,
  startWorkout,
  computeStats,
  type Workout,
  type WorkoutSet,
  type Stats,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { formatVolume, useUnit } from "../lib/units";
import { friendlyDate } from "../lib/progress";
import { goalHint, type UserProfile } from "../lib/profile";

/** Good morning is only right at 7am. */
function greetingFor(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Still up";
}

/** First name only. The email address is not a greeting. */
function greetName(displayName: string): string | null {
  const clean = displayName.trim();
  if (!clean) return null;
  const first = clean.split(/\s+/)[0];
  return first || null;
}

function greetingCopy(streak: number, trainedToday: boolean): string {
  if (trainedToday) return "You have already trained today.";
  if (streak > 0) return `You are ${streak === 1 ? "on a run" : `${streak} sessions in`}.`;
  return "";
}

/**
 * The four training numbers as an editorial ledger rather than four identical
 * cards. A grid of equal panels reads as decoration; a line of figures reads
 * as data.
 */
function LoadLedger({
  volume,
  workouts,
  sets,
  week,
  unit,
}: {
  volume: string;
  workouts: number;
  sets: number;
  week: number;
  unit: string;
}) {
  return (
    <div className="panel divide-y divide-[var(--line)]">
      {[
        ["Volume", `${volume} ${unit}`, "All time"],
        ["Workouts", String(workouts), "Logged"],
        ["Sets", String(sets), "Completed"],
        ["This week", String(week), "Sessions"],
      ].map(([label, value, hint]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
          <span className="text-[14px] text-[var(--ink-2)]">{label}</span>
          <span className="flex items-baseline gap-2">
            <span className="hint text-[12px] text-[var(--ink-3)]">{hint}</span>
            <span className="num text-[17px] font-semibold">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Weekly progress toward the target the athlete set during onboarding. */
function WeekGoal({ profile, done }: { profile: UserProfile; done: number }) {
  const target = Math.max(1, profile.daysPerWeek);
  const reached = Math.min(done, target);
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[14px] text-[var(--ink-2)]">Weekly target</span>
        <span className="num text-[13px] font-semibold">
          {reached} / {target}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: target }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i < reached ? "var(--ink)" : "var(--line)" }}
          />
        ))}
      </div>
    </div>
  );
}

/** A destination, not a card. Used for Progress and the Training brain. */
function LinkRow({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tab flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-[var(--line)] py-3.5 text-left last:border-b-0"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-[var(--ink-2)]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">{title}</span>
          <span className="block truncate text-[13px] text-[var(--ink-2)]">{body}</span>
        </span>
      </span>
      <CaretRight size={16} className="shrink-0 text-[var(--ink-3)]" />
    </button>
  );
}

export default function Today({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const [unit] = useUnit();

  const [active, setActive] = useState<Workout | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(new Map());
  const [starting, setStarting] = useState(false);
  // Filtered where the data arrives. Reading the clock during render trips the
  // react/purity rule and would change under the optimiser anyway.
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  // The clock is read once, on mount. A greeting that recomputes on every
  // render is a greeting that can disagree with itself.
  const [now, setNow] = useState(() => new Date());

  // One authored moment, on the header. Everything below it is simply there.
  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  // Refreshed when the tab comes back, so a phone left open overnight does not
  // still say "Good evening".
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveWorkout(user.uid, setActive);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeWorkouts(user.uid, setWorkouts);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadRoutines(user.uid)
      .then((list) => {
        if (cancelled) return;
        setRoutines(list);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setRoutines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const recent = workouts.slice(0, 10);
    const unsubs = recent.map((w) =>
      subscribeSets(w.id, (sets) => {
        setSetsByWorkout((prev) => {
          const next = new Map(prev);
          next.set(w.id, sets);
          return next;
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [workouts]);

  const stats: Stats | null = useMemo(
    () => (user ? computeStats(workouts, setsByWorkout) : null),
    [user, workouts, setsByWorkout]
  );

  const todaysRoutines = useMemo(
    () => routinesForDay(routines ?? [], now.getDay()),
    [routines, now]
  );
  const completed = useMemo(() => workouts.filter((w) => w.completed).slice(0, 3), [workouts]);
  const firstRun = !!stats && stats.totalWorkouts === 0;

  const trainedToday = useMemo(() => {
    const today = now.toISOString().slice(0, 10);
    return workouts.some((w) => w.date === today && w.completed);
  }, [workouts, now]);

  const name = greetName(profile.displayName);
  const streak = stats?.streak ?? 0;
  const note = greetingCopy(streak, trainedToday);

  const startRoutine = async (routine: Routine) => {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await startWorkout(user.uid, routine.name);
      // The plan travels with the route so the session opens on the moves the
      // athlete said they were doing, in the order they listed them.
      navigate(`/app/workout/${id}`, { state: { planned: routine.exercises } });
    } catch (err) {
      console.error(err);
      toast("Couldn't start the workout. Check your connection.", "error");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <ThemeToggle fixed />

      {/* Greeting carries the screen. The date supports it rather than competing. */}
      <motion.header {...rise()}>
        <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em]">
          {greetingFor(now.getHours())}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--ink-2)]">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </motion.header>

      {!firstRun && (
        <motion.div {...rise(0.05)} className="mt-5">
          <div className="flex items-end gap-3">
            <span className="num text-[64px] font-bold leading-[0.85] tracking-[-0.04em]">
              {streak}
            </span>
            <span className="pb-1.5 text-[15px] font-medium text-[var(--ink-2)]">
              {streak === 1 ? "day" : "days"} in a row
            </span>
          </div>
          {note && <p className="mt-2 text-[14px] text-[var(--ink-2)]">{note}</p>}
          {!trainedToday && !note && (
            <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
              {goalHint(profile.goal)}
            </p>
          )}
        </motion.div>
      )}

      {/* The one thing to do next gets the only raised surface on the screen. */}
      {active ? (
        <motion.button
          {...rise(0.08)}
          onClick={() => navigate(`/app/workout/${active.id}`)}
          className="mt-6 flex w-full items-center justify-between gap-3 rounded-[14px] p-4 text-left transition-transform active:scale-[0.98]"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]">
              <Play size={16} weight="fill" className="text-[var(--ink)]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{active.name}</span>
              <span className="block text-[13px] opacity-70">Still going. Tap to pick up.</span>
            </span>
          </span>
          <CaretRight size={18} className="shrink-0 opacity-70" />
        </motion.button>
      ) : todaysRoutines.length > 0 ? (
        <motion.div {...rise(0.08)} className="mt-6">
          {todaysRoutines.map((r) => (
            <button
              key={r.id}
              onClick={() => startRoutine(r)}
              disabled={starting}
              className="flex w-full items-center justify-between gap-3 rounded-[14px] p-4 text-left transition-transform active:scale-[0.98]"
              style={{ background: "var(--ink)", color: "var(--bg)" }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]">
                  <Play size={16} weight="fill" className="text-[var(--ink)]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                  <span className="block text-[13px] opacity-70">
                    {starting
                      ? "Starting…"
                      : r.exercises.length > 0
                        ? `${r.exercises.length} moves planned`
                        : "Start the session"}
                  </span>
                </span>
              </span>
              <CaretRight size={18} className="shrink-0 opacity-70" />
            </button>
          ))}
          {todaysRoutines.length > 1 && (
            <div className="mt-2 flex flex-col gap-2">
              {todaysRoutines.slice(1).map((r) => (
                <button
                  key={r.id}
                  onClick={() => startRoutine(r)}
                  disabled={starting}
                  className="panel flex items-center justify-between gap-3 p-3.5 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{r.name}</span>
                    <span className="block text-[12px] text-[var(--ink-3)]">
                      {r.exercises.length} moves planned
                    </span>
                  </span>
                  <Play size={14} weight="fill" className="shrink-0 text-[var(--ink-3)]" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      ) : null}

      {/* Everything below is already there. No entrance per section. */}
      {routines && todaysRoutines.length === 0 && (
        <div className="mt-6">
          <div className="panel p-4">
            <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
              {routines.length === 0
                ? "No sessions planned yet. Name the days you train and the moves you want on each, and they will show up here."
                : "Nothing scheduled today. Edit your split to change the days, or start a session any time."}
            </p>
            <button onClick={() => navigate("/app/profile")} className="btn-line mt-3 w-full">
              {routines.length === 0 ? "Plan my split" : "Open my split"}
            </button>
          </div>
        </div>
      )}

      {stats && stats.totalWorkouts > 0 && (
        <>
          <h2 className="label mt-10 mb-3">Training load</h2>
          <LoadLedger
            volume={formatVolume(stats.totalVolume, unit).value}
            workouts={stats.totalWorkouts}
            sets={stats.totalSets}
            week={stats.weekWorkouts}
            unit={formatVolume(stats.totalVolume, unit).suffix}
          />
          <WeekGoal profile={profile} done={stats.weekWorkouts} />
        </>
      )}

      {firstRun && (
        <div className="panel mt-10 px-6 py-9 text-center">
          <p className="text-[17px] font-semibold tracking-[-0.01em]">Nothing logged yet</p>
          <p className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
            Start a session, add your first set, and this page fills up with your
            streak, volume and progress.
          </p>
        </div>
      )}

      {stats && stats.totalWorkouts > 0 && (
        <div className="panel mt-3 px-4">
          <LinkRow
            icon={<ChartLine size={16} />}
            title="Progress"
            body="Strength trend and weekly volume"
            onClick={() => navigate("/app/progress")}
          />
          <LinkRow
            icon={<BrainIcon size={16} />}
            title="Training brain"
            body="Ask why a lift has stalled"
            onClick={() => navigate("/app/brain")}
          />
          <LinkRow
            icon={<UsersThree size={16} />}
            title="Feed"
            body="Sessions from the people you follow"
            onClick={() => navigate("/app/feed")}
          />
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="label mt-10 mb-3">Recent</h2>
          <div className="panel divide-y divide-[var(--line)]">
            {completed.map((w) => (
              <button
                key={w.id}
                onClick={() => navigate(`/app/workout/${w.id}`)}
                className="tab flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{w.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{friendlyDate(w.date)}</p>
                </div>
                <CaretRight size={16} className="shrink-0 text-[var(--ink-3)]" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
