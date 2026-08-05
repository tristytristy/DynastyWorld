import { abbreviateClass, isRedshirt } from '../../lib/rosterOrder';

/**
 * A player's class, with the redshirt mark in front of it instead of an "RS "
 * prefix.
 *
 * A COMPONENT RATHER THAN A CHANGE TO `abbreviateClass`, deliberately. That
 * helper returns a STRING and is the one owner of this vocabulary — the roster
 * exports and anything else that has to write text still need "RS Senior"
 * spelled out, because a CSV cannot carry an icon. So the helper keeps its job
 * and this wraps it for the surfaces that can draw one.
 *
 * The mark REPLACES the prefix, it doesn't join it: an icon next to "RS SR"
 * says redshirt twice.
 *
 * `max-w-none` on the image is not decoration — Tailwind's preflight sets
 * `img { max-width: 100% }`, which resolves against the containing block, and
 * this badge routinely sits in table cells and inline runs narrower than the
 * icon's own box. That is the exact trap that squashed the toggle knob into an
 * oval; here it would silently shave the mark.
 */
export function ClassBadge({
  schoolYear,
  redshirtStatus,
  className = '',
}: {
  schoolYear: string;
  redshirtStatus?: string | null;
  className?: string;
}) {
  // Called WITHOUT the status on purpose: that returns the bare class, and the
  // icon is what says redshirt.
  const base = abbreviateClass(schoolYear);
  if (!isRedshirt(redshirtStatus)) return <>{base}</>;
  return (
    /* align-middle, and it is not belt-and-braces: an inline-flex box aligns to
       its parent text run by BASELINE, and a flex container's baseline is its
       first line box - which sits lower than the surrounding cap height once an
       icon is in the row. That is what left the mark hanging below the class it
       belongs to. */
    <span className={`inline-flex items-center gap-1 whitespace-nowrap align-middle ${className}`}>
      <img
        src="assets/UI/redshirt.webp"
        alt="Redshirt"
        title="Redshirt"
        draggable={false}
        className="h-3.5 w-3.5 max-w-none shrink-0 object-contain"
      />
      {base}
    </span>
  );
}
