import { motion, useReducedMotion } from "framer-motion";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for screen readers, e.g. "Start rest timer automatically". */
  label: string;
  disabled?: boolean;
}

const W = 50;
const H = 30;
const KNOB = 24;

/**
 * On/off control. Built as a real switch rather than a labelled button, because
 * "On"/"Off" text changes size and shape the moment it is tapped.
 */
export default function Switch({ checked, onChange, label, disabled = false }: Props) {
  const reduce = useReducedMotion();

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{
        width: W,
        height: H,
        background: checked ? "var(--ink)" : "var(--line)",
      }}
    >
      <motion.span
        className="absolute top-1/2 block rounded-full"
        style={{ background: checked ? "var(--bg)" : "var(--surface)" }}
        animate={{
          x: checked ? W - KNOB - 3 : 3,
          y: "-50%",
          width: KNOB,
          height: KNOB,
        }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", bounce: 0, duration: 0.35 }
        }
      />
    </button>
  );
}