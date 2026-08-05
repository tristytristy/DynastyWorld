import { getHelmetPath, DEFAULT_HELMET_PATH, type HelmetSide } from '../../lib/helmetAssetMapping';
import { useProgramArt } from '../../data/ProgramArtProvider';
import { isProgramArtPath } from '../../lib/programArt';

/**
 * A team's helmet, loaded from the external image pack. `side` is the physical
 * screen position (the art in each folder faces INWARD): 'left' art faces right
 * so it belongs on the left, 'right' art faces left so it belongs on the right.
 * Falls back once to the generic Default helmet if a team's file 404s.
 *
 * Shared rather than per-page: the Game Info page and the NCAA Hub's Game of
 * the Week hero both draw opposing helmets, and the mirroring rule below is
 * exactly the kind of detail that goes wrong when it exists twice.
 */
export function HelmetImg({
  teamName,
  side,
  className = '',
}: {
  teamName: string;
  side: HelmetSide;
  className?: string;
}) {
  const { version } = useProgramArt();
  const src = getHelmetPath(teamName, side);
  // ONE uploaded helmet serves both sides, so the right-hand one is flipped
  // here — otherwise a matchup would show two helmets facing the same way.
  // Shipped art already has a real right-side render and is left alone.
  const mirrored = side === 'right' && isProgramArtPath(src);
  return (
    <img
      key={version}
      src={src}
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      // Decorative: every caller prints the team's name beside it.
      alt=""
      onError={(event) => {
        const img = event.currentTarget;
        if (img.dataset.fellBack) return;
        img.dataset.fellBack = '1';
        img.src = DEFAULT_HELMET_PATH[side];
      }}
      className={className}
      draggable={false}
    />
  );
}
