import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Goal } from "./profile";

/**
 * Nutrition is its own vertical. Nothing in here reads or writes lifting
 * weights, and nothing in `units.ts` knows this file exists: the two scales are
 * deliberately independent, so an athlete can lift in pounds and eat in grams.
 *
 * Macros are always grams. The display unit converts on the way out and never
 * changes what is written, because rounding 12.5 g of protein to 13 g on write
 * would quietly lose a tenth of a gram on every meal for a week.
 */

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealItem {
  label: string;
  /** Always grams. */
  grams: number;
  macros: Macros;
}

export interface Meal {
  id: string;
  name: string;
  /** Where it came from, or null for a one-off. Provenance only, never a link. */
  templateId: string | null;
  items: MealItem[];
  macros: Macros;
  kcal: number;
  /** Millisecond epoch, see the rules note on why this is not a date string. */
  loggedAt: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: MealItem[];
  macros: Macros;
  kcal: number;
  createdAt: number;
}

/** What a meal looks like before it has an id or a time. */
export interface MealDraft {
  name: string;
  templateId: string | null;
  items: MealItem[];
}

/**
 * A hard cap, not a soft one. Past this the day total is simply from the
 * newest meals, which is a wrong number; reading without a limit would be a
 * slow screen, which is worse.
 */
export const DAILY_MEAL_LIMIT = 20;
export const MAX_ITEMS = 30;
export const KCAL_PER_G: { protein: number; carbs: number; fat: number } = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

/** Grams of protein per kg of bodyweight, by the goal the athlete picked. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  muscle: 1.8,
  strength: 1.6,
  general: 1.4,
  endurance: 1.4,
};

export function emptyMacros(): Macros {
  return { protein: 0, carbs: 0, fat: 0 };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function sumMacros(items: MealItem[]): Macros {
  return items.reduce((acc, item) => addMacros(acc, item.macros), emptyMacros());
}

export function kcalOf(m: Macros): number {
  const raw =
    m.protein * KCAL_PER_G.protein +
    m.carbs * KCAL_PER_G.carbs +
    m.fat * KCAL_PER_G.fat;
  return Math.round(raw);
}

/** Nearest 5 g, because a target of 143 g is a number nobody would set. */
export function proteinTargetOverride(grams: number): number {
  return Math.round(grams / 5) * 5;
}

/**
 * The target an athlete gets from bodyweight and goal. Null when there is no
 * usable bodyweight, because the alternative is a bar drawn at zero or a card
 * reading NaN, and neither is an honest thing to show somebody.
 */
export function proteinTargetFor(bodyweightKg: number | null, goal: Goal): number | null {
  if (bodyweightKg === null) return null;
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;
  const rate = PROTEIN_PER_KG[goal];
  if (!rate) return null;
  return proteinTargetOverride(bodyweightKg * rate);
}

/** The target to show: the athlete's own number if they set one. */
export function resolveProteinTarget(
  bodyweightKg: number | null,
  goal: Goal,
  overrideG: number | null,
): number | null {
  if (overrideG !== null && Number.isFinite(overrideG) && overrideG > 0) {
    return proteinTargetOverride(overrideG);
  }
  return proteinTargetFor(bodyweightKg, goal);
}

/**
 * Local midnight, as epoch milliseconds. Local rather than UTC because "today"
 * has to mean the athlete's today: at 23:59 in Auckland a meal is still
 * today's, and a UTC boundary would file it under tomorrow.
 */
export function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function dayKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/* ---------- Firestore ---------- */

/**
 * `loggedAt` is a millisecond epoch, not a `YYYY-MM-DD` string like
 * `Workout.date` and not a Firestore `Timestamp`. This is deliberate. A range
 * filter and an orderBy on the same field are served from Firestore's
 * automatic single-field indexes, so `firestore.indexes.json` does not change;
 * an equality on a `day` string plus an orderBy on a different field would need
 * a composite index, and these meals are scoped to one athlete already, so
 * there is no cross-author bucketing for a date string to solve.
 */
function mealsFor(uid: string) {
  return collection(db, "users", uid, "meals");
}

function templatesFor(uid: string) {
  return collection(db, "users", uid, "templates");
}

function isMacros(v: unknown): v is Macros {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.protein === "number" && typeof m.carbs === "number" && typeof m.fat === "number";
}

/**
 * A document that does not parse is skipped rather than thrown at the screen.
 * One bad row from a half-finished write should cost that row, not the day.
 */
function toMeal(id: string, d: Record<string, unknown>): Meal | null {
  if (typeof d.name !== "string" || !Array.isArray(d.items)) return null;
  if (!isMacros(d.macros)) return null;
  return {
    id,
    name: d.name,
    templateId: typeof d.templateId === "string" ? d.templateId : null,
    items: d.items as MealItem[],
    macros: d.macros,
    kcal: typeof d.kcal === "number" ? d.kcal : kcalOf(d.macros),
    loggedAt: typeof d.loggedAt === "number" ? d.loggedAt : 0,
  };
}

function toTemplate(id: string, d: Record<string, unknown>): MealTemplate | null {
  if (typeof d.name !== "string" || !Array.isArray(d.items)) return null;
  if (!isMacros(d.macros)) return null;
  return {
    id,
    name: d.name,
    items: d.items as MealItem[],
    macros: d.macros,
    kcal: typeof d.kcal === "number" ? d.kcal : kcalOf(d.macros),
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
  };
}

export interface MealsState {
  meals: Meal[];
  loading: boolean;
  error: string | null;
}

/**
 * Today's meals, newest first. One query and at most `DAILY_MEAL_LIMIT` reads,
 * which is the whole cost this feature adds to the Today screen. Nothing here
 * queries per meal, per item or per template.
 */
export function useTodayMeals(uid: string | null): MealsState {
  const [state, setState] = useState<MealsState>({ meals: [], loading: true, error: null });
  const [forUid, setForUid] = useState<string | null>(uid);

  // Reset during render rather than in the effect, so signing out clears the
  // day's meals without a frame of somebody else's food on screen.
  if (forUid !== uid) {
    setForUid(uid);
    setState({ meals: [], loading: uid !== null, error: null });
  }

  useEffect(() => {
    if (!uid) return;
    const since = startOfDay(new Date());
    const q = query(
      mealsFor(uid),
      where("loggedAt", ">=", since),
      orderBy("loggedAt", "desc"),
      limit(DAILY_MEAL_LIMIT),
    );
    return onSnapshot(
      q,
      (snap) => {
        const meals = snap.docs
          .map((d) => toMeal(d.id, d.data() as Record<string, unknown>))
          .filter((m): m is Meal => m !== null);
        setState({ meals, loading: false, error: null });
      },
      () => setState({ meals: [], loading: false, error: "Couldn't load today's meals." }),
    );
  }, [uid]);

  return state;
}

export interface TemplatesState {
  templates: MealTemplate[];
  loading: boolean;
  error: string | null;
}

/** Loaded when the sheet opens, never on the Today screen. */
export function useTemplates(uid: string | null): TemplatesState {
  const [state, setState] = useState<TemplatesState>({
    templates: [],
    loading: true,
    error: null,
  });
  const [forUid, setForUid] = useState<string | null>(uid);

  if (forUid !== uid) {
    setForUid(uid);
    setState({ templates: [], loading: uid !== null, error: null });
  }

  useEffect(() => {
    if (!uid) return;
    const q = query(templatesFor(uid), orderBy("createdAt", "desc"), limit(12));
    return onSnapshot(
      q,
      (snap) => {
        const templates = snap.docs
          .map((d) => toTemplate(d.id, d.data() as Record<string, unknown>))
          .filter((t): t is MealTemplate => t !== null);
        setState({ templates, loading: false, error: null });
      },
      () => setState({ templates: [], loading: false, error: "Couldn't load your saved meals." }),
    );
  }, [uid]);

  return state;
}

/**
 * Log a meal. Items are copied in, never referenced: editing a template later
 * must not rewrite a meal that was already eaten, so a meal is a snapshot of
 * what was on the plate at the time.
 */
export async function logMeal(uid: string, draft: MealDraft): Promise<string> {
  const items = draft.items.slice(0, MAX_ITEMS);
  const macros = sumMacros(items);
  const ref = await addDoc(mealsFor(uid), {
    name: draft.name,
    templateId: draft.templateId,
    items,
    macros,
    kcal: kcalOf(macros),
    loggedAt: Date.now(),
  });
  return ref.id;
}

export async function saveTemplate(uid: string, draft: MealDraft): Promise<string> {
  const items = draft.items.slice(0, MAX_ITEMS);
  const macros = sumMacros(items);
  const ref = await addDoc(templatesFor(uid), {
    name: draft.name,
    items,
    macros,
    kcal: kcalOf(macros),
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteTemplate(uid: string, templateId: string): Promise<void> {
  await deleteDoc(doc(templatesFor(uid), templateId));
}
