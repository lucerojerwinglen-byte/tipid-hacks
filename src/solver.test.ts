// Covers SOLVER.md §8's test-case table. Cases 2-3 use the real Jollibee pipeline dataset —
// their assertions are structural (feasible/greater-than/etc.), not tied to exact prices, so
// they double as a live smoke test. Cases 1, 4-11 use small synthetic fixtures where a
// targeted, controlled scenario proves the point more clearly than the full menu would; per
// the planning brief, "the structural insight survives price drift even when exact numbers
// are stale" — case 1 in particular pins the brief's own illustrative peso figures (₱69/₱80,
// see DATA-MODEL.md §5), which real scraped pricing has no obligation to match. Cases 10-11
// cover ADR 0001 (docs/adr/0001-sulit-default-value-per-peso.md) — the "Sulit" value-per-peso
// objective that replaced "maximum-food"'s old raw-item-count objective.

import { describe, expect, it } from "vitest";
import { jollibee } from "./data/jollibee.js";
import { excludeTags, solve, solveAnyChain, computeNaiveBaseline } from "./solver.js";
import type { Chain, Item } from "./types.js";

const jollibeeItems = jollibee.items;

function item(overrides: Partial<Item> & Pick<Item, "id" | "price">): Item {
  return {
    chain_id: "test",
    name: overrides.id,
    category: "main",
    serves: 1,
    main_servings: 0,
    carb_servings: 0,
    shareable: false,
    is_combo: false,
    tags: [],
    available: true,
    price_confidence: "verified",
    ...overrides,
  };
}

describe("case 1: brief's own worked example — ₱300, 4 people, Jollibee, feed-everyone", () => {
  // Small synthetic fixture reproducing the brief's own illustrative prices exactly (DATA-
  // MODEL.md §5: ₱69 ala carte 1pc Chickenjoy w/ rice, ₱80 combo) — decoupled from the real
  // pipeline's Jollibee data, which reprices/restructures weekly and has no obligation to
  // still contain this exact ₱69 SKU or reproduce this exact scenario.
  const alaCarte = item({
    id: "jb-chickenjoy-1pc-rice",
    price: 69,
    category: "main",
    main_servings: 1,
    carb_servings: 1,
  });
  const combo = item({
    id: "jb-chickenjoy-combo",
    price: 80,
    category: "combo",
    main_servings: 1,
    carb_servings: 1,
    is_combo: true,
  });
  const items = [alaCarte, combo];
  const result = solve(items, 4, 300, "feed-everyone");

  it("finds the ala-carte combination, not the combo path", () => {
    expect(result.feasible).toBe(true);
    expect(result.coverageCost).toBe(276);
    expect(result.coverageItems).toEqual([{ item: alaCarte, qty: 4 }]);
  });

  it("reports ₱44 savings vs the naive (combo) baseline, matching PRD.md §2 exactly", () => {
    expect(computeNaiveBaseline(items, 4)).toBe(320); // 4 x ₱80 combo
    expect(result.savings).toBe(44);
  });

  it("leaves ₱24 unspent in feed-everyone's headline total, matching the brief's example", () => {
    expect(result.totalCost).toBe(276);
    expect(result.leftover).toBe(24);
  });
});

describe("case 2: ₱100, 8 people, feed-everyone — infeasible, honest partial fallback", () => {
  const result = solve(jollibeeItems, 8, 100, "feed-everyone");

  it("is not feasible, and auto-falls back to a partial cheapest-possible answer", () => {
    expect(result.feasible).toBe(false);
    expect(result.mode).toBe("feed-everyone"); // original requested mode is preserved
    expect(result.peopleCovered).toBeGreaterThan(0);
    expect(result.peopleCovered).toBeLessThan(8);
    expect(result.totalCost).toBeLessThanOrEqual(100);
  });

  it("does not report a misleading savings figure for a partial answer", () => {
    expect(result.savings).toBeNull();
  });
});

describe("case 3: budget exactly equals minimum feasible cost", () => {
  const minCost = solve(jollibeeItems, 4, 100_000, "feed-everyone").coverageCost;
  const result = solve(jollibeeItems, 4, minCost, "feed-everyone");

  it("has zero leftover and does not crash phase 2 on an empty budget", () => {
    expect(result.feasible).toBe(true);
    expect(result.leftover).toBe(0);
    expect(result.bonusItems).toEqual([]);
  });
});

describe("case 4: 1 person, large budget, maximum-food mode", () => {
  const result = solve(jollibeeItems, 1, 5000, "maximum-food");

  it("only requires covering 1 person, not over-assuming a larger group", () => {
    expect(result.feasible).toBe(true);
    expect(result.requestedHeadcount).toBe(1);
    expect(result.peopleCovered).toBe(1);
  });

  it("spends the leftover on bonus items as part of the total (unlike feed-everyone)", () => {
    expect(result.bonusItems.length).toBeGreaterThan(0);
    expect(result.totalCost).toBeGreaterThan(result.coverageCost);
    expect(result.totalCost).toBeLessThanOrEqual(5000);
  });
});

describe("case 5: bucket chosen despite 'wasting' servings beyond headcount", () => {
  // Small synthetic fixture: a bucket priced so it's cheaper than N singles even though it
  // over-covers the main requirement (SOLVER.md §8, case 5).
  const single = item({ id: "single", price: 100, category: "main", main_servings: 1, carb_servings: 1 });
  const bucket = item({
    id: "bucket-6",
    price: 250,
    category: "main",
    main_servings: 6,
    carb_servings: 0,
    shareable: true,
  });
  const rice = item({ id: "rice", price: 10, category: "rice", carb_servings: 1 });
  const items = [single, bucket, rice];

  it("picks the bucket + rice over 4 singles, despite 2 unused main-servings", () => {
    const result = solve(items, 4, 1000, "feed-everyone");
    expect(result.feasible).toBe(true);
    // 4 singles = 400; bucket(250) + 4 rice(40) = 290 — bucket path wins.
    expect(result.coverageCost).toBe(290);
    const bucketLine = result.coverageItems.find((i) => i.item.id === "bucket-6");
    expect(bucketLine?.qty).toBe(1);
  });
});

describe("case 6: unlimited-rice modeling (Mang Inasal-style)", () => {
  const main = item({ id: "inasal-main", price: 60, category: "main", main_servings: 1, carb_servings: 0 });
  const unlimitedRice = item({
    id: "unlimited-rice",
    price: 5,
    category: "rice",
    carb_servings: 10, // large constant, per DATA-MODEL.md §4
    shareable: true,
  });
  const items = [main, unlimitedRice];

  it("satisfies the carb requirement for the whole group near-free, not per-person", () => {
    const result = solve(items, 6, 1000, "feed-everyone");
    expect(result.feasible).toBe(true);
    // 6 mains (360) + a single ₱5 unlimited-rice order, not 6 separate rice purchases.
    expect(result.coverageCost).toBe(365);
    const riceLine = result.coverageItems.find((i) => i.item.id === "unlimited-rice");
    expect(riceLine?.qty).toBe(1);
  });
});

describe("case 7: pizza-style dual main+carb contribution (Shakey's-style)", () => {
  const slice = item({
    id: "pizza-slice",
    price: 40,
    category: "main",
    main_servings: 1,
    carb_servings: 1, // a slice counts as both, per DATA-MODEL.md §4
  });
  const items = [slice];

  it("covers both requirements from a single item type", () => {
    const result = solve(items, 4, 1000, "feed-everyone");
    expect(result.feasible).toBe(true);
    expect(result.coverageCost).toBe(160); // 4 x ₱40, no separate carb item needed
  });
});

describe("case 8: dietary filter removes all matching mains — distinct from budget-infeasibility", () => {
  // Synthetic fixture: every main-category item carries an excluded tag, so the filter
  // guarantees zero remaining "main" coverage (SOLVER.md §8 case 8's actual spec) — real
  // Jollibee data isn't a reliable vehicle for this, since its tags aren't an exhaustive
  // meat taxonomy (e.g. "burger steak"/"bacon" items aren't also tagged "beef"/"pork").
  const chickenMain = item({
    id: "chicken-main",
    price: 60,
    category: "main",
    main_servings: 1,
    carb_servings: 1,
    tags: ["chicken"],
  });
  const porkMain = item({
    id: "pork-main",
    price: 65,
    category: "main",
    main_servings: 1,
    carb_servings: 1,
    tags: ["pork"],
  });
  const riceOnly = item({ id: "rice-only", price: 10, category: "rice", carb_servings: 1 });
  const items = [chickenMain, porkMain, riceOnly];

  it("reports zero people covered when no item satisfies the coverage requirement at all", () => {
    const noMeatItems = excludeTags(items, ["chicken", "beef", "pork"]);
    const result = solve(noMeatItems, 4, 100_000, "feed-everyone");
    expect(result.feasible).toBe(false);
    expect(result.peopleCovered).toBe(0);
    // Distinguishing this from a budget-limited partial cover is a UI-layer concern
    // (OPEN-QUESTIONS.md) — at the solver level both look like peopleCovered < requested.
  });
});

describe("phase 2 respects the per-item quantity cap (regression: Mang Inasal's 79x-rice bug)", () => {
  // A cheap item with real value (like Mang Inasal's unlimited rice) — exactly the shape that
  // let the pre-fix version of maximizeLeftoverValue recommend dozens of copies (found while
  // building Milestone 2, ROADMAP.md). Under the value-maximizing objective (ADR 0001) this is
  // an even sharper trap than the old count objective: each copy is "worth" 10 value units for
  // ₱1, not just +1 item, so an uncapped version would chase it even harder.
  const main = item({ id: "main", price: 100, category: "main", main_servings: 1, carb_servings: 1 });
  const cheapValueExtra = item({ id: "cheap-extra", price: 1, category: "rice", carb_servings: 10 });
  const items = [main, cheapValueExtra];

  it("never suggests more than maxQtyFor(N) copies of a single bonus item", () => {
    const result = solve(items, 1, 1000, "maximum-food"); // huge leftover (₱900) at ₱1/unit
    const cheapLine = result.bonusItems.find((i) => i.item.id === "cheap-extra");
    expect(cheapLine?.qty).toBeLessThanOrEqual(3); // maxQtyFor(1) = min(1+2, 12) = 3
  });
});

describe("case 10: Sulit — maximum-food's leftover objective maximizes food value, not raw item count (ADR 0001)", () => {
  const covering = item({ id: "covering", price: 50, category: "main", main_servings: 1, carb_servings: 1 });
  // 0 main/carb servings, like every drink/dessert/side in the data model — cheaper per unit
  // than extraMain, so the old count-maximizing objective would have preferred it.
  const drink = item({ id: "drink", price: 10, category: "drink" });
  const extraMain = item({ id: "extra-main", price: 20, category: "main", main_servings: 1, carb_servings: 0 });
  const items = [covering, drink, extraMain];

  it("never spends leftover on a zero-value item, even though it's cheaper per unit", () => {
    const result = solve(items, 1, 90, "maximum-food"); // leftover = ₱40 after ₱50 coverage
    const drinkLine = result.bonusItems.find((i) => i.item.id === "drink");
    expect(drinkLine).toBeUndefined();
  });

  it("fills the leftover with the item that actually delivers food value instead", () => {
    const result = solve(items, 1, 90, "maximum-food");
    const extraLine = result.bonusItems.find((i) => i.item.id === "extra-main");
    expect(extraLine?.qty).toBe(2); // floor(40/20) = 2, within maxQtyFor(1) = 3
    expect(result.totalValue).toBe(4); // covering (1+1) + 2x extraMain (1 each)
  });
});

describe("case 11: any-chain ranking follows the selected mode's own objective (ADR 0001)", () => {
  function chain(id: string, name: string, items: Item[]): { chain: Chain; items: Item[] } {
    return {
      chain: { id, name, source_url: "", source_type: "official", last_updated: "2026-01-01" },
      items,
    };
  }

  // Chain A: cheap-ish coverage, but its only leftover-fill item is a zero-value drink — never
  // bought — and its leftover (₱80) is too small to afford a second covering item (₱120), so
  // its leftover budget goes entirely unspent and its total cost stays low.
  const chainA = chain("chain-a", "Chain A", [
    item({ id: "a-covering", price: 120, category: "main", main_servings: 1, carb_servings: 1 }),
    item({ id: "a-drink", price: 10, category: "drink" }),
  ]);
  // Chain B: pricier coverage, but its leftover-fill item delivers real value, so it fully
  // spends the budget and ends up delivering more total food value than Chain A.
  const chainB = chain("chain-b", "Chain B", [
    item({ id: "b-covering", price: 150, category: "main", main_servings: 1, carb_servings: 1 }),
    item({ id: "b-extra", price: 25, category: "main", main_servings: 1, carb_servings: 0 }),
  ]);
  const chains = [chainA, chainB];

  it("maximum-food (the default, Sulit): ranks by total value delivered — B wins despite costing more", () => {
    const { winner } = solveAnyChain(chains, 1, 200, "maximum-food");
    expect(winner.chain.id).toBe("chain-b");
    expect(winner.result.totalCost).toBe(200); // fully spent
    expect(winner.result.totalValue).toBe(4); // (1+1) coverage + 2x b-extra(1 each)
  });

  it("feed-everyone: still ranks by lowest cost, unaffected by the value-ranking change", () => {
    const { winner } = solveAnyChain(chains, 1, 200, "feed-everyone");
    expect(winner.chain.id).toBe("chain-a"); // ₱100 coverage beats Chain B's ₱150
  });
});

describe("case 9: ties are resolved deterministically", () => {
  const a = item({ id: "item-a", price: 50, category: "main", main_servings: 1, carb_servings: 1 });
  const b = item({ id: "item-b", price: 50, category: "main", main_servings: 1, carb_servings: 1 });
  const items = [a, b];

  it("always picks the same item on repeated solves of identical input", () => {
    const first = solve(items, 2, 1000, "feed-everyone");
    const second = solve(items, 2, 1000, "feed-everyone");
    expect(first.coverageItems).toEqual(second.coverageItems);
    expect(first.coverageItems).toEqual([{ item: a, qty: 2 }]); // "a" wins: earlier in array order
  });
});
