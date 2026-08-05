import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getCurrentSeason, getSeasonById, getSnapshot } from './helpers';
import { getAllLeaguePlayers } from './getLeagueRoster';
import { getRecruitRanks } from './getNationalRecruits';
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
  /*
    AND NEITHER IS THE ORDER. (2026-08-02, user's suggestion.)

    Withholding the number while still RANKING by it leaks the more useful half:
    the order of the list is the scouting answer. So the two kinds are ranked by
    two different public keys — players by overall, which is public for them, and
    prospects by NATIONAL RANK, which is printed beside every name on the board
    and in the profile. Nothing hidden touches the ordering.

    The rank is also the better answer on its own terms: it's the number a user
    recruits by, and it isn't a proxy for the rating (on a real board sorted by
    overall the ranks run 2262, 965, 715, 635, 489, 323, 214, 329 — related, not
    equivalent), so a top-100 prospect surfaces above an unranked one exactly as
    you'd want.

    SLOTS ARE RESERVED so neither kind starves the other. Ranking prospects last
    and cutting at twelve would have hidden them behind any common surname, which
    would defeat the "you can still find a prospect by name" the split above
    exists for. Each kind gets at least six of the twelve when it has matches,
    and takes the lot when the other has none.
  */
  const recruitRanks = getRecruitRanks(dynastyId, season.id) ?? new Map<number, number>();
  const recruitIds = new Set(recruitRanks.keys());

  const matches = (getAllLeaguePlayers(dynastyId, season.id) ?? []).filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
  );
  const matchedPlayers = matches
    .filter((p) => !recruitIds.has(p.id))
    .sort((a, b) => b.overallRating - a.overallRating);
  const matchedRecruits = matches
    .filter((p) => recruitIds.has(p.id))
    // 0 means unranked in the save, which belongs at the bottom, not the top.
    .sort((a, b) => (recruitRanks.get(a.id) || Infinity) - (recruitRanks.get(b.id) || Infinity));

  const LIMIT = 12;
  const FLOOR = 6;
  const players = [
    ...matchedPlayers.slice(0, Math.max(FLOOR, LIMIT - matchedRecruits.length)),
    ...matchedRecruits.slice(0, Math.max(FLOOR, LIMIT - matchedPlayers.length)),
  ]
    .slice(0, LIMIT)
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
