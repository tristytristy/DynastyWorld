import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelectedSeason } from './SelectedSeasonProvider';
import type { AwardsOverview } from '../../shared/types';

/**
 * Self-fetching awards data for the award pages. Replaces the old
 * AwardsLayout Outlet context now that the award pages are split across
 * sections by scope (national → NCAA Hub, team → Team Hub) rather than nested
 * under one Awards layout. `awards` is `undefined` while loading, `null` if
 * the season has none.
 */
export function useAwardsOverview(): {
  dynastyId: string;
  seasonId: number | undefined;
  awards: AwardsOverview | null | undefined;
} {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [awards, setAwards] = useState<AwardsOverview | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setAwards(undefined);
    window.api.db.getAwards(id, seasonId).then((result) => {
      if (!cancelled) setAwards(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  return { dynastyId: id ?? '', seasonId, awards };
}
