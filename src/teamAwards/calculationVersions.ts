/**
 * Bumped whenever a shipped award's formula changes. A result row's own
 * `calculation_version` is never rewritten retroactively when this changes —
 * historical seasons keep the version they were actually calculated with
 * (see awardPersistence.ts) so a formula tweak never silently reinterprets a
 * past season's confirmed winner.
 */
export const TEAM_AWARDS_VERSION = 'team-awards-v1';
