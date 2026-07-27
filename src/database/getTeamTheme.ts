import { getCurrentSeason, getSeasonById, getSnapshot } from './helpers';
import type { TeamData } from '../extractors/extract-teams';
import type { TeamTheme } from '../shared/types';

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A team's own brand colors, so a player's trading card is themed to the team he
 * actually plays for — not the user's dynasty. Team colors are stable across
 * seasons, so an unspecified season resolves to the current one (a past-season
 * card still themes correctly). Matches by display name (the same value the card
 * already carries for the logo/jersey). Null when the team isn't in the snapshot
 * or carries no colors (e.g. an FCS placeholder), so the caller can fall back.
 */
export function getTeamTheme(dynastyId: string, teamName: string, seasonId?: number): TeamTheme | null {
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const target = normalize(teamName);
  const team = teams.find((t) => t.displayName === teamName) ?? teams.find((t) => normalize(t.displayName) === target);
  if (!team) return null;

  return { primaryColor: team.primaryColorHex ?? null, secondaryColor: team.secondaryColorHex ?? null };
}
