# Nutrition and prep meals: written spec

Status: awaiting review. Nothing here is built. Per `.agent/skills/brainstorming`,
this spec is written only after the conversational design was approved, and the
implementation plan is written only after this spec is approved.

## What this is

A private macro log that lives on the Today screen. The daily path is: a
repeatable meal, logged in one tap, moving a protein bar toward a target. Food
search exists for the case where you are eating something new, and it is never
on the critical path.

Everything is private to the athlete. There is no sharing, no feed post, and no
public meal data. That is a deliberate limit, not an oversight: the feature is
worth building because it is small and quiet, and it stops being worth building
the moment it becomes social.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Approach | A, templates first | "Log fast" is the claim, so the network must not be on the daily path |
| Onboarding | Modified, stays four steps | Bodyweight and the nutrition unit join the existing Setup step |
| Units | Nutrition units are separate from lifting units | Food is weighed in grams and ounces; plates are in kilograms and pounds |
| Food data | USDA FoodData Central | Public domain, government uptime, and it sends CORS headers a browser accepts. Needs a free key, which ships in the bundle. |
| Photos | None | Removes the 1 MiB Firestore ceiling from the design entirely |
| Reminders | None scheduled | No Cloud Scheduler on the free plan, so nothing may promise a notification it cannot deliver |
| Tone | Warmer, same tokens | One new accent in `src/index.css`, used only by the nutrition surfaces |

## Constraints this design inherits

- The Firebase project stays on the free plan. No Cloud Storage, no Cloud
  Functions. Everything persistent is Firestore.
- Firestore rules allow a limited number of document access calls per request.
  Every query below is counted against that budget and none of them scales with
  the number of meals an athlete has eaten.
- Firestore rules and `FIRESTORE_SCHEMA.md` change in the same commit as the
  client, or the next deploy breaks a path that already works.
- Copy claims no health outcomes. A protein target is a number the athlete sets,
  not advice the app gives.

## Onboarding change

Four steps stay four steps. The Setup step, which already collects equipment and
the lifting unit, gains two controls.

**Bodyweight.** A numeric stepper in the lifting unit, because a body is not a
food portion and nobody weighs themselves in ounces. Optional: an athlete who
skips it gets no protein target and the Today card asks for it once, rather
than being blocked by a setup screen that now refuses to finish.

**Nutrition unit.** A two-way toggle, grams or ounces, defaulting to follow the
lifting unit (kg gives grams, lb gives ounces). Independent afterwards, which
is the point: an athlete who lifts in pounds and thinks about food in grams is
an ordinary person, not an edge case.

Bodyweight becomes `users/{uid}.bodyweight`, stored in kilograms, following the
same convention as every other weight in the app. The nutrition unit becomes
`users/{uid}.foodUnit`, `"g" | "oz"`, and joins `pickPrefs` and `DEFAULT_PREFS`
so that editing setup later never resets it.

## The unit model

Two separate scales, deliberately:

- **Body mass** (bodyweight, lifting weights) uses the existing `src/lib/units.ts`
  kg and lb scale.
- **Food mass and macros** (a portion of rice, grams of protein) use a new scale
  in a new module, grams and ounces.

Macros are stored as grams and converted for display, the same way `units.ts`
stores kilograms and converts. Storing in the athlete's unit would round on
every write and quietly lose protein across a week of meals.

`foodUnit` is a display preference only. It never touches what is written.

## Protein target

Derived from bodyweight and goal, rounded to the nearest 5g, editable in
Profile, and recomputed whenever either input changes.

| Goal | g per kg |
|---|---|
| Build muscle | 1.8 |
| Get stronger | 1.6 |
| Stay in shape | 1.4 |
| Build endurance | 1.4 |

These are editable defaults, not medical advice, and the UI says so by letting
the number be changed rather than by carrying a disclaimer nobody reads.

## Data model

Four paths, all private.

### `users/{uid}.bodyweight`, `users/{uid}.foodUnit`

On the existing profile document, beside `unit` and `tzOffset`. No new document,
so no extra read on any screen that already loads the profile.

### `users/{uid}/meals/{mealId}`

One logged meal.

| Field | Type | Notes |
|---|---|---|
| `name` | string | what the athlete called it |
| `templateId` | string | the template it came from, absent for a one-off |
| `items` | Item[] | inline, ordered, capped at 30 |
| `macros` | `{ protein, carbs, fat }` | grams, denormalised onto the meal |
| `kcal` | number | denormalised, so the day total is one sum |
| `loggedAt` | timestamp | server time |

Each item carries `label`, `grams`, and its own `macros`. The macros are copied
onto the meal precisely so that reading the day never costs a read per meal.

### `users/{uid}/templates/{templateId}`

The same shape as a meal, minus `loggedAt` and `templateId`. Logging one is a
single write that copies its items into a new meal. This is what makes a
repeatable meal fast: no search, no arithmetic, no network.

### `users/{uid}/foods/{foodId}`

The athlete's own cache of what they have looked up, mirroring
`exercises/{exerciseId}` in shape but private.

It is deliberately **not** a shared `foods` collection. The `exercises` catalog
is data this app ships, so any client may write it. Food data comes from a
third-party API and is cached per athlete, so one client cannot poison another's
lookups by writing a document with wrong macros. The cost is a few kilobytes per
food per athlete, once.

## Reads, and what they cost

| Screen | Query | Cost |
|---|---|---|
| Today | `meals` where `loggedAt` is today, newest first, limit 20 | 1 query, up to 20 reads |
| Today | profile, already loaded | unchanged |
| Sheet, on open | `templates`, newest first, limit 12 | 1 query, up to 12 reads |
| Sheet, on search | `foods`, name prefix, limit 20 | 1 query, after 300ms idle |

Nothing on Today queries per meal, per item, or per template. The day total is
a client-side sum over one result set.

A limit of 20 meals a day is generous past the point of realism, and it is a
hard cap rather than an unbounded read: an athlete who eats more has a wrong
number, which is better than a slow screen.

Both subcollection queries are a single `orderBy` on one field inside a
user-scoped subcollection, so Firestore serves them from automatic single-field
indexes. `firestore.indexes.json` does not change.

## Food search

USDA FoodData Central, searched by name, debounced 300ms, results cached per
athlete on first successful fetch.

This replaced an Open Food Facts design that was written here first and did not
survive contact with a browser. **Open Food Facts' search service cannot be
called from a browser at all**: it returns `access-control-allow-origin: *` when
no `Origin` header is sent and no CORS header whatsoever when one is, which
every browser sends. A `curl` without `Origin` proves nothing. USDA is one of
the few food APIs that sends `access-control-allow-origin: *` either way, which
is the reason for the change.

The cost is a free API key, held as `VITE_FDC_API_KEY`. That is a real cost and
it is worth stating plainly: the key is baked into the client bundle at build
time and is readable by anyone who opens the page. It is a read-only key for
public-domain data and costs nothing, but it is not a secret and must never be
treated as one.

The data is public domain, so unlike Open Food Facts there is no attribution
obligation. The sheet still names the source, as a matter of honesty rather
than licence.

When the network is down, rate-limited, or the athlete is offline, search fails
quietly with one line saying so. A missing API key is reported as its own
message, because "no key configured" and "service unreachable" need different
actions. Templates keep working either way, because a template carries its own
macros and never needs the API.

## The surfaces

**Today** gains one card below the existing training content: the day's protein
against target, and the last three meals as one-tap rows. Tapping a row logs
that meal again. The card is the only thing added to the screen.

**The sheet** opens from the card. Three tabs, no more: Templates, Search,
Recent. Logging a template is one tap. Search results offer portions, which the
athlete adjusts with a stepper in the nutrition unit.

**No new route and no bottom-nav item.** The app's claim is one screen, and a
nutrition tab would be a second product.

## Warmth, without new colours floating around

One accent added to `src/index.css` as `--food`, a warm amber, plus `--food-dim`
for fills. Both are tokens. No raw hex outside that file, no new one-off
utilities, and the existing `.panel`, `.tab` and `.btn-solid` classes keep
working unchanged. `--success` stays reserved for progress lines and logged
states, so a warm accent cannot be mistaken for it.

Motion stays inside the existing rules and respects the current
`prefers-reduced-motion` block.

## Out of scope, deliberately

- Photos of food
- Sharing meals to the feed
- Calorie targets as advice, or any health claim
- Scheduled reminders or notifications
- A global shared food catalog written by clients
- Import or export

## Deploy order

The client and the rules ship together. `firestore.rules` gains two subcollection
matches under `users/{uid}`, and `FIRESTORE_SCHEMA.md` gains the four paths
above. A cached old bundle meeting new rules cannot write a meal, so the failure
is "the log button does nothing" rather than an error. Worth a release note.

## Still open

Nothing blocking. One thing to revisit after the feature ships: the 20-meal
daily cap is a guess, and real usage will say whether it should be a visible
"and 4 more" or stay silent.
