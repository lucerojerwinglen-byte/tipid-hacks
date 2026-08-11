// Milestone 4 (ROADMAP.md): types for the fetch -> LLM parse -> validate -> diff -> commit
// pipeline described in DATA-PIPELINE.md. Deliberately separate from src/types.ts — these
// are pipeline-internal shapes (pre-id-generation, pre-merge), not the app's data model.

import type { Category, Item } from "../../src/types.js";

/** One item as extracted directly from raw page content by the LLM, before ids are assigned. */
export interface ExtractedItem {
  name: string;
  category: Category;
  price: number;
  serves: number;
  main_servings: number;
  carb_servings: number;
  shareable: boolean;
  is_combo: boolean;
  /** Component names as they appear elsewhere in the same extraction batch. Empty if not a combo. */
  combo_component_names: { name: string; qty: number }[];
  tags: string[];
  available: boolean;
}

export interface ExtractionResult {
  items: ExtractedItem[];
}

/** Static per-chain pipeline configuration (DATA-PIPELINE.md §1). */
export interface PipelineSource {
  chain_id: string;
  chain_name: string;
  source_url: string;
  source_type: "official" | "third-party-aggregator";
  /** Short id prefix matching the hand-typed convention (e.g. "jb", "mc", "mi"). */
  id_prefix: string;
  /** The `export const <name>` identifier in src/data/<chain_id>.ts (e.g. "mangInasal"). */
  export_var_name: string;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  items: Item[];
}

export interface DiffEntry {
  kind: "added" | "removed" | "price-changed";
  id: string;
  name: string;
  detail: string;
}
