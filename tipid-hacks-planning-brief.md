# Tipid Hacks — Planning Brief for Claude Code

**Status:** Pre-build. Planning and interrogation only.
**Author:** Jerwin (Philippines)
**Date:** August 2026

---

## 0. Your role and the rules of this session

You are acting as a **senior technical co-founder doing discovery**, not as a code generator.

**Hard rules for this session:**

1. **Do NOT write application code yet.** No scaffolding, no `npm create`, no components. If you feel the urge to start building, that's the signal to ask me another question instead.
2. **Interrogate this brief before you plan.** Where my thinking is vague, underspecified, or probably wrong, say so directly. I would rather be corrected now than after three weekends of work.
3. **Challenge the tech stack in Section 6.** I've proposed one, but I'm a beginner and I picked it partly on vibes. If something simpler or more appropriate exists, argue for it.
4. **Verify current versions and APIs via web search.** Your training data may be stale. Before recommending any library, framework, or API, check what the current stable version is as of today and whether the API surface I'm assuming still exists.
5. **Explain tradeoffs in plain language.** I'm a beginner with Claude Code and I'm not a professional developer. When you name a pattern or tool, tell me what problem it solves and what it costs me. Don't assume I know the jargon.
6. **Optimise for a solo developer with limited time**, working nights and weekends, who will lose motivation if the maintenance burden is high. Design for abandonment resistance.
7. **Ask me the questions in Section 12 before producing the deliverables in Section 11.** Wait for my answers.

---

## 1. Context

I'm building a free, non-commercial side project for Filipino users. It is not a business — there is no revenue model and I don't want one. Success is defined as: real people use it and save real money.

Because it earns nothing, **maintenance cost is the primary existential risk**. A design that requires me to manually update data every week will be dead within six months. Every architectural decision should be weighed against "will Jerwin still be doing this in a year?"

**Constraints about me:**
- I run Claude Code in the VS Code extension panel. Beginner level.
- I'm on Claude Pro. Note that the Pro subscription does **not** include Anthropic API credits — if the plan involves calling the API programmatically, that's a separate pay-as-you-go account, and I need you to estimate the monthly cost.
- I have limited budget. Prefer free tiers. Assume near-zero infrastructure spend.

---

## 2. The product, in one paragraph

The user enters **how much money they have** and **how many people are eating**. The app returns the optimal fast-food order for that budget and headcount — the specific items and quantities to buy — along with how much they saved versus the obvious/advertised option. The core insight is that fast-food menu pricing contains traps: advertised combo meals are frequently more expensive than buying the same components à la carte, and bucket/family sizes cross over into being cheaper only past a certain headcount. Nobody does that arithmetic while standing in a queue. Software can do it instantly.

**Example output:**

> **₱300 · 4 people · Jollibee**
> 4× Chickenjoy 1pc with rice (à la carte) — ₱276
> ✅ You save ₱44 vs 4 combo meals
> Everyone gets chicken + rice. ₱24 left over.

---

## 3. Core user stories

- As a student with ₱150 and two friends, I want to know what we can actually afford so we don't get embarrassed at the counter.
- As a parent with ₱500 feeding a family of five, I want the combination that feeds everyone, not the one with the best marketing.
- As someone with no mobile data left, I want the app to still work.
- As someone who doesn't trust apps, I want to use it without making an account or giving up any personal information.
- As a user who spots a wrong price, I want to correct it in one tap.
- As someone deciding in a group chat, I want to share the result as an image.

---

## 4. Feature scope

### Must have (v1)
- Budget input (pesos) + headcount input
- Chain selection (or "any chain")
- Optimal order output with itemised quantities and total
- **Savings comparison** against the naive/advertised option — this is the trust-builder, not a nice-to-have
- Plain-language explanation of *why* this combination won ("the bucket beats singles once you're 4+")
- Fully functional offline after first load
- No sign-up, no login, no account
- Visible **price freshness indicator** ("prices as of 12 Aug 2026")

### Should have
- One-tap "this price is wrong" report
- Share result as an image (this is how it spreads in the Philippines — group chats, not app stores)
- Tagalog / English toggle
- Simple dietary filters (no pork, no beef, no spicy)
- "Feed everyone" vs "maximum food" vs "cheapest possible" solver modes

### Could have (later)
- Receipt photo scan that splits the bill among the group **and** harvests fresh prices as a byproduct
- Price history ("Chickenjoy is ₱12 more than in March")
- Nearby branch locator

### Explicitly NOT in v1
- User accounts, profiles, social features
- Delivery integration or ordering
- Independent restaurants and carinderias (unmaintainable — national chains only)
- Ads, affiliate links, monetisation of any kind
- Native app store distribution

---

## 5. The three hard problems

Please treat these as the substance of the planning work. Everything else is plumbing.

### 5.1 The solver

This is the actual intellectual property. Everything else is a wrapper around it.

**Inputs:** budget `B`, headcount `N`, optional chain filter, optional dietary filters, solver mode.

**Constraint (default "feed everyone" mode):** every one of the `N` people must receive at least one main item and one carbohydrate/rice portion. Shareable items (buckets, family platters) contribute fractional servings toward this.

**Objective:** minimise total cost subject to satisfying the constraint; then, with any remaining budget, maximise added value.

**The critical modelling requirement:** combo meals must be **decomposable** into their component items. If the data model treats "Chickenjoy Combo" as an opaque product with one price, the solver can never discover that buying the components separately is cheaper — and that discovery *is the entire product*. Please design the schema around this from the start.

**Hard technical constraint:** the solver must run **client-side, in the browser, offline, in JavaScript/TypeScript**. No Python solver, no server round-trip. Target: under 50ms for a typical query.

**Questions I want you to answer:**
- What's the right algorithmic formulation? (Bounded knapsack? Integer linear programming? Branch-and-bound with pruning? Something simpler that's good enough?)
- Does the combinatorial space actually explode at realistic menu sizes (~100–150 items per chain, N up to 10), or is brute force with pruning genuinely fine?
- Should I hand-roll this or use an existing JS solver library? What are the bundle-size implications?
- How do I model "servings" for shareable items? A 6-piece bucket serves how many? Is this a data field I have to hand-assign per item, and if so, how much work is that?
- How do we handle ties and near-ties gracefully so the output doesn't feel arbitrary?

### 5.2 The automated data pipeline

I do not want to maintain prices by hand. The intended flow:

1. **Scheduled trigger** — weekly cron, ideally GitHub Actions (free tier).
2. **Fetch** — retrieve each chain's official menu or online-ordering page. Some are server-rendered HTML; some are JavaScript apps that call a JSON API behind the scenes. Finding that underlying API is far better than scraping rendered HTML — please investigate this per chain during planning.
3. **Parse with an LLM** — pass the raw fetched content to the Anthropic API and have it return structured JSON matching a strict schema. Use structured output / tool-use to force schema conformance. The reason for using an LLM here rather than CSS selectors is resilience: selector-based scrapers shatter on any layout change, whereas an LLM reading the page copes with redesigns.
4. **Validate** — schema validation plus sanity rules (see below).
5. **Diff** against the previous run. No change, no action.
6. **Commit** the updated JSON to the repository. *Nice property: git history gives me a free, permanent price archive with zero extra work.*
7. **Alert me** (GitHub issue or email) when something looks wrong.

**Sanity rules — please expand on these:**
- Reject any single price change greater than ~30% and flag for human review rather than auto-applying
- Reject a run where the item count drops sharply (usually means the page failed to load, not that the menu shrank)
- Reject obviously nonsensical values (₱9 or ₱9,000 for a burger)
- **Silent auto-updating of bad data is the worst possible failure mode.** Wrong-but-confident is worse than stale-but-honest. Design accordingly.

**Fallback requirement:** at least one chain will inevitably be unscrapeable. There must be a manual override file the pipeline respects and never clobbers.

**Questions I want you to answer:**
- Which of the six chains actually publish prices publicly? Please check.
- Fetch layer: plain HTTP client, or is headless browser automation needed? If the latter, does it still run acceptably in GitHub Actions?
- Python or TypeScript for the pipeline? (Single-language repo has appeal, but scraping tooling is more mature in Python.)
- Estimated monthly Anthropic API cost at weekly cadence across six chains?
- Should the LLM parse every run, or only when a cheap checksum indicates the page changed? (Cost and determinism implications.)

### 5.3 Staleness and trust

Prices drift and promos expire. The app must degrade honestly rather than lie.

Design principles to plan around:
- Build the solver's reasoning on **structural rules and ratios** ("à la carte beats the combo," "bucket wins past 4 people") rather than only absolute peso figures. The structural insight survives price drift even when exact numbers are stale.
- Always surface the data's age. Users forgive stale prices they can see; they do not forgive confident wrong answers.
- Prices are **indicative, not a quote**. State this plainly in the UI.
- Chains zone-price differently across NCR and the provinces, so a single national menu is inherently an approximation. Decide how to communicate this.

---

## 6. Proposed tech stack — challenge this

I've said I want a modern stack. Here's my starting proposal. Push back where it's wrong.

**Client:**
- Progressive Web App, not a native app. Rationale: no app store fees, no review delays, instant updates, one codebase. Offline is achievable with a service worker, and my entire dataset is a few kilobytes.
- Vite + React + TypeScript
- Tailwind CSS
- Minimal state management (probably none beyond React state; Zustand at most)
- Menu data cached in IndexedDB or localStorage; app remains fully usable with zero connectivity
- Hosted free on Cloudflare Pages or Vercel

**Pipeline:**
- Python (httpx, selectolax, Playwright only if unavoidable) or TypeScript — your call, argue it
- Anthropic API for structured extraction
- Pydantic or Zod for schema validation
- GitHub Actions on a weekly cron
- Data committed as JSON in-repo — no database, no backend

**Explicitly rejected:**
- No backend server, no database, no auth provider, no analytics SDK. If the plan needs any of these, justify it hard.

**Things I want your opinion on:**
- Is a PWA genuinely the right call for the Philippine market, given how Android-dominant and low-end-device-heavy it is? Are there install-prompt or iOS limitations that would hurt adoption?
- Next.js vs plain Vite for something this small and this static?
- Is committing data to git as the "database" sane at this scale, or will it become awkward?

---

## 7. Data model — starting sketch

Refine or replace this. It's a first attempt, not a spec.

```
Chain
  id, name, last_updated, source_url, notes

Item
  id, chain_id, name, category (main | rice | side | drink | dessert | combo)
  price
  serves           # fractional; a 6pc bucket might serve 3.0
  shareable        # bool
  is_combo         # bool
  combo_contents   # list of item_ids, if is_combo
  tags             # pork, beef, chicken, spicy, etc.
  available        # bool — for LTO items that vanish
  price_confidence # derived from pipeline validation
```

**Open modelling questions for you:**
- How do I represent unlimited rice (Mang Inasal) in a solver that counts carb portions?
- How are limited-time offers handled when they expire mid-week?
- How is regional price variance represented without multiplying the dataset by every zone?

---

## 8. Non-functional requirements

The target user is on a low-end Android phone with a prepaid data balance that may be zero. This is not a Silicon Valley user.

- Initial JS bundle under ~200KB gzipped
- Total data payload under ~100KB
- Interactive within 2 seconds on a 3G connection
- Fully functional on Android 8+ and 2GB RAM devices
- Fully functional offline after first load
- **Zero personal data collected.** No accounts, no PII, no third-party analytics. This also keeps me clear of Data Privacy Act obligations — please confirm that reasoning holds.
- Accessible: legible contrast, large tap targets, usable one-handed on a small screen

---

## 9. Legal, ethical, and brand considerations

Please research and advise. I understand you are not a lawyer and I'm not asking for legal advice — I'm asking for the risks I should be aware of and where I should get proper counsel.

- Review each target chain's `robots.txt` and terms of service before scraping. Flag any that clearly prohibit it.
- Fetch politely: weekly cadence, identifying user agent, no hammering.
- **Do not scrape delivery aggregators** (GrabFood, Foodpanda). Their terms prohibit it, and their prices carry a 10–20% delivery markup, which would make the data wrong for dine-in and takeout anyway.
- Using brand names to refer to the actual brands is generally nominative use, but **do not use logos or trade dress**. Advise on safe presentation.
- Prominent disclaimer: unofficial, not affiliated with or endorsed by any chain, prices indicative only.
- Consider how to respond if a chain sends a takedown request. Having thought about it beforehand is better than panicking.

---

## 10. Risk register — please expand and rank

| Risk | Why it matters |
|---|---|
| Pipeline breaks silently and serves stale prices | Destroys trust permanently; the app becomes actively harmful |
| Chains don't publish prices publicly | Removes the automation premise entirely |
| Solver output feels arbitrary or obviously wrong | Users won't return after one bad answer |
| Maintenance burden exceeds my motivation | The default fate of unpaid side projects |
| A chain issues a takedown | Project ends abruptly |
| Nobody finds the app | Free doesn't mean discovered — distribution still has to be planned |
| Regional price variance makes answers wrong outside NCR | Silently misleads exactly the users who need it most |

---

## 11. Deliverables I want from this planning session

After you've asked your questions and I've answered, produce these as separate markdown files:

1. **`PRD.md`** — product requirements, scope, user stories, success criteria
2. **`ARCHITECTURE.md`** — stack decision with rationale, rejected alternatives and why, system diagram
3. **`SOLVER.md`** — algorithm choice, formulation, complexity analysis, pseudocode, test cases including edge cases
4. **`DATA-PIPELINE.md`** — per-chain source investigation, fetch/parse/validate/commit design, cost estimate, failure modes
5. **`DATA-MODEL.md`** — finalised schema with worked examples for at least two real chains
6. **`RISKS.md`** — expanded and ranked register with mitigations
7. **`ROADMAP.md`** — milestones sized for one person working weekends, with an explicit "smallest thing that proves this works" first milestone
8. **`OPEN-QUESTIONS.md`** — everything still unresolved and what would resolve it

---

## 12. Questions I expect you to ask me before planning

Ask these, plus anything else you need. Wait for my answers.

- Which six chains, specifically? Should the choice be driven by market share, by data availability, or by what I personally eat?
- What does "optimal" mean when budget and satisfaction conflict — is cheapest always best, or is there a quality floor?
- Do I want dine-in prices, takeout prices, or both?
- What's my realistic weekly time budget for this project?
- How will the first hundred users find it?
- What would make me personally abandon this project, so we can design against that specifically?

---

## 13. First response format

Please respond with:

1. Your honest read of this brief — what's strong, what's underspecified, what I've gotten wrong
2. Anything I've assumed that you think is false
3. Your questions from Section 12 plus your own
4. **Nothing else.** No code, no file scaffolding, no plan yet.

Then wait.
