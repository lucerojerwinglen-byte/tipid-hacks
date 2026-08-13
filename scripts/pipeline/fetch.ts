// Stage 2 (fetch) + stage 3 (checksum gate) of DATA-PIPELINE.md §2.

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

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

/**
 * Milestone 5 (ROADMAP.md): KFC and Shakey's don't server-render prices — the raw HTML is an
 * empty JS shell (DATA-PIPELINE.md §1). This renders one page in headless Chromium and returns
 * the post-render DOM. Unused by the currently-wired sources (all plain HTTP), kept for when a
 * JS-rendered chain gets a deterministic parser and needs the real post-render DOM to parse.
 */
async function renderPage(browser: import("playwright").Browser, url: string): Promise<string> {
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!response || !response.ok()) {
      throw new Error(
        `Rendered fetch failed for ${url}: HTTP ${response?.status() ?? "no response"} ${response?.statusText() ?? ""}`,
      );
    }
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function fetchRendered(url: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    return await renderPage(browser, url);
  } finally {
    await browser.close();
  }
}

/**
 * Shakey's catalog has no single "all items" page that actually renders products — only its
 * per-category pages do (confirmed by hand during Milestone 5: `/catalog/categories/all` stays
 * a bare category-nav shell, while `/catalog/categories/<id>` renders that category's items).
 * Renders each url in one shared browser instance and joins the results, so the rest of the
 * pipeline (checksum, extraction) still sees a single blob of content per chain.
 */
export async function fetchRenderedMulti(urls: string[]): Promise<string> {
  const browser = await chromium.launch();
  try {
    const pages = await Promise.all(urls.map((url) => renderPage(browser, url)));
    return pages.join("\n\n<!-- ===== next category page ===== -->\n\n");
  } finally {
    await browser.close();
  }
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

