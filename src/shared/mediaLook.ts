/**
 * How a photo READS — its colour treatment, its vignette, and which of the
 * plate's two marks are printed on it.
 *
 * Shared, not renderer-only, because the look travels with the row: the main
 * process stores and returns it, the viewer applies it, the grid tiles apply it,
 * and the export captures it. One definition of what a look IS keeps those four
 * from drifting.
 *
 * NOTHING HERE TOUCHES THE FILE. Same contract as framing — a look is metadata
 * beside the row, so the original stays the original, any treatment can be
 * undone forever after, and a trading card made from the same shot keeps its
 * own independent look.
 */

export interface MediaLook {
  /** A key from FILTER_PRESETS. 'none' is the untreated photo. */
  filter: string;
  /** 0–100. How far toward the preset the photo is taken; 100 is the preset as designed. */
  intensity: number;
  /** 0–100. Darkness of the corners. 0 is off. */
  vignette: number;
  /** 0–100. How far in from the corners the darkening starts — low is a tight ring, high is a broad falloff. */
  vignetteSoftness: number;
  /** 0–100. Film grain over the whole frame. */
  grain: number;
  /**
   * 0–200, where 100 is the photo as it came. Sits AFTER the preset in the
   * filter chain and multiplies it, so it reads as "more/less of whatever this
   * look already does to colour" rather than fighting the preset for the same
   * knob: 0 is grey, 200 is twice as saturated, and a preset that already
   * desaturates still responds.
   */
  saturation: number;
  /** Print the program's mark in the caption's left corner. */
  showTeamMark: boolean;
  /** Print the occasion's mark (bowl, playoff round, rivalry, conference) in the right corner. */
  showOccasionMark: boolean;
}

/**
 * An untreated photo with both marks — what every row that has never been
 * edited is, and what the plate has done since the marks shipped. Kept as the
 * shape a null column resolves to, so "no look saved" and "look explicitly set
 * to nothing" render identically without storing the second one.
 */
export const DEFAULT_MEDIA_LOOK: MediaLook = {
  filter: 'none',
  intensity: 100,
  vignette: 0,
  vignetteSoftness: 55,
  grain: 0,
  saturation: 100,
  showTeamMark: true,
  showOccasionMark: true,
};

/** A stored look is a partial — an older row may predate any field added later. */
export function resolveMediaLook(look: Partial<MediaLook> | null | undefined): MediaLook {
  if (!look) return DEFAULT_MEDIA_LOOK;
  return { ...DEFAULT_MEDIA_LOOK, ...look };
}

/** True when a look changes nothing — the point at which it's cleared rather than stored. */
export function isUntreated(look: MediaLook): boolean {
  return (
    (look.filter === 'none' || look.intensity === 0) &&
    look.vignette === 0 &&
    look.grain === 0 &&
    look.saturation === 100 &&
    look.showTeamMark &&
    look.showOccasionMark
  );
}

/**
 * THE PRESETS.
 *
 * Each one is a set of CSS filter primitives at full strength; `intensity`
 * scales every value back toward its neutral point, so the same preset gives a
 * whisper at 20 and the full treatment at 100. That is what makes a small
 * catalogue feel large — nine looks with a slider is not nine looks.
 *
 * They're built from the primitives a browser composites on the GPU
 * (grayscale / sepia / saturate / contrast / brightness / hue-rotate), so a 4K
 * photo re-renders on every slider tick without dropping a frame. No canvas, no
 * pixel loop, and nothing to re-encode.
 *
 * The names are the looks they're after, not the maths: someone picking a
 * treatment for a night-game photo is choosing FRIDAY NIGHT, not
 * "contrast(1.3) saturate(0.85)".
 */
export interface FilterPreset {
  key: string;
  label: string;
  /** One line on what it's for — this is a photo editor, so the catalogue should teach. */
  hint: string;
  /** Values at intensity 100. Neutral for each primitive is its identity (1, or 0deg). */
  grayscale?: number;
  sepia?: number;
  saturate?: number;
  contrast?: number;
  brightness?: number;
  hueRotate?: number;
  /** A colour laid over the frame at this alpha — what CSS filters alone can't do (a wash, a lifted black). */
  wash?: { color: string; alpha: number; blend: 'overlay' | 'soft-light' | 'screen' | 'multiply' | 'color' };
}

export const FILTER_PRESETS: FilterPreset[] = [
  { key: 'none', label: 'Original', hint: 'The photo as it was taken.' },
  {
    key: 'mono',
    label: 'Black & white',
    hint: 'Colour out of the way, so the moment carries it.',
    grayscale: 1,
    contrast: 1.05,
  },
  {
    key: 'noir',
    label: 'Noir',
    hint: 'Black and white with the lights turned down — night games.',
    grayscale: 1,
    contrast: 1.45,
    brightness: 0.92,
  },
  {
    key: 'contrast',
    label: 'High contrast',
    hint: 'Deeper blacks, brighter whites. Cuts through a flat, grey afternoon.',
    contrast: 1.4,
    saturate: 1.1,
  },
  {
    key: 'sepia',
    label: 'Sepia',
    hint: 'The program history look — a photo that could be sixty years old.',
    sepia: 0.85,
    contrast: 1.05,
    brightness: 1.02,
  },
  {
    key: 'vivid',
    label: 'Vivid',
    hint: 'Saturated and punchy. Uniforms and end-zone paint come alive.',
    saturate: 1.55,
    contrast: 1.15,
  },
  {
    key: 'friday',
    label: 'Friday night',
    hint: 'Cool shadows under stadium light, with the highlights held.',
    saturate: 0.95,
    contrast: 1.2,
    brightness: 0.97,
    wash: { color: '#1d4ed8', alpha: 0.18, blend: 'soft-light' },
  },
  {
    key: 'goldenhour',
    label: 'Golden hour',
    hint: 'Warm late-afternoon light. Best on an early-season kickoff.',
    saturate: 1.15,
    contrast: 1.05,
    wash: { color: '#f59e0b', alpha: 0.2, blend: 'soft-light' },
  },
  {
    key: 'faded',
    label: 'Faded film',
    hint: 'Lifted blacks and washed colour — a print that has been in a drawer.',
    saturate: 0.8,
    contrast: 0.9,
    brightness: 1.05,
    wash: { color: '#f8fafc', alpha: 0.12, blend: 'screen' },
  },
  {
    key: 'broadcast',
    label: 'Broadcast',
    hint: 'The crisp, slightly cool look of a televised game.',
    saturate: 1.2,
    contrast: 1.25,
    brightness: 1.02,
    hueRotate: -4,
  },
];

export function findPreset(key: string): FilterPreset {
  return FILTER_PRESETS.find((p) => p.key === key) ?? FILTER_PRESETS[0];
}

/** Eases a primitive from its neutral value toward the preset's, by intensity. */
function lerp(neutral: number, target: number | undefined, t: number): number | null {
  if (target === undefined) return null;
  return neutral + (target - neutral) * t;
}

/**
 * The `filter` string for a look — '' when there is nothing to apply, which
 * lets a caller drop the property rather than set an expensive no-op.
 */
export function filterCss(look: MediaLook): string {
  const preset = findPreset(look.filter);
  const t = Math.max(0, Math.min(100, look.intensity)) / 100;
  /*
    SATURATION IS INDEPENDENT OF THE PRESET, so it is computed before the early
    return: it has to work on an untreated photo too, which is most of them.
    Appended LAST in the chain so it multiplies whatever the preset did rather
    than being overwritten by it — two saturate() functions compose, which is
    exactly the behaviour wanted here.
  */
  const userSaturation = Math.max(0, Math.min(200, look.saturation)) / 100;
  const saturationPart = userSaturation === 1 ? null : `saturate(${userSaturation.toFixed(3)})`;
  if (preset.key === 'none' || t === 0) return saturationPart ?? '';

  const parts: string[] = [];
  const grayscale = lerp(0, preset.grayscale, t);
  const sepia = lerp(0, preset.sepia, t);
  const saturate = lerp(1, preset.saturate, t);
  const contrast = lerp(1, preset.contrast, t);
  const brightness = lerp(1, preset.brightness, t);
  const hue = lerp(0, preset.hueRotate, t);
  if (grayscale !== null) parts.push(`grayscale(${grayscale.toFixed(3)})`);
  if (sepia !== null) parts.push(`sepia(${sepia.toFixed(3)})`);
  if (saturate !== null) parts.push(`saturate(${saturate.toFixed(3)})`);
  if (contrast !== null) parts.push(`contrast(${contrast.toFixed(3)})`);
  if (brightness !== null) parts.push(`brightness(${brightness.toFixed(3)})`);
  if (hue !== null) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  if (saturationPart) parts.push(saturationPart);
  return parts.join(' ');
}

/** The preset's colour wash, scaled by intensity — null when the preset has none. */
export function washStyle(look: MediaLook): { background: string; mixBlendMode: string; opacity: number } | null {
  const preset = findPreset(look.filter);
  const t = Math.max(0, Math.min(100, look.intensity)) / 100;
  if (!preset.wash || t === 0) return null;
  return { background: preset.wash.color, mixBlendMode: preset.wash.blend, opacity: preset.wash.alpha * t };
}

/**
 * The vignette, as a radial gradient over the frame.
 *
 * Softness moves where the darkening STARTS, not how dark it gets: at 0 the
 * corners go almost immediately, at 100 the falloff begins near the edge and
 * eases in. Strength is the alpha at the very corner. Two numbers, and between
 * them they cover everything from a tight spotlight to a barely-there weight in
 * the corners.
 *
 * Drawn at 140% so the ellipse's own edge is outside the frame — a gradient
 * that ends exactly at the border leaves a visible ring on the diagonal.
 */
export function vignetteCss(look: MediaLook): string | null {
  if (look.vignette <= 0) return null;
  /*
    STRENGTHENED (user direction): the top of the range was not dark enough to
    read as a vignette at all. Two numbers moved. The corner alpha now reaches a
    true 1.0 rather than stopping at 0.92, so 100 is genuinely black in the
    corners; and the falloff STARTS much further in — 8%–68% of the radius
    instead of 25%–75% — so the darkening covers a real part of the frame
    instead of hugging the very edge. A mid setting now does what the old
    maximum did.

    A second, tighter stop is layered under the first at half strength. One
    gradient from clear to black over that distance is a long even ramp, which
    reads as a grey haze; a photograph's vignette falls off faster near the
    corner than in the middle, and the inner stop is what gives it that shape.
  */
  const alpha = Math.max(0, Math.min(100, look.vignette)) / 100;
  const start = 8 + (Math.max(0, Math.min(100, look.vignetteSoftness)) / 100) * 60;
  const mid = start + (100 - start) * 0.55;
  return (
    `radial-gradient(ellipse 140% 140% at 50% 50%, rgba(0,0,0,0) ${start.toFixed(1)}%, ` +
    `rgba(0,0,0,${(alpha * 0.45).toFixed(3)}) ${mid.toFixed(1)}%, ` +
    `rgba(0,0,0,${alpha.toFixed(3)}) 100%)`
  );
}
