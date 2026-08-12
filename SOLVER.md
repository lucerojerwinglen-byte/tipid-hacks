# Solver — barato

**Status:** Formulation decided. This is the actual intellectual property of the project —
everything else is plumbing around it.

---

## 1. Why dynamic programming, not a library or brute force

Considered and rejected during planning (see ARCHITECTURE.md for the research backing this):

- **Brute force over item subsets** — would genuinely explode (2^100+ for a 100-150 item
  menu). Rejected.
- **WASM LP/ILP solvers** (glpk.js, highs.js) — each alone would consume 75-150% of the
  entire 200KB bundle budget, plus tens of ms of WASM instantiation eating into the 50ms
  target. Rejected.
- **JS LP libraries** (javascript-lp-solver, YALPS) — general single-objective LP doesn't
  naturally express this problem's actual objective, which has three stages (satisfy a
  coverage constraint → minimize cost → maximize leftover value) without weighted-sum hacks
  that would make behavior hard to reason about or explain to a user. Rejected.
- **Hand-rolled dynamic programming** — this problem is bounded knapsack with a small,
  bounded coverage target (headcount N ≤ 10) and a bounded item catalog (~100-150 per chain).
  That combination makes the *correct* DP state space tiny. Chosen.

---

## 2. Inputs

- `B` — budget in pesos (integer)
- `N` — headcount (integer, 1-10 in practice; no hard cap enforced, but the UI should warn
  above ~15 since coverage-based modeling stops meaning much for very large ad-hoc groups)
- `chain` — a specific chain, or "any" (see §5)
- `mode` — `feed-everyone` (default) | `maximum-food` | `cheapest-possible`
- Optional dietary filters (tag-based exclusion, applied by removing matching items from the
  candidate pool before solving — no solver-level special casing needed)
- The chain's item catalog: each item has `price`, `category` (main/rice/side/drink/dessert/
  combo — combos pre-decomposed per DATA-MODEL.md), `serves`, and per-category serving
  contributions (see §3)

---

## 3. Modeling "coverage"

Every person needs **≥1 main-equivalent serving** and **≥1 carb-equivalent serving**. Each
item contributes:

- `mainServings` — servings of "main" this item provides per unit purchased (0 if the item
  isn't a main)
- `carbServings` — servings of "carb/rice" this item provides per unit purchased (0 if not
  applicable)

Most items contribute to exactly one of these. Two modeling special cases, resolved during
planning (see DATA-MODEL.md for the full schema):

- **Unlimited rice** (Mang Inasal): modeled as a near-zero-price item with `carbServings` set
  to a large constant (≥ N), so the DP satisfies the carb requirement for the whole group at
  negligible cost, matching reality.
- **Pizza** (Shakey's): a slice functions as a complete food unit, not cleanly "a main" or "a
  carb" the way a burger-and-rice pairing is. Modeled as contributing to **both**
  `mainServings` and `carbServings` per slice-equivalent. Flagged in OPEN-QUESTIONS.md as
  worth revisiting once real Shakey's data is in hand — this is a reasonable v1 approximation,
  not a load-bearing assumption.

Per-item purchase quantity is capped at `min(N + 2, 12)` — buying far more of one item than
the group could plausibly want is never the optimal *useful* answer, and capping keeps the DP
small. (The `+2` slack allows a slightly-oversized shareable item to still win when it's
genuinely the cheapest way to hit the coverage target.)

---

## 4. Algorithm

### Phase 1 — minimum cost to cover the group

State: `dp[m][r]` = minimum cost (pesos) to acquire at least `m` main-servings **and** at
least `r` carb-servings, for `m, r` each ranging `0..N`. (`m` and `r` are capped at `N` —
servings beyond what's needed don't help feasibility, so they're not tracked separately;
phase 2 handles "more than needed" as *value*, not coverage.)

```
function solveCoverage(items, N):
    dp = (N+1) x (N+1) grid, all set to Infinity, except dp[0][0] = 0
    parent = same-shape grid, for reconstructing the chosen items

    for item in items:
        maxQty = min(N + 2, 12)
        for q in 1..maxQty:
            # Note: iterating m, r upward technically lets a single pass chain
            # unlimited reuse of the same item (see Phase 2 below for where that
            # actually matters). It's harmless here because m and r are capped at
            # N and the objective MINIMIZES cost — once a cell hits its cap,
            # spending more on redundant copies never wins, so excess quantity is
            # never chosen no matter how loose this bound technically is.
            for m in 0..N:
                for r in 0..N:
                    if dp[m][r] is Infinity: continue
                    newCost = dp[m][r] + item.price
                    newM = min(N, m + item.mainServings)
                    newR = min(N, r + item.carbServings)
                    if newCost < dp[newM][newR]:
                        dp[newM][newR] = newCost
                        parent[newM][newR] = (m, r, item, newM, newR)

    return dp, parent
```

`dp[N][N]` is the minimum cost to fully cover the group — the core "feed everyone" answer.
`dp[n'][n']` for any `n' < N` is, for free, the minimum cost to fully cover just `n'` people —
this is what powers `cheapest-possible` mode and the infeasible-input fallback (§5).

### Phase 2 — spend leftover budget maximizing value

Given `minCost = dp[N][N]` and `leftover = B - minCost` (only runs if `minCost <= B`): a 1D
knapsack maximizing total **food value** (`mainServings + carbServings` delivered, not raw item
count — see "Sulit" below) within `leftover` pesos, **bounded at `maxQty` per item** (same cap
as Phase 1, SOLVER.md §3).

**"Sulit," not "mura" (ADR 0001, docs/adr/0001-sulit-default-value-per-peso.md).** Through
Milestone 2 this objective maximized raw item *count*, which made "maximum-food" mode
functionally "buy whatever's cheapest per unit" — a cheap objective wearing a value-sounding
name. It's now weighted by each unit's actual `mainServings + carbServings`, so an item with
zero of both — every drink, dessert, and side in the data model (DATA-MODEL.md) — contributes
zero value no matter how cheap it is, and is therefore never chosen to fill leftover budget.
This is the same DP shape as before; only the per-unit weight changed (`+1` → `+ itemValue`).
See CONTEXT.md's `Sulit` / `Mura` / `Value (servings)` glossary entries for the vocabulary this
maps to.

That per-item cap is not optional here the way it effectively is in Phase 1. This was found the
hard way while building Milestone 2 (ROADMAP.md) against Mang Inasal's real menu: its ₱5
unlimited-rice add-on let an unbounded version of this function recommend 79 separate orders of
it — technically correct under an uncapped objective, useless as a suggestion, and an even
sharper trap under the value-weighted objective than the old count-weighted one, since each
copy of that item is "worth" 10 value units (its `carbServings`), not just 1. Phase 1 gets away
with loop order that technically allows unlimited reuse *within* a single pass, because its
(m, r) state is capped and it minimizes cost, so excess copies are never preferred regardless.
Phase 2 maximizes value with no such ceiling, so it needs the cap enforced for real — via
`maxQty` repeated passes processed in **decreasing** budget order, which is what actually
limits each pass to "at most one more unit of this item" (increasing order — Phase 1's order —
lets a single pass chain unlimited reuse; decreasing order doesn't, because by the time a cell
is revisited within the same pass, nothing later in that pass could have fed back into it):

```
function maximizeLeftoverValue(items, leftoverBudget, N):
    best = array of size (leftoverBudget + 1), all 0
    chosen = array of size (leftoverBudget + 1), all empty
    maxQty = min(N + 2, 12)

    for item in items:
        itemValue = item.mainServings + item.carbServings
        for q in 1..maxQty:
            for c from leftoverBudget down to item.price:
                if best[c - item.price] + itemValue > best[c]:
                    best[c] = best[c - item.price] + itemValue
                    chosen[c] = chosen[c - item.price] + [item]

    return chosen[leftoverBudget]
```

`feed-everyone` and `maximum-food` modes both run phase 1 then phase 2 — they are, honestly,
the *same computation*. The difference is presentation, not algorithm: `feed-everyone`
headlines the minimum-cost solution and shows phase-2 additions as an optional "you could also
add..." suggestion; `maximum-food` headlines the fully-spent total (phase 1 + all of phase 2)
as the primary order. This was a genuine finding while formalizing the algorithm, worth
knowing before building the UI so the two modes aren't accidentally implemented as duplicate
logic.

### `cheapest-possible` mode and the infeasible fallback

```
function solveCheapestPossible(dp, N, B):
    # find the largest n' <= N such that fully covering n' people fits the budget
    for nPrime in N downTo 0:
        if dp[nPrime][nPrime] <= B:
            return { peopleCovered: nPrime, cost: dp[nPrime][nPrime] }
    return { peopleCovered: 0, cost: 0 }  # not even 1 person fits — see edge cases
```

If `dp[N][N] > B` (i.e. `feed-everyone` is infeasible), the app automatically runs this and
reports honestly: *"₱100 isn't enough to feed 8 people a full meal here — this covers 3."*

---

## 5. "Any chain" mode

No cross-chain mixing (decided during planning — a mixed order requires visiting two physical
stores, which isn't a real action, and it would multiply the DP's item pool 6x for no
real-world benefit). "Any chain" runs the full solve independently per chain and ranks them by
**the requested mode's own objective** (ADR 0001): for `maximum-food` (the default, "Sulit")
that's highest total food value delivered, not lowest cost — that mode always spends the full
budget when feasible, so cost stops meaningfully differentiating chains and value is the honest
comparison ("Jollibee feeds you 2 more servings than Chowking for this budget"). For
`feed-everyone` and `cheapest-possible` — modes that are explicitly about minimizing spend —
ranking stays cost-based, exactly as before ADR 0001 ("Jollibee beats Chowking by ₱44 for this
group"). The next 1-2 chains are shown as runners-up either way — this is nearly free once all
six are already being computed, and it's a genuine trust-building feature since it shows the
user *why* the answer won instead of asserting it.

---

## 6. Complexity

Phase 1: `O(items × maxQty × N²)`. With items ≈ 150, maxQty ≈ 10, N ≤ 10: **≈150 × 10 × 121 ≈
180,000 operations** — comfortably sub-millisecond in JS, well inside the 50ms target with
massive headroom. (This is a smaller and more precise estimate than the ≈7.5M "items × budget
× qty" ballpark floated during planning, which modeled the DP over raw peso-budget rather than
over coverage counts — indexing by coverage instead of pesos is both correct and cheaper here
specifically because `N` is small.)

Phase 2: `O(leftoverBudget × items)` — with leftover bounded by `B` (realistically a few
thousand pesos) and items ≈ 150, this is at most a few hundred thousand operations. Also
trivial.

**The combinatorial space does not explode at realistic menu sizes.** Brute force over subsets
would; DP over the small coverage/budget state spaces does not, because it's polynomial in
`N`, `items`, and `B`, not exponential in the number of items.

---

## 7. Ties and near-ties

When multiple item combinations achieve the identical minimum cost (Phase 1) or identical
maximum value (Phase 2's "Sulit" objective, ADR 0001), break ties **deterministically** by a
stable canonical item ordering (e.g. item ID) rather than by any additional "desirability"
heuristic — consistent with the planning decision not to add a quality/desirability scoring
system for v1. This guarantees the same input always produces the same output, which is what
actually prevents the result from *feeling* arbitrary — determinism and explainability, not a
hidden taste model. Note that "value" itself (`mainServings + carbServings`) is *not* such a
scoring system — it's an objective count derived from data already in the item schema, not a
subjective quality judgment; only tie-breaks *among* equal-value combinations avoid one.

---

## 8. Test cases

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | ₱300, 4 people, Jollibee, feed-everyone | Matches the brief's own worked example: à la carte beats 4 combo meals; savings explicitly shown |
| 2 | ₱100, 8 people, feed-everyone | Infeasible — auto-falls back to cheapest-possible, honestly reports partial coverage (e.g. "covers 3 of 8") |
| 3 | Budget exactly equals minimum feasible cost | Leftover = 0; phase 2 is a no-op; must not crash on an empty leftover budget |
| 4 | 1 person, ₱5,000 budget, maximum-food | Coverage constraint only requires 1 main + 1 carb; phase 2 must not over-assume more people need feeding |
| 5 | Headcount not a clean multiple of a bucket's `serves` (e.g. 4 people, 6pc bucket) | Solver may still choose the bucket if it's cheapest overall despite 2 "wasted" servings — correct behavior, not a bug |
| 6 | Mang Inasal, any budget/headcount | Carb constraint satisfied near-free via the unlimited-rice modeling in §3; verify it doesn't silently consume most of the budget |
| 7 | Shakey's, feed-everyone | Pizza slices satisfy both main and carb per §3's dual-contribution modeling; revisit once real data confirms slice-per-box counts |
| 8 | Dietary filter removes all "main" category items for a chain | Distinct from budget-infeasibility — the message shown must say "no matching items for your filters here," not "not enough budget," since the fix is different (change filters vs. raise budget or headcount) |
| 9 | Two distinct item combinations tie at the same minimum cost | Same input always produces the same output (§7) |
| 10 | `maximum-food` (the default, "Sulit") leftover budget, with both a zero-value item (drink) and a real-value item affordable | Never picks the zero-value item; fills leftover with the real-value item instead (ADR 0001) |
| 11 | "Any chain," `maximum-food` mode, two chains where the cheaper one can't usefully spend its leftover and the pricier one can | Ranks by total value delivered, not cost — the pricier-but-higher-value chain wins (ADR 0001). Same two chains under `feed-everyone` still rank by cost, unaffected |
