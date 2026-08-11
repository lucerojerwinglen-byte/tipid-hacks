// PRD.md §4: low-key by default, tone shifts to soft/friendly (never alarming) past ~3-4
// weeks of staleness. Reads straight off the chain data actually powering the result shown
// (Chain.last_updated) — that's the one date guaranteed to match what's on screen.
const STALE_AFTER_DAYS = 25; // midpoint of the "3-4 weeks" band in PRD.md §4

interface FreshnessIndicatorProps {
  lastUpdated: string;
}

export function FreshnessIndicator({ lastUpdated }: FreshnessIndicatorProps) {
  const updatedDate = new Date(lastUpdated);
  if (Number.isNaN(updatedDate.getTime())) return null;

  const daysStale = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = daysStale >= STALE_AFTER_DAYS;
  const formatted = updatedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <p
      className={
        isStale
          ? "mb-1.5 ml-1 inline-block rounded-full bg-marker/30 px-3 py-1 font-display text-xs text-ink"
          : "mb-1.5 ml-1 inline-block font-display text-xs text-ink-muted"
      }
    >
      {isStale
        ? `Prices as of ${formatted} — might be a little out of date`
        : `Prices as of ${formatted}`}
    </p>
  );
}
