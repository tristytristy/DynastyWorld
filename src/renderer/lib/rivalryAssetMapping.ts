const RIVALRY_LOGO_BASE_PATH = 'assets/rivalry/rivalrylogo';

/** The generic "RIVALRY" shield, for a confirmed rivalry with no dedicated art. */
const DEFAULT_RIVALRY_LOGO = `${RIVALRY_LOGO_BASE_PATH}/ryLgs_1024_Default_Small.webp`;

/**
 * Matchup → logo file, keyed by the two teams rather than by the save's rivalry
 * NAME.
 *
 * Two reasons it has to work this way. The art is named by pairing
 * ("AlabamaVsAuburn"), not by rivalry ("Iron Bowl"). And the save only extracts
 * rivalry names for the USER's team (see extract-rivalries.ts) — keying on the
 * pairing means a browsed team's schedule and any league game's box score get
 * the same treatment for free, with no new extraction.
 *
 * Written out as real display-name pairs instead of parsed from the filenames,
 * because the filenames don't agree with each other or with the save. The art
 * ships "TexasAM" in one file and "Texasam" in another; the save says
 * "New Mexico St." where the art says "NewMexicoState", "USF" where the art
 * says "SouthFlorida", and "Washington St." where the art says
 * "WashingtonState". A parser would need every one of those exceptions anyway,
 * and would fail silently on the next one — this fails loudly, at the point
 * where a new pairing is added.
 *
 * Names below are verified against the real 138-team display-name list.
 */
const RIVALRY_LOGO_FILES: [string, string, string][] = [
  ['Alabama', 'Auburn', 'ryLgs_1024_AlabamaVsAuburn_Small.webp'],
  ['Alabama', 'Tennessee', 'ryLgs_1024_AlabamaVsTennessee_Small.webp'],
  ['Arizona', 'Arizona State', 'ryLgs_1024_ArizonaVsArizonaState_Small.webp'],
  ['Arkansas', 'Texas A&M', 'ryLgs_1024_ArkansasVsTexasAM_Small.webp'],
  ['Army', 'Navy', 'ryLgs_1024_ArmyVsNavy_Small.webp'],
  ['Buffalo', 'UMass', 'ryLgs_1024_BuffaloVsUmass_Small.webp'],
  ['California', 'Stanford', 'ryLgs_1024_CalVsStanford_Small.webp'],
  ['Clemson', 'South Carolina', 'ryLgs_1024_ClemsonVsSouthCarolina_Small.webp'],
  ['Colorado State', 'Wyoming', 'ryLgs_1024_ColoradoStateVsWyoming_Small.webp'],
  ['Colorado', 'Colorado State', 'ryLgs_1024_ColoradoVsColoradoState_Small.webp'],
  ['Florida', 'Florida State', 'ryLgs_1024_FloridaVsFloridaState_Small.webp'],
  ['Florida', 'Georgia', 'ryLgs_1024_FloridaVsGeorgia_Small.webp'],
  ['Iowa', 'Iowa State', 'ryLgs_1024_IowaVsIowaState_Small.webp'],
  ['Kansas', 'Kansas State', 'ryLgs_1024_KansasVsKansasState_Small.webp'],
  ['LSU', 'Ole Miss', 'ryLgs_1024_LsuVsOleMiss_Small.webp'],
  ['Missouri', 'Arkansas', 'ryLgs_1024_MissouriVsArkansas_Small.webp'],
  ['Nebraska', 'Iowa', 'ryLgs_1024_NebraskaVsIowa_Small.webp'],
  ['New Mexico', 'New Mexico St.', 'ryLgs_1024_NewMexicoVsNewMexicoState_Small.webp'],
  ['Oklahoma State', 'Tulsa', 'ryLgs_1024_OklahomaStateVsTulsa_Small.webp'],
  ['Oklahoma', 'Oklahoma State', 'ryLgs_1024_OklahomaVsOklahomaState_Small.webp'],
  ['Oklahoma', 'Texas', 'ryLgs_1024_OklahomaVsTexas_Small.webp'],
  ['Pittsburgh', 'West Virginia', 'ryLgs_1024_PittsburghVsWestVirginia_Small.webp'],
  ['Southern Miss', 'Tulane', 'ryLgs_1024_SouthernMissVsTulane_Small.webp'],
  ['Texas State', 'UTSA', 'ryLgs_1024_TexasStateVsUtsa_Small.webp'],
  ['Texas', 'Texas A&M', 'ryLgs_1024_TexasVsTexasam_Small.webp'],
  ['Toledo', 'Bowling Green', 'ryLgs_1024_ToledoVsBowlingGreen_Small.webp'],
  ['Troy', 'South Alabama', 'ryLgs_1024_TroyVsSouthAlabama_Small.webp'],
  ['UCF', 'USF', 'ryLgs_1024_UcfVsSouthFlorida_Small.webp'],
  ['UTEP', 'New Mexico St.', 'ryLgs_1024_UtepVsNewMexicoState_Small.webp'],
  ['Virginia', 'Virginia Tech', 'ryLgs_1024_VirginiaVsVirginiaTech_Small.webp'],
  ['Washington', 'Washington St.', 'ryLgs_1024_WashingtonVsWashingtonState_Small.webp'],
];

/** Case/punctuation-insensitive, so "Texas A&M" and "TEXAS AM" are the same team. */
function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Order-independent: a matchup is the same rivalry whoever is at home.
 *
 * EXPORTED because user-declared rivalries are stored under this exact key
 * (schema v20, `custom_rivals.pair_key`). One implementation, or the editor
 * would write a key the resolver below can't find and a rivalry someone created
 * would simply never appear.
 */
export function rivalryPairKey(a: string, b: string): string {
  return [normalizeTeam(a), normalizeTeam(b)].sort().join('|');
}

const pairKey = rivalryPairKey;

/** A rivalry the user declared: a name, and optionally their own art for it. */
export interface CustomRivalryEntry {
  name: string;
  /** A renderer-loadable URL for the uploaded logo, or null for the generic shield. */
  logo: string | null;
}

/**
 * User-declared rivalries, sitting in front of the shipped pairing list.
 *
 * A PLAIN MODULE, for the same reason `programArt.ts` is one: rivalry art is
 * resolved by a pure function that the Schedule, Scores, Game Info and Media
 * pages all call, none of which can use hooks at the point of the call.
 * Threading a map through four call sites would still miss the fifth.
 * `CustomRivalsProvider` owns the lifecycle and is the only writer.
 *
 * Holds ONE dynasty's rows at a time, which is what makes a name-derived key
 * safe here — two saves can each declare their own "Montana vs Idaho" without
 * either reaching the other.
 */
let customRivalries: Record<string, CustomRivalryEntry> = {};

export function setCustomRivalryRegistry(next: Record<string, CustomRivalryEntry>): void {
  customRivalries = next;
}

/**
 * THE SAVE'S OWN RIVALRIES, LEAGUEWIDE — pair key → the save's name for it
 * (or null when it has none).
 *
 * User report (2026-08-07): "Michigan vs Ohio State, one of the biggest
 * rivalries in all of college football, looks just like a regular game."
 * Correct, and for two compounding reasons. The Game has no dedicated art in the
 * shipped pairing list below, so nothing matched there; and the only other
 * signal was `isKnownRivalry`, which comes from the save's rivalry flag for the
 * USER's team alone — browse anybody else's schedule and every rivalry in the
 * country goes quiet.
 *
 * The save knew all along: every one of the 138 teams carries three rival slots,
 * and walking them yields 272 pairings. `extractLeagueRivalries` now captures
 * them, and this is where they land. A rivalry in here earns at least the
 * generic shield, exactly as a user-declared one does — the evidence is the
 * same kind, so the treatment is the same.
 *
 * Empty until a season is re-synced, which simply restores the old behaviour
 * rather than breaking anything.
 */
let leagueRivalries: Map<string, string | null> = new Map();

export function setLeagueRivalryRegistry(rows: { teamA: string; teamB: string; name: string | null }[]): void {
  leagueRivalries = new Map(rows.map((r) => [rivalryPairKey(r.teamA, r.teamB), r.name]));
}


const LOGO_BY_PAIR = new Map(
  RIVALRY_LOGO_FILES.map(([teamA, teamB, file]) => [pairKey(teamA, teamB), `${RIVALRY_LOGO_BASE_PATH}/${file}`]),
);

/**
 * This matchup's rivalry logo, or null when it isn't one we can name.
 *
 * ORDER OF PRECEDENCE, and the user comes first. Someone who uploaded art for
 * their own rivalry meant it to be used, including over a shipped pairing —
 * declaring "the Battle for the Bell" on Alabama/Auburn is an odd thing to do,
 * but if they do it, showing them the Iron Bowl shield instead would be the app
 * overruling an explicit instruction.
 *
 * A NAMED CUSTOM RIVALRY WITH NO ART still gets the generic shield. The user
 * said these two are rivals; that is the same evidence the save's own flag
 * provides, and it earns the same treatment.
 *
 * `isKnownRivalry` is the save's own rivalry flag for the user's team. It only
 * ever widens the result to the generic shield — a pairing with dedicated art
 * gets it either way, so a browsed team's Iron Bowl still shows the Iron Bowl.
 * Without any of the three there is no fallback, because "these two teams
 * played" is not evidence of a rivalry.
 */
export function getRivalryLogoPath(teamA: string, teamB: string, isKnownRivalry = false): string | null {
  const key = pairKey(teamA, teamB);
  const custom = customRivalries[key];
  if (custom?.logo) return custom.logo;
  const known = LOGO_BY_PAIR.get(key);
  if (known) return known;
  // The save's leaguewide list joins `isKnownRivalry` as evidence of the same
  // kind — the difference between them is only WHOSE schedule you are on, which
  // is no reason for The Game to look like a Tuesday non-conference fixture.
  return custom || isKnownRivalry || leagueRivalries.has(key) ? DEFAULT_RIVALRY_LOGO : null;
}

/**
 * IS this matchup a rivalry — from any source we trust: the user's own
 * declaration, the shipped pairing list, the save's leaguewide table, or the
 * caller's own flag.
 *
 * Separate from `getRivalryLogoPath` because "is it one" and "what mark does it
 * get" are different questions, and callers were answering the first by testing
 * the second for null — which reads as a coincidence rather than a check.
 */
export function isKnownRivalry(teamA: string, teamB: string, saveFlag = false): boolean {
  const k = pairKey(teamA, teamB);
  return saveFlag || k in customRivalries || LOGO_BY_PAIR.has(k) || leagueRivalries.has(k);
}

/**
 * What to CALL this matchup — the user's name for it, else the save's, else
 * nothing. The counterpart to the logo lookup, for surfaces that print a
 * rivalry's name rather than draw its mark.
 */
export function getRivalryName(teamA: string, teamB: string, saveName?: string | null): string | null {
  const key = pairKey(teamA, teamB);
  // `saveName` is the caller's own (user-team-scoped) knowledge and stays ahead
  // of the leaguewide table, which is the same data read from further away.
  return customRivalries[key]?.name ?? saveName ?? leagueRivalries.get(key) ?? null;
}
