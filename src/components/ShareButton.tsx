import { useState } from "react";
import wordmarkUrl from "../assets/brand/wordmark.webp";
import { useLocale } from "../i18n/LocaleContext.js";
import type { SolveResult } from "../solver.js";
import { buildReceiptLines, computeCanvasHeight } from "../utils/receiptLayout.js";
import {
  buildReceiptFilename,
  renderReceiptToBlob,
  shareOrDownloadReceipt,
} from "../utils/shareImage.js";

const CANVAS_WIDTH = 360;
const REPO_URL = "github.com/lucerojerwinglen-byte/tipid-hacks"; // ARCHITECTURE.md — no deployed domain yet

function pesos(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

interface ShareButtonProps {
  result: SolveResult;
  chainDisplayName: string;
  chainId: string;
  lastUpdated: string;
}

type Status = "idle" | "rendering" | "downloaded" | "error";

export function ShareButton({ result, chainDisplayName, chainId, lastUpdated }: ShareButtonProps) {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status>("idle");

  async function handleShare() {
    setStatus("rendering");
    try {
      const modeLabel =
        result.mode === "maximum-food"
          ? t.modes.maximumFood.label
          : result.mode === "feed-everyone"
            ? t.modes.feedEveryone.label
            : t.modes.cheapestPossible.label;

      const freshnessDate = new Date(lastUpdated);
      const freshnessText = Number.isNaN(freshnessDate.getTime())
        ? ""
        : t.freshness.fresh(
            freshnessDate.toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          );

      const lines = buildReceiptLines({
        result,
        chainDisplayName,
        modeLabel,
        freshnessText,
        footerText: `barato — ${REPO_URL}`,
        bonusLabel: result.mode === "maximum-food" ? t.results.bonusIncluded : t.results.bonusSuggested,
        savingsText:
          result.savings !== null && result.savings > 0
            ? t.results.savings(pesos(result.savings))
            : null,
        totalLabel: t.results.total,
        leftOverText: t.results.leftOver(pesos(result.leftover)),
      });
      const height = computeCanvasHeight(lines);

      const blob = await renderReceiptToBlob(lines, wordmarkUrl, CANVAS_WIDTH, height);
      const filename = buildReceiptFilename(chainId, new Date().toISOString());
      const outcome = await shareOrDownloadReceipt(blob, filename);

      if (outcome === "downloaded") {
        setStatus("downloaded");
        setTimeout(() => setStatus("idle"), 3000);
      } else if (outcome === "failed") {
        setStatus("error");
      } else {
        // "shared" (OS handled it) or "cancelled" (user backed out) — nothing more to show.
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "rendering"
      ? t.share.rendering
      : status === "downloaded"
        ? t.share.downloadedNote
        : status === "error"
          ? t.share.error
          : t.share.button;

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={status === "rendering"}
      className="mt-5 w-full rounded-lg border border-brand px-4 py-3 text-sm font-semibold
                 text-brand transition-colors hover:bg-brand-soft disabled:opacity-60"
    >
      {label}
    </button>
  );
}
