# Roadmap — barato

**Status:** Sized against Jerwin's stated time budget (10+ hrs/week — can absorb bigger
milestones without stalling). Ordered so the riskiest, most novel part (the solver) is proven
before any time is spent on plumbing (pipeline, hosting, polish) that only matters if the core
idea actually works.

---

## Milestone 0 — Smallest thing that proves this works

**Goal:** confirm the actual intellectual property (the solver) does what the brief claims it
will, before building anything else around it.

- Hand-type ~20-30 real Jollibee items (including at least one combo and its decomposed
  components) into a small JSON file — no pipeline, no UI.
- Implement the Phase 1/Phase 2 DP from SOLVER.md as a standalone TypeScript function, run
  from a script or test file, no React yet.
- Reproduce the brief's own worked example: ₱300, 4 people → confirm the solver finds the
  à la carte combination over 4 combo meals and reports a savings figure.
- Add 2-3 more scenarios by hand: an infeasible case (tiny budget, big headcount), a tie case,
  a shareable-bucket case.

**Done when:** the brief's own example output is reproduced correctly from real (hand-entered)
menu data, plus SOLVER.md's test-case table (§8) passes for the cases above. This is the
"prove it" milestone — if the solver doesn't feel right here, nothing downstream matters yet.

## Milestone 1 — Minimal end-to-end UI, one chain

**Goal:** the full user-facing loop works, still on hand-entered data.

- Vite + React + TypeScript scaffold per ARCHITECTURE.md.
- Budget + headcount input, solver wired in, results rendered with itemized quantities, total,
  and the savings comparison.
- Solver mode toggle (feed-everyone / maximum-food / cheapest-possible).
- No PWA features yet, no other chains yet — this milestone is about the interaction loop,
  not robustness.

**Done when:** a real person (Jerwin) can use the deployed-locally app on their own phone,
type in a real scenario, and trust the answer.

## Milestone 2 — All six chains, still hand-entered data

**Goal:** validate the data model and solver generalize across chains before automating
data collection.

- Hand-enter a representative item set (not the full menu) for the remaining five chains,
  deliberately including the two special cases from DATA-MODEL.md §4: Mang Inasal's unlimited
  rice and Shakey's pizza dual-contribution modeling.
- "Any chain" mode: solve per chain, surface the winner + runners-up.
- Dietary filter tags (no pork / no beef / no spicy) — the tag system, not a full flavor
  taxonomy.

**Done when:** all six chains produce sane answers, and the two special-case items behave as
designed rather than as bugs.

## Milestone 3 — PWA-ify

**Goal:** meet the non-functional requirements that matter for the actual target device.

- `vite-plugin-pwa` setup, manifest, installability.
- IndexedDB via `idb-keyval` for cached price data; network-first / stale-while-revalidate
  service worker strategy (ARCHITECTURE.md §3).
- Freshness indicator (low-key chip, tone shift past ~3-4 weeks stale — PRD.md §4).
- Bundle-size check against the ~200KB gzipped budget; trim before this milestone is "done,"
  not after.
- In-app-browser detection banner (the Messenger/Facebook/TikTok "Add to Home Screen" gap from
  RISKS.md #7).

**Done when:** the app installs on an actual low-end Android phone, works with airplane mode
on after first load, and passes a rough Lighthouse/3G-throttled check.

## Milestone 4 — Real data pipeline, easy sources first

**Goal:** replace hand-entered data for the three chains that don't need a headless browser —
smallest pipeline lift, proves the fetch → parse → validate → commit loop end-to-end.

- Mang Inasal (official, plain fetch), Jollibee and McDonald's (third-party sources, plain
  fetch) — see DATA-PIPELINE.md §1.
- Checksum gate, extraction, the three sanity rules, diff-before-commit, manual-override file
  mechanism, `source_type`/`price_confidence` fields wired through to the data model. Originally
  built on Groq structured extraction (an LLM parse step); **2026-08-13 correction:** replaced
  with deterministic per-chain parsers (`scripts/pipeline/parsers/`) — see the Milestone 5
  write-up below for why.
- Run manually first (not yet on a schedule) to build confidence in the output before
  automating the trigger.

**Done when:** running the pipeline by hand produces a correctly-validated JSON commit for all
three chains, and a deliberately-broken test run (e.g. malformed fetch) gets caught and
blocked, not silently merged.

## Milestone 5 — Remaining sources (Playwright-based)

**Goal:** KFC, Chowking, Shakey's — the three needing headless-browser rendering.

- Playwright wired into the same pipeline shape as Milestone 4.
- Confirm feasibility inside GitHub Actions (DATA-PIPELINE.md §5) with a real CI run, not just
  local testing.

**Status: all three deferred to hand-maintained data. Milestone closed on that basis.** Building
this for real (not just against the planning-time assumptions) surfaced corrections for all
three chains, all captured in DATA-PIPELINE.md §1:

- **KFC**'s homepage doesn't carry prices at all — the real fetch target is `/en/menu`. Fetch
  itself worked fine, but KFC's real (~280-item) menu needs 9 LLM-extraction chunks, and Groq's
  free-tier 8,000 TPM budget turns that into 20-50+ minute rate-limit waits per chunk — both
  locally and in a real Actions run (2026-08-12/13, cancelled after over an hour still mid-run).
  Along the way this surfaced and fixed two latent bugs in the LLM extraction step itself: Groq's
  TPM rate limit can reject a request outright (HTTP 413) rather than only 429 after acceptance,
  and a fixed chunk-size limit tuned against Milestone 4's sparser pages let too many items land
  in one chunk, overflowing the completion-token budget. Moot now — see the 2026-08-13 correction
  below, which removed the LLM-extraction step (and both its bugs) from the pipeline entirely.
- **Shakey's** has no single "all items" page that renders; its catalog is 11 separate category
  pages. Wiring `fetch_urls`/`fetchRenderedMulti` to fetch and join them worked, but it hit the
  same Groq rate-limiting as KFC before a real run ever finished, and investigating that
  surfaced a second, independent blocker: each category page paginates behind a "LOAD MORE
  PRODUCTS" button and only shows a single "Starts at ₱X" price, with real size/variant pricing
  behind a picker not present in the rendered page content. `src/data/shakeys.ts` no longer
  holds the Milestone-2 placeholder prices — hand-verified against the live site 2026-08-13
  (clicking through all 11 categories' "Load More" and each item's Crust/Size picker) and
  re-typed with real prices, sizing, and combos.
- **Chowking**'s pricing lives behind a Cloudflare-gated JSON API that a real headless-browser
  session only triggers inconsistently and that direct calls get 403'd on — the same shape as
  Jollibee's already-ruled-out official domain, and ruled out for the same reason (§1).

All three stay on hand-maintained data (`src/data/{kfc,shakeys,chowking}.ts`) rather than
becoming a maintenance trap or, in Chowking's case, a bot-protection arms race — the manual-
override mechanism's designed fallback role (DATA-PIPELINE.md §2).

**2026-08-13 correction — the LLM step is gone entirely, not just for KFC/Shakey's.** The three
chains still on the automated pipeline (Jollibee, McDonald's, Mang Inasal) are plain HTTP
fetches with simple, stable page structure (a card grid + fallback `<table>` for Jollibee, a
sequential heading/price pairing for McDonald's, a single well-formed price table with rowspan'd
categories for Mang Inasal) — no headless browser, no dense multi-thousand-item catalog. That
made them a good fit for a hand-written deterministic parser per chain
(`scripts/pipeline/parsers/`) instead of the Groq LLM-extraction step, removing the rate-limit
dependency (and the `GROQ_API_KEY` requirement) from the pipeline altogether — $0/month, no
account, no quota to run into. Bonus: writing Mang Inasal's parser as an actual table walker
fixed a real bug the old LLM extraction had, where it lost the table's rowspan'd Category column
and produced bare, indistinguishable item names ("Solo", "Value Meal") for the Palabok section.
The tradeoff is real, not free: a deterministic parser breaks on a genuine site redesign in a way
the old LLM step wouldn't have — acceptable here because the parse step's own validation still
blocks a run that comes back empty or wildly wrong, same safety net as before (DATA-PIPELINE.md
§2 step 4).

**Done.** The three remaining wired chains (Jollibee, McDonald's, Mang Inasal) are confirmed
running cleanly through a real GitHub Actions run (`.github/workflows/pipeline.yml`,
`workflow_dispatch`) using the new deterministic parsers, no `GROQ_API_KEY` secret needed at all
— confirmed locally 2026-08-13 (clean parse + write for all three; Jollibee and Mang Inasal both
picked up real, expected diffs from the parser rewrite, McDonald's had none), then confirmed in
CI the same day: run 31681894928 completed in 22 seconds, a stark contrast to the previous
Groq-based runs that stalled 20+ minutes to 2+ hours before being cancelled. KFC, Shakey's, and
Chowking are explicitly out of scope for automation — see DATA-PIPELINE.md §1/§6 — so "all six
chains automated" was never this milestone's real bar; three automated plus three consciously
hand-maintained is.

## Milestone 6 — Automation and alerting

**Goal:** the pipeline runs unattended, which is the entire point of the project.

- GitHub Actions weekly cron.
- Automatic GitHub issue on any sanity-rule failure (DATA-PIPELINE.md §2, §3).
- One full unattended week, watched but not touched, to confirm the whole loop — including the
  "nothing changed, do nothing" checksum-gate path — behaves as designed.

**Done when:** a full week passes with no manual intervention required, and Jerwin trusts the
alert path enough to stop checking it daily.

## Milestone 7 — Trust and polish features

**Goal:** the should-have features that build user trust and virality, now that the
foundation is solid.

- One-tap "wrong price" report (PRD.md §4) — for Jollibee/McDonald's, this is also the primary
  correction channel given the third-party source.
- Share result as an image.
- Tagalog / English toggle.

**Done when:** all should-have features from PRD.md §4 are live.

## Milestone 8 — Open-source launch

**Goal:** ship it to the distribution channels chosen during planning.

- MIT license, README, repo cleanup for public consumption.
- The prepared takedown-response draft (RISKS.md #6) written and saved *before* launch, not
  after.
- Post to r/Philippines, r/phinvest, relevant Facebook budget/frugal-living groups.

**Done when:** the repo is public, and the first post is live in at least one target
community.

---

## Sizing note

No calendar dates are attached deliberately — Jerwin's own time budget (10+ hrs/week) is
irregular in practice for most solo projects even when the weekly average holds, and
milestone-based tracking survives a skipped week better than a date-based one does. Milestone
0 through 3 (prove the solver, then wrap a UI and PWA shell around it) can reasonably happen
before any pipeline code exists at all — this is intentional, not a corner being cut: it means
the riskiest, least-proven part of the project gets validated first, on the smallest possible
amount of hand-entered data.
