import { motion, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { toDisplay, type Unit } from "../lib/units";

interface Props {
  /** Newest set for this exercise, in kg. Null when there is nothing to repeat. */
  last: { weight: number; reps: number } | null;
  unit: Unit;
  onRepeat: (weight: number, reps: number) => void;
}

/**
 * Repeats are the common case in a workout, so the last set is one tap instead
 * of two numbers a person has to remember and retype.
 */
export default function RepeatSet({ last, unit, onRepeat }: Props) {
  const reduce = useReducedMotion();

  if (!last) return null;

  const label = last.weight > 0 ? `${toDisplay(last.weight, unit)} × ${last.reps}` : `${last.reps} reps`;

  return (
    <motion.button
      initial={reduce ? false : { opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onRepeat(last.weight, last.reps)}
      className="tab flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--fill)] px-3 text-[13px] font-medium transition-transform active:scale-[0.97]"
      style={{ height: 40 }}
      aria-label={`Repeat last set, ${label} ${unit}`}
    >
      <ArrowCounterClockwise size={14} weight="bold" />
      <span className="num truncate">{label}</span>
    </motion.button>
  );
}