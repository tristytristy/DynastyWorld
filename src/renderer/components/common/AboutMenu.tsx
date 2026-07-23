import { useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';

const CREDITS: { role: string; value: string }[] = [
  { role: 'Developer & Design', value: 'Mat Evanz' },
  { role: 'Built with', value: 'Claude (Anthropic)' },
  { role: 'Save decoding', value: 'madden-franchise by bep713' },
  { role: 'Foundation', value: 'Electron · React · TypeScript · sql.js' },
  { role: 'Typeface', value: 'Inter (SIL Open Font License)' },
];

/**
 * The "About" panel in the sidebar Tools group — app identity, version,
 * a one-line descriptor, credits, and the company name. Mirrors the other
 * Tools menus (a full-width trigger button that opens a CenteredModalPanel).
 * Version comes from __APP_VERSION__ (injected from package.json at build).
 */
export function AboutMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        About
      </button>

      <CenteredModalPanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
        widthRem={28}
        eyebrow="About"
        title="College Football 27 Dynasty Hub"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="border border-[color:color-mix(in_srgb,var(--team-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--team-primary)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
              v{__APP_VERSION__}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">by Antigracity</span>
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
        </div>
      </CenteredModalPanel>
    </div>
  );
}
