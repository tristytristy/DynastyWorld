/**
 * The single source of truth for every static design value — typography,
 * spacing, radius, shadow, motion. Values are consumed as CSS custom
 * properties (applied once at renderer startup by applyTokens.ts), and
 * tailwind.config.js points its own scales at those variables — so both
 * Tailwind utilities and hand-written CSS resolve through this file.
 *
 * 2026-07-18 visual overhaul (see docs/VISUAL_OVERHAUL_PLAN.md): values are
 * no longer Tailwind defaults — this file now carries the premium visual
 * system. Two font families only (spec §3):
 *
 * - Display: DIN. "DIN Pro" is listed first but NOT bundled (commercial
 *   license — supplied files drop in with no code change). The working
 *   default is Bahnschrift, Microsoft's genuine licensed DIN 1451
 *   implementation, present on every Windows 10/11 machine — this app is
 *   Windows-only, so the DIN identity is real without bundling anything.
 * - Body: Inter (SIL OFL 1.1), bundled as woff2 in public/assets/fonts and
 *   declared via @font-face in globals.css — the CSP is `default-src 'self'`,
 *   so fonts must ship locally; no network font loading exists.
 *
 * Surface tokens (canvas/primary/raised/overlay) are theme-dependent and
 * live as hand-written CSS variables in globals.css instead — this file is
 * single-value-per-token and doesn't know about light/dark.
 */

export interface FontSizeToken {
  size: string;
  lineHeight: string;
}

export interface DesignTokens {
  /** Semantic spacing steps for components/layouts (additive to Tailwind's numeric scale, not a replacement). */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  /**
   * Shape language (user direction, 2026-07-19): hard edges — zero radius on
   * every rectangular surface, with a single angled ("cut") corner on key
   * panels/controls instead, echoing the game's own UI so the app feels like
   * it lives in the same universe (Minority-Report-futuristic, not bubbly).
   * The cut is a clip-path (`.corner-cut` / `.corner-cut-sm` in globals.css),
   * not a radius. All four radius steps are therefore 0px — the tokens stay
   * as the single switch so this decision is reversible in one place — and
   * `full` remains for genuinely circular elements (avatars, dots) only.
   */
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
  typography: {
    /** DIN display stack — titles, stats, scores, table headers, buttons. */
    fontDisplay: string;
    /** Inter body stack — running text, descriptions, dense table cells. */
    fontBody: string;
    /**
     * Legacy alias consumed by the existing `font-sans` utility across every
     * page — points at the body stack so the whole app picks up Inter without
     * a per-file migration. New code should use font-display/font-body.
     */
    fontSans: string;
    fontSize: {
      xs: FontSizeToken;
      sm: FontSizeToken;
      base: FontSizeToken;
      lg: FontSizeToken;
      xl: FontSizeToken;
      '2xl': FontSizeToken;
      '3xl': FontSizeToken;
      /** Role-based additions (spec §4) — consumed as text-page-title etc. */
      'display-xl': FontSizeToken;
      'page-title': FontSizeToken;
      'section-title': FontSizeToken;
      'card-title': FontSizeToken;
      eyebrow: FontSizeToken;
      meta: FontSizeToken;
      'stat-xl': FontSizeToken;
      'stat-lg': FontSizeToken;
      'stat-md': FontSizeToken;
      'stat-sm': FontSizeToken;
    };
  };
  motion: {
    /**
     * Milliseconds as numbers; CSS gets them as "150ms" strings. Character
     * (spec §9): quick, controlled, slightly mechanical. `fast` = hovers and
     * presses, `base` = standard state changes, `slow` = emphasis
     * (modals/expansion), `page` = page-level transitions.
     */
    durationMs: {
      fast: number;
      base: number;
      slow: number;
      page: number;
    };
    easing: {
      standard: string;
      enter: string;
      exit: string;
    };
  };
}

export const DEFAULT_TOKENS: DesignTokens = {
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
  },
  radius: {
    sm: '0px',
    md: '0px',
    lg: '0px',
    xl: '0px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(2 6 23 / 0.08)',
    md: '0 2px 8px -2px rgb(2 6 23 / 0.16)',
    lg: '0 12px 32px -12px rgb(2 6 23 / 0.28)',
  },
  typography: {
    fontDisplay:
      '"DIN Pro", "DIN Pro Cond", Bahnschrift, "Roboto Condensed", "Arial Narrow", sans-serif',
    fontBody: '"Inter", "Segoe UI", system-ui, sans-serif',
    fontSans: '"Inter", "Segoe UI", system-ui, sans-serif',
    fontSize: {
      xs: { size: '0.75rem', lineHeight: '1rem' },
      sm: { size: '0.875rem', lineHeight: '1.25rem' },
      base: { size: '0.9375rem', lineHeight: '1.5rem' },
      lg: { size: '1.125rem', lineHeight: '1.75rem' },
      xl: { size: '1.25rem', lineHeight: '1.75rem' },
      '2xl': { size: '1.5rem', lineHeight: '2rem' },
      '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
      'display-xl': { size: '3.5rem', lineHeight: '1.05' },
      'page-title': { size: '2.25rem', lineHeight: '1.1' },
      'section-title': { size: '1.5rem', lineHeight: '1.2' },
      'card-title': { size: '1rem', lineHeight: '1.35' },
      eyebrow: { size: '0.6875rem', lineHeight: '1.2' },
      meta: { size: '0.75rem', lineHeight: '1.35' },
      'stat-xl': { size: '3rem', lineHeight: '1' },
      'stat-lg': { size: '2.25rem', lineHeight: '1.05' },
      'stat-md': { size: '1.5rem', lineHeight: '1.1' },
      'stat-sm': { size: '1.125rem', lineHeight: '1.2' },
    },
  },
  motion: {
    durationMs: {
      fast: 120,
      base: 180,
      slow: 260,
      page: 320,
    },
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      enter: 'cubic-bezier(0, 0, 0.2, 1)',
      exit: 'cubic-bezier(0.4, 0, 1, 1)',
    },
  },
};

/**
 * Flattens a token set into the CSS custom properties the rest of the app
 * reads. Variable names are part of the public contract — tailwind.config.js
 * references them as strings and can't typecheck against this file.
 */
export function tokenCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(tokens.spacing)) {
    vars[`--space-${key}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    vars[`--radius-${key}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.shadow)) {
    vars[`--shadow-${key}`] = value;
  }

  vars['--font-display'] = tokens.typography.fontDisplay;
  vars['--font-body'] = tokens.typography.fontBody;
  vars['--font-sans'] = tokens.typography.fontSans;
  for (const [key, value] of Object.entries(tokens.typography.fontSize)) {
    vars[`--text-${key}`] = value.size;
    vars[`--text-${key}-lh`] = value.lineHeight;
  }

  for (const [key, value] of Object.entries(tokens.motion.durationMs)) {
    vars[`--duration-${key}`] = `${value}ms`;
  }
  for (const [key, value] of Object.entries(tokens.motion.easing)) {
    vars[`--ease-${key}`] = value;
  }

  return vars;
}
