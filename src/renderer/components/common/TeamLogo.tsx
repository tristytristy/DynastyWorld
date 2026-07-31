import { useProgramArt } from '../../data/ProgramArtProvider';
import { isProgramArtPath } from '../../lib/programArt';
import { getLogoPath } from '../../lib/assetMapping';
import { useTheme } from '../../theme/ThemeProvider';

export interface TeamLogoTeam {
  assetName: string;
  label: string;
}

interface TeamLogoProps {
  team: TeamLogoTeam;
  /**
   * Three fixed steps, per the premium-logo direction: 'lg' = 100% (128px, the
   * showcase size the 3D art is drawn for), 'md' = 50% (64px), 'sm' = 25% (32px,
   * the smallest we ever render — smaller contexts round up to this). The 3D
   * logo is the same source at every step, just scaled down.
   */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Forces the celebratory gold 3D variant instead of the theme-driven light/dark one — for "this team just gained something" contexts (e.g. a newly-signed recruit), not a general appearance choice. */
  variant?: 'gold';
}

const SIZE_CLASSES: Record<NonNullable<TeamLogoProps['size']>, string> = {
  sm: 'w-8 h-8', // 25%
  md: 'w-16 h-16', // 50%
  lg: 'w-32 h-32', // 100%
};

/** Picks the on-dark/on-light premium logo variant from the app's current appearance, unless `variant="gold"` overrides it. */
export function TeamLogo({ team, size = 'md', className = '', variant }: TeamLogoProps) {
  const { appearance } = useTheme();
  // Subscribes this component to uploaded art: `getLogoPath` reads a plain
  // module registry, which React cannot see change on its own.
  const { version } = useProgramArt();
  const src = getLogoPath(team.assetName, variant === 'gold' ? 'gold' : appearance);
  // An uploaded logo is ONE file standing in for three shipped variants. Light
  // and dark it can serve as-is; gold it cannot, so the celebration variant is
  // tinted here rather than asking the user for a gold version of their mark
  // they almost certainly don't have. Shipped gold art is untouched.
  const tintGold = variant === 'gold' && isProgramArtPath(src);
  return (
    <img
      key={version}
      src={src}
      alt={team.label}
      className={`${SIZE_CLASSES[size]} object-contain ${className}`}
      style={tintGold ? { filter: 'sepia(1) saturate(2.2) hue-rotate(-8deg) brightness(1.05)' } : undefined}
      draggable={false}
      // The 3D marks are the heaviest art in the library (~240 KB each), and the
      // 'sm' step is what every long list uses — a national roster or a full
      // standings page asks for one per row. Those defer until they scroll into
      // view; 'lg' is the showcase size (masthead, trading card) and stays eager
      // so an exported card never captures a blank logo.
      loading={size === 'lg' ? undefined : 'lazy'}
      decoding="async"
    />
  );
}
