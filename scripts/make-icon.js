/**
 * Builds build/icon.ico (Windows multi-size app icon) from public/Icon/ICON.png.
 * Re-runnable: drop in a new ICON.png and run `node scripts/make-icon.js`.
 *
 * ICO entries are PNG-compressed (valid since Vista) — 256 down to 16 so the
 * icon stays sharp in the installer, Alt-Tab, taskbar, and Explorer list views.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '..', 'public', 'Icon', 'ICON.png');
const OUT_DIR = path.join(__dirname, '..', 'build');
const OUT = path.join(OUT_DIR, 'icon.ico');
const SIZES = [256, 128, 64, 48, 32, 16];

async function main() {
  const pngs = [];
  for (const size of SIZES) {
    const buf = await sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toBuffer();
    pngs.push({ size, buf });
  }

  const headerSize = 6 + 16 * pngs.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = headerSize;
  pngs.forEach(({ size, buf }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size === 256 ? 0 : size, entry); // width (0 = 256)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette colors
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(buf.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += buf.length;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, Buffer.concat([header, ...pngs.map((p) => p.buf)]));
  console.log(`Wrote ${OUT} (${SIZES.join('/')}px, ${fs.statSync(OUT).size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
