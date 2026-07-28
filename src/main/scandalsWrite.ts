import { getDynastyById } from '../database/helpers';
import { extractAll } from '../extractors/extract-all';
import { persistExtraction } from '../database/importExtraction';
import { backupSaveFile } from './editorWrite';
import { getLargestTable, nonEmpty, openFranchiseFile, type FranchiseRecord, type OpenFranchise } from '../extractors/lib/franchise';
import type { SaveEditResult, ScandalsData, ScandalsEdit } from '../shared/types';

/**
 * "Scandals" — the user coach's cheat panel. Everything here writes directly to
 * the save file, so every field was proven to round-trip on a disposable copy
 * before being exposed (write → save → reopen from disk → compare).
 *
 * The bit widths below are read from the save's own offset table, and they are
 * NOT cosmetic. These fields are packed to the bit, and an over-large value
 * wraps silently rather than erroring: writing 5000 recruiting hours into a
 * 12-bit field stored 904 (5000 − 4096) and looked like a successful save. Every
 * value is therefore clamped to what the field can physically hold.
 */

/** Ceiling for each editable field, derived from its real bit width in the save. */
const LIMITS = {
  recruitingHours: 4095, // 12-bit
  experiencePoints: 1048575, // 20-bit
  level: 127, // 7-bit
  coachPoints: 4095, // 12-bit
  prestigeScore: 16383, // 14-bit
  jobSecurity: 100, // 7-bit field, but it's a percentage — cap at 100, not 127
  contractPoints: 1023, // 10-bit
  positionXp: 511, // 9-bit
} as const;

/** Valid enum values, per PocketScout's testing — anything else is rejected by the game. */
export const COACH_XP_SPEEDS = ['Slowest', 'Normal', 'Fastest'] as const;
export const TALENT_PROGRESS_SPEEDS = ['Slowest', 'Slow', 'Normal', 'Fast'] as const;

/** The positions ProgressionXPSlider carries, in depth-chart order. */
export const XP_SLIDER_POSITIONS = [
  'QB', 'HB', 'FB', 'WR', 'TE', 'T', 'G', 'C',
  'DE', 'DT', 'OLB', 'MLB', 'CB', 'FS', 'SS', 'K', 'P', 'LS',
] as const;

/**
 * The coach talent trees, mapped to the subtree slots that back them.
 *
 * Nothing in the save names a tree: the subtree record holds only Version and
 * CoachPointsSpent, ActiveTalentTree holds a single pointer, and
 * CoachTalentEffects turned out to be per-coach effect values rather than a
 * talent catalog. The names live in the game's data files, not the save. So the
 * map below was derived from the league instead, across 414 coaches with points
 * spent:
 *
 *  - Coach.DominantArchetype names the archetype a coach has invested in, which
 *    cross-tabs against the slot they spent the most in (Architect → 4 for 25
 *    head coaches, Strategist → 6 for 24, Talent Developer → 8, and so on).
 *  - Slots 3, 5 and 7 are strictly nested inside 0, 1 and 2: not one coach in
 *    the league had spent in 3 without 0, 5 without 1, or 7 without 2. Those are
 *    second halves of the same tree, which is why 13 slots render as 10 trees.
 *  - Slots 9-12 are never touched by coordinators, matching the head-coach-only
 *    trees; 0-8 are shared with OC/DC.
 *
 * Order matches the game's own tree carousel.
 */
const TALENT_TREES: {
  key: string;
  name: string;
  slots: number[];
  confirmed: boolean;
  tierLabels?: string[];
}[] = [
  // CEO and Program Builder are confirmed by SHAPE, not spending: slot 12 holds
  // exactly 9 live nodes and slot 11 exactly 21, matching CEO's 9 one-off
  // talents and Program Builder's 7 talents of 3 levels.
  { key: 'ceo', name: 'CEO', slots: [12], confirmed: true },
  { key: 'programBuilder', name: 'Program Builder', slots: [11], confirmed: true },
  { key: 'recruiter', name: 'Recruiter', slots: [2, 7], confirmed: true, tierLabels: ['Recruiter', 'Elite Recruiter'] },
  { key: 'tactician', name: 'Tactician', slots: [1, 5], confirmed: true, tierLabels: ['Tactician', 'Scheme Guru'] },
  { key: 'motivator', name: 'Motivator', slots: [0, 3], confirmed: true, tierLabels: ['Motivator', 'Master Motivator'] },
  { key: 'architect', name: 'Architect', slots: [4], confirmed: true },
  { key: 'strategist', name: 'Strategist', slots: [6], confirmed: true },
  { key: 'talentDeveloper', name: 'Talent Developer', slots: [8], confirmed: true },
  // Slots 9 and 10 are identically shaped (4 single-level talents) and nobody in
  // the league owns one, since both sit behind a real-money gate. Which of the
  // two is which is still a coin flip.
  { key: 'rainmaker', name: 'Rainmaker', slots: [9], confirmed: false },
  { key: 'visionary', name: 'Visionary', slots: [10], confirmed: false },
];

/**
 * Every subtree is 33 nodes: one header node that gates the tier, then the
 * talents packed sequentially — block 0's levels first, then block 1's, and so
 * on. Trees are NOT all the same shape, so the layout is per slot.
 *
 * The shapes were read out of the save rather than assumed: for each slot, the
 * highest node index any coach in the league has ever had Owned or Purchasable
 * gives the number of live nodes. Slots 0-8 use all 32 (8 blocks × 4 levels),
 * slot 11 uses 21 (7 × 3) and slot 12 uses 9 (9 × 1) — matching Program Builder
 * and CEO exactly, which is what confirms those two labels. Slots 9 and 10 hold
 * 4 gated nodes each and nobody in the league owns one, because Rainmaker and
 * Visionary sit behind an MVP+ membership and a Madden 27 coach respectively.
 *
 * Block names come from the game's own tree screens. Their ORDER is assumed to
 * match the save's node order (row-major, as drawn) — the shapes and counts are
 * verified, the name-to-position pairing is not.
 */
const POSITION_BLOCKS = [
  'Passing Game (QB)', 'Running Game (HB/FB)', 'Receiving Game (WR/TE)', 'Blocking (OL)',
  'Defensive Line (DL)', 'Linebackers (LB)', 'Secondary (DB)', 'Specialists (K/P)',
];

const SLOT_LAYOUTS: Record<number, { levels: number; blocks: string[] }> = {
  // Motivator / Master Motivator
  0: { levels: 4, blocks: POSITION_BLOCKS },
  3: { levels: 4, blocks: POSITION_BLOCKS },
  // Tactician — same position groups, but Cross Training in place of Specialists
  1: { levels: 4, blocks: [...POSITION_BLOCKS.slice(0, 7), 'Cross Training'] },
  // Scheme Guru — the Tactician elite tier, with its own scheme-flavoured blocks
  5: {
    levels: 4,
    blocks: [
      'Fast Tempo Offense', 'Pass Game Offense', 'Ground & Pound Offense', 'Discipline & Communication (O)',
      'Fast Tempo Defense', 'Pass Game Defense', 'Ground & Pound Defense', 'Discipline & Communication (D)',
    ],
  },
  // Recruiter / Elite Recruiter
  2: { levels: 4, blocks: POSITION_BLOCKS },
  7: { levels: 4, blocks: POSITION_BLOCKS },
  // Architect, Strategist, Talent Developer
  4: { levels: 4, blocks: POSITION_BLOCKS },
  6: { levels: 4, blocks: POSITION_BLOCKS },
  8: { levels: 4, blocks: POSITION_BLOCKS },
  // Rainmaker / Visionary — single-tier talents behind a real-money gate
  9: { levels: 1, blocks: ['Deal Maker', 'Budget Booster', 'Stay Power', 'Contract Incentives'] },
  10: { levels: 1, blocks: ['Pro Pipeline', 'Practice Makes Perfect', 'Hot Start', 'Signing Bonus'] },
  // Program Builder — 7 talents of 3 levels
  11: {
    levels: 3,
    blocks: [
      'Stability Improvements', 'Set The Tone', 'Roster Retention', 'High Integrity',
      'Faster Progression', 'Relationship Builder', 'Strong Roots',
    ],
  },
  // CEO — 9 one-off talents
  12: {
    levels: 1,
    blocks: [
      'Gainz Getter', 'Second Chance', 'Lasting Impression', 'More The Merrier', 'Gasoline',
      'Last Dance', 'Dream School', 'Bundle Discount', 'Senior Superlatives',
    ],
  },
};

/** Falls back to the common shape so an unmapped slot is still editable. */
function layoutFor(slot: number): { levels: number; blocks: string[] } {
  return SLOT_LAYOUTS[slot] ?? { levels: 4, blocks: POSITION_BLOCKS };
}

/** Node index for a block/level within a slot, skipping the header at 0. */
function nodeIndex(slot: number, block: number, level: number): number {
  return 1 + block * layoutFor(slot).levels + level;
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), max));
}

function num(record: FranchiseRecord, key: string): number {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : 0;
}

/** Follows a reference field to the record it points at. */
function follow(franchise: OpenFranchise, record: FranchiseRecord, key: string):
  | { table: { name: string; records: FranchiseRecord[]; readRecords(a?: string[]): Promise<void> }; row: number }
  | null {
  const ref = record.getReferenceDataByKey(key);
  if (!ref) return null;
  const table = franchise.getTableById(ref.tableId) as unknown as {
    name: string;
    records: FranchiseRecord[];
    readRecords(a?: string[]): Promise<void>;
  } | null;
  return table ? { table, row: ref.rowNumber } : null;
}

async function findUserCoach(franchise: OpenFranchise): Promise<FranchiseRecord | null> {
  const table = getLargestTable(franchise, 'Coach');
  await table.readRecords();
  return nonEmpty(table.records).find((r) => String(r.IsUserControlled) === 'true') ?? null;
}

/**
 * The user's recruiting board, reached through their team rather than by
 * guessing a row: Team.RecruitingBoard is a reference, and board rows carry no
 * team id of their own.
 */
async function findRecruitingBoard(
  franchise: OpenFranchise,
  coach: FranchiseRecord,
): Promise<FranchiseRecord | null> {
  const teams = getLargestTable(franchise, 'Team');
  await teams.readRecords();
  const team = nonEmpty(teams.records).find((t) => Number(t.TeamIndex) === Number(coach.TeamIndex));
  if (!team) return null;
  const ref = follow(franchise, team, 'RecruitingBoard');
  if (!ref) return null;
  await ref.table.readRecords();
  return ref.table.records[ref.row] ?? null;
}

/**
 * Every talent node the coach has, via
 * Coach.ActiveTalentTree → TalentSubTreeStatusList → TalentSubTreeStatus[] →
 * each subtree's TalentStatus0..N. Slots are enumerated rather than hardcoded:
 * the layout differs between head coaches and coordinators, so a fixed index
 * list would silently skip or miss trees.
 */
async function collectTalentNodes(
  franchise: OpenFranchise,
  coach: FranchiseRecord,
): Promise<{ slot: number; record: FranchiseRecord; fields: string[] }[]> {
  const treeRef = follow(franchise, coach, 'ActiveTalentTree');
  if (!treeRef) return [];
  await treeRef.table.readRecords();
  const tree = treeRef.table.records[treeRef.row];
  if (!tree) return [];

  const listRef = follow(franchise, tree, 'TalentSubTreeStatusList');
  if (!listRef) return [];
  await listRef.table.readRecords();
  const list = listRef.table.records[listRef.row];
  if (!list) return [];

  const out: { slot: number; record: FranchiseRecord; fields: string[] }[] = [];
  for (const key of Object.keys(list.fields)) {
    const match = /^TalentSubTreeStatus(\d+)$/.exec(key);
    if (!match) continue;
    const subRef = follow(franchise, list, key);
    if (!subRef) continue;
    await subRef.table.readRecords();
    const sub = subRef.table.records[subRef.row];
    if (!sub || sub.isEmpty) continue;
    const fields = Object.keys(sub.fields).filter((f) => /^TalentStatus\d+$/.test(f));
    if (fields.length > 0) out.push({ slot: Number(match[1]), record: sub, fields });
  }
  return out;
}

/** Reads the current state of everything the Scandals panel can change. */
export async function getScandalsData(dynastyId: string): Promise<ScandalsData | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const franchise = await openFranchiseFile(dynasty.savePath);
  const coach = await findUserCoach(franchise);
  if (!coach) return null;

  const board = await findRecruitingBoard(franchise, coach);

  const league = getLargestTable(franchise, 'LeagueSetting');
  await league.readRecords();
  const settings = league.records[0];

  const sliders = getLargestTable(franchise, 'ProgressionXPSlider');
  await sliders.readRecords();
  const slider = sliders.records[0];

  const nodes = await collectTalentNodes(franchise, coach);

  // Only surface trees whose slots this coach actually has: coordinators carry
  // slots 0-8 and never the head-coach trees, so a fixed list would offer them
  // trees the game will never show.
  const bySlot = new Map(nodes.map((n) => [n.slot, n]));
  const talentTrees = TALENT_TREES.flatMap((tree) => {
    const present = tree.slots.filter((s) => bySlot.has(s));
    if (present.length === 0) return [];
    let total = 0;
    let owned = 0;
    let spent = 0;
    const tiers = present.map((slot, index) => {
      const entry = bySlot.get(slot)!;
      const layout = layoutFor(slot);
      // Only the live nodes count — the short trees leave the tail of their 33
      // unused, and counting those would report totals the game never shows.
      total += layout.blocks.length * layout.levels;
      spent += num(entry.record, 'CoachPointsSpent');

      // Count owned levels per block. Counting rather than finding the last
      // owned index keeps a gapped block honest instead of overstating it.
      const blocks = layout.blocks.map((name, block) => {
        let levels = 0;
        for (let level = 0; level < layout.levels; level += 1) {
          const field = entry.fields[nodeIndex(slot, block, level)];
          if (field && String(entry.record[field]) === 'Owned') levels += 1;
        }
        owned += levels;
        return { name, owned: levels };
      });

      return {
        slot,
        label: tree.tierLabels?.[index] ?? tree.name,
        levelsPerBlock: layout.levels,
        blocks,
        locked: String(entry.record[entry.fields[0]]) === 'Locked',
      };
    });
    return [{ ...tree, total, owned, spent, tiers }];
  });

  return {
    coachName: `${String(coach.FirstName)} ${String(coach.LastName)}`.trim(),
    recruitingHours: board ? num(board, 'RecruitingHoursTotal') : 0,
    experiencePoints: num(coach, 'ExperiencePoints'),
    level: num(coach, 'Level'),
    coachPoints: num(coach, 'CoachPoints'),
    prestigeScore: num(coach, 'CoachPrestigeScore'),
    jobSecurity: num(coach, 'CurrentJobSecurityPercentage'),
    contractPoints: num(coach, 'EarnedContractPoints_ThisYear'),
    coachXpSpeed: settings ? String(settings.CoachXPSpeedSetting ?? 'Normal') : 'Normal',
    talentProgressSpeed: settings ? String(settings.TalentProgressSpeed ?? 'Normal') : 'Normal',
    positionXp: Object.fromEntries(
      XP_SLIDER_POSITIONS.map((p) => [p, slider ? num(slider, p) : 100]),
    ) as Record<string, number>,
    // Live talents only — every subtree is 33 nodes on disk, but the short trees
    // leave the tail unused, and counting those would advertise talents the game
    // never shows.
    talentNodesTotal: talentTrees.reduce((sum, t) => sum + t.total, 0),
    talentNodesOwned: talentTrees.reduce((sum, t) => sum + t.owned, 0),
    talentTrees,
    limits: { ...LIMITS },
  };
}

/**
 * Applies an edit. Backs the save up first (a failed backup aborts), writes only
 * the fields actually supplied, then re-runs extraction so the app's own data
 * matches the save it just changed.
 */
export async function saveScandals(dynastyId: string, edit: ScandalsEdit): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  const backup = backupSaveFile(dynastyId);
  if (!backup.success) {
    return { success: false, message: `Backup failed, so nothing was changed. ${backup.message}` };
  }

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    const coach = await findUserCoach(franchise);
    if (!coach) return { success: false, message: 'No user-controlled coach in this save.' };

    const applied: string[] = [];

    if (edit.recruitingHours !== undefined) {
      const board = await findRecruitingBoard(franchise, coach);
      if (board) {
        board.RecruitingHoursTotal = clamp(edit.recruitingHours, LIMITS.recruitingHours);
        applied.push('recruiting hours');
      }
    }

    const coachFields: [keyof ScandalsEdit, string, number][] = [
      ['experiencePoints', 'ExperiencePoints', LIMITS.experiencePoints],
      ['level', 'Level', LIMITS.level],
      ['coachPoints', 'CoachPoints', LIMITS.coachPoints],
      ['prestigeScore', 'CoachPrestigeScore', LIMITS.prestigeScore],
      ['jobSecurity', 'CurrentJobSecurityPercentage', LIMITS.jobSecurity],
      ['contractPoints', 'EarnedContractPoints_ThisYear', LIMITS.contractPoints],
    ];
    for (const [key, field, max] of coachFields) {
      const value = edit[key];
      if (typeof value === 'number') {
        coach[field] = clamp(value, max);
        applied.push(field);
      }
    }

    if (edit.coachXpSpeed || edit.talentProgressSpeed) {
      const league = getLargestTable(franchise, 'LeagueSetting');
      await league.readRecords();
      const settings = league.records[0];
      if (settings) {
        if (edit.coachXpSpeed && (COACH_XP_SPEEDS as readonly string[]).includes(edit.coachXpSpeed)) {
          settings.CoachXPSpeedSetting = edit.coachXpSpeed;
          applied.push('coach XP speed');
        }
        if (
          edit.talentProgressSpeed &&
          (TALENT_PROGRESS_SPEEDS as readonly string[]).includes(edit.talentProgressSpeed)
        ) {
          settings.TalentProgressSpeed = edit.talentProgressSpeed;
          applied.push('talent progress speed');
        }
      }
    }

    if (edit.positionXp) {
      const sliders = getLargestTable(franchise, 'ProgressionXPSlider');
      await sliders.readRecords();
      const slider = sliders.records[0];
      if (slider) {
        for (const [position, value] of Object.entries(edit.positionXp)) {
          if (!(XP_SLIDER_POSITIONS as readonly string[]).includes(position)) continue;
          slider[position] = clamp(value, LIMITS.positionXp);
        }
        applied.push('position XP sliders');
      }
    }

    if (edit.talentUnlocks && Object.keys(edit.talentUnlocks).length > 0) {
      const nodes = await collectTalentNodes(franchise, coach);
      const bySlot = new Map(nodes.map((n) => [n.slot, n]));
      let changed = 0;
      const touched = new Set<number>();

      for (const [rawSlot, rawLevels] of Object.entries(edit.talentUnlocks)) {
        const slot = Number(rawSlot);
        const entry = bySlot.get(slot);
        // A slot this coach doesn't have is ignored rather than created:
        // coordinators simply have no head-coach trees.
        if (!entry || !Array.isArray(rawLevels)) continue;

        const layout = layoutFor(slot);
        let slotChanged = 0;
        for (let block = 0; block < layout.blocks.length; block += 1) {
          // Clamped to this slot's real level count, so a 4 aimed at a
          // single-level tree can't spill into the next block's nodes.
          const want = clamp(Number(rawLevels[block]) || 0, layout.levels);
          for (let level = 0; level < want; level += 1) {
            const field = entry.fields[nodeIndex(slot, block, level)];
            if (!field) continue;
            // Written straight to Owned: Locked means a prerequisite isn't met,
            // so anything gentler would leave most of the selection untouched.
            if (String(entry.record[field]) !== 'Owned') {
              entry.record[field] = 'Owned';
              slotChanged += 1;
            }
          }
        }

        // The header gates the whole tier — owning talents under a Locked header
        // would leave the tier shut in-game.
        if (slotChanged > 0) {
          const header = entry.fields[0];
          if (header && String(entry.record[header]) !== 'Owned') {
            entry.record[header] = 'Owned';
            slotChanged += 1;
          }
          changed += slotChanged;
          touched.add(slot);
        }
      }

      if (changed > 0) {
        const names = TALENT_TREES.filter((t) => t.slots.some((s) => touched.has(s))).map((t) => t.name);
        applied.push(`${changed} talent nodes (${names.join(', ')})`);
      }
    }

    if (applied.length === 0) {
      return { success: false, message: 'Nothing to change.' };
    }

    await franchise.save(dynasty.savePath, {});

    // Re-read the save so the app's own archive reflects what just changed.
    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    return { success: true, message: `Applied: ${applied.join(', ')}. Backup saved first.` };
  } catch (err) {
    return {
      success: false,
      message: `${err instanceof Error ? err.message : 'Write failed.'} Your pre-edit backup is safe.`,
    };
  }
}
