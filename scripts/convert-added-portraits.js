/**
 * Converts newly-added PNG portraits into the WebP library, in place.
 *
 * The bulk library was built once by convert-portraits.js from an external
 * master folder. This is the drip-feed companion: drop new PNGs into an
 * `*_added` folder (already named `nilcp_<asset>.png` / `nilpp_<asset>.png`)
 * and this normalizes them to match everything already shipping — 512x512,
 * WebP q90, alpha preserved.
 *
 * Matching the library exactly matters: the app reconstructs portrait paths
 * from the asset name alone (see renderer/lib/coachAssetMapping.ts), so a file
 * that differs in name, size or format simply won't be found.
 *
 * Usage:  node scripts/convert-added-portraits.js [folder ...]
 *         defaults to public/assets/coaches_added
 * Needs:  npm i -D sharp   (dev-only; never ships in the app)
 *
 * Originals are left untouched — this only writes .webp beside them, so a bad
 * conversion is always re-runnable from the masters.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 512;
const QUALITY = 90;
const DEFAULT_DIRS = [path.join(__dirname, '..', 'public', 'assets', 'coaches_added')];

async function convertDir(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`[skip] no such folder: ${dir}`);
    return { converted: 0, failed: 0 };
  }
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    console.log(`[skip] no PNGs in ${dir}`);
    return { converted: 0, failed: 0 };
  }

  console.log(`\n${dir}  —  ${files.length} PNG${files.length === 1 ? '' : 's'}`);
  let converted = 0;
  let failed = 0;

  for (const file of files) {
    const src = path.join(dir, file);
    const out = path.join(dir, file.replace(/\.png$/i, '.webp'));
    try {
      const meta = await sharp(src).metadata();
      // `fit: 'inside'` + withoutEnlargement: downscale an oversized master to
      // 512 without upscaling a smaller one into softness. Portraits are square,
      // so this never crops.
      await sharp(src)
        .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(out);

      const after = await sharp(out).metadata();
      const srcKb = (fs.statSync(src).size / 1024).toFixed(0);
      const outKb = (fs.statSync(out).size / 1024).toFixed(0);
      const resized = meta.width !== after.width ? `  (resized from ${meta.width}x${meta.height})` : '';
      console.log(`  ok  ${path.basename(out).padEnd(46)} ${after.width}x${after.height}  ${srcKb} KB -> ${outKb} KB${resized}`);
      converted++;
    } catch (err) {
      console.error(`  FAIL ${file}: ${err.message}`);
      failed++;
    }
  }
  return { converted, failed };
}

(async () => {
  const dirs = process.argv.slice(2);
  const targets = dirs.length ? dirs.map((d) => path.resolve(d)) : DEFAULT_DIRS;

  let converted = 0;
  let failed = 0;
  for (const dir of targets) {
    const r = await convertDir(dir);
    converted += r.converted;
    failed += r.failed;
  }
  console.log(`\n${converted} converted, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
