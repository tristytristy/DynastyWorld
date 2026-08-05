import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from '../../components/common/TeamLogo';
import { spaceCamelCase } from '../../components/common/CoachCard';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatTile } from '../../components/ui/StatTile';
import { getBowlLogoPath, getConferenceChampionshipTrophyPath, getTrophyImagePath } from '../../lib/trophyAssetMapping';
import { useCoachHubReady, useCoachQuery, useSeasonCoaches } from './coachData';
import { recordLine } from './coachMetrics';
import type { ProgramHistoryOverview } from '../../../shared/types';

/**
 * Career highs, and the school/role splits — the two things a résumé adds that a
 * list of seasons doesn't.
 *
 * SPLITS ONLY APPEAR WHEN THERE IS SOMETHING TO SPLIT. A coach with one school
 * and one role would get two controls that each show his whole career back to
 * him, which the spec explicitly rules out; a journey across two programmes is
 * exactly when the comparison starts meaning something.
 *
 * Every figure here comes from the seasons this archive actually has, so nothing
 * claims to know about years before the dynasty was imported.
 */
function CareerSplits({
  history,
  userPositionByYear,
}: {
  history: ProgramHistoryOverview;
  userPositionByYear: Map<number, string>;
}) {
  const seasons = history.seasons;

  const bySchool = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; seasons: number }>();
    for (const s of seasons) {
      const row = map.get(s.teamName) ?? { wins: 0, losses: 0, seasons: 0 };
      row.wins += s.wins;
      row.losses += s.losses;
      row.seasons += 1;
      map.set(s.teamName, row);
    }
    return [...map.entries()];
  }, [seasons]);

  const byRole = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; seasons: number }>();
    for (const s of seasons) {
      const role = userPositionByYear.get(s.seasonYear);
      if (!role) continue;
      const row = map.get(role) ?? { wins: 0, losses: 0, seasons: 0 };
      row.wins += s.wins;
      row.losses += s.losses;
      row.seasons += 1;
      map.set(role, row);
    }
    return [...map.entries()];
  }, [seasons, userPositionByYear]);

  const highs = useMemo(() => {
    const played = seasons.filter((s) => s.wins + s.losses > 0);
    if (played.length === 0) return null;
    const best = played.reduce((a, b) => (b.wins > a.wins || (b.wins === a.wins && b.losses < a.losses) ? b : a));
    const ranked = played.filter((s) => s.mediaRank !== null && s.mediaRank > 0);
    const bestRank = ranked.length ? ranked.reduce((a, b) => (b.mediaRank! < a.mediaRank! ? b : a)) : null;
    return { best, bestRank };
  }, [seasons]);

  const rows = (entries: [string, { wins: number; losses: number; seasons: number }][], label: string) => (
    <div>
      <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">{label}</p>
      <div className="space-y-1.5">
        {entries.map(([name, r]) => (
          <div
            key={name}
            className="corner-cut-sm flex items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm dark:border-slate-800 dark:bg-white/5"
          >
            <span className="truncate font-medium text-slate-800 dark:text-slate-200">{spaceCamelCase(name)}</span>
            <span className="tnum shrink-0 font-semibold text-slate-900 dark:text-white">
              {r.wins}-{r.losses}
              <span className="ml-2 font-normal text-slate-400 dark:text-slate-500">
                {r.seasons} {r.seasons === 1 ? 'season' : 'seasons'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const showSchools = bySchool.length > 1;
  const showRoles = byRole.length > 1;
  if (!showSchools && !showRoles && !highs) return null;

  return (
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {showSchools && rows(bySchool, 'By school')}
      {showRoles && rows(byRole, 'By role')}
      {highs && (
        <div>
          <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">Career highs</p>
          <div className="space-y-1.5">
            <HighRow
              label="Best season"
              value={`${highs.best.wins}-${highs.best.losses}`}
              detail={`${highs.best.seasonYear} · ${highs.best.teamName}`}
            />
            {highs.bestRank && (
              <HighRow
                label="Highest finish"
                value={`#${highs.bestRank.mediaRank}`}
                detail={`${highs.bestRank.seasonYear} · ${highs.bestRank.teamName}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HighRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="corner-cut-sm flex items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm dark:border-slate-800 dark:bg-white/5">
      <span className="truncate text-slate-500 dark:text-slate-400">{label}</span>
      <span className="shrink-0 text-right">
        <span className="tnum font-semibold text-slate-900 dark:text-white">{value}</span>
        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{detail}</span>
      </span>
    </div>
  );
}

const nationalChampionshipTrophyPath = getTrophyImagePath({
  kind: 'national-championship',
  label: 'National Champions',
  assetKey: null,
});

/**
 * Coach Career — "what have I accomplished?".
 *
 * Phase 1 consolidates the two career sections the single-page Coach had split
 * apart (Career Record, from the save's own lifetime figures, and Career
 * Résumé, from this archive's own season history) into one destination. The
 * deeper treatment — achievement cabinet, drillable season rows, school/role
 * splits, career highs — is Phase 4.
 *
 * NO DRAFT METRICS. The "Draft picks" and "1st round picks" tiles that used to
 * sit in this grid are gone and are not replaced: the game's draft data doesn't
 * survive a season reliably (a 2027 save showed a player who never entered the
 * draft as drafted, and omitted an actual late-round pick). The fields remain on
 * CareerCoachStats for compatibility; nothing in the Coach Hub renders them.
 */
export function CoachCareer() {
  const { dynastyId, overview, userCoach, career, userPositionByYear } = useCoachHubReady();
  // Only the LIGHT all-seasons load: the user's own position per season is what
  // turns the program timeline below into a career timeline, and that comes from
  // the coaches snapshots alone — no per-season schedules needed here.
  useSeasonCoaches();
  const history = useCoachQuery<ProgramHistoryOverview | null>(
    dynastyId ? `history:${dynastyId}` : null,
    () => window.api.db.getHistory(dynastyId),
  );

  return (
    <div className="space-y-6">
      {userCoach && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Career Record</p>
          {career ? (
            <>
              <div className="mt-4 overflow-hidden bg-[var(--team-primary)] p-5 text-[var(--team-on-primary)]">
                <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
                <p className="mt-2 type-stat-lg">{recordLine(career.wins, career.losses)}</p>
                <p className="mt-1 text-sm opacity-80">
                  At {overview.teamName}: {recordLine(career.winsAtCurrentSchool, career.lossesAtCurrentSchool)}
                </p>
              </div>
              {/* The trophies themselves live in the Trophy Room — this panel is
                  the RECORD, not the cabinet, and building a second cabinet here
                  would be the duplication the refactor exists to remove. */}
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                Every trophy behind these numbers is on display in the{' '}
                <Link
                  to={`/dynasty/${dynastyId}/coach/trophy-room`}
                  className="font-semibold text-[var(--team-accent-text)] underline-offset-4 hover:underline"
                >
                  Trophy Room
                </Link>
                .
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <StatTile label="Bowl record" value={recordLine(career.bowlWins, career.bowlLosses)} />
                <StatTile label="Conf. titles" value={recordLine(career.confChampWins, career.confChampLosses)} />
                <StatTile label="National titles" value={String(career.ncWins)} />
                <StatTile label="Playoff record" value={recordLine(career.playoffWins, career.playoffLosses)} />
                <StatTile label="Rivalry record" value={recordLine(career.rivalWins, career.rivalLosses)} />
                <StatTile label="Top 25 record" value={recordLine(career.top25Wins, career.top25Losses)} />
                <StatTile label="Top-5 recruit classes" value={String(career.top5RecruitClasses)} />
                <StatTile label="Players developed to max" value={String(career.playersMaxProgressed)} />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No career record available for this coach.</p>
          )}
        </SurfaceCard>
      )}

      {history === undefined && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading career résumé...</p>
      )}

      {history && history.seasons.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Career Résumé</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}&apos;s coaching journey
          </h3>
          {(() => {
            const rs = history.seasons;
            const schools = [...new Map(rs.map((s) => [s.teamName, s.teamName])).keys()];
            const trackedWins = rs.reduce((sum, s) => sum + s.wins, 0);
            const trackedLosses = rs.reduce((sum, s) => sum + s.losses, 0);
            const natTitles = rs.filter((s) => s.nationalChampion).length;
            const confTitles = rs.filter((s) => s.conferenceChampion).length;
            return (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Seasons tracked" value={String(rs.length)} />
                  <StatTile label="Tracked record" value={recordLine(trackedWins, trackedLosses)} />
                  <StatTile label="National titles" value={String(natTitles)} />
                  <StatTile label="Conf. titles" value={String(confTitles)} />
                </div>
                {schools.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {schools.length === 1 ? 'School' : `${schools.length} schools`}:
                    </span>
                    {schools.map((school) => (
                      <span
                        key={school}
                        className="inline-flex items-center gap-1.5 border border-slate-200/80 bg-slate-50/85 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
                      >
                        <TeamLogo team={{ assetName: school, label: school }} size="sm" className="!h-4 !w-4" />
                        {school}
                      </span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          <CareerSplits history={history} userPositionByYear={userPositionByYear} />

          <ul className="mt-4 space-y-2">
            {history.seasons.map((season) => {
              const bowlLogoPath = season.bowlAppearance ? getBowlLogoPath(season.bowlAssetName) : null;
              const confTrophyPath =
                season.conferenceChampion && season.conferenceChampionName
                  ? getConferenceChampionshipTrophyPath(season.conferenceChampionName)
                  : null;
              return (
                <li
                  key={season.seasonYear}
                  className="corner-cut-sm flex flex-wrap items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {season.seasonYear} — {season.teamName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(() => {
                          const pos = userPositionByYear.get(season.seasonYear);
                          if (!pos) return season.headCoachName ?? 'Unknown coach';
                          // If the user WAS the head coach, "HC: <self>" is redundant.
                          const showHc = pos !== 'HeadCoach' && season.headCoachName;
                          return `${spaceCamelCase(pos)}${showHc ? ` · HC: ${season.headCoachName}` : ''}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {season.nationalChampion && nationalChampionshipTrophyPath && (
                        <img
                          src={nationalChampionshipTrophyPath}
                          alt="National champions"
                          title="National champions"
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {confTrophyPath && (
                        <img
                          src={confTrophyPath}
                          alt={`${season.conferenceChampionName} champions`}
                          title={`${season.conferenceChampionName} champions`}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {bowlLogoPath && (
                        <img
                          src={bowlLogoPath}
                          alt={season.bowlAppearance ?? 'Bowl appearance'}
                          title={season.postseasonSummary ?? season.bowlAppearance ?? undefined}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                    </div>
                    <span className="proportional-nums font-semibold text-slate-700 dark:text-slate-200">
                      {recordLine(season.wins, season.losses)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </SurfaceCard>
      )}
    </div>
  );
}
