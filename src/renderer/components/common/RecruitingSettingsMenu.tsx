import { useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { useRecruitingExperience } from '../../data/RecruitingExperienceProvider';
import { AnchoredMenuPanel } from './AnchoredMenuPanel';

/**
 * Recruiting experience settings — the "Recruiting" entry under EXPERIENCE in
 * the sidebar. A master convenience over the per-recruit reveal locks: flip
 * every recruit's overall + athletic ratings between fully revealed and fully
 * hidden in one place. Fine-grained (per-recruit) reveals still live on the
 * Recruits profile itself.
 */
export function RecruitingSettingsMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
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
                <span className={`text-sm font-semibold ${strong}`}>Reveal all recruit ratings</span>
                <span className={`mt-1 block text-xs leading-5 ${subtle}`}>
                  A prospect&apos;s overall and athletic ratings start hidden across the Recruits pages — recruit the way
                  the game intends, on rank, stars, and film. Turn this on to reveal every recruit&apos;s ratings at once,
                  or leave it off and reveal prospects one at a time from their profile. Ranks, stars, hometown, pipeline,
                  and school interest are always visible.
                </span>
              </span>
              <input
                type="checkbox"
                checked={revealAll}
                onChange={(e) => setRevealAll(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--team-primary)]"
                aria-label="Reveal all recruit ratings"
              />
            </label>
          </section>

          <section className={`mt-4 rounded-xl border p-4 ${isDark ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-amber-400/50 bg-amber-50/70'}`}>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className={`text-sm font-semibold ${strong}`}>Experimental save editing</span>
                <span className={`mt-1 block text-xs leading-5 ${subtle}`}>
                  Unlocks tools that write directly to your dynasty save — currently <strong>Force Commit</strong>, which
                  forces a recruit already on your board to commit to your team. Every write backs up your save first and
                  is verified before it&apos;s kept, but this is experimental: the commit is proven at the save-file level,
                  yet whether it survives an in-game season is still being confirmed. Off by default; turning it off hides
                  these tools without affecting the rest of the Recruit Hub.
                </span>
              </span>
              <input
                type="checkbox"
                checked={experimentalSaveEditing}
                onChange={(e) => setExperimentalSaveEditing(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-amber-500"
                aria-label="Enable experimental save editing"
              />
            </label>
          </section>
        </div>
      </AnchoredMenuPanel>
    </div>
  );
}
