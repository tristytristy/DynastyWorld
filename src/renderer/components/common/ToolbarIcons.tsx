/**
 * The title-bar tool icons. Standalone marks — no chip, no background, no
 * border — so they read as part of the window chrome rather than as buttons
 * parked in it.
 *
 * All three are drawn on the same 24 grid at the same 1.7 stroke so they carry
 * equal visual weight. That matters more than it sounds: mixing a stroked icon
 * with a filled one at the same box size makes the filled one look heavier and
 * the row stops looking like a set.
 */

const STROKE = 1.7;

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.4a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 1 1-3.89 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.75-2.75l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 1 1 0-3.89h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.75-2.75l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47v-.17a1.94 1.94 0 1 1 3.89 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 1 1 0 3.89h-.09a1.6 1.6 0 0 0-1.47.97Z" />
    </Icon>
  );
}

export function BookIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 4.8A1.8 1.8 0 0 1 5.8 3H18a1 1 0 0 1 1 1v13.5" />
      <path d="M6.2 16.5H19a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6.2A2.2 2.2 0 0 1 4 18.8V4.8" />
      <path d="M8 7.5h7" />
    </Icon>
  );
}

/**
 * The InnerActivity symbol — the circular "IA" mark only, cropped out of the
 * full horizontal lock-up (see InnerActivityMark, which carries the wordmark
 * for the About panel).
 *
 * The source art's own stroke weights are drawn for a 1920px canvas: rendered
 * at ~18px the ring is a 0.26px hairline and the letterforms barely register,
 * so both get an explicit stroke ON TOP of their fill to bring them up to the
 * 1.7-on-24 weight the other icons use. Without that this mark reads as a
 * smudge beside two crisp icons.
 */
export function InnerActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="196 426 228 228"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M309.628 432C250.628 432 202.627 480 202.627 539C202.627 598 250.628 646 309.628 646C368.628 646 416.627 598 416.627 539C416.627 480 368.628 432 309.628 432ZM309.628 642.807C252.388 642.807 205.82 596.24 205.82 539C205.82 481.76 252.388 435.193 309.628 435.193C366.867 435.193 413.435 481.76 413.435 539C413.435 596.24 366.867 642.807 309.628 642.807Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="13"
      />
      <path
        d="M325.401 524.387C318.877 535.128 300.772 567.295 295.318 576.899C295.095 577.293 294.681 577.535 294.228 577.541L283.626 577.692C282.64 577.706 282.01 576.647 282.494 575.789C294.896 553.808 312.581 523.159 325.584 501.477C326.077 500.655 327.263 500.644 327.765 501.46C339.158 519.994 358.383 556.405 369.043 575.685C369.497 576.507 368.938 577.515 368.001 577.574C364.733 577.78 360.039 577.735 357.189 577.612C356.732 577.592 356.326 577.329 356.115 576.924C349.974 565.104 334.779 537.437 327.608 524.433C327.134 523.574 325.91 523.549 325.401 524.387Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M261.414 500.081H251.331C250.626 500.081 250.054 500.653 250.054 501.358V576.642C250.054 577.347 250.626 577.919 251.331 577.919H261.414C262.119 577.919 262.691 577.347 262.691 576.642V501.358C262.691 500.653 262.119 500.081 261.414 500.081Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
