// Milestone 3 (ROADMAP.md): IndexedDB via idb-keyval for cached price data.
//
// Price data currently ships baked into the JS bundle (ARCHITECTURE.md §1), not fetched
// separately at runtime, so this isn't in the request path of a normal load — the bundle
// always has data. What it buys instead: a durable snapshot that outlives the service
// worker's Cache Storage entry (IndexedDB is evicted far less aggressively under storage
// pressure) and a stable read/write shape that Milestone 4/5's real data pipeline can adopt
// unchanged once prices are fetched at runtime instead of bundled at build time.
import { get, set } from "idb-keyval";
import type { ChainData } from "./types.js";

const CACHE_KEY = "barato:price-snapshot";

export interface PriceSnapshot {
  chains: ChainData[];
  cachedAt: string;
}

export async function savePriceSnapshot(chains: ChainData[]): Promise<void> {
  const snapshot: PriceSnapshot = { chains, cachedAt: new Date().toISOString() };
  try {
    await set(CACHE_KEY, snapshot);
  } catch {
    // IndexedDB can be unavailable (private browsing, storage quota, disabled by policy) —
    // the app works fine off the bundled data either way, so this is best-effort only.
  }
}

export async function loadPriceSnapshot(): Promise<PriceSnapshot | undefined> {
  try {
    return await get<PriceSnapshot>(CACHE_KEY);
  } catch {
    return undefined;
  }
}
