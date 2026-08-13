# Data Pipeline — barato

**Status:** Sources verified for all six chains via live fetches during planning (Aug 2026).
Milestone 5 (ROADMAP.md) then wired and hand-tested KFC and Shakey's for real, and that testing
corrected two of this document's planning-time assumptions — see the KFC/Shakey's/Chowking rows
in §1 for what actually shipped vs. what was originally assumed. It also surfaced a third
correction: KFC's and Shakey's real menus are dense enough that the LLM-extraction step this
pipeline originally used (Groq, `openai/gpt-oss-120b`) reliably stalled on Groq's free-tier rate
limit for 20-50+ minutes per chunk, both locally and in a real GitHub Actions run
(2026-08-12/13). Both moved to hand-maintained data (`src/data/{kfc,shakeys}.ts`), joining
Chowking. With the LLM step now gone entirely (see §2 step 4), Jollibee, McDonald's, and Mang
Inasal moved to deterministic per-chain parsers (`scripts/pipeline/parsers/`) instead — three of
six chains are hand-maintained, three run through the automated pipeline, and none of it depends
on an LLM or an API key anymore.
**Core principle carried through every decision below:** silent auto-updating of bad data is
the worst possible failure mode. Wrong-but-confident is worse than stale-but-honest.

---

## 1. Per-chain sources

| Chain | Source | Method | Why |
|---|---|---|---|
| **Jollibee** | `jollibeemenuprice.net` (third-party) | Plain HTTP fetch, deterministic parser (`scripts/pipeline/parsers/jollibee.ts`) | Jollibee's own ordering domain (`order.jollibee.com`) returned HTTP 403 with bot-protection signatures, requires login + store selection, and its path is not disallowed but is practically unreachable without circumventing bot protection — ruled out entirely during planning. The third-party site is a plain server-rendered WordPress page, prices embedded directly in HTML, robots.txt only blocks `/wp-admin/`, explicit "not affiliated with Jollibee" disclaimer, no anti-scraping clause, last updated Apr 2026. **Milestone 5 correction:** originally parsed via Groq LLM extraction; moved to a deterministic parser (§2 step 4) that walks every `<table>` on the page — the site renders each menu section as both a decorative card grid and a plain `<tr><td>name</td><td>price</td></tr>` table, and the tables alone cover every section (including one, "Family Pack" bundles, that only exists as a table). |
| **McDonald's PH** | `mcdomenuprices.com.ph` (third-party) | Plain HTTP fetch, deterministic parser (`scripts/pipeline/parsers/mcdonalds.ts`) | McDonald's own ordering domain (`mcdelivery.com.ph`) is a JS SPA with its ordering path explicitly `Disallow`'d in robots.txt and gated behind login/store selection. The third-party site is the same shape as Jollibee's: plain HTML, prices embedded, open robots.txt, explicit non-affiliation disclaimer, last updated Jul 2026 (~3 weeks old at time of writing). **Milestone 5 correction:** same LLM-to-deterministic-parser move as Jollibee; this site has no menu `<table>`, so the parser pairs each Kadence heading paragraph with the price paragraph immediately following it in document order. |
| **Mang Inasal** | `manginasal.ph/news/menu-and-prices` (official) | Plain HTTP fetch, deterministic parser (`scripts/pipeline/parsers/mang-inasal.ts`) | The standout case — a full price table in plain server-rendered HTML on the chain's own site. Open robots.txt (only blocks `/wp-admin/`). Caveat: it's a manually-curated marketing page, not a live per-branch feed, so treat it like any other source and run it through the same sanity checks. **Milestone 5 correction:** moved from LLM extraction to a parser that walks the table directly, tracking its rowspan'd Category column — this actually fixed a real bug the LLM extraction had, where it lost that rowspan context and produced bare, indistinguishable item names ("Solo", "Value Meal") for the Palabok section. |
| **KFC PH** | `kfc.com.ph/en/menu` (official) | **Deferred — hand-maintained** (`src/data/kfc.ts`) | Most permissive robots.txt of the six official sites (`Allow: /` for everything), no bot-wall encountered, no anti-scraping ToS clause — fetch access was never the problem. **Milestone 5 correction:** the homepage (`kfc.com.ph/`) is a bare landing shell with no prices; "OUR MENU" resolves client-side to `/en/menu`, the page that actually renders the priced catalog. Playwright fetch worked fine once pointed there — but KFC's real menu (~280 items) is dense enough that the LLM-extraction step (§4) needs 9 chunks, and Groq's free-tier 8,000 TPM budget turns that into 20-50+ minute rate-limit waits per chunk, both locally and in a real Actions run (2026-08-12/13, cancelled after over an hour still mid-run). Moved to hand-maintained data rather than pay for a higher Groq tier for one chain; prices verified directly against the live site 2026-08-13 (matched what the one completed pipeline run had already captured, no changes). |
| **Chowking** | `chowkingdelivery.com` (official) | **Deferred — hand-maintained** (`src/data/chowking.ts`) | **Milestone 5 correction, supersedes the planning-time assessment below.** The page shell itself loads fine (no bot-wall on the HTML), but its price data comes from a separate JSON API (`api.chowkingdelivery.com/mobilem8-menu-service/.../v2/menu`) that sits behind Cloudflare: calling it directly (or via Playwright's own request context, which isn't routed through the real browser network stack) returns an HTTP 403 Cloudflare challenge page, and even a full headless-browser session only triggers that call inconsistently — clicking through "Start New Order" repeatedly produced a blank `/menu` route with no further API activity. This is the same shape as Jollibee's ruled-out official domain (§1, "Ruled out entirely" below): routing around Cloudflare would cross from scraping a public page into circumventing access controls, which this project has already decided against for exactly this reason. Chowking stays on hand-maintained data (the manual-override mechanism's designed fallback role, §2) until/unless a legitimate public API surface turns up. |
| **Shakey's** | `shakeyspizza.ph/catalog/categories/<id>` ×11 (official) | **Deferred — hand-maintained** (`src/data/shakeys.ts`) | No `robots.txt` file exists at all for this domain (404), treated as default-allow; ToS confirmed 2026-08-12 (`/legal-terms`, rendered via Playwright) with no anti-scraping clause — fetch access was never the problem here either. **Milestone 5 correction:** planning assumed one JS-rendered page per chain, but Shakey's `/catalog/categories/all` — the obvious "everything" URL — never actually renders any products; it's permanently just the category-nav shell. Each individual category page (`/catalog/categories/3` for Pizza, etc.) *does* render its items directly, and the pipeline was wired to fetch all 11 in one shared headless-browser session (`fetch_urls`, `fetchRenderedMulti` in scripts/pipeline/fetch.ts) — but two problems surfaced before it ever finished a real run: the same Groq rate-limiting as KFC, and — discovered 2026-08-13 while investigating that — each category page paginates behind a "LOAD MORE PRODUCTS" button and only exposes a single "Starts at ₱X" price per item, with actual size/variant pricing behind a picker that isn't in the static rendered content. Moved to hand-maintained; `src/data/shakeys.ts` still holds the original Milestone-2 placeholder prices and needs a manual pass (clicking through all 11 categories' "Load More" and each item's size picker) before it can be marked verified. |

Every chain that has a live ordering/delivery flow ties real pricing to a store/branch or
delivery-address selection — none of them expose a single canonical "national" price list from
their live systems. The pipeline picks one representative reference (Metro Manila/NCR — see
DATA-MODEL.md) rather than attempting per-branch pricing.

**Before any chain goes live in the pipeline:** do one manual human read of that chain's
current ToS. Done for all six as of 2026-08-12 — no explicit anti-scraping clause found in any
of them. The two pages that render via JavaScript (Chowking's delivery ToS — which turned out
to live at the plain-HTML `chowking.ph/terms-and-conditions` after all — and Shakey's
`/legal-terms`, read by rendering it with Playwright) needed more than a plain fetch to verify,
but both have now actually been read, not just "not found."

**Ruled out entirely, not just deprioritized:** attempting to bypass Jollibee's bot protection
to reach official pricing, and — discovered during Milestone 5 — the same call for Chowking's
Cloudflare-gated menu API. Both cross from "scraping a public page" into "circumventing access
controls" — a materially worse legal position (potential Cybercrime Prevention Act exposure in
the PH, not just a ToS breach) and a losing technical bet (permanent arms race against an
anti-bot system) for a project that has to survive on near-zero maintenance effort.

---

## 2. Pipeline stages

```
1. Scheduled trigger — GitHub Actions, weekly cron (free tier)
2. Fetch — per §1's method per chain (plain fetch or Playwright)
3. Checksum gate — hash the raw fetched content; if unchanged since last run, stop here.
   No LLM call, no diff, no commit. Keeps git history meaningful and avoids pointless spend.
4. Parse — deterministic, per-chain (`scripts/pipeline/parsers/`), producing the same shape
   DATA-MODEL.md defines. Originally an LLM-extraction step (Groq, `openai/gpt-oss-120b`),
   chosen for being resilient to layout redesigns in a way CSS-selector scraping isn't — but
   Groq's free-tier rate limits made KFC/Shakey's reliably stall for 20-50+ minutes per chunk
   (§1), and even on the three lighter chains it left every run dependent on a third-party API
   key and quota. Replaced with a hand-written parser per chain: more fragile to a genuine site
   redesign (a selector breaks; an LLM reading rendered content usually doesn't), but zero cost,
   zero rate limits, and — in Mang Inasal's case — actually more accurate than the LLM's own
   output (§1). If a chain's markup changes enough to break its parser, that surfaces as a hard
   parse error/empty extraction, which stage 5's validation blocks on rather than committing
   silently wrong data.
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

Originally built on Claude Sonnet 5 (pay-as-you-go), briefly switched to Gemini
(`gemini-3.6-flash`) via Google AI Studio's free tier, then moved to Groq
(`openai/gpt-oss-120b`) after the Google account hit an account-level API restriction that
required linking billing (which would have removed Gemini's free tier entirely) — but Groq's
free-tier rate limits turned out not to comfortably cover real usage after all (§1: KFC/Shakey's
stalls, both locally and in CI). Milestone 5 dropped the LLM step entirely in favor of
deterministic per-chain parsers (§2 step 4) for the three chains still on the automated
pipeline; the rest are hand-maintained.

**$0/month, genuinely, with no API key or account of any kind.** No LLM provider is called
anywhere in this pipeline anymore.

---

## 5. Infrastructure feasibility

Verified via research during planning, then confirmed by actually running it (Milestone 5):
GitHub Actions public repos get effectively unlimited minutes on standard runners (4 vCPU /
16GB). With KFC and Shakey's moved to hand-maintained data (§1), the three chains still on the
automated pipeline (Jollibee, McDonald's, Mang Inasal) are all plain HTTP fetch + deterministic
parse, no Playwright/headless-browser step needed at all — a full run should complete in well
under a minute. `.github/workflows/pipeline.yml` (`workflow_dispatch`) exists and runs this in
CI. Milestone 6 is what turns it into the unattended weekly cron once a clean manual run
confirms the deterministic-parser rewrite end to end.

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
  it's mitigated by (a) validation blocking a parse that comes back empty or wildly different
  rather than committing it — a broken parser fails loudly, not silently — (b) the checksum
  gate meaning most weeks do nothing at all, and (c) the manual-override file meaning a single
  broken chain degrades to "one chain shows stale/overridden data" rather than blocking the
  whole pipeline or the whole app. Unlike the original LLM-based design, a deterministic parser
  is NOT redesign-resilient — a chain restyling its page can break its parser outright — but it
  costs nothing, has no rate limit, and needs no API key, which is why it won the tradeoff for
  the three chains simple enough to parse deterministically (§2 step 4).

If a chain becomes unmaintainable in practice, the manual-override file is the release valve —
it was designed as a scraping fallback, but it works equally well as a "give up on this one
source and hand-maintain it occasionally" fallback without touching the rest of the system.
Chowking (§1) is the first real instance of exactly this, discovered rather than hypothetical:
its Cloudflare-gated menu API isn't safely automatable, so it's on the same "spot-check
occasionally" footing as Jollibee and McDonald's above, just without even the third-party site
as a fetch target — `src/data/chowking.ts` is hand-maintained directly.
