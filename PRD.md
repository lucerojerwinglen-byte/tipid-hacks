# Product Requirements Document — barato

**Status:** Approved for build
**Author:** Jerwin, with Claude Code (planning session)
**Date:** August 2026

---

## 1. Summary

A free, non-commercial Progressive Web App for Filipino users. The user enters how much
money they have and how many people are eating; the app returns the optimal fast-food order
— specific items and quantities — for that budget and headcount, plus how much they saved
versus the obvious/advertised option.

**Success is defined as:** real people use it and save real money. There is no revenue model
and none is wanted. The primary existential risk is maintenance burden, not lack of users or
lack of funding — every decision in this document and its companions is weighed against "will
this still be running in a year, unattended."

---

## 2. Problem

Fast-food menu pricing in the Philippines contains traps that nobody does the arithmetic on
while standing in a queue:

- Advertised combo meals are frequently more expensive than buying the same components à la
  carte.
- Bucket/family sizes only become cheaper than singles past a certain headcount — and that
  crossover point isn't advertised anywhere.

Software can do this arithmetic instantly. Nobody currently does.

---

## 3. Target users and core stories

The target user is on a low-end Android phone, often with a prepaid data balance that may be
zero, in the Philippines. This is not a Silicon Valley user, and the product must not assume
Silicon Valley conditions (always-on connectivity, high-end hardware, tolerance for account
creation).

- As a student with ₱150 and two friends, I want to know what we can actually afford so we
  don't get embarrassed at the counter.
- As a parent with ₱500 feeding a family of five, I want the combination that feeds everyone,
  not the one with the best marketing.
- As someone with no mobile data left, I want the app to still work.
- As someone who doesn't trust apps, I want to use it without making an account or giving up
  any personal information.
- As a user who spots a wrong price, I want to correct it in one tap.
- As someone deciding in a group chat, I want to share the result as an image.

---

## 4. Feature scope

### Must have (v1)

- Budget input (pesos) + headcount input
- Chain selection, or "any chain" (see §5 — solves per-chain, returns the best single chain's
  result with runners-up shown)
- Optimal order output with itemised quantities and total
- **Savings comparison** against the naive/advertised option — the trust-builder, not a
  nice-to-have
- Plain-language explanation of *why* this combination won (e.g. "the bucket beats singles
  once you're 4+")
- Fully functional offline after first load (app shell + last-fetched price data); fully
  functional online too — this is an online-or-offline app, not an offline-only one. See
  ARCHITECTURE.md for the network-first / stale-while-revalidate caching strategy this implies.
- No sign-up, no login, no account
- Visible **price freshness indicator** ("prices as of 12 Aug 2026") — low-key by default,
  shifts to a soft/friendly (never alarming) tone only past ~3-4 weeks of staleness

### Should have

- One-tap "this price is wrong" report — doubles as the primary correction channel for the two
  chains sourced from third-party sites (Jollibee, McDonald's — see DATA-PIPELINE.md)
- Share result as an image — this is how it spreads in the Philippines, via group chats
- Tagalog / English toggle
- Simple dietary filters (no pork, no beef, no spicy)
- Solver modes: "maximum food" — labeled **"Sulit"** in the UI, and the **default** (ADR 0001,
  docs/adr/0001-sulit-default-value-per-peso.md) — vs "feed everyone" vs "cheapest possible".
  The default optimizes for best value per peso (most food value for the budget), not lowest
  price — see SOLVER.md and CONTEXT.md's `Sulit`/`Mura` glossary entries for exact semantics.

### Could have (later)

- Receipt photo scan that splits the bill among the group **and** harvests fresh prices as a
  byproduct. Considered and deliberately *not* pulled into v1 during planning — the
  Jollibee/McDonald's data-source problem this would have solved was instead solved by
  scraping third-party price-listing sites (see DATA-PIPELINE.md). Still worth building later:
  it's a stronger long-term answer and a genuine engagement mechanic.
- Price history ("Chickenjoy is ₱12 more than in March") — falls out nearly free from the
  git-committed price archive (see DATA-PIPELINE.md)
- Nearby branch locator

### Explicitly NOT in v1

- User accounts, profiles, social features
- Delivery integration or ordering
- Independent restaurants and carinderias (unmaintainable — national chains only)
- Ads, affiliate links, monetisation of any kind
- Native app store distribution
- Cross-chain mixing within a single order (see SOLVER.md — a mixed order requires visiting
  two physical stores, which doesn't correspond to a real action)
- Multi-zone/regional pricing (single NCR reference price per chain in v1 — see DATA-MODEL.md)

---

## 5. The six chains

**Jollibee, McDonald's PH, KFC PH, Chowking, Mang Inasal, Shakey's** — chosen for
solver-design diversity, not pure market share:

| Chain | Why it's in the set |
|---|---|
| Jollibee, McDonald's, KFC | Highest volume; all have the classic combo-vs-à-la-carte trap and bucket/family crossover |
| Chowking | Different meal shape (rice bowls, noodles) — tests the data model beyond "burger + fries + drink" |
| Mang Inasal | Forces the "unlimited rice" modeling question (see DATA-MODEL.md) |
| Shakey's | Pizza is a genuinely different serving-size shape — stress-tests whether "feed everyone" mode generalizes |

## 6. Solver behavior (product-level summary — full formulation in SOLVER.md)

- Every person gets ≥1 main + ≥1 carbohydrate/rice portion — this coverage requirement holds
  regardless of mode; what differs by mode is what happens with money left over after coverage.
- The default mode ("Sulit"/`maximum-food`) spends the leftover on whichever items deliver the
  most food value per peso, not on whichever items are individually cheapest (ADR 0001) — no
  explicit quality/desirability floor beyond category tagging is needed on top of that, since
  "value" here is an objective count (main + carb servings), not a taste judgment. Revisit only
  if real usage shows this feels bad.
- If budget × headcount makes coverage infeasible at all (any mode), the app says so honestly
  and auto-offers the "cheapest possible" answer instead of a dead end.
- "Any chain" never mixes items across chains in one order — it solves per chain and shows the
  winner plus runners-up.

## 7. Non-functional requirements

- Initial JS bundle under ~200KB gzipped
- Total data payload under ~100KB
- Interactive within 2 seconds on a 3G connection
- Fully functional on Android 8+ and 2GB RAM devices
- Zero personal data collected — no accounts, no PII, no third-party analytics
- Accessible: legible contrast, large tap targets, usable one-handed on a small screen

## 8. Trust and honesty principles

- Prices are **indicative, not a quote** — stated plainly in the UI.
- A single NCR reference price is used per chain; the UI states this openly rather than
  implying national precision (see DATA-MODEL.md).
- Data sourced from a third-party site (Jollibee, McDonald's) is marked as such in the data
  model (`source_type`); this doesn't change what the user sees, but it's honest internally
  and shapes validation strictness.
- Wrong-but-confident is worse than stale-but-honest — this governs the entire data pipeline
  design (see DATA-PIPELINE.md) and the freshness indicator's design (§4 above).

## 9. Distribution

Primary channel: Filipino online communities (r/Philippines, r/phinvest, Facebook
budget/frugal-living groups) — not personal-network-led. The project is also open source
(MIT-licensed public repo), which fits how these communities respond to and trust tools like
this. Share-as-image remains important since results still circulate through group chats once
discovered.

## 10. Success criteria

- Real users complete a budget+headcount query and get a usable answer, offline or online, on
  a low-end Android device.
- The savings comparison is trusted enough that users act on it (share it, return to it).
- The pipeline runs unattended for months without Jerwin's intervention beyond the two
  chains' planned monthly manual checks (see DATA-PIPELINE.md).
- No takedown-driven shutdown; no silent-bad-data incident.
