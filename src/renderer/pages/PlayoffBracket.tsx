import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useGameModal } from '../data/GameModalProvider';
import { getLogoPath } from '../lib/assetMapping';
import {
  getBowlLogoPath,
  getBowlTrophyPath,
  getNationalChampionshipAppearanceImagePath,
  getPlayoffRoundImagePath,
} from '../lib/trophyAssetMapping';
import { getNeutralVenue } from '../lib/neutralVenues';
import { CFP_FIRST_ROUND, CFP_QUARTERFINAL, CFP_SEMIFINAL } from '../../shared/cfpBowls';
import { CHAMPIONSHIP_SLOT, FEEDS_INTO } from '../../shared/playoffBracket';
import type { PlayoffBracketGame, PlayoffBracketSide, PlayoffBracketView } from '../../shared/types';

/**
 * The twelve-team playoff, as a bracket.
 *
 * The layout is the real one and that is the point: four columns left to right,
 * the bye seed sitting BELOW its pending opponent in the quarterfinal column
 * (that asymmetry is what makes a bye legible), the bowl's own mark on the
 * junction each game feeds, and the trophy at the end.
 *
 * The room is the Trophy Room's — dark in both themes, losers going to ash so
 * the surviving path is the only lit thing left. See `.cfp-*` in globals.css.
 */

const NATIONAL_CHAMPIONSHIP = 'National Championship';

/**
 * Natural size of one bracket box; the stage scales as a whole from here.
 *
 * BRACKET_H is the load-bearing one. Without an explicit height the columns
 * size to their own content — four stacked pairs, about 460px — and the whole
 * thing reads cramped, rounds crushed together with no air between games.
 * Giving the columns a height they can't fill lets `justify-around` distribute
 * the slack, which is also precisely what keeps each round centred against the
 * one feeding it. Everything else is parametric off these, so the connectors,
 * medallion positions and pair geometry all follow automatically.
 */
const BOX_H = 54;
const BOX_GAP = 8;
const GUTTER = 56;
const COL_W = 276;
const BRACKET_H = 760;
/** Below this the type stops being readable, so it pans instead of shrinking further. */
const SCALE_FLOOR = 0.66;

/**
 * Vertical order within each column, top to bottom — NOT slot order.
 *
 * The bracket reads 12/5, 9/8, 11/6, 10/7 down the first round, because each
 * pair must sit beside the quarterfinal it actually feeds: slot 3 → 7, 0 → 4,
 * 2 → 6, 1 → 5. Ordering the first round by seed instead (3, 2, 1, 0) looks
 * plausible and is wrong — it draws a connector from the 11/6 game into the
 * 1 seed's quarterfinal, which is fed by 9/8. Caught by screenshotting it;
 * the content was all correct, only the routing was a lie.
 *
 * Listing the slots explicitly IS the layout. Deriving it would be the same
 * list written as arithmetic, and harder to check against a real bracket.
 */
const COLUMNS: { title: string; slots: number[] }[] = [
  { title: 'First Round', slots: [3, 0, 2, 1] },
  { title: 'Quarterfinal', slots: [7, 4, 6, 5] },
  { title: 'Semifinal', slots: [8, 9] },
  { title: 'National Championship', slots: [CHAMPIONSHIP_SLOT] },
];

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function darken(hex: string, amount: number): string {
  return `#${hexToRgb(hex)
    .map((v) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Text colour for a fill, measured against the gradient's MIDPOINT rather than
 * its top stop — that's the tone the text actually sits on. Without this,
 * Tennessee's orange (and every other bright primary) gets white text on it.
 */
function inkFor(hex: string): string {
  const top = hexToRgb(hex);
  const bottom = hexToRgb(darken(hex, 0.3));
  const channel = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const mid = [0, 1, 2].map((i) => (top[i] + bottom[i]) / 2 / 255);
  const luminance = 0.2126 * channel(mid[0]) + 0.7152 * channel(mid[1]) + 0.0722 * channel(mid[2]);
  return luminance > 0.36 ? '#14120c' : '#ffffff';
}

/** State schools read the way they're said aloud, rather than truncating mid-word. */
function displayName(name: string): string {
  return name.replace(/\bState\b/, 'St.');
}

const CARD_W = 296;
/**
 * A deliberate OVER-estimate of the tallest card, used only to keep the card
 * clear of the viewport edges. It is never used to centre — the card's real
 * height varies with its content (venue wrapping, nought/one/two team rows, the
 * click hint), so centring against a constant put it 12px out. `translateY(-50%)`
 * centres it exactly whatever it measures; erring high here just means the
 * clamp keeps a little more distance from an edge than strictly needed.
 */
const CARD_MAX_H = 300;
const CARD_GAP = 14;

/**
 * Where the hover card sits: beside the mark that opened it, vertically centred
 * on it, so it reads as attached to that game rather than floating near it.
 *
 * Preferred side is to the RIGHT; it flips left when the right edge would run
 * off. Both axes are clamped to the viewport, so a mark near an edge still gets
 * a fully visible card instead of one hanging off the screen.
 *
 * The card is PORTALLED to document.body, which this positioning depends on: a
 * `position: fixed` element resolves against the nearest ancestor carrying a
 * transform/filter rather than the viewport, and the page wrapper animates
 * `transform` (`.content-enter`). Rendered in place, these viewport
 * coordinates were being measured against a different origin and the card
 * landed a long way from its mark.
 */
function cardPosition(anchor: DOMRect): { left: number; top: number; transform: string } {
  const room = window.innerWidth - anchor.right - CARD_GAP;
  const left = room >= CARD_W ? anchor.right + CARD_GAP : anchor.left - CARD_GAP - CARD_W;
  // `top` is the MARK's centre; translateY(-50%) then centres the card on it
  // exactly, whatever height it turns out to be.
  const centre = anchor.top + anchor.height / 2;
  const half = CARD_MAX_H / 2;
  return {
    left: Math.max(12, Math.min(left, window.innerWidth - CARD_W - 12)),
    top: Math.max(12 + half, Math.min(centre, window.innerHeight - 12 - half)),
    transform: 'translateY(-50%)',
  };
}

interface HoverCard {
  game: PlayoffBracketGame;
  /** Screen rect of the mark that opened it — the card positions against this. */
  anchor: DOMRect;
  /** Sides to list, already resolved (an unscheduled semifinal shows who advanced). */
  sides: PlayoffBracketSide[];
  roundLabel: string;
  artPath: string;
  venueLabel: string | null;
}

function TeamBox({
  side,
  state,
}: {
  side: PlayoffBracketSide;
  state: 'played' | 'pending' | 'empty';
}) {
  if (state === 'empty' || !side.teamName) {
    return (
      <div className="cfp-box" data-tbd="1">
        <span className="w-4 shrink-0" />
        <span className="flex-1 truncate text-[10.5px] font-bold uppercase tracking-[0.14em] opacity-70">
          To be decided
        </span>
        <span className="tnum flex h-full w-10 shrink-0 items-center justify-center text-base font-extrabold">
          –
        </span>
      </div>
    );
  }

  const primary = side.primaryColorHex ?? '#1a1a22';
  const pending = state === 'pending';

  return (
    <div
      className="cfp-box"
      data-out={!pending && !side.isWinner && side.score !== null ? '1' : undefined}
      data-pending={pending ? '1' : undefined}
      data-you={side.isUserTeam ? '1' : undefined}
      style={
        {
          '--cfp-tc': primary,
          '--cfp-tc-dark': darken(primary, 0.3),
          '--cfp-to': inkFor(primary),
        } as React.CSSProperties
      }
    >
      <span className="tnum w-4 shrink-0 text-center text-[15px] font-extrabold opacity-75">
        {side.seed ?? ''}
      </span>
      <img
        src={getLogoPath(side.teamName, 'dark')}
        alt=""
        className="h-[22px] w-[22px] shrink-0 object-contain"
      />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold uppercase">
        {displayName(side.teamName)}
      </span>
      {side.wins !== null && (
        <span className="tnum shrink-0 pr-2 text-[10px] font-semibold opacity-60">
          {side.wins}-{side.losses}
        </span>
      )}
      <span
        className="tnum flex h-full w-10 shrink-0 items-center justify-center text-base font-extrabold"
        style={{ background: pending ? 'transparent' : 'rgba(0,0,0,0.28)' }}
      >
        {side.score ?? '–'}
      </span>
    </div>
  );
}

export function PlayoffBracket() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const { openGameModal } = useGameModal();

  const [bracket, setBracket] = useState<PlayoffBracketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<HoverCard | null>(null);

  const outerRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    window.api.db.getPlayoffBracket(id, selectedSeasonId).then((result) => {
      if (cancelled) return;
      setBracket(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, selectedSeasonId]);

  const bySlot = useMemo(() => {
    const map = new Map<number, PlayoffBracketGame>();
    for (const g of bracket?.games ?? []) map.set(g.slot, g);
    return map;
  }, [bracket]);

  /**
   * Who has advanced into a slot the save hasn't written yet.
   *
   * After the quarterfinals we know both semifinalists, but the save leaves
   * those rows empty until it schedules them. Printing "To be decided" beside
   * an obvious answer reads as broken, so the winners are shown in the
   * outlined "advancing, not yet scheduled" treatment instead.
   */
  const advancingInto = useCallback(
    (slot: number): PlayoffBracketSide[] => {
      const feeders = Object.entries(FEEDS_INTO)
        .filter(([, to]) => to === slot)
        .map(([from]) => Number(from));
      return feeders
        .map((from) => {
          const g = bySlot.get(from);
          if (!g?.played) return null;
          return g.home.isWinner ? g.home : g.away;
        })
        .filter((s): s is PlayoffBracketSide => s !== null);
    },
    [bySlot],
  );

  /** Scale the whole stage to fit; below the floor, pan instead of shrinking. */
  const fit = useCallback(() => {
    const outer = outerRef.current;
    const stage = stageRef.current;
    const sizer = sizerRef.current;
    if (!outer || !stage || !sizer) return;
    stage.style.transform = 'none';
    const naturalW = stage.offsetWidth;
    const naturalH = stage.offsetHeight;
    if (!naturalW) return;
    const raw = Math.min(1, outer.clientWidth / naturalW);
    const panning = raw < SCALE_FLOOR;
    const scale = panning ? SCALE_FLOOR : raw;
    stage.style.transform = `scale(${scale})`;
    sizer.style.width = `${naturalW * scale}px`;
    sizer.style.height = `${naturalH * scale}px`;
    outer.style.overflowX = panning ? 'auto' : 'hidden';
    outer.style.cursor = panning ? 'grab' : '';
  }, []);

  useLayoutEffect(() => {
    fit();
    const outer = outerRef.current;
    if (!outer) return;
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [fit, bracket]);

  // Drag to pan, once the bracket is wider than the floor allows.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    let down = false;
    let startX = 0;
    let startScroll = 0;
    const onDown = (e: PointerEvent) => {
      if (outer.style.overflowX !== 'auto') return;
      down = true;
      startX = e.clientX;
      startScroll = outer.scrollLeft;
      outer.style.cursor = 'grabbing';
      outer.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (down) outer.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => {
      down = false;
      if (outer.style.overflowX === 'auto') outer.style.cursor = 'grab';
    };
    outer.addEventListener('pointerdown', onDown);
    outer.addEventListener('pointermove', onMove);
    outer.addEventListener('pointerup', onUp);
    outer.addEventListener('pointercancel', onUp);
    return () => {
      outer.removeEventListener('pointerdown', onDown);
      outer.removeEventListener('pointermove', onMove);
      outer.removeEventListener('pointerup', onUp);
      outer.removeEventListener('pointercancel', onUp);
    };
  }, [bracket]);

  // A card stranded over the wrong game is worse than no card.
  useEffect(() => {
    const dismiss = () => setCard(null);
    window.addEventListener('scroll', dismiss, { passive: true });
    outerRef.current?.addEventListener('scroll', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss);
    };
  }, []);

  const roundLabelOf = (game: PlayoffBracketGame): string => {
    if (game.bowlName) return `${game.bowlName}`;
    if (game.round === 'first-round') return CFP_FIRST_ROUND;
    if (game.round === 'quarterfinal') return CFP_QUARTERFINAL;
    if (game.round === 'semifinal') return CFP_SEMIFINAL;
    return NATIONAL_CHAMPIONSHIP;
  };

  /** The mark for a game: its bowl's own logo, else the generic round art. */
  const markOf = (game: PlayoffBracketGame): { src: string; generic: boolean } => {
    if (game.bowlAssetName) return { src: getBowlLogoPath(game.bowlAssetName), generic: false };
    if (game.round === 'championship') {
      return { src: getNationalChampionshipAppearanceImagePath('dark'), generic: true };
    }
    const roundName =
      game.round === 'first-round'
        ? CFP_FIRST_ROUND
        : game.round === 'quarterfinal'
          ? CFP_QUARTERFINAL
          : CFP_SEMIFINAL;
    return { src: getPlayoffRoundImagePath(roundName) ?? getBowlLogoPath(null), generic: true };
  };

  const showCard = (game: PlayoffBracketGame, element: HTMLElement) => {
    window.clearTimeout(hideTimer.current);
    const sides = game.home.teamName || game.away.teamName
      ? [game.home, game.away]
      : advancingInto(game.slot);
    const venue = getNeutralVenue(game.neutralVenueId);
    setCard({
      game,
      anchor: element.getBoundingClientRect(),
      sides,
      roundLabel: roundLabelOf(game),
      artPath: game.bowlAssetName ? getBowlTrophyPath(game.bowlAssetName) : markOf(game).src,
      venueLabel: venue ? `${venue.stadium} · ${venue.city}, ${venue.state}` : null,
    });
  };

  const scheduleHide = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setCard(null), 220);
  };

  if (!id) return null;

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading the bracket…</p>;
  }

  if (!bracket) {
    const season = seasons.find((s) => s.id === selectedSeasonId);
    return (
      <div className="corner-cut border border-slate-200/80 bg-slate-100/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        No playoff on record for {season ? season.seasonYear : 'this season'} — the field is set the
        week after the conference championships.
      </div>
    );
  }

  const champion = bracket.games.find((g) => g.slot === CHAMPIONSHIP_SLOT) ?? null;
  const championVenue = getNeutralVenue(bracket.championshipVenueId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--team-primary)]">
            {bracket.seasonYear} Postseason
          </p>
          <h2 className="text-xl font-extrabold uppercase tracking-tight">College Football Playoff</h2>
        </div>
      </div>

      <div ref={outerRef} className="relative overflow-hidden">
        <div ref={sizerRef} className="relative">
          {/*
            data-spot is always on. It was a toggle, and a toggle here is a
            control that does nothing in most seasons: your program is in the
            field or it isn't, and when it isn't there is simply nothing lit to
            turn off.
          */}
          <div
            ref={stageRef}
            className="cfp-stage corner-cut absolute left-0 top-0 px-7 pb-7 pt-9"
            data-spot="1"
            style={
              {
                '--cfp-box-h': `${BOX_H}px`,
                '--cfp-box-gap': `${BOX_GAP}px`,
                '--cfp-gutter': `${GUTTER}px`,
              } as React.CSSProperties
            }
          >
            <div className="relative z-[2] flex items-stretch" style={{ height: BRACKET_H }}>
              {COLUMNS.map((column, columnIndex) => (
                <div
                  key={column.title}
                  className="flex flex-none flex-col"
                  style={{ width: COL_W, marginLeft: columnIndex === 0 ? 0 : GUTTER }}
                >
                  <div className="relative flex h-full flex-col justify-around">
                    <span className="absolute -top-6 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.19em] text-[#d8b67c]">
                      {column.title}
                    </span>
                    {column.slots.map((slot) => {
                      const game = bySlot.get(slot);
                      if (!game) return null;

                      /*
                        A slot the save hasn't written yet, whose participants
                        we nonetheless know because their previous round is
                        played. Those show OUTLINED — present, not yet locked —
                        while a confirmed participant of a scheduled-but-unplayed
                        game (a bye seed waiting on its opponent) stays solid.
                        Conflating the two would draw the 1 seed as a ghost.
                      */
                      const showingAdvancing = !game.home.teamName && !game.away.teamName;
                      const advancing = showingAdvancing ? advancingInto(slot) : [];
                      const sides: [PlayoffBracketSide | null, PlayoffBracketSide | null] =
                        showingAdvancing
                          ? [advancing[0] ?? null, advancing[1] ?? null]
                          : [game.away, game.home];

                      const onRoute =
                        bracket.userTeamIndex !== null &&
                        game.played &&
                        [game.home, game.away].some((s) => s.isUserTeam && s.isWinner);

                      const mark = markOf(game);

                      return (
                        <div
                          key={slot}
                          className="cfp-grp relative flex flex-col"
                          style={{ gap: BOX_GAP }}
                          data-onward={game.feedsIntoSlot !== null ? '1' : undefined}
                          data-route={onRoute ? '1' : undefined}
                        >
                          {sides.map((side, i) => (
                            <TeamBox
                              key={i}
                              side={side ?? game.home}
                              state={
                                side === null || !side.teamName
                                  ? 'empty'
                                  : showingAdvancing
                                    ? 'pending'
                                    : 'played'
                              }
                            />
                          ))}
                          {/* Every round carries a mark, the title game included —
                              the trophy beside it says who won, not which game it is. */}
                          {
                            <button
                              type="button"
                              className="cfp-medal"
                              data-round={mark.generic ? '1' : undefined}
                              data-open={card?.game.slot === slot ? '1' : undefined}
                              aria-label={`${roundLabelOf(game)} — game card`}
                              onPointerEnter={(e) => showCard(game, e.currentTarget)}
                              onPointerLeave={scheduleHide}
                              onFocus={(e) => showCard(game, e.currentTarget)}
                              onBlur={scheduleHide}
                              onClick={(e) => showCard(game, e.currentTarget)}
                            >
                              <img src={mark.src} alt="" />
                            </button>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* The trophy is the bracket's last node, not a separate panel. */}
              <div
                className="relative z-[2] flex flex-none flex-col items-center justify-center gap-0.5 text-center"
                style={{ width: 210, marginLeft: GUTTER }}
              >
                {champion?.played && <span className="cfp-champ-glow" />}
                <img
                  src={getNationalChampionshipAppearanceImagePath('dark')}
                  alt=""
                  className="relative w-[150px] object-contain"
                  style={
                    champion?.played
                      ? undefined
                      : { filter: 'grayscale(1) brightness(0.4)', opacity: 0.45 }
                  }
                />
                <span className="relative mt-1.5 text-[9px] font-bold uppercase tracking-[0.19em] text-[#d8b67c]">
                  {bracket.championName ? `${bracket.seasonYear} National Champions` : 'Awaiting a champion'}
                </span>
                <span
                  className="relative text-[19px] font-extrabold uppercase leading-tight"
                  style={{ color: bracket.championName ? '#fff' : '#6d6d7a' }}
                >
                  {bracket.championName ? displayName(bracket.championName) : '—'}
                </span>
                {championVenue && (
                  <span className="relative text-[10px] text-[#6d6d7a]">
                    {championVenue.city}, {championVenue.state}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {card && createPortal(
        <div
          className="corner-cut fixed z-[80] w-[296px] cursor-pointer border border-[rgba(233,210,140,0.3)] px-5 pb-3.5 pt-5 text-center text-[#f2f2f6]"
          style={{
            background: 'linear-gradient(180deg, #12121a 0%, #08080c 100%)',
            ...cardPosition(card.anchor),
          }}
          onPointerEnter={() => window.clearTimeout(hideTimer.current)}
          onPointerLeave={scheduleHide}
          onClick={() => {
            if (card.game.gameId !== null) openGameModal(id, card.game.gameId, selectedSeasonId);
            setCard(null);
          }}
        >
          {/*
            Bridges the gap back to the mark so the cursor can reach the card
            without it dismissing mid-travel. Extends on BOTH sides because the
            card flips to whichever side has room, and it sits behind the panel
            so it never intercepts a click meant for the content.
          */}
          <span className="pointer-events-auto absolute -left-4 -right-4 -top-2 -bottom-2 -z-10" />
          <img src={card.artPath} alt="" className="mx-auto h-[86px] w-[86px] object-contain" />
          <p className="mt-2 text-[18px] font-extrabold uppercase leading-tight">{card.roundLabel}</p>
          <p className="mb-3.5 text-xs text-[#6d6d7a]">
            {card.venueLabel ?? (card.game.round === 'first-round' ? 'On campus' : 'Site not yet set')}
          </p>
          {card.sides.length === 0 ? (
            <p className="text-xs text-[#6d6d7a]">Matchup not set</p>
          ) : (
            card.sides.map((side, i) => (
              <div
                key={i}
                className="mt-1 flex items-center justify-between gap-3 px-3 py-1.5 text-[13.5px] font-extrabold uppercase"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  opacity: card.game.played && !side.isWinner ? 0.42 : 1,
                }}
              >
                <span className="truncate">
                  {side.seed ?? ''} {side.teamName ? displayName(side.teamName) : 'TBD'}
                </span>
                <span className="tnum">{side.score ?? '–'}</span>
              </div>
            ))
          )}
          {card.game.gameId !== null && (
            <p className="mt-3 text-[8.5px] font-bold uppercase tracking-[0.15em] text-[#d8b67c] opacity-75">
              Click for full game info
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
