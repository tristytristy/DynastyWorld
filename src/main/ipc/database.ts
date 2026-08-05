import { app, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import { withTask } from '../updater/taskRegistry';
import { mediaDirFor } from './media';
import type {
  AwardsOverview,
  CoachOverview,
  DynastyMatchCandidate,
  DynastySummary,
  DynastyTheme,
  TeamTheme,
  GameLogEntry,
  GameDetailData,
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
  TeamGameStat,
  TeamTrophies,
} from '../../shared/types';
import {
  deleteDynasty,
  getCurrentSeason,
  getDynastyById,
  getDynasties,
  getSeasonsByDynasty,
  getSnapshot,
  resolveSeasonTeam,
} from '../../database/helpers';
import { formatSaveWeek, isBowlSlateSet } from '../../shared/syncPhase';
import type { LeagueData } from '../../extractors/extract-league';
import { formatBackfillSuffix, persistExtraction, syncDynasty } from '../../database/importExtraction';
import { checkDynastyMatch, relinkDynasty } from '../../database/relinkDynasty';
import { getSeasonOverview, getSeasonTheme } from '../../database/getSeasonOverview';
import { getTeamTheme } from '../../database/getTeamTheme';
import { getNcaaHub } from '../../database/getNcaaHub';
import { getHistory } from '../../database/getHistory';
import { getRoster } from '../../database/getRoster';
import { getPlayerStats } from '../../database/getPlayerStats';
import { getTeamStats } from '../../database/getTeamStats';
import { getTeamGameStats } from '../../database/getTeamGameStats';
import { getKickingStats } from '../../database/getKickingStats';
import { getGameLog, getPlayerGameLog } from '../../database/getGameLog';
import { getGameDetail } from '../../database/getGameDetail';
import { getTrophies } from '../../database/getTrophies';
import { getSchedule } from '../../database/getSchedule';
import { getStandings } from '../../database/getStandings';
import { getCoaches } from '../../database/getCoaches';
import { getAwards } from '../../database/getAwards';
import { getRankings } from '../../database/getRankings';
import { getRecruits } from '../../database/getRecruits';
import { getLeagueTeams, getLeagueTeamOverview, getLeagueTeamRoster, getAllLeaguePlayers, getLeagueTeamSchedule, getLeagueTeamHonors, getTeamCard } from '../../database/getLeagueRoster';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getPlayoffBracket } from '../../database/getPlayoffBracket';
import { getNationalTeamStats } from '../../database/getNationalTeamStats';
import { getNationalStatLeaders } from '../../database/getNationalStatLeaders';
import { getNationalRecruits, getRecruitById } from '../../database/getNationalRecruits';
import { getTeamHistory } from '../../database/getTeamHistory';
import { getNcaaRecords } from '../../database/getNcaaRecords';
import { getDynastyTrends } from '../../database/getDynastyTrends';
import { getSeasonAnalytics } from '../../database/getSeasonAnalytics';
import { getProgramArc } from '../../database/getProgramArc';
import { getTransfers } from '../../database/getTransfers';
import { getDepartures } from '../../database/getDepartures';
import { globalSearch } from '../../database/globalSearch';
import { getPlayerDevelopment } from '../../database/getPlayerDevelopment';
import { getPlayerStatHistory } from '../../database/getPlayerStatHistory';
import { getHeadToHead } from '../../database/getHeadToHead';
import { activeCoachId, addLegend, assignLegend, getCoachHall, getHallEligible, getLegendStatus, removeLegend } from '../../database/hallOfLegends';
import { getCoachingTree } from '../../database/getCoachingTree';
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
      // The in-game calendar point of the last synced save, from that season's
      // league snapshot (has currentWeek + the phase fields). Null for a
      // history-only season (no league snapshot).
      const league = currentSeason ? getSnapshot<LeagueData>(currentSeason.id, 'league') : null;
      // currentWeekType only exists in snapshots taken with the phase-aware
      // extractor (v1.0+); older seasons show no label until re-synced.
      const savePhaseLabel = league?.currentWeekType
        ? formatSaveWeek({
            currentWeekType: league.currentWeekType,
            currentOffseasonStage: league.currentOffseasonStage,
            currentWeek: league.currentWeek,
          })
        : null;

      return {
        id: dynasty.id,
        label: dynasty.label,
        teamName: dynasty.teamName ?? dynasty.label,
        seasonYear: currentSeason?.seasonYear ?? null,
        record,
        primaryColor: dynasty.teamColorPrimary,
        secondaryColor: dynasty.teamColorSecondary,
        coachName: userCoach ? `${userCoach.firstName} ${userCoach.lastName}`.trim() : null,
        coachPosition: userCoach?.position ?? null,
        coachPortraitAssetName: userCoach?.portraitAssetName ?? null,
        savePhaseLabel,
        savePath: dynasty.savePath,
      };
    });
  });

  /*
    Registered with the task registry so the updater knows this is running: an
    import reads a 10 MB save and writes ~25 tables, and restarting into an
    installer half-way through would abandon all of it. See updater/taskRegistry.
  */
  ipcMain.handle(IPC.db.importDynasty, async (event, savePath: string): Promise<ImportResult> =>
    withTask('import', async () => {
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
  }),
  );

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

  ipcMain.handle(IPC.db.syncDynasty, async (_event, dynastyId: string): Promise<ImportResult> =>
    withTask('sync', async () => syncDynasty(dynastyId)),
  );

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
    // The DB cascade only drops the rows — also remove the dynasty's on-disk file
    // stores (media library + custom card photos) so nothing is left orphaned on
    // the user's drive.
    await fs.rm(mediaDirFor(dynastyId), { recursive: true, force: true }).catch(() => {});
    await fs.rm(path.join(app.getPath('userData'), 'card-photos', dynastyId), { recursive: true, force: true }).catch(() => {});
  });

  ipcMain.handle(IPC.db.getSeasons, async (_event, dynastyId: string): Promise<SeasonSummary[]> => {
    return getSeasonsByDynasty(dynastyId).map((season) => ({
      id: season.id,
      seasonYear: season.seasonYear,
      isCurrent: season.isCurrent,
      hasFullData: season.hasFullData,
      teamName: resolveSeasonTeam(season)?.displayName ?? null,
      postseasonReached: isBowlSlateSet(season.syncedWeekType) || !season.isCurrent,
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
    IPC.db.getTeamGameStats,
    async (_event, dynastyId: string, teamIndex: number | null, seasonId?: number): Promise<TeamGameStat[] | null> => {
      return getTeamGameStats(dynastyId, teamIndex, seasonId) ?? null;
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
    IPC.db.getPlayerGameLog,
    async (
      _event,
      dynastyId: string,
      playerId: number,
      seasonId?: number,
    ): Promise<GameLogEntry[] | null> => {
      return getPlayerGameLog(dynastyId, playerId, seasonId) ?? null;
    },
  );

  ipcMain.handle(
    IPC.db.getGameDetail,
    async (_event, dynastyId: string, gameId: number, seasonId?: number): Promise<GameDetailData | null> => {
      return getGameDetail(dynastyId, gameId, seasonId) ?? null;
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

  ipcMain.handle(IPC.db.getPlayoffBracket, async (_event, dynastyId: string, seasonId?: number) => {
    return getPlayoffBracket(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueScores, async (_event, dynastyId: string, seasonId?: number) => {
    return getLeagueScores(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeams, async (_event, dynastyId: string, seasonId?: number) => {
    return getLeagueTeams(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getTeamCard, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getTeamCard(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNationalTeamStats, async (_event, dynastyId: string, seasonId?: number) => {
    return getNationalTeamStats(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNationalStatLeaders, async (_event, dynastyId: string, seasonId?: number) => {
    return getNationalStatLeaders(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamOverview, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamOverview(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamRoster, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamRoster(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getAllLeaguePlayers, async (_event, dynastyId: string, seasonId?: number) => {
    return getAllLeaguePlayers(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamSchedule, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamSchedule(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getLeagueTeamHonors, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getLeagueTeamHonors(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getTeamHistory, async (_event, dynastyId: string, teamIndex: number, seasonId?: number) => {
    return getTeamHistory(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getRecruitById, async (_event, dynastyId: string, playerId: number, seasonId?: number) => {
    return getRecruitById(dynastyId, playerId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNationalRecruits, async (_event, dynastyId: string, seasonId?: number) => {
    return getNationalRecruits(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getNcaaRecords, async (_event, dynastyId: string, seasonId?: number) => {
    return getNcaaRecords(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getSeasonAnalytics, async (_event, dynastyId: string, seasonId?: number) => {
    return getSeasonAnalytics(dynastyId, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.getProgramArc, async (_event, dynastyId: string) => {
    return getProgramArc(dynastyId) ?? null;
  });

  ipcMain.handle(IPC.db.getDynastyTrends, async (_event, dynastyId: string) => {
    return getDynastyTrends(dynastyId) ?? null;
  });

  ipcMain.handle(IPC.db.getDepartures, async (_event, dynastyId: string, teamIndex: number | null, seasonId?: number) => {
    return getDepartures(dynastyId, teamIndex, seasonId) ?? null;
  });

  ipcMain.handle(IPC.db.globalSearch, async (_event, dynastyId: string, query: string, seasonId?: number) => {
    return globalSearch(dynastyId, query, seasonId);
  });

  ipcMain.handle(IPC.db.getPlayerDevelopment, async (_event, dynastyId: string, playerId: number) => {
    return getPlayerDevelopment(dynastyId, playerId);
  });

  ipcMain.handle(IPC.db.getPlayerStatHistory, async (_event, dynastyId: string, playerId: number) => {
    return getPlayerStatHistory(dynastyId, playerId);
  });

  /*
    The Hall's four calls. Every one resolves the coach itself rather than
    taking a coachId from the renderer: the active coach is a property of the
    dynasty's own seasons (`user_coach_id`), so letting a caller pass one in
    would be inventing a way to write into somebody else's Hall.
  */
  ipcMain.handle(IPC.db.getCoachHall, async (_event, dynastyId: string) => {
    return getCoachHall(dynastyId);
  });

  ipcMain.handle(IPC.db.getHallEligible, async (_event, dynastyId: string) => {
    return getHallEligible(dynastyId);
  });

  ipcMain.handle(IPC.db.getLegendStatus, async (_event, dynastyId: string, playerId: number) => {
    return getLegendStatus(dynastyId, playerId);
  });

  ipcMain.handle(IPC.db.addLegend, async (_event, dynastyId: string, playerId: number) => {
    const coachId = activeCoachId(dynastyId);
    return coachId === null ? false : addLegend(dynastyId, coachId, playerId);
  });

  ipcMain.handle(IPC.db.removeLegend, async (_event, dynastyId: string, playerId: number) => {
    const coachId = activeCoachId(dynastyId);
    if (coachId !== null) removeLegend(dynastyId, coachId, playerId);
  });

  ipcMain.handle(
    IPC.db.assignLegend,
    async (_event, dynastyId: string, playerId: number, tier: 'first' | 'second' | null, slotId: string | null) => {
      const coachId = activeCoachId(dynastyId);
      if (coachId === null) return { ok: false, message: 'No coach identity recorded for this dynasty yet.' };
      return assignLegend(dynastyId, coachId, playerId, tier, slotId);
    },
  );

  ipcMain.handle(IPC.db.getHeadToHead, async (_event, dynastyId: string) => {
    return getHeadToHead(dynastyId);
  });

  ipcMain.handle(IPC.db.getCoachingTree, async (_event, dynastyId: string) => {
    return getCoachingTree(dynastyId);
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
    IPC.db.getTeamTheme,
    async (_event, dynastyId: string, teamName: string, seasonId?: number): Promise<TeamTheme | null> => {
      return getTeamTheme(dynastyId, teamName, seasonId);
    },
  );

  ipcMain.handle(
    IPC.db.getSeasonTheme,
    async (_event, dynastyId: string, seasonId?: number): Promise<DynastyTheme | null> => {
      return getSeasonTheme(dynastyId, seasonId);
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
