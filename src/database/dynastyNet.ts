import { getDb, persist } from './init';
import type { NetAccount, NetAccountKind, NetFeedView, NetPost, NetPostKind } from '../shared/netTypes';

/**
 * DynastyNet storage (schema v24). Same contract as media.ts: user/bot
 * content, never written by persistExtraction, survives re-syncs.
 */

interface AccountRow {
  id: number;
  handle: string;
  display_name: string;
  kind: string;
  persona: string;
}

interface PostRow {
  id: number;
  season_id: number;
  account_id: number;
  handle: string;
  display_name: string;
  account_kind: string;
  kind: string;
  parent_id: number | null;
  media_id: number | null;
  title: string;
  body: string;
  likes: number;
  week: number;
  created_at: string;
}

function mapAccount(row: AccountRow): NetAccount {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    kind: row.kind as NetAccountKind,
    persona: row.persona,
  };
}

function mapPost(row: PostRow): NetPost {
  return {
    id: row.id,
    seasonId: row.season_id,
    accountId: row.account_id,
    handle: row.handle,
    displayName: row.display_name,
    accountKind: row.account_kind as NetAccountKind,
    kind: row.kind as NetPostKind,
    parentId: row.parent_id,
    mediaId: row.media_id,
    title: row.title,
    body: row.body,
    likes: row.likes,
    week: row.week,
    createdAt: row.created_at,
    replies: [],
  };
}

function selectRows<T>(sql: string, params: (string | number | null)[]): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
  stmt.free();
  return rows;
}

const POST_SELECT = `
  SELECT p.id, p.season_id, p.account_id, a.handle, a.display_name,
         a.kind AS account_kind, p.kind, p.parent_id, p.media_id,
         p.title, p.body, p.likes, p.week, p.created_at
  FROM net_posts p JOIN net_accounts a ON a.id = p.account_id`;

export function getAccounts(dynastyId: string): NetAccount[] {
  return selectRows<AccountRow>(
    'SELECT id, handle, display_name, kind, persona FROM net_accounts WHERE dynasty_id = ? ORDER BY id',
    [dynastyId],
  ).map(mapAccount);
}

/**
 * Idempotent cast install: existing handles are left alone (their posts keep
 * their author), new ones are added. Returns the full roster either way.
 */
export function ensureAccounts(
  dynastyId: string,
  wanted: { handle: string; displayName: string; kind: NetAccountKind; persona: string }[],
): NetAccount[] {
  const db = getDb();
  const current = getAccounts(dynastyId);
  let added = false;
  // The user's identity is singular: if it already exists under an old
  // handle (early builds used @Coach), rename it in place so every past
  // post follows the new name instead of a second user account appearing.
  const wantedUser = wanted.find((w) => w.kind === 'user');
  const existingUser = current.find((a) => a.kind === 'user');
  if (wantedUser && existingUser && existingUser.handle !== wantedUser.handle) {
    db.run('UPDATE net_accounts SET handle = ?, display_name = ? WHERE id = ?', [
      wantedUser.handle,
      wantedUser.displayName,
      existingUser.id,
    ]);
    existingUser.handle = wantedUser.handle;
    added = true;
  }
  const existing = new Set(current.map((a) => a.handle));
  for (const w of wanted) {
    if (existing.has(w.handle)) continue;
    db.run('INSERT INTO net_accounts (dynasty_id, handle, display_name, kind, persona, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      dynastyId,
      w.handle,
      w.displayName,
      w.kind,
      w.persona,
      new Date().toISOString(),
    ]);
    added = true;
  }
  if (added) persist();
  return getAccounts(dynastyId);
}

export interface NewNetPost {
  seasonId: number;
  accountId: number;
  kind: NetPostKind;
  parentId?: number | null;
  mediaId?: number | null;
  title?: string;
  body: string;
  likes?: number;
  week: number;
}

export function insertPosts(dynastyId: string, posts: NewNetPost[]): number {
  if (posts.length === 0) return 0;
  const db = getDb();
  for (const p of posts) {
    db.run(
      'INSERT INTO net_posts (dynasty_id, season_id, account_id, kind, parent_id, media_id, title, body, likes, week, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        dynastyId,
        p.seasonId,
        p.accountId,
        p.kind,
        p.parentId ?? null,
        p.mediaId ?? null,
        p.title ?? '',
        p.body,
        p.likes ?? 0,
        p.week,
        new Date().toISOString(),
      ],
    );
  }
  persist();
  return posts.length;
}

/**
 * The id of the most recently inserted post.
 *
 * ONLY VALID BEFORE THE NEXT FLUSH: sql.js's export() (inside persist())
 * closes and reopens the connection, which resets last_insert_rowid() to 0 —
 * the same reopen that resets PRAGMA foreign_keys (see init.ts). Callers that
 * need this id for a reply's parent_id must run their inserts inside
 * withBatchedPersist(), which defers the flush until the batch ends.
 */
export function lastInsertId(): number {
  const rows = selectRows<{ id: number }>('SELECT last_insert_rowid() AS id', []);
  return rows[0]?.id ?? 0;
}

function attachReplies(dynastyId: string, tops: NetPost[]): NetPost[] {
  if (tops.length === 0) return tops;
  const byId = new Map(tops.map((p) => [p.id, p]));
  const replies = selectRows<PostRow>(
    `${POST_SELECT} WHERE p.dynasty_id = ? AND p.parent_id IS NOT NULL ORDER BY p.id`,
    [dynastyId],
  ).map(mapPost);
  for (const r of replies) {
    const parent = r.parentId !== null ? byId.get(r.parentId) : undefined;
    if (parent) parent.replies.push(r);
  }
  return tops;
}

/** Feed posts (and the user's) for a season, newest week first, replies attached. */
export function getFeed(dynastyId: string, seasonId: number): NetPost[] {
  const tops = selectRows<PostRow>(
    `${POST_SELECT} WHERE p.dynasty_id = ? AND p.season_id = ? AND p.kind IN ('post') AND p.parent_id IS NULL ORDER BY p.week DESC, p.id ASC`,
    [dynastyId, seasonId],
  ).map(mapPost);
  return attachReplies(dynastyId, tops);
}

export function getFeedView(dynastyId: string, seasonId: number): NetFeedView {
  const posts = getFeed(dynastyId, seasonId);
  const weeks = selectRows<{ week: number }>(
    "SELECT DISTINCT week FROM net_posts WHERE dynasty_id = ? AND season_id = ? AND kind = 'post' ORDER BY week",
    [dynastyId, seasonId],
  ).map((r) => r.week);
  const user = getAccounts(dynastyId).find((a) => a.kind === 'user') ?? null;
  return { posts, generatedWeeks: weeks, userAccount: user };
}

/** Articles or podcast episodes for a season, newest week first. */
export function getEditions(dynastyId: string, seasonId: number, kind: 'article' | 'podcast' | 'throwback' | 'top10'): NetPost[] {
  return selectRows<PostRow>(
    `${POST_SELECT} WHERE p.dynasty_id = ? AND p.season_id = ? AND p.kind = ? ORDER BY p.week DESC, p.id ASC`,
    [dynastyId, seasonId, kind],
  ).map(mapPost);
}

/** Comment threads under one media item ("video"), oldest first, replies attached. */
export function getMediaComments(dynastyId: string, mediaId: number): NetPost[] {
  const tops = selectRows<PostRow>(
    `${POST_SELECT} WHERE p.dynasty_id = ? AND p.media_id = ? AND p.parent_id IS NULL ORDER BY p.id`,
    [dynastyId, mediaId],
  ).map(mapPost);
  return attachReplies(dynastyId, tops);
}

/**
 * Rename (or lazily create) the user's account. Handles are normalized to
 * @letters/digits/underscores; collisions with cast handles are refused so
 * the user can't impersonate a bot.
 */
export function setUserIdentity(
  dynastyId: string,
  rawHandle: string,
  rawDisplayName: string,
): { ok: boolean; message?: string; account?: NetAccount } {
  const db = getDb();
  const handle = '@' + rawHandle.replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 24);
  if (handle.length < 3) return { ok: false, message: 'Handle needs at least 2 letters or digits.' };
  const displayName = (rawDisplayName.trim() || handle.slice(1)).slice(0, 40);
  const accounts = getAccounts(dynastyId);
  const user = accounts.find((a) => a.kind === 'user');
  if (accounts.some((a) => a.handle.toLowerCase() === handle.toLowerCase() && a.id !== user?.id)) {
    return { ok: false, message: `${handle} is taken by someone on the Net. Pick another.` };
  }
  if (user) {
    db.run('UPDATE net_accounts SET handle = ?, display_name = ? WHERE id = ?', [handle, displayName, user.id]);
  } else {
    db.run(
      "INSERT INTO net_accounts (dynasty_id, handle, display_name, kind, persona, created_at) VALUES (?, ?, ?, 'user', '', ?)",
      [dynastyId, handle, displayName, new Date().toISOString()],
    );
  }
  persist();
  const account = getAccounts(dynastyId).find((a) => a.kind === 'user');
  return { ok: true, account };
}

/**
 * The Net's recent history, oldest first — the memory every generator is
 * handed so feuds, takes and bad predictions carry across weeks. Bounded:
 * bodies truncated, newest `limit` posts only.
 */
export function getRecentPosts(
  dynastyId: string,
  limit = 40,
): { handle: string; week: number; body: string; isUser: boolean }[] {
  return selectRows<PostRow>(
    `${POST_SELECT} WHERE p.dynasty_id = ? AND p.kind IN ('post', 'reply') ORDER BY p.id DESC LIMIT ${Math.max(1, Math.floor(limit))}`,
    [dynastyId],
  )
    .reverse()
    .map((r) => ({
      handle: r.handle,
      week: r.week,
      body: r.body.slice(0, 180),
      isUser: r.account_kind === 'user',
    }));
}

/** One post and its replies, oldest first — the context for replying in-thread. */
export function getThread(dynastyId: string, postId: number): NetPost | null {
  const tops = selectRows<PostRow>(`${POST_SELECT} WHERE p.dynasty_id = ? AND p.id = ?`, [dynastyId, postId]).map(
    mapPost,
  );
  if (!tops.length) return null;
  return attachReplies(dynastyId, tops)[0];
}

/** True when a week already has generated feed chatter — the regenerate guard. */
export function weekHasPosts(dynastyId: string, seasonId: number, week: number): boolean {
  return (
    selectRows<{ n: number }>(
      "SELECT COUNT(*) AS n FROM net_posts p JOIN net_accounts a ON a.id = p.account_id WHERE p.dynasty_id = ? AND p.season_id = ? AND p.week = ? AND p.kind = 'post' AND a.kind != 'user'",
      [dynastyId, seasonId, week],
    )[0]?.n ?? 0
  ) > 0;
}

/** Wipe one week's bot content (feed + article + podcast) ahead of a regenerate. User posts stay. */
export function clearWeek(dynastyId: string, seasonId: number, week: number): void {
  const db = getDb();
  db.run(
    "DELETE FROM net_posts WHERE dynasty_id = ? AND season_id = ? AND week = ? AND account_id IN (SELECT id FROM net_accounts WHERE dynasty_id = ? AND kind != 'user')",
    [dynastyId, seasonId, week, dynastyId],
  );
  persist();
}
