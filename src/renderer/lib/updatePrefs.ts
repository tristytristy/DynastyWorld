import type { UpdatePreferences } from '../../shared/updateTypes';

/**
 * The renderer's window onto the updater's settings.
 *
 * THEY LIVE IN THE MAIN PROCESS NOW. They used to be a localStorage flag, which
 * worked while the renderer did the checking — but the launch check runs in
 * main, before any renderer has said anything, so a setting main can't read is
 * a setting that doesn't do what it claims. Off now means no request at all.
 */

/** The old localStorage flag. Kept only long enough to carry an existing choice across. */
const LEGACY_KEY = 'cfbhub.checkUpdatesOnStartup';

export async function getUpdatePrefs(): Promise<UpdatePreferences> {
  return window.api.update.getPrefs();
}

export async function setCheckUpdatesOnStartup(value: boolean): Promise<UpdatePreferences> {
  return window.api.update.setPrefs({ checkOnStartup: value });
}

/**
 * Carries a pre-existing "don't check on startup" choice into the main-process
 * store, once, then removes the old key.
 *
 * Without this, everyone who had deliberately turned the check off would have
 * it silently turned back on by the upgrade — the app would start phoning
 * GitHub again on launch, which is exactly the thing they opted out of. Only an
 * explicit `false` migrates; an absent key means they never chose, and the
 * default already covers that.
 */
export async function migrateLegacyUpdatePref(): Promise<void> {
  let legacy: string | null = null;
  try {
    legacy = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (legacy === null) return;

  try {
    if (legacy === 'false') await setCheckUpdatesOnStartup(false);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* non-fatal — it just gets retried next launch */
  }
}
