// Five of six chains' pipeline sources (DATA-PIPELINE.md §1). Jollibee, McDonald's, and Mang
// Inasal (Milestone 4) are plain HTTP fetches; KFC and Shakey's (Milestone 5) are JS-rendered
// SPAs and need Playwright (fetch_method dispatches this in run.ts). Chowking is deliberately
// NOT here: Milestone 5 confirmed its menu-data API sits behind Cloudflare bot protection
// (returns HTTP 403 to anything but a full real-browser session, and even that only fires the
// call inconsistently) — see DATA-PIPELINE.md §1 for the discovery and why this project doesn't
// attempt to route around it. src/data/chowking.ts stays hand-maintained until that changes.

import type { PipelineSource } from "./types.js";

export const PIPELINE_SOURCES: PipelineSource[] = [
  {
    chain_id: "jollibee",
    chain_name: "Jollibee",
    source_url: "https://jollibeemenuprice.net/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "jb",
    export_var_name: "jollibee",
  },
  {
    chain_id: "mcdonalds",
    chain_name: "McDonald's",
    source_url: "https://mcdomenuprices.com.ph/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "mc",
    export_var_name: "mcdonalds",
  },
  {
    chain_id: "mang-inasal",
    chain_name: "Mang Inasal",
    source_url: "https://www.manginasal.ph/news/menu-and-prices",
    source_type: "official",
    fetch_method: "http",
    id_prefix: "mi",
    export_var_name: "mangInasal",
  },
  {
    chain_id: "kfc",
    chain_name: "KFC",
    // The homepage is a landing shell with no prices — "OUR MENU" resolves to this path
    // client-side, and it's the one that actually renders the priced catalog once Playwright
    // loads it (confirmed by hand during Milestone 5).
    source_url: "https://www.kfc.com.ph/en/menu",
    source_type: "official",
    fetch_method: "playwright",
    id_prefix: "kfc",
    export_var_name: "kfc",
  },
  {
    chain_id: "shakeys",
    chain_name: "Shakey's",
    source_url: "https://www.shakeyspizza.ph/catalog/categories/all",
    source_type: "official",
    fetch_method: "playwright",
    // /catalog/categories/all never actually renders products (confirmed by hand — it's a
    // permanent category-nav shell, not a lazy-load timing issue). Every real category *does*
    // render its items directly, so fetch each one and let run.ts join them. Deliberately
    // excludes "Promos" (category 34, time-limited) to mirror how the other five chains' pages
    // only ever exposed standing menu prices, not flash offers.
    fetch_urls: [
      "https://www.shakeyspizza.ph/catalog/categories/3", // Pizza
      "https://www.shakeyspizza.ph/catalog/categories/4", // Group Meals
      "https://www.shakeyspizza.ph/catalog/categories/33", // Chicken 'n Mojos
      "https://www.shakeyspizza.ph/catalog/categories/36", // Combos
      "https://www.shakeyspizza.ph/catalog/categories/143", // Sandwiches
      "https://www.shakeyspizza.ph/catalog/categories/25", // Pasta
      "https://www.shakeyspizza.ph/catalog/categories/26", // Starters
      "https://www.shakeyspizza.ph/catalog/categories/18", // Soup & Salad
      "https://www.shakeyspizza.ph/catalog/categories/98", // Desserts
      "https://www.shakeyspizza.ph/catalog/categories/11", // Drinks
      "https://www.shakeyspizza.ph/catalog/categories/24", // Extras
    ],
    id_prefix: "sh",
    export_var_name: "shakeys",
  },
];

export function getSource(chainId: string): PipelineSource {
  const source = PIPELINE_SOURCES.find((s) => s.chain_id === chainId);
  if (!source) {
    throw new Error(
      `No pipeline source for chain "${chainId}". Available: ${PIPELINE_SOURCES.map((s) => s.chain_id).join(", ")}`,
    );
  }
  return source;
}
