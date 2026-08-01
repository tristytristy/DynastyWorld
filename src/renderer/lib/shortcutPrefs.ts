/**
 * User-defined keyboard shortcuts — the bindings themselves, and the rules for
 * what counts as one.
 *
 * Stored per-machine in localStorage alongside the other preferences rather
 * than in the archive: a shortcut is about how this person drives this install,
 * not about the dynasty, and syncing them into the database would carry one
 * user's muscle memory into someone else's copy of a shared save.
 */
const STORAGE_KEY = 'dynastyos.shortcuts.v1';

/** A binding is stored as its canonical combo string, e.g. "Ctrl+Shift+R". */
export type ShortcutBindings = Record<string, string>;

/**
 * Combinations the app already owns. Offering these would let someone bind over
 * a behaviour they can't get back from this panel — so the recorder rejects
 * them by name instead of silently creating a conflict the user then has to
 * diagnose.
 */
export const RESERVED_COMBOS: Record<string, string> = {
  'Ctrl+K': 'Global search',
  'Meta+K': 'Global search',
  Escape: 'Close the open panel',
  'Shift+ArrowLeft': 'Previous team',
  'Shift+ArrowRight': 'Next team',
};

/** Modifier-only presses aren't a shortcut; they're the user still on their way to one. */
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS']);

/**
 * A canonical, comparable string for a key event. Order is fixed
 * (Ctrl→Meta→Alt→Shift→key) so the same physical combination always produces
 * the same string no matter which modifier was pressed first.
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.metaKey) parts.push('Meta');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  // Single characters normalise to upper case so "r" and "R" are one binding;
  // named keys (ArrowLeft, F5, Escape) already have a stable spelling.
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join('+');
}

/** How a combo is written for the user — the platform's own symbols on a Mac. */
export function formatCombo(combo: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  if (!isMac) return combo.replace(/\+/g, ' + ');
  return combo
    .replace('Ctrl', '⌃')
    .replace('Meta', '⌘')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, '');
}

/**
 * A bare letter is not acceptable as a shortcut. The app is full of text
 * fields, and while the dispatcher already ignores typing, a binding of "R"
 * would still fire from every non-input surface — including the moment someone
 * expects a page to be inert. Requiring a modifier keeps shortcuts deliberate.
 */
export function isBindableCombo(combo: string): { ok: true } | { ok: false; reason: string } {
  if (RESERVED_COMBOS[combo]) {
    return { ok: false, reason: `${formatCombo(combo)} is already ${RESERVED_COMBOS[combo]}.` };
  }
  const hasModifier = /^(Ctrl|Meta|Alt)\+/.test(combo) || combo.includes('+Alt+');
  const isFunctionKey = /^F\d{1,2}$/.test(combo.split('+').pop() ?? '');
  if (!hasModifier && !isFunctionKey) {
    return { ok: false, reason: 'Add Ctrl, Alt or Cmd — a bare key would fire while you were reading a page.' };
  }
  return { ok: true };
}

export function loadShortcuts(): ShortcutBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ShortcutBindings = {};
    for (const [id, combo] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof combo === 'string' && combo.length > 0) out[id] = combo;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveShortcuts(bindings: ShortcutBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // A full or blocked localStorage shouldn't take the app down; the shortcuts
    // simply won't survive the session.
  }
}
