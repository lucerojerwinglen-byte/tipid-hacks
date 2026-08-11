// Manual-override file mechanism (DATA-PIPELINE.md §2). One file per chain, never written by
// the pipeline itself — it's the fallback if a source goes dark, and the landing spot for a
// validated "wrong price" user report (PRD.md).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Item } from "../../src/types.js";

const OVERRIDES_DIR = path.resolve(import.meta.dirname, "../../data/overrides");

interface OverrideFile {
  items: Item[];
}

export async function loadOverrides(chainId: string): Promise<Item[]> {
  const filePath = path.join(OVERRIDES_DIR, `${chainId}.json`);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed: OverrideFile = JSON.parse(raw);
    return parsed.items;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`Failed to load manual overrides for ${chainId} (${filePath}): ${(err as Error).message}`);
  }
}

/**
 * Merges manual-override items into pipeline-extracted items. An override with an id matching
 * a pipeline item replaces it; a new id is appended. Every merged item is forced to
 * price_confidence "manual-override" regardless of what the override file says, since that's
 * what actually happened to it.
 */
export function applyOverrides(pipelineItems: Item[], overrides: Item[]): Item[] {
  const byId = new Map(pipelineItems.map((item) => [item.id, item]));
  for (const override of overrides) {
    byId.set(override.id, { ...override, price_confidence: "manual-override" });
  }
  return Array.from(byId.values());
}
