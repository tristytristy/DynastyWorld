import { app } from 'electron';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Resolves where the heavy image assets (player/coach portraits, team logos,
 * trophies) actually live on disk. As of the two-installer split these are NO
 * LONGER bundled inside the app — they ship as a separate, user-placed "image
 * data" folder so the ~1 GB library is installed once and survives app updates
 * (see the cfbmedia:// protocol in main.ts).
 *
 * Lookup order, first hit wins:
 *   1. A path the user explicitly set inside the app (asset-config.json).
 *   2. Convention folders next to the app executable ("assets" / "CFB Dynasty
 *      Hub Assets"), so a co-located install just works with no prompt.
 *   3. The bundled copy (dist/renderer/assets) — present in dev and in any
 *      build that still ships assets inside it (e.g. the portable exe).
 *
 * A folder only counts as a real asset root if it contains the SENTINEL
 * sub-folder, so a stray empty directory never masks the real one.
 */
const SENTINEL = 'playerportrait';

function configPath(): string {
  return path.join(app.getPath('userData'), 'asset-config.json');
}

function readConfig(): { assetsPath?: string } {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')) as { assetsPath?: string };
  } catch {
    return {};
  }
}

// Resolving the root touches the filesystem (and the registry) and the
// cfbmedia:// handler calls it on EVERY image request, so cache the result.
// `undefined` = not yet resolved; setAssetsPath() invalidates it.
let cachedRoot: string | null | undefined;

/** Persist (or clear, with null) the user's chosen image-data folder. */
export function setAssetsPath(p: string | null): void {
  const cfg = readConfig();
  if (p) cfg.assetsPath = p;
  else delete cfg.assetsPath;
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.error('[assets] failed to save asset-config.json:', err);
  }
  cachedRoot = undefined;
}

/**
 * The path the Asset Installer records under HKCU\Software\CFB Dynasty Hub so
 * the app auto-detects a user-chosen folder with no browsing. Read once per
 * session (behind the cache) — never per image request.
 */
function readRegistryAssetsPath(): string | null {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\CFB Dynasty Hub', '/v', 'AssetsPath'], {
      encoding: 'utf8',
      windowsHide: true,
      // Ignore stderr so a missing key doesn't spam the log with reg.exe's
      // "unable to find the specified registry key" message (we handle absence).
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const m = out.match(/AssetsPath\s+REG_SZ\s+(.+)/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/** True only if `dir` looks like a real image-data root (has the sentinel folder). */
export function isAssetRoot(dir: string | null | undefined): dir is string {
  return !!dir && fs.existsSync(path.join(dir, SENTINEL));
}

function candidateRoots(): string[] {
  const roots: string[] = [];
  const cfg = readConfig();
  if (cfg.assetsPath) roots.push(cfg.assetsPath);
  const reg = readRegistryAssetsPath();
  if (reg) roots.push(reg);
  try {
    const exeDir = path.dirname(app.getPath('exe'));
    roots.push(path.join(exeDir, 'assets'));
    roots.push(path.join(exeDir, 'CFB Dynasty Hub Assets'));
    roots.push(path.join(exeDir, '..', 'CFB Dynasty Hub Assets'));
  } catch {
    // app.getPath('exe') can throw very early; convention roots are optional.
  }
  // Bundled fallback: main.js lives at dist/main, assets at dist/renderer/assets.
  roots.push(path.join(__dirname, '..', 'renderer', 'assets'));
  return roots;
}

/** The resolved image-data root, or null if none is found (cached per session). */
export function getAssetsRoot(): string | null {
  if (cachedRoot === undefined) {
    cachedRoot = candidateRoots().find((r) => isAssetRoot(r)) ?? null;
  }
  return cachedRoot;
}

export function getAssetStatus(): { found: boolean; path: string | null } {
  const root = getAssetsRoot();
  return { found: !!root, path: root };
}
