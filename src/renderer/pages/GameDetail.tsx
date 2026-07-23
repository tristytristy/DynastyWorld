import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { ConferenceMark } from '../components/common/ConferenceMark';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { StatisticsCategorySection, type ColumnDef, type LeaderCardRow, type LeaderMetric } from '../components/common/StatisticsCategorySection';
import type { StatTableRow } from '../components/common/StatisticsTable';
import { gameTypeLabel, getGameTypeImagePath, getLocationDisplay, isTraditionalBowl } from '../lib/scheduleFormat';
import { getBowlLogoPath } from '../lib/trophyAssetMapping';
import { gameImpactScore } from '../../shared/gameImpactScore';
import { useTheme } from '../theme/ThemeProvider';
import { useStadiumData } from '../data/StadiumDataProvider';
import { MediaGallery } from '../components/common/MediaGallery';
import type {
  DefensiveGameLine,
  GameLogEntry,
  MediaItemResolved,
  OffensiveGameLine,
  RosterPlayer,
  ScheduleGame,
  ScheduleOverview,
  TeamStatLine,
} from '../../shared/types';

function formatPossession(seconds: number): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function StatCompareRow({
  label,
  team,
  opponent,
  format = (value: number) => String(value),
}: {
  label: string;
  team: number;
  opponent: number;
  format?: (value: number) => string;
}) {
  return (
    <tr className="border-b border-white/60 last:border-b-0 dark:border-white/5">
      <td className="proportional-nums px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{format(team)}</td>
      <td className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</td>
      <td className="proportional-nums px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">{format(opponent)}</td>
    </tr>
  );
}

function TeamStatsCompare({ team, opponent }: { team: TeamStatLine; opponent: TeamStatLine }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <StatCompareRow label="Total Yards" team={team.totalYards} opponent={opponent.totalYards} />
        <StatCompareRow label="Pass Yards" team={team.passYards} opponent={opponent.passYards} />
        <StatCompareRow label="Rush Yards" team={team.rushYards} opponent={opponent.rushYards} />
        <StatCompareRow label="First Downs" team={team.firstDowns} opponent={opponent.firstDowns} />
        <StatCompareRow label="Third Down" team={team.thirdDownConversions} opponent={opponent.thirdDownConversions} />
        <StatCompareRow label="Turnovers" team={team.turnovers} opponent={opponent.turnovers} />
        <StatCompareRow label="Sacks" team={team.sacks} opponent={opponent.sacks} />
        <StatCompareRow label="Penalty Yards" team={team.penaltyYards} opponent={opponent.penaltyYards} />
        <StatCompareRow
          label="Possession"
          team={team.possessionTimeSeconds}
          opponent={opponent.possessionTimeSeconds}
          format={formatPossession}
        />
      </tbody>
    </table>
  );
}

/** Category-specific "did this player actually do anything" check — a QB with zero attempts, a back with zero touches, or a defender with an all-zero line shouldn't clutter the box score just because a GameLogEntry row exists for them. */
function hasMeaningfulStats(entry: GameLogEntry): boolean {
  if (entry.category === 'offense') {
    const line = entry.line as OffensiveGameLine;
    return line.passAttempts > 0 || line.rushAttempts > 0 || line.receptions > 0;
  }
  const line = entry.line as DefensiveGameLine;
  return (
    line.tackles > 0 ||
    line.assistedTackles > 0 ||
    line.tacklesForLoss > 0 ||
    line.sacks > 0 ||
    line.interceptions > 0 ||
    line.forcedFumbles > 0 ||
    line.fumbleRecoveries > 0 ||
    line.passDeflections > 0
  );
}

function offenseSummary(line: OffensiveGameLine): string {
  const parts: string[] = [];
  if (line.passAttempts > 0) parts.push(`${line.passCompletions}/${line.passAttempts}, ${line.passYards} yds, ${line.passTDs} TD`);
  if (line.rushAttempts > 0) parts.push(`${line.rushAttempts} car, ${line.rushYards} yds, ${line.rushTDs} TD`);
  if (line.receptions > 0) parts.push(`${line.receptions} rec, ${line.receivingYards} yds, ${line.receivingTDs} TD`);
  return parts.join(' | ') || '-';
}

function defenseSummary(line: DefensiveGameLine): string {
  const parts: string[] = [`${line.tackles + line.assistedTackles} tkl`];
  if (line.sacks > 0) parts.push(`${line.sacks} sck`);
  if (line.interceptions > 0) parts.push(`${line.interceptions} INT`);
  if (line.passDeflections > 0) parts.push(`${line.passDeflections} PD`);
  if (line.forcedFumbles > 0) parts.push(`${line.forcedFumbles} FF`);
  return parts.join(' | ');
}

/**
 * Per-game box score, split Passing / Rushing / Receiving to mirror the
 * season Statistics page's category structure (explicit user direction —
 * uniformity across the app), rather than one wide combined Offense table.
 * Columns match the Statistics page's per-category sets except stats that
 * genuinely don't exist on per-game lines (GP, Int, Lng).
 */
const gamePct = (num: number, den: number): number | null => (den > 0 ? (100 * num) / den : null);
const gamePctFormat = (v: number): string => `${v.toFixed(1)}%`;
const gameOneDecimal = (v: number): string => v.toFixed(1);

const PASSING_GAME_COLUMNS: ColumnDef<OffensiveGameLine>[] = [
  { key: 'passCompletions', label: 'Cmp', raw: (l) => l.passCompletions },
  { key: 'passAttempts', label: 'Att', raw: (l) => l.passAttempts },
  { key: 'passCompletionPct', label: 'Cmp%', raw: (l) => gamePct(l.passCompletions, l.passAttempts), format: gamePctFormat },
  { key: 'passYards', label: 'Yds', raw: (l) => l.passYards },
  { key: 'passYardsPerAttempt', label: 'Y/A', raw: (l) => (l.passAttempts > 0 ? l.passYards / l.passAttempts : null), format: gameOneDecimal },
  { key: 'passTDs', label: 'TD', raw: (l) => l.passTDs },
];

const RUSHING_GAME_COLUMNS: ColumnDef<OffensiveGameLine>[] = [
  { key: 'rushAttempts', label: 'Att', raw: (l) => l.rushAttempts },
  { key: 'rushYards', label: 'Yds', raw: (l) => l.rushYards },
  { key: 'rushYardsPerCarry', label: 'Y/C', raw: (l) => (l.rushAttempts > 0 ? l.rushYards / l.rushAttempts : null), format: gameOneDecimal },
  { key: 'rushTDs', label: 'TD', raw: (l) => l.rushTDs },
];

const RECEIVING_GAME_COLUMNS: ColumnDef<OffensiveGameLine>[] = [
  { key: 'receptions', label: 'Rec', raw: (l) => l.receptions },
  { key: 'receivingYards', label: 'Yds', raw: (l) => l.receivingYards },
  { key: 'receivingYardsPerCatch', label: 'Y/R', raw: (l) => (l.receptions > 0 ? l.receivingYards / l.receptions : null), format: gameOneDecimal },
  { key: 'receivingTDs', label: 'TD', raw: (l) => l.receivingTDs },
];

const PASSING_GAME_LEADERS: LeaderMetric<OffensiveGameLine>[] = [
  { label: 'Passing Yards', value: (l) => l.passYards, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Passing Touchdowns', value: (l) => l.passTDs, format: (v) => v.toLocaleString(), onlyIfPositive: true },
];

const RUSHING_GAME_LEADERS: LeaderMetric<OffensiveGameLine>[] = [
  { label: 'Rushing Yards', value: (l) => l.rushYards, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Rushing Touchdowns', value: (l) => l.rushTDs, format: (v) => v.toLocaleString(), onlyIfPositive: true },
];

const RECEIVING_GAME_LEADERS: LeaderMetric<OffensiveGameLine>[] = [
  { label: 'Receptions', value: (l) => l.receptions, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Receiving Yards', value: (l) => l.receivingYards, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Receiving Touchdowns', value: (l) => l.receivingTDs, format: (v) => v.toLocaleString(), onlyIfPositive: true },
];

const DEFENSE_GAME_COLUMNS: ColumnDef<DefensiveGameLine>[] = [
  { key: 'tackles', label: 'Tkl', raw: (l) => l.tackles },
  { key: 'assistedTackles', label: 'Ast', raw: (l) => l.assistedTackles },
  { key: 'tacklesForLoss', label: 'TFL', raw: (l) => l.tacklesForLoss },
  { key: 'sacks', label: 'Sck', raw: (l) => l.sacks },
  { key: 'interceptions', label: 'Int', raw: (l) => l.interceptions },
  { key: 'forcedFumbles', label: 'FF', raw: (l) => l.forcedFumbles },
  { key: 'fumbleRecoveries', label: 'FR', raw: (l) => l.fumbleRecoveries },
  { key: 'passDeflections', label: 'PD', raw: (l) => l.passDeflections },
];

/** No defensive-touchdown field exists at the per-game level (confirmed — DefensiveGameLine has no such field), so unlike the season Defense leaders this deliberately has no "Defensive Touchdowns" card rather than fabricating one. */
const DEFENSE_GAME_LEADERS: LeaderMetric<DefensiveGameLine>[] = [
  { label: 'Tackles', value: (l) => l.tackles + l.assistedTackles, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Sacks', value: (l) => l.sacks, format: (v) => v.toLocaleString(), onlyIfPositive: true },
  { label: 'Interceptions', value: (l) => l.interceptions, format: (v) => v.toLocaleString(), onlyIfPositive: true },
];

/**
 * Builds the (StatTableRow & LeaderCardRow) shape StatisticsCategorySection needs.
 * Prefers the user roster (richer/current) for identity, but falls back to the
 * entry's own self-contained identity for OPPONENT players, who aren't in the
 * user's roster snapshot. (Seasons synced before opponent box scores shipped
 * carry no per-entry identity — those are all user-team players, covered by the
 * roster lookup.)
 */
function buildGameRows<TLine>(entries: GameLogEntry[], roster: RosterPlayer[]): (StatTableRow<TLine> & LeaderCardRow)[] {
  return entries
    .map((entry) => {
      const player = roster.find((item) => item.id === entry.playerId);
      const firstName = player?.firstName ?? entry.firstName;
      const lastName = player?.lastName ?? entry.lastName;
      if (firstName === undefined || lastName === undefined) return null;
      return {
        playerId: entry.playerId,
        firstName,
        lastName,
        position: player?.position ?? entry.position ?? '',
        jerseyNumber: player?.jerseyNumber ?? entry.jerseyNumber ?? 0,
        schoolYear: player?.schoolYear ?? entry.schoolYear ?? '',
        portraitAssetName: player?.portraitAssetName ?? entry.portraitAssetName ?? null,
        line: entry.line as TLine,
      };
    })
    .filter((row): row is StatTableRow<TLine> & LeaderCardRow => row !== null);
}

function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

export function GameDetailContent({
  dynastyId,
  gameId,
  seasonId,
}: {
  dynastyId: string;
  gameId: number;
  seasonId: number | undefined;
}) {
  const id = dynastyId;
  const { appearance } = useTheme();
  const { getStadium } = useStadiumData();
  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [gamelog, setGamelog] = useState<GameLogEntry[] | null | undefined>(undefined);
  const [media, setMedia] = useState<MediaItemResolved[]>([]);
  // Which side's player box score is shown (when opponent data is available).
  const [side, setSide] = useState<'user' | 'opponent'>('user');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSchedule(id, seasonId).then((result) => !cancelled && setSchedule(result));
    window.api.db.getRoster(id, seasonId).then((result) => !cancelled && setRoster(result));
    window.api.db.getGameLog(id, seasonId).then((result) => !cancelled && setGamelog(result));
    window.api.media.listForGame(id, seasonId, Number(gameId)).then((result) => !cancelled && setMedia(result));
    return () => {
      cancelled = true;
    };
  }, [id, seasonId, gameId]);

  if (schedule === undefined || roster === undefined || gamelog === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading game...</p>;
  }

  const game: ScheduleGame | undefined = schedule?.games.find((item) => item.gameId === Number(gameId));

  if (!game || !id) {
    return <p className="text-slate-500 dark:text-slate-400">Game not found.</p>;
  }

  const allEntries = (gamelog ?? []).filter((entry) => entry.gameId === game.gameId);
  // Split the box score by team. The user's team is whichever team an entry's
  // player belongs to in the user roster; the other team index is the opponent.
  // Seasons synced before this shipped carry no per-entry teamIndex — there,
  // hasBothSides is false and the box score stays the user's team (as before).
  const userTeamIndex = allEntries.find(
    (e) => e.teamIndex !== undefined && (roster ?? []).some((r) => r.id === e.playerId),
  )?.teamIndex;
  const teamIndexes = [...new Set(allEntries.map((e) => e.teamIndex).filter((x): x is number => x !== undefined))];
  const opponentTeamIndex = teamIndexes.find((ti) => ti !== userTeamIndex);
  const hasBothSides = userTeamIndex !== undefined && opponentTeamIndex !== undefined;
  const activeTeamIndex = hasBothSides ? (side === 'opponent' ? opponentTeamIndex : userTeamIndex) : undefined;
  const sideEntries = hasBothSides ? allEntries.filter((e) => e.teamIndex === activeTeamIndex) : allEntries;

  const entries = sideEntries.filter(hasMeaningfulStats);
  const offenseEntries = entries.filter((entry) => entry.category === 'offense');
  const defenseEntries = entries.filter((entry) => entry.category === 'defense');
  const offenseRows = buildGameRows<OffensiveGameLine>(offenseEntries, roster ?? []);
  const defenseRows = buildGameRows<DefensiveGameLine>(defenseEntries, roster ?? []);
  // Category scoping mirrors the season Statistics page: a player appears in
  // a section only if they actually did that thing in this game (same
  // "no false zero rows" principle as hasMeaningfulStats above).
  const passingRows = offenseRows.filter((row) => row.line.passAttempts > 0);
  const rushingRows = offenseRows.filter((row) => row.line.rushAttempts > 0);
  const receivingRows = offenseRows.filter((row) => row.line.receptions > 0);
  const topPerformer = entries.length
    ? entries.reduce((best, entry) => (gameImpactScore(entry) > gameImpactScore(best) ? entry : best))
    : null;
  const topPerformerPlayer = topPerformer ? (roster ?? []).find((player) => player.id === topPerformer.playerId) : null;

  const resultColor =
    game.result === 'W'
      ? 'text-green-700 dark:text-green-400'
      : game.result === 'L'
        ? 'text-red-700 dark:text-red-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-white/5">
              <TeamLogo team={{ assetName: game.opponent, label: game.opponent }} size="lg" />
            </div>
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game detail</p>
              <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
                {game.isHome ? 'vs' : '@'} {game.opponent}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Week {game.week} | {game.date} | {game.dayOfWeek} {game.kickoffTime}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                {game.gameType === 'conference' && game.conferenceName ? (
                  <ConferenceMark conferenceName={game.conferenceName} background={appearance} context="inline" alt="" />
                ) : (
                  getGameTypeImagePath(game, appearance) && (
                    <img
                      src={getGameTypeImagePath(game, appearance) ?? undefined}
                      alt=""
                      onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
                      className="h-5 w-5 shrink-0 object-contain"
                      draggable={false}
                    />
                  )
                )}
                <span>
                  {[
                    gameTypeLabel(game),
                    (() => {
                      const location = getLocationDisplay(game, getStadium);
                      if (location.stadium) return `${location.stadium}, ${location.cityState}`;
                      return game.siteType === 'neutral' ? location.badge : null;
                    })(),
                    game.opponentCurrentRank && game.opponentCurrentRank <= 25
                      ? `#${game.opponentCurrentRank}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </span>
              </p>
            </div>
          </div>

          <div className="text-right">
            {game.result !== null ? (
              <p className={`text-4xl font-semibold tracking-tight ${resultColor}`}>
                {game.result} {game.teamScore}-{game.opponentScore}
              </p>
            ) : (
              <p className="text-2xl font-semibold tracking-tight text-slate-400 dark:text-slate-500">Upcoming</p>
            )}
          </div>
        </div>
      </SurfaceCard>

      {game.result === null || !game.teamStats || !game.opponentStats ? (
        <SurfaceCard>
          <div className="rounded-xl border border-dashed border-slate-300/80 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            This game has not been played yet. Box score and stat surfaces will populate after the result is imported.
          </div>
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Quarter by quarter</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]"></th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">Q1</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">Q2</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">Q3</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">Q4</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">Final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/60 bg-slate-50/80 dark:border-white/5 dark:bg-white/5">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{game.teamName}</td>
                    {game.teamQuarterScores.map((score, index) => (
                      <td key={index} className="proportional-nums px-4 py-3 text-center text-slate-900 dark:text-white">{score}</td>
                    ))}
                    <td className="proportional-nums px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{game.teamScore}</td>
                  </tr>
                  <tr className="bg-slate-50/80 dark:bg-white/5">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{game.opponent}</td>
                    {game.opponentQuarterScores.map((score, index) => (
                      <td key={index} className="proportional-nums px-4 py-3 text-center text-slate-900 dark:text-white">{score}</td>
                    ))}
                    <td className="proportional-nums px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{game.opponentScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Team stats</h3>
              <div className="flex gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                <span>{game.teamName}</span>
                <span>{game.opponent}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-white/5">
              <TeamStatsCompare team={game.teamStats} opponent={game.opponentStats} />
            </div>
          </SurfaceCard>

          {hasBothSides && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 type-eyebrow text-slate-400 dark:text-slate-500">Player box score</span>
              {([
                ['user', game.teamName] as const,
                ['opponent', game.opponent] as const,
              ]).map(([key, name]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSide(key)}
                  aria-pressed={side === key}
                  className={`flex items-center gap-2 border px-3 py-2 text-sm font-medium transition ${
                    side === key
                      ? 'border-[var(--team-primary)] bg-[color-mix(in_srgb,var(--team-primary)_12%,transparent)] text-slate-950 dark:text-white'
                      : 'border-slate-200/80 text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5'
                  }`}
                >
                  <TeamLogo team={{ assetName: name, label: name }} size="sm" />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          )}

          {topPerformer && (
            <SurfaceCard>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Top performer</p>
              <h3 className="mt-2 font-display text-section-title font-semibold text-slate-950 dark:text-white">
                {topPerformerPlayer
                  ? `${topPerformerPlayer.firstName} ${topPerformerPlayer.lastName}`
                  : topPerformer.firstName
                    ? `${topPerformer.firstName} ${topPerformer.lastName}`
                    : `#${topPerformer.playerId}`}
              </h3>
              {(topPerformerPlayer?.position ?? topPerformer.position) && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {topPerformerPlayer?.position ?? topPerformer.position}
                </p>
              )}
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {topPerformer.category === 'offense'
                  ? offenseSummary(topPerformer.line as OffensiveGameLine)
                  : defenseSummary(topPerformer.line as DefensiveGameLine)}
              </p>
            </SurfaceCard>
          )}

          {entries.length === 0 ? (
            <SurfaceCard>
              <div className="rounded-xl border border-dashed border-slate-300/80 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                No individual player stats were recorded for{' '}
                {hasBothSides ? (side === 'opponent' ? game.opponent : game.teamName) : 'your roster'} in this game.
              </div>
            </SurfaceCard>
          ) : (
            <>
              {passingRows.length > 0 && (
                <StatisticsCategorySection<OffensiveGameLine>
                  dynastyId={id}
                  seasonId={seasonId}
                  title="Passing"
                  rows={passingRows}
                  columnDefs={PASSING_GAME_COLUMNS}
                  mode="per-game"
                  defaultSortKey="passYards"
                  leaders={PASSING_GAME_LEADERS}
                  emptyStateMessage="No passing stats recorded."
                />
              )}
              {rushingRows.length > 0 && (
                <StatisticsCategorySection<OffensiveGameLine>
                  dynastyId={id}
                  seasonId={seasonId}
                  title="Rushing"
                  rows={rushingRows}
                  columnDefs={RUSHING_GAME_COLUMNS}
                  mode="per-game"
                  defaultSortKey="rushYards"
                  leaders={RUSHING_GAME_LEADERS}
                  emptyStateMessage="No rushing stats recorded."
                />
              )}
              {receivingRows.length > 0 && (
                <StatisticsCategorySection<OffensiveGameLine>
                  dynastyId={id}
                  seasonId={seasonId}
                  title="Receiving"
                  rows={receivingRows}
                  columnDefs={RECEIVING_GAME_COLUMNS}
                  mode="per-game"
                  defaultSortKey="receivingYards"
                  leaders={RECEIVING_GAME_LEADERS}
                  emptyStateMessage="No receiving stats recorded."
                />
              )}
              {defenseRows.length > 0 && (
                <StatisticsCategorySection<DefensiveGameLine>
                  dynastyId={id}
                  seasonId={seasonId}
                  title="Defense"
                  rows={defenseRows}
                  columnDefs={DEFENSE_GAME_COLUMNS}
                  mode="per-game"
                  defaultSortKey="tackles"
                  leaders={DEFENSE_GAME_LEADERS}
                  emptyStateMessage="No defensive stats recorded."
                />
              )}
            </>
          )}
        </>
      )}

      {/* Auto-populated from Media-page tags: every upload linked to this game. Hidden when empty — the Media page is the hub; this is a bonus surface. */}
      {media.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Media</p>
          <div className="mt-3">
            <MediaGallery dynastyId={id} items={media} hideGameChip />
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
