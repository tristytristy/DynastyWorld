import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import type { DepartureData } from '../extractors/extract-departures';
import type { PlayerDeparture } from '../shared/types';

interface TeamsEntry {
  teamIndex: number;
  displayName: string;
}

/**
 * The offseason "who left and why" list for a team (NFL declarations w/ projected
 * round, transfers out w/ the game's stated reason, graduations) — read from the
 * 'departures' snapshot the game only exposes at OffSeason stage 2 (Players
 * Leaving), captured onto the concluded season by persistExtraction. `teamIndex`
 * null returns the whole league's departures; otherwise scoped to one team.
 */
export function getDepartures(
  dynastyId: string,
  teamIndex: number | null,
  seasonId?: number,
): PlayerDeparture[] | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const seasons = getSeasonsByDynasty(dynastyId);
  const season =
    seasonId !== undefined
      ? seasons.find((s) => s.id === seasonId)
      : (seasons.find((s) => s.isCurrent) ?? seasons[0]);
  if (!season || season.dynastyId !== dynastyId) return null;

  const departures = getSnapshot<DepartureData[]>(season.id, 'departures') ?? [];
  const teams = getSnapshot<TeamsEntry[]>(season.id, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  return departures
    .filter((d) => teamIndex === null || d.teamIndex === teamIndex)
    .map((d) => ({ ...d, teamName: nameByIndex.get(d.teamIndex) ?? null }))
    .sort((a, b) => b.overallRating - a.overallRating);
}
