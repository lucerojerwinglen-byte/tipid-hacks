// Stage 2 (fetch) + stage 3 (checksum gate) of DATA-PIPELINE.md §2.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CHECKSUMS_PATH = path.resolve(import.meta.dirname, "../../data/checksums.json");

const USER_AGENT =
  "tipid-hacks-pipeline/0.1 (+https://github.com/; weekly price-check, see DATA-PIPELINE.md)";

export async function fetchRaw(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function checksumOf(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

type ChecksumStore = Record<string, string>;

async function readChecksums(): Promise<ChecksumStore> {
  try {
    return JSON.parse(await readFile(CHECKSUMS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

/** Returns true if `content`'s checksum matches the last recorded run for `chainId` (skip signal). */
export async function isUnchangedSinceLastRun(chainId: string, content: string): Promise<boolean> {
  const checksums = await readChecksums();
  return checksums[chainId] === checksumOf(content);
}

export async function recordChecksum(chainId: string, content: string): Promise<void> {
  const checksums = await readChecksums();
  checksums[chainId] = checksumOf(content);
  await mkdir(path.dirname(CHECKSUMS_PATH), { recursive: true });
  await writeFile(CHECKSUMS_PATH, JSON.stringify(checksums, null, 2) + "\n", "utf-8");
}

/**
 * Strips script/style/comment noise from raw HTML before it goes to the LLM — cuts token
 * spend without touching the visible text (prices, item names) the extraction step reads.
 */
export function stripHtmlNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 400_000); // Safety valve — a well-formed menu page is nowhere near this large.
}
