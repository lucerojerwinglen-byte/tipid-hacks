// ROADMAP.md Milestones 4-5: run the real data pipeline by hand (not yet on a schedule —
// that's Milestone 6). Usage:
//
//   npm run pipeline                          # all three wired chains (the rest are hand-maintained)
//   npm run pipeline -- jollibee mcdonalds    # specific chains (space-separated)
//   npm run pipeline -- --no-commit           # write src/data/*.ts but skip the git commit
//
// No API key needed — every wired source is parsed deterministically (scripts/pipeline/parsers/),
// not via an LLM (DATA-PIPELINE.md §1).

import { PIPELINE_SOURCES } from "./pipeline/sources.js";
import { runChain } from "./pipeline/run.js";

const args = process.argv.slice(2);
const commit = !args.includes("--no-commit");
const requestedChains = args.filter((a) => !a.startsWith("--"));
const chainIds = requestedChains.length > 0 ? requestedChains : PIPELINE_SOURCES.map((s) => s.chain_id);

const results = [];
for (const chainId of chainIds) {
  try {
    results.push(await runChain(chainId, { commit }));
  } catch (err) {
    console.error(`\nFAILED (${chainId}): ${(err as Error).message}`);
    results.push({ chainId, status: "blocked" as const, message: (err as Error).message });
  }
}

console.log(`\n${"=".repeat(60)}\nSummary\n${"=".repeat(60)}`);
for (const r of results) {
  console.log(`  ${r.chainId}: ${r.status} — ${r.message}`);
}

const anyBlocked = results.some((r) => r.status === "blocked");
process.exit(anyBlocked ? 1 : 0);
