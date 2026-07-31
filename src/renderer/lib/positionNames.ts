/**
 * Roster abbreviations spelled out.
 *
 * The save uses the depth-chart codes ("LOLB", "RE", "HB"), which are right for
 * a table column and wrong on a trading card — a card says "Tight End". Sides
 * collapse deliberately: LOLB and ROLB are both Outside Linebacker, LE and RE
 * both Defensive End. Nobody reading a card cares which side of the line the
 * depth chart put him on.
 *
 * Unknown codes fall through unchanged, so a position this map hasn't met shows
 * its abbreviation rather than nothing.
 */
const POSITION_NAMES: Record<string, string> = {
  QB: 'Quarterback',
  HB: 'Running Back',
  RB: 'Running Back',
  FB: 'Fullback',
  WR: 'Wide Receiver',
  TE: 'Tight End',
  LT: 'Left Tackle',
  LG: 'Left Guard',
  C: 'Center',
  RG: 'Right Guard',
  RT: 'Right Tackle',
  OL: 'Offensive Line',
  LE: 'Defensive End',
  RE: 'Defensive End',
  DE: 'Defensive End',
  DT: 'Defensive Tackle',
  DL: 'Defensive Line',
  LOLB: 'Outside Linebacker',
  ROLB: 'Outside Linebacker',
  OLB: 'Outside Linebacker',
  MLB: 'Middle Linebacker',
  LB: 'Linebacker',
  CB: 'Cornerback',
  FS: 'Free Safety',
  SS: 'Strong Safety',
  S: 'Safety',
  DB: 'Defensive Back',
  K: 'Kicker',
  P: 'Punter',
};

export function fullPositionName(position: string): string {
  return POSITION_NAMES[position.toUpperCase()] ?? position;
}
