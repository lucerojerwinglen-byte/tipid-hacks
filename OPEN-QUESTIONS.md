# Open Questions — barato

**Status:** None of these block starting the build (Milestone 0 in ROADMAP.md needs none of
them resolved). Listed so they don't get silently forgotten.

---

## Data / legal verification still needed

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

## Process items with no owner yet

- **Quarterly manual check that the two third-party sources are still the best available
  option** (RISKS.md #2) was recommended but has no concrete reminder mechanism.
  **Resolves by:** Jerwin deciding whether to calendar this or just fold it into the monthly
  Jollibee/McDonald's price spot-check already planned (DATA-PIPELINE.md §6).

## Resolved

- **Shakey's pizza dual-contribution modeling, validated against real data — 2026-08-13.**
  `src/data/shakeys.ts` was hand-verified against the live site (real Crust/Size pricing, not
  Milestone-2 placeholders), and the pizza items still model each slice-equivalent as
  contributing to both `main_servings` and `carb_servings` (DATA-MODEL.md §4) — confirmed sane
  against real prices/sizing, with a dedicated regression test
  (`src/chains.test.ts`, "a pizza slice satisfies both main and carb from a single purchase").
  The v1 approximation holds up; no modeling change needed.
- **Chowking delivery-app ToS and Shakey's `/legal-terms` — read 2026-08-12.** Chowking:
  `chowking.ph/terms-and-conditions` turned out to *be* the delivery/app ToS (its own title is
  "TERMS AND CONDITIONS FOR THE CHOWKING DELIVERY WEBSITE AND APP," explicitly covering
  `chowkingdelivery.com`, the App, and both Delivery and Pick-Up) and is plain server-rendered
  HTML — no separate JS-rendered page needed reading after all. Shakey's `/legal-terms` is a
  client-rendered Next.js shell (empty in raw HTML) but its full text was retrieved by
  rendering the page with Playwright (already a project dependency for Milestone 5) and
  clicking through to the "Terms and Conditions" tab. **Neither ToS contains any clause
  addressing scraping, crawlers, bots, automated access, or data mining** — see
  DATA-PIPELINE.md §1 for the updated per-chain notes.
- **Dine-in vs. takeout price parity — checked 2026-08-12** across all six chains' public
  pages (the three Milestone 4 source pages plus a quick look at KFC/Chowking/Shakey's own
  sites ahead of Milestone 5). No chain shows a separate dine-in vs. takeout price anywhere.
  Mang Inasal's own official price table is the clearest confirmation — its price column
  header is literally "DINE-IN / TAKEOUT" as one combined price, not two. No exception found;
  the planning assumption holds.
- **Fetch failure → alert path — test added 2026-08-12** (`scripts/pipeline/fetch.test.ts`).
  The actual GitHub-issue alert is still Milestone 6 (GitHub Actions doesn't exist yet in this
  repo) — what's confirmed now is the signal that alert will hook into: `fetchRaw` throws on
  both a fully unreachable host and a non-OK HTTP response, and that throw propagates
  unhandled out of `runChain` exactly like a `validate.ts` sanity-rule failure does, so
  `scripts/run-pipeline.ts`'s per-chain `try/catch` records both as status `"blocked"` and
  exits non-zero. A dead source and a bad-data source are indistinguishable to anything
  watching the process exit code — which is what Milestone 6's alert step will watch.
