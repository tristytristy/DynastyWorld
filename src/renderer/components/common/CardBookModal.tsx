import { useCallback, useEffect, useMemo, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { CardExportDialog, exportableFromCard } from './CardExportDialog';
import { CardFocusModal } from './CardFocusModal';
import { ScaledSavedPlayerCard } from './SavedPlayerCard';
import { ExportIcon, TrashIcon } from './ActionIcons';
import { useTeamThemeVars } from '../../lib/cardTheme';
import { useConfirm } from '../../data/ConfirmDialogProvider';
import type { PlayerCardRecord } from '../../../shared/types';

/** How wide a card sits on a page of the book. */
const CARD_W = 220;

/** Cards with no season, which have to go somewhere and shouldn't pretend to a year. */
const NO_YEAR = '—';

const TOOLBAR_BTN =
  'border border-slate-300/80 bg-white/85 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white';

const TOOLBAR_ICON_BTN =
  'grid h-8 w-8 place-items-center border border-slate-300/80 bg-white/85 text-slate-600 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white';

interface BookPage {
  key: string;
  label: string;
  cards: PlayerCardRecord[];
}

/**
 * Favourited cards split into pages, one per season, oldest first. A new year is
 * a new page — that's the whole pagination rule, and it's why the page label can
 * just be the year.
 */
function paginate(cards: PlayerCardRecord[]): BookPage[] {
  const byYear = new Map<string, PlayerCardRecord[]>();
  for (const card of cards) {
    const key = card.seasonYear === null ? NO_YEAR : String(card.seasonYear);
    const bucket = byYear.get(key);
    if (bucket) bucket.push(card);
    else byYear.set(key, [card]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => {
      // The yearless page goes last: it's a fallback, not a season.
      if (a === NO_YEAR) return 1;
      if (b === NO_YEAR) return -1;
      return Number(a) - Number(b);
    })
    .map(([label, pageCards]) => ({ key: label, label, cards: pageCards }));
}

/**
 * The card book — every starred card in the dynasty, a page per season.
 *
 * Almost no text on purpose. The cards are the content; a book that explains
 * itself in prose is a report about cards rather than a book of them.
 *
 * TWO MODES, because one click can't mean two things. Browsing is the default
 * and a click opens the card full size — which is what you want nine times out
 * of ten in something called a book. **Select** switches clicks over to picking,
 * and only then do the actions that operate on a selection exist: export and
 * delete appear once at least one card is chosen, and are simply absent the rest
 * of the time rather than sitting there greyed out.
 */
export function CardBookModal({
  open,
  onClose,
  dynastyId,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
}) {
  const confirm = useConfirm();
  const [cards, setCards] = useState<PlayerCardRecord[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await window.api.card.listFavorites(dynastyId);
    setCards(rows);
    return rows;
  }, [dynastyId]);

  useEffect(() => {
    if (!open) return;
    setCards(null);
    setSelected(new Set());
    setSelecting(false);
    setExpandedIndex(null);
    setPageIndex(0);
    void load();
  }, [open, load]);

  const pages = useMemo(() => paginate(cards ?? []), [cards]);
  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const page = pages[safePageIndex] ?? null;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Leaving select mode drops the selection — a set you can no longer see isn't a set you meant to keep. */
  function toggleSelecting() {
    setSelecting((prev) => {
      if (prev) setSelected(new Set());
      return !prev;
    });
  }

  const selectedCards = (cards ?? []).filter((c) => selected.has(c.id));

  async function deleteSelected() {
    const ok = await confirm({
      eyebrow: 'Delete cards',
      title: `Delete ${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'}?`,
      message:
        'The cards and any photos you put on them are removed for good. The players are untouched — only the cards go.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      for (const card of selectedCards) {
        await window.api.card.remove(dynastyId, card.id);
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Portals to <body>, outside the dynasty container, so the book's own accents
  // (the season tabs, the selection outline) would fall back to an undefined
  // --team-primary and render grey. The cards inside still resolve their OWN
  // school's colours; this is only the chrome around them.
  const chromeVars = useTeamThemeVars(dynastyId, null);

  return (
    <>
      <CenteredModalPanel open={open} onClose={onClose} widthRem={76} title="Cards">
        {cards === null ? (
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Star a card on any player&apos;s Card tab and it lands here.
          </p>
        ) : (
          <div className="space-y-4" style={chromeVars}>
            <div className="flex flex-wrap items-center gap-2">
              {/* The spine. One tab per season, which is one page per season. */}
              <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Seasons">
                {pages.map((p, i) => {
                  const active = i === safePageIndex;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPageIndex(i)}
                      className={`corner-cut-sm border px-3 py-1.5 text-sm font-semibold tracking-wide transition ${
                        active
                          ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                          : 'border-slate-300/80 text-slate-500 hover:border-[var(--team-primary)] dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {selected.size > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">{selected.size} selected</span>
                )}
                {/* Only exist once there's a selection to act on. */}
                {selected.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExportOpen(true)}
                      disabled={busy}
                      aria-label={`Export ${selected.size} card${selected.size === 1 ? '' : 's'}`}
                      title={`Export ${selected.size} card${selected.size === 1 ? '' : 's'}`}
                      className={TOOLBAR_ICON_BTN}
                    >
                      <ExportIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSelected()}
                      disabled={busy}
                      aria-label={`Delete ${selected.size} card${selected.size === 1 ? '' : 's'}`}
                      title={`Delete ${selected.size} card${selected.size === 1 ? '' : 's'}`}
                      className={`${TOOLBAR_ICON_BTN} hover:!border-red-400 hover:!text-red-600 dark:hover:!text-red-400`}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleSelecting}
                  aria-pressed={selecting}
                  className={`${TOOLBAR_BTN} ${
                    selecting ? '!border-[var(--team-primary)] !text-slate-900 dark:!text-white' : ''
                  }`}
                >
                  {selecting ? 'Done' : 'Select'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
              {page?.cards.map((card, i) => {
                const on = selected.has(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => (selecting ? toggle(card.id) : setExpandedIndex(i))}
                    aria-pressed={selecting ? on : undefined}
                    aria-label={`${card.player.firstName} ${card.player.lastName}`}
                    title={selecting ? 'Select' : 'Open'}
                    className={`transition ${
                      selecting && on
                        ? 'opacity-100 outline outline-2 outline-offset-4 outline-[var(--team-primary)]'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <ScaledSavedPlayerCard dynastyId={dynastyId} card={card} width={CARD_W} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CenteredModalPanel>

      {/* Click a card in the book and it opens here, full size, with ← / →
          stepping through the rest of the page — the same expanded card the
          player modal opens, minus the editor: the book is for looking at a
          collection, and a card is edited where it was made. */}
      {open && expandedIndex !== null && page && (
        <CardFocusModal
          dynastyId={dynastyId}
          cards={page.cards}
          index={Math.min(expandedIndex, page.cards.length - 1)}
          onIndex={setExpandedIndex}
          onClose={() => setExpandedIndex(null)}
        />
      )}

      <CardExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        dynastyId={dynastyId}
        items={selectedCards.map(exportableFromCard)}
      />
    </>
  );
}
