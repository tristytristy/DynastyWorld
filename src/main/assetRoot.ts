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
 * The path the Asset Installer records so the app auto-detects a user-chosen
 * folder with no browsing. Read once per session (behind the cache) — never per
 * image request.
 *
 * BOTH the DynastyOS key and the old CFB Dynasty Hub one are checked: anyone
 * who ran the Asset Installer before the rename has their ~1 GB library
 * registered under the old name, and dropping that lookup would leave them with
 * an app that suddenly can't find any artwork.
 */
const ASSET_REGISTRY_KEYS = ['HKCU\\Software\\DynastyOS', 'HKCU\\Software\\CFB Dynasty Hub'];

function readRegistryAssetsPath(): string | null {
  if (process.platform !== 'win32') return null;
  for (const key of ASSET_REGISTRY_KEYS) {
    try {
      const out = execFileSync('reg', ['query', key, '/v', 'AssetsPath'], {
        encoding: 'utf8',
        windowsHide: true,
        // Ignore stderr so a missing key doesn't spam the log with reg.exe's
        // "unable to find the specified registry key" message (we handle absence).
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const m = out.match(/AssetsPath\s+REG_SZ\s+(.+)/);
      if (m) return m[1].trim();
    } catch {
      // Key absent — try the next one.
    }
  }
  return null;
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
    // Both names: a library installed beside the app before the rename still
    // sits in a "CFB Dynasty Hub Assets" folder.
    roots.push(path.join(exeDir, 'DynastyOS Assets'));
    roots.push(path.join(exeDir, '..', 'DynastyOS Assets'));
    roots.push(path.join(exeDir, 'CFB Dynasty Hub Assets'));
    roots.push(path.join(exeDir, '..', 'CFB Dynasty Hub Assets'));
  } catch {
    // app.getPath('exe') can throw very early; convention roots are optional.
  }
  try {
    // A library checked out INSIDE the project: the DynastyWorld fork carries
    // one at the repo root, and in dev app.getAppPath() IS the project root —
    // so a plain `git clone` + launch finds its art with no prompt. In a
    // packaged build this resolves inside resources/app, where the folder
    // doesn't exist, so the extra candidates cost nothing.
    roots.push(path.join(app.getAppPath(), 'DynastyOS Assets'));
    roots.push(path.join(app.getAppPath(), 'assets'));
  } catch {
    // Same early-startup caveat as above.
  }
  // Bundled fallback: main.js lives at dist/main, assets at dist/renderer/assets.
  roots.push(path.join(__dirname, '..', 'renderer', 'assets'));
  return roots;
}

/** The resolved image-data root, or null if none is found (cached per session). */
export function getAssetsRoot(): string | null {
  /*
    THE ONLY WAY TO SEE THE FIRST-RUN SCREEN ON A MACHINE THAT HAS THE LIBRARY.
    AssetGate is what a brand-new user meets before anything else, and it is
    unreachable for anyone who can build the app: the lookup below falls through
    to the installer's registry key, then to the bundled dev copy, so it always
    finds something. That is why it has historically shipped unverified.

    Env-gated and diagnostic-only, the same shape as the SCREENSHOT_* hooks in
    main.ts. Nothing sets it in a real launch, and being an env var rather than a
    setting means it cannot be reached from inside the running app at all.
  */
  if (process.env.FORCE_NO_ASSETS === '1') return null;
  if (cachedRoot === undefined) {
    cachedRoot = candidateRoots().find((r) => isAssetRoot(r)) ?? null;
  }
  return cachedRoot;
}

export function getAssetStatus(): { found: boolean; path: string | null } {
  const root = getAssetsRoot();
  return { found: !!root, path: root };
}
