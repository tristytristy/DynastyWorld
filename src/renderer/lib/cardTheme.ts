import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import type { TeamTheme } from '../../shared/types';

/**
 * Team colours are stable within a session, so one lookup per team serves every
 * card that wears it. Module-level on purpose: a card strip, the hover preview
 * and the card book all ask for the same handful of teams, and a per-component
 * cache would re-fetch each time one of them mounts.
 */
const themeCache = new Map<string, TeamTheme | null>();

/**
 * The `--team-*` custom properties for a team, ready to spread onto a card
 * wrapper.
 *
 * Every card surface needs this and none of them can inherit it: modals and the
 * hover preview portal to `<body>`, outside the dynasty container that sets the
 * vars, and a card in the book wears the colours of the school on the CARD —
 * which is not necessarily the school the page is showing. Passing `null` for
 * the team falls back to the dynasty's own colours.
 */
export function useTeamThemeVars(dynastyId: string, teamName: string | null): CSSProperties {
  const { resolveColorVars } = useTheme();
  const key = `${dynastyId}::${teamName ?? ''}`;
  const [theme, setTheme] = useState<TeamTheme | null>(() => themeCache.get(key) ?? null);

  useEffect(() => {
    let cancelled = false;
    if (themeCache.has(key)) {
      setTheme(themeCache.get(key) ?? null);
      return;
    }
    const request = teamName
      ? window.api.db.getTeamTheme(dynastyId, teamName)
      : window.api.db.getDynastyTheme(dynastyId);
    request.then((t) => {
      const colors = t ? { primaryColor: t.primaryColor, secondaryColor: t.secondaryColor } : null;
      themeCache.set(key, colors);
      if (!cancelled) setTheme(colors);
    });
    return () => {
      cancelled = true;
    };
  }, [key, dynastyId, teamName]);

  return resolveColorVars({
    primary: theme?.primaryColor ?? null,
    secondary: theme?.secondaryColor ?? null,
  }) as CSSProperties;
}
