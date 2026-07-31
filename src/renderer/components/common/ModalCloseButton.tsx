import { forwardRef } from 'react';
import { CloseIcon } from './ActionIcons';

/**
 * The dismiss control in an overlay's header. One component, because the
 * bordered "CLOSE" pill it replaces existed as TWELVE hand-written copies of
 * the same class string across the profile modals, the editors, the viewers and
 * the box score — the same drift ActionIcons was created to stop.
 *
 * A glyph rather than a word, for the reason the nav search trigger is one: a
 * bordered box in a header reads as a control of equal weight to whatever else
 * is up there, and an X in the corner of an overlay is the most universally
 * understood control in software. It carries no border and no fill — the
 * app's icon-button language — and states itself to a screen reader through
 * `label`, which is required rather than optional so a nameless button can't
 * ship.
 *
 * NOT for the quiet cancel in a footer action pair (Close | Commit the crime).
 * That one is half of a pair and has to read as a word beside the verb it's
 * declining — see UI/ModalAction.md.
 */
export const ModalCloseButton = forwardRef<
  HTMLButtonElement,
  {
    /** What is being closed, e.g. "player profile". Becomes "Close player profile". */
    label: string;
    onClick: () => void;
    disabled?: boolean;
    /** Extra positioning only — an overlay that floats this over its content rather than sitting it in a header row. */
    className?: string;
  }
>(function ModalCloseButton({ label, onClick, disabled, className = '' }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Close ${label}`}
      title="Close"
      /*
        focus-visible, not focus: several overlays focus this button on open to
        start the focus trap inside the panel, and the browser's default ring
        drew a box around the glyph — which is exactly the bordered look this
        component exists to remove, back again on every single open. Keyboard
        users still get a ring; it's just the team accent rather than the UA's.
      */
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 outline-none transition-colors duration-base ease-standard hover:text-slate-900 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--team-primary)] disabled:pointer-events-none disabled:opacity-40 dark:text-slate-500 dark:hover:text-white ${className}`}
    >
      <CloseIcon className="h-[18px] w-[18px]" />
    </button>
  );
});
