import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { DynastyApi, ExtractionProgressEvent } from '../shared/types';

const api: DynastyApi = {
  fs: {
    selectFile: () => ipcRenderer.invoke(IPC.fs.selectFile),
    getDefaultSavesDir: () => ipcRenderer.invoke(IPC.fs.getDefaultSavesDir),
    scanForSaves: (dirPath) => ipcRenderer.invoke(IPC.fs.scanForSaves, dirPath),
    peekSave: (filePath) => ipcRenderer.invoke(IPC.fs.peekSave, filePath),
    chooseSavesFolder: () => ipcRenderer.invoke(IPC.fs.chooseSavesFolder),
  },
  assets: {
    getStatus: () => ipcRenderer.invoke(IPC.assets.getStatus),
    chooseFolder: () => ipcRenderer.invoke(IPC.assets.chooseFolder),
    clearPath: () => ipcRenderer.invoke(IPC.assets.clearPath),
  },
  db: {
    getDynasties: () => ipcRenderer.invoke(IPC.db.getDynasties),
    importDynasty: (savePath) => ipcRenderer.invoke(IPC.db.importDynasty, savePath),
    checkDynastyMatch: (savePath) => ipcRenderer.invoke(IPC.db.checkDynastyMatch, savePath),
    relinkDynasty: (dynastyId, savePath) => ipcRenderer.invoke(IPC.db.relinkDynasty, dynastyId, savePath),
    syncDynasty: (dynastyId) => ipcRenderer.invoke(IPC.db.syncDynasty, dynastyId),
    getSeasonOverview: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getSeasonOverview, dynastyId, seasonId),
    getNcaaHub: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getNcaaHub, dynastyId, seasonId),
    getHistory: (dynastyId) => ipcRenderer.invoke(IPC.db.getHistory, dynastyId),
    deleteDynasty: (dynastyId) => ipcRenderer.invoke(IPC.db.deleteDynasty, dynastyId),
    getSeasons: (dynastyId) => ipcRenderer.invoke(IPC.db.getSeasons, dynastyId),
    getRoster: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getRoster, dynastyId, seasonId),
    getPlayerStats: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getPlayerStats, dynastyId, seasonId),
    getTeamStats: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamStats, dynastyId, seasonId),
    getTeamGameStats: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamGameStats, dynastyId, teamIndex, seasonId),
    getTeamCard: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamCard, dynastyId, teamIndex, seasonId),
    getNationalTeamStats: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getNationalTeamStats, dynastyId, seasonId),
    getNationalStatLeaders: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getNationalStatLeaders, dynastyId, seasonId),
    getKickingStats: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getKickingStats, dynastyId, seasonId),
    getGameLog: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getGameLog, dynastyId, seasonId),
    getGameDetail: (dynastyId, gameId, seasonId) => ipcRenderer.invoke(IPC.db.getGameDetail, dynastyId, gameId, seasonId),
    getTeamTrophies: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamTrophies, dynastyId, seasonId),
    getSchedule: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getSchedule, dynastyId, seasonId),
    getStandings: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getStandings, dynastyId, seasonId),
    getCoaches: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getCoaches, dynastyId, seasonId),
    getAwards: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getAwards, dynastyId, seasonId),
    getRankings: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getRankings, dynastyId, seasonId),
    getRecruits: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getRecruits, dynastyId, seasonId),
    getLeagueTeams: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getLeagueTeams, dynastyId, seasonId),
    getLeagueScores: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getLeagueScores, dynastyId, seasonId),
    getLeagueTeamOverview: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeamOverview, dynastyId, teamIndex, seasonId),
    getLeagueTeamRoster: (dynastyId, teamIndex, seasonId) => ipcRenderer.invoke(IPC.db.getLeagueTeamRoster, dynastyId, teamIndex, seasonId),
    getAllLeaguePlayers: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getAllLeaguePlayers, dynastyId, seasonId),
    getLeagueTeamSchedule: (dynastyId, teamIndex, seasonId) => ipcRenderer.invoke(IPC.db.getLeagueTeamSchedule, dynastyId, teamIndex, seasonId),
    getLeagueTeamHonors: (dynastyId, teamIndex, seasonId) => ipcRenderer.invoke(IPC.db.getLeagueTeamHonors, dynastyId, teamIndex, seasonId),
    getNationalRecruits: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getNationalRecruits, dynastyId, seasonId),
    getNcaaRecords: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getNcaaRecords, dynastyId, seasonId),
    getDynastyTrends: (dynastyId) => ipcRenderer.invoke(IPC.db.getDynastyTrends, dynastyId),
    getTransfers: (dynastyId, focusTeamName) => ipcRenderer.invoke(IPC.db.getTransfers, dynastyId, focusTeamName),
    getDepartures: (dynastyId, teamIndex, seasonId) => ipcRenderer.invoke(IPC.db.getDepartures, dynastyId, teamIndex, seasonId),
    globalSearch: (dynastyId, query, seasonId) => ipcRenderer.invoke(IPC.db.globalSearch, dynastyId, query, seasonId),
    getPlayerDevelopment: (dynastyId, playerId) => ipcRenderer.invoke(IPC.db.getPlayerDevelopment, dynastyId, playerId),
    getHeadToHead: (dynastyId) => ipcRenderer.invoke(IPC.db.getHeadToHead, dynastyId),
    getCoachingTree: (dynastyId) => ipcRenderer.invoke(IPC.db.getCoachingTree, dynastyId),
    getDynastyTheme: (dynastyId) => ipcRenderer.invoke(IPC.db.getDynastyTheme, dynastyId),
    getTeamTheme: (dynastyId, teamName, seasonId) => ipcRenderer.invoke(IPC.db.getTeamTheme, dynastyId, teamName, seasonId),
    getSeasonTheme: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getSeasonTheme, dynastyId, seasonId),
    getTeamAwardDefinitions: () => ipcRenderer.invoke(IPC.db.getTeamAwardDefinitions),
    getTeamAwardResults: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamAwardResults, dynastyId, seasonId),
    calculateTeamAward: (dynastyId, seasonId, awardDefinitionId) =>
      ipcRenderer.invoke(IPC.db.calculateTeamAward, dynastyId, seasonId, awardDefinitionId),
    confirmTeamAwardWinner: (dynastyId, seasonId, awardDefinitionId, winnerId) =>
      ipcRenderer.invoke(IPC.db.confirmTeamAwardWinner, dynastyId, seasonId, awardDefinitionId, winnerId),
    selectManualAwardWinner: (dynastyId, seasonId, awardDefinitionId, winnerId) =>
      ipcRenderer.invoke(IPC.db.selectManualAwardWinner, dynastyId, seasonId, awardDefinitionId, winnerId),
    finalizeTeamAwards: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.finalizeTeamAwards, dynastyId, seasonId),
    unlockTeamAwards: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.unlockTeamAwards, dynastyId, seasonId),
    getTeamAwardSettings: (dynastyId) => ipcRenderer.invoke(IPC.db.getTeamAwardSettings, dynastyId),
    saveTeamAwardSettings: (dynastyId, settings) =>
      ipcRenderer.invoke(IPC.db.saveTeamAwardSettings, dynastyId, settings),
    getTeamAwardHistory: (dynastyId) => ipcRenderer.invoke(IPC.db.getTeamAwardHistory, dynastyId),
  },
  extraction: {
    extractAll: (savePath) => ipcRenderer.invoke(IPC.extraction.extractAll, savePath),
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ExtractionProgressEvent) =>
        callback(payload);
      ipcRenderer.on(IPC.extraction.progress, listener);
      return () => ipcRenderer.removeListener(IPC.extraction.progress, listener);
    },
  },
  export: {
    historyToHtml: (dynastyId) => ipcRenderer.invoke(IPC.export.historyToHtml, dynastyId),
    seasonYearbookToHtml: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.export.seasonYearbookToHtml, dynastyId, seasonId),
    playerCardToPng: (fileName, rect) => ipcRenderer.invoke(IPC.export.playerCardToPng, fileName, rect),
  },
  editor: {
    backupSaveFile: (dynastyId) => ipcRenderer.invoke(IPC.editor.backupSaveFile, dynastyId),
    getScandals: (dynastyId) => ipcRenderer.invoke(IPC.editor.getScandals, dynastyId),
    saveScandals: (dynastyId, edit) => ipcRenderer.invoke(IPC.editor.saveScandals, dynastyId, edit),
    estimateDynastyBackup: (dynastyId) => ipcRenderer.invoke(IPC.editor.estimateDynastyBackup, dynastyId),
    createDynastyBackup: (dynastyId, contents) =>
      ipcRenderer.invoke(IPC.editor.createDynastyBackup, dynastyId, contents),
    chooseBackupToRestore: () => ipcRenderer.invoke(IPC.editor.chooseBackupToRestore),
    restoreDynastyBackup: (filePath) => ipcRenderer.invoke(IPC.editor.restoreDynastyBackup, filePath),
    onBackupProgress: (callback) => {
      const listener = (_event: unknown, progress: { percent: number; step: string }) => callback(progress);
      ipcRenderer.on(IPC.editor.backupProgress, listener);
      return () => ipcRenderer.removeListener(IPC.editor.backupProgress, listener);
    },
    getPlayer: (dynastyId, playerId) => ipcRenderer.invoke(IPC.editor.getPlayer, dynastyId, playerId),
    savePlayer: (dynastyId, playerId, fields) =>
      ipcRenderer.invoke(IPC.editor.savePlayer, dynastyId, playerId, fields),
    getCoach: (dynastyId, teamIndex, position) =>
      ipcRenderer.invoke(IPC.editor.getCoach, dynastyId, teamIndex, position),
    saveCoach: (dynastyId, teamIndex, position, fields) =>
      ipcRenderer.invoke(IPC.editor.saveCoach, dynastyId, teamIndex, position, fields),
    getRecruit: (dynastyId, playerId) => ipcRenderer.invoke(IPC.editor.getRecruit, dynastyId, playerId),
    saveRecruit: (dynastyId, playerId, fields) =>
      ipcRenderer.invoke(IPC.editor.saveRecruit, dynastyId, playerId, fields),
    saveRecruitInfluence: (dynastyId, playerId, edit) =>
      ipcRenderer.invoke(IPC.editor.saveRecruitInfluence, dynastyId, playerId, edit),
    getTeamBudget: (dynastyId, teamIndex) => ipcRenderer.invoke(IPC.editor.getTeamBudget, dynastyId, teamIndex),
    saveTeamBudget: (dynastyId, teamIndex, edit) =>
      ipcRenderer.invoke(IPC.editor.saveTeamBudget, dynastyId, teamIndex, edit),
    forceCommitRecruit: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.editor.forceCommitRecruit, dynastyId, playerId),
    searchPortraits: (kind, query, filters, page) =>
      ipcRenderer.invoke(IPC.editor.searchPortraits, kind, query, filters, page),
  },
  card: {
    pickPhoto: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.pickPhoto, dynastyId, playerId),
    setPhotoFromPath: (dynastyId, playerId, sourcePath) =>
      ipcRenderer.invoke(IPC.card.setPhotoFromPath, dynastyId, playerId, sourcePath),
    getPhoto: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.getPhoto, dynastyId, playerId),
    removePhoto: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.removePhoto, dynastyId, playerId),
  },
  media: {
    pickFiles: () => ipcRenderer.invoke(IPC.media.pickFiles),
    addFiles: (dynastyId, seasonId, filePaths) => ipcRenderer.invoke(IPC.media.addFiles, dynastyId, seasonId, filePaths),
    list: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.media.list, dynastyId, seasonId),
    listForPlayer: (dynastyId, playerId) => ipcRenderer.invoke(IPC.media.listForPlayer, dynastyId, playerId),
    listForGame: (dynastyId, seasonId, gameId) => ipcRenderer.invoke(IPC.media.listForGame, dynastyId, seasonId, gameId),
    update: (id, patch) => ipcRenderer.invoke(IPC.media.update, id, patch),
    reorder: (dynastyId, seasonId, orderedIds) => ipcRenderer.invoke(IPC.media.reorder, dynastyId, seasonId, orderedIds),
    remove: (id) => ipcRenderer.invoke(IPC.media.remove, id),
    getStorageUsage: () => ipcRenderer.invoke(IPC.media.getStorageUsage),
    cleanUpBackups: () => ipcRenderer.invoke(IPC.media.cleanUpBackups),
    clearDeletedDynastyCache: () => ipcRenderer.invoke(IPC.media.clearDeletedDynastyCache),
    getLibraryStatus: () => ipcRenderer.invoke(IPC.media.getLibraryStatus),
    chooseLibraryFolder: () => ipcRenderer.invoke(IPC.media.chooseLibraryFolder),
    resetLibraryFolder: () => ipcRenderer.invoke(IPC.media.resetLibraryFolder),
    openLibraryFolder: () => ipcRenderer.invoke(IPC.media.openLibraryFolder),
  },
  notes: {
    list: (dynastyId, playerId) => ipcRenderer.invoke(IPC.notes.list, dynastyId, playerId),
    create: (dynastyId, playerId, title, body) => ipcRenderer.invoke(IPC.notes.create, dynastyId, playerId, title, body),
    update: (id, title, body) => ipcRenderer.invoke(IPC.notes.update, id, title, body),
    remove: (id) => ipcRenderer.invoke(IPC.notes.remove, id),
    titleSuggestions: (dynastyId) => ipcRenderer.invoke(IPC.notes.titleSuggestions, dynastyId),
  },
  update: {
    check: () => ipcRenderer.invoke(IPC.update.check),
    openDownload: (url) => ipcRenderer.invoke(IPC.update.openDownload, url),
  },
};

contextBridge.exposeInMainWorld('api', api);
