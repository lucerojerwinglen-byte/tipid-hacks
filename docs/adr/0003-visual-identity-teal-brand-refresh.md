---
status: accepted
---

# Visual identity refresh: teal/gold brand palette from the official logo

**Context.** Jerwin supplied the app's first official logo (`assests/barato-logo.png` /
`-nobg.png`): a hand-lettered "Barato" wordmark in teal with a dark-teal outline, topped by a
two-arc teal-and-gold wave squiggle, on a grainy cream paper texture. This doesn't match the
app's existing implemented design system (`src/index.css`): a deliberate "sari-sari store paper
ephemera" theme — receipt/order-slip structure, rubber-stamp and highlighter-marker accents,
system-monospace display font, and a green/orange-red/yellow palette (`--color-peso: #1f7a5c`,
`--color-stamp: #bd431f`, `--color-marker: #f4c430`) with no functional relationship to the new
logo's teal/gold. This ADR resolves that mismatch before Milestone 5 (ROADMAP.md), so the app
looks like one product with the logo rather than a logo bolted onto an unrelated palette.

Decided in a `/grilling` session with Jerwin on 2026-08-12; see that conversation for the full
branch-by-branch reasoning. Summary of the resolved forks:

- **Direction:** hybrid, not a full pivot and not logo-as-decoration-only. Keep the receipt/
  order-slip structure (torn-strip cards, itemized-slip metaphor) — it's deliberate and tied to
  the product (SOLVER.md's output *is* an itemized order). Retint it to the logo's colors.
- **Typography:** stay system-font-only (no webfont) — PRD.md §7's perf budget ("interactive in
  2s on 3G," "usable on a dead prepaid balance") is a brand promise, not just an engineering
  constraint, per the existing comment at the top of `index.css`. The logo's hand-lettered
  wordmark can't be approximated by any system font, so it's never re-set as text — the real
  logo image is used wherever the wordmark appears. Headings get a bolder/looser system-sans
  treatment (not literal shape-matching) to read warmer than the receipt-line-item monospace;
  a true cross-platform "rounded" system font (`ui-rounded` is Apple-only, no Android/Windows
  equivalent) doesn't exist, confirmed via the `ui-ux-pro-max` skill's typography search — every
  matching "playful/rounded" pairing it returned (Fredoka/Nunito, Varela Round, Kalam) requires
  a webfont, which the perf budget rules out. This is a deliberate, budget-driven deviation from
  that recommendation, not an oversight.
- **Color roles:** the logo's colors take over the *functional* brand roles, sampled directly
  from the source PNG's pixels (not eyeballed) — see Palette below. `--color-marker` (yellow
  highlighter) is untouched; it's a distinct highlighter metaphor, not a brand color.
- **Scope:** full pass — tokens, header/branding, regenerated PWA icons, and a consistency sweep
  over every component under the new palette. No new animation/microinteractions/loading states
  — that's explicitly out of scope for this pass.
- **Logo placement:** compact in the header (the real wordmark image, cropped tight, sized to
  roughly the old text heading's footprint) — not the full wordmark+wave lockup on every screen,
  which would push the budget input further down small phones. The full lockup is reserved for
  non-repeating surfaces (this doc, any future About/share-image surface).
- **Texture:** a subtle CSS-only grain (SVG turbulence or a tiny repeating pattern), not a
  shipped raster texture image.
- **Shape/motif:** the wave squiggle becomes a new recurring decorative accent, implemented as
  inline SVG (not a re-export of the raster logo crop) so it stays crisp, colorable, and free at
  any size — consistent with how the existing torn-strip/barcode decorations are already pure
  CSS, zero extra image requests. Corner-rounding stays as restrained as it is today; the logo's
  wobbly hand-drawn letterforms are not chased in UI chrome.
- **Dark mode:** none. The paper/receipt metaphor is a light-surface concept; a forced dark
  variant would fight the brand.
- **Layout/interaction:** unchanged. Jerwin is fine with the current structure and will flag
  specific layout tweaks separately, after this pass.
- **Name casing:** the logo itself renders "Barato" (title case) as a stylized wordmark image —
  that's the artwork, not typed text, so it doesn't reopen ADR 0002 (`barato`, always lowercase,
  for every *typed* instance: alt text, page title, manifest name, UI copy).

## Palette

Sampled directly from `assests/barato-logo-nobg.png` pixel data (not estimated), then adjusted
only where WCAG contrast against `--color-paper` (`#fffdf8`) required it for text/border/focus
use — verified with the sRGB relative-luminance formula, not eyeballed:

| Token | Old value | New value | Sampled from / derivation | Role |
|---|---|---|---|---|
| `--color-brand` (was `--color-peso`) | `#1f7a5c` | `#00686b` | Logo's dark-teal outline, sampled directly (6.47:1 on paper) | Primary text/border/focus/button color — replaces peso-green everywhere it was functional |
| `--color-brand-light` (new) | — | `#5bb2b5` | Logo's teal letter fill / wave upper arc, sampled directly (2.44:1 — decorative only) | Larger fills, wave motif, icon backgrounds — never used for text |
| `--color-brand-soft` (was `--color-peso-soft`) | `#e4f0ea` | `#e8f3ef` | `--color-brand-light` mixed 14% into `--color-paper` | Selected-state backgrounds (e.g. active solver-mode card) |
| `--color-stamp` | `#bd431f` | `#996900` | Logo's wave gold (`#ffad00`, sampled directly) darkened in HSL (L 50%→30%, hue/sat held) to clear 4.5:1 on paper — the raw gold is only 1.84:1 | Functional warning/emphasis text/border (savings badge, infeasible-result marker, active dietary-filter pill) |
| `--color-stamp-light` (new) | — | `#ffad00` | Logo's wave lower arc, sampled directly | Decorative-only use (wave motif); never text |
| `--color-stamp-soft` | `#fbe9e0` | `#fff0d0` | `--color-stamp-light` mixed 16% into `--color-paper` | Soft badge backgrounds |
| `--color-marker` | `#f4c430` | `#f4c430` (unchanged) | — | Highlighter effect only, not a brand color |
| `--color-bg`, `--color-paper`, `--color-ink`, `--color-ink-muted`, `--color-line` | unchanged | unchanged | — | Already a warm cream/ink pairing — this is how the logo itself is presented (teal wordmark on cream paper grain), so no change needed here |

`--color-peso-dark` (`#14503d`) is dropped: grep confirmed it was defined but never referenced
by any component.

## Assets

- `scripts/generate-icons.mjs` rewritten: instead of drawing a placeholder coin mark from
  scratch, it now crops the real logo (`assests/barato-logo-nobg.png`) via a headless
  Playwright/canvas pass — reproducible if the logo is ever replaced. Two crop regions, hand-
  picked from row pixel-density analysis (the source has no fully-transparent gap row between
  the wave and the wordmark, so the split is a fixed y-coordinate, not runtime-detected):
  - **Wave-only** (`x:152–1452, y:300–555` of the 2000×1600 source) → the icon/favicon symbol.
    The wordmark is illegible at 16–32px, but the wave is abstract and recognizable, so it
    carries the PWA icons, maskable icon, and apple-touch-icon (cream bg, matching how the
    source art actually presents the mark — safer than inventing a new bg/fg combination).
  - **Wordmark-only** (`x:142–1885, y:628–1061`) → `src/assets/brand/wordmark.webp`, the header
    mark. `y0` sits in the narrow band between the wave's lowest stroke and the "B"'s topmost
    curve — there's no fully-transparent row to crop at, so this was tuned by eye (a first pass
    at `y0:645` clipped the top of the letterforms; `y0:590` let a fleck of the wave's tail
    bleed in) rather than derived purely from the row-density analysis. Exported as WebP (not
    PNG): the source has grain texture baked into the letter fills themselves, which compresses
    poorly losslessly — PNG came out to ~95KB for this crop, WebP at quality 0.78 is ~20KB. This
    asset ships in the app bundle, where PRD §7's budget applies directly, unlike the PWA icons
    (fetched once, OS-level, off the critical path).
  - `favicon.svg` is hand-authored inline SVG (two bezier wave strokes in `--color-brand-light`/
    `--color-stamp-light` on a cream rounded square), not a rasterized crop — true vector stays
    crisp at any browser-requested favicon size for near-zero bytes.

## Consequences

- Every component referencing `bg-peso`/`text-peso`/`border-peso`/`peso-soft` needs updating to
  the `brand`-named classes (rename, not just a value swap, since "peso" no longer describes
  what the token is for).
- `vite.config.ts`'s PWA manifest `theme_color`/`background_color` need updating to match.
- The header's background changes from a solid `--color-peso` block to the paper/cream surface,
  so the (now teal, image-based) wordmark has contrast to sit on — a solid teal block behind a
  teal-on-transparent wordmark image would be close to invisible. Strong brand-color usage moves
  to interactive elements (buttons, focus rings, selected states, the best-deal badge) instead of
  a flat header fill.
- `scripts/generate-icons.mjs` now depends on Playwright at generation time (already a pipeline
  devDependency for the Milestone 5 scraper) instead of being a dependency-free hand-rolled PNG
  encoder. It's a one-off dev-time script, not part of the shipped app, so this doesn't affect
  the runtime bundle.
