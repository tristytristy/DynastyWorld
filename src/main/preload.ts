import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC } from '../shared/ipcChannels';
import type { DynastyApi, ExtractionProgressEvent } from '../shared/types';
import type { UpdateState } from '../shared/updateTypes';

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
  },
  db: {
    getDynasties: () => ipcRenderer.invoke(IPC.db.getDynasties),
    importDynasty: (savePath) => ipcRenderer.invoke(IPC.db.importDynasty, savePath),
    checkDynastyMatch: (savePath) => ipcRenderer.invoke(IPC.db.checkDynastyMatch, savePath),
    relinkDynasty: (dynastyId, savePath) =>
      ipcRenderer.invoke(IPC.db.relinkDynasty, dynastyId, savePath),
    syncDynasty: (dynastyId) => ipcRenderer.invoke(IPC.db.syncDynasty, dynastyId),
    getSeasonOverview: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getSeasonOverview, dynastyId, seasonId),
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
    getPlayerGameLog: (dynastyId, playerId, seasonId, anchorSeasonId) =>
      ipcRenderer.invoke(IPC.db.getPlayerGameLog, dynastyId, playerId, seasonId, anchorSeasonId),
    getGameDetail: (dynastyId, gameId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getGameDetail, dynastyId, gameId, seasonId),
    getTeamTrophies: (dynastyId, seasonId, teamIndex) =>
      ipcRenderer.invoke(IPC.db.getTeamTrophies, dynastyId, seasonId, teamIndex),
    getSchedule: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getSchedule, dynastyId, seasonId),
    getStandings: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getStandings, dynastyId, seasonId),
    getCoaches: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getCoaches, dynastyId, seasonId),
    getAwards: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.db.getAwards, dynastyId, seasonId),
    getRankings: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getRankings, dynastyId, seasonId),
    getRecruits: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getRecruits, dynastyId, seasonId),
    getLeagueTeams: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeams, dynastyId, seasonId),
    getLeagueScores: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueScores, dynastyId, seasonId),
    getPlayoffBracket: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getPlayoffBracket, dynastyId, seasonId),
    getLeagueTeamOverview: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeamOverview, dynastyId, teamIndex, seasonId),
    getLeagueTeamRoster: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeamRoster, dynastyId, teamIndex, seasonId),
    getAllLeaguePlayers: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getAllLeaguePlayers, dynastyId, seasonId),
    getLeagueTeamSchedule: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeamSchedule, dynastyId, teamIndex, seasonId),
    getLeagueTeamHonors: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getLeagueTeamHonors, dynastyId, teamIndex, seasonId),
    getNationalRecruits: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getNationalRecruits, dynastyId, seasonId),
    getRecruitById: (dynastyId, playerId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getRecruitById, dynastyId, playerId, seasonId),
    getTeamHistory: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamHistory, dynastyId, teamIndex, seasonId),
    getNcaaRecords: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getNcaaRecords, dynastyId, seasonId),
    getDynastyTrends: (dynastyId) => ipcRenderer.invoke(IPC.db.getDynastyTrends, dynastyId),
    getSeasonAnalytics: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getSeasonAnalytics, dynastyId, seasonId),
    getProgramArc: (dynastyId) => ipcRenderer.invoke(IPC.db.getProgramArc, dynastyId),
    getTransfers: (dynastyId, focusTeamName) =>
      ipcRenderer.invoke(IPC.db.getTransfers, dynastyId, focusTeamName),
    getDepartures: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getDepartures, dynastyId, teamIndex, seasonId),
    globalSearch: (dynastyId, query, seasonId) =>
      ipcRenderer.invoke(IPC.db.globalSearch, dynastyId, query, seasonId),
    getPlayerDevelopment: (dynastyId, playerId, anchorSeasonId) =>
      ipcRenderer.invoke(IPC.db.getPlayerDevelopment, dynastyId, playerId, anchorSeasonId),
    getPlayerStatHistory: (dynastyId, playerId, anchorSeasonId) =>
      ipcRenderer.invoke(IPC.db.getPlayerStatHistory, dynastyId, playerId, anchorSeasonId),
    getCoachHall: (dynastyId) => ipcRenderer.invoke(IPC.db.getCoachHall, dynastyId),
    getCoachStatistics: (dynastyId) => ipcRenderer.invoke(IPC.db.getCoachStatistics, dynastyId),
    getCoachLeaderboards: (dynastyId) => ipcRenderer.invoke(IPC.db.getCoachLeaderboards, dynastyId),
    getHallEligible: (dynastyId) => ipcRenderer.invoke(IPC.db.getHallEligible, dynastyId),
    getLegendStatus: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.db.getLegendStatus, dynastyId, playerId),
    addLegend: (dynastyId, playerId) => ipcRenderer.invoke(IPC.db.addLegend, dynastyId, playerId),
    removeLegend: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.db.removeLegend, dynastyId, playerId),
    assignLegend: (dynastyId, playerId, tier, slotId) =>
      ipcRenderer.invoke(IPC.db.assignLegend, dynastyId, playerId, tier, slotId),
    getHeadToHead: (dynastyId) => ipcRenderer.invoke(IPC.db.getHeadToHead, dynastyId),
    getCoachingTree: (dynastyId) => ipcRenderer.invoke(IPC.db.getCoachingTree, dynastyId),
    getDynastyTheme: (dynastyId) => ipcRenderer.invoke(IPC.db.getDynastyTheme, dynastyId),
    getTeamTheme: (dynastyId, teamName, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamTheme, dynastyId, teamName, seasonId),
    getSaveRivals: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.db.getSaveRivals, dynastyId, teamIndex, seasonId),
    getSeasonTheme: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getSeasonTheme, dynastyId, seasonId),
    getTeamAwardDefinitions: () => ipcRenderer.invoke(IPC.db.getTeamAwardDefinitions),
    getTeamAwardResults: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.getTeamAwardResults, dynastyId, seasonId),
    calculateTeamAward: (dynastyId, seasonId, awardDefinitionId) =>
      ipcRenderer.invoke(IPC.db.calculateTeamAward, dynastyId, seasonId, awardDefinitionId),
    confirmTeamAwardWinner: (dynastyId, seasonId, awardDefinitionId, winnerId) =>
      ipcRenderer.invoke(
        IPC.db.confirmTeamAwardWinner,
        dynastyId,
        seasonId,
        awardDefinitionId,
        winnerId,
      ),
    selectManualAwardWinner: (dynastyId, seasonId, awardDefinitionId, winnerId) =>
      ipcRenderer.invoke(
        IPC.db.selectManualAwardWinner,
        dynastyId,
        seasonId,
        awardDefinitionId,
        winnerId,
      ),
    finalizeTeamAwards: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.finalizeTeamAwards, dynastyId, seasonId),
    unlockTeamAwards: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.db.unlockTeamAwards, dynastyId, seasonId),
    getTeamAwardSettings: (dynastyId) => ipcRenderer.invoke(IPC.db.getTeamAwardSettings, dynastyId),
    saveTeamAwardSettings: (dynastyId, settings) =>
      ipcRenderer.invoke(IPC.db.saveTeamAwardSettings, dynastyId, settings),
    getTeamAwardHistory: (dynastyId) => ipcRenderer.invoke(IPC.db.getTeamAwardHistory, dynastyId),
  },
  extraction: {
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ExtractionProgressEvent) =>
        callback(payload);
      ipcRenderer.on(IPC.extraction.progress, listener);
      return () => ipcRenderer.removeListener(IPC.extraction.progress, listener);
    },
  },
  export: {
    historyToHtml: (dynastyId) => ipcRenderer.invoke(IPC.export.historyToHtml, dynastyId),
    seasonYearbookToHtml: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.export.seasonYearbookToHtml, dynastyId, seasonId),
    playerCardToPng: (fileName, rect) =>
      ipcRenderer.invoke(IPC.export.playerCardToPng, fileName, rect),
    mediaPlateToPng: (fileName, rect) =>
      ipcRenderer.invoke(IPC.export.mediaPlateToPng, fileName, rect),
    pickCardFolder: () => ipcRenderer.invoke(IPC.export.pickCardFolder),
    playerCardToFolder: (folderPath, fileName, rect) =>
      ipcRenderer.invoke(IPC.export.playerCardToFolder, folderPath, fileName, rect),
    rosterToFile: (dynastyId, teamIndex, seasonId) =>
      ipcRenderer.invoke(IPC.export.rosterToFile, dynastyId, teamIndex, seasonId),
  },
  editor: {
    getScandals: (dynastyId) => ipcRenderer.invoke(IPC.editor.getScandals, dynastyId),
    saveScandals: (dynastyId, edit) => ipcRenderer.invoke(IPC.editor.saveScandals, dynastyId, edit),
    estimateDynastyBackup: (dynastyId) =>
      ipcRenderer.invoke(IPC.editor.estimateDynastyBackup, dynastyId),
    createDynastyBackup: (dynastyId, contents) =>
      ipcRenderer.invoke(IPC.editor.createDynastyBackup, dynastyId, contents),
    chooseBackupToRestore: () => ipcRenderer.invoke(IPC.editor.chooseBackupToRestore),
    restoreDynastyBackup: (filePath, options) =>
      ipcRenderer.invoke(IPC.editor.restoreDynastyBackup, filePath, options),
    onBackupProgress: (callback) => {
      const listener = (_event: unknown, progress: { percent: number; step: string }) =>
        callback(progress);
      ipcRenderer.on(IPC.editor.backupProgress, listener);
      return () => ipcRenderer.removeListener(IPC.editor.backupProgress, listener);
    },
    getPlayer: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.editor.getPlayer, dynastyId, playerId),
    savePlayer: (dynastyId, playerId, fields) =>
      ipcRenderer.invoke(IPC.editor.savePlayer, dynastyId, playerId, fields),
    getCoach: (dynastyId, teamIndex, position) =>
      ipcRenderer.invoke(IPC.editor.getCoach, dynastyId, teamIndex, position),
    saveCoach: (dynastyId, teamIndex, position, fields) =>
      ipcRenderer.invoke(IPC.editor.saveCoach, dynastyId, teamIndex, position, fields),
    getRecruit: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.editor.getRecruit, dynastyId, playerId),
    saveRecruit: (dynastyId, playerId, fields) =>
      ipcRenderer.invoke(IPC.editor.saveRecruit, dynastyId, playerId, fields),
    saveRecruitInfluence: (dynastyId, playerId, edit) =>
      ipcRenderer.invoke(IPC.editor.saveRecruitInfluence, dynastyId, playerId, edit),
    getTeamBudget: (dynastyId, teamIndex) =>
      ipcRenderer.invoke(IPC.editor.getTeamBudget, dynastyId, teamIndex),
    saveTeamBudget: (dynastyId, teamIndex, edit) =>
      ipcRenderer.invoke(IPC.editor.saveTeamBudget, dynastyId, teamIndex, edit),
    forceCommitRecruit: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.editor.forceCommitRecruit, dynastyId, playerId),
    searchPortraits: (kind, query, filters, page) =>
      ipcRenderer.invoke(IPC.editor.searchPortraits, kind, query, filters, page),
  },
  card: {
    pickPhoto: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.pickPhoto, dynastyId, playerId),
    getPhoto: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.getPhoto, dynastyId, playerId),
    removePhoto: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.card.removePhoto, dynastyId, playerId),
    pickPhotoForCard: (dynastyId, playerId, cardId) =>
      ipcRenderer.invoke(IPC.card.pickPhotoForCard, dynastyId, playerId, cardId),
    setCardPhotoFromPath: (dynastyId, playerId, cardId, sourcePath) =>
      ipcRenderer.invoke(IPC.card.setCardPhotoFromPath, dynastyId, playerId, cardId, sourcePath),
    removeCardPhoto: (dynastyId, photoFile) =>
      ipcRenderer.invoke(IPC.card.removeCardPhoto, dynastyId, photoFile),
    list: (dynastyId, playerId) => ipcRenderer.invoke(IPC.card.list, dynastyId, playerId),
    listFavorites: (dynastyId) => ipcRenderer.invoke(IPC.card.listFavorites, dynastyId),
    listCardedPlayerIds: (dynastyId) => ipcRenderer.invoke(IPC.card.listCardedPlayerIds, dynastyId),
    create: (dynastyId, playerId, input) =>
      ipcRenderer.invoke(IPC.card.create, dynastyId, playerId, input),
    update: (dynastyId, id, input) => ipcRenderer.invoke(IPC.card.update, dynastyId, id, input),
    setFavorite: (dynastyId, id, favorite) =>
      ipcRenderer.invoke(IPC.card.setFavorite, dynastyId, id, favorite),
    setDefault: (dynastyId, playerId, id) =>
      ipcRenderer.invoke(IPC.card.setDefault, dynastyId, playerId, id),
    remove: (dynastyId, id) => ipcRenderer.invoke(IPC.card.remove, dynastyId, id),
  },
  program: {
    list: (dynastyId) => ipcRenderer.invoke(IPC.program.list, dynastyId),
    setIdentity: (dynastyId, teamIndex, teamNameKey, identity) =>
      ipcRenderer.invoke(IPC.program.setIdentity, dynastyId, teamIndex, teamNameKey, identity),
    pickArt: (dynastyId, teamIndex, teamNameKey, slot) =>
      ipcRenderer.invoke(IPC.program.pickArt, dynastyId, teamIndex, teamNameKey, slot),
    clearArt: (dynastyId, teamIndex, teamNameKey, slot) =>
      ipcRenderer.invoke(IPC.program.clearArt, dynastyId, teamIndex, teamNameKey, slot),
  },
  rivals: {
    list: (dynastyId) => ipcRenderer.invoke(IPC.rivals.list, dynastyId),
    save: (dynastyId, input) => ipcRenderer.invoke(IPC.rivals.save, dynastyId, input),
    remove: (dynastyId, pairKey) => ipcRenderer.invoke(IPC.rivals.remove, dynastyId, pairKey),
    pickLogo: (dynastyId, pairKey) => ipcRenderer.invoke(IPC.rivals.pickLogo, dynastyId, pairKey),
    clearLogo: (dynastyId, pairKey) => ipcRenderer.invoke(IPC.rivals.clearLogo, dynastyId, pairKey),
  },
  media: {
    /*
      THE ON-DISK PATH OF A DRAGGED FILE.

      `File.path` is an Electron extension to the web File object that is
      DEPRECATED and removed in Electron 32 — so a drag-and-drop import written
      against it works today and silently imports nothing after the next major
      upgrade. `webUtils.getPathForFile` is the supported replacement, and it
      has to be called HERE: it needs the real File object, which only exists on
      this side of the bridge.
    */
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return (file as File & { path?: string }).path ?? '';
      }
    },
    pickFiles: () => ipcRenderer.invoke(IPC.media.pickFiles),
    addFiles: (dynastyId, seasonId, filePaths) =>
      ipcRenderer.invoke(IPC.media.addFiles, dynastyId, seasonId, filePaths),
    list: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.media.list, dynastyId, seasonId),
    listForPlayer: (dynastyId, playerId) =>
      ipcRenderer.invoke(IPC.media.listForPlayer, dynastyId, playerId),
    listForGame: (dynastyId, seasonId, gameId) =>
      ipcRenderer.invoke(IPC.media.listForGame, dynastyId, seasonId, gameId),
    listAlbums: (dynastyId, seasonId) => ipcRenderer.invoke(IPC.media.listAlbums, dynastyId, seasonId),
    renameAlbum: (dynastyId, seasonId, gameId, name) =>
      ipcRenderer.invoke(IPC.media.renameAlbum, dynastyId, seasonId, gameId, name),
    setAlbumCover: (dynastyId, seasonId, gameId, mediaId) =>
      ipcRenderer.invoke(IPC.media.setAlbumCover, dynastyId, seasonId, gameId, mediaId),
    listCustomAlbums: (dynastyId, seasonId) =>
      ipcRenderer.invoke(IPC.media.listCustomAlbums, dynastyId, seasonId),
    createCustomAlbum: (dynastyId, seasonId, name) =>
      ipcRenderer.invoke(IPC.media.createCustomAlbum, dynastyId, seasonId, name),
    renameCustomAlbum: (dynastyId, seasonId, albumId, name) =>
      ipcRenderer.invoke(IPC.media.renameCustomAlbum, dynastyId, seasonId, albumId, name),
    removeCustomAlbum: (dynastyId, seasonId, albumId) =>
      ipcRenderer.invoke(IPC.media.removeCustomAlbum, dynastyId, seasonId, albumId),
    setCustomAlbumCover: (dynastyId, seasonId, albumId, mediaId) =>
      ipcRenderer.invoke(IPC.media.setCustomAlbumCover, dynastyId, seasonId, albumId, mediaId),
    update: (id, patch) => ipcRenderer.invoke(IPC.media.update, id, patch),
    setFraming: (id, framing) => ipcRenderer.invoke(IPC.media.setFraming, id, framing),
    setLook: (id, look) => ipcRenderer.invoke(IPC.media.setLook, id, look),
    reorder: (dynastyId, seasonId, orderedIds) =>
      ipcRenderer.invoke(IPC.media.reorder, dynastyId, seasonId, orderedIds),
    remove: (id) => ipcRenderer.invoke(IPC.media.remove, id),
    getStorageUsage: () => ipcRenderer.invoke(IPC.media.getStorageUsage),
    cleanUpBackups: () => ipcRenderer.invoke(IPC.media.cleanUpBackups),
    clearDeletedDynastyCache: () => ipcRenderer.invoke(IPC.media.clearDeletedDynastyCache),
    getLibraryStatus: () => ipcRenderer.invoke(IPC.media.getLibraryStatus),
    chooseLibraryFolder: () => ipcRenderer.invoke(IPC.media.chooseLibraryFolder),
    resetLibraryFolder: () => ipcRenderer.invoke(IPC.media.resetLibraryFolder),
    openLibraryFolder: () => ipcRenderer.invoke(IPC.media.openLibraryFolder),
  },
  manualSeasons: {
    list: (dynastyId) => ipcRenderer.invoke(IPC.manualSeasons.list, dynastyId),
    save: (dynastyId, seasons) => ipcRenderer.invoke(IPC.manualSeasons.save, dynastyId, seasons),
    gap: (dynastyId) => ipcRenderer.invoke(IPC.manualSeasons.gap, dynastyId),
    markPromptSeen: (dynastyId) => ipcRenderer.invoke(IPC.manualSeasons.markPromptSeen, dynastyId),
  },
  notes: {
    list: (dynastyId, playerId) => ipcRenderer.invoke(IPC.notes.list, dynastyId, playerId),
    create: (dynastyId, playerId, title, body) =>
      ipcRenderer.invoke(IPC.notes.create, dynastyId, playerId, title, body),
    update: (id, title, body) => ipcRenderer.invoke(IPC.notes.update, id, title, body),
    remove: (id) => ipcRenderer.invoke(IPC.notes.remove, id),
    titleSuggestions: (dynastyId) => ipcRenderer.invoke(IPC.notes.titleSuggestions, dynastyId),
  },
  update: {
    check: () => ipcRenderer.invoke(IPC.update.check),
    download: () => ipcRenderer.invoke(IPC.update.download),
    install: () => ipcRenderer.invoke(IPC.update.install),
    backupNow: () => ipcRenderer.invoke(IPC.update.backupNow),
    getState: () => ipcRenderer.invoke(IPC.update.getState),
    openLink: (url) => ipcRenderer.invoke(IPC.update.openLink, url),
    getPrefs: () => ipcRenderer.invoke(IPC.update.getPrefs),
    setPrefs: (next) => ipcRenderer.invoke(IPC.update.setPrefs, next),
    /*
      One subscription, and it hands back its own unsubscribe — the same shape
      the extraction-progress bridge uses. Returning the cleanup rather than
      exposing `removeListener` is what stops a re-rendering React component
      from stacking duplicate listeners on every mount.
    */
    onStateChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: UpdateState) => callback(payload);
      ipcRenderer.on(IPC.update.state, listener);
      return () => ipcRenderer.removeListener(IPC.update.state, listener);
    },
  },
  window: {
    setTitleBarTheme: (appearance) => ipcRenderer.invoke(IPC.window.setTitleBarTheme, appearance),
  },
};

contextBridge.exposeInMainWorld('api', api);
