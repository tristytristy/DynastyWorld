import { app } from 'electron';
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
}

/** True only if `dir` looks like a real image-data root (has the sentinel folder). */
export function isAssetRoot(dir: string | null | undefined): dir is string {
  return !!dir && fs.existsSync(path.join(dir, SENTINEL));
}

function candidateRoots(): string[] {
  const roots: string[] = [];
  const cfg = readConfig();
  if (cfg.assetsPath) roots.push(cfg.assetsPath);
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

/** The resolved image-data root, or null if none is found. */
export function getAssetsRoot(): string | null {
  for (const r of candidateRoots()) {
    if (isAssetRoot(r)) return r;
  }
  return null;
}

export function getAssetStatus(): { found: boolean; path: string | null } {
  const root = getAssetsRoot();
  return { found: !!root, path: root };
}
