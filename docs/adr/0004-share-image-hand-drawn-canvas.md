---
status: accepted
---

# Share-as-image: hand-drawn `<canvas>` receipt, not a DOM-to-image library

**Context.** PRD.md §4's should-have "share result as an image" was explicitly undesigned going
into Milestone 7 (OPEN-QUESTIONS.md flagged both the mechanism and the exact visual design as
unresolved). RISKS.md #7 names this the app's primary distribution lever — a receipt shared into
a Philippine group chat is how the app is expected to spread — so the output image needs to be
legible as a small chat thumbnail and needs to point back to the app somehow.

**Decision.** Render the receipt by hand onto a `<canvas>` (`src/utils/receiptLayout.ts` for the
pure layout math, `src/utils/receiptCanvas.ts` for the actual draw calls), then hand the result to
`navigator.share({ files: [...] })` when the browser supports file sharing
(`src/utils/shareImage.ts`), falling back to a plain `<a download>` blob-URL click otherwise. No
`html2canvas`/`dom-to-image` or similar DOM-snapshot library.

Visual content, top to bottom: the real wordmark image → chain name + mode label → freshness date
→ itemized coverage list → total/leftover → a savings stamp (only when `savings > 0`) → bonus
items under the same label `ResultsPanel` already uses → a footer with the repo URL (no deployed
domain exists yet — ARCHITECTURE.md; swap to the real one once Cloudflare Pages hosting goes
live). Runner-up chain-comparison text is deliberately excluded — a receipt doesn't list what you
didn't buy elsewhere, and leaving it out keeps the layout to one shape. Only feasible results get
a share button in v1; sharing a partial/infeasible "closest honest answer" result is legitimate
future scope, not built here.

Text is drawn in the app's own `--font-display` monospace stack (`index.css`) — already the
line-item font in the live UI — which also means wrap-width can be computed by character count
(`wrapText` in `receiptLayout.ts`) instead of needing real font-metric measurement, so the layout
math is unit-testable without a browser. Colors are read live via `getComputedStyle` on the CSS
custom properties (`--color-brand`, `--color-stamp`, `--color-paper`, `--color-ink`, `--color-
line`) rather than a second hardcoded palette in JS, so they can't drift out of sync with
`index.css`/ADR 0003 if the brand palette is ever revisited again. The canvas renders at 2x its
logical layout size for a sharp result in a group-chat thumbnail.

## Considered options

- **`html2canvas` / `dom-to-image`.** Rejected: both are 30-50KB+ minified (a meaningful bite out
  of the ~200KB gzip budget, ARCHITECTURE.md §4/ROADMAP.md Milestone 3), and both work by
  snapshotting live DOM/CSS — fragile against this app's actual decorations, which lean on CSS
  masks (`.torn-strip`) and inline-SVG data-URI backgrounds (`.paper-grain`, `.wave-motif`,
  ADR 0003), a combination these libraries are known to render inconsistently or drop entirely.
  Also inconsistent with this project's standing pattern of hand-rolling instead of pulling in a
  dependency for something the app's own shape doesn't strictly need (hand-rolled solver instead
  of an LP library — ARCHITECTURE.md §4; hand-rolled deterministic parsers instead of LLM
  extraction — ROADMAP.md Milestone 5).
- **Server-side image rendering** (e.g. a Workers function generating the PNG). Rejected outright
  — the app has no backend by design (ARCHITECTURE.md), and this milestone doesn't change that.
- **Sharing a link instead of an image** (e.g. a URL encoding the budget/headcount/result).
  Rejected for v1: PRD.md §4 and RISKS.md #7 both specifically call for an *image* — it's what
  reads instantly in a group chat without a tap-through, which is the whole point of the
  mechanic. Worth revisiting later as an addition, not a replacement.

## Consequences

- `src/components/ShareButton.tsx` needs `chainDisplayName`, `chainId`, and `lastUpdated` plumbed
  down through `ResultsPanel.tsx` from `App.tsx`'s already-computed `solved` object, so the
  receipt matches what's on screen exactly.
- `navigator.share`'s transient-activation timing (whether an async image-decode step before the
  `share()` call is tolerated) is a real-device concern that can't be proven from a plan or a unit
  test — confirmed working via a headless-Chromium download-fallback run during this milestone;
  still worth a manual check on real iOS Safari once this is live, since browsers vary here.
- If the footer URL changes (once Cloudflare Pages hosting is live), only the constant in
  `ShareButton.tsx` needs updating — the layout/canvas modules don't hardcode it.
