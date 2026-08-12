// Milestone 2 (ROADMAP.md): "all six chains produce sane answers, and the two special-case
// items behave as designed rather than as bugs." Complements solver.test.ts (which proves the
// algorithm itself against synthetic fixtures) by proving the six real hand-typed datasets
// don't break it.

import { describe, expect, it } from "vitest";
import { chains, mangInasal, shakeys } from "./data/chains.js";
import { excludeTags, solve, solveAnyChain } from "./solver.js";

// Shakey's real minimum cost to feed 4 (one Large pizza, ₱635 — DATA-PIPELINE.md §1) is above
// ₱500, unlike the other five chains' cheaper per-person fast food. Not a sanity-band problem
// (₱635/4 ≈ ₱159, well inside the 20-300 band below) — just a higher floor for this one chain.
const BUDGET_FOR_4: Record<string, number> = { shakeys: 700 };

describe("every chain produces a sane answer for a typical scenario", () => {
  for (const chainData of chains) {
    const budget = BUDGET_FOR_4[chainData.chain.id] ?? 500;
    it(`${chainData.chain.name}: ₱${budget} for 4 people is feasible and sane`, () => {
      const result = solve(chainData.items, 4, budget, "feed-everyone");
      expect(result.feasible).toBe(true);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.totalCost).toBeLessThanOrEqual(budget);
      expect(result.coverageItems.length).toBeGreaterThan(0);
      // Sanity band, not a precision check — catches "a zero snuck into a price" class of bug.
      expect(result.totalCost / 4).toBeGreaterThan(20);
      expect(result.totalCost / 4).toBeLessThan(300);
    });
  }
});

describe("Mang Inasal: unlimited rice satisfies the carb requirement cheaply for a group", () => {
  it("doesn't buy N separate rice orders when the unlimited-rice item is available", () => {
    const result = solve(mangInasal.items, 6, 1000, "feed-everyone");
    expect(result.feasible).toBe(true);
    const unlimitedRiceLine = result.coverageItems.find((i) => i.item.id === "mi-unlimited-rice");
    const plainRiceLine = result.coverageItems.find((i) => i.item.id === "mi-plain-rice");
    expect(unlimitedRiceLine?.qty).toBe(1);
    expect(plainRiceLine).toBeUndefined();
  });
});

describe("Shakey's: a pizza's per-slice math beats N individual pasta orders", () => {
  it("prefers a whole pizza over per-person carbonara once the group is big enough", () => {
    const result = solve(shakeys.items, 4, 1000, "feed-everyone");
    expect(result.feasible).toBe(true);
    // Regular only serves 2 (real site: "Good for 1-2 Persons"), so a group of 4 needs the
    // Large (serves 4), not the Regular — unlike the old invented placeholder sizing.
    const pizzaLine = result.coverageItems.find((i) => i.item.id === "sh-pizza-thin-large");
    expect(pizzaLine?.qty).toBe(1);
    // ₱635 for 4 via one Large pizza should beat 4x Carbonara Supreme (₱299 each = ₱1,196).
    expect(result.coverageCost).toBeLessThan(1196);
  });

  it("a pizza slice satisfies both main and carb from a single purchase (DATA-MODEL.md §4)", () => {
    const pizza = shakeys.items.find((i) => i.id === "sh-pizza-thin-regular")!;
    expect(pizza.main_servings).toBe(pizza.serves);
    expect(pizza.carb_servings).toBe(pizza.serves);
  });
});

describe("any-chain mode: solves independently per chain, returns winner + runners-up", () => {
  it("picks a single winning chain and never mixes items across chains", () => {
    const { winner, runnersUp } = solveAnyChain(chains, 4, 400, "feed-everyone");
    expect(winner.result.feasible).toBe(true);
    expect(runnersUp.length).toBeGreaterThan(0);
    expect(runnersUp.length).toBeLessThanOrEqual(2);
    // Every item in the winning result belongs to the winning chain, never a mix.
    for (const { item } of winner.result.coverageItems) {
      expect(item.chain_id).toBe(winner.chain.id);
    }
  });

  it("ranks the winner as cheapest (or best-covered) among all six", () => {
    const { winner, runnersUp } = solveAnyChain(chains, 4, 400, "feed-everyone");
    for (const runnerUp of runnersUp) {
      if (winner.result.feasible && runnerUp.result.feasible) {
        expect(winner.result.totalCost).toBeLessThanOrEqual(runnerUp.result.totalCost);
      }
    }
  });

  it("applies dietary filters per chain before ranking (no pork)", () => {
    const { winner } = solveAnyChain(chains, 2, 400, "feed-everyone", ["pork"]);
    for (const { item } of winner.result.coverageItems) {
      expect(item.tags).not.toContain("pork");
    }
  });
});

describe("dietary filters generalize across all six chains", () => {
  for (const chainData of chains) {
    it(`${chainData.chain.name}: excluding all tagged proteins never crashes`, () => {
      const filtered = excludeTags(chainData.items, ["chicken", "beef", "pork"]);
      const result = solve(filtered, 4, 100_000, "feed-everyone");
      // Some chains may have an untagged main (e.g. Bangus Sisig) and still succeed — the
      // point of this test is "doesn't throw / doesn't silently misbehave," not a fixed verdict.
      expect(typeof result.feasible).toBe("boolean");
    });
  }
});
