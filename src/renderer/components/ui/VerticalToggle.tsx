import { useRef, useState } from 'react';
import { GRADIENT_SURFACE } from '../../lib/gradients';

/**
 * A VERTICAL three-position switch — the app's toggle language, stood on end.
 *
 * Why this exists rather than a third label on the horizontal one: a toggle is a
 * thing with two ends and a knob that travels between them, and widening that to
 * three gives you a knob that stops in the middle — a control that looks like the
 * app's switches and doesn't behave like one. Vertical solves it honestly. The
 * knob still travels end to end; there is simply a stop on the way, and a list
 * read top to bottom carries three items without any of them looking like a
 * midpoint between the others.
 *
 * EVERYTHING ELSE IS THE HORIZONTAL SWITCH'S. Same rail — rounded, hairline
 * border at the same weights, the same GRADIENT_SURFACE fill. Same knob
 * overhang: the knob is deliberately much larger than the rail is wide, so it
 * stands proud of it on both sides, which is the look. Same accent ring on the
 * rail. The only differences are the axis and that the mark riding the knob is a
 * fixed piece of art rather than a team logo, because this switch is app chrome
 * — it changes which unit you are looking at, not whose.
 */

const ROW_H = 46;
const KNOB = 27;
const RAIL_W = 22;

export function VerticalToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  /** Top to bottom. Three is the shape this was drawn for; two or four work. */
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const railH = ROW_H * options.length;

  /*
    DRAGGABLE, and it snaps.

    A knob that only teleports when you click a label is a radio group wearing a
    switch's clothes. Grabbing it and pulling is the thing the control looks like
    it can do, so it does it.

    `drag` holds the live pixel offset while the pointer is down and null the
    rest of the time — which is also what turns the CSS transition off mid-drag
    (a 300ms ease between every pointermove would lag the knob behind the finger)
    and back on for the snap, so the release animates home.

    Pointer capture, not window listeners: the browser then routes every move and
    the release to this element even when the pointer leaves it, which is most of
    a drag. It also means no listener can outlive the component.
  */
  const [drag, setDrag] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /** Pointer Y → the row it is over, clamped to the ends. */
  const indexAt = (clientY: number): number => {
    const rail = railRef.current;
    if (!rail) return index;
    const offset = clientY - rail.getBoundingClientRect().top;
    return Math.min(options.length - 1, Math.max(0, Math.floor(offset / ROW_H)));
  };
  /*
    The knob's travel, and the arithmetic is worth stating because getting it
    wrong is invisible until you look at it: it starts 1px ABOVE the rail and
    ends 1px below, so the overhang is symmetric at both ends exactly as it is
    on the horizontal switch. Each stop is then centred on its own row.
  */
  const top = index * ROW_H + (ROW_H - KNOB) / 2;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative inline-flex select-none items-start gap-3"
    >
      {/* The rail. The KNOB is draggable; the labels beside it are the click
          targets, which are far bigger things to aim at than a 22px bar. */}
      <div
        /* NO ACCENT RING. The horizontal switch wears one only in its ON state,
           as the thing that says "on" — a switch that is always in one of three
           positions has no off state for a ring to distinguish, so a permanent
           one is just a bright blue outline around a piece of chrome. The rail
           is the same dark surface and hairline border the horizontal switch
           wears at rest, and nothing more. */
        className={[
          'relative shrink-0 rounded-full border',
          'border-slate-200/80 dark:border-white/10',
          GRADIENT_SURFACE,
        ].join(' ')}
        ref={railRef}
        style={{ width: RAIL_W, height: railH }}
      >
        {/*
          `max-w-none` is load-bearing. Tailwind's preflight sets
          `img { max-width: 100% }`, and this image's containing block is the
          22px RAIL - so the knob was being clamped to 22px wide while keeping
          its 34px height, i.e. squeezed into an oval. The art is square
          (1254×1254); the distortion was entirely CSS.
        */}
        <img
          src="assets/UI/gold3DtoggleBall.webp"
          alt=""
          draggable={false}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(e.clientY);
          }}
          onPointerMove={(e) => {
            if (drag === null) return;
            setDrag(e.clientY);
            /* Commits DURING the drag, not only on release, so the board behind
               follows the knob rather than waiting for you to let go. Guarded on
               a real change, or every pointermove would fire onChange. */
            const next = options[indexAt(e.clientY)];
            if (next && next.value !== value) onChange(next.value);
          }}
          onPointerUp={(e) => {
            if (drag !== null) onChange(options[indexAt(e.clientY)].value);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
          className={[
            'absolute max-w-none touch-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]',
            drag === null ? 'cursor-grab transition-[top] duration-300 ease-out' : 'cursor-grabbing',
            'motion-reduce:transition-none',
          ].join(' ')}
          /* While dragging the knob follows the pointer to the pixel, clamped to
             the rail; released, `top` returns to the snapped stop and the
             transition (back on now) carries it home. */
          style={{
            width: KNOB,
            height: KNOB,
            top:
              drag === null
                ? top
                : Math.min(
                    railH - KNOB,
                    Math.max(0, drag - (railRef.current?.getBoundingClientRect().top ?? 0) - KNOB / 2),
                  ),
            left: (RAIL_W - KNOB) / 2,
          }}
        />
      </div>

      <div className="flex flex-col">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              /* Each label owns its whole row height, so the clickable area
                 lines up with the stop the knob travels to rather than being a
                 word floating next to it. */
              className={[
                'flex items-center whitespace-nowrap text-left text-sm font-semibold uppercase tracking-wide transition-colors duration-150',
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
              ].join(' ')}
              style={{ height: ROW_H }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
