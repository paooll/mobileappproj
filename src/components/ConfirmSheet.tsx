import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Warning, Info } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  title: string;
  /** Say exactly what is about to happen and what cannot be undone. */
  body: string;
  confirmLabel: string;
  /** Names the way out, so it does not read "Keep it" on an unfollow. */
  cancelLabel?: string;
  /** Unfollowing loses nothing, so it must not be dressed as a deletion. */
  tone?: "danger" | "neutral";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive confirmations belong in the app, not in a browser dialog. A native
 * `confirm()` looks like a crash on a phone and gives no room to name what is
 * about to be lost.
 */
export default function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep it",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const reduce = useReducedMotion();
  const Icon = tone === "danger" ? Warning : Info;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            aria-label="Cancel"
            onClick={onCancel}
            className="absolute inset-0 bg-black/45"
            style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass relative mx-4 mb-[max(env(safe-area-inset-bottom),12px)] w-full max-w-md rounded-3xl p-5 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--fill)",
                  color: tone === "danger" ? "var(--danger)" : "var(--ink-2)",
                }}
              >
                <Icon size={18} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-[17px] font-bold tracking-[-0.01em]">
                  {title}
                </h2>
                <p id="confirm-body" className="mt-1 text-[14px] leading-snug text-[var(--ink-2)]">
                  {body}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={onCancel} className="btn-line flex-1" disabled={busy}>
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="btn-solid flex-1"
                style={
                  tone === "danger"
                    ? { background: "var(--danger)", color: "var(--bg)" }
                    : { background: "var(--ink)", color: "var(--bg)" }
                }
              >
                {busy ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}