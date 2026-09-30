import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  getStats,
  getActiveWorkout,
  listWorkouts,
  type Stats,
  type Workout,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import StartWorkoutCard from "../components/StartWorkoutCard";
import ThemeToggle from "../components/ThemeToggle";

function Stat({ value, label }: { value?: string | number; label: string }) {
  return (
    <div className="panel flex flex-col gap-0.5 p-4">
      <span className="num text-[26px] font-semibold leading-none">
        {value ?? "–"}
      </span>
      <span className="label mt-1">{label}</span>
    </div>
  );
}

export default function Today() {
  const user = useAuthUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [active, setActive] = useState<Workout | null>(null);
  const [recent, setRecent] = useState<Workout[]>([]);
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [s, a, w] = await Promise.all([
        getStats(user.uid),
        getActiveWorkout(user.uid),
        listWorkouts(user.uid),
      ]);
      if (cancelled) return;
      setStats(s);
      setActive(a);
      setRecent(w);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const completed = recent.filter((w) => w.completed).slice(0, 3);

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
      </motion.div>

      <StartWorkoutCard
        activeId={active?.id}
        onStarted={async () => {
          if (!user) return;
          setActive(await getActiveWorkout(user.uid));
        }}
      />

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
        <motion.div {...rise(0.1)} className="grid grid-cols-2 gap-3">
          <Stat value={stats.totalWorkouts} label="Workouts" />
          <Stat
            value={
              stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)} t`
                : `${stats.totalVolume} kg`
            }
            label="Volume lifted"
          />
          <Stat value={stats.totalSets} label="Sets logged" />
          <Stat
            value={
              stats.totalWorkouts
                ? Math.round(stats.totalSets / stats.totalWorkouts)
                : 0
            }
            label="Sets / workout"
          />
        </motion.div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="label mt-10 mb-3">Recent</h2>
          <motion.div {...rise(0.15)} className="panel divide-y divide-[var(--line)]">
            {completed.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-[15px] font-medium">{w.name}</p>
                  <p className="label mt-0.5 normal-case">{w.date}</p>
                </div>
                <span className="num text-[13px] font-semibold">✓</span>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
