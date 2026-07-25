import { app, ipcMain, net, shell } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { UpdateCheckResult } from '../../shared/types';

/**
 * "Check for update" — the app polls this repo's GitHub Releases and compares
 * the latest release tag to its own version. Publishing a Release IS the
 * notification: the app fetches the tag, and if it's higher than the running
 * version, the UI offers a download. No auto-install (the app is unsigned and
 * distributed manually) — the Download button just opens the installer link.
 */
const GITHUB_REPO = 'matevanz/DynastyHub';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;
const TIMEOUT_MS = 8000;

interface GitHubRelease {
  tag_name?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
  assets?: { name: string; browser_download_url: string }[];
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/i, '').split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
}

/** Strictly-newer numeric compare, so 0.6.10 correctly beats 0.6.9 (string compare wouldn't). */
function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function fetchLatestRelease(): Promise<GitHubRelease | null> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: RELEASES_API, method: 'GET' });
    // GitHub rejects requests without a User-Agent; the Accept header pins the API version.
    request.setHeader('User-Agent', 'CFB-Dynasty-Hub');
    request.setHeader('Accept', 'application/vnd.github+json');
    const timer = setTimeout(() => {
      request.abort();
      reject(new Error('timed out'));
    }, TIMEOUT_MS);

    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk.toString()));
      response.on('end', () => {
        clearTimeout(timer);
        const status = response.statusCode ?? 0;
        if (status === 404) {
          resolve(null); // repo has no published releases yet
          return;
        }
        if (status >= 400) {
          reject(new Error(`GitHub responded ${status}`));
          return;
        }
        try {
          resolve(JSON.parse(body) as GitHubRelease);
        } catch (err) {
          reject(err as Error);
        }
      });
      response.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    request.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    request.end();
  });
}

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC.update.check, async (): Promise<UpdateCheckResult> => {
    const current = app.getVersion();
    try {
      const release = await fetchLatestRelease();
      if (!release || !release.tag_name || release.draft) {
        return { current, latest: null, updateAvailable: false, url: null, notes: null, error: null };
      }
      const latest = release.tag_name.replace(/^v/i, '');
      // Prefer the NSIS "Setup" installer asset; fall back to any .exe, then the release page.
      const assets = release.assets ?? [];
      const setup = assets.find((a) => /setup .*\.exe$/i.test(a.name)) ?? assets.find((a) => /\.exe$/i.test(a.name));
      const url = setup?.browser_download_url ?? release.html_url ?? RELEASES_PAGE;
      return { current, latest, updateAvailable: isNewer(latest, current), url, notes: release.body ?? null, error: null };
    } catch (err) {
      return { current, latest: null, updateAvailable: false, url: null, notes: null, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.update.openDownload, async (_event, url: string): Promise<void> => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
    }
  });
}
