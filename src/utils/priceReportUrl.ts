// PRD.md §4 should-have: one-tap "wrong price" report. The app has no backend (ARCHITECTURE.md),
// so there's nowhere to submit a report to directly — instead this opens a prefilled GitHub
// "new issue" link on the (public) repo, labeled price-report. DATA-PIPELINE.md §2 already
// describes a "validated" wrong-price report being manually applied to a chain's override file —
// an issue is exactly the triage step that implies, and mirrors the gh-issue pattern already
// built for Milestone 6's pipeline-failure alerts.
const REPO = "lucerojerwinglen-byte/tipid-hacks";

export interface PriceReportInput {
  chainName: string;
  chainId: string;
  itemName: string;
  itemId: string;
  price: number;
}

/** Pure — builds a prefilled GitHub "new issue" URL. No network call, no side effect. */
export function buildPriceReportUrl(input: PriceReportInput): string {
  const url = new URL(`https://github.com/${REPO}/issues/new`);
  url.searchParams.set("title", `Wrong price: ${input.chainName} — ${input.itemName}`);
  url.searchParams.set(
    "body",
    [
      `**Chain:** ${input.chainName} (\`${input.chainId}\`)`,
      `**Item:** ${input.itemName} (\`${input.itemId}\`)`,
      `**Currently listed price:** ₱${input.price}`,
      "",
      "**What's the correct price?**",
      "",
      "(fill in — a screenshot of the menu/receipt helps)",
    ].join("\n"),
  );
  url.searchParams.set("labels", "price-report");
  return url.toString();
}
