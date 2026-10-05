# Nutrition and Prep Meals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private macro log on the Today screen where a repeatable meal logs in one tap and moves a protein bar toward a target.

**Architecture:** Nutrition is its own vertical, never touching the lifting weight code. `foodUnits.ts` is a display scale for food mass and macros (g/oz), separate from the existing `units.ts` (kg/lb). `nutrition.ts` holds the domain types, the pure math and the Firestore layer. One new card lands on Today; the sheet that opens from it holds templates, search and recent. No route, no bottom-nav item.

**Tech Stack:** Vite 8, React 19, TypeScript ~6.0 (`erasableSyntaxOnly`), Tailwind v3, Bun, `@phosphor-icons/react`, Firebase 12 (Firestore + Auth only), framer-motion.

**Spec:** `NUTRITION_SPEC.md` at the repo root. Read it before starting; this plan implements it and does not restate it.

## Global Constraints

Every task below is subject to these, and they come from `AGENTS.md` and the spec.

- Free plan only. Cloud Storage and Cloud Functions are unavailable and must not be proposed.
- `firestore.rules` and `FIRESTORE_SCHEMA.md` change in the same commit as any client that reads or writes the new paths.
- `erasableSyntaxOnly`: no TypeScript parameter properties. `noUnusedLocals` and `noUnusedParameters` are on, so an unused import fails the build.
- `verbatimModuleSyntax` is on, so every type-only import needs `import type`.
- Icons come from `@phosphor-icons/react`. Lucide is banned.
- Colours live in `src/index.css` as tokens. No raw hex outside that file, no new one-off utilities. `.panel`, `.tab` and `.btn-solid` keep working unchanged.
- Motion is feedback only and must respect the existing `prefers-reduced-motion` block.
- Copy contains no em-dashes. Touch targets are at least 44px. Text meets WCAG AA against its own background.
- Touch targets and steppers reuse the shape already in `src/components/ActiveWorkout`'s stepper rows.
- Lint baseline is **7 warnings, 0 errors**. Adding a warning is a regression; the count is part of done.

### Verification, and why it looks like this

This repo has no test runner and is not getting one. Every task is verified by the three house checks plus, where the task has pure logic, a throwaway script under `/tmp` run with `bun`, which executes TypeScript directly. Nothing is committed under a `test/` directory.

The three house checks, run from the repo root:

```bash
bun tsc -b --noEmit        # must exit 0
bun run lint src          # must be exactly 7 warnings, 0 errors
npm run build             # must exit 0
```

Do not run these in a pipeline that hides the exit status. Use `set -o pipefail` or check `$?` explicitly.

## Review Focus

The five input classes most likely to bite an athlete using this. Each has a task that pins it below.

1. **The athlete lifts in lb but thinks about food in grams.** Food units are independent of `units.ts`, so switching `foodUnit` must never rewrite what is stored. Expected: displayed numbers change, stored grams do not.
2. **No bodyweight set.** `proteinTargetFor` has no valid input. Expected: the card shows no target and asks once, never `NaN`, never a 0g bar, never a crash.
3. **More than 20 meals in one day.** `DAILY_MEAL_LIMIT` is a hard cap. Expected: the day still renders and totals are simply from the newest 20, with no error.
4. **Open Food Facts is unreachable, rate-limited, or the device is offline.** Expected: one quiet line saying search is unavailable, and templates keep logging, because a template carries its own macros.
5. **An athlete edits a template they have already eaten.** Expected: past meals keep the numbers they were eaten with; only future logs change.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/foodUnits.ts` | The g/oz display scale. Nothing else. |
| `src/lib/nutrition.ts` | Domain types, pure macro and target math, the Firestore layer, the hooks. |
| `src/lib/foodApi.ts` | Open Food Facts search, and reading/writing the athlete's own food cache. |
| `src/components/NutritionCard.tsx` | The Today card: protein against target, last three meals, one-tap log. |
| `src/components/NutritionSheet.tsx` | The sheet: Templates, Search, Recent. |

**Modified**

| File | Change |
|---|---|
| `src/lib/profile.ts` | `bodyweightKg`, `foodUnit`, `proteinTargetG` on `UserPrefs`; defaults; `pickPrefs`. |
| `src/pages/Onboarding.tsx` | The Setup step gains bodyweight and the nutrition unit. |
| `src/pages/Today.tsx` | Mount `NutritionCard`. |
| `src/pages/Profile.tsx` | Edit bodyweight, nutrition unit and the protein target. |
| `src/index.css` | `--food` and `--food-dim` tokens. |
| `firestore.rules` | Three `users/{uid}` subcollection matches. |
| `FIRESTORE_SCHEMA.md` | The four new paths. |

---

### Task 1: The food unit scale

**Files:**
- Create: `src/lib/foodUnits.ts`

**Interfaces:**
- Consumes: `import type { Unit } from "./units"` (the existing kg/lb scale).
- Produces:
  ```ts
  export type FoodUnit = "g" | "oz";
  export const OZ_PER_G: number;                     // 0.0352739619
  export function foodToDisplay(grams: number, unit: FoodUnit): number;
  export function foodFromDisplay(value: number, unit: FoodUnit): number;
  export function foodUnitFor(weightUnit: Unit): FoodUnit;   // kg -> "g", lb -> "oz"
  export function formatFood(grams: number, unit: FoodUnit): string;  // "150 g" / "5.3 oz"
  ```

- [ ] **Step 1: Write the check**

Create `/tmp/verify-food-units.ts`:

```ts
import { foodToDisplay, foodFromDisplay, foodUnitFor, formatFood, OZ_PER_G } from "/home/daytona/codebase/src/lib/foodUnits";
const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
const out: string[] = [];
out.push(`oz per g ${OZ_PER_G}`);
out.push(`150 g -> oz ${foodToDisplay(150, "oz")}`);          // expect 5.29
out.push(`round trip 150 g ${foodFromDisplay(foodToDisplay(150, "oz"), "oz")}`);  // expect ~150
out.push(`kg lifts -> ${foodUnitFor("kg")}, lb lifts -> ${foodUnitFor("lb")}`);
out.push(`formatted: ${formatFood(150, "g")} / ${formatFood(150, "oz")}`);
out.push(`stable at ${near(foodFromDisplay(foodToDisplay(150, "oz"), "oz"), 150) ? "yes" : "NO"}`);
console.log(out.join("\n"));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun /tmp/verify-food-units.ts`
Expected: a module-not-found error for `src/lib/foodUnits`.

- [ ] **Step 3: Implement `src/lib/foodUnits.ts`**

Mirror the shape of `src/lib/units.ts`: `toDisplay` rounds to one decimal on the way out, `fromDisplay` rounds to two on the way in. `formatFood` returns `` `${value} ${unit}` ``. Do not persist anything and do not touch localStorage; `foodUnit` lives on the profile like `unit` does.

- [ ] **Step 4: Run it to verify it passes**

Run: `bun /tmp/verify-food-units.ts`
Expected: prints the values above, and the last line says `stable at yes`. That last line is Review Focus 1, pinned.

- [ ] **Step 5: Run the house checks**

Run: `bun tsc -b --noEmit && bun run lint src && npm run build`
Expected: exit 0, then 7 warnings and 0 errors, then exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/foodUnits.ts
git commit -m "Add the food unit scale, separate from lifting weights"
```

---

### Task 2: The nutrition domain

**Files:**
- Create: `src/lib/nutrition.ts`, pure half only

**Interfaces:**
- Consumes: `import type { Goal } from "./profile"`, `type FoodUnit` and the converters from `./foodUnits`.
- Produces:
  ```ts
  export interface Macros { protein: number; carbs: number; fat: number }  // always grams
  export interface MealItem { label: string; grams: number; macros: Macros }
  export interface Meal { id: string; name: string; templateId: string | null;
                          items: MealItem[]; macros: Macros; kcal: number; loggedAt: number }
  export interface MealTemplate { id: string; name: string; items: MealItem[];
                                  macros: Macros; kcal: number; createdAt: number }
  export interface MealDraft { name: string; templateId: string | null; items: MealItem[] }
  export const DAILY_MEAL_LIMIT = 20;
  export const MAX_ITEMS = 30;
  export const KCAL_PER_G: { protein: 4; carbs: 4; fat: 9 };
  export function sumMacros(items: MealItem[]): Macros;
  export function kcalOf(m: Macros): number;
  export function proteinTargetFor(bodyweightKg: number | null, goal: Goal): number | null;
  export function proteinTargetOverride(kg: number): number;  // rounds to nearest 5
  export function startOfDay(now: Date): number;
  ```

- [ ] **Step 1: Write the check**

Create `/tmp/verify-nutrition-math.ts`, asserting these exact values from the spec:

```ts
// sumMacros over two items sums each field and leaves the rest alone
// kcalOf({protein:30,carbs:40,fat:10}) === 370        (120 + 160 + 90)
// proteinTargetFor(80, "muscle") === 145              (80 * 1.8 = 144 -> nearest 5)
// proteinTargetFor(80, "strength") === 130            (80 * 1.6 = 128)
// proteinTargetFor(80, "general") === 110             (80 * 1.4 = 112 -> nearest 5 = 110)
// proteinTargetFor(null, "muscle") === null          Review Focus 2
// proteinTargetFor(0, "muscle") === null
// proteinTargetOverride(137) === 135
// startOfDay(new Date(2026, 9, 5, 23, 59)) is local midnight of that day
```

`startOfDay` returns a millisecond epoch number, because `loggedAt` is a number in Task 3. Assert it equals `new Date(2026, 9, 5).getTime()`, and assert that at 23:59 local it is still that same day's midnight, which is the contract that stops an athlete's last meal landing in tomorrow.

Use `console.log` of each result and compare by eye, or `throw` on mismatch. Either way the script must exit non-zero when a value is wrong.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun /tmp/verify-nutrition-math.ts`
Expected: module-not-found for `src/lib/nutrition`.

- [ ] **Step 3: Implement the pure half of `src/lib/nutrition.ts`**

Goals map to grams per kilogram exactly as the spec's table states: muscle 1.8, strength 1.6, general 1.4, endurance 1.4. `proteinTargetFor` returns null when bodyweight is null, zero, negative or not finite, because that is the Review Focus 2 contract. `kcalOf` multiplies grams by the constant and rounds to the nearest whole number. `startOfDay` builds local midnight from a `Date`, never UTC, so an athlete's "today" is their own day.

- [ ] **Step 4: Run it to verify it passes**

Run: `bun /tmp/verify-nutrition-math.ts`
Expected: exits 0 with every asserted value matching.

- [ ] **Step 5: Run the house checks**

- [ ] **Step 6: Commit**

```bash
git add src/lib/nutrition.ts
git commit -m "Add the nutrition domain: macros, meals and the protein target"
```

---

### Task 3: Firestore access, rules and the schema doc

**Files:**
- Modify: `src/lib/nutrition.ts` (add the data layer below the pure half)
- Modify: `firestore.rules`, inside the existing `match /users/{uid}` block
- Modify: `FIRESTORE_SCHEMA.md`

**Interfaces:**
- Consumes: types from Task 2; `src/lib/firebase.ts`'s existing `db` export; the query conventions in `src/lib/data.ts`.
- Produces:
  ```ts
  export function useTodayMeals(uid: string): { meals: Meal[]; loading: boolean; error: string | null };
  export function useTemplates(uid: string): { templates: MealTemplate[]; loading: boolean; error: string | null };
  export async function logMeal(uid: string, draft: MealDraft): Promise<string>;
  export async function saveTemplate(uid: string, draft: MealDraft): Promise<string>;
  export async function deleteTemplate(uid: string, templateId: string): Promise<void>;
  ```

- [ ] **Step 1: Add the three rules matches**

Inside `match /users/{uid}`, alongside the existing rules, add `meals/{mealId}`, `templates/{templateId}` and `foods/{foodId}`. Each is the same three lines as the existing workout scoping: read, create, update and delete only when `request.auth.uid == uid`. `foods` is scoped to the athlete too, deliberately not a shared collection, because a shared one would let any client write wrong macros into everybody's search.

Add a comment above them saying the food cache is per-athlete on purpose.

- [ ] **Step 2: Add the data layer to `nutrition.ts`**

`useTodayMeals` issues one query: `collection(db, "users", uid, "meals")`, `where("loggedAt", ">=", startOfDay(new Date()))`, `orderBy("loggedAt", "desc")`, `limit(DAILY_MEAL_LIMIT)`. Range filter and order on the same field, so Firestore serves it from automatic single-field indexes and `firestore.indexes.json` does not change. That is the whole Today cost: one query, at most 20 reads.

**`loggedAt` is a millisecond epoch number, not a `YYYY-MM-DD` string and not a Firestore `Timestamp`.** This deliberately diverges from `Workout.date`, which is a date string (`src/lib/data.ts:38`) with `orderBy("date", "desc")` at line 305. The reason is index cost: matching workouts exactly would mean an equality filter on a `day` string plus an `orderBy` on a different field, which does need a composite index in `firestore.indexes.json`, and the spec states that file does not change. Meals also have none of the reason workouts use a date string: they live in a subcollection already scoped to one athlete, so there is no cross-author bucketing to get right. If the reviewer prefers house consistency over the index budget, the change is to add `day` alongside `loggedAt` and accept one new composite index.

`logMeal` computes `sumMacros` and `kcalOf` on the client and writes them onto the meal, so reading the day never costs a read per meal. Items are written inline, capped at `MAX_ITEMS`.

Expose `error` as a string on both hooks so the UI can say something. Do not swallow a write failure into a console log: the comment-button precedent in `PostSheet.tsx` says a write that half-succeeded must tell the athlete.

- [ ] **Step 3: Document the four paths in FIRESTORE_SCHEMA.md**

Follow the existing table format. Document `users.bodyweightKg`, `users.foodUnit`, `users/{uid}/meals/{mealId}` and `users/{uid}/templates/{templateId}`, and a short paragraph on why the food cache is per-athlete. Note that macros are grams and that the display unit never changes what is written.

- [ ] **Step 4: Verify the rules parse and the build is clean**

Run: `bun tsc -b --noEmit && bun run lint src && npm run build`
Expected: exit 0, 7 warnings and 0 errors, exit 0. There is no local rules interpreter in this repo, so the rules are verified by reading them against the two existing blocks, not by executing them. Say so in the commit body rather than claiming they were run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition.ts firestore.rules FIRESTORE_SCHEMA.md
git commit -m "Store meals and templates under the athlete, with the rules to match"
```

---

### Task 4: Profile fields

**Files:**
- Modify: `src/lib/profile.ts`

**Interfaces:**
- Consumes: `FoodUnit` from `./foodUnits` (Task 1), `Goal` from this file, and the target math from Task 2's `nutrition.ts` only when a default has to be shown.
- Produces on `UserPrefs`: `foodUnit: FoodUnit`, `proteinTargetG: number | null`. On `UserProfile`: `bodyweightKg: number | null`.

- [ ] **Step 1: Write the check**

Create `/tmp/verify-profile-defaults.ts`: build the loader's default object from a profile document that has none of the three new fields, and print `foodUnit`, `bodyweightKg` and `proteinTargetG`. Expected: `g`, `null`, `null`. Every existing field must still fall back exactly as before, which is what makes an old document valid.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun /tmp/verify-profile-defaults.ts`
Expected: the three fields are `undefined`, not the defaults.

- [ ] **Step 3: Implement the fields**

Add all three to `UserPrefs`, to `DEFAULT_PREFS`, to `pickPrefs`, and to the loader's fallback chain next to `unit`. `bodyweightKg` is stored in kilograms, following `units.ts`, and is null until the athlete gives one. `foodUnit` defaults from the lifting unit at first read so a profile written before this feature still opens.

`proteinTargetG` is null until set; it is an override of the computed target, not a second source of truth.

- [ ] **Step 4: Run it and the house checks**

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile.ts
git commit -m "Carry bodyweight, the food unit and a protein target on the profile"
```

---

### Task 5: The warm tokens

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Produces: `--food` and `--food-dim` on both `:root` and `:root.dark`, beside the existing tokens.

- [ ] **Step 1: Add the tokens**

One warm amber for `--food`, and a dimmer fill for `--food-dim`. Both themes get both tokens, since `--bg` differs between them. Do not redefine `--success`; it stays reserved for progress lines and logged states so the warm accent cannot be mistaken for it.

- [ ] **Step 2: Verify contrast**

Read the computed contrast of `--food` against `--bg` and `--surface-2` in both themes and confirm it clears WCAG AA for the sizes it is used at, 20px or larger bold or 24px regular. If it does not, darken or lighten the value until it does. Record the ratio in the commit body.

- [ ] **Step 3: Run the house checks and commit**

```bash
git add src/index.css
git commit -m "Add the food accent tokens, checked against AA in both themes"
```

---

### Task 6: Onboarding, on the existing Setup step

**Files:**
- Modify: `src/pages/Onboarding.tsx`

**Interfaces:**
- Consumes: `bodyweightKg`, `foodUnit` from Task 4; `useUnit` already in the file; `foodToDisplay` and `foodFromDisplay`.
- Produces: two controls on step 3. Four steps stay four.

- [ ] **Step 1: Add the bodyweight stepper**

On the Setup step, beside equipment and the existing unit picker. A numeric input plus the same `−` and `+` shape the set-entry steppers already use, in the lifting unit because a body is not a food portion. Entering a value writes `bodyweightKg` in kilograms.

The step must remain completable with it empty. `canAdvance` for step 3 already returns true, and that must not change.

- [ ] **Step 2: Add the nutrition unit toggle**

Two options, grams and ounces, defaulting from the lifting unit. It writes `foodUnit` and is independent of `units.ts` afterwards.

- [ ] **Step 3: Carry both through `finish`**

`saveProfile` already spreads `...existing` so preferences survive an edit. Add the new fields to that path so editing setup later never resets bodyweight or the food unit.

- [ ] **Step 4: Verify in the browser**

Run: `freebuff-preview restart`
Then walk setup from a fresh account: four steps, reach the end with bodyweight empty, confirm the app opens and no target is claimed. Set 80 kg, confirm the target is 145 g for the muscle goal.

- [ ] **Step 5: Run the house checks and commit**

```bash
git add src/pages/Onboarding.tsx
git commit -m "Ask for bodyweight and the food unit where the rest of setup lives"
```

---

### Task 7: The Today card

**Files:**
- Create: `src/components/NutritionCard.tsx`
- Modify: `src/pages/Today.tsx`

**Interfaces:**
- Consumes: `useTodayMeals`, `proteinTargetFor`, `Macros`, `foodToDisplay` and `formatFood`, and the profile's `bodyweightKg`, `goal`, `foodUnit`.
- Produces: `export default function NutritionCard({ profile }: { profile: UserProfile })`. Mounted in `Today.tsx` below the existing training content, with no route and no nav item.

- [ ] **Step 1: Build the card**

Protein against target as a bar using `--food`, with the day's totals in `formatFood`. The last three meals as one-tap rows. Tapping a row calls `logMeal(uid, { name: meal.name, templateId: meal.templateId, items: meal.items })`, which copies the items into a new meal.

When `proteinTargetFor` returns null, render no bar and no number: one line asking for bodyweight, which navigates to Profile. That is Review Focus 2, and it must never render `NaN` or a zero-width bar.

- [ ] **Step 2: Mount it and confirm the read cost**

Wire `useTodayMeals` into the card only. Today gains exactly one query. Nothing on this screen queries per meal, per item or per template.

- [ ] **Step 3: Verify in the browser**

Run: `freebuff-preview restart`
Log two meals, confirm the bar moves and the rows are the newest two, and confirm in the console that the second meal did not trigger extra reads.

- [ ] **Step 4: Check the empty and over-cap states**

An athlete with no meals sees an empty card, not a broken one. Force `DAILY_MEAL_LIMIT` meals into one day in the emulator: the card still renders and totals come from the newest 20 without an error. That is Review Focus 3.

- [ ] **Step 5: Run the house checks and commit**

```bash
git add src/components/NutritionCard.tsx src/pages/Today.tsx
git commit -m "Show the day's protein on Today, one tap to log a repeat meal"
```

---

### Task 8: Templates in the sheet

**Files:**
- Create: `src/components/NutritionSheet.tsx`

**Interfaces:**
- Consumes: `useTemplates`, `saveTemplate`, `deleteTemplate`, `logMeal`, `MealTemplate`, `MealDraft`.
- Produces: `export default function NutritionSheet({ open, onClose }: { open: boolean; onClose: () => void })`, opened by `NutritionCard`.

- [ ] **Step 1: Build the Templates tab**

`useTemplates` loads only when the sheet opens, never on Today. Each row is a one-tap log that copies items into a new meal in a single write. This is the claim the feature is built around, so it must work with the network off.

- [ ] **Step 2: Add save-as-template from a logged meal**

Offer it on any meal in Recent. The saved template copies `items`, `macros` and `kcal` as they were.

Confirm that editing a template afterwards does not touch meals already logged: a meal is a copy at write time, never a live reference. That is Review Focus 5, and it is why `logMeal` copies rather than writing a `templateId` pointer alone.

- [ ] **Step 3: Verify in the browser, offline**

Run: `freebuff-preview restart`, save a template, then turn the network off in devtools. Templates still log. Search, when added in Task 9, shows one quiet line instead.

- [ ] **Step 4: Run the house checks and commit**

```bash
git add src/components/NutritionSheet.tsx
git commit -m "Log a repeatable meal in one tap, and save one from what was eaten"
```

---

### Task 9: Food search

**Files:**
- Create: `src/lib/foodApi.ts`
- Modify: `src/components/NutritionSheet.tsx`, add the Search tab

**Interfaces:**
- Consumes: `Macros` from Task 2.
- Produces:
  ```ts
  export interface FoodHit { id: string; label: string; brand: string; per100: Macros }
  export const OFF_CREDIT: string;   // "Food data from Open Food Facts"
  export async function searchFoods(query: string, uid: string, signal: AbortSignal): Promise<FoodHit[]>;
  export async function cacheFoods(uid: string, hits: FoodHit[]): Promise<void>;
  ```

- [ ] **Step 1: Call Open Food Facts**

Search by name, debounced 300ms, aborted on the next keystroke. Nutrients are per 100 g and are divided by the portion before being shown. There is no API key and no signup, which is the deciding factor: a credential has to live somewhere managed, and this feature does not need one.

- [ ] **Step 2: Cache per athlete**

On a successful fetch, write the hits to `users/{uid}/foods/{foodId}`. A search reads the cache first and only calls the network for a query the cache does not answer.

- [ ] **Step 3: Build the Search tab and the credit**

A result opens a portion stepper in `foodUnit`, and logging writes a meal whose items carry their own macros, so it keeps working offline afterwards.

Put `OFF_CREDIT` on screen in this tab. The Open Food Facts data is ODbL, which obliges attribution where the data is shown. That is a licence obligation, not a nicety, and it does not come out.

- [ ] **Step 4: Verify the failure path**

Run: `freebuff-preview restart`, then block `world.openfoodfacts.org` in devtools. Search shows one line saying it is unavailable, the app does not throw, and templates still log. That is Review Focus 4.

- [ ] **Step 5: Run the house checks and commit**

```bash
git add src/lib/foodApi.ts src/components/NutritionSheet.tsx
git commit -m "Search Open Food Facts and cache it per athlete, offline after first fetch"
```

---

### Task 10: Editing it all from Profile

**Files:**
- Modify: `src/pages/Profile.tsx`

**Interfaces:**
- Consumes: `bodyweightKg`, `foodUnit`, `proteinTargetG` from Task 4; `proteinTargetFor`, `proteinTargetOverride`.

- [ ] **Step 1: Add the three controls**

Bodyweight in the lifting unit, the nutrition unit toggle, and the protein target. The target shows the computed default from bodyweight and goal, and an athlete who sets one overrides it. Clearing the override goes back to the computed value.

- [ ] **Step 2: Verify the recompute**

Change bodyweight at 80 kg to 90 kg with the muscle goal and no override: the target goes 145 g to 160 g. Set an override, change bodyweight again, confirm the override holds.

- [ ] **Step 3: Run the house checks and commit**

```bash
git add src/pages/Profile.tsx
git commit -m "Let the athlete edit bodyweight, the food unit and the protein target"
```

---

## Definition of Done

- `bun tsc -b --noEmit` exits 0.
- `bun run lint src` reports exactly 7 warnings and 0 errors.
- `npm run build` exits 0.
- All five Review Focus lines are demonstrated in the browser, in the task that owns them.
- `firestore.rules` and `FIRESTORE_SCHEMA.md` are in the same commit as the client that needs them.
- The Open Food Facts credit is on screen where its data is shown.

## Out of Scope

No photos, no sharing to the feed, no calorie advice, no scheduled reminders, no global food collection written by clients, no import or export. Any of these arriving later is a new spec, not a task added to this plan.
