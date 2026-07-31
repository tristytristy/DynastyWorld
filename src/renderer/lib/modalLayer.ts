import { useEffect, useState } from 'react';

/**
 * Stacking order for overlays, assigned when a modal OPENS rather than
 * hardcoded per component.
 *
 * Every modal used to carry its own `z-[100]` or `z-[110]`, which works right
 * up until two of them are open at once and share a value — then paint order
 * falls back to DOM order, and DOM order is decided by where each provider
 * happens to sit in app.tsx. That's how opening a player from the game box
 * score put the player card BEHIND the game modal: both were z-100, and the
 * player modal's provider is mounted first.
 *
 * Depth-on-open is the rule that actually matches intent — whatever you opened
 * last is what you're looking at, however the tree is arranged.
 *
 * The stack holds only OPEN modals, so closing one frees its slot and the
 * numbers can't creep upward over a session. Ones still open keep the depth
 * they were given, which preserves their relative order.
 */
const BASE_Z = 100;
const STEP = 10;

let openStack: number[] = [];
let nextId = 1;

/**
 * @param open whether this overlay is currently rendered
 * @returns the z-index to apply — pass it to `style`, not a Tailwind class,
 *          since the value isn't known at build time.
 */
export function useModalLayer(open: boolean): number {
  const [zIndex, setZIndex] = useState(BASE_Z);

  useEffect(() => {
    if (!open) return undefined;
    const id = nextId++;
    openStack.push(id);
    setZIndex(BASE_Z + openStack.length * STEP);
    return () => {
      openStack = openStack.filter((entry) => entry !== id);
    };
  }, [open]);

  return zIndex;
}
