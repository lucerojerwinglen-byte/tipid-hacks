import type { Locale } from "./dictionary.js";

export const LOCALE_STORAGE_KEY = "barato:locale";

/** Pure — no globals touched. Narrows an arbitrary stored/external value down to a real Locale. */
export function parseLocale(raw: string | null | undefined): Locale | null {
  return raw === "tl" || raw === "en" ? raw : null;
}

// A single small preference string is a different risk profile than the price-data cache
// ARCHITECTURE.md rejected localStorage for (main-thread jank from a large synchronous read on
// 2GB-RAM devices) — this is a couple of bytes, read once at startup. idb-keyval's async read
// would just add a startup flicker for no benefit here.

export function loadLocale(defaultLocale: Locale = "tl"): Locale {
  try {
    return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY)) ?? defaultLocale;
  } catch {
    return defaultLocale; // private browsing / storage disabled — same fallback as priceCache.ts
  }
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // best-effort, same as priceCache.ts
  }
}
