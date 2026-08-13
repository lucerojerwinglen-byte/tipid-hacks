// Deterministic parser for manginasal.ph/news/menu-and-prices — replaces the Groq LLM-extraction
// step for this chain (sources.ts). The page's menu is a single well-formed HTML table: Category
// (rowspan'd down its group) | Product | Price. Walking the table directly fixes a real bug the
// old LLM extraction had: working from stripped visible text (fetch.ts's stripHtmlNoise), it lost
// the rowspan'd Category cell for the Palabok/Chicken Palabok groups, so "Solo"/"Value Meal"/
// "Family Size"/"Party Size" ended up as bare, indistinguishable item names — the table's own
// structure makes this unambiguous.
//
// Per-category rules below encode the same judgment calls extract.ts's SYSTEM_PROMPT used to
// delegate to the LLM (serving counts, rice/carb inclusion, bulk-bundle multipliers), reverse
// engineered from this table's own naming conventions (piece counts, "Value Meal"/"Rice"/"UR"
// implying a rice serving, "FFM" prefix on Family Fiesta marking the rice-inclusive variant). Not
// a byte-for-byte replication of the old (buggy) LLM output — a consistent ruleset beats
// hand-copying inconsistencies the LLM itself introduced.

import { parse as parseHtml } from "node-html-parser";
import type { ExtractedItem } from "../types.js";
import { cleanText, impliesRice, inferProteinTags, isShareable, parsePrice } from "./heuristics.js";

type ItemCategory = ExtractedItem["category"];

interface CategoryRule {
  category: ItemCategory;
  extraTags?: string[];
  /** Multiplies every piece/segment-derived main_servings count — Family Fiesta rows are 5x the
   * single-serve Solo Fiesta equivalent of the same name pattern. */
  bulkFactor?: number;
  /** Fixed `serves` for every product in this raw category, overriding the name-derived guess. */
  servesOverride?: number;
  /** Carb (rice) inclusion rule for this raw category — most categories infer it from the
   * product name (impliesRice/"Value Meal"), but a few need a category-level override. */
  carb: "from-name" | "always" | "never" | "ffm-prefix";
}

// Keyed by the table's own <strong>Category</strong> cell text.
const CATEGORY_RULES: Record<string, CategoryRule> = {
  "Chicken Inasal": { category: "main", extraTags: ["chicken"], carb: "from-name" },
  "Pork BBQ": { category: "main", extraTags: ["pork"], carb: "from-name" },
  "Spicy Pork BBQ": { category: "main", extraTags: ["pork", "spicy"], carb: "from-name" },
  "Chicken BBQ": { category: "main", extraTags: ["chicken"], carb: "from-name" },
  "Spicy Chicken BBQ": { category: "main", extraTags: ["chicken", "spicy"], carb: "from-name" },
  "Liempo (v2)": { category: "main", extraTags: ["pork"], carb: "from-name" },
  Sisig: { category: "main", carb: "from-name" }, // protein tag inferred per-item (Pork/Chicken/Bangus Sisig)
  "Halo-Halo": { category: "dessert", carb: "never" },
  "Solo Fiesta": { category: "combo", carb: "always", servesOverride: 1 },
  "ASF Solo Fiesta": { category: "combo", carb: "always", servesOverride: 1 },
  "Family Fiesta": { category: "combo", carb: "ffm-prefix", bulkFactor: 5, servesOverride: 5 },
  "Lumpiang Togue": { category: "side", extraTags: ["vegetable"], carb: "never" },
  Palabok: { category: "main", extraTags: ["noodles"], carb: "never" },
  "Chicken Palabok": { category: "main", extraTags: ["chicken", "noodles"], carb: "never" },
  "Breakfast Almusolb": { category: "main", extraTags: ["breakfast"], carb: "always" },
  Sulitbowls: { category: "main", carb: "always" }, // every product name already ends "Rice Bowl"
  "Ihaw-sarap Combos": { category: "combo", carb: "always", servesOverride: 2 },
};

function inferSingleMainServings(segment: string): number {
  const piece = segment.match(/(\d+)\s*[-–]?\s*p(?:c|iece)s?\b/i);
  if (piece) return parseInt(piece[1]!, 10);
  if (/\bbuddy\b/i.test(segment)) return 2;
  if (/\bfamily\b/i.test(segment)) return 5;
  if (/\bparty\b/i.test(segment)) return 10;
  if (/halo[\s-]?halo/i.test(segment)) return 0; // dessert component, not a main
  return 1;
}

/** Combo product names join components with "+"/"&" (e.g. "Paa + Pork BBQ") — sum each side. */
function inferMainServings(name: string): number {
  const segments = name.split(/\s*[+&]\s*/);
  return segments.reduce((sum, seg) => sum + inferSingleMainServings(seg), 0);
}

function inferServes(name: string, mainServings: number, override?: number): number {
  if (override !== undefined) return override;
  if (mainServings > 2) return Math.max(1, Math.round(mainServings / 2));
  return 1;
}

/** "Solo"/"Value Meal"/"Family Size"/"Party Size" alone aren't distinguishing names — prefix the
 * category (this is exactly the info the old LLM run lost, per the file header). */
function buildItemName(rawCategory: string, product: string): string {
  const GENERIC_PRODUCT_NAMES = new Set(["Solo", "Value Meal", "Family Size", "Party Size"]);
  return GENERIC_PRODUCT_NAMES.has(product) ? `${rawCategory} ${product}` : product;
}

export function parse(html: string): ExtractedItem[] {
  const root = parseHtml(html);
  const table = root.querySelector("table.table-bordered") ?? root.querySelector("table");
  if (!table) throw new Error("mang-inasal parser: no menu table found in fetched HTML.");

  const items: ExtractedItem[] = [];
  let currentRawCategory = "";

  for (const row of table.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue; // header rows (th) or the 2-col "DINE-IN/TAKEOUT" sub-header

    // 3-cell rows: [category (may be empty -> carries forward), product, price].
    // Some rows render only 2 <td> if the category cell was entirely absent from this <tr>'s
    // markup (still rowspan'd from above) rather than present-but-empty.
    const [categoryCell, productCell, priceCell] = cells.length === 3 ? cells : [null, cells[0], cells[1]];

    const categoryText = categoryCell ? cleanText(categoryCell.text) : "";
    if (categoryText) currentRawCategory = categoryText;
    if (!currentRawCategory) continue; // before the first real category row

    const product = cleanText(productCell!.text);
    const price = priceCell ? parsePrice(priceCell.text) : null;
    if (!product || price === null) continue;

    const rule = CATEGORY_RULES[currentRawCategory];
    if (!rule) continue; // unrecognized category grouping — skip rather than guess

    const name = buildItemName(currentRawCategory, product);
    const mainServings = inferMainServings(product) * (rule.bulkFactor ?? 1);

    let carbServings: number;
    switch (rule.carb) {
      case "always":
        carbServings = 1;
        break;
      case "never":
        carbServings = 0;
        break;
      case "ffm-prefix":
        carbServings = /^FFM\b/i.test(product) ? 1 : 0;
        break;
      default:
        carbServings = impliesRice(product) || /\bvalue meal\b/i.test(product) ? 1 : 0;
    }

    const serves = inferServes(product, mainServings, rule.servesOverride);
    const tags = [...(rule.extraTags ?? [])];
    for (const tag of inferProteinTags(product)) {
      if (!tags.includes(tag)) tags.push(tag);
    }
    // "Paa"/"Pecho" (chicken leg/breast) are this chain's own names for chicken cuts, not
    // generic English protein words the shared heuristic recognizes.
    if (/\bpaa\b|\bpecho\b/i.test(product) && !tags.includes("chicken")) tags.push("chicken");

    items.push({
      name,
      category: rule.category,
      price,
      serves,
      main_servings: mainServings,
      carb_servings: carbServings,
      shareable: isShareable(product, serves),
      is_combo: false,
      combo_component_names: [],
      tags,
      available: true,
    });
  }

  return items;
}
