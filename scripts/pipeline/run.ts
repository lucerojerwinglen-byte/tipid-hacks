// Orchestrates the full pipeline for one chain: fetch -> checksum gate -> LLM parse ->
// validate -> diff -> commit (DATA-PIPELINE.md §2). Invoked by scripts/run-pipeline.ts.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checksumOf, fetchRaw, isUnchangedSinceLastRun, recordChecksum, stripHtmlNoise } from "./fetch.js";
import { extractItems } from "./extract.js";
import { assignIdsAndResolveCombos } from "./ids.js";
import { loadCurrentChainData } from "./current.js";
import { validateExtractedItems } from "./validate.js";
import { loadOverrides, applyOverrides } from "./overrides.js";
import { diffItems, formatDiff } from "./diff.js";
import { writeChainDataFile } from "./write.js";
import { getSource } from "./sources.js";
import type { ChainData } from "../../src/types.js";

const execFileAsync = promisify(execFile);

export interface RunOptions {
  commit: boolean;
}

export interface RunResult {
  chainId: string;
  status: "skipped-unchanged" | "committed" | "blocked" | "written-not-committed";
  message: string;
}

export async function runChain(chainId: string, options: RunOptions): Promise<RunResult> {
  const source = getSource(chainId);
  console.log(`\n${"=".repeat(60)}\n${source.chain_name} (${source.chain_id})\n${"=".repeat(60)}`);

  // Stage 2: fetch.
  const raw = await fetchRaw(source.source_url);
  console.log(`Fetched ${raw.length.toLocaleString()} bytes, checksum ${checksumOf(raw).slice(0, 12)}...`);

  // Stage 3: checksum gate.
  if (await isUnchangedSinceLastRun(chainId, raw)) {
    console.log("Unchanged since last run — skipping LLM parse and commit.");
    return { chainId, status: "skipped-unchanged", message: "No change detected." };
  }

  // Stage 4: LLM parse.
  const cleaned = stripHtmlNoise(raw);
  console.log(`Extracting items via Gemini (${cleaned.length.toLocaleString()} chars of input)...`);
  const extracted = await extractItems(cleaned, source.chain_name);
  console.log(`Extracted ${extracted.length} raw items.`);

  const { items: pipelineItems, errors: idErrors } = assignIdsAndResolveCombos(
    extracted,
    source.chain_id,
    source.id_prefix,
  );

  // Stage 5: validate.
  const previousChainData = await loadCurrentChainData(source);
  const previousItems = previousChainData?.items ?? [];
  const validation = validateExtractedItems(pipelineItems, previousItems);
  const allIssues = [...idErrors.map((message) => ({ severity: "error" as const, message })), ...validation.issues];
  const ok = validation.ok && idErrors.length === 0;

  if (allIssues.length > 0) {
    console.log("\nValidation issues:");
    for (const issue of allIssues) {
      console.log(`  [${issue.severity}] ${issue.message}`);
    }
  }

  if (!ok) {
    console.log(`\nBLOCKED — not committing. Checksum not recorded, so the next run retries this fetch.`);
    return {
      chainId,
      status: "blocked",
      message: `${allIssues.filter((i) => i.severity === "error").length} validation error(s) blocked the commit.`,
    };
  }

  // Manual overrides merge (never overwritten by the pipeline itself).
  const overrides = await loadOverrides(chainId);
  const finalItems = applyOverrides(pipelineItems, overrides);
  if (overrides.length > 0) {
    console.log(`Applied ${overrides.length} manual-override item(s).`);
  }

  // Stage 6: diff.
  const diff = diffItems(finalItems, previousItems);
  console.log(`\nDiff vs. currently committed data:\n${formatDiff(diff)}`);

  if (diff.length === 0) {
    console.log("\nNo item-level changes despite a raw content change — recording checksum, nothing to commit.");
    await recordChecksum(chainId, raw);
    return { chainId, status: "skipped-unchanged", message: "Raw content changed but no item-level diff." };
  }

  const chainData: ChainData = {
    chain: {
      id: source.chain_id,
      name: source.chain_name,
      source_url: source.source_url,
      source_type: source.source_type,
      last_updated: new Date().toISOString().slice(0, 10),
      notes: previousChainData?.chain.notes ?? "NCR reference pricing; sourced by the automated pipeline.",
    },
    items: finalItems,
  };

  // Stage 7: commit.
  const filePath = await writeChainDataFile(source, chainData);
  await recordChecksum(chainId, raw);
  console.log(`\nWrote ${filePath}`);

  if (!options.commit) {
    return { chainId, status: "written-not-committed", message: "File written; --no-commit set, skipping git commit." };
  }

  try {
    await execFileAsync("git", ["add", filePath, "data/checksums.json"]);
    const summary = `${diff.length} item change(s): ${diff
      .slice(0, 5)
      .map((d) => `${d.kind} ${d.id}`)
      .join(", ")}${diff.length > 5 ? ", ..." : ""}`;
    await execFileAsync("git", [
      "commit",
      "-m",
      `pipeline: update ${source.chain_name} prices\n\n${summary}\n\nSource: ${source.source_url}`,
    ]);
    console.log("Committed.");
    return { chainId, status: "committed", message: summary };
  } catch (err) {
    console.log(`git commit failed (file was still written): ${(err as Error).message}`);
    return { chainId, status: "written-not-committed", message: "git commit failed; see log above." };
  }
}
