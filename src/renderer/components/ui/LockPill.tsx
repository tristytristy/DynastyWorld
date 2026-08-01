/**
 * The reveal control for hidden recruit ratings.
 *
 * Recruiting deliberately hides a prospect's overall and athletic ratings — you
 * scout on rank, stars and film — and this is the one control that lets a user
 * choose to see one anyway. It lived inside NationalRecruits.tsx, which was fine
 * while the Recruit Hub was the only place a rating could be revealed. It isn't
 * anymore: the recruit profile modal and the global-search rows both hide
 * ratings under the same rule, and a second hand-drawn lock would have been a
 * second thing to keep in step.
 *
 * The lock STATE is not held here — it lives in RecruitingExperienceProvider, so
 * every surface reads one set and revealing in any of them reveals in all.
 */
export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="1" />
      {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.4-2" />}
    </svg>
  );
}

/** A compact lock/reveal pill — the shared control for the OVR and athletic reveals. */
export function LockPill({
  unlocked,
  onClick,
  revealLabel = 'Reveal',
}: {
  unlocked: boolean;
  onClick: () => void;
  revealLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
        unlocked
          ? 'border-[var(--team-primary)]/50 bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)] text-[var(--team-accent-text)] dark:text-white'
          : 'border-slate-300/80 bg-slate-100/70 text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'
      }`}
      aria-label={unlocked ? 'Hide' : revealLabel}
    >
      <LockIcon locked={!unlocked} />
      {unlocked ? 'Hide' : revealLabel}
    </button>
  );
}
