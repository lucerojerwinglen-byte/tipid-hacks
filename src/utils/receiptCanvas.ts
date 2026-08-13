// The actual fillRect/fillText/drawImage calls — not unit tested, same category as component
// view code (needs a real CanvasRenderingContext2D, which this repo's Node-only vitest setup
// doesn't have). Layout math lives in receiptLayout.ts and *is* tested there.
import { DEFAULT_LAYOUT, wrapText, type LayoutConstants, type ReceiptLine } from "./receiptLayout.js";

const MONO_FONT = "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', 'Consolas', monospace";

// Colors read live from the CSS custom properties (index.css, docs/adr/0003) rather than a
// second hardcoded palette here, so they can't silently drift out of sync if the brand palette
// is ever revisited again.
function cssColor(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

export function drawReceipt(
  ctx: CanvasRenderingContext2D,
  lines: ReceiptLine[],
  wordmarkImg: HTMLImageElement,
  width: number,
  height: number,
  constants: LayoutConstants = DEFAULT_LAYOUT,
): void {
  const { padding, lineHeight, wordmarkHeight, wordmarkGap, maxChars } = constants;
  const paper = cssColor("--color-paper", "#fffdf8");
  const ink = cssColor("--color-ink", "#201d1a");
  const inkMuted = cssColor("--color-ink-muted", "#6b6459");
  const stamp = cssColor("--color-stamp", "#996900");
  const lineColor = cssColor("--color-line", "#e4dcc9");

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "alphabetic";

  let y = padding;

  const rightAlignedAmount = (amount: string, baselineY: number) => {
    const w = ctx.measureText(amount).width;
    ctx.fillText(amount, width - padding - w, baselineY);
  };

  for (const line of lines) {
    switch (line.type) {
      case "wordmark": {
        const targetW = (wordmarkImg.naturalWidth / wordmarkImg.naturalHeight) * wordmarkHeight;
        ctx.drawImage(wordmarkImg, padding, y, targetW, wordmarkHeight);
        y += wordmarkHeight + wordmarkGap;
        break;
      }
      case "heading": {
        ctx.font = `600 13px ${MONO_FONT}`;
        ctx.fillStyle = inkMuted;
        ctx.fillText(line.text, padding, y + 10);
        y += lineHeight;
        break;
      }
      case "item": {
        const wrapped = wrapText(line.label, maxChars);
        wrapped.forEach((part, i) => {
          ctx.font = `14px ${MONO_FONT}`;
          ctx.fillStyle = ink;
          ctx.fillText(part, padding, y + 10);
          if (i === 0) {
            ctx.font = `600 14px ${MONO_FONT}`;
            ctx.fillStyle = ink;
            rightAlignedAmount(line.amount, y + 10);
          }
          y += lineHeight;
        });
        break;
      }
      case "divider": {
        ctx.strokeStyle = lineColor;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding, y + 4);
        ctx.lineTo(width - padding, y + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        y += lineHeight * 0.6;
        break;
      }
      case "total": {
        ctx.font = `700 17px ${MONO_FONT}`;
        ctx.fillStyle = ink;
        ctx.fillText(line.label, padding, y + 12);
        rightAlignedAmount(line.amount, y + 12);
        y += lineHeight * 1.3;
        break;
      }
      case "note": {
        ctx.font = `12px ${MONO_FONT}`;
        ctx.fillStyle = inkMuted;
        ctx.fillText(line.text, padding, y + 9);
        y += lineHeight * 0.9;
        break;
      }
      case "stamp": {
        ctx.font = `700 13px ${MONO_FONT}`;
        ctx.fillStyle = stamp;
        ctx.strokeStyle = stamp;
        const textW = ctx.measureText(line.text).width;
        ctx.strokeRect(padding, y, textW + 16, 24);
        ctx.fillText(line.text, padding + 8, y + 16);
        y += lineHeight * 1.6;
        break;
      }
      case "footer": {
        ctx.font = `11px ${MONO_FONT}`;
        ctx.fillStyle = inkMuted;
        for (const part of wrapText(line.text, maxChars)) {
          ctx.fillText(part, padding, y + 8);
          y += lineHeight * 0.8;
        }
        break;
      }
    }
  }
}
