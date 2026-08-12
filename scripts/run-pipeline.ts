// ROADMAP.md Milestones 4-5: run the real data pipeline by hand (not yet on a schedule —
// that's Milestone 6). Usage:
//
//   npm run pipeline                          # all five wired chains (Chowking is hand-maintained)
//   npm run pipeline -- jollibee kfc          # specific chains
//   npm run pipeline -- --no-commit           # write src/data/*.ts but skip the git commit
//
// Requires GROQ_API_KEY (free-tier Groq API key per DATA-PIPELINE.md §4) — put it in a .env
// file at the project root (see .env.example); .env is git-ignored and never committed.

import "dotenv/config";
import { PIPELINE_SOURCES } from "./pipeline/sources.js";
import { runChain } from "./pipeline/run.js";

if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your-groq-api-key-here") {
  console.error(
    "GROQ_API_KEY is not set. Copy .env.example to .env and paste your real key in there.",
  );
  process.exit(1);
}

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
