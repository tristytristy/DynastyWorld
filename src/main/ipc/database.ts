import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  AwardsOverview,
  CoachOverview,
  DynastyMatchCandidate,
  DynastySummary,
  DynastyTheme,
  GameLogEntry,
  ImportResult,
  NcaaHubOverview,
  PlayerKickingStats,
  PlayerStats,
  ProgramHistoryOverview,
  RankingsOverview,
  RecruitingOverview,
  RosterPlayer,
  ScheduleOverview,
  SeasonOverview,
  SeasonSummary,
  StandingsOverview,
  TeamAwardDefinitionSummary,
  TeamAwardResult,
  TeamAwardHistorySeason,
  TeamAwardSettings,
  TeamStats,
  TeamTrophies,
} from '../../shared/types';
import {
  deleteDynasty,
  getCurrentSeason,
  getDynastyById,
  getDynasties,
  getSeasonsByDynasty,
} from '../../database/helpers';
import { formatBackfillSuffix, persistExtraction, syncDynasty } from '../../database/importExtraction';
import { checkDynastyMatch, relinkDynasty } from '../../database/relinkDynasty';
import { getSeasonOverview } from '../../database/getSeasonOverview';
import { getNcaaHub } from '../../database/getNcaaHub';
import { getHistory } from '../../database/getHistory';
import { getRoster } from '../../database/getRoster';
import { getPlayerStats } from '../../database/getPlayerStats';
import { getTeamStats } from '../../database/getTeamStats';
import { getKickingStats } from '../../database/getKickingStats';
import { getGameLog } from '../../database/getGameLog';
import { getTrophies } from '../../database/getTrophies';
import { getSchedule } from '../../database/getSchedule';
import { getStandings } from '../../database/getStandings';
import { getCoaches } from '../../database/getCoaches';
import { getAwards } from '../../database/getAwards';
import { getRankings } from '../../database/getRankings';
import { getRecruits } from '../../database/getRecruits';
import { getLeagueTeams, getLeagueTeamRoster, getLeagueTeamSchedule, getLeagueTeamHonors } from '../../database/getLeagueRoster';
import { getNationalRecruits } from '../../database/getNationalRecruits';
import { getNcaaRecords } from '../../database/getNcaaRecords';
import { getDynastyTrends } from '../../database/getDynastyTrends';
import { getTransfers } from '../../database/getTransfers';
import {
  confirmTeamAwardWinner,
  finalizeTeamAwards,
  getAllTeamAwardResults,
  getTeamAwardHistory,
  runTeamAwardCalculation,
  selectManualTeamAwardWinner,
  unlockTeamAwards,
} from '../../database/getTeamAwards';
import { getTeamAwardSettings, saveTeamAwardSettings } from '../../database/teamAwardsWrite';
import { AWARD_DEFINITIONS } from '../../teamAwards/awardDefinitions';
import { extractAll } from '../../extractors/extract-all';

export function registerDatabaseHandlers(): void {
  ipcMain.handle(IPC.db.getDynasties, async (): Promise<DynastySummary[]> => {
    return getDynasties().map((dynasty) => {
      const currentSeason = getCurrentSeason(dynasty.id);
      const record =
        currentSeason &&
        currentSeason.finalRecordWins !== null &&
        currentSeason.finalRecordLosses !== null
          ? {
              wins: currentSeason.finalRecordWins,
              losses: currentSeason.finalRecordLosses,
            }
          : null;
      const userCoach = getCoaches(dynasty.id, currentSeason?.id)?.userCoach ?? null;

      return {
        id: dynasty.id,
        label: dynasty.label,
        teamName: dynasty.teamName ?? dynasty.label,
        seasonYear: currentSeason?.seasonYear ?? null,
        record,
        primaryColor: dynasty.teamColorPrimary,
        secondaryColor: dynasty.teamColorSecondary,
        coachName: userCoach ? `${userCoach.firstName} ${userCoach.lastName}`.trim() : null,
        coachPortraitAssetName: userCoach?.portraitAssetName ?? null,
      };
    });
  });

  ipcMain.handle(IPC.db.importDynasty, async (event, savePath: string): Promise<ImportResult> => {
    try {
      const extraction = await extractAll(savePath, (step, status) => {
        event.sender.send(IPC.extraction.progress, { step, status });
      });
      const { dynasty, backfilledSeasonYears } = persistExtraction(savePath, extraction);
      return {
        success: true,
        message: `Imported ${extraction.userTeam.displayName} — season ${extraction.league.seasonYear}.${formatBackfillSuffix(backfilledSeasonYears)}`,
        dynastyId: dynasty.id,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Import failed unexpectedly.',
      };
    }
  });

  ipcMain.handle(
    IPC.db.checkDynastyMatch,
    async (_event, savePath: string): Promise<DynastyMatchCandidate | null> => {
      try {
        return await checkDynastyMatch(savePath);
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    IPC.db.relinkDynasty,
    async (_event, dynastyId: string, savePath: string): Promise<ImportResult> => {
      return relinkDynasty(dynastyId, savePath);
    },
  );

  ipcMain.handle(IPC.db.syncDynasty, async (_event, dynastyId: string): Promise<ImportResult> => {
    return syncDynasty(dynastyId);
  });

  ipcMain.handle(
    IPC.db.getSeasonOverview,
    async (_event, dynastyId: string, seasonId?: number): Promise<SeasonOverview | null> => {
      return getSeasonOverview(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getNcaaHub,
    async (_event, dynastyId: string, seasonId?: number): Promise<NcaaHubOverview | null> => {
      return getNcaaHub(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getHistory,
    async (_event, dynastyId: string): Promise<ProgramHistoryOverview | null> => {
      return getHistory(dynastyId) ?? null;
    },
  );

  ipcMain.handle(IPC.db.deleteDynasty, async (_event, dynastyId: string): Promise<void> => {
    deleteDynasty(dynastyId);
  });

  ipcMain.handle(IPC.db.getSeasons, async (_event, dynastyId: string): Promise<SeasonSummary[]> => {
    return getSeasonsByDynasty(dynastyId).map((season) => ({
      id: season.id,
      seasonYear: season.seasonYear,
      isCurrent: season.isCurrent,
      hasFullData: season.hasFullData,
    }));
  });

  ipcMain.handle(
    IPC.db.getRoster,
    async (_event, dynastyId: string, seasonId?: number): Promise<RosterPlayer[] | null> => {
      return getRoster(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getPlayerStats,
    async (_event, dynastyId: string, seasonId?: number): Promise<PlayerStats[] | null> => {
      return getPlayerStats(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getTeamStats,
    async (_event, dynastyId: string, seasonId?: number): Promise<TeamStats | null> => {
      return getTeamStats(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getKickingStats,
    async (_event, dynastyId: string, seasonId?: number): Promise<PlayerKickingStats[] | null> => {
      return getKickingStats(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getGameLog,
    async (_event, dynastyId: string, seasonId?: number): Promise<GameLogEntry[] | null> => {
      return getGameLog(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getTeamTrophies,
    async (_event, dynastyId: string, seasonId?: number): Promise<TeamTrophies | null> => {
      return getTrophies(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getSchedule,
    async (_event, dynastyId: string, seasonId?: number): Promise<ScheduleOverview | null> => {
      return getSchedule(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getStandings,
    async (_event, dynastyId: string, seasonId?: number): Promise<StandingsOverview | null> => {
      return getStandings(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getCoaches,
    async (_event, dynastyId: string, seasonId?: number): Promise<CoachOverview | null> => {
      return getCoaches(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getAwards,
    async (_event, dynastyId: string, seasonId?: number): Promise<AwardsOverview | null> => {
      return getAwards(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getRankings,
    async (_event, dynastyId: string, seasonId?: number): Promise<RankingsOverview | null> => {
      return getRankings(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getRecruits,
    async (_event, dynastyId: string, seasonId?: number): Promise<RecruitingOverview | null> => {
      return getRecruits(dynastyId, seasonId) ?? null;
    },
  );

  ipcMain.handle(IPC.db.getLeagueTeams, async (_event, dynastyId: string, seasonId?: number) => {
    return getLeagueTeams(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamRoster, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamRoster(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamSchedule, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamSchedule(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamHonors, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamHonors(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNationalRecruits, async (_event, dynastyId: string, seasonId?: number) => {
    return getNationalRecruits(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNcaaRecords, async (_event, dynastyId: string, seasonId?: number) => {
    return getNcaaRecords(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getDynastyTrends, async (_event, dynastyId: string) => {
    return getDynastyTrends(dynastyId) ?? null;
  });

  ipcMain.handle(IPC.db.getTransfers, async (_event, dynastyId: string, focusTeamName: string) => {
    return getTransfers(dynastyId, focusTeamName) ?? null;
  });


  ipcMain.handle(
    IPC.db.getDynastyTheme,
    async (_event, dynastyId: string): Promise<DynastyTheme | null> => {
      const dynasty = getDynastyById(dynastyId);
      if (!dynasty) return null;
      return {
        teamName: dynasty.teamName ?? dynasty.label,
        primaryColor: dynasty.teamColorPrimary,
        secondaryColor: dynasty.teamColorSecondary,
      };
    },
  );

  ipcMain.handle(
    IPC.db.getTeamAwardDefinitions,
    async (): Promise<TeamAwardDefinitionSummary[]> => {
      return AWARD_DEFINITIONS.map((def) => ({
        id: def.id,
        name: def.name,
        shortName: def.shortName,
        description: def.description,
        category: def.category,
        calculationMode: def.calculationMode,
        enabled: def.enabled,
        disabledReason: def.disabledReason,
        retired: def.retired,
        finalistCount: def.finalistCount,
      }));
    },
  );

  ipcMain.handle(
    IPC.db.getTeamAwardResults,
    async (_event, dynastyId: string, seasonId: number): Promise<TeamAwardResult[]> => {
      return getAllTeamAwardResults(dynastyId, seasonId);
    },
  );

  ipcMain.handle(
    IPC.db.calculateTeamAward,
    async (_event, dynastyId: string, seasonId: number, awardDefinitionId: string): Promise<TeamAwardResult> => {
      return runTeamAwardCalculation(dynastyId, seasonId, awardDefinitionId);
    },
  );

  ipcMain.handle(
    IPC.db.confirmTeamAwardWinner,
    async (
      _event,
      dynastyId: string,
      seasonId: number,
      awardDefinitionId: string,
      winnerId: number,
    ): Promise<TeamAwardResult> => {
      return confirmTeamAwardWinner(dynastyId, seasonId, awardDefinitionId, winnerId);
    },
  );

  ipcMain.handle(
    IPC.db.selectManualAwardWinner,
    async (
      _event,
      dynastyId: string,
      seasonId: number,
      awardDefinitionId: string,
      winnerId: number,
    ): Promise<TeamAwardResult> => {
      return selectManualTeamAwardWinner(dynastyId, seasonId, awardDefinitionId, winnerId);
    },
  );

  ipcMain.handle(
    IPC.db.finalizeTeamAwards,
    async (_event, dynastyId: string, seasonId: number): Promise<TeamAwardResult[]> => {
      return finalizeTeamAwards(dynastyId, seasonId);
    },
  );

  ipcMain.handle(
    IPC.db.unlockTeamAwards,
    async (_event, dynastyId: string, seasonId: number): Promise<TeamAwardResult[]> => {
      return unlockTeamAwards(dynastyId, seasonId);
    },
  );

  ipcMain.handle(
    IPC.db.getTeamAwardSettings,
    async (_event, dynastyId: string): Promise<TeamAwardSettings> => {
      return getTeamAwardSettings(dynastyId);
    },
  );

  ipcMain.handle(
    IPC.db.saveTeamAwardSettings,
    async (_event, dynastyId: string, settings: TeamAwardSettings): Promise<TeamAwardSettings> => {
      return saveTeamAwardSettings(dynastyId, settings);
    },
  );

  ipcMain.handle(
    IPC.db.getTeamAwardHistory,
    async (_event, dynastyId: string): Promise<TeamAwardHistorySeason[]> => {
      return getTeamAwardHistory(dynastyId);
    },
  );
}
