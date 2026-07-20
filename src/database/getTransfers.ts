import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { TeamTransfers, TransferEntry } from '../shared/types';

interface TeamsEntry {
  teamIndex: number;
  displayName: string;
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
 * untracked origin to have transferred from).
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
    const prevTeamByPlayer = new Map<number, string>();
    for (const p of prev.league.players) {
      prevTeamByPlayer.set(p.id, prevName.get(p.teamIndex) ?? `Team ${p.teamIndex}`);
    }

    for (const p of curr.league.players) {
      const prevTeam = prevTeamByPlayer.get(p.id);
      if (prevTeam === undefined) continue; // new to the league — recruit, not a transfer
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
