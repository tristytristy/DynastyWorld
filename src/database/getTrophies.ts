import { CFP_ROUND_NAMES, resolveCfpBowl } from '../shared/cfpBowls';
import { isGamePlayed } from '../shared/gameStatus';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { getSeasonYearRow } from './seasonYearRow';
import type { GameData } from '../extractors/extract-schedule';
import type { ConferenceChampionshipData } from '../extractors/extract-league-history';
import type { TeamData } from '../extractors/extract-teams';
import { rivalryTrophyFor, rivalryTrophyLabel } from '../shared/rivalryTrophies';
import type { BowlAppearance, PostseasonKind, Trophy, TeamTrophies } from '../shared/types';

type LegacyConferenceChampionshipData = {
  conferenceName: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
};

/**
 * `userTeamName` is the USER's team, deliberately, even when this runs for
 * another program. The legacy snapshot shape recorded a single championship
 * without saying who won it, because at the time only the user's could be
 * stored — so it can only ever be attributed to them. Reading it as a browsed
 * team's title would hand every program in the league the user's conference
 * trophy. Pass undefined and the legacy row is simply skipped; archives synced
 * since the array form landed are unaffected either way.
 */
function normalizeConferenceChampionships(
  snapshot: ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null | undefined,
  userTeamName: string | undefined,
): ConferenceChampionshipData[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot)) return snapshot;
  if (!userTeamName) return [];

  return [
    {
      conferenceName: snapshot.conferenceName,
      winningTeamName: userTeamName,
      losingTeamName: snapshot.opponentName,
      winningTeamScore: snapshot.teamScore,
      losingTeamScore: snapshot.opponentScore,
    },
  ];
}

function gameResult(game: GameData, userTeamIndex: number): 'W' | 'L' | 'T' | null {
  if (!isGamePlayed(game.status)) return null;
  const isHome = game.homeTeamIndex === userTeamIndex;
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  if (teamScore > opponentScore) return 'W';
  if (teamScore < opponentScore) return 'L';
  return 'T';
}

function opponentName(game: GameData, userTeamIndex: number): string {
  const isHome = game.homeTeamIndex === userTeamIndex;
  return (isHome ? game.awayTeamName : game.homeTeamName) ?? 'TBD';
}

function classifyPostseasonKind(game: GameData): PostseasonKind {
  if (game.isNationalChampionship) return 'national-championship';
  // A CFP round played at one of the six New Year's Six venues IS that bowl —
  // a quarterfinal at the Rose Bowl is the Rose Bowl, and the game awards its
  // trophy. Only a round with no bowl behind it (the first round, played on
  // campus) stays a bare bracket round.
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) {
    return resolveCfpBowl(game.bowlName, game.neutralVenueId) ? 'bowl' : 'cfp-round';
  }
  return 'bowl';
}

/**
 * The bowl a postseason game actually is, traditional or playoff.
 *
 * A traditional bowl carries its own AssetName. A CFP quarterfinal or semifinal
 * carries a placeholder, and its real identity has to be resolved from the
 * venue (see shared/cfpBowls.ts). Null for the first round — played on the
 * higher seed's campus, so there is no bowl to win — and for the national
 * championship, which is a neutral site rather than anybody's bowl.
 */
function bowlIdentity(game: GameData): { name: string; assetName: string | null } | null {
  if (game.isNationalChampionship) return null;
  const cfp = resolveCfpBowl(game.bowlName, game.neutralVenueId);
  if (cfp) return { name: cfp.name, assetName: cfp.assetName };
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) return null;
  return game.bowlName ? { name: game.bowlName, assetName: game.bowlAssetName } : null;
}

/**
 * Composes this season's trophy case (national championship, conference
 * championship, bowl win) and postseason appearance from the schedule
 * snapshot (national championship / bowl win / CFP rounds - all fully
 * derivable from per-game result data already extracted) plus the
 * conference-championship snapshot (the one piece that needed its own
 * extractor - see extract-conference-championship.ts). Returns real, played
 * results only; nothing here is inferred from incomplete/upcoming games.
 *
 * Where those two sources are silent because the season was never captured at
 * full term, conference and national titles are recovered from the save's own
 * program history and marked `recovered` (see seasonYearRow.ts). Bowl trophies
 * deliberately have no such fallback: program history records that a postseason
 * round was won but never which bowl it was, so there is no honest way to pick
 * the trophy.
 *
 * WORKS FOR ANY TEAM, not just the user's. Every source it reads — the
 * leaguewide `schedule` snapshot, `teams`, the conference-championship snapshot
 * and the rivalry-trophy pairing map — already covers all 143 programs; the only
 * thing that was ever user-specific here was which teamIndex it filtered on. So
 * a browsed program's Team Hub shows the same case its own coach would see:
 * bowls won, rivalry trophies taken, conference and national titles. Omit
 * `teamIndex` for the dynasty's own team, which is what every existing caller
 * does.
 */
export function getTrophies(dynastyId: string, seasonId?: number, teamIndex?: number): TeamTrophies | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const subjectTeamIndex = teamIndex ?? season.userTeamId;
  if (subjectTeamIndex === null || subjectTeamIndex === undefined) return undefined;

  const userTeamIndex = subjectTeamIndex;
  const allGames = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const teamGames = allGames.filter(
    (g) => g.homeTeamIndex === userTeamIndex || g.awayTeamIndex === userTeamIndex,
  );

  const trophies: Trophy[] = [];
  // The safety net for seasons that were never captured at full term — consulted
  // only where the season's own data comes up empty. See seasonYearRow.ts.
  const historySeason = getSeasonYearRow(dynastyId, season.seasonYear, subjectTeamIndex);

  const ncGame = teamGames.find((g) => g.isNationalChampionship && isGamePlayed(g.status));
  if (ncGame && gameResult(ncGame, userTeamIndex) === 'W') {
    trophies.push({ kind: 'national-championship', label: 'National Champions', assetKey: null });
  } else if (!ncGame && historySeason?.nationalResult === 'Win') {
    trophies.push({
      kind: 'national-championship',
      label: 'National Champions',
      assetKey: null,
      recovered: true,
    });
  }

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((team) => team.teamIndex === userTeamIndex);
  const isUserTeam = season.userTeamId === userTeamIndex;
  const confChampions = normalizeConferenceChampionships(
    getSnapshot<ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null>(
      season.id,
      'conferenceChampionship',
    ),
    // Only the user's own team may claim an unattributed legacy row — see above.
    isUserTeam ? userTeam?.displayName : undefined,
  );
  const confChamp = userTeam
    ? confChampions.find((entry) => entry.winningTeamName === userTeam.displayName)
    : undefined;
  if (confChamp) {
    trophies.push({
      kind: 'conference-championship',
      label: `${confChamp.conferenceName} Champions`,
      assetKey: confChamp.conferenceName,
    });
  } else if (historySeason?.wonConferenceChampionship && historySeason.conferenceName) {
    /*
      No conference title in this season's own snapshot, but the save's program
      history says the team won one. That combination is not a contradiction —
      it's the ordinary result of syncing before the year closed, which leaves
      the league-history row empty while program history fills in later.

      Safe against false positives: the flag was checked against the
      authoritative winners on a full season and matched all ten, with no
      losing finalist carrying it (see extract-team-history.ts). It also rescues
      the naming mismatch above, where the snapshot's "Jacksonville State"
      never matched program history's "Jax State".
    */
    trophies.push({
      kind: 'conference-championship',
      label: `${historySeason.conferenceName} Champions`,
      assetKey: historySeason.conferenceName,
      recovered: true,
    });
  }

  // Every postseason game played, not just traditional bowls - a team that
  // makes the CFP plays several of these before (maybe) reaching the national
  // championship. The furthest one (highest week) is "how the postseason
  // went" for the single appearance badge.
  const postseasonGames = teamGames
    .filter((g) => g.isBowlGame && isGamePlayed(g.status) && g.bowlName)
    .sort((a, b) => b.week - a.week);

  let bowlAppearance: BowlAppearance | null = null;
  const latest = postseasonGames[0];
  if (latest && latest.bowlName) {
    const identity = bowlIdentity(latest);
    bowlAppearance = {
      kind: classifyPostseasonKind(latest),
      /*
        A resolved playoff bowl reports itself as the bowl, so the badge reads
        "Rose Bowl" and carries the Rose Bowl's own art rather than the generic
        "CFP Quarterfinal" mark. Falls back to the save's own naming when there
        is no bowl behind the round — the first round, played on campus.
      */
      bowlName: identity?.name ?? latest.bowlName,
      bowlAssetName: identity?.assetName ?? latest.bowlAssetName,
      opponent: opponentName(latest, userTeamIndex),
      result: gameResult(latest, userTeamIndex),
    };
  }

  /*
    BOWL TROPHIES, INCLUDING THE ONES WON INSIDE THE PLAYOFF.

    This used to award nothing for a CFP round, reasoning that winning a bracket
    round is progression rather than a prize. That held only while the app
    couldn't tell WHICH bowl a quarterfinal was — now that the venue resolves
    it, a quarterfinal at the Rose Bowl IS the Rose Bowl, and the game hands
    over that trophy on the way to the title.

    Iterated over every postseason game rather than only the furthest, because a
    playoff run can collect more than one: win the Rose Bowl quarterfinal and
    the Orange Bowl semifinal and both belong in the case. Deduped by asset so a
    bowl can't appear twice, and the national championship is excluded — it is a
    neutral site rather than anybody's bowl, and the title trophy above already
    covers it.
  */
  for (const game of postseasonGames) {
    if (gameResult(game, userTeamIndex) !== 'W') continue;
    const identity = bowlIdentity(game);
    if (!identity) continue;
    if (trophies.some((t) => t.kind === 'bowl-win' && t.assetKey === identity.assetName)) continue;
    trophies.push({
      kind: 'bowl-win',
      label: `${identity.name} Champions`,
      assetKey: identity.assetName,
    });
  }

  /*
    Rivalry trophies. Not a separate data source — a rivalry trophy is won by
    beating the school it's contested with, so every won game is checked against
    the pairing map (which is itself read out of the save's Rivalry table; see
    shared/rivalryTrophies.ts).

    Deliberately NOT gated on the save's isRivalryGame flag: that only covers
    the user's own three Rival1/2/3 slots, while a program can hold several
    trophies against schools outside those slots. The pairing map is the
    authority on whether a trophy exists at all.
  */
  if (userTeam) {
    for (const game of teamGames) {
      if (!isGamePlayed(game.status) || gameResult(game, userTeamIndex) !== 'W') continue;
      const stem = rivalryTrophyFor(userTeam.displayName, opponentName(game, userTeamIndex));
      if (!stem || trophies.some((t) => t.assetKey === stem)) continue;
      trophies.push({
        kind: 'rivalry-win',
        id: stem,
        label: rivalryTrophyLabel(stem),
        assetKey: stem,
      });
    }
  }

  return { trophies, bowlAppearance };
}
