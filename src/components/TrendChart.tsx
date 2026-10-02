import { useCallback } from "react";
import { useElementWidth } from "../hooks/useElementWidth";

export interface TrendPoint {
  label: string;
  value: number;
}

interface Props {
  points: TrendPoint[];
  /** Text summary for screen readers, e.g. "Estimated one rep max rose from 40 to 47 kg". */
  summary: string;
  selected: number | null;
  onSelect: (index: number | null) => void;
  height?: number;
  formatValue: (value: number) => string;
}

const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

/**
 * A plain line with a soft area under it. Straight segments, no smoothing: the
 * point is to show what was actually lifted, not to invent a curve through it.
 */
export default function TrendChart({
  points,
  summary,
  selected,
  onSelect,
  height = 190,
  formatValue,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const innerW = Math.max(1, width - PAD_X * 2);
  const innerH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);

  const values = points.map((p) => p.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  // A flat series still needs a visible band, and a little headroom keeps the
  // line off the very top edge
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.05);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const x = useCallback(
    (i: number) => (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    [points.length, innerW]
  );
  const y = useCallback(
    (v: number) => innerH - ((v - min) / (max - min)) * innerH,
    [innerH, min, max]
  );

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area =
    points.length > 1
      ? `${line} L${x(points.length - 1)},${innerH} L${x(0)},${innerH} Z`
      : "";

  const pick = useCallback(
    (clientX: number, target: SVGSVGElement) => {
      if (points.length === 0) return;
      const box = target.getBoundingClientRect();
      const rel = ((clientX - box.left) / box.width) * width - PAD_X;
      const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
      const index = Math.round(rel / step);
      onSelect(Math.min(points.length - 1, Math.max(0, index)));
    },
    [points.length, innerW, width, onSelect]
  );

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${PAD_X},${PAD_TOP})`}>
          {/* Horizontal guides: enough to read a level, few enough to stay quiet */}
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={0}
              x2={innerW}
              y1={t * innerH}
              y2={t * innerH}
              stroke="var(--line)"
              strokeWidth={1}
            />
          ))}

          {area && <path d={area} fill="url(#trend-fill)" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p, i) => {
            const active = selected === i;
            return (
              <circle
                key={`${p.label}-${i}`}
                cx={x(i)}
                cy={y(p.value)}
                r={active ? 5 : 3}
                fill={active ? "var(--ink)" : "var(--bg)"}
                stroke="var(--ink)"
                strokeWidth={2}
              />
            );
          })}
        </g>

        {/* First and last date only: the chart is about the shape, not the dates */}
        <text x={PAD_X} y={height - 6} className="fill-[var(--ink-3)] text-[10px]">
          {points[0]?.label ?? ""}
        </text>
        <text
          x={width - PAD_X}
          y={height - 6}
          textAnchor="end"
          className="fill-[var(--ink-3)] text-[10px]"
        >
          {points.length > 1 ? points[points.length - 1].label : ""}
        </text>
      </svg>

      {selected !== null && points[selected] && (
        <div
          className="num pointer-events-none absolute top-0 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: "var(--ink)",
            color: "var(--bg)",
            left: Math.min(Math.max(0, PAD_X + x(selected) - 24), Math.max(0, width - 60)),
          }}
        >
          {formatValue(points[selected].value)}
        </div>
      )}
    </div>
  );
}