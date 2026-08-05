import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import initSqlJs, { type Database } from 'sql.js';
import { MIGRATIONS } from './migrations';

const DB_FILENAME = 'dynasty-archive.sqlite';
// Checkpoints are now gzipped (~3x smaller) AND only written when the database
// actually changed, so each of these is a genuinely distinct recovery point
// rather than a duplicate — 5 real states beats 10 copies of the same one.
const MAX_BACKUPS = 5;

let db: Database | undefined;

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

/** The archive file's size on disk — what the user actually sees in the storage panel. */
export function getDatabaseFileBytes(): number {
  try {
    return fs.statSync(getDbPath()).size;
  } catch {
    return 0;
  }
}

function getBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

/**
 * Thrown specifically when the on-disk file exists but sql.js can't parse it
 * (truncated write, garbage bytes, filesystem corruption) — distinct from
 * other startup failures (missing wasm binary, out-of-memory, etc.) that
 * `initDatabaseWithRecovery` in main.ts shouldn't try to "recover" from,
 * since it has no idea how to fix those.
 */
export class DatabaseCorruptedError extends Error {
  constructor(
    public readonly dbPath: string,
    cause: unknown,
  ) {
    super(`Database file at ${dbPath} could not be read: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'DatabaseCorruptedError';
  }
}

/**
 * Bumped every time the live handle is replaced — a fresh open, a restore from
 * backup, an archive swapped in underneath us.
 *
 * Read by the snapshot cache in helpers.ts, which cannot simply be told to clear
 * from here: helpers imports from this module, so an import the other way would
 * be a cycle. A generation counter the reader checks is the acyclic version of
 * the same thing, and it can't be forgotten at a new call site — replacing `db`
 * is what invalidates, and replacing `db` is what bumps this.
 */
let dbEpoch = 0;
export function getDbEpoch(): number {
  return dbEpoch;
}

/** The live database handle. Throws if called before initDatabase() resolves. */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() before using the DAL.');
  }
  return db;
}

/**
 * Flushes the in-memory sql.js database to disk. Call after every write.
 *
 * Re-asserts foreign keys afterwards, and that is NOT redundant: sql.js's
 * `export()` silently resets `PRAGMA foreign_keys` back to 0. Since persist()
 * runs after every write, enforcement used to survive only until the first save
 * of a session — after that, `ON DELETE CASCADE` quietly stopped firing, so
 * deleting a dynasty removed its name row and stranded every season, snapshot
 * and note underneath it. That's where 137 MB of a real 170 MB archive came
 * from. Verified directly: pragma reads 1 before export() and 0 after.
 */
export function persist(): void {
  if (deferDepth > 0) {
    pendingWrite = true;
    return;
  }
  const database = getDb();
  fs.writeFileSync(getDbPath(), Buffer.from(database.export()));
  database.run('PRAGMA foreign_keys = ON;');
}

// How many batches are open, and whether anything inside them asked to persist.
let deferDepth = 0;
let pendingWrite = false;

/**
 * Runs a bulk write as ONE flush to disk instead of one per statement.
 *
 * Every write goes through `run()` in helpers.ts, which calls `persist()`
 * afterwards — and `persist()` serialises and rewrites the WHOLE database file.
 * That is the right default for a single edit (the archive is never left
 * un-flushed) and badly wrong for an import: `persistExtraction` performs about
 * 25 writes, so a sync rewrote the entire archive 25 times over.
 *
 * The cost is invisible on a new archive and grows with the dynasty. Measured
 * on a real 30 MB archive: a sync spent ~1.9 s in persist alone — roughly
 * 750 MB of file writes for one sync — against ~80 ms for a single flush. It
 * gets worse every season, which is exactly the wrong direction.
 *
 * Nested batches are safe (the flush happens when the outermost one ends), and
 * the flush is in a `finally`: if the bulk operation throws part-way, whatever
 * did land in memory is still written, so the file can't silently drift from
 * the in-memory database.
 */
export function withBatchedPersist<T>(fn: () => T): T {
  deferDepth++;
  try {
    return fn();
  } finally {
    deferDepth--;
    if (deferDepth === 0 && pendingWrite) {
      pendingWrite = false;
      persist();
    }
  }
}

/**
 * Is a bulk write open right now?
 *
 * `deferDepth` is the honest answer to "is it safe to close the app": while a
 * batch is open the file on disk is deliberately BEHIND the in-memory database,
 * and quitting there loses whatever the batch had accumulated. The updater's
 * pre-install check reads this before it agrees to restart (see
 * main/updater/updateService.ts).
 */
export function isDatabaseWriteInProgress(): boolean {
  return deferDepth > 0;
}

/**
 * Writes anything a batch left pending, if a batch somehow ended without
 * flushing. A no-op in the normal case — `withBatchedPersist` flushes in its
 * own `finally` — so this is a belt-and-braces call for shutdown paths, not a
 * routine one.
 */
export function flushPendingWrites(): void {
  if (deferDepth === 0 && pendingWrite) {
    pendingWrite = false;
    persist();
  }
}

/**
 * Space SQLite has already freed internally but has NOT returned to the file —
 * pages emptied by past deletions and kept for reuse. Invisible to the user,
 * who just sees an archive that never shrinks. Exact, and costs two pragmas.
 */
export function getReusableSpaceBytes(): number {
  try {
    const database = getDb();
    const pages = database.exec('PRAGMA freelist_count')[0]?.values[0][0];
    const pageSize = database.exec('PRAGMA page_size')[0]?.values[0][0];
    return Number(pages ?? 0) * Number(pageSize ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Rebuilds the database file without its free pages, actually handing the space
 * back to the operating system.
 *
 * This is the step that was missing. Deleting a dynasty DOES correctly remove
 * every row (the cascades work — verified), but SQLite keeps the emptied pages
 * for reuse rather than shrinking the file, so the archive sits at its
 * high-water mark forever and a deletion appears to free nothing. Measured on a
 * real archive: 170.1 MB before, still 170.1 MB after deleting 568 snapshots,
 * 20.6 MB after this runs.
 */
export function compactDatabase(): void {
  getDb().run('VACUUM');
  persist();
}

/**
 * Records the state the last checkpoint captured, so an unchanged database
 * isn't copied again. Size+mtime is enough and costs nothing: `persist()`
 * rewrites the file on every single write, so an untouched database keeps an
 * untouched mtime — and a session that only *reads* correctly produces no new
 * backup at all.
 */
function checkpointMarkerPath(): string {
  return path.join(getBackupDir(), '.checkpoint.json');
}

function currentFingerprint(): string | null {
  try {
    const s = fs.statSync(getDbPath());
    return `${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

function lastCheckpointFingerprint(): string | null {
  try {
    return (JSON.parse(fs.readFileSync(checkpointMarkerPath(), 'utf8')) as { fingerprint?: string }).fingerprint ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes a timestamped, gzipped checkpoint of the database — resolving to the
 * backup path, or null when nothing changed since the last one.
 *
 * Two deliberate choices, both measured on a real 170 MB archive:
 *   - **Only when it changed.** This used to run on EVERY launch, so ten
 *     launches with no dynasty work left ten near-identical copies; the folder
 *     had reached 1.7 GB of redundant data.
 *   - **Gzipped, streamed, level 1.** 170 MB → 57.6 MB (level 6 saved only 4 MB
 *     more for 55% more time). Streaming keeps the 1.5 s of compression off the
 *     main thread, and the caller defers it until after the window is up, so
 *     startup never waits on it.
 *
 * Legacy uncompressed `.sqlite` backups stay readable — see restoreFromBackup.
 */
export async function backupDatabase(): Promise<string | null> {
  const fingerprint = currentFingerprint();
  if (!fingerprint) return null;
  if (fingerprint === lastCheckpointFingerprint()) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `dynasty-archive-${timestamp}.sqlite.gz`);

  await pipeline(fs.createReadStream(getDbPath()), zlib.createGzip({ level: 1 }), fs.createWriteStream(backupPath));

  try {
    fs.writeFileSync(checkpointMarkerPath(), JSON.stringify({ fingerprint, at: new Date().toISOString() }, null, 2));
  } catch {
    // Losing the marker only costs one redundant backup next launch.
  }
  return backupPath;
}

export interface BackupInfo {
  path: string;
  /** The ISO-ish timestamp embedded in the filename (colons/dots replaced with `-`), newest first. */
  label: string;
  bytes: number;
}

function isBackupName(name: string): boolean {
  return name.startsWith('dynasty-archive-') && (name.endsWith('.sqlite') || name.endsWith('.sqlite.gz'));
}

/** Every backup on disk, newest first. Empty if the backups folder doesn't exist yet (e.g. first-ever launch). */
export function listBackups(): BackupInfo[] {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter(isBackupName)
    .sort()
    .reverse()
    .map((name) => {
      const full = path.join(backupDir, name);
      let bytes = 0;
      try {
        bytes = fs.statSync(full).size;
      } catch {
        // Vanished between readdir and stat — report it as empty rather than throwing.
      }
      return {
        path: full,
        label: name.slice('dynasty-archive-'.length).replace(/\.sqlite(\.gz)?$/, ''),
        bytes,
      };
    });
}

/** Deletes every backup beyond the most recent `keep` — unbounded backup growth was never the goal, just a recent safety net. */
export function pruneOldBackups(keep: number = MAX_BACKUPS): number {
  let removed = 0;
  for (const backup of listBackups().slice(keep)) {
    try {
      fs.unlinkSync(backup.path);
      removed++;
    } catch {
      // Non-fatal: a leftover old backup file costs disk space, nothing more.
    }
  }
  return removed;
}

/** Folder path + how much it's actually using, for the Preferences storage panel. */
export function getBackupsFolderInfo(): { path: string; fileCount: number; totalBytes: number } {
  const backups = listBackups();
  return {
    path: getBackupDir(),
    fileCount: backups.length,
    totalBytes: backups.reduce((sum, b) => sum + b.bytes, 0),
  };
}

/**
 * Renames (not deletes) an unreadable database file out of the way so a
 * fresh one can be created in its place — the original bytes are kept in
 * case manual/forensic recovery is ever needed, never silently destroyed.
 */
export function quarantineCorruptDatabase(dbPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const quarantineDir = path.join(app.getPath('userData'), 'corrupted');
  fs.mkdirSync(quarantineDir, { recursive: true });
  const quarantinePath = path.join(quarantineDir, `dynasty-archive-corrupted-${timestamp}.sqlite`);
  fs.renameSync(dbPath, quarantinePath);
  return quarantinePath;
}

/**
 * Puts a backup file back at the live database path. Caller must re-run
 * `initDatabase()` afterward to actually load it. Handles both the gzipped
 * checkpoints written today and the plain `.sqlite` copies older versions left
 * behind — those stay restorable forever, since a recovery path that can't read
 * a user's existing backups is worse than useless.
 */
export function restoreFromBackup(backupPath: string): void {
  if (backupPath.endsWith('.gz')) {
    fs.writeFileSync(getDbPath(), zlib.gunzipSync(fs.readFileSync(backupPath)));
    return;
  }
  fs.copyFileSync(backupPath, getDbPath());
}

function getAppliedVersion(): number {
  const stmt = getDb().prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations');
  stmt.step();
  const { v } = stmt.getAsObject() as { v: number };
  stmt.free();
  return v;
}

function applyMigration(migration: (typeof MIGRATIONS)[number]): void {
  const database = getDb();
  try {
    database.exec('BEGIN TRANSACTION;');
    database.exec(migration.sql);
    database.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
      migration.version,
      migration.name,
      new Date().toISOString(),
    ]);
    database.exec('COMMIT;');
  } catch (err) {
    database.exec('ROLLBACK;');
    throw err;
  }
}

// The initialised sql.js module, kept so a second, throwaway database can be
// opened without re-loading the wasm binary (see openDetachedDatabase).
let SQLModule: Awaited<ReturnType<typeof initSqlJs>> | undefined;

/**
 * Opens an independent, in-memory copy of the archive as it currently stands on
 * disk — a scratch database the caller can freely mutate without touching the
 * live one. Used by the per-dynasty backup, which builds its single-dynasty
 * archive by deleting the OTHER dynasties out of a copy: destructive by design,
 * and something that must never happen to the real thing.
 *
 * Caller owns the returned handle and must `close()` it.
 */
export function openDetachedDatabase(): Database {
  return loadDatabaseFromBuffer(fs.readFileSync(getDbPath()));
}

/**
 * Opens a database from raw bytes — a backup's archive read straight out of its
 * zip, without ever touching disk. Independent of the live database; the caller
 * owns it and must `close()` it.
 */
export function loadDatabaseFromBuffer(buffer: Buffer): Database {
  if (!SQLModule) throw new Error('Database not initialized — call initDatabase() first.');
  const database = new SQLModule.Database(buffer);
  database.run('PRAGMA foreign_keys = ON;');
  return database;
}

export async function initDatabase(): Promise<void> {
  // Not require.resolve('sql.js/dist/sql-wasm.wasm'): webpack's externals
  // handling doesn't apply to require.resolve(), so it degrades to the bare
  // string and resolves against cwd instead of node_modules. __dirname is the
  // real (non-webpack-virtualized) dist/main directory at runtime — see
  // node: { __dirname: false } in webpack.config.js.
  const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmFile = fs.readFileSync(wasmPath);
  const wasmBinary = wasmFile.buffer.slice(
    wasmFile.byteOffset,
    wasmFile.byteOffset + wasmFile.byteLength,
  ) as ArrayBuffer;
  const SQL = await initSqlJs({ wasmBinary });
  SQLModule = SQL;

  const dbPath = getDbPath();
  const dbFileExists = fs.existsSync(dbPath);
  try {
    // sql.js doesn't validate the file format at construction time — a
    // truncated/garbage buffer opens "successfully" and only throws once
    // SQLite actually touches the schema on the first real statement, which
    // is why these two run() calls have to be inside the same try/catch as
    // the constructor, not after it (confirmed by a real corrupted-file test
    // that slipped through when they were split — see DevLog).
    db = dbFileExists ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
    dbEpoch += 1; // anything cached from the previous handle is now about a different file
    db.run('PRAGMA foreign_keys = ON;');
    db.run(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );
  } catch (err) {
    // Only a pre-existing file can be "corrupted" in the recoverable sense —
    // a from-scratch in-memory Database failing here would be some other,
    // unrelated failure (e.g. out of memory) with nothing to recover from.
    if (dbFileExists) {
      throw new DatabaseCorruptedError(dbPath, err);
    }
    throw err;
  }

  const appliedVersion = getAppliedVersion();
  const pending = MIGRATIONS.filter((m) => m.version > appliedVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    applyMigration(migration);
  }

  if (pending.length > 0) {
    persist();
  }
}
