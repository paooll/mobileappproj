import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { WarningCircle, CheckCircle, Info, X } from "@phosphor-icons/react";

type ToastKind = "error" | "success" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** A single offer to reverse the thing the toast is reporting. */
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind, action?: ToastItem["action"]) => void;
}

const ToastCtx = createContext<ToastApi>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICONS: Record<ToastKind, typeof Info> = {
  error: WarningCircle,
  success: CheckCircle,
  info: Info,
};

const COLORS: Record<ToastKind, string> = {
  error: "text-[var(--danger)]",
  success: "text-[var(--success)]",
  info: "text-[var(--ink-2)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info", action?: ToastItem["action"]) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, kind, message, action }]);
      // Anything undoable stays long enough to actually reach for
      const ttl = action ? 6000 : kind === "error" ? 5000 : 3200;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
                transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-float)]"
              >
                <Icon size={20} weight="fill" className={`shrink-0 ${COLORS[t.kind]}`} />
                <p className="min-w-0 flex-1 text-[14px] font-medium leading-snug">
                  {t.message}
                </p>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="tab shrink-0 rounded-lg px-2 py-1 text-[14px] font-semibold transition-transform active:scale-[0.96]"
                    style={{ background: "var(--fill)" }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  className="tab -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-3)] transition-colors active:text-[var(--ink)]"
                  aria-label="Dismiss"
                >
                  <X size={14} weight="bold" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
