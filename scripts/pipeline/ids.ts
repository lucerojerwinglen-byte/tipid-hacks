// Turns raw LLM-extracted items into DATA-MODEL.md `Item`s: generates stable ids and resolves
// combo_component_names (name references within one extraction batch) into combo_contents
// (id references), since the LLM can't know final ids before they're assigned.

import type { Item } from "../../src/types.js";
import type { ExtractedItem } from "./types.js";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Builds Item[] from a batch of ExtractedItem, generating unique ids and resolving combos. */
export function assignIdsAndResolveCombos(
  extracted: ExtractedItem[],
  chainId: string,
  idPrefix: string,
): { items: Item[]; errors: string[] } {
  const errors: string[] = [];
  const usedIds = new Set<string>();
  const nameToId = new Map<string, string>();

  const idFor = (name: string): string => {
    const base = `${idPrefix}-${slugify(name)}`;
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    return id;
  };

  // First pass: assign every item an id before resolving references, so combos can point
  // forward or backward in the source list.
  const withIds = extracted.map((item) => {
    const id = idFor(item.name);
    nameToId.set(item.name.trim().toLowerCase(), id);
    return { item, id };
  });

  const items: Item[] = withIds.map(({ item, id }) => {
    let combo_contents: Item["combo_contents"];
    if (item.is_combo) {
      combo_contents = [];
      for (const component of item.combo_component_names) {
        const componentId = nameToId.get(component.name.trim().toLowerCase());
        if (!componentId) {
          errors.push(
            `Combo "${item.name}" references component "${component.name}", which was not found as its own item in the same extraction batch.`,
          );
          continue;
        }
        combo_contents.push({ item_id: componentId, qty: component.qty });
      }
    }

    return {
      id,
      chain_id: chainId,
      name: item.name,
      category: item.category,
      price: item.price,
      serves: item.serves,
      main_servings: item.main_servings,
      carb_servings: item.carb_servings,
      shareable: item.shareable,
      is_combo: item.is_combo,
      ...(combo_contents ? { combo_contents } : {}),
      tags: item.tags,
      available: item.available,
      price_confidence: "verified",
    };
  });

  return { items, errors };
}
