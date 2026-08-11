// Implements SOLVER.md exactly: Phase 1 (coverage DP), Phase 2 (leftover-value knapsack),
// cheapest-possible / infeasible fallback, and deterministic tie-breaking via item order.

import type { Item, ChainData } from "./types.js";

export type SolverMode = "feed-everyone" | "maximum-food" | "cheapest-possible";

export interface ItemQty {
  item: Item;
  qty: number;
}

export interface SolveResult {
  mode: SolverMode;
  requestedHeadcount: number;
  /** How many people the returned order actually covers (may be < requestedHeadcount only in the infeasible/cheapest-possible path). */
  peopleCovered: number;
  /** True only when every one of requestedHeadcount got >=1 main + >=1 carb. */
  feasible: boolean;
  coverageCost: number;
  coverageItems: ItemQty[];
  /** Phase-2 additions. For feed-everyone this is a suggestion, not included in totalCost. For maximum-food it IS included. */
  bonusItems: ItemQty[];
  totalCost: number;
  budget: number;
  leftover: number;
  /** Cheapest single-person full-coverage option x N — see DATA-MODEL.md §3. Null if no item can cover even one person. */
  naiveBaselineCost: number | null;
  /** naiveBaselineCost - coverageCost. Null whenever peopleCovered < requestedHeadcount (see below). */
  savings: number | null;
}

interface ParentRef {
  fromM: number;
  fromR: number;
  item: Item;
}

const MAX_QTY_CAP = 12;

function maxQtyFor(N: number): number {
  return Math.min(N + 2, MAX_QTY_CAP);
}

/** SOLVER.md §4, Phase 1: dp[m][r] = min cost to reach >=m main-servings and >=r carb-servings (m, r capped at N). */
export function solveCoverage(
  items: Item[],
  N: number,
): { dp: number[][]; parent: (ParentRef | null)[][] } {
  const size = N + 1;
  const dp: number[][] = Array.from({ length: size }, () => new Array(size).fill(Infinity));
  const parent: (ParentRef | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null),
  );
  dp[0]![0] = 0;

  // Loop order note: this processes (m, r) in INCREASING order per pass, which technically
  // lets one pass chain unlimited reuse of the same item (see maximizeLeftoverValue's doc
  // comment for why that's normally a bug). It's harmless here specifically because m and r
  // are capped at N and the objective MINIMIZES cost — once a cell reaches its cap, spending
  // more on redundant copies of the same item never wins, so excess quantity is never chosen
  // regardless of how loose the pass-based bound is. Phase 2 has no such ceiling, which is
  // exactly why it needed the stricter decreasing-order fix.
  for (const item of items) {
    if (!item.available) continue;
    const maxQty = maxQtyFor(N);
    for (let q = 0; q < maxQty; q++) {
      for (let m = 0; m <= N; m++) {
        for (let r = 0; r <= N; r++) {
          const current = dp[m]![r]!;
          if (current === Infinity) continue;
          const newCost = current + item.price;
          const newM = Math.min(N, m + item.main_servings);
          const newR = Math.min(N, r + item.carb_servings);
          if (newCost < dp[newM]![newR]!) {
            dp[newM]![newR] = newCost;
            parent[newM]![newR] = { fromM: m, fromR: r, item };
          }
        }
      }
    }
  }

  return { dp, parent };
}

/** Walks parent pointers from (targetM, targetR) back to (0,0), collapsing repeats into quantities. */
export function reconstructCoverage(
  parent: (ParentRef | null)[][],
  targetM: number,
  targetR: number,
): ItemQty[] {
  const counts = new Map<string, ItemQty>();
  let m = targetM;
  let r = targetR;

  while (m !== 0 || r !== 0) {
    const ref = parent[m]?.[r];
    if (!ref) break;
    const existing = counts.get(ref.item.id);
    if (existing) existing.qty += 1;
    else counts.set(ref.item.id, { item: ref.item, qty: 1 });
    m = ref.fromM;
    r = ref.fromR;
  }

  return [...counts.values()];
}

/**
 * SOLVER.md §4, Phase 2: maximize total item count within a leftover budget.
 *
 * Bounded per item at maxQtyFor(N) (SOLVER.md §3) — without this, a very cheap item (e.g.
 * Mang Inasal's ₱5 unlimited-rice add-on) lets a naive unbounded knapsack "maximize count" by
 * recommending dozens of copies of it, which is nonsense as a suggestion. Caught while
 * building Milestone 2 (ROADMAP.md) against real chain data — Jollibee's smaller leftover
 * budgets never hit this, Mang Inasal's near-zero-price item did immediately.
 *
 * Each item is capped at `maxQty` via the textbook bounded-knapsack DP: item-indexed layers
 * `dp[i][c]`, each explicitly trying every quantity `0..maxQty` of item `i` and recording
 * which quantity was best. This is deliberately NOT a single 1D array shared across items
 * (via either repeated relaxation passes or copy-expansion) — both of those bound the
 * computed *value* correctly but not the *reconstruction*: a shared parent-pointer array
 * can't tell "item i's 1st copy" from "item i's 3rd copy" while walking backward, so it keeps
 * re-chaining through the same cheap item past the intended cap regardless of how the value
 * array was built. That exact bug shipped twice (once as repeated passes, once as copy
 * expansion) before this comment existed — see solver.test.ts's regression case and
 * SOLVER.md §4. Layering the DP by item index sidesteps the problem entirely: `qtyUsed[i][c]`
 * is unambiguous about how much of item `i` specifically was used, so reconstruction is
 * correct by construction, not by hoping the pointers happen to behave.
 */
export function maximizeLeftoverValue(items: Item[], leftoverBudget: number, N: number): ItemQty[] {
  if (leftoverBudget <= 0) return [];
  const available = items.filter((i) => i.available);
  const maxQty = maxQtyFor(N);
  const n = available.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(leftoverBudget + 1).fill(0));
  const qtyUsed: number[][] = Array.from({ length: n + 1 }, () => new Array(leftoverBudget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = available[i - 1]!;
    const prevLayer = dp[i - 1]!;
    const maxAffordableAt = (c: number) =>
      item.price > 0 ? Math.min(maxQty, Math.floor(c / item.price)) : 0;

    for (let c = 0; c <= leftoverBudget; c++) {
      let best = prevLayer[c]!;
      let bestQ = 0;
      for (let q = 1; q <= maxAffordableAt(c); q++) {
        const candidate = prevLayer[c - q * item.price]! + q;
        if (candidate > best) {
          best = candidate;
          bestQ = q;
        }
      }
      dp[i]![c] = best;
      qtyUsed[i]![c] = bestQ;
    }
  }

  const result: ItemQty[] = [];
  let c = leftoverBudget;
  for (let i = n; i >= 1; i--) {
    const q = qtyUsed[i]![c]!;
    if (q > 0) {
      const item = available[i - 1]!;
      result.push({ item, qty: q });
      c -= q * item.price;
    }
  }
  return result;
}

/** SOLVER.md §4: largest n' <= N such that fully covering n' people fits the budget. */
export function largestFeasibleCoverage(dp: number[][], N: number, budget: number): number {
  for (let nPrime = N; nPrime >= 0; nPrime--) {
    if (dp[nPrime]![nPrime]! <= budget) return nPrime;
  }
  return 0;
}

function sumCost(itemQtys: ItemQty[]): number {
  return itemQtys.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
}

/**
 * DATA-MODEL.md §3: what an uninformed shopper would obviously order for themselves, x N —
 * NOT the mathematically optimal single-person answer (dp[1][1] already finds the ala-carte
 * trick even for N=1, which would make "savings" read as ~0 for exactly the scenario the app
 * exists to catch). Prefers the cheapest combo that alone covers one person, since that's what
 * chains actually market as "the" meal; falls back to the cheapest single-item full-coverage
 * option only for chains with no such combo (e.g. a pure ala-carte + unlimited-rice menu).
 *
 * Shareable/family-sized items are excluded from consideration — a 6-person Family Fiesta
 * isn't what one uninformed person orders "for themselves," even if it happens to be the
 * cheapest combo per-serving. Caught while building Mang Inasal's dataset (Milestone 2,
 * ROADMAP.md), where the only combo on the menu was a 6-person bucket meal.
 */
export function computeNaiveBaseline(items: Item[], N: number): number | null {
  const available = items.filter(
    (i) => i.available && !i.shareable && i.main_servings >= 1 && i.carb_servings >= 1,
  );
  const combos = available.filter((i) => i.is_combo);
  const candidates = combos.length > 0 ? combos : available;
  if (candidates.length === 0) return null;
  const cheapest = candidates.reduce((min, i) => (i.price < min.price ? i : min));
  return cheapest.price * N;
}

export function solve(items: Item[], N: number, budget: number, mode: SolverMode): SolveResult {
  const { dp, parent } = solveCoverage(items, N);
  const naiveBaselineCost = N >= 1 ? computeNaiveBaseline(items, N) : null;

  if (mode === "cheapest-possible") {
    const nPrime = largestFeasibleCoverage(dp, N, budget);
    const cost = dp[nPrime]![nPrime]!;
    const coverageItems = nPrime > 0 ? reconstructCoverage(parent, nPrime, nPrime) : [];
    const fullyCovered = nPrime === N;
    return {
      mode,
      requestedHeadcount: N,
      peopleCovered: nPrime,
      feasible: fullyCovered,
      coverageCost: cost,
      coverageItems,
      bonusItems: [],
      totalCost: cost,
      budget,
      leftover: budget - cost,
      naiveBaselineCost,
      savings: fullyCovered && naiveBaselineCost !== null ? naiveBaselineCost - cost : null,
    };
  }

  const minCost = dp[N]![N]!;
  const feasible = Number.isFinite(minCost) && minCost <= budget;

  if (!feasible) {
    // SOLVER.md §4: auto-fallback to the cheapest-possible answer, honestly reporting partial coverage.
    const fallback = solve(items, N, budget, "cheapest-possible");
    return { ...fallback, mode };
  }

  const coverageItems = reconstructCoverage(parent, N, N);
  const leftoverBudget = budget - minCost;
  const bonusItems = maximizeLeftoverValue(items, leftoverBudget, N);
  const bonusCost = sumCost(bonusItems);

  // SOLVER.md §4: feed-everyone and maximum-food share the same computation; only the
  // presentation differs — maximum-food actually spends phase 2, feed-everyone offers it.
  const totalCost = mode === "maximum-food" ? minCost + bonusCost : minCost;

  return {
    mode,
    requestedHeadcount: N,
    peopleCovered: N,
    feasible: true,
    coverageCost: minCost,
    coverageItems,
    bonusItems,
    totalCost,
    budget,
    leftover: budget - totalCost,
    naiveBaselineCost,
    savings: naiveBaselineCost !== null ? naiveBaselineCost - minCost : null,
  };
}

/** Dietary filters (PRD.md §4) — applied before solving, no solver-level special-casing needed. */
export function excludeTags(items: Item[], tagsToExclude: string[]): Item[] {
  if (tagsToExclude.length === 0) return items;
  return items.filter((item) => !item.tags.some((tag) => tagsToExclude.includes(tag)));
}

export interface ChainSolveResult {
  chain: ChainData["chain"];
  result: SolveResult;
}

/**
 * SOLVER.md §5: no cross-chain mixing. Solves each chain independently and ranks them —
 * fully-feasible chains first (cheapest total wins), infeasible chains after (most people
 * covered wins, cost breaks ties) so a group that can't be fully fed anywhere still sees the
 * closest honest answer rather than nothing. Returns the winner plus up to 2 runners-up so
 * the UI can show *why* the winner won (PRD.md §9's trust-building "any chain" behavior).
 */
export function solveAnyChain(
  chains: ChainData[],
  N: number,
  budget: number,
  mode: SolverMode,
  excludedTags: string[] = [],
): { winner: ChainSolveResult; runnersUp: ChainSolveResult[] } {
  if (chains.length === 0) throw new Error("solveAnyChain requires at least one chain");

  const ranked: ChainSolveResult[] = chains
    .map((chainData) => ({
      chain: chainData.chain,
      result: solve(excludeTags(chainData.items, excludedTags), N, budget, mode),
    }))
    .sort((a, b) => {
      if (a.result.feasible !== b.result.feasible) return a.result.feasible ? -1 : 1;
      if (a.result.feasible) return a.result.totalCost - b.result.totalCost;
      if (a.result.peopleCovered !== b.result.peopleCovered) {
        return b.result.peopleCovered - a.result.peopleCovered;
      }
      return a.result.totalCost - b.result.totalCost;
    });

  const [winner, ...rest] = ranked;
  if (!winner) throw new Error("unreachable: ranked list is non-empty");
  return { winner, runnersUp: rest.slice(0, 2) };
}
