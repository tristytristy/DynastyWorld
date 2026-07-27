import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PlayerCard } from '../components/common/PlayerCard';
import { useTheme } from '../theme/ThemeProvider';
import { getPlayerCardHoverDelayMs, getPlayerCardHoverEnabled } from '../lib/hoverCardPrefs';
import type { RosterPlayer, TeamTheme } from '../../shared/types';

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

// Team colors are stable within a session; cache by team so a hover never
// re-hits IPC for a team we've already themed.
const themeCache = new Map<string, TeamTheme | null>();

function readTransform(dynastyId: string, playerId: number): { x: number; y: number; scale: number } {
  try {
    const raw = localStorage.getItem(`cfb.cardphoto.${dynastyId}.${playerId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { x: number; y: number; scale: number };
      return { x: parsed.x ?? 0, y: parsed.y ?? 0, scale: parsed.scale ?? 1 };
    }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, scale: 1 };
}

/** The floating preview itself — resolves colors + the player's framed photo, then positions near the anchor. */
function HoverCard({ data, rect }: HoverState) {
  const { resolveColorVars } = useTheme();
  const cacheKey = `${data.dynastyId}::${data.teamName ?? ''}`;
  const [theme, setTheme] = useState<TeamTheme | null>(() => themeCache.get(cacheKey) ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (themeCache.has(cacheKey)) {
      setTheme(themeCache.get(cacheKey) ?? null);
    } else {
      const request = data.teamName
        ? window.api.db.getTeamTheme(data.dynastyId, data.teamName)
        : window.api.db.getDynastyTheme(data.dynastyId);
      request.then((t) => {
        const colors = t ? { primaryColor: t.primaryColor, secondaryColor: t.secondaryColor } : null;
        themeCache.set(cacheKey, colors);
        if (!cancelled) setTheme(colors);
      });
    }
    window.api.card.getPhoto(data.dynastyId, data.player.id).then((p) => {
      if (!cancelled) {
        setPhotoUrl(p ? encodeURI(`file:///${p.replace(/\\/g, '/')}`) : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, data.dynastyId, data.teamName, data.player.id]);

  const colorVars = resolveColorVars({ primary: theme?.primaryColor ?? null, secondary: theme?.secondaryColor ?? null });

  // Prefer the right of the name; flip left if it would overflow, then clamp.
  let left = rect.right + 12;
  if (left + CARD_W > window.innerWidth - 8) left = rect.left - CARD_W - 12;
  left = Math.max(8, Math.min(left, window.innerWidth - CARD_W - 8));
  const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - CARD_H - 8));

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] animate-[cardHoverIn_140ms_ease-out]"
      style={{ left, top, width: CARD_W, ...(colorVars as CSSProperties) }}
    >
      <PlayerCard
        player={data.player}
        teamName={data.teamName}
        seasonYear={data.seasonYear}
        stats={data.stats ?? []}
        photoUrl={photoUrl}
        photoTransform={photoUrl ? readTransform(data.dynastyId, data.player.id) : undefined}
      />
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
