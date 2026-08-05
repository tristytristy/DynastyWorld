import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { isGamePlayed } from '../shared/gameStatus';
import { resolveCfpBowl } from '../shared/cfpBowls';
import {
  ALL_SLOTS,
  CHAMPIONSHIP_SLOT,
  FEEDS_INTO,
  bracketSlots,
  isPlayoffGame,
  roundOf,
  seedOf,
} from '../shared/playoffBracket';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { PlayoffBracketGame, PlayoffBracketSide, PlayoffBracketView } from '../shared/types';

/**
 * The twelve-team College Football Playoff, wired.
 *
 * The bracket is a READ, not a simulation. All eleven games exist in the save
 * from the moment the field is set, the engine writes each winner into the next
 * round's game row itself, and `BowlGame.PlayoffBracketSlot` numbers the
 * positions — so nothing here decides who advances. This joins the pieces (game
 * rows, seeds, colours, bowl identity) and hands back all eleven slots.
 *
 * The shape and the slot derivation live in shared/playoffBracket.ts; this file
 * is only the join.
 *
 * EMPTY SLOTS ARE RETURNED, NOT OMITTED. A bracket with three games in it isn't
 * a bracket — the caller always gets 0-10 and renders the gaps.
 */

const EMPTY_SIDE: PlayoffBracketSide = {
  teamIndex: null,
  teamName: null,
  shortName: null,
  seed: null,
  wins: null,
  losses: null,
  score: null,
  isWinner: false,
  isUserTeam: false,
  primaryColorHex: null,
  secondaryColorHex: null,
};

export function getPlayoffBracket(dynastyId: string, seasonId?: number): PlayoffBracketView | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  // The `schedule` snapshot is leaguewide, so it already holds every playoff
  // game — a bracket needs teams the user's own schedule never touches.
  const schedule = getSnapshot<GameData[]>(season.id, 'schedule');
  if (!schedule) return null;

  const playoffGames = schedule.filter(isPlayoffGame);
  if (playoffGames.length === 0) return null;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const teamByIndex = new Map(teams.map((t) => [t.teamIndex, t]));
  const seedByTeam = new Map<number, number>();
  for (const t of teams) {
    const seed = seedOf(t.cfpRank);
    if (seed !== null) seedByTeam.set(t.teamIndex, seed);
  }

  const { slotByGameId, fromSave } = bracketSlots(playoffGames, seedByTeam);

  const gameBySlot = new Map<number, GameData>();
  for (const g of playoffGames) {
    const slot = slotByGameId.get(g.gameId);
    if (slot !== undefined) gameBySlot.set(slot, g);
  }

  const userTeamIndex = season.userTeamId ?? null;

  const sideOf = (
    teamIndex: number | null,
    score: number | null,
    isWinner: boolean,
  ): PlayoffBracketSide => {
    if (teamIndex === null) return { ...EMPTY_SIDE };
    const team = teamByIndex.get(teamIndex);
    return {
      teamIndex,
      teamName: team?.displayName ?? null,
      shortName: team?.shortName || null,
      seed: seedByTeam.get(teamIndex) ?? null,
      wins: team ? team.confWins + team.nonConfWins : null,
      losses: team ? team.confLosses + team.nonConfLosses : null,
      score,
      isWinner,
      isUserTeam: userTeamIndex !== null && teamIndex === userTeamIndex,
      primaryColorHex: team?.primaryColorHex ?? null,
      secondaryColorHex: team?.secondaryColorHex ?? null,
    };
  };

  const games: PlayoffBracketGame[] = ALL_SLOTS.map((slot) => {
    const g = gameBySlot.get(slot);
    const round = roundOf(slot);

    if (!g) {
      return {
        gameId: null,
        slot,
        round,
        week: null,
        played: false,
        bowlName: null,
        bowlAssetName: null,
        neutralVenueId: null,
        feedsIntoSlot: FEEDS_INTO[slot],
        home: { ...EMPTY_SIDE },
        away: { ...EMPTY_SIDE },
      };
    }

    const played = isGamePlayed(g.status);
    const homeWon = played && g.homeScore > g.awayScore;
    const awayWon = played && g.awayScore > g.homeScore;
    const bowl = resolveCfpBowl(g.bowlName, g.neutralVenueId);

    return {
      gameId: g.gameId,
      slot,
      round,
      week: g.week,
      played,
      bowlName: bowl?.name ?? null,
      bowlAssetName: bowl?.assetName ?? null,
      neutralVenueId: g.neutralVenueId ?? null,
      feedsIntoSlot: FEEDS_INTO[slot],
      home: sideOf(g.homeTeamIndex, played ? g.homeScore : null, homeWon),
      away: sideOf(g.awayTeamIndex, played ? g.awayScore : null, awayWon),
    };
  });

  const title = games.find((g) => g.slot === CHAMPIONSHIP_SLOT);
  const champion = title?.played ? (title.home.isWinner ? title.home : title.away) : null;

  return {
    seasonYear: season.seasonYear,
    games,
    championTeamIndex: champion?.teamIndex ?? null,
    championName: champion?.teamName ?? null,
    championshipVenueId: title?.neutralVenueId ?? null,
    userTeamIndex,
    slotsFromSave: fromSave,
  };
}
