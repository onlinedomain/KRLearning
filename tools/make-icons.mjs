// Generates PNG app icons (no dependencies). Run: node tools/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG = [194, 80, 47], PAPER = [255, 249, 239], INK = [194, 80, 47];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Shapes in unit coordinates (0..1). Returns color or null.
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r)), cy = Math.max(y0 + r, Math.min(y, y1 - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function shade(x, y, maskable) {
  // Background (full bleed for maskable, rounded otherwise)
  if (!maskable && !inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return null;
  const s = maskable ? 0.8 : 1, o = (1 - s) / 2; // safe zone for maskable icons
  const u = (x - o) / s, v = (y - o) / s;
  // Open book: two pages
  const left = inRoundRect(u, v, 0.17, 0.27, 0.49, 0.75, 0.05);
  const right = inRoundRect(u, v, 0.51, 0.27, 0.83, 0.75, 0.05);
  if (left || right) {
    // text lines on pages
    const lines = [0.38, 0.47, 0.56, 0.65];
    for (const ly of lines) {
      if (Math.abs(v - ly) < 0.018 && ((u > 0.23 && u < 0.44) || (u > 0.56 && u < (ly === 0.65 ? 0.68 : 0.77)))) return INK;
    }
    return PAPER;
  }
  // Plus badge
  if ((u - 0.79) ** 2 + (v - 0.23) ** 2 < 0.115 ** 2) {
    if ((Math.abs(u - 0.79) < 0.022 && Math.abs(v - 0.23) < 0.07) || (Math.abs(v - 0.23) < 0.022 && Math.abs(u - 0.79) < 0.07)) return INK;
    return PAPER;
  }
  return BG;
}

function png(size, maskable = false) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, maskable);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = a ? r / a : 0; raw[i + 1] = a ? g / a : 0; raw[i + 2] = a ? b / a : 0; raw[i + 3] = (a / (SS * SS)) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const [name, size, mask] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-180.png', 180, true], ['maskable-512.png', 512, true]]) {
  fs.writeFileSync(new URL(`../icons/${name}`, import.meta.url), png(size, mask));
}
fs.writeFileSync(new URL('../icons/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#C2502F"/>
<rect x="17" y="27" width="32" height="48" rx="5" fill="#FFF9EF"/><rect x="51" y="27" width="32" height="48" rx="5" fill="#FFF9EF"/>
<g stroke="#C2502F" stroke-width="3.6" stroke-linecap="round"><path d="M24 38h19M24 47h19M24 56h19M24 65h19M57 38h19M57 47h19M57 56h19M57 65h11"/></g>
<circle cx="79" cy="23" r="11.5" fill="#FFF9EF"/><path d="M79 16.5v13M72.5 23h13" stroke="#C2502F" stroke-width="4.4" stroke-linecap="round"/></svg>`);
console.log('icons written');
