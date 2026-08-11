// Covers SOLVER.md §8's test-case table. Cases 1-3, 8 use the real hand-typed Jollibee
// dataset (Milestone 0); cases 4-7, 9 use small synthetic fixtures where a targeted,
// controlled scenario proves the point more clearly than the full menu would.

import { describe, expect, it } from "vitest";
import { jollibee } from "./data/jollibee.js";
import { excludeTags, solve, computeNaiveBaseline } from "./solver.js";
import type { Item } from "./types.js";

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
  const result = solve(jollibeeItems, 4, 300, "feed-everyone");

  it("finds the ala-carte combination, not the combo path", () => {
    expect(result.feasible).toBe(true);
    expect(result.coverageCost).toBe(276);
    expect(result.coverageItems).toEqual([
      { item: jollibeeItems.find((i) => i.id === "jb-chickenjoy-1pc-rice"), qty: 4 },
    ]);
  });

  it("reports ₱44 savings vs the naive (combo) baseline, matching PRD.md §2 exactly", () => {
    expect(computeNaiveBaseline(jollibeeItems, 4)).toBe(320); // 4 x ₱80 combo
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
  it("reports zero people covered when no item satisfies the coverage requirement at all", () => {
    const noMeatItems = excludeTags(jollibeeItems, ["chicken", "beef", "pork"]);
    const result = solve(noMeatItems, 4, 100_000, "feed-everyone");
    expect(result.feasible).toBe(false);
    expect(result.peopleCovered).toBe(0);
    // Distinguishing this from a budget-limited partial cover is a UI-layer concern
    // (OPEN-QUESTIONS.md) — at the solver level both look like peopleCovered < requested.
  });
});

describe("phase 2 respects the per-item quantity cap (regression: Mang Inasal's 79x-rice bug)", () => {
  // A very cheap item with no coverage contribution — exactly the shape that let the
  // pre-fix version of maximizeLeftoverValue recommend dozens of copies of Mang Inasal's
  // ₱5 unlimited-rice add-on (found while building Milestone 2, ROADMAP.md).
  const main = item({ id: "main", price: 100, category: "main", main_servings: 1, carb_servings: 1 });
  const cheapExtra = item({ id: "cheap-extra", price: 1, category: "side" });
  const items = [main, cheapExtra];

  it("never suggests more than maxQtyFor(N) copies of a single bonus item", () => {
    const result = solve(items, 1, 1000, "feed-everyone"); // huge leftover (₱900) at ₱1/unit
    const cheapLine = result.bonusItems.find((i) => i.item.id === "cheap-extra");
    expect(cheapLine?.qty).toBeLessThanOrEqual(3); // maxQtyFor(1) = min(1+2, 12) = 3
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
