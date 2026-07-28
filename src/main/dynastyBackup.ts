import { app } from 'electron';
import archiver from 'archiver';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { openDetachedDatabase, persist } from '../database/init';
import { getDynastyById } from '../database/helpers';
import { mediaDirFor } from './ipc/media';
import type { DynastyBackupContents, DynastyBackupEstimate, DynastyBackupResult } from '../shared/types';

/**
 * Per-dynasty backup — one dynasty's ARCHIVE (its whole recorded history) plus,
 * optionally, its photos, trading-card images and latest game save, written to
 * a single `.zip` the user chooses the location of.
 *
 * Three deliberate decisions:
 *
 * 1. **A plain `.zip`, not a custom format.** The whole point is a file that
 *    still means something years later, on a machine that may not run this app.
 *    Anyone can open a zip and see their screenshots; a bespoke container makes
 *    a user's memories hostage to a program still existing.
 * 2. **Per dynasty, not everything.** The user picks a dynasty and gets exactly
 *    that dynasty — no other program's data rides along.
 * 3. **The user picks what goes in.** Photos and saves are optional, with sizes
 *    shown up front, so a 30-year dynasty and a light archive-only backup are
 *    both one click away.
 */

/** Layout inside the zip. Restore reads these paths, so they're part of the format. */
export const BACKUP_PATHS = {
  manifest: 'dynastyos-backup.json',
  readme: 'README.txt',
  archive: 'archive/dynasty-archive.sqlite',
  media: 'media',
  cardPhotos: 'card-photos',
  save: 'save',
} as const;

/** Bumped only if the layout above changes in a way restore must branch on. */
export const BACKUP_FORMAT_VERSION = 1;

function cardPhotoDirFor(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'card-photos', dynastyId);
}

async function folderBytes(dir: string): Promise<{ files: string[]; bytes: number }> {
  const files: string[] = [];
  let bytes = 0;
  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return { files, bytes }; // No folder = nothing to back up, not an error.
  }
  for (const name of entries) {
    try {
      const stat = await fsp.stat(path.join(dir, name));
      if (!stat.isFile()) continue;
      files.push(name);
      bytes += stat.size;
    } catch {
      // Vanished mid-scan — skip it.
    }
  }
  return { files, bytes };
}

/**
 * What each part of this dynasty's backup would cost, so the picker can show
 * real sizes as the user ticks boxes rather than making them guess.
 *
 * The archive figure is the dynasty's stored season payloads. It's a slight
 * UNDER-estimate of the extracted database (which carries row overhead too),
 * and it ignores zip compression, which pulls the finished file back the other
 * way — text-heavy archive data compresses hard.
 */
export async function estimateDynastyBackup(dynastyId: string): Promise<DynastyBackupEstimate | null> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const db = openDetachedDatabase();
  let archiveBytes = 0;
  let seasonCount = 0;
  try {
    const sizeStmt = db.prepare(
      `SELECT COALESCE(SUM(LENGTH(payload)), 0) AS b FROM season_snapshots
        WHERE season_id IN (SELECT id FROM seasons WHERE dynasty_id = ?)`,
    );
    sizeStmt.bind([dynastyId]);
    if (sizeStmt.step()) archiveBytes = Number((sizeStmt.getAsObject() as { b: number }).b ?? 0);
    sizeStmt.free();

    const seasonStmt = db.prepare('SELECT COUNT(*) AS c FROM seasons WHERE dynasty_id = ?');
    seasonStmt.bind([dynastyId]);
    if (seasonStmt.step()) seasonCount = Number((seasonStmt.getAsObject() as { c: number }).c ?? 0);
    seasonStmt.free();
  } finally {
    db.close();
  }

  const media = await folderBytes(mediaDirFor(dynastyId));
  const cards = await folderBytes(cardPhotoDirFor(dynastyId));

  let saveGameBytes = 0;
  let saveGameName: string | null = null;
  try {
    const stat = await fsp.stat(dynasty.savePath);
    saveGameBytes = stat.size;
    saveGameName = path.basename(dynasty.savePath);
  } catch {
    // The save file has moved or been deleted — the checkbox is offered as
    // unavailable rather than silently producing a backup without it.
  }

  return {
    dynastyId,
    label: dynasty.label,
    teamName: dynasty.teamName ?? dynasty.label,
    seasonCount,
    archiveBytes,
    mediaFiles: media.files.length,
    mediaBytes: media.bytes,
    cardPhotoFiles: cards.files.length,
    cardPhotoBytes: cards.bytes,
    saveGameBytes,
    saveGameName,
    saveGameAvailable: saveGameName !== null,
  };
}

/**
 * Builds a database containing ONLY this dynasty, by opening a throwaway copy
 * of the live archive and deleting every other dynasty out of it.
 *
 * Deleting the others (rather than copying this one's rows into a fresh
 * database) is deliberate: the schema already cascades a dynasty's seasons,
 * snapshots, players, notes, media rows and awards, so this inherits that
 * correctness instead of re-implementing the relationships by hand across a
 * dozen tables and getting one subtly wrong. VACUUM then shrinks the result to
 * just this dynasty's data.
 */
function buildSingleDynastyArchive(dynastyId: string): Buffer {
  const db = openDetachedDatabase();
  try {
    db.run('PRAGMA foreign_keys = ON;');
    db.run('DELETE FROM dynasties WHERE id != ?', [dynastyId]);
    // Anything a past build stranded would otherwise ride along as dead weight.
    for (const [table, column] of [
      ['seasons', 'dynasty_id'],
      ['players', 'dynasty_id'],
      ['coaches', 'dynasty_id'],
      ['recruits', 'dynasty_id'],
      ['championships', 'dynasty_id'],
      ['program_milestones', 'dynasty_id'],
      ['player_career_stats', 'dynasty_id'],
      ['player_notes', 'dynasty_id'],
      ['media_items', 'dynasty_id'],
      ['team_award_results', 'dynasty_id'],
      ['team_award_settings', 'dynasty_id'],
    ]) {
      try {
        db.run(`DELETE FROM ${table} WHERE ${column} NOT IN (SELECT id FROM dynasties)`);
      } catch {
        // Table absent in this schema version — nothing to clean.
      }
    }
    db.run('VACUUM');
    return Buffer.from(db.export());
  } finally {
    db.close();
  }
}

/** A default filename that reads well in a folder full of other things. */
export function suggestedBackupFileName(teamName: string): string {
  const safe = teamName.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Dynasty';
  const date = new Date().toISOString().slice(0, 10);
  return `${safe} Dynasty Backup ${date}.zip`;
}

function readmeText(estimate: DynastyBackupEstimate, contents: DynastyBackupContents): string {
  const lines = [
    `${estimate.teamName} — dynasty backup`,
    `Created ${new Date().toLocaleString()}`,
    `Seasons recorded: ${estimate.seasonCount}`,
    '',
    'WHAT IS THIS?',
    'A backup of one dynasty from DynastyOS. To put it back, open the app',
    'and choose Restore, then pick this file.',
    '',
    'WHAT IS INSIDE?',
    `  ${BACKUP_PATHS.archive}`,
    '      The dynasty archive itself: every season, stat, award and note.',
    '      A standard SQLite database if you ever want to read it directly.',
  ];
  if (contents.media) {
    lines.push(
      `  ${BACKUP_PATHS.media}/`,
      `      Your ${estimate.mediaFiles} Media Hub photos and videos, as ordinary files.`,
      '      You can open these in any picture viewer, with or without the app.',
    );
  }
  if (contents.cardPhotos) {
    lines.push(`  ${BACKUP_PATHS.cardPhotos}/`, `      Photos used on player trading cards (${estimate.cardPhotoFiles}).`);
  }
  if (contents.saveGame && estimate.saveGameAvailable) {
    lines.push(`  ${BACKUP_PATHS.save}/${estimate.saveGameName}`, '      Your EA College Football save file, as last synced.');
  }
  lines.push(
    '',
    'NOT INCLUDED: player portraits, team logos and trophy art. Those are shared',
    'artwork rather than your data, and are reinstalled with the app.',
    '',
  );
  return lines.join('\n');
}

/**
 * Adds a file with compression switched OFF. Photos, videos and save files are
 * already-compressed formats where deflating costs seconds and saves almost
 * nothing.
 *
 * Built as a typed `ZipEntryData` rather than an inline literal because
 * archiver's v5 typings declare `file()` as taking the format-agnostic
 * `EntryData`, which omits zip's per-entry `store` flag — the runtime honours
 * it, the type just doesn't mention it.
 */
function addStoredFile(zip: archiver.Archiver, filePath: string, name: string): void {
  const entry: archiver.ZipEntryData = { name, store: true };
  zip.file(filePath, entry);
}

export interface BackupProgress {
  /** 0-100, for a progress bar that reflects bytes rather than file count. */
  percent: number;
  step: string;
}

/**
 * Writes the backup zip. Media, card photos and the save file are STORED rather
 * than deflated — they're already-compressed formats where compression costs
 * seconds and saves almost nothing — while the archive database, which is
 * mostly text, is deflated hard (a real 170 MB archive gzips to 58 MB).
 */
export async function createDynastyBackup(
  dynastyId: string,
  contents: DynastyBackupContents,
  destinationPath: string,
  onProgress?: (progress: BackupProgress) => void,
): Promise<DynastyBackupResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'That dynasty no longer exists.' };

  const estimate = await estimateDynastyBackup(dynastyId);
  if (!estimate) return { success: false, message: 'That dynasty no longer exists.' };

  try {
    // Flush pending writes so the copy we extract from is fully up to date.
    persist();

    onProgress?.({ percent: 5, step: 'Preparing the archive…' });
    const archiveBuffer = buildSingleDynastyArchive(dynastyId);

    const output = fs.createWriteStream(destinationPath);
    const zip = archiver('zip', { zlib: { level: 6 } });

    const done = new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', reject);
      zip.on('error', reject);
      zip.on('warning', (err: NodeJS.ErrnoException) => {
        // ENOENT here means a file disappeared mid-write; everything else is real.
        if (err.code !== 'ENOENT') reject(err);
      });
    });
    zip.pipe(output);

    const totalBytes =
      estimate.archiveBytes +
      (contents.media ? estimate.mediaBytes : 0) +
      (contents.cardPhotos ? estimate.cardPhotoBytes : 0) +
      (contents.saveGame ? estimate.saveGameBytes : 0);
    zip.on('progress', (data: archiver.ProgressData) => {
      const processed = data.fs.processedBytes;
      const percent = totalBytes > 0 ? Math.min(95, 5 + Math.round((processed / totalBytes) * 90)) : 50;
      onProgress?.({ percent, step: 'Writing backup…' });
    });

    zip.append(archiveBuffer, { name: BACKUP_PATHS.archive });
    zip.append(readmeText(estimate, contents), { name: BACKUP_PATHS.readme });

    if (contents.media) {
      const dir = mediaDirFor(dynastyId);
      const { files } = await folderBytes(dir);
      for (const name of files) addStoredFile(zip, path.join(dir, name), `${BACKUP_PATHS.media}/${name}`);
    }
    if (contents.cardPhotos) {
      const dir = cardPhotoDirFor(dynastyId);
      const { files } = await folderBytes(dir);
      for (const name of files) addStoredFile(zip, path.join(dir, name), `${BACKUP_PATHS.cardPhotos}/${name}`);
    }
    if (contents.saveGame && estimate.saveGameAvailable) {
      addStoredFile(zip, dynasty.savePath, `${BACKUP_PATHS.save}/${estimate.saveGameName}`);
    }

    zip.append(
      JSON.stringify(
        {
          formatVersion: BACKUP_FORMAT_VERSION,
          app: 'DynastyOS',
          appVersion: app.getVersion(),
          createdAt: new Date().toISOString(),
          dynasty: {
            id: dynastyId,
            label: dynasty.label,
            teamName: estimate.teamName,
            seasonCount: estimate.seasonCount,
          },
          contents: {
            archive: true,
            media: contents.media ? estimate.mediaFiles : 0,
            cardPhotos: contents.cardPhotos ? estimate.cardPhotoFiles : 0,
            saveGame: contents.saveGame && estimate.saveGameAvailable ? estimate.saveGameName : null,
          },
        },
        null,
        2,
      ),
      { name: BACKUP_PATHS.manifest },
    );

    await zip.finalize();
    await done;

    onProgress?.({ percent: 100, step: 'Done' });
    const finalBytes = fs.statSync(destinationPath).size;
    return {
      success: true,
      message: `Backed up ${estimate.teamName} (${estimate.seasonCount} season${estimate.seasonCount === 1 ? '' : 's'}).`,
      filePath: destinationPath,
      bytes: finalBytes,
    };
  } catch (err) {
    // A partial zip is worse than none — it looks restorable and isn't.
    try {
      fs.unlinkSync(destinationPath);
    } catch {
      // Never written, or already gone.
    }
    return { success: false, message: err instanceof Error ? err.message : 'Backup failed unexpectedly.' };
  }
}
