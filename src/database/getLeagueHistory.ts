import { getDynasties, getSeasonsByDynasty, getSnapshot } from './helpers';
import type { YearSummaryData } from '../extractors/extract-league-history';
import type { TeamHistoryData } from '../extractors/extract-team-history';

/**
 * LEAGUE HISTORY — the app's version of the game's own "League History &
 * Records" screen (user pick, 2026-09-19). Three sources, three panels:
 *
 *   1. The champions timeline: every archived season's `yearSummary`
 *      snapshot — full AND history-only seasons alike, so a legacy import
 *      browses the same way a synced year does.
 *   2. The all-time program table: the newest sync's `teamHistory` snapshot,
 *      whose per-team totals the save PRELOADS with real history (Alabama's
 *      1000+ wins) and keeps updating as the dynasty runs.
 *   3. "From the record book": if a legacy dynasty (id `legacy:*`) lives in
 *      the archive, its champions ride along in a side panel — thirty years
 *      of CFB 26 canon next to the CFB 27 timeline.
 */

export interface LeagueHistoryTimelineRow {
  seasonYear: number;
  hasFullData: boolean;
  nationalChampion: YearSummaryData['nationalChampion'];
  runnerUp: YearSummaryData['runnerUp'];
  /** The title game's score line, when both sides are known. */
  conferenceChampions: { conferenceName: string; winningTeamName: string }[];
  /** "F. Lastname (Team)" — matched loosely on the save's award-type string. */
  heisman: string | null;
}

export interface LeagueAllTimeProgramRow {
  teamIndex: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  nationalTitles: number;
  nationalApps: number;
  confTitles: number;
  cfpsMade: number;
  bowlsWon: number;
  bowlsMade: number;
  heismans: number;
  playersDrafted: number;
}

export interface LeagueTitleCount {
  teamName: string;
  titles: number;
  years: number[];
}

export interface LegacyRecordBook {
  label: string;
  firstYear: number;
  lastYear: number;
  champions: { seasonYear: number; teamName: string; runnerUp: string | null; score: string | null }[];
  titleCounts: LeagueTitleCount[];
}

export interface LeagueHistoryView {
  timeline: LeagueHistoryTimelineRow[];
  titleCounts: LeagueTitleCount[];
  programs: LeagueAllTimeProgramRow[];
  /** Season year the program table reflects (the newest full sync). Null = no full season yet. */
  programsAsOf: number | null;
  legacy: LegacyRecordBook | null;
}

function timelineOf(dynastyId: string): { rows: LeagueHistoryTimelineRow[]; summaries: Map<number, YearSummaryData> } {
  const rows: LeagueHistoryTimelineRow[] = [];
  const summaries = new Map<number, YearSummaryData>();
  for (const season of getSeasonsByDynasty(dynastyId)) {
    const summary = getSnapshot<YearSummaryData>(season.id, 'yearSummary');
    if (!summary) continue;
    summaries.set(season.seasonYear, summary);
    const heisman = (summary.awards ?? []).find((a) => /heisman/i.test(a.awardType));
    rows.push({
      seasonYear: season.seasonYear,
      hasFullData: season.hasFullData,
      nationalChampion: summary.nationalChampion,
      runnerUp: summary.runnerUp,
      conferenceChampions: (summary.conferenceChampions ?? []).map((c) => ({
        conferenceName: c.conferenceName,
        winningTeamName: c.winningTeamName,
      })),
      heisman: heisman ? `${heisman.firstName} ${heisman.lastName} (${heisman.teamDisplayName})`.trim() : null,
    });
  }
  return { rows: rows.sort((a, b) => b.seasonYear - a.seasonYear), summaries };
}

function countTitles(rows: { seasonYear: number; champion: string | null }[]): LeagueTitleCount[] {
  const byTeam = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.champion) continue;
    const years = byTeam.get(r.champion) ?? [];
    years.push(r.seasonYear);
    byTeam.set(r.champion, years);
  }
  return [...byTeam.entries()]
    .map(([teamName, years]) => ({ teamName, titles: years.length, years: years.sort((a, b) => a - b) }))
    .sort((a, b) => b.titles - a.titles || a.teamName.localeCompare(b.teamName));
}

export function getLeagueHistory(dynastyId: string): LeagueHistoryView {
  const { rows: timeline } = timelineOf(dynastyId);
  const titleCounts = countTitles(
    timeline.map((r) => ({ seasonYear: r.seasonYear, champion: r.nationalChampion?.teamName ?? null })),
  );

  // The program table reads the NEWEST full sync — history accumulates in the
  // save, so the latest capture supersedes every earlier one.
  const newestFull = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => b.seasonYear - a.seasonYear)[0];
  const teamHistory = newestFull ? getSnapshot<TeamHistoryData[]>(newestFull.id, 'teamHistory') ?? [] : [];
  const programs: LeagueAllTimeProgramRow[] = teamHistory
    .filter((t) => t.allTime)
    .map((t) => ({
      teamIndex: t.teamIndex,
      teamName: t.teamName,
      wins: t.allTime!.wins,
      losses: t.allTime!.losses,
      ties: t.allTime!.ties,
      nationalTitles: t.allTime!.nationalChampionshipsWon,
      nationalApps: t.allTime!.nationalChampionshipsMade,
      confTitles: t.allTime!.conferenceChampionshipsWon,
      cfpsMade: t.allTime!.cfpsMade,
      bowlsWon: t.allTime!.bowlsWon,
      bowlsMade: t.allTime!.bowlsMade,
      heismans: t.allTime!.heismanWinners,
      playersDrafted: t.allTime!.playersDrafted,
    }))
    .sort((a, b) => b.wins - a.wins);

  // The record book rides along when a legacy dynasty is in the archive —
  // and this page is not itself that legacy dynasty's.
  let legacy: LegacyRecordBook | null = null;
  if (!dynastyId.startsWith('legacy:')) {
    const legacyDynasty = getDynasties().find((d) => d.id.startsWith('legacy:'));
    if (legacyDynasty) {
      const { summaries } = timelineOf(legacyDynasty.id);
      const champions = [...summaries.entries()]
        .map(([seasonYear, s]) => ({
          seasonYear,
          teamName: s.nationalChampion?.teamName ?? '',
          runnerUp: s.runnerUp?.teamName ?? null,
          score:
            s.nationalChampion && s.runnerUp && (s.nationalChampion.score || s.runnerUp.score)
              ? `${s.nationalChampion.score}-${s.runnerUp.score}`
              : null,
        }))
        .filter((c) => c.teamName)
        .sort((a, b) => b.seasonYear - a.seasonYear);
      if (champions.length) {
        legacy = {
          label: legacyDynasty.label,
          firstYear: champions[champions.length - 1].seasonYear,
          lastYear: champions[0].seasonYear,
          champions,
          titleCounts: countTitles(champions.map((c) => ({ seasonYear: c.seasonYear, champion: c.teamName }))),
        };
      }
    }
  }

  return {
    timeline,
    titleCounts,
    programs,
    programsAsOf: newestFull?.seasonYear ?? null,
    legacy,
  };
}
