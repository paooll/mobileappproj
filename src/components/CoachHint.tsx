import { motion, useReducedMotion } from "framer-motion";
import { Minus, TrendDown, TrendUp, X } from "@phosphor-icons/react";
import type { CoachSuggestion } from "../lib/coach";
import { toDisplay, type Unit } from "../lib/units";

interface Props {
  loading: boolean;
  hasHistory: boolean;
  suggestion: CoachSuggestion | null;
  unit: Unit;
  compareWeight: number | null;
  onUse: () => void;
  onDismiss: () => void;
}

const ICON = 14;

export default function CoachHint({
  loading,
  hasHistory,
  suggestion,
  unit,
  compareWeight,
  onUse,
  onDismiss,
}: Props) {
  const reduce = useReducedMotion();

  if (loading) {
    return (
      <div className="mb-2 rounded-xl bg-[var(--fill)] px-3 py-2.5">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-[var(--line)]" />
      </div>
    );
  }

  // Nothing logged for this exercise yet: coach by asking for a baseline.
  if (!hasHistory || !suggestion) {
    return (
      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-[var(--fill)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="label">First time here</p>
          <p className="mt-0.5 truncate text-[13px] text-[var(--ink-2)]">
            Pick a weight you can move for 8 to 12 clean reps.
          </p>
        </div>
      </div>
    );
  }

  const loaded = suggestion.weight > 0;
  const value = loaded
    ? `${toDisplay(suggestion.weight, unit)} ${unit} × ${suggestion.reps}`
    : `${suggestion.reps} reps`;
  const Icon = suggestion.kind === "increase" ? TrendUp : suggestion.kind === "deload" ? TrendDown : Minus;

  const delta = (() => {
    if (!loaded || compareWeight === null) return null;
    const from = toDisplay(compareWeight, unit);
    const to = toDisplay(suggestion.weight, unit);
    if (from === to) return null;
    return `${to > from ? "+" : "−"}${Math.abs(to - from)} ${unit}`;
  })();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-2 flex items-start gap-2 rounded-xl bg-[var(--fill)] px-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="label">Next set</p>
          {delta && (
            <span className="num flex items-center gap-0.5 text-[11px] font-semibold text-[var(--ink-3)]">
              <Icon size={11} weight="bold" />
              {delta}
            </span>
          )}
        </div>
        <p className="num mt-0.5 text-[17px] font-bold leading-tight">{value}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-2)]">{suggestion.reason}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onUse} className="btn-quiet">
          Use
        </button>
        <button
          onClick={onDismiss}
          className="tab -mr-1 p-2 text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
          aria-label="Hide coach suggestion"
        >
          <X size={ICON + 1} />
        </button>
      </div>
    </motion.div>
  );
}