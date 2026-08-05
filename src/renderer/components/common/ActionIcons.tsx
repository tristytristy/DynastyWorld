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
