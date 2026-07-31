/**
 * Every `Player` attribute the extraction pipeline reads, in one list.
 *
 * WHY THIS EXISTS. `readRecords()` with no arguments loads every attribute of
 * every row, and `Player` is the biggest table in the save (~16,500 rows, 100+
 * attributes). Measured on a real save: the full read is **767 ms**, this
 * subset is **82 ms**. Five separate places used to trigger the full read —
 * `extract-league-roster` directly, plus `preloadAllInstances(franchise,
 * 'Player')` in awards, recruits, national recruits and departures — so the
 * cost was paid by whichever ran first and the rest rode along on the cache.
 *
 * ONE SHARED LIST, NOT A LIST PER CALL SITE. An attribute that isn't loaded
 * doesn't throw — the field simply isn't there, so `Number(...)` yields NaN and
 * `String(...)` yields "undefined", and the wrong value is written to the
 * archive silently. A single list means a new field is added in one place and
 * every reader gets it, rather than four lists drifting apart.
 *
 * ADDING A FIELD: put it here. Then re-run the extraction and diff the output
 * against a run from before the change — an unloaded attribute shows up as NaN
 * or "undefined" in the JSON, so the diff catches a missed field.
 *
 * The WRITE paths (`editorWrite.ts`, `recruitingWrite.ts`) deliberately do NOT
 * use this: they open their own franchise file and write arbitrary fields back,
 * so they keep the unrestricted read.
 */
export const PLAYER_FIELDS = [
  // Identity and bio — extract-roster's mapPlayer, the gamelog's per-entry
  // identity, departures, and the award winner rows.
  'PresentationId',
  'FirstName',
  'LastName',
  'TeamIndex',
  'Position',
  'JerseyNum',
  'SchoolYear',
  'OverallRating',
  'CurrentNILCompensation',
  'PlayerType',
  'TraitDevelopment',
  'Height',
  'Weight',
  'PLYR_HOME_TOWN',
  'PLYR_HOME_STATE',
  'RedshirtStatus',
  'GenericHeadAssetName',
  'PLYR_ISCAPTAIN',

  // Stat-table references — resolved, not read as values (extract-stats,
  // extract-kicking, extract-gamelog, extract-league-roster).
  'CareerStats',
  'SeasonStats',
  'GameStats',

  // Recruiting — recruits are Player rows too (extract-recruits,
  // extract-national-recruits).
  'ProspectStarRating',
  'HomePipeline',
  'RecruitingDealbreaker',
  'IdealRecruitingPitch',
  'BaseNILValue',
  'SpeedRating',
  'AccelerationRating',
  'AgilityRating',
  'StrengthRating',
  'AwarenessRating',
  'JumpingRating',
];
