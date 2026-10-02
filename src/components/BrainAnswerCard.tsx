import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import type { BrainAnswer } from "../lib/brain";
import { formatVolume, toDisplay, type Unit } from "../lib/units";
import TrendChart from "./TrendChart";
import BarChart from "./BarChart";

const INTENT_LABEL: Record<string, string> = {
  stall: "Progress check",
  increase: "Load decision",
  today: "Session plan",
  neglect: "Muscle balance",
  strongest: "Best session",
  volume: "Volume",
  consistency: "Consistency",
  last: "Last session",
  unknown: "Not answered",
};

interface Props {
  answer: BrainAnswer;
  unit: Unit;
}

export default function BrainAnswerCard({ answer, unit }: Props) {
  const navigate = useNavigate();
  const [point, setPoint] = useState<number | null>(null);

  const fmt = (v: number) => `${toDisplay(v, unit)} ${unit}`;
  const volFmt = (v: number) => {
    const f = formatVolume(v, unit);
    return `${f.value} ${f.suffix}`;
  };

  return (
    <div className="panel p-4">
      <p className="label">{INTENT_LABEL[answer.intent] ?? "Answer"}</p>
      <p className="mt-1.5 text-[16px] font-semibold leading-snug">{answer.headline}</p>

      {answer.facts.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
          {answer.facts.slice(0, 3).map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="num truncate text-[16px] font-bold leading-none">{f.value}</p>
              <p className="label mt-1.5 normal-case leading-tight">{f.label}</p>
            </div>
          ))}
        </div>
      )}

      {answer.points.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {answer.points.map((p) => (
            <li key={p} className="flex gap-2 text-[13px] leading-snug text-[var(--ink-2)]">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--ink-3)]" />
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>
      )}

      {answer.chart && answer.chart.points.length > 1 && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="label mb-1">{answer.chart.caption}</p>
          {answer.chart.kind === "trend" ? (
            <TrendChart
              points={answer.chart.points}
              summary={`${answer.chart.caption} over ${answer.chart.points.length} sessions`}
              selected={point}
              onSelect={setPoint}
              height={140}
              formatValue={fmt}
            />
          ) : (
            <BarChart
              bars={answer.chart.points}
              selected={point}
              onSelect={setPoint}
              height={120}
              summary={`${answer.chart.caption} over ${answer.chart.points.length} weeks`}
              formatValue={volFmt}
            />
          )}
        </div>
      )}

      {answer.action && (
        <button
          onClick={() => navigate(answer.action!.to)}
          className="btn-line mt-4 w-full"
        >
          {answer.action.label}
          <ArrowRight size={15} weight="bold" />
        </button>
      )}
    </div>
  );
}