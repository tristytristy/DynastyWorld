import type { MediaLook } from './mediaLook';
import type {
  TeamAllTimeData,
  TeamHistorySeasonData,
  TeamStatRecordData,
} from '../extractors/extract-team-history';

export type { TeamAllTimeData, TeamHistorySeasonData, TeamStatRecordData };

import type { PortraitBuild, PortraitSkinTone, PortraitType } from './portraitTaxonomy';

export interface SaveFileInfo {
  path: string;
  name: string;
  modifiedAt: string;
  bytes: number;
  /** The dynasty this file belongs to (`DYNASTY-EVANZSYNC-AUTOSAVE` → `EVANZSYNC`), so its variants group under one row. */
  slug: string;
  /** `main` is the save itself; `autosave` and `backup` are the game's other copies of the same dynasty. */
  kind: 'main' | 'autosave' | 'backup';
}

/** The identity read from inside a save file, so the picker can show a school and coach rather than a filename. */
export interface SavePeek {
  teamName: string | null;
  coachName: string | null;
  coachPosition: string | null;
  seasonYear: number;
  /** "Preseason", "Week 7", "End of Season Recap" — see formatSaveWeek. */
  weekLabel: string;
}

export interface DynastySummary {
  id: string;
  label: string;
  teamName: string;
  seasonYear: number | null;
  record: { wins: number; losses: number } | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  /** The human-controlled coach's name — Head Coach, Offensive Coordinator, or Defensive Coordinator, whichever the user actually plays as. A dynasty is identified by its coach, not its current job (team). */
  coachName: string | null;
  /** The user coach's role enum (HeadCoach / OffensiveCoordinator / DefensiveCoordinator); humanized for display. Null on history-only seasons. */
  coachPosition: string | null;
  coachPortraitAssetName: string | null;
  /** Where in the in-game calendar the last synced save sits — e.g. "Preseason", "Week 7", "End of Season Recap". Null on history-only seasons. */
  savePhaseLabel: string | null;
  /** The save file this dynasty tracks — lets the Import picker mark saves that are already on the dashboard. */
  savePath: string;
}

export interface DynastyTheme {
  teamName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** A team's own brand colors (any team, not just the user's) — themes a player's trading card to the team he plays for. See getTeamTheme. */
export interface TeamTheme {
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface ImportResult {
  success: boolean;
  message: string;
  dynastyId?: string;
}

export interface DynastyMatchCandidate {
  dynastyId: string;
  label: string;
  currentSeasonYear: number;
  newSeasonYear: number;
}

export interface ExportResult {
  success: boolean;
  message: string;
  filePath?: string;
}

export interface SaveFileBackupResult {
  success: boolean;
  message: string;
  filePath?: string;
}

/** All values are the raw save-file strings/numbers, editable in place — see src/shared/playerEditorFields.ts for the section/label layout consumed by the editor UI. */
export interface PlayerEditFields {
  firstName: string;
  lastName: string;
  position: string;
  /**
   * Player.PlayerType, the raw enum name ("QB_FieldGeneral"). READ-ONLY — the
   * editor does not change a player's archetype; this is carried so the live
   * overall calculator can pick the right weight vector, which is keyed on
   * (position, archetype). See shared/overallRating.ts.
   */
  playerType: string;
  schoolYear: string;
  redshirtStatus: string;
  jerseyNumber: number;
  traitDevelopment: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  personality: string;
  scheme: string;
  role: string;
  /** Player.RecruitingDealbreaker — the one thing this recruit cares most about (enum). */
  recruitingDealbreaker: string;
  /** Player.IdealRecruitingPitch — the pitch this recruit most wants to hear (enum). */
  idealRecruitingPitch: string;
  /**
   * Player.BaseNILValue — the recruit's NIL demand (in $K). Signed 11-bit field,
   * real range [-255, 1023]; top prospects sit ~130-165. Lowering it is what lets
   * a low-prestige program actually meet a recruit's NIL and keep him committed.
   */
  nilDemand: number;
  /**
   * Player.SkillPoints — the spendable skill-points currency the game accrues
   * (from ExperiencePoints) and the player spends to upgrade attributes/abilities.
   * Unsigned 15-bit field (real max 32,767); real rosters sit in the single/low
   * double digits. Distinct from SkillGroupCap1..6 (the per-group rating ceilings).
   */
  skillPoints: number;
  /**
   * Player.ExperiencePoints — the XP a player accrues from games, which converts
   * into SkillPoints. Unsigned 20-bit field (real max 1,048,575); real rosters
   * range into the low tens of thousands.
   */
  experiencePoints: number;
  isImpactPlayer: boolean;
  isCreated: boolean;
  isUserControlled: boolean;
  portraitAssetName: string | null;
  /** Keyed by RatingFieldDef.key (includes overallRating as 'ovr'). */
  ratings: Record<string, number>;
  /** Keyed by SKILL_GROUP_CAP_FIELDS[].key. */
  skillGroupCaps: Record<string, number>;
  /** Keyed by `${abilityKey}`/`${rankKey}` from MENTAL_ABILITY_FIELDS. */
  mentalAbilities: Record<string, string>;
  /** Keyed by PHYSICAL_ABILITY_FIELDS[].key -> tier string. */
  physicalAbilities: Record<string, string>;
}

export interface PlayerEditData {
  id: number;
  fields: PlayerEditFields;
}

/**
 * A team's program-points budget (the coach-HUD "Program Points"). NIL isn't a
 * separate pool — it's a spending category funded out of these points, so raising
 * the budget/unspent points is how a program affords bigger NIL deals. Read fresh
 * from the Team record on modal open (like the coach editor), not from the snapshot.
 */
export interface TeamBudgetFields {
  /** Team.ProgramPointBudget — total program points for the year. Cap 25,000. Editable. */
  programPointBudget: number;
  /** Team.RemainingProgramPoints — unspent points (the blue diamond in the HUD). Editable. */
  remainingProgramPoints: number;
  /** Team.NILProgramPointsSpent — read-only context: points currently allocated to NIL. */
  nilProgramPointsSpent: number;
  /** Team.TeamPrestige — read-only context: prestige that drives baseline NIL capacity. */
  teamPrestige: number;
}

export interface TeamBudgetData {
  teamIndex: number;
  teamName: string;
  fields: TeamBudgetFields;
}

/** Only the two writable budget fields — the other TeamBudgetFields are display-only context. */
export interface TeamBudgetEdit {
  programPointBudget: number;
  remainingProgramPoints: number;
}

/** One before/after field mutation, for the Force Commit change log. */
export interface ForceCommitFieldChange {
  field: string;
  before: string;
  after: string;
}

/**
 * Result of the EXPERIMENTAL Force Commit action. `code` disambiguates the
 * blocked cases (recruit not on board, already signed, no user team) so the UI
 * can explain them precisely. On success, `changedFields` is the full write log
 * and `validated` reflects the post-write reopen check.
 */
export interface ForceCommitResult {
  success: boolean;
  message: string;
  code?: 'NOT_ON_BOARD' | 'ALREADY_SIGNED' | 'NO_USER_TEAM' | 'NOT_FOUND' | 'VALIDATION_FAILED';
  destinationTeamName?: string;
  changedFields?: ForceCommitFieldChange[];
  validated?: boolean;
}

export interface CoachEditFields {
  firstName: string;
  lastName: string;
  personality: string;
  coachPrestige: number;
  /** Coach.CoachPoints — the coach's recruiting/coach points (the coach-HUD number). Unsigned 12-bit, clamped [0, 4000]. */
  coachPoints: number;
  contractSalary: number;
  contractLength: number;
  contractYearsRemaining: number;
  portraitAssetName: string | null;
}

export interface CoachEditData {
  teamIndex: number;
  position: string;
  fields: CoachEditFields;
}

/**
 * Deliberately narrower than the full spec's field wishlist — only fields
 * verified safe (a real write -> save -> reopen round trip against a
 * disposable save) are included. Excluded and why: home state resolves to a
 * real enum (`StateName`) whose valid member list wasn't catalogued in this
 * pass; "top schools" is a reference to another table (a tracking structure,
 * not a scalar), too complex to edit safely here; commitment status and
 * signed school drive real recruiting-stage game logic / are derived
 * cross-team data, not simple field edits. Name/position remain editable via
 * the existing general Player editor (recruits are `Player` records too).
 */
export interface RecruitEditFields {
  hometown: string;
  /** 1-5, translated to/from the real ONE_STAR..FIVE_STAR enum. */
  stars: number;
  /** 'HighSchool' | 'JuniorCollege_Sophomore' | 'JuniorCollege_Junior' | 'JuniorCollege_Senior' — real enum values, not guessed. */
  classYear: string;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
}

/** One editable top-school slot for a recruit. `originalTeamIndex` identifies which slot (the team currently in it); `teamIndex` is the team to write (same = influence-only edit, different = swap). */
export interface RecruitTopSchoolEdit {
  originalTeamIndex: number;
  teamIndex: number;
  influence: number;
}

/** Step-1 recruiting write payload — a prospect's decision funnel (verified round-trip safe): commitment stage, commit score, and each top school's interest. Writes Recruit.RecruitStage/CommitScore + ProspectTargetSchool.TeamId/TeamInfluence. */
export interface RecruitInfluenceEdit {
  stage: string;
  commitScore: number;
  topSchools: RecruitTopSchoolEdit[];
}

export interface RecruitEditData {
  playerId: number;
  fields: RecruitEditFields;
}

export interface SaveEditResult {
  success: boolean;
  message: string;
}

export interface PortraitSearchResult {
  assetName: string;
  path: string;
  type: PortraitType;
  build: PortraitBuild | null;
  skinTone: PortraitSkinTone | null;
}

export interface PortraitFilters {
  type: PortraitType | 'all';
  build: PortraitBuild | 'all';
  skinTone: PortraitSkinTone | 'all';
}

export interface PortraitSearchResponse {
  results: PortraitSearchResult[];
  totalCount: number;
}

export interface GameSummary {
  week: number;
  opponent: string;
  isHome: boolean;
  status: string;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'W' | 'L' | 'T' | null;
}

/** The coach who led a team for a season — surfaced on the Team Hub overview so browsing any program shows who's in charge. presentationId is the stable coach id (see docs/coach-movement-research.md). */
export interface SeasonOverviewCoach {
  firstName: string;
  lastName: string;
  position: string;
  presentationId: number;
  isUserControlled: boolean;
  portraitAssetName: string | null;
}

export interface SeasonOverview {
  dynastyId: string;
  dynastyLabel: string;
  teamName: string;
  seasonYear: number;
  /** The team's head coach that season (or the user-controlled coach if no HeadCoach row resolved); null for a history-only season. */
  headCoach: SeasonOverviewCoach | null;
  lastSyncedAt: string;
  record: { wins: number; losses: number };
  conferenceRecord: { wins: number; losses: number };
  rankings: { media: number | null; coaches: number | null; cfp: number | null };
  recruitingClassRank: number | null;
  teamPrestige: number | null;
  recentGames: GameSummary[];
  upcomingGames: GameSummary[];
}

export interface NcaaHubTop25Entry {
  rank: number;
  teamName: string;
  conferenceName: string | null;
  wins: number;
  losses: number;
  coachesRank: number | null;
  cfpRank: number | null;
  isUserTeam: boolean;
  /**
   * Spots gained since last week IN THIS LIST'S OWN POLL: positive is a climb,
   * negative a fall, 0 held station. Deliberately not named for the media poll
   * — each poll list carries its own movement, so a coaches ranking can never
   * be annotated with media-poll movement.
   *
   * Null when there is nothing honest to compare against: a season synced
   * before the last-week field was captured, a week before the poll was
   * released, or the CFP poll, whose `LastWeeksRank` mirrors its current rank
   * on every save checked (see extract-teams.ts).
   */
  rankMovement: number | null;
  /** Last week's rank in the same poll, so a chip can name where the team came from. Null under the same conditions as rankMovement. */
  lastWeekRank: number | null;
}

export interface NcaaHubHeismanFeature {
  label: 'Heisman Winner' | 'Heisman Leader';
  rank: number;
  playerId: number;
  playerName: string;
  position: string;
  teamDisplayName: string;
}

export interface NcaaHubGameFeature {
  week: number;
  date: string;
  dayOfWeek: string;
  kickoffTime: string;
  broadcastScope: string;
  homeTeamName: string;
  awayTeamName: string;
  homeRank: number | null;
  awayRank: number | null;
  homeScore: number | null;
  awayScore: number | null;
  isBowlGame: boolean;
  isNationalChampionship: boolean;
  bowlName: string | null;
  bowlAssetName: string | null;
  isNeutralSite: boolean;
  summary: string;
  /**
   * For the upset feature: how many poll spots the winner reached up
   * (loser's rank subtracted from the winner's, always positive). Kept as a
   * fact rather than only as a word in `summary`, so the magnitude is
   * readable without parsing prose. Null on any feature that isn't an upset.
   */
  rankSwing: number | null;
}

export interface NcaaHubCoachSpotlight {
  coachName: string;
  coachPortraitAssetName: string | null;
  teamName: string;
  overallWins: number;
  overallLosses: number;
  mediaRank: number | null;
  teamPrestige: number | null;
  reason: string;
}

export interface NcaaHubRecordWatchEntry {
  teamName: string;
  conferenceName: string | null;
  wins: number;
  losses: number;
  mediaRank: number | null;
  isUserTeam: boolean;
}

export interface NcaaHubConferenceLeader {
  conferenceName: string;
  teamName: string;
  conferenceWins: number;
  conferenceLosses: number;
  overallWins: number;
  overallLosses: number;
  mediaRank: number | null;
  isUserTeam: boolean;
}

export interface NcaaHubRecruitingClassEntry {
  rank: number;
  teamName: string;
  conferenceName: string | null;
  conferenceRank: number | null;
  isUserTeam: boolean;
}

export interface NcaaHubOverview {
  seasonYear: number;
  lastSyncedAt: string;
  /** The media poll, top 25 — the "AP" list in the UI's terms. */
  top25: NcaaHubTop25Entry[];
  /** The coaches poll, top 25, with its own movement (the save carries a real coaches LastWeeksRank). */
  coachesTop25: NcaaHubTop25Entry[];
  /**
   * The CFP poll, top 25 — empty until the committee's first release, which is
   * how the UI knows not to offer a CFP tab. Movement is always null here: the
   * save's CFP LastWeeksRank never differs from its current rank.
   */
  cfpTop25: NcaaHubTop25Entry[];
  heismanFeature: NcaaHubHeismanFeature | null;
  gameOfTheWeek: NcaaHubGameFeature | null;
  upsetOfTheWeek: NcaaHubGameFeature | null;
  upcomingWeek: number | null;
  upcomingGames: NcaaHubGameFeature[];
  coachSpotlight: NcaaHubCoachSpotlight | null;
  recruitingBuzz: NcaaHubRecruitingClassEntry[];
  undefeatedWatch: NcaaHubRecordWatchEntry[];
  oneLossWatch: NcaaHubRecordWatchEntry[];
  conferenceLeaders: NcaaHubConferenceLeader[];
}

export interface ExtractionResult {
  success: boolean;
  message: string;
}

export interface RosterPlayer {
  id: number;
  firstName: string;
  lastName: string;
  portraitAssetName: string | null;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  overallRating: number;
  /** Current NIL pay in $K (Player.CurrentNILCompensation). Absent on rosters synced before this shipped. */
  nilCompensation?: number;
  archetype: string;
  developmentTrait: string;
  heightInches: number;
  weightPounds: number;
  hometown: string;
  homeState: string;
  redshirtStatus: string;
  isCaptain: boolean;
}

export interface CareerCoachStats {
  wins: number;
  losses: number;
  winsAtCurrentSchool: number;
  lossesAtCurrentSchool: number;
  bowlWins: number;
  bowlLosses: number;
  confChampWins: number;
  confChampLosses: number;
  confChampWinStreak: number;
  ncWins: number;
  ncLosses: number;
  recentYearNCWon: number;
  playoffWins: number;
  playoffLosses: number;
  timesFired: number;
  rivalWins: number;
  rivalLosses: number;
  rivalWinStreak: number;
  top25Wins: number;
  top25Losses: number;
  draftPicks: number;
  firstRoundDraftPicks: number;
  top5RecruitClasses: number;
  playersMaxProgressed: number;
  numPrestigeIncreases: number;
}

/**
 * One AD goal slot as the save stores it. The goal's WORDING and its
 * coach-point reward are not in the save — the slot references a catalogue that
 * ships with the game (see extract-coaches.ts) — so this is status and progress
 * only.
 */
export interface ContractGoalSlot {
  goalId: number | null;
  status: string;
  progress: number;
  isHotSeat: boolean;
  jobSecurity: number;
}

export interface Coach {
  /**
   * The coach's stable per-entity id (Coach.PresentationId). Stable across school
   * moves and portrait/name edits, so it's the key for tracking the USER's coach
   * journey across teams and saves. NOT universally unique across all coaches
   * (some generated coordinators share 0), so it does NOT replace (teamIndex,
   * position) for editing — see docs/coach-movement-research.md.
   */
  presentationId: number;
  /** Current team, not the coach's alma mater — see extract-coaches.ts. Together with `position`, uniquely identifies a coach for editing. */
  teamIndex: number;
  firstName: string;
  lastName: string;
  portraitAssetName: string | null;
  position: string;
  /** True for exactly one staff member — the human-controlled coach, regardless of position (Head Coach, Offensive Coordinator, or Defensive Coordinator). See CoachOverview.userCoach. */
  isUserControlled: boolean;
  yearsCoaching: number;
  /** Resolved school name, or null when the save's raw value doesn't match any real team (see extract-coaches.ts). */
  almaMaterName: string | null;
  age: number;
  /** CoachTalentArcheType enum, e.g. "ProgramBuilder", "EliteRecruiter". */
  dominantArchetype: string;
  /** Save-native "years at current school" — may legitimately differ from the app's own imported-season count for this team. */
  seasonsWithTeam: number;
  /** JobSecurityStatus enum: "Safe" | "SafeForNow" | "Low" | "HotSeat" | "Invalid". */
  currentJobSecurityStatus: string;
  /**
   * The AD-expectations block (see extract-coaches.ts for what the save does and
   * does NOT carry). Null on any season synced before these were extracted.
   */
  currentJobSecurityPercentage: number | null;
  seasonStartJobSecurityStatus: string | null;
  /** The AD's headline expectation as an enum, e.g. "Win8Games". */
  currentContractExpectation: string | null;
  earnedContractPointsThisYear: number | null;
  coachPoints: number | null;
  /** The AD's goal slots — user coach only, null for everyone else and for seasons synced before this shipped. */
  contractGoals: ContractGoalSlot[] | null;
  /** Contract terms off the Coach record (same fields the coach editor writes). */
  contractSalary: number;
  contractLength: number;
  contractYearsRemaining: number;
  /** Personality enum, e.g. "Leader", "Intense", "Unpredictable". */
  personality: string;
  /** Save-native lifetime coaching record — see CareerCoachStats. Null when the save doesn't resolve a career record for this coach. */
  careerStats: CareerCoachStats | null;
}

export interface CoachOverview {
  /** The real Head Coach, whoever that is — not necessarily the user. Kept separate from userCoach so pages that specifically want "the actual head coach" (Dashboard, Rankings, Team Hub headlines) don't need to guess. */
  headCoach: Coach | null;
  /** The human-controlled coach — may be the Head Coach, or an Offensive/Defensive Coordinator. This is who Coach Hub's hero should center on. Null only if the save's IsUserControlled flag didn't resolve to anyone on this team (shouldn't happen in practice, but not force-assumed). */
  userCoach: Coach | null;
  /** Full staff for the team, head coach included, head-coach-first. */
  staff: Coach[];
}

export interface OffensiveStatLine {
  gamesPlayed: number;
  gamesStarted: number;
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTDs: number;
  passInts: number;
  passLongest: number;
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  rushLongest: number;
  /** Real field (RUSHFUMBLES) — fumbles committed on rushing plays. Not a "fumbles lost" count (no such field exists on this table) and doesn't cover receiving/passing-play fumbles, which aren't tracked separately anywhere in the save. */
  fumbles: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  receivingLongest: number;
  /** 0 for every player without real return duty — a genuine "not a designated returner" fact, not a placeholder. See extract-stats.ts. */
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTDs: number;
  kickReturnLongest: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTDs: number;
  puntReturnLongest: number;
}

export interface DefensiveStatLine {
  gamesPlayed: number;
  gamesStarted: number;
  tackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptions: number;
  interceptionReturnYards: number;
  interceptionTDs: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  passDeflections: number;
  /** 0 for every player without real return duty — a genuine "not a designated returner" fact, not a placeholder. See extract-stats.ts. */
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTDs: number;
  kickReturnLongest: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTDs: number;
  puntReturnLongest: number;
}

export interface PlayerStats {
  playerId: number;
  category: 'offense' | 'defense';
  career: OffensiveStatLine | DefensiveStatLine | null;
  season: OffensiveStatLine | DefensiveStatLine | null;
}

/** Kicking/punting — a genuinely separate stat category (own save table, CareerKickingStats/SeasonKickingStats), not merged into the offense/defense binary. See extract-kicking.ts. */
export interface KickingStatLine {
  gamesPlayed: number;
  gamesStarted: number;
  fgMade: number;
  fgAttempts: number;
  fgLongest: number;
  fgBlocked: number;
  xpMade: number;
  xpAttempts: number;
  xpBlocked: number;
  puntAttempts: number;
  puntYards: number;
  puntNetYards: number;
  puntLongest: number;
  puntIn20: number;
  puntTouchbacks: number;
  puntBlocked: number;
}

export interface PlayerKickingStats {
  playerId: number;
  career: KickingStatLine | null;
  season: KickingStatLine | null;
}

/** The user's own team's season box-score totals — see extract-team-stats.ts for what's real vs. derived (no POINTS field exists in the save; scoring comes from the schedule instead). */
export interface TeamStats {
  wins: number;
  losses: number;
  ties: number;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  totalYards: number;
  offPassYards: number;
  offRushYards: number;
  defPassYards: number;
  defRushYards: number;
  passAttempts: number;
  passCompletions: number;
  passTds: number;
  passInts: number;
  rushAttempts: number;
  rushTds: number;
  firstDowns: number;
  thirdDownConv: number;
  thirdDowns: number;
  fourthDownConv: number;
  fourthDowns: number;
  offRedZones: number;
  offRedZoneTds: number;
  offRedZoneFgs: number;
  defRedZones: number;
  defRedZoneTds: number;
  defRedZoneFgs: number;
  sacks: number;
  sacksAllowed: number;
  defInts: number;
  passDeflections: number;
  fumbleRec: number;
  fumblesLost: number;
  takeaways: number;
  giveaways: number;
  penalties: number;
  penaltyYards: number;
  possessionTime: number;
  punts: number;
  puntYards: number;
  kickReturnYards: number;
  puntReturnYards: number;
  twoPointConvAttempts: number;
  twoPointConvMade: number;
}

export type TeamAwardCategory =
  'major' | 'offense' | 'defense' | 'specialTeams' | 'position' | 'story';
export type TeamAwardCalculationMode = 'automaticWithConfirmation' | 'manual';
export type TeamAwardStatus =
  'notCalculated' | 'calculated' | 'confirmed' | 'finalized' | 'insufficientData';
export type TeamAwardSelectionMode = 'recommended' | 'manuallyChanged' | 'manual';

/** Static metadata for one of the 12 Team Awards — enough for the renderer to lay out every award's card (even disabled ones, with their reason) without needing the full scoring-model definition, which only the main process needs. */
export interface TeamAwardDefinitionSummary {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  category: TeamAwardCategory;
  calculationMode: TeamAwardCalculationMode;
  enabled: boolean;
  disabledReason?: string;
  /** Permanently removed from the active award package — see AwardDefinition.retired for the full distinction from `enabled`. */
  retired?: boolean;
  finalistCount: number;
}

export interface TeamAwardScoreComponent {
  key: string;
  label: string;
  rawValue: number | null;
  normalizedValue: number | null;
  weight: number;
  weightedScore: number;
}

export interface TeamAwardCandidateScore {
  playerId: number;
  rawScore: number;
  normalizedScore: number;
  positionPercentile: number | null;
  eligibilityPassed: boolean;
  eligibilityReasons: string[];
  components: TeamAwardScoreComponent[];
  missingInputs: string[];
}

/** One award's persisted result for one season — see schema_v5_team_awards.sql. Lives outside season_snapshots so a confirmed/finalized winner survives a re-sync untouched. */
export interface TeamAwardResult {
  awardDefinitionId: string;
  dynastyId: string;
  seasonId: number;
  recommendedWinnerId: number | null;
  selectedWinnerId: number | null;
  finalistIds: number[];
  candidateScores: TeamAwardCandidateScore[];
  explanation: string | null;
  missingInputs: string[];
  status: TeamAwardStatus;
  selectionMode: TeamAwardSelectionMode;
  calculationVersion: string;
  calculatedAt: string | null;
  confirmedAt: string | null;
  finalizedAt: string | null;
}

/** One row per dynasty (not per season) — coaching-philosophy preferences, not year-to-year state. */
export interface TeamAwardSettings {
  freshmanEligibility: 'trueOnly' | 'trueAndRedshirt';
  newcomerEligibility: 'transfersOnly' | 'allFirstYear';
  calculationTiming: 'postseasonOnly' | 'allowPreliminary';
  autoRecalculate: boolean;
  disabledAwardIds: string[];
}

/** One resolved, confirmed/finalized Team Award win, ready to render — player identity already joined server-side so the season-history view doesn't need a per-season roster fetch. */
export interface TeamAwardHistoryWin {
  awardDefinitionId: string;
  awardName: string;
  playerId: number;
  playerName: string;
  position: string;
  portraitAssetName: string | null;
}

/** Confirmed/finalized Team Awards winners for one full-data season — the "season history" view. `teamName` is that season's own real team (not the dynasty's current one), so history stays attached to whichever school it was actually won at. */
export interface TeamAwardHistorySeason {
  seasonId: number;
  seasonYear: number;
  teamName: string;
  wins: TeamAwardHistoryWin[];
}

export interface OffensiveGameLine {
  started: boolean;
  gameRating: number;
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTDs: number;
  passInts: number;
  passLongest: number;
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  rushLongest: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  receivingLongest: number;
}

export interface DefensiveGameLine {
  started: boolean;
  gameRating: number;
  tackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptions: number;
  interceptionReturnYards: number;
  interceptionTDs: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  passDeflections: number;
}

/**
 * What a game's two teams looked like around the time it was played — captured
 * at sync time, because the save only ever holds current values (see
 * schema_v11_game_context.sql). Absent for games that were already finished
 * before this tracking existed.
 */
export interface GameContext {
  homeMediaRank: number | null;
  homeCfpRank: number | null;
  homeRecord: { wins: number; losses: number } | null;
  awayMediaRank: number | null;
  awayCfpRank: number | null;
  awayRecord: { wins: number; losses: number } | null;
  /** SeasonInfo.CurrentWeek at capture — how close to kickoff this actually is. */
  capturedWeek: number | null;
  /** True once the game was seen played; the row never changes again. */
  locked: boolean;
  /** True when the game was already over when tracking began — "when we started watching", NOT "at kickoff". */
  approximate: boolean;
}

/** One league game for the national Scores page — from the leaguewide schedule snapshot; click-through opens the full Game Info modal. */
export interface LeagueScoreGame {
  gameId: number;
  week: number;
  weekType: string;
  homeTeamName: string;
  awayTeamName: string;
  /**
   * The save's own broadcast abbreviation (`Team.ShortName` — BAMA, ZONA, BC;
   * 5 characters at most), for surfaces too tight for a display name. Null when
   * the team didn't resolve in the season's teams snapshot; callers fall back
   * to the display name rather than abbreviating one themselves.
   */
  homeShortName: string | null;
  awayShortName: string | null;
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeScore: number | null;
  awayScore: number | null;
  bowlName: string | null;
  /** Stable bowl identity for logo matching; null outside the postseason. */
  bowlAssetName: string | null;
  /** Venue reference — identifies WHICH bowl a CFP quarterfinal or semifinal is. See shared/cfpBowls.ts. */
  neutralVenueId: string | null;
  isBowlGame: boolean;
  isNationalChampionship: boolean;
  homeConference: string | null;
  awayConference: string | null;
  /**
   * Media-poll rank, or null when unranked. This is the poll AS OF THE SYNC —
   * a save holds only the current poll, with no week-by-week history to join
   * against — so on a finished season it is the final poll, and mid-season it
   * is simply "who is ranked now". The scoreboard's Upsets filter says as much
   * rather than implying the number was live at kickoff.
   */
  homeRank: number | null;
  awayRank: number | null;
}

/**
 * The week whose non-user results this season's snapshot is deliberately
 * withholding (null = nothing held), recorded at sync time. See
 * shared/resultsHold.ts — the save pre-simulates the current week's other
 * games before the game itself reveals them.
 */
export interface ResultsHold {
  week: number | null;
}

/**
 * One program's full history — the payload behind the History page for ANY
 * school. Mirrors extract-team-history.ts's shapes; `allTime` and the record
 * books are real pre-loaded history that the dynasty writes into, while
 * `seasons` only covers years this dynasty has played.
 */
export interface TeamHistoryView {
  teamIndex: number;
  teamName: string;
  yearSchoolEstablished: number;
  yearProgramStarted: number;
  allTime: TeamAllTimeData | null;
  seasons: TeamHistorySeasonData[];
  careerRecords: TeamStatRecordData[];
  seasonRecords: TeamStatRecordData[];
}

/** The national Scores page payload — every league game, plus which week (if any) is being withheld. */
export interface LeagueScoresView {
  games: LeagueScoreGame[];
  /** Non-user results for this week (and later) are hidden until the user's own game is played. Null when nothing is held. */
  heldWeek: number | null;
}

export type PlayoffRound = 'first-round' | 'quarterfinal' | 'semifinal' | 'championship';

/** One side of a bracket game. Every field is nullable: a slot exists before its participants do. */
export interface PlayoffBracketSide {
  teamIndex: number | null;
  teamName: string | null;
  shortName: string | null;
  /** CFP seed 1-12. Null when the slot is empty or the poll never ranked them. */
  seed: number | null;
  wins: number | null;
  losses: number | null;
  /** Null until the game is genuinely played — see shared/gameStatus.ts. */
  score: number | null;
  isWinner: boolean;
  isUserTeam: boolean;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
}

export interface PlayoffBracketGame {
  /** Null for a slot the save hasn't created a game row for. */
  gameId: number | null;
  /** The save's own bracket position, 0-10. See GameData.playoffBracketSlot. */
  slot: number;
  round: PlayoffRound;
  week: number | null;
  played: boolean;
  /**
   * The bowl this game IS — "Rose Bowl" — for a quarterfinal or semifinal whose
   * venue is known. Null for the first round (played on campus), for the title
   * game (a neutral site that is nobody's bowl), and for a semifinal before the
   * quarterfinals resolve, which is when the save assigns its venue.
   */
  bowlName: string | null;
  /** Asset key for the same bowl, feeding the existing bowl logo/trophy lookups. */
  bowlAssetName: string | null;
  /** Raw venue reference; the renderer resolves it to a stadium name. */
  neutralVenueId: string | null;
  /** Where this game's winner goes. Null for the championship. */
  feedsIntoSlot: number | null;
  home: PlayoffBracketSide;
  away: PlayoffBracketSide;
}

export interface PlayoffBracketView {
  seasonYear: number;
  /** All eleven slots, always, ordered 0-10 — an empty slot is a slot, not an absence. */
  games: PlayoffBracketGame[];
  championTeamIndex: number | null;
  championName: string | null;
  /** The title game's venue, for the champion panel. */
  championshipVenueId: string | null;
  userTeamIndex: number | null;
  /**
   * False when the bracket positions were reconstructed from CFP seeds because
   * the season predates `playoffBracketSlot` being extracted. The bracket is
   * still correct; this exists so a caller can tell derived from authoritative.
   */
  slotsFromSave: boolean;
}

/** One side of a game, in neutral home/away terms — powers the universal Game Info modal for ANY league game. */
export interface GameDetailTeamSide {
  teamIndex: number;
  name: string;
  score: number;
  /** [Q1, Q2, Q3, Q4] — REGULATION ONLY; overtime is `overtimePoints`. */
  quarterScores: number[];
  /**
   * Points scored in overtime, TOTAL across every extra period. The save keeps
   * one number per side rather than a period-by-period split, so a double
   * overtime shows as one OT column, not OT1/OT2. Zero on a regulation game.
   */
  overtimePoints: number;
  /** null until the game is played. */
  stats: TeamStatLine | null;
  /** Media-poll rank AT KICKOFF where game_context captured one, falling back to the team's current rank. */
  currentRank: number | null;
  /**
   * W-L as it stood going into this game, from the same captured game_context
   * the schedule page uses. Null when the game predates context capture — the
   * save itself only ever exposes a team's CURRENT record, so there is no way
   * to reconstruct a point-in-time one after the fact.
   */
  recordAtGame: { wins: number; losses: number } | null;
  /** Team primary/secondary colors (hex) from the save, or null for placeholder/FCS teams. Drives per-side theming on the Game Info page. */
  primaryColor: string | null;
  secondaryColor: string | null;
  /** True when this side is the active dynasty's own team (drives user-perspective framing). */
  isUser: boolean;
}

/**
 * Everything the Game Info modal needs for ONE game, framed neutrally (home vs
 * away) so the SAME modal renders a user game and any non-user/CPU game. When
 * `hasUser` is true one side's `isUser` is set and the modal frames from that
 * side (vs/@ opponent, W/L). Built by getGameDetail from the leaguewide
 * schedule + teams + gamelog snapshots.
 */
export interface GameDetailData {
  gameId: number;
  week: number;
  played: boolean;
  /** Went to overtime — the box score adds an OT column and the score line says so. */
  isOvertime: boolean;
  status: string;
  dayOfWeek: string;
  kickoffTime: string;
  date: string;
  isBowlGame: boolean;
  isNationalChampionship: boolean;
  bowlName: string | null;
  bowlAssetName: string | null;
  isNeutralSite: boolean;
  gameType: 'conference' | 'non-conference' | 'bowl';
  /** This conference's championship game — see shared/championshipWeek.ts. */
  isConferenceChampionship: boolean;
  /** Stable venue reference for a game not at a home field — see lib/neutralVenues.ts. */
  neutralVenueId: string | null;
  conferenceName: string | null;
  home: GameDetailTeamSide;
  away: GameDetailTeamSide;
  hasUser: boolean;
  /** Both teams' player box-score lines for this game. */
  players: GameLogEntry[];
}

export interface GameLogEntry {
  playerId: number;
  gameId: number;
  category: 'offense' | 'defense';
  line: OffensiveGameLine | DefensiveGameLine;
  /** The player's team — powers the Game Info box-score team toggle. Absent on seasons synced before this shipped. */
  teamIndex?: number;
  // Self-contained identity (opponent players aren't in the user roster snapshot).
  // Optional so seasons synced before this shipped still type-check.
  firstName?: string;
  lastName?: string;
  position?: string;
  jerseyNumber?: number;
  schoolYear?: string;
  portraitAssetName?: string | null;
}

export interface TeamStatLine {
  totalYards: number;
  passYards: number;
  rushYards: number;
  firstDowns: number;
  thirdDownConversions: number;
  thirdDownAttempts: number;
  fourthDownConversions: number;
  fourthDownAttempts: number;
  turnovers: number;
  takeaways: number;
  sacks: number;
  sacksAllowed: number;
  penalties: number;
  penaltyYards: number;
  possessionTimeSeconds: number;
  punts: number;
  puntYards: number;
}

/**
 * One played-or-upcoming game for a single team, with that team's own per-game
 * stat line (`teamStats`) and the opponent's (`opponentStats`, i.e. the defense
 * / "X allowed" side). The raw input to the Statistics page's shared filter +
 * aggregation layer — summing `teamStats` across a filtered set reproduces the
 * season totals exactly (verified). Red-zone %, return yards, and completion %
 * are NOT here (season-only, see TeamStats) — they can't be filtered per-game.
 */
export interface TeamGameStat {
  gameId: number;
  week: number;
  opponent: string;
  gameType: 'conference' | 'non-conference' | 'bowl';
  siteType: 'home' | 'away' | 'neutral';
  isRivalry: boolean;
  played: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  teamStats: TeamStatLine | null;
  opponentStats: TeamStatLine | null;
}

/** One of a team's top players, for the Team modal's best-players rail. */
export interface TeamCardPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  overallRating: number;
  portraitAssetName: string | null;
}

/** The single bundled payload behind the global Team modal — see getTeamCard. */
export interface TeamCard {
  teamIndex: number;
  /** Record / rankings / recent + upcoming games — same SeasonOverview the Team Hub uses. */
  overview: SeasonOverview;
  topPlayers: TeamCardPlayer[];
  /** Per-game stat lines; the modal aggregates these into the stat strip via the shared teamStats lib. */
  games: TeamGameStat[];
  conferenceName: string | null;
  teamAssetName: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
}

/** One team's aggregated season line for the NCAA Hub national team-stat leaderboard. The UI derives per-game averages, ratios, and turnover margin from these totals. */
export interface NationalTeamStatRow {
  teamIndex: number;
  teamName: string;
  conferenceName: string | null;
  games: number;
  points: number;
  pointsAllowed: number;
  /** ALL-PURPOSE yards (offense + kick/punt returns) — the save's own TOTALYARDS. Never rank "offense" on this; see shared/teamYards.ts. */
  totalYards: number;
  /** Total offense (pass + rush) — what the game calls Total Offense, and what an offensive ranking means. */
  offenseYards: number;
  passYards: number;
  rushYards: number;
  /** Yards ALLOWED — the opponent's OFFENSE, not their all-purpose total. */
  defTotalYards: number;
  defPassYards: number;
  defRushYards: number;
  thirdDownConv: number;
  thirdDownAtt: number;
  turnovers: number;
  takeaways: number;
  sacks: number;
}

/** A national player-leaderboard entry — player identity + team + the stat line for whichever unit they played. */
export interface NationalLeaderEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  teamName: string;
  teamIndex: number;
  offense: OffensiveStatLine | null;
  defense: DefensiveStatLine | null;
}

/** Top-100-per-category national player leaderboards (see getNationalStatLeaders). */
export interface NationalStatLeaders {
  passing: NationalLeaderEntry[];
  rushing: NationalLeaderEntry[];
  receiving: NationalLeaderEntry[];
  defense: NationalLeaderEntry[];
}

export interface SeasonSummary {
  id: number;
  seasonYear: number;
  isCurrent: boolean;
  /** False for a lightweight, backfilled "history-only" season — league-wide champions/awards only, no roster/schedule/stats. */
  hasFullData: boolean;
  /** The school the user coached that season — for the season picker's label so a multi-school journey reads "2028 — SMU / 2029 — UCLA". Null for a history-only season. */
  teamName: string | null;
  /**
   * Whether this season has got as far as the postseason — gates the Playoff
   * tab, which shouldn't exist during a regular season that has no bracket yet.
   *
   * True once the save's week type leaves RegularSeason (see isBowlSlateSet),
   * and true for any season that is no longer the current one. That second
   * clause is deliberate: a superseded season's postseason either happened or
   * never will, and hiding a real archived bracket is a worse failure than
   * showing a tab that says a season has no playoff on record.
   */
  postseasonReached: boolean;
}

export type GameType = 'conference' | 'non-conference' | 'bowl';

export interface ScheduleGame {
  gameId: number;
  week: number;
  /** The user's own team's display name — for client-side stadium lookup on home games (see stadiumData.ts), mirrors `opponent`. */
  teamName: string;
  opponent: string;
  /** The opponent's league team index (null for a bye/TBD) — lets a team name open the Team modal. */
  opponentTeamIndex: number | null;
  isHome: boolean;
  status: string;
  dayOfWeek: string;
  /**
   * Renamed from "network" — the save never stores a real channel name (ESPN, FOX,
   * etc), only a broadcast-scope classification ("Streaming" / "National" / "TBD").
   */
  broadcastScope: string;
  kickoffTime: string;
  date: string;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'W' | 'L' | 'T' | null;
  /** The opponent's current poll rank, not their rank at the time this game was/will be played — no weekly poll history exists in the save. */
  opponentCurrentRank: number | null;
  /**
   * True when the rank/record above were CAPTURED around this game's kickoff
   * rather than read live. False means no capture exists (the game predates
   * context tracking), so they're today's values — the UI must not present
   * those as historical. See schema_v11_game_context.sql.
   */
  opponentContextCaptured: boolean;
  teamQuarterScores: number[];
  opponentQuarterScores: number[];
  /** null until played. */
  teamStats: TeamStatLine | null;
  opponentStats: TeamStatLine | null;
  gameType: GameType;
  /**
   * Set whenever the BowlGame reference resolved — this includes the national
   * championship game itself (its real Name is "National Championship", it's
   * just AssetName that's blank there) and the three CFP bracket-round
   * placeholder entries ("CFP First Round"/"CFP Quarterfinal"/"CFP
   * Semifinal"), not only traditional named bowls. Null for regular-season
   * games and the rare unresolvable/placeholder BowlGame row.
   */
  bowlName: string | null;
  /** Stable identity for bowl-logo lookup (see extract-schedule.ts); only meaningful alongside a real (non-CFP-placeholder) bowlName. */
  bowlAssetName: string | null;
  isNationalChampionship: boolean;
  /** Set only when gameType is 'conference' — the shared conference both teams belong to, for logo lookup. */
  conferenceName: string | null;
  /** True when the opponent is one of the user's team's real rivals (save-verified, e.g. Ohio State/Michigan). Independent of gameType — a rival can be in- or out-of-conference. */
  isRivalryGame: boolean;
  /** The save's own named rivalry ("I-35 Rivalry", etc.) when one resolved for this matchup; null if isRivalryGame but no named record was found. */
  rivalryName: string | null;
  /** This conference's championship game — the last regular-season week (see shared/championshipWeek.ts), between two teams from the same conference. */
  isConferenceChampionship: boolean;
  /** Venue name isn't available anywhere in the save (see extract-schedule.ts) — only this three-way classification; a real-world stadium/city is resolved client-side from stadiumData.ts where known. */
  siteType: 'home' | 'away' | 'neutral';
  /** The save's stable venue reference for a game NOT at a home field — resolved to a real stadium by lib/neutralVenues.ts. Null for a normal home/away game, and on seasons synced before this shipped. */
  neutralVenueId: string | null;
  /** The opponent's overall win-loss record — the save only ever exposes a team's CURRENT/final record, not a point-in-time snapshot from the week this game was actually played, so this is the same "final" caveat as opponentCurrentRank. Null if the opponent couldn't be resolved. */
  opponentRecord: { wins: number; losses: number } | null;
  /** The user's own overall/conference record after this game specifically — computed by accumulating games in week order up through this row, not copied from the season's final totals. Null for a game that hasn't been played yet (nothing to accumulate through). */
  runningRecord: {
    overallWins: number;
    overallLosses: number;
    conferenceWins: number;
    conferenceLosses: number;
  } | null;
}

export interface ScheduleOverview {
  games: ScheduleGame[];
  record: { wins: number; losses: number };
  conferenceRecord: { wins: number; losses: number };
  currentStreak: { type: 'W' | 'L' | null; count: number };
  bowlEligible: boolean;
}
export interface ConferenceStandingTeam {
  place: number;
  teamIndex: number;
  teamName: string;
  overallWins: number;
  overallLosses: number;
  conferenceWins: number;
  conferenceLosses: number;
  mediaPollRank: number | null;
  coachesPollRank: number | null;
  cfpRank: number | null;
  isUserTeam: boolean;
  isConferenceChampion: boolean;
  /** The team's division within the conference, or null when the conference isn't divided this season. */
  divisionName: string | null;
  /** Division win-loss (division games only); shown alongside the conference record in a divided conference. */
  divisionWins: number;
  divisionLosses: number;
  /** True for the team leading its division (the game's own division-standing #0). */
  isDivisionLeader: boolean;
}

/** One division's ordered teams within a divided conference — present only on divided conferences. */
export interface ConferenceDivisionGroup {
  name: string;
  teams: ConferenceStandingTeam[];
}

export interface ConferenceStandingsGroup {
  id: string;
  conferenceName: string | null;
  label: string;
  teams: ConferenceStandingTeam[];
  /** Non-null only when the conference has 2+ real named divisions — teams grouped and ordered by the game's own division standings. When set, the UI renders divisional sub-tables instead of the flat `teams` list. */
  divisions: ConferenceDivisionGroup[] | null;
  top25Count: number;
  nonConferenceWins: number;
  nonConferenceLosses: number;
  overallWins: number;
  overallLosses: number;
}

export interface StandingsOverview {
  teamName: string;
  userConferenceId: string | null;
  groups: ConferenceStandingsGroup[];
}

export type TrophyKind =
  'national-championship' | 'conference-championship' | 'bowl-win' | 'rivalry-win';

export interface Trophy {
  kind: TrophyKind;
  label: string;
  /** Renderer-side asset lookup key — conference name for conference-championship, bowl asset name for bowl-win, the trophy file stem for rivalry-win, null for national-championship (fixed asset). */
  assetKey: string | null;
  /** Distinguishes multiple trophies of the same kind — a season can carry several rivalry wins. */
  id?: string;
}

export type PostseasonKind = 'bowl' | 'cfp-round' | 'national-championship';

export interface BowlAppearance {
  /** Which asset family to resolve this appearance against — see trophyAssetMapping.ts's getPostseasonAppearanceImagePath. */
  kind: PostseasonKind;
  /** Display name — may be a rotating sponsor rebrand for a real bowl (see extract-schedule.ts), or the real "CFP First Round"/etc text for a playoff round. */
  bowlName: string;
  /** Stable identity for asset lookup; only meaningful when kind is 'bowl'. */
  bowlAssetName: string | null;
  opponent: string;
  result: 'W' | 'L' | 'T' | null;
}

export interface TeamTrophies {
  trophies: Trophy[];
  /** The season's bowl appearance (win or loss), if any — separate from the "bowl-win" trophy above, which only fires on a win. */
  bowlAppearance: BowlAppearance | null;
}

/** One of the ~22 leaguewide "single winner" season awards (Heisman shown separately — see heismanWinner/heismanFinalists), in the game's own real display order. `playerId` is null only for the two coach awards (BEST_HC/BEST_AC), which have no player to link to. */
export interface LeagueAward {
  awardType: string;
  playerId: number | null;
  winnerName: string;
  teamDisplayName: string;
  position: string;
  /** True when the winner plays/coaches for the active dynasty's own team. */
  isUserTeam: boolean;
  /** Real portrait, resolved leaguewide — null only for the two coach awards (no Player record). */
  portraitAssetName: string | null;
}

/** One Heisman race entry — the winner or a finalist (see AwardsOverview.heismanWinner/heismanFinalists for the split). */
export interface HeismanCandidate {
  rank: number;
  playerId: number;
  playerName: string;
  position: string;
  teamDisplayName: string;
  /** True when this candidate plays for the active dynasty's own team. */
  isUserTeam: boolean;
  /** Real portrait, resolved leaguewide. */
  portraitAssetName: string | null;
}

/** One weekly Player-of-the-Week style honor for a player on the user's own team, with that week's opponent resolved from the schedule. */
export interface WeeklyHonor {
  week: number;
  awardType: string;
  playerId: number;
  playerName: string;
  position: string;
  /** Null if no schedule game was found for that week (bye week, or a scheduling gap). */
  opponent: string | null;
  portraitAssetName: string | null;
}

/** One All-American/All-Conference selection, leaguewide — not scoped to the user's team, so the honors roster browser can show every conference's picks. Preseason (`_PRE`) variants are excluded entirely (a different, speculative thing from being actually named). */
export interface HonorRosterEntry {
  playerId: number;
  playerName: string;
  position: string;
  teamDisplayName: string;
  conferenceName: string | null;
  /** One of the 6 non-preseason `ALL_AM_*` variants — see awardFormat.ts's getHonorKind/getHonorTier. */
  awardType: string;
  /** True when this player plays for the active dynasty's own team. */
  isUserTeam: boolean;
  /** Real portrait, resolved leaguewide. */
  portraitAssetName: string | null;
}

export interface TeamHonorCounts {
  allAmericanFirst: number;
  allAmericanSecond: number;
  allAmericanFreshman: number;
  allConferenceFirst: number;
  allConferenceSecond: number;
  allConferenceFreshman: number;
}

/**
 * Preseason (watch-list) honor counts for the user's team. Preseason has only
 * 1st/2nd teams — no freshman preseason team exists in the save — so this is a
 * deliberately narrower shape than the postseason `TeamHonorCounts`.
 */
export interface PreseasonTeamHonorCounts {
  allAmericanFirst: number;
  allAmericanSecond: number;
  allConferenceFirst: number;
  allConferenceSecond: number;
}

export interface AwardsOverview {
  teamName: string;
  leagueAwards: LeagueAward[];
  heismanWinner: HeismanCandidate | null;
  heismanFinalists: HeismanCandidate[];
  teamHonorCounts: TeamHonorCounts;
  /** Full leaguewide All-American/All-Conference roster — the UI filters this client-side by kind/tier/conference rather than the server pre-splitting it. Postseason (earned) honors only. */
  honorsRoster: HonorRosterEntry[];
  /**
   * Leaguewide PRESEASON (`_PRE`) All-America/All-Conference watch list —
   * projected honors the game assigns at the start of a season (before any
   * games), kept separate from `honorsRoster` so a prediction is never shown
   * as an earned award. Only 1st/2nd-team variants exist (no freshman
   * preseason). Present as soon as a Week 0 sync is taken.
   */
  preseasonHonorsRoster: HonorRosterEntry[];
  /** Preseason (watch-list) honor counts for the user's team. */
  preseasonTeamHonorCounts: PreseasonTeamHonorCounts;
  /** The user's own team's weekly honors, chronological. */
  weeklyHonors: WeeklyHonor[];
  /** Distinct conference names across the league, alphabetical with the user's own conference moved to the front. */
  conferences: string[];
  userConferenceName: string | null;
}

/**
 * One recorded rank snapshot for the user's own team, tied to the week it was
 * captured. The save file itself only ever exposes 3 poll data points
 * (start-of-season / last-week / current) — never a full per-week history —
 * so this is built by this app accumulating one row per import as a season
 * progresses, not read whole from a single save. `0` means unranked, the
 * same convention used everywhere else in this app.
 */
export interface RankingWeek {
  week: number;
  mediaPollRank: number;
  coachesPollRank: number;
  cfpRank: number;
  wins: number;
  losses: number;
}

export interface RankingsOverview {
  teamName: string;
  /** Chronological by week; as sparse as one point on a dynasty's first-ever import, growing with each subsequent import. */
  history: RankingWeek[];
  /** Best (lowest-number) rank reached so far this season, per poll — null if the team has never been ranked. */
  highestMediaPollRank: number | null;
  highestCoachesPollRank: number | null;
  highestCfpRank: number | null;
  averageMediaPollRank: number | null;
  averageCoachesPollRank: number | null;
  averageCfpRank: number | null;
}

/**
 * Where a prospect sits on the user's own recruiting board — derived, not a
 * literal save field:
 * - `watching`: no offer from this team yet
 * - `offered`: this team has offered, recruit hasn't soft-committed yet
 * - `committed`: soft-committed to this team (real `committedWeekNumber`),
 *   not yet locked in on signing day
 * - `signed`: the prospect's overall stage is `'Signed'` AND they signed
 *   with *this* team
 * - `lost`: the prospect's overall stage is `'Signed'` but with a
 *   *different* team
 *
 * `signed` vs. `lost` is decided by comparing `signedTeamDisplayName`
 * against this team's own name — NOT by `committedWeekNumber`. An earlier
 * version used `committedWeekNumber > 0` as the signed/lost split and
 * shipped visibly wrong results: real recruits who did sign with the user's
 * team were showing as "Lost" because that field is only ever populated
 * during the pre-signing soft-commit phase, not retroactively once a
 * recruit reaches `'Signed'`.
 */
export type RecruitBoardStage = 'watching' | 'offered' | 'committed' | 'signed' | 'lost';

/** One prospect on the user's own recruiting board (up to 35 real slots — verified directly, not the full leaguewide recruit pool). */
/** League-wide browse (2026-07-20): every team's roster from the compressed per-season league snapshot. Bio shape matches RosterPlayer; seasonStat joined for stat-holders only. */
export interface LeagueTeamSummary {
  teamIndex: number;
  displayName: string;
  playerCount: number;
}

export interface LeagueRosterPlayer extends RosterPlayer {
  teamIndex: number;
  seasonStat: {
    playerId: number;
    category: 'offense' | 'defense';
    season: OffensiveStatLine | DefensiveStatLine | null;
  } | null;
}

/** A league player flattened for the national Players page — a LeagueRosterPlayer with its team name + conference joined on. */
export interface NationalPlayer extends LeagueRosterPlayer {
  teamDisplayName: string;
  conferenceName: string | null;
}

export interface LeagueTeamGame {
  gameId: number;
  week: number;
  weekType: string;
  /**
   * Read from the leaguewide `schedule` snapshot rather than the league one —
   * see getLeagueTeamSchedule. Null when the save's BowlGame reference didn't
   * resolve; never substitute the week bucket ("BowlSeason3"), which is not a
   * round name.
   */
  bowlName: string | null;
  /** Stable bowl identity for logo matching; blank for CFP bracket placeholders. */
  bowlAssetName: string | null;
  isNationalChampionship: boolean;
  /** This conference's championship game — see shared/championshipWeek.ts. */
  isConferenceChampionship: boolean;
  isHome: boolean;
  opponent: string;
  /** The opponent's league team index — opens the Team modal. */
  opponentTeamIndex: number;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'W' | 'L' | 'T' | null;
  /** Same classification the user's own schedule uses — bowl/playoff, or conference vs non-conference by comparing both teams' conference membership (from the teams snapshot). */
  gameType: 'conference' | 'non-conference' | 'bowl';
  /** The opponent's poll rank captured around kickoff, not their rank today. Null when this game predates context tracking. See schema_v11_game_context.sql. */
  opponentRank: number | null;
  /** The opponent's record as it stood around kickoff. Null when uncaptured. */
  opponentRecord: { wins: number; losses: number } | null;
  /** The conference name when gameType is 'conference' (for an in-conference badge); null otherwise. */
  conferenceName: string | null;
}

export interface LeagueTeamRoster {
  teamIndex: number;
  displayName: string;
  seasonId: number;
  players: LeagueRosterPlayer[];
}

/** One school pursuing a recruit (from the recruit's top-schools list), with its 0-99 influence — the recruiting battle. */
/** One former staffer in the coaching tree — someone who was on your staff and is now elsewhere. */
export interface CoachingTreeEntry {
  presentationId: number;
  name: string;
  portraitAssetName: string | null;
  /** The role(s) they held under you (HeadCoach/OffensiveCoordinator/DefensiveCoordinator). */
  positionsUnderYou: string[];
  firstYearWithYou: number;
  lastYearWithYou: number;
  nowTeamIndex: number | null;
  nowTeamName: string | null;
  nowPosition: string | null;
  nowSeasonYear: number | null;
  /** They're now a head coach somewhere — the prestige branch. */
  isHeadCoachNow: boolean;
  /**
   * Their team's record in the most recent synced season — how the job is going
   * right now. Head coaches only, and OBSERVED from that team's own season
   * record rather than read off the coach: `Coach.careerStats` is not usable for
   * anyone but the user's own coach (see getCoachingTree for the measurement).
   */
  currentRecord: { wins: number; losses: number } | null;
  /** Accumulated across every synced season they've been a head coach, anywhere. */
  headCoachRecord: { wins: number; losses: number } | null;
  /**
   * Every stop AFTER they left your staff, oldest first — a coach who moves from
   * his first job to a second belongs on your tree twice, because his journey is
   * a piece of yours. Empty for someone still at their first destination in the
   * season they arrived.
   */
  journey: CoachingTreeStop[];
}

/** One contiguous run at one school in one role. */
export interface CoachingTreeStop {
  teamIndex: number;
  teamName: string | null;
  position: string;
  firstYear: number;
  lastYear: number;
  isHeadCoach: boolean;
  /** Their team's accumulated record over this stop. HEAD COACHES ONLY — null otherwise. */
  record: { wins: number; losses: number } | null;
  /** Postseason wins during this stop. Head coaches only. */
  trophies: { seasonYear: number; label: string; kind: 'national' | 'bowl' }[];
}

/** "Where your people went" — the program's coaching tree (getCoachingTree). */
export interface CoachingTree {
  rootCoachName: string | null;
  rootTeamName: string | null;
  /** Former staffers who moved on, head-coach promotions first. */
  entries: CoachingTreeEntry[];
  coachesProduced: number;
  headCoachesProduced: number;
}

/** One game in a head-to-head series (getHeadToHead), from the user's perspective. */
export interface HeadToHeadGame {
  seasonYear: number;
  week: number;
  isHome: boolean;
  neutral: boolean;
  result: 'W' | 'L' | 'T';
  teamScore: number;
  opponentScore: number;
  /** Set for a postseason/bowl meeting. */
  bowlName: string | null;
}

/** The program's all-time series vs one opponent across synced seasons (getHeadToHead). */
export interface HeadToHeadOpponent {
  opponentTeamIndex: number | null;
  opponentName: string;
  /** The opponent is one of the program's save-designated rivals. */
  isRival: boolean;
  rivalryName: string | null;
  wins: number;
  losses: number;
  ties: number;
  /** Average scoring margin from the user's perspective (positive = outscoring them). */
  avgMargin: number;
  streakType: 'W' | 'L' | 'T' | null;
  streakCount: number;
  /** Every played meeting, newest first. */
  games: HeadToHeadGame[];
}

/** One season in a player's rating arc (getPlayerDevelopment) — for the OVR-over-seasons chart. */
/**
 * One synced season of a player's production, with the school he played it for.
 *
 * Leaguewide, so a transfer's years at previous schools are included — see
 * getPlayerStatHistory for why that can't come from the user's own snapshots.
 */
export interface PlayerStatSeason {
  seasonYear: number;
  teamIndex: number;
  teamName: string;
  /** Whether this season was played for the dynasty's own program that year. */
  isUserTeam: boolean;
  schoolYear: string | null;
  position: string | null;
  category: 'offense' | 'defense';
  line: OffensiveStatLine | DefensiveStatLine;
}

export interface PlayerDevelopmentSeason {
  seasonYear: number;
  overallRating: number;
  position: string;
  /** Freshman / Sophomore / … that season — shows class progression alongside OVR. */
  schoolYear: string;
  teamName: string | null;
}

/** One player hit in the global search. `id` opens a profile; `teamIndex` themes it. */
export interface GlobalSearchPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  /** Null for a recruit — a prospect has no program yet, and the placeholder bucket's name is not one. */
  teamName: string | null;
  teamIndex: number;
  overallRating: number;
  portraitAssetName: string | null;
  /**
   * True when this id belongs to the season's recruit pool. Recruits share the
   * league roster this searches, so without this they appear as ordinary
   * players: the row must label them "Recruit", withhold the rating until it is
   * revealed, and open the recruit view rather than the player workspace.
   */
  isRecruit: boolean;
}

/** One coach hit — clicking jumps to their team's card (no standalone coach modal). */
export interface GlobalSearchCoach {
  firstName: string;
  lastName: string;
  position: string;
  teamName: string | null;
  teamIndex: number;
  portraitAssetName: string | null;
}

/** One team hit — opens the team modal. */
export interface GlobalSearchTeam {
  teamIndex: number;
  displayName: string;
  conferenceName: string | null;
}

/** Grouped results for the one-box global search (players / coaches / teams). */
export interface GlobalSearchResults {
  players: GlobalSearchPlayer[];
  coaches: GlobalSearchCoach[];
  teams: GlobalSearchTeam[];
}

export interface NationalRecruitSchool {
  teamIndex: number;
  teamName: string;
  influence: number;
}

/** A prospect from the league-wide recruit pool (the national Recruits browser). Renderer-facing mirror of extract-national-recruits.ts's NationalRecruitData. */
export interface NationalRecruit {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  archetype: string;
  stars: number;
  overallRating: number;
  developmentTrait: string;
  heightInches: number;
  weightPounds: number;
  hometown: string;
  homeState: string;
  pipeline: string;
  portraitAssetName: string | null;
  classYear: string;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
  recruitStage: string;
  gemBust: string;
  commitScore: number;
  totalOffers: number;
  dealbreaker: string;
  idealPitch: string;
  baseNilValue: number;
  athletic: {
    speed: number;
    acceleration: number;
    agility: number;
    strength: number;
    awareness: number;
    jumping: number;
  };
  topSchools: NationalRecruitSchool[];
  /** True if this prospect is on the user's own recruiting board (merged from the board snapshot in getNationalRecruits). */
  onUserBoard: boolean;
}

/** A viewed (any) team's championship honors for one season, from the leaguewide YearSummary snapshot — so Team Hub can show the same trophies the user's own team gets. */
export interface LeagueTeamHonors {
  conferenceChampion: boolean;
  /** The conference the team won, for the trophy asset lookup; null when not a conference champion. */
  conferenceName: string | null;
  nationalChampion: boolean;
}

/** One media-gallery item (schema v6) — user-uploaded image/video with optional game + player links. Metadata only; the file lives under <userData>/media/<dynastyId>/. */
/**
 * A season the user typed in from their own records (schema v19) — the only
 * human-sourced numbers in the app.
 *
 * EVERY VALUE IS NULLABLE and null means UNKNOWN, never zero. A user who can't
 * remember their 2031 conference record leaves it blank, and the timeline shows
 * a dash rather than inventing 0-0.
 *
 * These never enter a computed total. See database/manualSeasons.ts for why
 * they live in their own table rather than as a flag on a season.
 */
export interface ManualSeason {
  seasonYear: number;
  teamName: string | null;
  wins: number | null;
  losses: number | null;
  conferenceWins: number | null;
  conferenceLosses: number | null;
  /** Free text — handwritten notes are least consistent here, so nothing is forced into a taxonomy. */
  bowlName: string | null;
  bowlResult: 'W' | 'L' | null;
  conferenceChampion: boolean;
  nationalChampion: boolean;
  playoffAppearance: boolean;
  finalRank: number | null;
  headCoachName: string | null;
  note: string | null;
}

/** Whether a dynasty has seasons the app never saw, and which years those are. */
export interface ManualSeasonGap {
  earliestSyncedYear: number | null;
  latestSyncedYear: number | null;
  syncedYearCount: number;
  /** The user coach's own `yearsCoaching` — the dynasty's true age, from the save. */
  coachSeasonCount: number;
  /**
   * Seasons the SAVE's own history already covers (Team.TeamSeriesHistory),
   * with their values. Shown in the editor PREFILLED and LOCKED — visible so it
   * is clear they are handled, filled so the lock reads as "already known"
   * rather than as data you are forbidden to supply, and uneditable so nobody
   * retypes or contradicts what the game states.
   */
  gameKnownSeasons: {
    year: number;
    teamName: string;
    wins: number;
    losses: number;
    conferenceWins: number;
    conferenceLosses: number;
  }[];
  /** Years before the first sync that are neither synced, game-known, nor already filled in. */
  missingYears: number[];
  manualYearCount: number;
  /** The backfill offer has already been made for this dynasty; never ask again. */
  promptSeen: boolean;
}

/** A freeform user note scoped to one player within a dynasty (schema v7). Timestamps are ISO strings. */
export interface PlayerNote {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** The pan/zoom framing of a custom card photo, in the card's own pixel space. */
export interface CardPhotoTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Where a card's stat line came from (schema v13). The numbers themselves are
 * frozen in `stats`; this is the provenance, and it exists so the editor can
 * reopen on the right list — and so a card can celebrate ONE GAME rather than
 * only a season total.
 *
 * `key` is the stable identity the picker matches on: `'season'`, or
 * `'game:<gameId>'` for a single Saturday.
 */
export interface CardStatSource {
  key: string;
  kind: 'season' | 'game';
  /** How it reads to a human — "2027 Season", "Wk 5 · vs Georgia". */
  label: string;
}

/**
 * A stat source WITH its numbers — what the card editor picks from. Built by
 * whatever page is showing the player (it owns the season totals and the game
 * log); only the `CardStatSource` half is ever stored.
 */
export interface CardStatSourceOption extends CardStatSource {
  /** The season these numbers belong to, so a year-locked card can refuse a mismatched line. */
  seasonYear: number | null;
  tiles: { label: string; value: string }[];
}

/**
 * A saved player trading card (schema v12, extended in v13). The display fields
 * are FROZEN at the moment the card was last edited — see
 * schema_v12_player_cards.sql for why the book cannot re-derive them.
 * `photoFile` is a basename inside card-photos/<dynastyId>/; `photoPath` is that
 * resolved to an absolute path by the main process, and is null when the file
 * has gone missing.
 */
export interface PlayerCardRecord {
  id: number;
  playerId: number;
  seasonYear: number | null;
  teamName: string | null;
  /** Everything PlayerCard needs to draw the player, as they were on this card. */
  player: RosterPlayer;
  stats: { label: string; value: string }[];
  /** Which of this card's layers are drawn, wherever it is drawn. */
  layers: CardLayers;
  /** Where `stats` came from; null on cards made before v13 (a season line by construction). */
  statSource: CardStatSource | null;
  photoFile: string | null;
  photoPath: string | null;
  photoTransform: CardPhotoTransform;
  /** The bottom fade. Never null to a caller — a card that predates the setting reads back DEFAULT_CARD_SCRIM. */
  scrim: CardScrim;
  favorite: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Which of a card's layers are drawn. Every one defaults to ON, so a card that
 * has never been near the toggles looks exactly as it always did.
 *
 * Since v13 this is a property of the CARD, not of the export dialog: turning
 * the stat row off makes a photo-and-name card that stays that way in the book,
 * in the hover preview and in the PNG. The export dialog still edits the same
 * shape, and what it saves is the card's own setting.
 *
 * The DynastyOS mark and the photo are deliberately NOT in here: the mark is the
 * card's maker's mark, and a card with the photo off is a blank rectangle.
 */
export interface CardLayers {
  ovr: boolean;
  name: boolean;
  /** "vs. NC State" — only ever drawn when the card's stats came from one game. */
  opponent: boolean;
  /** Position · School · Class · Year. */
  profile: boolean;
  stats: boolean;
  teamLogo: boolean;
}

/**
 * The dark gradient a card draws up from its bottom edge, so the name and the
 * profile line stay legible over whatever is behind them.
 *
 * `height` is a FRACTION OF THE CARD'S HEIGHT measured up from the bottom, not a
 * gradient start position, because that is the thing being set: how much of my
 * card is this covering. 0.30 means the fade occupies the bottom 30% and the top
 * 70% of the photograph is untouched.
 */
export interface CardScrim {
  enabled: boolean;
  height: number;
}

/**
 * Enough to sit just above the team mark in the bottom-left corner and no
 * further (user direction 2026-08-03).
 *
 * It used to be 0.58 — transparent at 42% of the card and solid by 74% — which
 * is fine over a generated portrait (a head on a flat background, nothing in the
 * lower half worth seeing) and wrong over a photograph. Someone framing their
 * own shot was composing against a fade that ate more than half the card, so the
 * moment they were trying to place either sat in the dark or had to be dragged
 * up out of frame to escape it.
 */
export const DEFAULT_CARD_SCRIM: CardScrim = { enabled: true, height: 0.58 };

/** The narrowest and widest the slider will go. Below the floor the profile line
 *  loses its backing entirely; above the ceiling the fade is back to eating the
 *  card, which is the thing this exists to stop. */
export const CARD_SCRIM_MIN = 0.12;
export const CARD_SCRIM_MAX = 0.6;

export const ALL_CARD_LAYERS: CardLayers = {
  ovr: true,
  opponent: true,
  name: true,
  profile: true,
  stats: true,
  teamLogo: true,
};

/**
 * The writable half of a card — everything a save/create call sets.
 *
 * `seasonYear`, `teamName` and `player` are written at CREATE and then left
 * alone: a card is a printed moment, so the year and the profile line it went to
 * press with are the year and profile line it keeps (user direction, 2026-07-30).
 * The editor passes the card's own values straight back on every update, which
 * is what makes editing a 2026 card while the app is showing 2028 safe.
 */
export interface PlayerCardInput {
  seasonYear: number | null;
  teamName: string | null;
  player: RosterPlayer;
  stats: { label: string; value: string }[];
  layers: CardLayers;
  statSource: CardStatSource | null;
  photoFile: string | null;
  photoTransform: CardPhotoTransform;
  /** The bottom fade — see CardScrim. */
  scrim: CardScrim;
}

/**
 * A saved crop of a media photo (schema v14) — how the user wants that shot
 * shown, without anything being done to the file.
 *
 * `x` and `y` are FRACTIONS of the photo's own displayed size, not pixels,
 * because the same framing is drawn at wildly different sizes (a full-screen
 * viewer, a grid thumbnail, a laptop, a 4K monitor) and pixels would mean
 * something different in each. As fractions the pan limit is also a pure number:
 * at scale `s` the photo overhangs its box by `(s-1)/2` each way, so both
 * offsets are bounded to exactly that with nothing to measure.
 *
 * `null` anywhere this appears means "no saved framing" — show the whole photo.
 */
export interface MediaFraming {
  x: number;
  y: number;
  scale: number;
}

/** One uploaded art file: the stored basename, plus the absolute path the main process resolves it to (null when the file has gone missing). */
export interface ProgramArtFile {
  file: string;
  path: string | null;
}

/** The four pieces of team art a user can supply. Null = use the shipped default. */
export interface ProgramArtSet {
  logo: ProgramArtFile | null;
  helmet: ProgramArtFile | null;
  jersey: ProgramArtFile | null;
  polo: ProgramArtFile | null;
}

export type ProgramArtSlot = 'logo' | 'helmet' | 'jersey' | 'polo';

/**
 * A user-chosen name for one media folder (schema v21). `gameId` null is the
 * "not from a game" pile. A name only — it never decides which photos are in
 * the folder; that stays the game each photo is tagged to.
 */
export interface MediaAlbum {
  gameId: number | null;
  /** Empty when the folder keeps the game's own name and only a cover was chosen. */
  name: string;
  /** The photo this folder shows. Null = whichever is first in it. */
  coverMediaId: number | null;
}

/** One of EA's own rival slots for a program — read-only; see getSaveRivals. */
export interface SaveRival {
  opponentTeamIndex: number;
  opponentName: string;
  /** The save's name for the matchup ("I-35 Rivalry"), or null when the slot is a rival with no named record. */
  rivalryName: string | null;
}

/**
 * A rivalry the user declared themselves (schema v20).
 *
 * Symmetric and pair-keyed: this is the same row whichever of the two teams you
 * are looking at, which is why it carries both sides' names rather than an
 * owner and an opponent. Purely app-facing — nothing here is written to the
 * save, and EA's own rival slots are read-only beside it.
 */
export interface CustomRival {
  id: number;
  teamIndex: number;
  teamName: string;
  teamNameKey: string;
  opponentTeamIndex: number;
  opponentName: string;
  opponentNameKey: string;
  /** The two normalised names, sorted and joined — see lib/rivalryAssetMapping.rivalryPairKey. */
  pairKey: string;
  rivalryName: string;
  /** The uploaded logo: basename plus its absolute path once the IPC layer has resolved it. Null = the generic shield. */
  logo: ProgramArtFile | null;
  updatedAt: string;
}

/** What the editor sends when creating or renaming a rivalry. */
export interface CustomRivalInput {
  teamIndex: number;
  teamName: string;
  teamNameKey: string;
  opponentTeamIndex: number;
  opponentName: string;
  opponentNameKey: string;
  pairKey: string;
  rivalryName: string;
}

/** Stadium name and city, as the user wants them shown. */
export interface ProgramOverrideIdentity {
  stadiumName: string | null;
  stadiumCity: string | null;
}

/**
 * A program's user-supplied identity and artwork (schema v15), scoped to one
 * dynasty and keyed by the save's own team slot.
 *
 * Exists because Teambuilder imports overwrite a real school's slot with a team
 * the shipped asset library has never heard of — see
 * schema_v15_program_overrides.sql for the measured evidence and for why this is
 * keyed by `teamIndex` rather than by name.
 */
export interface ProgramOverride {
  teamIndex: number;
  /** canonicalKey() of the display name — how the renderer finds this row from a component that only knows a name. */
  teamNameKey: string;
  stadiumName: string | null;
  stadiumCity: string | null;
  art: ProgramArtSet;
  updatedAt: string;
}

export interface MediaItem {
  id: number;
  seasonId: number;
  fileName: string;
  mediaType: 'image' | 'video';
  /** The user's saved crop, or null for the whole photo. Never alters the file on disk. */
  framing: MediaFraming | null;
  /** Colour treatment, vignette and which plate marks are printed. Null = untouched (see shared/mediaLook.ts). */
  look: Partial<MediaLook> | null;
  /** Save-native SeasonGame gameId — same id ScheduleGame and the /schedule/:gameId route use. Null = not linked to a game. */
  gameId: number | null;
  /** A user-made album (schema v22). Mutually exclusive with `gameId` — a photo is filed in exactly one place. */
  albumId: number | null;
  description: string;
  /** Tagged players, as the same opaque roster player ids used app-wide; names resolve from that season's roster snapshot. */
  playerIds: number[];
  createdAt: string;
}

/** MediaItem plus the absolute on-disk path, resolved by the media IPC layer so the renderer can build a file:// URL. */
export interface MediaItemWithPath extends MediaItem {
  absolutePath: string;
}

export interface MediaItemPatch {
  gameId: number | null;
  /** Ignored unless `gameId` is null — the two are alternatives, not a pair. */
  albumId?: number | null;
  description: string;
  playerIds: number[];
}

/** An album the user created (schema v22) — its own folder, filled by hand. */
export interface CustomAlbum {
  id: number;
  name: string;
  /** The photo the folder shows. Null = whichever is first in it. */
  coverMediaId: number | null;
}

/** A tagged player's display info, resolved from the item's own season's roster snapshot. */
export interface MediaTaggedPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  portraitAssetName: string | null;
}

/** MediaItemWithPath plus display metadata resolved server-side against the item's OWN season (game label, tagged players) — for the read-only galleries on player bios and game pages, which span or sit outside the Media page's selected season. */
export interface MediaItemResolved extends MediaItemWithPath {
  gameLabel: string | null;
  taggedPlayers: MediaTaggedPlayer[];
}

/** One season's row in the Dynasty Trends dashboard — assembled server-side from that season's snapshots + ranking_history. */
/**
 * ── Season Lab ──────────────────────────────────────────────────────────────
 * One season, explained. Everything below is either read straight from the
 * save's snapshots or derived by arithmetic over them — see
 * docs/planning/ANALYTICS_PHASE0_AUDIT.md for the field-by-field provenance.
 * Nullable throughout on purpose: a preseason season legitimately has no
 * per-game anything, and that has to survive into the UI rather than being
 * flattened to zero.
 */
export interface SeasonGamePoint {
  gameId: number;
  week: number;
  opponent: string;
  opponentTeamIndex: number | null;
  siteType: 'home' | 'away' | 'neutral';
  gameType: 'conference' | 'non-conference' | 'bowl';
  isRivalry: boolean;
  teamScore: number;
  opponentScore: number;
  /** teamScore − opponentScore. */
  margin: number;
  result: 'W' | 'L' | 'T';
  /** Regulation only, 4 entries. Null when the snapshot carries no quarter data. */
  quarterDifferential: number[] | null;
  /**
   * True when the quarter scores don't reconcile with the final score. Verified
   * across 944 league games: every such game was tied after regulation, i.e. it
   * went to overtime, and OT points appear only in the final score.
   */
  wentToOvertime: boolean;
}

export interface SeasonIdentityMetric {
  key: string;
  label: string;
  value: number;
  format: 'perGame' | 'percent' | 'plusMinus';
  /** Defence, yards allowed and penalties are better when lower. */
  lowerIsBetter: boolean;
  /** Null when a league-wide comparison isn't supportable for this metric. */
  nationalPercentile: number | null;
  nationalRank: number | null;
  /** How many teams the percentile was computed across — never imply the basis. */
  comparedTeams: number | null;
}

/** Deterministic and descriptive. Never causal — no "because". */
export interface SeasonFinding {
  id: string;
  label: string;
  statement: string;
  /** The numbers behind the sentence, so the UI can show its working. */
  support: { label: string; value: string }[];
  sampleSize: number;
}

export interface SeasonAnalytics {
  seasonId: number;
  seasonYear: number;
  teamName: string;
  /**
   * Four genuinely different situations, all of which occur in real archives:
   *  • `history-only` — backfilled from league history; standings and champions
   *    only, no roster/schedule/stats will ever exist for it.
   *  • `preseason`  — a real season with no schedule snapshot yet.
   *  • `partial`    — scheduled, some games played.
   *  • `complete`   — every scheduled game played.
   * Never inferred from has_full_data, which reads 1 even for a 0-game season.
   */
  state: 'history-only' | 'preseason' | 'partial' | 'complete';
  gamesPlayed: number;
  gamesScheduled: number;
  summary: {
    wins: number;
    losses: number;
    ties: number;
    pointsPerGame: number | null;
    pointsAllowedPerGame: number | null;
    scoringMarginPerGame: number | null;
    turnoverMarginPerGame: number | null;
  };
  journey: SeasonGamePoint[];
  identity: SeasonIdentityMetric[];
  findings: SeasonFinding[];
  /** True when any played game reached overtime, so Quarter Pulse can say so. */
  hasOvertimeGames: boolean;
}

/**
 * ── Program Arc ─────────────────────────────────────────────────────────────
 * The Yearly view's counterpart to Season Lab: the same season read across
 * every year on record. Every module here is assembled from snapshots the app
 * ALREADY archives (`teams`, `schedule`), so it fills in retroactively for
 * seasons synced long before it existed — no re-sync, no extractor change.
 *
 * Every value carries its national rank because a raw number can't be judged:
 * a 39% third-down rate is meaningless until you know it was 65th of 139.
 */
export interface ProgramArcRanked {
  value: number;
  /** 1-based, best first. Null when the season has no comparable population. */
  nationalRank: number | null;
  /** Percent of teams beaten, so a dot's position is readable without a legend. */
  nationalPercentile: number | null;
  /** How many teams the rank was measured against — never imply the basis. */
  comparedTeams: number | null;
}

/** One position group's grade for one season (the game's own 0-99 Team Ratings numbers). */
export interface ProgramUnitSeason extends ProgramArcRanked {
  seasonId: number;
  seasonYear: number;
}

export interface ProgramUnitRow {
  key: string;
  label: string;
  /** True for the offense/defense/overall rollups, which read as a summary rather than a unit. */
  isSummary: boolean;
  seasons: ProgramUnitSeason[];
}

export interface ProgramEfficiencySeason extends ProgramArcRanked {
  seasonId: number;
  seasonYear: number;
}

export interface ProgramEfficiencyRow {
  key: string;
  label: string;
  format: 'perGame' | 'percent' | 'plusMinus';
  lowerIsBetter: boolean;
  seasons: ProgramEfficiencySeason[];
}

export interface ProgramPrestigeSeason extends ProgramArcRanked {
  seasonId: number;
  seasonYear: number;
  /** Rank within the team's own conference that season. */
  conferenceRank: number | null;
  conferenceName: string | null;
  /** Change against the previous season on record; null for the first one. */
  changeFromPrevious: number | null;
}

export interface ProgramArc {
  teamName: string;
  /** The game's own prestige scale, so the UI never hardcodes it. */
  prestigeMax: number;
  prestige: ProgramPrestigeSeason[];
  units: ProgramUnitRow[];
  efficiency: ProgramEfficiencyRow[];
  /**
   * Seasons that contributed, in year order — including which are still in
   * progress, so a mid-sync year is marked rather than plotted as a collapse.
   */
  seasons: { seasonId: number; seasonYear: number; gamesPlayed: number; complete: boolean }[];
}

export interface DynastyTrendSeason {
  seasonId: number;
  seasonYear: number;
  hasFullData: boolean;
  wins: number | null;
  losses: number | null;
  /** Summed from the season's schedule results (null if no games played / no schedule). */
  pointsFor: number | null;
  pointsAgainst: number | null;
  recruitingClassRank: number | null;
  /** Final poll ranks for the season (last recorded week, else the season-overview current rank). */
  finalMediaRank: number | null;
  finalCoachesRank: number | null;
  finalCfpRank: number | null;
  /** Week-by-week poll ranks accumulated across syncs (ranking_history) — the only real weekly trend the save can't provide on its own. */
  rankingWeeks: {
    week: number;
    mediaRank: number | null;
    coachesRank: number | null;
    cfpRank: number | null;
  }[];
}

export interface DynastyTrends {
  teamName: string;
  /** Oldest → newest. */
  seasons: DynastyTrendSeason[];
}

/** One school-to-school move detected by diffing consecutive league-roster snapshots (same PresentationId, different team). */
export interface TransferEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  portraitAssetName: string | null;
  fromTeam: string;
  toTeam: string;
  /** The season the player shows up on their new team. */
  seasonYear: number;
  toSeasonId: number;
  /**
   * The season he was on the OLD team — the year he left.
   *
   * Both ends are recorded because a transfer belongs to a different season
   * depending on which side you're looking from, and the page shows both. An
   * arrival is news in the season he turns up; a departure is news in the
   * season he left, which is the season BEFORE. Keying everything to the
   * arrival year put "transferred out" a season ahead of the departures list
   * beside it, and broke the join that annotates a leaver with his reason.
   */
  fromSeasonYear: number;
  fromSeasonId: number;
  /** The player's team index in the destination season — lets the bio modal resolve the full league profile. */
  toTeamIndex: number;
}

export interface TeamTransfers {
  teamName: string;
  transfersIn: TransferEntry[];
  transfersOut: TransferEntry[];
  /** Consecutive season pairs available to diff. 0 = need a second synced season before anything can show. */
  seasonPairsAvailable: number;
}

/** A player who left the program this offseason — from the game's LeavingPlayer table (see getDepartures / extract-departures). */

/** A player as they were when enshrined — what the card renders when the save no longer holds them. */
export interface LegendPlayerSnapshot {
  name: string;
  position: string;
  jerseyNumber?: number;
  schoolName?: string | null;
  teamIndex?: number | null;
  peakOverall?: number;
  portraitAssetName?: string | null;
  firstSeasonYear?: number;
  lastSeasonYear?: number;
}

/** One player in a coach's Hall. Tier and slot are null while they sit in the pool unassigned. */
export interface LegendEntry {
  playerId: number;
  addedAt: string;
  addedFromSeasonId: number | null;
  addedFromTeamIndex: number | null;
  tier: 'first' | 'second' | null;
  slotId: string | null;
  assignedAt: string | null;
  inductionNote: string | null;
  snapshot: LegendPlayerSnapshot;
}

/** Someone this coach actually coached — the set a player must come from to be added. */
export interface HallEligiblePlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  portraitAssetName: string | null;
  /** Best overall reached in a season under THIS coach. */
  peakOverall: number;
  schoolName: string | null;
  teamIndex: number | null;
  firstSeasonYear: number;
  lastSeasonYear: number;
  seasonsCoached: number;
}

/** Where one player stands with the active coach's Hall — what the profile action needs. */
export interface LegendStatus {
  eligible: boolean;
  inPool: boolean;
  tier: 'first' | 'second' | null;
  slotId: string | null;
}

export interface CoachHall {
  /** Coach.PresentationId, or null when no season records a coach identity yet. */
  coachId: number | null;
  coachName: string | null;
  careerFirstYear: number | null;
  careerLastYear: number | null;
  entries: LegendEntry[];
}

export interface PlayerDeparture {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  overallRating: number;
  portraitAssetName: string | null;
  teamIndex: number;
  teamName: string | null;
  /**
   * 'nfl' = declared for the NFL (projected round only — no team/pick);
   * 'transfer' = went to another FBS school; 'graduated' = a senior out of
   * eligibility; 'left' = off FBS with no reason recorded; 'other' = a stored
   * row from before this was resolved against the roster.
   */
  type: 'nfl' | 'transfer' | 'graduated' | 'left' | 'other';
  /** NFL declarations: projected round 1–7. */
  projectedRound: number | null;
  /** Transfers: the game's stated reason, humanized (e.g. "Pro Potential"). */
  reason: string | null;
  /**
   * True once the following season's roster proved the player actually left.
   * False means this is still only the game's declaration list — players can
   * and do withdraw, and graduating seniors aren't in it at all.
   */
  confirmed: boolean;
}

/**
 * What the recruit view renders, from either source.
 *
 * A prospect can be opened two ways: off the user's own board (RecruitBoardEntry)
 * or from anywhere its id turns up — search, a routed player-modal open — where
 * only the league-wide record exists (NationalRecruit). The league-wide record
 * already carries almost everything the panel shows: ranks, commit score, school
 * interest, offers, dealbreaker, ideal pitch, stage, ratings. The board adds
 * exactly four things that only mean anything for a prospect you're recruiting —
 * your favourite mark, YOUR nil offer, the week they committed, who they signed
 * with — so those are the only optional fields here, and the view omits each one
 * it hasn't got rather than drawing an empty row.
 */
export type RecruitProfileSubject = NationalRecruit &
  Partial<
    Pick<
      RecruitBoardEntry,
      'isFavorite' | 'currentNilOffer' | 'committedWeekNumber' | 'signedTeamDisplayName' | 'stage'
    >
  >;

export interface RecruitBoardEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  /** 1-5; 0 if unrated. */
  stars: number;
  overallRating: number;
  archetype: string;
  developmentTrait: string;
  heightInches: number;
  weightPounds: number;
  hometown: string;
  homeState: string;
  /** Recruits are Player rows, so they carry a real portrait like any roster player — confirmed directly against a real save. */
  portraitAssetName: string | null;
  /** HighSchool / JuniorCollege_Sophomore / JuniorCollege_Junior / JuniorCollege_Senior — real values, not simplified. */
  classYear: string;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
  isFavorite: boolean;
  nilExpectation: number;
  currentNilOffer: number;
  /** 0 = not committed to this team; >0 = the week number they committed. */
  committedWeekNumber: number;
  stage: RecruitBoardStage;
  /**
   * Set once `stage` is `'signed'` or `'lost'` — the real school this recruit
   * signed with (resolved leaguewide via every team's own committed-players
   * list, not derivable from the player's own record). Null while still
   * undecided. Pass this directly as `TeamLogo`'s `assetName` prop — despite
   * the prop's name, this app's logo lookup is keyed by normalized display
   * name, not the save's own raw `AssetName` field.
   */
  signedTeamDisplayName: string | null;
}

export interface RecruitingClassSummary {
  signedCount: number;
  committedCount: number;
  /** Average star rating across signed + committed prospects; null if neither exists yet. */
  averageStars: number | null;
  positionBreakdown: { position: string; count: number }[];
  /** From the same `TopClassRank`/`TopClassConferenceRank` fields the game itself tracks — null if the team has never been ranked. */
  nationalClassRank: number | null;
  conferenceClassRank: number | null;
}

/** One committed/signed prospect, chronological by the real week they committed — not a fabricated timeline. Decommits aren't trackable from a single save snapshot (nothing marks "previously committed, now gone"), so this only ever shows forward progress. */
export interface RecruitingTimelineEntry {
  week: number;
  playerId: number;
  playerName: string;
  position: string;
  stars: number;
}

/** One position group's grade (0-99) — the game's own computed rating, the same numbers behind the in-game Team Ratings screen. */
export interface TeamNeedEntry {
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST';
  rating: number;
}

export interface TeamNeedsSummary {
  /** Ascending by rating — the weakest position group (biggest need) first. */
  positions: TeamNeedEntry[];
  offenseRating: number;
  defenseRating: number;
  overallRating: number;
}

export interface RecruitingOverview {
  teamName: string;
  board: RecruitBoardEntry[];
  classSummary: RecruitingClassSummary;
  timeline: RecruitingTimelineEntry[];
  /** Null only if the team couldn't be resolved (matches classSummary's own rank-lookup fallback). */
  teamNeeds: TeamNeedsSummary | null;
}

export interface ProgramHistoryRecordHolder {
  playerName: string;
  position: string;
  value: number;
  seasonYear: number;
}

export interface ProgramHistoryRecordCategory {
  key:
    | 'passYards'
    | 'passTds'
    | 'rushYards'
    | 'rushTds'
    | 'receivingYards'
    | 'receivingTds'
    | 'receivingCatches'
    | 'defensiveSacks'
    | 'defensiveInts';
  label: string;
  careerRecord: ProgramHistoryRecordHolder | null;
  seasonRecord: ProgramHistoryRecordHolder | null;
  gameRecord: ProgramHistoryRecordHolder | null;
}

export interface ProgramHistorySeasonEntry {
  /**
   * Where this row came from. Three provenances, and only the first may be
   * summed:
   *
   *   synced       the app captured this season in full — roster, schedule,
   *                stats. Everything on this object was computed from these.
   *   gameHistory  the SAVE's own year-by-year record (Team.TeamSeriesHistory),
   *                for a season the app never synced. Real and save-derived,
   *                but thin: an outcome with no roster or box score behind it.
   *   manual       typed by the user from their own notes.
   *
   * `gameHistory` and `manual` appear on the TIMELINE ONLY. They are excluded
   * from every `dynasty*` total, coach summary and record here, so a number
   * computed from full seasons can never quietly absorb a thinner one. Render
   * them visibly differently; see shared/programHistory.ts.
   */
  source: 'synced' | 'gameHistory' | 'manual';
  seasonYear: number;
  /** The real team this season was played for — a dynasty can span schools; see Phase 0 per-season team tracking. */
  teamName: string;
  /**
   * NULL MEANS UNKNOWN, NOT ZERO — only reachable on a `manual` row, where the
   * user left the field blank. Render a dash: a 0-0 would read as a season that
   * was played and lost, which is a fact nobody supplied. Synced rows are always
   * numbers.
   */
  wins: number | null;
  losses: number | null;
  conferenceWins: number | null;
  conferenceLosses: number | null;
  mediaRank: number | null;
  coachesRank: number | null;
  cfpRank: number | null;
  headCoachName: string | null;
  conferenceChampion: boolean;
  /** Real conference name for that season specifically (not the dynasty's current one) — used to resolve the right conference-championship trophy art even if the team has since realigned. Null when conferenceChampion is false or the conference wasn't recognized. */
  conferenceChampionName: string | null;
  nationalChampion: boolean;
  playoffAppearance: boolean;
  bowlAppearance: string | null;
  /** Stable asset key for the bowl logo/trophy (see ScheduleGame.bowlAssetName) — bowlAppearance is the display name, which can carry a rotating sponsor prefix that doesn't match the asset filename. */
  bowlAssetName: string | null;
  postseasonSummary: string | null;
}

export interface ProgramHistoryCoachSummary {
  coachName: string;
  seasons: number;
  wins: number;
  losses: number;
  conferenceTitles: number;
  nationalTitles: number;
  playoffAppearances: number;
  tenWinSeasons: number;
}

export interface ProgramHistoryMilestone {
  seasonYear: number;
  label: string;
  detail: string;
}

/** One leaguewide season award (or Heisman) won by a player/coach on this program, in a season the dynasty archive covers. Raw `awardType` — format with awardFormat.ts's formatAwardLabel at render time, same convention as Weekly Honors. */
export interface ProgramHistoryNationalAward {
  seasonYear: number;
  awardType: string;
  playerName: string;
}

export interface LeagueChampionSummary {
  teamName: string;
  wins: number;
  losses: number;
  score: number;
  rank: number;
  coachFirstName: string;
  coachLastName: string;
}

export interface LeagueConferenceChampion {
  conferenceName: string;
  winningTeamName: string;
}

/**
 * One year of leaguewide history (national/conference champions), sourced
 * from every season row's own 'yearSummary' snapshot — full and
 * history-only seasons alike, unlike the rest of ProgramHistoryOverview
 * (which stays scoped to full seasons, since team win-loss data genuinely
 * isn't recoverable for a history-only year). See extract-league-history.ts.
 */
export interface LeagueHistoryYearEntry {
  seasonYear: number;
  hasFullData: boolean;
  nationalChampion: LeagueChampionSummary | null;
  conferenceChampions: LeagueConferenceChampion[];
}

export interface ProgramHistoryOverview {
  teamName: string;
  dynastyWins: number;
  dynastyLosses: number;
  dynastyConferenceTitles: number;
  dynastyNationalTitles: number;
  dynastyPlayoffAppearances: number;
  dynastyBowlAppearances: number;
  dynastyBowlWins: number;
  dynastyTenWinSeasons: number;
  dynastyUndefeatedSeasons: number;
  bestMediaRank: number | null;
  /** Best (lowest) final national recruiting class rank across every season in the archive — the save's own `TopClassRank` field. Null if the team was never ranked. */
  bestRecruitingClassRank: number | null;
  /** Number of seasons in the archive with full data (not "History Only"). */
  seasonsCoached: number;
  /** Distinct real team display names this dynasty has represented, oldest first — a dynasty can span schools via coaching changes. */
  schoolsCoached: string[];
  /** The most recently tracked season's user-controlled coach — HC, OC, or DC, whichever the user actually plays as. Null if no season ever resolved one. */
  headCoachName: string | null;
  /**
   * The save's own lifetime coaching record for that same coach — see
   * `Coach.careerStats`. This is the coach's real full in-game career, not
   * re-scoped to "since this dynasty was imported" (this app doesn't attempt
   * that slicing anywhere — see Coach Hub's Career Record panel for the same
   * choice). Null when the save doesn't resolve one.
   */
  headCoachCareer: CareerCoachStats | null;
  /** Every leaguewide season award (Heisman included) won by this program, across every season the archive covers — not just the current one. */
  nationalAwards: ProgramHistoryNationalAward[];
  seasons: ProgramHistorySeasonEntry[];
  coaches: ProgramHistoryCoachSummary[];
  records: ProgramHistoryRecordCategory[];
  milestones: ProgramHistoryMilestone[];
  leagueHistory: LeagueHistoryYearEntry[];
}

export const EXTRACTION_STEPS = [
  'league',
  'teams',
  'coaches',
  'roster',
  'schedule',
  'recruits',
  'stats',
  'gamelog',
  'trophies',
  'rivalries',
  'teamHistory',
  'awards',
] as const;
export type ExtractionStep = (typeof EXTRACTION_STEPS)[number];
export type ExtractionStepStatus = 'start' | 'done';

export interface ExtractionProgressEvent {
  step: ExtractionStep;
  status: ExtractionStepStatus;
}

/** Where the external image-data folder lives, and whether it was found. */
export interface AssetStatus {
  found: boolean;
  path: string | null;
}

/** Result of the "choose image folder" dialog. `picked` is false if the user cancelled; `invalid` is true if the chosen folder isn't a real image-data folder. */
export interface AssetChooseResult extends AssetStatus {
  picked: boolean;
  invalid?: boolean;
}

/**
 * Where the user's OWN uploaded media (Media Hub photos/videos) is stored.
 * Distinct from AssetStatus, which locates the shipped portrait/logo library:
 * that's app content, this is the user's irreplaceable screenshots. See
 * main/mediaRoot.ts.
 */
export interface MediaLibraryStatus {
  /** The folder currently in use — always a real answer, never null. */
  path: string;
  /** True when no custom folder is set (i.e. the AppData default). */
  isDefault: boolean;
  /** False when a custom folder was set but has since gone missing (unplugged drive, deleted folder). */
  exists: boolean;
  /** The built-in default, so the UI can offer "reset" without guessing it. */
  defaultPath: string;
}

/** One on-disk folder the app manages, for the Preferences storage panel — so nothing it writes stays invisible to the user. */
export interface StorageFolderUsage {
  path: string;
  fileCount: number;
  totalBytes: number;
}

/** Everything the app is using on disk, broken down by what it's for. */
export interface StorageUsage {
  /** The dynasty archive itself — every dynasty, season and note. */
  database: StorageFolderUsage;
  /** Media Hub photos/videos (wherever the user has pointed them). */
  media: StorageFolderUsage;
  /** Trading-card photos. */
  cardPhotos: StorageFolderUsage;
  /** Automatic crash-recovery checkpoints of the database. */
  databaseBackups: StorageFolderUsage;
  /** Pre-edit copies of the user's actual game saves. */
  saveBackups: StorageFolderUsage;
  /**
   * Space inside the archive still held by dynasties the user deleted — called
   * "cache" in the UI because that's the word people understand, though it's
   * really stranded rows plus pages SQLite freed without shrinking the file.
   */
  deletedDynastyCacheBytes: number;
}

/** Which optional parts the user ticked for a dynasty backup. The archive itself is always included — it IS the backup. */
export interface DynastyBackupContents {
  media: boolean;
  cardPhotos: boolean;
  saveGame: boolean;
}

/** What each part of a dynasty backup would cost, so the picker can show real sizes as boxes are ticked. */
export interface DynastyBackupEstimate {
  dynastyId: string;
  label: string;
  teamName: string;
  seasonCount: number;
  archiveBytes: number;
  mediaFiles: number;
  mediaBytes: number;
  cardPhotoFiles: number;
  cardPhotoBytes: number;
  saveGameBytes: number;
  saveGameName: string | null;
  /** False when the save file has moved or been deleted — the option is offered as unavailable rather than silently skipped. */
  saveGameAvailable: boolean;
}

/** What a backup file says it contains, read before anything is changed. */
export interface BackupInspection {
  valid: boolean;
  /** Why it can't be used, when `valid` is false. */
  message: string;
  dynastyId?: string;
  teamName?: string;
  seasonCount?: number;
  createdAt?: string | null;
  appVersion?: string | null;
  mediaFiles?: number;
  cardPhotoFiles?: number;
  saveGameName?: string | null;
  /** True when this dynasty is already here and restoring would replace it. */
  alreadyPresent?: boolean;
}

export interface DynastyRestoreResult {
  success: boolean;
  message: string;
  dynastyId?: string;
  rowsRestored?: number;
}

export interface DynastyBackupResult {
  success: boolean;
  message: string;
  filePath?: string;
  bytes?: number;
}

/** Result of moving the media library. `error` means nothing moved — the old folder is still live and untouched. */
export interface MediaLibraryMoveResult {
  status: MediaLibraryStatus;
  movedFiles: number;
  error?: string;
}

/** Current state of everything the Scandals panel can edit. */
export interface ScandalsData {
  coachName: string;
  recruitingHours: number;
  experiencePoints: number;
  level: number;
  coachPoints: number;
  prestigeScore: number;
  jobSecurity: number;
  contractPoints: number;
  coachXpSpeed: string;
  talentProgressSpeed: string;
  /** Per-position progression multiplier; 100 is the game's normal. */
  positionXp: Record<string, number>;
  talentNodesTotal: number;
  talentNodesOwned: number;
  /** The coach's talent trees, so they can be unlocked one at a time. */
  talentTrees: ScandalsTree[];
  /** Real ceilings from each field's bit width — over these, the save wraps silently. */
  limits: Record<string, number>;
}

/**
 * One named coach talent tree. The save stores trees as anonymous numbered
 * subtree slots with no name field anywhere in the chain, so the slot→name map
 * is derived rather than read — see TALENT_TREES in scandalsWrite.ts.
 */
export interface ScandalsTree {
  key: string;
  name: string;
  total: number;
  owned: number;
  /** Coach points the coach has already sunk into this tree. */
  spent: number;
  /** False where the slot→name mapping is inferred but not yet proven in-game. */
  confirmed: boolean;
  /** Base tier, then the Elite tier gated behind it. */
  tiers: ScandalsTreeTier[];
}

/**
 * One tier of a tree — a subtree slot, drawn as a set of talent blocks plus a
 * header node that gates the tier. Shapes differ per tree: most are 8 blocks of
 * 4 levels, but CEO is 9 blocks of 1 and Program Builder is 7 of 3.
 */
export interface ScandalsTreeTier {
  slot: number;
  /** The tier's in-game name, e.g. "Recruiter" then "Elite Recruiter". */
  label: string;
  levelsPerBlock: number;
  blocks: { name: string; owned: number }[];
  /** True when the tier's header node is still Locked (the in-game padlock). */
  locked: boolean;
}

/** Only the fields actually supplied are written. */
export interface ScandalsEdit {
  recruitingHours?: number;
  experiencePoints?: number;
  level?: number;
  coachPoints?: number;
  prestigeScore?: number;
  jobSecurity?: number;
  contractPoints?: number;
  coachXpSpeed?: string;
  talentProgressSpeed?: string;
  positionXp?: Record<string, number>;
  /**
   * Talent levels to own, keyed by subtree slot: 8 entries per slot, each 0-4,
   * meaning "own levels 1..n of this block". Levels above n are left alone
   * rather than revoked. Absent or empty changes no talents.
   */
  talentUnlocks?: Record<string, number[]>;
}

import type { UpdatePreferences, UpdateState } from './updateTypes';

export interface DynastyApi {
  fs: {
    selectFile: () => Promise<string | null>;
    getDefaultSavesDir: () => Promise<string>;
    scanForSaves: (dirPath: string) => Promise<SaveFileInfo[]>;
    /** Reads a save's school/coach/year for the Import picker. Null if it isn't a readable dynasty save. */
    peekSave: (filePath: string) => Promise<SavePeek | null>;
    /** Folder picker for the saves location, remembered for next time. Null if cancelled. */
    chooseSavesFolder: () => Promise<string | null>;
  };
  assets: {
    getStatus: () => Promise<AssetStatus>;
    chooseFolder: () => Promise<AssetChooseResult>;
  };
  db: {
    getDynasties: () => Promise<DynastySummary[]>;
    importDynasty: (savePath: string) => Promise<ImportResult>;
    checkDynastyMatch: (savePath: string) => Promise<DynastyMatchCandidate | null>;
    relinkDynasty: (dynastyId: string, savePath: string) => Promise<ImportResult>;
    syncDynasty: (dynastyId: string) => Promise<ImportResult>;
    getSeasonOverview: (dynastyId: string, seasonId?: number) => Promise<SeasonOverview | null>;
    getNcaaHub: (dynastyId: string, seasonId?: number) => Promise<NcaaHubOverview | null>;
    getHistory: (dynastyId: string) => Promise<ProgramHistoryOverview | null>;
    deleteDynasty: (dynastyId: string) => Promise<void>;
    getSeasons: (dynastyId: string) => Promise<SeasonSummary[]>;
    getRoster: (dynastyId: string, seasonId?: number) => Promise<RosterPlayer[] | null>;
    getPlayerStats: (dynastyId: string, seasonId?: number) => Promise<PlayerStats[] | null>;
    getTeamStats: (dynastyId: string, seasonId?: number) => Promise<TeamStats | null>;
    /** Per-game team + opponent stat lines for one team (null teamIndex = the user's own) — the Statistics page's filterable source. */
    getTeamGameStats: (
      dynastyId: string,
      teamIndex: number | null,
      seasonId?: number,
    ) => Promise<TeamGameStat[] | null>;
    getTeamCard: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<TeamCard | null>;
    getNationalTeamStats: (
      dynastyId: string,
      seasonId?: number,
    ) => Promise<NationalTeamStatRow[] | null>;
    getNationalStatLeaders: (
      dynastyId: string,
      seasonId?: number,
    ) => Promise<NationalStatLeaders | null>;
    getKickingStats: (dynastyId: string, seasonId?: number) => Promise<PlayerKickingStats[] | null>;
    getGameLog: (dynastyId: string, seasonId?: number) => Promise<GameLogEntry[] | null>;
    /** One player's lines from a season's log, filtered in the main process. The leaguewide log is ~16 MB for a played season; every renderer caller only ever wants one player out of it. */
    /**
     * `anchorSeasonId` is only needed when LOOPING this across seasons to build
     * a career: player ids are recycled, so a season where a different person
     * held the id would otherwise contribute his games. Pass the season the
     * player is being viewed in. A single-season caller can omit it.
     * See shared/playerIdentity.ts.
     */
    getPlayerGameLog: (
      dynastyId: string,
      playerId: number,
      seasonId?: number,
      anchorSeasonId?: number,
    ) => Promise<GameLogEntry[] | null>;
    getGameDetail: (
      dynastyId: string,
      gameId: number,
      seasonId?: number,
    ) => Promise<GameDetailData | null>;
    /** This season's trophy case. `teamIndex` omitted = the dynasty's own team; pass one to read any program's. */
    getTeamTrophies: (dynastyId: string, seasonId?: number, teamIndex?: number) => Promise<TeamTrophies | null>;
    getSchedule: (dynastyId: string, seasonId?: number) => Promise<ScheduleOverview | null>;
    getStandings: (dynastyId: string, seasonId?: number) => Promise<StandingsOverview | null>;
    getCoaches: (dynastyId: string, seasonId?: number) => Promise<CoachOverview | null>;
    getAwards: (dynastyId: string, seasonId?: number) => Promise<AwardsOverview | null>;
    getRankings: (dynastyId: string, seasonId?: number) => Promise<RankingsOverview | null>;
    getRecruits: (dynastyId: string, seasonId?: number) => Promise<RecruitingOverview | null>;
    getLeagueTeams: (dynastyId: string, seasonId?: number) => Promise<LeagueTeamSummary[] | null>;
    getLeagueScores: (dynastyId: string, seasonId?: number) => Promise<LeagueScoresView | null>;
    getPlayoffBracket: (dynastyId: string, seasonId?: number) => Promise<PlayoffBracketView | null>;
    getLeagueTeamOverview: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<SeasonOverview | null>;
    getLeagueTeamRoster: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<LeagueTeamRoster | null>;
    getAllLeaguePlayers: (dynastyId: string, seasonId?: number) => Promise<NationalPlayer[] | null>;
    getLeagueTeamSchedule: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<LeagueTeamGame[] | null>;
    getLeagueTeamHonors: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<LeagueTeamHonors | null>;
    getNationalRecruits: (
      dynastyId: string,
      seasonId?: number,
    ) => Promise<NationalRecruit[] | null>;
    /** One program's all-time résumé, season-by-season history and record book. Null for seasons synced before this shipped. */
    getTeamHistory: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<TeamHistoryView | null>;
    /** One prospect by player id, or null when the id is not a recruit — the test that routes an open to the recruit view instead of the player workspace. */
    getRecruitById: (
      dynastyId: string,
      playerId: number,
      seasonId?: number,
    ) => Promise<NationalRecruit | null>;
    getNcaaRecords: (
      dynastyId: string,
      seasonId?: number,
    ) => Promise<import('../extractors/extract-ncaa-records').NcaaRecordsData | null>;
    getDynastyTrends: (dynastyId: string) => Promise<DynastyTrends | null>;
    /** Season Lab: one season's journey, identity and derived findings. */
    getSeasonAnalytics: (dynastyId: string, seasonId?: number) => Promise<SeasonAnalytics | null>;
    getProgramArc: (dynastyId: string) => Promise<ProgramArc | null>;
    getTransfers: (dynastyId: string, focusTeamName: string) => Promise<TeamTransfers | null>;
    getDepartures: (
      dynastyId: string,
      teamIndex: number | null,
      seasonId?: number,
    ) => Promise<PlayerDeparture[] | null>;
    globalSearch: (
      dynastyId: string,
      query: string,
      seasonId?: number,
    ) => Promise<GlobalSearchResults>;
    /**
     * `anchorSeasonId` says WHICH occupant of a recycled id is meant — the save
     * reissues player ids to incoming recruits, so an id alone does not name a
     * person across seasons. Pass the season the player is being viewed in;
     * omitting it falls back to the newest season holding that id, which is
     * wrong for a historical player whose id has since been reused. See
     * shared/playerIdentity.ts.
     */
    getPlayerDevelopment: (
      dynastyId: string,
      playerId: number,
      anchorSeasonId?: number,
    ) => Promise<PlayerDevelopmentSeason[]>;
    /** Season-by-season production INCLUDING years at other schools — see getPlayerStatHistory. */
    getPlayerStatHistory: (
      dynastyId: string,
      playerId: number,
      anchorSeasonId?: number,
    ) => Promise<PlayerStatSeason[]>;
    getCoachHall: (dynastyId: string) => Promise<CoachHall | undefined>;
    /** Everyone this coach coached — fetched lazily, only when the picker opens. */
    getHallEligible: (dynastyId: string) => Promise<HallEligiblePlayer[]>;
    getLegendStatus: (dynastyId: string, playerId: number) => Promise<LegendStatus>;
    addLegend: (dynastyId: string, playerId: number) => Promise<boolean>;
    removeLegend: (dynastyId: string, playerId: number) => Promise<void>;
    assignLegend: (
      dynastyId: string,
      playerId: number,
      tier: 'first' | 'second' | null,
      slotId: string | null,
    ) => Promise<{ ok: boolean; message?: string }>;
    getHeadToHead: (dynastyId: string) => Promise<HeadToHeadOpponent[]>;
    getCoachingTree: (dynastyId: string) => Promise<CoachingTree>;
    getDynastyTheme: (dynastyId: string) => Promise<DynastyTheme | null>;
    /** A specific team's brand colors (any team), for theming a player's card to the team he plays for. Season optional (colors are stable). */
    getTeamTheme: (
      dynastyId: string,
      teamName: string,
      seasonId?: number,
    ) => Promise<TeamTheme | null>;
    /** EA's own rival slots for a program. `isUserTeam` false means the save doesn't record them for this team — not that it has none. */
    getSaveRivals: (
      dynastyId: string,
      teamIndex: number,
      seasonId?: number,
    ) => Promise<{ isUserTeam: boolean; rivals: SaveRival[] } | null>;
    /** Team colors for a specific season (the team coached that season) — the coach-journey theming source; falls back to the dynasty theme. */
    getSeasonTheme: (dynastyId: string, seasonId?: number) => Promise<DynastyTheme | null>;
    getTeamAwardDefinitions: () => Promise<TeamAwardDefinitionSummary[]>;
    getTeamAwardResults: (dynastyId: string, seasonId: number) => Promise<TeamAwardResult[]>;
    calculateTeamAward: (
      dynastyId: string,
      seasonId: number,
      awardDefinitionId: string,
    ) => Promise<TeamAwardResult>;
    confirmTeamAwardWinner: (
      dynastyId: string,
      seasonId: number,
      awardDefinitionId: string,
      winnerId: number,
    ) => Promise<TeamAwardResult>;
    selectManualAwardWinner: (
      dynastyId: string,
      seasonId: number,
      awardDefinitionId: string,
      winnerId: number,
    ) => Promise<TeamAwardResult>;
    finalizeTeamAwards: (dynastyId: string, seasonId: number) => Promise<TeamAwardResult[]>;
    unlockTeamAwards: (dynastyId: string, seasonId: number) => Promise<TeamAwardResult[]>;
    getTeamAwardSettings: (dynastyId: string) => Promise<TeamAwardSettings>;
    saveTeamAwardSettings: (
      dynastyId: string,
      settings: TeamAwardSettings,
    ) => Promise<TeamAwardSettings>;
    getTeamAwardHistory: (dynastyId: string) => Promise<TeamAwardHistorySeason[]>;
  };
  extraction: {
    onProgress: (callback: (event: ExtractionProgressEvent) => void) => () => void;
  };
  export: {
    historyToHtml: (dynastyId: string) => Promise<ExportResult>;
    seasonYearbookToHtml: (dynastyId: string, seasonId: number) => Promise<ExportResult>;
    /** Capture a rectangle of the window (the rendered card) and save it as a PNG. */
    playerCardToPng: (
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => Promise<ExportResult>;
    /** The media viewer's photo-and-caption plate, captured as it appears on screen. */
    mediaPlateToPng: (
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => Promise<ExportResult>;
    /** Folder picker for a bulk card export — chosen once, then written to without further prompting. */
    pickCardFolder: () => Promise<string | null>;
    /** Capture one card straight into an already-chosen folder. No dialog, so a run of cards doesn't ask N times. */
    playerCardToFolder: (
      folderPath: string,
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => Promise<ExportResult>;
    /**
     * One team's roster as a file — the archived player record plus every
     * rating, written as CSV or XML depending on which the save dialog is left
     * on. `teamIndex` null means the user's own team. Ratings come from the live
     * save, so a past season (or a missing save) exports profiles only and says
     * why.
     */
    rosterToFile: (
      dynastyId: string,
      teamIndex: number | null,
      seasonId?: number,
    ) => Promise<ExportResult>;
  };
  editor: {
    /** Reads the user coach's current Scandals values straight from the save. */
    getScandals: (dynastyId: string) => Promise<ScandalsData | null>;
    /** Writes Scandals edits to the save (backs up first). */
    saveScandals: (dynastyId: string, edit: ScandalsEdit) => Promise<SaveEditResult>;
    /** Sizes for each part of this dynasty's backup, for the picker's running total. */
    estimateDynastyBackup: (dynastyId: string) => Promise<DynastyBackupEstimate | null>;
    /** Opens a save dialog, then writes the backup zip. A cancelled dialog returns success:false with an empty message. */
    createDynastyBackup: (
      dynastyId: string,
      contents: DynastyBackupContents,
    ) => Promise<DynastyBackupResult>;
    /** Opens a file picker and reports what the chosen backup contains, WITHOUT changing anything. Null if cancelled. */
    chooseBackupToRestore: () => Promise<(BackupInspection & { filePath: string }) | null>;
    /** Restores a backup, after checkpointing whatever is already here. */
    restoreDynastyBackup: (filePath: string) => Promise<DynastyRestoreResult>;
    /** Subscribes to write progress; returns an unsubscribe function. */
    onBackupProgress: (
      callback: (progress: { percent: number; step: string }) => void,
    ) => () => void;
    getPlayer: (dynastyId: string, playerId: number) => Promise<PlayerEditData | null>;
    savePlayer: (
      dynastyId: string,
      playerId: number,
      fields: PlayerEditFields,
    ) => Promise<SaveEditResult>;
    getCoach: (
      dynastyId: string,
      teamIndex: number,
      position: string,
    ) => Promise<CoachEditData | null>;
    saveCoach: (
      dynastyId: string,
      teamIndex: number,
      position: string,
      fields: CoachEditFields,
    ) => Promise<SaveEditResult>;
    getRecruit: (dynastyId: string, playerId: number) => Promise<RecruitEditData | null>;
    saveRecruit: (
      dynastyId: string,
      playerId: number,
      fields: RecruitEditFields,
    ) => Promise<SaveEditResult>;
    saveRecruitInfluence: (
      dynastyId: string,
      playerId: number,
      edit: RecruitInfluenceEdit,
    ) => Promise<SaveEditResult>;
    getTeamBudget: (dynastyId: string, teamIndex: number) => Promise<TeamBudgetData | null>;
    saveTeamBudget: (
      dynastyId: string,
      teamIndex: number,
      edit: TeamBudgetEdit,
    ) => Promise<SaveEditResult>;
    /** EXPERIMENTAL — force a boarded recruit to commit to the user's team. */
    forceCommitRecruit: (dynastyId: string, playerId: number) => Promise<ForceCommitResult>;
    searchPortraits: (
      kind: 'player' | 'coach',
      query: string,
      filters: PortraitFilters,
      page: number,
    ) => Promise<PortraitSearchResponse>;
  };
  card: {
    /** Pick an image and store it as this player's custom card photo; returns its absolute path, or null if cancelled. */
    pickPhoto: (dynastyId: string, playerId: number) => Promise<string | null>;
    /** Store an existing image (e.g. a gallery photo tagged to this player) as the card photo; returns its stored path, or null if the type is unsupported. */
    /** The player's stored custom card photo path, or null if none. */
    getPhoto: (dynastyId: string, playerId: number) => Promise<string | null>;
    /** Remove the player's custom card photo. */
    removePhoto: (dynastyId: string, playerId: number) => Promise<void>;

    /** Pick an image for ONE card. Returns the stored basename (what the card row keeps), or null if cancelled. */
    pickPhotoForCard: (
      dynastyId: string,
      playerId: number,
      cardId: number,
    ) => Promise<string | null>;
    /** Store an existing image (e.g. a tagged gallery photo) as this card's photo; returns the stored basename. */
    setCardPhotoFromPath: (
      dynastyId: string,
      playerId: number,
      cardId: number,
      sourcePath: string,
    ) => Promise<string | null>;
    /** Delete a card photo file by its stored basename. */
    removeCardPhoto: (dynastyId: string, photoFile: string) => Promise<void>;

    /** Every saved card for a player, the default first. */
    list: (dynastyId: string, playerId: number) => Promise<PlayerCardRecord[]>;
    /** Every starred card in the dynasty, oldest season first — the card book. */
    listFavorites: (dynastyId: string) => Promise<PlayerCardRecord[]>;
    /** Player ids that have at least one saved card. */
    listCardedPlayerIds: (dynastyId: string) => Promise<number[]>;
    create: (
      dynastyId: string,
      playerId: number,
      input: PlayerCardInput,
    ) => Promise<PlayerCardRecord>;
    update: (
      dynastyId: string,
      id: number,
      input: PlayerCardInput,
    ) => Promise<PlayerCardRecord | null>;
    setFavorite: (
      dynastyId: string,
      id: number,
      favorite: boolean,
    ) => Promise<PlayerCardRecord | null>;
    /** Promote a card to the player's default (what the hover preview shows); returns the player's cards after the change. */
    setDefault: (dynastyId: string, playerId: number, id: number) => Promise<PlayerCardRecord[]>;
    /** Deletes the card AND its photo file; returns the player's remaining cards. */
    remove: (dynastyId: string, id: number) => Promise<PlayerCardRecord[]>;
  };
  program: {
    /** Every override in the dynasty, art paths resolved. The renderer holds these for the session. */
    list: (dynastyId: string) => Promise<ProgramOverride[]>;
    /** Stadium name + city for one program. */
    setIdentity: (
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      identity: ProgramOverrideIdentity,
    ) => Promise<ProgramOverride | null>;
    /** Native picker + copy-in for one art slot; returns the row with the new file resolved, or null if cancelled. */
    pickArt: (
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      slot: ProgramArtSlot,
    ) => Promise<ProgramOverride | null>;
    /** Drops an uploaded file and goes back to the shipped default. */
    clearArt: (
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      slot: ProgramArtSlot,
    ) => Promise<ProgramOverride | null>;
  };
  /** User-declared rivalries. Cosmetic and app-only — none of these write to the save. */
  rivals: {
    /** Every custom rivalry in the dynasty, logo paths resolved. The renderer holds these for the session. */
    list: (dynastyId: string) => Promise<CustomRival[]>;
    /** Creates the rivalry, or renames the one already covering this matchup. Null when the name is blank or a team was paired with itself. */
    save: (dynastyId: string, input: CustomRivalInput) => Promise<CustomRival | null>;
    /** Deletes the rivalry and its uploaded logo. False when there was nothing to delete. */
    remove: (dynastyId: string, pairKey: string) => Promise<boolean>;
    /** Native picker + copy-in for the rivalry mark; null if cancelled. */
    pickLogo: (dynastyId: string, pairKey: string) => Promise<CustomRival | null>;
    /** Drops the uploaded mark and goes back to the generic shield. */
    clearLogo: (dynastyId: string, pairKey: string) => Promise<CustomRival | null>;
  };
  media: {
    /** The on-disk path of a dragged File. Uses Electron's supported webUtils rather than the deprecated `File.path`. */
    pathForFile: (file: File) => string;
    /** Native multi-select file dialog (images + videos). Returns absolute paths, or null if cancelled. */
    pickFiles: () => Promise<string[] | null>;
    /** Copies the given files into the dynasty's media library and creates their DB rows. Split from pickFiles so verification runs can add files without a native dialog. */
    addFiles: (
      dynastyId: string,
      seasonId: number,
      filePaths: string[],
    ) => Promise<MediaItemWithPath[]>;
    list: (dynastyId: string, seasonId?: number) => Promise<MediaItemWithPath[] | undefined>;
    /** Everything this player is tagged in, across all seasons — the Media tab on player bios. */
    listForPlayer: (dynastyId: string, playerId: number) => Promise<MediaItemResolved[]>;
    /** Everything linked to one game — the media section on the Game info page. */
    listForGame: (
      dynastyId: string,
      seasonId: number | undefined,
      gameId: number,
    ) => Promise<MediaItemResolved[]>;
    /** Every folder the user has renamed this season. A folder with no row uses the game's own label. */
    listAlbums: (dynastyId: string, seasonId: number) => Promise<MediaAlbum[]>;
    /** Renames one folder; a blank name hands it back to the game. Returns the season's albums after the change. */
    renameAlbum: (
      dynastyId: string,
      seasonId: number,
      gameId: number | null,
      name: string,
    ) => Promise<MediaAlbum[]>;
    /** Which photo a GAME folder shows; null goes back to whichever is first in it. */
    setAlbumCover: (
      dynastyId: string,
      seasonId: number,
      gameId: number | null,
      mediaId: number | null,
    ) => Promise<MediaAlbum[]>;
    /** Albums the user made this season. */
    listCustomAlbums: (dynastyId: string, seasonId: number) => Promise<CustomAlbum[]>;
    createCustomAlbum: (dynastyId: string, seasonId: number, name: string) => Promise<CustomAlbum[]>;
    renameCustomAlbum: (
      dynastyId: string,
      seasonId: number,
      albumId: number,
      name: string,
    ) => Promise<CustomAlbum[]>;
    /** Deletes the album and RELEASES its photos back to unfiled — it never deletes pictures. */
    removeCustomAlbum: (dynastyId: string, seasonId: number, albumId: number) => Promise<CustomAlbum[]>;
    setCustomAlbumCover: (
      dynastyId: string,
      seasonId: number,
      albumId: number,
      mediaId: number | null,
    ) => Promise<CustomAlbum[]>;
    update: (id: number, patch: MediaItemPatch) => Promise<void>;
    /** Save (or clear, with null) how this photo is framed. Metadata only — the file is never touched. */
    setFraming: (id: number, framing: MediaFraming | null) => Promise<void>;
    /** Null clears the look back to untreated. */
    setLook: (id: number, look: MediaLook | null) => Promise<void>;
    /** Persist a drag-chosen order: `orderedIds` is the season's item ids in display order. */
    reorder: (dynastyId: string, seasonId: number, orderedIds: number[]) => Promise<void>;
    remove: (id: number) => Promise<void>;
    /** Everything the app is using on disk, so no folder it writes to stays invisible. */
    getStorageUsage: () => Promise<StorageUsage>;
    /** Deletes all but the newest few database checkpoints and game-save backups. Returns how many files went. */
    cleanUpBackups: () => Promise<{ removed: number; freedBytes: number }>;
    /** Clears space still held by deleted dynasties and compacts the archive. Returns bytes actually freed. */
    clearDeletedDynastyCache: () => Promise<{ freedBytes: number }>;
    /** Where uploaded photos/videos are stored — the AppData default unless the user moved it. */
    getLibraryStatus: () => Promise<MediaLibraryStatus>;
    /** Folder picker + move. `picked` is false if the dialog was cancelled; `error` means nothing moved and the old folder is still live. */
    chooseLibraryFolder: () => Promise<MediaLibraryMoveResult & { picked: boolean }>;
    /** Moves the library back to the built-in AppData folder. */
    resetLibraryFolder: () => Promise<MediaLibraryMoveResult>;
    /** Reveals the library in Explorer/Finder. */
    openLibraryFolder: () => Promise<void>;
  };
  /**
   * User-typed historical seasons (schema v19). `save` replaces the WHOLE set
   * for a dynasty — the editor is a grid and a cleared row must disappear.
   * These never enter a computed total; see shared/programHistory.ts.
   */
  manualSeasons: {
    list: (dynastyId: string) => Promise<ManualSeason[]>;
    save: (dynastyId: string, seasons: ManualSeason[]) => Promise<ManualSeason[]>;
    gap: (dynastyId: string) => Promise<ManualSeasonGap | null>;
    markPromptSeen: (dynastyId: string) => Promise<void>;
  };
  notes: {
    /** All of a player's notes, most-recently-updated first. Scoped to (dynasty, player). */
    list: (dynastyId: string, playerId: number) => Promise<PlayerNote[]>;
    create: (
      dynastyId: string,
      playerId: number,
      title: string,
      body: string,
    ) => Promise<PlayerNote>;
    /** Updates title + body; resolves to the fresh note, or null if the id no longer exists. */
    update: (id: number, title: string, body: string) => Promise<PlayerNote | null>;
    remove: (id: number) => Promise<void>;
    /** Distinct titles used anywhere in this dynasty (recall/auto-fill for the title field). */
    titleSuggestions: (dynastyId: string) => Promise<string[]>;
  };
  update: {
    /** Asks GitHub whether a newer release exists. Never throws — failures come back as `state.error`. */
    check: () => Promise<UpdateState>;
    /** Starts downloading the available update, inside the app. */
    download: () => Promise<UpdateState>;
    /** Saves everything outstanding, then closes, installs and relaunches. Refuses (with a reason) while work is in flight. */
    install: () => Promise<UpdateState>;
    /** The current state, for a renderer that just mounted mid-download. */
    getState: () => Promise<UpdateState>;
    /** Subscribes to state pushes; returns its own unsubscribe. */
    onStateChanged: (callback: (state: UpdateState) => void) => () => void;
    /** Opens a GitHub link the user clicked in their browser (https + GitHub hosts only). */
    openLink: (url: string) => Promise<void>;
    /** The updater's own settings, owned by the main process (the launch check reads them before any renderer exists). */
    getPrefs: () => Promise<UpdatePreferences>;
    setPrefs: (next: Partial<UpdatePreferences>) => Promise<UpdatePreferences>;
  };
  window: {
    /**
     * Repaints the Windows Control Overlay (the native minimise/maximise/close
     * strip drawn over our page) to match the app's appearance. Without this the
     * buttons keep the colours they were created with and a light-mode window
     * shows a black band across its top-right corner.
     */
    setTitleBarTheme: (appearance: 'light' | 'dark') => Promise<void>;
  };
}

