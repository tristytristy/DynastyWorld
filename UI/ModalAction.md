# Modal — the overlay shell and the action dialog

**InnerActivity component spec.** One scrim and one panel for every overlay in
the app, plus the confirm dialog that asks before something irreversible
happens.

Two pieces, used together: a **scrim** that dims the page, and a **panel** that
holds the content. Everything else — profile modals, editors, viewers, lightboxes
— is those two plus its own layout.

**Where it runs today:** profile and team modals, every editor, the media and
portrait viewers, the card book, and the confirm dialog.

---

## Anatomy

```
        portal → <body>
┌─────────────────────────────────────────────┐
│  scrim — dims, never blurs, click to close  │
│                                             │
│        ┌───────────────────────────┐        │
│        │ header — title · Close    │        │  panel
│        ├───────────────────────────┤        │
│        │ body (scrolls)            │        │
│        └───────────────────────────┘        │
└─────────────────────────────────────────────┘
```

| Part | Role |
|---|---|
| **Scrim** | Full-screen dim. Owns click-to-close and the layout of the panel inside it (centred, or top-aligned for tall content). |
| **Panel** | Solid surface, hairline border, cut corner. Caps its own height and scrolls internally so the page behind never scrolls. |
| **Depth** | Assigned when the overlay *opens*, not hardcoded — see *Layering*. |

---

## The scrim darkens and nothing else

```css
.modal-scrim {
  background-color: rgba(0, 0, 0, 0.55);
  animation: modal-scrim-in var(--duration-fast) var(--ease-enter);
}

/* Media and portrait viewers only. */
.modal-scrim-deep {
  background-color: rgba(0, 0, 0, 0.8);
}

@keyframes modal-scrim-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**No `backdrop-filter`.** This is the decision that matters most and the easiest
to get wrong. Blurring the scrim — and worse, blurring the panel sitting on top
of it — turns everything behind into grey mush, and the modal stops reading as
something laid *on* your work and starts reading as a wall replacing it. Dimming
alone keeps the page legible underneath, which is what makes an overlay feel
light.

Two values, and only two: **55%** standard, **80%** for viewers showing imagery,
where there's no page content worth keeping legible and artwork reads better
against a deeper ground.

> Drift is the real enemy. Before this was centralised, thirteen overlays had
> each hand-written their own: four scrim values across two base colours, three
> blur radii, and half the panels rounded while the other half carried the cut
> corner. None of it was a decision — it was thirteen separate afternoons.

---

## The panel

```css
.modal-panel {
  background-color: var(--surface-overlay);   /* solid: white / black */
  border: 1px solid var(--section-divider);   /* the page's own hairline */
  animation: modal-panel-in var(--duration-base) var(--ease-enter);
}

@keyframes modal-panel-in {
  from { opacity: 0; transform: translateY(12px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
```

- **Solid fill, never translucent.** It floats over arbitrary content; a
  translucent panel makes whatever is behind it part of the reading.
- **Hairline border at divider weight.** A panel shouldn't announce itself with a
  heavier frame than the page's own dividing lines.
- **No drop shadow.** With a proper scrim it adds nothing, and on a dark ground a
  soft shadow reads as a grey smudge *behind* the panel rather than as depth.
- **Cut corner, no radius** — the shape language.

---

## The close control is a glyph

```html
<button type="button" aria-label="Close player profile" title="Close"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center
               text-slate-400 outline-none transition-colors
               hover:text-slate-900 focus-visible:outline focus-visible:outline-1
               focus-visible:outline-offset-2 dark:text-slate-500 dark:hover:text-white">
  <svg …><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>
</button>
```

One component, `ModalCloseButton`. It replaced a bordered **CLOSE** pill that
existed as twelve hand-written copies of the same class string.

- **A glyph, not a word.** A bordered box in a header reads as a control of equal
  weight to whatever else is up there, and an X in the corner of an overlay is
  the most universally understood control in software. Same reasoning as the nav
  search trigger.
- **No border, no fill** — the app's icon-button language. Muted, resolving to
  full contrast on hover.
- **`label` is required, not optional**, so a nameless button can't ship. It
  becomes `Close <label>`.
- **`focus-visible`, never `focus`.** This matters more than it sounds: several
  overlays focus a control on open to start the focus trap, and the browser's
  default ring then draws a box around the glyph — the bordered look, back
  again, on every single open.

**Focus the panel on open, not the close button.** Both are valid trap entries,
but focusing a control lands it in its focused state every time, and focusing
the dialog announces its own label rather than "Close …, button". Needs
`tabIndex={-1}` on the panel, and `outline-none` so the panel doesn't ring
itself.

**Not for the quiet cancel in a footer action pair** (`Close` | `Commit the
crime`). That one is half of a pair and has to read as a word beside the verb
it's declining — see *The action dialog*.

---

## Markup

```html
<!-- portalled to <body> -->
<div class="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
     role="presentation">
  <div role="dialog" aria-modal="true" aria-label="…"
       class="modal-panel corner-cut relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden">
    …
  </div>
</div>
```

The scrim carries the layout classes; the panel carries its size caps. Neither
carries colour — that's what the two shared classes are for.

---

## Motion is one family

| Surface | Rise | Curve |
|---|---|---|
| Dropdown panel | 6px | `--ease-enter`, `--duration-base` |
| Command palette | 8px | same |
| Modal panel | 12px | same |

A bigger surface travelling a little further reads as **weight**, not as a
different animation. Same curve, same duration, every time. Reduced-motion is
handled globally by the app's clamp.

---

## The action dialog

For destructive or irreversible choices.

```
┌──────────────────────────────────────────────┐
│ ⚠   DELETE DYNASTY                           │  glyph + eyebrow
│     Delete this dynasty?                     │  title — a question
│     This removes all imported data and       │  consequence, plainly
│     cannot be undone.                        │
│                                              │
│                        Cancel   [ Delete ]   │  primary LAST, on the right
└──────────────────────────────────────────────┘
```

1. **The glyph is only on destructive dialogs.** It's what makes "this deletes
   something" register before the sentence is read — and it only works because it
   isn't on every dialog. Squared with the cut corner in a tinted box; nothing
   else here is round.
2. **The title is a question; the body is the consequence.** "Delete this
   dynasty?" then "…cannot be undone." Never put the consequence in the title.
3. **The confirm button says the verb** — *Delete*, not *OK*. Someone skimming
   reads only the buttons.
4. **Cancel is quiet** (text only) and comes first; the primary sits last, on the
   right, where the eye finishes.
5. **A destructive primary is outlined in the danger colour, not filled with it.**
   A big red block reads as the recommended action.
6. `role="alertdialog"`, labelled by the title. Focus the confirm button on open;
   Escape and a scrim click **cancel** — never confirm.

---

## Layering and dismissal

- **Portal every overlay to `<body>`.** One rendered inside the tree competes
  with its ancestors' stacking contexts, and any `clip-path` or
  `backdrop-filter` ancestor traps a `position: fixed` child.
- **Depth on open, not hardcoded.** Assign z-index from a stack when the overlay
  mounts, so whatever was opened last is on top however the tree is arranged.
  Fixed values collide the moment two overlays are open, and paint order then
  falls back to DOM order — decided by where providers happen to sit.
- **Scrim click closes only when the click lands on the scrim itself**
  (`event.target === event.currentTarget`). This also makes portalled children —
  a dropdown opened from inside the modal — safe by construction.
- **Escape closes the innermost thing.** Modals listen on `document`, so any
  nested popup must stop the event, or one keystroke closes both and takes
  unsaved edits with it.
- **Lock the page scroll** while open, and return focus to whatever opened the
  modal when it closes.

---

## Porting checklist

- [ ] Scrim: 55% black, **no blur**, fade in
- [ ] Panel: solid, hairline border, cut corner, no shadow, rise + scale in
- [ ] Close is `ModalCloseButton` — glyph, no border, `focus-visible` only
- [ ] Panel takes focus on open (`tabIndex={-1}` + `outline-none`), not the close button
- [ ] Portalled to `<body>`, depth assigned on open
- [ ] Scrim click cancels · Escape cancels · focus returns to the trigger
- [ ] Page scroll locked while open
- [ ] Destructive dialogs: glyph, question title, verb button, outlined primary
