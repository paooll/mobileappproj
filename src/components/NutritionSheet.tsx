import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import Sheet from "./Sheet";
import SegmentedControl from "./SegmentedControl";
import { useAuthUser } from "../hooks/useAuthUser";
import { useToast } from "./Toast";
import {
  formatFood,
  foodFromDisplay,
  useFoodUnit,
  type FoodUnit,
} from "../lib/foodUnits";
import {
  deleteTemplate,
  logMeal,
  saveTemplate,
  useTemplates,
  useTodayMeals,
  type Meal,
  type MealItem,
  type MealTemplate,
} from "../lib/nutrition";
import { FDC_CREDIT, macrosForPortion, searchFoods, type FoodHit } from "../lib/foodApi";

type Tab = "templates" | "search" | "recent";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PORTION_STEP: Record<FoodUnit, number> = { g: 10, oz: 0.5 };

/**
 * Three tabs and no more: what you eat repeatedly, something new, and what you
 * already ate today.
 *
 * Templates carry their own macros, so logging one is a single write that never
 * touches the network. Search is the only thing here that can fail, and it
 * fails into one quiet line rather than an error screen.
 */
export default function NutritionSheet({ open, onClose }: Props) {
  const user = useAuthUser();
  const uid = user?.uid ?? null;
  const { toast } = useToast();
  const [unit, setUnit] = useFoodUnit();
  const [tab, setTab] = useState<Tab>("templates");
  const [busy, setBusy] = useState(false);

  // Both queries are gated on `open`. This component is mounted by the card
  // whether or not the sheet is showing, so an ungated hook here would put a
  // second live subscription on the same meals query and a third query for
  // templates on a screen that never shows either. Today costs one query.
  const { templates, loading: tLoading, error: tError } = useTemplates(open ? uid : null);
  const { meals } = useTodayMeals(open ? uid : null);

  const log = async (name: string, templateId: string | null, items: MealItem[]) => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      await logMeal(uid, { name, templateId, items });
      toast(`${name} logged.`);
    } catch (err) {
      console.error(err);
      toast("Couldn't log that meal. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const keepTemplate = async (meal: Meal) => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      await saveTemplate(uid, { name: meal.name, templateId: null, items: meal.items });
      toast(`${meal.name} saved. Log it from Templates next time.`);
    } catch (err) {
      console.error(err);
      toast("Couldn't save that meal. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const dropTemplate = async (t: MealTemplate) => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      await deleteTemplate(uid, t.id);
    } catch (err) {
      console.error(err);
      toast("Couldn't remove that meal. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Meals" onClose={onClose}>
      <div className="px-4 pb-6">
        <SegmentedControl<Tab>
          label="Meal source"
          value={tab}
          onChange={setTab}
          options={[
            { value: "templates", label: "Templates" },
            { value: "search", label: "Search" },
            { value: "recent", label: "Recent" },
          ]}
        />

        {tab === "templates" && (
          <TemplatesTab
            templates={templates}
            loading={tLoading}
            error={tError}
            unit={unit}
            busy={busy}
            onLog={(t) => log(t.name, t.id, t.items)}
            onDelete={dropTemplate}
          />
        )}

        {tab === "search" && (
          <SearchTab
            uid={uid}
            unit={unit}
            busy={busy}
            onLog={(name, items) => log(name, null, items)}
          />
        )}

        {tab === "recent" && (
          <RecentTab
            meals={meals}
            unit={unit}
            busy={busy}
            onRepeat={(m) => log(m.name, m.templateId, m.items)}
            onKeep={keepTemplate}
          />
        )}

        <div className="mt-6">
          <p className="label mb-2">Food unit</p>
          <SegmentedControl<FoodUnit>
            label="Food unit"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "g", label: "Grams" },
              { value: "oz", label: "Ounces" },
            ]}
          />
        </div>
      </div>
    </Sheet>
  );
}

function MacroLine({ name, item, unit }: { name: string; item: MealItem; unit: FoodUnit }) {
  return (
    <p className="truncate text-[13px] text-[var(--ink-2)]">
      {name} · {formatFood(item.macros.protein, unit)} protein
    </p>
  );
}

function TemplatesTab({
  templates,
  loading,
  error,
  unit,
  busy,
  onLog,
  onDelete,
}: {
  templates: MealTemplate[];
  loading: boolean;
  error: string | null;
  unit: FoodUnit;
  busy: boolean;
  onLog: (t: MealTemplate) => void;
  onDelete: (t: MealTemplate) => void;
}) {
  if (loading) return <p className="mt-4 text-[14px] text-[var(--ink-3)]">Loading…</p>;
  if (error) return <p className="mt-4 text-[14px] text-[var(--ink-3)]">{error}</p>;
  if (templates.length === 0)
    return (
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-3)]">
        Nothing saved yet. Log something on the Recent tab and save it, and it lands here to
        log again in one tap.
      </p>
    );
  return (
    <div className="mt-3">
      {templates.map((t) => (
        <div key={t.id} className="flex items-center gap-2 border-b border-[var(--line)] last:border-b-0">
          <button
            onClick={() => onLog(t)}
            disabled={busy}
            className="tab flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-3 text-left disabled:opacity-50"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--food-dim)", color: "var(--food)" }}
            >
              <Plus size={15} weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">{t.name}</span>
              <MacroLine name={t.items[0]?.label ?? ""} item={t.items[0] ?? { label: "", grams: 0, macros: { protein: 0, carbs: 0, fat: 0 } }} unit={unit} />
            </span>
          </button>
          <button
            onClick={() => onDelete(t)}
            disabled={busy}
            aria-label={`Remove ${t.name}`}
            className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-3)] disabled:opacity-50"
          >
            <Trash size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function RecentTab({
  meals,
  unit,
  busy,
  onRepeat,
  onKeep,
}: {
  meals: Meal[];
  unit: FoodUnit;
  busy: boolean;
  onRepeat: (m: Meal) => void;
  onKeep: (m: Meal) => void;
}) {
  if (meals.length === 0)
    return <p className="mt-4 text-[14px] text-[var(--ink-3)]">Nothing logged today yet.</p>;
  return (
    <div className="mt-3">
      {meals.map((m) => (
        <div key={m.id} className="flex items-center gap-2 border-b border-[var(--line)] last:border-b-0">
          <button
            onClick={() => onRepeat(m)}
            disabled={busy}
            className="tab flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-3 text-left disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">{m.name}</span>
              <span className="block truncate text-[13px] text-[var(--ink-2)]">
                {formatFood(m.macros.protein, unit)} protein · {m.kcal} kcal
              </span>
            </span>
          </button>
          <button
            onClick={() => onKeep(m)}
            disabled={busy}
            aria-label={`Save ${m.name} as a template`}
            className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            style={{ color: "var(--food)" }}
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}

function SearchTab({
  uid,
  unit,
  busy,
  onLog,
}: {
  uid: string | null;
  unit: FoodUnit;
  busy: boolean;
  onLog: (name: string, items: MealItem[]) => void;
}) {
  const [text, setText] = useState("");
  // Results are keyed by the term that produced them, so a new keystroke hides
  // the old answers during render rather than through a setState in the effect.
  const [result, setResult] = useState<{
    term: string;
    hits: FoodHit[];
    offline: boolean;
    missingKey: boolean;
    searching: boolean;
  } | null>(null);
  const [portion, setPortion] = useState<Record<string, number>>({});
  const timer = useRef<number | null>(null);

  const term = text.trim();
  const shown = result && result.term === term ? result : null;
  const hits = shown?.hits ?? [];
  const offline = shown?.offline ?? false;
  const missingKey = shown?.missingKey ?? false;
  const searching = shown?.searching ?? false;

  useEffect(() => {
    if (term.length < 2 || !uid) return;
    const controller = new AbortController();
    // Debounced, so a search is one request rather than one per keystroke.
    timer.current = window.setTimeout(() => {
      setResult({ term, hits: [], offline: false, missingKey: false, searching: true });
      searchFoods(term, uid, controller.signal)
        .then((r) =>
          setResult({
            term,
            hits: r.hits,
            offline: r.offline,
            missingKey: r.missingKey,
            searching: false,
          }),
        )
        .catch(() =>
          setResult({ term, hits: [], offline: true, missingKey: false, searching: false }),
        );
    }, 300);
    return () => {
      controller.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [term, uid]);

  const gramsFor = (hit: FoodHit) =>
    portion[hit.id] ?? foodFromDisplay(100, unit);

  return (
    <div className="mt-4">
      <div
        className="flex h-11 items-center gap-2 rounded-xl px-3"
        style={{ background: "var(--fill)", border: "1px solid var(--line)" }}
      >
        <MagnifyingGlass size={16} className="shrink-0 text-[var(--ink-3)]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search a food"
          aria-label="Search a food"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--ink-3)]"
        />
      </div>

      {searching && <p className="mt-3 text-[14px] text-[var(--ink-3)]">Searching…</p>}
      {missingKey && (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-3)]">
          Food search needs an API key, which is not set. Anything you have saved still logs.
        </p>
      )}
      {offline && (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-3)]">
          Search is unavailable right now. Anything you have saved still logs.
        </p>
      )}
      {!searching && !offline && !missingKey && text.trim().length >= 2 && hits.length === 0 && (
        <p className="mt-3 text-[14px] text-[var(--ink-3)]">Nothing matched that.</p>
      )}

      <div className="mt-2">
        {hits.map((hit) => {
          const macros = macrosForPortion(hit.per100, gramsFor(hit));
          return (
            <div key={hit.id} className="border-b border-[var(--line)] py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{hit.label}</p>
                  {hit.brand && <p className="truncate text-[13px] text-[var(--ink-3)]">{hit.brand}</p>}
                </div>
                <button
                  onClick={() =>
                    onLog(hit.label, [
                      { label: hit.label, grams: gramsFor(hit), macros },
                    ])
                  }
                  disabled={busy}
                  aria-label={`Log ${hit.label}`}
                  className="tab flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                  style={{ background: "var(--food-dim)", color: "var(--food)" }}
                >
                  <Plus size={16} weight="bold" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() =>
                    setPortion((p) => ({
                      ...p,
                      [hit.id]: Math.max(
                        PORTION_STEP[unit],
                        gramsFor(hit) - foodFromDisplay(PORTION_STEP[unit], unit),
                      ),
                    }))
                  }
                  aria-label={`Smaller portion of ${hit.label}`}
                  className="tab h-11 w-11 shrink-0 rounded-full text-[var(--ink-2)]"
                  style={{ background: "var(--fill)" }}
                >
                  −
                </button>
                <span className="text-[14px] font-semibold">
                  {formatFood(gramsFor(hit), unit)}
                </span>
                <button
                  onClick={() =>
                    setPortion((p) => ({
                      ...p,
                      [hit.id]: gramsFor(hit) + foodFromDisplay(PORTION_STEP[unit], unit),
                    }))
                  }
                  aria-label={`Larger portion of ${hit.label}`}
                  className="tab h-11 w-11 shrink-0 rounded-full text-[var(--ink-2)]"
                  style={{ background: "var(--fill)" }}
                >
                  +
                </button>
                <span className="ml-auto truncate text-[13px] text-[var(--ink-2)]">
                  {formatFood(macros.protein, unit)} protein
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[12px] text-[var(--ink-3)]">{FDC_CREDIT}</p>
    </div>
  );
}
