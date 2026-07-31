import { useEffect, useRef, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { PlayerCard } from './PlayerCard';
import { CardLayerToggles } from './CardLayerToggles';
import { mediaFileUrl } from './MediaGallery';
import { useTeamThemeVars } from '../../lib/cardTheme';
import { ALL_CARD_LAYERS } from '../../../shared/types';
import type { CardLayers, CardPhotoTransform, PlayerCardRecord, RosterPlayer } from '../../../shared/types';

/**
 * One card, ready to be drawn and saved — the single shape both callers speak.
 *
 * The player-modal export has a LIVE card that may not even be a saved row yet;
 * the book has a list of saved rows. Flattening both to this is what lets one
 * dialog serve them, and it's why the dialog owns the rendering: it can't
 * capture a card it didn't draw, since the book's cards aren't all on screen
 * (and the modal's is behind this very dialog).
 */
export interface ExportableCard {
  key: string;
  /** Filename stem, without extension. */
  fileName: string;
  player: RosterPlayer;
  teamName: string | null;
  seasonYear: number | null;
  stats: { label: string; value: string }[];
  /** What the card itself says it shows — the dialog opens on this rather than on all-on. */
  layers: CardLayers;
  photoUrl: string | null;
  photoTransform: CardPhotoTransform;
}

/** A saved row as something exportable. */
export function exportableFromCard(card: PlayerCardRecord): ExportableCard {
  const name = `${card.player.firstName} ${card.player.lastName}`.trim();
  return {
    key: String(card.id),
    fileName: [name, card.seasonYear].filter(Boolean).join(' '),
    player: card.player,
    teamName: card.teamName,
    seasonYear: card.seasonYear,
    stats: card.stats,
    layers: card.layers,
    photoUrl: card.photoPath
      ? // Busted on updatedAt — a replaced photo reuses its filename, so an
        // un-busted src would export the image it replaced.
        `${mediaFileUrl(card.photoPath)}?v=${encodeURIComponent(card.updatedAt)}`
      : null,
    photoTransform: card.photoTransform,
  };
}

/** Card art is at its design width for the capture, so an exported PNG is the same size however the dialog is laid out. */
const CAPTURE_WIDTH = 330;

/** Resolves once every image inside the node has actually decoded — a capture taken a frame too early saves a card with no portrait on it. */
async function awaitImages(node: HTMLElement): Promise<void> {
  const images = [...node.querySelectorAll('img')];
  await Promise.all(
    images.map((img) =>
      img.complete
        ? img.decode().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
    ),
  );
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** The card being exported, drawn at capture size with the chosen layers. */
function CaptureCard({ item, layers }: { item: ExportableCard; layers: CardLayers }) {
  return (
    <PlayerCard
      player={item.player}
      teamName={item.teamName}
      seasonYear={item.seasonYear}
      stats={item.stats}
      photoUrl={item.photoUrl}
      photoTransform={item.photoTransform}
      layers={layers}
    />
  );
}

/** Wrapper that gives the capture card its own school's colours. */
function ThemedCapture({
  dynastyId,
  item,
  layers,
  innerRef,
}: {
  dynastyId: string;
  item: ExportableCard;
  layers: CardLayers;
  innerRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const colorVars = useTeamThemeVars(dynastyId, item.teamName);
  return (
    <div ref={innerRef} style={{ width: CAPTURE_WIDTH, ...colorVars }}>
      <CaptureCard item={item} layers={layers} />
    </div>
  );
}

/**
 * Turn parts of the card off, then export.
 *
 * Built standalone from the start because both callers need exactly this: the
 * player modal exports one card, the card book exports a selection, and the
 * only difference between them is how many are in the list. Retrofitting a
 * single-card dialog for multi-select afterwards is the more painful direction.
 *
 * ONE card goes through the ordinary save dialog, so the user names the file.
 * SEVERAL pick a folder once and are written into it — twenty cards through a
 * save dialog would be twenty dialogs.
 *
 * The dialog draws each card ITSELF rather than capturing one already on the
 * page. It has to: the book's cards aren't all on screen at capture size, and
 * the modal's card is behind this dialog. Drawing them here also means the
 * preview and the PNG are the same element, so what you see is what lands.
 */
export function CardExportDialog({
  open,
  onClose,
  dynastyId,
  items,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
  items: ExportableCard[];
}) {
  const [layers, setLayers] = useState<CardLayers>(ALL_CARD_LAYERS);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);

  // Seeded from the card being exported, not reset to all-on: since v13 a card
  // KNOWS what it shows, and a photo-and-name card that quietly grew its stat
  // row back on the way to a PNG would be the app overruling the user. Changes
  // made here are for this export only — the card's own setting lives in its
  // editor, which is why the section is labelled as such.
  const firstKey = items[0]?.key;
  useEffect(() => {
    if (open) {
      setIndex(0);
      setMsg(null);
      setLayers(items[0]?.layers ?? ALL_CARD_LAYERS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firstKey]);

  const current = items[Math.min(index, items.length - 1)] ?? null;

  // The panel portals to <body>, outside the dynasty container, so its own
  // accents (the Export button, the checkboxes) would otherwise fall back to an
  // undefined --team-primary and render grey. Themed to the card on screen, so
  // the chrome belongs to the same school the preview does.
  const panelVars = useTeamThemeVars(dynastyId, current?.teamName ?? null);

  /**
   * The card's rectangle, as a PLAIN object.
   *
   * Not the DOMRect itself: its x/y/width/height are prototype getters, and
   * Electron's structured clone carries own enumerable properties — so a DOMRect
   * arrives in the main process as an empty object, every dimension reads
   * `undefined`, `Math.round` turns them into NaN, and `capturePage` quietly
   * ignores the clip and returns THE WHOLE WINDOW. Caught by looking at an
   * exported file: a screenshot of the app with the export dialog in it,
   * saved under the player's name, reported as a success.
   */
  async function captureCurrent(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const node = captureRef.current;
    if (!node) return null;
    await awaitImages(node);
    const r = node.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  async function runExport() {
    if (items.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      if (items.length === 1) {
        const rect = await captureCurrent();
        if (!rect) return;
        const result = await window.api.export.playerCardToPng(items[0].fileName, rect);
        setMsg(result.message);
        if (result.success) onClose();
        return;
      }

      const folder = await window.api.export.pickCardFolder();
      if (!folder) {
        setMsg('Export canceled.');
        return;
      }
      let saved = 0;
      for (let i = 0; i < items.length; i++) {
        // Swapping the preview to each card in turn IS the progress indicator,
        // and it's honest: the card on screen is the one being written.
        setIndex(i);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = await captureCurrent();
        if (!rect) break;
        const result = await window.api.export.playerCardToFolder(folder, items[i].fileName, rect);
        if (result.success) saved++;
      }
      setMsg(`${saved} of ${items.length} card${items.length === 1 ? '' : 's'} saved.`);
      if (saved === items.length) onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <CenteredModalPanel
      open={open}
      onClose={busy ? () => undefined : onClose}
      widthRem={44}
      eyebrow={items.length === 1 ? 'Export card' : `Export ${items.length} cards`}
      title={items.length === 1 ? (current?.fileName ?? 'Card') : 'Choose what appears'}
    >
      <div className="flex flex-col items-start gap-6 sm:flex-row" style={panelVars}>
        <div className="mx-auto shrink-0 sm:mx-0">
          {current && <ThemedCapture dynastyId={dynastyId} item={current} layers={layers} innerRef={captureRef} />}
          {items.length > 1 && (
            <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
              {busy ? `Saving ${index + 1} of ${items.length}…` : `${index + 1} of ${items.length}`}
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Show in this export</p>
          <div className="mt-2">
            <CardLayerToggles layers={layers} onChange={setLayers} disabled={busy} />
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Just for the file you&apos;re saving. What the card itself shows is set in its editor.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runExport}
              disabled={busy || items.length === 0}
              className="corner-cut-sm border border-slate-300/80 bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Saving…' : items.length === 1 ? 'Export card' : `Export ${items.length} cards`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>

          {msg && <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{msg}</p>}
        </div>
      </div>
    </CenteredModalPanel>
  );
}
