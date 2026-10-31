import { motion, useReducedMotion } from "framer-motion";
import { formatFood, type FoodUnit } from "../lib/foodUnits";

const SIZE = 96;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Animated SVG ring for protein progress. Fills clockwise from 12 o'clock in
 * --food amber; switches to --success green when the athlete hits 100%.
 *
 * Respects prefers-reduced-motion: when reduced, the ring renders at its final
 * position with no transition.
 */
export default function ProteinRing({
  eaten,
  target,
  unit,
}: {
  eaten: number;
  target: number;
  unit: FoodUnit;
}) {
  const reduced = useReducedMotion();
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const hit = pct >= 100;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Protein against target"
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--food-dim)"
          strokeWidth={STROKE}
        />
        {/* Fill */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={hit ? "var(--success)" : "var(--food)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
        />
        {/* Center text */}
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ink)"
          fontSize="15"
          fontWeight="700"
          fontFamily="inherit"
        >
          {formatFood(eaten, unit)}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ink-2)"
          fontSize="10"
          fontWeight="500"
          fontFamily="inherit"
        >
          / {formatFood(target, unit)}
        </text>
      </svg>
    </div>
  );
}
