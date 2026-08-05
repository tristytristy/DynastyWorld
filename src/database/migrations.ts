import schemaV1 from './schema.sql';
import schemaV2 from './schema_v2_ranking_history.sql';
import schemaV3 from './schema_v3_season_team.sql';
import schemaV4 from './schema_v4_season_history_only.sql';
import schemaV5 from './schema_v5_team_awards.sql';
import schemaV6 from './schema_v6_media.sql';
import schemaV7 from './schema_v7_player_notes.sql';
import schemaV8 from './schema_v8_season_coach.sql';
import schemaV9 from './schema_v9_season_phase.sql';
import schemaV10 from './schema_v10_media_order.sql';
import schemaV11 from './schema_v11_game_context.sql';
import schemaV12 from './schema_v12_player_cards.sql';
import schemaV13 from './schema_v13_card_layers.sql';
import schemaV14 from './schema_v14_media_framing.sql';
import schemaV15 from './schema_v15_program_overrides.sql';
import schemaV16 from './schema_v16_media_look.sql';
import schemaV17 from './schema_v17_coach_legends.sql';
import schemaV18 from './schema_v18_card_scrim.sql';
import schemaV19 from './schema_v19_manual_seasons.sql';
import schemaV20 from './schema_v20_custom_rivals.sql';

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
  { version: 10, name: 'media_order', sql: schemaV10 },
  { version: 11, name: 'game_context', sql: schemaV11 },
  { version: 12, name: 'player_cards', sql: schemaV12 },
  { version: 13, name: 'card_layers', sql: schemaV13 },
  { version: 14, name: 'media_framing', sql: schemaV14 },
  { version: 15, name: 'program_overrides', sql: schemaV15 },
  { version: 16, name: 'media_look', sql: schemaV16 },
  { version: 17, name: 'coach_legends', sql: schemaV17 },
  { version: 18, name: 'card_scrim', sql: schemaV18 },
  { version: 19, name: 'manual_seasons', sql: schemaV19 },
  { version: 20, name: 'custom_rivals', sql: schemaV20 },
];
