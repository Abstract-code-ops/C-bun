// Generates the C-bun app icons (no dependencies). Run from the project root:
//   node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? 'public/icons';
mkdirSync(OUT, { recursive: true });

const BG = [9, 12, 18], GLOW = [15, 58, 47], MINT = [0, 229, 160], WHITE = [255, 255, 255];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// --- tiny PNG encoder ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgb) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgb.buffer, y * size * 3, size * 3).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- the design: two "reps" as a motion curve ending in a live dot ---
const N = 240;
const path = Array.from({ length: N + 1 }, (_, i) => {
  const t = i / N;
  return [0.22 + 0.56 * t, 0.5 - 0.14 * Math.cos(4 * Math.PI * t)];
});
const end = path[N];

function render(size) {
  const px = new Uint8Array(size * size * 3);
  const hw = 0.042 * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const g = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.3) / 0.75);
      let c = mix(BG, GLOW, g * g);

      let d2 = Infinity;
      for (const [pu, pv] of path) {
        const dd = (u - pu) ** 2 + (v - pv) ** 2;
        if (dd < d2) d2 = dd;
      }
      const dpx = Math.sqrt(d2) * size;
      c = mix(c, MINT, Math.exp(-((dpx / (size * 0.07)) ** 2)) * 0.22);
      c = mix(c, MINT, clamp(hw - dpx + 0.5, 0, 1));

      const de = Math.hypot(u - end[0], v - end[1]) * size;
      c = mix(c, MINT, clamp(0.075 * size - de + 0.5, 0, 1));
      c = mix(c, WHITE, clamp(0.048 * size - de + 0.5, 0, 1));

      const o = (y * size + x) * 3;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
  }
  return px;
}

const files = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
];
const cache = new Map();
for (const [name, size] of files) {
  if (!cache.has(size)) cache.set(size, png(size, render(size)));
  writeFileSync(`${OUT}/${name}`, cache.get(size));
  console.log('wrote', `${OUT}/${name}`);
}