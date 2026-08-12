// Three of six chains' pipeline sources (DATA-PIPELINE.md §1). Jollibee, McDonald's, and Mang
// Inasal (Milestone 4) are plain HTTP fetches. KFC, Shakey's, and Chowking are deliberately NOT
// here — all three stay hand-maintained (src/data/{kfc,shakeys,chowking}.ts), each for its own
// reason:
// - Chowking's menu-data API sits behind Cloudflare bot protection (HTTP 403 to anything but a
//   full real-browser session, and even that only fires the call inconsistently).
// - KFC and Shakey's are JS-rendered SPAs that Playwright *can* fetch, but their real menus are
//   dense enough that the LLM-extraction step (extract.ts) blows through Groq's free-tier
//   8,000 TPM budget — runs stall on 20-50+ minute rate-limit backoffs per chunk, both locally
//   and in CI (a real Actions run on 2026-08-12 was still stuck after an hour and had to be
//   cancelled). Rather than pay for a higher Groq tier or add a second LLM provider just for two
//   chains, both moved to hand-maintained data, same as Chowking.

import type { PipelineSource } from "./types.js";

export const PIPELINE_SOURCES: PipelineSource[] = [
  {
    chain_id: "jollibee",
    chain_name: "Jollibee",
    source_url: "https://jollibeemenuprice.net/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "jb",
    export_var_name: "jollibee",
  },
  {
    chain_id: "mcdonalds",
    chain_name: "McDonald's",
    source_url: "https://mcdomenuprices.com.ph/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "mc",
    export_var_name: "mcdonalds",
  },
  {
    chain_id: "mang-inasal",
    chain_name: "Mang Inasal",
    source_url: "https://www.manginasal.ph/news/menu-and-prices",
    source_type: "official",
    fetch_method: "http",
    id_prefix: "mi",
    export_var_name: "mangInasal",
  },
];

export function getSource(chainId: string): PipelineSource {
  const source = PIPELINE_SOURCES.find((s) => s.chain_id === chainId);
  if (!source) {
    throw new Error(
      `No pipeline source for chain "${chainId}". Available: ${PIPELINE_SOURCES.map((s) => s.chain_id).join(", ")}`,
    );
  }
  return source;
}
