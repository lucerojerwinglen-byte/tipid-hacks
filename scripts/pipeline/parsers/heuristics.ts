// Shared text-inference helpers for the deterministic (non-LLM) parsers in this directory.
// Each site's DOM structure is parsed by its own chain-specific file; this module only turns an
// item's name text into the serving/tag fields DATA-MODEL.md needs, the same judgment calls
// extract.ts's SYSTEM_PROMPT used to delegate to the LLM, now hand-coded and site-agnostic.

/** Pulls a leading integer price out of text like "₱ 134/ 740 Kcal." or "<strong>₱</strong> 290".
 * Takes the FIRST number after the peso sign — a trailing "/ NNN Kcal" is calorie count, not price. */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/<[^>]+>/g, "").replace(/&nbsp;|&amp;/g, " ");
  const m = cleaned.match(/₱\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const value = Number(m[1]!.replace(/,/g, ""));
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** "6-piece", "6 – pieces", "8pc", "2pc" -> 6/8/2. Defaults to 1 (a regular single-serve item). */
export function extractPieceCount(name: string): number {
  const m = name.match(/(\d+)\s*[-–]?\s*p(?:c|iece)s?\b/i);
  return m ? parseInt(m[1]!, 10) : 1;
}

/** True if the name mentions rice in a way that implies a carb serving is included — "1 Rice",
 * "Unli Rice", "UR" (this chain's own abbreviation for unlimited rice), "Rice Bowl". Excludes
 * "Ala Carte", which explicitly means no rice. */
export function impliesRice(name: string): boolean {
  if (/\bala\s*carte\b/i.test(name)) return false;
  return /\brice\b/i.test(name) || /\bUR\b/.test(name);
}

const PROTEIN_KEYWORDS: [RegExp, string][] = [
  [/\bchicken(?:joy)?\b/i, "chicken"],
  [/\bpork\b|\bliempo\b/i, "pork"],
  [/\bbeef\b|\bburger\s*steak\b/i, "beef"],
  [/\bbangus\b|\bfish\b|\btuna\b/i, "fish"],
  [/\bshrimp\b|\bebi\b/i, "shrimp"],
];

/** Best-effort dietary/protein tags from an item's own name text — same scope as the LLM's
 * "tags" field: only what's evident from the name, not a full ingredient lookup. */
export function inferProteinTags(name: string): string[] {
  const tags: string[] = [];
  for (const [re, tag] of PROTEIN_KEYWORDS) {
    if (re.test(name) && !tags.includes(tag)) tags.push(tag);
  }
  if (/\bspicy\b/i.test(name)) tags.push("spicy");
  return tags;
}

export function isShareable(name: string, serves: number): boolean {
  return serves > 1 || /\bbucket\b|\bfamily\b|\bparty\b|\bbilao\b|\bsharing\b/i.test(name);
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "...",
  mdash: "—",
  ndash: "–",
  rsquo: "'",
  lsquo: "'",
};

/** Strips tags and decodes entities from a small fragment of extracted text (item names). */
export function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|hellip|mdash|ndash|rsquo|lsquo);/g, (_, name) => HTML_ENTITIES[name] ?? _)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}
