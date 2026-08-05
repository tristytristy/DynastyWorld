/**
 * Recruit dealbreakers and ideal pitches — the game's own wording.
 *
 * TWO FIELDS, ONE VOCABULARY: `Player.RecruitingDealbreaker` (enum
 * `RecruitingMotivationType`, 4 bits) and `Player.IdealRecruitingPitch` (enum
 * `RecruitingPitchType`, 5 bits). The maps below are the COMPLETE enum domains,
 * read off a real save's own schema rather than collected from observed values:
 * 14 motivations and 20 pitches, plus an `Invalid` sentinel each. (`First_`,
 * `Last_` and `Count_` also appear in the schema as aliases of existing
 * ordinals — they are boundary markers, not values, and are deliberately
 * absent here.)
 *
 * WHY A MAP RATHER THAN A SPLITTER. The National Recruits page used to print
 * these through a generic camelCase humanizer, which is right for most enums
 * and wrong for these: an enum name cannot carry an apostrophe, and it cannot
 * say which of its words are articles. So `CoachsFavorite` printed "Coachs
 * Favorite", `ItsGameTime` printed "Its Game Time", `StudentOfTheGame` printed
 * "Student Of The Game", and `TVTime` printed "TVTime" with no space at all —
 * the splitter needs a lowercase-then-uppercase boundary and that name has
 * none. Measured on a real save: 1,855 of 4,525 prospects (41%) carried a label
 * that did not match the game's.
 *
 * Verified against two unrelated saves (a live week-15 dynasty and a finished
 * Auburn season): identical value sets, 9 distinct dealbreakers and 21 distinct
 * pitches in use. The six motivations that appear in neither save are real
 * schema members all the same — absence from a dynasty is not absence from the
 * game, which is why nothing here is trimmed to "what we happened to see".
 */

/** `Invalid` is the real sentinel; the others are cheap defensive spellings. */
const UNSET = new Set(['', 'Invalid', 'Invalid_', 'None']);

/** `RecruitingMotivationType` — the one thing a recruit cares most about. */
export const DEALBREAKER_LABELS: Readonly<Record<string, string>> = {
  AcademicPrestige: 'Academic Prestige',
  AthleticFacilities: 'Athletic Facilities',
  BrandExposure: 'Brand Exposure',
  CampusLifestyle: 'Campus Lifestyle',
  ChampionshipContender: 'Championship Contender',
  CoachPrestige: 'Coach Prestige',
  CoachStability: 'Coach Stability',
  ConferencePrestige: 'Conference Prestige',
  PlayingStyle: 'Playing Style',
  PlayingTime: 'Playing Time',
  ProPotential: 'Pro Potential',
  ProgramTradition: 'Program Tradition',
  ProximityToHome: 'Proximity to Home',
  StadiumAtmosphere: 'Stadium Atmosphere',
};

/** `RecruitingPitchType` — the pitch a recruit most wants to hear. */
export const IDEAL_PITCH_LABELS: Readonly<Record<string, string>> = {
  Aspirational: 'Aspirational',
  CampusPersonality: 'Campus Personality',
  CoachsFavorite: "Coach's Favorite",
  CollegeExperience: 'College Experience',
  ConferenceSpotlight: 'Conference Spotlight',
  FootballInfluencer: 'Football Influencer',
  Grassroots: 'Grassroots',
  HometownHero: 'Hometown Hero',
  ItsGameTime: "It's Game Time",
  Prestigious: 'Prestigious',
  ProveYourself: 'Prove Yourself',
  Starter: 'Starter',
  StudentOfTheGame: 'Student of the Game',
  SundayBound: 'Sunday Bound',
  TVTime: 'TV Time',
  TeamPlayer: 'Team Player',
  TheClutch: 'The Clutch',
  TimeToGetToWork: 'Time to Get to Work',
  ToTheHouse: 'To the House',
  WorkHorse: 'Work Horse',
};

/**
 * The OLD humanizer, kept verbatim and deliberately.
 *
 * It is no longer how anything is labelled; it exists so the legacy correction
 * below can be DERIVED rather than hand-maintained. A second hand-written table
 * of "wrong string → right string" would drift the moment a label changed here;
 * generating it from these maps means the two can never disagree.
 */
function legacyHumanize(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

/**
 * What archives synced before this fix already contain.
 *
 * The extractor stores the LABEL, not the raw enum, so seasons on disk hold the
 * splitter's output. Correcting only the extractor would leave every existing
 * dynasty wrong until a re-sync — so read paths run stored text through this,
 * and the wrong spellings are unique enough across both enums to map back
 * unambiguously.
 */
const LEGACY_LABEL_FIX: ReadonlyMap<string, string> = (() => {
  const fix = new Map<string, string>();
  for (const [raw, label] of [...Object.entries(DEALBREAKER_LABELS), ...Object.entries(IDEAL_PITCH_LABELS)]) {
    const legacy = legacyHumanize(raw);
    if (legacy !== label) fix.set(legacy, label);
  }
  return fix;
})();

/**
 * Label an enum value, or '' when the game hasn't decided one.
 *
 * `Invalid` is a real and common state — roughly 10% of a recruit pool — and it
 * means "not revealed", so it returns empty for the caller to render as a dash
 * rather than printing the word "Invalid" at a user.
 *
 * An unrecognised value falls back to the old splitter: a future title adding
 * an enum member should render something readable rather than nothing.
 */
function labelFrom(map: Readonly<Record<string, string>>, raw: string | null | undefined): string {
  if (!raw || UNSET.has(raw)) return '';
  return map[raw] ?? legacyHumanize(raw);
}

export function dealbreakerLabel(raw: string | null | undefined): string {
  return labelFrom(DEALBREAKER_LABELS, raw);
}

export function idealPitchLabel(raw: string | null | undefined): string {
  return labelFrom(IDEAL_PITCH_LABELS, raw);
}

/**
 * Repairs a label read back from a snapshot written before the maps existed.
 * A value already correct — or one this doesn't recognise — passes through
 * untouched, so this is safe to run over every row on every read.
 */
export function normalizeRecruitPreference(stored: string | null | undefined): string {
  if (!stored) return '';
  return LEGACY_LABEL_FIX.get(stored) ?? stored;
}
