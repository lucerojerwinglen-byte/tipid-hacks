// Regenerates the app's icons and header wordmark from the real logo (assests/barato-logo-nobg.png)
// via a headless canvas (Playwright is already a pipeline devDependency). Re-run this after the
// source logo changes: `node scripts/generate-icons.mjs`.
//
// The source PNG (2000x1600) contains two vertically-stacked elements with no fully-transparent
// gap row between them (the "B"'s round top overlaps the wave's tail band), so the split between
// "wave" and "wordmark" below is a fixed y-coordinate picked by inspecting row pixel-density
// (see docs/adr/0003-visual-identity-teal-brand-refresh.md) rather than detected at runtime.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "assests", "barato-logo-nobg.png");
const sourceUrl = "file:///" + SOURCE.replace(/\\/g, "/");

// Bounding boxes within the 2000x1600 source, hand-picked from pixel analysis (ADR 0003).
const WAVE = { x0: 152, y0: 300, x1: 1452, y1: 555 }; // wave squiggle, small margin
// y0 was 628 (then a wrongly-judged 650 — see git history), both clipping the top of the "B"'s
// loop and other ascenders. The wave's orange tail overlaps the wordmark's own bounding box down
// to about y610 with no fully-transparent gap row between them (see the file-header comment), so
// this was re-picked by rendering several y0 candidates through the real render pipeline at
// production size and reading each one back — not by eyeballing a coordinate. y0=620 is the
// first value that fully clears the wave's tail while keeping the full glyph top intact.
const WORD = { x0: 90, y0: 620, x1: 1930, y1: 1090 }; // "Barato" wordmark, small margin

const PAGE_HTML = `
<!doctype html><html><body><canvas id="c"></canvas>
<script>
window.render = async (url, ops) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const src = document.createElement('canvas');
  src.width = img.width; src.height = img.height;
  src.getContext('2d').drawImage(img, 0, 0);

  const results = {};
  for (const [key, op] of Object.entries(ops)) {
    const { box, size, bgColor, padPct, corner } = op;
    const out = document.createElement('canvas');
    const w = size.w, h = size.h;
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    if (corner) {
      ctx.beginPath();
      ctx.moveTo(corner, 0);
      ctx.arcTo(w, 0, w, h, corner);
      ctx.arcTo(w, h, 0, h, corner);
      ctx.arcTo(0, h, 0, 0, corner);
      ctx.arcTo(0, 0, w, 0, corner);
      ctx.closePath();
      ctx.clip();
    }
    if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    const pad = padPct || 0;
    const avail = { w: w * (1 - pad * 2), h: h * (1 - pad * 2) };
    const scale = Math.min(avail.w / bw, avail.h / bh);
    const dw = bw * scale, dh = bh * scale;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.drawImage(src, box.x0, box.y0, bw, bh, dx, dy, dw, dh);
    results[key] = out.toDataURL(op.format || 'image/png', op.quality);
  }
  return results;
};
</script></body></html>`;

const CREAM = "#fffdf8";

const targets = {
  // Header wordmark: transparent bg, tight crop, exported wide for retina (~3x a 34px-tall header
  // mark). WebP (not PNG) because this asset ships in the app's own JS/asset bundle, where the
  // perf budget (PRD.md §7) applies directly — PNG came out to ~95KB for this image, WebP ~9KB.
  wordmark: {
    box: WORD,
    size: { w: 340, h: Math.round((340 * (WORD.y1 - WORD.y0)) / (WORD.x1 - WORD.x0)) },
    format: "image/webp",
    quality: 0.78,
    out: join(ROOT, "src", "assets", "brand", "wordmark.webp"),
  },
  // App icons: wave mark centered on cream, matching how the source art actually presents it.
  icon192: {
    box: WAVE,
    size: { w: 192, h: 192 },
    bgColor: CREAM,
    padPct: 0.24,
    corner: 192 * 0.2,
    out: join(ROOT, "public", "icon-192.png"),
  },
  icon512: {
    box: WAVE,
    size: { w: 512, h: 512 },
    bgColor: CREAM,
    padPct: 0.24,
    corner: 512 * 0.2,
    out: join(ROOT, "public", "icon-512.png"),
  },
  // Maskable: OS crops to a circle, so keep the mark well inside the safe zone, full-bleed bg, no rounding.
  iconMaskable: {
    box: WAVE,
    size: { w: 512, h: 512 },
    bgColor: CREAM,
    padPct: 0.34,
    out: join(ROOT, "public", "icon-maskable-512.png"),
  },
  appleTouchIcon: {
    box: WAVE,
    size: { w: 180, h: 180 },
    bgColor: CREAM,
    padPct: 0.24,
    corner: 180 * 0.22,
    out: join(ROOT, "public", "apple-touch-icon.png"),
  },
};

const { mkdirSync, writeFileSync } = await import("node:fs");

// A page loaded via setContent() sits on an about:blank origin, which still taints canvas reads
// from a file:// image even with the launch flags below — so write the harness to a real file:// URL.
const harnessPath = join(ROOT, "scripts", ".generate-icons-harness.html");
writeFileSync(harnessPath, PAGE_HTML);

const browser = await chromium.launch({
  args: ["--allow-file-access-from-files", "--disable-web-security"],
});
const page = await browser.newPage();
await page.goto("file:///" + harnessPath.replace(/\\/g, "/"));

const ops = Object.fromEntries(
  Object.entries(targets).map(([key, t]) => [
    key,
    {
      box: t.box,
      size: t.size,
      bgColor: t.bgColor,
      padPct: t.padPct,
      corner: t.corner,
      format: t.format,
      quality: t.quality,
    },
  ]),
);
const dataUrls = await page.evaluate(({ url, ops }) => window.render(url, ops), { url: sourceUrl, ops });

for (const [key, target] of Object.entries(targets)) {
  const base64 = dataUrls[key].replace(/^data:image\/\w+;base64,/, "");
  mkdirSync(dirname(target.out), { recursive: true });
  writeFileSync(target.out, Buffer.from(base64, "base64"));
  console.log(`wrote ${target.out} (${Buffer.byteLength(base64, "base64")} bytes)`);
}

await browser.close();

const { unlinkSync } = await import("node:fs");
unlinkSync(harnessPath);
