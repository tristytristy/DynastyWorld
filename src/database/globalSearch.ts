import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getCurrentSeason, getSeasonById, getSnapshot } from './helpers';
import { getAllLeaguePlayers } from './getLeagueRoster';
import { getRecruitIds } from './getNationalRecruits';
import type { CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';
import type { GlobalSearchResults } from '../shared/types';


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

  /*
    PROSPECTS ARE NOT PLAYERS, AND SEARCH HAS TO SAY SO.

    Recruits sit in the same league roster this searches, on the FCS/placeholder
    team index — so a search for a common surname returned high-school prospects
    labelled as "FCS West" players, ranked by an overall rating the Recruit Hub
    deliberately keeps hidden until you reveal it. That is a hole straight
    through the hidden-ratings design: anyone could read a prospect's OVR out of
    the search box without ever touching Reveal.

    Marking them here rather than dropping them keeps the useful half — you can
    still find a prospect by name. The renderer uses `isRecruit` to label the row
    "Recruit" instead of a fake team, to withhold the rating unless it has been
    revealed, and to open the recruit view rather than the player workspace.

    Identity comes from the recruit pool, NOT from the team index: 255 is a
    shared bucket that also holds non-prospect placeholder entities.
  */
  const recruitIds = new Set(getRecruitIds(dynastyId, season.id) ?? []);

  const players = (getAllLeaguePlayers(dynastyId, season.id) ?? [])
    .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 12)
    .map((p) => {
      const isRecruit = recruitIds.has(p.id);
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        // A prospect has no program yet; the placeholder bucket's name ("FCS
        // West") is not one, and printing it reads as a real school.
        teamName: isRecruit ? null : p.teamDisplayName,
        teamIndex: p.teamIndex,
        overallRating: p.overallRating,
        portraitAssetName: p.portraitAssetName,
        isRecruit,
      };
    });

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
