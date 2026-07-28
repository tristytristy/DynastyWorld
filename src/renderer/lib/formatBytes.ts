/**
 * Byte counts as something a person reads at a glance ("1.7 GB", "57 MB").
 * Shared by the storage panel and the dynasty backup picker, which both show
 * sizes the user is making decisions about.
 *
 * Precision scales with the unit on purpose: "170 MB" is the useful answer,
 * "170.13 MB" is noise — but under 10 of a unit ("1.7 GB", "9.2 MB") the
 * decimal genuinely carries information.
 */
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}
