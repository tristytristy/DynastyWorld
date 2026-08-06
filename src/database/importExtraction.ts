import { isGamePlayed } from '../shared/gameStatus';
import { extractAll } from '../extractors/extract-all';
import type { ExtractionData } from '../extractors/extract-all';
import {
  createDynasty,
  createSeason,
  getDynastyById,
  getDynastyBySavePath,
  getSeasonByYear,
  recordRankingSnapshot,
  getSnapshot,
  saveSnapshot,
  saveSnapshotCompressed,
  updateDynasty,
  updateSeasonPhase,
  upgradeSeasonToFull,
  type Dynasty,
  type Season,
} from './helpers';
import { withBatchedPersist } from './init';
import { autoRecalculateTeamAwards } from './getTeamAwards';
import { captureGameContext } from './gameContext';
import { deriveSyncPhase, isScheduleFinal, isSeasonFinalizing, isSeasonLocked } from '../shared/syncPhase';
import {
  holdGameResult,
  holdLeagueGameResult,
  isResultHeld,
  resolveHeldWeek,
} from '../shared/resultsHold';
import type { ImportResult, ResultsHold } from '../shared/types';

/**
 * The save's own week counter (SeasonInfo.CurrentWeek) reads 0 once the
 * season reaches OffSeason/PreSeason stages — confirmed directly against
 * several real saves, including a fully-completed one — so it can't be
 * trusted to label a ranking snapshot. Deriving "last played week" from the
 * user's own played games instead works in every season stage: 0 for a
 * fresh preseason save (falls back to a single week-0 baseline point), the
 * real in-progress week mid-season, and the actual bowl/CFP week for a
 * finished season.
 */
function computeLastPlayedWeek(schedule: ExtractionData['schedule'], teamIndex: number): number {
  const played = schedule.filter(
    (game) =>
      (game.homeTeamIndex === teamIndex || game.awayTeamIndex === teamIndex) && isGamePlayed(game.status),
  );
  if (played.length === 0) return 0;
  return Math.max(...played.map((game) => game.week));
}

export interface PersistedImport {
  dynasty: Dynasty;
  season: Season;
  /** Years newly backfilled as history-only seasons this call (see extractLeagueHistory) — empty on the common case where nothing was skipped. */
  backfilledSeasonYears: number[];
}

/**
 * Writes an extraction result to SQLite. Importing the same save path twice
 * reuses the existing dynasty (refreshing its label) rather than erroring on
 * the save_path UNIQUE constraint — re-importing to pull the latest week's
 * data is the common case, not an edge case.
 */
export function persistExtraction(savePath: string, extraction: ExtractionData): PersistedImport {
  // ~25 writes land below, and each one would otherwise rewrite the entire
  // archive to disk. One flush at the end instead — see withBatchedPersist.
  return withBatchedPersist(() => persistExtractionInner(savePath, extraction));
}

function persistExtractionInner(savePath: string, extraction: ExtractionData): PersistedImport {
  const { league, userTeam } = extraction;
  const label = `${userTeam.displayName} Dynasty`;

  const existingDynasty = getDynastyBySavePath(savePath);
  const colorPatch = {
    teamColorPrimary: userTeam.primaryColorHex,
    teamColorSecondary: userTeam.secondaryColorHex,
  };

  // teamId/teamName on the dynasty row are a "most recently known" display
  // cache for the Dashboard card list only — refreshed on every import so it
  // reflects wherever the coach currently is, but never trusted for
  // season-scoped queries, since the coach can change schools mid-dynasty
  // (see schema_v3_season_team.sql). Each season records its own real team
  // below instead.
  const teamPatch = { teamId: userTeam.teamIndex, teamName: userTeam.displayName };

  let dynasty: Dynasty;
  if (existingDynasty) {
    updateDynasty(existingDynasty.id, { label, ...colorPatch, ...teamPatch });
    dynasty = { ...existingDynasty, label, ...colorPatch, ...teamPatch };
  } else {
    dynasty = createDynasty({
      savePath,
      label,
      ...teamPatch,
      ...colorPatch,
    });
  }

  // The user coach's stable id (Coach.PresentationId) — the identity anchor for
  // the coaching journey. 0 (generated coordinators) is treated as "no real id".
  const userCoach = extraction.coaches.find((c) => c.isUserControlled);
  const userCoachId = userCoach && userCoach.presentationId ? userCoach.presentationId : null;

  // Move-year attribution: a coach moves after the bowl but before the season
  // year rolls over, so on a post-move sync `userTeam` is already the NEW school
  // while the just-completed season was coached at the OLD one. If the coach's
  // most recent move landed at the current team AT THE END of this same season
  // year, attribute the season to the previous school instead. (This corrects
  // the season's TEAM; a post-move sync still captures the new team's roster
  // snapshot, so syncing before advancing remains the way to keep full fidelity.)
  const move = extraction.coachMove;
  let seasonTeamIndex = userTeam.teamIndex;
  if (move && move.toTeamIndex === userTeam.teamIndex) {
    const moveAbsoluteYear = league.baseCalendarYear + move.seasonYearRelative;
    if (moveAbsoluteYear === league.seasonYear) {
      seasonTeamIndex = move.fromTeamIndex;
    }
  }

  const existing = getSeasonByYear(dynasty.id, league.seasonYear);
  const season = existing ?? createSeason(dynasty.id, league.seasonYear, seasonTeamIndex, userCoachId);

  // Finalize / lock (Step 3): this year was already captured for a DIFFERENT
  // team than the one we're now extracting — meaning the coach has changed
  // schools since. The stored season is a finalized past season at the previous
  // school; a post-move re-sync must NOT overwrite its snapshots with the new
  // team's roster/coaches (which would leave the old-school season carrying the
  // new school's data). Compare against the EXTRACTED team (userTeam.teamIndex,
  // what the snapshots are actually for), not the move-attributed index — the
  // latter can equal the stored team and would defeat the lock. The new school's
  // tenure is captured on its own next season instead.
  const finalizedElsewhere =
    !!existing &&
    existing.hasFullData &&
    existing.userTeamId !== null &&
    existing.userTeamId !== userTeam.teamIndex;

  // Phase-aware sync (see shared/syncPhase.ts + memory reference-sync-phase-map).
  // The save is one mutable snapshot; a mistimed sync would overwrite a finished
  // season with churned data. Block this season's write when: the coach changed
  // schools since (finalizedElsewhere); OR we're in the deep offseason (stage 3+,
  // where players scatter to the pool and awards get thinned); OR the season is
  // already finalized and this isn't a finalize-window refresh (i.e. a rewind to
  // an earlier save). The finalize window is End of Season Recap + Players Leaving
  // (offseason stage 1–2), where rosters are still intact.
  const phase = deriveSyncPhase({
    currentWeekType: league.currentWeekType,
    currentOffseasonStage: league.currentOffseasonStage,
  });
  const finalizing = isSeasonFinalizing(phase);
  const blockWrite = finalizedElsewhere || isSeasonLocked(phase) || (!!existing?.finalized && !finalizing);

  // Results hold (see shared/resultsHold.ts): the save pre-simulates the whole
  // current week the moment you enter it, but the game keeps those scores
  // hidden until you've played your own game. Strip them here — at the single
  // ingest choke point — so no page can spoil a weekend the user hasn't seen.
  // Nothing is lost: the next sync writes the real results back in.
  const heldWeek = resolveHeldWeek({
    currentWeek: league.currentWeek,
    currentWeekType: league.currentWeekType,
    currentOffseasonStage: league.currentOffseasonStage,
    userTeamIndex: userTeam.teamIndex,
    games: extraction.schedule,
  });
  const heldGameIds = new Set(
    extraction.schedule.filter((g) => isResultHeld(g, heldWeek, userTeam.teamIndex)).map((g) => g.gameId),
  );
  const schedule = extraction.schedule.map((g) => (heldGameIds.has(g.gameId) ? holdGameResult(g) : g));
  const leagueSchedule = extraction.leagueSchedule.map((g) =>
    heldGameIds.has(g.gameId) ? holdLeagueGameResult(g) : g,
  );
  // Per-game player lines don't exist for the current week in any save checked
  // (see resultsHold.ts), so this normally drops nothing — it's here so the
  // hold still holds if a future title writes them earlier.
  const gamelog = extraction.gamelog.filter((entry) => !heldGameIds.has(entry.gameId));

  if (!blockWrite) {
    /*
      A year that was backfilled as history-only is now being captured for real,
      so the row has to stop describing itself as a stub — see
      upgradeSeasonToFull for why the flag alone isn't enough (a null
      user_team_id makes nine read paths skip the season entirely).

      Inside the write branch deliberately: promoting a season whose snapshots
      were blocked would claim data that was never written.
    */
    if (existing && !existing.hasFullData) {
      upgradeSeasonToFull(season.id, dynasty.id, seasonTeamIndex, userCoachId);
      // The in-memory row is handed back to the caller and read by the success
      // message; leaving it stale would report a history-only import.
      season.hasFullData = true;
      season.isCurrent = true;
      season.userTeamId = seasonTeamIndex;
    }

    saveSnapshot(season.id, 'league', extraction.league);
    saveSnapshot(season.id, 'teams', extraction.teams);
    /*
      STAFF IS LOCKED ONCE THE CAROUSEL HAS FIRED (user report, Barcode 2026-08-05).

      The coaching carousel moves coordinators right AFTER the national
      championship — user-confirmed from the JMU→Cincinnati playtest, logged as a
      ~week-18 CoachTransactionHistoryEntry. Every offseason sync after that
      point is reading NEXT season's staff.

      Rewriting `coaches` there overwrote the finished season's staff with the
      replacements, so a coach who looked back at last year saw coordinators who
      were never there — and the coordinators who actually won it had vanished
      from Overview and Staff. `isSeasonLocked` only starts refusing writes at
      offseason stage 3, so stages 1–2 sailed straight through. Those are End of
      Season Recap and Players Leaving: precisely the moment the app RECOMMENDS
      syncing, which made this near-guaranteed rather than rare.

      Same shape as the coach→team rule (see memory reference-sync-phase-map):
      capture before the carousel, then stop looking until the next season.

      A first-ever sync taken in the offseason still writes, because post-carousel
      staff beats no staff at all — the gate only ever refuses to REPLACE a
      capture taken while the season was live.
    */
    const staffAlreadyCaptured = getSnapshot(season.id, 'coaches') !== undefined;
    if (phase.kind !== 'offseason' || !staffAlreadyCaptured) {
      saveSnapshot(season.id, 'coaches', extraction.coaches);
    }
    saveSnapshot(season.id, 'roster', extraction.roster);
    saveSnapshot(season.id, 'leaguePortraits', extraction.leaguePortraits);
    saveSnapshotCompressed(season.id, 'leagueRoster', extraction.leagueRoster);
    // Schedules are user-editable in the preseason (the game count settles once
    // the season starts — 934→944), so only capture them once out of preseason.
    if (isScheduleFinal(phase)) {
      saveSnapshotCompressed(season.id, 'leagueSchedule', leagueSchedule);
      saveSnapshot(season.id, 'schedule', schedule);
    }
    // Always written (even when nothing is held) so a previous sync's hold is
    // cleared the moment the week is revealed. Read by getLeagueScores so the
    // Scores page can say why a week reads empty instead of looking broken.
    saveSnapshot(season.id, 'resultsHold', { week: heldWeek } satisfies ResultsHold);
    saveSnapshot(season.id, 'recruits', extraction.recruits);
    // ~2,950 recruits each with a 10-school list — compressed like the other leaguewide snapshots.
    saveSnapshotCompressed(season.id, 'nationalRecruits', extraction.nationalRecruits);
    saveSnapshot(season.id, 'ncaaRecords', extraction.ncaaRecords);
    saveSnapshot(season.id, 'stats', extraction.stats);
    saveSnapshot(season.id, 'teamStats', extraction.teamStats);
    saveSnapshot(season.id, 'kicking', extraction.kicking);
    // Leaguewide box scores — every team's per-game lines — so compressed like
    // the other leaguewide snapshots (roster/schedule).
    saveSnapshotCompressed(season.id, 'gamelog', gamelog);
    saveSnapshot(season.id, 'conferenceChampionship', extraction.conferenceChampionship);
    saveSnapshot(season.id, 'rivalries', extraction.rivalries);
    // 138 programs x (all-time totals + up to 108 seasons + two record books) —
    // leaguewide and repetitive, so compressed like the other league snapshots.
    saveSnapshotCompressed(season.id, 'teamHistory', extraction.teamHistory);
    saveSnapshot(season.id, 'awards', extraction.awards);
    // Departures are only present at OffSeason stage 2 — write-once so a later
    // (or earlier) sync with an empty list never clobbers a captured one.
    if (extraction.departures.length > 0) {
      saveSnapshot(season.id, 'departures', extraction.departures);
    }

    const currentYearSummary = extraction.leagueHistory.find((y) => y.seasonYear === league.seasonYear);
    if (currentYearSummary) saveSnapshot(season.id, 'yearSummary', currentYearSummary);

    // Point-in-time opponent context. Must use the UNREDACTED schedule: the
    // results hold rewrites held games to look unplayed, and feeding that in
    // would leave those games unlocked and let a later sync overwrite their
    // pre-game state with post-game numbers — destroying the exact thing this
    // captures. `played` therefore comes from what the SAVE says, not from what
    // we chose to show the user.
    const teamStateByIndex = new Map(
      extraction.teams.map((t) => [
        t.teamIndex,
        {
          mediaPollRank: t.mediaPollRank,
          cfpRank: t.cfpRank,
          wins: t.confWins + t.nonConfWins,
          losses: t.confLosses + t.nonConfLosses,
        },
      ]),
    );
    captureGameContext(
      season.id,
      extraction.schedule.map((g) => ({
        gameId: g.gameId,
        week: g.week,
        played: isGamePlayed(g.status),
        home: g.homeTeamIndex !== null ? teamStateByIndex.get(g.homeTeamIndex) ?? null : null,
        away: g.awayTeamIndex !== null ? teamStateByIndex.get(g.awayTeamIndex) ?? null : null,
      })),
      league.currentWeek,
      // CurrentWeek reads 0 in preseason AND offseason, so the "this week's
      // games" rule only applies while a season is actually being played.
      phase.kind === 'regular' || phase.kind === 'postseason',
    );

    recordRankingSnapshot(season.id, {
      week: computeLastPlayedWeek(extraction.schedule, userTeam.teamIndex),
      mediaPollRank: userTeam.mediaPollRank,
      coachesPollRank: userTeam.coachesPollRank,
      cfpRank: userTeam.cfpRank,
      wins: userTeam.confWins + userTeam.nonConfWins,
      losses: userTeam.confLosses + userTeam.nonConfLosses,
    });

    // Record the phase written at + finalize the season at End of Season Recap /
    // Players Leaving so a later dirty-offseason sync can't overwrite it.
    updateSeasonPhase(season.id, league.currentWeekType, phase.offseasonStage, finalizing);
  }

  // Backfill: real league-wide history exists for completed years the app
  // never individually synced (e.g. a save imported for the first time
  // several seasons in). Each becomes a lightweight, clearly-marked
  // "history-only" season — never touching a year that already has a row,
  // full or partial, so a real sync is never overwritten by a backfill.
  const backfilledSeasonYears: number[] = [];
  for (const yearSummary of extraction.leagueHistory) {
    if (yearSummary.seasonYear === league.seasonYear) continue;
    if (getSeasonByYear(dynasty.id, yearSummary.seasonYear)) continue;
    const backfilledSeason = createSeason(dynasty.id, yearSummary.seasonYear, null, null, false, false);
    saveSnapshot(backfilledSeason.id, 'yearSummary', yearSummary);
    backfilledSeasonYears.push(yearSummary.seasonYear);
  }

  return { dynasty, season, backfilledSeasonYears };
}

/**
 * A clear, honest suffix for the import/sync/relink success message when
 * history-only seasons were just backfilled — explains what's actually
 * there (league-wide champions/awards) and what isn't (roster/schedule/
 * stats), so a user importing an already-progressed save understands why
 * those seasons look different rather than assuming something's broken.
 */
export function formatBackfillSuffix(backfilledSeasonYears: number[]): string {
  if (backfilledSeasonYears.length === 0) return '';
  const sorted = [...backfilledSeasonYears].sort((a, b) => a - b);
  const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
  return ` Also recovered ${sorted.length} history-only season${sorted.length === 1 ? '' : 's'} (${range}) from league history — national/conference champions and awards only; full roster/schedule/stats need a sync while that season is current.`;
}

/**
 * One-click reimport for a dynasty the app already knows about — re-reads
 * the save file at its already-stored path (no file picker) and persists it
 * exactly like a normal import. This is the common "I played more, refresh
 * my data" action; picking a *different* file path (a rename/restore) is a
 * separate, deliberate action — see relinkDynasty.ts.
 */
export async function syncDynasty(dynastyId: string): Promise<ImportResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) {
    return { success: false, message: 'That dynasty no longer exists.' };
  }

  try {
    const extraction = await extractAll(dynasty.savePath);
    // One batch across BOTH halves, so the award recalculation's own writes
    // don't each trigger another full-archive flush after the import's single one.
    const { backfilledSeasonYears } = withBatchedPersist(() => {
      const persisted = persistExtraction(dynasty.savePath, extraction);
      // Best-effort — a coach's confirmed/finalized winner is never touched
      // regardless, and a failure here shouldn't fail the sync itself (already
      // logged per-award inside autoRecalculateTeamAwards).
      try {
        autoRecalculateTeamAwards(dynastyId, persisted.season.id);
      } catch (err) {
        console.error('[team-awards] autoRecalculateTeamAwards failed:', err);
      }
      return persisted;
    });
    return {
      success: true,
      message: `Synced — season ${extraction.league.seasonYear}.${formatBackfillSuffix(backfilledSeasonYears)}`,
      dynastyId,
    };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Failed to read save file.' };
  }
}
