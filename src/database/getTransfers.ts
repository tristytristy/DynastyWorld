import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { TeamTransfers, TransferEntry } from '../shared/types';

interface TeamsEntry {
  teamIndex: number;
  displayName: string;
  conferenceName: string | null;
}


/**
 * Detects school-to-school transfers by diffing consecutive per-season
 * league-wide roster snapshots. Players are matched by PresentationId (a
 * stable, persistent id — the same one the editor writes by), so the diff is
 * trustworthy. A transfer = a player present in two consecutive seasons whose
 * TEAM changed; matching on the team's display NAME (not the raw index) keeps
 * it correct even if team slots ever reshuffle between seasons. A player who
 * only DISAPPEARS graduated/left the league (not a transfer); one who newly
 * APPEARS is an incoming recruit (the whole league is tracked, so there's no
 * untracked origin to have transferred from). Moves in/out of the generic FCS
 * pool (see FCS_POOL_TEAM_INDEX) are excluded — those are recruit commitments
 * or departures from FBS, not portal transfers.
 */
export function getTransfers(dynastyId: string, focusTeamName: string): TeamTransfers | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const seasons = [...getSeasonsByDynasty(dynastyId)]
    .map((season) => ({
      season,
      league: getSnapshot<LeagueRosterData>(season.id, 'leagueRoster'),
      teams: getSnapshot<TeamsEntry[]>(season.id, 'teams') ?? [],
    }))
    .filter((s): s is { season: (typeof s)['season']; league: LeagueRosterData; teams: TeamsEntry[] } =>
      Boolean(s.league && s.league.players.length > 0),
    )
    .sort((a, b) => a.season.seasonYear - b.season.seasonYear);

  const transfersIn: TransferEntry[] = [];
  const transfersOut: TransferEntry[] = [];

  for (let i = 1; i < seasons.length; i++) {
    const prev = seasons[i - 1];
    const curr = seasons[i];
    const prevName = new Map(prev.teams.map((t) => [t.teamIndex, t.displayName]));
    const currName = new Map(curr.teams.map((t) => [t.teamIndex, t.displayName]));
    // The pool is teamIndex 255, but also derive it defensively from any
    // null-conference bucket in either season's teams snapshot.
    const poolIndices = new Set<number>([FCS_POOL_TEAM_INDEX]);
    for (const t of [...prev.teams, ...curr.teams]) {
      if (t.conferenceName == null) poolIndices.add(t.teamIndex);
    }
    const prevIndexByPlayer = new Map<number, number>();
    for (const p of prev.league.players) {
      prevIndexByPlayer.set(p.id, p.teamIndex);
    }

    for (const p of curr.league.players) {
      const prevIndex = prevIndexByPlayer.get(p.id);
      if (prevIndex === undefined) continue; // new to the league — recruit, not a transfer
      // Exclude moves in/out of the generic FCS pool — a recruit signing onto a
      // real team, or a player dropping off FBS, is not a school-to-school move.
      if (poolIndices.has(prevIndex) || poolIndices.has(p.teamIndex)) continue;
      const prevTeam = prevName.get(prevIndex) ?? `Team ${prevIndex}`;
      const toTeam = currName.get(p.teamIndex) ?? `Team ${p.teamIndex}`;
      if (prevTeam === toTeam) continue; // stayed put

      const entry: TransferEntry = {
        playerId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        portraitAssetName: p.portraitAssetName ?? null,
        fromTeam: prevTeam,
        toTeam,
        seasonYear: curr.season.seasonYear,
        toSeasonId: curr.season.id,
        // The season he left, so a caller can scope "who left THIS year"
        // without being a season out of step with the departures list.
        fromSeasonYear: prev.season.seasonYear,
        fromSeasonId: prev.season.id,
        toTeamIndex: p.teamIndex,
      };

      if (toTeam === focusTeamName) transfersIn.push(entry);
      else if (prevTeam === focusTeamName) transfersOut.push(entry);
    }
  }

  const byRecency = (a: TransferEntry, b: TransferEntry) =>
    b.seasonYear - a.seasonYear || a.lastName.localeCompare(b.lastName);
  transfersIn.sort(byRecency);
  transfersOut.sort(byRecency);

  return {
    teamName: focusTeamName,
    transfersIn,
    transfersOut,
    seasonPairsAvailable: Math.max(0, seasons.length - 1),
  };
}
