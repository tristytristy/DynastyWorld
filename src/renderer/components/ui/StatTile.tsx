/**
 * Labeled metric tile — uppercase eyebrow above a large value. Previously
 * defined identically as `StatTile` (Season Overview, Schedule) and
 * `SummaryTile` (Roster); consolidated here. The value renders in the display
 * face with tabular numerals (visual overhaul §17) so tiles in a row align
 * and values don't jitter when they change.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="type-stat-md mt-3 text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
