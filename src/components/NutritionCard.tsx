import { useState } from "react";
import { BowlFood, CaretRight, CheckCircle, Plus } from "@phosphor-icons/react";
import NutritionSheet from "./NutritionSheet";
import ProteinRing from "./ProteinRing";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "./Toast";
import { formatFood, useFoodUnit } from "../lib/foodUnits";
import {
  addMacros,
  emptyMacros,
  kcalOf,
  logMeal,
  resolveProteinTarget,
  useTodayMeals,
  type Macros,
  type Meal,
} from "../lib/nutrition";
import type { UserProfile } from "../lib/profile";

/**
 * The one thing nutrition adds to Today: today's protein against a target, and
 * the last few meals to log again in a tap.
 *
 * It reads one query. Nothing on this card queries per meal, per item or per
 * template, because the rules allow a limited number of document reads per
 * request and a day of eating is the easiest way to spend them all.
 */
export default function NutritionCard({ profile }: { profile: UserProfile }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unit] = useFoodUnit();
  const { meals, loading, error } = useTodayMeals(user?.uid ?? null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  const target = resolveProteinTarget(profile.bodyweightKg, profile.goal, profile.proteinTargetG);
  const eaten: Macros = meals.reduce((acc, m) => addMacros(acc, m.macros), emptyMacros());
  const totalKcal = kcalOf(eaten);

  const repeat = async (meal: Meal) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await logMeal(user.uid, {
        name: meal.name,
        templateId: meal.templateId,
        items: meal.items,
      });
      toast(`${meal.name} logged.`);
    } catch (err) {
      console.error(err);
      // The comment sheet's rule: a write that did not happen has to say so.
      toast("Couldn't log that meal. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const recent = meals.slice(0, 3);
  const pct = target ? Math.min(100, Math.round((eaten.protein / target) * 100)) : 0;

  return (
    <section className="panel mt-3 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Today&apos;s nutrition</h2>
        <button
          onClick={() => setSheet(true)}
          className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)]"
          aria-label="Log a meal"
        >
          <CaretRight size={16} />
        </button>
      </div>

      {/* Ring + macros row */}
      {target ? (
        <div className="mt-3 flex items-center gap-5">
          {/* Protein ring */}
          <ProteinRing eaten={eaten.protein} target={target} unit={unit} />

          {/* Macro breakdown */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <MacroRow label="Protein" value={formatFood(eaten.protein, unit)} color="var(--food)" />
            <MacroRow label="Carbs" value={formatFood(eaten.carbs, unit)} color="var(--ink-3)" />
            <MacroRow label="Fat" value={formatFood(eaten.fat, unit)} color="var(--ink-3)" />
            <p className="text-[12px] font-medium text-[var(--ink-2)]">
              {totalKcal} kcal total
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">
          No target yet. Add your bodyweight to get one.
        </p>
      )}

      {/* Target hit celebration */}
      {target !== null && pct >= 100 && (
        <div
          className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold"
          style={{ background: "var(--food-dim)", color: "var(--food)" }}
        >
          <CheckCircle size={16} weight="fill" />
          Protein target hit!
        </div>
      )}

      {target === null && (
        <button
          onClick={() => navigate("/app/profile")}
          className="btn-solid mt-3 flex min-h-[44px] w-full items-center justify-center gap-2"
        >
          <BowlFood size={18} />
          Set a protein target
        </button>
      )}

      {error && <p className="mt-3 text-[13px] text-[var(--ink-3)]">{error}</p>}

      {/* Recent meals as pill cards */}
      {!loading && !error && recent.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)]">
            Quick repeat
          </p>
          {recent.map((meal) => (
            <button
              key={meal.id}
              onClick={() => repeat(meal)}
              disabled={busy}
              className="tab flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--food-dim)" }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--food)", color: "var(--surface)" }}
              >
                <Plus size={14} weight="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{meal.name}</span>
                <span className="block truncate text-[12px] text-[var(--ink-2)]">
                  {formatFood(meal.macros.protein, unit)} P
                  {" \u00b7 "}
                  {formatFood(meal.macros.carbs, unit)} C
                  {" \u00b7 "}
                  {formatFood(meal.macros.fat, unit)} F
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && meals.length === 0 && (
        <p className="mt-3 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-3)]">
          Nothing eaten logged yet. Meals you log show up here to repeat.
        </p>
      )}

      <NutritionSheet open={sheet} onClose={() => setSheet(false)} />
    </section>
  );
}

/** Compact row: colored dot + label + value. */
function MacroRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="text-[var(--ink-2)]">{label}</span>
      <span className="ml-auto font-semibold num">{value}</span>
    </div>
  );
}
