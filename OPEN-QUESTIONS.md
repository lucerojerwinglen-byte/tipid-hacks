# Open Questions — Tipid Hacks

**Status:** None of these block starting the build (Milestone 0 in ROADMAP.md needs none of
them resolved). Listed so they don't get silently forgotten.

---

## Data / legal verification still needed

- **Chowking's delivery-app ToS and Shakey's `/legal-terms` couldn't be machine-read** (both
  render via JavaScript) — no anti-scraping clause was found for any of the six chains in the
  text that *could* be read, but this is a "not found" not a confirmed "absent." **Resolves
  by:** one manual human read of each before that chain goes live in the pipeline
  (ROADMAP.md Milestone 4/5).
- **Dine-in vs. takeout price parity was assumed, not verified per chain.** Planning concluded
  PH fast-food chains don't split-price these at the counter, but this wasn't checked
  chain-by-chain. **Resolves by:** a quick check during Milestone 4/5 build, flagging any
  chain that turns out to be an exception.
- **Whether Jollibee or McDonald's PH corporate would grant legitimate API/data access if
  asked directly** was floated during planning as a low-cost, high-value long shot (one email,
  no downside) but never sent. **Resolves by:** Jerwin deciding whether to actually send it —
  doesn't block anything else either way.
- **Where to get real legal counsel** if the "push back and seek clarification" takedown
  posture (RISKS.md #6) ever actually gets tested. The brief itself asked for this and it
  wasn't answered concretely. **Resolves by:** identifying a specific low-cost/free resource
  (e.g. a PH IP-law legal aid clinic, a lawyer contact) before it's urgently needed, not after.

## Product/UX details not yet designed

- **Exact copy for the freshness indicator's two tones** (neutral vs. soft-warning past ~3-4
  weeks stale) — the mechanism is decided (PRD.md §4), the wording isn't. **Resolves by:** a
  short copywriting pass during Milestone 3.
- **Dietary filter tag taxonomy beyond "no pork / no beef / no spicy"** — real menu data may
  surface ambiguous cases (cross-contamination disclaimers, mixed-ingredient items).
  **Resolves by:** finalizing the tag list once real data is in hand (Milestone 2), not
  before.
- **Share-as-image exact visual design** — a should-have feature (PRD.md, ROADMAP.md
  Milestone 7) with no design work done yet. **Resolves by:** a design pass when that
  milestone starts.
- **Maximum realistic headcount `N` and what the UI does above it** — SOLVER.md notes no hard
  cap is enforced but suggests a UI warning above ~15; the exact threshold and warning copy
  aren't decided. **Resolves by:** picking a number during Milestone 1 once the input UI is
  actually being built.
- **How many "runner-up" chains to show in "any chain" mode, and at what cost-difference
  threshold a runner-up stops being worth showing** — the feature is decided (SOLVER.md §5),
  the display rule isn't. **Resolves by:** a UX decision during Milestone 2.
- **Whether `price_confidence` (verified / flagged / manual-override) is ever shown to end
  users, or stays purely internal to the pipeline/alerting flow** — the field exists in the
  schema (DATA-MODEL.md), its UI treatment doesn't. **Resolves by:** a decision during
  Milestone 3 or 7 — leaning toward "internal only, drives the alert path" is the simpler
  default until a reason to surface it appears.
- **Whether a combo should ever be visually deprioritized in results when a strictly cheaper
  component-only alternative exists at identical coverage** — currently the solver just picks
  whichever is cheaper with no special display treatment either way. **Resolves by:** waiting
  to see if this actually looks confusing in practice before adding any special-casing.

## Solver polish noticed while building Milestone 2

- **Phase 2 can suggest more of an item that's already at its coverage ceiling** — e.g. Mang
  Inasal's leftover-budget suggestions included "8× Unlimited Rice" even though 1 order
  already covers the whole group's carb requirement. Not a bug (each suggested quantity is
  correctly capped per `maxQtyFor(N)` per item — see SOLVER.md §4's regression note), just a
  low-value suggestion since additional unlimited-rice orders add nothing once one is already
  in the cart. **Resolves by:** phase 2 could deprioritize/exclude items whose relevant
  coverage dimension is already saturated by the phase-1 selection — worth doing only if real
  usage shows these suggestions read as confusing rather than just slightly wasteful.

## Modeling approximations flagged as worth revisiting

- **Shakey's pizza modeled as contributing to both `main_servings` and `carb_servings` per
  slice-equivalent** (DATA-MODEL.md §4) — a reasonable v1 approximation, not validated against
  real Shakey's data yet since that chain's prices weren't directly observable during
  planning. **Resolves by:** sanity-checking this once Milestone 5 pulls real Shakey's data
  through the pipeline.

## Process items with no owner yet

- **Quarterly manual check that the two third-party sources are still the best available
  option** (RISKS.md #2) was recommended but has no concrete reminder mechanism.
  **Resolves by:** Jerwin deciding whether to calendar this or just fold it into the monthly
  Jollibee/McDonald's price spot-check already planned (DATA-PIPELINE.md §6).
- **Whether a third-party source going fully unreachable (not just wrong-looking) is
  guaranteed to trigger the same GitHub-issue alert as a sanity-rule failure** — implied by
  "a fetch failure is itself a failure," but not explicitly built or tested.
  **Resolves by:** an explicit test case during Milestone 4 (point the fetcher at a dead URL,
  confirm an alert fires).
