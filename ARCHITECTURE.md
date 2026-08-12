# Architecture — barato

**Status:** Decided, backed by live research (Aug 2026)

This document records the stack decision, what was rejected and why, and a system diagram.
Every claim about current library versions or API availability below was verified via web
search during planning rather than assumed from training data, per the brief's own
instruction to distrust stale assumptions.

---

## 1. System diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub repo (public)                   │
│                                                                 │
│  ┌───────────────┐   weekly cron   ┌──────────────────────┐  │
│  │ GitHub Actions │────────────────▶│  Data pipeline (TS)   │  │
│  │   (free tier)  │                 │  fetch → checksum-gate│  │
│  └───────────────┘                 │  → LLM parse → validate│  │
│                                     │  → diff → commit       │  │
│                                     └──────────┬─────────────┘  │
│                                                │                 │
│                                     commits price JSON           │
│                                                │                 │
│                                                ▼                 │
│                              /data/*.json  (git-tracked archive) │
│                                                │                 │
└────────────────────────────────────────────────┼─────────────────┘
                                                  │  build-time fetch
                                                  ▼
                                    ┌──────────────────────────┐
                                    │  Vite build (React + TS)  │
                                    │  bundles latest data +    │
                                    │  solver + UI              │
                                    └─────────────┬──────────────┘
                                                  │  static deploy
                                                  ▼
                                    ┌──────────────────────────┐
                                    │     Cloudflare Pages       │
                                    │  (free, uncapped bandwidth)│
                                    └─────────────┬──────────────┘
                                                  │
                                                  ▼
                                    ┌──────────────────────────┐
                                    │   User's browser (PWA)    │
                                    │  service worker: network- │
                                    │  first / stale-while-     │
                                    │  revalidate for price data │
                                    │  IndexedDB (idb-keyval)    │
                                    │  client-side DP solver     │
                                    └──────────────────────────┘
```

No backend server, no database, no auth provider, no analytics SDK — confirmed still correct
after research; nothing found during planning required any of these.

---

## 2. Client stack

| Layer | Choice | Version (Aug 2026) |
|---|---|---|
| Build tool | Vite | 8.x (ships Rolldown, a Rust bundler, by default) |
| UI framework | React | 19.2.x |
| Language | TypeScript | 7.0.x (Go-native compiler rewrite; confirmed GA via a real `npm install` on 2026-08-11 — the Aug-2026 web research had it as RC, but that snapshot was already stale by the time the build actually started. Same language/type semantics as 6.0, just a much faster compiler.) |
| Styling | Tailwind CSS | 4.3.x (CSS-first config — no `tailwind.config.js` needed, a real change from the v3 era) |
| PWA tooling | `vite-plugin-pwa` | Zero-config service worker + manifest generation, actively maintained |
| State | React state; Zustand only if it's genuinely needed once building starts | — |
| Local storage | IndexedDB via `idb-keyval` | — |
| Hosting | Cloudflare Pages | — |

### Rejected: Next.js

Next.js's core value — SSR, ISR, API routes, server components — solves problems this project
doesn't have: no backend, no SEO-critical dynamic content, no willingness to pay for a server
runtime. 2026 comparisons consistently place Vite as the default choice for SPAs and lighter
client-side apps, reserving Next.js for when SSR/SEO/backend-adjacent routing is actually
needed. `vite-plugin-pwa` covers the PWA story as well as or better than `next-pwa`, without
requiring a static-export workaround to sidestep Next's server assumptions. For a solo
beginner, Next's server/client component boundary is a real conceptual tax with no offsetting
benefit here.

### Rejected: localStorage as primary storage

localStorage is synchronous and runs on the main thread — on the 2GB-RAM Android devices this
app targets, that risks jank, especially alongside React re-renders. It also only stores
strings, forcing `JSON.stringify`/`parse` on every read. IndexedDB is async, stores structured
data natively, and — unlike localStorage — is reachable from the service worker, which matters
for the network-first caching strategy below. `idb-keyval` gives IndexedDB's benefits without
hand-rolling its notoriously clunky raw API.

### Hosting: Cloudflare Pages over Vercel

Cloudflare Pages has no published bandwidth cap; Vercel's Hobby tier caps at ~100GB "fair use"
(not a contractual guarantee) with Fast Origin Transfer capped further at ~10GB. For a project
that must stay free indefinitely with unpredictable traffic, the uncapped option is the safer
bet. Caveat worth tracking: Cloudflare's own new feature investment (Cron Triggers, Durable
Objects, Workflows) is going into **Workers with static assets**, not Pages specifically —
Pages still works and isn't being shut down, but it's in maintenance mode. If Pages is ever
deprecated, migrating to Workers-static-assets is the fallback (see RISKS.md).

### PWA viability — confirmed for the PH market

~89% Android share in the Philippines as of 2026; Chrome's install flow works normally, no
new hurdles found. The ~11% iOS minority faces the usual Safari friction (manual "Add to Home
Screen," no install prompt) — not a material adoption blocker given no push-notification
dependency exists here anyway. The concrete risk worth designing around: **in-app browsers**
(Messenger, Facebook, TikTok — exactly how this app's target distribution channels share
links) often break the "Add to Home Screen" affordance on iOS. Mitigation: detect in-app-
browser user agents and show a lightweight "open in Safari/Chrome" banner.

---

## 3. Offline/online strategy

The app is explicitly **online-or-offline**, not offline-first-purist — a correction made
during planning after the brief's initial framing implied strict offline-first. This means:

- Service worker caching for price data uses **network-first / stale-while-revalidate**: try
  the network for the latest committed price data, fall back to the cached copy if offline.
  Do not cache once at install and never refetch.
- The app shell (JS/CSS) can be precached normally — that part is genuinely offline-first,
  since it doesn't change per-session.
- The freshness indicator (see PRD.md §4, DATA-MODEL.md) is what keeps this honest for users
  who stay offline a long time — the date shown is real, and its tone shifts only when the gap
  becomes large enough to imply something's actually wrong.

---

## 4. Solver: client-side, hand-rolled

See SOLVER.md for the full formulation. Architecturally: the solver is a plain TypeScript
module with no external optimization library dependency. This was a deliberate rejection of
both WASM-based LP/ILP solvers (glpk.js, highs.js — each alone would consume 75-150% of the
entire 200KB bundle budget) and JS LP libraries (javascript-lp-solver, YALPS — general LP
doesn't naturally express the project's two-stage objective of "satisfy the per-person
constraint, then minimize cost, then maximize leftover value" without weighted-sum hacks).

---

## 5. Data pipeline: Node/TypeScript, not Python

Single-language repo: the solver is necessarily TypeScript (must run in-browser), and keeping
the pipeline in the same language means one toolchain, one CI setup, and shared types for a
solo maintainer. Python's scraping ecosystem (httpx/selectolax/Playwright) is roughly as
mature as Node's (undici/cheerio/Playwright) — this was close to a wash technically, so the
tiebreaker was maintainer ergonomics, not capability. See DATA-PIPELINE.md for the fetch/
parse/validate/commit design, per-chain source table, and cost estimate.

---

## 6. What's explicitly still rejected

No backend server, no database, no auth provider, no analytics SDK, no ads, no affiliate
links. Nothing surfaced during planning that requires reversing any of these.
