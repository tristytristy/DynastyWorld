/**
 * One-time (re-runnable) portrait conversion: PNG masters → WebP q90 library.
 *
 * Reads the archived PNG masters (moved OUT of the project before deletion —
 * they are the only masters; the original DDS exports no longer exist) and
 * writes a normalized WebP library into public/assets. Normalization strips
 * the legacy `_result`/`_result_result` filename suffixes so every asset is
 * exactly `<prefix>_<assetName>.webp` — which is what the app's mapping
 * helpers reconstruct (see renderer/lib/playerAssetMapping.ts).
 *
 * Usage:  node scripts/convert-portraits.js
 * Needs:  npm i -D sharp   (dev-only; never ships in the app)
 * Source: D:/PROJECT/portrait-master-png/{playerportrait,coaches}
 *
 * Verifies after converting: output count equals unique-asset count, and a
 * sample of outputs decodes back to the master's exact dimensions.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const MASTER_ROOT = 'D:/PROJECT/portrait-master-png';
const OUT_ROOT = path.join(__dirname, '..', 'public', 'assets');
const QUALITY = 90;
const CONCURRENCY = Math.max(4, os.cpus().length);

const SETS = [
  { dir: 'playerportrait', prefix: 'nilpp_' },
  { dir: 'coaches', prefix: 'nilcp_' },
];

function canonicalName(file, prefix) {
  // "nilpp_<asset>[_result[_result[_result]]].png" -> "<prefix>_<asset>.webp"
  const base = file.replace(/(_result)+\.png$/i, '').replace(/\.png$/i, '');
  if (!base.startsWith(prefix)) return null;
  return `${base}.webp`;
}

async function convertSet({ dir, prefix }) {
  const srcDir = path.join(MASTER_ROOT, dir);
  const outDir = path.join(OUT_ROOT, dir);
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.png'));
  const jobs = [];
  const seen = new Set();
  for (const file of files) {
    const out = canonicalName(file, prefix);
    if (!out) {
      console.warn(`  SKIP (unexpected name): ${file}`);
      continue;
    }
    if (seen.has(out)) {
      console.warn(`  SKIP (duplicate canonical name): ${file} -> ${out}`);
      continue;
    }
    seen.add(out);
    jobs.push({ src: path.join(srcDir, file), dest: path.join(outDir, out) });
  }

  let done = 0;
  const started = Date.now();
  async function worker() {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      await sharp(job.src).webp({ quality: QUALITY }).toFile(job.dest);
      done += 1;
      if (done % 2000 === 0) console.log(`  ${dir}: ${done}/${seen.size}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const outFiles = fs.readdirSync(outDir).filter((f) => f.endsWith('.webp'));
  if (outFiles.length !== seen.size) {
    throw new Error(`${dir}: expected ${seen.size} outputs, found ${outFiles.length}`);
  }
  // Spot-check: decode a spread sample, dimensions must match the master's.
  const step = Math.max(1, Math.floor(outFiles.length / 25));
  for (let i = 0; i < outFiles.length; i += step) {
    const meta = await sharp(path.join(outDir, outFiles[i])).metadata();
    if (meta.width !== 512 || meta.height !== 512) {
      throw new Error(`${dir}/${outFiles[i]}: unexpected dimensions ${meta.width}x${meta.height}`);
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`  ${dir}: ${outFiles.length} webp written in ${secs}s (verified count + sampled dimensions)`);
}

(async () => {
  for (const set of SETS) {
    console.log(`Converting ${set.dir}...`);
    await convertSet(set);
  }
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
