-- DynastyNet: the save's own internet. Accounts are the recurring cast of
-- fake users (plus the user's own account); posts hold every surface the
-- Net renders — feed posts and replies, video comments on media items,
-- newspaper articles, and podcast episodes — discriminated by `kind`.
-- User-authored rows and bot rows live in the same table so a thread is
-- one query. Never written by persistExtraction; survives re-syncs (same
-- guarantee as media_items and team_award_results).

CREATE TABLE net_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  -- 'bot' | 'user' | 'paper' | 'podcast'
  kind TEXT NOT NULL DEFAULT 'bot',
  -- One-line personality brief fed to the generator; empty for 'user'.
  persona TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, handle)
);

CREATE INDEX idx_net_accounts_dynasty ON net_accounts(dynasty_id);

CREATE TABLE net_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  -- 'post' | 'reply' | 'comment' (on a media item) | 'article' | 'podcast'
  kind TEXT NOT NULL DEFAULT 'post',
  -- Reply/comment threading within the table.
  parent_id INTEGER,
  -- Video comments attach to the media gallery's rows.
  media_id INTEGER,
  -- Article headline / podcast episode title. Empty for feed posts.
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  -- The sync week the content reacts to, so the feed reads chronologically
  -- across a season and regeneration can replace a week wholesale.
  week INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY(account_id) REFERENCES net_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES net_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_net_posts_feed ON net_posts(dynasty_id, season_id, kind, week);
CREATE INDEX idx_net_posts_parent ON net_posts(parent_id);
CREATE INDEX idx_net_posts_media ON net_posts(media_id);
