# Data Pipeline — Tipid Hacks

**Status:** Sources verified for all six chains via live fetches during planning (Aug 2026).
**Core principle carried through every decision below:** silent auto-updating of bad data is
the worst possible failure mode. Wrong-but-confident is worse than stale-but-honest.

---

## 1. Per-chain sources

| Chain | Source | Method | Why |
|---|---|---|---|
| **Jollibee** | `jollibeemenuprice.net` (third-party) | Plain HTTP fetch | Jollibee's own ordering domain (`order.jollibee.com`) returned HTTP 403 with bot-protection signatures, requires login + store selection, and its path is not disallowed but is practically unreachable without circumventing bot protection — ruled out entirely during planning. The third-party site is a plain server-rendered WordPress page, prices embedded directly in HTML, robots.txt only blocks `/wp-admin/`, explicit "not affiliated with Jollibee" disclaimer, no anti-scraping clause, last updated Apr 2026. |
| **McDonald's PH** | `mcdomenuprices.com.ph` (third-party) | Plain HTTP fetch | McDonald's own ordering domain (`mcdelivery.com.ph`) is a JS SPA with its ordering path explicitly `Disallow`'d in robots.txt and gated behind login/store selection. The third-party site is the same shape as Jollibee's: plain HTML, prices embedded, open robots.txt, explicit non-affiliation disclaimer, last updated Jul 2026 (~3 weeks old at time of writing). |
| **Mang Inasal** | `manginasal.ph/news/menu-and-prices` (official) | Plain HTTP fetch | The standout case — a full price table in plain server-rendered HTML on the chain's own site. Open robots.txt (only blocks `/wp-admin/`). Caveat: it's a manually-curated marketing page, not a live per-branch feed, so treat it like any other source and run it through the same sanity checks. |
| **KFC PH** | `kfc.com.ph` (official) | Playwright (headless) | Most permissive robots.txt of the six official sites (`Allow: /` for everything), no bot-wall encountered, no anti-scraping ToS clause — but it's a JS single-page app, so prices aren't present in the raw HTML and require a rendered page (or captured XHR calls). |
| **Chowking** | `chowkingdelivery.com` (official) | Playwright (headless) | Delivery subdomain's robots.txt is fully open (`Allow: /`), no bot-wall hit — but JS-rendered, same as KFC. The general `chowking.ph` site's ToS was readable and had no anti-scraping clause; the delivery subdomain's own ToS page is itself JS-rendered and its exact text should get one manual human read before this chain goes live in the pipeline, to close that gap. |
| **Shakey's** | `shakeyspizza.ph` (official) | Playwright (headless) | Confirmed during planning that individual product pages do not server-render price data (empty shell, no price tokens in raw HTML) — needs the same headless treatment as KFC/Chowking. No `robots.txt` file exists at all for this domain (404), which is unusual for a commercial site and is treated as default-allow, not as a green light to skip a manual ToS read before launch. |

Every chain that has a live ordering/delivery flow ties real pricing to a store/branch or
delivery-address selection — none of them expose a single canonical "national" price list from
their live systems. The pipeline picks one representative reference (Metro Manila/NCR — see
DATA-MODEL.md) rather than attempting per-branch pricing.

**Before any chain goes live in the pipeline:** do one manual human read of that chain's
current ToS. The retrievable text found during planning contained no explicit anti-scraping
clause for any of the six, but two ToS pages (Chowking's delivery app, Shakey's `/legal-terms`)
render via JavaScript and their exact text could not be machine-verified — "not found" is being
reported here, not a confirmed "absent."

**Ruled out entirely, not just deprioritized:** attempting to bypass Jollibee's bot protection
to reach official pricing. That crosses from "scraping a public page" into "circumventing
access controls" — a materially worse legal position (potential Cybercrime Prevention Act
exposure in the PH, not just a ToS breach) and a losing technical bet (permanent arms race
against an anti-bot system) for a project that has to survive on near-zero maintenance effort.

---

## 2. Pipeline stages

```
1. Scheduled trigger — GitHub Actions, weekly cron (free tier)
2. Fetch — per §1's method per chain (plain fetch or Playwright)
3. Checksum gate — hash the raw fetched content; if unchanged since last run, stop here.
   No LLM call, no diff, no commit. Keeps git history meaningful and avoids pointless spend.
4. LLM parse — Gemini (`gemini-3.6-flash`) via structured output (JSON schema), enforcing a
   strict JSON schema (see DATA-MODEL.md). An LLM is used here specifically because it's
   resilient to layout redesigns in a way CSS-selector scraping isn't — the selector breaks,
   the LLM reading rendered content generally doesn't.
5. Validate — schema validation, plus the sanity rules in §3
6. Diff — against the previous committed version
7. Commit — the updated JSON to the repo if the diff passes validation.
   Nice property, free: git history is a permanent, zero-effort price archive.
8. Alert — GitHub issue opened automatically if any sanity rule fails, so nothing bad merges
   silently.
```

Manual-override files (one per chain) sit alongside the pipeline output and are never
overwritten by it. For Jollibee and McDonald's, this file is the fallback if the third-party
source ever goes dark or degrades — not the primary plan (the primary plan is §1's scrape).
For every chain, it's also where a validated "wrong price" user report (see PRD.md) gets
applied.

---

## 3. Sanity rules

- Reject any single item's price change greater than ~30% — flag for human review, don't
  auto-apply.
- Reject a run where the item count drops sharply — almost always means the page failed to
  load or render, not that the menu genuinely shrank.
- Reject obviously nonsensical values (e.g. ₱9 or ₱9,000 for a single item).
- Third-party sources (Jollibee, McDonald's) go through **the same rules**, not stricter
  ones — the validation layer's entire purpose is to not trust any single source blindly,
  which already covers the extra risk of a secondary source.
- Any rule failure blocks the commit and opens an alert (§2, step 8). It never silently
  applies the new value and it never silently keeps the old value without saying so.

---

## 4. Cost estimate

Originally built on Claude Sonnet 5 (pay-as-you-go), then switched to Gemini
(`gemini-3.6-flash`) via Google AI Studio's free tier — this is a personal side project, and
the free tier's rate limits (well above weekly, 6-chain, checksum-gated usage) comfortably
cover it.

**≈$0/month.** No billing account required; a Google AI Studio API key is free with no card
on file. If usage ever needs to exceed the free tier's daily quota, Gemini's paid tier is the
fallback — but at this project's scale (6 chains, weekly cadence, checksum-gated so unchanged
pages skip the LLM call entirely) that shouldn't happen.

This runs on a **free Google AI Studio API key** (aistudio.google.com/apikey) — separate from
any other Google account billing.

---

## 5. Infrastructure feasibility

Verified via research during planning: GitHub Actions public repos get effectively unlimited
minutes on standard runners (4 vCPU / 16GB), and Playwright is comfortably feasible within
that — browser install is well under two minutes, and a full weekly run across all six chains
(three via Playwright, three via plain fetch) should complete in low single-digit minutes
total.

---

## 6. Maintenance reality for Jerwin (this is the part that matters most)

This project's own risk register names "pipeline becomes a chore" as the specific
abandonment risk Jerwin identified during planning. Two categories of ongoing human labor
exist by design, and they are intentionally different in kind:

- **Planned, bounded, low-frequency:** a monthly spot-check of the two third-party sites
  (Jollibee, McDonald's) to make sure they're still accurate and still up. Fast-food chains
  don't reprice weekly in practice — most months, this is "open two pages, see nothing
  changed, done in five minutes."
- **Unplanned, in principle unbounded:** a scraper breaking because a chain redesigned its
  site, changed its API shape, or added new bot protection. This is the actual chore risk, and
  it's mitigated by (a) the LLM-based parsing being redesign-resilient by design, (b) the
  checksum gate meaning most weeks do nothing at all, and (c) the manual-override file meaning
  a single broken chain degrades to "one chain shows stale/overridden data" rather than
  blocking the whole pipeline or the whole app.

If a chain becomes unmaintainable in practice, the manual-override file is the release valve —
it was designed as a scraping fallback, but it works equally well as a "give up on this one
source and hand-maintain it occasionally" fallback without touching the rest of the system.
