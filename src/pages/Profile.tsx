import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignOut } from "@phosphor-icons/react";
import { signOut, getStats, type Stats } from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";

export default function Profile() {
  const user = useAuthUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    getStats(user.uid).then(setStats);
  }, [user]);

  const doSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <h1 className="text-[30px] font-bold tracking-[-0.02em]">Profile</h1>

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
            <p className="num text-[20px] font-semibold">{stats?.streak ?? 0}</p>
            <p className="label mt-0.5">Streak</p>
          </div>
          <div>
            <p className="num text-[20px] font-semibold">
              {stats?.totalWorkouts ?? 0}
            </p>
            <p className="label mt-0.5">Workouts</p>
          </div>
          <div>
            <p className="num text-[20px] font-semibold">
              {stats
                ? stats.totalVolume >= 1000
                  ? `${(stats.totalVolume / 1000).toFixed(1)}t`
                  : `${stats.totalVolume}`
                : 0}
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
