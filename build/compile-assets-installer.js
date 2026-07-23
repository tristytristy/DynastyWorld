/**
 * Compiles the standalone Image Data (asset) installer from
 * build/assets-installer.nsi, using the NSIS compiler electron-builder already
 * caches (so there's nothing extra to install — run `npm run package` once
 * first if the cache is empty). Output: release/CFB Dynasty Hub Image Data <ver>.exe
 *
 *   npm run package:assets
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findMakensis() {
  const cacheBase = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'nsis');
  if (!fs.existsSync(cacheBase)) return null;
  for (const dir of fs.readdirSync(cacheBase)) {
    const candidate = path.join(cacheBase, dir, 'Bin', 'makensis.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const makensis = findMakensis();
if (!makensis) {
  console.error(
    'makensis not found. Run `npm run package` once so electron-builder downloads NSIS, then retry.',
  );
  process.exit(1);
}

const script = path.join(__dirname, 'assets-installer.nsi');
console.log(`Compiling asset installer with ${makensis}`);
execFileSync(makensis, [script], { stdio: 'inherit' });
