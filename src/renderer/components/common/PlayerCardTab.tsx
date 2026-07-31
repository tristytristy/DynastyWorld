import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardExportDialog, exportableFromCard } from './CardExportDialog';
import { CardFocusModal } from './CardFocusModal';
import { CardGrid } from './CardGrid';
import { useConfirm } from '../../data/ConfirmDialogProvider';
import { useTeamThemeVars } from '../../lib/cardTheme';
import { ALL_CARD_LAYERS } from '../../../shared/types';
import type { CardFocusEditor } from './CardFocusModal';
import type {
  CardLayers,
  CardPhotoTransform,
  CardStatSource,
  CardStatSourceOption,
  PlayerCardInput,
  PlayerCardRecord,
  RosterPlayer,
} from '../../../shared/types';

/**
 * Which stats headline the card, by default, when the user hasn't picked their
 * own. Higher wins; anything unlisted sits in the middle, and "Games" is pushed
 * to the bottom so a marquee line (Pass Yds, Pass TD, …) leads instead. A player
 * is only ever one side of the ball, so the shared 'INT' label is unambiguous
 * per card.
 */
const STAT_PRIORITY: Record<string, number> = {
  'Pass Yds': 100,
  'Pass TD': 96,
  'Rush Yds': 92,
  'Rush TD': 90,
  'Rec Yds': 88,
  'Rec TD': 86,
  Tackles: 100,
  Sacks: 96,
  TFL: 88,
  Rec: 74,
  'Pass Def.': 72,
  'Forced Fum.': 70,
  'Comp/Att': 68,
  'Fum. Rec.': 66,
  INT: 62,
  'Int Yds': 58,
  Assists: 56,
  'Rush Att': 40,
  'Pass Att': 30,
  Games: 0,
};

/**
 * The default marquee stats (up to 3) for a card, most-notable first.
 *
 * Negatives are skipped when there's anything else to print. A quarterback's
 * rushing line is frequently "-30 Rush Yds" once sacks are counted, and that
 * number ranks high enough to walk straight onto the card — a printed card
 * leading with a loss is not the card anyone meant to make. They stay pickable;
 * they just don't get chosen on the player's behalf.
 */
function defaultStats(tiles: { label: string; value: string }[]): { label: string; value: string }[] {
  const ranked = [...tiles].sort((a, b) => (STAT_PRIORITY[b.label] ?? 50) - (STAT_PRIORITY[a.label] ?? 50));
  const positive = ranked.filter((t) => !t.value.trim().startsWith('-'));
  return (positive.length > 0 ? positive : ranked).slice(0, 3);
}

const DEFAULT_TRANSFORM: CardPhotoTransform = { x: 0, y: 0, scale: 1 };

/** The id the unsaved preview card carries. Negative so it can never collide with a real row. */
const DRAFT_ID = -1;

/** A localStorage value parsed back, or null if it's absent or unreadable. */
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** The last path segment of a stored photo — the card row keeps the basename, not the full path. */
function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/**
 * The player-modal "Cards" tab — every card this player has, and everything that
 * makes another one.
 *
 * WHERE THE STATE LIVES. A card is a row in `player_cards` (schema v12, extended
 * in v13): the photo's filename, its framing, the chosen stat line and where it
 * came from, which layers it draws, the star, and a frozen copy of the player as
 * they were.
 *
 * A row is created LAZILY — on the first thing the user actually does, not on
 * merely opening the tab, so browsing a roster doesn't quietly mint a card for
 * every player looked at. Until then the grid shows a live DRAFT tile: a real
 * card built from the player as they are right now, which becomes card one the
 * moment it's opened. That keeps the lazy rule without making a player with no
 * cards look like a player with nothing to show.
 *
 * TWO RULES THIS TAB EXISTS TO HOLD (user direction, 2026-07-30):
 *
 *  - **Cards are not a view of the current season.** They are the player's
 *    story, so the list is loaded per PLAYER and nothing about switching the
 *    season selector reloads it, reorders it, or changes what any card shows.
 *  - **A card locks its year and profile when it is made.** The identity columns
 *    are write-once in the DAL; everything here passes the card's own frozen
 *    values back on save rather than the live ones, and the stat line can only
 *    be re-picked from the season the card was printed in.
 *
 * Legacy state is adopted, not abandoned: a player with a pre-v12 photo or saved
 * stat picks gets a row built from them the first time this tab opens, keeping
 * the photo file exactly where it already sits.
 */
export function PlayerCardTab({
  player,
  teamName,
  seasonYear,
  statSources,
  playerName,
  dynastyId,
}: {
  player: RosterPlayer;
  teamName: string | null;
  seasonYear?: number | null;
  /** The season line and every game played, as pickable stat lines. */
  statSources: CardStatSourceOption[];
  playerName: string;
  dynastyId: string;
}) {
  const confirm = useConfirm();

  // The tab is inside the dynasty container, but a player's card wears their OWN
  // school's colours (any team, not just the user's), so resolve them here.
  const colorVars = useTeamThemeVars(dynastyId, teamName);

  const [cards, setCards] = useState<PlayerCardRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [exportCard, setExportCard] = useState<PlayerCardRecord | null>(null);

  // Pre-v12 keys. READ ONLY, and only to adopt what a user already has — the
  // row is the source of truth from here on, so nothing writes these again.
  const legacyStatsKey = `cfb.cardstats.${dynastyId}.${player.id}`;
  const legacyTransformKey = `cfb.cardphoto.${dynastyId}.${player.id}`;

  const seasonSource = statSources.find((s) => s.kind === 'season') ?? statSources[0] ?? null;

  // Held in a ref so the load effect can read the newest sources without listing
  // them as dependencies — a season switch changes the stat lists, and reloading
  // the cards because of that is exactly what rule one forbids.
  const sourcesRef = useRef({ seasonSource, seasonYear, teamName, player });
  sourcesRef.current = { seasonSource, seasonYear, teamName, player };

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setCards([]);
    setFocusId(null);

    (async () => {
      let loadedCards = await window.api.card.list(dynastyId, player.id);

      if (loadedCards.length === 0) {
        // Nothing saved yet — adopt any pre-v12 state so an existing card
        // survives the migration exactly as the user left it.
        const legacyPhoto = await window.api.card.getPhoto(dynastyId, player.id);
        const legacyTransform = readJson<CardPhotoTransform>(legacyTransformKey);
        const legacyLabels = readJson<string[]>(legacyStatsKey);
        if (legacyPhoto || legacyLabels) {
          const live = sourcesRef.current;
          const tiles = live.seasonSource?.tiles ?? [];
          const kept = (legacyLabels ?? [])
            .map((l) => tiles.find((t) => t.label === l))
            .filter((t): t is { label: string; value: string } => Boolean(t));
          const created = await window.api.card.create(dynastyId, player.id, {
            seasonYear: live.seasonYear ?? null,
            teamName: live.teamName,
            player: live.player,
            stats: kept.length > 0 ? kept : defaultStats(tiles),
            layers: ALL_CARD_LAYERS,
            statSource: live.seasonSource
              ? { key: live.seasonSource.key, kind: live.seasonSource.kind, label: live.seasonSource.label }
              : null,
            photoFile: legacyPhoto ? baseName(legacyPhoto) : null,
            photoTransform: legacyTransform ?? DEFAULT_TRANSFORM,
          });
          loadedCards = [created];
        }
      }

      if (cancelled) return;
      setCards(loadedCards);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynastyId, player.id]);

  /** Folds a changed row back into the list in place, so the grid and the focused card can't disagree. */
  const mergeCard = useCallback((updated: PlayerCardRecord) => {
    setCards((prev) =>
      prev.some((c) => c.id === updated.id) ? prev.map((c) => (c.id === updated.id ? updated : c)) : [...prev, updated],
    );
  }, []);

  /**
   * The unsaved first card. A real card in every respect except that it has no
   * row yet — built from the player as they are right now, and committed the
   * moment the user opens it.
   */
  const draftCard: PlayerCardRecord | null = useMemo(() => {
    if (!loaded || cards.length > 0) return null;
    const now = new Date().toISOString();
    return {
      id: DRAFT_ID,
      playerId: player.id,
      seasonYear: seasonYear ?? null,
      teamName,
      player,
      stats: defaultStats(seasonSource?.tiles ?? []),
      layers: ALL_CARD_LAYERS,
      statSource: seasonSource
        ? { key: seasonSource.key, kind: seasonSource.kind, label: seasonSource.label }
        : null,
      photoFile: null,
      photoPath: null,
      photoTransform: DEFAULT_TRANSFORM,
      favorite: false,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };
  }, [loaded, cards.length, player, seasonYear, teamName, seasonSource]);

  /** A brand-new card for this player, frozen at the season and profile now in view. */
  const newCardInput = useCallback(
    (over: Partial<PlayerCardInput> = {}): PlayerCardInput => ({
      seasonYear: seasonYear ?? null,
      teamName,
      player,
      stats: defaultStats(seasonSource?.tiles ?? []),
      layers: ALL_CARD_LAYERS,
      statSource: seasonSource
        ? { key: seasonSource.key, kind: seasonSource.kind, label: seasonSource.label }
        : null,
      photoFile: null,
      photoTransform: DEFAULT_TRANSFORM,
      ...over,
    }),
    [seasonYear, teamName, player, seasonSource],
  );

  // Two clicks in quick succession must not each decide there is no row and
  // create one. The in-flight create is shared.
  const creating = useRef<Promise<PlayerCardRecord> | null>(null);

  /** Commits the draft tile into a real row (or returns the row it already became). */
  const commitDraft = useCallback(async (): Promise<PlayerCardRecord> => {
    if (cards.length > 0) return cards[0];
    if (!creating.current) {
      creating.current = window.api.card.create(dynastyId, player.id, newCardInput()).then((created) => {
        mergeCard(created);
        creating.current = null;
        return created;
      });
    }
    return creating.current;
  }, [cards, dynastyId, player.id, newCardInput, mergeCard]);

  /**
   * Writes a card's editable content back.
   *
   * Its identity — year, school, the player as printed — is passed straight back
   * from the row rather than rebuilt from what the app is currently showing.
   * The DAL ignores those columns on update anyway; sending the card's own
   * values means the two halves agree about what a card is.
   */
  const saveCard = useCallback(
    async (card: PlayerCardRecord, over: Partial<PlayerCardInput>) => {
      const updated = await window.api.card.update(dynastyId, card.id, {
        seasonYear: card.seasonYear,
        teamName: card.teamName,
        player: card.player,
        stats: card.stats,
        layers: card.layers,
        statSource: card.statSource,
        photoFile: card.photoFile,
        photoTransform: card.photoTransform,
        ...over,
      });
      if (updated) mergeCard(updated);
      return updated;
    },
    [dynastyId, mergeCard],
  );

  /**
   * Another card for the same player. Starts from the player as they are right
   * now with no photo — the reason to make another one is almost always a
   * different photo, so an empty frame is the honest starting point rather than
   * a duplicate of the one you already have.
   */
  async function addCard() {
    await commitDraft(); // a draft on screen becomes card one rather than being thrown away
    const created = await window.api.card.create(dynastyId, player.id, newCardInput());
    mergeCard(created);
    setFocusId(created.id);
  }

  async function openCard(card: PlayerCardRecord) {
    if (card.id === DRAFT_ID) {
      const committed = await commitDraft();
      setFocusId(committed.id);
      return;
    }
    setFocusId(card.id);
  }

  async function makeDefault(id: number) {
    if (id === DRAFT_ID) return;
    setCards(await window.api.card.setDefault(dynastyId, player.id, id));
  }

  async function deleteCard(card: PlayerCardRecord) {
    const ok = await confirm({
      eyebrow: 'Delete card',
      title: 'Delete this card?',
      message:
        'The card and any photo you put on it are removed for good. The player is untouched — only the card goes.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const remaining = await window.api.card.remove(dynastyId, card.id);
    setCards(remaining);
    setFocusId((current) => (current === card.id ? (remaining[0]?.id ?? null) : current));
  }

  // --- The editor, as the focused card sees it ---
  const editor: CardFocusEditor = {
    statSources,
    viewedSeasonYear: seasonYear ?? null,
    listMedia: async () => {
      const items = await window.api.media.listForPlayer(dynastyId, player.id);
      return items.filter((m) => m.mediaType === 'image');
    },
    pickPhoto: (card) => {
      void (async () => {
        const file = await window.api.card.pickPhotoForCard(dynastyId, player.id, card.id);
        if (!file) return;
        await saveCard(card, { photoFile: file, photoTransform: DEFAULT_TRANSFORM });
      })();
    },
    useMediaPhoto: (card, absolutePath) => {
      void (async () => {
        const file = await window.api.card.setCardPhotoFromPath(dynastyId, player.id, card.id, absolutePath);
        if (!file) return;
        await saveCard(card, { photoFile: file, photoTransform: DEFAULT_TRANSFORM });
      })();
    },
    removePhoto: (card) => {
      void (async () => {
        if (!card.photoFile) return;
        await window.api.card.removeCardPhoto(dynastyId, card.photoFile);
        await saveCard(card, { photoFile: null, photoTransform: DEFAULT_TRANSFORM });
      })();
    },
    commitFraming: (card, photoTransform) => {
      void saveCard(card, { photoTransform });
    },
    setStats: (card, statSource: CardStatSource, stats) => {
      void saveCard(card, { statSource, stats });
    },
    setLayers: (card, layers: CardLayers) => {
      void saveCard(card, { layers });
    },
    toggleFavorite: (card) => {
      void (async () => {
        const updated = await window.api.card.setFavorite(dynastyId, card.id, !card.favorite);
        if (updated) mergeCard(updated);
      })();
    },
    makeDefault: (card) => void makeDefault(card.id),
    remove: (card) => void deleteCard(card),
  };

  // Creation order, so ← / → in the focused card walks the grid in the order the
  // grid draws it rather than in the DAL's default-first order.
  const ordered = [...cards].sort((a, b) => a.id - b.id);
  const focusIndex = ordered.findIndex((c) => c.id === focusId);

  return (
    <div className="py-4" style={colorVars}>
      {/* Heading and count AFTER the collection has loaded — a count that
          flickers in from nothing reads as a number that changed. */}
      {loaded && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Cards</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {cards.length === 0 ? 'None yet' : `${cards.length} card${cards.length === 1 ? '' : 's'}`}
          </p>
        </div>
      )}
      {loaded && (
        <CardGrid
          dynastyId={dynastyId}
          cards={draftCard ? [draftCard] : ordered}
          onOpen={(card) => void openCard(card)}
          onAdd={() => void addCard()}
          onMakeDefault={(id) => void makeDefault(id)}
        />
      )}

      {focusIndex >= 0 && (
        <CardFocusModal
          dynastyId={dynastyId}
          cards={ordered}
          index={focusIndex}
          onIndex={(next) => setFocusId(ordered[next]?.id ?? null)}
          onClose={() => setFocusId(null)}
          onExport={(card) => setExportCard(card)}
          editor={editor}
        />
      )}

      <CardExportDialog
        open={exportCard !== null}
        onClose={() => setExportCard(null)}
        dynastyId={dynastyId}
        items={
          exportCard
            ? [{ ...exportableFromCard(exportCard), fileName: [playerName, exportCard.seasonYear].filter(Boolean).join(' ') }]
            : []
        }
      />
    </div>
  );
}
