import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { UpdatePreferences } from '../../shared/updateTypes';

/**
 * The updater's own preferences, owned by the MAIN process.
 *
 * They used to live in the renderer's localStorage, which was fine while the
 * renderer was the thing doing the checking. It isn't any more: the launch
 * check now runs in main, before any renderer has told it anything — so a
 * preference main can't read is a preference that doesn't work. Turning the
 * setting off used to hide the notification while the app still contacted
 * GitHub on every launch, which is not what the setting says it does.
 *
 * One small JSON file next to the database. Read-through-cached because the
 * startup path asks for it before the window is even shown.
 */

const DEFAULTS: UpdatePreferences = { checkOnStartup: true };

let cached: UpdatePreferences | null = null;

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'update-prefs.json');
}

export type { UpdatePreferences };

export function getUpdatePreferences(): UpdatePreferences {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<UpdatePreferences>;
    // Only the shape we understand survives — a hand-edited or half-written
    // file falls back to the default rather than disabling updates by accident.
    cached = { checkOnStartup: parsed.checkOnStartup !== false };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export function setUpdatePreferences(next: Partial<UpdatePreferences>): UpdatePreferences {
  const merged: UpdatePreferences = { ...getUpdatePreferences(), ...next };
  cached = merged;
  try {
    fs.writeFileSync(prefsPath(), JSON.stringify(merged, null, 2));
  } catch {
    // Non-fatal: the setting still applies for this session, it just won't
    // survive a restart. Better than refusing to change it at all.
  }
  return merged;
}
