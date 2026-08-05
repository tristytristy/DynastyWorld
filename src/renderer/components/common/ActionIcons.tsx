/**
 * The app's action icons — edit, export, delete, close.
 *
 * Drawn on a 20 grid at 1.6 stroke, which is a deliberately different family
 * from ToolbarIcons (24 grid, 1.7): those are window chrome, these sit on
 * cards and rows. Mixing the two weights in one row makes the heavier one look
 * like a mistake.
 *
 * They lived as private copies in CoachCard, Dashboard and Media. Shared here
 * so "the edit icon" means one shape everywhere rather than three that happen
 * to look alike.
 */

function Glyph({ className = 'h-4 w-4', children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Two arrows passing — swap one thing for another (the Hall's slot change). */
export function SwapIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 7.5h12M13 4.5 16 7.5 13 10.5" />
      <path d="M16 12.5H4M7 9.5 4 12.5 7 15.5" />
    </Glyph>
  );
}

/** A plus. Adds the thing the surface is about — an empty slot, an empty row. */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M10 4.5v11M4.5 10h11" />
    </Glyph>
  );
}

/** Pencil. */
export function EditIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M13.5 3.5a1.5 1.5 0 0 1 2.12 2.12l-8.5 8.5-3 .88.88-3 8.5-8.5Z" />
    </Glyph>
  );
}

/** An upward arrow leaving a tray — distinct from the downward "into tray" backup shape. */
export function ExportIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M10 12.5V3M10 3 6.5 6.5M10 3l3.5 3.5" />
      <path d="M4 13v1.5A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V13" />
    </Glyph>
  );
}

/** X. Dismisses an overlay — see ModalCloseButton, which is how it's actually used. */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Glyph>
  );
}

/** Bin. */
export function TrashIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 6h12" />
      <path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" />
      <path d="M5.5 6 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L14.5 6" />
      <path d="M8.5 9v5M11.5 9v5" />
    </Glyph>
  );
}

/**
 * Balaclava and swag bag — Scandals.
 *
 * A SOLID SHAPE, not a stroked one, and the one deliberate break from the
 * family above. Scandals is the single destructive thing on this page: it
 * writes to your save. Everything else here is stroked line-work at 1.6, so a
 * filled silhouette reads as different in kind before you have read the label —
 * which is the point of an icon on a warning-coloured button.
 *
 * The eyes and mouth are cut out with `fillRule="evenodd"` rather than painted
 * in the background colour, so the holes stay holes on any ground: the button
 * is red-tinted in light mode and near-black in dark, and a painted-in eye
 * would show as the wrong colour on one of them.
 */
export function ThiefIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      {/* Hooded head. A CAPSULE, not a circle — the straight sides between the
          two arcs are what read as a balaclava rather than a bald head, and
          they survive the shape collapsing to 16px. Eyes and mouth are knocked
          out with evenodd so the holes stay holes on any ground. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5 1.6a3.3 3.3 0 0 1 3.3 3.3v2.3a3.3 3.3 0 0 1-6.6 0V4.9a3.3 3.3 0 0 1 3.3-3.3Zm-1.9 3.7a.95.95 0 1 0 1.9 0 .95.95 0 0 0-1.9 0Zm3.1 0a.95.95 0 1 0 1.9 0 .95.95 0 0 0-1.9 0ZM5.3 8.1a1.25.7 0 1 0 2.5 0 1.25.7 0 0 0-2.5 0Z"
      />
      {/* Shoulders — a dome rising to just under the jaw, cropped by the frame
          so it reads as a bust rather than a floating blob. */}
      <path d="M0.7 18.6c0-4.3 2.6-7.2 5.8-7.2s5.8 2.9 5.8 7.2Z" />
      {/* Swag bag, clear of the head: cinched neck, then a heavy sack. Kept to
          the right half so the two shapes never touch at any size. */}
      <path d="M14.6 8.5h2.9l-.5 2.1a3.5 3.5 0 1 1-1.9 0l-.5-2.1Z" />
    </svg>
  );
}

/**
 * A card with a star — the Cardbook.
 *
 * Stroked, so it sits in the same family as Edit/Export/Trash beside it. The
 * star is FILLED against the stroked card: the book is the container, the star
 * is what marks a card as kept, and giving them the same treatment made the
 * whole thing read as a texture at 16px rather than as two ideas.
 */
export function CardStarIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      {/* Portrait card, corners squared to match the app's shape language. */}
      <rect x="4.5" y="2.5" width="11" height="15" rx="0.6" />
      {/* Solid star, sized to sit optically centred rather than geometrically. */}
      <path
        d="M10 5.9l1.35 2.74 3.02.44-2.18 2.13.51 3.01L10 12.8l-2.7 1.42.51-3.01L5.63 9.08l3.02-.44L10 5.9Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}
