import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { NetSettings } from '../../shared/netTypes';

/**
 * DynastyNet settings — the Anthropic API key, kept main-process-side in
 * userData (never sent to the renderer beyond a has-key flag). The Net works
 * without one: the offline template engine writes the posts instead, so the
 * key is strictly the opt-in "make it come alive" upgrade.
 */

const FILE = 'dynastynet-settings.json';

function settingsPath(): string {
  return path.join(app.getPath('userData'), FILE);
}

interface StoredSettings {
  apiKey?: string;
}

function read(): StoredSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as StoredSettings;
  } catch {
    return {};
  }
}

export function getApiKey(): string {
  return read().apiKey ?? '';
}

export function setApiKey(apiKey: string): void {
  const next: StoredSettings = { ...read(), apiKey: apiKey.trim() };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

/** The renderer-safe view: whether a key exists, never the key itself. */
export function getPublicSettings(): NetSettings {
  const key = getApiKey();
  return { apiKey: '', hasKey: key.length > 0 };
}
