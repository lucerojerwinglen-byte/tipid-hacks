// Reads the currently-committed data for a chain straight out of src/data/<chain_id>.ts —
// this is the "previous version" the validate and diff stages compare against.

import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ChainData } from "../../src/types.js";
import type { PipelineSource } from "./types.js";

export async function loadCurrentChainData(source: PipelineSource): Promise<ChainData | undefined> {
  const filePath = path.resolve(import.meta.dirname, `../../src/data/${source.chain_id}.ts`);
  try {
    // Dynamic import() needs a file:// URL on Windows — a bare absolute path (C:\...) isn't
    // a valid ESM specifier there, even though it works unmodified on macOS/Linux.
    const mod: Record<string, ChainData> = await import(pathToFileURL(filePath).href);
    return mod[source.export_var_name];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") return undefined;
    throw err;
  }
}
