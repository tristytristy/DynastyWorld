import type { ProgramHistorySeasonEntry } from '../../../shared/types';

/**
 * WHAT THE APP PUT BACK, AND WHAT IT COULD NOT.
 *
 * Shown for a season that was synced before it finished. The app has already
 * corrected the numbers from the save's own year-row — this exists to say so
 * plainly, and to be specific about what is gone, because the alternative is a
 * coach who notices their 12-2 season has no box scores and concludes the app
 * lost them.
 *
 * The honesty is the point, so the missing half is stated as flatly as the
 * recovered half rather than buried under it. The closing line is the only
 * advice given, and it is given once: there is nothing the user can do about
 * these seasons now, and a lecture attached to a loss they cannot undo reads as
 * blame. What it can do is change what happens next season.
 */
export function RecoveredSeasonNotice({
  season,
  onClose,
}: {
  season: ProgramHistorySeasonEntry;
  onClose: () => void;
}) {
  const totalGames = (season.wins ?? 0) + (season.losses ?? 0);
  const captured = season.capturedGames ?? 0;

  const restored = [
    season.wins !== null && season.losses !== null
      ? `Final record — ${season.wins}-${season.losses}`
      : null,
    season.conferenceWins !== null && season.conferenceLosses !== null
      ? `Conference record — ${season.conferenceWins}-${season.conferenceLosses}`
      : null,
    season.mediaRank !== null ? `Final ranking — #${season.mediaRank}` : null,
    season.conferenceChampion
      ? `${season.conferenceChampionName ?? 'Conference'} champions`
      : null,
    season.nationalChampion ? 'National champions' : null,
    season.headCoachName ? `Head coach — ${season.headCoachName}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovered-season-title"
        onClick={(event) => event.stopPropagation()}
        className="corner-cut w-full max-w-lg border border-slate-300 bg-white p-6 dark:border-white/15 dark:bg-slate-900"
      >
        <p className="type-eyebrow text-slate-500 dark:text-slate-400">Season recovered</p>
        <h2
          id="recovered-season-title"
          className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white"
        >
          {season.seasonYear} {season.teamName}
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          This season was synced before it finished — DynastyOS only ever saw{' '}
          <strong className="font-semibold text-slate-900 dark:text-white">
            {captured} of {totalGames} games
          </strong>
          . The rest has been read back from your save&apos;s own program history, so the
          numbers here are the game&apos;s, not a guess.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="type-eyebrow text-emerald-700 dark:text-emerald-400">Recovered</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              {restored.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="type-eyebrow text-slate-500 dark:text-slate-400">Gone for good</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              <li>Individual game results and box scores</li>
              <li>Player and team stats</li>
              <li>Week-by-week poll movement</li>
              <li>Which bowl was played, and its trophy</li>
            </ul>
          </div>
        </div>

        <p className="mt-5 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:text-slate-300">
          Your save only keeps one season&apos;s games at a time — once the dynasty advances
          to the next year, the detail is overwritten and nothing can bring it back. Syncing
          at the <strong className="font-semibold text-slate-900 dark:text-white">End of Season Recap</strong>{' '}
          keeps a season whole.
        </p>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="corner-cut-sm border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/40"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
