import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, useReducedMotion } from "framer-motion";
import { Fire, CalendarBlank, Package, Stack } from "@phosphor-icons/react";
import StartWorkoutCard from "../components/StartWorkoutCard";

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string | number | undefined;
  label: string;
}) {
  return (
    <div className="panel flex flex-col gap-0.5 p-4">
      <Icon size={20} weight="duotone" className="text-spot" />
      <span className="font-mono text-[22px] font-medium tracking-tight">
        {value ?? "–"}
      </span>
      <span className="meta">{label}</span>
    </div>
  );
}

export default function Today() {
  const stats = useQuery(api.workouts.stats);
  const active = useQuery(api.workouts.active);
  const recent = useQuery(api.workouts.list);
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  const completed = (recent ?? []).filter((w) => w.completedAt).slice(0, 3);

  return (
    <div className="px-5 pt-12">
      <motion.header {...rise()}>
        <p className="meta">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.02em]">
          Today
        </h1>
      </motion.header>

      <StartWorkoutCard activeId={active?._id} />

      <h2 className="meta mt-10 mb-3">This week</h2>
      <motion.div {...rise(0.12)} className="grid grid-cols-2 gap-3">
        <Stat icon={Fire} value={stats?.streak} label="Day streak" />
        <Stat icon={CalendarBlank} value={stats?.totalWorkouts} label="Workouts" />
        <Stat
          icon={Package}
          value={stats ? `${(stats.totalVolume / 1000).toFixed(1)}t` : undefined}
          label="Volume"
        />
        <Stat icon={Stack} value={stats?.totalSets} label="Sets" />
      </motion.div>

      {completed.length > 0 && (
        <>
          <h2 className="meta mt-10 mb-3">Recent</h2>
          <div className="panel divide-y divide-line p-0">
            {completed.map((w) => (
              <div key={w._id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-[15px] font-medium">{w.name}</p>
                  <p className="meta mt-0.5 normal-case">{w.date}</p>
                </div>
                <span className="rounded-full bg-pale-green px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.05em] text-pale-greentext">
                  Done
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
