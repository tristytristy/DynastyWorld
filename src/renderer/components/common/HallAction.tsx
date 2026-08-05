import { useCallback, useEffect, useState } from 'react';
import { findSlot } from '../../../shared/hallFormation';
import type { LegendStatus } from '../../../shared/types';

/**
 * The Hall of Champions control on a player's profile — the feature's stated
 * entry point.
 *
 * ELIGIBILITY IS THE WHOLE GATE, and it is why this renders nothing most of the
 * time. The profile opens for any player in the country, and only someone this
 * coach actually coached can be enshrined; a disabled "Add to All-Time Legends" on
 * an opposing linebacker would be an invitation to a thing that will never
 * happen. Absent is a clearer answer than greyed out.
 *
 * Adding takes no confirmation (the spec's rule, and the right one — it is
 * reversible and costs nothing). Removing does, but it belongs on the Hall page
 * where the pool is managed, not here: this control's job is to get a player IN.
 *
 * The status is fetched per player rather than read from a loaded Hall, so
 * opening a profile costs one small query instead of folding several hundred
 * eligible players to answer a yes/no about one of them.
 */
export function HallAction({ dynastyId, playerId }: { dynastyId: string; playerId: number }) {
  const [status, setStatus] = useState<LegendStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    window.api.db.getLegendStatus(dynastyId, playerId).then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId]);

  useEffect(load, [load]);

  if (!status?.eligible) return null;

  const slot = status.slotId ? findSlot(status.slotId) : undefined;
  const placed = slot && status.tier;

  if (status.inPool) {
    return (
      <span
        className="corner-cut-sm inline-flex items-center gap-2 border border-[var(--team-primary)]/45 bg-[color:color-mix(in_srgb,var(--team-primary)_10%,transparent)] px-3 py-1.5"
        title="Manage this on the Hall of Champions page"
      >
        <span className="type-eyebrow text-[var(--team-accent-text)]">Hall of Champions</span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {placed ? `${status.tier === 'first' ? 'First' : 'Second'}-Team ${slot.label}` : 'In All-Time Legends'}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await window.api.db.addLegend(dynastyId, playerId);
          const next = await window.api.db.getLegendStatus(dynastyId, playerId);
          setStatus(next);
        } finally {
          setBusy(false);
        }
      }}
      className="corner-cut-sm inline-flex items-center gap-2 border border-slate-300/80 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--team-primary)] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
    >
      {busy ? 'Adding…' : 'Add to All-Time Legends'}
    </button>
  );
}
