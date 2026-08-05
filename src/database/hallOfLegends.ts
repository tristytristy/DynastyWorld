import { getDb, persist } from './init';
import { getDynastyById, getSnapshot } from './helpers';
import { isCompatible } from '../shared/hallFormation';
import { findSamePlayer } from '../shared/playerIdentity';
import type { LegendTier } from '../shared/hallFormation';
import type { RosterPlayer } from '../shared/types';
import type { TeamData } from '../extractors/extract-teams';
import type {
  CoachHall,
  HallEligiblePlayer,
  LegendEntry,
  LegendPlayerSnapshot,
  LegendStatus,
} from '../shared/types';

/**
 * The Hall of Champions — the players a coach chose to keep, across every school
 * they coached.
 *
 * The whole feature rests on two columns that already existed before it:
 * `seasons.user_team_id` (which team the user coached that season) and
 * `seasons.user_coach_id` (which coach they WERE, as Coach.PresentationId).
 * Between them, "the seasons this coach coached" is a filter over the seasons
 * table, and the roster snapshot of each of those seasons is that season's
 * squad. No new extraction, no new sync step, and it works retroactively on
 * every dynasty already in the archive.
 */

interface LegendRow {
  id: number;
  dynasty_id: string;
  coach_id: number;
  player_id: number;
  added_at: string;
  added_from_season_id: number | null;
  added_from_team_index: number | null;
  tier: string | null;
  slot_id: string | null;
  assigned_at: string | null;
  induction_note: string | null;
  snapshot_json: string;
}

const COLS =
  'id, dynasty_id, coach_id, player_id, added_at, added_from_season_id, added_from_team_index, tier, slot_id, assigned_at, induction_note, snapshot_json';

function rowsOf(sql: string, params: (string | number | null)[]): LegendRow[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const out: LegendRow[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as unknown as LegendRow);
  stmt.free();
  return out;
}

function toEntry(row: LegendRow): LegendEntry {
  let snapshot: LegendPlayerSnapshot;
  try {
    snapshot = JSON.parse(row.snapshot_json) as LegendPlayerSnapshot;
  } catch {
    // A corrupt snapshot must not take the Hall down — the entry still knows
    // who it is by id, and the card falls back to the historical treatment.
    snapshot = { name: 'Unknown player', position: '' };
  }
  return {
    playerId: row.player_id,
    addedAt: row.added_at,
    addedFromSeasonId: row.added_from_season_id,
    addedFromTeamIndex: row.added_from_team_index,
    tier: row.tier === 'first' || row.tier === 'second' ? row.tier : null,
    slotId: row.slot_id,
    assignedAt: row.assigned_at,
    inductionNote: row.induction_note,
    snapshot,
  };
}

/**
 * The coach whose Hall this is — the one the user is playing as, taken from the
 * most recent season that recorded a coach identity.
 *
 * NOT the current season alone: a season imported before v8, or a history-only
 * season, has no `user_coach_id`, and falling back to "no coach" would hide a
 * Hall that exists. Walking back to the newest season that knows is both more
 * forgiving and more correct — a coach identity doesn't change without the user
 * starting a different career.
 */
export function activeCoachId(dynastyId: string): number | null {
  const stmt = getDb().prepare(
    'SELECT user_coach_id FROM seasons WHERE dynasty_id = ? AND user_coach_id IS NOT NULL ORDER BY season_year DESC LIMIT 1',
  );
  stmt.bind([dynastyId]);
  const found = stmt.step() ? (stmt.getAsObject() as { user_coach_id: number | null }) : null;
  stmt.free();
  return found?.user_coach_id ? Number(found.user_coach_id) : null;
}

interface CoachSeason {
  seasonId: number;
  seasonYear: number;
  teamIndex: number | null;
}

/**
 * Every season this coach coached, oldest first — the spine of both eligibility
 * and the career span.
 *
 * ONE QUERY, not one per season. This ran a prepared statement inside a loop
 * over `getSeasonsByDynasty`, which is fine at three seasons and silly at
 * fifteen — and it's called by three different entry points, so the waste
 * multiplied.
 */
function coachSeasons(dynastyId: string, coachId: number): CoachSeason[] {
  const stmt = getDb().prepare(
    'SELECT id, season_year, user_team_id FROM seasons WHERE dynasty_id = ? AND user_coach_id = ? ORDER BY season_year ASC',
  );
  stmt.bind([dynastyId, coachId]);
  const out: CoachSeason[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; season_year: number; user_team_id: number | null };
    out.push({ seasonId: Number(row.id), seasonYear: Number(row.season_year), teamIndex: row.user_team_id ?? null });
  }
  stmt.free();
  return out;
}

/**
 * Everyone this coach ever coached, folded across seasons.
 *
 * A player who was on the roster for four years is ONE entry here, carrying the
 * span he was coached and the best overall he ever reached under this coach —
 * which is what a Hall is asking about. Peak is taken over the coached seasons
 * only: a rating he hit somewhere else, for someone else, is not this coach's.
 *
 * Built in the main process on purpose. Ten seasons of an 85-man roster is ~850
 * players spread over ten snapshots, and shipping all of them to the renderer to
 * be folded there would send several megabytes to answer one question.
 */
export function eligiblePlayers(dynastyId: string, coachId: number): HallEligiblePlayer[] {
  const seasons = coachSeasons(dynastyId, coachId);
  if (seasons.length === 0) return [];

  const byPlayer = new Map<number, HallEligiblePlayer>();
  for (const season of seasons) {
    const roster = getSnapshot<RosterPlayer[]>(season.seasonId, 'roster') ?? [];
    const teams = getSnapshot<TeamData[]>(season.seasonId, 'teams') ?? [];
    const teamName =
      season.teamIndex === null
        ? null
        : (teams.find((t) => t.teamIndex === season.teamIndex)?.displayName ?? null);

    for (const player of roster) {
      const existing = byPlayer.get(player.id);
      if (!existing) {
        byPlayer.set(player.id, {
          playerId: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          portraitAssetName: player.portraitAssetName,
          peakOverall: player.overallRating,
          // The school is the one he was LAST coached at under this coach, which
          // is the one a card should print — a transfer's final stop with you.
          schoolName: teamName,
          teamIndex: season.teamIndex,
          firstSeasonYear: season.seasonYear,
          lastSeasonYear: season.seasonYear,
          seasonsCoached: 1,
        });
        continue;
      }
      existing.peakOverall = Math.max(existing.peakOverall, player.overallRating);
      existing.lastSeasonYear = season.seasonYear;
      existing.seasonsCoached += 1;
      existing.position = player.position; // The position he finished at.
      existing.jerseyNumber = player.jerseyNumber;
      if (teamName) {
        existing.schoolName = teamName;
        existing.teamIndex = season.teamIndex;
      }
    }
  }
  return [...byPlayer.values()].sort(
    (a, b) => b.peakOverall - a.peakOverall || a.lastName.localeCompare(b.lastName),
  );
}

/**
 * Eligible, as a yes/no — for the player modal, which asks about one player and
 * shouldn't fold 850 of them to find out.
 */
export function isEligibleForCoachHall(dynastyId: string, coachId: number, playerId: number): boolean {
  // Spans every season this coach worked, so a bare id would let a RECYCLED id
  // qualify someone the coach never coached — the newest holder of the id is
  // the person being asked about, and only his own seasons should count.
  // See shared/playerIdentity.ts.
  const seasons = [...coachSeasons(dynastyId, coachId)].sort((a, b) => b.seasonYear - a.seasonYear);
  const rosters = seasons.map((season) => getSnapshot<RosterPlayer[]>(season.seasonId, 'roster') ?? []);
  const reference = rosters.map((roster) => roster.find((p) => p.id === playerId)).find(Boolean);
  if (!reference) return false;
  return rosters.some((roster) => !!findSamePlayer(roster, reference));
}

/**
 * One player's standing with the Hall — for the profile's action, which asks
 * about a single player and must not fold 850 of them to answer.
 */
export function getLegendStatus(dynastyId: string, playerId: number): LegendStatus {
  const coachId = activeCoachId(dynastyId);
  if (coachId === null) return { eligible: false, inPool: false, tier: null, slotId: null };

  const rows = rowsOf(
    `SELECT ${COLS} FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND player_id = ?`,
    [dynastyId, coachId, playerId],
  );
  if (rows.length > 0) {
    const entry = toEntry(rows[0]);
    // Already in the Hall is proof of eligibility, and cheaper than re-deriving
    // it — an entry can only have been created by passing that check.
    return { eligible: true, inPool: true, tier: entry.tier, slotId: entry.slotId };
  }
  return {
    eligible: isEligibleForCoachHall(dynastyId, coachId, playerId),
    inPool: false,
    tier: null,
    slotId: null,
  };
}

function snapshotFor(player: HallEligiblePlayer): LegendPlayerSnapshot {
  return {
    name: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    schoolName: player.schoolName,
    teamIndex: player.teamIndex,
    peakOverall: player.peakOverall,
    portraitAssetName: player.portraitAssetName,
    firstSeasonYear: player.firstSeasonYear,
    lastSeasonYear: player.lastSeasonYear,
  };
}

/** The whole Hall for the active coach — entries, career span, and the eligible pool. */
export function getCoachHall(dynastyId: string): CoachHall | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const coachId = activeCoachId(dynastyId);
  if (coachId === null) {
    return {
      coachId: null,
      coachName: null,
      careerFirstYear: null,
      careerLastYear: null,
      entries: [],
    };
  }

  const seasons = coachSeasons(dynastyId, coachId);
  const entries = rowsOf(
    `SELECT ${COLS} FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? ORDER BY added_at ASC`,
    [dynastyId, coachId],
  ).map(toEntry);

  // The coach's own name comes from the newest season that has a coaches
  // snapshot naming him; the id is the identity, the name is just the label.
  let coachName: string | null = null;
  for (const season of [...seasons].reverse()) {
    const coaches = getSnapshot<{ presentationId: number; firstName: string; lastName: string }[]>(
      season.seasonId,
      'coaches',
    );
    const match = coaches?.find((c) => c.presentationId === coachId);
    if (match) {
      coachName = `${match.firstName} ${match.lastName}`.trim();
      break;
    }
  }

  return {
    coachId,
    coachName,
    careerFirstYear: seasons[0]?.seasonYear ?? null,
    careerLastYear: seasons[seasons.length - 1]?.seasonYear ?? null,
    entries,
    /*
      NOT the eligible list. Measured on a three-season dynasty, the Hall came
      back at 45 KB of which 38 KB — 85% — was everyone the coach had ever
      coached, which the BOARD never looks at: only the picker does. A ten-season
      dynasty is several hundred players, and the page re-fetches after every
      single assignment, so that was a couple of hundred kilobytes per click to
      draw eleven cards.
      Fetch it from `getHallEligible` when the picker actually opens.

      Nor a COUNT of them, which is how the first version of this fix still paid
      for the whole fold — the number was never printed anywhere, and computing
      it meant decompressing every roster snapshot to answer a question nobody
      asked. What's left here is one indexed query.
    */
  };
}

/** The picker's data, fetched only when a slot is being filled. See getCoachHall. */
export function getHallEligible(dynastyId: string): HallEligiblePlayer[] {
  const coachId = activeCoachId(dynastyId);
  return coachId === null ? [] : eligiblePlayers(dynastyId, coachId);
}

/**
 * Adds a player to the pool. Idempotent: adding someone already there refreshes
 * their snapshot rather than erroring or duplicating, which is what the unique
 * index would otherwise turn into a thrown query.
 */
export function addLegend(dynastyId: string, coachId: number, playerId: number): boolean {
  const player = eligiblePlayers(dynastyId, coachId).find((p) => p.playerId === playerId);
  if (!player) return false; // Not coached by this coach — the one hard rule.

  const seasons = coachSeasons(dynastyId, coachId);
  const last = seasons[seasons.length - 1];
  getDb().run(
    `INSERT INTO coach_legends
       (dynasty_id, coach_id, player_id, added_at, added_from_season_id, added_from_team_index, snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dynasty_id, coach_id, player_id) DO UPDATE SET snapshot_json = excluded.snapshot_json`,
    [
      dynastyId,
      coachId,
      playerId,
      new Date().toISOString(),
      last?.seasonId ?? null,
      player.teamIndex,
      JSON.stringify(snapshotFor(player)),
    ],
  );
  persist();
  return true;
}

/**
 * Removes a player from the pool entirely, which also clears any slot they held
 * — the row IS the assignment, so there is nothing left behind to orphan.
 */
export function removeLegend(dynastyId: string, coachId: number, playerId: number): void {
  getDb().run('DELETE FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND player_id = ?', [
    dynastyId,
    coachId,
    playerId,
  ]);
  persist();
}

/**
 * Puts a legend in a slot, or takes them out of one (`slotId` null).
 *
 * MOVING, NOT COPYING. Because tier and slot live on the player's single row,
 * assigning somewhere new IS leaving the old place — there is no second record
 * to forget to clear, and "a player may not appear on both teams" needs no
 * enforcement because it cannot be expressed.
 *
 * Replacement is explicit rather than an error: the caller has already asked
 * the user, so the occupant is returned to the pool here in the same write. The
 * two updates run in the order that never leaves both players holding the slot,
 * since the unique index would reject the second one.
 */
export function assignLegend(
  dynastyId: string,
  coachId: number,
  playerId: number,
  tier: LegendTier | null,
  slotId: string | null,
): { ok: boolean; message?: string } {
  const stmt = getDb().prepare(
    `SELECT ${COLS} FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND player_id = ?`,
  );
  stmt.bind([dynastyId, coachId, playerId]);
  const row = stmt.step() ? (stmt.getAsObject() as unknown as LegendRow) : null;
  stmt.free();
  if (!row) return { ok: false, message: 'That player is not in the Legends Pool.' };

  if (slotId === null || tier === null) {
    getDb().run(
      'UPDATE coach_legends SET tier = NULL, slot_id = NULL, assigned_at = NULL WHERE id = ?',
      [row.id],
    );
    persist();
    return { ok: true };
  }

  const entry = toEntry(row);
  if (!isCompatible(entry.snapshot.position, slotId)) {
    return { ok: false, message: `A ${entry.snapshot.position} cannot fill that slot.` };
  }

  // Whoever is there now goes back to the pool first — the unique index means
  // the order isn't optional.
  getDb().run(
    'UPDATE coach_legends SET tier = NULL, slot_id = NULL, assigned_at = NULL WHERE dynasty_id = ? AND coach_id = ? AND tier = ? AND slot_id = ?',
    [dynastyId, coachId, tier, slotId],
  );
  getDb().run('UPDATE coach_legends SET tier = ?, slot_id = ?, assigned_at = ? WHERE id = ?', [
    tier,
    slotId,
    new Date().toISOString(),
    row.id,
  ]);
  persist();
  return { ok: true };
}
