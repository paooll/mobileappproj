import { useElementWidth } from "../hooks/useElementWidth";

export interface Bar {
  label: string;
  value: number;
}

interface Props {
  bars: Bar[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  height?: number;
  summary: string;
  formatValue: (value: number) => string;
}

const PAD_X = 10;
const PAD_TOP = 16;
const GAP = 6;

/**
 * Weekly volume as bars. Empty weeks keep a faint stub so a gap in training
 * reads as a gap rather than disappearing off the end of the chart.
 */
export default function BarChart({
  bars,
  selected,
  onSelect,
  height = 150,
  summary,
  formatValue,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const innerW = Math.max(1, width - PAD_X * 2);
  const innerH = Math.max(1, height - PAD_TOP);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = bars.length > 0 ? innerW / bars.length : innerW;
  const barW = Math.max(6, slot - GAP);

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        onPointerDown={() => onSelect(null)}
      >
        <line
          x1={PAD_X}
          x2={width - PAD_X}
          y1={PAD_TOP + innerH}
          y2={PAD_TOP + innerH}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {bars.map((b, i) => {
          const h = b.value > 0 ? Math.max(3, (b.value / max) * (innerH - 6)) : 2;
          const x = PAD_X + i * slot + (slot - barW) / 2;
          const active = selected === i;
          const dimmed = selected !== null && !active;
          return (
            <g key={`${b.label}-${i}`}>
              <rect
                x={x}
                y={PAD_TOP + innerH - h}
                width={barW}
                height={h}
                rx={4}
                fill={b.value > 0 ? "var(--ink)" : "var(--line)"}
                opacity={dimmed ? 0.35 : 1}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(active ? null : i);
                }}
              />
              {active && (
                <text
                  x={x + barW / 2}
                  y={PAD_TOP + innerH - h - 5}
                  textAnchor="middle"
                  className="fill-[var(--ink-2)] text-[10px] font-semibold"
                >
                  {formatValue(b.value)}
                </text>
              )}
            </g>
          );
        })}
        <text x={PAD_X} y={11} className="fill-[var(--ink-3)] text-[10px]">
          {bars[0]?.label ?? ""}
        </text>
        <text
          x={width - PAD_X}
          y={11}
          textAnchor="end"
          className="fill-[var(--ink-3)] text-[10px]"
        >
          {bars.length > 1 ? bars[bars.length - 1].label : ""}
        </text>
      </svg>
    </div>
  );
}