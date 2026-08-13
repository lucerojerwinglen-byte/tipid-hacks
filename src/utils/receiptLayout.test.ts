import { describe, expect, it } from "vitest";
import type { Item } from "../types.js";
import type { SolveResult } from "../solver.js";
import {
  buildReceiptLines,
  computeCanvasHeight,
  DEFAULT_LAYOUT,
  wrapText,
} from "./receiptLayout.js";

function item(overrides: Partial<Item> & Pick<Item, "id" | "price">): Item {
  return {
    chain_id: "test-chain",
    name: overrides.id,
    category: "main",
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

function feasibleResult(overrides: Partial<SolveResult> = {}): SolveResult {
  return {
    mode: "maximum-food",
    requestedHeadcount: 4,
    peopleCovered: 4,
    feasible: true,
    coverageCost: 280,
    coverageItems: [{ item: item({ id: "chickenjoy", name: "1pc Chickenjoy w/ Rice", price: 69 }), qty: 4 }],
    bonusItems: [],
    totalCost: 280,
    totalValue: 8,
    budget: 300,
    leftover: 20,
    naiveBaselineCost: 320,
    savings: 40,
    ...overrides,
  };
}

const baseInput = {
  chainDisplayName: "Jollibee",
  modeLabel: "Sulit",
  freshnessText: "Prices as of Aug 13, 2026",
  footerText: "barato — github.com/lucerojerwinglen-byte/tipid-hacks",
  bonusLabel: "Included",
  totalLabel: "Total",
  leftOverText: "₱20 left over",
};

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("1pc Chickenjoy", 34)).toEqual(["1pc Chickenjoy"]);
  });

  it("wraps at a word boundary once the budget is exceeded", () => {
    const wrapped = wrapText("6× Unlimited Rice (per order) with extra gravy", 20);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(20 + 1); // +1: single long word allowance
  });

  it("gives a single very-long word its own overflowing line instead of breaking it", () => {
    const longWord = "Supercalifragilisticexpialidocious";
    expect(wrapText(longWord, 10)).toEqual([longWord]);
  });

  it("handles an empty string", () => {
    expect(wrapText("", 20)).toEqual([""]);
  });

  it("handles an exact-fit line", () => {
    expect(wrapText("12345", 5)).toEqual(["12345"]);
  });
});

describe("buildReceiptLines", () => {
  it("produces wordmark, heading, items, total, and footer for a feasible result with no bonus/savings", () => {
    const lines = buildReceiptLines({
      result: feasibleResult({ savings: null }),
      savingsText: null,
      ...baseInput,
    });
    expect(lines[0]).toEqual({ type: "wordmark" });
    expect(lines.some((l) => l.type === "item")).toBe(true);
    expect(lines.some((l) => l.type === "total")).toBe(true);
    expect(lines.some((l) => l.type === "stamp")).toBe(false);
    expect(lines[lines.length - 1]).toEqual({
      type: "footer",
      text: baseInput.footerText,
    });
  });

  it("includes a stamp line only when savingsText is provided", () => {
    const withSavings = buildReceiptLines({
      result: feasibleResult(),
      savingsText: "Matipid ka — save ₱40",
      ...baseInput,
    });
    expect(withSavings.filter((l) => l.type === "stamp")).toHaveLength(1);
  });

  it("includes bonus items under the bonus label when present", () => {
    const result = feasibleResult({
      bonusItems: [{ item: item({ id: "rice", name: "Extra Rice", price: 15 }), qty: 2 }],
    });
    const lines = buildReceiptLines({ result, savingsText: null, ...baseInput });
    const bonusNoteIndex = lines.findIndex(
      (l) => l.type === "note" && l.text === `${baseInput.bonusLabel}:`,
    );
    expect(bonusNoteIndex).toBeGreaterThan(-1);
    expect(lines[bonusNoteIndex + 1]).toMatchObject({ type: "item", label: "2× Extra Rice" });
  });
});

describe("computeCanvasHeight", () => {
  it("is monotonically non-decreasing as more coverage items are added", () => {
    const one = buildReceiptLines({ result: feasibleResult(), savingsText: null, ...baseInput });
    const two = buildReceiptLines({
      result: feasibleResult({
        coverageItems: [
          ...feasibleResult().coverageItems,
          { item: item({ id: "drink", name: "Coke Float", price: 45 }), qty: 4 },
        ],
      }),
      savingsText: null,
      ...baseInput,
    });
    expect(computeCanvasHeight(two)).toBeGreaterThan(computeCanvasHeight(one));
  });

  it("matches a hand-computed value for a small fixed input", () => {
    const shortFooter = "barato";
    const lines = buildReceiptLines({
      result: feasibleResult(),
      savingsText: null,
      ...baseInput,
      footerText: shortFooter,
    });
    // wordmark + gap, heading, note(freshness), divider, 1 item line, divider, total, note
    // (leftover), divider, footer(1 line, short enough not to wrap) + top/bottom padding.
    const { padding, lineHeight, wordmarkHeight, wordmarkGap, maxChars } = DEFAULT_LAYOUT;
    expect(wrapText(shortFooter, maxChars)).toHaveLength(1); // guards the "1 line" assumption below
    const expected = Math.ceil(
      padding * 2 +
        (wordmarkHeight + wordmarkGap) +
        lineHeight + // heading
        lineHeight * 0.9 + // freshness note
        lineHeight * 0.6 + // divider
        lineHeight * 1 + // 1 coverage item (fits on one line)
        lineHeight * 0.6 + // divider
        lineHeight * 1.3 + // total
        lineHeight * 0.9 + // leftover note
        lineHeight * 0.6 + // divider
        lineHeight * 0.8, // footer (1 line)
    );
    expect(computeCanvasHeight(lines)).toBe(expected);
  });
});
