// Stage 6 (diff) of DATA-PIPELINE.md §2 — human-readable summary of what changed vs. the
// previously committed version, printed before the commit stage decides whether to proceed.

import type { Item } from "../../src/types.js";
import type { DiffEntry } from "./types.js";

export function diffItems(newItems: Item[], previousItems: Item[]): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const newById = new Map(newItems.map((item) => [item.id, item]));

  for (const item of newItems) {
    const previous = previousById.get(item.id);
    if (!previous) {
      entries.push({ kind: "added", id: item.id, name: item.name, detail: `₱${item.price}` });
    } else if (previous.price !== item.price) {
      entries.push({
        kind: "price-changed",
        id: item.id,
        name: item.name,
        detail: `₱${previous.price} -> ₱${item.price}`,
      });
    }
  }
  for (const item of previousItems) {
    if (!newById.has(item.id)) {
      entries.push({ kind: "removed", id: item.id, name: item.name, detail: `was ₱${item.price}` });
    }
  }
  return entries;
}

export function formatDiff(entries: DiffEntry[]): string {
  if (entries.length === 0) return "  (no changes)";
  return entries
    .map((e) => {
      const marker = e.kind === "added" ? "+" : e.kind === "removed" ? "-" : "~";
      return `  ${marker} [${e.id}] ${e.name} — ${e.detail}`;
    })
    .join("\n");
}
