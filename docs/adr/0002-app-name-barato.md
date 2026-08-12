---
status: accepted
---

# App name is "barato" (lowercase), not "Tipid Hacks"

**Context.** The project has shipped under the working name "Tipid Hacks" across code,
package metadata, and docs. Jerwin wants to rename the user-facing product to **barato** —
the Bikol term for "cheap" — mainly for a catchier brand, not because "Tipid Hacks" was
failing at anything. This creates a real tension with [[Sulit]]/[[Mura]] (CONTEXT.md): the
app's core identity, established in ADR 0001, is that it defaults to maximizing value per
peso, *not* minimizing spend — and "barato" reads to most Filipino speakers as exactly the
Mura framing the product deliberately does not default to. In Bikol usage, though, "barato"
also carries a "sulit"/worth-it connotation, closer to the app's actual intent than the
literal Tagalog "cheap" reading. Jerwin confirmed he's fine with the name being read
literally ("cheap") by the majority-Tagalog national audience (PRD.md §3, §9), on the
understanding that in-app copy — the Sulit/Mura mode labels and hint text — carries the
disambiguation, not the name by itself.

**Decision.** Rename the product's user-facing name to **barato**, always lowercase (not
"Barato" or "BARATO"). This pass covers user-facing surfaces only: UI strings, page
title/PWA manifest name, and product docs (PRD.md and similar). The git repo/folder name and
`package.json`'s `name` field remain `tipid-hacks` — renaming those is a separate,
more disruptive operation (breaks local clone paths, any CI/deploy config tied to the repo
slug) and is deferred to a deliberate later step, not bundled into this branding decision.

## Considered options

- **Keep "Tipid Hacks".** This was the actual recommendation going in — "Tipid" already
  means "to save/economize," arguably closer to Sulit's spirit than "barato," and there was
  no functional complaint driving the rename. Rejected: Jerwin wants "barato" regardless: the
  motivation is brand appeal, not a defect in the old name.
- **Reframe "barato" as describing the outcome, not the strategy** (e.g. "you get a barato
  deal because of the value you got"), keeping the name decoupled from literal Tagalog
  "cheap." Superseded by the simpler resolution: Jerwin's point that in Bikol, "barato"
  already carries a "sulit" connotation natively, so no reframing exercise is needed — the
  ambiguity for non-Bikol readers is accepted as-is, resolved by in-app language rather than
  by redefining the word.
- **Title-case "Barato".** Considered as the default brand-name styling (matches how "Tipid
  Hacks" and other proper nouns are capitalized elsewhere in the docs). Rejected: Jerwin wants
  lowercase styling.

## Consequences

- Product docs (PRD.md, and any other doc referring to the app by name) need their
  "Tipid Hacks" references updated to "barato" as user-facing implementation work — not done
  as part of this decision record.
- Code-level rename (UI strings, `index.html`/PWA manifest name and short_name) is likewise
  tracked as separate implementation work.
- `package.json`'s `name` field, the git repo name, and the local folder path intentionally
  keep saying `tipid-hacks` until a future, deliberate rename — code and tooling should not be
  changed to reference "barato" as an identifier in this pass.
- Future readers of the Sulit/Mura glossary entries should not be surprised that the app is
  named after the "Mura" word — this ADR and the `barato` glossary entry in CONTEXT.md exist
  specifically to answer that "why" the two moments it'll come up: someone reading the
  glossary, and someone reading the app name.
