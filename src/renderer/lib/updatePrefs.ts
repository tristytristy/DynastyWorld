/**
 * User preference: whether the app quietly checks GitHub for a newer version on
 * launch (the UpdateNotice popup). Stored in localStorage, defaults ON — an
 * absent key reads as enabled, so existing users keep the current behavior. The
 * manual "Check for updates" button in About always works regardless of this.
 */
const KEY = 'cfbhub.checkUpdatesOnStartup';

export function getCheckUpdatesOnStartup(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setCheckUpdatesOnStartup(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? 'true' : 'false');
  } catch {
    /* non-fatal */
  }
}
