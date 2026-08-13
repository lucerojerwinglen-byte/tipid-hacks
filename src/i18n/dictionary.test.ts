import { describe, expect, it } from "vitest";
import { dictionaries, en, tl } from "./dictionary.js";

// Runtime belt-and-suspenders on top of TypeScript's compile-time guarantee that `tl` and `en`
// both implement `Dictionary` — catches an `as any`/`as Dictionary` escape hatch a type checker
// alone wouldn't.
function keyShape(value: unknown): unknown {
  if (typeof value === "function") return "function";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return value.map(keyShape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, keyShape(v)]),
    );
  }
  return typeof value;
}

describe("dictionaries", () => {
  it("tl and en expose identical key shapes", () => {
    expect(keyShape(tl)).toEqual(keyShape(en));
  });

  it("registers both locales", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(["en", "tl"]);
  });

  it("parameterized entries return non-empty, distinct-per-locale strings for sample inputs", () => {
    for (const dict of [tl, en]) {
      expect(dict.budgetError.max("100,000")).toContain("100,000");
      expect(dict.headcountError.max(100)).toContain("100");
      expect(dict.results.bestDealBadge("Jollibee")).toContain("Jollibee");
      expect(dict.results.total.length).toBeGreaterThan(0);
    }
    expect(tl.budgetLabel).not.toBe(en.budgetLabel);
    expect(tl.dietaryLegend).not.toBe(en.dietaryLegend);
  });

  it("never translates the named term Sulit", () => {
    expect(tl.modes.maximumFood.label).toBe("Sulit");
    expect(en.modes.maximumFood.label).toBe("Sulit");
  });
});
