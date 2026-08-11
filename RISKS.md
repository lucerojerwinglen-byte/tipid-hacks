# Risk Register — Tipid Hacks

**Status:** Expanded from the brief's original 7-item table with findings from planning
research. Ranked by (likelihood × how badly it defeats the project's stated purpose), highest
first. Jerwin's own selected abandonment trigger — pipeline maintenance becoming a chore — is
the lens most of the mitigations below are optimized against, since that's the risk most
likely to actually end the project.

---

## 1. Pipeline breaks silently and serves stale-but-confident prices

**Why it's #1:** this is the one failure mode that doesn't just stall progress, it actively
harms the users the project exists to help, and destroys trust permanently once it happens
once. It's also the only risk in this table the project's own stated design principle
("wrong-but-confident is worse than stale-but-honest") is entirely organized around.

**Mitigation:** the entire DATA-PIPELINE.md validation chain — checksum gate, LLM extraction
with schema enforcement, the three sanity rules (30% price-jump threshold, item-count-drop
detection, implausible-value rejection), diff-before-commit, and an automatic GitHub issue on
any rule failure. No stage silently applies a value it isn't confident in.

## 2. Third-party data source (Jollibee, McDonald's) goes dark or degrades

**New risk, surfaced during planning.** Two of six chains are sourced from small, ad-supported
third-party sites (`jollibeemenuprice.net`, `mcdomenuprices.com.ph`) rather than the chains'
own systems, because both official ordering domains are bot-blocked. These sites could
reformat, get abandoned, or disappear with no warning — a materially different failure mode
from "official site changed its HTML," since there's no accountability or SLA on a hobbyist
site's continued existence.

**Mitigation:** these sources run through the exact same sanity checks as official ones (risk
#1's machinery already covers "a source suddenly returns garbage"). The manual-override file
is the designed fallback specifically for this case — if either site goes dark, that chain
degrades to occasional manual entry rather than breaking the app or the pipeline. Worth a
periodic (roughly quarterly) human check that both sites are still the best available option,
independent of the pipeline's own validation.

## 3. Maintenance burden exceeds motivation

**Jerwin's own selected abandonment trigger.** The default fate of unpaid side projects, and
the risk every other mitigation in this document is implicitly weighed against.

**Mitigation:** checksum-gating (no-op weeks produce zero LLM calls and zero commits — nothing
to review most weeks), the `serves` field being derived rather than hand-maintained (DATA-MODEL.md
§2 — resolved specifically because it would otherwise have been recurring per-item labor), and
open-sourcing the project (RISKS.md #7 below) as a hedge so the project doesn't have to die the
moment Jerwin's own time budget shrinks.

## 4. Two of six chains can't be automated at all without the third-party workaround

**Refines the brief's original "chains don't publish prices publicly" risk.** Confirmed during
planning: Jollibee's ordering domain actively blocks bot traffic; McDonald's explicitly
disallows its ordering path in robots.txt. Both are resolved (§DATA-PIPELINE.md §1) via
third-party sources, which is itself risk #2 above — so this risk doesn't disappear, it
transforms into a different, smaller one. Listed separately here because if the third-party
workaround ever fails *and* a replacement can't be found, this reverts to the original,
harder problem.

**Mitigation:** already covered by #2's mitigation. Fallback-of-last-resort: swap one or both
chains for a scrapeable alternative (Greenwich, Bonchon, Andok's were considered and set aside
during planning, not ruled out) if the situation ever becomes unworkable.

## 5. Solver output feels arbitrary or obviously wrong

**Users won't return after one bad answer.** Mitigated primarily through design choices made
during planning, not through complexity: deterministic tie-breaking (SOLVER.md §7) so the same
input always produces the same output, an explicit and honest infeasibility path rather than a
confusing empty result (SOLVER.md §4), and the "any chain" mode showing runners-up so a result
is explained, not just asserted (SOLVER.md §5).

**Watch item:** the "no explicit quality floor" decision (SOLVER.md §3) is a deliberate
simplicity bet — if real usage shows the always-cheapest-main output feels bad in practice,
this is the first place to revisit, not the tie-breaking or infeasibility logic.

## 6. A chain issues a takedown or cease-and-desist

**Jerwin's explicit call during planning: push back and seek clarification first**, rather
than comply immediately. This is a deliberate, informed choice against the safer default, so
the mitigation needs to actually exist before it's needed, not be improvised under stress.

**Mitigation:** draft a calm, ready-to-send response *now*, before any letter arrives, citing:
nominative use of chain names (not logos/trade dress — none are used anywhere in the app), a
public-interest/non-commercial framing, and — for the two chains where this applies — that the
pricing data itself comes from a public third-party page, not from circumventing the chain's
own systems. Having this written in advance is the entire difference between "push back
calmly" and "panic," which was the brief's own original concern in this area.

**Second-order effect of "push back":** since this is a slower, more contested posture than
immediate compliance, worst case duration of any dispute is longer and higher-stress. Worth
Jerwin knowing this going in as the actual cost of the choice he made.

## 7. Nobody finds the app

**Distribution channel chosen during planning:** Filipino online communities (r/Philippines,
r/phinvest, Facebook budget/frugal-living groups) rather than personal network/group chats.
Open-sourcing the project (decided during planning, see below) is also a distribution lever in
these specific communities, which tend to respond well to visible, inspectable open-source
tools.

**New risk surfaced during research:** the project's primary sharing mechanic (share-as-image
in a group chat) interacts badly with a PWA-specific gap — links opened inside in-app browsers
(Messenger, Facebook, TikTok — exactly how these communities share things) can break the "Add
to Home Screen" flow on iOS. See ARCHITECTURE.md's PWA section for the mitigation (detect
in-app-browser UA, prompt to open in a real browser).

## 8. Regional price variance makes answers wrong outside NCR

**Decided during planning:** a single NCR reference price per chain, stated plainly in the UI
rather than implied as nationally precise. This doesn't eliminate the risk — a user in Cebu or
Davao may see a materially wrong number — but it converts it from a silent-lie risk into a
disclosed-limitation risk, which is the category of risk this project's trust principles are
designed to tolerate honestly rather than solve perfectly in v1.

## 9. Open-sourcing trade-off: public repo makes the scraping approach visible too

**New risk, a direct consequence of the open-source decision (below).** A public repo means
the exact scraping/parsing approach for all six chains — including the third-party-source
workaround for Jollibee and McDonald's — is visible to anyone, including the chains
themselves. This is a real cost of open-sourcing, not a hypothetical one.

**Mitigation:** accepted deliberately as a fair trade against the alternative (the project
dying quietly if Jerwin stops maintaining it). Consistent with the "push back and seek
clarification" takedown posture above — if a chain does object, the project's approach being
fully visible and non-deceptive (no bot-protection bypass, no hidden behavior) is a stronger
position than if it looked like it had something to hide.

## 10. Hosting platform (Cloudflare Pages) is in maintenance mode

**New risk surfaced during research.** Cloudflare's newer feature investment (Cron Triggers,
Durable Objects, Workflows) is going into Workers-with-static-assets, not Pages specifically.
Pages still works today and isn't being shut down, but isn't where Cloudflare's growth
attention is.

**Mitigation:** none needed now — noted here so it isn't a surprise later. If Pages is ever
formally deprecated, migrating a static site to Cloudflare Workers' static-assets mode is a
comparatively small lift. Not worth pre-emptively building against a deprecation that hasn't
been announced.

---

## Explicitly decided against, not merely deprioritized

- **Bypassing official bot protection** (considered for Jollibee, ruled out entirely — see
  DATA-PIPELINE.md §1). Not a live risk because it was never adopted, listed here so the
  decision and its reasoning stay visible rather than getting silently re-proposed later.
