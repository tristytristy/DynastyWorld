import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  findRecordByPresentationId,
  getLargestTable,
  nonEmpty,
  openFranchiseFile,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
} from '../extractors/lib/franchise';
import { getDynastyById } from '../database/helpers';
import { extractAll } from '../extractors/extract-all';
import { persistExtraction } from '../database/importExtraction';
import {
  ALL_RATING_FIELDS,
  MENTAL_ABILITY_FIELDS,
  PHYSICAL_ABILITY_FIELDS,
  SKILL_GROUP_CAP_FIELDS,
} from '../shared/playerEditorFields';
import { classifyPortrait } from '../shared/portraitTaxonomy';
import type {
  CoachEditData,
  CoachEditFields,
  PlayerEditData,
  PlayerEditFields,
  PortraitFilters,
  PortraitSearchResponse,
  PortraitSearchResult,
  RecruitEditData,
  RecruitEditFields,
  SaveEditResult,
  SaveFileBackupResult,
  TeamBudgetData,
  TeamBudgetEdit,
} from '../shared/types';

/** Matches extract-roster.ts's documented empirical offset — kept in sync so the editor round-trips the same "real" pounds value the rest of the app already displays. */
const WEIGHT_OFFSET = 160;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readPlayerFields(r: FranchiseRecord): PlayerEditFields {
  const ratings: Record<string, number> = {};
  for (const f of ALL_RATING_FIELDS) ratings[f.key] = Number(r[f.schemaField]);

  const skillGroupCaps: Record<string, number> = {};
  for (const f of SKILL_GROUP_CAP_FIELDS) skillGroupCaps[f.key] = Number(r[f.schemaField]);

  const mentalAbilities: Record<string, string> = {};
  for (const f of MENTAL_ABILITY_FIELDS) {
    mentalAbilities[f.abilityKey] = String(r[f.abilitySchemaField]);
    mentalAbilities[f.rankKey] = String(r[f.rankSchemaField]);
  }

  const physicalAbilities: Record<string, string> = {};
  for (const f of PHYSICAL_ABILITY_FIELDS) physicalAbilities[f.key] = String(r[f.schemaField]);

  return {
    firstName: String(r.FirstName),
    lastName: String(r.LastName),
    position: String(r.Position),
    schoolYear: String(r.SchoolYear),
    redshirtStatus: String(r.RedshirtStatus),
    jerseyNumber: Number(r.JerseyNum),
    traitDevelopment: String(r.TraitDevelopment),
    age: Number(r.Age),
    heightInches: Number(r.Height),
    weightPounds: Number(r.Weight) + WEIGHT_OFFSET,
    personality: String(r.Personality),
    scheme: String(r.Scheme),
    role: String(r.Role),
    recruitingDealbreaker: String(r.RecruitingDealbreaker),
    idealRecruitingPitch: String(r.IdealRecruitingPitch),
    nilDemand: Number(r.BaseNILValue),
    skillPoints: Number(r.SkillPoints),
    isImpactPlayer: Boolean(r.IsImpactPlayer),
    isCreated: Boolean(r.IsCreated),
    isUserControlled: Boolean(r.IsUserControlled),
    portraitAssetName: String(r.GenericHeadAssetName || '').trim() || null,
    ratings,
    skillGroupCaps,
    mentalAbilities,
    physicalAbilities,
  };
}

function writePlayerFields(r: FranchiseRecord, fields: PlayerEditFields): void {
  r.FirstName = fields.firstName;
  r.LastName = fields.lastName;
  r.Position = fields.position;
  r.SchoolYear = fields.schoolYear;
  r.RedshirtStatus = fields.redshirtStatus;
  r.JerseyNum = fields.jerseyNumber;
  r.TraitDevelopment = fields.traitDevelopment;
  r.Age = fields.age;
  r.Height = fields.heightInches;
  r.Weight = fields.weightPounds - WEIGHT_OFFSET;
  r.Personality = fields.personality;
  r.Scheme = fields.scheme;
  r.Role = fields.role;
  r.RecruitingDealbreaker = fields.recruitingDealbreaker;
  r.IdealRecruitingPitch = fields.idealRecruitingPitch;
  // BaseNILValue is a signed 11-bit field ([-255, 1023]); clamp so an out-of-range
  // entry can't wrap to a garbage value the way an unclamped write once did.
  r.BaseNILValue = clamp(Math.round(fields.nilDemand), -255, 1023);
  // SkillPoints is an unsigned 15-bit field; clamp to its real range so an
  // over-range entry can't wrap to a garbage value (same guard as NIL/CoachPoints).
  r.SkillPoints = clamp(Math.round(fields.skillPoints), 0, 32767);
  r.IsImpactPlayer = fields.isImpactPlayer;
  r.IsCreated = fields.isCreated;
  r.IsUserControlled = fields.isUserControlled;
  if (fields.portraitAssetName) {
    // GenericHeadAssetName is descriptive only — the actual in-game 2D portrait render
    // reads PLYR_PORTRAIT (a plain int), confirmed via a real save to equal the "Generic_<N>_"
    // sequence number exactly for 7,243/7,244 real players. Writing only the string field left
    // the in-game portrait unchanged even though this app's own preview updated correctly.
    r.GenericHeadAssetName = fields.portraitAssetName;
    const genericSeq = fields.portraitAssetName.match(/^Generic_(\d+)_/);
    if (genericSeq) r.PLYR_PORTRAIT = Number(genericSeq[1]);
  }

  for (const f of ALL_RATING_FIELDS) {
    const value = fields.ratings[f.key];
    if (value !== undefined) r[f.schemaField] = clamp(Math.round(value), f.min, f.max);
  }
  for (const f of SKILL_GROUP_CAP_FIELDS) {
    const value = fields.skillGroupCaps[f.key];
    if (value !== undefined) r[f.schemaField] = value;
  }
  for (const f of MENTAL_ABILITY_FIELDS) {
    if (fields.mentalAbilities[f.abilityKey] !== undefined) r[f.abilitySchemaField] = fields.mentalAbilities[f.abilityKey];
    if (fields.mentalAbilities[f.rankKey] !== undefined) r[f.rankSchemaField] = fields.mentalAbilities[f.rankKey];
  }
  for (const f of PHYSICAL_ABILITY_FIELDS) {
    if (fields.physicalAbilities[f.key] !== undefined) r[f.schemaField] = fields.physicalAbilities[f.key];
  }
}

function readCoachFields(r: FranchiseRecord): CoachEditFields {
  return {
    firstName: String(r.FirstName),
    lastName: String(r.LastName),
    personality: String(r.Personality),
    coachPrestige: Number(r.CoachPrestigeScore),
    coachPoints: Number(r.CoachPoints),
    contractSalary: Number(r.ContractSalary),
    contractLength: Number(r.ContractLength),
    contractYearsRemaining: Number(r.ContractYearsRemaining),
    portraitAssetName: (String(r.AssetName || '') || String(r.GenericHeadAssetName || '') || '').trim() || null,
  };
}

function writeCoachFields(
  r: FranchiseRecord,
  fields: CoachEditFields,
  franchise?: Awaited<ReturnType<typeof openFranchiseFile>>,
): void {
  r.FirstName = fields.firstName;
  r.LastName = fields.lastName;
  r.Personality = fields.personality;
  r.CoachPrestigeScore = fields.coachPrestige;
  // CoachPoints is an unsigned 12-bit field (max 4095); clamp to PocketScout's
  // proven [0, 4000] so an over-range entry can't wrap to garbage.
  r.CoachPoints = clamp(Math.round(fields.coachPoints), 0, 4000);
  r.ContractSalary = fields.contractSalary;
  r.ContractLength = fields.contractLength;
  r.ContractYearsRemaining = fields.contractYearsRemaining;
  if (fields.portraitAssetName) {
    // Both name fields — reads prefer AssetName over GenericHeadAssetName
    // (see readCoachFields), so writing only the generic one left unique
    // coaches showing their old face even in this app's own preview.
    r.AssetName = fields.portraitAssetName;
    r.GenericHeadAssetName = fields.portraitAssetName;
    // Coach.Portrait (the int the game engine renders from, same role as the
    // player-side PLYR_PORTRAIT) is an arbitrary baked-in index with NO
    // derivable relationship to the asset name's number — confirmed
    // 2026-07-19 across two real saves: offsets between the asset number and
    // Portrait are all over the map (the once-suspected "+10 pattern" was
    // coincidental clustering). What IS reliable: within a save, every asset
    // name maps to exactly one Portrait value (zero conflicts across 448 and
    // 408 distinct assets on two real saves) — so the correct index for the
    // chosen face is copied from whichever coach already wears that asset.
    // No wearer in this save → Portrait is left untouched (the app's preview
    // still updates via the name fields; in-game face may lag, the same
    // honest limitation as before, now only for genuinely unmapped assets).
    if (franchise) {
      const table = getLargestTable(franchise, 'Coach');
      const wearer = nonEmpty(table.records).find(
        (row) =>
          row !== r &&
          ((String(row.AssetName || '') || String(row.GenericHeadAssetName || '')).trim() === fields.portraitAssetName),
      );
      if (wearer) r.Portrait = Number(wearer.Portrait);
    }
  }
}

/**
 * Coach.PresentationId is NOT reliably unique — verified against a real save:
 * 64 of 493 real coaches share id=0, and a genuine collision was found
 * between two different real coaches (id=256 matched both an OC and a head
 * coach on different teams). That's the opposite of Player.PresentationId,
 * which was separately verified unique across an entire real roster. A
 * team can only have one coach per position, so TeamIndex+Position is used
 * as the lookup key for Coach instead — confirmed unique across every real
 * team on that same save (the only collisions were TeamIndex 255, an
 * "unassigned" sentinel with no real coaches, not a real team).
 */
async function findCoachRecord(
  franchise: Awaited<ReturnType<typeof openFranchiseFile>>,
  teamIndex: number,
  position: string,
): Promise<FranchiseRecord | undefined> {
  const table = getLargestTable(franchise, 'Coach');
  await table.readRecords();
  return nonEmpty(table.records).find(
    (r) => Number(r.TeamIndex) === teamIndex && String(r.Position) === position,
  );
}

const STAR_ENUM_BY_COUNT: Record<number, string> = {
  1: 'ONE_STAR',
  2: 'TWO_STAR',
  3: 'THREE_STAR',
  4: 'FOUR_STAR',
  5: 'FIVE_STAR',
};
const STAR_COUNT_BY_ENUM: Record<string, number> = {
  ONE_STAR: 1,
  TWO_STAR: 2,
  THREE_STAR: 3,
  FOUR_STAR: 4,
  FIVE_STAR: 5,
};

/**
 * A recruit's editable data spans two records — `Recruit` (class year, the
 * three rank fields) and the `Player` it references (hometown, star rating)
 * — so lookup returns both rather than one `FranchiseRecord` like the
 * player/coach paths. `Recruit` is a leaguewide table (4,101+ rows on a real
 * save), so this is a linear scan by resolved `Player.PresentationId`, not a
 * team-scoped board lookup — the recruit being edited is already known to
 * exist on the user's board (the id came from `getRecruits`), and this just
 * needs the same id resolved back to its two source records for writing.
 */
async function findRecruitRecord(
  franchise: Awaited<ReturnType<typeof openFranchiseFile>>,
  playerId: number,
): Promise<{ recruit: FranchiseRecord; player: FranchiseRecord } | undefined> {
  const table = getLargestTable(franchise, 'Recruit');
  await table.readRecords();
  await preloadAllInstances(franchise, 'Player');
  for (const recruit of nonEmpty(table.records)) {
    const player = resolveReferenceWithTable(franchise, recruit, 'Player');
    if (player && Number(player.record.PresentationId) === playerId) {
      return { recruit, player: player.record };
    }
  }
  return undefined;
}

function readRecruitFields(recruit: FranchiseRecord, player: FranchiseRecord): RecruitEditFields {
  return {
    hometown: String(player.PLYR_HOME_TOWN),
    stars: STAR_COUNT_BY_ENUM[String(player.ProspectStarRating)] ?? 0,
    classYear: String(recruit.Class),
    nationalRank: Number(recruit.NationalRank),
    positionRank: Number(recruit.PositionRank),
    stateRank: Number(recruit.StateRank),
  };
}

/**
 * Only the fields verified safe via a real write -> save -> reopen round
 * trip against a disposable save are applied here — see RecruitEditFields'
 * own doc comment for what was tried and excluded (home state, top schools,
 * commitment status, signed school).
 */
function writeRecruitFields(recruit: FranchiseRecord, player: FranchiseRecord, fields: RecruitEditFields): void {
  player.PLYR_HOME_TOWN = fields.hometown;
  const starEnum = STAR_ENUM_BY_COUNT[fields.stars];
  if (starEnum) player.ProspectStarRating = starEnum;
  recruit.Class = fields.classYear;
  recruit.NationalRank = fields.nationalRank;
  recruit.PositionRank = fields.positionRank;
  recruit.StateRank = fields.stateRank;
}

export async function getRecruitEditData(dynastyId: string, playerId: number): Promise<RecruitEditData | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const franchise = await openFranchiseFile(dynasty.savePath);
  const found = await findRecruitRecord(franchise, playerId);
  if (!found) return null;
  return { playerId, fields: readRecruitFields(found.recruit, found.player) };
}

export async function saveRecruitEdits(
  dynastyId: string,
  playerId: number,
  fields: RecruitEditFields,
): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    const found = await findRecruitRecord(franchise, playerId);
    if (!found) return { success: false, message: 'Recruit not found in the save file.' };

    writeRecruitFields(found.recruit, found.player, fields);
    await franchise.save(dynasty.savePath, {});

    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    return { success: true, message: 'Saved.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Save failed unexpectedly.' };
  }
}

/**
 * Every write goes through this same open-find-edit-save-reextract sequence:
 * a fresh franchise open (never reusing a stale in-memory handle from a prior
 * read), locate the exact record, apply field edits, call franchise.save()
 * (overwrites the same file it was opened from — see madden-franchise's
 * packFile()), then re-run this app's own extraction/persist pipeline so the
 * SQLite snapshot — and therefore every other page in the app — reflects the
 * edit immediately instead of showing stale data until the next manual
 * re-import.
 */
async function withRecord<TFields>(
  dynastyId: string,
  find: (franchise: Awaited<ReturnType<typeof openFranchiseFile>>) => Promise<FranchiseRecord | undefined>,
  apply: (record: FranchiseRecord, fields: TFields) => void,
  fields: TFields,
): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    const record = await find(franchise);
    if (!record) return { success: false, message: 'Record not found in the save file.' };

    apply(record, fields);
    await franchise.save(dynasty.savePath, {});

    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    return { success: true, message: 'Saved.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Save failed unexpectedly.' };
  }
}

export async function getPlayerEditData(dynastyId: string, playerId: number): Promise<PlayerEditData | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const franchise = await openFranchiseFile(dynasty.savePath);
  const record = await findRecordByPresentationId(franchise, 'Player', playerId);
  if (!record) return null;
  return { id: playerId, fields: readPlayerFields(record) };
}

export function savePlayerEdits(
  dynastyId: string,
  playerId: number,
  fields: PlayerEditFields,
): Promise<SaveEditResult> {
  return withRecord(
    dynastyId,
    (franchise) => findRecordByPresentationId(franchise, 'Player', playerId),
    writePlayerFields,
    fields,
  );
}

export async function getCoachEditData(
  dynastyId: string,
  teamIndex: number,
  position: string,
): Promise<CoachEditData | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const franchise = await openFranchiseFile(dynasty.savePath);
  const record = await findCoachRecord(franchise, teamIndex, position);
  if (!record) return null;
  return { teamIndex, position, fields: readCoachFields(record) };
}

export function saveCoachEdits(
  dynastyId: string,
  teamIndex: number,
  position: string,
  fields: CoachEditFields,
): Promise<SaveEditResult> {
  // The franchise handle is captured from the find step so the writer can run
  // the asset→Portrait lookup against the already-loaded Coach table.
  let openedFranchise: Awaited<ReturnType<typeof openFranchiseFile>> | undefined;
  return withRecord(
    dynastyId,
    (franchise) => {
      openedFranchise = franchise;
      return findCoachRecord(franchise, teamIndex, position);
    },
    (record, f) => writeCoachFields(record, f, openedFranchise),
    fields,
  );
}

/**
 * The game caps a program's total points at 25,000 (matches PocketScout's own
 * limit) — clamping here keeps a fat-fingered entry from producing a nonsense
 * budget in the coach HUD.
 */
const MAX_PROGRAM_POINT_BUDGET = 25000;

async function findTeamRecord(
  franchise: Awaited<ReturnType<typeof openFranchiseFile>>,
  teamIndex: number,
): Promise<FranchiseRecord | undefined> {
  const table = getLargestTable(franchise, 'Team');
  await table.readRecords();
  return nonEmpty(table.records).find((r) => r.DisplayName && Number(r.TeamIndex) === teamIndex);
}

export async function getTeamBudgetData(dynastyId: string, teamIndex: number): Promise<TeamBudgetData | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const franchise = await openFranchiseFile(dynasty.savePath);
  const record = await findTeamRecord(franchise, teamIndex);
  if (!record) return null;
  return {
    teamIndex,
    teamName: String(record.DisplayName),
    fields: {
      programPointBudget: Number(record.ProgramPointBudget),
      remainingProgramPoints: Number(record.RemainingProgramPoints),
      nilProgramPointsSpent: Number(record.NILProgramPointsSpent),
      teamPrestige: Number(record.TeamPrestige),
    },
  };
}

/**
 * Writes a team's program-points budget. Only two plain integer fields are
 * touched — ProgramPointBudget and RemainingProgramPoints (unspent ≤ total) —
 * exactly the pair PocketScout's "Increase NIL Budget" edits, round-trip
 * verified on a disposable save. Auto-backs up first (this touches the Team
 * table the main player/coach editor never does), aborting the write if the
 * backup fails.
 */
export async function saveTeamBudget(
  dynastyId: string,
  teamIndex: number,
  edit: TeamBudgetEdit,
): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  const backup = backupSaveFile(dynastyId);
  if (!backup.success) {
    return { success: false, message: `Aborted — could not back up the save first: ${backup.message}` };
  }

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    const record = await findTeamRecord(franchise, teamIndex);
    if (!record) return { success: false, message: 'Team not found in the save file.' };

    const budget = clamp(Math.round(edit.programPointBudget), 0, MAX_PROGRAM_POINT_BUDGET);
    const remaining = clamp(Math.round(edit.remainingProgramPoints), 0, budget);
    record.ProgramPointBudget = budget;
    record.RemainingProgramPoints = remaining;

    await franchise.save(dynasty.savePath, {});

    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    return { success: true, message: 'Saved.' };
  } catch (err) {
    return {
      success: false,
      message: `Save failed (your pre-edit backup is safe: ${backup.filePath ?? 'save-backups'}). ${err instanceof Error ? err.message : ''}`.trim(),
    };
  }
}

export function backupSaveFile(dynastyId: string): SaveFileBackupResult {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(app.getPath('userData'), 'save-backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const originalName = path.basename(dynasty.savePath);
    const backupPath = path.join(backupDir, `${originalName}-${timestamp}`);
    fs.copyFileSync(dynasty.savePath, backupPath);
    return { success: true, message: `Save file backed up to ${backupPath}`, filePath: backupPath };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Backup failed unexpectedly.' };
  }
}

const PORTRAIT_DIRS: Record<'player' | 'coach', { dir: string; prefix: string }> = {
  player: { dir: 'playerportrait', prefix: 'nilpp_' },
  coach: { dir: 'coaches', prefix: 'nilcp_' },
};

const PORTRAITS_PER_PAGE = 60;

/**
 * Reads the same asset folder the renderer already displays portraits from
 * (dist/renderer/assets/..., copied from public/assets/... at build time —
 * see webpack.config.js) to let the editor search across the full local
 * portrait library without shipping a 25,000+ entry list over IPC up front.
 *
 * Build/skin-tone filtering only applies to "Generic" portraits — see
 * shared/portraitTaxonomy.ts for how that classification was derived (cross-
 * referenced against real player Weight/Height/Position data, not guessed).
 * "Unique" portraits carry no such classification, so a build/skinTone
 * filter other than "all" naturally excludes them.
 */
export function searchPortraits(
  kind: 'player' | 'coach',
  query: string,
  filters: PortraitFilters,
  page: number,
): PortraitSearchResponse {
  const { dir, prefix } = PORTRAIT_DIRS[kind];
  const assetDir = path.join(__dirname, '../renderer/assets', dir);

  let files: string[];
  try {
    files = fs.readdirSync(assetDir);
  } catch {
    return { results: [], totalCount: 0 };
  }

  const normalizedQuery = query.trim().toLowerCase();
  const allMatches: PortraitSearchResult[] = [];

  for (const file of files) {
    if (!file.startsWith(prefix) || !file.endsWith('.webp')) continue;
    const assetName = file.slice(prefix.length, -'.webp'.length);
    if (normalizedQuery && !assetName.toLowerCase().includes(normalizedQuery)) continue;

    const meta = classifyPortrait(assetName);
    if (filters.type !== 'all' && meta.type !== filters.type) continue;
    if (filters.build !== 'all' && meta.build !== filters.build) continue;
    if (filters.skinTone !== 'all' && meta.skinTone !== filters.skinTone) continue;

    allMatches.push({ assetName, path: `assets/${dir}/${file}`, type: meta.type, build: meta.build, skinTone: meta.skinTone });
  }

  const start = Math.max(0, page) * PORTRAITS_PER_PAGE;
  return { results: allMatches.slice(start, start + PORTRAITS_PER_PAGE), totalCount: allMatches.length };
}
