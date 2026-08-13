import { describe, expect, it } from "vitest";
import { parseLocale } from "./locale.js";

// loadLocale/saveLocale are thin try/caught wrappers over localStorage — same category as the
// untested get/set calls in priceCache.ts, not unit tested in this repo's Node-only vitest setup.
describe("parseLocale", () => {
  it("accepts valid locale codes", () => {
    expect(parseLocale("tl")).toBe("tl");
    expect(parseLocale("en")).toBe("en");
  });

  it("rejects anything else", () => {
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale("")).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });
});
