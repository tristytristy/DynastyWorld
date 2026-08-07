import type { OffensiveStatLine, DefensiveStatLine } from '../extractors/extract-stats';
import type { LeagueSeasonStat } from '../extractors/extract-league-roster';
import { getDynastyById, getSeasonById, getSeasonsByDynasty, getSnapshot, resolveSeasonHeadCoach } from './helpers';
import { conferenceChampionshipWeek } from '../shared/championshipWeek';
import { getSeasonGameContext } from './gameContext';
import { getTeamGameStats } from './getTeamGameStats';
import { isBowlSlateSet } from '../shared/syncPhase';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { GameData } from '../extractors/extract-schedule';
import type { ConferenceChampionshipData, YearSummaryData } from '../extractors/extract-league-history';
import type { TeamData } from '../extractors/extract-teams';
import type { GameSummary, LeagueTeamGame, LeagueTeamHonors, LeagueTeamRoster, LeagueTeamSummary, NationalPlayer, SeasonOverview, TeamCard } from '../shared/types';
import { isFcsPool } from '../shared/fcsPool';

interface TeamsSnapshotEntry {
  teamIndex: number;
  displayName: string;
  conferenceName?: string | null;
}

function resolveSeasonId(dynastyId: string, seasonId?: number): number | undefined {
  const seasons = getSeasonsByDynasty(dynastyId);
  if (seasonId !== undefined) return seasons.find((s) => s.id === seasonId)?.id;
  return seasons.find((s) => s.isCurrent)?.id ?? seasons[0]?.id;
}

/**
 * A full Team-Hub overview for ANY team (not just the user's), built from the
 * same `teams` + `leagueSchedule` snapshots the browse pages already use. Lets
 * a non-user Team Hub show the identical picture the user's does — record,
 * conference record, poll ranks, recruiting-class rank, prestige, and recent/
 * upcoming games. (Season-high ranking history stays user-only — it's not
 * tracked leaguewide.) Returns the same SeasonOverview shape so one render path
 * serves both.
 */
/**
 * A league-roster stat cell, or null for a lineman.
 *
 * Linemen carry their own line now (pancakes, sacks allowed — see
 * extract-stats.ts), and this column renders the offense/defense box score,
 * which has no place to put one. Null is the same thing the roster showed
 * before linemen had stats at all, so nothing regresses; their numbers appear
 * on the Statistics leaderboards.
 */
function leagueSeasonStat(
  stat: LeagueSeasonStat | undefined,
): { playerId: number; category: 'offense' | 'defense'; season: OffensiveStatLine | DefensiveStatLine | null } | null {
  if (!stat || stat.category === 'oline') return null;
  return {
    playerId: stat.playerId,
    category: stat.category,
    season: stat.season as OffensiveStatLine | DefensiveStatLine | null,
  };
}

export function getLeagueTeamOverview(
  dynastyId: string,
  teamIndex: number,
  seasonId?: number,
): SeasonOverview | undefined {
  if (isFcsPool(teamIndex)) return undefined;
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return undefined;
  const dynasty = getDynastyById(dynastyId);
  const season = getSeasonById(resolved);
  const teams = getSnapshot<TeamData[]>(resolved, 'teams') ?? [];
  const team = teams.find((t) => t.teamIndex === teamIndex);
  if (!team || !dynasty || !season) return undefined;

  const games = getSnapshot<LeagueGameData[]>(resolved, 'leagueSchedule') ?? [];
  // "Upcoming games" below would otherwise surface the save's placeholder bowl
  // pairing as a real fixture — the same defect as the schedule page, so it
  // takes the same gate (isBowlSlateSet).
  const bowlsVisible = isBowlSlateSet(season.syncedWeekType);
  const teamGames = games.filter(
    (g) =>
      (g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex) &&
      (g.weekType === 'RegularSeason' || bowlsVisible || (g.homeScore !== null && g.awayScore !== null)),
  );
  const toSummary = (g: LeagueGameData): GameSummary => {
    const isHome = g.homeTeamIndex === teamIndex;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const opponentScore = isHome ? g.awayScore : g.homeScore;
    const played = teamScore !== null && opponentScore !== null;
    let result: GameSummary['result'] = null;
    if (played) result = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T';
    return {
      week: g.week,
      opponent: (isHome ? g.awayTeamName : g.homeTeamName) ?? 'TBD',
      isHome,
      status: played ? 'Played' : 'Unplayed',
      teamScore: played ? teamScore : null,
      opponentScore: played ? opponentScore : null,
      result,
    };
  };
  const played = teamGames.filter((g) => g.homeScore !== null && g.awayScore !== null).sort((a, b) => a.week - b.week);
  const upcoming = teamGames.filter((g) => g.homeScore === null || g.awayScore === null).sort((a, b) => a.week - b.week);

  return {
    dynastyId: dynasty.id,
    dynastyLabel: dynasty.label,
    teamName: team.displayName,
    seasonYear: season.seasonYear,
    headCoach: resolveSeasonHeadCoach(season, teamIndex),
    lastSyncedAt: season.extractedAt,
    record: { wins: team.confWins + team.nonConfWins, losses: team.confLosses + team.nonConfLosses },
    conferenceRecord: { wins: team.confWins, losses: team.confLosses },
    rankings: {
      media: team.mediaPollRank > 0 ? team.mediaPollRank : null,
      coaches: team.coachesPollRank > 0 ? team.coachesPollRank : null,
      cfp: team.cfpRank > 0 ? team.cfpRank : null,
    },
    recruitingClassRank: team.topClassRank > 0 ? team.topClassRank : null,
    teamPrestige: team.teamPrestige > 0 ? team.teamPrestige : null,
    recentGames: played.slice(-3).reverse().map(toSummary),
    upcomingGames: upcoming.slice(0, 3).map(toSummary),
  };
}

/**
 * A compact, single-fetch "team card" for the global Team modal. Bundles the
 * same SeasonOverview the Team Hub uses (record / rankings / recent + upcoming
 * games) with the team's identity + colors (for the header wash + logo), its
 * top players by OVR, and its per-game stat lines (the modal aggregates those
 * into the stat strip via the shared teamStats lib, exactly as the Statistics
 * page does). One round trip keeps the modal snappy. Returns null for an
 * unknown / generic-FCS-pool team — TeamLink shouldn't open the modal for those.
 */
export function getTeamCard(dynastyId: string, teamIndex: number, seasonId?: number): TeamCard | null {
  if (isFcsPool(teamIndex)) return null;
  const overview = getLeagueTeamOverview(dynastyId, teamIndex, seasonId);
  if (!overview) return null;
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const team = (getSnapshot<TeamData[]>(resolved, 'teams') ?? []).find((t) => t.teamIndex === teamIndex);
  const roster = getLeagueTeamRoster(dynastyId, teamIndex, seasonId);
  const topPlayers = [...(roster?.players ?? [])]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      overallRating: p.overallRating,
      portraitAssetName: p.portraitAssetName,
    }));
  return {
    teamIndex,
    overview,
    topPlayers,
    games: getTeamGameStats(dynastyId, teamIndex, seasonId) ?? [],
    conferenceName: team?.conferenceName ?? null,
    teamAssetName: team?.assetName ?? null,
    primaryColorHex: team?.primaryColorHex ?? null,
    secondaryColorHex: team?.secondaryColorHex ?? null,
  };
}

/** Every team in the league with a roster in this season's league snapshot — for the browse entry list. */
export function getLeagueTeams(dynastyId: string, seasonId?: number): LeagueTeamSummary[] | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  const counts = new Map<number, number>();
  for (const player of league.players) {
    counts.set(player.teamIndex, (counts.get(player.teamIndex) ?? 0) + 1);
  }
  return [...counts.entries()]
    // The FCS pool is not a team — 4,525 players share index 255, and offering
    // it in the switcher is what let a user open a roster large enough to take
    // the renderer down. See shared/fcsPool.ts.
    .filter(([teamIndex]) => !isFcsPool(teamIndex))
    .map(([teamIndex, playerCount]) => ({
      teamIndex,
      displayName: nameByIndex.get(teamIndex) ?? `Team ${teamIndex}`,
      playerCount,
    }))
    .filter((t) => !t.displayName.startsWith('Team ') || t.playerCount > 30)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** One team's full roster from the league snapshot, with season stat lines joined for stat-holders. */
export function getLeagueTeamRoster(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamRoster | null {
  if (isFcsPool(teamIndex)) return null;
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const displayName = teams.find((t) => t.teamIndex === teamIndex)?.displayName ?? `Team ${teamIndex}`;

  const statByPlayer = new Map(league.stats.map((s) => [s.playerId, s]));
  const players = league.players
    .filter((p) => p.teamIndex === teamIndex)
    .map((p) => ({ ...p, seasonStat: leagueSeasonStat(statByPlayer.get(p.id)) }));

  return { teamIndex, displayName, seasonId: resolved, players };
}

/**
 * WHICH TEAM does this player belong to — asked of the whole league, not the
 * user's roster.
 *
 * Leaguewide surfaces (Annual Awards, All-America teams, weekly honors, the
 * Heisman board) carry a player id and a team NAME, but nothing that resolves to
 * a `teamIndex` — so a click on an opposing team's award winner had no way to
 * reach the league snapshot his full profile is sitting in, and the modal fell
 * back to a name-and-portrait stub reading "Full profile unavailable". The data
 * was there the whole time; only the join was missing.
 *
 * Searches the caller's season first, then every full-data season newest-first,
 * because a career-spanning surface may hand over an id whose player has since
 * left. The FCS pool and any team with no conference are skipped for the same
 * reason getPlayerDevelopment skips them: index 255 is where the league parks
 * departed players and un-enrolled recruits, and "resolving" one to it would
 * open a roster of 4,500 strangers.
 */
export function findLeaguePlayerTeam(
  dynastyId: string,
  playerId: number,
  seasonId?: number,
): { teamIndex: number; seasonId: number } | null {
  const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData);
  const searchOrder = [
    ...(seasonId !== undefined ? seasons.filter((s) => s.id === seasonId) : []),
    ...[...seasons].sort((a, b) => b.seasonYear - a.seasonYear),
  ];

  for (const season of searchOrder) {
    const league = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
    const player = league?.players.find((p) => p.id === playerId);
    if (!player || isFcsPool(player.teamIndex)) continue;
    const team = (getSnapshot<TeamsSnapshotEntry[]>(season.id, 'teams') ?? []).find(
      (t) => t.teamIndex === player.teamIndex,
    );
    // No team, or one with no conference, is the pool by another name.
    if (!team || team.conferenceName == null) continue;
    return { teamIndex: player.teamIndex, seasonId: season.id };
  }
  return null;
}

/**
 * Every player in the league for a season — the national counterpart to the
 * Team Hub roster. Same per-team league snapshot the browse pages use, but
 * flattened across all teams with each player's team name + conference joined
 * on (for the national Players page's Team column + team/conference filters).
 *
 * THE FCS POOL IS EXCLUDED, and the previous guard only looked like it did
 * (user-reported 2026-08-04: "FCS West is showing up"). The test was
 * `nameByIndex.has(teamIndex)` — "does this resolve to a real team" — but the
 * pool DOES resolve to a name: all five "FCS East / West / Midwest / Northwest
 * / Southeast" rows sit in the teams snapshot at index 255, so every one of the
 * ~4,500 players parked there passed it.
 *
 * They all rendered as "FCS West" for a second reason worth knowing: five names
 * key to the one index, so the last write to `nameByIndex` wins and the whole
 * pool inherits whichever sorts last.
 *
 * The honest test is the one shared/fcsPool.ts defines — index 255 — plus a
 * null conference as a backstop, since a real program always has one. Both,
 * because either alone has been forgotten somewhere in this codebase before.
 */
export function getAllLeaguePlayers(dynastyId: string, seasonId?: number): NationalPlayer[] | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const realTeams = teams.filter((t) => !isFcsPool(t.teamIndex) && !!t.conferenceName);
  const nameByIndex = new Map(realTeams.map((t) => [t.teamIndex, t.displayName]));
  const confByIndex = new Map(realTeams.map((t) => [t.teamIndex, t.conferenceName ?? null]));
  const statByPlayer = new Map(league.stats.map((s) => [s.playerId, s]));

  return league.players
    .filter((p) => nameByIndex.has(p.teamIndex))
    .map((p) => ({
      ...p,
      teamDisplayName: nameByIndex.get(p.teamIndex) as string,
      conferenceName: confByIndex.get(p.teamIndex) ?? null,
      seasonStat: leagueSeasonStat(statByPlayer.get(p.id)),
    }));
}

/** Any team's season schedule from the league-wide game snapshot, mapped relative to that team (their opponent, their W/L). */
/**
 * Wins-losses through each played game, in week order — the browsed-team twin of
 * getSchedule's `applyRunningRecords`, and deliberately the same rule: ties
 * count toward neither column, matching how season totals are read everywhere
 * else in this app. Mutates in place; the caller has already sorted by week.
 */
function applyLeagueRunningRecords(games: LeagueTeamGame[]): void {
  let overallWins = 0;
  let overallLosses = 0;
  let conferenceWins = 0;
  let conferenceLosses = 0;
  for (const game of games) {
    if (game.result === null) continue;
    if (game.result === 'W') {
      overallWins++;
      if (game.gameType === 'conference') conferenceWins++;
    } else if (game.result === 'L') {
      overallLosses++;
      if (game.gameType === 'conference') conferenceLosses++;
    }
    game.runningRecord = { overallWins, overallLosses, conferenceWins, conferenceLosses };
  }
}

export function getLeagueTeamSchedule(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamGame[] | null {
  if (isFcsPool(teamIndex)) return null;
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const games = getSnapshot<LeagueGameData[]>(resolved, 'leagueSchedule');
  if (!games) return null;

  // Conference membership per team, same source (teams snapshot) and same
  // classification rule the user's own schedule uses in getSchedule.ts — a
  // game is 'conference' only when both teams share a conference.
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const conferenceByTeamIndex = new Map(teams.map((t) => [t.teamIndex, t.conferenceName ?? null]));
  const gameContext = getSeasonGameContext(resolved);

  // Same placeholder-bowl gate the user's own schedule applies (isBowlSlateSet):
  // before bowl week the save's bowl pairings are pre-assignments that will be
  // rewritten, and browsing another program shouldn't show them either.
  const bowlsVisible = isBowlSlateSet(getSeasonById(resolved)?.syncedWeekType);

  /*
    Bowl identity comes from the `schedule` snapshot, not from `leagueSchedule`
    — GameData is leaguewide (every game, not just the user's), and it's the one
    that actually resolves the save's BowlGame reference. The leagueSchedule
    copy was null for EVERY postseason game, so the Type column fell back to
    printing the raw week bucket: a CFP Semifinal read "BowlSeason3".

    Reading across fixes existing dynasties with no re-sync. The extractor was
    fixed too (it ran before BowlGame was preloaded, so the reference never
    resolved), but that only helps seasons synced from now on.
  */
  const championshipWeek = conferenceChampionshipWeek(
    (getSnapshot<GameData[]>(resolved, 'schedule') ?? []).map((g) => ({ week: g.week, isBowlGame: g.isBowlGame })),
  );
  const bowlByGameId = new Map(
    (getSnapshot<GameData[]>(resolved, 'schedule') ?? []).map((g) => [
      g.gameId,
      {
        bowlName: g.bowlName,
        bowlAssetName: g.bowlAssetName,
        isNationalChampionship: g.isNationalChampionship,
        // The venue reference rides along for the same reason the bowl name
        // does: it is what identifies which bowl a CFP round actually is, and
        // the leaguewide copy of it is the one that can be missing.
        neutralVenueId: g.neutralVenueId ?? null,
        // And whether it was played at anybody's home at all — the first thing
        // the venue lookup asks before it tries to name a stadium.
        isNeutralSite: g.isNeutralSite,
      },
    ]),
  );

  const rows = games
    .filter((g) => g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex)
    .filter(
      (g) =>
        g.weekType === 'RegularSeason' ||
        bowlsVisible ||
        (g.homeScore !== null && g.awayScore !== null),
    )
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const isHome = g.homeTeamIndex === teamIndex;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const opponentScore = isHome ? g.awayScore : g.homeScore;
      const opponentIndex = isHome ? g.awayTeamIndex : g.homeTeamIndex;
      const result =
        teamScore === null || opponentScore === null
          ? null
          : teamScore > opponentScore
            ? ('W' as const)
            : teamScore < opponentScore
              ? ('L' as const)
              : ('T' as const);

      const ownConf = conferenceByTeamIndex.get(teamIndex) ?? null;
      const oppConf = conferenceByTeamIndex.get(opponentIndex) ?? null;
      const gameType: LeagueTeamGame['gameType'] =
        g.weekType !== 'RegularSeason'
          ? 'bowl'
          : ownConf && oppConf && ownConf === oppConf
            ? 'conference'
            : 'non-conference';

      // What the opponent WAS around kickoff, so browsing another program's
      // season shows the matchups as they stood at the time rather than as
      // today's standings would rewrite them.
      const ctx = gameContext.get(g.gameId);
      const oppRank = isHome ? ctx?.awayMediaRank : ctx?.homeMediaRank;
      const oppRecord = isHome ? ctx?.awayRecord : ctx?.homeRecord;

      return {
        gameId: g.gameId,
        week: g.week,
        weekType: g.weekType,
        bowlName: bowlByGameId.get(g.gameId)?.bowlName ?? g.bowlName,
        bowlAssetName: bowlByGameId.get(g.gameId)?.bowlAssetName ?? null,
        neutralVenueId: bowlByGameId.get(g.gameId)?.neutralVenueId ?? g.neutralVenueId ?? null,
        siteType: (bowlByGameId.get(g.gameId)?.isNeutralSite ? 'neutral' : isHome ? 'home' : 'away') as LeagueTeamGame['siteType'],
        // Filled by applyLeagueRunningRecords below, once the whole season is
        // in week order — one game can't know the record it produced.
        runningRecord: null,
        isNationalChampionship: bowlByGameId.get(g.gameId)?.isNationalChampionship ?? g.weekType === 'NationalChampionship',
        isConferenceChampionship: gameType === 'conference' && championshipWeek !== null && g.week === championshipWeek,
        isHome,
        opponent: isHome ? g.awayTeamName : g.homeTeamName,
        opponentTeamIndex: opponentIndex,
        teamScore,
        opponentScore,
        result,
        gameType,
        conferenceName: gameType === 'conference' ? ownConf : null,
        opponentRank: oppRank ?? null,
        opponentRecord: oppRecord ?? null,
      };
    });

  applyLeagueRunningRecords(rows);
  return rows;
}

/**
 * Any team's championship honors for a season — conference title and/or
 * national title — read from the leaguewide `yearSummary` snapshot (the same
 * completed-year data behind the user's own trophy case and the standings
 * conference-champion flag). Lets Team Hub show the same trophies for any
 * program the user browses to, not just their own. Returns all-false when the
 * season isn't decided yet (no yearSummary) so a mid-season browse simply
 * shows no trophy rather than a wrong one.
 */
export function getLeagueTeamHonors(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamHonors | null {
  if (isFcsPool(teamIndex)) return null;
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;

  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const teamName = teams.find((t) => t.teamIndex === teamIndex)?.displayName;
  if (!teamName) return { conferenceChampion: false, conferenceName: null, nationalChampion: false };

  const yearSummary = getSnapshot<YearSummaryData>(resolved, 'yearSummary');
  // Conference champions: prefer the rich yearSummary array; fall back to the
  // standalone conferenceChampionship snapshot (same leaguewide data) so a
  // season synced before yearSummary was captured still resolves a title.
  const confChampions: ConferenceChampionshipData[] =
    yearSummary?.conferenceChampions ??
    getSnapshot<ConferenceChampionshipData[]>(resolved, 'conferenceChampionship') ??
    [];
  const confChamp = confChampions.find((c) => c.winningTeamName === teamName) ?? null;

  return {
    conferenceChampion: confChamp !== null,
    conferenceName: confChamp?.conferenceName ?? null,
    nationalChampion: yearSummary?.nationalChampion?.teamName === teamName,
  };
}
