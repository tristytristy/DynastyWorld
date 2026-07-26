import type { PortraitBuild, PortraitSkinTone, PortraitType } from './portraitTaxonomy';

export interface SaveFileInfo {
  path: string;
  name: string;
  modifiedAt: string;
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
  coachPortraitAssetName: string | null;
}

export interface DynastyTheme {
  teamName: string;
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

export interface NcaaHubCfpEntry {
  rank: number;
  teamName: string;
  conferenceName: string | null;
  wins: number;
  losses: number;
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
  top25: NcaaHubTop25Entry[];
  heismanFeature: NcaaHubHeismanFeature | null;
  gameOfTheWeek: NcaaHubGameFeature | null;
  upsetOfTheWeek: NcaaHubGameFeature | null;
  upcomingWeek: number | null;
  upcomingGames: NcaaHubGameFeature[];
  coachSpotlight: NcaaHubCoachSpotlight | null;
  playoffPicture: NcaaHubCfpEntry[];
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

export type TeamAwardCategory = 'major' | 'offense' | 'defense' | 'specialTeams' | 'position' | 'story';
export type TeamAwardCalculationMode = 'automaticWithConfirmation' | 'manual';
export type TeamAwardStatus = 'notCalculated' | 'calculated' | 'confirmed' | 'finalized' | 'insufficientData';
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

/** One league game for the national Scores page — from the leaguewide schedule snapshot; click-through opens the full Game Info modal. */
export interface LeagueScoreGame {
  gameId: number;
  week: number;
  weekType: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeScore: number | null;
  awayScore: number | null;
  bowlName: string | null;
}

/** One side of a game, in neutral home/away terms — powers the universal Game Info modal for ANY league game. */
export interface GameDetailTeamSide {
  teamIndex: number;
  name: string;
  score: number;
  /** [Q1, Q2, Q3, Q4]. */
  quarterScores: number[];
  /** null until the game is played. */
  stats: TeamStatLine | null;
  /** Current media-poll rank (approx, not point-in-time), or null if unranked. */
  currentRank: number | null;
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
  totalYards: number;
  passYards: number;
  rushYards: number;
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
  /** Venue name isn't available anywhere in the save (see extract-schedule.ts) — only this three-way classification; a real-world stadium/city is resolved client-side from stadiumData.ts where known. */
  siteType: 'home' | 'away' | 'neutral';
  /** The opponent's overall win-loss record — the save only ever exposes a team's CURRENT/final record, not a point-in-time snapshot from the week this game was actually played, so this is the same "final" caveat as opponentCurrentRank. Null if the opponent couldn't be resolved. */
  opponentRecord: { wins: number; losses: number } | null;
  /** The user's own overall/conference record after this game specifically — computed by accumulating games in week order up through this row, not copied from the season's final totals. Null for a game that hasn't been played yet (nothing to accumulate through). */
  runningRecord: { overallWins: number; overallLosses: number; conferenceWins: number; conferenceLosses: number } | null;
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

export type TrophyKind = 'national-championship' | 'conference-championship' | 'bowl-win';

export interface Trophy {
  kind: TrophyKind;
  label: string;
  /** Renderer-side asset lookup key — conference name for conference-championship, bowl asset name for bowl-win, null for national-championship (fixed asset). */
  assetKey: string | null;
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
  seasonStat: { playerId: number; category: 'offense' | 'defense'; season: OffensiveStatLine | DefensiveStatLine | null } | null;
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
  bowlName: string | null;
  isHome: boolean;
  opponent: string;
  /** The opponent's league team index — opens the Team modal. */
  opponentTeamIndex: number;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'W' | 'L' | 'T' | null;
  /** Same classification the user's own schedule uses — bowl/playoff, or conference vs non-conference by comparing both teams' conference membership (from the teams snapshot). */
  gameType: 'conference' | 'non-conference' | 'bowl';
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
/** A freeform user note scoped to one player within a dynasty (schema v7). Timestamps are ISO strings. */
export interface PlayerNote {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: number;
  seasonId: number;
  fileName: string;
  mediaType: 'image' | 'video';
  /** Save-native SeasonGame gameId — same id ScheduleGame and the /schedule/:gameId route use. Null = not linked to a game. */
  gameId: number | null;
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
  description: string;
  playerIds: number[];
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
  rankingWeeks: { week: number; mediaRank: number | null; coachesRank: number | null; cfpRank: number | null }[];
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
export interface PlayerDeparture {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  overallRating: number;
  portraitAssetName: string | null;
  teamIndex: number;
  teamName: string | null;
  /** 'nfl' = declared for the NFL (projected round only — no team/pick); 'transfer' = entered the portal; 'other'. */
  type: 'nfl' | 'transfer' | 'other';
  /** NFL declarations: projected round 1–7. */
  projectedRound: number | null;
  /** Transfers: the game's stated reason, humanized (e.g. "Pro Potential"). */
  reason: string | null;
}

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
  seasonYear: number;
  /** The real team this season was played for — a dynasty can span schools; see Phase 0 per-season team tracking. */
  teamName: string;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
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

export interface DynastyApi {
  fs: {
    selectFile: () => Promise<string | null>;
    getDefaultSavesDir: () => Promise<string>;
    scanForSaves: (dirPath: string) => Promise<SaveFileInfo[]>;
  };
  assets: {
    getStatus: () => Promise<AssetStatus>;
    chooseFolder: () => Promise<AssetChooseResult>;
    clearPath: () => Promise<AssetStatus>;
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
    getTeamGameStats: (dynastyId: string, teamIndex: number | null, seasonId?: number) => Promise<TeamGameStat[] | null>;
    getTeamCard: (dynastyId: string, teamIndex: number, seasonId?: number) => Promise<TeamCard | null>;
    getNationalTeamStats: (dynastyId: string, seasonId?: number) => Promise<NationalTeamStatRow[] | null>;
    getNationalStatLeaders: (dynastyId: string, seasonId?: number) => Promise<NationalStatLeaders | null>;
    getKickingStats: (dynastyId: string, seasonId?: number) => Promise<PlayerKickingStats[] | null>;
    getGameLog: (dynastyId: string, seasonId?: number) => Promise<GameLogEntry[] | null>;
    getGameDetail: (dynastyId: string, gameId: number, seasonId?: number) => Promise<GameDetailData | null>;
    getTeamTrophies: (dynastyId: string, seasonId?: number) => Promise<TeamTrophies | null>;
    getSchedule: (dynastyId: string, seasonId?: number) => Promise<ScheduleOverview | null>;
    getStandings: (dynastyId: string, seasonId?: number) => Promise<StandingsOverview | null>;
    getCoaches: (dynastyId: string, seasonId?: number) => Promise<CoachOverview | null>;
    getAwards: (dynastyId: string, seasonId?: number) => Promise<AwardsOverview | null>;
    getRankings: (dynastyId: string, seasonId?: number) => Promise<RankingsOverview | null>;
    getRecruits: (dynastyId: string, seasonId?: number) => Promise<RecruitingOverview | null>;
    getLeagueTeams: (dynastyId: string, seasonId?: number) => Promise<LeagueTeamSummary[] | null>;
    getLeagueScores: (dynastyId: string, seasonId?: number) => Promise<LeagueScoreGame[] | null>;
    getLeagueTeamOverview: (dynastyId: string, teamIndex: number, seasonId?: number) => Promise<SeasonOverview | null>;
    getLeagueTeamRoster: (dynastyId: string, teamIndex: number, seasonId?: number) => Promise<LeagueTeamRoster | null>;
    getAllLeaguePlayers: (dynastyId: string, seasonId?: number) => Promise<NationalPlayer[] | null>;
    getLeagueTeamSchedule: (dynastyId: string, teamIndex: number, seasonId?: number) => Promise<LeagueTeamGame[] | null>;
    getLeagueTeamHonors: (dynastyId: string, teamIndex: number, seasonId?: number) => Promise<LeagueTeamHonors | null>;
    getNationalRecruits: (dynastyId: string, seasonId?: number) => Promise<NationalRecruit[] | null>;
    getNcaaRecords: (
      dynastyId: string,
      seasonId?: number,
    ) => Promise<import('../extractors/extract-ncaa-records').NcaaRecordsData | null>;
    getDynastyTrends: (dynastyId: string) => Promise<DynastyTrends | null>;
    getTransfers: (dynastyId: string, focusTeamName: string) => Promise<TeamTransfers | null>;
    getDepartures: (dynastyId: string, teamIndex: number | null, seasonId?: number) => Promise<PlayerDeparture[] | null>;
    getDynastyTheme: (dynastyId: string) => Promise<DynastyTheme | null>;
    /** Team colors for a specific season (the team coached that season) — the coach-journey theming source; falls back to the dynasty theme. */
    getSeasonTheme: (dynastyId: string, seasonId?: number) => Promise<DynastyTheme | null>;
    getTeamAwardDefinitions: () => Promise<TeamAwardDefinitionSummary[]>;
    getTeamAwardResults: (dynastyId: string, seasonId: number) => Promise<TeamAwardResult[]>;
    calculateTeamAward: (dynastyId: string, seasonId: number, awardDefinitionId: string) => Promise<TeamAwardResult>;
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
    saveTeamAwardSettings: (dynastyId: string, settings: TeamAwardSettings) => Promise<TeamAwardSettings>;
    getTeamAwardHistory: (dynastyId: string) => Promise<TeamAwardHistorySeason[]>;
  };
  extraction: {
    extractAll: (savePath: string) => Promise<ExtractionResult>;
    onProgress: (callback: (event: ExtractionProgressEvent) => void) => () => void;
  };
  export: {
    historyToHtml: (dynastyId: string) => Promise<ExportResult>;
  };
  editor: {
    backupSaveFile: (dynastyId: string) => Promise<SaveFileBackupResult>;
    getPlayer: (dynastyId: string, playerId: number) => Promise<PlayerEditData | null>;
    savePlayer: (dynastyId: string, playerId: number, fields: PlayerEditFields) => Promise<SaveEditResult>;
    getCoach: (dynastyId: string, teamIndex: number, position: string) => Promise<CoachEditData | null>;
    saveCoach: (
      dynastyId: string,
      teamIndex: number,
      position: string,
      fields: CoachEditFields,
    ) => Promise<SaveEditResult>;
    getRecruit: (dynastyId: string, playerId: number) => Promise<RecruitEditData | null>;
    saveRecruit: (dynastyId: string, playerId: number, fields: RecruitEditFields) => Promise<SaveEditResult>;
    saveRecruitInfluence: (dynastyId: string, playerId: number, edit: RecruitInfluenceEdit) => Promise<SaveEditResult>;
    getTeamBudget: (dynastyId: string, teamIndex: number) => Promise<TeamBudgetData | null>;
    saveTeamBudget: (dynastyId: string, teamIndex: number, edit: TeamBudgetEdit) => Promise<SaveEditResult>;
    /** EXPERIMENTAL — force a boarded recruit to commit to the user's team. */
    forceCommitRecruit: (dynastyId: string, playerId: number) => Promise<ForceCommitResult>;
    searchPortraits: (
      kind: 'player' | 'coach',
      query: string,
      filters: PortraitFilters,
      page: number,
    ) => Promise<PortraitSearchResponse>;
  };
  media: {
    /** Native multi-select file dialog (images + videos). Returns absolute paths, or null if cancelled. */
    pickFiles: () => Promise<string[] | null>;
    /** Copies the given files into the dynasty's media library and creates their DB rows. Split from pickFiles so verification runs can add files without a native dialog. */
    addFiles: (dynastyId: string, seasonId: number, filePaths: string[]) => Promise<MediaItemWithPath[]>;
    list: (dynastyId: string, seasonId?: number) => Promise<MediaItemWithPath[] | undefined>;
    /** Everything this player is tagged in, across all seasons — the Media tab on player bios. */
    listForPlayer: (dynastyId: string, playerId: number) => Promise<MediaItemResolved[]>;
    /** Everything linked to one game — the media section on the Game info page. */
    listForGame: (dynastyId: string, seasonId: number | undefined, gameId: number) => Promise<MediaItemResolved[]>;
    update: (id: number, patch: MediaItemPatch) => Promise<void>;
    remove: (id: number) => Promise<void>;
  };
  notes: {
    /** All of a player's notes, most-recently-updated first. Scoped to (dynasty, player). */
    list: (dynastyId: string, playerId: number) => Promise<PlayerNote[]>;
    create: (dynastyId: string, playerId: number, title: string, body: string) => Promise<PlayerNote>;
    /** Updates title + body; resolves to the fresh note, or null if the id no longer exists. */
    update: (id: number, title: string, body: string) => Promise<PlayerNote | null>;
    remove: (id: number) => Promise<void>;
    /** Distinct titles used anywhere in this dynasty (recall/auto-fill for the title field). */
    titleSuggestions: (dynastyId: string) => Promise<string[]>;
  };
  update: {
    /** Checks the GitHub Releases API for a newer version. Never throws — network/rate-limit failures come back as `error`. */
    check: () => Promise<UpdateCheckResult>;
    /** Opens a download URL in the user's default browser (http/https only). */
    openDownload: (url: string) => Promise<void>;
  };
}

/** Result of an update check against the project's GitHub Releases. */
export interface UpdateCheckResult {
  /** The running app version. */
  current: string;
  /** The latest published release version (tag, `v` stripped), or null if none/failed. */
  latest: string | null;
  updateAvailable: boolean;
  /** Direct installer download (Setup .exe asset) or the release page, for the Download button. */
  url: string | null;
  /** The release notes (markdown), if any. */
  notes: string | null;
  /** Non-null when the check couldn't complete (offline, rate-limited, etc.) — the UI stays quiet. */
  error: string | null;
}



