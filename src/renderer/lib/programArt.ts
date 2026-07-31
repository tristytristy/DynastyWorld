import type { ProgramArtSlot } from '../../shared/types';

/**
 * User-uploaded team art, sitting in front of the shipped asset library.
 *
 * WHY A REGISTRY AND NOT PROPS. Team art is resolved by four pure functions
 * (`getLogoPath`, `getHelmetPath`, `getJerseyPath`, `getCoachPoloPath`) that a
 * dozen components call — mastheads, matchup graphics, roster portraits, coach
 * cards, trading cards, the hover preview, the PNG export. Threading an override
 * map through all of them would mean touching every one and would still miss the
 * next caller. Putting it in front of the resolvers means an uploaded logo
 * appears everywhere a logo appears, including places nobody thought about.
 *
 * It is deliberately a plain module and not a context: it must be readable from
 * inside those pure functions, which have no hooks. `ProgramArtProvider` owns
 * the lifecycle — it loads the dynasty's rows, calls `setProgramArtRegistry`,
 * and publishes a version through context so the components that draw art
 * re-render when it changes. Nothing else writes here.
 *
 * KEYED BY canonicalKey(displayName), and safe to be: the registry only ever
 * holds ONE dynasty's overrides, so the name collision that makes a global,
 * name-keyed store wrong (a Teambuilder "Montana" clobbering the real Montana)
 * cannot happen — the row's authoritative identity is still the team slot.
 */
export type ProgramArtRegistry = Record<string, Partial<Record<ProgramArtSlot, string>>>;

let registry: ProgramArtRegistry = {};

/** Marks a URL as an upload rather than shipped art — see `isProgramArtPath`. */
const PROGRAM_ART_MARKER = '#program-art';

export function setProgramArtRegistry(next: ProgramArtRegistry): void {
  registry = next;
}

/** True when this path came from an upload. Callers use it where shipped art carries assumptions an arbitrary image can't (the gold logo variant, the mirrored helmet). */
export function isProgramArtPath(src: string | null | undefined): boolean {
  return Boolean(src && src.includes(PROGRAM_ART_MARKER));
}

/**
 * An absolute file path as a renderer-loadable URL — tagged so it can be
 * recognised later, and busted so a REPLACED upload actually redraws.
 *
 * The bust is not optional: an art slot writes to a deterministic filename, so
 * uploading a new logo leaves the URL identical and the browser would keep
 * showing the old image. `version` is the row's updatedAt, which changes on
 * every write. Query before hash, or the fragment swallows it.
 */
export function programArtUrl(absolutePath: string, version: string): string {
  const slashed = absolutePath.replace(/\\/g, '/');
  const url = encodeURI(slashed.startsWith('//') ? `file:${slashed}` : `file:///${slashed}`);
  return `${url}?v=${encodeURIComponent(version)}${PROGRAM_ART_MARKER}`;
}

/**
 * The uploaded art for a team, or null to fall through to the shipped library.
 * Takes an ALREADY-CANONICALISED key so this module needs no imports and can be
 * called from inside `assetMapping` without a cycle.
 */
export function programArtFor(teamKey: string, slot: ProgramArtSlot): string | null {
  return registry[teamKey]?.[slot] ?? null;
}
