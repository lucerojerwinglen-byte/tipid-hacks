// Discovered running the real KFC pipeline (Milestone 5, ROADMAP.md): see dedupe.ts for the
// full story. Pure-function tests, no network/LLM call, run in `npm test`.

import { describe, expect, it } from "vitest";
import { dedupeByLowestPrice } from "./dedupe.js";
import type { ExtractedItem } from "./types.js";

function extracted(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    name: "Test Item",
    category: "main",
    price: 100,
    serves: 1,
    main_servings: 1,
    carb_servings: 0,
    shareable: false,
    is_combo: false,
    combo_component_names: [],
    tags: [],
    available: true,
    ...overrides,
  };
}

describe("dedupeByLowestPrice", () => {
  it("passes non-duplicate items through unchanged", () => {
    const items = [extracted({ name: "A", price: 50 }), extracted({ name: "B", price: 60 })];
    const result = dedupeByLowestPrice(items);
    expect(result.items).toHaveLength(2);
    expect(result.droppedCount).toBe(0);
  });

  it("collapses same name+category duplicates, keeping the lower price (KFC's delivery-vs-pickup case)", () => {
    const items = [
      extracted({ name: "Zinger Burger", category: "main", price: 195 }),
      extracted({ name: "Zinger Burger", category: "main", price: 185 }),
    ];
    const result = dedupeByLowestPrice(items);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.price).toBe(185);
    expect(result.droppedCount).toBe(1);
  });

  it("keeps the lower price regardless of which duplicate appears first", () => {
    const items = [
      extracted({ name: "Zinger Burger", category: "main", price: 185 }),
      extracted({ name: "Zinger Burger", category: "main", price: 195 }),
    ];
    const result = dedupeByLowestPrice(items);
    expect(result.items[0]?.price).toBe(185);
  });

  it("does not merge same-name items in different categories", () => {
    const items = [
      extracted({ name: "Rice", category: "rice", price: 20 }),
      extracted({ name: "Rice", category: "combo", price: 200 }),
    ];
    const result = dedupeByLowestPrice(items);
    expect(result.items).toHaveLength(2);
    expect(result.droppedCount).toBe(0);
  });

  it("is case- and whitespace-insensitive on the name", () => {
    const items = [
      extracted({ name: "Zinger Burger", category: "main", price: 195 }),
      extracted({ name: "  ZINGER BURGER  ", category: "main", price: 185 }),
    ];
    const result = dedupeByLowestPrice(items);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.price).toBe(185);
  });

  it("handles three-or-more-way duplicates", () => {
    const items = [
      extracted({ name: "X", price: 300 }),
      extracted({ name: "X", price: 100 }),
      extracted({ name: "X", price: 200 }),
    ];
    const result = dedupeByLowestPrice(items);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.price).toBe(100);
    expect(result.droppedCount).toBe(2);
  });
});
