import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';
import { PLAYER_FIELDS } from './lib/playerFields';

/**
 * One prospect on the user's own recruiting board — NOT the leaguewide pool
 * (4,101+ real rows leaguewide, verified directly; almost all irrelevant to
 * a single team). A team's board lives at `Team.RecruitingBoard.Recruits`, a
 * fixed 35-slot array of `UserRecruitTarget` rows (verified: 31/35 filled on
 * a real save) — each one is a prospect this team has actively added to
 * their board, with team-specific fields (offer status, NIL, whether they've
 * committed to *this* team) layered on top of the prospect's own league-wide
 * record (`Recruit`, resolved via `UserRecruitTarget.Recruit`) and bio
 * (`Player`, resolved via `Recruit.Player` — the same `Player` table real
 * roster players live in, but recruits are prospects, not roster players
 * yet: their `TeamIndex` stays a sentinel `255` even after signing,
 * confirmed directly against 5 real "Signed" recruits).
 */
export interface RecruitData {
  /** Player.PresentationId — stable across the whole league, same convention as roster/awards. */
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  stars: number;
  overallRating: number;
  archetype: string;
  developmentTrait: string;
  heightInches: number;
  weightPounds: number;
  hometown: string;
  homeState: string;
  /** Same field/format as RosterPlayerData's portraitAssetName — recruits are Player rows, so they carry a real portrait like any roster player. */
  portraitAssetName: string | null;
  /** HighSchool / JuniorCollege_Sophomore / JuniorCollege_Junior / JuniorCollege_Senior — verified real values, not guessed. */
  classYear: string;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
  /**
   * The prospect's own overall decision-funnel stage (Top10/Top5/Top3/
   * SoftCommitted/Signed/Battle) — leaguewide, not team-specific. Combined
   * with this team's own `scholarshipStatus`/`committedWeekNumber` below to
   * derive this team's board stage (see recruitFormat.ts).
   */
  recruitStage: string;
  /** 'Offered' | 'None' — whether *this* team has formally offered a scholarship, verified as the only two real values on a live board. */
  scholarshipStatus: string;
  isFavorite: boolean;
  nilExpectation: number;
  currentNilOffer: number;
  /** 0 = not committed to this team; >0 = the week number they committed. Real stored value, not inferred. */
  committedWeekNumber: number;
  /**
   * Where this recruit actually signed, once `recruitStage === 'Signed'` —
   * null while still undecided. NOT derivable from `Player.TeamIndex` (stays
   * a sentinel `255` for a prospect even after signing, confirmed directly)
   * — resolved instead via a leaguewide reverse lookup over every team's own
   * `CommittedPlayers` list (see `buildSignedDestinationMap`), the only
   * reliable source. Covers both "signed with us" and "signed elsewhere".
   * This is also the correct string to hand to `TeamLogo`'s `assetName` prop
   * — despite the prop's name, this app's logo lookup is keyed by normalized
   * *display* name (see `assetMapping.ts`'s `TEAM_3D_LOGOS`/`canonicalKey`),
   * not the save's own raw `Team.AssetName` field (e.g. `"hurricanes"`),
   * which doesn't match anything and silently falls back to a generic mark —
   * confirmed directly after an earlier version of this field used the raw
   * `AssetName` and shipped broken logos.
   */
  signedTeamDisplayName: string | null;
}

/** Same offset/format helpers as extract-roster.ts — kept in sync deliberately rather than shared, since recruits and roster players are different enough (no jersey/redshirt/captain fields here) that a shared helper module would need its own indirection for little real benefit. */
const WEIGHT_OFFSET = 160;

function formatArchetype(playerType: string): string {
  const withoutPositionPrefix = playerType.replace(/^[A-Z0-9]+_/, '');
  return withoutPositionPrefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function formatDevTrait(traitDevelopment: string): string {
  return traitDevelopment.replace(/^College_/, '').replace(/_/g, ' ');
}

const STAR_WORDS: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/** ProspectStarRating is a string enum ("ONE_STAR".."FIVE_STAR"), not a raw number — confirmed directly against real save data (a plain `Number(...)` silently produced NaN/null for every recruit). 0 for any unrecognized value rather than throwing, since a recruit with no rating yet is a real, unremarkable state (not corrupt data). */
function parseStarRating(raw: string): number {
  const word = raw.split('_')[0];
  return STAR_WORDS[word] ?? 0;
}

/**
 * Builds a leaguewide `playerId -> destination team display name` lookup
 * from every real team's own `CommittedPlayers` list (up to 35 real `Player`
 * slots each — same shape as a recruiting board, but holding prospects who
 * signed *with that team*, not just prospects it's pursuing). This is the
 * only reliable way to answer "who did this recruit actually sign with" —
 * verified directly: the leaguewide total this produces (1,538 on a real
 * save) exactly matches the count of `Recruit` rows with `RecruitStage ===
 * 'Signed'`, and building the full reverse map found zero players appearing
 * in more than one team's list (a clean, exclusive source, not a guess).
 */
export async function buildSignedDestinationMap(
  franchise: OpenFranchise,
  teamTable: { records: FranchiseRecord[] },
): Promise<Map<number, string>> {
  await preloadAllInstances(franchise, 'Player[]');

  const map = new Map<number, string>();
  for (const team of nonEmpty(teamTable.records as FranchiseRecord[])) {
    const committed = resolveReferenceWithTable(franchise, team, 'CommittedPlayers');
    if (!committed) continue;
    const displayName = String(team.DisplayName);
    for (const slotKey of Object.keys(committed.record.fields)) {
      const player = resolveReferenceWithTable(franchise, committed.record, slotKey);
      if (!player || !player.record.PresentationId) continue;
      map.set(Number(player.record.PresentationId), displayName);
    }
  }
  return map;
}

function mapRecruit(
  target: FranchiseRecord,
  recruit: FranchiseRecord,
  player: FranchiseRecord,
  signedDestinations: Map<number, string>,
): RecruitData {
  const playerId = Number(player.PresentationId);
  const destination = String(recruit.RecruitStage) === 'Signed' ? signedDestinations.get(playerId) : undefined;
  return {
    playerId,
    firstName: String(player.FirstName),
    lastName: String(player.LastName),
    position: String(player.Position),
    stars: parseStarRating(String(player.ProspectStarRating)),
    overallRating: Number(player.OverallRating),
    archetype: formatArchetype(String(player.PlayerType)),
    developmentTrait: formatDevTrait(String(player.TraitDevelopment)),
    heightInches: Number(player.Height),
    weightPounds: Number(player.Weight) + WEIGHT_OFFSET,
    hometown: String(player.PLYR_HOME_TOWN),
    homeState: String(player.PLYR_HOME_STATE),
    /** Recruits are Player rows (see this file's own doc comment), so they carry the same real portrait fields roster players do — confirmed directly against a real save (every one of a real team's 35 board slots had a populated GenericHeadAssetName). Same field/format as extract-roster.ts's portraitAssetName. */
    portraitAssetName: String(player.GenericHeadAssetName || '').trim() || null,
    classYear: String(recruit.Class),
    nationalRank: Number(recruit.NationalRank),
    positionRank: Number(recruit.PositionRank),
    stateRank: Number(recruit.StateRank),
    recruitStage: String(recruit.RecruitStage),
    scholarshipStatus: String(target.ScholarshipStatus),
    isFavorite: Boolean(target.IsFavorite),
    nilExpectation: Number(target.NILExpectation),
    currentNilOffer: Number(target.CurrentNILOffer),
    committedWeekNumber: Number(target.CommittedWeekNumber),
    signedTeamDisplayName: destination ?? null,
  };
}

export async function extractRecruits(franchise: OpenFranchise, userTeamIndex: number): Promise<RecruitData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords(['TeamIndex', 'DisplayName', 'RecruitingBoard', 'CommittedPlayers']);
  const teamRow = nonEmpty(teamTable.records).find((r) => Number(r.TeamIndex) === userTeamIndex);
  if (!teamRow) return [];

  // RecruitingBoard -> Recruits (a "RecruitTarget[]" array table, same literal-
  // brackets naming gotcha as SeasonStats[]/GameStats[]/HeismanAwardRanking[]
  // elsewhere in this codebase) -> up to 35 UserRecruitTarget slots -> each
  // one's own Recruit -> that Recruit's own Player. Every link in this chain
  // needs its target table preloaded before resolution works.
  await Promise.all([
    preloadAllInstances(franchise, 'RecruitingBoard'),
    preloadAllInstances(franchise, 'RecruitTarget[]'),
    preloadAllInstances(franchise, 'UserRecruitTarget'),
    preloadAllInstances(franchise, 'Recruit'),
    preloadAllInstances(franchise, 'Player', PLAYER_FIELDS),
  ]);

  const signedDestinations = await buildSignedDestinationMap(franchise, teamTable);

  const board = resolveReferenceWithTable(franchise, teamRow, 'RecruitingBoard');
  if (!board) return [];
  const recruitSlots = resolveReferenceWithTable(franchise, board.record, 'Recruits');
  if (!recruitSlots) return [];

  const results: RecruitData[] = [];
  for (const slotKey of Object.keys(recruitSlots.record.fields)) {
    const target = resolveReferenceWithTable(franchise, recruitSlots.record, slotKey);
    if (!target) continue;
    const recruit = resolveReferenceWithTable(franchise, target.record, 'Recruit');
    if (!recruit) continue;
    const player = resolveReferenceWithTable(franchise, recruit.record, 'Player');
    if (!player || !player.record.LastName) continue;
    results.push(mapRecruit(target.record, recruit.record, player.record, signedDestinations));
  }
  return results;
}
