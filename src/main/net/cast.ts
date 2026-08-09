import type { NetAccountKind } from '../../shared/netTypes';

/**
 * The recurring cast of DynastyNet. Fixed media voices plus fan accounts
 * minted for whichever teams are in the news this week — the cast grows with
 * the dynasty (a fan account, once created, keeps its history forever).
 */

export interface CastMember {
  handle: string;
  displayName: string;
  kind: NetAccountKind;
  persona: string;
}

export const FIXED_CAST: CastMember[] = [
  {
    handle: '@PollCentral',
    displayName: 'Poll Central',
    kind: 'bot',
    persona: 'Measured poll-watcher account. Posts ranking movements with context; never yells, quietly devastating.',
  },
  {
    handle: '@TheGoalLineShow',
    displayName: 'Goal Line Radio',
    kind: 'bot',
    persona: 'Loud hot-take radio host. ALL CAPS when excited. Always confident, frequently wrong, never apologizes.',
  },
  {
    handle: '@StatsNerdCFB',
    displayName: 'Field Position Frank',
    kind: 'bot',
    persona: 'Stats obsessive. Leads every take with a number nobody asked for. Considers vibes a rounding error.',
  },
  {
    handle: '@gridironGrandpa',
    displayName: 'Gridiron Grandpa',
    kind: 'bot',
    persona: 'Old-school curmudgeon. Thinks everything was better in 1987, hates the transfer portal, loves punting.',
  },
  {
    handle: '@UpsetAlertSzn',
    displayName: 'Upset Alert',
    kind: 'bot',
    persona: 'Lives for chaos. Siren emojis. Only truly happy when a top-10 team loses to a directional school.',
  },
  {
    handle: '@Client97',
    displayName: 'burner acct (definitely not an agent)',
    kind: 'bot',
    persona: "NIL-world gossip account. Vague insider claims, 'hearing things', screenshots nothing. Occasionally right, which is the scary part.",
  },
  {
    handle: '@TheCrystalFB',
    displayName: 'The Crystal Football',
    kind: 'paper',
    persona: 'The national newspaper of record for this universe. Writes the weekly front-page story: biggest game, biggest storyline, written straight and vivid like great sports journalism.',
  },
  {
    handle: '@4thAndForever',
    displayName: '4th & Forever Pod',
    kind: 'podcast',
    persona: 'Two-host podcast. RECAP-style episode summaries: teams rising, teams collapsing, coaches on hot seats, one weekly overreaction the hosts argue about.',
  },
];

/** Deterministic fan-account identity for a school, so the same team always gets the same fan. */
export function fanFor(teamName: string): CastMember {
  const compact = teamName.replace(/[^A-Za-z0-9]/g, '');
  return {
    handle: `@${compact}Diehard`,
    displayName: `${teamName} Diehard`,
    kind: 'bot',
    persona: `Die-hard ${teamName} fan. Unshakeable homer, feuds with rival fans, treats every loss as a conspiracy and every win as destiny.`,
  };
}

/** The user's own account — created once per dynasty, posts as "you". */
export function userAccountFor(coachTeam: string | null): CastMember {
  return {
    handle: '@Coach',
    displayName: coachTeam ? `Coach (${coachTeam})` : 'Coach',
    kind: 'user',
    persona: '',
  };
}
