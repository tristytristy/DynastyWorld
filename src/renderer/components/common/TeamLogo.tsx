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
  return (
    <img
      src={getLogoPath(team.assetName, variant === 'gold' ? 'gold' : appearance)}
      alt={team.label}
      className={`${SIZE_CLASSES[size]} object-contain ${className}`}
      draggable={false}
    />
  );
}
