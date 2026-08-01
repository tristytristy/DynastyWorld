/**
 * Verifies that every file the build READS actually exists.
 *
 *   npm run check:refs
 *
 * `tsc` already proves the import graph, and a broken import fails the build
 * loudly. Nothing checks the rest: the asset folders webpack copies, the
 * `File /r` sections in the NSIS installers, the scripts npm invokes, the fonts
 * and artwork the manual generator inlines. Those fail quietly — a renamed
 * folder yields an installer missing a section, or a manual with no logo, and
 * the first report comes from a user.
 *
 * INPUTS ONLY, and extracted per file type rather than by scraping every quoted
 * string. The dumb version flagged fourteen things, all of them MIME types,
 * webpack `to:` destinations and NSIS `OutFile` — a checker that cries wolf
 * stops being run, which is worse than not having one.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Paths that are legitimately absent from a clean checkout. Each needs a reason. */
const EXPECTED_ABSENT = [
  { match: /^public\/assets/, why: 'image library is gitignored; present only where installed' },
  { match: /^References\//, why: 'gitignored reference material' },
];

const results = { checked: 0, missing: [], skipped: [] };

function check(from, ref, base = ROOT) {
  const rel = ref.replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.includes('${') || rel.includes('*')) return; // variable or glob, not a literal
  results.checked++;
  const excused = EXPECTED_ABSENT.find((r) => r.match.test(rel));
  if (excused) {
    results.skipped.push({ ref: rel, why: excused.why });
    return;
  }
  if (!fs.existsSync(path.resolve(base, rel))) {
    results.missing.push({ from, ref, resolved: path.relative(ROOT, path.resolve(base, rel)) });
  }
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// --- webpack: only `from:` (what it copies IN), never `to:` ------------------
{
  const text = read('webpack.config.js');
  for (const m of text.matchAll(/\bfrom:\s*'([^']+)'/g)) check('webpack.config.js', m[1]);
  for (const m of text.matchAll(/\bentry:\s*'([^']+)'/g)) check('webpack.config.js', m[1]);
  for (const m of text.matchAll(/\btemplate:\s*'([^']+)'/g)) check('webpack.config.js', m[1]);
}

// --- electron-builder: the icon it stamps onto the exe -----------------------
{
  const text = read('electron-builder.js');
  for (const m of text.matchAll(/\bicon:\s*'([^']+)'/g)) check('electron-builder.js', m[1]);
}

// --- npm scripts: every .js they hand to node/electron ----------------------
{
  const pkg = JSON.parse(read('package.json'));
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    for (const m of cmd.matchAll(/(?:^|\s)((?:build|scripts|docs)\/[A-Za-z0-9_./-]+\.js)/g)) {
      check(`package.json → scripts.${name}`, m[1]);
    }
  }
}

// --- NSIS: `File` sections are the payload; OutFile is the product ----------
for (const nsi of ['build/assets-installer.nsi', 'build/polos-installer.nsi']) {
  const text = read(nsi);
  const base = path.join(ROOT, 'build');
  const src = text.match(/!define\s+SRC\s+"([^"]+)"/);
  for (const m of text.matchAll(/^\s*File\s+(?:\/r\s+)?"([^"]+)"/gm)) {
    const raw = src ? m[1].replace('${SRC}', src[1]) : m[1];
    check(nsi, raw, base);
  }
}

// --- the manual generator's inlined artwork ---------------------------------
{
  const text = read('docs/manual/make-manual-pdf.js');
  /*
    Its path constants have different bases, so a single "resolve against ROOT"
    rule reports six phantom breaks. Mapped explicitly instead — and the OUTPUT
    constants are deliberately absent, because the PDF and the transient render
    file are products, not inputs.
  */
  const BASES = {
    ROOT: ROOT,
    HERE: path.join(ROOT, 'docs/manual'),
    FONTS: path.join(ROOT, 'public/assets/fonts'),
  };
  /** Written by the generator, not read by it — the PDF and the transient render file. */
  const PRODUCTS = [/\.pdf$/i, /manual\.rendered\.html$/];
  for (const m of text.matchAll(/path\.join\((ROOT|HERE|FONTS),\s*'([^']+)'\)/g)) {
    if (PRODUCTS.some((p) => p.test(m[2]))) continue;
    check('docs/manual/make-manual-pdf.js', m[2], BASES[m[1]]);
  }
  // The two standalone consts that point straight at artwork.
  for (const name of ['LOGO', 'SPLASH']) {
    const m = text.match(new RegExp(`const ${name} = path\.join\(ROOT, '([^']+)'\)`));
    if (m) check('docs/manual/make-manual-pdf.js', m[1]);
  }
}

// --- generators that read a committed source document -----------------------
{
  const text = read('scripts/generate-ovr-formulas.js');
  for (const m of text.matchAll(/path\.join\(ROOT,\s*'([^']+)',\s*'([^']+)'\)/g)) {
    check('scripts/generate-ovr-formulas.js', `${m[1]}/${m[2]}`);
  }
}

console.log(`Checked ${results.checked} build-input references.`);
if (results.skipped.length) {
  console.log(`\nSkipped (expected absent on a clean checkout):`);
  for (const s of results.skipped) console.log(`  ${s.ref} — ${s.why}`);
}
if (results.missing.length === 0) {
  console.log('\nEvery referenced input resolves. ✔');
  process.exit(0);
}
console.log(`\n${results.missing.length} BROKEN reference(s):\n`);
for (const m of results.missing) {
  console.log(`  ${m.from}`);
  console.log(`    references : ${m.ref}`);
  console.log(`    resolves to: ${m.resolved}  (missing)`);
}
process.exit(1);
