import type { ReactNode } from 'react';
import { SurfaceCard } from '../ui/SurfaceCard';
import { InfoHint } from '../ui/InfoHint';
import { useTheme } from '../../theme/ThemeProvider';
import { getLogoPath } from '../../lib/assetMapping';
import { getHelmetPath, DEFAULT_HELMET_PATH } from '../../lib/helmetAssetMapping';
import { boundsFor, markGeometry } from '../../lib/markBounds';
import { useProgramArt } from '../../data/ProgramArtProvider';

/**
 * The shared page masthead — one card, one height, one mark treatment, across
 * every team-scoped page (Roster, Transfers, Statistics, Analytics, Honors,
 * History, Rivalries, Schedule).
 *
 * The mark is a SIBLING of the card, never a child. SurfaceCard's cut corner is
 * a `clip-path`, and clip-path clips every descendant — so a mark inside the
 * card can't cross its edge no matter what overflow says; it can only push the
 * card taller. Layering it over the card from outside is what lets it overhang
 * while the card's height stays fixed by its text alone.
 *
 * Sizes come from measured art bounds rather than per-page guesses. Each mark
 * is a 1024² canvas with the art floating inside it, and the fill varies wildly
 * between logos — 25% of the canvas for LSU, 80% for Texas State, a 3.19×
 * spread. Rendering them all in one box would make some bulge past the card and
 * leave others short of it, which is exactly the inconsistency this component
 * exists to remove. See lib/markBounds.ts.
 */

/** Every masthead is this tall, which is what makes the pages feel like one system. */
const TEXT_MIN_HEIGHT = '9.5rem';
/**
 * The slot every mark is fitted into — at most this tall AND this wide, so a
 * wordmark can't run away horizontally the way it does when only height is
 * normalised (JMU reached 638px wide, UAB 689px, against a 257px median).
 * Whichever limit binds first wins.
 *
 * Helmets get more height because they read as lighter: a helmet is mostly
 * negative shape, a logo a solid mass, so matching by raw pixels makes the logo
 * look the bigger of the two. They're near-square, so the width limit never
 * binds for them.
 *
 * The slot width is FIXED, which is what keeps the headline starting on the
 * same pixel regardless of team — a narrow mark leaves a gap rather than
 * dragging the text left.
 */
export const MASTHEAD_ART_SLOT = {
  // The helmet OVERHANGS the card (250 against a ~194px card) — that's the
  // signature, and it works because a helmet is a single silhouette reading as
  // one object breaking the frame.
  helmet: { maxHeight: 250, maxWidth: 300 },
  // A logo does NOT. Tried at 230 and it read as a mistake rather than a
  // flourish: logos are dense, high-contrast shapes with hard outlines, so
  // crossing the card edge looks like a clipping bug instead of depth. Capped
  // under the card's own height so every logo sits inside the box with a
  // consistent inset.
  logo: { maxHeight: 170, maxWidth: 300 },
} as const;
const SLOT_LEFT = { helmet: 40, logo: 40 } as const;
const TEXT_GAP = 32;

export interface PageMastheadMark {
  kind: 'helmet' | 'logo';
  teamAssetName: string;
  /** Forces the celebratory gold logo (History). Ignored for helmets, which have no variants. */
  variant?: 'gold';
}

export function PageMasthead({
  eyebrow,
  title,
  description,
  subtitle,
  mark,
  stats,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  /** Goes behind the hint icon beside the title — same convention as PageHeader. */
  description?: ReactNode;
  /** The metadata line under the title (season, coach, record…). */
  subtitle?: ReactNode;
  mark: PageMastheadMark;
  /** Optional chips (Schedule's record/streak numbers). */
  stats?: { label: string; value: string }[];
  /** Right-aligned controls (Team Awards' calculate/settings buttons). */
  actions?: ReactNode;
}) {
  const { appearance } = useTheme();

  // `version` subscribes this to uploaded art — see ProgramArtProvider.
  const { version } = useProgramArt();
  const src =
    mark.kind === 'helmet'
      ? getHelmetPath(mark.teamAssetName, 'left')
      : getLogoPath(mark.teamAssetName, mark.variant === 'gold' ? 'gold' : appearance);

  const geometry = markGeometry(boundsFor(src, mark.kind), {
    ...MASTHEAD_ART_SLOT[mark.kind],
    slotLeft: SLOT_LEFT[mark.kind],
    textGap: TEXT_GAP,
  });

  return (
    <div className="relative">
      <SurfaceCard surface="raised" className="relative overflow-hidden">
        {/* Signature left edge in the active team color — ties the masthead to the app chrome. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--team-primary)]" />
        <div
          className="relative flex flex-col justify-center gap-4 text-left lg:flex-row lg:items-center lg:justify-between"
          style={{ minHeight: TEXT_MIN_HEIGHT, paddingLeft: geometry.textInset }}
        >
          <div className="min-w-0">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>
            <h2 className="type-page-title mt-1.5 flex items-center gap-2 text-slate-950 dark:text-white">
              <span>{title}</span>
              {description ? <InfoHint label="About this page">{description}</InfoHint> : null}
            </h2>
            {subtitle ? (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
            {stats && stats.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 px-4 py-2 dark:border-slate-800 dark:bg-white/5"
                  >
                    <p className="type-eyebrow text-slate-400 dark:text-slate-500">{stat.label}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </SurfaceCard>

      {/* Rendered AFTER the card so it paints over it without a z-index war, and
          pointer-events-none so it never eats a click meant for the card. The
          drop shadow is on the artwork, not the panel — SurfaceCard stays flat
          by design. */}
      <img
        key={version}
        src={src}
        alt=""
        onError={
          mark.kind === 'helmet'
            ? (event) => {
                const img = event.currentTarget;
                if (img.dataset.fellBack) return;
                img.dataset.fellBack = '1';
                img.src = DEFAULT_HELMET_PATH.left;
              }
            : undefined
        }
        style={geometry.style}
        className="pointer-events-none absolute select-none object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
    </div>
  );
}
