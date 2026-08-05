/**
 * The pre-rendered map of where a program plays, for the record banner.
 *
 * ONE IMAGE PER TEAM, RENDERED AT BUILD TIME by scripts/render-team-maps.js —
 * never fetched live. A live map would mean bundling MapLibre (~800 KB gzipped,
 * against a 1.05 MB renderer), opening `script-src`, `connect-src` and `img-src`
 * in the CSP, breaking the app offline, and hitting a third-party server on
 * every team-page view. The slow drift over it is a CSS transform, exactly like
 * the Trophy Room backdrop's, so nothing about the motion needs a live map.
 *
 * KEYED ON `canonicalKey`, the same identity as logos, helmets, jerseys, stadium
 * data and school locations — so a lookup by any in-game DisplayName resolves
 * the way every other asset does, aliases included.
 *
 * IT IS THE STADIUM, NOT THE CAMPUS. The banner is about a season, so the frame
 * is where they play. Those are genuinely different places: UCLA's campus is 17
 * miles from the Rose Bowl, Miami's 16 from Hard Rock. See geoCoordinates.ts.
 *
 * NULL IS A REAL ANSWER. 17 FBS programs have no stadium coordinate we could
 * source, and a TeamBuilder school never will. Callers render the plain team
 * gradient in that case — the banner as it has always looked — rather than a
 * grey placeholder. Absence should read as "this banner has no map", not as
 * "something failed to load".
 *
 * Attribution for the imagery is mandatory and lives in the About dialog:
 * "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", plus
 * openstreetmap.org/copyright. Do not remove it.
 */
import { canonicalKey } from './assetMapping';
import { STADIUM_COORDS } from './geoCoordinates';

const TEAM_MAP_BASE_PATH = 'cfbmedia://media/teammaps';

/**
 * The map image for a team, or null when there isn't one.
 *
 * Gated on `STADIUM_COORDS` rather than on a separate list of filenames: the
 * render script reads that same table, so "has a coordinate" and "has an image"
 * cannot drift apart. A team added to the table without a re-render is the only
 * way to get a broken path, and re-running the script fixes it.
 */
export function getTeamMapPath(teamName: string | null | undefined): string | null {
  if (!teamName) return null;
  const key = canonicalKey(teamName);
  return STADIUM_COORDS[key] ? `${TEAM_MAP_BASE_PATH}/${key}.webp` : null;
}
