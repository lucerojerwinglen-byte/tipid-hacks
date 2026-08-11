// ROADMAP.md Milestone 4: "a deliberately-broken test run (e.g. malformed fetch) gets caught
// and blocked, not silently merged." These are pure-function tests against validate.ts/ids.ts
// directly — no network, no LLM call — so they run in `npm test` like the rest of the suite.

import { describe, expect, it } from "vitest";
import { validateExtractedItems } from "./validate.js";
import { assignIdsAndResolveCombos } from "./ids.js";
import type { Item } from "../../src/types.js";
import type { ExtractedItem } from "./types.js";

function item(overrides: Partial<Item>): Item {
  return {
    id: "test-item",
    chain_id: "jollibee",
    name: "Test Item",
    category: "main",
    price: 69,
    serves: 1,
    main_servings: 1,
    carb_servings: 0,
    shareable: false,
    is_combo: false,
    tags: [],
    available: true,
    price_confidence: "verified",
    ...overrides,
  };
}

function extracted(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    name: "Test Item",
    category: "main",
    price: 69,
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

describe("sanity rule: nonsensical price (DATA-PIPELINE.md §3)", () => {
  it("blocks a ₱9,000 single item — a broken parse, not a real price", () => {
    const result = validateExtractedItems([item({ price: 9000 })], []);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("nonsensical"))).toBe(true);
  });

  it("blocks a ₱9 item as too cheap to be real", () => {
    const result = validateExtractedItems([item({ price: 9 })], []);
    expect(result.ok).toBe(false);
  });

  it("allows a real family-size combo price without false-positiving", () => {
    const result = validateExtractedItems([item({ price: 895 })], []);
    expect(result.ok).toBe(true);
  });
});

describe("sanity rule: price change >30% (DATA-PIPELINE.md §3)", () => {
  it("blocks a >30% swing on a matching id and flags it for review, doesn't silently apply it", () => {
    const previous = [item({ id: "jb-chickenjoy-1pc", price: 69 })];
    const broken = [item({ id: "jb-chickenjoy-1pc", price: 200 })]; // +190%
    const result = validateExtractedItems(broken, previous);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("exceeding the 30% sanity threshold"))).toBe(true);
  });

  it("allows a normal small price bump", () => {
    const previous = [item({ id: "jb-chickenjoy-1pc", price: 69 })];
    const updated = [item({ id: "jb-chickenjoy-1pc", price: 72 })]; // +4%
    const result = validateExtractedItems(updated, previous);
    expect(result.ok).toBe(true);
  });

  it("does not apply the price-change rule to a manual-override item (it's human-vetted)", () => {
    const previous = [item({ id: "mi-unlimited-rice", price: 5, price_confidence: "manual-override" })];
    // A pipeline run would never re-extract this id (it's LLM-invisible per DATA-MODEL.md §2),
    // but the rule must not misfire even if an id happened to collide.
    const updated = [item({ id: "mi-unlimited-rice", price: 50 })];
    const result = validateExtractedItems(updated, previous);
    expect(result.ok).toBe(true);
  });
});

describe("sanity rule: item count drop (DATA-PIPELINE.md §3)", () => {
  it("blocks a sharp drop — the classic 'page failed to render' symptom", () => {
    const previous = Array.from({ length: 20 }, (_, i) => item({ id: `jb-item-${i}` }));
    const broken = Array.from({ length: 3 }, (_, i) => item({ id: `jb-item-${i}` })); // an 85% drop
    const result = validateExtractedItems(broken, previous);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Item count dropped"))).toBe(true);
  });

  it("allows a small, plausible menu trim (an LTO rotating out)", () => {
    const previous = Array.from({ length: 20 }, (_, i) => item({ id: `jb-item-${i}` }));
    const trimmed = Array.from({ length: 18 }, (_, i) => item({ id: `jb-item-${i}` }));
    const result = validateExtractedItems(trimmed, previous);
    expect(result.ok).toBe(true);
  });

  it("doesn't block the very first run for a chain (nothing to compare against yet)", () => {
    const result = validateExtractedItems([item({})], []);
    expect(result.ok).toBe(true);
  });
});

describe("combo reference integrity", () => {
  it("blocks a combo whose component id doesn't resolve to a real item", () => {
    const items = [
      item({ id: "jb-combo", is_combo: true, combo_contents: [{ item_id: "jb-does-not-exist", qty: 1 }] }),
    ];
    const result = validateExtractedItems(items, []);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("unknown component id"))).toBe(true);
  });
});

describe("assignIdsAndResolveCombos: id generation and combo resolution", () => {
  it("generates unique, prefixed, slugified ids", () => {
    const { items } = assignIdsAndResolveCombos(
      [extracted({ name: "Chickenjoy 1pc (Ala Carte, no rice)" })],
      "jollibee",
      "jb",
    );
    expect(items[0]!.id).toBe("jb-chickenjoy-1pc-ala-carte-no-rice");
    expect(items[0]!.chain_id).toBe("jollibee");
  });

  it("de-duplicates a repeated name with a numeric suffix instead of silently colliding", () => {
    const { items } = assignIdsAndResolveCombos(
      [extracted({ name: "Softdrink" }), extracted({ name: "Softdrink" })],
      "jollibee",
      "jb",
    );
    expect(items[0]!.id).not.toBe(items[1]!.id);
  });

  it("resolves combo_component_names to combo_contents by matching names within the batch", () => {
    const { items, errors } = assignIdsAndResolveCombos(
      [
        extracted({ name: "Chickenjoy 1pc" }),
        extracted({ name: "Softdrink" }),
        extracted({
          name: "Chickenjoy Combo",
          is_combo: true,
          combo_component_names: [
            { name: "Chickenjoy 1pc", qty: 1 },
            { name: "Softdrink", qty: 1 },
          ],
        }),
      ],
      "jollibee",
      "jb",
    );
    expect(errors).toEqual([]);
    const combo = items.find((i) => i.name === "Chickenjoy Combo")!;
    expect(combo.combo_contents).toEqual([
      { item_id: "jb-chickenjoy-1pc", qty: 1 },
      { item_id: "jb-softdrink", qty: 1 },
    ]);
  });

  it("reports an error (doesn't silently drop) when a combo references a name not in the batch", () => {
    const { errors } = assignIdsAndResolveCombos(
      [
        extracted({
          name: "Mystery Combo",
          is_combo: true,
          combo_component_names: [{ name: "Item That Was Never Extracted", qty: 1 }],
        }),
      ],
      "jollibee",
      "jb",
    );
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Mystery Combo");
  });
});
