/**
 * The Hall of Champions formation — its slots, and which players may fill them.
 *
 * Kept as DATA, separate from any Hall entry, so an alternate scheme can be
 * added later by defining another slot list rather than by migrating the rows
 * that reference one. An entry stores a `slotId` string and nothing about the
 * geometry it happens to sit in.
 *
 * POSITIONS ARE THE SAVE'S OWN, and this is the part every spec of this feature
 * gets wrong: the game has 21 position values and no RB, DE, OLB, S, OL, EDGE or
 * NT among them (see renderer/lib/rosterOrder.ts, verified against a real save).
 * The vocabulary is:
 *
 *   QB HB FB WR TE LT LG C RG RT LE RE DT LOLB MLB ROLB CB SS FS K P
 *
 * A compatibility table written against Madden's names would silently match
 * nothing, and the failure looks like "the Hall says I have no defensive ends".
 */

export type LegendUnit = 'offense' | 'defense' | 'specialists';
export type LegendTier = 'first' | 'second';

export interface LegendFormationSlot {
  /** Stable across releases — it's what an assignment row stores. Never renumber these. */
  id: string;
  unit: LegendUnit;
  /** What the empty slot prints. */
  label: string;
  /** Longer form for accessible labels and the pool's filter chip. */
  longLabel: string;
  /** Save positions allowed here. */
  compatible: string[];
  /** Row within the unit, top of the field down. Layout reads these; it doesn't hard-code coordinates. */
  row: number;
  /** 1-based column on the unit's TEN-track grid — real field placement, not running order. */
  column: number;
}

/*
  ELEVEN PERSONNEL WITH TWO BACKS — 2 WR, 1 TE, 2 RB (user's call).

  The formation decides who can be honoured, which makes it a product decision
  and not a diagram: a dynasty is far likelier to produce two running backs
  worth enshrining than a third receiver. FULLBACKS COUNT — both back slots take
  HB and FB, because a fullback who blocked for four years is exactly the kind of
  player a Hall is for and the game gives him nowhere else to stand.

  A FIELD AGAIN (user direction 2026-08-03, after a spell as stacked position
  groups). Rows of QB / RB·RB / WR·WR·WR·WR·TE / the line held every card at one
  size and never scrolled, and it read as a tower — a depth chart standing on
  end, not a formation. The football shape is worth the constraint it imposes.

  TEN COLUMNS, the user's arrangement:

      WR  ·  ·  LT LG  C  RG RT TE  ·  WR          row 0
       ·  WR ·  ·  ·  QB  ·  ·  ·  WR  ·           row 1
       ·  ·  ·  RB ·  ·  RB ·  ·  ·  ·             row 2

  `row` groups and `column` is a REAL PLACEMENT on a shared ten-track axis
  again — not an order within its row. That is what puts the quarterback under
  the centre, the backs in the gaps either side of him, two receivers split wide
  on the line and two in the slot.

  THREE RECEIVERS, NOT FOUR. A fourth was added while the board was stacked rows
  and the receivers had no line to split around; mirrored back onto a real
  formation it became a slot man on the left with nobody opposite him, and the
  user cut it. The slot id off-wr4 is simply gone from the list — every other id
  and every other column is untouched, so nothing on the board moved when it
  went.

  THE COLUMN COUNT IS WHAT SETS THE CARD SIZE, and that is the price of the
  formation: ten tracks of card have to fit the board's width, so the cards are
  smaller here than the five-across rows allowed. There is no arrangement that
  keeps both.
*/
const OFFENSE: LegendFormationSlot[] = [
  {
    id: 'off-wr1',
    unit: 'offense',
    label: 'WR',
    longLabel: 'Wide receiver',
    compatible: ['WR'],
    row: 0,
    column: 1,
  },
  {
    id: 'off-lt',
    unit: 'offense',
    label: 'LT',
    longLabel: 'Left tackle',
    compatible: ['LT', 'RT', 'LG', 'RG', 'C'],
    row: 0,
    column: 3,
  },
  {
    id: 'off-lg',
    unit: 'offense',
    label: 'LG',
    longLabel: 'Left guard',
    compatible: ['LG', 'RG', 'C', 'LT', 'RT'],
    row: 0,
    column: 4,
  },
  {
    id: 'off-c',
    unit: 'offense',
    label: 'C',
    longLabel: 'Center',
    compatible: ['C', 'LG', 'RG'],
    row: 0,
    column: 5,
  },
  {
    id: 'off-rg',
    unit: 'offense',
    label: 'RG',
    longLabel: 'Right guard',
    compatible: ['RG', 'LG', 'C', 'RT', 'LT'],
    row: 0,
    column: 6,
  },
  {
    id: 'off-rt',
    unit: 'offense',
    label: 'RT',
    longLabel: 'Right tackle',
    compatible: ['RT', 'LT', 'RG', 'LG', 'C'],
    row: 0,
    column: 7,
  },
  {
    id: 'off-te',
    unit: 'offense',
    label: 'TE',
    longLabel: 'Tight end',
    compatible: ['TE'],
    row: 0,
    column: 8,
  },
  {
    id: 'off-wr2',
    unit: 'offense',
    label: 'WR',
    longLabel: 'Wide receiver',
    compatible: ['WR'],
    row: 0,
    column: 10,
  },
  {
    id: 'off-qb',
    unit: 'offense',
    label: 'QB',
    longLabel: 'Quarterback',
    compatible: ['QB'],
    row: 1,
    column: 5,
  },
  {
    id: 'off-wr3',
    unit: 'offense',
    label: 'WR',
    longLabel: 'Third wide receiver',
    compatible: ['WR'],
    row: 1,
    column: 9,
  },
  {
    id: 'off-rb1',
    unit: 'offense',
    label: 'RB',
    longLabel: 'Running back',
    compatible: ['HB', 'FB'],
    row: 2,
    column: 4,
  },
  {
    id: 'off-rb2',
    unit: 'offense',
    label: 'RB',
    longLabel: 'Second running back',
    compatible: ['HB', 'FB'],
    row: 2,
    column: 6,
  },
];

/*
  A 3-4 — three down linemen and TWO middle linebackers (user's call), which is
  also the front a Hall wants: it honours two inside backers instead of one, and
  most dynasties produce more of those than they do nose tackles.

  A FIELD AGAIN TOO, on the offence's ten-track axis: the nose on the middle with
  an end either side, the two inside backers stacked behind the gaps, the outside
  backers setting the edge, the corners out on the boundary and the safeties
  deep. Grouping it as line / linebackers / secondary made the corners sit on the
  ends of the DEFENSIVE LINE's row, which is where they stand on a field and
  nonsense as a group — that was the tell that these want to be coordinates.

  Every id is unchanged, so nothing anyone has already enshrined moves.
*/
const DEFENSE: LegendFormationSlot[] = [
  {
    id: 'def-cb1',
    unit: 'defense',
    label: 'CB',
    longLabel: 'Cornerback',
    compatible: ['CB'],
    row: 0,
    column: 1,
  },
  {
    id: 'def-le',
    unit: 'defense',
    label: 'LE',
    longLabel: 'Left end',
    compatible: ['LE', 'RE', 'DT'],
    row: 0,
    column: 4,
  },
  {
    id: 'def-dt1',
    unit: 'defense',
    label: 'DT',
    longLabel: 'Nose tackle',
    compatible: ['DT'],
    row: 0,
    column: 5,
  },
  {
    id: 'def-re',
    unit: 'defense',
    label: 'RE',
    longLabel: 'Right end',
    compatible: ['RE', 'LE', 'DT'],
    row: 0,
    column: 6,
  },
  {
    id: 'def-cb2',
    unit: 'defense',
    label: 'CB',
    longLabel: 'Cornerback',
    compatible: ['CB'],
    row: 0,
    column: 10,
  },
  {
    id: 'def-lolb',
    unit: 'defense',
    label: 'OLB',
    longLabel: 'Outside linebacker',
    compatible: ['LOLB', 'ROLB', 'MLB'],
    row: 1,
    column: 3,
  },
  {
    id: 'def-mlb1',
    unit: 'defense',
    label: 'MLB',
    longLabel: 'Middle linebacker',
    compatible: ['MLB', 'LOLB', 'ROLB'],
    row: 1,
    column: 4,
  },
  {
    id: 'def-mlb2',
    unit: 'defense',
    label: 'MLB',
    longLabel: 'Second middle linebacker',
    compatible: ['MLB', 'LOLB', 'ROLB'],
    row: 1,
    column: 6,
  },
  {
    id: 'def-rolb',
    unit: 'defense',
    label: 'OLB',
    longLabel: 'Outside linebacker',
    compatible: ['ROLB', 'LOLB', 'MLB'],
    row: 1,
    column: 7,
  },
  {
    id: 'def-fs',
    unit: 'defense',
    label: 'FS',
    longLabel: 'Free safety',
    compatible: ['FS', 'SS'],
    row: 2,
    column: 4,
  },
  {
    id: 'def-ss',
    unit: 'defense',
    label: 'SS',
    longLabel: 'Strong safety',
    compatible: ['SS', 'FS'],
    row: 2,
    column: 6,
  },
];

/*
  THE KICKER GETS A SLOT, on the board rather than on a strip beside it — a
  specialist parked outside the field reads as an afterthought, which is the
  opposite of the point of giving him a slot at all.

  They appear under the OFFENCE only (user's call). Kicking is what you do when
  the offence stops, and printing the same two slots under the defence as well
  was showing them twice to say one thing.

  A UNIT OF ITS OWN NOW (user direction 2026-08-03), not two slots borrowed onto
  the bottom of the offence. Riding along under the offence was the right answer
  while there were only two of them and the alternative was a strip beside the
  board — but a third unit is what lets the returners exist, and a returner is
  not an offensive player who happens to also field kicks.

  THE RETURNERS ARE NOT SAVE POSITIONS. The game has 21 positions and KR and PR
  are not among them (see the vocabulary at the top of this file), because
  returning is a job rather than a position — it is done by whichever receiver,
  back or corner is the best athlete on the roster. So the two returner slots
  take the whole skill-position set instead of one name, which is what makes them
  fillable at all; a `compatible: ['KR']` would have matched nobody, forever, and
  looked like a bug in the Hall rather than a fact about the save.
*/
const RETURN_ELIGIBLE = ['WR', 'HB', 'FB', 'CB', 'FS', 'SS', 'TE'];

const SPECIAL_TEAMS: LegendFormationSlot[] = [
  {
    id: 'sp-k',
    unit: 'specialists',
    label: 'K',
    longLabel: 'Kicker',
    compatible: ['K'],
    row: 1,
    column: 1,
  },
  {
    id: 'sp-p',
    unit: 'specialists',
    label: 'P',
    longLabel: 'Punter',
    compatible: ['P', 'K'],
    row: 1,
    column: 2,
  },
  {
    id: 'sp-kr',
    unit: 'specialists',
    label: 'KR',
    longLabel: 'Kick returner',
    compatible: RETURN_ELIGIBLE,
    row: 0,
    column: 1,
  },
  {
    id: 'sp-pr',
    unit: 'specialists',
    label: 'PR',
    longLabel: 'Punt returner',
    compatible: RETURN_ELIGIBLE,
    row: 0,
    column: 2,
  },
];

export const LEGEND_SLOTS: LegendFormationSlot[] = [...OFFENSE, ...DEFENSE, ...SPECIAL_TEAMS];

export function slotsForUnit(unit: LegendUnit): LegendFormationSlot[] {
  return LEGEND_SLOTS.filter((slot) => slot.unit === unit);
}

export function findSlot(slotId: string): LegendFormationSlot | undefined {
  return LEGEND_SLOTS.find((slot) => slot.id === slotId);
}


export function isCompatible(position: string, slotId: string): boolean {
  const slot = findSlot(slotId);
  return !!slot && slot.compatible.includes(position.trim().toUpperCase());
}
