import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignOut } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import {
  signOut,
  subscribeWorkouts,
  subscribeSets,
  computeStats,
  type Workout,
  type WorkoutSet,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";

export default function Profile() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(
    new Map()
  );

  useEffect(() => {
    if (!user) return;
    const unsubWorkouts = subscribeWorkouts(user.uid, setWorkouts);
    const unsubs: Array<() => void> = [];
    // Subscribe to sets of the 10 most recent completed workouts for live stats
    const completedIds = workouts
      .filter((w) => w.completed)
      .slice(0, 10)
      .map((w) => w.id);
    for (const wid of completedIds) {
      unsubs.push(
        subscribeSets(wid, (sets) =>
          setSetsByWorkout((prev) => new Map(prev).set(wid, sets))
        )
      );
    }
    return () => {
      unsubWorkouts();
      unsubs.forEach((u) => u());
    };
  }, [user, workouts.filter((w) => w.completed).slice(0, 10).map((w) => w.id).join(",")]);

  const stats = useMemo(
    () => computeStats(workouts, setsByWorkout),
    [workouts, setsByWorkout]
  );

  const doSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error(err);
      toast("Couldn't sign out. Try again.", "error");
    }
  };

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <div className="flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Profile</h1>
        <ThemeToggle />
      </div>

      <div className="panel mt-6 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ink)] text-[18px] font-bold text-[var(--bg)]">
            R
          </div>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">
              {user?.email ?? "Athlete"}
            </p>
            <p className="label mt-0.5 normal-case">Reprange member</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] border-t border-[var(--line)] pt-4 text-center">
          <div>
            <p className="num text-[20px] font-semibold">{stats.streak}</p>
            <p className="label mt-0.5">Streak</p>
          </div>
          <div>
            <p className="num text-[20px] font-semibold">
              {stats.totalWorkouts}
            </p>
            <p className="label mt-0.5">Workouts</p>
          </div>
          <div>
            <p className="num text-[20px] font-semibold">
              {stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}t`
                : `${stats.totalVolume}`}
            </p>
            <p className="label mt-0.5">Volume</p>
          </div>
        </div>
      </div>

      <button
        onClick={doSignOut}
        className="btn-line mt-8 w-full text-[var(--ink-2)]"
        disabled={!user}
      >
        <SignOut size={16} /> Sign out
      </button>

      <p className="mt-12 text-center text-[13px] text-[var(--ink-3)]">Reprange</p>
    </div>
  );
}
