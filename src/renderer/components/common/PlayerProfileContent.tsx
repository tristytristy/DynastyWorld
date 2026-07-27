import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RATING_SECTIONS } from '../../../shared/playerEditorFields';
import { SurfaceCard } from '../ui/SurfaceCard';
import { PlayerPortrait } from './PlayerPortrait';
import { TeamLogo } from './TeamLogo';
import { abbreviateClass } from '../../lib/rosterOrder';
import { formatAwardLabel, groupWeeklyHonors } from '../../lib/awardFormat';
import { getAwardTrophyPath } from '../../lib/trophyAssetMapping';
import { gameImpactScore, gameResultLine } from '../../../shared/gameImpactScore';
import type { PlayerModalFallback } from '../../data/PlayerModalProvider';
import { useEditorModal } from '../../data/EditorModalProvider';
import { EditButton } from './CoachCard';
import { MediaGallery } from './MediaGallery';
import { PlayerNotesTab } from './PlayerNotesTab';
import { TrendLineChart, type ChartSeries } from '../charts/TrendCharts';
import type {
  AwardsOverview,
  SeasonSummary,
  DefensiveGameLine,
  DefensiveStatLine,
  GameLogEntry,
  HonorRosterEntry,
  LeagueAward,
  MediaItemResolved,
  OffensiveGameLine,
  OffensiveStatLine,
  PlayerDevelopmentSeason,
  PlayerEditFields,
  PlayerStats,
  RosterPlayer,
  ScheduleOverview,
  TeamAwardDefinitionSummary,
  WeeklyHonor,
} from '../../../shared/types';

interface PlayerTeamAwardWin {
  seasonYear: number;
  awardName: string;
}

type AwardsBySeason = {
  seasonYear: number;
  awards: AwardsOverview;
};

type PlayerHonorSeason = {
  seasonYear: number;
  marqueeWins: LeagueAward[];
  honorTiers: HonorRosterEntry[];
  weeklyHonors: WeeklyHonor[];
};

type PlayerStatsBySeason = {
  seasonYear: number;
  roster: RosterPlayer[] | null;
  stats: PlayerStats[] | null;
};

type PlayerImportedStatSeason = {
  seasonYear: number;
  schoolYear: string | null;
  position: string | null;
  category: 'offense' | 'defense';
  line: OffensiveStatLine | DefensiveStatLine;
};

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

function BioTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 text-center dark:border-slate-800 dark:bg-white/5">
      <p className="proportional-nums text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function EmptySection({ title, message }: { title: string; message: string }) {
  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300/80 px-5 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        {message}
      </div>
    </SurfaceCard>
  );
}

function HonorsSection({
  seasons,
}: {
  seasons: PlayerHonorSeason[];
}) {
  if (seasons.length === 0) {
    return <EmptySection title="Honors" message="No awards, All-American selections, or weekly honors yet." />;
  }

  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Honors</h3>
      <div className="mt-4 space-y-4">
        {seasons.map((season) => {
          const weeklyGrouped = groupWeeklyHonors(season.weeklyHonors);
          return (
            <div
              key={season.seasonYear}
              className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {season.seasonYear}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {season.marqueeWins.length + season.honorTiers.length + season.weeklyHonors.length} honor
                  {season.marqueeWins.length + season.honorTiers.length + season.weeklyHonors.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {season.marqueeWins.map((award) => {
                  const imagePath = getAwardTrophyPath(award.awardType);
                  return (
                    <div
                      key={`${season.seasonYear}-${award.awardType}`}
                      className="flex items-center gap-2.5 border border-slate-200/80 py-1.5 pl-1.5 pr-3.5 dark:border-slate-700"
                    >
                      {imagePath ? (
                        <img src={imagePath} alt="" className="h-6 w-6 shrink-0 object-contain" draggable={false} />
                      ) : (
                        <span className="h-6 w-6 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatAwardLabel(award.awardType)}
                      </span>
                    </div>
                  );
                })}
                {season.honorTiers.map((entry, index) => (
                  <span
                    key={`${season.seasonYear}-${entry.awardType}-${index}`}
                    className="border border-slate-200/80 px-3.5 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {formatAwardLabel(entry.awardType)}
                  </span>
                ))}
                {weeklyGrouped.map((entry) => (
                  <span
                    key={`${season.seasonYear}-${entry.label}`}
                    className="bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400"
                  >
                    {entry.count > 1 ? `${entry.count}x ` : ''}
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

/** Confirmed/finalized Team Awards this player has won — the app's own coach-decided awards, distinct from the save-native Honors above. Only confirmed/finalized results ever show here; a merely-calculated recommendation isn't a real win yet. */
function TeamAwardsWonSection({ wins }: { wins: PlayerTeamAwardWin[] }) {
  if (wins.length === 0) return null;

  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Team Awards</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {wins.map((win, index) => (
          <span
            key={`${win.seasonYear}-${win.awardName}-${index}`}
            className="border border-slate-200/80 px-3.5 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {win.awardName} <span className="text-slate-400 dark:text-slate-500">— {win.seasonYear}</span>
          </span>
        ))}
      </div>
    </SurfaceCard>
  );
}

function offensiveTiles(line: OffensiveStatLine) {
  return [
    { label: 'Games', value: line.gamesPlayed },
    { label: 'Comp/Att', value: `${line.passCompletions}/${line.passAttempts}` },
    { label: 'Pass Yds', value: line.passYards },
    { label: 'Pass TD', value: line.passTDs },
    { label: 'INT', value: line.passInts },
    { label: 'Rush Att', value: line.rushAttempts },
    { label: 'Rush Yds', value: line.rushYards },
    { label: 'Rush TD', value: line.rushTDs },
    { label: 'Rec', value: line.receptions },
    { label: 'Rec Yds', value: line.receivingYards },
    { label: 'Rec TD', value: line.receivingTDs },
  ];
}

function defensiveTiles(line: DefensiveStatLine) {
  return [
    { label: 'Games', value: line.gamesPlayed },
    { label: 'Tackles', value: line.tackles },
    { label: 'Assists', value: line.assistedTackles },
    { label: 'TFL', value: line.tacklesForLoss },
    { label: 'Sacks', value: line.sacks },
    { label: 'INT', value: line.interceptions },
    { label: 'INT Yds', value: line.interceptionReturnYards },
    { label: 'Forced Fum.', value: line.forcedFumbles },
    { label: 'Fum. Rec.', value: line.fumbleRecoveries },
    { label: 'Pass Def.', value: line.passDeflections },
  ];
}

function StatLineSection({
  title,
  category,
  line,
  emptyMessage,
}: {
  title: string;
  category: 'offense' | 'defense' | undefined;
  line: OffensiveStatLine | DefensiveStatLine | null | undefined;
  emptyMessage: string;
}) {
  if (!line || !category) {
    return <EmptySection title={title} message={emptyMessage} />;
  }

  const tiles = category === 'offense' ? offensiveTiles(line as OffensiveStatLine) : defensiveTiles(line as DefensiveStatLine);

  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function buildImportedStatSeasons(history: PlayerStatsBySeason[], playerId: number): PlayerImportedStatSeason[] {
  return history
    .map(({ seasonYear, roster, stats }) => {
      const player = roster?.find((item) => item.id === playerId) ?? null;
      const playerStats = stats?.find((item) => item.playerId === playerId) ?? null;
      if (!playerStats?.season) return null;
      return {
        seasonYear,
        schoolYear: player?.schoolYear ?? null,
        position: player?.position ?? null,
        category: playerStats.category,
        line: playerStats.season,
      };
    })
    .filter((entry): entry is PlayerImportedStatSeason => entry !== null)
    .sort((a, b) => b.seasonYear - a.seasonYear);
}

function ImportedSeasonHistorySection({ seasons }: { seasons: PlayerImportedStatSeason[] }) {
  if (seasons.length === 0) {
    return (
      <EmptySection
        title="Season by season"
        message="No multi-season stat history is available yet. Import more seasons to build this player timeline."
      />
    );
  }

  const category = seasons[0].category;

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
        <h3 className="font-display text-section-title font-semibold text-slate-950 dark:text-white">Season by season</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          One row per imported season for this player.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50/85 text-slate-500 dark:bg-white/5 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Season</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Class</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Pos</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">GP</th>
              {category === 'offense' ? (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Pass Yds</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Pass TD</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Rush Yds</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Rush TD</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Rec Yds</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Rec TD</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Tkl</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">TFL</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Sacks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">INT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">FF</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">PD</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.seasonYear} className="border-t border-white/60 bg-slate-50/80 dark:border-white/5 dark:bg-white/5">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{season.seasonYear}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {season.schoolYear ? abbreviateClass(season.schoolYear) : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{season.position ?? '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{season.line.gamesPlayed}</td>
                {category === 'offense' ? (
                  <>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).passYards}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).passTDs}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).rushYards}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).rushTDs}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).receivingYards}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as OffensiveStatLine).receivingTDs}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).tackles}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).tacklesForLoss}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).sacks}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).interceptions}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).forcedFumbles}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {(season.line as DefensiveStatLine).passDeflections}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function offensiveGameTiles(line: OffensiveGameLine) {
  return [
    { label: 'Comp/Att', value: `${line.passCompletions}/${line.passAttempts}` },
    { label: 'Pass Yds', value: line.passYards },
    { label: 'Pass TD', value: line.passTDs },
    { label: 'INT', value: line.passInts },
    { label: 'Rush Att', value: line.rushAttempts },
    { label: 'Rush Yds', value: line.rushYards },
    { label: 'Rush TD', value: line.rushTDs },
    { label: 'Rec', value: line.receptions },
    { label: 'Rec Yds', value: line.receivingYards },
    { label: 'Rec TD', value: line.receivingTDs },
  ];
}

function defensiveGameTiles(line: DefensiveGameLine) {
  return [
    { label: 'Tackles', value: line.tackles },
    { label: 'Assists', value: line.assistedTackles },
    { label: 'TFL', value: line.tacklesForLoss },
    { label: 'Sacks', value: line.sacks },
    { label: 'INT', value: line.interceptions },
    { label: 'Forced Fum.', value: line.forcedFumbles },
    { label: 'Pass Def.', value: line.passDeflections },
  ];
}


function gameLogSummary(entry: GameLogEntry): string {
  if (entry.category === 'offense') {
    const line = entry.line as OffensiveGameLine;
    const parts: string[] = [];
    if (line.passAttempts > 0) parts.push(`${line.passCompletions}/${line.passAttempts}, ${line.passYards} yds, ${line.passTDs} TD`);
    if (line.rushAttempts > 0) parts.push(`${line.rushAttempts} car, ${line.rushYards} yds`);
    if (line.receptions > 0) parts.push(`${line.receptions} rec, ${line.receivingYards} yds`);
    return parts.join(' | ') || '-';
  }
  const line = entry.line as DefensiveGameLine;
  const parts = [`${line.tackles + line.assistedTackles} tkl`];
  if (line.sacks > 0) parts.push(`${line.sacks} sck`);
  if (line.interceptions > 0) parts.push(`${line.interceptions} INT`);
  return parts.join(' | ');
}

function GameLogSection({ entries, schedule }: { entries: GameLogEntry[]; schedule: ScheduleOverview | null }) {
  if (entries.length === 0) {
    return (
      <EmptySection
        title="Game log"
        message="No games played yet. A per-game stat line appears here once the season gets underway."
      />
    );
  }

  const rows = entries
    .map((entry) => ({ entry, game: schedule?.games.find((game) => game.gameId === entry.gameId) }))
    .sort((a, b) => (a.game?.week ?? 0) - (b.game?.week ?? 0));

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Game log</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Wk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Opponent</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Line</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.22em]">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, game }) => {
              const resultLine = gameResultLine(game);
              const resultColor =
                game?.result === 'W'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : game?.result === 'L'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400';
              return (
                <tr key={entry.gameId} className="border-b border-white/60 bg-slate-50/80 dark:border-white/5 dark:bg-white/5">
                  <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{game?.week ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : '-'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{gameLogSummary(entry)}</td>
                  <td className={`proportional-nums px-4 py-3 text-right font-semibold ${resultColor}`}>{resultLine ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

function BestGameSection({ entries, schedule }: { entries: GameLogEntry[]; schedule: ScheduleOverview | null }) {
  if (entries.length === 0) {
    return <EmptySection title="Best game" message="Once a game has been played, the top performance shows up here." />;
  }

  const best = entries.reduce((top, entry) => (gameImpactScore(entry) > gameImpactScore(top) ? entry : top));
  const game = schedule?.games.find((item) => item.gameId === best.gameId);
  const resultLine = gameResultLine(game);
  const tiles =
    best.category === 'offense'
      ? offensiveGameTiles(best.line as OffensiveGameLine)
      : defensiveGameTiles(best.line as DefensiveGameLine);

  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Best game</h3>
      {game && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Week {game.week} {game.isHome ? 'vs' : '@'} {game.opponent}
          {resultLine ? ` — ${resultLine}` : ''}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function buildPlayerHonorSeasons(awardHistory: AwardsBySeason[], playerId: number): PlayerHonorSeason[] {
  return awardHistory
    .map(({ seasonYear, awards }) => ({
      seasonYear,
      marqueeWins: awards.leagueAwards.filter((award) => award.playerId === playerId),
      honorTiers: awards.honorsRoster.filter((entry) => entry.playerId === playerId),
      weeklyHonors: awards.weeklyHonors.filter((honor) => honor.playerId === playerId),
    }))
    .filter(
      (season) =>
        season.marqueeWins.length > 0 || season.honorTiers.length > 0 || season.weeklyHonors.length > 0,
    )
    .sort((a, b) => b.seasonYear - a.seasonYear);
}

/**
 * The full player-profile content — bio, stats, game log, honors, best game.
 * Self-contained (fetches its own data from dynastyId+playerId) so it can be
 * dropped into either the standalone route (PlayerDetail.tsx, for
 * deep-linking) or the global PlayerProfileModal without either owning the
 * other's concerns.
 */
/**
 * Profile subpages (2026-07-20 redesign — see DevLog). One long scroll became
 * a hero + six destinations; every tab renders from data the component
 * already loads, except Attributes, which reads the save file via the
 * existing editor IPC (read-only reuse — current season only, since the save
 * has long since moved past any historical season's state).
 */
type ProfileTab = 'overview' | 'stats' | 'career' | 'awards' | 'media' | 'notes' | 'attributes' | 'gamelog' | 'history';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'stats', label: 'Stats' },
  { key: 'career', label: 'Career' },
  { key: 'awards', label: 'Awards' },
  { key: 'media', label: 'Media' },
  { key: 'notes', label: 'Notes' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'gamelog', label: 'Game Log' },
  { key: 'history', label: 'History' },
];

/** Media tab — everything this player is tagged in across all seasons, auto-populated from Media-page tags. Fetches lazily on first open. */
function PlayerMediaTab({ dynastyId, playerId }: { dynastyId: string; playerId: number }) {
  const [items, setItems] = useState<MediaItemResolved[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setItems(undefined);
    window.api.media.listForPlayer(dynastyId, playerId).then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId]);

  if (items === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading media...</p>;
  }
  if (items.length === 0) {
    return (
      <EmptySection
        title="Media"
        message="No photos or clips tag this player yet. Tag them on an upload in the Media page and it shows up here automatically."
      />
    );
  }
  return <MediaGallery dynastyId={dynastyId} items={items} omitPlayerId={playerId} />;
}

function profileTabClass(active: boolean): string {
  return [
    'px-4 py-2 font-display text-sm font-semibold transition-all duration-base ease-standard',
    active
      ? 'corner-cut-sm bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');
}

/** Compact editorial card used across the Overview tab — title, one focal line, supporting line, optional jump-to-tab action. */
function OverviewCard({
  eyebrow,
  focal,
  support,
  onJump,
  jumpLabel,
}: {
  eyebrow: string;
  focal: ReactNode;
  support?: ReactNode;
  onJump?: () => void;
  jumpLabel?: string;
}) {
  return (
    <div className="corner-cut-sm flex flex-col border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>
      <div className="mt-2 flex-1 text-slate-950 dark:text-white">{focal}</div>
      {support ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{support}</p> : null}
      {onJump ? (
        <button
          type="button"
          onClick={onJump}
          className="mt-3 self-start font-display text-xs font-semibold uppercase tracking-[0.18em] text-[var(--team-accent-text)] transition hover:opacity-75"
        >
          {jumpLabel ?? 'View'} →
        </button>
      ) : null}
    </div>
  );
}

/**
 * Read-only attribute ratings, grouped exactly like the editor's Ratings tab
 * (same RATING_SECTIONS source). Current season only — ratings live in the
 * save file, and a historical season's file state no longer exists to read.
 */
function AttributesTab({ dynastyId, playerId, isCurrentSeason }: { dynastyId: string; playerId: number; isCurrentSeason: boolean }) {
  const [fields, setFields] = useState<PlayerEditFields | null | undefined>(isCurrentSeason ? undefined : null);

  useEffect(() => {
    if (!isCurrentSeason) return;
    let cancelled = false;
    setFields(undefined);
    window.api.editor.getPlayer(dynastyId, playerId).then((result) => {
      if (!cancelled) setFields(result?.fields ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, isCurrentSeason]);

  if (!isCurrentSeason) {
    return (
      <EmptySection
        title="Attributes"
        message="Attribute ratings are read live from the save file, so they're only available for players on the current season's roster — a past season's save state no longer exists to read."
      />
    );
  }
  if (fields === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Reading attributes from the save file...</p>;
  }
  if (fields === null) {
    return <EmptySection title="Attributes" message="This player couldn't be found in the save file." />;
  }

  return (
    <div className="space-y-5">
      {RATING_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">{section.title}</p>
          <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
            {section.fields.map((f) => (
              <div key={f.key} className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-3 text-center dark:border-slate-800 dark:bg-white/5">
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">{f.abbr}</p>
                <p className="type-stat-sm mt-1 text-slate-950 dark:text-white">{fields.ratings[f.key] ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimelineEvent {
  seasonYear: number;
  label: string;
  detail: string | null;
}

/**
 * The player's story, derived strictly from data the archive actually holds:
 * per-season roster presence (class/OVR/team), honors, and team awards. No
 * fabricated events — transfers/redshirts only appear where the snapshots
 * show them (a team change between tracked seasons, a repeated class year).
 */
function buildTimeline(
  statsHistory: PlayerStatsBySeason[],
  playerId: number,
  honors: PlayerHonorSeason[],
  teamAwardWins: PlayerTeamAwardWin[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const rosterByYear = statsHistory
    .map((entry) => ({ seasonYear: entry.seasonYear, player: entry.roster?.find((p) => p.id === playerId) }))
    .filter((e): e is { seasonYear: number; player: RosterPlayer } => !!e.player)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  rosterByYear.forEach((entry, index) => {
    if (index === 0) {
      events.push({
        seasonYear: entry.seasonYear,
        label: 'First tracked season',
        detail: `${entry.player.schoolYear} · ${entry.player.position} · ${entry.player.overallRating} OVR`,
      });
      return;
    }
    const prev = rosterByYear[index - 1];
    const ovrDelta = entry.player.overallRating - prev.player.overallRating;
    const details = [
      `${entry.player.schoolYear} · ${entry.player.overallRating} OVR${ovrDelta !== 0 ? ` (${ovrDelta > 0 ? '+' : ''}${ovrDelta})` : ''}`,
    ];
    if (entry.player.position !== prev.player.position) {
      details.push(`moved ${prev.player.position} → ${entry.player.position}`);
    }
    if (entry.player.jerseyNumber !== prev.player.jerseyNumber) {
      details.push(`#${prev.player.jerseyNumber} → #${entry.player.jerseyNumber}`);
    }
    events.push({ seasonYear: entry.seasonYear, label: 'Season', detail: details.join(' · ') });
  });

  for (const honorSeason of honors) {
    for (const award of honorSeason.marqueeWins) {
      events.push({ seasonYear: honorSeason.seasonYear, label: formatAwardLabel(award.awardType), detail: 'National award' });
    }
    for (const tier of honorSeason.honorTiers) {
      events.push({ seasonYear: honorSeason.seasonYear, label: formatAwardLabel(tier.awardType), detail: null });
    }
    for (const grouped of groupWeeklyHonors(honorSeason.weeklyHonors)) {
      events.push({
        seasonYear: honorSeason.seasonYear,
        label: `${grouped.count > 1 ? `${grouped.count}x ` : ''}${grouped.label}`,
        detail: 'Weekly honor',
      });
    }
  }
  for (const win of teamAwardWins) {
    events.push({ seasonYear: win.seasonYear, label: win.awardName, detail: 'Team award' });
  }

  return events.sort((a, b) => b.seasonYear - a.seasonYear);
}

function HistoryTab({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <EmptySection title="History" message="This player's story builds up as more seasons are imported — seasons, honors, and awards will appear here." />;
  }
  const byYear = new Map<number, TimelineEvent[]>();
  for (const event of events) {
    byYear.set(event.seasonYear, [...(byYear.get(event.seasonYear) ?? []), event]);
  }
  return (
    <div className="space-y-4">
      {[...byYear.entries()].map(([year, yearEvents]) => (
        <div key={year} className="flex gap-4">
          <div className="w-16 shrink-0 pt-0.5 text-right">
            <span className="type-stat-sm text-slate-950 dark:text-white">{year}</span>
          </div>
          <div className="flex-1 space-y-2 border-l-2 border-[var(--team-primary)] pl-4 pb-2">
            {yearEvents.map((event, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.label}</p>
                {event.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{event.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlayerProfileContent({
  dynastyId,
  playerId,
  seasonId,
  fallback,
  leagueTeamIndex,
}: {
  dynastyId: string;
  playerId: number;
  /** The season the caller was actually browsing (e.g. Roster's currently-selected season). When the player isn't on this season's roster (or no season is given), the component falls back to searching every season, newest first, for the season that actually has them — a player who transferred/graduated/was drafted stays fully viewable, since their old season's roster/stats/gamelog/schedule snapshots are never deleted, only ever added to. */
  seasonId?: number;
  /** Display info for players who won't be found in the local roster (e.g. an opposing team's Heisman winner) — that roster snapshot only covers the user's own team. Lets this component show a real name/team instead of a bare "not found" for leaguewide award data. */
  fallback?: PlayerModalFallback;
  /** Set when the player was opened while browsing another team via the team switcher — the profile then resolves from that team's league snapshot (full bio + season stats + live attributes) instead of the user's roster, so it renders the same full layout as a user-team player. Per-player game logs aren't tracked leaguewide, so those sections show their honest empty states. */
  leagueTeamIndex?: number;
}) {
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [allStats, setAllStats] = useState<PlayerStats[] | null | undefined>(undefined);
  const [allGamelog, setAllGamelog] = useState<GameLogEntry[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [awardHistory, setAwardHistory] = useState<AwardsBySeason[] | undefined>(undefined);
  const [statsHistory, setStatsHistory] = useState<PlayerStatsBySeason[] | undefined>(undefined);
  const [teamAwardWins, setTeamAwardWins] = useState<PlayerTeamAwardWin[]>([]);
  /** The season this component actually resolved and is rendering — may differ from the `seasonId` prop if that season's roster didn't have the player and a fallback scan found them in an older one. Drives the Edit button's current-season-only restriction below. */
  const [resolvedSeasonId, setResolvedSeasonId] = useState<number | undefined>(seasonId);
  const [heroTeamName, setHeroTeamName] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [seasonsList, setSeasonsList] = useState<SeasonSummary[]>([]);
  const [development, setDevelopment] = useState<PlayerDevelopmentSeason[]>([]);
  const { openPlayerEditor } = useEditorModal();

  // The player's OVR arc across every synced season (getPlayerDevelopment walks
  // each season's league roster by PresentationId) — powers the Development chart.
  useEffect(() => {
    let cancelled = false;
    setDevelopment([]);
    window.api.db.getPlayerDevelopment(dynastyId, playerId).then((rows) => {
      if (!cancelled) setDevelopment(rows ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId]);

  useEffect(() => {
    let cancelled = false;
    setRoster(undefined);
    setResolvedSeasonId(seasonId);

    async function load() {
      const seasons = await window.api.db.getSeasons(dynastyId);
      if (!cancelled) setSeasonsList(seasons);

      const [seasonAwards, seasonStats, teamAwardDefinitions, seasonTeamAwardResults] = await Promise.all([
        Promise.all(
          seasons.map(async (season) => ({
            seasonYear: season.seasonYear,
            awards: await window.api.db.getAwards(dynastyId, season.id),
          })),
        ),
        Promise.all(
          seasons.map(async (season) => ({
            seasonId: season.id,
            seasonYear: season.seasonYear,
            roster: await window.api.db.getRoster(dynastyId, season.id),
            stats: await window.api.db.getPlayerStats(dynastyId, season.id),
          })),
        ),
        window.api.db.getTeamAwardDefinitions(),
        Promise.all(
          seasons.map(async (season) => ({
            seasonYear: season.seasonYear,
            results: await window.api.db.getTeamAwardResults(dynastyId, season.id),
          })),
        ),
      ]);

      if (cancelled) return;
      setAwardHistory(
        seasonAwards
          .filter((entry): entry is AwardsBySeason => entry.awards !== null)
          .sort((a, b) => b.seasonYear - a.seasonYear),
      );
      setStatsHistory(seasonStats.sort((a, b) => b.seasonYear - a.seasonYear));

      const defNameById = new Map<string, string>(
        teamAwardDefinitions.map((def: TeamAwardDefinitionSummary) => [def.id, def.shortName ?? def.name]),
      );
      const wins: PlayerTeamAwardWin[] = [];
      for (const { seasonYear, results } of seasonTeamAwardResults) {
        for (const result of results) {
          if (result.status !== 'confirmed' && result.status !== 'finalized') continue;
          const winnerId = result.selectedWinnerId ?? result.recommendedWinnerId;
          if (winnerId !== playerId) continue;
          const awardName = defNameById.get(result.awardDefinitionId);
          if (awardName) wins.push({ seasonYear, awardName });
        }
      }
      setTeamAwardWins(wins.sort((a, b) => b.seasonYear - a.seasonYear));

      // League mode: the player lives on another team's league snapshot, not
      // the user's roster. LeagueRosterPlayer extends RosterPlayer, so the
      // full profile layout renders as-is; per-player game logs aren't
      // tracked leaguewide, so those sections keep their honest empties.
      if (leagueTeamIndex !== undefined) {
        const leagueRoster = await window.api.db.getLeagueTeamRoster(dynastyId, leagueTeamIndex, seasonId);
        if (cancelled) return;
        setResolvedSeasonId(leagueRoster?.seasonId);
        setRoster(leagueRoster?.players ?? null);
        setAllStats(
          leagueRoster
            ? leagueRoster.players
                .filter((p) => p.seasonStat)
                .map((p) => ({ playerId: p.id, category: p.seasonStat!.category, career: null, season: p.seasonStat!.season }))
            : null,
        );
        setHeroTeamName(leagueRoster?.displayName ?? fallback?.teamDisplayName ?? null);
        setAllGamelog(null);
        setSchedule(null);
        return;
      }

      // Resolve which season to actually render: the one the caller was
      // browsing, if the player is on its roster; otherwise search every
      // season newest-first for the one that has them. A player who
      // transferred/graduated/was drafted is still fully viewable this way —
      // their old season's snapshots were never deleted, the lookup just
      // never used to search past the current season.
      const requestedSeason = seasonId !== undefined ? seasons.find((s) => s.id === seasonId) : undefined;
      const searchOrder = [
        ...(requestedSeason ? [requestedSeason] : []),
        ...[...seasons].sort((a, b) => b.seasonYear - a.seasonYear),
      ];

      let resolved: { seasonId: number; roster: RosterPlayer[] | null; stats: PlayerStats[] | null } | undefined;
      for (const season of searchOrder) {
        const entry = seasonStats.find((s) => s.seasonId === season.id);
        if (entry?.roster?.some((p) => p.id === playerId)) {
          resolved = entry;
          break;
        }
      }

      if (cancelled) return;
      setResolvedSeasonId(resolved?.seasonId);
      setRoster(resolved?.roster ?? null);
      setAllStats(resolved?.stats ?? null);

      // Team identity for the hero — that season's actual team (a player who
      // transferred shows the school they were on that year, not the
      // dynasty's current one).
      if (resolved) {
        window.api.db.getSeasonOverview(dynastyId, resolved.seasonId).then((overview) => {
          if (!cancelled) setHeroTeamName(overview?.teamName ?? null);
        });
      } else {
        setHeroTeamName(null);
      }

      if (resolved) {
        const [gamelogResult, scheduleResult] = await Promise.all([
          window.api.db.getGameLog(dynastyId, resolved.seasonId),
          window.api.db.getSchedule(dynastyId, resolved.seasonId),
        ]);
        if (!cancelled) {
          setAllGamelog(gamelogResult);
          setSchedule(scheduleResult);
        }
      } else {
        setAllGamelog(null);
        setSchedule(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, playerId, leagueTeamIndex, fallback?.teamDisplayName]);

  if (roster === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading player...</p>;
  }

  const player = roster?.find((item) => item.id === playerId);

  if (!player) {
    if (!fallback) {
      return <p className="text-slate-500 dark:text-slate-400">Player not found.</p>;
    }

    // Leaguewide award data (Heisman, Annual Awards, All-American/Conference) references
    // players from every team, but the local roster snapshot only covers the user's own
    // team — so this branch is the common case for those, not an error. `awards` is keyed
    // off the same leaguewide extraction, so honors for this player are still available
    // even though a full roster/stats profile isn't.
    const honorSeasons = buildPlayerHonorSeasons(awardHistory ?? [], playerId);

    const [fallbackFirstName, ...fallbackLastNameParts] = fallback.name.trim().split(/\s+/);
    const fallbackPlayer = {
      firstName: fallbackFirstName ?? fallback.name,
      lastName: fallbackLastNameParts.join(' '),
      portraitAssetName: fallback.portraitAssetName ?? null,
    };

    return (
      <div className="space-y-6">
        <SurfaceCard className="flex items-center gap-4">
          <PlayerPortrait player={fallbackPlayer} size="lg" teamAssetName={fallback.teamDisplayName} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-section-title font-semibold text-slate-950 dark:text-white">{fallback.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span>{fallback.position}</span>
              <span aria-hidden="true">&middot;</span>
              <TeamLogo team={{ assetName: fallback.teamDisplayName, label: fallback.teamDisplayName }} size="sm" />
              <span>{fallback.teamDisplayName}</span>
            </p>
          </div>
        </SurfaceCard>
        <EmptySection
          title="Full profile unavailable"
          message="This player is on an opposing team, so detailed bio, stats, and game log data aren't tracked for them in this dynasty — only your own team's roster is fully extracted."
        />
        <HonorsSection seasons={honorSeasons} />
      </div>
    );
  }

  const stats = allStats?.find((item) => item.playerId === playerId);
  const playerGamelog = (allGamelog ?? []).filter((entry) => entry.playerId === playerId);
  const honorSeasons = buildPlayerHonorSeasons(awardHistory ?? [], playerId);
  const importedStatSeasons = buildImportedStatSeasons(statsHistory ?? [], playerId);

  // Editing is only ever allowed while looking at the live, current season —
  // a historical season's roster is a frozen snapshot, and the save file
  // itself has long since moved past whatever state it was in back then, so
  // there'd be nothing real for an edit to write back to. Centralized here
  // rather than left to every page that can open this modal to remember.
  const viewedSeason = seasonsList.find((s) => s.id === resolvedSeasonId);
  const canEditPlayer = viewedSeason?.isCurrent === true;

  const timelineEvents = buildTimeline(statsHistory ?? [], playerId, honorSeasons, teamAwardWins);
  const latestGame = playerGamelog
    .map((entry) => ({ entry, game: schedule?.games.find((g) => g.gameId === entry.gameId) }))
    .sort((a, b) => (b.game?.week ?? 0) - (a.game?.week ?? 0))[0];
  const seasonTiles =
    stats?.season && stats.category
      ? (stats.category === 'offense'
          ? offensiveTiles(stats.season as OffensiveStatLine)
          : defensiveTiles(stats.season as DefensiveStatLine)
        ).filter((t) => t.value !== 0 && t.value !== '0')
      : [];
  const totalHonors =
    honorSeasons.reduce((sum, s) => sum + s.marqueeWins.length + s.honorTiers.length + s.weeklyHonors.length, 0) +
    teamAwardWins.length;
  const latestHonor = honorSeasons[0]
    ? (honorSeasons[0].marqueeWins[0] && formatAwardLabel(honorSeasons[0].marqueeWins[0].awardType)) ||
      (honorSeasons[0].honorTiers[0] && formatAwardLabel(honorSeasons[0].honorTiers[0].awardType)) ||
      null
    : (teamAwardWins[0]?.awardName ?? null);

  return (
    <div className="space-y-5">
      {/* Hero — unboxed portrait over a subtle team-color field; the player is the subject, not a card among cards. */}
      <div
        className="corner-cut relative overflow-hidden border border-slate-200/70 dark:border-white/10"
        style={{
          background:
            'linear-gradient(120deg, color-mix(in srgb, var(--team-primary) 14%, transparent), transparent 55%), linear-gradient(300deg, color-mix(in srgb, var(--team-primary) 7%, transparent), transparent 45%)',
        }}
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center md:p-6">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <PlayerPortrait player={player} large teamAssetName={heroTeamName} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="corner-cut-sm inline-flex h-10 min-w-[2.6rem] items-center justify-center bg-[var(--team-primary)] px-3 font-display text-lg font-bold text-[var(--team-on-primary)]">
                {player.jerseyNumber}
              </span>
              {heroTeamName && (
                <span className="flex items-center gap-2">
                  <TeamLogo team={{ assetName: heroTeamName, label: heroTeamName }} size="sm" />
                  <span className="type-eyebrow text-slate-500 dark:text-slate-400">{heroTeamName}</span>
                </span>
              )}
              <span className="type-eyebrow text-slate-500 dark:text-slate-400">
                {player.position} · {abbreviateClass(player.schoolYear)}
              </span>
              {viewedSeason && !viewedSeason.isCurrent && (
                <span className="type-eyebrow bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {viewedSeason.seasonYear} season
                </span>
              )}
            </div>
            <h2 className="mt-3 flex items-center gap-2.5 font-display text-page-title font-bold text-slate-950 dark:text-white">
              {player.firstName} {player.lastName}
              {canEditPlayer && (
                <EditButton
                  onClick={() =>
                    openPlayerEditor({
                      dynastyId,
                      playerId,
                      playerLabel: `${player.firstName} ${player.lastName}`,
                    })
                  }
                  label={`Edit ${player.firstName} ${player.lastName}`}
                />
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {player.archetype} · {player.developmentTrait} development · {formatHeight(player.heightInches)},{' '}
              {player.weightPounds} lb
            </p>
          </div>
          <div className="shrink-0 text-center sm:pr-4">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Overall</p>
            <p className="type-stat-xl mt-1 text-slate-950 dark:text-white">{player.overallRating}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200/80 pb-3 dark:border-white/10">
        {PROFILE_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={profileTabClass(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="space-y-5">
        {tab === 'overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <BioTile label="Height" value={formatHeight(player.heightInches)} />
              <BioTile label="Weight" value={`${player.weightPounds} lb`} />
              <BioTile label="Development trait" value={player.developmentTrait} />
              <BioTile label="Archetype" value={player.archetype} />
              <BioTile label="Hometown" value={`${player.hometown}, ${player.homeState}`} />
              <BioTile label="Class" value={player.schoolYear} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <OverviewCard
                eyebrow="Season snapshot"
                focal={
                  seasonTiles.length > 0 ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {seasonTiles.slice(0, 4).map((t) => (
                        <span key={t.label} className="whitespace-nowrap">
                          <span className="type-stat-sm">{t.value}</span>{' '}
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">No stats recorded yet this season.</span>
                  )
                }
                onJump={() => setTab('stats')}
                jumpLabel="Full stats"
              />
              <OverviewCard
                eyebrow="Latest game"
                focal={
                  latestGame ? (
                    <span className="text-sm font-semibold">
                      {latestGame.game ? `${latestGame.game.isHome ? 'vs' : '@'} ${latestGame.game.opponent}` : 'Untracked game'}
                      {latestGame.game?.result && (
                        <span className={latestGame.game.result === 'W' ? 'ml-2 text-green-600 dark:text-green-400' : 'ml-2 text-red-600 dark:text-red-400'}>
                          {latestGame.game.result} {latestGame.game.teamScore}-{latestGame.game.opponentScore}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">No games played yet.</span>
                  )
                }
                support={latestGame ? gameLogSummary(latestGame.entry) : undefined}
                onJump={() => setTab('gamelog')}
                jumpLabel="Game log"
              />
              <OverviewCard
                eyebrow="Honors & awards"
                focal={
                  totalHonors > 0 ? (
                    <span>
                      <span className="type-stat-sm">{totalHonors}</span>{' '}
                      <span className="text-sm text-slate-500 dark:text-slate-400">career honor{totalHonors === 1 ? '' : 's'}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">None yet — the résumé starts here.</span>
                  )
                }
                support={latestHonor ?? undefined}
                onJump={() => setTab('awards')}
                jumpLabel="Awards & honors"
              />
            </div>

            {development.length > 0 &&
              (() => {
                const first = development[0];
                const last = development[development.length - 1];
                const ovrs = development.map((d) => d.overallRating);
                const peak = Math.max(...ovrs);
                const change = last.overallRating - first.overallRating;
                const series: ChartSeries[] = [
                  { key: 'ovr', label: 'OVR', color: 'blue', points: development.map((d) => ({ x: d.seasonYear, y: d.overallRating })) },
                ];
                return (
                  <SurfaceCard className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Development</p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Overall rating across every synced season.</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span>
                          <span className="type-stat-sm">{last.overallRating}</span>{' '}
                          <span className="text-xs text-slate-500 dark:text-slate-400">current OVR</span>
                        </span>
                        <span>
                          <span
                            className={`type-stat-sm ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : change < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                          >
                            {change > 0 ? `+${change}` : change}
                          </span>{' '}
                          <span className="text-xs text-slate-500 dark:text-slate-400">since {first.seasonYear}</span>
                        </span>
                        <span>
                          <span className="type-stat-sm">{peak}</span>{' '}
                          <span className="text-xs text-slate-500 dark:text-slate-400">peak</span>
                        </span>
                      </div>
                    </div>
                    {development.length > 1 ? (
                      <div className="mt-3">
                        <TrendLineChart
                          series={series}
                          xTicks={development.map((d) => d.seasonYear)}
                          formatX={(x) => String(x)}
                          formatY={(y) => String(Math.round(y))}
                          yMinHint={Math.max(0, Math.min(...ovrs) - 3)}
                          height={200}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        One season tracked so far — {first.seasonYear}: {first.overallRating} OVR as a {first.schoolYear}. Sync each
                        season and this grows into a development curve.
                      </p>
                    )}
                  </SurfaceCard>
                );
              })()}
          </>
        )}

        {tab === 'stats' && (
          <>
            <StatLineSection
              title="This season"
              category={stats?.category}
              line={stats?.season}
              emptyMessage="No season stats yet. These appear once games have been played and re-imported."
            />
            <GameLogSection entries={playerGamelog} schedule={schedule ?? null} />
          </>
        )}

        {tab === 'career' && (
          <>
            <StatLineSection
              title="Career totals"
              category={stats?.category}
              line={stats?.career}
              emptyMessage="No career stats yet. These appear once games have been played and re-imported."
            />
            <ImportedSeasonHistorySection seasons={importedStatSeasons} />
          </>
        )}

        {tab === 'awards' && (
          <>
            <TeamAwardsWonSection wins={teamAwardWins} />
            <HonorsSection seasons={honorSeasons} />
          </>
        )}

        {tab === 'media' && <PlayerMediaTab dynastyId={dynastyId} playerId={playerId} />}
        {tab === 'notes' && <PlayerNotesTab dynastyId={dynastyId} playerId={playerId} />}

        {tab === 'attributes' && <AttributesTab dynastyId={dynastyId} playerId={playerId} isCurrentSeason={canEditPlayer} />}

        {tab === 'gamelog' && (
          <>
            <BestGameSection entries={playerGamelog} schedule={schedule ?? null} />
            <GameLogSection entries={playerGamelog} schedule={schedule ?? null} />
          </>
        )}

        {tab === 'history' && <HistoryTab events={timelineEvents} />}
      </div>
    </div>
  );
}
