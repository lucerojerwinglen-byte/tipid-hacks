// PRD.md §4 should-have: share result as an image. Pure layout math — no canvas/DOM here, so
// it's fully unit-testable in this repo's Node-only vitest setup. The actual drawing lives in
// receiptCanvas.ts; this module decides *what* goes on the receipt and how tall it needs to be.
import type { SolveResult } from "../solver.js";

export type ReceiptLine =
  | { type: "wordmark" }
  | { type: "heading"; text: string }
  | { type: "item"; label: string; amount: string }
  | { type: "divider" }
  | { type: "total"; label: string; amount: string }
  | { type: "note"; text: string }
  | { type: "stamp"; text: string }
  | { type: "footer"; text: string };

export interface LayoutConstants {
  padding: number;
  lineHeight: number;
  wordmarkHeight: number;
  wordmarkGap: number;
  /** Character budget per drawn line at the font size receiptCanvas.ts uses — wrapping is by
   * character count, not real font metrics, since every text line is drawn in the app's own
   * monospace `--font-display` stack (index.css), where character width is constant. */
  maxChars: number;
}

export const DEFAULT_LAYOUT: LayoutConstants = {
  padding: 24,
  lineHeight: 22,
  wordmarkHeight: 32,
  wordmarkGap: 12,
  maxChars: 34,
};

function pesos(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

/** Greedy word-wrap by character count — no real font metrics needed at this layout stage. A
 * single word longer than maxChars gets its own (overflowing) line rather than being broken
 * mid-word. */
export function wrapText(text: string, maxChars: number): string[] {
  if (text === "") return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length <= maxChars || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

export interface BuildReceiptLinesInput {
  result: SolveResult;
  chainDisplayName: string;
  modeLabel: string;
  freshnessText: string;
  footerText: string;
  bonusLabel: string;
  /** Already-resolved (e.g. "Matipid ka — save ₱241"), or null when there's nothing to show. */
  savingsText: string | null;
  totalLabel: string;
  /** Already-resolved (e.g. "₱0 left over"). */
  leftOverText: string;
}

/** Takes a SolveResult plus already-resolved locale strings — stays localized by construction
 * instead of duplicating ResultsPanel's copy. Only meaningful for feasible results; callers
 * (ShareButton) only invoke this in the feasible branch, matching the v1 share-image scope. */
export function buildReceiptLines(input: BuildReceiptLinesInput): ReceiptLine[] {
  const {
    result,
    chainDisplayName,
    modeLabel,
    freshnessText,
    footerText,
    bonusLabel,
    savingsText,
    totalLabel,
    leftOverText,
  } = input;

  const lines: ReceiptLine[] = [
    { type: "wordmark" },
    { type: "heading", text: `${chainDisplayName} — ${modeLabel}` },
  ];
  if (freshnessText) lines.push({ type: "note", text: freshnessText });
  lines.push({ type: "divider" });

  for (const { item, qty } of result.coverageItems) {
    lines.push({ type: "item", label: `${qty}× ${item.name}`, amount: pesos(item.price * qty) });
  }

  lines.push({ type: "divider" });
  lines.push({ type: "total", label: totalLabel, amount: pesos(result.totalCost) });
  lines.push({ type: "note", text: leftOverText });

  if (savingsText) lines.push({ type: "stamp", text: savingsText });

  if (result.bonusItems.length > 0) {
    lines.push({ type: "divider" });
    lines.push({ type: "note", text: `${bonusLabel}:` });
    for (const { item, qty } of result.bonusItems) {
      lines.push({ type: "item", label: `${qty}× ${item.name}`, amount: pesos(item.price * qty) });
    }
  }

  lines.push({ type: "divider" });
  lines.push({ type: "footer", text: footerText });

  return lines;
}

/** Line-by-line height accounting, matching how receiptCanvas.ts advances its own draw cursor.
 * Pure — no canvas needed, which is what makes this testable in this repo's Node-only vitest
 * setup (real font-metric wrapping would need a browser). */
export function computeCanvasHeight(
  lines: ReceiptLine[],
  constants: LayoutConstants = DEFAULT_LAYOUT,
): number {
  const { padding, lineHeight, wordmarkHeight, wordmarkGap, maxChars } = constants;
  let height = padding * 2;

  for (const line of lines) {
    switch (line.type) {
      case "wordmark":
        height += wordmarkHeight + wordmarkGap;
        break;
      case "heading":
        height += lineHeight;
        break;
      case "item":
        height += lineHeight * wrapText(line.label, maxChars).length;
        break;
      case "divider":
        height += lineHeight * 0.6;
        break;
      case "total":
        height += lineHeight * 1.3;
        break;
      case "note":
        height += lineHeight * 0.9;
        break;
      case "stamp":
        height += lineHeight * 1.6;
        break;
      case "footer":
        height += lineHeight * 0.8 * wrapText(line.text, maxChars).length;
        break;
    }
  }

  return Math.ceil(height);
}
