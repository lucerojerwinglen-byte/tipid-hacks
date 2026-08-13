import { describe, expect, it } from "vitest";
import { buildReceiptFilename, canShareFiles } from "./shareImage.js";

// renderReceiptToBlob/shareOrDownloadReceipt/drawReceipt need a real canvas/Image/
// navigator.share this repo's Node-only vitest setup doesn't have — not unit tested here, same
// treatment priceCache.ts's storage calls already get. Verified by hand in a real browser.

describe("canShareFiles", () => {
  it("is false when navigator has no share method at all", () => {
    expect(canShareFiles(undefined)).toBe(false);
    expect(canShareFiles({} as never)).toBe(false);
  });

  it("is false when share exists but canShare is missing (older API shape)", () => {
    expect(canShareFiles({ share: async () => {} } as never)).toBe(false);
  });

  it("reflects canShare's own answer when both are present", () => {
    expect(canShareFiles({ share: async () => {}, canShare: () => true })).toBe(true);
    expect(canShareFiles({ share: async () => {}, canShare: () => false })).toBe(false);
  });

  it("treats a throwing canShare as unsupported rather than propagating", () => {
    expect(
      canShareFiles({
        share: async () => {},
        canShare: () => {
          throw new Error("not implemented");
        },
      }),
    ).toBe(false);
  });
});

describe("buildReceiptFilename", () => {
  it("is deterministic given a fixed chain id and date", () => {
    expect(buildReceiptFilename("jollibee", "2026-08-13T04:00:00.000Z")).toBe(
      "barato-jollibee-2026-08-13.png",
    );
  });

  it("differs per chain and per date", () => {
    const a = buildReceiptFilename("jollibee", "2026-08-13T00:00:00.000Z");
    const b = buildReceiptFilename("mcdonalds", "2026-08-13T00:00:00.000Z");
    const c = buildReceiptFilename("jollibee", "2026-08-20T00:00:00.000Z");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
