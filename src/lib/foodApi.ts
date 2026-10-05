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
 * Food data from Open Food Facts. There is no API key and no signup, which is
 * the deciding factor: a credential has to live somewhere managed, and this
 * feature does not need one. Results are cached per athlete on first fetch, so
 * a food an athlete has looked up before is served from Firestore and works
 * offline afterwards.
 *
 * The data is ODbL, which obliges attribution where it is shown. `OFF_CREDIT`
 * is rendered by the search tab for that reason and not for decoration.
 */
export const OFF_CREDIT = "Food data from Open Food Facts";

const ENDPOINT = "https://search.openfoodfacts.org/search";
const PAGE_SIZE = 20;

export interface FoodHit {
  id: string;
  label: string;
  brand: string;
  /** Per 100 g, in grams. Portions divide this down before anything is shown. */
  per100: Macros;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  /** The search service returns brands as a list; the product API returns a string. */
  brands?: string | string[];
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

/** OFF uses underscores; a product with no macros reads as zero, not as a crash. */
function per100Of(n: OffProduct["nutriments"]): Macros {
  return {
    protein: num(n?.proteins_100g),
    carbs: num(n?.carbohydrates_100g),
    fat: num(n?.fat_100g),
  };
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "food"
  );
}

/** OFF's product code when there is one, otherwise a stable slug of the name. */
function idFor(p: OffProduct): string {
  return p.code ? `off-${p.code}` : `name-${slug(p.product_name ?? "food")}`;
}

function toHit(p: OffProduct): FoodHit | null {
  const label = (p.product_name ?? "").trim();
  if (!label) return null;
  const macros = per100Of(p.nutriments);
  // A product with no macros at all is not useful to log, so it is not offered.
  if (macros.protein + macros.carbs + macros.fat === 0) return null;
  const rawBrand = Array.isArray(p.brands) ? (p.brands[0] ?? "") : (p.brands ?? "");
  return {
    id: idFor(p),
    label,
    brand: rawBrand.split(",")[0]?.trim() ?? "",
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

/** Open Food Facts fails intermittently with a 503, so a single try is not enough. */
const RETRY_DELAYS_MS = [400, 1000];

async function remoteFoods(term: string, signal: AbortSignal): Promise<FoodHit[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", term);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("fields", "code,product_name,brands,nutriments");

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    }
    try {
      const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
      // 4xx is our fault and will not fix itself; 5xx is theirs and usually will.
      if (res.status >= 500) {
        lastError = new Error(`Open Food Facts returned ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
      const body = (await res.json()) as { hits?: OffProduct[] };
      return (body.hits ?? []).map(toHit).filter((h): h is FoodHit => h !== null);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      lastError = err;
    }
  }
  throw lastError ?? new Error("Open Food Facts did not respond");
}

/**
 * Cache first, network second. The cache answers most repeat lookups outright,
 * so the third time somebody searches chicken the network is never involved.
 *
 * A network failure returns whatever the cache had rather than throwing, so a
 * search box that stops working never becomes an error screen.
 */
export async function searchFoods(
  queryText: string,
  uid: string,
  signal: AbortSignal,
): Promise<{ hits: FoodHit[]; offline: boolean }> {
  const term = queryText.trim();
  if (term.length < 2) return { hits: [], offline: false };

  let cached: FoodHit[] = [];
  try {
    cached = await cachedFoods(uid, term);
  } catch (err) {
    console.error("Food cache read failed:", err);
  }
  if (cached.length > 0) return { hits: cached, offline: false };

  try {
    const hits = await remoteFoods(term, signal);
    // Caching must never be the thing that breaks a search that worked.
    cacheFoods(uid, hits).catch((err) => console.error("Food cache write failed:", err));
    return { hits, offline: false };
  } catch (err) {
    if ((err as Error).name === "AbortError") return { hits: [], offline: false };
    console.error("Food search failed:", err);
    return { hits: cached, offline: true };
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
