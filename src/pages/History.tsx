import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash } from "@phosphor-icons/react";
import {
  subscribeWorkouts,
  subscribeSets,
  deleteWorkout,
  type Workout,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import ThemeToggle from "../components/ThemeToggle";
import WorkoutCalendar from "../components/WorkoutCalendar";
import { formatVolume, useUnit } from "../lib/units";

export default function History() {
  const user = useAuthUser();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [setsCount, setSetsCount] = useState<Map<string, number>>(new Map());
  const [setsVolume, setSetsVolume] = useState<Map<string, number>>(new Map());
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unit] = useUnit();

  const remove = async (id: string) => {
    if (!window.confirm("Delete this workout and all its sets? This can't be undone."))
      return;
    try {
      await deleteWorkout(id);
      toast("Workout deleted.", "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't delete the workout. Try again.", "error");
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeWorkouts(user.uid, (list) =>
      setWorkouts(list.filter((w) => w.completed))
    );
    return unsub;
  }, [user]);

  // Live set counts for shown workouts
  const completed = useMemo(() => workouts ?? [], [workouts]);
  const completedIds = useMemo(
    () => completed.slice(0, 20).map((w) => w.id).join(","),
    [completed]
  );
  useEffect(() => {
    if (!user || !completedIds) return;
    const ids = completedIds.split(",");
    const unsubs = ids.map((wid) =>
      subscribeSets(wid, (sets) => {
        setSetsCount((prev) => new Map(prev).set(wid, sets.length));
        setSetsVolume((prev) =>
          new Map(prev).set(
            wid,
            sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
          )
        );
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user, completedIds]);

  const workoutDates = useMemo(() => new Set(completed.map((w) => w.date)), [completed]);
  const shown = useMemo(
    () => (dayFilter ? completed.filter((w) => w.date === dayFilter) : completed),
    [completed, dayFilter]
  );

  if (workouts === null) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <div className="h-9 w-32 animate-pulse rounded-xl bg-[var(--fill)]" />
        <div className="mt-8 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[14px] bg-[var(--fill)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">History</h1>
        <ThemeToggle />
      </div>
      <p className="label mt-1 normal-case">
        {completed.length} completed {completed.length === 1 ? "workout" : "workouts"}
      </p>

      {completed.length > 0 && (
        <WorkoutCalendar
          dates={workoutDates}
          selected={dayFilter}
          onSelect={setDayFilter}
        />
      )}

      {dayFilter && (
        <p className="label mt-6 normal-case">
          Showing {new Date(`${dayFilter}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}

      {completed.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-12 text-center">
          <span className="num text-[40px] font-bold text-[var(--ink-3)]">0</span>
          <p className="mt-3 max-w-[24ch] text-[15px] text-[var(--ink-2)]">
            No sessions yet. Pick a quick start on Today and log your first set.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="panel mt-6 flex flex-col items-center px-6 py-10 text-center">
          <p className="max-w-[26ch] text-[15px] text-[var(--ink-2)]">
            Nothing logged on that day.
          </p>
          <button onClick={() => setDayFilter(null)} className="btn-line mt-4">
            Back to all
          </button>
        </div>
      ) : (
        <div className="panel mt-6 divide-y divide-[var(--line)]">
          {shown.map((w) => {
            const vol = setsVolume.get(w.id);
            const volText = vol ? formatVolume(vol, unit) : null;
            return (
            <div key={w.id} className="flex items-center justify-between px-4 py-3.5">
              <button
                className="tab flex-1 text-left transition-opacity active:opacity-60"
                onClick={() => navigate(`/app/workout/${w.id}`)}
              >
                <p className="text-[15px] font-medium">{w.name}</p>
                <p className="label mt-0.5 normal-case">
                  {w.date}
                  {setsCount.has(w.id) ? ` · ${setsCount.get(w.id)} sets` : ""}
                  {volText ? ` · ${volText.value} ${volText.suffix}` : ""}
                </p>
              </button>
              <button
                onClick={() => remove(w.id)}
                className="tab p-2 text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
                aria-label="Delete workout"
              >
                <Trash size={16} />
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
