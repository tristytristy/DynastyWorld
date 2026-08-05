import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaFraming } from '../../../shared/types';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const STEP = 0.02;
/** How much one wheel notch moves the zoom. Roughly a tenth of the range, so a flick crosses it and a nudge is still fine-grained. */
const WHEEL_STEP = 0.35;

const UNFRAMED: MediaFraming = { x: 0, y: 0, scale: 1 };

/** The whole photo, in effect — a framing this close to unzoomed isn't worth storing as one. */
function isUnframed(framing: MediaFraming): boolean {
  return framing.scale <= 1.001 && Math.abs(framing.x) < 0.001 && Math.abs(framing.y) < 0.001;
}

function same(a: MediaFraming, b: MediaFraming): boolean {
  return Math.abs(a.x - b.x) < 0.0005 && Math.abs(a.y - b.y) < 0.0005 && Math.abs(a.scale - b.scale) < 0.005;
}

/**
 * Turns a framing into a CSS transform.
 *
 * PERCENTAGES, NOT PIXELS, and that is the whole reason a framing is portable.
 * A `translate()` percentage resolves against the element's own box, so the same
 * three numbers describe the same crop whether the photo is filling a 4K viewer
 * or sitting in a 240px thumbnail. Shared with the grid tiles, which is where it
 * has to hold up.
 */
export function framingTransform(framing: MediaFraming | null | undefined): string | undefined {
  if (!framing || isUnframed(framing)) return undefined;
  return `translate(${framing.x * 100}%, ${framing.y * 100}%) scale(${framing.scale})`;
}

/**
 * A photo you can zoom into, drag around, and keep that way — the trading
 * card's framing control, brought to the media viewers (user request,
 * 2026-07-30) and made persistent (2026-07-30, follow-up).
 *
 * SAME GESTURE AS THE CARD, DELIBERATELY. Same 1×–5× range, same 0.02 step, same
 * team-coloured track, and drag-to-move once you're past 1×. Someone who has
 * framed a card photo already knows how to use this.
 *
 * SAVING KEEPS THE ORIGINAL. `Save framing` writes three numbers next to the
 * media row; the file on disk is never re-encoded, re-cropped or rewritten, and
 * `Reset` gives the whole frame back. That is what lets the same shot sit
 * cropped one way in the gallery and another way on a trading card — a card
 * copies the file into its own folder and stores its own pan/zoom, so the two
 * were always independent and keeping this as metadata is what preserves that.
 *
 * TRANSIENT UNTIL SAVED. Zooming to read a scoreboard shouldn't quietly become
 * how that photo looks forever, so nothing persists until asked. Moving to
 * another photo drops an unsaved zoom and picks up that photo's own saved
 * framing — `src` changing is the reset, which also covers Prev/Next swapping
 * the image under an open viewer.
 *
 * Renders as a fragment — the image layer, then the control pill. The parent
 * stage must be `relative` and `overflow-hidden`; a zoomed photo has to be
 * clipped by something, and that something is the stage it lives in.
 */
export function ZoomableImage({
  src,
  alt,
  saved,
  onSave,
  filter,
}: {
  src: string;
  alt: string;
  /** The framing stored for this photo, if any — where the viewer opens. */
  saved?: MediaFraming | null;
  /** Omit to make the viewer look-only: the zoom still works, it just can't be kept. */
  onSave?: (framing: MediaFraming | null) => void;
  /**
   * A CSS `filter` chain to draw the photo under — the media darkroom's colour
   * treatment. It has to be passed IN rather than applied by the caller to the
   * stage, because this component owns the <img>: filtering the stage instead
   * would also filter the zoom pill sitting on top of it.
   */
  filter?: string;
}) {
  const savedFraming = saved ?? UNFRAMED;
  const [framing, setFraming] = useState<MediaFraming>(savedFraming);
  const framingRef = useRef(framing);
  framingRef.current = framing;
  const imgRef = useRef<HTMLImageElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  // A different photo is a different framing question: drop anything unsaved and
  // open on whatever that photo keeps.
  useEffect(() => {
    setFraming(saved ?? UNFRAMED);
    setJustSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  /**
   * Keeps the photo covering its box. At scale `s` it overhangs by `(s-1)/2`
   * each way, and since the offsets are fractions of the photo's own size that
   * bound is a plain number — nothing to measure, and it holds at every render
   * size. You can reach every edge and never drag into blank space.
   */
  const clamp = useCallback((next: MediaFraming): MediaFraming => {
    if (next.scale <= 1) return { x: 0, y: 0, scale: next.scale };
    const limit = (next.scale - 1) / 2;
    return {
      scale: next.scale,
      x: Math.max(-limit, Math.min(limit, next.x)),
      y: Math.max(-limit, Math.min(limit, next.y)),
    };
  }, []);

  const zoomTo = useCallback(
    (scale: number) => {
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      setFraming((prev) => clamp({ ...prev, scale: clamped }));
      setJustSaved(false);
    },
    [clamp],
  );

  // --- Drag to move ---
  // The gesture arrives in screen pixels and the framing is stored in fractions,
  // so the photo's own rendered size is what converts between them.
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; w: number; h: number } | null>(
    null,
  );
  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setFraming((prev) =>
        clamp({
          ...prev,
          x: drag.origX + (event.clientX - drag.startX) / drag.w,
          y: drag.origY + (event.clientY - drag.startY) / drag.h,
        }),
      );
    },
    [clamp],
  );
  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );
  function onPointerDown(event: React.PointerEvent) {
    const img = imgRef.current;
    if (!img || framingRef.current.scale <= 1) return; // nothing to move at fit-to-stage
    event.preventDefault();
    setJustSaved(false);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: framingRef.current.x,
      origY: framingRef.current.y,
      w: img.offsetWidth,
      h: img.offsetHeight,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // --- Wheel to zoom ---
  // Attached by hand rather than as an `onWheel` prop, and that is not a style
  // choice: React registers `wheel` on its root as a PASSIVE listener, so
  // `preventDefault()` inside a JSX handler is silently ignored (with a console
  // warning) and the page behind this overlay scrolls away underneath the photo.
  // A non-passive listener on the element itself is the only version that works.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTo(framingRef.current.scale + (event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  const zoomed = framing.scale > 1;
  /*
    THE RULE-OF-THIRDS GRID (user direction) — off by default, because it is a
    tool for composing a crop and not something to look at a photograph
    through. Local to the viewer rather than saved: it guides the framing, it
    is not part of it, and nothing about the photograph changes when it is on.
  */
  const [showThirds, setShowThirds] = useState(false);

  const dirty = !same(framing, savedFraming);
  const hasSaved = Boolean(saved) && !isUnframed(savedFraming);

  function save() {
    // An unzoomed "framing" is stored as no framing at all, so the row goes back
    // to meaning "the whole photo" rather than carrying a no-op crop.
    onSave?.(isUnframed(framing) ? null : framing);
    setJustSaved(true);
  }

  return (
    <>
      <div
        ref={stageRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        // Back to fit. The fastest way out of a zoom you didn't mean.
        onDoubleClick={() => {
          setFraming(UNFRAMED);
          setJustSaved(false);
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onPointerDown={onPointerDown}
          className={`max-h-[70vh] max-w-full select-none object-contain ${zoomed ? 'cursor-move touch-none' : ''}`}
          style={{
            transform: `translate(${framing.x * 100}%, ${framing.y * 100}%) scale(${framing.scale})`,
            transformOrigin: 'center',
            filter: filter || undefined,
          }}
        />
      </div>

      {/* Drawn over the stage, not over the IMAGE, so the lines stay put while
          the photo pans and zooms underneath them — a grid that moved with the
          crop would be measuring the wrong thing. */}
      {showThirds && (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
          {[1, 2].map((n) => (
            <span
              key={`v${n}`}
              className="absolute inset-y-0 w-px bg-white/45 mix-blend-difference"
              style={{ left: `${(n * 100) / 3}%` }}
            />
          ))}
          {[1, 2].map((n) => (
            <span
              key={`h${n}`}
              className="absolute inset-x-0 h-px bg-white/45 mix-blend-difference"
              style={{ top: `${(n * 100) / 3}%` }}
            />
          ))}
        </div>
      )}

      {/* Sits with the counter along the bottom of the stage, in the same
          quiet dark pill — a control that belongs to the photo, not chrome
          competing with it.

          CENTRED, NOT LEFT (user direction). The bottom-left corner is where
          the plate prints the program's mark, so the pill sat on top of the
          team logo and the two fought over the same corner. The middle of the
          bottom edge is the one place along it that no caption furniture
          claims. `-translate-x-1/2` rather than a flex parent so the pill keeps
          sizing to its own contents — it grows when the framing buttons appear
          and must stay centred when it does. */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 bg-slate-950/70 px-2.5 py-1 text-slate-200">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3M8 11h6" strokeLinecap="round" />
        </svg>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={STEP}
          value={framing.scale}
          onChange={(event) => zoomTo(Number(event.target.value))}
          aria-label="Zoom photo"
          className="w-28 accent-[var(--team-primary)]"
        />
        <span className="tnum w-10 text-right text-xs">{Math.round(framing.scale * 100)}%</span>

        {/* Only where framing is possible: on a viewer that cannot crop, a
            composition guide is a grid over someone's photograph for no
            reason. */}
        {onSave && (
          <button
            type="button"
            onClick={() => setShowThirds((v) => !v)}
            aria-pressed={showThirds}
            title={showThirds ? 'Hide the rule-of-thirds grid' : 'Show the rule-of-thirds grid'}
            aria-label="Rule-of-thirds grid"
            className={`ml-1 border-l border-white/20 pl-2 transition-colors ${
              showThirds ? 'text-[var(--team-primary)]' : 'text-slate-300 hover:text-white'
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
              <rect x="2" y="2" width="16" height="16" />
              <path d="M7.33 2v16M12.67 2v16M2 7.33h16M2 12.67h16" />
            </svg>
          </button>
        )}

        {/* Only where framing can be kept, and only once there's something to
            keep or to undo — a Save that is permanently there invites the
            question of what it would even do. */}
        {onSave && (dirty || hasSaved) && (
          <span className="ml-1 flex items-center gap-1.5 border-l border-white/20 pl-2">
            {dirty && (
              <button
                type="button"
                onClick={save}
                title="Keep this framing for this photo. The original file isn't changed."
                className="text-xs font-semibold text-[var(--team-primary)] transition duration-fast ease-standard hover:text-white"
              >
                Save framing
              </button>
            )}
            {hasSaved && (
              <button
                type="button"
                onClick={() => {
                  setFraming(UNFRAMED);
                  onSave(null);
                  setJustSaved(false);
                }}
                title="Show the whole photo again"
                className="text-xs text-slate-300 transition duration-fast ease-standard hover:text-white"
              >
                Reset
              </button>
            )}
            {!dirty && justSaved && <span className="text-xs text-slate-400">Saved</span>}
          </span>
        )}
      </div>
    </>
  );
}
