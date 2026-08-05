import { app, BrowserWindow, Menu, dialog, ipcMain, screen, protocol, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IPC } from '../shared/ipcChannels';
import { getAssetsRoot } from './assetRoot';
import { migrateLegacyUserData } from './userDataMigration';
import { registerFilesystemHandlers } from './ipc/filesystem';
import { registerAssetHandlers } from './ipc/assets';
import { registerDatabaseHandlers } from './ipc/database';
import { registerExportHandlers } from './ipc/export';
import { registerEditorHandlers } from './ipc/editor';
import { registerMediaHandlers } from './ipc/media';
import { registerCardHandlers } from './ipc/card';
import { registerProgramHandlers } from './ipc/program';
import { registerNotesHandlers } from './ipc/notes';
import { registerUpdateHandlers } from './updater/updateIpc';
import { scheduleStartupCheck } from './updater/updateService';
import {
  initDatabase,
  DatabaseCorruptedError,
  listBackups,
  quarantineCorruptDatabase,
  restoreFromBackup,
  backupDatabase,
  pruneOldBackups,
} from '../database/init';
import { extractAll } from '../extractors/extract-all';
import { persistExtraction } from '../database/importExtraction';
import { backfillMissingSeasonTeamIds } from '../database/helpers';
import { getSchedule } from '../database/getSchedule';

/**
 * Without this, double-clicking the launcher twice while the first instance
 * is still starting up (exactly the scenario the instant pre-splash — see
 * scripts/pre-splash.hta — exists to discourage) would actually spawn two
 * separate app processes fighting over the same SQLite file. Must run before
 * any other app.* calls; the second instance quits immediately and its
 * arguments are handed to the first instance instead.
 */
// Isolated-userData hook for diagnostics/tests against the PACKAGED build.
// The dev CLI honors --user-data-dir, but the packaged binary rejects it
// ("bad option"), and overriding %APPDATA% doesn't move Electron's appData
// (resolved via the OS API, not the env var) — confirmed 2026-07-20 when a
// packaged screenshot run silently landed on the real user database. Must be
// set before requestSingleInstanceLock(), which locks against userData.
if (process.env.CFB_USER_DATA_DIR) {
  app.setPath('userData', process.env.CFB_USER_DATA_DIR);
}

/**
 * Keep the window compositing even when Windows thinks it's hidden.
 *
 * Windows' native occlusion detection tells Chromium a covered window can stop
 * producing frames — sensible for power, ruinous for `capturePage`, which reads
 * whatever the compositor last submitted. Measured: with the window behind
 * another, three captures taken with a visible DOM change between each came
 * back BYTE-IDENTICAL, every one of them reporting success. The card export
 * rasterises the page, so a user who alt-tabs during a twenty-card export would
 * get twenty copies of card one and no indication anything went wrong.
 *
 * Must be set before app ready. Costs a little idle GPU when the window is
 * fully covered, which is the right trade for exports that are actually the
 * cards you asked for.
 */
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// The rename to DynastyOS changes the folder Electron derives from the app
// name, so a user's entire archive would otherwise be stranded under the old
// one while the app reported an empty workspace. Runs here, before the single
// instance lock — that lock is taken against userData itself, so anything after
// it is already too late. See userDataMigration.ts.
const userDataMigration = migrateLegacyUserData();
if (userDataMigration.migrated) {
  console.log(
    `[startup] moved existing data from ${userDataMigration.from} (${userDataMigration.method})`,
  );
} else if (userDataMigration.error) {
  console.error('[startup] could not move existing data:', userDataMigration.error);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });
}

const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;
/**
 * Height of the Windows Control Overlay strip. The renderer reserves exactly
 * this much space above the masthead (`--titlebar-height` in globals.css) so
 * the buttons float over the page background rather than landing on the card —
 * keep the two in step if either changes.
 */
const TITLE_BAR_HEIGHT = 36;
const USE_PRE_SPLASH_ONLY = process.env.USE_PRE_SPLASH_ONLY === '1';

/**
 * The heavy image assets are served over a custom `cfbmedia://` scheme from
 * the external image-data folder (see assetRoot.ts) rather than bundled inside
 * the app. Renderer image URLs look like `cfbmedia://media/3d_logos/...webp`;
 * the host segment ("media") is ignored and the path is resolved against the
 * resolved asset root. Must be declared as a privileged/standard/secure scheme
 * BEFORE app 'ready' so <img> can load it under the page CSP.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cfbmedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

/** Wires the cfbmedia:// handler to the resolved image-data folder. Call once, after app 'ready'. */
function registerMediaProtocol(): void {
  protocol.handle('cfbmedia', async (request) => {
    const root = getAssetsRoot();
    if (!root) return new Response('image data not installed', { status: 404 });
    let rel: string;
    try {
      rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    } catch {
      return new Response('bad request', { status: 400 });
    }
    const resolved = path.resolve(root, rel);
    // Path-traversal guard: never serve outside the asset root.
    if (resolved !== path.resolve(root) && !resolved.startsWith(path.resolve(root) + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    try {
      const data = await fs.promises.readFile(resolved);
      const type =
        MEDIA_CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream';
      return new Response(data, {
        headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000' },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowBounds {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowBounds>;
    return {
      width: parsed.width ?? DEFAULT_WIDTH,
      height: parsed.height ?? DEFAULT_HEIGHT,
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}

function rectsIntersect(a: Electron.Rectangle, b: Electron.Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Drops saved x/y if they'd place the window fully off every currently
 * connected display — e.g. a monitor used last session has since been
 * unplugged or had its resolution/arrangement changed. Without this check, a
 * stale window-state.json can open the app fully off-screen with no way to
 * recover short of manually deleting the file (must run after app 'ready' —
 * the screen module requires it).
 */
function sanitizeWindowState(state: WindowBounds): WindowBounds {
  const width = Math.max(state.width, MIN_WIDTH);
  const height = Math.max(state.height, MIN_HEIGHT);

  if (state.x === undefined || state.y === undefined) {
    return { width, height };
  }

  const rect = { x: state.x, y: state.y, width, height };
  const onScreen = screen.getAllDisplays().some((display) => rectsIntersect(rect, display.bounds));
  return onScreen ? { width, height, x: state.x, y: state.y } : { width, height };
}

function saveWindowState(window: BrowserWindow): void {
  try {
    const bounds = window.getBounds();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds), 'utf-8');
  } catch {
    // Non-fatal: window position simply won't be restored next launch.
  }
}

/**
 * The native application menu bar. Removed in the July 2026 "self-contained
 * hub" pass, then restored on request so there's a standard File/Edit/View/
 * Window bar for reload, DevTools, zoom, and clipboard actions. Built entirely
 * from predefined roles, so it needs no custom IPC and stays cross-platform.
 */
function buildAppMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  return Menu.buildFromTemplate(template);
}

/**
 * Overlay colours per appearance. `color` is the strip behind the buttons and
 * matches the page ground exactly (globals.css: pure black in dark, the light
 * theme's top gradient stop in light) so the strip is invisible; `symbolColor`
 * is the glyph, which has to invert with it or the close button vanishes.
 */
const TITLE_BAR_THEMES = {
  dark: { color: '#000000', symbolColor: '#d2d2d5' },
  light: { color: '#f3f4f6', symbolColor: '#4d4d52' },
} as const;

function createWindow(): BrowserWindow {
  const state = sanitizeWindowState(loadWindowState());

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    /*
      Frameless with the Windows Control Overlay — the Figma/VS Code treatment,
      not the Slack/Discord one. Windows still DRAWS the minimise/maximise/close
      buttons, just as a transparent overlay on our own page, which is why Snap
      Layouts (hover-maximise), correct hit targets, tooltips and accessibility
      all keep working for free. Drawing our own buttons would have meant owning
      every one of those forever.

      `color` is the strip behind the buttons: it's set to the page background
      of the CURRENT theme so the strip disappears into the page, and it's
      re-set from the renderer whenever light/dark flips (see
      IPC.window.setTitleBarTheme). Starting value is the dark ground, matching
      the app's default appearance.
    */
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLE_BAR_THEMES.dark, height: TITLE_BAR_HEIGHT },
    /*
      Without this the window has no opaque backing, and on Windows 11 a
      frameless window composites the SYSTEM BACKDROP wherever the page hasn't
      painted a pixel. Measured: the top 40px band read rgb(10,10,11) and the
      bottom edge rgb(13,13,13) — two different off-blacks, which is the tell
      that it was the desktop showing through rather than any CSS. No amount of
      making surfaces black in the renderer could reach it.
    */
    backgroundColor: '#000000',
    // The menu bar is only ever built in dev (packaged releases pass null), and
    // a hidden title bar has nowhere to draw it — Alt still reveals it.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      /*
        Explicit rather than inherited. Electron has sandboxed renderers by
        default since v20, so this changes nothing today — it states the
        requirement, so a future webPreferences edit has to argue with it
        instead of quietly turning it off. The preload survives it: it imports
        `electron` and one bundled constants module, and touches no Node
        built-in.
      */
      sandbox: true,
    },
  });

  /*
    THE APP IS ONE PAGE AND IT NEVER LEAVES IT.

    Two doors were standing open. `setWindowOpenHandler` denies every new
    window — nothing in this app opens one, so any attempt is either a stray
    `target="_blank"` or something that should not be happening; an http(s)
    target is handed to the user's real browser instead, which is where a link
    out of a desktop app belongs. `will-navigate` pins the frame to the page it
    booted with (its own file:// index, hash routes and all), so a dropped link
    or an injected navigation cannot replace the application with a remote
    document that would then be talking to the preload bridge.
  */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    // Same document (a hash route change is the router doing its job) is fine;
    // anything else is not.
    if (url.split('#')[0] !== current.split('#')[0]) event.preventDefault();
  });

  // Dev-only (unpackaged) developer shortcuts, wired straight onto the
  // webContents so they work even if the application menu / its accelerators
  // aren't present:
  //   F12 / Ctrl+Shift+I  — toggle DevTools
  //   Ctrl+Shift+R        — hard reload, bypassing the cache, so a rebuild can
  //                         be picked up without restarting the app
  // Packaged releases skip this entirely: it's a build-loop convenience, and in
  // a release a reload can't pick up new code anyway.
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const key = input.key.toLowerCase();
      if (key === 'f12' || (input.control && input.shift && key === 'i')) {
        win.webContents.toggleDevTools();
        event.preventDefault();
        return;
      }
      if (input.control && input.shift && key === 'r') {
        win.webContents.reloadIgnoringCache();
        event.preventDefault();
      }
    });
  }

  win.on('close', () => saveWindowState(win));

  /*
    Repaint the overlay when the renderer's appearance changes. Registered per
    window (and cleaned up with it) rather than globally, so it always targets
    the window that sent it and can't outlive it. Wrapped because
    setTitleBarOverlay only exists on Windows — on any other platform the whole
    thing is a no-op rather than a crash.
  */
  const applyTitleBarTheme = (
    _event: Electron.IpcMainInvokeEvent,
    appearance: 'light' | 'dark',
  ) => {
    if (win.isDestroyed() || typeof win.setTitleBarOverlay !== 'function') return;
    try {
      win.setTitleBarOverlay({
        ...(TITLE_BAR_THEMES[appearance] ?? TITLE_BAR_THEMES.dark),
        height: TITLE_BAR_HEIGHT,
      });
    } catch {
      // Platform doesn't support the overlay — the window simply keeps its
      // initial colours, which is cosmetic only.
    }
  };
  ipcMain.handle(IPC.window.setTitleBarTheme, applyTitleBarTheme);
  win.on('closed', () => ipcMain.removeHandler(IPC.window.setTitleBarTheme));

  if (process.env.SCREENSHOT_ROUTE) {
    if (process.env.SCREENSHOT_DEBUG_CONSOLE) {
      win.webContents.on('console-message', (_e, _level, message) => {
        console.log('[renderer-console]', message);
      });
    }
    win.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: process.env.SCREENSHOT_ROUTE,
    });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}

/** Shows the main window once its renderer has actually painted (avoids a blank-white flash) — used both on first launch (after the splash screen) and on macOS re-activation. */
function showWhenReady(win: BrowserWindow, onShown?: () => void): void {
  win.once('ready-to-show', () => {
    win.show();
    onShown?.();
    /*
      The quiet update check, started only once the window is actually up.
      Deliberately AFTER the paint and on a delay: launch is the slowest moment
      in the app's life (database open, migrations, first render), and a network
      round trip competing with that buys nothing. Packaged builds only, and it
      never downloads on its own — see updateService.
    */
    scheduleStartupCheck();
  });
}

/**
 * The splash window's CSS size, matched by scripts/pre-splash.hta so the handoff
 * between the two is pixel-identical.
 *
 * This is a LAYOUT size, not the artwork's pixel size — a claim this comment
 * used to make and got wrong. The previous spshscr.png was 1736×839, i.e. a 2×
 * asset for HiDPI displayed at 868×420; the current one is 868×420 native.
 * Either renders correctly; a 2× source is simply sharper on a high-DPI screen.
 */
const SPLASH_WIDTH = 868;
const SPLASH_HEIGHT = 420;
/** Real startup (sql.js init + IPC registration) can finish in well under a second on a warm cache — this floor keeps the splash from just flashing on screen instead of being visible/legible. */
const MIN_SPLASH_DISPLAY_MS = 1200;

/**
 * "Launch DynastyOS.bat" shows an instant, non-Electron pre-splash
 * (scripts/pre-splash.hta, launched before npm/webpack/electron even start —
 * that pre-Electron stretch is otherwise a silent gap with nothing on
 * screen) using the exact same splash image, and polls for this file to know
 * when it's safe to close. In normal Electron-splash mode it's written once
 * this app's own splash becomes visible; in pre-splash-only launcher mode
 * it's written once the real main window is ready. Not written at all when
 * launched directly (`npx electron .`, diagnostic runs) — harmless, since
 * nothing is polling for it in that case.
 */
const PRE_SPLASH_READY_FLAG = path.join(os.tmpdir(), 'dynastyos-splash-ready.flag');

function signalPreSplashReady(): void {
  try {
    fs.writeFileSync(PRE_SPLASH_READY_FLAG, String(Date.now()));
  } catch {
    // Non-fatal — the pre-splash has its own safety timeout if this never arrives.
  }
}

interface SplashProgressPayload {
  percent: number;
  status: string;
}

/**
 * Resolves only once the splash page has actually finished loading (not just
 * "ready to show") — its inline script attaches the splash:progress listener
 * as part of that load, so sending progress before this resolves risks the
 * first update being dropped silently.
 */
function createSplashWindow(): Promise<BrowserWindow> {
  return new Promise((resolve) => {
    const splash = new BrowserWindow({
      width: SPLASH_WIDTH,
      height: SPLASH_HEIGHT,
      frame: false,
      resizable: false,
      movable: false,
      center: true,
      show: false,
      backgroundColor: '#3a3a3a',
      webPreferences: {
        preload: path.join(__dirname, 'splash/splash-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    splash.once('ready-to-show', () => {
      splash.show();
      signalPreSplashReady();
    });
    splash.webContents.once('did-finish-load', () => resolve(splash));
    splash.loadFile(path.join(__dirname, 'splash/splash.html'));
  });
}

function sendSplashProgress(splash: BrowserWindow, payload: SplashProgressPayload): void {
  if (!splash.isDestroyed()) {
    splash.webContents.send('splash:progress', payload);
  }
}

/**
 * Wraps initDatabase() with a real recovery path for the one failure mode
 * that's actually recoverable — the on-disk file existing but being
 * unreadable (truncated write, garbage bytes, filesystem hiccup). Previously
 * this class of failure just fell through to the top-level .catch() below and
 * quit silently, with no explanation and no way back in short of manually
 * finding and deleting the file. Any OTHER startup error (missing wasm
 * binary, out of memory, etc.) still isn't "recoverable" by anything this
 * function knows how to do, so it's re-thrown unchanged for that same
 * top-level handler.
 */
async function initDatabaseWithRecovery(): Promise<void> {
  try {
    await initDatabase();
  } catch (err) {
    if (!(err instanceof DatabaseCorruptedError)) throw err;

    // The pre-splash would otherwise sit on screen for its full safety
    // timeout while the native dialog below waits for a response.
    signalPreSplashReady();

    const quarantinePath = quarantineCorruptDatabase(err.dbPath);
    const backups = listBackups();
    const mostRecent = backups[0];

    const buttons = mostRecent
      ? ['Restore Backup', 'Start Fresh', 'Quit']
      : ['Start Fresh', 'Quit'];
    const detail = mostRecent
      ? `Your dynasty database could not be read and may be corrupted. The unreadable file was moved to:\n${quarantinePath}\n\nA backup from ${mostRecent.label} is available to restore, or you can start fresh with an empty database.`
      : `Your dynasty database could not be read and may be corrupted. The unreadable file was moved to:\n${quarantinePath}\n\nNo backup was found. Starting fresh creates a new, empty database — any imported dynasties will need to be re-imported from their save files.`;

    // Diagnostic-only escape hatch: a real showMessageBoxSync call blocks on
    // human input, which a headless verification run can never provide.
    // Setting this env var lets a temporary diagnostic branch exercise the
    // full recovery path (quarantine → choice → restore/fresh → re-open →
    // checkpoint backup) without a real dialog ever appearing — see the
    // "Corrupted-database recovery flow" entry in DevLog.md for how this was
    // actually used to catch a real bug in this same function.
    const choice = process.env.DIAGNOSTIC_DB_RECOVERY_CHOICE
      ? process.env.DIAGNOSTIC_DB_RECOVERY_CHOICE
      : buttons[
          dialog.showMessageBoxSync({
            type: 'warning',
            title: 'Database Could Not Be Opened',
            message: 'Your dynasty database could not be read.',
            detail,
            buttons,
            defaultId: 0,
            cancelId: buttons.length - 1,
          })
        ];

    if (choice === 'Quit') {
      app.quit();
      throw new Error('Startup canceled: user chose to quit after database corruption.');
    }
    if (choice === 'Restore Backup' && mostRecent) {
      restoreFromBackup(mostRecent.path);
    }
    // 'Start Fresh': nothing else to do — the corrupt file is already
    // quarantined out of the way, so retrying initDatabase() naturally
    // creates a brand-new empty database in its place.
    await initDatabase();
  }

  // Reaching here means the database is open and readable — whether that's
  // the normal case, a fresh database, or one just restored from backup.
  // Checkpoint a new backup so there's always a recent recovery point, and cap
  // how many accumulate on disk. Deliberately NOT awaited: the checkpoint is a
  // recovery point for NEXT time, so nothing about this launch depends on it,
  // and compressing a large archive (~1.5s on a real 170 MB one) would
  // otherwise be dead time the user spends staring at a splash screen. Streamed
  // + unawaited, it runs while they're already using the app. It also no-ops
  // entirely when the database hasn't changed since the last one.
  void backupDatabase()
    .then(() => pruneOldBackups())
    .catch(() => {
      // Non-fatal — a missed backup checkpoint doesn't block the app from opening.
    });

  // One-time backfill for seasons imported before user_team_id existed (see
  // schema_v3_season_team.sql) — cheap no-op once every row already has a value.
  try {
    backfillMissingSeasonTeamIds();
  } catch (err) {
    console.error('[startup] season team backfill failed', err);
  }
}

app
  .whenReady()
  .then(async () => {
    // A second instance's whenReady() can still fire in the brief window before
    // app.quit() (called above) actually takes effect — bail out immediately
    // rather than race the first instance for the same SQLite file.
    if (!gotSingleInstanceLock) return;

    // Serve the external image-data folder over cfbmedia:// for every path below.
    registerMediaProtocol();

    // Diagnostic runs are a one-shot headless import + quit — the splash screen
    // would just flash and add noise to the log, so it's skipped entirely.
    if (process.env.DIAGNOSTIC_IMPORT_PATH) {
      await initDatabase();
      registerFilesystemHandlers();
      registerAssetHandlers();
      registerDatabaseHandlers();
      registerExportHandlers();
      registerEditorHandlers();
      registerMediaHandlers();
      registerCardHandlers();
      registerProgramHandlers();
      registerNotesHandlers();
      registerUpdateHandlers();
      try {
        const extraction = await extractAll(process.env.DIAGNOSTIC_IMPORT_PATH);
        const { dynasty } = persistExtraction(process.env.DIAGNOSTIC_IMPORT_PATH, extraction);
        const schedule = getSchedule(dynasty.id);
        console.log(
          '[diagnostic] sample games:',
          JSON.stringify(schedule?.games.slice(0, 3), null, 2),
        );
      } catch (err) {
        console.error('[diagnostic] FAILED', err);
      }
      app.quit();
      return;
    }

    if (USE_PRE_SPLASH_ONLY) {
      await initDatabaseWithRecovery();
      registerFilesystemHandlers();
      registerAssetHandlers();
      registerDatabaseHandlers();
      registerExportHandlers();
      registerEditorHandlers();
      registerMediaHandlers();
      registerCardHandlers();
      registerProgramHandlers();
      registerNotesHandlers();
      registerUpdateHandlers();
      // Diagnostic/screenshot runs keep no menu bar so its height doesn't shift
      // captures (the normal launch path restores the native menu — see below).
      Menu.setApplicationMenu(null);

      const win = createWindow();
      showWhenReady(win, () => {
        signalPreSplashReady();
        if (process.env.SCREENSHOT_DIR) {
          setTimeout(async () => {
            const dir = process.env.SCREENSHOT_DIR as string;
            // Window size defaults to a tall desktop capture; SCREENSHOT_SIZE="W,H"
            // overrides it so a run can verify responsive/narrow layouts too.
            const [sw, sh] = (process.env.SCREENSHOT_SIZE ?? '1400,2600').split(',').map(Number);
            win.setSize(sw || 1400, sh || 2600);
            await new Promise((r) => setTimeout(r, 500));
            // Imports a save file into the (isolated) database before any
            // select/click/capture — lets a verification run self-provision a
            // disposable dynasty instead of needing a pre-seeded user-data
            // dir. Runs through the same preload API the real UI uses. Only
            // meaningful with CFB_USER_DATA_DIR pointing at a scratch dir.
            if (process.env.SCREENSHOT_IMPORT_SAVE) {
              await win.webContents.executeJavaScript(
                `window.api.db.importDynasty(${JSON.stringify(process.env.SCREENSHOT_IMPORT_SAVE)});`,
              );
              await new Promise((r) => setTimeout(r, 1500));
              // Re-enter the route so pages mounted before the import re-fetch against the now-populated DB.
              await win.webContents.executeJavaScript('window.location.reload();');
              await new Promise((r) => setTimeout(r, 2500));
            }
            // "selector::value[;;selector::value...]" — sets <select> values
            // the way React sees them (native setter + change event), for UI
            // reachable only through dropdowns (e.g. the season switcher, the
            // Statistics split filters). Runs BEFORE the click hooks so a page
            // can be scoped to the right season/filter first, then clicked
            // (e.g. open a modal on the now-populated page).
            if (process.env.SCREENSHOT_SELECT_VALUE) {
              for (const pair of process.env.SCREENSHOT_SELECT_VALUE.split(';;')) {
                const sepIndex = pair.indexOf('::');
                const selector = pair.slice(0, sepIndex);
                const value = pair.slice(sepIndex + 2);
                await win.webContents.executeJavaScript(
                  `(() => {
                    const el = document.querySelector(${JSON.stringify(selector)});
                    if (!el) return 'not-found';
                    // Native <select>: set the value the way React sees it.
                    if (el instanceof HTMLSelectElement) {
                      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
                      setter.call(el, ${JSON.stringify(value)});
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                      return 'select';
                    }
                    // The app's own dropdown (ui/Select.tsx) has no value to set
                    // — its options only exist while the panel is open, and the
                    // panel is portalled to <body>. So drive it the way a user
                    // does: open it, then click the option. Returns 'pending'
                    // because the click happens on the next tick below.
                    el.click();
                    return 'listbox';
                  })();`,
                );
                // Second step for the custom dropdown — the panel has to mount
                // (and animate in) before its options can be found.
                await new Promise((r) => setTimeout(r, 350));
                await win.webContents.executeJavaScript(
                  `(() => {
                    const option = document.querySelector('[data-select-option=' + JSON.stringify(${JSON.stringify(value)}) + ']');
                    if (option) option.click();
                  })();`,
                );
                await new Promise((r) => setTimeout(r, 900));
              }
            }
            // Diagnostic escape hatch: evaluates the given JS in the page and
            // logs the JSON-stringified result to stdout — for verification
            // runs that need to inspect live DOM state (computed styles,
            // rects) rather than eyeball a screenshot. Local dev only, like
            // every other SCREENSHOT_* hook.
            if (process.env.SCREENSHOT_EVAL) {
              const evalResult = await win.webContents.executeJavaScript(
                process.env.SCREENSHOT_EVAL,
              );
              console.log('[screenshot-eval]', JSON.stringify(evalResult));
            }
            if (process.env.SCREENSHOT_CLICK_SELECTOR) {
              await win.webContents.executeJavaScript(
                `document.querySelector(${JSON.stringify(process.env.SCREENSHOT_CLICK_SELECTOR)})?.click();`,
              );
              await new Promise((r) => setTimeout(r, 500));
            }
            if (process.env.SCREENSHOT_CLICK_SELECTOR_2) {
              await win.webContents.executeJavaScript(
                `document.querySelector(${JSON.stringify(process.env.SCREENSHOT_CLICK_SELECTOR_2)})?.click();`,
              );
              await new Promise((r) => setTimeout(r, 500));
            }
            // Scrolls an element to the top of the viewport before capture —
            // for sections living below the fold on long pages.
            if (process.env.SCREENSHOT_SCROLL_SELECTOR) {
              await win.webContents.executeJavaScript(
                `document.querySelector(${JSON.stringify(process.env.SCREENSHOT_SCROLL_SELECTOR)})?.scrollIntoView({ block: 'start' });`,
              );
              await new Promise((r) => setTimeout(r, 400));
            }
            if (process.env.SCREENSHOT_FORCE_HOVER_SELECTOR) {
              // CDP screenshots can't simulate a real mouse hover — force any
              // group-hover/hover-reveal opacity rule visible for the matched
              // selector so hover-only UI (e.g. card action buttons) shows up.
              // The extra wait lets any CSS opacity transition actually finish
              // before the frame is captured, instead of grabbing mid-fade.
              await win.webContents.executeJavaScript(
                `document.querySelectorAll(${JSON.stringify(process.env.SCREENSHOT_FORCE_HOVER_SELECTOR)}).forEach((el) => { el.style.transition = 'none'; el.style.opacity = '1'; });`,
              );
              await new Promise((r) => setTimeout(r, 300));
            }
            const rectEnv = process.env.SCREENSHOT_RECT;
            const rect = rectEnv
              ? (([x, y, width, height]) => ({ x, y, width, height }))(
                  rectEnv.split(',').map(Number),
                )
              : undefined;
            const image = await win.webContents.capturePage(rect);
            fs.writeFileSync(
              path.join(dir, `${process.env.SCREENSHOT_NAME ?? 'shot'}.png`),
              image.toPNG(),
            );
            app.quit();
          }, 3500);
        }
      });
    } else {
      const splashStartedAt = Date.now();
      const splash = await createSplashWindow();

      sendSplashProgress(splash, { percent: 10, status: 'Loading database engine...' });
      await initDatabaseWithRecovery();

      sendSplashProgress(splash, { percent: 55, status: 'Preparing workspace...' });
      registerFilesystemHandlers();
      registerAssetHandlers();
      registerDatabaseHandlers();
      registerExportHandlers();
      registerEditorHandlers();
      registerMediaHandlers();
      registerCardHandlers();
      registerProgramHandlers();
      registerNotesHandlers();
      registerUpdateHandlers();
      // Native menu bar (File/Edit/View/Window) — reload, DevTools, zoom, and
      // clipboard actions — for IN-HOUSE DEVELOPMENT ONLY. Shipped/packaged
      // releases keep the self-contained-hub look with no native menu. Gated on
      // app.isPackaged: false when run unpackaged (the playtest .bats launch
      // `electron .`), true inside a built installer/portable exe. The
      // diagnostic/screenshot branch keeps it null regardless (clean captures).
      Menu.setApplicationMenu(app.isPackaged ? null : buildAppMenu());

      sendSplashProgress(splash, { percent: 85, status: 'Opening hub...' });
      const win = createWindow();
      showWhenReady(win, () => {
        sendSplashProgress(splash, { percent: 100, status: 'Ready.' });
        const elapsed = Date.now() - splashStartedAt;
        const remaining = Math.max(0, MIN_SPLASH_DISPLAY_MS - elapsed);
        setTimeout(() => {
          if (!splash.isDestroyed()) splash.close();
        }, remaining);
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        showWhenReady(createWindow());
      }
    });
  })
  .catch((err) => {
    console.error('[startup]', err);
    // A startup failure before createSplashWindow() ever ran means nothing
    // would otherwise tell the pre-splash to close — it would otherwise sit
    // on screen for its full safety timeout while the user just sees nothing
    // else happen.
    signalPreSplashReady();
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
