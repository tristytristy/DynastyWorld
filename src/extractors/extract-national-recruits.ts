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
 * One school pursuing a recruit, from the recruit's own top-schools list
 * (`Recruit.TopSchoolsList` -> `ProspectTargetSchool[]` -> up to 10
 * `ProspectTargetSchool` rows, each with a `TeamId` = Team.TeamIndex and a
 * 0-99 `TeamInfluence`). Sorted by influence descending — the recruiting
 * battle at a glance. Verified against a real save (e.g. #4 QB Mike Pugh:
 * Alabama 69, LSU 68, USC 65, Texas 64, Ohio State 63...).
 */
export interface NationalRecruitSchool {
  teamIndex: number;
  teamName: string;
  influence: number;
}

/**
 * A single prospect from the LEAGUE-WIDE recruit pool — the whole national
 * board (~2,950 rows on a real preseason save), not the user's own 35-slot
 * board (that's `extract-recruits.ts`). Read straight off the `Recruit` table
 * and its resolved `Player` (recruits are Player rows, `TeamIndex` sentinel
 * 255 until signed) — no `UserRecruitTarget` here, since board-specific fields
 * (scholarship/influence/NIL offer) only exist for recruits a team has added.
 */
export interface NationalRecruitData {
  /** Player.PresentationId — stable leaguewide identity, same convention as roster/awards/board recruits. */
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
  /** Recruiting pipeline region (Player.HomePipeline, e.g. "North Texas") — humanized. */
  pipeline: string;
  portraitAssetName: string | null;
  classYear: string;
  nationalRank: number;
  positionRank: number;
  stateRank: number;
  /** Leaguewide decision-funnel stage (Top10/Top5/Top3/SoftCommitted/Signed/Battle). */
  recruitStage: string;
  /** Recruit.QualityModifier — NORMAL/GEM/BUST. Mostly NORMAL until the game reveals gem/bust via scouting. */
  gemBust: string;
  /** Recruit.CommitScore — the game's own "how locked in" metric (~0-1000 range observed). */
  commitScore: number;
  totalOffers: number;
  /** Player.RecruitingDealbreaker — the single thing this recruit cares most about (humanized). */
  dealbreaker: string;
  /** Player.IdealRecruitingPitch — the pitch this recruit most wants to hear (humanized). */
  idealPitch: string;
  baseNilValue: number;
  /** A compact universal-athletic snapshot (0-99) — enough to show an athletic profile and derive rough strengths/weaknesses across any position without extracting all ~45 ratings. */
  athletic: {
    speed: number;
    acceleration: number;
    agility: number;
    strength: number;
    awareness: number;
    jumping: number;
  };
  /** Up to 10 pursuing schools, sorted by influence desc. */
  topSchools: NationalRecruitSchool[];
}

const WEIGHT_OFFSET = 160;

const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function parseStarRating(raw: string): number {
  return STAR_WORDS[raw.split('_')[0]] ?? 0;
}

/** camelCase / Prefixed_Enum -> human words: "NorthTexas"->"North Texas", "College_Elite"->"Elite", "QB_Improviser"->"Improviser". */
function humanizeEnum(raw: string, stripPrefixes = true): string {
  if (!raw || raw === 'Invalid' || raw === 'Invalid_' || raw === 'None') return '';
  let s = raw;
  if (stripPrefixes) s = s.replace(/^(College_|QB_|RB_|WR_|TE_|OT_|OG_|C_|OL_|DE_|DT_|DL_|LB_|MLB_|OLB_|CB_|FS_|SS_|DB_|S_|K_|P_)/, '');
  s = s.replace(/_/g, ' ');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return s.trim();
}

function mapRecruit(
  recruit: FranchiseRecord,
  player: FranchiseRecord,
  topSchools: NationalRecruitSchool[],
): NationalRecruitData {
  return {
    playerId: Number(player.PresentationId),
    firstName: String(player.FirstName),
    lastName: String(player.LastName),
    position: String(player.Position),
    archetype: humanizeEnum(String(player.PlayerType)),
    stars: parseStarRating(String(player.ProspectStarRating)),
    overallRating: Number(player.OverallRating),
    developmentTrait: humanizeEnum(String(player.TraitDevelopment)),
    heightInches: Number(player.Height),
    weightPounds: Number(player.Weight) + WEIGHT_OFFSET,
    hometown: String(player.PLYR_HOME_TOWN),
    homeState: String(player.PLYR_HOME_STATE),
    pipeline: humanizeEnum(String(player.HomePipeline), false),
    portraitAssetName: String(player.GenericHeadAssetName || '').trim() || null,
    classYear: String(recruit.Class),
    nationalRank: Number(recruit.NationalRank),
    positionRank: Number(recruit.PositionRank),
    stateRank: Number(recruit.StateRank),
    recruitStage: String(recruit.RecruitStage),
    gemBust: String(recruit.QualityModifier),
    commitScore: Number(recruit.CommitScore),
    totalOffers: Number(recruit.TotalScholarshipOffers),
    dealbreaker: humanizeEnum(String(player.RecruitingDealbreaker)),
    idealPitch: humanizeEnum(String(player.IdealRecruitingPitch)),
    baseNilValue: Number(player.BaseNILValue),
    athletic: {
      speed: Number(player.SpeedRating),
      acceleration: Number(player.AccelerationRating),
      agility: Number(player.AgilityRating),
      strength: Number(player.StrengthRating),
      awareness: Number(player.AwarenessRating),
      jumping: Number(player.JumpingRating),
    },
    topSchools,
  };
}

function resolveTopSchools(
  franchise: OpenFranchise,
  recruit: FranchiseRecord,
  teamNameByIndex: Map<number, string>,
): NationalRecruitSchool[] {
  const list = resolveReferenceWithTable(franchise, recruit, 'TopSchoolsList');
  if (!list) return [];

  const schools: NationalRecruitSchool[] = [];
  for (const slotKey of Object.keys(list.record.fields)) {
    const entry = resolveReferenceWithTable(franchise, list.record, slotKey);
    if (!entry) continue;
    const teamIndex = Number(entry.record.TeamId);
    const teamName = teamNameByIndex.get(teamIndex);
    if (!teamName) continue;
    schools.push({ teamIndex, teamName, influence: Number(entry.record.TeamInfluence) });
  }
  return schools.sort((a, b) => b.influence - a.influence);
}

/**
 * Extracts the entire league-wide recruit pool for a season. Iterates the
 * `Recruit` table directly (not a team's board), resolving each row's `Player`
 * for bio/ratings and its `TopSchoolsList` for the recruiting battle. Skips
 * empty/placeholder rows (no resolvable player last name), matching how
 * extract-recruits guards the board chain.
 */
export async function extractNationalRecruits(franchise: OpenFranchise): Promise<NationalRecruitData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords(['TeamIndex', 'DisplayName']);
  const teamNameByIndex = new Map<number, string>();
  for (const t of nonEmpty(teamTable.records)) {
    if (t.DisplayName) teamNameByIndex.set(Number(t.TeamIndex), String(t.DisplayName));
  }

  // Every link in Recruit -> Player and Recruit -> TopSchoolsList (a
  // ProspectTargetSchool[] container) -> ProspectTargetSchool needs its target
  // table instances preloaded before reference resolution works.
  await Promise.all([
    preloadAllInstances(franchise, 'Recruit'),
    preloadAllInstances(franchise, 'Player', PLAYER_FIELDS),
    preloadAllInstances(franchise, 'ProspectTargetSchool[]'),
    preloadAllInstances(franchise, 'ProspectTargetSchool'),
  ]);

  const recruitTable = getLargestTable(franchise, 'Recruit');

  const results: NationalRecruitData[] = [];
  for (const recruit of nonEmpty(recruitTable.records)) {
    const player = resolveReferenceWithTable(franchise, recruit, 'Player');
    if (!player || !String(player.record.LastName || '').trim()) continue;
    const topSchools = resolveTopSchools(franchise, recruit, teamNameByIndex);
    results.push(mapRecruit(recruit, player.record, topSchools));
  }
  return results;
}
