import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { GameData } from '../extractors/extract-schedule';
import type { ConferenceChampionshipData } from '../extractors/extract-league-history';
import type { TeamData } from '../extractors/extract-teams';
import { rivalryTrophyFor, rivalryTrophyLabel } from '../shared/rivalryTrophies';
import type { BowlAppearance, PostseasonKind, Trophy, TeamTrophies } from '../shared/types';

/** The real BowlGame.Name strings the save uses for the three CFP bracket rounds - verified directly, not guessed. */
const CFP_ROUND_NAMES = new Set(['CFP First Round', 'CFP Quarterfinal', 'CFP Semifinal']);

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
  if (game.status === 'Unplayed') return null;
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
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) return 'cfp-round';
  return 'bowl';
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

  const ncGame = teamGames.find((g) => g.isNationalChampionship && g.status !== 'Unplayed');
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
  // went" for the single appearance badge; a bowl-win trophy only fires for a
  // genuine named bowl, not for winning a CFP bracket round (that's
  // progression, not a trophy - the championship win above covers the actual
  // prize).
  const postseasonGames = teamGames
    .filter((g) => g.isBowlGame && g.status !== 'Unplayed' && g.bowlName)
    .sort((a, b) => b.week - a.week);

  let bowlAppearance: BowlAppearance | null = null;
  const latest = postseasonGames[0];
  if (latest && latest.bowlName) {
    const kind = classifyPostseasonKind(latest);
    const result = gameResult(latest, userTeamIndex);
    bowlAppearance = {
      kind,
      bowlName: latest.bowlName,
      bowlAssetName: latest.bowlAssetName,
      opponent: opponentName(latest, userTeamIndex),
      result,
    };
    if (kind === 'bowl' && result === 'W') {
      trophies.push({
        kind: 'bowl-win',
        label: `${latest.bowlName} Champions`,
        assetKey: latest.bowlAssetName,
      });
    }
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
      if (game.status === 'Unplayed' || gameResult(game, userTeamIndex) !== 'W') continue;
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
