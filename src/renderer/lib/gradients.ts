/**
 * The app's gradient vocabulary — a small, named set rather than one-off
 * gradients scattered through components.
 *
 * The DynastyOS look is black + silver with gold accents, and flat black panels
 * on a black page read as one undifferentiated slab. A gradient that settles
 * INTO the background gives a surface weight and a direction (light at the top
 * edge, dissolving downward) without adding a border, a shadow or a colour that
 * would compete with the team palette each page is themed in.
 *
 * Two rules keep this from becoming noise:
 *   1. **Always vertical, always darkening downward.** One light source for the
 *      whole app; mixed directions read as a mistake.
 *   2. **Very low contrast on chrome.** These sit under real content, so the
 *      range is a few percent of white — enough to feel dimensional, not enough
 *      to fight the text on top. Only the gold ACTION gradient is assertive,
 *      because it's a button and it's meant to be found.
 *
 * Light mode gets the same treatment inverted in feel (white settling to a
 * faint warm grey) so panels don't read as flat paper either.
 */

/** Panel/card fill: a hint of lift at the top dissolving into the page. */
export const GRADIENT_SURFACE =
  'bg-gradient-to-b from-white to-slate-50 dark:from-white/[0.055] dark:to-transparent';

/**
 * Section header rows ("PASSING", table column heads). Slightly stronger than
 * a panel so the header separates from the rows beneath it without needing a
 * hard rule.
 */
export const GRADIENT_HEADER =
  'bg-gradient-to-b from-slate-100 to-slate-50/40 dark:from-white/[0.09] dark:to-white/[0.02]';

/**
 * A team-coloured block (the record card, table heads themed to the team) that
 * deepens toward the bottom. Mixing toward black rather than toward a second
 * hue keeps every team's identity intact — a maroon stays maroon, just with
 * dimension.
 */
export const GRADIENT_TEAM_BLOCK =
  'bg-gradient-to-b from-[var(--team-primary)] to-[color-mix(in_srgb,var(--team-primary)_62%,#000)]';

/** The primary action fill — brand gold, deliberately the loudest gradient here. */
export const GRADIENT_ACTION = 'bg-gradient-to-b from-gold-100 via-gold-300 to-gold-500';

/**
 * A hairline that fades out at both ends instead of stopping dead — for
 * separators that shouldn't draw a hard line across a dark panel.
 */
export const GRADIENT_RULE =
  'bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-white/15';
