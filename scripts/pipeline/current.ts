// Reads the currently-committed data for a chain straight out of src/data/<chain_id>.ts —
// this is the "previous version" the validate and diff stages compare against.

import path from "node:path";
import type { ChainData } from "../../src/types.js";
import type { PipelineSource } from "./types.js";

export async function loadCurrentChainData(source: PipelineSource): Promise<ChainData | undefined> {
  const filePath = path.resolve(import.meta.dirname, `../../src/data/${source.chain_id}.ts`);
  try {
    const mod: Record<string, ChainData> = await import(filePath);
    return mod[source.export_var_name];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") return undefined;
    throw err;
  }
}
