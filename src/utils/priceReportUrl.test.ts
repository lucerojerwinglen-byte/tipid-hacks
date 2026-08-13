import { describe, expect, it } from "vitest";
import { buildPriceReportUrl } from "./priceReportUrl.js";

describe("buildPriceReportUrl", () => {
  it("targets the confirmed repo's new-issue endpoint", () => {
    const url = new URL(
      buildPriceReportUrl({
        chainName: "Jollibee",
        chainId: "jollibee",
        itemName: "Chickenjoy",
        itemId: "jollibee-chickenjoy",
        price: 99,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://github.com/lucerojerwinglen-byte/tipid-hacks/issues/new",
    );
  });

  it("prefills title, body, and label with the right details", () => {
    const url = new URL(
      buildPriceReportUrl({
        chainName: "Jollibee",
        chainId: "jollibee",
        itemName: "Chickenjoy",
        itemId: "jollibee-chickenjoy",
        price: 99,
      }),
    );
    expect(url.searchParams.get("title")).toBe("Wrong price: Jollibee — Chickenjoy");
    expect(url.searchParams.get("labels")).toBe("price-report");
    const body = url.searchParams.get("body") ?? "";
    expect(body).toContain("Jollibee");
    expect(body).toContain("jollibee-chickenjoy");
    expect(body).toContain("₱99");
  });

  it("round-trips special characters (ampersands, peso sign, diacritics) through the URL", () => {
    const url = buildPriceReportUrl({
      chainName: "Chowking",
      chainId: "chowking",
      itemName: "Lauriat & Halo-Halo Ñ",
      itemId: "chowking-lauriat",
      price: 149,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe(
      "Wrong price: Chowking — Lauriat & Halo-Halo Ñ",
    );
    expect(parsed.searchParams.get("body")).toContain("Lauriat & Halo-Halo Ñ");
  });
});
