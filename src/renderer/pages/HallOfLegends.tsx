import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SavedPlayerCard } from '../components/common/SavedPlayerCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { VerticalToggle } from '../components/ui/VerticalToggle';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { CenteredModalPanel } from '../components/common/CenteredModalPanel';
import { PlusIcon, SwapIcon } from '../components/common/ActionIcons';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useViewedTeamOptional } from '../data/ViewedTeamProvider';
import { useConfirm } from '../data/ConfirmDialogProvider';
import {
  findSlot,
  slotsForUnit,
  type LegendFormationSlot,
  type LegendTier,
} from '../../shared/hallFormation';
import { ALL_CARD_LAYERS, DEFAULT_CARD_SCRIM } from '../../shared/types';
import type {
  CoachHall,
  HallEligiblePlayer,
  LegendEntry,
  PlayerCardRecord,
} from '../../shared/types';

/**
 * THE HALL OF LEGENDS — the players a coach kept, arranged as a formation.
 *
 * ALL-TIME BY DEFINITION, which is the one thing about this page that differs
 * from every other: it does not answer to the season switcher. A Hall that
 * changed when you moved the season dropdown would not be a Hall. The header
 * says the career span out loud so a page ignoring a control right above it
 * reads as deliberate rather than broken (user-confirmed).
 *
 * The formation is the centrepiece and the pool is the management layer, so the
 * page is mostly field: two toggles, a board, and a strip of specialists.
 */

type UnitView = 'offense' | 'defense' | 'specialists';

/** Positions from the save, spelled for a caption rather than a depth chart. */
function seasonSpan(entry: LegendEntry): string | null {
  const { firstSeasonYear, lastSeasonYear } = entry.snapshot;
  if (!firstSeasonYear) return null;
  return lastSeasonYear && lastSeasonYear !== firstSeasonYear
    ? `${firstSeasonYear}–${lastSeasonYear}`
    : String(firstSeasonYear);
}

/**
 * A legend on the board — the player's OWN CARD, at size.
 *
 * This used to be a bespoke tile: portrait, name, position, school, peak. It was
 * a second, smaller visual language for a player, invented on one page, sitting
 * a click away from the real card in the modal. The Hall now stands the actual
 * DEFAULT CARD in the slot (user direction 2026-08-03) — the one the user framed
 * and chose, with their photo and their crop, which is the whole reason the card
 * system exists.
 *
 * ALMOST EVERYTHING PRINTED ON IT COMES OFF (user direction 2026-08-03), and
 * each for its own reason rather than as one sweep:
 *
 *   stats, opponent — facts about one season and one afternoon; a Hall is a
 *     career.
 *   profile line   — "Running Back · UCLA" restates the plaque above the card,
 *     and the school is already on the card as the team mark.
 *   OVR            — a rating is a measurement taken on a Tuesday. It earns its
 *     place on a card about a season and says nothing about a career.
 *   the DynastyOS mark — a maker's mark is a signature at one card; at eleven
 *     standing in a formation it is wallpaper.
 *
 * What is left is a photograph and a name, which is what a hall of fame wall is.
 *
 * A player with no saved card still gets a card rather than a fallback tile: the
 * snapshot already holds everything the face of a card needs, so it is
 * synthesised (see `snapshotCard`) and drawn down the same path. One render
 * path means the board can't develop two looks depending on who has been to the
 * card editor.
 */
const HALL_LAYERS = { stats: false, opponent: false, profile: false, ovr: false } as const;

/*
  THE BOARD DRAWS CARDS AT FULL SIZE AND SCALES THEM DOWN, rather than drawing
  small cards.

  This is the difference between the two things that both look like "make the
  cards smaller", and only one of them is right. PlayerCard is laid out in fixed
  pixels — a 19px stat figure, a jersey OVR, a vertical surname that auto-fits to
  the card's HEIGHT — all of it proportioned for a card about 330px across. Hand
  that layout a 152px box and nothing about the type follows: the OVR stays huge,
  the surname column eats half the width, and the name gets clipped behind the
  number. That is exactly what a first attempt at this produced.

  So the card is rendered at its design width and transformed. One scale factor,
  everything inside it proportional, identical to the card in the modal — which
  is the point, since it IS the card in the modal.

  FIXED, NOT FLUID: the cards are the same size at every window size, so the
  formation reads as one object rather than swelling on a wide monitor.

  116px IS SET BY THE FORMATION, not chosen. The board is a field again, which
  means ten tracks on a shared axis (see hallFormation) rather than five cards to
  a row — and ten tracks plus their gaps have to fit the room. That is the price
  of the football shape, and there is no arrangement that keeps both it and the
  bigger card.
*/
const CARD_DESIGN_W = 330;
const CARD_W = 116;
const CARD_H = Math.round((CARD_W * 496) / 330);
const CARD_SCALE = CARD_W / CARD_DESIGN_W;

/** The card at board size — full-size layout, scaled as one piece. */
function ScaledCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: CARD_W, height: CARD_H }} className="relative">
      <div
        style={{
          width: CARD_DESIGN_W,
          transform: `scale(${CARD_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A card for a legend who has never had one made.
 *
 * Deliberately built from the SNAPSHOT rather than from the live roster: the
 * snapshot is what lets the Hall keep someone the save has since forgotten, and
 * a board that quietly emptied as players aged out would defeat it. Nothing is
 * persisted — this record never goes near the database, it only exists to give
 * PlayerCard the shape it draws.
 */
function snapshotCard(entry: LegendEntry): PlayerCardRecord {
  const { snapshot } = entry;
  const [firstName, ...rest] = snapshot.name.split(' ');
  return {
    id: -entry.playerId,
    playerId: entry.playerId,
    seasonYear: snapshot.lastSeasonYear ?? snapshot.firstSeasonYear ?? null,
    teamName: snapshot.schoolName ?? null,
    player: {
      id: entry.playerId,
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      portraitAssetName: snapshot.portraitAssetName ?? null,
      position: snapshot.position,
      jerseyNumber: snapshot.jerseyNumber ?? 0,
      schoolYear: '',
      overallRating: snapshot.peakOverall ?? 0,
      archetype: '',
      developmentTrait: '',
      heightInches: 0,
      weightPounds: 0,
      hometown: '',
      homeState: '',
      redshirtStatus: '',
      isCaptain: false,
    },
    stats: [],
    layers: ALL_CARD_LAYERS,
    statSource: null,
    photoFile: null,
    photoPath: null,
    photoTransform: { x: 0, y: 0, scale: 1 },
    scrim: DEFAULT_CARD_SCRIM,
    favorite: false,
    isDefault: false,
    createdAt: entry.addedAt,
    updatedAt: entry.addedAt,
  };
}

function LegendCard({
  dynastyId,
  entry,
  slot,
  card,
  onOpen,
  onSwap,
}: {
  dynastyId: string;
  entry: LegendEntry;
  slot: LegendFormationSlot;
  /** The player's default card, or null while it is still being fetched / if they have none. */
  card: PlayerCardRecord | null;
  onOpen: () => void;
  /** Opens the picker for THIS slot — the only way to change an occupied one. */
  onSwap: () => void;
}) {
  const { snapshot } = entry;
  const span = seasonSpan(entry);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        title={`${snapshot.name} — ${slot.longLabel}`}
        /* No hover lift of its own — the board owns the hover now (see
           `.legend-slot-body` in globals.css), and two transforms on nested
           elements would compound into a jump. */
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--team-primary)]"
      >
        <ScaledCard>
          <SavedPlayerCard
            dynastyId={dynastyId}
            card={card ?? snapshotCard(entry)}
            layerOverrides={HALL_LAYERS}
            hideMark
          />
          {/* The foil catching the light as the card turns. Inside ScaledCard so
              it is clipped to the card's own box and scales with it. */}
          <span className="legend-slot-sweep" aria-hidden="true" />
          {/*
            THE YEARS HE WAS HERE, overlaid rather than printed by PlayerCard.

            It belongs to the HALL, not to the card: a card is a season and says
            its year in the profile line, whereas a legend is a span — 2026–2027
            — and that span is the one fact this board is actually about. Drawing
            it here keeps it off every other surface the same card appears on.

            Sitting in the fade the card already draws, level with the team mark
            in the opposite corner, so it lands on backing that is there anyway
            rather than needing its own plate.

            SIZED IN THE CARD'S DESIGN SPACE, not in board pixels. This sits
            inside ScaledCard, so everything here is multiplied by ~0.35 on the
            way out — an 11px rule rendered at 4px and was unreadable. 32px
            design → ~11px on the board, which is the size it looks.
          */}
          {span && (
            <span className="tnum pointer-events-none absolute inset-x-0 bottom-[6%] text-center text-[32px] font-bold leading-none tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              {span}
            </span>
          )}
        </ScaledCard>
      </button>
      {/*
        CHANGING A FILLED SLOT NEEDS A DOOR, and the card itself can't be it —
        clicking a legend opens the legend, which is the whole point of putting
        him on a board. Without this the only way to replace someone was to go
        and unassign them first.

        It sits OUTSIDE the card's button now rather than as a role="button"
        span inside it. The card used to be a small tile with room to spare; at
        full size it is a real card with a clipped corner, and a genuine
        <button> beside it is both simpler markup and a bigger target than the
        nested-span workaround the old tile needed.
      */}
      <button
        type="button"
        aria-label={`Change the ${slot.longLabel.toLowerCase()}`}
        title="Change this selection"
        onClick={onSwap}
        /* `pointer-events-none` while invisible. An opacity-0 button is still a
           click target, so the top-right corner of every card on the board was
           quietly swallowing clicks meant for the player and opening the picker
           instead — a second way to get the wrong thing from a card click, on
           top of the recruit-id collision. It comes back the moment the slot is
           hovered, which is the only time it can be seen anyway. */
        /* IN the corner, not near it, and small.

           At h-7 with a 2px inset it sat in the middle of the card's bottom-right
           quadrant, right where the years are printed — two things competing for
           one corner. Slammed flush to the corner and down to h-5, it is out of
           the years' way entirely.

           IT ANSWERS TO ITS OWN CORNER, not to the whole slot. `group-hover/slot`
           meant crossing any part of a card armed a control the user had no
           reason to be near; a swap is a rare, destructive-ish action and should
           need aiming at. `legend-swap` (globals.css) makes the reveal a plain
           `:hover` on the button itself, which on a 20px target in the corner is
           exactly the aiming this wants. */
        className="legend-swap absolute bottom-2 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition hover:bg-black/90 hover:text-white"
      >
        <SwapIcon className="h-2 w-2" />
      </button>
    </div>
  );
}

/** An unfilled position — visible, labelled, and the way in. */
function EmptySlot({
  slot,
  tier,
  onPick,
}: {
  slot: LegendFormationSlot;
  tier: LegendTier;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Empty ${tier === 'first' ? 'First' : 'Second'}-Team ${slot.longLabel.toLowerCase()} slot`}
      /* Solid gold hairline, not a dashed grey one (user's call). Dashed reads
         as provisional — a placeholder for something missing — and these slots
         aren't missing anything, they're waiting. Gold is the app's accent and
         the same ink a filled card's accents use, so an empty position belongs
         to the board rather than looking like a gap in it.

         THE ASPECT RATIO IS THE CARD'S, not a min-height. Now that filled slots
         hold real cards, an empty one that sized itself to its own contents made
         the row it sat in ragged — a short placeholder beside a tall card reads
         as a layout bug rather than as a slot waiting. It takes the SAME fixed
         box the scaled cards do, so full and empty stand exactly the same size
         whatever the window is doing. */
      style={{ width: CARD_W, height: CARD_H }}
      className="corner-cut flex flex-col items-center justify-center gap-1 border border-gold-300/35 text-center transition hover:border-gold-200 hover:bg-gold-300/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]"
    >
      <span className="font-display text-lg font-bold text-slate-400 dark:text-white/35">
        {slot.label}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-white/25">Select Legend</span>
      <PlusIcon className="mt-0.5 h-3.5 w-3.5 text-slate-400 dark:text-white/25" />
    </button>
  );
}

export function HallOfLegends() {
  const { id } = useParams<{ id: string }>();
  const { openPlayerModal } = usePlayerModal();
  // Optional, so the page degrades to a plain knob rather than throwing if it
  // is ever rendered outside a dynasty.
  const viewed = useViewedTeamOptional();
  const confirm = useConfirm();
  const [hall, setHall] = useState<CoachHall | null | undefined>(undefined);
  const [tier, setTier] = useState<LegendTier>('first');
  const [unit, setUnit] = useState<UnitView>('offense');
  const [picking, setPicking] = useState<LegendFormationSlot | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  /*
    Everyone the coach ever coached — several hundred rows on a long dynasty, and
    the BOARD never reads them. Fetched the first time a picker opens and then
    kept, so filling eleven slots costs one fetch rather than eleven. See
    getCoachHall's note for the measurement that prompted this.
  */
  const [eligible, setEligible] = useState<HallEligiblePlayer[] | null>(null);
  useEffect(() => {
    if (!picking || eligible || !id) return;
    let cancelled = false;
    window.api.db.getHallEligible(id).then((list) => {
      if (!cancelled) setEligible(list);
    });
    return () => {
      cancelled = true;
    };
  }, [picking, eligible, id]);

  const load = useCallback(() => {
    if (!id) return;
    window.api.db.getCoachHall(id).then((result) => setHall(result ?? null));
  }, [id]);

  useEffect(load, [load]);

  /*
    THE DEFAULT CARD FOR EVERY LEGEND STANDING IN A SLOT.

    Fetched ONCE for the whole hall — both tiers, both units — rather than for
    whatever the board is showing, because the alternative is a fresh round of
    IPC every time someone flicks First/Second or Offence/Defence, on a page
    whose two toggles are the main thing you do with it. A full board is at most
    twenty-six people; this is one pass over them.

    `listCardedPlayerIds` is what keeps that pass cheap: it is a single call that
    says who has any card at all, and on a typical dynasty most legends don't, so
    the per-player fetches that follow are a handful rather than twenty-six.
    Anyone not in that set is skipped and draws from their snapshot instead.
  */
  const [cards, setCards] = useState<Map<number, PlayerCardRecord>>(new Map());
  useEffect(() => {
    if (!id || !hall) return;
    const placed = [...new Set(hall.entries.filter((e) => e.slotId).map((e) => e.playerId))];
    if (placed.length === 0) return;
    let cancelled = false;
    (async () => {
      const carded = new Set(await window.api.card.listCardedPlayerIds(id));
      const wanted = placed.filter((playerId) => carded.has(playerId));
      if (cancelled || wanted.length === 0) return;
      const lists = await Promise.all(wanted.map((playerId) => window.api.card.list(id, playerId)));
      if (cancelled) return;
      const next = new Map<number, PlayerCardRecord>();
      wanted.forEach((playerId, i) => {
        // Same preference the hover card uses: the card the user marked default,
        // else the first one they made.
        const preferred = lists[i].find((c) => c.isDefault) ?? lists[i][0];
        if (preferred) next.set(playerId, preferred);
      });
      setCards(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, hall]);

  const bySlot = useMemo(() => {
    const map = new Map<string, LegendEntry>();
    for (const entry of hall?.entries ?? []) {
      if (entry.tier === tier && entry.slotId) map.set(entry.slotId, entry);
    }
    return map;
  }, [hall, tier]);

  const pool = useMemo(() => (hall?.entries ?? []).filter((e) => !e.slotId), [hall]);

  /*
    GRAB-TO-PAN, and the two things that make it not annoying.

    A THRESHOLD, so a drag is not a click. Every card on this board opens a
    player, and a pan that starts on a card would fire that open on release
    unless the movement is measured — 4px is enough to tell a shaky click from a
    deliberate pull. Below it nothing is suppressed and the card opens normally.

    THE CURSOR ONLY OFFERS when there is something to pan to. `data-pannable` is
    set from the measured overflow, because CSS cannot know it — and a grab
    cursor on a board that cannot move is an affordance that lies.
  */
  const panRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [pannable, setPannable] = useState(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const el = panRef.current;
    if (!el) return;
    const measure = () => setPannable(el.scrollWidth > el.clientWidth + 1);
    measure();
    /* WATCH THE CONTENT, not just the container. The container's own box does not
       change when the board inside it grows - the cards arrive asynchronously -
       so observing only the scroller measured an empty board and concluded there
       was nothing to pan to. Observing both catches a window resize AND the
       moment the formation fills in. */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
    /* `hall` IS IN HERE ON PURPOSE. These hooks sit above the early returns (they
       have to — hooks cannot be conditional), so on the first render the board
       does not exist yet and `panRef.current` is null. Without a dep that changes
       when the Hall arrives, the effect bailed once and never measured anything,
       and the grab cursor never appeared however far the formation overflowed. */
  }, [unit, tier, hall]);

  const panProps = {
    ref: panRef,
    /*
      THE PADDING HERE IS THE ZOOM'S HEADROOM, and it lives on the SCROLLER
      because the scroller is what clips.

      `.legend-pan` is `overflow-x: auto`, which forces `overflow-y` to `auto`
      as well (the spec allows no mix of `visible` with a scrolling axis), so it
      hides anything a card grows past its box — and a hovered card grows a LOT:
      the slot is 116x192 with its plaque, and scale(1.66) puts 38px past each
      side and 63px past the top and bottom. At the old `py-6` (24px) the top
      row's cards had their heads shaved off at exactly the moment they stepped
      forward.

      Reserved here rather than on the room: the room's padding is on the far
      side of this clip, so it cannot save a card from it. The room gave up the
      same amount in exchange (`px-11 py-14` -> `px-3 py-0`), so the board still
      sits exactly where it did — 44px in from the room's edge and 80px down
      from its top — with the headroom now on the right side of the boundary.

      MEASURED, not eyeballed, and with slack on purpose: 80px against a 63px
      overhang and 48px against 38px. The first attempt cleared by ONE pixel,
      which is the kind of margin a longer name or a different font wrapping the
      plaque quietly eats.
    */
    className: 'legend-pan -mx-4 px-12 py-20',
    'data-pannable': pannable ? 'true' : undefined,
    'data-panning': panning ? 'true' : undefined,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pannable || e.button !== 0) return;
      /* NOT FROM A CARD (user direction 2026-08-03). Left-drag is the only pan
         gesture - no middle click, since plenty of mice and every tablet lack
         one - so it has to share the surface with thirteen click targets.
         Starting a pan only on the space BETWEEN cards keeps a press on a card
         unambiguously a press on that card, and the board has room to spare in
         every unit. */
      if ((e.target as HTMLElement).closest('.legend-slot')) return;
      panStart.current = { x: e.clientX, left: panRef.current?.scrollLeft ?? 0, moved: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const start = panStart.current;
      const el = panRef.current;
      if (!start || !el) return;
      const dx = e.clientX - start.x;
      if (!start.moved && Math.abs(dx) < 4) return;
      if (!start.moved) {
        start.moved = true;
        setPanning(true);
      }
      el.scrollLeft = start.left - dx;
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      // A pan must not also open whatever it started on.
      if (panStart.current?.moved) {
        e.preventDefault();
        e.stopPropagation();
      }
      panStart.current = null;
      setPanning(false);
    },
    onPointerLeave: () => {
      panStart.current = null;
      setPanning(false);
    },
    onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => {
      if (panning) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };

  if (!id) return null;
  if (hall === undefined)
    return <p className="text-slate-500 dark:text-slate-400">Opening the Hall…</p>;
  if (hall === null) return <p className="text-slate-500 dark:text-slate-400">Hall not found.</p>;

  if (hall.coachId === null) {
    return (
      <div className="py-16 text-center">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Hall of Champions</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This dynasty has no coach identity recorded yet. Sync once and the Hall opens with every
          player you have coached.
        </p>
      </div>
    );
  }

  const knobTeam = viewed?.userTeamName ?? null;
  const knob = knobTeam ? (
    <TeamLogo
      team={{ assetName: knobTeam, label: knobTeam }}
      size="sm"
      variant="gold"
      className="h-[35px] w-[35px]"
    />
  ) : undefined;

  const firstCount = (hall.entries ?? []).filter((e) => e.tier === 'first').length;
  const secondCount = (hall.entries ?? []).filter((e) => e.tier === 'second').length;
  const career =
    hall.careerFirstYear === null
      ? null
      : hall.careerLastYear && hall.careerLastYear !== hall.careerFirstYear
        ? `${hall.careerFirstYear}–${hall.careerLastYear}`
        : String(hall.careerFirstYear);

  /*
    Assignment, with the two confirmations the spec asks for and no others.

    REPLACING is confirmed because it displaces someone the user chose on
    purpose — quietly bumping a legend out of the first team is exactly the kind
    of silent loss a Hall shouldn't have. MOVING between tiers is confirmed for
    the same reason: it looks like a copy and isn't.

    Everything else is not: adding, unassigning (they stay in the pool), and
    flipping a toggle are all cheap and reversible, and a dialog on each would
    make curating a board feel like filing paperwork.
  */
  async function assign(playerId: number, slotId: string | null, nextTier: LegendTier | null) {
    if (!id) return;

    const mover = hall?.entries.find((e) => e.playerId === playerId);
    if (slotId && nextTier) {
      const occupant = hall?.entries.find((e) => e.tier === nextTier && e.slotId === slotId);
      if (occupant && occupant.playerId !== playerId) {
        const slotLabel = findSlot(slotId)?.label ?? 'that slot';
        const ok = await confirm({
          eyebrow: 'Hall of Champions',
          title: `Replace ${occupant.snapshot.name}?`,
          message: `${mover?.snapshot.name ?? 'This player'} takes the ${
            nextTier === 'first' ? 'First' : 'Second'
          }-Team ${slotLabel} slot. ${occupant.snapshot.name} stays in All-Time Legends, unassigned.`,
          confirmLabel: 'Replace',
        });
        if (!ok) {
          setPicking(null);
          return;
        }
      } else if (mover?.slotId && mover.tier && mover.tier !== nextTier) {
        const ok = await confirm({
          eyebrow: 'Hall of Champions',
          title: `Move ${mover.snapshot.name} to the ${nextTier === 'first' ? 'First' : 'Second'} Team?`,
          message:
            'They leave their current slot — this moves the selection rather than copying it.',
          confirmLabel: 'Move',
        });
        if (!ok) {
          setPicking(null);
          return;
        }
      }
    }

    const result = await window.api.db.assignLegend(id, playerId, nextTier, slotId);
    if (!result.ok && result.message) {
      await confirm({
        title: 'That assignment isn’t allowed',
        message: result.message,
        confirmLabel: 'OK',
      });
    }
    setPicking(null);
    load();
  }

  /*
    Three units, three boards, and NOTHING is merged across them any more.

    The kicker and the punter used to be folded into the offence's rows — right
    while there were two of them and the alternative was a strip beside the
    board. Special teams is its own destination now (user direction 2026-08-03),
    which is what makes room for the returners, so every unit is simply its own
    slots grouped by row.
  */
  const rows = (() => {
    const grouped = new Map<number, LegendFormationSlot[]>();
    for (const slot of slotsForUnit(unit)) {
      const row = grouped.get(slot.row) ?? [];
      row.push(slot);
      grouped.set(slot.row, row);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, list]) => list.sort((a, b) => a.column - b.column));
  })();

  /*
    TEN COLUMNS, AND EVERY ROW SHARES THEM — the board is a field again.

    It spent a spell as position groups stacked five to a row, each row centred on
    its own axis. That held every card at one size and never scrolled, and it read
    as a TOWER: a depth chart stood on end. The football shape is worth what it
    costs.

    What it costs is card size. Ten tracks of card plus their gaps have to fit the
    room, so the cards are 116px here where five-to-a-row allowed 152. There is no
    arrangement that keeps both — the formation sets the column count and the
    column count sets the card.

    THE GRID IS THE MECHANISM, not a centred flex row. Each slot declares the
    column it plays on (see hallFormation) and is placed there by `gridColumn`,
    which is what puts the quarterback under the CENTER rather than under the gap
    between the guards, and the backs in the gaps either side of him. A flex row
    would centre each row's own contents and the whole thing would drift out of
    alignment with itself.
  */
  /*
    SPECIAL TEAMS IS NOT A FORMATION and doesn't get the ten-track field. Four
    men who never take the pitch together have no arrangement to be faithful to,
    so they get a plain two-by-two block at the user's spacing:

        KR   PR
        K    P

    100px between columns and 50px between rows, given as explicit gaps rather
    than borrowed from the field's tracks — the field's spacing means something
    (it is where people stand) and this block's doesn't, so pretending otherwise
    would be decoration dressed as information.
  */
  const specialTeams = unit === 'specialists';

  const renderRow = (row: LegendFormationSlot[], rowIndex: number) => (
    <div
      key={`${tier}-${unit}-${rowIndex}`}
      className="grid w-full justify-center"
      style={
        specialTeams
          ? { gridTemplateColumns: `repeat(2, ${CARD_W}px)`, columnGap: 100 }
          : { gridTemplateColumns: `repeat(10, ${CARD_W}px)`, columnGap: 8 }
      }
    >
      {row.map((slot, j) => {
        const entry = bySlot.get(slot.id);
        return (
          <div
            key={slot.id}
            /* AN EMPTY SLOT IS INERT. It gets no zoom, casts no sweep, and does
               not dim the board around it (globals.css keys off this class).
               There is nothing there to look closer at, so an effect whose whole
               job is "focus on this one" has nothing to focus on — and a
               placeholder lighting up like a legend was the board promising
               something it wasn't holding. */
            className={`legend-slot legend-enter group/slot${entry ? '' : ' legend-slot-empty'}`}
            style={{ gridColumn: slot.column, animationDelay: `${(rowIndex * 5 + j) * 28}ms` }}
          >
            {/* The plaque. The slot label used to be etched into the corner of
                the bespoke tile; a real card has no spare corner, and a card
                standing on a named position wants the name said out loud
                anyway. */}
            <p className="type-eyebrow mb-1.5 text-center text-[10px] text-slate-400 dark:text-white/40">
              {slot.label}
            </p>
            {/* The zoom and the blur ride on THIS, not on the slot, because the
                slot carries `legend-enter` — an animation with a transform in
                it, whose filled final state would win over a hover transform on
                the same element. Separating them also leaves the plaque at rest
                while the card comes forward, which is the right reading: the
                position stays put, the man in it steps out. */}
            <div className="legend-slot-body">
              {entry ? (
                <LegendCard
                  dynastyId={id ?? ''}
                  entry={entry}
                  slot={slot}
                  card={cards.get(entry.playerId) ?? null}
                  onOpen={() => openPlayerModal(id, entry.playerId)}
                  onSwap={() => setPicking(slot)}
                />
              ) : (
                <EmptySlot slot={slot} tier={tier} onPick={() => setPicking(slot)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/*
        EDITORIAL, NOT A DASHBOARD. The counts are a sentence under the name
        rather than three equally weighted tiles — this page is about who these
        players were, and a row of stat cards would open it by talking about
        totals.
      */}
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Hall of Champions</p>
        <h1 className="mt-1 font-display text-page-title font-bold text-slate-950 dark:text-white">
          {/* Not the coach's name (user direction 2026-08-03): the Hall spans a
              whole career across whatever schools it touched, and stamping one
              coach's name on it was both narrower than the page and, in a
              multi-coach archive, sometimes simply the wrong name. */}
          All-Time Legends
        </h1>
        {/*
          The career span survived the tagline's removal, moved into the counts.

          It isn't decoration: this is the one page in the app that ignores the
          season switcher sitting directly above it, and a page that quietly
          disobeys a control reads as broken unless it says what it's showing.
          Two words in the line that was already here does that without the
          sentence the user cut.
        */}
        <p className="tnum mt-3 text-sm text-slate-500 dark:text-slate-400">
          {career && (
            <>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{career}</span>
              <span className="px-2 text-slate-300 dark:text-slate-700">·</span>
            </>
          )}
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {hall.entries.length}
          </span>{' '}
          Legends
          <span className="px-2 text-slate-300 dark:text-slate-700">·</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {firstCount}
          </span>{' '}
          First Team
          <span className="px-2 text-slate-300 dark:text-slate-700">·</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {secondCount}
          </span>{' '}
          Second Team
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/*
          The gold mark rides the knob, which is what a two-state switch looks
          like everywhere else in the app — Roster|Transfers, List|Gallery,
          Team|Player. These two shipped with the bare dot and read as a
          different control from the ones directly above them.

          The school is the coach's CURRENT one even though the Hall spans every
          school he coached: the knob is the app's chrome, not a fact about the
          legends on the board.
        */}
        <ToggleSwitch<LegendTier>
          value={tier}
          onChange={setTier}
          left={{ value: 'first', label: 'FIRST TEAM' }}
          right={{ value: 'second', label: 'SECOND TEAM' }}
          ariaLabel="First or Second Team"
          knob={knob}
        />
        <div className="ml-auto">
          <Button variant="secondary" onClick={() => setPoolOpen(true)}>
            All-Time Legends {hall.entries.length}
          </Button>
        </div>
      </div>

      {/*
        THE UNIT SWITCH IS NO LONGER A TOGGLE, because it now has three
        positions and a toggle is a thing with two ends and a knob that slides
        between them. Widening it to three would have meant inventing a control
        that looks like the app's toggles but doesn't behave like one — a knob
        that stops in the middle — which is worse than using a different control,
        since it teaches the toggle two meanings.

        SegmentedControl is the app's existing answer for an exclusive choice of
        three or more (Statistics uses it for Team/Player and Total/Per-Game),
        and it is already the right SHAPE for this: mode switches keep the filled
        look, and only navigation gets the glider. So this reads as a mode switch
        because it is one.

        ON ITS OWN LINE, directly under FIRST TEAM and above the board (user's
        placement). The two controls answer different questions — which team, and
        which unit — and side by side they read as one long strip of settings.
        Stacked, the tier sits with the page's identity and the unit sits with
        the thing it changes.
      */}

      {/*
        THE BOARD — a tactical surface, not a football field. Charcoal, a faint
        yard guide, a vignette, and nothing bright enough to compete with the
        cards standing on it.
      */}
      {/*
        NO SLAB. The board was a charcoal panel with a gradient, faint yard
        guides and a vignette — a surface for the cards to stand on. Removed at
        the user's request, and it turns out to be the better call: the cards
        already carry their own edges, so the panel was a second frame around
        things that were already framed, and taking it away lets the formation
        read as the shape it is rather than as a picture of a field.

        Losing it means the cards now sit on the PAGE, which is light in light
        mode — so everything on them had to stop being hard-coded white.
      */}
      {/* IT PANS AGAIN, but by hand. Ten tracks of card need ~1240px, which is
          fine on a desktop and not on a tablet — and "shrink until it fits"
          stopped being available once the cards were pinned to one size. So the
          board scrolls sideways when it has to, and you GRAB it rather than
          hunting a scrollbar. See `panProps`. */}
      {/*
        `legend-board` is what makes hovering one card dim and blur every OTHER
        one — the effect is a property of the BOARD, not of the card, because it
        is about the cards a card is standing among. Done in CSS with
        `:hover ~`-style sibling reach rather than in React state: a hover that
        re-renders eleven cards to change eleven class names is a lot of work to
        move a mouse, and it would stutter exactly when it needs to be smooth.
      */}
      {/* The room the cards stand in — the Trophy Room's own surface and its
          slow-breathing shaft of light, reused rather than re-invented. These
          two pages are the same idea seen twice (what this coach won, who won
          it), so they should feel like the same building. */}
      {/* THE PADDING IS LOAD-BEARING, but most of it now sits on `.legend-pan`
          inside this element rather than here — see `panProps`. `.trophy-room`
          still hides its overflow (it has to: the spotlight and vignette are
          oversized elements meant to be clipped to the room), so it is a second
          clipping boundary the zoom has to clear, and the pan's own padding is
          what actually clears the first one. The two together keep the board in
          the same place it has always been. */}
      <div className="trophy-room legend-room corner-cut relative border border-white/10 px-3 py-0">
        <span className="trophy-spotlight" aria-hidden="true" />
        <span className="trophy-vignette" aria-hidden="true" />
        {/*
          IN the room rather than in the toolbar above it: the unit switch
          changes what the field IS, so it belongs on the field, standing beside
          the formation the way a coordinator's sheet does. Absolute, so it never
          pushes the board off its centre.

          BOTTOM-left, not top-left as sketched, and the sketch was drawn against
          the old stacked layout whose top-left was empty. On a real formation
          column 1 row 0 is a split end in the offence and a corner in the
          defence, so a control parked there sits on a player's face. The bottom
          of column 1 is the one corner empty in ALL THREE units — the backs sit
          at 4 and 6, the safeties at 4 and 6, the specialists at 4 through 7 —
          which also puts it where a sideline actually is.
        */}
        <div className="absolute bottom-6 left-6 z-10">
          <VerticalToggle<UnitView>
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'offense', label: 'Offense' },
              { value: 'defense', label: 'Defense' },
              { value: 'specialists', label: 'Special Teams' },
            ]}
            ariaLabel="Offense, defense or special teams"
          />
        </div>
        {/*
          THE BOARD RESERVES THE TALLEST UNIT'S HEIGHT so switching units never
          changes the room's size. Offence and defence are three rows; special
          teams is two, and without this the whole page — room, spotlight,
          everything below it — jumped a card's height every time you crossed
          that toggle. A fixed floor costs one line and one unused strip of dark
          on one of three tabs.

          Three rows of card plus their plaques plus the row gaps, spelled out
          rather than measured, so it stays right if the card size changes.
        */}
        <div {...panProps}>
          <div
            /* w-max + mx-auto, NOT items-center. A centred flex child that is
             WIDER than its scroll container overflows equally on both sides, and
             scrollLeft cannot go below 0 - so the left half is unreachable no
             matter how far you drag. That is why the left receiver and corner
             could never be seen. Sized to its widest row instead, the board
             starts at x=0 and every card is reachable; mx-auto still centres it
             whenever there IS free space, which is the only time centring is
             wanted. */
            className="legend-board relative mx-auto flex w-max flex-col"
            style={{
              rowGap: specialTeams ? 50 : 28,
              minHeight: 3 * (CARD_H + 22) + 2 * 28,
            }}
          >
            {/*
            Keyed on tier AND unit so switching either REMOUNTS the board and
            the reveal plays again. Without the key React would reconcile eleven
            cards in place and the change would happen instantly, which is the
            one moment on this page worth animating.

            The stagger is a per-slot delay rather than a library: 28ms apart
            across eleven slots lands the whole assembly inside the 280–420ms
            the spec asks for, and `.legend-enter` zeroes the delay under
            reduced motion (see globals.css — the global clamp only zeroes
            duration, which would leave a silent stagger behind).
          */}
            {rows.map((row, i) => renderRow(row, i))}
          </div>
        </div>
      </div>

      {hall.entries.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Your Hall of Champions is waiting. Open any player you have coached and add them to
          All-Time Legends as they earn a permanent place in your story.
        </p>
      )}

      {picking && (
        <SlotPicker
          slot={picking}
          tier={tier}
          pool={pool}
          eligible={eligible}
          onClose={() => setPicking(null)}
          onAssign={(playerId) => assign(playerId, picking.id, tier)}
          onAddAndAssign={async (playerId) => {
            if (!id) return;
            await window.api.db.addLegend(id, playerId);
            await assign(playerId, picking.id, tier);
          }}
        />
      )}

      {poolOpen && (
        <LegendsPool
          hall={hall}
          onClose={() => setPoolOpen(false)}
          onOpenPlayer={(playerId) => openPlayerModal(id, playerId)}
          onRemove={async (playerId, name) => {
            const ok = await confirm({
              eyebrow: 'All-Time Legends',
              title: `Remove ${name} from the Hall?`,
              message:
                'They leave the pool and any formation slot they hold. Nothing about the player changes.',
              confirmLabel: 'Remove',
              tone: 'danger',
            });
            if (!ok || !id) return;
            await window.api.db.removeLegend(id, playerId);
            load();
          }}
          onUnassign={(playerId) => assign(playerId, null, null)}
        />
      )}
    </div>
  );
}

/**
 * Picking someone for one slot.
 *
 * Two lists in one panel: legends already in the pool who fit, then everyone
 * else this coach coached who fits. The second half is the shortcut — requiring
 * a trip to the profile to add someone before you can place them is right when
 * you are curating forty and pure ceremony when you are filling an empty board.
 * Adding still creates the same pool entry either way, so the model is
 * unchanged; only the number of modals is.
 */
function SlotPicker({
  slot,
  tier,
  pool,
  eligible,
  onClose,
  onAssign,
  onAddAndAssign,
}: {
  slot: LegendFormationSlot;
  tier: LegendTier;
  pool: LegendEntry[];
  eligible: HallEligiblePlayer[] | null;
  onClose: () => void;
  onAssign: (playerId: number) => void;
  onAddAndAssign: (playerId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const fits = (position: string) => slot.compatible.includes(position.trim().toUpperCase());
  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  const inPool = pool.filter((e) => fits(e.snapshot.position) && match(e.snapshot.name));
  const poolIds = new Set(pool.map((e) => e.playerId));
  // Null while the lazy fetch is in flight — the pool half of the picker still
  // works, so the panel is useful before it arrives rather than blocked on it.
  const others = (eligible ?? []).filter(
    (p) => !poolIds.has(p.playerId) && fits(p.position) && match(`${p.firstName} ${p.lastName}`),
  );

  return (
    <CenteredModalPanel
      open
      onClose={onClose}
      widthRem={40}
      eyebrow={tier === 'first' ? 'First Team' : 'Second Team'}
      title={slot.longLabel}
    >
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">
        Eligible: {slot.compatible.join(' · ')}
      </p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search players"
        className="w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
      />

      <div className="mt-3 max-h-[50vh] space-y-4 overflow-y-auto">
        {inPool.length > 0 && (
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">In the pool</p>
            <div className="mt-1.5 space-y-1">
              {inPool.map((entry) => (
                <PickRow
                  key={entry.playerId}
                  name={entry.snapshot.name}
                  meta={`${entry.snapshot.position}${entry.snapshot.schoolName ? ` · ${entry.snapshot.schoolName}` : ''}`}
                  peak={entry.snapshot.peakOverall}
                  action="Assign"
                  onPick={() => onAssign(entry.playerId)}
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Everyone you coached</p>
          <div className="mt-1.5 space-y-1">
            {eligible === null && (
              <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                Loading everyone you coached…
              </p>
            )}
            {others.slice(0, 40).map((player) => (
              <PickRow
                key={player.playerId}
                name={`${player.firstName} ${player.lastName}`}
                meta={`${player.position}${player.schoolName ? ` · ${player.schoolName}` : ''} · ${player.firstSeasonYear}${
                  player.lastSeasonYear !== player.firstSeasonYear
                    ? `–${player.lastSeasonYear}`
                    : ''
                }`}
                peak={player.peakOverall}
                action="Add & assign"
                onPick={() => onAddAndAssign(player.playerId)}
              />
            ))}
            {others.length === 0 && inPool.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                No one you coached fits this slot.
              </p>
            )}
          </div>
        </div>
      </div>
    </CenteredModalPanel>
  );
}

function PickRow({
  name,
  meta,
  peak,
  action,
  onPick,
}: {
  name: string;
  meta: string;
  peak?: number;
  action: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
          {name}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{meta}</span>
      </span>
      {peak !== undefined && (
        <span className="tnum shrink-0 text-xs font-bold text-slate-500 dark:text-slate-300">
          {peak}
        </span>
      )}
      <span className="type-eyebrow shrink-0 text-[10px] text-[var(--team-accent-text)]">
        {action}
      </span>
    </button>
  );
}

/** Everyone in the Hall, with where they stand and how to change it. */
function LegendsPool({
  hall,
  onClose,
  onOpenPlayer,
  onRemove,
  onUnassign,
}: {
  hall: CoachHall;
  onClose: () => void;
  onOpenPlayer: (playerId: number) => void;
  onRemove: (playerId: number, name: string) => void;
  onUnassign: (playerId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const [school, setSchool] = useState('');
  const [placement, setPlacement] = useState('');

  /*
    The filters are built FROM the pool, not from a fixed list — a Hall with
    three schools in it shouldn't offer a menu of a hundred and thirty-eight,
    and a pool of eight quarterbacks shouldn't offer every position in the game.
    Every option here is guaranteed to return something.
  */
  const positions = [...new Set(hall.entries.map((e) => e.snapshot.position))]
    .filter(Boolean)
    .sort();
  const schools = [...new Set(hall.entries.map((e) => e.snapshot.schoolName ?? ''))]
    .filter(Boolean)
    .sort();

  const q = query.trim().toLowerCase();
  const entries = hall.entries.filter((e) => {
    if (q && !e.snapshot.name.toLowerCase().includes(q)) return false;
    if (position && e.snapshot.position !== position) return false;
    if (school && e.snapshot.schoolName !== school) return false;
    if (placement === 'unassigned' && e.slotId) return false;
    if (placement === 'first' && e.tier !== 'first') return false;
    if (placement === 'second' && e.tier !== 'second') return false;
    return true;
  });

  return (
    <CenteredModalPanel
      open
      onClose={onClose}
      widthRem={52}
      /*
        NO COACH NAME HERE EITHER (user direction). This read "N honoured across
        <coach>'s career" and named the wrong coach — the same fault already
        fixed on the page header above (2026-08-03), for the same reason: the
        Hall spans a whole career across whatever schools and coaches it
        touched, so no single name is right for it, and in a multi-coach archive
        the one it picked was simply wrong.

        The header now mirrors the page it belongs to — eyebrow, then the same
        h1 — and the count is already on the button that opens this panel, so
        nothing was lost with the sentence. `title` stays set rather than
        omitted because omitting it drops the panel's whole chrome, including
        its accessible label and close button.
      */
      eyebrow="Hall of Champions"
      title="All-Time Legends"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the pool…"
        aria-label="Search All-Time Legends"
        className="w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
      />

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Select
          value={position}
          onChange={setPosition}
          ariaLabel="Filter by position"
          className="w-full"
          options={[
            { value: '', label: 'All positions' },
            ...positions.map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          value={school}
          onChange={setSchool}
          ariaLabel="Filter by school"
          className="w-full"
          options={[
            { value: '', label: 'All schools' },
            ...schools.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          value={placement}
          onChange={setPlacement}
          ariaLabel="Filter by Hall placement"
          className="w-full"
          options={[
            { value: '', label: 'Any placement' },
            { value: 'unassigned', label: 'Unassigned only' },
            { value: 'first', label: 'First Team' },
            { value: 'second', label: 'Second Team' },
          ]}
        />
      </div>

      <p className="tnum mt-2 text-xs text-slate-400 dark:text-slate-500">
        {entries.length === hall.entries.length
          ? `${hall.entries.length} in the pool`
          : `${entries.length} of ${hall.entries.length}`}
      </p>

      <div className="mt-2 max-h-[55vh] space-y-1 overflow-y-auto">
        {entries.map((entry) => {
          const slot = entry.slotId ? findSlot(entry.slotId) : undefined;
          return (
            <div
              key={entry.playerId}
              className="flex items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 dark:border-slate-800 dark:bg-white/5"
            >
              <button
                type="button"
                onClick={() => onOpenPlayer(entry.playerId)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {entry.snapshot.name}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {entry.snapshot.position}
                  {entry.snapshot.schoolName ? ` · ${entry.snapshot.schoolName}` : ''}
                  {seasonSpan(entry) ? ` · ${seasonSpan(entry)}` : ''}
                </span>
              </button>
              <span className="tnum shrink-0 text-xs font-bold text-slate-500 dark:text-slate-300">
                {entry.snapshot.peakOverall ?? '—'}
              </span>
              <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {slot
                  ? `${entry.tier === 'first' ? 'First' : 'Second'}-Team ${slot.label}`
                  : 'Unassigned'}
              </span>
              {slot && (
                <button
                  type="button"
                  onClick={() => onUnassign(entry.playerId)}
                  className="shrink-0 border border-slate-300/80 px-2 py-1 text-xs text-slate-600 transition hover:border-[var(--team-primary)] dark:border-slate-700 dark:text-slate-300"
                >
                  Unassign
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(entry.playerId, entry.snapshot.name)}
                className="shrink-0 border border-slate-300/80 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                Remove
              </button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No players in the pool yet. Open a player you coached, or click an empty slot on the
            field.
          </p>
        )}
      </div>
    </CenteredModalPanel>
  );
}
