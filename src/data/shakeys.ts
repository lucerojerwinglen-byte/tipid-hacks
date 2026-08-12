// Hand-maintained, same as src/data/chowking.ts — see sources.ts for why (Groq rate limits on
// KFC/Shakey's real menus). Prices below were verified by hand against the live site
// 2026-08-13: shakeyspizza.ph paginates each category behind a "LOAD MORE PRODUCTS" button, so
// getting the full item list needed clicking that on each of the 11 category pages
// (scripts/pipeline/sources.ts), and pizza sizing needed opening each product's page and
// stepping through its Crust/Size picker one option at a time to read the updated total (the
// category-list "Starts at ₱X" price is only the cheapest size). This stays a small
// representative sample of the real catalog (not an exhaustive scrape of all ~40 pizza flavors
// × sizes × crusts) — same scope as the original Milestone-2 set, just with real current prices
// and, where the old placeholder's exact item no longer exists on the live menu (the 1pc ala
// carte chicken, the plain "Regular" softdrink/mojos, and both combos), swapped for the closest
// real equivalent instead of guessing a number for a defunct SKU. This is the chain that forces
// the pizza dual-contribution modeling question (DATA-MODEL.md §4): a slice functions as a
// complete food unit, not a main paired with a separate carb.

import type { ChainData } from "../types.js";

export const shakeys: ChainData = {
  chain: {
    id: "shakeys",
    name: "Shakey's",
    source_url: "https://www.shakeyspizza.ph/catalog/categories/all",
    source_type: "official",
    last_updated: "2026-08-13",
    notes: "Hand-maintained — see file header. Verified against the live site 2026-08-13.",
  },
  items: [
    // Pizza sizes: main_servings/carb_servings both set to the slice-equivalent serving
    // count, per DATA-MODEL.md §4 — a slice is a complete main+carb unit, not a main that
    // still needs a separate rice/carb side the way a burger does. "Manager's Choice"
    // (ham, beef, Italian sausage, bell pepper, onion) is Shakey's own "no. 1 pizza" —
    // picked as the representative flavor since it matches the original placeholder's
    // meat profile. serves = the upper end of the site's own "Good for X-Y persons" label.
    {
      id: "sh-pizza-thin-regular",
      chain_id: "shakeys",
      name: "Manager's Choice Pizza (Thin Crust, Regular)",
      category: "main",
      price: 415,
      serves: 2,
      main_servings: 2,
      carb_servings: 2,
      shareable: true,
      is_combo: false,
      tags: ["pork", "beef"],
      available: true,
      price_confidence: "verified",
    },
    {
      id: "sh-pizza-thin-large",
      chain_id: "shakeys",
      name: "Manager's Choice Pizza (Thin Crust, Large)",
      category: "main",
      price: 635,
      serves: 4,
      main_servings: 4,
      carb_servings: 4,
      shareable: true,
      is_combo: false,
      tags: ["pork", "beef"],
      available: true,
      price_confidence: "verified",
    },
    {
      id: "sh-pizza-thin-party",
      chain_id: "shakeys",
      name: "Manager's Choice Pizza (Thin Crust, Party)",
      category: "main",
      price: 820,
      serves: 6,
      main_servings: 6,
      carb_servings: 6,
      shareable: true,
      is_combo: false,
      tags: ["pork", "beef"],
      available: true,
      price_confidence: "verified",
    },
    // The old placeholder's plain "1pc ala carte" chicken no longer exists on the live menu —
    // the smallest current chicken option already bundles Mojos.
    {
      id: "sh-chicken-n-mojos-1pc",
      chain_id: "shakeys",
      name: "Solo Pack (3pc Chicken with Mojos)",
      category: "main",
      price: 450,
      serves: 1,
      main_servings: 1,
      carb_servings: 0,
      shareable: false,
      is_combo: false,
      tags: ["chicken"],
      available: true,
      price_confidence: "verified",
    },
    {
      id: "sh-mojos-side",
      chain_id: "shakeys",
      name: "Solo Mojos (Potato Wedges)",
      category: "side",
      price: 169,
      serves: 1,
      main_servings: 0,
      carb_servings: 0,
      shareable: false,
      is_combo: false,
      tags: [],
      available: true,
      price_confidence: "verified",
    },
    // Pasta is another self-contained main+carb dish, same pattern as the pizza slice — comes
    // with garlic bread. Real name is bacon-based, not chicken, unlike the old placeholder.
    {
      id: "sh-carbonara",
      chain_id: "shakeys",
      name: "Carbonara Supreme (Solo, with Garlic Bread)",
      category: "main",
      price: 299,
      serves: 1,
      main_servings: 1,
      carb_servings: 1,
      shareable: false,
      is_combo: false,
      tags: ["pork"],
      available: true,
      price_confidence: "verified",
    },
    {
      id: "sh-drink-reg",
      chain_id: "shakeys",
      name: "Coke in Can",
      category: "drink",
      price: 99,
      serves: 1,
      main_servings: 0,
      carb_servings: 0,
      shareable: false,
      is_combo: false,
      tags: [],
      available: true,
      price_confidence: "verified",
    },
    // Single-scoop ice cream isn't on the live menu anymore; closest current dessert.
    {
      id: "sh-ice-cream",
      chain_id: "shakeys",
      name: "6\" Choc'O S'Mores (Dessert Pizza)",
      category: "dessert",
      price: 155,
      serves: 1,
      main_servings: 0,
      carb_servings: 0,
      shareable: false,
      is_combo: false,
      tags: [],
      available: true,
      price_confidence: "verified",
    },
    // Real named combo (Group Meals category): any Large pizza + a pasta platter or Solo Pack
    // chicken 'n Mojos + a 1L drink, for 3-4 persons. combo_contents omitted — the pasta/chicken
    // choice is an either/or the schema can't represent, so only the guaranteed pizza is listed.
    {
      id: "sh-mojos-pizza-combo",
      chain_id: "shakeys",
      name: "Family Meal Deal 1 (Large Pizza + Pasta or Chicken 'n Mojos + Drink, 3-4pax)",
      category: "combo",
      price: 1209,
      serves: 4,
      main_servings: 4,
      carb_servings: 4,
      shareable: true,
      is_combo: true,
      combo_contents: [{ item_id: "sh-pizza-thin-large", qty: 1 }],
      tags: ["pork", "beef", "chicken"],
      available: true,
      price_confidence: "verified",
    },
    // Real named combo (Combos category): a slice of pizza, Chicken 'n Mojos, Skilletti pasta,
    // and garlic bread on one plate — genuinely a solo-sized multi-item meal.
    {
      id: "sh-solo-combo",
      chain_id: "shakeys",
      name: "Bunch Of Lunch Original (Solo Combo)",
      category: "combo",
      price: 239,
      serves: 1,
      main_servings: 1,
      carb_servings: 1,
      shareable: false,
      is_combo: true,
      tags: ["chicken", "pork"],
      available: true,
      price_confidence: "verified",
    },
  ],
};
