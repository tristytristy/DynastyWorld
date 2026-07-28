import { app } from 'electron';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import yauzl from 'yauzl';
import type { Database } from 'sql.js';
import { backupDatabase, compactDatabase, getDb, loadDatabaseFromBuffer, persist } from '../database/init';
import { getDynastyById, updateDynasty } from '../database/helpers';
import { mediaDirFor } from './ipc/media';
import { BACKUP_PATHS } from './dynastyBackup';
import type { BackupInspection, DynastyRestoreResult } from '../shared/types';

/**
 * Restoring a dynasty backup written by dynastyBackup.ts.
 *
 * The hard part isn't the zip, it's the merge. A backup carries a whole
 * one-dynasty database, and the archive it's going back into usually already
 * holds other dynasties whose seasons/players/games occupy the same
 * autoincrement id numbers. Copying rows verbatim would silently staple this
 * dynasty's seasons onto someone else's — so every incoming id is shifted clear
 * of the ids already in use before anything is written.
 */

/**
 * Every table whose integer ids must be shifted on the way in, and the columns
 * that point at them. Declared rather than introspected because a missed
 * reference here would produce a restore that "works" and quietly mis-links
 * data — a failure mode that deserves an explicit, reviewable list.
 */
const ID_SPACES: { table: string; refs: [string, string][] }[] = [
  {
    table: 'seasons',
    refs: [
      ['season_snapshots', 'season_id'],
      ['games', 'season_id'],
      ['awards', 'season_id'],
      ['bowl_games', 'season_id'],
      ['coach_seasons', 'season_id'],
      ['player_seasons', 'season_id'],
      ['recruit_seasons', 'season_id'],
      ['ranking_history', 'season_id'],
      ['media_items', 'season_id'],
      ['team_award_results', 'season_id'],
    ],
  },
  {
    table: 'players',
    refs: [
      ['player_seasons', 'player_id'],
      ['player_game_stats', 'player_id'],
      ['player_career_stats', 'player_id'],
      ['awards', 'player_id'],
      ['player_notes', 'player_id'],
    ],
  },
  { table: 'coaches', refs: [['coach_seasons', 'coach_id'], ['awards', 'coach_id']] },
  { table: 'recruits', refs: [['recruit_seasons', 'recruit_id']] },
  { table: 'games', refs: [['player_game_stats', 'game_id']] },
];

/** Tables with their own integer ids but nothing pointing at them — shifted so they can't collide either. */
const STANDALONE_ID_TABLES = [
  'season_snapshots',
  'player_seasons',
  'coach_seasons',
  'awards',
  'championships',
  'bowl_games',
  'program_milestones',
  'recruit_seasons',
  'player_game_stats',
  'ranking_history',
  'media_items',
  'player_notes',
  'team_award_results',
  'team_award_settings',
];

/** Never copied: the schema ledger belongs to the receiving archive, not the backup. */
const SKIP_TABLES = new Set(['schema_migrations']);

function tableExists(db: Database, table: string): boolean {
  const stmt = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
  stmt.bind([table]);
  const found = stmt.step();
  stmt.free();
  return found;
}

function columnsOf(db: Database, table: string): string[] {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return [];
  const nameIndex = result[0].columns.indexOf('name');
  return result[0].values.map((row) => String(row[nameIndex]));
}

function hasIntegerId(db: Database, table: string): boolean {
  return columnsOf(db, table).includes('id');
}

function maxId(db: Database, table: string): number {
  try {
    const result = db.exec(`SELECT COALESCE(MAX(id), 0) FROM ${table}`);
    return Number(result[0]?.values[0][0] ?? 0);
  } catch {
    return 0;
  }
}

// ---- Reading the backup -----------------------------------------------------

async function readZipEntries(zipPath: string, wanted: (name: string) => boolean): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    const out = new Map<string, Buffer>();
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Could not open that file.'));
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName) || !wanted(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) return reject(streamErr ?? new Error('Could not read the backup.'));
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            out.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on('error', reject);
        });
      });
      zip.on('end', () => resolve(out));
      zip.on('error', reject);
    });
  });
}

/**
 * Reads the manifest without unpacking anything, so the user can be told
 * exactly what a file contains — and what it does NOT contain — before they
 * commit to restoring it.
 */
export async function inspectBackup(zipPath: string): Promise<BackupInspection> {
  try {
    const entries = await readZipEntries(zipPath, (name) => name === BACKUP_PATHS.manifest);
    const raw = entries.get(BACKUP_PATHS.manifest);
    if (!raw) {
      return { valid: false, message: "That doesn't look like a dynasty backup — no backup details inside." };
    }
    const manifest = JSON.parse(raw.toString()) as {
      formatVersion?: number;
      appVersion?: string;
      createdAt?: string;
      dynasty?: { id?: string; teamName?: string; seasonCount?: number };
      contents?: { media?: number; cardPhotos?: number; saveGame?: string | null };
    };
    const dynastyId = manifest.dynasty?.id;
    if (!dynastyId) {
      return { valid: false, message: 'That backup is missing the dynasty it belongs to.' };
    }
    return {
      valid: true,
      message: '',
      dynastyId,
      teamName: manifest.dynasty?.teamName ?? 'Unknown team',
      seasonCount: manifest.dynasty?.seasonCount ?? 0,
      createdAt: manifest.createdAt ?? null,
      appVersion: manifest.appVersion ?? null,
      mediaFiles: manifest.contents?.media ?? 0,
      cardPhotoFiles: manifest.contents?.cardPhotos ?? 0,
      saveGameName: manifest.contents?.saveGame ?? null,
      /** True when this dynasty is already in the archive and would be replaced. */
      alreadyPresent: !!getDynastyById(dynastyId),
    };
  } catch (err) {
    return {
      valid: false,
      message: err instanceof Error ? `Could not read that file: ${err.message}` : 'Could not read that file.',
    };
  }
}

// ---- The merge --------------------------------------------------------------

/**
 * Shifts every id in the incoming database clear of the ids already in the live
 * one.
 *
 * Enforcement is switched OFF on the scratch copy for the duration, then the
 * whole thing is re-checked. Renumbering a parent and the rows pointing at it
 * cannot be done in one atomic step: whichever goes first, the database is
 * briefly inconsistent, and with foreign keys on, that intermediate state is
 * rejected outright. Turning them off for the shift and running
 * `foreign_key_check` immediately afterwards gives the same guarantee without
 * needing the impossible atomic update — and this is a throwaway copy, never
 * the user's archive.
 */
function shiftIncomingIds(incoming: Database, live: Database): void {
  incoming.run('PRAGMA foreign_keys = OFF;');

  for (const { table, refs } of ID_SPACES) {
    if (!tableExists(incoming, table)) continue;
    const offset = maxId(live, table);
    if (offset === 0) continue;
    // Children first: shifting the parent id before its references would leave
    // the children pointing at rows that no longer carry those numbers.
    for (const [refTable, refColumn] of refs) {
      if (!tableExists(incoming, refTable)) continue;
      if (!columnsOf(incoming, refTable).includes(refColumn)) continue;
      incoming.run(`UPDATE ${refTable} SET ${refColumn} = ${refColumn} + ${offset} WHERE ${refColumn} IS NOT NULL`);
    }
    incoming.run(`UPDATE ${table} SET id = id + ${offset}`);
  }

  for (const table of STANDALONE_ID_TABLES) {
    if (!tableExists(incoming, table) || !hasIntegerId(incoming, table)) continue;
    const offset = maxId(live, table);
    if (offset === 0) continue;
    incoming.run(`UPDATE ${table} SET id = id + ${offset}`);
  }

  // Prove the renumbering left everything still pointing where it should,
  // BEFORE a single row reaches the user's archive.
  incoming.run('PRAGMA foreign_keys = ON;');
  const violations = incoming.exec('PRAGMA foreign_key_check');
  if (violations.length > 0) {
    throw new Error('That backup could not be renumbered safely, so nothing was changed.');
  }
}

/** Copies every row of every table from the incoming database into the live one. */
function copyAllRows(incoming: Database, live: Database): number {
  const tables = incoming
    .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]
    ?.values.map((row) => String(row[0])) ?? [];

  let rowsCopied = 0;
  for (const table of tables) {
    if (SKIP_TABLES.has(table) || !tableExists(live, table)) continue;

    const incomingColumns = columnsOf(incoming, table);
    const liveColumns = new Set(columnsOf(live, table));
    // Only columns both sides know about — a backup from an older or newer
    // build restores as much as it validly can rather than failing outright.
    const columns = incomingColumns.filter((c) => liveColumns.has(c));
    if (columns.length === 0) continue;

    const result = incoming.exec(`SELECT ${columns.join(', ')} FROM ${table}`);
    if (!result.length) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const insert = live.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
    for (const row of result[0].values) {
      insert.run(row);
      rowsCopied++;
    }
    insert.free();
  }
  return rowsCopied;
}

async function restoreFiles(source: Map<string, Buffer>, prefix: string, destDir: string): Promise<number> {
  let count = 0;
  for (const [name, buffer] of source) {
    if (!name.startsWith(`${prefix}/`)) continue;
    const fileName = path.basename(name);
    if (!fileName) continue;
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.writeFile(path.join(destDir, fileName), buffer);
    count++;
  }
  return count;
}

/**
 * Puts a backed-up dynasty back into this installation.
 *
 * Takes a full checkpoint of the current archive first — restoring on top of
 * existing data is the one action here that can destroy a real dynasty in a
 * single click, and someone will eventually do it on the wrong machine. That
 * safety net is deliberately NOT optional.
 *
 * Photos land in whatever media folder this machine is currently using, rather
 * than wherever they lived on the machine that made the backup: the path the
 * files came from may not exist here, and the app looks for them by dynasty,
 * not by remembered location.
 */
export async function restoreDynastyBackup(zipPath: string): Promise<DynastyRestoreResult> {
  const inspection = await inspectBackup(zipPath);
  if (!inspection.valid || !inspection.dynastyId) {
    return { success: false, message: inspection.message };
  }
  const dynastyId = inspection.dynastyId;

  // Safety net, taken before anything is touched. backupDatabase() returning
  // null is fine — it means the archive is unchanged since the last checkpoint,
  // so a good one already exists. A THROWN error is different: if there are
  // dynasties here to lose and we can't protect them, refuse rather than
  // gamble.
  let safetyNet: string | null = null;
  try {
    persist();
    safetyNet = await backupDatabase();
  } catch {
    const existing = Number(getDb().exec('SELECT COUNT(*) FROM dynasties')[0]?.values[0][0] ?? 0);
    if (existing > 0) {
      return { success: false, message: 'Could not make a safety copy of your existing dynasties, so nothing was changed.' };
    }
  }

  try {
    const entries = await readZipEntries(zipPath, (name) => name !== BACKUP_PATHS.manifest);
    const archiveBuffer = entries.get(BACKUP_PATHS.archive);
    if (!archiveBuffer) {
      return { success: false, message: 'That backup has no dynasty archive inside it.' };
    }

    const live = getDb();
    live.run('PRAGMA foreign_keys = ON;');

    // Replacing an existing copy: remove it first so the restore is a clean
    // swap rather than a half-merge of two versions of the same dynasty.
    if (getDynastyById(dynastyId)) {
      live.run('DELETE FROM dynasties WHERE id = ?', [dynastyId]);
    }

    const scratch = loadDatabaseFromBuffer(archiveBuffer);
    try {
      shiftIncomingIds(scratch, live);
      const rows = copyAllRows(scratch, live);
      persist();

      // Point the restored dynasty at this machine's copy of the save file, if
      // one came along — otherwise its stored path refers to a machine that may
      // not be this one, and Relink is the user's route back.
      let savePathNote = '';
      if (inspection.saveGameName) {
        const saveBuffer = entries.get(`${BACKUP_PATHS.save}/${inspection.saveGameName}`);
        if (saveBuffer) {
          const restoredSaveDir = path.join(app.getPath('userData'), 'restored-saves', dynastyId);
          await fsp.mkdir(restoredSaveDir, { recursive: true });
          const restoredSavePath = path.join(restoredSaveDir, inspection.saveGameName);
          await fsp.writeFile(restoredSavePath, saveBuffer);
          if (!fs.existsSync(getDynastyById(dynastyId)?.savePath ?? '')) {
            updateDynasty(dynastyId, { savePath: restoredSavePath });
            savePathNote = ' Your game save was restored too.';
          }
        }
      }

      const mediaCount = await restoreFiles(entries, BACKUP_PATHS.media, mediaDirFor(dynastyId));
      const cardCount = await restoreFiles(
        entries,
        BACKUP_PATHS.cardPhotos,
        path.join(app.getPath('userData'), 'card-photos', dynastyId),
      );

      compactDatabase();

      const parts = [`Restored ${inspection.teamName} (${inspection.seasonCount} season${inspection.seasonCount === 1 ? '' : 's'})`];
      if (mediaCount) parts.push(`${mediaCount} photo${mediaCount === 1 ? '' : 's'}`);
      if (cardCount) parts.push(`${cardCount} card image${cardCount === 1 ? '' : 's'}`);
      return {
        success: true,
        message: `${parts.join(', ')}.${savePathNote}`,
        dynastyId,
        rowsRestored: rows,
      };
    } finally {
      scratch.close();
    }
  } catch (err) {
    return {
      success: false,
      message: `${err instanceof Error ? err.message : 'Restore failed.'}${
        safetyNet ? ' Your existing dynasties were checkpointed before this started.' : ''
      }`,
    };
  }
}
