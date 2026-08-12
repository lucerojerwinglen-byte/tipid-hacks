// Stage 4.5 (between LLM parse and id assignment) of DATA-PIPELINE.md §2. Discovered running
// the real KFC pipeline (Milestone 5, ROADMAP.md): KFC's `/en/menu` renders two complete price
// lists in the same DOM in one page load — two full "section" groups, each with their own
// distinct backend item ids, matching the site's own delivery-vs-pickup fulfilment split — with
// no distinguishing text a downstream LLM extraction step (working from stripped visible text
// only) could use to tell them apart. Both surface as items with identical name+category but
// different prices, ~5% apart.
//
// This project's data is meant to be dine-in/pickup reference pricing, never delivery-inflated
// (brief §9, DATA-PIPELINE.md §1's rejection of GrabFood/Foodpanda as sources for the same
// reason) — keeping the lower of any such duplicate is the safe, generic rule: dine-in/pickup
// is never pricier than delivery in practice, and a genuinely different product always gets a
// distinguishing name (e.g. "Mashed Potato Regular" vs "Large Mashed Potato"), never an exact
// duplicate name+category pair. Runs for every chain, not just KFC — a no-op when a chain's
// page has no such collision.

import type { ExtractedItem } from "./types.js";

export interface DedupeResult {
  items: ExtractedItem[];
  droppedCount: number;
}

export function dedupeByLowestPrice(items: ExtractedItem[]): DedupeResult {
  const byKey = new Map<string, ExtractedItem>();
  let droppedCount = 0;
  for (const item of items) {
    const key = `${item.name.trim().toLowerCase()}|${item.category}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
    } else {
      droppedCount += 1;
      if (item.price < existing.price) byKey.set(key, item);
    }
  }
  return { items: Array.from(byKey.values()), droppedCount };
}
