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

export default function History() {
  const user = useAuthUser();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [setsCount, setSetsCount] = useState<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const { toast } = useToast();

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
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user, completedIds]);

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

      {completed.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-12 text-center">
          <span className="num text-[40px] font-bold text-[var(--ink-3)]">0</span>
          <p className="mt-3 max-w-[24ch] text-[15px] text-[var(--ink-2)]">
            No sessions yet. Pick a quick start on Today and log your first set.
          </p>
        </div>
      ) : (
        <div className="panel mt-6 divide-y divide-[var(--line)]">
          {completed.map((w) => (
            <div key={w.id} className="flex items-center justify-between px-4 py-3.5">
              <button
                className="tab flex-1 text-left transition-opacity active:opacity-60"
                onClick={() => navigate(`/app/workout/${w.id}`)}
              >
                <p className="text-[15px] font-medium">{w.name}</p>
                <p className="label mt-0.5 normal-case">
                  {w.date}
                  {setsCount.has(w.id) ? ` · ${setsCount.get(w.id)} sets` : ""}
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
          ))}
        </div>
      )}
    </div>
  );
}
