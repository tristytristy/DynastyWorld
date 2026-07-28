/** @type {import('tailwindcss').Config} */

// Radius, shadow, font, and motion scales resolve through the CSS custom
// properties set by src/design/applyTokens.ts from src/design/defaultTokens.ts
// (Phase A of the UI/UX overhaul). No var() fallbacks here on purpose —
// defaultTokens.ts is the single place values live; applyDesignTokens() runs
// before the first React render, so nothing paints without them. The variable
// names are a string contract with tokenCssVars() — keep them in sync by hand.
module.exports = {
  darkMode: 'class',
  content: ['./public/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DynastyOS brand: black + SILVER, with gold reserved for accents —
        // sampled from the logo art. This replaced a blue ramp, and the reason
        // is functional rather than cosmetic: every dynasty page is themed with
        // the user's real team colors, and a saturated blue chrome competed with
        // them (a maroon program sat inside a blue frame). A neutral silver
        // recedes behind whatever colors the team brings.
        brand: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D6D6D6',
          300: '#C5C5C5',
          400: '#ABABAB',
          500: '#9C9C9C',
          600: '#787878',
          700: '#6E6E6E',
          800: '#555555',
          900: '#3A3A3A',
        },
        // The logo's gold. Accent only — small highlights, never a large fill,
        // or it starts competing exactly like the blue did.
        gold: {
          100: '#FEEA9D',
          200: '#E9D28C',
          300: '#D8B67C',
          400: '#B99A63',
          500: '#77674B',
        },
        // The UI gray. Default Tailwind `slate` is blue-tinted, which read as a
        // navy cast on every dark surface. Remapped to a true-neutral ramp (with
        // a near-black deep end) so the base theme is black, not blue — team
        // color lives only in accents (buttons, text, borders, the card), never
        // in the ambient ground. Same lightness ramp as slate, hue removed.
        slate: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e6e6e8',
          300: '#d2d2d5',
          400: '#9a9a9f',
          500: '#6c6c72',
          600: '#4d4d52',
          700: '#38383c',
          800: '#1f1f22',
          900: '#141416',
          950: '#0a0a0b',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--text-xs-lh)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--text-sm-lh)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--text-base-lh)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--text-lg-lh)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--text-xl-lh)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--text-2xl-lh)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--text-3xl-lh)' }],
        // Role-based scale (visual overhaul spec §4) — text-page-title etc.
        'display-xl': ['var(--text-display-xl)', { lineHeight: 'var(--text-display-xl-lh)' }],
        'page-title': ['var(--text-page-title)', { lineHeight: 'var(--text-page-title-lh)' }],
        'section-title': ['var(--text-section-title)', { lineHeight: 'var(--text-section-title-lh)' }],
        'card-title': ['var(--text-card-title)', { lineHeight: 'var(--text-card-title-lh)' }],
        eyebrow: ['var(--text-eyebrow)', { lineHeight: 'var(--text-eyebrow-lh)' }],
        meta: ['var(--text-meta)', { lineHeight: 'var(--text-meta-lh)' }],
        'stat-xl': ['var(--text-stat-xl)', { lineHeight: 'var(--text-stat-xl-lh)' }],
        'stat-lg': ['var(--text-stat-lg)', { lineHeight: 'var(--text-stat-lg-lh)' }],
        'stat-md': ['var(--text-stat-md)', { lineHeight: 'var(--text-stat-md-lh)' }],
        'stat-sm': ['var(--text-stat-sm)', { lineHeight: 'var(--text-stat-sm-lh)' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      // Semantic spacing steps (p-xs, gap-md, ...) — additive alongside
      // Tailwind's numeric scale, which existing pages keep using until the
      // Phase F page sweep migrates them.
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        page: 'var(--duration-page)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        enter: 'var(--ease-enter)',
        exit: 'var(--ease-exit)',
      },
    },
  },
  plugins: [],
};
