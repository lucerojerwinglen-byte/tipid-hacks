// Deterministic parser for mcdomenuprices.com.ph — replaces the Groq LLM-extraction step for
// this chain (sources.ts). Unlike Jollibee's site, there's no separate <table>; every item here
// is a Kadence "advanced heading" paragraph pair in document order — a name paragraph immediately
// followed by a price paragraph (`<p class="kt-adv-heading...">`, price text always containing
// "₱"). Pairing by document-order adjacency (rather than a fixed class-name suffix, which Kadence
// randomizes per block) is what makes this robust to the page's own markup churn.

import { parse as parseHtml } from "node-html-parser";
import type { ExtractedItem } from "../types.js";
import { cleanText, extractPieceCount, inferProteinTags, isShareable, parsePrice } from "./heuristics.js";

type ItemCategory = ExtractedItem["category"];

const DRINK_RE =
  /\b(coke|sprite|royal|iced tea|orange juice|apple juice|mcshake|mccafé|mccafe|espresso|cappuccino|americano|latte|mocha(?:ccino)?|frappe|smoothie|cereal milk|coffee)\b/i;
const DESSERT_RE = /\b(pie|puff|mcflurry|sundae|cheesecake|cake|cookies?|banana slice)\b/i;
const RICE_SIDE_RE = /\bextra plain rice\b/i;
const SIDE_RE = /\b(fries|sauce|dunk|gravy|mayonnaise|cheese\b(?!burger)|croissant)\b/i;
const COMBO_RE = /\bmeal\b|\bcombo\b|\bbundle\b|\bbox\b|\bmcshare\b|\bbff\b|\bhappy meal\b/i;
// The aggregator's own page has at least one clear data-entry error: "Golden Chicken Curry
// Fillet with Medium Drink" priced at ₱1119, next to sibling items in the ₱100-180 range and a
// near-identical "...with Fries Medium Meal" at ₱181 — obviously not a real solo-item price on a
// menu that otherwise tops out around ₱375 (a 20-pc nugget order) outside the family-bundle
// tier. Guard against this class of error rather than silently committing an invented number.
const MAX_PLAUSIBLE_NON_COMBO_PRICE = 500;
const MAIN_DISH_RE =
  /\bchees?e?burger\b|\bbig mac\b|\bquarter pounder\b|\bbcb\b|\bmcchicken\b|\bchicken\b|\bmcnuggets?\b|\bmcspaghetti\b|\bmushroom pepper steak\b|\bburger\b|\bwrap\b|\bhotdog\b|\bsandwich\b|\bfillet\b/i;

const MCDO_PROTEIN_KEYWORDS: [RegExp, string][] = [
  [/\bchicken\b/i, "chicken"],
  [/\bchees?e?burger\b|\bbig mac\b|\bquarter pounder\b|\bburger mcdo\b|\bmushroom pepper steak\b|\bbcb\b/i, "beef"],
  [/\bsausage\b/i, "pork"],
  [/\bfish\b/i, "fish"],
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

/** 0 unless the name actually names a protein dish or an explicit piece count — a plain "Extra
 * BBQ Sauce" or "Coke Zero Sugar" never gets main_servings just because it shares a "Meal"
 * bundle name pattern with real food items elsewhere on the page. McNuggets are bite-sized, not
 * a full main-course unit per piece, so they're normalized at ~6 pieces per serving. */
function inferMainServings(name: string): number {
  // "McShare Bundle for 4" states its serving count directly, with no piece-count/dish keyword
  // to key off of otherwise.
  const forN = name.match(/\bfor (\d+)\b/i);
  if (forN) return parseInt(forN[1]!, 10);
  if (!MAIN_DISH_RE.test(name)) return 0;
  const piece = extractPieceCount(name);
  if (/\bmcnuggets?\b/i.test(name)) return Math.max(1, Math.round(piece / 6));
  return piece;
}

function inferCarbServings(name: string): number {
  const explicit = name.match(/(\d+)\s*rice\b/i);
  if (explicit) return parseInt(explicit[1]!, 10);
  if (/\brice\b|\bmcspaghetti\b/i.test(name)) return 1;
  return 0;
}

export function parse(html: string): ExtractedItem[] {
  const root = parseHtml(html);
  const paras = root.querySelectorAll("p[class*='kt-adv-heading']");

  const items: ExtractedItem[] = [];
  for (let i = 0; i < paras.length; i++) {
    const text = cleanText(paras[i]!.text);
    if (!text || /₱/.test(text)) continue; // this slot is a price, or empty — handled as the "next" of some name

    const nextRaw = paras[i + 1]?.text;
    if (!nextRaw || !/₱/.test(nextRaw)) continue; // no adjacent price — not a menu item (nav/heading text)

    const price = parsePrice(nextRaw);
    if (price === null) continue;

    const category = categorize(text);
    if (category !== "combo" && price > MAX_PLAUSIBLE_NON_COMBO_PRICE) continue;
    const mainServings = inferMainServings(text);
    const carbServings = inferCarbServings(text);
    const serves = mainServings > 1 ? mainServings : 1;

    const tags = inferProteinTags(text);
    for (const [re, tag] of MCDO_PROTEIN_KEYWORDS) {
      if (re.test(text) && !tags.includes(tag)) tags.push(tag);
    }
    if (/\bspicy\b/i.test(text) && !tags.includes("spicy")) tags.push("spicy");

    items.push({
      name: text,
      category,
      price,
      serves,
      main_servings: mainServings,
      carb_servings: carbServings,
      shareable: isShareable(text, serves),
      is_combo: false,
      combo_component_names: [],
      tags,
      available: true,
    });
  }

  return items;
}
