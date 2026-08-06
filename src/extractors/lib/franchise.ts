import fs from 'fs';
import path from 'path';
import Franchise from 'madden-franchise';

export type OpenFranchise = Awaited<ReturnType<typeof Franchise.create>>;

/**
 * madden-franchise records are runtime Proxies (field access like `record.DisplayName`
 * is dynamic), so there's no useful static type from the library itself. This is the
 * boundary type for the rest of the extractors — everything past this file works with
 * our own typed interfaces instead.
 */
export interface FranchiseRecord {
  isEmpty: boolean;
  /** Keyed by field name — used to enumerate a record's fields dynamically (e.g. array-row slot keys) when the count isn't fixed/known ahead of time. */
  fields: Record<string, unknown>;
  getFieldByKey(key: string): { value: string } | null;
  getReferenceDataByKey(key: string): { tableId: number; rowNumber: number } | null;
  [key: string]: unknown;
}

export interface FranchiseTable {
  name: string;
  header: { recordCapacity: number };
  records: FranchiseRecord[];
  readRecords(attributes?: string[]): Promise<void>;
  /**
   * Present on normal tables, ABSENT on the `Foo[]` array containers — those
   * hold numbered reference fields instead and are read off the record itself.
   * Optional here so a caller has to acknowledge which kind it's holding.
   */
  schema?: { attributes: { name: string }[] };
}

/** The shape of the library instance this module reaches into — everything else treats it as opaque. */
interface FranchiseInternals {
  tables: { header?: { tableId: number } }[];
  getTableById(id: number): unknown;
}

/**
 * Replaces the library's `getTableById` with an indexed lookup.
 *
 * The original is `this.tables.find(t => t.header && t.header.tableId === id)`
 * — a LINEAR SCAN over every table in the file, and a real save holds **2,400
 * of them**. That would be unremarkable if it ran occasionally, but it is the
 * innermost operation of the whole extraction: every reference resolution goes
 * through it (`resolveReferenceWithTable` here, and the library's own
 * `getReferencedRecord`), and one import performs **316,000** of them. A single
 * player's per-game stats mean ~23 resolutions, times 16,500 players.
 *
 * Measured on a real save: the two heaviest traversals took 2,704 ms and
 * 2,009 ms; with the lookup indexed they take 128 ms and 129 ms. The scan was
 * roughly 95% of both.
 *
 * Wrapping the instance rather than our own helpers is deliberate — it also
 * fixes `getReferencedRecord`, which takes the same path and which
 * `resolveReference` depends on, without reimplementing the library's
 * reference decoding.
 *
 * The index is built once, lazily, and keeps the FIRST table for an id — the
 * same one `find` would have returned. Misses are memoised too (a null
 * reference decodes to a table id that doesn't exist, and those are common
 * enough that re-scanning for them would give most of the cost straight back).
 * Tables are parsed when the file opens and nothing adds one afterwards, so
 * neither a hit nor a miss can go stale.
 */
function indexTablesById(franchise: OpenFranchise): void {
  const internals = franchise as unknown as FranchiseInternals;
  const original = internals.getTableById.bind(internals);
  let index: Map<number, unknown> | null = null;

  internals.getTableById = (id: number) => {
    if (!index) {
      index = new Map();
      for (const table of internals.tables) {
        if (table.header && !index.has(table.header.tableId)) index.set(table.header.tableId, table);
      }
    }
    if (index.has(id)) return index.get(id);
    const found = original(id);
    index.set(id, found);
    return found;
  };
}

/*
  SCHEMAS FOR SAVES NEWER THAN THE LIBRARY KNOWS ABOUT.

  A save is unlabelled binary; the schema is the map that says which bits are
  TeamIndex, which are the coach's name, and so on. madden-franchise ships those
  maps and picks one per file.

  ITS PICKER CANNOT BE TRUSTED ACROSS A GAME PATCH. It selects the schema whose
  major version is numerically CLOSEST to the one the save asks for — and the two
  numbering schemes are unrelated. Measured on real saves: a pre-patch file asks
  for major 814 and a post-patch file for 833, while the schemas are numbered 468
  and 486. Both files land on 486 because it is nearer to both numbers, so simply
  adding a newer schema silently breaks every save that predates it.

  The August 6 2026 title update added a field to the Coach table (137 members →
  138). Every tool that reads coaches broke the same day, ours included, with
  "Could not determine which team this dynasty belongs to" — the schema refuses
  to bind, zero coaches parse, and nothing identifies the user's team.

  So: open normally, and only if the Coach table failed to bind, reopen pointing
  at the newer schema by PATH, which bypasses the picker entirely. Unpatched
  saves take the original path and are completely unaffected; patched saves pay
  one extra open, which is cheap beside the extraction that follows.

  Adding a future patch's schema means dropping its .gz into resources/schemas/27
  and listing it below, newest first.
*/
const FALLBACK_SCHEMAS: { fileName: string; gameYear: number; major: number; minor: number }[] = [
  // EA CFB 27 title update, 6 August 2026.
  { fileName: 'C27_486_1.gz', gameYear: 27, major: 486, minor: 1 },
];

function bundledSchemaPath(fileName: string): string | null {
  const candidates = [
    // Packaged: electron-builder copies resources/schemas via extraResources.
    process.resourcesPath ? path.join(process.resourcesPath, 'schemas', '27', fileName) : null,
    // Dev / tests, run from the repo.
    path.join(process.cwd(), 'resources', 'schemas', '27', fileName),
  ].filter((p): p is string => p !== null);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/**
 * Did the Coach table get a real schema, or did the library fall back to
 * generating anonymous `Field_0`, `Field_1`… from the header? The latter parses
 * without error and yields nothing usable, so it has to be detected explicitly.
 */
function coachTableBound(franchise: OpenFranchise): boolean {
  const tables = franchise.getAllTablesByName('Coach') as unknown as FranchiseTable[];
  if (!tables || tables.length === 0) return true; // nothing to judge; let the caller fail normally
  const biggest = tables.reduce((a, b) => (b.header.recordCapacity > a.header.recordCapacity ? b : a));
  return Boolean(biggest.schema);
}

export async function openFranchiseFile(filePath: string): Promise<OpenFranchise> {
  let franchise = await Franchise.create(filePath);

  if (!coachTableBound(franchise)) {
    for (const candidate of FALLBACK_SCHEMAS) {
      const schemaPath = bundledSchemaPath(candidate.fileName);
      if (!schemaPath) continue;
      /*
        `path` is what actually does the work — it bypasses the picker and loads
        this exact file. The version fields alongside it are the same schema's
        real metadata; they're supplied because the library's type requires them,
        and they keep the override self-describing rather than an opaque path.
      */
      const settings = {
        schemaOverride: {
          gameYear: candidate.gameYear,
          major: candidate.major,
          minor: candidate.minor,
          path: schemaPath,
        },
        // Cast because the library's published settings type demands every
        // option and doesn't declare `path` on the override, while the runtime
        // reads exactly this shape (see its schemaOverride.path branch).
      } as unknown as Parameters<typeof Franchise.create>[1];
      const retried = await Franchise.create(filePath, settings);
      if (coachTableBound(retried)) {
        franchise = retried;
        break;
      }
    }
  }

  indexTablesById(franchise);
  return franchise;
}

/**
 * A table name can be fragmented across several small placeholder instances plus one
 * real data table (observed: 9 tables named "Team", capacities 1×7 + 6 + 143 — only the
 * 143 is real). The real instance is always the one with the largest capacity.
 */
export function getLargestTable(franchise: OpenFranchise, name: string): FranchiseTable {
  const tables = franchise.getAllTablesByName(name) as unknown as FranchiseTable[];
  if (tables.length === 0) {
    throw new Error(`No table found named "${name}"`);
  }
  return tables.reduce((largest, t) =>
    t.header.recordCapacity > largest.header.recordCapacity ? t : largest,
  );
}

/**
 * Resolves a reference field (e.g. a game's HomeTeam) to its target record.
 * The target table's records must already be loaded via readRecords() — the
 * library looks up `targetTable.records[rowNumber]` internally.
 */
export function resolveReference(
  franchise: OpenFranchise,
  record: FranchiseRecord,
  key: string,
): FranchiseRecord | undefined {
  const field = record.getFieldByKey(key);
  if (!field) return undefined;
  return franchise.getReferencedRecord(field.value) as unknown as FranchiseRecord | undefined;
}

export function nonEmpty(records: FranchiseRecord[]): FranchiseRecord[] {
  return records.filter((r) => !r.isEmpty);
}

/**
 * Locates a single record by its PresentationId — the stable per-record ID
 * this app already keys players/coaches by everywhere else. Used by the
 * editor's write path: open the franchise file fresh, find the exact same
 * record the user was editing, and apply field changes to it directly.
 */
export async function findRecordByPresentationId(
  franchise: OpenFranchise,
  tableName: string,
  presentationId: number,
): Promise<FranchiseRecord | undefined> {
  const table = getLargestTable(franchise, tableName);
  await table.readRecords();
  return nonEmpty(table.records).find((r) => Number(r.PresentationId) === presentationId);
}

/**
 * Loads every table instance sharing this name (not just the largest — see
 * getLargestTable). Needed before resolving a reference whose target table
 * isn't known ahead of time (e.g. a stat reference that could land in any of
 * several same-named fragments); resolveReferenceWithTable indexes into
 * whichever specific instance getTableById returns, so all instances must be
 * pre-loaded, not just the largest.
 */
export async function preloadAllInstances(
  franchise: OpenFranchise,
  name: string,
  /**
   * Which attributes to load. Omit for all of them — which is right for small
   * tables and required for the write paths, but ruinous on `Player`: see
   * lib/playerFields.ts.
   */
  attributes?: string[],
): Promise<void> {
  const tables = franchise.getAllTablesByName(name) as unknown as FranchiseTable[];
  await Promise.all(tables.map((t) => t.readRecords(attributes)));
}

/**
 * Resolves a reference field to both its target record and the table it lives
 * in. Needed when a single reference field can point to different tables
 * depending on context (e.g. a player's CareerStats resolves to
 * CareerOffensiveStats, CareerDefensiveStats, CareerKickingStats, or
 * CareerOLineStats depending on position) — the table name lets callers route
 * on the result without guessing from the source record. The target table
 * must already be loaded via readRecords()/preloadAllInstances().
 */
export function resolveReferenceWithTable(
  franchise: OpenFranchise,
  record: FranchiseRecord,
  key: string,
): { table: FranchiseTable; record: FranchiseRecord } | undefined {
  const refData = record.getReferenceDataByKey(key);
  if (!refData) return undefined;
  const table = franchise.getTableById(refData.tableId) as unknown as FranchiseTable | null;
  if (!table) return undefined;
  const targetRecord = table.records[refData.rowNumber];
  if (!targetRecord || targetRecord.isEmpty) return undefined;
  return { table, record: targetRecord };
}
