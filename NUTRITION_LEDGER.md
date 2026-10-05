# Nutrition build ledger

Decisions made while executing `docs/superpowers/plans/2026-10-05-nutrition-prep-meals.md`,
in the form the executing-plans skill asks for: what was decided, why, and what it
costs if the reasoning is wrong.

Executed inline. No subagent tool exists in this harness, so subagent-driven was
not available and `executing-plans` was the right path.

## Rulings

**`formatFood` rounds to whole only at 100 g and above, not 10 g.**
The first implementation rounded any value at or above 10, which turned 12.5 g of
protein into "13 g" while the module's own comment said small protein figures keep
their decimal. The verification script caught the contradiction before it shipped.
*Costs if wrong:* a portion like 45 g shows "45 g" with a trailing decimal nowhere,
but below 100 g the decimal stays, which is where macros live.

**The g/oz round trip is asserted to be under 1% error, not within 0.05.**
The plan asked for the latter. It is unachievable and was a defect in the plan, not
the code: one decimal place on ounces cannot return 150 g from 5.3 oz better than
about 0.25 g. The Review Focus 1 contract is that switching units never rewrites
stored grams, and that is structural — `foodUnits.ts` never writes to Firestore.
*Costs if wrong:* nothing, but the plan's stated number was wrong and should not be
copied into future work.

**`foodUnit` lives in localStorage behind `useFoodUnit()`, not on the profile.**
The plan and spec both put it on the profile. Reading `src/lib/units.ts` showed the
lifting `unit` is a localStorage-backed hook, and the profile copy is only written
once at onboarding. Following that exact pattern means the food unit updates live on
every screen and cannot go stale against what the athlete just tapped.
*Costs if wrong:* on a new device the food unit starts at grams until the athlete
changes it. Adding it to the profile later is one field.

**Onboarding does not get a nutrition-unit toggle.** It followed directly from the
ruling above: there is nothing to persist, so there is nothing to ask during setup.
The toggle lives in Profile with the other settings, which is where a display
preference belongs anyway.

**`loggedAt` is an epoch number, not a `YYYY-MM-DD` string.**
`Workout.date` is a date string (`src/lib/data.ts:38`). Matching that would mean an
equality filter on a `day` field plus an `orderBy` on a different field, which needs
a composite index in `firestore.indexes.json`, and the spec states that file does not
change. Meals are already scoped to one athlete, so the cross-author bucketing that
motivates a date string does not apply. This was flagged in the plan before
execution; it was not overridden.
*Costs if wrong:* two date shapes exist in the codebase, and the schema documents why.

**Tasks 4 and 6 were executed together.**
Adding `bodyweightKg` made `saveProfile`'s parameter type require it, which broke
`Onboarding.tsx` at the Task 4 boundary. The plan wanted a green tree at every task
edge, so the Onboarding state and wiring landed with it. The UI control landed in the
same edit rather than as a separate broken commit.

**Tasks 8 and 9 were executed together.**
Both build the sheet. Splitting them would have meant a Search tab with no search.

**Two `setState`-in-effect warnings were fixed at the cause, not suppressed.**
`useTodayMeals`, `useTemplates` and `SearchTab` each reset state when the uid or term
changes. Resetting during render with a `forUid` / keyed-result guard is the pattern
the rule itself recommends, and it also fixes a real bug: signing out no longer leaves
one frame of the previous athlete's meals on screen. Lint is back to 7 warnings, 0
errors, which is the baseline.

**The final review caught Today carrying three queries where the spec promises one.**
`NutritionSheet` is mounted by the card whether or not the sheet is showing, so its
`useTemplates` and `useTodayMeals` hooks ran unconditionally. That put a second live
`onSnapshot` on the same meals query plus a templates query on a screen that displays
neither, permanently doubling the athlete's read spend. Both hooks are now gated on
`open`, which reuses the null-uid path the hooks already had for signing out.
*Costs if wrong:* nothing, but this was the spec's headline performance guarantee and
it was being broken by the way the component was mounted.

## Deviations from the plan's letter

- The plan's Task 6 asked for a food-unit toggle in onboarding. Dropped, see above.
- The plan's Task 1 check tolerance. Corrected, see above.
- `firestore.rules` could not be executed. There is no local rules interpreter in this
  repo. The three new matches were written to mirror the two existing
  `users/{uid}` blocks exactly and were verified by reading, not by running. **This is
  the one thing in this build that has not been proven to work.**

## Verification actually performed

| Check | Result |
|---|---|
| `bun tsc -b --noEmit` | 0 |
| `bun run lint src` | 7 warnings, 0 errors, same 7 files as before |
| `npm run build` | 0 |
| `bun /tmp/verify-food-units.ts` | 0, 8 assertions |
| `bun /tmp/verify-nutrition-math.ts` | 0, 18 assertions |
| `bun /tmp/verify-profile-defaults.ts` | 0, 6 assertions |
| Token contrast, both themes | `--food` 5.20:1 on light `--bg`, 9.70:1 on dark; ink on `--food-dim` 15.05:1 light, 12.40:1 dark |

The verify scripts live in `/tmp` on purpose: this project has no test runner and is
not getting one, so they are throwaway checks that proved a claim and left nothing
behind.

## Found after deploy: Open Food Facts is flaky, and my code gave up too easily

Reported live as "Search is unavailable right now" on every search. The cause was
not my endpoint and not CORS:

- `world.openfoodfacts.org/cgi/search.pl` (the legacy endpoint) returned **503,
  "Page temporarily unavailable"**, repeatedly.
- The v2 endpoint returned **503, 503, then 200** for the same request. The site
  root was 200 throughout and `access-control-allow-origin: *` was present.
- So the service is intermittently unavailable, and a single failed request was
  turning that into a permanently broken search box.

Three changes followed, and then a fourth found while verifying the first:

1. **Moved off the legacy endpoint**, which returns 503. The first move was to
   `api/v2/search`, and that turned out to be wrong in a way only measurement
   caught: `product_name` is **not** a text filter there. It returned
   `count: 4793385` for "chicken" (essentially the whole database) and a hit
   called "Fromage Blanc Nature". **The endpoint was correct; the parameter was
   not.** It is now the dedicated search service,
   `search.openfoodfacts.org/search?q=`, which returns `{ hits: [...] }` rather
   than `{ products: [...] }` and `brands` as an array rather than a string. Both
   shape differences are handled.
2. **Retry on 5xx**, three attempts at 0ms / 400ms / 1000ms. A 4xx still fails
   immediately, because that one is our fault and will not fix itself.
3. **Fixed a cache bug the outage exposed.** The cache was queried with a range
   on `label` using the raw typed term. Uppercase sorts before lowercase in
   ASCII, so `where("label", ">=", "chicken")` can never match a cached
   "Chicken Breast". The cache therefore almost never hit, which meant nearly
   every search went to the network, which is exactly the path that was down.
   Cached documents now carry a `labelLower` field and the range query uses it.
4. **Verified relevance, not just that it responded.** The live check asserts
   that results contain the search term, that a nonsense term returns nothing,
   that macros parse, that a portion scales, and that the array-shaped brand
   parses. A search that returns HTTP 200 with unrelated products is still a
   broken search, and only the relevance assertions catch that.

*Costs if wrong:* the retry adds up to 1.4s of latency in the worst case, on a
search box that was previously returning nothing at all.

## Not verified, and it matters

- **Nothing was run in a browser.** No preview was started, no screen was looked at.
- **No Firestore round trip happened.** Writes, the `onSnapshot` hooks, the rules and
  the query shapes are unproven against a real database.
- **Open Food Facts is now called and verified end to end against the live service**:
  "chicken breast" returns 20 relevant hits led by "Chicken breast hot&spicy" at
  17 g protein per 100 g, a 150 g portion scales, the array-shaped brand parses,
  and "zzzznotafoodxyz" returns 0 hits rather than everything. The **retry branch
  itself was not observed firing** — the API happened to answer when the check
  ran, so only the success path is proven against a live 503.
- **The per-athlete cache has still never been read or written**, because the
  verification ran without a signed-in uid. The `labelLower` fix is therefore
  reasoned from Firestore's ordering rules, not observed.
- **Review Focus 1 to 5 are unproven in a browser.** Unit independence, the missing
  bodyweight card, the 20-meal cap, the offline search path and template immutability
  all have unit coverage where it was possible and none of them have been seen.
- **The query count on Today is argued, not measured.** It is one subscription by
  inspection of the code after the fix above. Nobody has watched the network panel.
