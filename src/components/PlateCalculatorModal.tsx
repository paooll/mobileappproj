import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Barbell } from "@phosphor-icons/react";
import { calculatePlates, DEFAULT_BAR_KG, DEFAULT_BAR_LB } from "../lib/plates";
import type { Unit } from "../lib/units";

interface Props {
  targetWeight: number;
  unit: Unit;
  onClose: () => void;
}

export default function PlateCalculatorModal({ targetWeight, unit, onClose }: Props) {
  const defaultBar = unit === "lb" ? DEFAULT_BAR_LB : DEFAULT_BAR_KG;
  const [barWeight, setBarWeight] = useState(defaultBar);

  const result = calculatePlates(targetWeight, unit, barWeight);

  const barOptions =
    unit === "lb"
      ? [
          { label: "Olympic (45 lb)", val: 45 },
          { label: "Women/Tech (35 lb)", val: 35 },
          { label: "No bar (0)", val: 0 },
        ]
      : [
          { label: "Olympic (20 kg)", val: 20 },
          { label: "Women/Tech (15 kg)", val: 15 },
          { label: "No bar (0)", val: 0 },
        ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="panel relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <Barbell size={22} weight="bold" className="text-[var(--ink)]" />
              <h2 className="text-[18px] font-bold">Plate Calculator</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close plate calculator"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--fill)]"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <div className="mt-5 text-center">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
              Target Load
            </div>
            <div className="num mt-1 text-[36px] font-bold">
              {targetWeight}{" "}
              <span className="text-[18px] text-[var(--ink-2)] font-medium">{unit}</span>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
              Barbell Weight
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {barOptions.map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setBarWeight(opt.val)}
                  className={`min-h-[44px] rounded-xl px-2 py-1.5 text-[13px] font-medium transition-colors ${
                    barWeight === opt.val
                      ? "bg-[var(--ink)] text-[var(--bg)] font-semibold"
                      : "bg-[var(--fill)] text-[var(--ink-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[var(--fill)] p-4">
            <div className="flex items-center justify-between text-[13px] font-medium text-[var(--ink-2)] mb-3">
              <span>Each side:</span>
              <span className="num font-bold text-[var(--ink)]">
                {result.perSideWeight} {unit}
              </span>
            </div>

            {targetWeight < barWeight ? (
              <p className="text-center text-[14px] text-[var(--ink-2)] py-2">
                Target weight is less than the barbell weight.
              </p>
            ) : result.plates.length === 0 ? (
              <p className="text-center text-[14px] text-[var(--ink-2)] py-2">
                Just the bar. No plates needed.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {result.plates.map((p) => (
                  <div
                    key={p.weight}
                    className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-2.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-[12px] font-bold text-[var(--bg)]">
                        {p.count}×
                      </span>
                      <span className="num text-[16px] font-semibold">
                        {p.weight} {unit}
                      </span>
                    </div>
                    <span className="text-[13px] text-[var(--ink-3)] font-medium">
                      {(p.weight * p.count).toFixed(1)} {unit}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {result.remainder > 0 && (
              <div className="mt-3 text-center text-[12px] font-medium text-[var(--ink-3)]">
                Remainder: {result.remainder} {unit} not covered by standard plates
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
