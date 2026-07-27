import { getCurrentSeason, getSeasonById, getSnapshot } from './helpers';
import { getAllLeaguePlayers } from './getLeagueRoster';
import type { CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';
import type { GlobalSearchResults } from '../shared/types';

/** The FCS/placeholder pool — never a real searchable school/coach. */
const FCS_POOL_TEAM_INDEX = 255;

const EMPTY: GlobalSearchResults = { players: [], coaches: [], teams: [] };

/**
 * One-box search across a season's people and programs — every player in the
 * country, every coach on every staff, and every team — so the user can jump
 * straight to anyone. Runs server-side over the season snapshots (the league
 * roster is ~16k players; filtering here keeps that off the wire). Scoped to the
 * given season, or the current one by default.
 */
export function globalSearch(dynastyId: string, query: string, seasonId?: number): GlobalSearchResults {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return EMPTY;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return EMPTY;

  const teamsSnap = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const nameByIndex = new Map(teamsSnap.map((t) => [t.teamIndex, t.displayName]));

  const teams = teamsSnap
    .filter((t) => t.teamIndex !== FCS_POOL_TEAM_INDEX && t.displayName.toLowerCase().includes(q))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 8)
    .map((t) => ({ teamIndex: t.teamIndex, displayName: t.displayName, conferenceName: t.conferenceName ?? null }));

  const players = (getAllLeaguePlayers(dynastyId, season.id) ?? [])
    .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      teamName: p.teamDisplayName,
      teamIndex: p.teamIndex,
      overallRating: p.overallRating,
      portraitAssetName: p.portraitAssetName,
    }));

  const coaches = (getSnapshot<CoachData[]>(season.id, 'coaches') ?? [])
    .filter(
      (c) =>
        c.teamIndex !== FCS_POOL_TEAM_INDEX &&
        c.lastName &&
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
    )
    .slice(0, 8)
    .map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      position: c.position,
      teamName: nameByIndex.get(c.teamIndex) ?? null,
      teamIndex: c.teamIndex,
      portraitAssetName: c.portraitAssetName,
    }));

  return { players, coaches, teams };
}
