import { CFP_ROUND_NAMES, resolveCfpBowl } from '../shared/cfpBowls';
import { isGamePlayed } from '../shared/gameStatus';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
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
 */
export function getTrophies(dynastyId: string, seasonId?: number): TeamTrophies | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const userTeamIndex = season.userTeamId;
  const allGames = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const teamGames = allGames.filter(
    (g) => g.homeTeamIndex === userTeamIndex || g.awayTeamIndex === userTeamIndex,
  );

  const trophies: Trophy[] = [];

  const ncGame = teamGames.find((g) => g.isNationalChampionship && isGamePlayed(g.status));
  if (ncGame && gameResult(ncGame, userTeamIndex) === 'W') {
    trophies.push({ kind: 'national-championship', label: 'National Champions', assetKey: null });
  }

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((team) => team.teamIndex === userTeamIndex);
  const confChampions = normalizeConferenceChampionships(
    getSnapshot<ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null>(
      season.id,
      'conferenceChampionship',
    ),
    userTeam?.displayName,
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
