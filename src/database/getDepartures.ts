import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import type { DepartureData } from '../extractors/extract-departures';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { PlayerDeparture } from '../shared/types';

interface TeamsEntry {
  teamIndex: number;
  displayName: string;
  conferenceName: string | null;
}

/**
 * The offseason "who left" list for a team.
 *
 * TWO SOURCES, AND THE SECOND ONE IS THE AUTHORITY.
 *
 * The `departures` snapshot is the game's `LeavingPlayer` table, captured at
 * OffSeason stage 2 ("Players Leaving"). It is a list of DECLARATIONS, not
 * outcomes, and it is wrong in both directions:
 *
 *   TOO MANY — a player can declare and then come back. Measured on a real
 *   dynasty (UCLA 2027): Sahir West, LE, listed as an NFL declaration with a
 *   projected 4th round, is on the 2028 roster at 89 OVR. Kenneth Moore III was
 *   listed as a transfer and also stayed. The game let both change their minds
 *   after the snapshot was taken, and nothing rewrites the table.
 *
 *   TOO FEW — it only holds EARLY departures. A senior whose eligibility simply
 *   ran out never appears in it, because from the game's point of view he isn't
 *   "leaving early", he's just done. That same UCLA season lost 30 players who
 *   were never in the list, most of them graduating seniors — including the one
 *   the user noticed being drafted.
 *
 * So the roster decides. A player left if he was on this season's roster and is
 * not on it the next season; the declaration list is then only asked WHY. That
 * needs the following season to have been synced, which is the one thing this
 * can't manufacture — until then the declarations are all there is, and they go
 * out marked `confirmed: false` so the page can say so rather than assert
 * something the save hasn't decided yet.
 *
 * `teamIndex` null returns the whole league's departures (unresolved — the
 * roster diff is per team and a league-wide pass would be 15,000 players).
 */
export function getDepartures(
  dynastyId: string,
  teamIndex: number | null,
  seasonId?: number,
): PlayerDeparture[] | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const seasons = getSeasonsByDynasty(dynastyId);
  const season =
    seasonId !== undefined
      ? seasons.find((s) => s.id === seasonId)
      : (seasons.find((s) => s.isCurrent) ?? seasons[0]);
  if (!season || season.dynastyId !== dynastyId) return null;

  const declared = (getSnapshot<DepartureData[]>(season.id, 'departures') ?? []).filter(
    (d) => teamIndex === null || d.teamIndex === teamIndex,
  );
  const teams = getSnapshot<TeamsEntry[]>(season.id, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  const byRating = (a: PlayerDeparture, b: PlayerDeparture) => b.overallRating - a.overallRating;
  const asDeparture = (d: DepartureData, confirmed: boolean): PlayerDeparture => ({
    ...d,
    teamName: nameByIndex.get(d.teamIndex) ?? null,
    confirmed,
  });

  const resolved = teamIndex === null ? null : resolveAgainstNextSeason(dynastyId, season, teamIndex);
  // `teamIndex === null` is repeated so it narrows for the rest of the function;
  // `resolved` being non-null already implies it, but only to a reader.
  if (!resolved || teamIndex === null) {
    // Nothing to check against yet: the next season hasn't been synced (or this
    // is the league-wide call). Report the declarations as declarations.
    return declared.map((d) => asDeparture(d, false)).sort(byRating);
  }

  const { stillHere, leftTheLeague, movedToFbs } = resolved;

  const out: PlayerDeparture[] = [];
  const accountedFor = new Set<number>();

  // 1. Declarations that actually happened. A declared player still on the
  //    roster changed his mind and is simply dropped.
  for (const d of declared) {
    accountedFor.add(d.playerId);
    if (stillHere.has(d.playerId)) continue;
    out.push(asDeparture(d, true));
  }

  // 2. Everyone else who is gone. Seniors are graduations; anyone younger left
  //    FBS without the game recording a reason. Players who turned up at another
  //    FBS school are transfers, which the Transfers list owns — they carry the
  //    'transfer' type so this card filters them out rather than calling a
  //    portal move a graduation.
  for (const p of leftTheLeague) {
    if (accountedFor.has(p.id)) continue;
    out.push({
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      overallRating: p.overallRating,
      portraitAssetName: p.portraitAssetName ?? null,
      teamIndex,
      teamName: nameByIndex.get(teamIndex) ?? null,
      type: p.schoolYear === 'Senior' ? 'graduated' : 'left',
      projectedRound: null,
      reason: null,
      confirmed: true,
    });
  }
  for (const p of movedToFbs) {
    if (accountedFor.has(p.id)) continue;
    out.push({
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      overallRating: p.overallRating,
      portraitAssetName: p.portraitAssetName ?? null,
      teamIndex,
      teamName: nameByIndex.get(teamIndex) ?? null,
      type: 'transfer',
      projectedRound: null,
      reason: null,
      confirmed: true,
    });
  }

  return out.sort(byRating);
}

type LeaguePlayer = LeagueRosterData['players'][number];

/**
 * Who was on the team this season and is not on it the next one, split by where
 * they turned up.
 *
 * The FCS pool is NOT a destination. It's where the game parks players who have
 * dropped off FBS, and most graduating seniors land there rather than vanishing
 * outright — 17 of that UCLA season's 30 did. Treating it as a school would file
 * every graduate as a transfer to "FCS West". `getTransfers` already excludes
 * it for the same reason.
 *
 * Returns null when the next season has no league roster to compare against.
 */
function resolveAgainstNextSeason(
  dynastyId: string,
  season: { id: number; seasonYear: number },
  teamIndex: number,
): { stillHere: Set<number>; leftTheLeague: LeaguePlayer[]; movedToFbs: LeaguePlayer[] } | null {
  const thisLeague = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
  if (!thisLeague?.players.length) return null;

  const next = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.seasonYear > season.seasonYear)
    .sort((a, b) => a.seasonYear - b.seasonYear)
    .map((s) => ({ season: s, league: getSnapshot<LeagueRosterData>(s.id, 'leagueRoster') }))
    .find((s) => s.league && s.league.players.length > 0);
  if (!next?.league) return null;

  const pool = new Set<number>([FCS_POOL_TEAM_INDEX]);
  for (const s of [season.id, next.season.id]) {
    for (const t of getSnapshot<TeamsEntry[]>(s, 'teams') ?? []) {
      if (t.conferenceName == null) pool.add(t.teamIndex);
    }
  }

  const nextIndexById = new Map(next.league.players.map((p) => [p.id, p.teamIndex]));
  const stillHere = new Set<number>();
  const leftTheLeague: LeaguePlayer[] = [];
  const movedToFbs: LeaguePlayer[] = [];

  for (const p of thisLeague.players) {
    if (p.teamIndex !== teamIndex) continue;
    const to = nextIndexById.get(p.id);
    if (to === teamIndex) {
      stillHere.add(p.id);
    } else if (to === undefined || pool.has(to)) {
      leftTheLeague.push(p);
    } else {
      movedToFbs.push(p);
    }
  }

  return { stillHere, leftTheLeague, movedToFbs };
}
