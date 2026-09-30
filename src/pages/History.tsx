import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash } from "@phosphor-icons/react";
import { listWorkouts, deleteWorkout, type Workout } from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";

export default function History() {
  const user = useAuthUser();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    if (!user) return;
    setWorkouts(await listWorkouts(user.uid));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const completed = workouts.filter((w) => w.completed);

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <h1 className="text-[30px] font-bold tracking-[-0.02em]">History</h1>
      <p className="label mt-1 normal-case">
        {completed.length} completed {completed.length === 1 ? "workout" : "workouts"}
      </p>

      {completed.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center px-6 py-12 text-center">
          <span className="num text-[40px] font-bold text-[var(--ink-3)]">0</span>
          <p className="mt-3 max-w-[24ch] text-[15px] text-[var(--ink-2)]">
            No sessions logged yet. Your first workout is one tap away.
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
                <p className="label mt-0.5 normal-case">{w.date}</p>
              </button>
              <button
                onClick={async () => {
                  await deleteWorkout(w.id);
                  await refresh();
                }}
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
