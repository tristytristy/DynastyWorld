import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PlayerCard } from '../components/common/PlayerCard';
import { SavedPlayerCard } from '../components/common/SavedPlayerCard';
import { mediaFileUrl as fileUrl } from '../components/common/MediaGallery';
import { useTeamThemeVars } from '../lib/cardTheme';
import { getPlayerCardHoverDelayMs, getPlayerCardHoverEnabled } from '../lib/hoverCardPrefs';
import type { CardPhotoTransform, PlayerCardRecord, RosterPlayer } from '../../shared/types';

/** Everything the floating card needs — the player object we already hold at the hover site, plus its team/season context. */
export interface PlayerHoverData {
  player: RosterPlayer;
  teamName: string | null;
  seasonYear: number | null;
  dynastyId: string;
  /** Optional marquee stat line; omitted on hover for speed — the full card lives in the modal. */
  stats?: { label: string; value: string }[];
}

interface HoverState {
  data: PlayerHoverData;
  rect: DOMRect;
}

interface PlayerHoverContextValue {
  show: (data: PlayerHoverData, rect: DOMRect) => void;
  hide: () => void;
}

const PlayerHoverContext = createContext<PlayerHoverContextValue | null>(null);

const CARD_W = 250;
const CARD_H = Math.round((CARD_W * 496) / 330);

const NO_TRANSFORM: CardPhotoTransform = { x: 0, y: 0, scale: 1 };

/**
 * The hover card shows the name, the school's mark and the OVR — and nothing
 * else.
 *
 * The reason is the size. The card is designed at 330px with type in FIXED
 * pixels (a 46px surname, an 11px profile line), and everywhere else it is
 * drawn at that width and SCALED — see ScaledSavedPlayerCard. The hover is the
 * one place that lays it out at 250px instead, so every text element arrives a
 * third too big for the box it is in: the profile line wraps or clips, and the
 * stat row runs into the team logo.
 *
 * Dropping the two crowded layers leaves the three that are legible at any size
 * and are all a preview is for — who, where, how good. What the card actually
 * looks like is a click away in the modal, at its proper size.
 *
 * These override the SAVED card's own layer choices in one direction only: a
 * layer the user switched off on their card stays off.
 */
// The opponent goes with the profile and the stats: a hover preview is name,
// team and OVR, and a matchup line is exactly the detail that trim removed.
const HOVER_LAYERS = { profile: false, stats: false, opponent: false } as const;

/** Pre-v12 framing, kept only as the fallback for a player who has a legacy photo file but no saved card row. */
function readLegacyTransform(dynastyId: string, playerId: number): CardPhotoTransform {
  try {
    const raw = localStorage.getItem(`cfb.cardphoto.${dynastyId}.${playerId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CardPhotoTransform>;
      return { x: parsed.x ?? 0, y: parsed.y ?? 0, scale: parsed.scale ?? 1 };
    }
  } catch {
    /* ignore */
  }
  return NO_TRANSFORM;
}

/**
 * The floating preview itself.
 *
 * When the player has a saved card, the preview IS that card — the one marked
 * default — rendered straight from its row: its photo and framing, its stat
 * line, the player as they were on it, and its school's colours. That is what
 * makes "the default is what shows on hover" mean something; drawing the live
 * player with only the photo borrowed would show a card the user never made.
 *
 * With no saved card it falls back to a live card built from the hover site's
 * own player object, plus any pre-v12 photo file and its localStorage framing.
 */
function HoverCard({ data, rect }: HoverState) {
  const colorVars = useTeamThemeVars(data.dynastyId, data.teamName);
  const [card, setCard] = useState<PlayerCardRecord | null>(null);
  const [legacyPhotoUrl, setLegacyPhotoUrl] = useState<string | null>(null);
  const [legacyTransform, setLegacyTransform] = useState<CardPhotoTransform>(NO_TRANSFORM);

  useEffect(() => {
    let cancelled = false;
    setCard(null);

    window.api.card.list(data.dynastyId, data.player.id).then(async (cards) => {
      const preferred = cards.find((c) => c.isDefault) ?? cards[0] ?? null;
      if (preferred) {
        if (!cancelled) setCard(preferred);
        return;
      }
      const legacy = await window.api.card.getPhoto(data.dynastyId, data.player.id);
      if (!cancelled) {
        setLegacyPhotoUrl(legacy ? fileUrl(legacy) : null);
        setLegacyTransform(legacy ? readLegacyTransform(data.dynastyId, data.player.id) : NO_TRANSFORM);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data.dynastyId, data.player.id]);

  // Prefer the right of the name; flip left if it would overflow, then clamp.
  let left = rect.right + 12;
  if (left + CARD_W > window.innerWidth - 8) left = rect.left - CARD_W - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - CARD_W - 8));
  const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - CARD_H - 8));

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] animate-[cardHoverIn_140ms_ease-out]"
      style={{ left, top, width: CARD_W, ...colorVars }}
    >
      {card ? (
        <SavedPlayerCard dynastyId={data.dynastyId} card={card} layerOverrides={HOVER_LAYERS} />
      ) : (
        <PlayerCard
          player={data.player}
          teamName={data.teamName}
          seasonYear={data.seasonYear}
          stats={data.stats ?? []}
          layers={HOVER_LAYERS}
          photoUrl={legacyPhotoUrl}
          photoTransform={legacyPhotoUrl ? legacyTransform : undefined}
        />
      )}
    </div>,
    document.body,
  );
}

/**
 * Premium touch: hovering a player's name anywhere for ~0.85s pops their trading
 * card — the same framed photo, OVR, and team look they set in the modal. One
 * provider owns the single floating card; call sites opt in with the
 * usePlayerHoverCard() hook, spreading its handlers onto the existing name
 * element (no wrapper, no layout change).
 */
export function PlayerHoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HoverState | null>(null);

  const show = useCallback((data: PlayerHoverData, rect: DOMRect) => setState({ data, rect }), []);
  const hide = useCallback(() => setState(null), []);

  // A stale rect after scroll would misplace the card — dismiss on any scroll.
  useEffect(() => {
    if (!state) return;
    const onScroll = () => setState(null);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('wheel', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', onScroll);
    };
  }, [state]);

  const value = useMemo<PlayerHoverContextValue>(() => ({ show, hide }), [show, hide]);

  return (
    <PlayerHoverContext.Provider value={value}>
      {children}
      {state && <HoverCard data={state.data} rect={state.rect} />}
    </PlayerHoverContext.Provider>
  );
}

/**
 * Returns `hoverProps(data)` — spread the result onto a player-name element to
 * arm the hover-card preview. Safe to call once per component and reuse across a
 * list (the delay timer lives in one shared ref).
 */
export function usePlayerHoverCard() {
  const ctx = useContext(PlayerHoverContext);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useMemo(() => {
    if (!ctx) return { hoverProps: (_data: PlayerHoverData) => ({}) };
    const { show, hide } = ctx;
    return {
      hoverProps(data: PlayerHoverData) {
        return {
          onMouseEnter(event: ReactMouseEvent) {
            if (!getPlayerCardHoverEnabled()) return; // preview turned off in Preferences
            const el = event.currentTarget as HTMLElement;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => show(data, el.getBoundingClientRect()), getPlayerCardHoverDelayMs());
          },
          onMouseLeave() {
            window.clearTimeout(timer.current);
            hide();
          },
        };
      },
    };
  }, [ctx]);
}
