// Deterministic parser for jollibeemenuprice.net — replaces the Groq LLM-extraction step for
// this chain (sources.ts). The page renders every menu section twice: a decorative info-box
// card grid (kt-blocks-info-box divs) and a plain <table><tr><td>name</td><td>price</td></tr>
// list with the same content — except one section ("Family Pack" bundles) exists ONLY as a
// table, never as cards. Parsing every <table> on the page therefore gets strictly more coverage
// than the card grid, with a simpler two-cell-per-row shape, so that's the only source used here.
//
// This third-party aggregator's own content has real data-entry mistakes (e.g. one row prices
// "Jolly Spaghetti W/ Drink" at ₱745, clearly copy-pasted from a nearby bucket-meal row — the
// same item appears correctly priced at ₱82-93 elsewhere on the page). dedupe.ts's
// keep-the-lower-price rule (stage 4.5 in run.ts) is what actually neutralizes this: it's already
// dine-in/pickup-safe by construction, so a same-name/category duplicate resolving to the cheaper
// (correct) reading is the right outcome, not a bug in this parser.

import { parse as parseHtml } from "node-html-parser";
import type { ExtractedItem } from "../types.js";
import { cleanText, extractPieceCount, inferProteinTags, isShareable, parsePrice } from "./heuristics.js";

type ItemCategory = ExtractedItem["category"];

const DRINK_RE =
  /\b(coke|sprite|royal|sarsi|iced (tea|mocha|latte|sweet)|pineapple juice|soda floats?|coffee|hot chocolate|hot fresh brew|minute maid|orange juice)\b/i;
const DESSERT_RE = /\b(pie|sundae|choco mallow)\b/i;
const RICE_SIDE_RE = /\badditional rice\b/i;
const SIDE_RE = /\b(fries|macaroni soup|gravy)\b/i;
const COMBO_RE =
  /\b(bucket|family|kiddie meal|kids meal|combo|family pack|family pan|family savers|super meal|fiesta)\b/i;
// A dish keyword outranks a trailing "w/ Drink"/"& Pie" add-on: "Chickenjoy w/ Coke Float" is a
// chicken meal, not a drink, and must keep its main_servings even though "Coke" is in the name.
const MAIN_DISH_RE =
  /\bchickenjoy\b|\bnuggets?\b|\byumburger\b|\bburger steak\b|\bchamp\b|\bcorned beef\b|\bbeef tapa\b|\blongganisa\b|\bhotdog\b|\bpancakes?\b|\bsandwich\b|\bfillet\b|\bspaghetti\b/i;

const JOLLIBEE_PROTEIN_KEYWORDS: [RegExp, string][] = [
  [/\byum'?s?\s*yumburger\b|\byumburger\b|\bchamp\b|\bcorned beef\b|\bbeef tapa\b|\bburger steak\b/i, "beef"],
  [/\blongganisa\b|\bbacon\b|\bhotdog\b/i, "pork"],
  [/\btuna\b/i, "fish"],
];

function categorize(name: string): ItemCategory {
  if (COMBO_RE.test(name)) return "combo";
  if (MAIN_DISH_RE.test(name)) return "main";
  if (DRINK_RE.test(name)) return "drink";
  if (DESSERT_RE.test(name)) return "dessert";
  if (RICE_SIDE_RE.test(name)) return "rice";
  if (SIDE_RE.test(name)) return "side";
  return "main";
}

/** Explicit "N Rice" in a family-pack name (e.g. "10piece Chickenjoy w/ 5 Peach Mango Pie, 5
 * Rice, 5 Drinks") scales carb_servings with that stated count; otherwise a plain rice/spaghetti
 * mention is a flat one serving. Computed from the name directly, independent of the final
 * display category, so a combo/main item that also mentions a dessert/drink add-on doesn't lose
 * its coverage credit. */
function inferCarbServings(name: string): number {
  const explicit = name.match(/(\d+)\s*rice\b/i);
  if (explicit) return parseInt(explicit[1]!, 10);
  if (/\brice\b|\bspaghetti\b/i.test(name)) return 1;
  return 0;
}

/** 0 unless the name actually names a protein dish or an explicit piece count — a standalone
 * drink/dessert/side never gets main_servings just because a family-pack name mentions one. */
function inferMainServings(name: string): number {
  if (!MAIN_DISH_RE.test(name) && !/\d+\s*p(?:c|iece)s?\b/i.test(name)) return 0;
  return extractPieceCount(name);
}

export function parse(html: string): ExtractedItem[] {
  const root = parseHtml(html);
  const items: ExtractedItem[] = [];

  for (const table of root.querySelectorAll("table")) {
    for (const row of table.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length !== 2) continue; // header/opening-hours-style rows — not menu items

      const name = cleanText(cells[0]!.text);
      const price = parsePrice(cells[1]!.text);
      if (!name || price === null) continue;

      const category = categorize(name);
      const mainServings = inferMainServings(name);
      const carbServings = inferCarbServings(name);
      const serves = mainServings > 1 ? mainServings : 1;

      const tags = inferProteinTags(name);
      for (const [re, tag] of JOLLIBEE_PROTEIN_KEYWORDS) {
        if (re.test(name) && !tags.includes(tag)) tags.push(tag);
      }
      if (/\bspaghetti\b/i.test(name) && !tags.includes("spaghetti")) tags.push("spaghetti");
      if (/\bspicy\b/i.test(name) && !tags.includes("spicy")) tags.push("spicy");

      items.push({
        name,
        category,
        price,
        serves,
        main_servings: mainServings,
        carb_servings: carbServings,
        shareable: isShareable(name, serves),
        is_combo: false,
        combo_component_names: [],
        tags,
        available: true,
      });
    }
  }

  return items;
}
