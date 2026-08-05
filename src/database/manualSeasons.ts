import { getDb, persist } from './init';
import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import { getGameHistorySeasons } from './gameHistorySeasons';
import type { ManualSeason, ManualSeasonGap } from '../shared/types';

/**
 * Seasons the user typed in from their own records (schema v19).
 *
 * THE ONLY HUMAN-SOURCED NUMBERS IN THE APP, and deliberately quarantined. They
 * live in their own table — not as a flag on `seasons` — so that nothing which
 * computes a statistic can reach them by accident. Every aggregate in
 * getHistory, every national leaderboard, the record book and the team tables
 * all read `seasons` plus snapshots; none of them can see a manual row unless a
 * caller asks for one by name. That is the whole safety argument, and it is
 * structural rather than a rule someone has to remember.
 *
 * BLANK STAYS BLANK. Every value column is nullable, and callers must keep
 * treating null as unknown rather than zero: "I don't remember my 2031
 * conference record" is not 0-0, and a 0-0 would quietly become a real-looking
 * fact in the timeline.
 *
 * WHAT THEY MAY AND MAY NOT DO. A manual season appears on the program History
 * TIMELINE, marked, so a dynasty that began in 2026 doesn't look like it began
 * in 2040. It never contributes to a computed total. The save already knows the
 * authoritative career figures (CareerCoachStats — wins, bowl wins, national
 * titles), so there is nothing to gain by summing typed rows and plenty to lose.
 */

interface ManualSeasonRow {
  season_year: number;
  team_name: string | null;
  wins: number | null;
  losses: number | null;
  conference_wins: number | null;
  conference_losses: number | null;
  bowl_name: string | null;
  bowl_result: string | null;
  conference_champion: number;
  national_champion: number;
  playoff_appearance: number;
  final_rank: number | null;
  head_coach_name: string | null;
  note: string | null;
}

const COLS =
  'season_year, team_name, wins, losses, conference_wins, conference_losses, bowl_name, bowl_result, conference_champion, national_champion, playoff_appearance, final_rank, head_coach_name, note';

function mapRow(r: ManualSeasonRow): ManualSeason {
  return {
    seasonYear: r.season_year,
    teamName: r.team_name,
    wins: r.wins,
    losses: r.losses,
    conferenceWins: r.conference_wins,
    conferenceLosses: r.conference_losses,
    bowlName: r.bowl_name,
    bowlResult: (r.bowl_result === 'W' || r.bowl_result === 'L' ? r.bowl_result : null),
    conferenceChampion: r.conference_champion === 1,
    nationalChampion: r.national_champion === 1,
    playoffAppearance: r.playoff_appearance === 1,
    finalRank: r.final_rank,
    headCoachName: r.head_coach_name,
    note: r.note,
  };
}

export function listManualSeasons(dynastyId: string): ManualSeason[] {
  const stmt = getDb().prepare(`SELECT ${COLS} FROM manual_seasons WHERE dynasty_id = ? ORDER BY season_year ASC`);
  stmt.bind([dynastyId]);
  const out: ManualSeason[] = [];
  while (stmt.step()) out.push(mapRow(stmt.getAsObject() as unknown as ManualSeasonRow));
  stmt.free();
  return out;
}

/** True when a row carries nothing worth keeping — used to delete rather than store an empty year. */
function isBlank(s: ManualSeason): boolean {
  return (
    s.wins == null &&
    s.losses == null &&
    s.conferenceWins == null &&
    s.conferenceLosses == null &&
    !s.bowlName &&
    !s.conferenceChampion &&
    !s.nationalChampion &&
    !s.playoffAppearance &&
    s.finalRank == null &&
    !s.note
  );
}

/**
 * Replaces the whole set for a dynasty in one transaction.
 *
 * WHOLE-SET rather than per-row upsert because the editor is a grid: the user
 * edits several years and saves once, and a row they cleared has to disappear.
 * Diffing individual rows would mean tracking deletions in the UI for no gain
 * at this size (a few dozen rows at most).
 *
 * A row with nothing in it is DROPPED, not stored — an empty 2031 and no 2031
 * mean the same thing, and keeping the empty one would put a blank line in the
 * timeline.
 */
export function saveManualSeasons(dynastyId: string, seasons: ManualSeason[]): ManualSeason[] {
  if (!getDynastyById(dynastyId)) return [];
  const db = getDb();
  const now = new Date().toISOString();
  db.run('BEGIN');
  try {
    db.run('DELETE FROM manual_seasons WHERE dynasty_id = ?', [dynastyId]);
    for (const s of seasons) {
      if (isBlank(s)) continue;
      db.run(
        `INSERT INTO manual_seasons (dynasty_id, season_year, team_name, wins, losses, conference_wins, conference_losses,
          bowl_name, bowl_result, conference_champion, national_champion, playoff_appearance, final_rank, head_coach_name, note, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          dynastyId,
          s.seasonYear,
          s.teamName ?? null,
          s.wins ?? null,
          s.losses ?? null,
          s.conferenceWins ?? null,
          s.conferenceLosses ?? null,
          s.bowlName ?? null,
          s.bowlResult ?? null,
          s.conferenceChampion ? 1 : 0,
          s.nationalChampion ? 1 : 0,
          s.playoffAppearance ? 1 : 0,
          s.finalRank ?? null,
          s.headCoachName ?? null,
          s.note ?? null,
          now,
        ],
      );
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
  persist();
  return listManualSeasons(dynastyId);
}

/**
 * Is there a gap worth offering to fill, and how big?
 *
 * ONLY OFFER WHEN WE CAN PROVE A GAP. Someone who starts a dynasty and the app
 * together has nothing to backfill, and prompting them is pure noise. The proof
 * comes from the save itself, not a guess:
 *
 *   • `seasonsPlayed` — the dynasty's own age, from SeasonInfo.CurrentYear at
 *     the newest sync (0-based there, so a 14th season reads 13).
 *   • `careerWins/careerLosses` — CareerCoachStats, the game's authoritative
 *     lifetime tally for this coach. Present on the very first sync.
 *
 * A gap exists when the dynasty has run more seasons than the app has synced.
 * The prompt can then be specific — "this dynasty has run 14 seasons; DynastyOS
 * has 1" — which reads as the app already knowing something, rather than asking
 * the user to explain themselves.
 */
export function getManualSeasonGap(dynastyId: string): ManualSeasonGap | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;
  const seasons = getSeasonsByDynasty(dynastyId);
  const syncedYears = seasons.map((s) => s.seasonYear).sort((a, b) => a - b);
  const manualYears = new Set(listManualSeasons(dynastyId).map((m) => m.seasonYear));

  const stmt = getDb().prepare('SELECT history_prompt_seen FROM dynasties WHERE id = ?');
  stmt.bind([dynastyId]);
  const promptSeen = stmt.step() ? (stmt.getAsObject() as { history_prompt_seen: number }).history_prompt_seen === 1 : false;
  stmt.free();

  /*
    THE DYNASTY'S TRUE AGE comes from the user coach's own `yearsCoaching` on the
    newest synced season — the game's count, not ours. A coach 14 years in whose
    archive holds one season proves 13 unseen years without anyone claiming it.

    Deliberately NOT inferred from career wins/losses: a coach who changed
    schools carries their whole record with them, so that would overstate the
    gap for this dynasty. `yearsCoaching` has the same issue in principle, but
    it is a count of SEASONS rather than games, which is exactly the unit the
    backfill grid needs, and it degrades safely — an over-count offers a few
    extra blank rows the user simply leaves empty.
  */
  const newest = [...seasons].sort((a, b) => b.seasonYear - a.seasonYear)[0];
  let coachYears = 0;
  if (newest) {
    const coaches = getSnapshot<{ presentationId: number; yearsCoaching: number }[]>(newest.id, 'coaches') ?? [];
    const userCoach = coaches.find((c) => c.presentationId === newest.userCoachId);
    coachYears = userCoach?.yearsCoaching ?? 0;
  }

  // Everything before the earliest synced year, back as far as the coach's own
  // tenure reaches. Years the user already filled are excluded so a second visit
  // shows what is still missing rather than what was already answered.
  const earliest = syncedYears[0] ?? null;
  const missingYears: number[] = [];
  /*
    YEARS THE GAME ALREADY ACCOUNTS FOR ARE NOT MISSING. TeamSeriesHistory
    carries the user's record for every dynasty season, so those years are
    already on the timeline and asking for them again would be asking someone to
    retype what is on screen. They still appear in the editor — prefilled and
    LOCKED — so it is obvious they are handled rather than forgotten.
  */
  const gameSeasons = getGameHistorySeasons(dynastyId);
  const gameYears = new Set(gameSeasons.map((g) => g.year));
  if (earliest !== null && coachYears > syncedYears.length) {
    const unseen = coachYears - syncedYears.length;
    for (let i = unseen; i >= 1; i--) {
      const year = earliest - i;
      if (!manualYears.has(year) && !gameYears.has(year)) missingYears.push(year);
    }
  }

  return {
    earliestSyncedYear: earliest,
    latestSyncedYear: syncedYears[syncedYears.length - 1] ?? null,
    syncedYearCount: syncedYears.length,
    coachSeasonCount: coachYears,
    /** Seasons the save's own history already covers — shown locked, never asked for. */
    gameKnownSeasons: gameSeasons
      .map((g) => ({
        year: g.year,
        teamName: g.teamName,
        wins: g.wins,
        losses: g.losses,
        conferenceWins: g.conferenceWins,
        conferenceLosses: g.conferenceLosses,
      }))
      .sort((a, b) => a.year - b.year),
    missingYears,
    manualYearCount: manualYears.size,
    promptSeen,
  };
}

/** Records that the backfill offer has been made for this dynasty. Permanent. */
export function markHistoryPromptSeen(dynastyId: string): void {
  getDb().run('UPDATE dynasties SET history_prompt_seen = 1 WHERE id = ?', [dynastyId]);
  persist();
}
