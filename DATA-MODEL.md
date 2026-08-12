# Data Model — barato

**Status:** Finalized schema, refined from the brief's original sketch during planning.

---

## 1. Schema

```
Chain
  id                # e.g. "jollibee"
  name              # e.g. "Jollibee"
  source_url        # the URL actually fetched by the pipeline
  source_type       # "official" | "third-party-aggregator"
  last_updated      # ISO date of the last successful pipeline run that changed this chain
  notes             # free text, e.g. "NCR reference pricing; branch prices may vary"

Item
  id
  chain_id
  name
  category          # main | rice | side | drink | dessert | combo
  price              # pesos, integer
  serves             # fractional; derived (see §2), default 1
  main_servings      # contribution to the "main" coverage requirement per unit purchased
  carb_servings      # contribution to the "carb/rice" coverage requirement per unit purchased
  shareable          # bool
  is_combo           # bool
  combo_contents     # [{ item_id, qty }], present only if is_combo
  tags               # e.g. ["chicken", "spicy"] — drives dietary filters
  available          # bool — false for an LTO that has rotated out
  price_confidence   # "verified" | "flagged" | "manual-override" — set by the pipeline (see DATA-PIPELINE.md §3)
```

Two fields were added to the brief's original sketch during planning: `source_type` (so a
third-party-sourced chain is honestly distinguishable in the data itself, not just in this
document) and the split of a single implicit "serves" concept into `serves` (a display/
labeling number) plus `main_servings`/`carb_servings` (the actual values the solver consumes —
see SOLVER.md §3 for why main and carb needed separate per-item contribution values rather
than one shared `serves` count).

---

## 2. `serves` is derived, not hand-maintained

This was resolved specifically because it collided with the single biggest risk to the
project's survival — Jerwin identified "pipeline becomes a chore" as his abandonment trigger,
and a hand-maintained per-item field for every shareable item across six chains, forever, is
exactly that kind of chore.

- The LLM extraction step (already part of the pipeline for every chain) parses any stated
  piece/unit count directly from the item name or description — "6-pc Chickenjoy Bucket" →
  `serves: 6`, `main_servings: 6`.
- Regular single-serve items default to `serves: 1` with no extraction step needed.
- The manual-override file (already planned as a scraping fallback — see DATA-PIPELINE.md)
  doubles as the safety valve for the rare genuinely ambiguous item, such as a pizza box
  labeled "serves 4" as a marketing claim rather than a countable unit. This is expected to be
  a one-time fix per ambiguous item, not a recurring task.

---

## 3. Combo decomposition (the core requirement)

A combo is never an opaque priced product. `combo_contents` lists its components with
quantities, e.g. a "Chickenjoy Combo" might decompose as
`[{item_id: "chickenjoy-1pc", qty: 1}, {item_id: "rice", qty: 1}, {item_id: "drink-reg", qty: 1}]`.

**Combos remain purchasable as their own item** in the solver's candidate pool — with their
own listed price and `main_servings`/`carb_servings` derived by summing their components'
contributions. This matters: it means the solver isn't forced to always prefer buying
components separately. A combo is chosen when it's genuinely the cheaper or only path to a
given serving (e.g. a heavily-promoted bundle can legitimately undercut buying the same pieces
individually) — the solver just now has *both* options in the same pool and picks whichever is
actually cheaper, which is the entire point of the product.

### Savings comparison

The "you saved ₱X" headline (PRD.md §4) is computed by comparing the solver's actual answer
against a **naive baseline**: what an uninformed shopper would obviously order for themselves,
multiplied by `N`. This is deliberately *not* `dp[1][1] × N` (the mathematically optimal
single-person answer) — that number already finds the same ala-carte trick even at N=1, which
would make the reported savings read as ~₱0 for exactly the scenario the app exists to catch.
Instead: prefer the cheapest **non-shareable** combo that alone covers one person (since
that's what chains actually market as "the" meal), falling back to the cheapest single-item
full-coverage option only for a chain with no such combo (e.g. a pure ala-carte +
unlimited-rice menu, where the "trap" being demonstrated is the bucket/singles crossover
instead — see §5's worked example). Shareable items are excluded even when they're technically
the cheapest "combo" on the menu — a 6-person Family Fiesta isn't what one uninformed person
orders for themselves.

This definition was corrected twice while actually building it, both times by the same
mechanism (implement against real data, watch it produce an obviously-wrong number, fix the
rule) — first while building Milestone 0 (the original `dp[1][1]`-based definition failed to
reproduce the brief's own ₱44 example), then again while building Milestone 2's Mang Inasal
dataset (the un-excluded shareable Family Fiesta would have baselined against "buying N family
buckets"). Both are exactly what those milestones exist to catch.

---

## 4. Special-case modeling

- **Unlimited rice (Mang Inasal):** modeled as a near-zero-price item with `carb_servings` set
  to a large constant (≥ 10, i.e. ≥ the practical headcount cap) so the solver satisfies the
  carb requirement for the whole group at negligible cost — matching how unlimited rice
  actually works at the counter.
- **Pizza (Shakey's):** a slice-equivalent contributes to **both** `main_servings` and
  `carb_servings`, since pizza functions as a complete food unit rather than pairing a main
  with a separate rice/carb side the way most of the other five chains' menus do. Flagged in
  OPEN-QUESTIONS.md as worth revisiting once real Shakey's data confirms slice-per-box counts.
- **Regional/zone pricing:** a single canonical NCR reference price per item, stated plainly
  in the UI ("prices shown are Metro Manila reference prices and may vary by branch"). No
  multi-zone dataset in v1 — every chain that has a live ordering flow ties real pricing to a
  store/branch selection anyway (see DATA-PIPELINE.md §1), so a single declared reference point
  is more honest than implying a precision the source data doesn't actually have.
- **LTOs:** no dedicated mechanism — the existing `available` boolean handles it. An LTO that
  disappears between weekly pipeline runs flips to `available: false` on the next run; git
  history preserves the historical record for free.

---

## 5. Worked example — Mang Inasal (real data, fetched during planning research)

Confirmed live on `manginasal.ph/news/menu-and-prices` at planning time — subject to normal
price drift by the time the pipeline actually runs, shown here to validate the schema against
real content, not as a pricing guarantee:

```json
{
  "chain": {
    "id": "mang-inasal",
    "name": "Mang Inasal",
    "source_url": "https://www.manginasal.ph/news/menu-and-prices",
    "source_type": "official",
    "last_updated": "2026-08-11",
    "notes": "NCR reference pricing; unlimited rice modeled as near-zero-price high-carb_servings item"
  },
  "items": [
    {
      "id": "mi-chicken-inasal-paa-large-1rice",
      "name": "Chicken Inasal Paa (Large), 1 Rice",
      "category": "main",
      "price": 135,
      "serves": 1,
      "main_servings": 1,
      "carb_servings": 1,
      "shareable": false,
      "is_combo": false,
      "tags": ["chicken"],
      "available": true,
      "price_confidence": "verified"
    },
    {
      "id": "mi-unlimited-rice",
      "name": "Unlimited Rice (per order)",
      "category": "rice",
      "price": 5,
      "serves": 10,
      "main_servings": 0,
      "carb_servings": 10,
      "shareable": true,
      "is_combo": false,
      "tags": [],
      "available": true,
      "price_confidence": "manual-override",
      "_comment": "Nominal price; models the real-world 'unlimited' rice add-on so the carb constraint is satisfied cheaply, per §4"
    },
    {
      "id": "mi-pork-bbq-1pc-ala-carte",
      "name": "Pork BBQ, 1pc (Ala Carte)",
      "category": "main",
      "price": 50,
      "serves": 1,
      "main_servings": 1,
      "carb_servings": 0,
      "shareable": false,
      "is_combo": false,
      "tags": ["pork"],
      "available": true,
      "price_confidence": "verified"
    },
    {
      "id": "mi-family-fiesta",
      "name": "Family Fiesta",
      "category": "combo",
      "price": 895,
      "serves": 6,
      "main_servings": 6,
      "carb_servings": 6,
      "shareable": true,
      "is_combo": true,
      "combo_contents": [
        { "item_id": "mi-chicken-inasal-paa-large-1rice", "qty": 6 }
      ],
      "tags": ["chicken"],
      "available": true,
      "price_confidence": "verified",
      "_comment": "main_servings/carb_servings derived by summing the decomposed contents' contributions x qty"
    }
  ]
}
```

---

## 6. Worked example — Jollibee (illustrative, matches the brief's own example)

Prices below are **illustrative placeholders** matching the brief's own worked example
(PRD.md §1), not verified live prices — the real values come from the pipeline's actual
Jollibee run against `jollibeemenuprice.net` (see DATA-PIPELINE.md §1). Shown to validate
combo decomposition and the savings calculation against the schema:

```json
{
  "chain": {
    "id": "jollibee",
    "name": "Jollibee",
    "source_url": "https://jollibeemenuprice.net/",
    "source_type": "third-party-aggregator",
    "last_updated": "2026-08-11",
    "notes": "Sourced from an unaffiliated third-party price listing, not Jollibee's own site (see DATA-PIPELINE.md §1 for why)"
  },
  "items": [
    {
      "id": "jb-chickenjoy-1pc-rice",
      "name": "Chickenjoy 1pc with Rice (Ala Carte)",
      "category": "main",
      "price": 69,
      "serves": 1,
      "main_servings": 1,
      "carb_servings": 1,
      "shareable": false,
      "is_combo": false,
      "tags": ["chicken"],
      "available": true,
      "price_confidence": "verified"
    },
    {
      "id": "jb-chickenjoy-combo",
      "name": "Chickenjoy 1pc Combo (with drink)",
      "category": "combo",
      "price": 80,
      "serves": 1,
      "main_servings": 1,
      "carb_servings": 1,
      "shareable": false,
      "is_combo": true,
      "combo_contents": [
        { "item_id": "jb-chickenjoy-1pc-rice", "qty": 1 },
        { "item_id": "jb-drink-reg", "qty": 1 }
      ],
      "tags": ["chicken"],
      "available": true,
      "price_confidence": "verified"
    },
    {
      "id": "jb-drink-reg",
      "name": "Drink (Regular)",
      "category": "drink",
      "price": 39,
      "serves": 1,
      "main_servings": 0,
      "carb_servings": 0,
      "shareable": false,
      "is_combo": false,
      "tags": [],
      "available": true,
      "price_confidence": "verified"
    }
  ]
}
```

For ₱300 / 4 people: naive baseline = 4 × `jb-chickenjoy-combo` (₱80) = ₱320 — this is what an
uninformed shopper orders (a combo is the cheapest item here that alone covers one person, so
§3's rule picks it automatically). The solver instead finds 4 × `jb-chickenjoy-1pc-rice`
(₱69) = ₱276, fits the ₱300 budget with ₱24 left over, and reports **₱44 saved** — reproducing
the brief's own worked example (PRD.md §2) exactly. This combo price (₱80) was deliberately
chosen to match that example precisely: ₱69 ala carte vs ₱80 combo is the size of "cost of a
drink you didn't need to hit the coverage requirement," which is the actual mechanism behind
the savings, not a hardcoded "combos are bad" rule.

---

## 7. Open modeling questions resolved during planning

The three questions the original brief posed in this section (unlimited rice, LTOs expiring
mid-week, regional variance without multiplying the dataset) are all resolved above in §4.
