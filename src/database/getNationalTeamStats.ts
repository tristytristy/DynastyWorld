import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { NationalTeamStatRow } from '../shared/types';


/**
 * National team-stat leaderboard rows — one aggregated season line per real FBS
 * team, for the NCAA Hub Statistics page. Built by summing each team's per-game
 * team + opponent stat lines from the league-wide `schedule` snapshot (the same
 * source + arithmetic the Team Hub Statistics page uses via getTeamGameStats,
 * proven to reproduce the season TeamStats exactly). The whole league is walked
 * once. The UI derives per-game averages, ratios (3rd-down %), and turnover
 * margin from these totals. Generic FCS-pool teams (index 255 / null conference)
 * are excluded from having their own row; a real team's games AGAINST a pool team
 * still count (they're real games it played).
 */
export function getNationalTeamStats(dynastyId: string, seasonId?: number): NationalTeamStatRow[] | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const games = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const teamByIndex = new Map(teams.map((t) => [t.teamIndex, t]));

  const rows = new Map<number, NationalTeamStatRow>();
  const ensure = (index: number): NationalTeamStatRow | null => {
    if (index === FCS_POOL_TEAM_INDEX) return null;
    const team = teamByIndex.get(index);
    if (!team || team.conferenceName == null) return null; // not a real, rankable team
    let row = rows.get(index);
    if (!row) {
      row = {
        teamIndex: index,
        teamName: team.displayName,
        conferenceName: team.conferenceName,
        games: 0, points: 0, pointsAllowed: 0,
        totalYards: 0, passYards: 0, rushYards: 0,
        defTotalYards: 0, defPassYards: 0, defRushYards: 0,
        thirdDownConv: 0, thirdDownAtt: 0, turnovers: 0, takeaways: 0, sacks: 0,
      };
      rows.set(index, row);
    }
    return row;
  };

  const addSide = (
    index: number | null,
    teamScore: number,
    oppScore: number,
    self: GameData['homeTeamStats'],
    opp: GameData['awayTeamStats'],
  ) => {
    if (index === null) return;
    const row = ensure(index);
    if (!row) return;
    row.games += 1;
    row.points += teamScore;
    row.pointsAllowed += oppScore;
    if (self) {
      row.totalYards += self.totalYards;
      row.passYards += self.passYards;
      row.rushYards += self.rushYards;
      row.thirdDownConv += self.thirdDownConversions;
      row.thirdDownAtt += self.thirdDownAttempts;
      row.turnovers += self.turnovers;
      row.takeaways += self.takeaways;
      row.sacks += self.sacks;
    }
    if (opp) {
      row.defTotalYards += opp.totalYards;
      row.defPassYards += opp.passYards;
      row.defRushYards += opp.rushYards;
    }
  };

  for (const g of games) {
    if (g.status === 'Unplayed') continue;
    addSide(g.homeTeamIndex, g.homeScore, g.awayScore, g.homeTeamStats, g.awayTeamStats);
    addSide(g.awayTeamIndex, g.awayScore, g.homeScore, g.awayTeamStats, g.homeTeamStats);
  }

  return [...rows.values()].filter((r) => r.games > 0).sort((a, b) => a.teamName.localeCompare(b.teamName));
}
