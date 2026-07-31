/**
 * Measures the real artwork bounds inside every team mark and writes them to
 * `src/renderer/lib/markBounds.generated.ts`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every mark is a 1024x1024 canvas with the art floating somewhere inside it,
 * and how much of that canvas the art actually fills is NOT consistent:
 *
 *   • helmets  — 53.0%-57.5% tall (one 3D rig, measured across 40 teams). A
 *     single constant is fine for these.
 *   • 3D logos — 25% (LSU) to 80% (Texas State) tall. A 3.19x spread.
 *
 * That spread is why this script exists. Rendering every logo in the same box
 * makes LSU a third the height of Texas State's, so on a masthead where the
 * mark is meant to overhang the card, some teams would bulge past it and others
 * wouldn't reach it. Scaling each logo by its own measured fill ratio is the
 * only way to make them all present at the same visual size.
 *
 * RE-RUN IT when the art pack changes: `node scripts/measure-mark-bounds.js`.
 * Missing entries fall back to the median at runtime, so a stale map degrades
 * gracefully rather than breaking.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'public', 'assets');
const OUT = path.join(__dirname, '..', 'src', 'renderer', 'lib', 'markBounds.generated.ts');

/**
 * Measured at 256x256 rather than full resolution: the ratios are identical to
 * three decimal places and it turns a multi-minute pass over ~500 files into a
 * few seconds.
 */
const SAMPLE = 256;
const ALPHA_THRESHOLD = 10;

async function bounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize(SAMPLE, SAMPLE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // fully transparent
  return {
    // Fraction of the canvas the art occupies, and where its centre sits —
    // both needed to place a mark precisely rather than approximately.
    fillW: (maxX - minX + 1) / w,
    fillH: (maxY - minY + 1) / h,
    centerX: (minX + maxX + 1) / 2 / w,
    centerY: (minY + maxY + 1) / 2 / h,
  };
}

/** Strips the variant suffix so every variant of a team collapses to one key. */
function keyOf(fileName) {
  return fileName
    .replace(/\.(webp|png)$/i, '')
    .replace(/_(OD|OL|gold)$/i, '')
    .replace(/^thel_lthelmets_/i, '')
    .replace(/_result$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function measureDir(dir, label) {
  if (!fs.existsSync(dir)) {
    console.warn(`[skip] ${label}: ${dir} not found`);
    return {};
  }
  const files = fs.readdirSync(dir).filter((f) => /\.(webp|png)$/i.test(f));
  const out = {};
  for (const f of files) {
    try {
      const b = await bounds(path.join(dir, f));
      if (b) out[keyOf(f)] = b;
    } catch (err) {
      console.warn(`[warn] ${label}/${f}: ${err.message}`);
    }
  }
  console.log(`${label}: measured ${Object.keys(out).length} of ${files.length}`);
  return out;
}

const round = (n) => Number(n.toFixed(4));

function serialise(map) {
  const keys = Object.keys(map).sort();
  const rows = keys.map(
    (k) =>
      `  ${JSON.stringify(k)}: { fillW: ${round(map[k].fillW)}, fillH: ${round(map[k].fillH)}, centerX: ${round(
        map[k].centerX,
      )}, centerY: ${round(map[k].centerY)} },`,
  );
  return rows.join('\n');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

(async () => {
  /*
    ALL THREE logo folders, and the order matters. `png_OL` is the complete set
    (144 teams); `PNG_OD` holds only the ~69 "genuine two-variant" teams that
    have a distinct on-dark file, and `png_gold` the celebratory variant.
    Measuring PNG_OD alone — the first version of this script — left 75 of 144
    teams unmeasured and silently falling back to the median, which is exactly
    how Ball State ended up rendering half again too large.

    The variants are the same artwork in different colourways, so bounds are
    interchangeable: whichever folder sees a team first wins, and the others
    only fill gaps.
  */
  const logos = {
    ...(await measureDir(path.join(ASSETS, '3d_logos', 'png_gold'), 'logos (gold)')),
    ...(await measureDir(path.join(ASSETS, '3d_logos', 'PNG_OD'), 'logos (on-dark)')),
    ...(await measureDir(path.join(ASSETS, '3d_logos', 'png_OL'), 'logos (on-light)')),
  };
  const helmets = await measureDir(path.join(ASSETS, 'helmet', 'left'), 'helmets');

  const logoValues = Object.values(logos);
  const helmetValues = Object.values(helmets);
  const fallbackLogo = {
    fillW: median(logoValues.map((v) => v.fillW)),
    fillH: median(logoValues.map((v) => v.fillH)),
    centerX: median(logoValues.map((v) => v.centerX)),
    centerY: median(logoValues.map((v) => v.centerY)),
  };
  const fallbackHelmet = {
    fillW: median(helmetValues.map((v) => v.fillW)),
    fillH: median(helmetValues.map((v) => v.fillH)),
    centerX: median(helmetValues.map((v) => v.centerX)),
    centerY: median(helmetValues.map((v) => v.centerY)),
  };

  const banner = `/**
 * GENERATED by scripts/measure-mark-bounds.js — do not edit by hand.
 *
 * Where the real artwork sits inside each 1024x1024 mark canvas, as fractions:
 * \`fillW\`/\`fillH\` are how much of the canvas the art occupies, \`centerX\`/
 * \`centerY\` where its centre falls. The masthead uses these to render every
 * team's mark at the SAME visual size — without them the logos vary 3.19x in
 * height (LSU 25% of canvas, Texas State 80%) and a mark meant to overhang its
 * card would overhang wildly for some teams and not at all for others.
 *
 * Re-run after changing the art pack. Unknown keys fall back to the medians
 * below, so a stale map is imprecise rather than broken.
 */

export interface MarkBounds {
  fillW: number;
  fillH: number;
  centerX: number;
  centerY: number;
}
`;

  const body = `
export const LOGO_BOUNDS: Record<string, MarkBounds> = {
${serialise(logos)}
};

export const HELMET_BOUNDS: Record<string, MarkBounds> = {
${serialise(helmets)}
};

/** Medians, used for any team missing from the maps above. */
export const LOGO_BOUNDS_FALLBACK: MarkBounds = { fillW: ${round(fallbackLogo.fillW)}, fillH: ${round(
    fallbackLogo.fillH,
  )}, centerX: ${round(fallbackLogo.centerX)}, centerY: ${round(fallbackLogo.centerY)} };
export const HELMET_BOUNDS_FALLBACK: MarkBounds = { fillW: ${round(fallbackHelmet.fillW)}, fillH: ${round(
    fallbackHelmet.fillH,
  )}, centerX: ${round(fallbackHelmet.centerX)}, centerY: ${round(fallbackHelmet.centerY)} };
`;

  fs.writeFileSync(OUT, banner + body, 'utf-8');
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
