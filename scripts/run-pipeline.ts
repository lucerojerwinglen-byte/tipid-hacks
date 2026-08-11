// ROADMAP.md Milestone 4: run the real data pipeline by hand (not yet on a schedule — that's
// Milestone 6). Usage:
//
//   npm run pipeline                          # all three Milestone 4 chains
//   npm run pipeline -- jollibee mcdonalds    # specific chains
//   npm run pipeline -- --no-commit           # write src/data/*.ts but skip the git commit
//
// Requires ANTHROPIC_API_KEY (a separate pay-as-you-go account per DATA-PIPELINE.md §4) —
// run `ant auth status` first if you use the Anthropic CLI profile instead of an env var.

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
