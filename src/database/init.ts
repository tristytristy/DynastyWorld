import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import initSqlJs, { type Database } from 'sql.js';
import { MIGRATIONS } from './migrations';

const DB_FILENAME = 'dynasty-archive.sqlite';
const MAX_BACKUPS = 10;

let db: Database | undefined;

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME);
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

/** The live database handle. Throws if called before initDatabase() resolves. */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() before using the DAL.');
  }
  return db;
}

/** Flushes the in-memory sql.js database to disk. Call after every write. */
export function persist(): void {
  fs.writeFileSync(getDbPath(), Buffer.from(getDb().export()));
}

/** Copies the current database file to a timestamped backup. Returns the backup path. */
export function backupDatabase(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `dynasty-archive-${timestamp}.sqlite`);
  fs.copyFileSync(getDbPath(), backupPath);
  return backupPath;
}

export interface BackupInfo {
  path: string;
  /** The ISO-ish timestamp embedded in the filename (colons/dots replaced with `-`), newest first. */
  label: string;
}

/** Every backup on disk, newest first. Empty if the backups folder doesn't exist yet (e.g. first-ever launch). */
export function listBackups(): BackupInfo[] {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith('dynasty-archive-') && name.endsWith('.sqlite'))
    .sort()
    .reverse()
    .map((name) => ({
      path: path.join(backupDir, name),
      label: name.slice('dynasty-archive-'.length, -'.sqlite'.length),
    }));
}

/** Deletes every backup beyond the most recent `keep` — unbounded backup growth was never the goal, just a recent safety net. */
export function pruneOldBackups(keep: number = MAX_BACKUPS): void {
  for (const backup of listBackups().slice(keep)) {
    try {
      fs.unlinkSync(backup.path);
    } catch {
      // Non-fatal: a leftover old backup file costs disk space, nothing more.
    }
  }
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

/** Copies a backup file over the live database path. Caller must re-run `initDatabase()` afterward to actually load it. */
export function restoreFromBackup(backupPath: string): void {
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
