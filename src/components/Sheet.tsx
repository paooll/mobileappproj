import { useEffect } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A bottom sheet that can hold anything. ConfirmSheet could not be reused here
 * because it only ever asks a yes or no question, and a comment thread needs a
 * list, a field and a send button.
 *
 * Same shell as ConfirmSheet on purpose: the same backdrop, the same glass, the
 * same rise. A second sheet that moved differently would read as two apps.
 */
export default function Sheet({ open, title, onClose, children }: Props) {
  const reduce = useReducedMotion();

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
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/45"
            style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass relative mx-4 mb-[max(env(safe-area-inset-bottom),12px)] flex max-h-[80vh] w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-3xl shadow-[var(--shadow-panel)]"
          >
            <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-[17px] font-bold tracking-[-0.01em]">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="icon-btn h-11 w-11 text-[var(--ink-3)]"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
