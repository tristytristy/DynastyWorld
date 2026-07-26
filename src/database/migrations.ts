import schemaV1 from './schema.sql';
import schemaV2 from './schema_v2_ranking_history.sql';
import schemaV3 from './schema_v3_season_team.sql';
import schemaV4 from './schema_v4_season_history_only.sql';
import schemaV5 from './schema_v5_team_awards.sql';
import schemaV6 from './schema_v6_media.sql';
import schemaV7 from './schema_v7_player_notes.sql';
import schemaV8 from './schema_v8_season_coach.sql';
import schemaV9 from './schema_v9_season_phase.sql';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Ordered, append-only. Never edit a shipped migration's sql — add a new
 * entry with the next version number instead.
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial_schema', sql: schemaV1 },
  { version: 2, name: 'ranking_history', sql: schemaV2 },
  { version: 3, name: 'season_team', sql: schemaV3 },
  { version: 4, name: 'season_history_only', sql: schemaV4 },
  { version: 5, name: 'team_awards', sql: schemaV5 },
  { version: 6, name: 'media', sql: schemaV6 },
  { version: 7, name: 'player_notes', sql: schemaV7 },
  { version: 8, name: 'season_coach', sql: schemaV8 },
  { version: 9, name: 'season_phase', sql: schemaV9 },
];
