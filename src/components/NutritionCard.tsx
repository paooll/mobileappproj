import { useState } from "react";
import { BowlFood, CaretRight, Plus } from "@phosphor-icons/react";
import NutritionSheet from "./NutritionSheet";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "./Toast";
import { formatFood, useFoodUnit } from "../lib/foodUnits";
import {
  addMacros,
  emptyMacros,
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Today&apos;s protein</h2>
          {target ? (
            <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
              <span className="font-semibold" style={{ color: "var(--food)" }}>
                {formatFood(eaten.protein, unit)}
              </span>{" "}
              of {formatFood(target, unit)}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">
              No target yet. Add your bodyweight to get one.
            </p>
          )}
        </div>
        <button
          onClick={() => setSheet(true)}
          className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)]"
          aria-label="Log a meal"
        >
          <CaretRight size={16} />
        </button>
      </div>

      {target && (
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full"
          style={{ background: "var(--food-dim)" }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Protein against target"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: "var(--food)" }}
          />
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

      {!loading && !error && recent.length > 0 && (
        <div className="mt-3 border-t border-[var(--line)]">
          {recent.map((meal) => (
            <button
              key={meal.id}
              onClick={() => repeat(meal)}
              disabled={busy}
              className="tab flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-[var(--line)] py-3 text-left last:border-b-0 disabled:opacity-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--food-dim)", color: "var(--food)" }}
                >
                  <Plus size={15} weight="bold" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{meal.name}</span>
                  <span className="block truncate text-[13px] text-[var(--ink-2)]">
                    {formatFood(meal.macros.protein, unit)} protein
                  </span>
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