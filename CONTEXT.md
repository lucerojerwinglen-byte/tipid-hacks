# barato

A budget/headcount → fast-food order solver for Philippine fast-food chains. Given a budget and
a group size, it recommends what to actually order — see SOLVER.md for the algorithm and
PRD.md for the product shape.

## Language

**Sulit**:
The app's default recommendation philosophy — the order that delivers the most actual food
value per peso spent, not the order that spends the least. This is the `maximum-food` solver
mode's objective (SOLVER.md §4) and the default ranking rule in "any chain" mode (SOLVER.md
§5). Established 2026-08-12 after a planning correction: earlier milestones had defaulted to
minimizing cost, which is a different (and, per product intent, wrong) default. See
[docs/adr/0001-sulit-default-value-per-peso.md](docs/adr/0001-sulit-default-value-per-peso.md).
_Avoid_: best deal, cheapest, best value (too vague — "sulit" is the one true term for this app's
default philosophy, "cheapest" names a *different*, still-available mode: `feed-everyone`).

**Mura**:
"Cheap" — minimizing pesos spent, with no regard for how much food that buys. This is
*explicitly not* the app's default; it names what `feed-everyone` (cheapest way to fully cover
the group) and `cheapest-possible` (lowest spend, full stop) optimize for. Kept as valid,
explicit opt-in modes — a user who genuinely wants the floor price should still be able to ask
for it. The distinction between Sulit and Mura is the app's core identity question; conflating
them was the exact misunderstanding this term's definition exists to prevent.

**Value (servings)**:
`main_servings + carb_servings` delivered by an item, per unit purchased — the numerator Sulit
is measured against (denominator is the item's price). Deliberately excludes drinks, desserts,
and sides, which are recorded as 0 of both in the data model (DATA-MODEL.md) and therefore
score 0 value — Sulit is about real food substance, not padding. Not a subjective quality or
desirability score; see SOLVER.md §7's standing decision against adding one. Value is an
objective count derived from data already in the item schema, not a new taste model.
_Avoid_: desirability, quality score, points (these imply subjective judgment, which this
project has deliberately never modeled).

**barato**:
The app's proper name (always lowercase), replacing the working name "Tipid Hacks" — see
[docs/adr/0002-app-name-barato.md](docs/adr/0002-app-name-barato.md). Literally Bikol/Tagalog
for "cheap," which reads to most of the app's national, majority-Tagalog audience as the
**Mura** framing — in tension with the app's actual default identity, **Sulit**. Kept
anyway: in Bikol usage "barato" also carries a "sulit"/worth-it connotation, and the gap for
readers who take it literally is deliberately left to be closed by in-app language (the
Sulit/Mura mode labels), not by the name itself. This term names the *product*, not a solver
concept — don't use it as a synonym for Mura or Sulit in code or solver docs.

**Coverage**:
The requirement that every person in the group gets ≥1 main-equivalent serving and ≥1
carb-equivalent serving. Phase 1 of the solver (SOLVER.md §4) finds the minimum-cost way to
satisfy coverage; Sulit only ever operates on *leftover* budget after coverage is met.
