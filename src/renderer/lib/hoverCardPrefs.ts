/**
 * User preferences for the player-card hover preview (the trading card that pops
 * up when you rest on a player's name). Stored in localStorage.
 *  - enabled: defaults ON (an absent key reads as enabled).
 *  - delay: how long to rest before it appears, in ms; defaults 850, clamped to
 *    a sane range so a bad stored value can't disable or spam the preview.
 */
const ENABLED_KEY = 'cfbhub.playerCardHover.enabled';
const DELAY_KEY = 'cfbhub.playerCardHover.delayMs';

export const HOVER_DELAY_MIN = 200;
export const HOVER_DELAY_MAX = 2000;
export const HOVER_DELAY_DEFAULT = 850;

export function getPlayerCardHoverEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setPlayerCardHoverEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    /* non-fatal */
  }
}

export function getPlayerCardHoverDelayMs(): number {
  try {
    const raw = Number(window.localStorage.getItem(DELAY_KEY));
    if (Number.isFinite(raw) && raw > 0) {
      return Math.min(HOVER_DELAY_MAX, Math.max(HOVER_DELAY_MIN, raw));
    }
  } catch {
    /* ignore */
  }
  return HOVER_DELAY_DEFAULT;
}

export function setPlayerCardHoverDelayMs(value: number): void {
  try {
    window.localStorage.setItem(DELAY_KEY, String(Math.min(HOVER_DELAY_MAX, Math.max(HOVER_DELAY_MIN, value))));
  } catch {
    /* non-fatal */
  }
}
