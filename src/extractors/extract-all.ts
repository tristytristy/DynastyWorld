import { openFranchiseFile } from './lib/franchise';
import { extractLeague, type LeagueData } from './extract-league';
import { extractTeams, type TeamData } from './extract-teams';
import { extractCoaches, findUserTeamIndex, type CoachData } from './extract-coaches';
import { extractUserCoachLastMove, type CoachMoveData } from './extract-coach-move';
import { extractRoster, type RosterPlayerData } from './extract-roster';
import { extractLeaguePortraits, type LeaguePortraitData } from './extract-league-portraits';
import { extractLeagueRoster, type LeagueRosterData } from './extract-league-roster';
import { extractLeagueSchedule, type LeagueGameData } from './extract-league-schedule';
import { extractSchedule, type GameData } from './extract-schedule';
import { extractRecruits, type RecruitData } from './extract-recruits';
import { extractNationalRecruits, type NationalRecruitData } from './extract-national-recruits';
import { extractNcaaRecords, type NcaaRecordsData } from './extract-ncaa-records';
import { extractStats, type PlayerStatsData } from './extract-stats';
import { extractTeamStats, type TeamStatsData } from './extract-team-stats';
import { extractKicking, type PlayerKickingStatsData } from './extract-kicking';
import { extractGameLog, type PlayerGameLogEntry } from './extract-gamelog';
import {
  extractLeagueHistory,
  type ConferenceChampionshipData,
  type YearSummaryData,
} from './extract-league-history';
import { extractRivalries, type RivalryData } from './extract-rivalries';
import { extractAwards, type AwardsData } from './extract-awards';
import type { ExtractionStep, ExtractionStepStatus } from '../shared/types';

export interface ExtractionData {
  league: LeagueData;
  teams: TeamData[];
  coaches: CoachData[];
  roster: RosterPlayerData[];
  leaguePortraits: LeaguePortraitData[];
  leagueRoster: LeagueRosterData;
  leagueSchedule: LeagueGameData[];
  schedule: GameData[];
  recruits: RecruitData[];
  /** The whole league-wide recruit pool (~2,950 rows) — the national Recruits browser; distinct from `recruits` (the user's own 35-slot board). */
  nationalRecruits: NationalRecruitData[];
  /** NCAA-wide record book — national career/season/single-game records (see extract-ncaa-records.ts). */
  ncaaRecords: NcaaRecordsData;
  stats: PlayerStatsData[];
  teamStats: TeamStatsData | null;
  kicking: PlayerKickingStatsData[];
  gamelog: PlayerGameLogEntry[];
  conferenceChampionship: ConferenceChampionshipData[];
  rivalries: RivalryData[];
  awards: AwardsData;
  userTeam: TeamData;
  /** Every completed year of league-wide history the save exposes (see extract-league-history.ts) — used to backfill history-only seasons the app never individually synced. */
  leagueHistory: YearSummaryData[];
  /** The user coach's most recent school move (or null) — for move-year season attribution at persist time. See extract-coach-move.ts. */
  coachMove: CoachMoveData | null;
}

export async function extractAll(
  filePath: string,
  onProgress?: (step: ExtractionStep, status: ExtractionStepStatus) => void,
): Promise<ExtractionData> {
  const franchise = await openFranchiseFile(filePath);

  onProgress?.('league', 'start');
  const league = await extractLeague(franchise);
  onProgress?.('league', 'done');

  onProgress?.('teams', 'start');
  const teams = await extractTeams(franchise);
  onProgress?.('teams', 'done');

  onProgress?.('coaches', 'start');
  const coaches = await extractCoaches(franchise);
  onProgress?.('coaches', 'done');

  const userTeamIndex = findUserTeamIndex(coaches);
  const userTeam = teams.find((t) => t.teamIndex === userTeamIndex);
  if (!userTeam) {
    throw new Error('Could not determine which team this dynasty belongs to.');
  }

  // The user coach's stable id + most recent school move (for move-year season
  // attribution in persistExtraction). 0 = a coach with no real id.
  const userCoach = coaches.find((c) => c.isUserControlled);
  const userCoachId = userCoach && userCoach.presentationId ? userCoach.presentationId : null;
  const coachMove = await extractUserCoachLastMove(franchise, userCoachId);

  onProgress?.('roster', 'start');
  const roster = await extractRoster(franchise, userTeam.teamIndex);
  const leaguePortraits = await extractLeaguePortraits(franchise);
  const leagueRoster = await extractLeagueRoster(franchise, league.seasonYear - league.baseCalendarYear);
  const leagueSchedule = await extractLeagueSchedule(franchise, league.seasonYear - league.baseCalendarYear);
  onProgress?.('roster', 'done');

  onProgress?.('schedule', 'start');
  const schedule = await extractSchedule(franchise, league.seasonYear - league.baseCalendarYear);
  onProgress?.('schedule', 'done');

  onProgress?.('recruits', 'start');
  const recruits = await extractRecruits(franchise, userTeam.teamIndex);
  const nationalRecruits = await extractNationalRecruits(franchise);
  const ncaaRecords = await extractNcaaRecords(franchise);
  onProgress?.('recruits', 'done');

  onProgress?.('stats', 'start');
  const stats = await extractStats(franchise, userTeam.teamIndex, league.seasonYear - league.baseCalendarYear);
  const teamStats = await extractTeamStats(franchise, userTeam.teamIndex);
  const kicking = await extractKicking(franchise, userTeam.teamIndex, league.seasonYear - league.baseCalendarYear);
  onProgress?.('stats', 'done');

  onProgress?.('gamelog', 'start');
  const gamelog = await extractGameLog(franchise, userTeam.teamIndex);
  onProgress?.('gamelog', 'done');

  onProgress?.('trophies', 'start');
  const leagueHistory = await extractLeagueHistory(franchise, league.baseCalendarYear);
  const currentYearSummary = leagueHistory.find((y) => y.seasonYear === league.seasonYear);
  const conferenceChampionship = currentYearSummary?.conferenceChampions ?? [];
  onProgress?.('trophies', 'done');

  onProgress?.('rivalries', 'start');
  const rivalries = await extractRivalries(franchise, userTeam.teamIndex);
  onProgress?.('rivalries', 'done');

  onProgress?.('awards', 'start');
  const awards = await extractAwards(
    franchise,
    userTeam.teamIndex,
    league.seasonYear - league.baseCalendarYear,
  );
  const coachAwards = (currentYearSummary?.awards ?? []).filter(
    (a) => a.awardType === 'BEST_HC' || a.awardType === 'BEST_AC',
  );
  awards.leagueAwards.push(...coachAwards);
  onProgress?.('awards', 'done');

  return {
    league,
    teams,
    coaches,
    roster,
    leaguePortraits,
    leagueRoster,
    leagueSchedule,
    schedule,
    recruits,
    nationalRecruits,
    ncaaRecords,
    stats,
    teamStats,
    kicking,
    gamelog,
    conferenceChampionship,
    rivalries,
    awards,
    userTeam,
    leagueHistory,
    coachMove,
  };
}
