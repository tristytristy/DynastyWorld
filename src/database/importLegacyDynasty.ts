import { createDynasty, createSeason, getDynastyBySavePath, getSeasonByYear, saveSnapshot, saveSnapshotCompressed } from './helpers';
import { withBatchedPersist } from './init';
import { CFP_FIRST_ROUND, CFP_QUARTERFINAL, CFP_SEMIFINAL } from '../shared/cfpBowls';
import type { ConferenceChampionshipData, YearSummaryData } from '../extractors/extract-league-history';
import type { GameData } from '../extractors/extract-schedule';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { ImportResult } from '../shared/types';

/**
 * Legacy dynasty import (2026-08) — a whole finished dynasty from a hand-kept
 * record book, not from a save file.
 *
 * The first user of this app kept an "official season record" document for a
 * 30-year CFB 26 dynasty — champions, full CFP brackets, every conference
 * title game, standings, national team stats, a coaching journey — because
 * nothing else preserved it. That document, parsed to JSON (see
 * legacy/cfb26-dynasty.json for the format's one real instance), imports here
 * as a browsable dynasty: Scores, Standings, and the Playoff Bracket all read
 * the same snapshots a synced season would produce.
 *
 * WHAT IS SYNTHESIZED VS. INVENTED. Only game rows the document actually
 * records become games (weeks 16-20: conference championships + the CFP), and
 * every score is the document's own. What the document doesn't know stays
 * honestly absent: no rosters, no player stats, no quarter-by-quarter lines
 * (zeros — the shape needs the field, the modal simply has nothing to show),
 * conference records read 0-0 rather than a guessed split. Seasons are created
 * as history-only (hasFullData=false) so every page that treats those
 * specially keeps doing so.
 *
 * IDEMPOTENT by savePath: the dynasty is keyed on `legacy:<slug>`, re-import
 * reuses the dynasty and each existing season row (snapshot upserts), so
 * season ids — and anything the user attached to them — survive.
 */

interface LegacyGame {
  round: 'first-round' | 'quarterfinal' | 'semifinal' | 'championship';
  bowl: string | null;
  team1: string;
  seed1: number | null;
  record1: [number, number] | null;
  team2: string;
  seed2: number | null;
  record2: [number, number] | null;
  winner: string | null;
  score: [number, number] | null;
}

interface LegacyConfChampionship {
  conference: string;
  team1: string | null;
  rank1: number | null;
  record1: [number, number] | null;
  team2: string | null;
  rank2: number | null;
  record2: [number, number] | null;
  winner: string | null;
  score: [number, number] | null;
  winningCoach: string | null;
}

interface LegacyStandingRow {
  team: string;
  wins: number;
  losses: number;
}

interface LegacyStatsTable {
  columns: string[];
  rows: { team: string; rank: number | null; values: string[] }[];
}

interface LegacyCoachSnapshot {
  name: string | null;
  job: string | null;
  team: string | null;
  seasonRecord: string | null;
  careerRecord: string | null;
  bowlRecord: string | null;
  bowlWin: string | null;
  confChampionshipsCareer: string | null;
  nationalChampionshipsCareer: string | null;
  cfpRecordCareer: string | null;
  notes: string | null;
}

interface LegacySeason {
  year: number;
  champion?: { team: string; record: string | null; finalRank: string | null; coach: string | null; seed: string | null };
  runnerUp?: { team: string; record: string | null; finalRank: string | null; seed: string | null; score: string | null };
  playoff: LegacyGame[];
  conferenceChampionships: LegacyConfChampionship[];
  standings: Record<string, LegacyStandingRow[]>;
  teamStatsOffense?: LegacyStatsTable | null;
  teamStatsDefense?: LegacyStatsTable | null;
  coach?: LegacyCoachSnapshot;
}

interface LegacyDynastyFile {
  format: string;
  label: string;
  game?: string;
  coachName?: string;
  seasons: LegacySeason[];
  allTimeCoaches?: Record<string, string>[];
}

const LEGACY_FORMAT = 'dynastyos-legacy-dynasty-v1';

function parseRecord(s: string | null | undefined): [number, number] | null {
  const m = /(\d+)\s*-\s*(\d+)/.exec(s ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** "Kirby Smart" -> first/last for the shapes that want them split. */
function splitName(name: string | null | undefined): { first: string; last: string } {
  const parts = (name ?? '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * The document's own bracket geometry, mapped to the save's slot numbering so
 * shared/playoffBracket.ts renders it with zero special-casing (slot rules
 * verified there): first-round slot = 8 - better seed; quarterfinal slot =
 * 3 + its bye seed (1-4); a semifinal is slot 8 when it contains the winner of
 * quarterfinal slot 4 or 7, else 9; the title game is slot 10.
 */
function bracketSlot(game: LegacyGame): number | null {
  const seeds = [game.seed1, game.seed2].filter((s): s is number => s !== null);
  if (game.round === 'championship') return 10;
  if (game.round === 'first-round') {
    if (!seeds.length) return null;
    return 8 - Math.min(...seeds);
  }
  if (game.round === 'quarterfinal') {
    const bye = seeds.find((s) => s >= 1 && s <= 4);
    return bye !== undefined ? 3 + bye : null;
  }
  return null;
}

/**
 * Semifinal slots are assigned per-season rather than per-game: each
 * semifinal is linked to the quarterfinal slots whose winners it contains,
 * and the pair containing the lower quarterfinal slot takes 8 (in the save's
 * own geometry, slot 8 holds the winners of quarterfinals 4 and 7 — min 4 —
 * and slot 9 holds 5 and 6). Ranking by minimum rather than matching the
 * exact pairs keeps the slots UNIQUE even for a season whose engine paired
 * the semifinals differently (the 2026 record book pairs 4v5 and 6v7 — the
 * bracket's connector lines cross there, but every game still renders).
 */
function semifinalSlots(semifinals: LegacyGame[], quarterfinals: LegacyGame[]): Map<LegacyGame, number | null> {
  const linked = semifinals.map((sf) => {
    const qfSlots = quarterfinals
      .filter((qf) => qf.winner && (qf.winner === sf.team1 || qf.winner === sf.team2))
      .map((qf) => bracketSlot(qf))
      .filter((slot): slot is number => slot !== null);
    return { sf, minQf: qfSlots.length ? Math.min(...qfSlots) : null };
  });
  const out = new Map<LegacyGame, number | null>();
  const placeable = linked.filter((l) => l.minQf !== null).sort((a, b) => (a.minQf as number) - (b.minQf as number));
  placeable.forEach((l, i) => out.set(l.sf, i === 0 ? 8 : 9));
  for (const l of linked) if (!out.has(l.sf)) out.set(l.sf, null);
  return out;
}

const ROUND_WEEK: Record<LegacyGame['round'], number> = {
  'first-round': 17,
  quarterfinal: 18,
  semifinal: 19,
  championship: 20,
};

const ROUND_WEEK_TYPE: Record<LegacyGame['round'], string> = {
  'first-round': 'BowlSeason1',
  quarterfinal: 'BowlSeason2',
  semifinal: 'BowlSeason3',
  championship: 'NationalChampionship',
};

const ROUND_BOWL_NAME: Record<LegacyGame['round'], string | null> = {
  'first-round': CFP_FIRST_ROUND,
  quarterfinal: CFP_QUARTERFINAL,
  semifinal: CFP_SEMIFINAL,
  championship: null,
};

interface BuiltGame {
  full: GameData;
  league: LeagueGameData;
}

function buildGame(
  gameId: number,
  week: number,
  weekType: string,
  bowlName: string | null,
  isNationalChampionship: boolean,
  home: { name: string; index: number; score: number },
  away: { name: string; index: number; score: number },
  playoffBracketSlot: number | null,
): BuiltGame {
  const status = home.score >= away.score ? 'HomeWon' : 'AwayWon';
  const full: GameData = {
    gameId,
    week,
    status,
    homeTeamIndex: home.index,
    awayTeamIndex: away.index,
    homeTeamName: home.name,
    awayTeamName: away.name,
    homeScore: home.score,
    awayScore: away.score,
    // The record book keeps finals only — the shape needs the fields, and
    // getGameDetail already treats a zero quarter line as "no breakdown".
    homeQuarterScores: [0, 0, 0, 0],
    awayQuarterScores: [0, 0, 0, 0],
    homeScoreOvertime: 0,
    awayScoreOvertime: 0,
    isOvertimeGame: false,
    dayOfWeek: 'Saturday',
    broadcastScope: 'National',
    kickoffMinutes: 0,
    gameMonth: 0,
    gameDay: 0,
    homeTeamStats: null,
    awayTeamStats: null,
    isBowlGame: week >= 17,
    isNationalChampionship,
    bowlName,
    bowlAssetName: null,
    playoffBracketSlot,
  } as GameData;
  const league: LeagueGameData = {
    gameId,
    week,
    weekType,
    bowlName,
    neutralVenueId: null,
    playoffBracketSlot,
    homeTeamIndex: home.index,
    awayTeamIndex: away.index,
    homeTeamName: home.name,
    awayTeamName: away.name,
    homeScore: home.score,
    awayScore: away.score,
  } as LeagueGameData;
  return { full, league };
}

export function importLegacyDynasty(jsonText: string): ImportResult {
  let data: LegacyDynastyFile;
  try {
    data = JSON.parse(jsonText) as LegacyDynastyFile;
  } catch {
    return { success: false, message: 'That file is not valid JSON.' };
  }
  if (data.format !== LEGACY_FORMAT) {
    return {
      success: false,
      message: `Not a legacy dynasty file — expected format "${LEGACY_FORMAT}", found "${String(data.format ?? 'none')}".`,
    };
  }
  if (!Array.isArray(data.seasons) || data.seasons.length === 0) {
    return { success: false, message: 'The legacy dynasty file has no seasons in it.' };
  }

  return withBatchedPersist(() => importInner(data));
}

function importInner(data: LegacyDynastyFile): ImportResult {
  const slug = data.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const savePath = `legacy:${slug}`;

  /*
    STABLE TEAM INDEXES ACROSS THE WHOLE DYNASTY. Every season's snapshots use
    the same name->index map (all names across all years, sorted), so a team
    keeps its index from 2025 to 2054 — cross-season features that join on
    teamIndex behave, and re-imports reproduce the identical mapping.
  */
  const allNames = new Set<string>();
  for (const s of data.seasons) {
    for (const rows of Object.values(s.standings)) for (const r of rows) allNames.add(r.team);
    for (const g of s.playoff) {
      allNames.add(g.team1);
      allNames.add(g.team2);
    }
    for (const c of s.conferenceChampionships) {
      if (c.team1) allNames.add(c.team1);
      if (c.team2) allNames.add(c.team2);
    }
    if (s.coach?.team) allNames.add(s.coach.team);
  }
  const teamIndexByName = new Map<string, number>();
  [...allNames].sort((a, b) => a.localeCompare(b)).forEach((name, i) => teamIndexByName.set(name, i + 1));
  const indexOf = (name: string): number => teamIndexByName.get(name) ?? 0;

  const existing = getDynastyBySavePath(savePath);
  const firstCoachTeam = data.seasons.find((s) => s.coach?.team)?.coach?.team ?? null;
  const dynasty =
    existing ??
    createDynasty({
      savePath,
      label: data.label,
      teamId: firstCoachTeam ? indexOf(firstCoachTeam) : undefined,
      teamName: firstCoachTeam ?? undefined,
    });

  let seasonsWritten = 0;
  for (const s of data.seasons) {
    const coachTeamIndex = s.coach?.team ? indexOf(s.coach.team) : null;
    const season =
      getSeasonByYear(dynasty.id, s.year) ??
      // History-only on purpose: pages that special-case stub seasons (no
      // roster, no player stats) are describing this data exactly.
      createSeason(dynasty.id, s.year, coachTeamIndex, null, false, false);

    // ---- teams (standings + ranks) ----
    const conferenceOf = new Map<number, string>();
    const recordOf = new Map<number, { wins: number; losses: number }>();
    for (const [conference, rows] of Object.entries(s.standings)) {
      for (const r of rows) {
        conferenceOf.set(indexOf(r.team), conference);
        recordOf.set(indexOf(r.team), { wins: r.wins, losses: r.losses });
      }
    }
    const seedOfTeam = new Map<number, number>();
    for (const g of s.playoff) {
      if (g.seed1 !== null) seedOfTeam.set(indexOf(g.team1), g.seed1);
      if (g.seed2 !== null) seedOfTeam.set(indexOf(g.team2), g.seed2);
    }
    const champIndex = s.champion ? indexOf(s.champion.team) : null;
    const runnerUpIndex = s.runnerUp ? indexOf(s.runnerUp.team) : null;
    const teams: TeamData[] = [...teamIndexByName.entries()].map(([name, teamIndex]) => {
      const record = recordOf.get(teamIndex);
      const mediaPollRank = teamIndex === champIndex ? 1 : teamIndex === runnerUpIndex ? 2 : 0;
      return {
        teamIndex,
        origId: teamIndex,
        logoId: 0,
        displayName: name,
        shortName: name,
        nickName: '',
        // Logos key on canonicalKey(displayName) in the renderer, so the
        // display name doubles as the asset name.
        assetName: name,
        confWins: 0,
        confLosses: 0,
        nonConfWins: record?.wins ?? 0,
        nonConfLosses: record?.losses ?? 0,
        mediaPollRank,
        coachesPollRank: mediaPollRank,
        cfpRank: seedOfTeam.get(teamIndex) ?? 0,
        conferenceName: conferenceOf.get(teamIndex) ?? '',
      } as unknown as TeamData;
    });
    // Only teams this season knows something about — keeps 2025's MWC out of a
    // year it had dissolved from, and vice versa.
    const seasonTeams = teams.filter(
      (t) =>
        recordOf.has(t.teamIndex) ||
        seedOfTeam.has(t.teamIndex) ||
        t.teamIndex === champIndex ||
        t.teamIndex === runnerUpIndex,
    );
    saveSnapshotCompressed(season.id, 'teams', seasonTeams);

    // ---- games: conference championships (wk 16) + CFP (wk 17-20) ----
    const built: BuiltGame[] = [];
    let nextGameId = s.year * 100;
    for (const c of s.conferenceChampionships) {
      if (!c.team1 || !c.team2 || !c.winner || !c.score) continue;
      const winnerIsTeam1 = c.winner === c.team1;
      const [winScore, loseScore] = c.score;
      built.push(
        buildGame(
          nextGameId++,
          16,
          'RegularSeason',
          null,
          false,
          { name: c.team2, index: indexOf(c.team2), score: winnerIsTeam1 ? loseScore : winScore },
          { name: c.team1, index: indexOf(c.team1), score: winnerIsTeam1 ? winScore : loseScore },
          null,
        ),
      );
    }
    const quarterfinals = s.playoff.filter((g) => g.round === 'quarterfinal');
    const sfSlots = semifinalSlots(s.playoff.filter((g) => g.round === 'semifinal'), quarterfinals);
    for (const g of s.playoff) {
      if (!g.winner || !g.score) continue;
      const [winScore, loseScore] = g.score;
      const winnerIsTeam1 = g.winner === g.team1;
      // First round is hosted by the better seed; everything later is neutral,
      // where home/away is presentational only.
      const betterSeedIsTeam1 = (g.seed1 ?? 99) <= (g.seed2 ?? 99);
      const homeIsTeam1 = g.round === 'first-round' ? betterSeedIsTeam1 : false;
      const team1 = { name: g.team1, index: indexOf(g.team1), score: winnerIsTeam1 ? winScore : loseScore };
      const team2 = { name: g.team2, index: indexOf(g.team2), score: winnerIsTeam1 ? loseScore : winScore };
      built.push(
        buildGame(
          nextGameId++,
          ROUND_WEEK[g.round],
          ROUND_WEEK_TYPE[g.round],
          ROUND_BOWL_NAME[g.round],
          g.round === 'championship',
          homeIsTeam1 ? team1 : team2,
          homeIsTeam1 ? team2 : team1,
          g.round === 'semifinal' ? sfSlots.get(g) ?? null : bracketSlot(g),
        ),
      );
    }
    saveSnapshotCompressed(season.id, 'schedule', built.map((b) => b.full));
    saveSnapshotCompressed(season.id, 'leagueSchedule', built.map((b) => b.league));

    // ---- year summary + conference championships ----
    const confChamps: ConferenceChampionshipData[] = s.conferenceChampionships
      .filter((c) => c.team1 && c.team2 && c.winner && c.score)
      .map((c) => ({
        conferenceName: c.conference,
        winningTeamName: c.winner as string,
        losingTeamName: (c.winner === c.team1 ? c.team2 : c.team1) as string,
        winningTeamScore: (c.score as [number, number])[0],
        losingTeamScore: (c.score as [number, number])[1],
      }));
    saveSnapshot(season.id, 'conferenceChampionship', confChamps);

    const titleGame = s.playoff.find((g) => g.round === 'championship');
    const champCoach = splitName(s.champion?.coach);
    const champRecord = parseRecord(s.champion?.record);
    const runnerUpRecord = parseRecord(s.runnerUp?.record);
    const titleScore = titleGame?.score ?? null;
    const yearSummary: YearSummaryData = {
      seasonYear: s.year,
      nationalChampion: s.champion
        ? {
            teamName: s.champion.team,
            wins: champRecord?.[0] ?? 0,
            losses: champRecord?.[1] ?? 0,
            score: titleScore?.[0] ?? 0,
            rank: Number(s.champion.finalRank) || 1,
            coachFirstName: champCoach.first,
            coachLastName: champCoach.last,
          }
        : null,
      runnerUp: s.runnerUp
        ? {
            teamName: s.runnerUp.team,
            wins: runnerUpRecord?.[0] ?? 0,
            losses: runnerUpRecord?.[1] ?? 0,
            score: titleScore?.[1] ?? 0,
            rank: Number(s.runnerUp.finalRank) || 2,
          }
        : null,
      conferenceChampions: confChamps,
      awards: [],
    };
    saveSnapshot(season.id, 'yearSummary', yearSummary);

    // ---- everything the app has no native home for yet ----
    saveSnapshot(season.id, 'legacy', {
      source: 'record-book',
      game: data.game ?? null,
      coach: s.coach ?? null,
      teamStatsOffense: s.teamStatsOffense ?? null,
      teamStatsDefense: s.teamStatsDefense ?? null,
      allTimeCoaches: s.year === Math.max(...data.seasons.map((x) => x.year)) ? data.allTimeCoaches ?? null : null,
    });

    seasonsWritten++;
  }

  const years = data.seasons.map((s) => s.year);
  return {
    success: true,
    message: `Imported "${data.label}" — ${seasonsWritten} seasons (${Math.min(...years)}-${Math.max(...years)}). Champions, playoff brackets, conference title games, and standings are browsable; rosters and player stats stay blank because a record book doesn't carry them.`,
    dynastyId: dynasty.id,
  };
}
