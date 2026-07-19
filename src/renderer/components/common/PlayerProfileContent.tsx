import { useEffect, useState } from 'react';
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
import type {
  AwardsOverview,
  SeasonSummary,
  DefensiveGameLine,
  DefensiveStatLine,
  GameLogEntry,
  HonorRosterEntry,
  LeagueAward,
  OffensiveGameLine,
  OffensiveStatLine,
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

function createEmptyOffensiveLine(): OffensiveStatLine {
  return {
    gamesPlayed: 0,
    gamesStarted: 0,
    passAttempts: 0,
    passCompletions: 0,
    passYards: 0,
    passTDs: 0,
    passInts: 0,
    passLongest: 0,
    rushAttempts: 0,
    rushYards: 0,
    rushTDs: 0,
    rushLongest: 0,
    fumbles: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    receivingLongest: 0,
    kickReturns: 0,
    kickReturnYards: 0,
    kickReturnTDs: 0,
    kickReturnLongest: 0,
    puntReturns: 0,
    puntReturnYards: 0,
    puntReturnTDs: 0,
    puntReturnLongest: 0,
  };
}

function createEmptyDefensiveLine(): DefensiveStatLine {
  return {
    gamesPlayed: 0,
    gamesStarted: 0,
    tackles: 0,
    assistedTackles: 0,
    tacklesForLoss: 0,
    sacks: 0,
    interceptions: 0,
    interceptionReturnYards: 0,
    interceptionTDs: 0,
    forcedFumbles: 0,
    fumbleRecoveries: 0,
    passDeflections: 0,
    kickReturns: 0,
    kickReturnYards: 0,
    kickReturnTDs: 0,
    kickReturnLongest: 0,
    puntReturns: 0,
    puntReturnYards: 0,
    puntReturnTDs: 0,
    puntReturnLongest: 0,
  };
}

function addOffensiveLines(total: OffensiveStatLine, line: OffensiveStatLine): OffensiveStatLine {
  return {
    gamesPlayed: total.gamesPlayed + line.gamesPlayed,
    gamesStarted: total.gamesStarted + line.gamesStarted,
    passAttempts: total.passAttempts + line.passAttempts,
    passCompletions: total.passCompletions + line.passCompletions,
    passYards: total.passYards + line.passYards,
    passTDs: total.passTDs + line.passTDs,
    passInts: total.passInts + line.passInts,
    passLongest: Math.max(total.passLongest, line.passLongest),
    rushAttempts: total.rushAttempts + line.rushAttempts,
    rushYards: total.rushYards + line.rushYards,
    rushTDs: total.rushTDs + line.rushTDs,
    rushLongest: Math.max(total.rushLongest, line.rushLongest),
    fumbles: total.fumbles + line.fumbles,
    receptions: total.receptions + line.receptions,
    receivingYards: total.receivingYards + line.receivingYards,
    receivingTDs: total.receivingTDs + line.receivingTDs,
    receivingLongest: Math.max(total.receivingLongest, line.receivingLongest),
    kickReturns: total.kickReturns + line.kickReturns,
    kickReturnYards: total.kickReturnYards + line.kickReturnYards,
    kickReturnTDs: total.kickReturnTDs + line.kickReturnTDs,
    kickReturnLongest: Math.max(total.kickReturnLongest, line.kickReturnLongest),
    puntReturns: total.puntReturns + line.puntReturns,
    puntReturnYards: total.puntReturnYards + line.puntReturnYards,
    puntReturnTDs: total.puntReturnTDs + line.puntReturnTDs,
    puntReturnLongest: Math.max(total.puntReturnLongest, line.puntReturnLongest),
  };
}

function addDefensiveLines(total: DefensiveStatLine, line: DefensiveStatLine): DefensiveStatLine {
  return {
    gamesPlayed: total.gamesPlayed + line.gamesPlayed,
    gamesStarted: total.gamesStarted + line.gamesStarted,
    tackles: total.tackles + line.tackles,
    assistedTackles: total.assistedTackles + line.assistedTackles,
    tacklesForLoss: total.tacklesForLoss + line.tacklesForLoss,
    sacks: total.sacks + line.sacks,
    interceptions: total.interceptions + line.interceptions,
    interceptionReturnYards: total.interceptionReturnYards + line.interceptionReturnYards,
    interceptionTDs: total.interceptionTDs + line.interceptionTDs,
    forcedFumbles: total.forcedFumbles + line.forcedFumbles,
    fumbleRecoveries: total.fumbleRecoveries + line.fumbleRecoveries,
    kickReturns: total.kickReturns + line.kickReturns,
    kickReturnYards: total.kickReturnYards + line.kickReturnYards,
    kickReturnTDs: total.kickReturnTDs + line.kickReturnTDs,
    kickReturnLongest: Math.max(total.kickReturnLongest, line.kickReturnLongest),
    puntReturns: total.puntReturns + line.puntReturns,
    puntReturnYards: total.puntReturnYards + line.puntReturnYards,
    puntReturnTDs: total.puntReturnTDs + line.puntReturnTDs,
    puntReturnLongest: Math.max(total.puntReturnLongest, line.puntReturnLongest),
    passDeflections: total.passDeflections + line.passDeflections,
  };
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

function buildImportedCareerTotals(
  seasons: PlayerImportedStatSeason[],
): { category: 'offense' | 'defense'; line: OffensiveStatLine | DefensiveStatLine } | null {
  if (seasons.length === 0) return null;
  const category = seasons[0].category;
  const matching = seasons.filter((season) => season.category === category);
  if (matching.length === 0) return null;

  if (category === 'offense') {
    const line = matching.reduce(
      (total, season) => addOffensiveLines(total, season.line as OffensiveStatLine),
      createEmptyOffensiveLine(),
    );
    return { category, line };
  }

  const line = matching.reduce(
    (total, season) => addDefensiveLines(total, season.line as DefensiveStatLine),
    createEmptyDefensiveLine(),
  );
  return { category, line };
}

function ImportedSeasonHistorySection({ seasons }: { seasons: PlayerImportedStatSeason[] }) {
  if (seasons.length === 0) {
    return (
      <EmptySection
        title="Imported season history"
        message="No multi-season stat history is available yet. Import more seasons to build this player timeline."
      />
    );
  }

  const category = seasons[0].category;

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Imported season history</h3>
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
export function PlayerProfileContent({
  dynastyId,
  playerId,
  seasonId,
  fallback,
}: {
  dynastyId: string;
  playerId: number;
  /** The season the caller was actually browsing (e.g. Roster's currently-selected season). When the player isn't on this season's roster (or no season is given), the component falls back to searching every season, newest first, for the season that actually has them — a player who transferred/graduated/was drafted stays fully viewable, since their old season's roster/stats/gamelog/schedule snapshots are never deleted, only ever added to. */
  seasonId?: number;
  /** Display info for players who won't be found in the local roster (e.g. an opposing team's Heisman winner) — that roster snapshot only covers the user's own team. Lets this component show a real name/team instead of a bare "not found" for leaguewide award data. */
  fallback?: PlayerModalFallback;
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
  const [seasonsList, setSeasonsList] = useState<SeasonSummary[]>([]);
  const { openPlayerEditor } = useEditorModal();

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
  }, [dynastyId, seasonId, playerId]);

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
          <PlayerPortrait player={fallbackPlayer} size="lg" />
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
  const importedCareerTotals = buildImportedCareerTotals(importedStatSeasons);

  // Editing is only ever allowed while looking at the live, current season —
  // a historical season's roster is a frozen snapshot, and the save file
  // itself has long since moved past whatever state it was in back then, so
  // there'd be nothing real for an edit to write back to. Centralized here
  // rather than left to every page that can open this modal to remember.
  const viewedSeason = seasonsList.find((s) => s.id === resolvedSeasonId);
  const canEditPlayer = viewedSeason?.isCurrent === true;

  return (
    <div className="space-y-6">
      {viewedSeason && !viewedSeason.isCurrent && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Viewing the {viewedSeason.seasonYear} season — a past record, not this player&apos;s current roster status.
        </div>
      )}
      <SurfaceCard>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center sm:justify-start">
              <PlayerPortrait player={player} large className="bg-slate-50/85 dark:bg-white/5" />
            </div>
            <div>
              <div className="inline-flex h-12 min-w-[3rem] items-center justify-center rounded-lg bg-[var(--team-primary)] px-4 text-xl font-bold text-[var(--team-on-primary)] shadow-[0_20px_45px_-24px_rgba(37,99,235,0.9)]">
                {player.jerseyNumber}
              </div>
              <p className="mt-4 type-eyebrow text-slate-400 dark:text-slate-500">Player detail</p>
              <h2 className="mt-2 flex items-center gap-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
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
                {player.position} | {abbreviateClass(player.schoolYear)} | {player.archetype}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 px-5 py-4 dark:border-slate-800 dark:bg-white/5">
            <p className="text-right type-eyebrow text-slate-400 dark:text-slate-500">
              Overall
            </p>
            <p className="mt-2 flex items-center justify-center type-stat-lg text-slate-950 dark:text-white">
              {player.overallRating}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <BioTile label="Height" value={formatHeight(player.heightInches)} />
        <BioTile label="Weight" value={`${player.weightPounds} lb`} />
        <BioTile label="Development trait" value={player.developmentTrait} />
        <BioTile label="Archetype" value={player.archetype} />
        <BioTile label="Hometown" value={`${player.hometown}, ${player.homeState}`} />
        <BioTile label="Class" value={player.schoolYear} />
      </div>

      <StatLineSection
        title="Career stats"
        category={stats?.category}
        line={stats?.career}
        emptyMessage="No career stats yet. These appear once games have been played and re-imported."
      />
      <StatLineSection
        title="Season stats"
        category={stats?.category}
        line={stats?.season}
        emptyMessage="No season stats yet. These appear once games have been played and re-imported."
      />
      <StatLineSection
        title="Imported career totals"
        category={importedCareerTotals?.category}
        line={importedCareerTotals?.line}
        emptyMessage="Import multiple seasons to build a true app-side career rollup for this player."
      />
      <ImportedSeasonHistorySection seasons={importedStatSeasons} />
      <GameLogSection entries={playerGamelog} schedule={schedule ?? null} />
      <TeamAwardsWonSection wins={teamAwardWins} />
      <HonorsSection seasons={honorSeasons} />
      <BestGameSection entries={playerGamelog} schedule={schedule ?? null} />
    </div>
  );
}
