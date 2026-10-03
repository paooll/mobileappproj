import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { formatEntryValue } from "../lib/setEntry";

interface Props {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  /** Sits after the number, e.g. the unit. */
  suffix?: string;
  disabled?: boolean;
}

const HOLD_DELAY = 320;
const HOLD_REPEAT = 90;

/**
 * Number control built for one thumb: big minus, big plus, and the number in
 * between stays tappable for the rare exact value. Holding a button repeats, so
 * a jump from 40 to 60 kg is one press held down instead of ten taps.
 */
export default function Stepper({
  label,
  value,
  step,
  onChange,
  suffix,
  disabled = false,
}: Props) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Held buttons repeat off the latest value, not the one captured at press time,
  // and resync whenever the parent clamps what it accepted.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  const nudge = (direction: 1 | -1) => {
    const size = step > 0 ? step : 1;
    const next = Math.max(0, Math.round((latest.current + direction * size) * 100) / 100);
    latest.current = next;
    onChange(next);
  };

  // Press and hold to repeat
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  // A pointer press already nudged once, so the click that follows must not
  // nudge a second time. Keyboard activation has no pointerdown, so it does.
  const viaPointer = useRef(false);
  const stopHold = () => {
    const t = timers.current;
    if (t.delay) window.clearTimeout(t.delay);
    if (t.repeat) window.clearInterval(t.repeat);
    timers.current = {};
  };
  useEffect(() => stopHold, []);

  const startHold = (direction: 1 | -1) => {
    if (disabled) return;
    stopHold();
    viaPointer.current = true;
    nudge(direction);
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => nudge(direction), HOLD_REPEAT);
    }, HOLD_DELAY);
  };

  const click = (direction: 1 | -1) => {
    if (viaPointer.current) {
      viaPointer.current = false;
      return;
    }
    nudge(direction);
  };

  const stepSize = step > 0 ? step : 1;

  const commit = () => {
    const cleaned = draft.trim().replace(",", ".");
    if (cleaned) {
      const n = Number(cleaned);
      if (isFinite(n) && n >= 0) onChange(Math.round(n * 100) / 100);
    }
    setTyping(false);
  };

  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <div
        className="mt-1 flex items-stretch overflow-hidden rounded-xl bg-[var(--fill)]"
        style={{ height: 56 }}
      >
        <button
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onClick={() => click(-1)}
          disabled={disabled}
          aria-label={`Decrease ${label.toLowerCase()} by ${stepSize}`}
          className="tab flex w-11 shrink-0 items-center justify-center text-[var(--ink-2)] transition-colors active:bg-[var(--line)] active:text-[var(--ink)] disabled:opacity-30"
        >
          <Minus size={16} weight="bold" />
        </button>

        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          {typing ? (
            <input
              ref={inputRef}
              className="num h-full w-full min-w-0 bg-transparent px-1 text-center text-[22px] font-bold outline-none"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") setTyping(false);
              }}
              aria-label={label}
            />
          ) : (
            <button
              onClick={() => {
                setDraft(formatEntryValue(value));
                setTyping(true);
              }}
              disabled={disabled}
              aria-label={`${label}, tap to type a value`}
              className="num flex h-full min-w-0 items-baseline justify-center gap-1 px-1 text-[22px] font-bold disabled:opacity-30"
            >
              <span className="truncate">{formatEntryValue(value)}</span>
              {suffix && (
                <span className="text-[12px] font-semibold text-[var(--ink-3)]">{suffix}</span>
              )}
            </button>
          )}
        </div>

        <button
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onClick={() => click(1)}
          disabled={disabled}
          aria-label={`Increase ${label.toLowerCase()} by ${stepSize}`}
          className="tab flex w-11 shrink-0 items-center justify-center text-[var(--ink-2)] transition-colors active:bg-[var(--line)] active:text-[var(--ink)] disabled:opacity-30"
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}