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

/**
 * A PLAIN RELATIVE PATH, like the rivalry, conference and font art — NOT
 * `cfbmedia://`, which is what this used to be and why the map was invisible to
 * most people.
 *
 * `cfbmedia://` resolves against the single external image-data root and has no
 * per-file fallback (see main.ts): a file that isn't in that folder is a 404.
 * The asset installer ships eleven folders and `teammaps` was never one of them,
 * while electron-builder's MEDIA_GLOBS — the list of folders DROPPED from a slim
 * app build — didn't contain it either. So the images travelled inside the app
 * and were then requested from a folder they were never installed into.
 *
 * The effect was split by install type rather than random, which is why it read
 * as "some users": anyone whose asset root falls back to `dist/renderer/assets`
 * (a dev run, a complete build) saw the map, and every slim install with the
 * separate asset pack — the normal user — silently got nothing. Developers are
 * in the first group, which is how it survived.
 *
 * Serving it from the bundle instead of adding it to the installer is the fix
 * that reaches existing users: the 5.5 MB is ALREADY in the slim app today, so
 * this costs nothing and needs no asset-pack rebuild, and it restores the
 * invariant assets-installer.nsi documents — the cfbmedia:// folders,
 * MEDIA_GLOBS and the installer sections are the same eleven again.
 */
const TEAM_MAP_BASE_PATH = 'assets/teammaps';

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
