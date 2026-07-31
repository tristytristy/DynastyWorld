# Glider — the selected-item indicator

**InnerActivity component spec.** A hairline rail with a lit segment that slides
to whichever item is active. It is the app's one selected-state device for
**navigation**: tab bars, sidebars, and the rows inside a dropdown or palette.

It replaces the filled tab. Nothing is highlighted with a solid block — the
segment moving to meet you is the highlight, which is quieter to look at and
reads as one continuous surface rather than a strip of buttons.

**Where it runs today:** top section bar, hub sub-navs, the sidebar's dynasty
list, the player-profile tabs, and every dropdown/command-palette row group.

---

## Anatomy

```
┌──────────────────────────────────────────────┐
│  Coach   Program   NCAA   Recruiting  Media  │  ← items (real links/buttons)
│ ─────────▔▔▔▔▔▔▔───────────────────────────  │  ← rail + segment
└──────────────────────────────────────────────┘
```

Four parts:

| Part | Role |
|---|---|
| **Items** | Real anchors/buttons. Never radio inputs — routing, keyboard and middle-click have to keep working. |
| **Rail** | A 1px groove spanning the whole row, faded at both ends. Present always. |
| **Segment** | The lit part, sized and positioned to the active item. |
| **Track** | An absolutely positioned, `overflow: hidden` box holding rail + segment. |

**The track is load-bearing** — see *Overshoot must be clipped* below.

---

## Geometry is measured, not fractional

The segment's position and length come from measuring the active item and
pushing three custom properties:

```
--glider-offset   distance from the row's start to the active item
--glider-size     the active item's length
--glider-cross    (horizontal only) distance from the row's bottom to the item's
                  bottom, so a WRAPPED row underlines the active item's own line
```

A fraction-based version (`100% / item-count`, `translate(n * 100%)`) is
tempting and cannot work here, for a reason worth stating plainly: **it assumes
every item is the same size.** Real items are words of different lengths
("Coach" vs "Recruiting") and rows of different heights (a sidebar's index row
vs its indented children). Measuring also makes dynamic lists work for free.

Measure with `getBoundingClientRect()` differences rather than `offsetLeft` —
offsets are relative to the nearest positioned ancestor, and a call site is free
to wrap items in extra markup.

Re-measure on: active-item change, item-count change, a **ResizeObserver** on the
row *and each item* (a label can change width without the row's box changing —
a font finishing loading, a count appearing in a tab), and window resize.

---

## Required tokens

The component consumes these; supply them from your own theme.

```css
--duration-fast   /* ~120ms — opacity                     */
--duration-slow   /* ~260ms — travel                      */
--ease-enter      /* standard entrance curve              */
--team-primary    /* the brand/context accent             */
--team-accent-text/* contrast-corrected accent, for TEXT  */
```

`--team-accent-text` matters: an accent picked for fills is often unreadable as
small text. Colour the active label with the corrected form, and the rail,
segment and bloom with the raw one.

---

## Styles

```css
.glider-nav {
  --glider-accent: var(--team-primary);
  --glider-label: var(--team-accent-text);
  --glider-rail: rgba(15, 23, 42, 0.16);
  --glider-wash: color-mix(in srgb, var(--glider-accent) 18%, transparent);
  --glider-bloom: 0;
  --glider-thickness: 2px;
  --glider-core: 22%;
  --glider-ease: cubic-bezier(0.34, 1.28, 0.64, 1);
  position: relative;
}

/* Dark inverts more than the colours — see "Light and dark are different
   treatments" below. */
.dark .glider-nav {
  --glider-accent: #e9d28c;
  --glider-label: var(--glider-accent);
  --glider-rail: rgba(255, 255, 255, 0.1);
  --glider-bloom: 1;
}

/* For a secondary row sitting under a primary one. */
.glider-nav[data-emphasis='quiet'] {
  --glider-bloom: 0;
  --glider-wash: color-mix(in srgb, var(--glider-accent) 10%, transparent);
}
.dark .glider-nav[data-emphasis='quiet'] {
  --glider-thickness: 1px;
}

.glider-track {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.glider-rail,
.glider-mark {
  position: absolute;
  pointer-events: none;
}

.glider-mark {
  opacity: var(--glider-opacity, 0);
}

/* No transition until the first measurement lands, or the segment flies in
   from the corner on every mount. */
.glider-nav[data-ready='true'] .glider-mark {
  transition:
    transform var(--duration-slow) var(--glider-ease),
    width var(--duration-slow) var(--glider-ease),
    height var(--duration-slow) var(--glider-ease),
    bottom var(--duration-slow) var(--glider-ease),
    opacity var(--duration-fast) linear;
}

.glider-mark::before,
.glider-mark::after {
  content: '';
  position: absolute;
}

/* Bloom — the segment's own colour, blurred. */
.glider-mark::before {
  background: var(--glider-accent);
  opacity: var(--glider-bloom);
  filter: blur(8px);
}

/* ── Horizontal: rail along the BOTTOM edge ───────────────────────────── */
.glider-nav[data-orientation='horizontal'] .glider-rail {
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--glider-rail) 50%, transparent 100%);
}

.glider-nav[data-orientation='horizontal'] .glider-mark {
  bottom: var(--glider-cross, 0px);
  left: 0;
  height: var(--glider-thickness);
  width: var(--glider-size, 0px);
  transform: translateX(var(--glider-offset, 0px));
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--glider-accent) var(--glider-core),
    var(--glider-accent) calc(100% - var(--glider-core)),
    transparent 100%
  );
}

/* Anchored to the segment's bottom and grown UPWARD — see "A 1px overhang
   raises scrollbars". */
.glider-nav[data-orientation='horizontal'] .glider-mark::before {
  bottom: 0;
  left: 50%;
  width: 60%;
  height: 300%;
  transform: translateX(-50%);
}

/* The wash rises INTO the item. */
.glider-nav[data-orientation='horizontal'] .glider-mark::after {
  right: 0;
  bottom: 0;
  left: 0;
  height: 1.75rem;
  background: linear-gradient(0deg, var(--glider-wash) 0%, transparent 100%);
}

/* ── Vertical: rail down the LEFT edge ────────────────────────────────── */
.glider-nav[data-orientation='vertical'] .glider-rail {
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, var(--glider-rail) 50%, transparent 100%);
}

.glider-nav[data-orientation='vertical'] .glider-mark {
  top: 0;
  left: 0;
  width: var(--glider-thickness);
  height: var(--glider-size, 0px);
  transform: translateY(var(--glider-offset, 0px));
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glider-accent) var(--glider-core),
    var(--glider-accent) calc(100% - var(--glider-core)),
    transparent 100%
  );
}

.glider-nav[data-orientation='vertical'] .glider-mark::before {
  top: 50%;
  left: 0;
  width: 300%;
  height: 60%;
  transform: translateY(-50%);
}

.glider-nav[data-orientation='vertical'] .glider-mark::after {
  top: 0;
  bottom: 0;
  left: 0;
  width: 9rem;
  background: linear-gradient(90deg, var(--glider-wash) 0%, transparent 100%);
}
```

---

## Markup

```html
<div class="glider-nav" data-orientation="horizontal" data-emphasis="primary" data-ready="true">
  <div class="glider-items">
    <a>Coach</a>
    <a>Program</a>
  </div>
  <span class="glider-track" aria-hidden="true">
    <span class="glider-rail"></span>
    <span class="glider-mark"></span>
  </span>
</div>
```

Items live in their own flex box (`flex` for horizontal, `flex flex-col` for
vertical). The track is a sibling, never a wrapper.

**Item styling:** padding, display face, and a colour transition. The active item
takes `color: var(--glider-label)`; everything else takes the muted body colour.
Hover lifts the text only — a hover *background* reads as a second selection now
that selection itself has no background.

**When the container needs a role** (a dropdown's rows are `option`s), put it on
the items box, not the root: the rail and segment must not sit inside the
`listbox`.

---

## Decisions worth keeping

**Light and dark are different treatments, not one with a swapped colour.**
Dark gets the full read — accent segment, blurred bloom, wash rising into the
item. Light **drops the bloom entirely**: `filter: blur()` on a colour reads as
light *emission*, which is meaningless on a white page and lands as a smudge.
Emphasis there comes from a crisper segment and the accent-coloured label.

**The segment needs a solid core.** Fading across its whole length works only
when a bloom carries the brightness. With no bloom — light mode, and any quiet
row — a fully-faded 1–2px line has almost no ink in it and the active item stops
reading as active. `--glider-core: 22%` holds the middle solid and fades only the
ends.

**Overshoot must be clipped.** `--glider-ease` overshoots on purpose (y > 1),
which is most of the character. Travelling to the LAST item therefore pushes the
segment past the row's edge — and inside a horizontally scrollable wrapper that
is real scrollable overflow: a scrollbar flashes in, steals height, and the whole
row jumps. Clipping in the **track** fixes it while leaving the items scrollable,
because the items are the track's siblings, not its children.

**A 1px overhang raises scrollbars.** The bloom was originally centred on the
segment, putting ~1px of its box below the row. `overflow-x: auto` forces the
other axis to `auto` as well, so that 1px was enough to raise *both* scrollbars
on a row that fit its space with room to spare. Anchor decorations to the edge
they grow from — and remember any element with `overflow` on one axis is a scroll
container on both.

**Reserve the first frame.** Gate transitions behind `data-ready`, set one
animation frame after mount, or the segment animates in from the corner every
time a layout mounts.

**Hide rather than park.** With no active item, pass `-1` and set
`--glider-opacity: 0`. Parking the segment on item 0 states something false.

---

## Mode switches keep their fill

The glider is for **navigation** — things that take you somewhere. A control that
changes a *mode* in place (a segmented control, a two-way switch) keeps a filled
active state. The difference in treatment is what tells someone which kind of
control they're touching, and it is worth protecting.
