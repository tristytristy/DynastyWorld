import { useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { useRecruitingExperience } from '../../data/RecruitingExperienceProvider';
import { AnchoredMenuPanel } from './AnchoredMenuPanel';

/**
 * Recruiting experience settings — the "Recruiting" entry under EXPERIENCE in
 * the sidebar. Currently the immersion (spoiler-free) toggle; a natural home
 * for future recruiting-play preferences.
 */
export function RecruitingSettingsMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const { hideUnscoutedStats, setHideUnscoutedStats } = useRecruitingExperience();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const panelShellClass = isDark
    ? 'border border-slate-800/90 bg-slate-950/96 shadow-[0_44px_120px_-44px_rgba(2,6,23,0.9)] backdrop-blur-2xl'
    : 'border border-white/72 bg-white/90 shadow-[0_40px_120px_-44px_rgba(15,23,42,0.45)] backdrop-blur-2xl';
  const strong = isDark ? 'text-white' : 'text-slate-900';
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Recruiting
      </button>

      <AnchoredMenuPanel anchorRef={triggerRef} open={isOpen} onClose={() => setIsOpen(false)} widthRem={26} isDark={isDark}>
        <div className={`relative overflow-hidden p-5 ${panelShellClass}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`type-eyebrow ${subtle}`}>Experience · Recruiting</p>
              <h2 className={`mt-2 text-xl font-semibold tracking-tight ${strong}`}>How you scout.</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={isDark
                ? 'border border-slate-700/85 bg-slate-950/94 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-slate-900 hover:text-white'
                : 'border border-slate-300/85 bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800'}
              aria-label="Close recruiting settings"
            >
              Close
            </button>
          </div>

          <section className={`mt-5 rounded-xl border p-4 ${isDark ? 'border-slate-800/80 bg-slate-950/84' : 'border-slate-200/90 bg-white/72'}`}>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className={`text-sm font-semibold ${strong}`}>Spoiler-free scouting</span>
                <span className={`mt-1 block text-xs leading-5 ${subtle}`}>
                  Hide a recruit&apos;s overall rating across the Recruits pages — recruit the way the game intends,
                  judging prospects on rank, stars, and film. Ranks, stars, hometown, pipeline, and school interest stay
                  visible. (Detailed athletic ratings have their own per-recruit lock on the profile.)
                </span>
              </span>
              <input
                type="checkbox"
                checked={hideUnscoutedStats}
                onChange={(e) => setHideUnscoutedStats(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--team-primary)]"
                aria-label="Hide recruit ratings until scouted"
              />
            </label>
          </section>
        </div>
      </AnchoredMenuPanel>
    </div>
  );
}
