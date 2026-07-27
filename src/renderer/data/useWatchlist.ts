import { useCallback, useEffect, useState } from 'react';

/**
 * A per-dynasty recruit "watchlist" — a set of recruit ids the user has flagged
 * to keep an eye on, stored locally (localStorage), never in the save. Keyed by
 * the recruit's PresentationId (what the app already exposes as `playerId`),
 * which is stable across re-syncs, so a flagged recruit stays flagged. This is
 * app-side convenience state, mirroring how the recruiting-experience prefs
 * persist — no IPC, no DB, no save writes.
 *
 * Call it ONCE per page and pass `isWatched`/`toggle` down, so the table and the
 * profile panel share one reactive source on that page.
 */
export interface WatchlistControls {
  ids: Set<number>;
  count: number;
  isWatched: (playerId: number) => boolean;
  toggle: (playerId: number) => void;
}

function storageKey(dynastyId: string | undefined): string | null {
  return dynastyId ? `cfb.watchlist.${dynastyId}` : null;
}

function loadSet(key: string | null): Set<number> {
  if (!key) return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n): n is number => typeof n === 'number'));
  } catch {
    return new Set();
  }
}

function saveSet(key: string | null, ids: Set<number>): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* ignore persistence failure */
  }
}

export function useWatchlist(dynastyId: string | undefined): WatchlistControls {
  const key = storageKey(dynastyId);
  const [ids, setIds] = useState<Set<number>>(() => loadSet(key));

  // Reload when the dynasty changes (switching programs).
  useEffect(() => {
    setIds(loadSet(key));
  }, [key]);

  const isWatched = useCallback((playerId: number) => ids.has(playerId), [ids]);

  const toggle = useCallback(
    (playerId: number) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(playerId)) next.delete(playerId);
        else next.add(playerId);
        saveSet(key, next);
        return next;
      });
    },
    [key],
  );

  return { ids, count: ids.size, isWatched, toggle };
}
