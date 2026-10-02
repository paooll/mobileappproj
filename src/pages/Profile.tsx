import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignOut, DownloadSimple, Trophy, Check, PencilSimple, ChartLine } from "@phosphor-icons/react";
import ThemeToggle from "../components/ThemeToggle";
import {
  signOut,
  computeStats,
  computePersonalRecords,
  loadArchive,
  type Workout,
  type WorkoutSet,
} from "../lib/data";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import { formatVolume, toDisplay, useUnit, type Unit } from "../lib/units";
import {
  DEFAULT_REST,
  REST_PRESETS,
  formatRest,
  loadRestSettings,
  saveRestSettings,
  type RestSettings,
} from "../lib/restTimer";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS, type UserProfile } from "../lib/profile";

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export default function Profile({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unit, setUnit] = useUnit();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rest, setRest] = useState<RestSettings>(DEFAULT_REST);

  // Rest timer preferences, stored on the same profile doc
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadRestSettings(user.uid).then((s) => {
      if (!cancelled) setRest(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateRest = useCallback(
    async (patch: Partial<RestSettings>) => {
      if (!user) return;
      const previous = rest;
      setRest((prev) => ({ ...prev, ...patch })); // instant feedback, revert on failure
      try {
        await saveRestSettings(user.uid, patch);
      } catch (err) {
        console.error(err);
        setRest(previous);
        toast("Couldn't save that rest setting. Try again.", "error");
      }
    },
    [rest, user, toast]
  );

  // Load the full archive once — needed for accurate stats, PRs, and export.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    loadArchive(user.uid)
      .then(({ workouts: w, setsByWorkout: s }) => {
        if (cancelled) return;
        setWorkouts(w);
        setSetsByWorkout(s);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setLoading(false);
        toast("Couldn't load your stats. Pull to refresh later.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const stats = useMemo(
    () => computeStats(workouts, setsByWorkout),
    [workouts, setsByWorkout]
  );
  const records = useMemo(
    () => computePersonalRecords(workouts, setsByWorkout).slice(0, 8),
    [workouts, setsByWorkout]
  );
  const volume = formatVolume(stats.totalVolume, unit);

  const exportData = useCallback(() => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        account: user?.email ?? null,
        unit,
        stats,
        workouts: workouts
          .filter((w) => w.completed)
          .map((w) => ({
            name: w.name,
            date: w.date,
            completedAt: w.completedAt,
            sets: (setsByWorkout.get(w.id) ?? []).map((s) => ({
              exercise: s.exerciseName,
              weightKg: s.weight,
              reps: s.reps,
            })),
          })),
        personalRecords: computePersonalRecords(workouts, setsByWorkout),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reprange-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded.", "success");
    } catch (err) {
      console.error(err);
      toast("Couldn't export your data. Try again.", "error");
    } finally {
      setExporting(false);
    }
  }, [exporting, user, unit, stats, workouts, setsByWorkout, toast]);

  const doSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (err) {
      console.error(err);
      toast("Couldn't sign out. Try again.", "error");
    }
  };

  const UNIT_OPTIONS: Unit[] = ["kg", "lb"];

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

        {loading ? (
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-[var(--fill)]"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] border-t border-[var(--line)] pt-4 text-center">
            <div>
              <p className="num text-[20px] font-semibold">{stats.streak}</p>
              <p className="label mt-0.5">Streak</p>
            </div>
            <div>
              <p className="num text-[20px] font-semibold">{stats.totalWorkouts}</p>
              <p className="label mt-0.5">Workouts</p>
            </div>
            <div>
              <p className="num text-[20px] font-semibold">
                {volume.value}
                <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                  {volume.suffix}
                </span>
              </p>
              <p className="label mt-0.5">Volume</p>
            </div>
          </div>
        )}
      </div>

      {/* What they told us at setup */}
      <h2 className="label mt-10 mb-3">Your setup</h2>
      <div className="panel divide-y divide-[var(--line)]">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-[15px] font-medium">
              {EXPERIENCE_OPTIONS.find((e) => e.value === profile.experience)?.label ??
                "Experience"}
            </p>
            <p className="label mt-0.5 normal-case">Training background</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-[15px] font-medium">
              {GOAL_OPTIONS.find((g) => g.value === profile.goal)?.label ?? "Goal"}
            </p>
            <p className="label mt-0.5 normal-case">Training goal</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="num text-[15px] font-medium">{profile.daysPerWeek} days</p>
            <p className="label mt-0.5 normal-case">Weekly target</p>
          </div>
        </div>
        {profile.equipment.length > 0 && (
          <div className="px-4 py-3.5">
            <p className="text-[15px] font-medium">Equipment</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.equipment.map((e) => (
                <span
                  key={e}
                  className="rounded-lg px-2.5 py-1 text-[12px] font-medium"
                  style={{ background: "var(--fill)", color: "var(--ink-2)" }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => navigate("/onboarding")}
        className="btn-line mt-3 w-full"
      >
        <PencilSimple size={16} /> Edit setup
      </button>

      {/* Settings */}
      <h2 className="label mt-10 mb-3">Settings</h2>
      <div className="flex flex-col gap-2">
        <SettingRow
          label="Weight unit"
          hint={
            unit === "kg"
              ? "Weights are shown in kilograms."
              : "Weights are shown in pounds."
          }
        >
          <div
            className="flex shrink-0 rounded-xl p-1"
            style={{ background: "var(--fill)" }}
            role="group"
            aria-label="Weight unit"
          >
            {UNIT_OPTIONS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className="tab relative flex h-10 w-12 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors"
                style={{
                  background: unit === u ? "var(--ink)" : "transparent",
                  color: unit === u ? "var(--bg)" : "var(--ink-2)",
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow
          label="Rest timer"
          hint={`Starts after every set you log. Currently ${formatRest(
            rest.seconds * 1000
          )}.`}
        >
          <button
            onClick={() => updateRest({ autoStart: !rest.autoStart })}
            aria-pressed={rest.autoStart}
            className="tab relative flex h-10 w-12 shrink-0 items-center justify-center rounded-xl text-[12px] font-semibold transition-colors"
            style={{
              background: rest.autoStart ? "var(--ink)" : "var(--fill)",
              color: rest.autoStart ? "var(--bg)" : "var(--ink-2)",
            }}
          >
            {rest.autoStart ? "On" : "Off"}
          </button>
        </SettingRow>

        <div className="panel p-4">
          <p className="text-[15px] font-medium">Rest between sets</p>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">
            Longer for heavy compounds, shorter for accessories and circuits.
          </p>
          <div
            className="mt-3 flex gap-1.5"
            role="group"
            aria-label="Rest duration"
          >
            {REST_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => updateRest({ seconds: s })}
                aria-pressed={rest.seconds === s}
                className="tab num flex h-11 flex-1 items-center justify-center rounded-xl text-[13px] font-semibold transition-colors"
                style={{
                  background: rest.seconds === s ? "var(--ink)" : "var(--fill)",
                  color: rest.seconds === s ? "var(--bg)" : "var(--ink-2)",
                }}
              >
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>
        </div>

        <SettingRow
          label="Export my data"
          hint={`Download every session and set as JSON${
            unit === "kg" ? ", in kilograms" : ""
          }.`}
        >
          <button
            onClick={exportData}
            disabled={exporting || loading}
            className="btn-quiet shrink-0"
          >
            {exporting ? (
              "Working…"
            ) : (
              <>
                <DownloadSimple size={15} weight="bold" /> Export
              </>
            )}
          </button>
        </SettingRow>
      </div>

      {/* Personal records */}
      <h2 className="label mt-10 mb-3">Personal records</h2>
      <button
        onClick={() => navigate("/app/progress")}
        className="btn-line mb-3 w-full"
        disabled={loading}
      >
        <ChartLine size={16} /> See progress
      </button>
      {loading ? (
        <div className="panel flex flex-col gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--fill)]" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-10 text-center">
          <Trophy size={22} className="text-[var(--ink-3)]" />
          <p className="mt-3 max-w-[26ch] text-[15px] text-[var(--ink-2)]">
            Log a weighted set and your heaviest lifts will show up here.
          </p>
        </div>
      ) : (
        <div className="panel divide-y divide-[var(--line)]">
          {records.map((r) => (
            <div key={r.exerciseName} className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{r.exerciseName}</p>
                <p className="label mt-0.5 normal-case">
                  {r.date}
                  <span className="mx-1.5 inline-flex items-center gap-0.5 align-middle">
                    <Check size={10} weight="bold" />
                    {r.reps} reps
                  </span>
                </p>
              </div>
              <span className="num shrink-0 text-[15px] font-semibold">
                {toDisplay(r.weight, unit)}
                <span className="ml-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                  {unit}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

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
