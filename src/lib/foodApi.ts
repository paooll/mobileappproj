import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Macros } from "./nutrition";

/**
 * Food data from USDA FoodData Central. Public domain, so there is no
 * attribution obligation the way Open Food Facts carries one, and the service
 * is a government API rather than a volunteer project, so it does not go down
 * the way the Open Food Facts search service does.
 *
 * It does need a free key. That key ships in the client bundle, which is a real
 * cost and worth saying out loud: the data is public and the key is free, but
 * it is not a secret and must never be treated as one. Only read-only public
 * search endpoints are ever called with it.
 *
 * `api.nal.usda.gov` is one of the few food APIs that actually sends
 * `access-control-allow-origin: *` when the browser sends an `Origin` header,
 * which is the entire reason it is used here. See the ledger.
 */
export const FDC_CREDIT = "Food data from USDA FoodData Central";

const ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";
const PAGE_SIZE = 20;

const API_KEY = import.meta.env.VITE_FDC_API_KEY as string | undefined;

/** True when no key was configured, which is a different problem from a failure. */
export function isConfigured(): boolean {
  return typeof API_KEY === "string" && API_KEY.length > 0;
}

export interface FoodHit {
  id: string;
  label: string;
  brand: string;
  /** Per 100 g, in grams. Portions divide this down before anything is shown. */
  per100: Macros;
}

interface FdcNutrient {
  nutrientId?: number;
  value?: number;
  unitName?: string;
}

interface FdcFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  foodNutrients?: FdcNutrient[];
}

/** Nutrient ids: 1003 protein, 1004 fat, 1005 carbohydrate. */
const PROTEIN = 1003;
const FAT = 1004;
const CARBS = 1005;

function nutrient(food: FdcFood, id: number): number {
  const hit = (food.foodNutrients ?? []).find((n) => n.nutrientId === id);
  // Branded entries can carry the same nutrient more than once, once per
  // serving and once per 100 g. Only the gram value is per 100 g.
  if (!hit || hit.unitName !== "G") return 0;
  return typeof hit.value === "number" && Number.isFinite(hit.value) ? hit.value : 0;
}

function toHit(f: FdcFood): FoodHit | null {
  const label = (f.description ?? "").trim();
  if (!label) return null;
  const macros: Macros = {
    protein: nutrient(f, PROTEIN),
    carbs: nutrient(f, CARBS),
    fat: nutrient(f, FAT),
  };
  // An entry with no macros is not worth logging.
  if (macros.protein + macros.carbs + macros.fat === 0) return null;
  return {
    id: `fdc-${f.fdcId ?? label}`,
    label,
    brand: (f.brandOwner || f.brandName || "").trim(),
    per100: macros,
  };
}

function foodsFor(uid: string) {
  return collection(db, "users", uid, "foods");
}

export async function cacheFoods(uid: string, hits: FoodHit[]): Promise<void> {
  if (hits.length === 0) return;
  await Promise.all(
    hits.map((hit) =>
      setDoc(
        doc(foodsFor(uid), hit.id),
        {
          label: hit.label,
          // Lowercased copy, because the cache is queried with a range on it and
          // uppercase sorts before lowercase: querying `label` for "chicken"
          // can never match a cached "Chicken Breast".
          labelLower: hit.label.toLowerCase(),
          brand: hit.brand,
          per100: hit.per100,
        },
        { merge: true },
      ),
    ),
  );
}

async function cachedFoods(uid: string, term: string): Promise<FoodHit[]> {
  const lower = term.toLowerCase();
  const snap = await getDocs(
    query(
      foodsFor(uid),
      where("labelLower", ">=", lower),
      where("labelLower", "<=", `${lower}\uf8ff`),
      limit(PAGE_SIZE),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data() as { label: string; brand: string; per100: Macros };
    return { id: d.id, label: data.label, brand: data.brand ?? "", per100: data.per100 };
  });
}

/** Retried because a client should survive one dropped connection. */
const RETRY_DELAYS_MS = [400, 1000];

async function remoteFoods(term: string, signal: AbortSignal): Promise<FoodHit[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("query", term);
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("api_key", API_KEY as string);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    }
    try {
      const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
      // 4xx is ours and will not fix itself, so it leaves the loop rather than
      // burning the retries. 5xx is theirs and usually will.
      if (!res.ok && res.status < 500) throw new Error(`Food search returned ${res.status}`);
      if (!res.ok) {
        lastError = new Error(`Food search returned ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { foods?: FdcFood[] };
      return (body.foods ?? []).map(toHit).filter((h): h is FoodHit => h !== null);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      lastError = err;
    }
  }
  throw lastError ?? new Error("Food search did not respond");
}

export interface SearchResult {
  hits: FoodHit[];
  /** The service could not be reached. */
  offline: boolean;
  /** No API key was configured, which is not the same thing as being offline. */
  missingKey: boolean;
}

/**
 * Cache first, network second. The cache answers most repeat lookups outright,
 * so the third time somebody searches chicken the network is never involved,
 * and a food logged yesterday still opens with the radio off.
 *
 * A network failure returns whatever the cache had rather than throwing, so a
 * search box that stops working never becomes an error screen.
 */
export async function searchFoods(
  queryText: string,
  uid: string,
  signal: AbortSignal,
): Promise<SearchResult> {
  const term = queryText.trim();
  if (term.length < 2) return { hits: [], offline: false, missingKey: false };

  let cached: FoodHit[] = [];
  try {
    cached = await cachedFoods(uid, term);
  } catch (err) {
    console.error("Food cache read failed:", err);
  }
  if (cached.length > 0) return { hits: cached, offline: false, missingKey: false };

  if (!isConfigured()) return { hits: cached, offline: false, missingKey: true };

  try {
    const hits = await remoteFoods(term, signal);
    // Caching must never be the thing that breaks a search that worked.
    cacheFoods(uid, hits).catch((err) => console.error("Food cache write failed:", err));
    return { hits, offline: false, missingKey: false };
  } catch (err) {
    if ((err as Error).name === "AbortError") return { hits: [], offline: false, missingKey: false };
    console.error("Food search failed:", err);
    return { hits: cached, offline: true, missingKey: false };
  }
}

/** Scale a per-100 g figure down to a portion, keeping one decimal. */
export function macrosForPortion(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
  };
}
