import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { loadRoutines, routinesForDay, type Routine } from "../lib/routines";
import { Play, CaretRight, ChartLine, Brain as BrainIcon } from "@phosphor-icons/react";
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

function Stat({
  value,
  suffix,
  label,
}: {
  value?: string | number;
  suffix?: string;
  label: string;
}) {
  return (
    <div className="panel flex flex-col gap-0.5 p-4">
      <span className="num text-[26px] font-semibold leading-none">
        {value ?? "–"}
        {suffix && (
          <span className="ml-0.5 text-[13px] font-medium text-[var(--ink-3)]">
            {suffix}
          </span>
        )}
      </span>
      <span className="label mt-1">{label}</span>
    </div>
  );
}

/**
 * Day one has nothing to show, so it says what to do instead of four zeros.
 * An empty streak counter is the least motivating possible welcome.
 */
function FirstRun() {
  return (
    <div className="panel mt-8 px-6 py-9 text-center">
      <p className="text-[17px] font-semibold tracking-[-0.01em]">
        Nothing logged yet
      </p>
      <p className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
        Pick a session above, add your first set, and this page fills up with your
        streak, volume and progress.
      </p>
    </div>
  );
}

/**
 * Weekly progress toward the target the athlete set during onboarding.
 * Purely presentational, so it renders nothing without a profile.
 */
function WeekGoal({ profile, done }: { profile: UserProfile; done: number }) {
  const target = Math.max(1, profile.daysPerWeek);
  const reached = Math.min(done, target);
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">This week</span>
        <span className="num text-[13px] font-semibold text-[var(--ink-2)]">
          {reached} / {target}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: target }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i < reached ? "var(--ink)" : "var(--line)" }}
          />
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[var(--ink-2)]">
        {reached >= target
          ? "Weekly target met."
          : `${target - reached} more to hit your target.`}
      </p>
    </div>
  );
}

export default function Today({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  const [active, setActive] = useState<Workout | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(new Map());
  const [starting, setStarting] = useState(false);
  // Filtered where the data arrives. Reading the clock during render trips the
  // react/purity rule and would change under the optimiser anyway, and the
  // athlete's day does not shift while the screen is open.
  const [split, setSplit] = useState<{ todays: Routine[]; total: number } | null>(null);
  const { toast } = useToast();
  const [unit] = useUnit();

  // Realtime: active workout
  useEffect(() => {
    if (!user) return;
    return subscribeActiveWorkout(user.uid, setActive);
  }, [user]);

  // Realtime: all workouts
  useEffect(() => {
    if (!user) return;
    return subscribeWorkouts(user.uid, setWorkouts);
  }, [user]);

  // The athlete's own split. Loaded once here and reloaded when Profile saves,
  // so a session added in settings turns up on Today without a manual refresh.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadRoutines(user.uid)
      .then((list) => {
        if (cancelled) return;
        setSplit({ todays: routinesForDay(list, new Date().getDay()), total: list.length });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setSplit({ todays: [], total: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Realtime: sets for the 10 most recent workouts (for stats and history)
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

  const todaysRoutines = split?.todays ?? [];

  const completed = useMemo(() => workouts.filter((w) => w.completed).slice(0, 3), [workouts]);
  const firstRun = !!stats && stats.totalWorkouts === 0;

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

      <motion.header {...rise()}>
        <p className="label">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </motion.header>

      <motion.div {...rise(0.05)} className="mt-4">
        <div className="flex items-end gap-3">
          {firstRun ? (
            <span className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em]">
              Let's get you logged.
            </span>
          ) : (
            <>
              <span className="num text-[76px] font-bold leading-[0.9] tracking-[-0.04em]">
                {stats?.streak ?? 0}
              </span>
              <span className="pb-2 text-[15px] font-medium text-[var(--ink-2)]">
                day{stats?.streak === 1 ? "" : "s"} in a row
              </span>
            </>
          )}
        </div>
        <p className="mt-3 max-w-[38ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
          {goalHint(profile.goal)}
        </p>
      </motion.div>

      {/* Active workout banner — live */}
      {active && (
        <motion.button
          {...rise(0.08)}
          onClick={() => navigate(`/app/workout/${active.id}`)}
          className="panel mt-6 flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)]">
              <Play size={16} weight="fill" className="text-[var(--bg)]" />
            </span>
            <div>
              <p className="text-[15px] font-semibold">{active.name}</p>
              <p className="label mt-0.5 normal-case">In progress — tap to resume</p>
            </div>
          </div>
          <CaretRight size={18} className="text-[var(--ink-3)]" />
        </motion.button>
      )}

      {/* The athlete's own split, one tap to start. There is no house template:
          Push/Legs, Upper/Lower and a bro split are all normal, and which one
          somebody runs is theirs to say. */}
      {!active && (
        <motion.div {...rise(0.1)} className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="label">Your split</h2>
            {split && split.total > 0 && (
              <button
                onClick={() => navigate("/app/profile")}
                className="tab text-[13px] font-medium text-[var(--ink-2)]"
              >
                Edit
              </button>
            )}
          </div>

          {split === null ? (
            <div className="h-16 animate-pulse rounded-[14px] bg-[var(--fill)]" />
          ) : todaysRoutines.length === 0 ? (
            <div className="panel p-4">
              <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
                {split.total === 0
                  ? "No sessions planned yet. Name the days you train and the moves you want on each, and they will show up here."
                  : "Nothing scheduled for today. Pick one, or edit your split to change the days."}
              </p>
              <button onClick={() => navigate("/app/profile")} className="btn-line mt-3 w-full">
                {split.total === 0 ? "Plan my split" : "Open my split"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todaysRoutines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startRoutine(r)}
                  disabled={starting}
                  className="panel flex items-center justify-between gap-3 p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                    <span className="block text-[12px] text-[var(--ink-3)]">
                      {r.exercises.length > 0
                        ? `${r.exercises.length} moves planned`
                        : "No moves added yet"}
                    </span>
                  </span>
                  <Play size={16} weight="fill" className="shrink-0 text-[var(--ink-3)]" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <h2 className="label mt-10 mb-3">Training load</h2>
      {!stats ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[92px] animate-pulse rounded-[14px] bg-[var(--fill)]"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      ) : stats.totalWorkouts === 0 ? (
        <FirstRun />
      ) : (
        <motion.div {...rise(0.12)} className="grid grid-cols-2 gap-3">
          <Stat
            value={formatVolume(stats.totalVolume, unit).value}
            suffix={formatVolume(stats.totalVolume, unit).suffix}
            label="Volume"
          />
          <Stat value={stats.totalWorkouts} label="Workouts" />
          <Stat value={stats.totalSets} label="Sets" />
          <Stat value={stats.weekWorkouts} label="This week" />
        </motion.div>
      )}

      {stats && stats.totalWorkouts > 0 && (
        <motion.div {...rise(0.13)} className="mt-3">
          <WeekGoal profile={profile} done={stats.weekWorkouts} />
        </motion.div>
      )}

      {/* Progress: strength trend and weekly volume */}
      {stats && stats.totalWorkouts > 0 && (
        <motion.div {...rise(0.14)} className="mt-3">
          <button
            onClick={() => navigate("/app/progress")}
            className="panel flex w-full items-center justify-between p-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fill)]">
                <ChartLine size={17} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">Progress</p>
                <p className="label mt-0.5 normal-case">Strength trend and weekly volume</p>
              </div>
            </div>
            <CaretRight size={18} className="text-[var(--ink-3)]" />
          </button>
        </motion.div>
      )}

      {stats && stats.totalWorkouts > 0 && (
        <motion.div {...rise(0.145)} className="mt-3">
          <button
            onClick={() => navigate("/app/brain")}
            className="panel flex w-full items-center justify-between p-4 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fill)]">
                <BrainIcon size={17} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">Training brain</p>
                <p className="label mt-0.5 normal-case">Ask why a lift has stalled</p>
              </div>
            </div>
            <CaretRight size={18} className="text-[var(--ink-3)]" />
          </button>
        </motion.div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="label mt-10 mb-3">Recent</h2>
          <motion.div {...rise(0.15)} className="panel divide-y divide-[var(--line)]">
            {completed.map((w) => (
              <button
                key={w.id}
                onClick={() => navigate(`/app/workout/${w.id}`)}
                className="tab flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{w.name}</p>
                  <p className="label mt-0.5 normal-case">{friendlyDate(w.date)}</p>
                </div>
                <CaretRight size={16} className="shrink-0 text-[var(--ink-3)]" />
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
