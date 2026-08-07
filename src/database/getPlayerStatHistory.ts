import type { OffensiveStatLine, DefensiveStatLine } from '../extractors/extract-stats';
import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getSeasonsByDynasty, getSnapshot } from './helpers';
import { findSamePlayer } from '../shared/playerIdentity';
import { referencePlayer } from './getPlayerDevelopment';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { TeamData } from '../extractors/extract-teams';
import type { PlayerStatSeason } from '../shared/types';

/**
 * A player's season-by-season production across every synced year — INCLUDING
 * the years he spent at other schools.
 *
 * WHY THIS EXISTS. The profile's season breakdown used to be assembled from
 * `getRoster` + `getPlayerStats`, which read the USER's team snapshots. So a
 * transfer's career total was right — the save's `CareerStats` accumulates
 * across schools — while the breakdown underneath it only showed the seasons he
 * spent with you. Measured on a real archive: a back who transferred Oklahoma →
 * Delaware showed a 931-yard career line with a single 610-yard season beneath
 * it, and no account of the other 321.
 *
 * Sourced from the LEAGUEWIDE roster snapshot instead, which carries a season
 * stat line for every player on every team (~6,200 lines a season), so the
 * Oklahoma year is already archived and needs no re-sync to appear.
 *
 * SEASONS IN THE FCS POOL ARE SKIPPED, on the same reasoning as
 * getPlayerDevelopment: a player doesn't leave the leaguewide roster when he
 * leaves football, he lands on the generic pool (team index 255, resolving to
 * "FCS West" and friends with a null conference). Charting those invents a
 * season he never played. A resolvable team WITH a conference is the test.
 *
 * THE HONEST LIMIT, which callers must not paper over: this can only cover
 * seasons the dynasty actually synced. A transfer who played elsewhere before
 * the archive begins has that production folded into his career total with no
 * season row anywhere, because the save keeps no per-season history for
 * untracked years. The UI should show the shortfall rather than imply the rows
 * are the whole story.
 */
export function getPlayerStatHistory(
  dynastyId: string,
  playerId: number,
  anchorSeasonId?: number,
): PlayerStatSeason[] {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((season) => season.hasFullData)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  // Ids are recycled between seasons, so the person has to be fixed before the
  // years can be walked — see shared/playerIdentity.ts.
  const reference = referencePlayer(seasons, playerId, anchorSeasonId);
  if (!reference) return [];

  const out: PlayerStatSeason[] = [];

  for (const season of seasons) {
    const league = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
    const player = findSamePlayer(league?.players, reference);
    if (!player) continue;
    if (player.teamIndex === FCS_POOL_TEAM_INDEX) continue;

    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    const team = teams.find((entry) => entry.teamIndex === player.teamIndex);
    // No team, or one with no conference, is the pool by another name.
    if (!team || !team.conferenceName) continue;

    // A player with no production that season has no stat line at all — that's
    // a real absence (he didn't play), not missing data, so the season is left
    // out rather than shown as a row of zeroes.
    // `player.id` rather than the caller's `playerId`: within ONE season an id
    // is unique and authoritative, and this is the row we just resolved. They
    // are the same number today — using the resolved row keeps it that way if
    // identity ever has to survive an id change too.
    const line = league?.stats.find((entry) => entry.playerId === player.id);
    if (!line?.season) continue;
    /*
      Linemen now carry a stat line of their own (pancakes, sacks allowed) — see
      extract-stats.ts. This history renders the offense/defense box score and
      has no row for either, so an 'oline' entry is skipped rather than forced
      into a shape it doesn't fit. Their numbers surface on the Statistics
      leaderboards instead.
    */
    if (line.category === 'oline') continue;
    // The guard above is the narrowing — `category` and `season` are separate
    // fields, so TypeScript can't infer it for us without making the payload a
    // discriminated union, which would ripple much further than this.
    const seasonLine = line.season as OffensiveStatLine | DefensiveStatLine;

    out.push({
      seasonYear: season.seasonYear,
      teamIndex: player.teamIndex,
      teamName: team.displayName,
      isUserTeam: season.userTeamId !== null && player.teamIndex === season.userTeamId,
      schoolYear: player.schoolYear ?? null,
      position: player.position ?? null,
      category: line.category,
      line: seasonLine,
    });
  }

  return out;
}
