import { getLeagueScores } from '../../database/getLeagueScores';
import { getStandings } from '../../database/getStandings';
import { getNationalStatLeaders } from '../../database/getNationalStatLeaders';
import { getSeasonOverview } from '../../database/getSeasonOverview';
import type { LeagueScoreGame } from '../../shared/types';

/**
 * The week's story, assembled from the archive — the exact package every Net
 * generator (feed bots, newspaper, podcast) is handed. Compact on purpose:
 * this goes inside a model prompt, so it carries the notable, not the total.
 */

export interface NetGameLine {
  week: number;
  weekType: string;
  winner: string;
  loser: string;
  winnerRank: number | null;
  loserRank: number | null;
  score: string;
  bowlName: string | null;
  isUpset: boolean;
  isChampionship: boolean;
}

export interface NetLeaderLine {
  player: string;
  position: string;
  team: string;
  line: string;
}

export interface NetWeekContext {
  seasonYear: number;
  week: number;
  userTeam: string;
  userRecord: string;
  userRank: number | null;
  /** The user's own results in the window, most recent last. */
  userGames: NetGameLine[];
  upsets: NetGameLine[];
  rankedWins: NetGameLine[];
  championships: NetGameLine[];
  top10: { rank: number; team: string; record: string }[];
  statLeaders: { passing: NetLeaderLine[]; rushing: NetLeaderLine[]; defense: NetLeaderLine[] };
  /** Teams whose fans deserve an account this week. */
  teamsInTheNews: string[];
}

function playedGames(games: LeagueScoreGame[]): LeagueScoreGame[] {
  return games.filter((g) => g.homeScore !== null && g.awayScore !== null);
}

function toLine(g: LeagueScoreGame): NetGameLine | null {
  if (g.homeScore === null || g.awayScore === null) return null;
  const homeWon = g.homeScore > g.awayScore;
  const winner = homeWon ? g.homeTeamName : g.awayTeamName;
  const loser = homeWon ? g.awayTeamName : g.homeTeamName;
  const winnerRank = homeWon ? g.homeRank : g.awayRank;
  const loserRank = homeWon ? g.awayRank : g.homeRank;
  return {
    week: g.week,
    weekType: g.weekType,
    winner,
    loser,
    winnerRank: winnerRank ?? null,
    loserRank: loserRank ?? null,
    score: homeWon ? `${g.homeScore}-${g.awayScore}` : `${g.awayScore}-${g.homeScore}`,
    bowlName: g.bowlName,
    isUpset: (loserRank ?? 99) < (winnerRank ?? 99),
    isChampionship: g.isNationalChampionship,
  };
}

export function buildWeekContext(dynastyId: string, seasonId: number): NetWeekContext | null {
  const overview = getSeasonOverview(dynastyId, seasonId);
  if (!overview) return null;
  const scores = getLeagueScores(dynastyId, seasonId);
  const standings = getStandings(dynastyId, seasonId);
  const leaders = getNationalStatLeaders(dynastyId, seasonId);

  const played = scores ? playedGames(scores.games) : [];
  const latestWeek = played.length ? Math.max(...played.map((g) => g.week)) : 0;
  // The "window": the latest played week, plus the one before it for context.
  const windowGames = played
    .filter((g) => g.week >= latestWeek - 1)
    .map(toLine)
    .filter((g): g is NetGameLine => g !== null);

  const userTeam = overview.teamName;
  const userGames = windowGames.filter((g) => g.winner === userTeam || g.loser === userTeam);
  const upsets = windowGames
    .filter((g) => g.isUpset && g.loserRank !== null)
    .sort((a, b) => (a.loserRank ?? 99) - (b.loserRank ?? 99))
    .slice(0, 5);
  const rankedWins = windowGames
    .filter((g) => !g.isUpset && g.winnerRank !== null && g.loserRank !== null)
    .slice(0, 5);
  const championships = windowGames.filter((g) => g.isChampionship || g.weekType === 'ConferenceChampionship');

  const allTeams = (standings?.groups ?? []).flatMap((group) => group.teams);
  const top10 = allTeams
    .filter((t) => t.mediaPollRank !== null && t.mediaPollRank <= 10)
    .sort((a, b) => (a.mediaPollRank ?? 99) - (b.mediaPollRank ?? 99))
    .map((t) => ({ rank: t.mediaPollRank as number, team: t.teamName, record: `${t.overallWins}-${t.overallLosses}` }));

  const statLeaders = {
    passing: (leaders?.passing ?? []).slice(0, 3).map((entry) => ({
      player: `${entry.firstName} ${entry.lastName}`,
      position: entry.position,
      team: entry.teamName,
      line: entry.offense
        ? `${entry.offense.passYards} yds, ${entry.offense.passTDs} TD ${entry.offense.passInts} INT`
        : '',
    })),
    rushing: (leaders?.rushing ?? []).slice(0, 3).map((entry) => ({
      player: `${entry.firstName} ${entry.lastName}`,
      position: entry.position,
      team: entry.teamName,
      line: entry.offense ? `${entry.offense.rushYards} yds, ${entry.offense.rushTDs} TD` : '',
    })),
    defense: (leaders?.defense ?? []).slice(0, 3).map((entry) => ({
      player: `${entry.firstName} ${entry.lastName}`,
      position: entry.position,
      team: entry.teamName,
      line: entry.defense
        ? `${entry.defense.tackles + entry.defense.assistedTackles} tkl, ${entry.defense.sacks} sacks, ${entry.defense.interceptions} INT`
        : '',
    })),
  };

  const news = new Set<string>();
  news.add(userTeam);
  for (const t of top10.slice(0, 3)) news.add(t.team);
  for (const u of upsets.slice(0, 2)) news.add(u.winner);
  for (const c of championships) news.add(c.winner);

  return {
    seasonYear: overview.seasonYear,
    week: latestWeek,
    userTeam,
    userRecord: `${overview.record.wins}-${overview.record.losses}`,
    userRank: overview.rankings.media,
    userGames,
    upsets,
    rankedWins,
    championships,
    top10,
    statLeaders,
    teamsInTheNews: [...news].slice(0, 6),
  };
}
