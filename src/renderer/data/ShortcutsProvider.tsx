import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  comboFromEvent,
  effectiveCombo,
  loadShortcuts,
  saveShortcuts,
  type ShortcutBindings,
} from '../lib/shortcutPrefs';
import { SHORTCUT_TARGETS, resolveTargetPath } from '../lib/shortcutTargets';
import { useTheme } from '../theme/ThemeProvider';

interface ShortcutsContextValue {
  /**
   * targetId -> combo, AS STORED: an absent id means "use the default" and ''
   * means "the user cleared it". Read it through `comboFor`, never directly,
   * or a defaulted row will look unbound.
   */
  bindings: ShortcutBindings;
  /** What a target is actually on right now, default and clears resolved. */
  comboFor: (targetId: string) => string | null;
  /** Binds a combo to a target, taking it off whatever else held it. */
  bind: (targetId: string, combo: string) => void;
  unbind: (targetId: string) => void;
  /** Back to the shipped state — defaults restored, everything else unbound. */
  clearAll: () => void;
  /** How many targets are bound right now, defaults included. */
  boundCount: number;
  /** True when anything differs from the shipped state — drives the reset button. */
  isCustomised: boolean;
  /** The target currently holding this combo, if any — drives the conflict warning. */
  targetHolding: (combo: string) => string | null;
  /** Suspends dispatch while the editor is recording, so the keys being captured don't also navigate. */
  setCapturing: (capturing: boolean) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

/**
 * True when the keystroke belongs to something the user is typing into, rather
 * than to the page. Without this a shortcut would fire mid-word in a note, a
 * search box or a rating field — and the app is full of all three.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Runs the app's keyboard shortcuts — the one that ships bound, and every one
 * the user has assigned.
 *
 * No DESTINATION is bound out of the box (see shortcutTargets.ts for why), so
 * for most of the catalogue this is inert until someone opens the editor. It
 * listens once at the document rather than per-page, because the whole point is
 * that a shortcut works from wherever you happen to be.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadShortcuts());
  const [capturing, setCapturing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleAppearance } = useTheme();

  /** targetId -> live combo, defaults and clears resolved. The one source both halves read. */
  const live = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of SHORTCUT_TARGETS) {
      const combo = effectiveCombo(bindings, target);
      if (combo) map.set(target.id, combo);
    }
    return map;
  }, [bindings]);

  const comboFor = useCallback((targetId: string) => live.get(targetId) ?? null, [live]);

  // The dynasty in view, so a dynasty-scoped target knows which one it means.
  const dynastyId = useMemo(() => {
    const match = location.pathname.match(/^\/dynasty\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const persist = useCallback((next: ShortcutBindings) => {
    setBindings(next);
    saveShortcuts(next);
  }, []);

  const bind = useCallback(
    (targetId: string, combo: string) => {
      const next = { ...bindings };
      /*
        One combo, one target: whoever held it loses it, rather than both firing
        and the winner depending on object key order.

        Checked against the LIVE map, not the stored one, because a default
        holder has no stored entry to delete — dropping keys from `bindings`
        would leave Ctrl+Shift+Z still resolving to the theme toggle after the
        user moved it to Roster, and both would fire. Taking a combo off a
        defaulted target is exactly what the tombstone is for.
      */
      for (const [id, existing] of live) {
        if (id !== targetId && existing === combo) next[id] = '';
      }
      next[targetId] = combo;
      persist(next);
    },
    [bindings, live, persist],
  );

  // A tombstone rather than a delete: on a target with a default, deleting the
  // entry means "use the default", which would put the shortcut straight back.
  const unbind = useCallback(
    (targetId: string) => persist({ ...bindings, [targetId]: '' }),
    [bindings, persist],
  );

  const clearAll = useCallback(() => persist({}), [persist]);

  const targetHolding = useCallback(
    (combo: string) => [...live].find(([, c]) => c === combo)?.[0] ?? null,
    [live],
  );

  useEffect(() => {
    // While the editor is recording a combo, the keystroke is the user telling
    // us what to bind — not asking us to go somewhere.
    if (capturing) return;
    if (live.size === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const combo = comboFromEvent(event);
      if (!combo) return;
      const targetId = [...live].find(([, c]) => c === combo)?.[0];
      if (!targetId) return;
      const target = SHORTCUT_TARGETS.find((t) => t.id === targetId);
      if (!target) return;

      if (target.kind === 'action') {
        event.preventDefault();
        // The switch is exhaustive over ShortcutAction, so adding an action
        // without handling it here is a compile error rather than a dead key.
        switch (target.action) {
          case 'toggle-appearance':
            toggleAppearance();
            break;
        }
        return;
      }

      const path = resolveTargetPath(target, dynastyId);
      // A dynasty page with no dynasty open resolves to nothing. Doing nothing
      // is right: picking one for them would be a guess.
      if (!path) return;
      event.preventDefault();
      navigate(path);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [live, capturing, dynastyId, navigate, toggleAppearance]);

  const boundCount = live.size;
  // Compared against the SHIPPED state, so "reset" only offers itself when
  // there is something to undo — a fresh install has one binding and nothing
  // to reset.
  const isCustomised = Object.keys(bindings).length > 0;

  const value = useMemo<ShortcutsContextValue>(
    () => ({ bindings, comboFor, bind, unbind, clearAll, boundCount, isCustomised, targetHolding, setCapturing }),
    [bindings, comboFor, bind, unbind, clearAll, boundCount, isCustomised, targetHolding],
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error('useShortcuts must be used within a ShortcutsProvider');
  return ctx;
}
