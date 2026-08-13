// Three of six chains' pipeline sources (DATA-PIPELINE.md §1). Jollibee, McDonald's, and Mang
// Inasal (Milestone 4) are plain HTTP fetches, parsed deterministically by their own file in
// scripts/pipeline/parsers/ — no LLM involved anywhere in this pipeline anymore (Milestone 5
// dropped Groq entirely; see below). KFC, Shakey's, and Chowking are deliberately NOT here — all
// three stay hand-maintained (src/data/{kfc,shakeys,chowking}.ts), each for its own reason:
// - Chowking's menu-data API sits behind Cloudflare bot protection (HTTP 403 to anything but a
//   full real-browser session, and even that only fires the call inconsistently).
// - KFC and Shakey's are JS-rendered SPAs (Playwright *can* fetch them, but their real menus
//   don't have Jollibee/McDonald's/Mang Inasal's simple table/card-grid structure to parse
//   deterministically) — small enough catalogs that hand-typing was less work than writing a
//   bespoke parser for each. This was originally an LLM-extraction step (Groq); that step blew
//   through Groq's free-tier 8,000 TPM budget on KFC/Shakey's dense menus (runs stalled on
//   20-50+ minute rate-limit backoffs, both locally and in CI — a real Actions run on 2026-08-12
//   was still stuck after an hour and had to be cancelled) and was replaced with deterministic
//   per-chain parsers here for these three, and hand-maintained data for KFC/Shakey's/Chowking.

import type { PipelineSource } from "./types.js";
import { parse as parseJollibee } from "./parsers/jollibee.js";
import { parse as parseMcdonalds } from "./parsers/mcdonalds.js";
import { parse as parseMangInasal } from "./parsers/mang-inasal.js";

export const PIPELINE_SOURCES: PipelineSource[] = [
  {
    chain_id: "jollibee",
    chain_name: "Jollibee",
    source_url: "https://jollibeemenuprice.net/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "jb",
    export_var_name: "jollibee",
    parse: parseJollibee,
  },
  {
    chain_id: "mcdonalds",
    chain_name: "McDonald's",
    source_url: "https://mcdomenuprices.com.ph/",
    source_type: "third-party-aggregator",
    fetch_method: "http",
    id_prefix: "mc",
    export_var_name: "mcdonalds",
    parse: parseMcdonalds,
  },
  {
    chain_id: "mang-inasal",
    chain_name: "Mang Inasal",
    source_url: "https://www.manginasal.ph/news/menu-and-prices",
    source_type: "official",
    fetch_method: "http",
    id_prefix: "mi",
    export_var_name: "mangInasal",
    parse: parseMangInasal,
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
