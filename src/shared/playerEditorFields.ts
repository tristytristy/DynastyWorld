/**
 * Maps every editable Player rating to its real madden-franchise schema field
 * name. Verified against the real CFB27 schema (node_modules/madden-franchise/
 * data/schemas/27/C27_468_2.gz) and live-checked against a real save — not
 * guessed from the abbreviation alone. All plain rating fields are `int`,
 * 0-127, except OverallRating (0-100).
 */
export interface RatingFieldDef {
  key: string;
  abbr: string;
  schemaField: string;
  min: number;
  max: number;
}

export const RATING_SECTIONS: { title: string; fields: RatingFieldDef[] }[] = [
  {
    title: 'Physical / General',
    fields: [
      { key: 'ovr', abbr: 'OVR', schemaField: 'OverallRating', min: 0, max: 100 },
      { key: 'str', abbr: 'STR', schemaField: 'StrengthRating', min: 0, max: 127 },
      { key: 'agi', abbr: 'AGI', schemaField: 'AgilityRating', min: 0, max: 127 },
      { key: 'cod', abbr: 'COD', schemaField: 'ChangeOfDirectionRating', min: 0, max: 127 },
      { key: 'spd', abbr: 'SPD', schemaField: 'SpeedRating', min: 0, max: 127 },
      { key: 'acc', abbr: 'ACC', schemaField: 'AccelerationRating', min: 0, max: 127 },
      { key: 'sta', abbr: 'STA', schemaField: 'StaminaRating', min: 0, max: 127 },
      { key: 'awr', abbr: 'AWR', schemaField: 'AwarenessRating', min: 0, max: 127 },
      { key: 'jmp', abbr: 'JMP', schemaField: 'JumpingRating', min: 0, max: 127 },
      { key: 'inj', abbr: 'INJ', schemaField: 'InjuryRating', min: 0, max: 127 },
      { key: 'tgh', abbr: 'TGH', schemaField: 'ToughnessRating', min: 0, max: 127 },
    ],
  },
  {
    title: 'Passing',
    fields: [
      { key: 'thp', abbr: 'THP', schemaField: 'ThrowPowerRating', min: 0, max: 127 },
      { key: 'tas', abbr: 'TAS', schemaField: 'ThrowAccuracyShortRating', min: 0, max: 127 },
      { key: 'tad', abbr: 'TAD', schemaField: 'ThrowAccuracyDeepRating', min: 0, max: 127 },
      { key: 'tor', abbr: 'TOR', schemaField: 'ThrowOnTheRunRating', min: 0, max: 127 },
      { key: 'pac', abbr: 'PAC', schemaField: 'PlayActionRating', min: 0, max: 127 },
      { key: 'tup', abbr: 'TUP', schemaField: 'ThrowUnderPressureRating', min: 0, max: 127 },
      { key: 'bsk', abbr: 'BSK', schemaField: 'BreakSackRating', min: 0, max: 127 },
      { key: 'ta', abbr: 'TA', schemaField: 'ThrowAccuracyRating', min: 0, max: 127 },
      { key: 'tam', abbr: 'TAM', schemaField: 'ThrowAccuracyMidRating', min: 0, max: 127 },
    ],
  },
  {
    title: 'Ball Carrier',
    fields: [
      { key: 'trk', abbr: 'TRK', schemaField: 'TruckingRating', min: 0, max: 127 },
      { key: 'sfa', abbr: 'SFA', schemaField: 'StiffArmRating', min: 0, max: 127 },
      { key: 'spm', abbr: 'SPM', schemaField: 'SpinMoveRating', min: 0, max: 127 },
      { key: 'jkm', abbr: 'JKM', schemaField: 'JukeMoveRating', min: 0, max: 127 },
      { key: 'car', abbr: 'CAR', schemaField: 'CarryingRating', min: 0, max: 127 },
      { key: 'btk', abbr: 'BTK', schemaField: 'BreakTackleRating', min: 0, max: 127 },
      { key: 'bcv', abbr: 'BCV', schemaField: 'BCVisionRating', min: 0, max: 127 },
    ],
  },
  {
    title: 'Receiving',
    fields: [
      { key: 'cth', abbr: 'CTH', schemaField: 'CatchingRating', min: 0, max: 127 },
      { key: 'cit', abbr: 'CIT', schemaField: 'CatchInTrafficRating', min: 0, max: 127 },
      { key: 'srr', abbr: 'SRR', schemaField: 'ShortRouteRunningRating', min: 0, max: 127 },
      { key: 'mrr', abbr: 'MRR', schemaField: 'MediumRouteRunningRating', min: 0, max: 127 },
      { key: 'drr', abbr: 'DRR', schemaField: 'DeepRouteRunningRating', min: 0, max: 127 },
      { key: 'spc', abbr: 'SPC', schemaField: 'SpectacularCatchRating', min: 0, max: 127 },
      { key: 'rls', abbr: 'RLS', schemaField: 'ReleaseRating', min: 0, max: 127 },
    ],
  },
  {
    title: 'Defense',
    fields: [
      { key: 'tak', abbr: 'TAK', schemaField: 'TackleRating', min: 0, max: 127 },
      { key: 'pmv', abbr: 'PMV', schemaField: 'PowerMovesRating', min: 0, max: 127 },
      { key: 'fmv', abbr: 'FMV', schemaField: 'FinesseMovesRating', min: 0, max: 127 },
      { key: 'bsh', abbr: 'BSH', schemaField: 'BlockSheddingRating', min: 0, max: 127 },
      { key: 'pur', abbr: 'PUR', schemaField: 'PursuitRating', min: 0, max: 127 },
      { key: 'prc', abbr: 'PRC', schemaField: 'PlayRecognitionRating', min: 0, max: 127 },
      { key: 'mcv', abbr: 'MCV', schemaField: 'ManCoverageRating', min: 0, max: 127 },
      { key: 'zcv', abbr: 'ZCV', schemaField: 'ZoneCoverageRating', min: 0, max: 127 },
      { key: 'prs', abbr: 'PRS', schemaField: 'PressRating', min: 0, max: 127 },
      { key: 'htp', abbr: 'HTP', schemaField: 'HitPowerRating', min: 0, max: 127 },
    ],
  },
  {
    title: 'Blocking',
    fields: [
      { key: 'pbk', abbr: 'PBK', schemaField: 'PassBlockRating', min: 0, max: 127 },
      { key: 'rbk', abbr: 'RBK', schemaField: 'RunBlockRating', min: 0, max: 127 },
      { key: 'lbk', abbr: 'LBK', schemaField: 'LeadBlockRating', min: 0, max: 127 },
      { key: 'pbp', abbr: 'PBP', schemaField: 'PassBlockPowerRating', min: 0, max: 127 },
      { key: 'pbf', abbr: 'PBF', schemaField: 'PassBlockFinesseRating', min: 0, max: 127 },
      { key: 'rbp', abbr: 'RBP', schemaField: 'RunBlockPowerRating', min: 0, max: 127 },
      { key: 'rbf', abbr: 'RBF', schemaField: 'RunBlockFinesseRating', min: 0, max: 127 },
      { key: 'iblk', abbr: 'IBLK', schemaField: 'ImpactBlockingRating', min: 0, max: 127 },
    ],
  },
];

export const ALL_RATING_FIELDS: RatingFieldDef[] = RATING_SECTIONS.flatMap((s) => s.fields);

export const SKILL_GROUP_CAP_FIELDS = [1, 2, 3, 4, 5, 6].map((n) => ({
  key: `skillGroupCap${n}`,
  schemaField: `SkillGroupCap${n}`,
  label: `Skill Group Cap ${n}`,
}));

/** Real MentalAbilities enum values from the CFB27 schema (sentinel First_/Last_/Count_ entries excluded). */
export const MENTAL_ABILITY_OPTIONS = [
  'None',
  'RoadFanFavorite',
  'Toughness',
  'FieldGeneral',
  'ClutchKicker',
  'Captain',
  'TeamPlayer',
  'ClearHeaded',
  'Headstrong',
  'Adrenaline',
  'HomeFanFavorite',
  'WinningTime',
  'TheNatural',
  'Rhythm',
  'BestFriend',
  'OLRally',
  'DLRally',
  'DBRally',
  'BellCow',
  'Instinct',
  'HotHead',
];

/** Real AbilitiesRank tier enum — shared by MentalAbilityRank1-3 and PhysicalAbility1-5. */
export const ABILITY_TIER_OPTIONS = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];

export const MENTAL_ABILITY_FIELDS = [1, 2, 3].map((n) => ({
  abilityKey: `mentalAbility${n}`,
  abilitySchemaField: `MentalAbility${n}`,
  rankKey: `mentalAbilityRank${n}`,
  rankSchemaField: `MentalAbilityRank${n}`,
}));

/**
 * Physical ability slot NAMES (e.g. "360", "Cutter") are archetype-specific
 * and not present anywhere in the static schema — the real save resolves them
 * from per-player signature-ability join tables at runtime, which this app
 * doesn't read (a real scope cut, not an oversight). Slots are shown here as
 * plain numbered tiers only.
 */
export const PHYSICAL_ABILITY_FIELDS = [1, 2, 3, 4, 5].map((n) => ({
  key: `physicalAbility${n}`,
  schemaField: `PhysicalAbility${n}`,
  label: `Physical Ability ${n}`,
}));
