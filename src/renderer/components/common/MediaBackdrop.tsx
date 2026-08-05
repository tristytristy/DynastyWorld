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
export function MediaBackdrop({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), 5000);
    return () => window.clearInterval(id);
  }, [photos.length]);

  // The layer holding the CURRENT photograph alternates, so the one being
  // replaced keeps its image while it fades out instead of snapping to the new
  // one mid-transition.
  const even = index % 2 === 0;
  const current = photos[index];
  const previous = photos[(index - 1 + photos.length) % photos.length];

  return (
    <div className="trophy-backdrop" aria-hidden="true">
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
