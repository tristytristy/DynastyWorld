# ToggleSwitch — the two-state switch

**InnerActivity component spec.** A labelled switch for a pair of views that
occupy the same place: Roster ⇄ Transfers, Statistics ⇄ Analytics, Season ⇄
Yearly.

It is deliberately *not* the [Glider](./RadioMenu.md). The glider marks
**navigation** — things that take you somewhere. This marks a **mode**, changed
in place, and keeping the two treatments apart is what tells someone which kind
of control they're touching.

---

## Anatomy

```
Roster  (●———)  Transfers        ← label · track+knob · label
```

Both labels are buttons: clicking either side selects it directly rather than
forcing you to aim at the track. The track toggles.

The active label takes the strong text colour; the inactive one is muted and
lifts on hover.

---

## Geometry

Get this wrong and it is invisible until you look closely, so it's written down:

```
track   52 × 24px, fully rounded, 1px border
knob    35 × 35px  ← deliberately TALLER than the track
travel  -1px → 18px  (52 − 35 + 1)
```

The knob **overhangs the track top and bottom** — that overhang is the look, not
a mistake. Starting at `-1` and ending at `18` keeps the overhang symmetric left
and right as well, so the slide reads as one object riding a groove rather than a
dot rattling inside a pill.

Travel is 19px. If you resize the knob, resize the track with it or the movement
stops being legible.

---

## The knob can carry artwork

```tsx
<ToggleSwitch
  value={view}
  onChange={setView}
  left={{ value: 'roster', label: 'Roster' }}
  right={{ value: 'transfers', label: 'Transfers' }}
  knob={<TeamLogo team={team} size="sm" />}
/>
```

With `knob` supplied the switch belongs to whatever context it sits in — a team
logo makes it that team's control. With nothing supplied it falls back to a plain
dot.

**Optical centring, not geometric.** When the knob carries a mark, centre it
about **2px above** true centre. A mascot's ink sits low inside its own square,
so a geometrically centred logo reads as sagging. This is a correction for the
artwork, not a layout bug — resist "fixing" it. (Ours was overdone at 5px and
walked back to 2.)

---

## Styling

```
track (off)  the app's surface gradient + hairline border
track (on)   same, plus an inset 1px ring in the context accent
knob         no fill when artwork is supplied; a solid dot with a soft shadow
             when it isn't
motion       150ms ease-out on transform and colour — a switch should feel
             instant, not springy
```

The "on" state uses an **inset ring rather than a filled track**. A filled track
in an accent colour competes with the artwork riding on it, and in a themed app
the accent changes per context — a ring survives every colour, a fill doesn't.

Avoid a hard-coded brand blue (or any colour outside the palette) for the on
state. Use the context accent.

---

## Accessibility

- The track is `role="switch"` with `aria-checked`.
- `aria-label` states the destination — "Switch to Transfers" — rather than the
  current state, which the checked attribute already carries.
- Both side labels are real buttons, so keyboard users get three targets and can
  select a side directly instead of toggling blindly.

---

## Layout notes

Lay it out **inline**, sized to sit level with the labels either side. A switch
positioned absolutely (centred on a point with a `-50%` translate) cannot be
dropped into a header row without fighting it.

---

## When not to use it

- **Three or more options** → segmented control.
- **On/off for a setting** (not a view) → a checkbox reads more honestly.
- **Two destinations with their own URLs** → that's navigation; use the glider.
