import { useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { InnerActivityMark } from './InnerActivityMark';
import type { UpdateCheckResult } from '../../../shared/types';

const PRIMARY_BTN =
  'shrink-0 border border-[var(--team-primary)] bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:opacity-90';
const SECONDARY_BTN =
  'shrink-0 border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800';

const CREDITS: { role: string; value: string }[] = [
  { role: 'Developer & Design', value: 'Mat Evanz' },
  { role: 'Built with', value: 'Google Antigravity' },
  { role: 'Save decoding', value: 'madden-franchise by bep713' },
  { role: 'Foundation', value: 'Electron · React · TypeScript · sql.js' },
];

/**
 * The "About" panel in the sidebar Tools group — app identity, version,
 * a one-line descriptor, credits, and the company name. Mirrors the other
 * Tools menus (a full-width trigger button that opens a CenteredModalPanel).
 * Version comes from __APP_VERSION__ (injected from package.json at build).
 */
export function AboutMenu({ triggerClassName, icon }: { triggerClassName?: string; icon?: React.ReactNode } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<UpdateCheckResult | null>(null);

  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await window.api.update.check());
    } finally {
      setChecking(false);
    }
  };

  const updateStatus = checking
    ? 'Checking for updates…'
    : check?.error
      ? "Couldn't reach GitHub — check your connection and try again."
      : check?.updateAvailable
        ? `Update available: v${check.latest}`
        : check
          ? "You're on the latest version."
          : 'See if a newer version is available.';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={icon ? 'About' : undefined}
        title={icon ? 'About' : undefined}
      >
        {icon ?? 'About'}
      </button>

      <CenteredModalPanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
        widthRem={28}
        eyebrow="About"
        title="DynastyOS"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="border border-[color:color-mix(in_srgb,var(--team-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--team-primary)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
              v{__APP_VERSION__}
            </span>
            {__BUILD_LABEL__ ? (
              <span className="border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {__BUILD_LABEL__}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-y border-slate-200/70 py-4 dark:border-white/5">
            <div className="min-w-0">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Updates</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{updateStatus}</p>
            </div>
            {check?.updateAvailable && check.url ? (
              <button type="button" onClick={() => window.api.update.openDownload(check.url as string)} className={PRIMARY_BTN}>
                Download
              </button>
            ) : (
              <button type="button" onClick={runCheck} disabled={checking} className={SECONDARY_BTN}>
                {checking ? 'Checking…' : 'Check for updates'}
              </button>
            )}
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            A companion app for EA Sports College Football 27 — it reads your dynasty save and turns it into a clean,
            browsable archive of your roster, stats, standings, recruiting, awards, and story, kept safe season after
            season.
          </p>

          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Credits</p>
            <dl className="mt-2">
              {CREDITS.map((c) => (
                <div
                  key={c.role}
                  className="flex justify-between gap-4 border-b border-slate-200/70 py-1.5 last:border-b-0 dark:border-white/5"
                >
                  <dt className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.role}</dt>
                  <dd className="text-right text-xs text-slate-500 dark:text-slate-400">{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500">
            Unofficial, fan-made companion — not affiliated with, endorsed by, or sponsored by Electronic Arts or EA
            Sports. All game names and trademarks belong to their respective owners.
          </p>

          {/* Signs off the panel rather than competing with the version badge,
              where it was too small to read. Full black/white as the brand art
              intends — the mark is fine strokes at this size, and dimming it on
              top of that pushed it past legible. Restraint comes from its size
              and placement, not from washing it out. */}
          <div className="flex justify-center pt-1">
            <InnerActivityMark className="h-6 w-auto text-black dark:text-white" />
          </div>
        </div>
      </CenteredModalPanel>
    </div>
  );
}
