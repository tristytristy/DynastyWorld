import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  comboFromEvent,
  loadShortcuts,
  saveShortcuts,
  type ShortcutBindings,
} from '../lib/shortcutPrefs';
import { SHORTCUT_TARGETS, resolveTargetPath } from '../lib/shortcutTargets';

interface ShortcutsContextValue {
  /** targetId -> combo. Empty until the user binds something; nothing ships bound. */
  bindings: ShortcutBindings;
  /** Binds a combo to a target, taking it off whatever else held it. */
  bind: (targetId: string, combo: string) => void;
  unbind: (targetId: string) => void;
  clearAll: () => void;
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
 * Runs the user's own keyboard shortcuts.
 *
 * Nothing is bound out of the box (see shortcutTargets.ts for why), so this is
 * inert until someone opens the editor and assigns something. It listens once
 * at the document rather than per-page, because the whole point is that a
 * shortcut works from wherever you happen to be.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadShortcuts());
  const [capturing, setCapturing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
      const next: ShortcutBindings = {};
      // One combo, one destination: whoever held it loses it, rather than both
      // firing and the winner depending on object key order.
      for (const [id, existing] of Object.entries(bindings)) {
        if (existing !== combo) next[id] = existing;
      }
      next[targetId] = combo;
      persist(next);
    },
    [bindings, persist],
  );

  const unbind = useCallback(
    (targetId: string) => {
      const next = { ...bindings };
      delete next[targetId];
      persist(next);
    },
    [bindings, persist],
  );

  const clearAll = useCallback(() => persist({}), [persist]);

  const targetHolding = useCallback(
    (combo: string) => Object.entries(bindings).find(([, c]) => c === combo)?.[0] ?? null,
    [bindings],
  );

  useEffect(() => {
    // While the editor is recording a combo, the keystroke is the user telling
    // us what to bind — not asking us to go somewhere.
    if (capturing) return;
    if (Object.keys(bindings).length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const combo = comboFromEvent(event);
      if (!combo) return;
      const targetId = Object.entries(bindings).find(([, c]) => c === combo)?.[0];
      if (!targetId) return;
      const target = SHORTCUT_TARGETS.find((t) => t.id === targetId);
      if (!target) return;
      const path = resolveTargetPath(target, dynastyId);
      // A dynasty page with no dynasty open resolves to nothing. Doing nothing
      // is right: picking one for them would be a guess.
      if (!path) return;
      event.preventDefault();
      navigate(path);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bindings, capturing, dynastyId, navigate]);

  const value = useMemo<ShortcutsContextValue>(
    () => ({ bindings, bind, unbind, clearAll, targetHolding, setCapturing }),
    [bindings, bind, unbind, clearAll, targetHolding],
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

export function useShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error('useShortcuts must be used within a ShortcutsProvider');
  return ctx;
}
