import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Key } from "@phosphor-icons/react";
import { useToast } from "./Toast";
import { changePassword, friendlyAccountError } from "../lib/account";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MIN_LENGTH = 6;

/**
 * Changing a password is three fields and a decision, so it gets its own sheet
 * rather than three more rows on a settings page that is already long.
 *
 * The form is a separate component so that it mounts fresh on every open: a
 * typed password never survives a closed sheet, and there is no state to reset.
 */
export default function PasswordSheet({ open, onClose }: Props) {
  const reduce = useReducedMotion();
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <PasswordForm key={uid} uid={uid} reduce={reduce} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}

function PasswordForm({
  uid,
  reduce,
  onClose,
}: {
  uid: string;
  reduce: boolean | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const firstField = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Focusing is the one thing an effect is genuinely for: reaching into the DOM.
  useEffect(() => {
    const t = window.setTimeout(() => firstField.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, []);

  const mismatched = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && confirm === next && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await changePassword(current, next);
      toast("Password updated.", "success");
      onClose();
    } catch (err) {
      console.error(err);
      setError(friendlyAccountError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
        style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative mx-4 mb-[max(env(safe-area-inset-bottom),12px)] w-full max-w-md rounded-3xl p-5 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--fill)", color: "var(--ink)" }}
          >
            <Key size={18} weight="fill" />
          </span>
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="text-[17px] font-bold tracking-[-0.01em]">
              Change password
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-[var(--ink-2)]">
              You'll stay signed in on this device.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5">
          <label className="label" htmlFor={`${uid}-current`}>
            Current password
          </label>
          <input
            ref={firstField}
            id={`${uid}-current`}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="field mt-1.5"
            required
          />

          <label className="label mt-4 block" htmlFor={`${uid}-next`}>
            New password
          </label>
          <input
            id={`${uid}-next`}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={MIN_LENGTH}
            aria-invalid={tooShort || undefined}
            aria-describedby={tooShort ? `${uid}-short` : undefined}
            className="field mt-1.5"
            required
          />
          {tooShort && (
            <p id={`${uid}-short`} className="mt-1.5 text-[12px] text-[var(--danger)]">
              At least {MIN_LENGTH} characters.
            </p>
          )}

          <label className="label mt-4 block" htmlFor={`${uid}-confirm`}>
            Confirm new password
          </label>
          <input
            id={`${uid}-confirm`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatched || undefined}
            aria-describedby={mismatched ? `${uid}-mismatch` : undefined}
            className="field mt-1.5"
            required
          />
          {mismatched && (
            <p id={`${uid}-mismatch`} className="mt-1.5 text-[12px] text-[var(--danger)]">
              Those don't match yet.
            </p>
          )}

          {error && (
            <p
              id={`${uid}-error`}
              role="alert"
              className="mt-4 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug text-[var(--danger)]"
              style={{ background: "var(--fill)" }}
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-line flex-1"
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-solid flex-1" disabled={!canSubmit}>
              {busy ? "Saving…" : "Update"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}