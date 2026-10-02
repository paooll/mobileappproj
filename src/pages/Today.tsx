import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, CaretRight, ChartLine, Brain as BrainIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import {
  subscribeActiveWorkout,
  subscribeWorkouts,
  subscribeSets,
  startWorkout,
  computeStats,
  TEMPLATES,
  type Workout,
  type WorkoutSet,
  type Stats,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { formatVolume, useUnit } from "../lib/units";
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

  // Realtime: sets for the 10 most recent workouts (for stats + templates)
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

  const completed = useMemo(() => workouts.filter((w) => w.completed).slice(0, 3), [workouts]);

  const startFromTemplate = async (name: string) => {
    if (!user || starting) return;
    setStarting(true);
    try {
      const id = await startWorkout(user.uid, name);
      navigate(`/app/workout/${id}`);
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
          <span className="num text-[76px] font-bold leading-[0.9] tracking-[-0.04em]">
            {stats?.streak ?? 0}
          </span>
          <span className="pb-2 text-[15px] font-medium text-[var(--ink-2)]">
            day{stats?.streak === 1 ? "" : "s"} in a row
          </span>
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

      {/* Templates: one tap to start */}
      {!active && (
        <motion.div {...rise(0.1)} className="mt-8">
          <h2 className="label mb-3">Quick start</h2>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => startFromTemplate(t.name)}
                disabled={starting}
                className="panel flex flex-col items-start gap-1 p-4 text-left transition-transform active:scale-[0.97]"
              >
                <span className="text-[15px] font-semibold">{t.name}</span>
                <span className="label normal-case">
                  {t.exercises.length} exercises
                </span>
              </button>
            ))}
          </div>
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
      ) : (
        <motion.div {...rise(0.12)} className="grid grid-cols-2 gap-3">
          <Stat value={stats.weekWorkouts} label="This week" />
          <Stat
            value={formatVolume(stats.totalVolume, unit).value}
            suffix={formatVolume(stats.totalVolume, unit).suffix}
            label="Volume"
          />
          <Stat value={stats.totalWorkouts} label="Workouts" />
          <Stat value={stats.totalSets} label="Sets" />
        </motion.div>
      )}

      {stats && (
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
                className="tab flex w-full items-center justify-between px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-[15px] font-medium">{w.name}</p>
                  <p className="label mt-0.5 normal-case">{w.date}</p>
                </div>
                <span className="num text-[13px] font-semibold">✓</span>
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
