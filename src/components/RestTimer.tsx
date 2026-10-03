import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, Plus, X } from "@phosphor-icons/react";
import { formatRest } from "../lib/restTimer";

interface Props {
  remainingMs: number;
  totalMs: number;
  running: boolean;
  /** What the athlete is resting from, for context. */
  context: string;
  onPause: () => void;
  onResume: () => void;
  onAdd: () => void;
  onDismiss: () => void;
}

const SIZE = 38;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RestTimerStrip({
  remainingMs,
  totalMs,
  running,
  context,
  onPause,
  onResume,
  onAdd,
  onDismiss,
}: Props) {
  const reduce = useReducedMotion();
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: 10 }}
      transition={{ duration: 0.22 }}
      className="glass mx-auto mb-2 flex w-full max-w-md items-center gap-3 rounded-[14px] p-3 shadow-[var(--shadow-panel)]"
      role="timer"
      aria-label={`Rest ${formatRest(remainingMs)} remaining`}
    >
      {/* Progress ring drains as the rest runs down */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--line)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="label">Resting</p>
        <p className="num mt-0.5 text-[22px] font-bold leading-none">
          {formatRest(remainingMs)}
        </p>
        <p className="mt-1 truncate text-[12px] text-[var(--ink-2)]">{context}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onAdd}
          className="tab flex h-11 items-center justify-center rounded-lg px-3 text-[13px] font-medium transition-transform active:scale-[0.97]"
          style={{ background: "var(--fill)" }}
          aria-label="Add 30 seconds to the rest timer"
        >
          <Plus size={13} weight="bold" />30s
        </button>
        <button
          onClick={running ? onPause : onResume}
          className="icon-btn"
          aria-label={running ? "Pause rest timer" : "Resume rest timer"}
        >
          {running ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
        </button>
        <button
          onClick={onDismiss}
          className="tab flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--fill)] active:text-[var(--ink)]"
          aria-label="Skip rest"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}