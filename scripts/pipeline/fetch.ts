// Stage 2 (fetch) + stage 3 (checksum gate) of DATA-PIPELINE.md §2.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CHECKSUMS_PATH = path.resolve(import.meta.dirname, "../../data/checksums.json");

const USER_AGENT =
  "barato-pipeline/0.1 (+https://github.com/; weekly price-check, see DATA-PIPELINE.md)";

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

const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "...",
  mdash: "—",
  ndash: "–",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(nbsp|amp|lt|gt|quot|apos|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/g, (_, name) => HTML_ENTITIES[name] ?? _)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/**
 * Strips a raw fetched page down to visible text before it goes to the LLM. Markup-heavy pages
 * (deeply nested divs, class/id/data-* attributes) can be 10-20x the size of their actual
 * visible content — Groq's free-tier tokens-per-minute limit is a few thousand tokens, so
 * sending near-raw HTML (fine for Claude/Gemini's much larger request budgets) blows straight
 * through it on real menu pages. Tags are converted to plain text rather than merely trimmed.
 */
export function stripHtmlNoise(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // Preserve visual line breaks between block-level elements before the tag strip below,
      // so adjacent item names/prices don't get glued into one unparseable run of text.
      .replace(/<\/(p|div|li|tr|td|th|h[1-6]|section|article|header|footer|ul|ol)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 400_000); // Safety valve — a well-formed menu page's visible text is nowhere near this large.
}
