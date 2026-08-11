// Milestone 4 sources — the three chains needing only a plain HTTP fetch (DATA-PIPELINE.md §1).
// KFC, Chowking, Shakey's need Playwright and are Milestone 5's job (ROADMAP.md).

import type { PipelineSource } from "./types.js";

export const PIPELINE_SOURCES: PipelineSource[] = [
  {
    chain_id: "jollibee",
    chain_name: "Jollibee",
    source_url: "https://jollibeemenuprice.net/",
    source_type: "third-party-aggregator",
    id_prefix: "jb",
    export_var_name: "jollibee",
  },
  {
    chain_id: "mcdonalds",
    chain_name: "McDonald's",
    source_url: "https://mcdomenuprices.com.ph/",
    source_type: "third-party-aggregator",
    id_prefix: "mc",
    export_var_name: "mcdonalds",
  },
  {
    chain_id: "mang-inasal",
    chain_name: "Mang Inasal",
    source_url: "https://www.manginasal.ph/news/menu-and-prices",
    source_type: "official",
    id_prefix: "mi",
    export_var_name: "mangInasal",
  },
];

export function getSource(chainId: string): PipelineSource {
  const source = PIPELINE_SOURCES.find((s) => s.chain_id === chainId);
  if (!source) {
    throw new Error(
      `No Milestone 4 pipeline source for chain "${chainId}". Available: ${PIPELINE_SOURCES.map((s) => s.chain_id).join(", ")}`,
    );
  }
  return source;
}
