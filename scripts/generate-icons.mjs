// One-off placeholder icon generator for Milestone 3 (ROADMAP.md) — no image-processing
// dependency needed for a simple flat mark. Run with `node scripts/generate-icons.mjs`.
// Produces a rounded-square "coin" mark (peso-green bg, marker-yellow disc) matching the
// app's receipt/stamp theme (see index.css). Real branding can replace these PNGs later
// without touching code.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: none
    rgba.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, y * rowBytes + rowBytes);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Orange rounded square (bg) + white disc (coin motif). `padPct` controls how much
// breathing room surrounds the disc — maskable icons need a bigger safe-zone margin.
function drawIcon(size, { padPct, cornerPct }) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [31, 122, 92]; // --color-peso
  const fg = [244, 196, 48]; // --color-marker
  const corner = size * cornerPct;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - size * padPct;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded-square background mask (distance-to-nearest-corner-center test).
      let insideBg = true;
      const nearLeft = x < corner;
      const nearRight = x > size - corner;
      const nearTop = y < corner;
      const nearBottom = y > size - corner;
      if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
        const ccx = nearLeft ? corner : size - corner;
        const ccy = nearTop ? corner : size - corner;
        const d = Math.hypot(x - ccx, y - ccy);
        insideBg = d <= corner;
      }

      const inDisc = Math.hypot(x - cx, y - cy) <= r;
      const [cr, cg, cb] = inDisc ? fg : bg;
      const a = insideBg ? 255 : 0;
      rgba[i] = cr;
      rgba[i + 1] = cg;
      rgba[i + 2] = cb;
      rgba[i + 3] = a;
    }
  }
  return rgba;
}

const targets = [
  { file: "public/icon-192.png", size: 192, padPct: 0.28, cornerPct: 0.2 },
  { file: "public/icon-512.png", size: 512, padPct: 0.28, cornerPct: 0.2 },
  // Maskable: OS may crop to a circle, so keep the disc well inside the safe zone and
  // fill the full square with no rounding (the OS does its own masking).
  { file: "public/icon-maskable-512.png", size: 512, padPct: 0.38, cornerPct: 0 },
  { file: "public/apple-touch-icon.png", size: 180, padPct: 0.28, cornerPct: 0.22 },
];

for (const t of targets) {
  const rgba = drawIcon(t.size, t);
  writeFileSync(t.file, encodePNG(t.size, t.size, rgba));
  console.log(`wrote ${t.file}`);
}
