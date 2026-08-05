/**
 * One-time (re-runnable) team map render: OpenFreeMap tiles → a WebP per team.
 *
 * WHY PRE-RENDER AT ALL. The Team Hub record banner shows a slow-drifting map of
 * where the program plays. Doing that live would mean bundling MapLibre (~800 KB
 * gzipped, against a 1.05 MB renderer), punching three holes in the CSP
 * (`script-src`, `connect-src`, `img-src`), breaking the app offline, and firing
 * a third-party request on every team-page view forever. Rendering once, here,
 * costs a few thousand tile requests from ONE machine and ships a flat image the
 * `cfbmedia://` handler already knows how to serve.
 *
 * The slow zoom does not need a live map either — it is a CSS transform on the
 * image, the same technique the Trophy Room backdrop uses on photographs.
 *
 * STADIUM, NOT CAMPUS. The banner is about the program's season, so the frame is
 * where they PLAY. Those differ by real distances — UCLA's campus is 17 miles
 * from the Rose Bowl (see shared/schoolLocations.ts vs lib/stadiumData.ts).
 * Teams with no stadium coordinate are skipped entirely and the app falls back
 * to the plain team gradient, which is a deliberate design choice, not a gap to
 * paper over.
 *
 * Usage:  node scripts/render-team-maps.js            (all teams)
 *         node scripts/render-team-maps.js UCLA Ohio  (just these)
 * Needs:  a network connection, and `npx electron` (WebGL via SwiftShader).
 * Writes: public/assets/teammaps/<canonicalKey>.webp
 *
 * ATTRIBUTION IS MANDATORY and lives in the About dialog — "OpenFreeMap ©
 * OpenMapTiles Data from OpenStreetMap" plus openstreetmap.org/copyright. The
 * OSM Foundation's guideline explicitly allows an acknowledgements section for
 * static images; do not remove it.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'teammaps');
const HELPER = path.join(__dirname, 'render-team-maps.electron.js');

/** Matches what the probe settled on, and what the banner CSS expects. */
const RENDER = {
  width: 1920,
  height: 480,
  style: 'dark',
  zoom: 11.25, // midpoint of the 10 -> 12.5 drift; CSS scales around it
};

function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // The team list comes from the shipped coordinate table, so this script and
  // the app can never disagree about which teams have a map.
  const src = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'lib', 'geoCoordinates.ts'), 'utf8');
  const block = src.slice(src.indexOf('STADIUM_COORDS'));
  const re = /^\s*([a-z0-9]+):\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\},\s*\/\/\s*(.+?)$/gm;
  const teams = [];
  let m;
  while ((m = re.exec(block))) {
    teams.push({ key: m[1], lat: +m[2], lon: +m[3], label: m[4].trim() });
  }
  const targets = only.length
    ? teams.filter((t) => only.some((o) => t.key.includes(o) || t.label.toLowerCase().includes(o)))
    : teams;

  console.log(`${teams.length} teams with a stadium coordinate; rendering ${targets.length}`);
  if (!targets.length) return;

  fs.writeFileSync(path.join(OUT_DIR, '_targets.json'), JSON.stringify({ ...RENDER, targets }));
  /*
    The electron BINARY directly, not `npx electron` through a shell. This repo
    lives at a path with a space in it ("CFB 27 Dynasty Hub"), and `shell: true`
    re-splits the arguments on that space — the helper path arrived as
    "D:\PROJECT\CFB". Requiring 'electron' from Node yields the executable path,
    so execFileSync passes it as one argv entry with no shell in between.

    ELECTRON_RUN_AS_NODE must be cleared too: with it set, electron.exe runs as
    plain Node, `app` is undefined, and the helper dies on app.whenReady().
  */
  const electronBinary = require('electron');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  execFileSync(electronBinary, [HELPER], { stdio: 'inherit', cwd: ROOT, env });
  fs.unlinkSync(path.join(OUT_DIR, '_targets.json'));

  const written = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webp'));
  console.log(`\ndone — ${written.length} .webp in public/assets/teammaps`);
}

main();
