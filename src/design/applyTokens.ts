import { DEFAULT_TOKENS, tokenCssVars, type DesignTokens } from './defaultTokens';

interface StylableElement {
  style: { setProperty(name: string, value: string): void };
}

/**
 * Writes a token set onto an element as CSS custom properties — called once
 * against document.documentElement before the first React render (so no
 * painted frame ever exists without the variables set; Tailwind's var()
 * references carry no hardcoded fallbacks, keeping defaultTokens.ts the only
 * place values live).
 */
export function applyDesignTokens(root: StylableElement, tokens: DesignTokens = DEFAULT_TOKENS): void {
  for (const [name, value] of Object.entries(tokenCssVars(tokens))) {
    root.style.setProperty(name, value);
  }
}
