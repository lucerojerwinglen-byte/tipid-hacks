// ROADMAP.md Milestone 0: prove the solver reproduces the brief's own worked example on real
// hand-typed data, with human-readable output — no UI, no pipeline, just the core algorithm.

import { jollibee } from "../src/data/jollibee.js";
import { solve, computeNaiveBaseline, type SolveResult } from "../src/solver.js";
import type { Item } from "../src/types.js";

function pesos(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

function printResult(label: string, result: SolveResult) {
  console.log(`\n--- ${label} ---`);
  console.log(`Requested: ${result.requestedHeadcount} people, budget ${pesos(result.budget)}, mode: ${result.mode}`);
  if (!result.feasible) {
    const verb = result.mode === "cheapest-possible" ? "Full group doesn't fit this budget" : "NOT ENOUGH BUDGET to feed everyone";
    console.log(
      `${verb}. Best honest answer: covers ${result.peopleCovered}/${result.requestedHeadcount} people for ${pesos(result.totalCost)}.`,
    );
    return;
  }
  for (const { item, qty } of result.coverageItems) {
    console.log(`  ${qty}x ${item.name} — ${pesos(item.price * qty)}`);
  }
  console.log(`  Total: ${pesos(result.totalCost)} (leftover: ${pesos(result.leftover)})`);
  if (result.naiveBaselineCost !== null && result.savings !== null) {
    console.log(
      `  vs naive baseline ${pesos(result.naiveBaselineCost)} -> you save ${pesos(result.savings)}`,
    );
  }
  if (result.bonusItems.length > 0) {
    const label2 = result.mode === "maximum-food" ? "included" : "you could also add";
    for (const { item, qty } of result.bonusItems) {
      console.log(`  (${label2}: ${qty}x ${item.name} — ${pesos(item.price * qty)})`);
    }
  }
}

console.log("=".repeat(60));
console.log("Tipid Hacks — Milestone 0: solver proof of concept");
console.log("=".repeat(60));

// The brief's own worked example (PRD.md §2): ₱300, 4 people, Jollibee.
const example = solve(jollibee.items, 4, 300, "feed-everyone");
printResult("Brief's worked example: ₱300, 4 people, Jollibee", example);

console.log("\nExpected from the brief: 4x Chickenjoy 1pc with rice (ala carte) — ₱276,");
console.log("save ₱44 vs 4 combo meals, ₱24 left over. Match:", example.coverageCost === 276 && example.savings === 44 && example.leftover === 24 ? "YES" : "NO");

// A few more scenarios from SOLVER.md §8's test table, for a human sanity check.
printResult("Same group, maximum-food mode (spend the leftover)", solve(jollibee.items, 4, 300, "maximum-food"));
printResult("Tighter budget: ₱150, 4 people", solve(jollibee.items, 4, 150, "feed-everyone"));
printResult("Infeasible: ₱100, 8 people", solve(jollibee.items, 8, 100, "feed-everyone"));
printResult("Explicit cheapest-possible: ₱250, 4 people", solve(jollibee.items, 4, 250, "cheapest-possible"));
printResult("Bigger group, does a bucket start winning? ₱600, 8 people", solve(jollibee.items, 8, 600, "feed-everyone"));

console.log("\nDone. Run `npm test` for the full automated test suite (SOLVER.md §8).");
