/**
 * Team colors come straight from the save file and are used as-is for solid
 * fills (that's the whole point � Oregon should look Oregon-green). But used
 * directly as text/link color, some team colors (bright yellows, light golds)
 * fail contrast against the page surface. Rather than fall back to a generic
 * blue and lose the team identity, this nudges the color toward black/white
 * in small steps � preserving hue � until it clears WCAG AA (4.5:1).
 */

type Rgb = [number, number, number];

const LIGHT_SURFACE_HEX = '#f8fafc'; // tailwind slate-50 � matches body bg-slate-50
const DARK_SURFACE_HEX = '#020617'; // tailwind slate-950 � matches body dark:bg-slate-950
const MIN_TEXT_CONTRAST = 4.5; // WCAG AA, normal text
const FALLBACK_PRIMARY = '#9C9C9C'; // DynastyOS silver (brand-500), used if no team color is set

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(rgb: Rgb, target: Rgb, amount: number): Rgb {
  return [
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ];
}

/** Darkens toward black on a light surface, lightens toward white on a dark one. */
function ensureContrastText(hex: string, surfaceHex: string, minContrast = MIN_TEXT_CONTRAST): string {
  const surfaceRgb = hexToRgb(surfaceHex);
  const original = hexToRgb(hex);
  if (contrastRatio(original, surfaceRgb) >= minContrast) return hex;

  const towardDark = relativeLuminance(surfaceRgb) > 0.5;
  const target: Rgb = towardDark ? [0, 0, 0] : [255, 255, 255];

  for (let step = 1; step <= 20; step++) {
    const candidate = mix(original, target, step / 20);
    if (contrastRatio(candidate, surfaceRgb) >= minContrast) {
      return rgbToHex(candidate);
    }
  }
  return rgbToHex(target);
}

/** White or near-black, whichever contrasts better as text on a solid fill of `hex`. */
function textColorOn(hex: string): string {
  const rgb = hexToRgb(hex);
  const white: Rgb = [255, 255, 255];
  const nearBlack: Rgb = [15, 23, 42]; // tailwind slate-900
  return contrastRatio(rgb, white) >= contrastRatio(rgb, nearBlack) ? '#ffffff' : '#0f172a';
}

export interface TeamColorVars {
  '--team-primary': string;
  '--team-primary-rgb': string;
  '--team-secondary': string;
  '--team-on-primary': string;
  '--team-text-light': string;
  '--team-text-dark': string;
}

/** CSS custom properties for a team's colors, safe to spread into a style prop. */
export function buildTeamColorVars(
  primaryHex: string | null | undefined,
  secondaryHex: string | null | undefined,
): TeamColorVars {
  const primary = primaryHex && HEX_PATTERN.test(primaryHex) ? primaryHex : FALLBACK_PRIMARY;
  const secondary = secondaryHex && HEX_PATTERN.test(secondaryHex) ? secondaryHex : primary;
  const [primaryR, primaryG, primaryB] = hexToRgb(primary);

  return {
    '--team-primary': primary,
    '--team-primary-rgb': `${primaryR} ${primaryG} ${primaryB}`,
    '--team-secondary': secondary,
    '--team-on-primary': textColorOn(primary),
    '--team-text-light': ensureContrastText(primary, LIGHT_SURFACE_HEX),
    '--team-text-dark': ensureContrastText(primary, DARK_SURFACE_HEX),
  };
}
