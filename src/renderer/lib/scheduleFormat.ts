import { CFP_ROUND_NAMES, resolveCfpBowl } from '../../shared/cfpBowls';
import {
  getBowlLogoPath,
  getConferenceChampionshipGamePath,
  getConferenceLogoPath,
  getNationalChampionshipTrophyPath,
  getPlayoffRoundImagePath,
} from './trophyAssetMapping';
import { getBowlVenue, getChampionshipVenue, getNeutralVenue } from './neutralVenues';
import type { StadiumInfo } from './stadiumData';
import type { ScheduleGame } from '../../shared/types';

/**
 * The fields these helpers actually read. Structural rather than
 * `ScheduleGame`, so a league-view game (`LeagueTeamGame`) gets the identical
 * treatment — a Playoff semifinal should look the same whether it's your team's
 * or someone else's, and duplicating this logic per view is how the two drifted
 * apart in the first place.
 */
export interface GameTypeFields {
  gameType: 'conference' | 'non-conference' | 'bowl';
  conferenceName: string | null;
  isNationalChampionship: boolean;
  isConferenceChampionship: boolean;
  bowlName: string | null;
  bowlAssetName: string | null;
  /** Venue reference — what identifies WHICH bowl a playoff game is. See shared/cfpBowls.ts. */
  neutralVenueId?: string | null;
}

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
  if (game.gameType === 'bowl') return bowlLabel(game);
  if (game.gameType === 'conference') {
    return game.isConferenceChampionship && game.conferenceName ? `${game.conferenceName} Championship` : '';
  }
  return game.isRivalryGame ? game.rivalryName ?? 'Rivalry' : '';
}

/**
 * A postseason game's name. Falls back to the generic "Bowl Game" when the
 * save's BowlGame reference didn't resolve — which is the honest answer,
 * because the week bucket it would otherwise print ("BowlSeason3") is NOT a
 * round: one Auburn season put 28 games in BowlSeason1, mixing every December
 * bowl in with the Playoff first round. There is nothing in a week number to
 * derive a round from.
 */
export function bowlLabel(game: Pick<GameTypeFields, 'isNationalChampionship' | 'bowlName'>): string {
  if (game.isNationalChampionship) return 'National Championship';
  return game.bowlName ?? 'Bowl Game';
}

export function locationLabel(siteType: ScheduleGame['siteType']): string {
  if (siteType === 'neutral') return 'Neutral Site';
  return siteType === 'home' ? 'Home' : 'Away';
}

export interface LocationDisplay {
  badge: string;
  stadium: string | null;
  /** "Memphis, TN" — for surfaces with room for the full address. */
  cityState: string | null;
  /** "Memphis" alone. The box-score hero uses this: its centre column is narrow enough that the state orphaned onto its own line. */
  city: string | null;
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
  const at = (venue: { stadium: string; city: string; state: string }, badgeText = 'Neutral Site') => ({
    badge: badgeText,
    stadium: venue.stadium,
    cityState: `${venue.city}, ${venue.state}`,
    city: venue.city,
  });
  const badge = locationLabel(game.siteType);

  /*
    Resolution order, most authoritative first. See lib/neutralVenues.ts for
    why the last two exist at all: a dynasty's past seasons can never be
    re-synced, so anything keyed only on the extracted venue reference would
    leave every already-imported championship showing the nominal home team's
    stadium forever.
  */

  // 1. The save's own venue reference — exact, and it follows an in-game move.
  const byId = getNeutralVenue(game.neutralVenueId);
  if (byId) return at(byId);

  /*
    2. A conference championship with no extracted reference. Note this runs
    BEFORE the siteType check on purpose: on an old snapshot the game was never
    flagged neutral in the first place, so waiting for `siteType === 'neutral'`
    would never reach it. `hosted` is a real answer, not a miss — five of the
    ten championships genuinely are at the higher seed's stadium, so that case
    falls through to the host lookup below rather than claiming a venue.
  */
  if (game.isConferenceChampionship) {
    const champ = getChampionshipVenue(game.conferenceName);
    if (champ?.kind === 'neutral') return at(champ.venue);
    if (champ?.kind === 'hosted') {
      const host = getStadium(game.isHome ? game.teamName : game.opponent);
      return host
        ? { badge: 'Home', stadium: host.stadium, cityState: `${host.city}, ${host.state}`, city: host.city }
        : { badge, stadium: null, cityState: null, city: null };
    }
  }

  // 3. A bowl, by its stable asset name (sponsor rebrands don't move a stadium).
  const byBowl = getBowlVenue(game.bowlAssetName);
  if (byBowl) return at(byBowl);

  // Nothing named it. A neutral game keeps the honest badge rather than
  // borrowing the host's stadium — that borrowing was the original bug.
  if (game.siteType === 'neutral') return { badge, stadium: null, cityState: null, city: null };

  const hostTeamName = game.siteType === 'home' ? game.teamName : game.opponent;
  const info = getStadium(hostTeamName);
  if (!info) return { badge, stadium: null, cityState: null, city: null };
  // Filtered rather than interpolated: a user-defined stadium has no state (the
  // Program editor asks for a city, not an address), and the plain template left
  // a dangling "East Point, " in the Schedule page's Location column.
  return {
    badge,
    stadium: info.stadium,
    cityState: [info.city, info.state].filter(Boolean).join(', '),
    city: info.city,
  };
}

/** True only for a real named bowl (not the national championship or a CFP bracket round) — the one case whose logo is a normalized-name guess rather than an exact asset, so callers know when an onError fallback is worth wiring up. */
export function isTraditionalBowl(game: GameTypeFields): boolean {
  return game.gameType === 'bowl' && !game.isNationalChampionship && !(game.bowlName && CFP_ROUND_NAMES.has(game.bowlName));
}

/**
 * The logo/mark for a game's type — conference logo, CFP bracket-round
 * graphic, appearance-appropriate national championship mark, or (falling
 * back to the same heuristic bowl-name matching used elsewhere) a
 * traditional bowl's event logo. Null for non-conference games, which have
 * no matching asset.
 */
export function getGameTypeImagePath(game: GameTypeFields, background: 'light' | 'dark'): string | null {
  if (game.gameType === 'conference') {
    if (!game.conferenceName) return null;
    // The championship game gets the event's own mark. It's the one conference
    // game of the year that isn't just "an SEC game", and the plain conference
    // logo said nothing to distinguish it from the other eight.
    if (game.isConferenceChampionship) {
      return getConferenceChampionshipGamePath(game.conferenceName) ?? getConferenceLogoPath(game.conferenceName, background);
    }
    return getConferenceLogoPath(game.conferenceName, background);
  }
  if (game.gameType !== 'bowl') return null;

  // The TROPHY, not the CFP event mark: on a scoreboard or a game header the
  // title game is being identified as the game it is, and the trophy says
  // "this one was for everything" in a way the round logo doesn't.
  if (game.isNationalChampionship) return getNationalChampionshipTrophyPath();
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) return getPlayoffRoundImagePath(game.bowlName);
  return getBowlLogoPath(game.bowlAssetName);
}

/**
 * The BOWL a playoff game is, as a second mark shown beside the CFP round
 * graphic — Rose Bowl next to "CFP Quarterfinal" rather than instead of it.
 *
 * Both marks earn their place: the round says how far into the bracket this is,
 * the bowl says which trophy is on the table. Neither answers the other's
 * question, which is why this returns a companion rather than replacing
 * getGameTypeImagePath's result.
 *
 * Null for everything else — the first round is on campus and has no bowl, the
 * national championship is a neutral site rather than anybody's bowl (and its
 * own mark is already the trophy), and a traditional bowl's logo is the primary
 * mark, so pairing it with itself would just print it twice.
 */
export function getCfpBowlImagePath(game: GameTypeFields): string | null {
  const bowl = resolveCfpBowl(game.bowlName, game.neutralVenueId);
  return bowl ? getBowlLogoPath(bowl.assetName) : null;
}
