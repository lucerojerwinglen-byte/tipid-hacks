---
status: accepted
---

# Default recommendation philosophy is Sulit (value-per-peso), not cheapest

**Context.** Through Milestone 2, the app's default solver mode was `feed-everyone`, which is
literally the *cheapest* way to fully cover the group (SOLVER.md §4), and "any chain" mode
ranked chains by lowest `totalCost` (SOLVER.md §5). During planning for Milestone 5, Jerwin
clarified that this was never the actual product intent: the app should default to the order
that's most **[[Sulit]]** (best value for the peso), not the one that's most **[[Mura]]**
(cheapest). The two are genuinely different objectives — "cheapest" minimizes spend, "sulit"
maximizes food value delivered per peso — and the codebase's default had been optimizing for
the wrong one.

**Decision.** Redefine the existing `maximum-food` `SolverMode`'s Phase 2 objective in
`maximizeLeftoverValue` (src/solver.ts) from maximizing raw item *count* to maximizing total
**[[Value (servings)|value]]** (`main_servings + carb_servings`) per peso of leftover budget —
same bounded-knapsack DP shape, different per-unit weight. Make `maximum-food` the app's
default `SolverMode` (was `feed-everyone`), and change "any chain" ranking (`solveAnyChain`) to
rank feasible chains by highest total value delivered instead of lowest `totalCost`.
`feed-everyone` and `cheapest-possible` are unchanged and remain available as explicit opt-in
modes for users who want the literal cheapest answer. Infeasible-chain ranking (most people
covered, then cost) is unchanged — Sulit ranking only applies once minimum coverage is
affordable. Ties are still broken deterministically by stable item ID (SOLVER.md §7) — value is
an objective, data-derived metric, not the subjective desirability score that decision rejected.
Drinks/desserts/sides score 0 value by construction (0 `main_servings`/`carb_servings` in the
data model) and are therefore effectively excluded from Sulit's leftover-budget picks — this is
deliberate, not a bug to fix later.

## Considered options

- **New `sulit` mode alongside the existing three**, leaving `maximum-food` untouched. Rejected:
  the three-mode structure already draws the meaningful lines (cheapest-to-cover vs.
  fully-spent vs. floor-price); a fourth mode with a name and a redefined `maximum-food` sitting
  next to each other would be confusing, and `maximum-food`'s current "spend it all, maximize
  count" behavior isn't a use case worth preserving as a separate button — count-maximizing was
  never a real product goal, just what got built first.
- **Redefine `feed-everyone`'s Phase 2 suggestion** instead of `maximum-food`'s. Rejected:
  `feed-everyone` headlines the minimum-cost coverage and only *offers* leftover spend as a
  suggestion (SOLVER.md §4); Sulit needs to be the headline result, not a footnote.
- **Value numerator including drinks/desserts/sides** (e.g. flat +1 for non-coverage items, closer
  to old count-maximizing behavior). Rejected in favor of servings-only: a "sulit" order should
  mean the leftover budget buys more real food, not a Coke — matches the intuitive Filipino sense
  of the word and keeps the rule simple and explainable.
- **Rank chains by value-per-peso ratio** rather than raw total value. Not chosen for v1: in
  `maximum-food` mode the full budget is always spent when feasible (SOLVER.md §4), so the
  denominator is ~constant across chains and raw total value ranks identically to the ratio in
  the common case, at lower implementation cost.

## Consequences

- SOLVER.md (§4 Phase 2 description, §7 tie-break note, §8 test-case table), PRD.md (mode
  descriptions and stated default), and the `solver.test.ts` regression test that currently
  locks in "maximize item count" for `maximum-food` all need rewriting to describe the new
  value-maximizing objective — tracked as implementation work for the next pass, not done as
  part of this decision record.
- `App.tsx`'s default `useState<SolverMode>` and `BudgetForm.tsx`'s label/hint text for
  `maximum-food` (renamed "Sulit" in the UI, hint *"Pinaka sulit — max value para sa budget mo"*)
  need corresponding code changes. `feed-everyone`'s and `cheapest-possible`'s UI labels are
  intentionally left as-is for now, per Jerwin — revisit later.
- Milestone 0's worked-example test (₱300, 4 people, Jollibee) is unaffected: it pins
  `feed-everyone` by explicit name, not "whatever today's default is."
