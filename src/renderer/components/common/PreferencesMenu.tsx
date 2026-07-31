import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { DEFAULT_GROUND_DARK, DEFAULT_GROUND_LIGHT } from '../../theme/themePreference';
import { useRecruitingExperience } from '../../data/RecruitingExperienceProvider';
import type { ColorMode } from '../../theme/themePreference';
import type {
  AssetStatus,
  MediaLibraryMoveResult,
  MediaLibraryStatus,
  StorageFolderUsage,
  StorageUsage,
} from '../../../shared/types';
import { CenteredModalPanel } from './CenteredModalPanel';
import { getCheckUpdatesOnStartup, setCheckUpdatesOnStartup } from '../../lib/updatePrefs';
import { formatBytes } from '../../lib/formatBytes';
import {
  HOVER_DELAY_MAX,
  HOVER_DELAY_MIN,
  getPlayerCardHoverDelayMs,
  getPlayerCardHoverEnabled,
  setPlayerCardHoverDelayMs,
  setPlayerCardHoverEnabled,
} from '../../lib/hoverCardPrefs';

function SegmentButton({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)] shadow-[0_16px_32px_-24px_rgba(0,0,0,0.95)]'
          : isDark
            ? 'text-slate-300 hover:bg-white/5 hover:text-white'
            : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
      }`}
    >
      {label}
    </button>
  );
}

function ThemeModeButton({
  label,
  value,
  description,
  active,
  isDark,
  onSelect,
}: {
  label: string;
  value: ColorMode;
  description: string;
  active: boolean;
  isDark: boolean;
  onSelect: (value: ColorMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        active
          ? isDark
            ? 'border-[var(--team-primary)] bg-slate-950/96 shadow-[0_22px_50px_-36px_rgba(0,0,0,0.50)]'
            : 'border-[var(--team-primary)] bg-white/88 shadow-[0_22px_50px_-36px_rgba(0,0,0,0.75)]'
          : isDark
            ? 'border-slate-800/85 bg-slate-950/82 hover:bg-slate-900/92'
            : 'border-slate-200/90 bg-white/72 hover:bg-white/88'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        {active && (
          <span className="bg-[var(--team-primary)] px-2.5 py-1 type-eyebrow text-[var(--team-on-primary)]">
            Active
          </span>
        )}
      </div>
      <p className={`mt-2 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-base ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A settings card whose body collapses. The collapse toggle is the title row;
 * an optional always-visible `accessory` (a switch, a segmented rail) stays in
 * the header so the live state is readable even when the explanatory body is
 * folded away.
 */
function CollapsibleSection({
  title,
  isDark,
  outerClass,
  accessory,
  defaultOpen = false,
  children,
}: {
  title: string;
  isDark: boolean;
  outerClass: string;
  accessory?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={outerClass}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={`flex flex-1 items-center gap-2 text-left ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          <ChevronIcon open={open} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </button>
        {accessory}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

export function PreferencesMenu({ triggerClassName, icon }: { triggerClassName?: string; icon?: React.ReactNode } = {}) {
  const { preference, appearance, setAppearance, setColorMode, setGround } = useTheme();
  const { ovr, athletic, experimentalSaveEditing, setExperimentalSaveEditing } = useRecruitingExperience();
  const revealAll = ovr.unlockedAll && athletic.unlockedAll;
  const setRevealAll = (value: boolean) => {
    if (value) {
      ovr.unlockForAll();
      athletic.unlockForAll();
    } else {
      ovr.lockAll();
      athletic.lockAll();
    }
  };
  const [isOpen, setIsOpen] = useState(false);
  const [checkOnStartup, setCheckOnStartupState] = useState(getCheckUpdatesOnStartup());
  const [cardHoverEnabled, setCardHoverEnabledState] = useState(getPlayerCardHoverEnabled());
  const [cardHoverDelay, setCardHoverDelayState] = useState(getPlayerCardHoverDelayMs());
  const isDark = appearance === 'dark';
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [assetStatus, setAssetStatus] = useState<AssetStatus | null>(null);
  useEffect(() => {
    window.api.assets
      .getStatus()
      .then(setAssetStatus)
      .catch(() => setAssetStatus(null));
  }, []);
  const changeAssetFolder = async () => {
    const res = await window.api.assets.chooseFolder();
    // Reload so every image path re-resolves against the new folder.
    if (res.picked && !res.invalid && res.found) {
      window.location.reload();
    } else {
      setAssetStatus(res);
    }
  };

  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const refreshStorage = () => {
    window.api.media
      .getStorageUsage()
      .then(setStorage)
      .catch(() => setStorage(null));
  };
  useEffect(refreshStorage, []);
  const cleanUpBackups = async () => {
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await window.api.media.cleanUpBackups();
      setCleanupMessage(
        res.removed === 0
          ? 'Nothing to clean up — no spare copies were sitting around.'
          : `Deleted ${res.removed} old ${res.removed === 1 ? 'copy' : 'copies'}, freeing ${formatBytes(res.freedBytes)}.`,
      );
      refreshStorage();
    } finally {
      setCleaning(false);
    }
  };

  const clearCache = async () => {
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const res = await window.api.media.clearDeletedDynastyCache();
      setCleanupMessage(
        res.freedBytes > 0
          ? `Cleared ${formatBytes(res.freedBytes)} left behind by deleted dynasties.`
          : 'Nothing left to clear.',
      );
      refreshStorage();
    } finally {
      setCleaning(false);
    }
  };

  const [mediaStatus, setMediaStatus] = useState<MediaLibraryStatus | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMessage, setMediaMessage] = useState<{ text: string; isError: boolean } | null>(null);
  useEffect(() => {
    window.api.media
      .getLibraryStatus()
      .then(setMediaStatus)
      .catch(() => setMediaStatus(null));
  }, []);
  // Moving copies every file before committing, so it can take a moment on a
  // big library — hence the busy state rather than an optimistic swap.
  const applyMediaMove = async (run: () => Promise<MediaLibraryMoveResult & { picked?: boolean }>) => {
    setMediaBusy(true);
    setMediaMessage(null);
    try {
      const res = await run();
      if (res.picked === false) return; // cancelled — say nothing
      setMediaStatus(res.status);
      setMediaMessage(
        res.error
          ? { text: res.error, isError: true }
          : {
              text:
                res.movedFiles > 0
                  ? `Moved ${res.movedFiles} file${res.movedFiles === 1 ? '' : 's'} to the new folder.`
                  : 'Folder updated.',
              isError: false,
            },
      );
    } finally {
      setMediaBusy(false);
    }
  };

  const sectionClass = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/84 p-4'
    : 'rounded-xl border border-slate-200/90 bg-white/72 p-4';
  const amberSectionClass = isDark
    ? 'rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4'
    : 'rounded-xl border border-amber-400/50 bg-amber-50/70 p-4';
  const railClass = isDark
    ? 'flex border border-slate-800/85 bg-slate-950/90 p-1'
    : 'flex border border-slate-200/90 bg-white/88 p-1';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={icon ? 'Preferences' : undefined}
        title={icon ? 'Preferences' : undefined}
      >
        {icon ?? 'Preferences'}
      </button>

      <CenteredModalPanel open={isOpen} onClose={() => setIsOpen(false)} widthRem={30} eyebrow="Experience Settings" title="Customize your workspace.">
        <p className={`text-sm leading-6 ${subtleTextClass}`}>
          Adjust appearance and how the recruiting experience behaves. Tap any section header to fold it away.
        </p>
        <div className="mt-4 space-y-6">
          <div className="space-y-4">
            <p className={`type-eyebrow ${subtleTextClass}`}>Interface</p>

            <CollapsibleSection
              title="Appearance"
              isDark={isDark}
              outerClass={sectionClass}
              accessory={
                <div className={railClass}>
                  <SegmentButton
                    label="Light"
                    active={appearance === 'light'}
                    isDark={isDark}
                    onClick={() => setAppearance('light')}
                  />
                  <SegmentButton
                    label="Dark"
                    active={appearance === 'dark'}
                    isDark={isDark}
                    onClick={() => setAppearance('dark')}
                  />
                </div>
              }
            >
              <p className={`text-xs leading-5 ${subtleTextClass}`}>Pick the base canvas for the app.</p>
            </CollapsibleSection>

            <CollapsibleSection title="Background" isDark={isDark} outerClass={sectionClass}>
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                The surface everything else sits on. Light and dark keep separate values — one colour can&apos;t sit
                behind both light and dark text — so this edits whichever appearance is active.
              </p>
              <div className="mt-3 flex items-center gap-3">
                {/* A native colour input: it's the one control every OS already
                    knows how to render well, and a hand-built picker here would
                    be a lot of surface for a setting most people touch once. */}
                <input
                  type="color"
                  aria-label={`${isDark ? 'Dark' : 'Light'} mode background colour`}
                  value={isDark ? preference.groundDark : preference.groundLight}
                  onChange={(event) => setGround(appearance, event.target.value)}
                  className="h-9 w-14 cursor-pointer border border-slate-300/80 bg-transparent p-0.5 dark:border-slate-700"
                />
                <code className={`tnum text-xs ${subtleTextClass}`}>
                  {isDark ? preference.groundDark : preference.groundLight}
                </code>
                <button
                  type="button"
                  onClick={() => setGround(appearance, isDark ? DEFAULT_GROUND_DARK : DEFAULT_GROUND_LIGHT)}
                  className={`ml-auto border px-3 py-1.5 text-xs font-medium transition ${
                    isDark
                      ? 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                      : 'border-slate-300/80 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                  }`}
                >
                  Reset
                </button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Theme Source" isDark={isDark} outerClass={sectionClass}>
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                Choose whether accent colors follow the active dynasty or the default app palette.
              </p>
              <div className="mt-3 space-y-3">
                <ThemeModeButton
                  label="Team Mode"
                  value="team"
                  description="Use the active dynasty's team colors in dynasty views while the shell keeps its shared structure."
                  active={preference.colorMode === 'team'}
                  isDark={isDark}
                  onSelect={setColorMode}
                />
                <ThemeModeButton
                  label="Default Mode"
                  value="default"
                  description="Keep the app on the built-in brand palette for a steady, neutral presentation."
                  active={preference.colorMode === 'default'}
                  isDark={isDark}
                  onSelect={setColorMode}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Player card preview"
              isDark={isDark}
              outerClass={sectionClass}
              accessory={
                <input
                  id="pref-card-hover"
                  type="checkbox"
                  checked={cardHoverEnabled}
                  onChange={(e) => {
                    setCardHoverEnabledState(e.target.checked);
                    setPlayerCardHoverEnabled(e.target.checked);
                  }}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--team-primary)]"
                  aria-label="Show the player card on hover"
                />
              }
            >
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                Rest on a player&apos;s name and their trading card pops up. Turn it off to browse without previews.
              </p>
              <div className={`mt-3 ${cardHoverEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                <div className="flex items-center justify-between">
                  <label htmlFor="pref-card-hover-delay" className={`text-xs font-medium ${subtleTextClass}`}>
                    Time before it appears
                  </label>
                  <span className={`proportional-nums text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {(cardHoverDelay / 1000).toFixed(2)}s
                  </span>
                </div>
                <input
                  id="pref-card-hover-delay"
                  type="range"
                  min={HOVER_DELAY_MIN}
                  max={HOVER_DELAY_MAX}
                  step={50}
                  value={cardHoverDelay}
                  disabled={!cardHoverEnabled}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCardHoverDelayState(next);
                    setPlayerCardHoverDelayMs(next);
                  }}
                  className="mt-2 w-full cursor-pointer accent-[var(--team-primary)]"
                  aria-label="Time before the player card appears"
                />
                <div className={`mt-1 flex justify-between text-[10px] ${subtleTextClass}`}>
                  <span>Faster</span>
                  <span>Slower</span>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          <div className="space-y-4">
            <p className={`type-eyebrow ${subtleTextClass}`}>Recruiting</p>

            <CollapsibleSection
              title="Reveal all recruit ratings"
              isDark={isDark}
              outerClass={sectionClass}
              accessory={
                <input
                  id="pref-reveal-all"
                  type="checkbox"
                  checked={revealAll}
                  onChange={(e) => setRevealAll(e.target.checked)}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--team-primary)]"
                  aria-label="Reveal all recruit ratings"
                />
              }
            >
              <label htmlFor="pref-reveal-all" className={`block cursor-pointer text-xs leading-5 ${subtleTextClass}`}>
                A prospect&apos;s overall and athletic ratings start hidden across the Recruits pages — recruit the way
                the game intends, on rank, stars, and film. Turn this on to reveal every recruit&apos;s ratings at once,
                or leave it off and reveal prospects one at a time from their profile.
              </label>
            </CollapsibleSection>

            <CollapsibleSection
              title="Experimental save editing"
              isDark={isDark}
              outerClass={amberSectionClass}
              accessory={
                <input
                  id="pref-experimental-editing"
                  type="checkbox"
                  checked={experimentalSaveEditing}
                  onChange={(e) => setExperimentalSaveEditing(e.target.checked)}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-amber-500"
                  aria-label="Enable experimental save editing"
                />
              }
            >
              <label
                htmlFor="pref-experimental-editing"
                className={`block cursor-pointer text-xs leading-5 ${subtleTextClass}`}
              >
                Unlocks tools that write directly to your dynasty save — currently <strong>Force Commit</strong>. Every
                write backs up your save first and is verified before it&apos;s kept, but this is experimental. Off by
                default; turning it off hides these tools without affecting the rest of the Recruit Hub.
              </label>
            </CollapsibleSection>
          </div>

          <div className="space-y-4">
            <p className={`type-eyebrow ${subtleTextClass}`}>Storage</p>

            <CollapsibleSection title="What the app is using on your disk" isDark={isDark} outerClass={sectionClass}>
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                Everything the app writes, and where. Nothing here is hidden from you.
              </p>
              {storage ? (
                <>
                  <div className="mt-3 space-y-1.5">
                    {(
                      [
                        ['Your dynasty archive', storage.database, 'Every dynasty, season, note and tag.'],
                        ['Media photos & videos', storage.media, 'What you add in the Media Hub.'],
                        ['Trading-card photos', storage.cardPhotos, 'Photos you dropped onto player cards.'],
                        [
                          'Automatic recovery copies',
                          storage.databaseBackups,
                          'Safety copies of the archive, in case it ever gets damaged.',
                        ],
                        [
                          'Game-save copies',
                          storage.saveBackups,
                          'Copies of your EA save taken before edits, and by the Backup button.',
                        ],
                        [
                          'Cache from deleted dynasties',
                          { path: '', fileCount: 0, totalBytes: storage.deletedDynastyCacheBytes },
                          'Space still held inside the archive by dynasties you removed.',
                        ],
                      ] as [string, StorageFolderUsage, string][]
                    ).map(([label, usage, blurb]) => (
                      <div
                        key={label}
                        className={`flex items-baseline justify-between gap-4 border-b py-1.5 ${
                          isDark ? 'border-slate-800/70' : 'border-slate-200/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                          <p className={`text-[11px] leading-4 ${subtleTextClass}`}>{blurb}</p>
                        </div>
                        <span className={`tnum shrink-0 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {formatBytes(usage.totalBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={`mt-2 flex items-baseline justify-between gap-4 text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <span>Total</span>
                    <span className="tnum">
                      {formatBytes(
                        storage.database.totalBytes +
                          storage.media.totalBytes +
                          storage.cardPhotos.totalBytes +
                          storage.databaseBackups.totalBytes +
                          storage.saveBackups.totalBytes,
                      )}
                    </span>
                  </p>
                  {cleanupMessage && <p className={`mt-2 text-xs ${subtleTextClass}`}>{cleanupMessage}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={cleaning}
                      onClick={cleanUpBackups}
                      className={`border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                        isDark
                          ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                          : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cleaning ? 'Cleaning up…' : 'Delete old copies'}
                    </button>
                    {storage.deletedDynastyCacheBytes > 0 && (
                      <button
                        type="button"
                        disabled={cleaning}
                        onClick={clearCache}
                        className={`border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                          isDark
                            ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                            : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cleaning ? 'Clearing…' : 'Clear cache'}
                      </button>
                    )}
                  </div>
                  <p className={`mt-2 text-xs leading-5 ${subtleTextClass}`}>
                    Keeps the most recent recovery copy of your archive and of each game save, and deletes the older
                    spares. Your dynasties, photos and cards are never touched.
                  </p>
                </>
              ) : (
                <p className={`mt-3 text-xs ${subtleTextClass}`}>Measuring…</p>
              )}
            </CollapsibleSection>
            <CollapsibleSection title="Image data folder" isDark={isDark} outerClass={sectionClass}>
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                Player faces, team logos, and trophies load from a separate image-data folder installed once by the
                Asset Installer. The app finds it automatically — point it somewhere new here if you move it.
              </p>
              <p className={`mt-2 break-all text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {assetStatus?.found ? (
                  <>
                    Current: <span className="font-mono">{assetStatus.path}</span>
                  </>
                ) : (
                  <span className="text-amber-500">Not found — the app is using bundled art, or none is installed.</span>
                )}
              </p>
              <button
                type="button"
                onClick={changeAssetFolder}
                className={`mt-3 border px-4 py-2 text-xs font-semibold transition ${
                  isDark
                    ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Change folder…
              </button>
            </CollapsibleSection>

            <CollapsibleSection title="Media library folder" isDark={isDark} outerClass={sectionClass}>
              <p className={`text-xs leading-5 ${subtleTextClass}`}>
                Photos and videos you add in the Media Hub are <strong>copied</strong> into this folder — deleting the
                original afterwards is safe. Put it somewhere you can actually reach (Pictures, a synced Dropbox or
                OneDrive folder, an external drive) instead of the default buried in AppData.
              </p>
              <p className={`mt-2 break-all text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Current: <span className="font-mono">{mediaStatus?.path ?? '…'}</span>
                {mediaStatus?.isDefault && <span className={subtleTextClass}> (default)</span>}
              </p>
              {mediaStatus && !mediaStatus.exists && (
                <p className="mt-2 text-xs text-amber-500">
                  This folder isn&apos;t there right now — if it&apos;s on a drive that isn&apos;t plugged in, your
                  photos will look missing until it&apos;s back.
                </p>
              )}
              {mediaMessage && (
                <p className={`mt-2 text-xs ${mediaMessage.isError ? 'text-amber-500' : subtleTextClass}`}>
                  {mediaMessage.text}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={() => applyMediaMove(() => window.api.media.chooseLibraryFolder())}
                  className={`border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                    isDark
                      ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {mediaBusy ? 'Moving…' : 'Change folder…'}
                </button>
                <button
                  type="button"
                  onClick={() => window.api.media.openLibraryFolder()}
                  className={`border px-4 py-2 text-xs font-semibold transition ${
                    isDark
                      ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Open folder
                </button>
                {mediaStatus && !mediaStatus.isDefault && (
                  <button
                    type="button"
                    disabled={mediaBusy}
                    onClick={() => applyMediaMove(() => window.api.media.resetLibraryFolder())}
                    className={`border px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      isDark
                        ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                        : 'border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <p className={`mt-2 text-xs leading-5 ${subtleTextClass}`}>
                Changing the folder moves your existing library across — nothing is left behind, and if the copy fails
                part-way nothing is moved at all.
              </p>
            </CollapsibleSection>
          </div>

          <div className="space-y-4">
            <p className={`type-eyebrow ${subtleTextClass}`}>Updates</p>
            <CollapsibleSection
              title="Check for updates on startup"
              isDark={isDark}
              outerClass={sectionClass}
              accessory={
                <input
                  id="pref-check-updates"
                  type="checkbox"
                  checked={checkOnStartup}
                  onChange={(e) => {
                    setCheckOnStartupState(e.target.checked);
                    setCheckUpdatesOnStartup(e.target.checked);
                  }}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--team-primary)]"
                  aria-label="Check for updates on startup"
                />
              }
            >
              <label htmlFor="pref-check-updates" className={`block cursor-pointer text-xs leading-5 ${subtleTextClass}`}>
                When on, the app quietly checks for a newer version each time it launches and shows a one-time notice if
                one is available (it never interrupts if you&apos;re offline). Turn it off to launch without checking —
                you can always check manually from the About panel.
              </label>
            </CollapsibleSection>
          </div>
        </div>
      </CenteredModalPanel>
    </div>
  );
}
