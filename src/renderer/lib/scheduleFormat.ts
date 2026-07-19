import {
  getBowlLogoPath,
  getConferenceLogoPath,
  getNationalChampionshipAppearanceImagePath,
  getPlayoffRoundImagePath,
} from './trophyAssetMapping';
import type { StadiumInfo } from './stadiumData';
import type { ScheduleGame } from '../../shared/types';

/** The real BowlGame.Name strings the save uses for the three CFP bracket rounds. */
const CFP_ROUND_NAMES = new Set(['CFP First Round', 'CFP Quarterfinal', 'CFP Semifinal']);

/**
 * Conference games show their logo alone (see getGameTypeImagePath) — the
 * word "Conference" is redundant next to it, so this returns '' for that
 * case rather than duplicating the information as text. A plain
 * non-conference, non-rivalry game has nothing worth calling out and also
 * returns '' (an intentionally blank Type cell); a rivalry game returns the
 * save's own real rivalry name if one resolved, or a generic "Rivalry" label
 * if the opponent is a confirmed rival with no named record.
 */
export function gameTypeLabel(game: ScheduleGame): string {
  if (game.gameType === 'bowl') {
    if (game.isNationalChampionship) return 'National Championship';
    return game.bowlName ?? 'Bowl Game';
  }
  if (game.gameType === 'conference') return '';
  return game.isRivalryGame ? game.rivalryName ?? 'Rivalry' : '';
}

export function locationLabel(siteType: ScheduleGame['siteType']): string {
  if (siteType === 'neutral') return 'Neutral Site';
  return siteType === 'home' ? 'Home' : 'Away';
}

export interface LocationDisplay {
  badge: string;
  stadium: string | null;
  cityState: string | null;
}

/**
 * Adds the real-world stadium/city to the Home/Away badge — the save itself
 * has no venue data at all (see extract-schedule.ts's isNeutralSite doc
 * comment), so this is resolved from the caller-supplied lookup instead
 * (pass `useStadiumData().getStadium` — this stays a pure function rather
 * than reading the stadium context directly, so it's usable outside React
 * and the caller's choice of default-vs-override resolution isn't hidden
 * here). Whichever team is actually hosting (home team, or the opponent on
 * the road) is looked up; neutral-site games have no single hosting team's
 * stadium to show, so stay badge-only — bowls already carry their own
 * identity via the Type column, and no other neutral-site venue data exists
 * to show instead.
 */
export function getLocationDisplay(
  game: ScheduleGame,
  getStadium: (teamName: string) => StadiumInfo | null,
): LocationDisplay {
  const badge = locationLabel(game.siteType);
  if (game.siteType === 'neutral') return { badge, stadium: null, cityState: null };

  const hostTeamName = game.siteType === 'home' ? game.teamName : game.opponent;
  const info = getStadium(hostTeamName);
  if (!info) return { badge, stadium: null, cityState: null };
  return { badge, stadium: info.stadium, cityState: `${info.city}, ${info.state}` };
}

/** True only for a real named bowl (not the national championship or a CFP bracket round) — the one case whose logo is a normalized-name guess rather than an exact asset, so callers know when an onError fallback is worth wiring up. */
export function isTraditionalBowl(game: ScheduleGame): boolean {
  return game.gameType === 'bowl' && !game.isNationalChampionship && !(game.bowlName && CFP_ROUND_NAMES.has(game.bowlName));
}

/**
 * The logo/mark for a game's type — conference logo, CFP bracket-round
 * graphic, appearance-appropriate national championship mark, or (falling
 * back to the same heuristic bowl-name matching used elsewhere) a
 * traditional bowl's event logo. Null for non-conference games, which have
 * no matching asset.
 */
export function getGameTypeImagePath(game: ScheduleGame, background: 'light' | 'dark'): string | null {
  if (game.gameType === 'conference') {
    return game.conferenceName ? getConferenceLogoPath(game.conferenceName, background) : null;
  }
  if (game.gameType !== 'bowl') return null;

  if (game.isNationalChampionship) return getNationalChampionshipAppearanceImagePath(background);
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) return getPlayoffRoundImagePath(game.bowlName);
  return getBowlLogoPath(game.bowlAssetName);
}
