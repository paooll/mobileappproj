import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretLeft, ChartLine, TrendDown, TrendUp } from "@phosphor-icons/react";
import { loadArchive, type Workout, type WorkoutSet } from "../lib/data";
import {
  exerciseSummaries,
  formatChange,
  shortDate,
  strengthSeries,
  totalVolume,
  weeklyVolume,
} from "../lib/progress";
import { formatVolume, toDisplay, useUnit } from "../lib/units";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "../components/Toast";
import ThemeToggle from "../components/ThemeToggle";
import ChipRow from "../components/ChipRow";
import TrendChart from "../components/TrendChart";
import BarChart from "../components/BarChart";

export default function Progress() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unit] = useUnit();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [setsByWorkout, setSetsByWorkout] = useState<Map<string, WorkoutSet[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lift, setLift] = useState<string>("");
  const [point, setPoint] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadArchive(user.uid)
      .then(({ workouts: w, setsByWorkout: s }) => {
        if (cancelled) return;
        setWorkouts(w);
        setSetsByWorkout(s);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) toast("Couldn't load your progress. Pull to refresh later.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const summaries = useMemo(
    () => exerciseSummaries(workouts, setsByWorkout),
    [workouts, setsByWorkout]
  );

  // Until the athlete picks a lift, show the strongest one on record
  const activeLift = lift || summaries[0]?.exerciseName || "";

  const series = useMemo(
    () => strengthSeries(workouts, setsByWorkout, activeLift),
    [workouts, setsByWorkout, activeLift]
  );
  const current = summaries.find((s) => s.exerciseName === activeLift) ?? null;
  const weeks = useMemo(() => weeklyVolume(workouts, setsByWorkout, 8), [workouts, setsByWorkout]);
  const volumeSum = totalVolume(weeks);
  const activeWeeks = weeks.filter((w) => w.workouts > 0).length;
  const avgVolume = activeWeeks > 0 ? volumeSum / activeWeeks : 0;

  const e1rm = (kg: number) => `${toDisplay(kg, unit)} ${unit}`;
  const fmt = (v: number) => formatVolume(v, unit).value;

  const selected = point !== null && point < series.length ? series[point] : null;
  const up = (current?.changePct ?? 0) >= 0;

  if (!loading && summaries.length === 0) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
        <button
          onClick={() => navigate(-1)}
          className="tab -ml-2 flex items-center gap-0.5 text-[15px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
        >
          <CaretLeft size={18} weight="bold" /> Back
        </button>
        <div className="panel mt-6 flex flex-col items-center px-6 py-12 text-center">
          <ChartLine size={22} className="text-[var(--ink-3)]" />
          <p className="mt-3 max-w-[30ch] text-[15px] leading-snug text-[var(--ink-2)]">
            Log a few weighted sets and your estimated strength and weekly volume
            will chart themselves here.
          </p>
          <button onClick={() => navigate("/app")} className="btn-line mt-5">
            Start a workout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),48px)]">
      <button
        onClick={() => navigate(-1)}
        className="tab -ml-2 flex items-center gap-0.5 text-[15px] font-medium text-[var(--ink-2)] transition-opacity active:opacity-60"
      >
        <CaretLeft size={18} weight="bold" /> Back
      </button>
      <div className="mt-4 flex items-start justify-between">
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Progress</h1>
        <ThemeToggle />
      </div>

      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--fill)]" />
          <div className="h-64 animate-pulse rounded-[14px] bg-[var(--fill)]" />
          <div className="h-48 animate-pulse rounded-[14px] bg-[var(--fill)]" />
        </div>
      ) : (
        <>
          <h2 className="label mt-8 mb-3">Lift</h2>
          <ChipRow
            options={summaries.map((s) => s.exerciseName)}
            value={activeLift}
            onChange={(name) => {
              setLift(name);
              setPoint(null);
            }}
            label="All lifts"
          />

          {/* Estimated one rep max over time */}
          <div className="panel mt-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{activeLift}</p>
                <p className="label mt-0.5 normal-case">Estimated one rep max</p>
              </div>
              {current && (
                <span
                  className="num flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold"
                  style={{ background: "var(--fill)", color: "var(--ink-2)" }}
                >
                  {up ? <TrendUp size={12} weight="bold" /> : <TrendDown size={12} weight="bold" />}
                  {formatChange(current.changePct)}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="num text-[34px] font-bold leading-none tracking-[-0.03em]">
                {current ? e1rm(current.best) : "–"}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">
              {current
                ? `${current.sessions} ${current.sessions === 1 ? "session" : "sessions"}, best on ${shortDate(current.bestDate)}`
                : ""}
            </p>

            <div className="mt-3">
              {series.length < 2 ? (
                <div className="flex h-[190px] items-center justify-center text-center text-[13px] leading-snug text-[var(--ink-3)]">
                  Log this lift twice and the trend starts here.
                </div>
              ) : (
                <TrendChart
                  points={series.map((p) => ({ label: shortDate(p.date), value: p.e1rm }))}
                  summary={`Estimated one rep max for ${activeLift}, from ${e1rm(series[0].e1rm)} on ${shortDate(series[0].date)} to ${e1rm(series[series.length - 1].e1rm)} on ${shortDate(series[series.length - 1].date)}.`}
                  selected={point}
                  onSelect={setPoint}
                  formatValue={e1rm}
                />
              )}
            </div>

            <p className="mt-1 min-h-[18px] text-[13px] text-[var(--ink-2)]">
              {selected
                ? `${shortDate(selected.date)}: ${toDisplay(selected.weight, unit)} ${unit} × ${selected.reps}`
                : series.length > 1
                  ? "Tap the chart for the set behind a point."
                  : ""}
            </p>
          </div>

          {/* Weekly volume */}
          <h2 className="label mt-8 mb-3">Weekly volume</h2>
          <div className="panel p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="num text-[26px] font-bold leading-none tracking-[-0.02em]">
                  {fmt(volumeSum)}
                </span>
                <span className="ml-1 text-[13px] font-medium text-[var(--ink-3)]">
                  {formatVolume(volumeSum, unit).suffix}
                </span>
              </div>
              <span className="label">Last 8 weeks</span>
            </div>
            <p className="mt-1 text-[13px] text-[var(--ink-2)]">
              {activeWeeks > 0
                ? `${fmt(avgVolume)} ${formatVolume(avgVolume, unit).suffix} on average across ${activeWeeks} training ${activeWeeks === 1 ? "week" : "weeks"}.`
                : "No sessions logged in the last 8 weeks."}
            </p>

            <div className="mt-4">
              <BarChart
                bars={weeks.map((w) => ({ label: shortDate(w.weekStart), value: w.volume }))}
                selected={week}
                onSelect={setWeek}
                summary={`Weekly training volume for the last 8 weeks, ${fmt(volumeSum)} ${formatVolume(volumeSum, unit).suffix} in total.`}
                formatValue={(v) => `${fmt(v)} ${formatVolume(v, unit).suffix}`}
              />
            </div>

            <p className="mt-1 min-h-[18px] text-[13px] text-[var(--ink-2)]">
              {week !== null && weeks[week]
                ? `Week of ${shortDate(weeks[week].weekStart)}: ${weeks[week].workouts} ${
                    weeks[week].workouts === 1 ? "session" : "sessions"
                  }, ${weeks[week].sets} sets.`
                : "Tap a bar for that week's detail."}
            </p>
          </div>

          <p className="mt-6 text-[12px] leading-relaxed text-[var(--ink-3)]">
            One rep max is estimated from your best set with the Epley formula, so treat it
            as a direction of travel rather than a tested number.
          </p>
        </>
      )}
    </div>
  );
}