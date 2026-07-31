import {
  DARK_SURFACE_HEX,
  LIGHT_SURFACE_HEX,
  ensureContrastText,
  hexToRgb,
  relativeLuminance,
  type Rgb,
} from './teamTheme';

/**
 * Team-coloured chart palettes — the Poll Trajectory chart first, and now every
 * chart on the Analytics page, which used a fixed blue/green/orange set that
 * read as a foreign brand sitting inside a team-themed app.
 *
 * Unlike the yearly trend charts — which deliberately avoid team colour so
 * several series stay distinguishable across every dynasty — this chart is a
 * single team's season, so it is painted in that team's own palette:
 *
 *   Coaches = team primary   ·   AP = team secondary   ·   CFP = gold, dashed
 *
 * The save carries exactly TWO team colours (probed: `TEAM_BACKGROUNDCOLOR*`
 * and `*2`, plus a `TEAM_HAS_SECONDARY_COLOR` flag — there is no third), so
 * that is the whole palette available and CFP has to come from outside it.
 * Which means three substitutions are unavoidable rather than cosmetic:
 *
 *   • a near-WHITE colour (Alabama's secondary) is invisible on the light page,
 *     so it becomes graphite;
 *   • a GOLD team colour (Wake Forest) both fades on white and collides with
 *     the CFP line, so it becomes grey — and CFP itself steps off gold when the
 *     team already owns it;
 *   • a team with no real secondary gets primary twice, which would draw AP and
 *     Coaches as one line, so the duplicate is pushed to a neutral.
 *
 * Everything else keeps the team's actual colour, nudged only as far as WCAG AA
 * against the page surface requires.
 */

/** The logo's gold (gold-300 / gold-500 from the Tailwind brand ramp). */
const CFP_GOLD = { dark: '#D8B67C', light: '#77674B' };
/** Neutral stand-ins, from the app's true-neutral slate ramp. */
const GRAPHITE = { dark: '#d2d2d5', light: '#38383c' }; // slate-300 / slate-700
const GREY = { dark: '#9a9a9f', light: '#6c6c72' }; // slate-400 / slate-500

export interface PollLineColors {
  ap: string;
  coaches: string;
  cfp: string;
  /** True when CFP had to step off gold because the team's own palette holds it. */
  cfpIsNeutral: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;

function rgbToHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

/** Yellow-gold family: the hue band that reads as "gold" on a scoreboard. */
function isGold(hex: string): boolean {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return h >= 35 && h <= 62 && s >= 0.35 && l >= 0.3 && l <= 0.82;
}

function isNearWhite(hex: string): boolean {
  return relativeLuminance(hexToRgb(hex)) > 0.7;
}

/**
 * "Would these two lines be mistaken for each other?" — judged on hue and
 * lightness rather than raw RGB distance, because straight Euclidean distance
 * called Texas State's maroon and gold a collision (58 units apart) when they
 * are obviously different colours on screen. Two hues far apart are always
 * distinct however close their brightness; two greys are only distinct if their
 * brightness differs.
 */
function tooClose(a: string, b: string): boolean {
  const ha = rgbToHsl(hexToRgb(a));
  const hb = rgbToHsl(hexToRgb(b));
  const dl = Math.abs(ha.l - hb.l);
  const aGrey = ha.s < 0.12;
  const bGrey = hb.s < 0.12;
  if (aGrey !== bGrey) return false;
  if (aGrey && bGrey) return dl < 0.18;
  const dh = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h));
  return dh < 25 && dl < 0.25;
}

/**
 * One team colour, made safe for the surface it's drawn on.
 *
 * Both substitutions are LIGHT-mode only, and that asymmetry is the point: on
 * the black theme a dark maroon or navy just needs lifting, which
 * `ensureContrastText` does while keeping the hue, and a team's gold reads
 * beautifully there — it's the CFP line that steps aside instead. On white,
 * neither survives: white vanishes outright and gold goes to mush.
 */
function teamLineColor(hex: string | null, isDark: boolean): string {
  if (!hex || !HEX.test(hex)) return isDark ? GREY.dark : GREY.light;
  if (!isDark) {
    if (isNearWhite(hex)) return GRAPHITE.light;
    if (isGold(hex)) return GREY.light;
  }
  return ensureContrastText(hex, isDark ? DARK_SURFACE_HEX : LIGHT_SURFACE_HEX);
}

export interface ThemedColor {
  light: string;
  dark: string;
}

/** One team colour, resolved for both surfaces at once. */
export function themedTeamColor(hex: string | null): ThemedColor {
  return { light: teamLineColor(hex, false), dark: teamLineColor(hex, true) };
}

/**
 * The ordered series palette for a team-themed chart: the program's own two
 * colours first, then on-brand neutrals (the logo's gold, then greys) for any
 * further series.
 *
 * Two colours is all the save has, so beyond that the honest choice is neutrals
 * rather than inventing hues the program doesn't own — a chart of six random
 * colours inside a team-coloured app is exactly the mismatch this replaced. It
 * also means the first two series, which is what most charts have, are pure
 * team identity.
 *
 * The primary/secondary pair goes through the same distinctness check as the
 * poll lines, so a program with no real secondary doesn't draw two identical
 * series.
 */
export function teamSeriesPalette(primary: string | null, secondary: string | null): ThemedColor[] {
  const pairLight = resolvePollLineColors(primary, secondary, false);
  const pairDark = resolvePollLineColors(primary, secondary, true);
  return [
    { light: pairLight.coaches, dark: pairDark.coaches }, // team primary
    { light: pairLight.ap, dark: pairDark.ap }, // team secondary (or a neutral if it duplicates)
    { light: CFP_GOLD.light, dark: CFP_GOLD.dark },
    { light: GRAPHITE.light, dark: GRAPHITE.dark },
    { light: GREY.light, dark: GREY.dark },
    { light: '#0a0a0a', dark: '#ffffff' },
  ];
}

export function resolvePollLineColors(
  primary: string | null,
  secondary: string | null,
  isDark: boolean,
): PollLineColors {
  const coaches = teamLineColor(primary, isDark);
  let ap = teamLineColor(secondary, isDark);

  // A team with no real secondary carries the primary twice — two identical
  // lines is worse than one honest neutral.
  if (tooClose(ap, coaches)) {
    ap = isDark ? GREY.dark : GREY.light;
    if (tooClose(ap, coaches)) ap = isDark ? GRAPHITE.dark : GRAPHITE.light;
  }

  // CFP wants gold — but a team that already owns gold would put two gold lines
  // on the same plot, so it steps off onto a neutral. The remaining candidates
  // are walked in order until one is distinct from both team lines; the last is
  // plain ink, which can never collide because no team colour survives this far
  // without having been pulled off the extremes already.
  const teamOwnsGold = [primary, secondary].some((c) => c && HEX.test(c) && isGold(c));
  const cfpCandidates = [
    ...(teamOwnsGold ? [] : [isDark ? CFP_GOLD.dark : CFP_GOLD.light]),
    isDark ? GREY.dark : GREY.light,
    isDark ? GRAPHITE.dark : GRAPHITE.light,
    isDark ? '#ffffff' : '#0a0a0a',
  ];
  const cfp = cfpCandidates.find((c) => !tooClose(c, ap) && !tooClose(c, coaches)) ?? cfpCandidates[0];

  return { ap, coaches, cfp, cfpIsNeutral: teamOwnsGold };
}
