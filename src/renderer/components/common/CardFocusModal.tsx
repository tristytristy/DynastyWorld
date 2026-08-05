import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { PlayerCard } from './PlayerCard';
import { CardLayerToggles, CardScrimControl } from './CardLayerToggles';
import { EditIcon, ExportIcon, TrashIcon } from './ActionIcons';
import { mediaFileUrl } from './MediaGallery';
import { CARD_DESIGN_H, CARD_DESIGN_W } from './SavedPlayerCard';
import { Select } from '../ui/Select';
import { useTeamThemeVars } from '../../lib/cardTheme';
import type {
  CardLayers,
  CardScrim,
  CardPhotoTransform,
  CardStatSource,
  CardStatSourceOption,
  MediaItemResolved,
  PlayerCardRecord,
} from '../../../shared/types';

/** How many stats fit across the bottom band before it stops being a stat line. */
const MAX_STATS = 4;

/** The card never grows past its design width — past that it's an upscale, not a bigger card. */
const MAX_FOCUS_W = CARD_DESIGN_W;
const MIN_FOCUS_W = 220;

/**
 * Everything the focused card can do beyond being looked at. Omitted entirely by
 * read-only callers (the card book browses; it doesn't edit), which is why this
 * is one optional bag rather than a dozen optional props.
 */
export interface CardFocusEditor {
  /** Every stat line available to build from right now — the season, and each game played. */
  statSources: CardStatSourceOption[];
  /** The season the app is currently showing; a card locked to another year can't re-pick its line. */
  viewedSeasonYear: number | null;
  listMedia: () => Promise<MediaItemResolved[]>;
  pickPhoto: (card: PlayerCardRecord) => void;
  useMediaPhoto: (card: PlayerCardRecord, absolutePath: string) => void;
  removePhoto: (card: PlayerCardRecord) => void;
  /** End of a drag or a zoom — the framing is final and can be written. */
  commitFraming: (card: PlayerCardRecord, transform: CardPhotoTransform) => void;
  setStats: (card: PlayerCardRecord, source: CardStatSource, tiles: { label: string; value: string }[]) => void;
  setLayers: (card: PlayerCardRecord, layers: CardLayers) => void;
  /** The bottom fade — on/off and how far up the card it reaches. */
  setScrim: (card: PlayerCardRecord, scrim: CardScrim) => void;
  toggleFavorite: (card: PlayerCardRecord) => void;
  makeDefault: (card: PlayerCardRecord) => void;
  remove: (card: PlayerCardRecord) => void;
}

/** How wide the card can be drawn without the page having to scroll to see it. */
function useFocusCardWidth(withPanel: boolean): number {
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Height is what actually binds: the card is tall, and below it sit the
  // control bar and the counter. Width only binds once the editor panel is out.
  const byHeight = ((viewport.h - 190) * CARD_DESIGN_W) / CARD_DESIGN_H;
  const byWidth = withPanel ? viewport.w - 480 : viewport.w - 160;
  return Math.round(Math.max(MIN_FOCUS_W, Math.min(MAX_FOCUS_W, byHeight, byWidth)));
}

function ChevronIcon({ left = false }: { left?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06L7.3 14.03 2.6 9.45l6.5-.95L12 2.6z"
        fill={filled ? '#f0b429' : 'none'}
        stroke={filled ? '#f0b429' : 'currentColor'}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The dot that marks the player's default card, as a button. */
function DefaultIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={1.6} />
      {on && <circle cx="12" cy="12" r="4" fill="currentColor" />}
    </svg>
  );
}

const BAR_BTN =
  'grid h-9 w-9 place-items-center rounded-full text-white/85 outline-none transition duration-fast ease-standard hover:bg-white/15 hover:text-white focus-visible:bg-white/15 focus-visible:text-white disabled:opacity-40 disabled:hover:bg-transparent';

const EDIT_BTN =
  'corner-cut-sm border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition duration-fast ease-standard hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-40 disabled:hover:border-slate-300/80 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white';

/**
 * The card, big, on its own.
 *
 * Drawn from the record with ONE live override — the framing being dragged,
 * which is held here rather than pushed into the row on every pointer move.
 * That is the difference between a drag that feels attached to the cursor and
 * one that writes to SQLite sixty times a second.
 *
 * No pointer-tracked lighting here (removed at the user's request, 2026-07-30).
 * The card keeps the fixed diagonal sheen it is drawn with, and that is the
 * whole of it — the expanded view shows the card, it doesn't perform it.
 */
function FocusCard({
  dynastyId,
  card,
  width,
  transform,
  onPointerDownPhoto,
  draggable,
}: {
  dynastyId: string;
  card: PlayerCardRecord;
  width: number;
  transform: CardPhotoTransform;
  onPointerDownPhoto?: (e: React.PointerEvent) => void;
  draggable: boolean;
}) {
  const colorVars = useTeamThemeVars(dynastyId, card.teamName);
  const scale = width / CARD_DESIGN_W;
  const photoUrl = card.photoPath
    ? // Busted on updatedAt: replacing a photo reuses the same filename, so an
      // un-busted src would keep showing the image that was replaced.
      `${mediaFileUrl(card.photoPath)}?v=${encodeURIComponent(card.updatedAt)}`
    : null;

  return (
    <div className="relative" style={{ width, height: Math.round((width * CARD_DESIGN_H) / CARD_DESIGN_W) }}>
      <div className="origin-top-left" style={{ width: CARD_DESIGN_W, transform: `scale(${scale})`, ...colorVars }}>
        <PlayerCard
          player={card.player}
          teamName={card.teamName}
          seasonYear={card.seasonYear}
          stats={card.stats}
          layers={card.layers}
          statSource={card.statSource}
          // The card's OWN fade, not the app default. Omitting this made
          // PlayerCard fall back to DEFAULT_CARD_SCRIM, so the editor's Bottom
          // fade control moved a value the preview beside it never drew — the
          // one surface where seeing the change is the whole point of the
          // panel. The grid tile (SavedPlayerCard) always passed it, which is
          // why the setting looked correct everywhere except while editing.
          scrim={card.scrim}
          photoUrl={photoUrl}
          photoTransform={transform}
          onPhotoPointerDown={draggable ? onPointerDownPhoto : undefined}
        />
      </div>
    </div>
  );
}

/**
 * A card, opened.
 *
 * The one place a card is the only thing on screen — which is why every action
 * that operates on exactly one card lives here rather than on the grid tile
 * behind it: there is no wrong card to hit, and no row of controls cluttering a
 * set of cards you were only browsing.
 *
 * The EDITOR is the same surface one step further in. It opens as a panel beside
 * the card, not a dialog on top of it, because every control in it changes what
 * the card looks like and you have to be able to see that happen.
 *
 * Read-only callers (the card book) simply omit `editor` and get the browse
 * half: the card, ← / → through the rest of the set, and Escape.
 */
export function CardFocusModal({
  dynastyId,
  cards,
  index,
  onIndex,
  onClose,
  onExport,
  editor,
}: {
  dynastyId: string;
  cards: PlayerCardRecord[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  onExport?: (card: PlayerCardRecord) => void;
  editor?: CardFocusEditor;
}) {
  const card = cards[index] ?? null;
  const [editing, setEditing] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [media, setMedia] = useState<MediaItemResolved[] | null>(null);

  // The framing being dragged. Seeded from the row and re-seeded whenever the
  // row changes underneath (a new card, a new photo, a committed gesture coming
  // back) — after our own commit the two are already equal, so that's a no-op.
  const [draft, setDraft] = useState<CardPhotoTransform>(card?.photoTransform ?? { x: 0, y: 0, scale: 1 });
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    if (!card) return;
    setDraft(card.photoTransform);
    draftRef.current = card.photoTransform;
  }, [card?.id, card?.photoFile, card?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching cards closes anything that belonged to the one you left.
  useEffect(() => {
    setMediaOpen(false);
  }, [card?.id]);

  const width = useFocusCardWidth(editing);

  const step = useCallback(
    (delta: number) => {
      if (cards.length < 2) return;
      onIndex((index + delta + cards.length) % cards.length);
    },
    [cards.length, index, onIndex],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        // Not while typing into the panel's own fields (the Select's search).
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (event.key === 'Escape') {
        // Capture-phase and stopped, so it closes THIS and not whatever is behind.
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, onClose]);

  // --- Dragging the photo ---
  // The delta is divided by the render scale because the framing is stored in
  // the card's OWN 330px space while the drag happens in screen pixels. Miss
  // that and a card drawn at 260px slides slower than the cursor.
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; scale: number } | null>(null);
  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setDraft((prev) => ({
      ...prev,
      x: d.origX + (e.clientX - d.startX) / d.scale,
      y: d.origY + (e.clientY - d.startY) / d.scale,
    }));
  }, []);
  // Both handlers must keep the SAME identity for the whole gesture: `setDraft`
  // re-renders on every pointer move, and a callback rebuilt on each render
  // would have its own cleanup tear the listeners off mid-drag. So the things
  // that do change per render — the card, the editor — are read through a ref
  // at the moment of use rather than captured as dependencies.
  const liveRef = useRef({ card, editor });
  liveRef.current = { card, editor };
  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    const { card: liveCard, editor: liveEditor } = liveRef.current;
    if (liveCard && liveEditor) liveEditor.commitFraming(liveCard, draftRef.current);
  }, [onPointerMove]);
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );
  function onPhotoPointerDown(e: React.PointerEvent) {
    if (!card?.photoFile) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: draftRef.current.x,
      origY: draftRef.current.y,
      scale: width / CARD_DESIGN_W,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // --- The stat line ---
  /**
   * A card's stat line can only be re-picked from the season it was printed in.
   * Everything on the card is frozen at its year (see `updatePlayerCard`), so
   * hanging this season's numbers off a 2026 card would make it a card of a
   * moment that never happened. The line is still shown — just as what it is.
   */
  const statsLocked =
    !!editor &&
    card?.seasonYear != null &&
    editor.viewedSeasonYear != null &&
    card.seasonYear !== editor.viewedSeasonYear;
  const activeSource: CardStatSourceOption | null = useMemo(() => {
    if (!editor || !card) return null;
    const byKey = editor.statSources.find((s) => s.key === card.statSource?.key);
    return byKey ?? editor.statSources[0] ?? null;
  }, [editor, card]);
  const selectedLabels = card ? card.stats.map((s) => s.label) : [];

  function toggleStat(label: string) {
    if (!card || !editor || !activeSource) return;
    const next = selectedLabels.includes(label)
      ? selectedLabels.filter((l) => l !== label)
      : selectedLabels.length >= MAX_STATS
        ? selectedLabels
        : [...selectedLabels, label];
    if (next === selectedLabels) return;
    const tiles = next
      .map((l) => activeSource.tiles.find((t) => t.label === l))
      .filter((t): t is { label: string; value: string } => Boolean(t));
    editor.setStats(card, { key: activeSource.key, kind: activeSource.kind, label: activeSource.label }, tiles);
  }

  /** Switching source replaces the whole line — the labels rarely survive the move, and a half-migrated line is worse than a fresh one. */
  function pickSource(key: string) {
    if (!card || !editor) return;
    const source = editor.statSources.find((s) => s.key === key);
    if (!source) return;
    const kept = selectedLabels
      .map((l) => source.tiles.find((t) => t.label === l))
      .filter((t): t is { label: string; value: string } => Boolean(t));
    const tiles = kept.length > 0 ? kept : source.tiles.slice(0, 3);
    editor.setStats(card, { key: source.key, kind: source.kind, label: source.label }, tiles);
  }

  async function toggleMedia() {
    const next = !mediaOpen;
    setMediaOpen(next);
    if (next && media === null && editor) setMedia(await editor.listMedia());
  }

  const chromeVars = useTeamThemeVars(dynastyId, card?.teamName ?? null);

  if (!card) return null;

  return (
    <ModalOverlay
      className="modal-scrim modal-scrim-deep fixed inset-0 flex items-center justify-center overflow-y-auto p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.player.firstName} ${card.player.lastName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-start gap-6" style={chromeVars} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {cards.length > 1 && (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous card"
                title="Previous card"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/55 transition duration-fast ease-standard hover:bg-white/10 hover:text-white"
              >
                <ChevronIcon left />
              </button>
            )}

            {/* Keyed on the card so the mount motion replays as you step through
                the set — a card that arrives is a card being dealt, which is the
                whole feeling this view is for. */}
            <div key={card.id} className="content-enter">
              <FocusCard
                dynastyId={dynastyId}
                card={card}
                width={width}
                transform={draft}
                draggable={Boolean(editing && editor && card.photoFile)}
                onPointerDownPhoto={onPhotoPointerDown}
              />
            </div>

            {cards.length > 1 && (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next card"
                title="Next card"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/55 transition duration-fast ease-standard hover:bg-white/10 hover:text-white"
              >
                <ChevronIcon />
              </button>
            )}
          </div>

          {/* One quiet bar of everything you can do to the card in front of you —
              the same pill the card's own hover controls use, so the gesture
              language doesn't change just because the card got bigger. Absent
              entirely for a read-only caller, rather than an empty pill. */}
          <div
            className={`items-center gap-0.5 rounded-full border border-white/15 bg-black/70 p-1 backdrop-blur-md ${
              editor || onExport ? 'flex' : 'hidden'
            }`}
          >
            {editor && (
              <button
                type="button"
                onClick={() => editor.toggleFavorite(card)}
                aria-pressed={card.favorite}
                title={card.favorite ? 'In your card book — click to remove' : 'Add this card to your card book'}
                aria-label={card.favorite ? 'Remove from card book' : 'Add to card book'}
                className={BAR_BTN}
              >
                <StarIcon filled={card.favorite} />
              </button>
            )}
            {editor && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                title={editing ? 'Close the editor' : 'Edit this card'}
                aria-label={editing ? 'Close the editor' : 'Edit this card'}
                className={`${BAR_BTN} ${editing ? 'bg-white/20 text-white' : ''}`}
              >
                <EditIcon className="h-[18px] w-[18px]" />
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={() => onExport(card)}
                title="Export card"
                aria-label="Export card"
                className={BAR_BTN}
              >
                <ExportIcon className="h-[18px] w-[18px]" />
              </button>
            )}
            {editor && (
              <button
                type="button"
                onClick={() => editor.makeDefault(card)}
                disabled={card.isDefault}
                title={card.isDefault ? 'Shown on hover' : 'Show this one on hover'}
                aria-label={card.isDefault ? 'Shown on hover' : 'Show this one on hover'}
                className={`${BAR_BTN} ${card.isDefault ? 'text-[#f0b429]' : ''}`}
              >
                <DefaultIcon on={card.isDefault} />
              </button>
            )}
            {editor && (
              <button
                type="button"
                onClick={() => editor.remove(card)}
                title="Delete this card"
                aria-label="Delete this card"
                className={`${BAR_BTN} hover:!text-red-400`}
              >
                <TrashIcon className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>

          {cards.length > 1 && (
            <p className="text-xs text-white/50">
              {index + 1} / {cards.length} &nbsp;·&nbsp; ← → to browse
            </p>
          )}
        </div>

        {/* The editor. Beside the card, never over it. */}
        {editing && editor && (
          <div className="modal-panel corner-cut max-h-[calc(100vh-6rem)] w-[21rem] shrink-0 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Photo</p>
              <input
                type="range"
                min={1}
                max={5}
                step={0.02}
                value={draft.scale}
                disabled={!card.photoFile}
                onChange={(e) => setDraft((prev) => ({ ...prev, scale: Number(e.target.value) }))}
                onPointerUp={() => editor.commitFraming(card, draftRef.current)}
                onKeyUp={() => editor.commitFraming(card, draftRef.current)}
                className="w-full accent-[var(--team-primary)] disabled:opacity-40"
                aria-label="Zoom photo"
              />
            </div>

            {/* Four, equal, two by two (user direction). Equal weight because
                they are equal choices — nothing here is the primary action. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => editor.pickPhoto(card)} className={EDIT_BTN}>
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => void toggleMedia()}
                aria-pressed={mediaOpen}
                className={`${EDIT_BTN} ${mediaOpen ? '!border-[var(--team-primary)]' : ''}`}
              >
                Media Photo
              </button>
              <button
                type="button"
                onClick={() => editor.removePhoto(card)}
                disabled={!card.photoFile}
                className={EDIT_BTN}
              >
                Remove Photo
              </button>
              <button type="button" onClick={() => setEditing(false)} className={EDIT_BTN}>
                Done
              </button>
            </div>

            {mediaOpen && (
              <div className="mt-3">
                {media === null ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
                ) : media.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    No photos tagged with {card.player.firstName} yet. Tag them in the Media gallery to reuse here.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {media.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          editor.useMediaPhoto(card, m.absolutePath);
                          setMediaOpen(false);
                        }}
                        title={m.description || m.gameLabel || 'Use this photo'}
                        className="group aspect-square overflow-hidden border border-slate-300/70 transition duration-fast ease-standard hover:border-[var(--team-primary)] dark:border-slate-700"
                      >
                        <img
                          src={mediaFileUrl(m.absolutePath)}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-cover transition duration-fast ease-standard group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Stats</p>
              {statsLocked ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {card.stats.map((s) => (
                      <span
                        key={s.label}
                        className="rounded-full border border-slate-300/80 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {card.statSource?.label ?? `${card.seasonYear} season`} — locked with the card. Open{' '}
                    {card.player.firstName} in the {card.seasonYear} season to change the line.
                  </p>
                </>
              ) : editor.statSources.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No stats recorded yet. They appear once games have been played and re-imported.
                </p>
              ) : (
                <>
                  {/* Season totals, or one Saturday. A card of a single game is
                      the reason this control exists — the 4-TD night against
                      the rival is the card people actually want to make. */}
                  <Select
                    value={activeSource?.key ?? ''}
                    onChange={pickSource}
                    options={editor.statSources.map((s) => ({ value: s.key, label: s.label }))}
                    ariaLabel="Which stats appear on the card"
                    className="w-full"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(activeSource?.tiles ?? []).map((s) => {
                      const on = selectedLabels.includes(s.label);
                      const full = !on && selectedLabels.length >= MAX_STATS;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => toggleStat(s.label)}
                          disabled={full}
                          aria-pressed={on}
                          title={`${s.value} ${s.label}`}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition duration-fast ease-standard ${
                            on
                              ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                              : 'border-slate-300/80 text-slate-500 hover:border-[var(--team-primary)] disabled:opacity-40 dark:border-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Up to {MAX_STATS} ({selectedLabels.length}/{MAX_STATS})
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Show on card</p>
              <CardLayerToggles layers={card.layers} onChange={(next) => editor.setLayers(card, next)} />
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
              <CardScrimControl scrim={card.scrim} onChange={(next) => editor.setScrim(card, next)} />
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
