// Stage 5 (validate) of DATA-PIPELINE.md §2 — schema shape plus the three sanity rules from
// §3. Pure functions, deliberately: no fetch/LLM/fs calls in here, so this file can be unit
// tested against synthetic "deliberately-broken" input (see validate.test.ts) without a
// network call, satisfying ROADMAP.md Milestone 4's "gets caught and blocked" requirement.

import type { Item } from "../../src/types.js";
import type { ValidationIssue, ValidationResult } from "./types.js";

// Tunable thresholds. Sourced from DATA-PIPELINE.md §3's own examples (₱9 / ₱9,000) with a
// generous upper bound so a real family-size combo (Family Fiesta ₱895, 8pc bucket ₱519+
// rice) never false-positives.
const MAX_PRICE_CHANGE_RATIO = 0.3;
const MAX_ITEM_COUNT_DROP_RATIO = 0.3;
const MIN_SANE_PRICE = 10;
const MAX_SANE_PRICE = 3000;

function nonsenseCheck(items: Item[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const item of items) {
    if (item.price < MIN_SANE_PRICE || item.price > MAX_SANE_PRICE) {
      issues.push({
        severity: "error",
        message: `"${item.name}" (${item.id}) has a nonsensical price of ₱${item.price} — outside the sane range ₱${MIN_SANE_PRICE}-₱${MAX_SANE_PRICE}.`,
      });
    }
    if (!Number.isInteger(item.price) || item.price <= 0) {
      issues.push({
        severity: "error",
        message: `"${item.name}" (${item.id}) has an invalid price: ${item.price}.`,
      });
    }
  }
  return issues;
}

function priceChangeCheck(newItems: Item[], previousItems: Item[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  for (const item of newItems) {
    const previous = previousById.get(item.id);
    if (!previous || previous.price_confidence === "manual-override") continue;
    if (previous.price <= 0) continue;
    const change = Math.abs(item.price - previous.price) / previous.price;
    if (change > MAX_PRICE_CHANGE_RATIO) {
      issues.push({
        severity: "error",
        message: `"${item.name}" (${item.id}) price changed by ${(change * 100).toFixed(0)}% (₱${previous.price} -> ₱${item.price}), exceeding the ${MAX_PRICE_CHANGE_RATIO * 100}% sanity threshold — needs human review.`,
      });
    }
  }
  return issues;
}

function itemCountDropCheck(newItems: Item[], previousItems: Item[]): ValidationIssue[] {
  const previousPipelineCount = previousItems.filter(
    (item) => item.price_confidence !== "manual-override",
  ).length;
  if (previousPipelineCount === 0) return []; // First-ever run for this chain — nothing to compare.
  const drop = (previousPipelineCount - newItems.length) / previousPipelineCount;
  if (drop > MAX_ITEM_COUNT_DROP_RATIO) {
    return [
      {
        severity: "error",
        message: `Item count dropped from ${previousPipelineCount} to ${newItems.length} (${(drop * 100).toFixed(0)}%) — likely a failed page load/render, not a genuinely shrunk menu.`,
      },
    ];
  }
  return [];
}

function comboReferenceCheck(items: Item[]): ValidationIssue[] {
  const knownIds = new Set(items.map((item) => item.id));
  const issues: ValidationIssue[] = [];
  for (const item of items) {
    if (!item.is_combo) continue;
    if (!item.combo_contents || item.combo_contents.length === 0) {
      issues.push({
        severity: "error",
        message: `Combo "${item.name}" (${item.id}) has no resolved components.`,
      });
      continue;
    }
    for (const component of item.combo_contents) {
      if (!knownIds.has(component.item_id)) {
        issues.push({
          severity: "error",
          message: `Combo "${item.name}" (${item.id}) references unknown component id "${component.item_id}".`,
        });
      }
    }
  }
  return issues;
}

/**
 * Runs the sanity rules against pipeline-extracted items (before manual overrides are merged
 * in — overrides are human-vetted and exempt from price-change/count-drop checks by design).
 */
export function validateExtractedItems(newItems: Item[], previousItems: Item[]): ValidationResult {
  const issues: ValidationIssue[] = [
    ...nonsenseCheck(newItems),
    ...priceChangeCheck(newItems, previousItems),
    ...itemCountDropCheck(newItems, previousItems),
    ...comboReferenceCheck(newItems),
  ];
  return { ok: !issues.some((i) => i.severity === "error"), issues, items: newItems };
}
