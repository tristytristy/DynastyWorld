-- Schema version 1 (initial). Applied once via migrations.ts as migration #1.
-- Column/table shapes match MASTER_ROADMAP_v2.md Phase 1.

CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,
  save_path TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  team_id INTEGER,
  team_name TEXT,
  team_color_primary TEXT,
  team_color_secondary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_dynasties_team_id ON dynasties(team_id);
CREATE INDEX idx_dynasties_created_at ON dynasties(created_at DESC);

CREATE TABLE seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  extracted_at TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  final_record_wins INTEGER,
  final_record_losses INTEGER,
  final_record_ties INTEGER,
  conference_record_wins INTEGER,
  conference_record_losses INTEGER,
  final_ranking_ap INTEGER,
  final_ranking_coaches INTEGER,
  final_ranking_cfp INTEGER,
  bowl_game_name TEXT,
  bowl_result TEXT,
  conference_championship INTEGER,
  national_championship INTEGER,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, season_year)
);

CREATE INDEX idx_seasons_dynasty_year ON seasons(dynasty_id, season_year DESC);
CREATE INDEX idx_seasons_extracted_at ON seasons(extracted_at DESC);

CREATE TABLE season_snapshots (
  season_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  extracted_at TEXT NOT NULL,
  extraction_version TEXT,
  PRIMARY KEY(season_id, name),
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_snapshots_name ON season_snapshots(name);

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  game_player_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  position TEXT,
  height_inches INTEGER,
  weight_pounds INTEGER,
  hometown TEXT,
  state TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_players_dynasty ON players(dynasty_id);
CREATE INDEX idx_players_position ON players(position);

CREATE TABLE player_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  class TEXT,
  overall_rating INTEGER,
  speed INTEGER,
  strength INTEGER,
  acceleration INTEGER,
  archetype TEXT,
  development_trait TEXT,
  games_played INTEGER,
  games_started INTEGER,
  status TEXT,
  jersey_number INTEGER,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(player_id, season_id)
);

CREATE INDEX idx_player_seasons_player ON player_seasons(player_id);
CREATE INDEX idx_player_seasons_season ON player_seasons(season_id);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week INTEGER,
  game_number INTEGER,
  opponent_name TEXT NOT NULL,
  opponent_id INTEGER,
  location TEXT,
  game_date TEXT,
  opponent_ranking_ap INTEGER DEFAULT 0,
  opponent_ranking_coaches INTEGER DEFAULT 0,
  user_ranking_ap INTEGER DEFAULT 0,
  user_score INTEGER,
  opponent_score INTEGER,
  result TEXT,
  game_type TEXT,
  notes TEXT,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_games_season_week ON games(season_id, week);
CREATE INDEX idx_games_result ON games(result);

CREATE TABLE player_game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  pass_attempts INTEGER DEFAULT 0,
  pass_completions INTEGER DEFAULT 0,
  pass_yards INTEGER DEFAULT 0,
  pass_touchdowns INTEGER DEFAULT 0,
  interceptions INTEGER DEFAULT 0,
  rush_attempts INTEGER DEFAULT 0,
  rush_yards INTEGER DEFAULT 0,
  rush_touchdowns INTEGER DEFAULT 0,
  receptions INTEGER DEFAULT 0,
  receiving_yards INTEGER DEFAULT 0,
  receiving_touchdowns INTEGER DEFAULT 0,
  tackles INTEGER DEFAULT 0,
  tackles_for_loss INTEGER DEFAULT 0,
  sacks REAL DEFAULT 0,
  interceptions_defense INTEGER DEFAULT 0,
  forced_fumbles INTEGER DEFAULT 0,
  fumble_recoveries INTEGER DEFAULT 0,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_game_stats_player ON player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_game ON player_game_stats(game_id);

CREATE TABLE player_career_stats (
  player_id INTEGER PRIMARY KEY,
  dynasty_id TEXT NOT NULL,
  total_games_played INTEGER DEFAULT 0,
  total_games_started INTEGER DEFAULT 0,
  career_pass_attempts INTEGER DEFAULT 0,
  career_pass_yards INTEGER DEFAULT 0,
  career_pass_touchdowns INTEGER DEFAULT 0,
  career_rush_yards INTEGER DEFAULT 0,
  career_rush_touchdowns INTEGER DEFAULT 0,
  career_receptions INTEGER DEFAULT 0,
  career_receiving_yards INTEGER DEFAULT 0,
  career_receiving_touchdowns INTEGER DEFAULT 0,
  career_tackles INTEGER DEFAULT 0,
  career_sacks REAL DEFAULT 0,
  career_interceptions INTEGER DEFAULT 0,
  last_updated TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE TABLE coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  position TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_coaches_dynasty ON coaches(dynasty_id);

CREATE TABLE coach_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  position TEXT,
  overall_rating INTEGER,
  years_coaching INTEGER,
  personality TEXT,
  prestige_rating INTEGER,
  contract_years_remaining INTEGER,
  salary INTEGER,
  buyout INTEGER,
  coaching_record_wins INTEGER,
  coaching_record_losses INTEGER,
  FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(coach_id, season_id)
);

CREATE INDEX idx_coach_seasons_season ON coach_seasons(season_id);

CREATE TABLE awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  award_name TEXT NOT NULL,
  award_type TEXT,
  player_id INTEGER,
  coach_id INTEGER,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE INDEX idx_awards_season ON awards(season_id);
CREATE INDEX idx_awards_player ON awards(player_id);

CREATE TABLE championships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  championship_type TEXT,
  conference_name TEXT,
  is_national INTEGER,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, season_year, championship_type)
);

CREATE INDEX idx_championships_dynasty ON championships(dynasty_id);

CREATE TABLE bowl_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  bowl_name TEXT NOT NULL,
  opponent_name TEXT,
  opponent_id INTEGER,
  user_score INTEGER,
  opponent_score INTEGER,
  result TEXT,
  game_date TEXT,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_bowl_games_season ON bowl_games(season_id);

CREATE TABLE program_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  milestone_type TEXT,
  description TEXT,
  value TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_milestones_dynasty ON program_milestones(dynasty_id);

CREATE TABLE recruits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  game_recruit_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  position TEXT,
  state TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_recruits_dynasty ON recruits(dynasty_id);

CREATE TABLE recruit_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruit_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  stars INTEGER,
  national_rank INTEGER DEFAULT 0,
  position_rank INTEGER DEFAULT 0,
  state_rank INTEGER DEFAULT 0,
  recruit_type TEXT,
  commitment_status TEXT,
  signed_status TEXT,
  archetype TEXT,
  FOREIGN KEY(recruit_id) REFERENCES recruits(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(recruit_id, season_id)
);

CREATE INDEX idx_recruit_seasons_season ON recruit_seasons(season_id);
