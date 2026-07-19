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
}

export async function openFranchiseFile(filePath: string): Promise<OpenFranchise> {
  return Franchise.create(filePath);
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
export async function preloadAllInstances(franchise: OpenFranchise, name: string): Promise<void> {
  const tables = franchise.getAllTablesByName(name) as unknown as FranchiseTable[];
  await Promise.all(tables.map((t) => t.readRecords()));
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
