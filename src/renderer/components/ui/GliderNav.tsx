import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The app's selected-state device for NAVIGATION (2026-07-29): a hairline rail
 * with a lit segment — "the glider" — that slides to whichever item is active.
 * Replaces the solid team-colour fill on every nav row (section bar, hub
 * sub-navs, the sidebar, the player-profile tabs).
 *
 * NAVIGATION ONLY, on purpose. SegmentedControl and PairLayout's toggle keep
 * their filled treatment: they change a *mode*, not a page, and having the two
 * wear different clothes is what tells you which one you're touching.
 *
 * ## Why this is measured in JS rather than done in pure CSS
 *
 * A pure-CSS version of this exists — radio inputs plus
 * `input:nth-of-type(n):checked ~ .glider` sibling selectors, with the glider
 * sized `100% / --total-radio` and moved `translate(n * 100%)`. Three reasons it
 * can't be used here, and the third is fatal:
 *
 *  1. Our nav items are router `<Link>`/`<NavLink>` anchors, not radio inputs —
 *     they have to stay anchors for routing, keyboard and middle-click.
 *  2. `--total-radio` is hand-maintained, and the sidebar's list is data-driven.
 *  3. **The fixed fraction assumes every item is the same size.** Our tabs are
 *     words of different lengths ("Coach" vs "Recruiting"), and the sidebar's
 *     rows are two different heights. A glider sized to a fraction of the row
 *     could never sit under the active item.
 *
 * So the *look* is CSS (see `.glider-nav` in globals.css) and only the geometry
 * is measured here: the active child's offset and length go out as CSS custom
 * properties and the stylesheet does the rest. That also makes variable-width
 * items and dynamic lists work for free.
 *
 * ## Layout contract
 *
 * Items go in an inner flex row/column; the rail and the glider are absolutely
 * positioned siblings of it. Keep any trailing controls (a season switcher, a
 * search box) OUTSIDE this component — the rail should span the tabs, not the
 * whole width of the bar. If the row needs to scroll, put `overflow-x-auto` on
 * a wrapper *around* GliderNav rather than on it: the rail is positioned in the
 * item row's own coordinates, so it then scrolls with the tabs instead of
 * staying pinned to the visible edge.
 */
export function GliderNav({
  activeIndex,
  orientation = 'horizontal',
  emphasis = 'primary',
  className = '',
  itemsClassName = '',
  ariaLabel,
  itemsRole,
  itemsId,
  children,
}: {
  /** Index of the active child, or -1 for none (the glider hides). */
  activeIndex: number;
  orientation?: 'horizontal' | 'vertical';
  /** `quiet` drops the bloom and thins the segment — for a sub-nav sitting under a primary one. */
  emphasis?: 'primary' | 'quiet';
  className?: string;
  itemsClassName?: string;
  ariaLabel?: string;
  /**
   * ARIA role for the ITEM CONTAINER. Nav rows need none (the links speak for
   * themselves), but a dropdown's rows are `option`s and their container has to
   * be the `listbox` — otherwise the glider's own wrapper silently breaks the
   * required parent/child pairing. See ui/Select.tsx.
   */
  itemsRole?: 'listbox';
  itemsId?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const count = Children.count(children);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const items = itemsRef.current;
    if (!root || !items) return;

    const element = items.children[activeIndex] as HTMLElement | undefined;
    if (activeIndex < 0 || !element) {
      root.style.setProperty('--glider-opacity', '0');
      return;
    }

    // Rects rather than offsetLeft/offsetTop: offsets are relative to the
    // nearest positioned ancestor, which is this root — but a call site is free
    // to wrap items in extra markup, and a rect difference stays correct
    // whatever the offsetParent chain looks like.
    const itemsRect = items.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    if (orientation === 'horizontal') {
      root.style.setProperty('--glider-offset', `${rect.left - itemsRect.left}px`);
      root.style.setProperty('--glider-size', `${rect.width}px`);
      // Distance from the row's bottom edge to this item's own bottom edge, so a
      // wrapped tab bar underlines the active tab's row instead of the last one.
      root.style.setProperty('--glider-cross', `${itemsRect.bottom - rect.bottom}px`);
    } else {
      root.style.setProperty('--glider-offset', `${rect.top - itemsRect.top}px`);
      root.style.setProperty('--glider-size', `${rect.height}px`);
      // No cross-axis offset in the vertical case: every row shares one spine on
      // the left, indented rows included — that shared line IS the pattern.
    }
    root.style.setProperty('--glider-opacity', '1');
  }, [activeIndex, orientation]);

  useLayoutEffect(() => {
    measure();

    const items = itemsRef.current;
    if (!items || typeof ResizeObserver === 'undefined') return;
    // The row itself catches reflows; each child is observed too, because a
    // label can change width without the row's own box changing (a font
    // finishing loading, a count appearing in a tab).
    const observer = new ResizeObserver(() => measure());
    observer.observe(items);
    for (const child of Array.from(items.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, count]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  // The first measurement must not animate, or the glider flies in from the
  // corner every time a layout mounts. One frame of "no transition" is enough.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`glider-nav ${className}`}
      data-orientation={orientation}
      data-emphasis={emphasis}
      data-ready={ready ? 'true' : 'false'}
    >
      <div
        ref={itemsRef}
        aria-label={ariaLabel}
        role={itemsRole}
        id={itemsId}
        className={`glider-items ${orientation === 'horizontal' ? 'flex items-stretch' : 'flex flex-col'} ${itemsClassName}`}
      >
        {children}
      </div>
      {/*
        The rail and the segment live in their own CLIPPED track, and that clip
        is load-bearing. The easing overshoots (y > 1), so moving to the LAST
        item sends the segment briefly past the row's right edge — which, inside
        a `overflow-x-auto` wrapper, is real scrollable overflow: a scrollbar
        flashed in, stole height, and the whole nav jumped. Reported as "it
        jitters when I pick History", which is the last tab.

        Clipping HERE rather than on the root is what keeps the tabs scrollable:
        the items are siblings of this track, so a nav too wide for its wrapper
        still scrolls normally, while the overshoot has nowhere to spill.
      */}
      <span aria-hidden="true" className="glider-track">
        <span className="glider-rail" />
        <span className="glider-mark" />
      </span>
    </div>
  );
}

/**
 * How a glider nav item looks. The active item is coloured, not filled — the
 * glider is what marks it — and `--glider-label` is the contrast-safe form of
 * the accent (team colour darkened on light, gold on dark; see globals.css).
 *
 * Hover only lifts the text: a hover *background* would read as a competing
 * selection now that selection itself no longer has a background.
 */
/**
 * Which tab a path belongs to, by index. NavLink's own `isActive` can't be used
 * for a positional glider (it's resolved per-link, and the nav needs to know
 * *which* link won), so this reproduces NavLink's matching rule once: `end`
 * means exact, otherwise the path or anything nested under it. Returns -1 for
 * no match, which hides the glider rather than parking it on tab 0.
 */
export function matchTabIndex(
  pathname: string,
  base: string,
  tabs: { to: string; end?: boolean }[],
): number {
  return tabs.findIndex((tab) => {
    const full = `${base}${tab.to}`;
    if (pathname === full || pathname === `${full}/`) return true;
    return !tab.end && pathname.startsWith(`${full}/`);
  });
}

export function gliderItemClass(active: boolean, padding = 'px-3.5 py-2'): string {
  return [
    padding,
    'relative whitespace-nowrap font-display text-sm font-semibold transition-colors duration-base ease-standard',
    active
      ? 'text-[color:var(--glider-label)]'
      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
  ].join(' ');
}
