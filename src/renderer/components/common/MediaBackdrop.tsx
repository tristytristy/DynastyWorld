import { useEffect, useState } from 'react';

/**
 * A dynasty's own photographs, drifting behind a surface in black and white.
 *
 * Extracted from the Trophy Room so the player masthead can stand in the same
 * room rather than growing a second implementation that slowly diverges — the
 * grade, the jumbotron grid, the drift and the crossfade all live in
 * `.trophy-backdrop*` in globals.css and are shared by every caller.
 *
 * TWO LAYERS THAT SWAP, never a carousel: one holds the outgoing photograph and
 * one the incoming, and the index decides which is lit. Two composited images at
 * any moment however many photographs exist — no layout, no scroll container, no
 * reflow.
 *
 * THE FALLBACK IS THE ABSENCE OF THIS COMPONENT. Callers render it only when
 * they have photographs, so a subject with none gets exactly the surface that
 * was there before. Everything a caller draws on top is unaffected either way.
 *
 * The host must be `relative` and `overflow-hidden`; this fills it.
 */
/** How long each photograph is held before the crossfade. */
const HOLD_MS = 5000;

export function MediaBackdrop({
  photos,
  tone = 'backdrop',
  staggerMs = 0,
}: {
  photos: string[];
  tone?: 'backdrop' | 'cover';
  /**
   * Pushes this instance's cycle out of step with its neighbours (user
   * direction). A wall of album covers all turning over on the same tick reads
   * as one thing blinking; a couple of hundred milliseconds apart and they read
   * as a room where things are quietly happening.
   *
   * Callers pass a raw per-item offset — typically `index * 200` — and the
   * WRAP is done here rather than there: past twenty or so items a raw offset
   * would exceed the hold and the boxes would silently re-cluster, one cycle
   * behind. Modulo keeps the spread meaningful at any number of albums.
   */
  staggerMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const offset = ((staggerMs % HOLD_MS) + HOLD_MS) % HOLD_MS;

  useEffect(() => {
    if (photos.length < 2) return;
    /*
      The offset delays the START of the cycle, so the first change lands at
      offset + HOLD rather than at the offset itself. Firing early would give
      every box a short first slide, and a photograph that flicks away sooner
      than the rest reads as a glitch rather than as a stagger.
    */
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), HOLD_MS);
    }, offset);
    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [photos.length, offset]);

  // The layer holding the CURRENT photograph alternates, so the one being
  // replaced keeps its image while it fades out instead of snapping to the new
  // one mid-transition.
  const even = index % 2 === 0;
  const current = photos[index];
  const previous = photos[(index - 1 + photos.length) % photos.length];

  /*
    TWO JOBS, ONE MECHANISM. As a BACKDROP the photograph sits behind a trophy
    or a masthead and must never compete with it — drained to grey and held at a
    third opacity. As a COVER it IS the content: an album box is a picture with
    a name on it, and the same grade there just looks like a fault. Same drift,
    same crossfade, same two layers; only the grade changes.
  */
  return (
    <div
      className={`trophy-backdrop${tone === 'cover' ? ' trophy-backdrop--cover' : ''}`}
      aria-hidden="true"
    >
      <div
        className="trophy-backdrop-layer"
        data-visible={even ? 'true' : 'false'}
        style={{ backgroundImage: `url("${even ? current : previous}")` }}
      />
      <div
        className="trophy-backdrop-layer"
        data-visible={even ? 'false' : 'true'}
        style={{ backgroundImage: `url("${even ? previous : current}")`, animationDelay: '-10s' }}
      />
    </div>
  );
}

/** File urls for a media list, the one place this conversion lives. */
export function mediaPhotoUrls(items: { absolutePath: string }[] | undefined): string[] {
  return (items ?? []).map((item) => encodeURI(`file:///${item.absolutePath.replace(/\\/g, '/')}`));
}
