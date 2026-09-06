// Zero-dependency PWA icon generator: navy pitch, yellow ring, white ball.
// Run: node scripts/gen-icons.mjs (output committed to public/icons/).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}
function icon(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const dx = (x - cx) / size, dy = (y - cy) / size;
    const d = Math.hypot(dx, dy);
    // navy background with subtle mow stripes
    const stripe = Math.floor(x / (size / 8)) % 2 === 0;
    let r = stripe ? 46 : 38, g = stripe ? 120 : 104, b = stripe ? 64 : 56;
    // yellow ring
    if (Math.abs(d - 0.36) < 0.035) { r = 247; g = 191; b = 48; }
    // white ball with dark patches
    if (d < 0.2) {
      const patch = Math.sin(x * 0.9) * Math.cos(y * 1.1) > 0.55;
      r = patch ? 31 : 247; g = patch ? 48 : 243; b = patch ? 64 : 233;
    }
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}
mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });
for (const s of [192, 512]) {
  const url = new URL(`../public/icons/icon-${s}.png`, import.meta.url);
  writeFileSync(url, icon(s));
  console.log('wrote', url.pathname);
}
