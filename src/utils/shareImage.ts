// Orchestration + feature detection for PRD.md §4's share-as-image feature. renderReceiptToBlob
// needs a real HTMLCanvasElement/Image and shareOrDownloadReceipt needs a real
// navigator.share/Blob — neither exists in this repo's Node-only vitest setup, so only the pure
// pieces below (canShareFiles, buildReceiptFilename) are unit tested; the rest is verified by
// hand in a real browser (same treatment priceCache.ts's storage calls already get).
import { drawReceipt } from "./receiptCanvas.js";
import { DEFAULT_LAYOUT, type LayoutConstants, type ReceiptLine } from "./receiptLayout.js";

// Rendered at 2x the logical layout size so the shared PNG looks sharp on a phone screen or a
// group-chat thumbnail, matching how a real receipt photo actually gets shared.
const RENDER_SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function renderReceiptToBlob(
  lines: ReceiptLine[],
  wordmarkUrl: string,
  width: number,
  height: number,
  constants: LayoutConstants = DEFAULT_LAYOUT,
): Promise<Blob> {
  const wordmarkImg = await loadImage(wordmarkUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width * RENDER_SCALE;
  canvas.height = height * RENDER_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.scale(RENDER_SCALE, RENDER_SCALE);

  drawReceipt(ctx, lines, wordmarkImg, width, height, constants);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}

/** Dependency-injected so it's testable without a real Navigator/jsdom. */
export function canShareFiles(nav?: Pick<Navigator, "share" | "canShare"> | null): boolean {
  if (!nav?.share || !nav.canShare) return false;
  try {
    return nav.canShare({ files: [new File([""], "receipt.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** Pure — deterministic given a fixed chain id and ISO date. */
export function buildReceiptFilename(chainId: string, dateIso: string): string {
  const datePart = dateIso.slice(0, 10) || "unknown-date";
  return `barato-${chainId}-${datePart}.png`;
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";

export async function shareOrDownloadReceipt(
  blob: Blob,
  filename: string,
  nav: Navigator = navigator,
): Promise<ShareOutcome> {
  if (canShareFiles(nav)) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      await nav.share({ files: [file] });
      return "shared";
    } catch (err) {
      // A user backing out of the OS share sheet is a normal cancellation, not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      return "failed";
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
