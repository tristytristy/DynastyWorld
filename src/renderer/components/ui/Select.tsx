import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { GliderNav } from './GliderNav';
import { useModalLayer } from '../../lib/modalLayer';

/**
 * The app's dropdown (2026-07-29, user direction). Replaces the native
 * `<select>`, which could never look like this: a native popup is drawn by
 * WINDOWS, not by the page — no artwork in the rows, no panel styling, no
 * motion, and a highlight colour we don't own. That's the whole reason this
 * exists; it isn't a restyle of a select, it's a listbox.
 *
 * THE HIGHLIGHT IS THE GLIDER. The panel reuses the sidebar's own indicator
 * (GliderNav, vertical) rather than painting a filled row: the lit segment
 * slides between rows as you arrow or hover, at the app's own ease. A dropdown
 * that moves like the side menu belongs to the same app; a dropdown with a blue
 * fill is a component from somewhere else.
 *
 * Everything native gave us for free is re-implemented deliberately here:
 * arrows, Home/End, Enter, Escape, type-ahead, focus return to the trigger, and
 * scrolling the active row into view. Losing those is the real cost of leaving
 * `<select>`, so they are the parts to protect.
 */
export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Art for the left of the row — a team logo, typically. Rendered in both the row and the trigger. */
  icon?: ReactNode;
  /** Muted trailing text on the row (the season switcher's year). */
  meta?: string;
  /** Extra words type-ahead and search should match on beyond `label`. */
  keywords?: string;
}

const PANEL_MAX_HEIGHT = 320;
/** Breathing room the panel keeps from the window edge when it has to be clamped. */
const EDGE_GAP = 8;
/** Below this many options a search field is clutter; above it, scrolling for a school is worse. */
const SEARCH_THRESHOLD = 12;

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Select…',
  className = '',
  searchable,
  searchPlaceholder = 'Type to filter…',
  disabled = false,
  variant = 'bordered',
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  /** Defaults to "only when the list is long" — see SEARCH_THRESHOLD. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  /**
   * `bare` drops the trigger's border and fill — for chrome rows (the nav) where
   * a boxed control reads as heavier than what it does. The PANEL is unaffected:
   * it always needs its edge, since it floats over arbitrary content.
   */
  variant?: 'bordered' | 'bare';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const typeAhead = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const panelWidthRef = useRef(0);
  const listId = useId();
  // The app's depth-on-open stack, not a fixed z-index: a dropdown opened INSIDE
  // a modal takes the next slot above that modal, which is the whole reason the
  // editors' selects will work when they're converted.
  const zIndex = useModalLayer(open);

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const selected = options.find((option) => option.value === value) ?? null;
  /** The panel only exists once a position is known — see the measuring effect below. */
  const isPlaced = rect !== null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      `${option.label} ${option.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  /**
   * Anchored to the trigger and re-measured while open — a panel positioned once
   * detaches from its button the moment anything scrolls. Flips above the
   * trigger when there isn't room below, which is what keeps the switcher usable
   * at the bottom of a page.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const room = window.innerHeight - box.bottom;
    const above = room < Math.min(PANEL_MAX_HEIGHT, 240) && box.top > room;
    // The panel is WIDER than its trigger (search field, logos, long school
    // names), so left-aligning it blindly pushes it off screen for any switcher
    // near the right edge — which is where both of ours live. Clamp to the
    // viewport using the width the panel actually measured on its last open.
    const panelWidth = Math.max(panelWidthRef.current, box.width);
    const left = Math.max(EDGE_GAP, Math.min(box.left, window.innerWidth - panelWidth - EDGE_GAP));
    setRect({
      top: above ? box.top : box.bottom,
      left,
      width: box.width,
      above,
    });
  }, []);

  /*
    The panel's own width has to be OBSERVED, not sampled once.

    Two things went wrong before this: on the first open `rect` is still null, so
    nothing is rendered and a one-shot effect measures a panel that doesn't exist
    (hence `isPlaced` in the deps). And even after it exists, the width
    settles a beat later — the search field, the scrollbar arriving on a 138-team
    list — so the clamp was computed against a stale number and the panel sat
    flush against the window edge anyway. Both were caught by measuring the
    rendered result rather than trusting the code.

    A ResizeObserver fixes both and keeps working while the list FILTERS, where
    the width changes again as rows come and go.
  */
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;

    const sync = () => {
      const measured = panel.getBoundingClientRect().width;
      if (Math.abs(measured - panelWidthRef.current) > 1) {
        panelWidthRef.current = measured;
        place();
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, place, isPlaced]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // `true` = capture, so a scroll in ANY ancestor scroller repositions the
    // panel, not just the window's own.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  // Opening lands on the current value, so the first arrow key steps from where
  // you already are rather than from the top of the list.
  useEffect(() => {
    if (!open) return;
    const index = visible.findIndex((option) => option.value === value);
    setActiveIndex(index === -1 ? 0 : index);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  // Keep the active row on screen when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    const row = panelRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close(restoreFocus = true) {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  }

  function commit(index: number) {
    const option = visible[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  /** Type-ahead for the searchless case — the one native-select habit people notice missing. */
  function jumpToTyped(key: string) {
    const now = Date.now();
    const text = now - typeAhead.current.at > 700 ? key : typeAhead.current.text + key;
    typeAhead.current = { text, at: now };
    const found = visible.findIndex((option) => option.label.toLowerCase().startsWith(text.toLowerCase()));
    if (found !== -1) setActiveIndex(found);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(visible.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(visible.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        // Committing a choice must not also submit the form this dropdown sits
        // in — the editors are full of them.
        event.stopPropagation();
        commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        /*
          STOPS HERE. Every modal in the app closes on Escape via a listener on
          `document` (CenteredModalPanel), and this panel is portalled to <body>,
          so without stopping the event one Escape would close the dropdown AND
          the editor behind it — losing unsaved edits. Escape closes the
          innermost thing, which is this list.
        */
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (!showSearch && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          jumpToTyped(event.key);
        }
    }
  }

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            className={`select-panel corner-cut-sm fixed border border-[color:var(--section-divider)] bg-white dark:bg-black ${
              rect.above ? 'select-panel-above' : ''
            }`}
            style={{
              zIndex,
              top: rect.above ? undefined : rect.top,
              bottom: rect.above ? window.innerHeight - rect.top : undefined,
              left: rect.left,
              minWidth: rect.width,
              maxHeight: PANEL_MAX_HEIGHT,
            }}
            onKeyDown={onKeyDown}
          >
            {showSearch && (
              <div className="border-b border-[color:var(--section-divider)] p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={`${ariaLabel} — filter`}
                  className="w-full bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
            )}

            {/*
              `overflow-x-hidden` is REQUIRED, not tidying. `overflow-y-auto`
              alone makes the other axis compute to `auto` as well, and the
              glider's wash is a fixed 9rem hanging off a 1–2px segment — wider
              than a narrow panel ("All stars"), so it raised a horizontal
              scrollbar on exactly the dropdowns that needed one least. The wash
              is a fade; clipping it at the panel edge costs nothing.
            */}
            <div className="max-h-[16rem] overflow-y-auto overflow-x-hidden overscroll-contain py-1">
              {visible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No matches.</p>
              ) : (
                <GliderNav
                  activeIndex={activeIndex}
                  orientation="vertical"
                  emphasis="quiet"
                  ariaLabel={ariaLabel}
                  itemsRole="listbox"
                  itemsId={listId}
                >
                  {visible.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      data-index={index}
                      data-select-option={option.value}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => commit(index)}
                      className={`flex w-full items-center gap-2.5 py-2 pl-4 pr-3 text-left text-sm transition-colors duration-fast ${
                        index === activeIndex
                          ? 'text-[color:var(--glider-label)]'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {option.icon}
                      <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                      {option.meta && (
                        <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {option.meta}
                        </span>
                      )}
                    </button>
                  ))}
                </GliderNav>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        data-select-root={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onKeyDown}
        /*
          Chrome borders are the SECTION DIVIDER colour, not a slate step (user
          direction): the dropdown's edges now read at the same weight as the
          hairlines between sections, so a panel floating over the page belongs
          to the same drawing rather than announcing itself with a heavier frame.
        */
        className={`inline-flex items-center gap-2.5 py-2 pl-3 pr-2.5 font-display text-sm font-semibold text-slate-700 transition-colors duration-base ease-standard disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 ${
          variant === 'bordered'
            ? 'border border-[color:var(--section-divider)] bg-white/90 hover:border-[color:color-mix(in_srgb,var(--team-primary)_55%,transparent)] dark:bg-black'
            : 'hover:text-slate-950 dark:hover:text-white'
        } ${className}`}
      >
        {selected?.icon}
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
        {selected?.meta && (
          <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">{selected.meta}</span>
        )}
        <Chevron open={open} />
      </button>
      {panel}
    </>
  );
}

/** Rotates rather than swapping glyphs, so opening reads as one motion. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-base ease-standard dark:text-slate-500 ${
        open ? 'rotate-180' : ''
      }`}
    >
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
