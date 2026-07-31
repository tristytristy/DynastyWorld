# Select — the dropdown

**InnerActivity component spec.** A listbox that replaces the native
`<select>` everywhere in the app: artwork beside the labels, a panel we control,
our motion, and the [Glider](./RadioMenu.md) as the row highlight.

---

## Why this is not a styled `<select>`

A native select's popup is drawn by the **operating system**, not the page. No
artwork in the rows, no panel styling, no motion, and a highlight colour you
don't own. There is no CSS that changes this. Anything that looks like the design
below is a listbox, and the cost of that is stated up front:

> **Everything native gives away for free has to be rebuilt** — arrow keys,
> Home/End, Enter, Escape, type-ahead, focus return to the trigger, and scrolling
> the active row into view. Skipping any of it is how this kind of change ends up
> prettier and worse.

---

## Anatomy

```
┌───────────────────────┐
│ ⬛ Auburn        2027 ⌄│   trigger — icon · label · meta · chevron
└───────────────────────┘
┌───────────────────────┐
│  Find a team…         │   search (only when the list is long)
├───────────────────────┤
│▎⬛ Auburn             │   ← glider segment on the active row
│ ⬛ Air Force          │
│ ⬛ Akron              │
└───────────────────────┘
```

The panel is **portalled to `<body>`** and positioned `fixed` against the
trigger's rect. It is not a child of the trigger — see *Modals* below.

---

## Behaviour contract

| Input | Result |
|---|---|
| Click trigger / `↓` / `Enter` / `Space` | Open, cursor on the **current value** so the first arrow steps from where you are |
| `↑` `↓` | Move the cursor |
| `Home` / `End` | First / last |
| `Enter` | Commit, close, focus returns to the trigger |
| `Escape` | Close, focus returns; **stops propagating** |
| `Tab` | Close without committing |
| Typing (no search field) | Type-ahead jump, 700ms window |
| Typing (search field) | Filter |
| Click outside | Close |

**Search appears automatically past ~12 options**, and can be forced on. Below
that it is clutter; above it, hunting a name by scrolling is worse.

---

## Positioning

Measure the trigger on open and re-measure while open — a panel positioned once
detaches from its button the moment anything scrolls. Listen on `scroll` **with
capture**, so a scroll in any ancestor repositions it, not just the window's.

Three rules:

1. **Flip above** when there isn't room below and there is above.
2. **Clamp to the viewport.** The panel is *wider* than its trigger (search
   field, icons, long labels), so left-aligning it blindly pushes it off screen
   for any control near the right edge — which is where switchers usually live.
   Keep a small gap (8px) from the edge.
3. **Observe the panel's own width, don't sample it once.** It settles a beat
   after opening — the search field, a scrollbar arriving on a long list — and it
   changes again while filtering. A one-shot measurement clamps against a stale
   number and the panel sits flush against the edge anyway. Use a
   `ResizeObserver`.

> A subtle trap: on first open there is no position yet, so nothing is rendered
> and a measuring effect finds no panel. Whatever triggers that effect must
> include "the panel now exists", or the clamp silently never runs.

---

## Panel styling

```
border   1px, at the same weight as the app's section dividers — a panel
         floating over the page shouldn't carry a heavier frame than the page's
         own dividing lines
fill     solid: white on light, black on dark. Never translucent; it floats over
         arbitrary content
shape    the app's cut corner; no radius
motion   ~180ms, rising 6px and scaling from 0.98, transform-origin at the edge
         it grows FROM (top when dropping down, bottom when flipped up) so it
         unfolds out of the trigger rather than appearing over it
```

```css
.select-panel {
  transform-origin: top center;
  animation: select-panel-in var(--duration-base) var(--ease-enter);
}
.select-panel.select-panel-above {
  transform-origin: bottom center;
  animation-name: select-panel-in-above;
}

@keyframes select-panel-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes select-panel-in-above {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

A dropdown you open all day cannot have a showpiece animation. Short, and it
still has to land softly.

**The row list needs `overflow-x: hidden` explicitly.** `overflow-y: auto` alone
makes the other axis compute to `auto` too, and the glider's wash is a fixed 9rem
hanging off a 1–2px segment — wider than a narrow panel, which raised a
horizontal scrollbar on exactly the dropdowns that needed one least.

---

## Rows

Each row is `icon · label · meta`, with the icon supplied by the call site so the
component knows nothing about teams, seasons or anything else domain-shaped. The
active row takes the glider's label colour; **no check mark** — the segment
already says which row you're on, and a tick is a second answer to a question
already answered.

Group rows with headings by giving **each group its own Glider** and passing `-1`
to the groups that don't hold the cursor. One indicator, many sections.

---

## Modals

Two hazards, because a portalled panel sits **outside** its modal in the DOM.

**Click-outside is usually safe** if the modal's backdrop only closes when the
click lands on the backdrop *itself* (`event.target === event.currentTarget`) —
a click inside a portalled panel never reaches it. Check; don't assume.

**Escape is not safe.** Modals typically listen on `document`, so one Escape
closes the dropdown *and* the editor behind it, losing unsaved work. The panel
must `stopPropagation()` on Escape: the innermost thing closes. Stop `Enter` too,
so committing a choice can't submit the form the dropdown sits in.

**Depth:** take the z-index from the app's open-order stack rather than a fixed
value, and a dropdown opened inside a modal lands above it for free.

---

## API

```ts
interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;     // rendered in the row AND the trigger
  meta?: string;        // muted trailing text
  keywords?: string;    // extra words search/type-ahead should match
}

<Select
  value={value}
  onChange={setValue}
  options={options}
  ariaLabel="Viewed team"
  searchable          // defaults to "only when the list is long"
  disabled
  className="w-full"  // triggers are inline-flex; stretch them explicitly
/>
```

`disabled` is not optional in practice — the native control had it, and any form
that conditionally locks a field will need it on day one.

---

## Porting notes

- Roles: trigger `role="combobox"` + `aria-haspopup="listbox"` + `aria-expanded`;
  the items container `role="listbox"`; rows `role="option"` with `aria-selected`.
- Give rows a stable `data-*` attribute carrying their value. Automated tests
  and screenshot harnesses cannot drive this control the way they drive a
  `<select>` (there is no `.value` to set) — they have to click the trigger, wait
  for the panel, then click the option.
- `<optgroup>` has no equivalent. Flatten and suffix the label
  (`"Spread · Offense"`); an unlabelled mix of two groups is a puzzle.
- Keep any "unknown value stays selectable" guard the native control had, or
  opening an editor can silently rewrite a legacy enum it didn't recognise.
