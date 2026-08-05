/**
 * Number formatting for the update panel. Small, boring, and separate from the
 * component so the sizes can be reasoned about (and corrected) without opening
 * any JSX.
 */

/**
 * "42.8 MB". Decimal megabytes, not binary — it is the unit every download UI
 * and every browser uses, so a user comparing this to the file on GitHub sees
 * the same number rather than a mysteriously smaller one.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${Math.round(bytes / 1000)} KB`;
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb)} MB`;
}

/** "8.2 MB/s" — or nothing at all, because a speed of zero is noise, not information. */
export function formatSpeed(bytesPerSecond: number): string | null {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return null;
  const mb = bytesPerSecond / 1_000_000;
  if (mb < 0.1) return `${Math.round(bytesPerSecond / 1000)} KB/s`;
  return `${mb.toFixed(1)} MB/s`;
}

/** "42.8 MB of 117.4 MB" — the total is unknown until the first progress event, so it degrades to just the transferred figure. */
export function formatTransferred(transferred: number, total: number): string {
  if (total > 0) return `${formatBytes(transferred)} of ${formatBytes(total)}`;
  return formatBytes(transferred);
}

/** A release date as something readable, or null when GitHub didn't give one. */
export function formatReleaseDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
