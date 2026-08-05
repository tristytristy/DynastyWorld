import { useCallback, useEffect, useRef, useState } from 'react';
import { SurfaceCard } from '../ui/SurfaceCard';
import { GliderNav, gliderItemClass } from '../ui/GliderNav';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { ClassBadge } from './ClassBadge';
import { PlayerPortrait } from './PlayerPortrait';
import { MediaBackdrop, mediaPhotoUrls } from './MediaBackdrop';
import { TeamLogo } from './TeamLogo';
import { CLASS_ORDER } from '../../lib/rosterOrder';
import { formatAwardLabel, groupWeeklyHonors } from '../../lib/awardFormat';
import { getAwardTrophyPath } from '../../lib/trophyAssetMapping';
import { gameImpactScore, gameResultLine } from '../../../shared/gameImpactScore';
import { findSamePlayer } from '../../../shared/playerIdentity';
import type { PlayerModalFallback } from '../../data/PlayerModalProvider';
import { useEditorModal } from '../../data/EditorModalProvider';
import { useGameModal } from '../../data/GameModalProvider';
import { EditButton } from './CoachCard';
import { HallAction } from './HallAction';
import { MediaGallery } from './MediaGallery';
import { PlayerNotesTab } from './PlayerNotesTab';
import { PlayerCardTab } from './PlayerCardTab';
import { PlayerOverview } from './player-profile/PlayerOverview';
import { orderedRatingSections, playerDna } from './player-profile/playerRatingRelevance';
import { buildJourneyEvents, type PlayerJourneyEvent } from './player-profile/playerJourneyEvents';
import type {
  AwardsOverview,
  CardStatSourceOption,
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
  PlayerStatSeason,
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

/** The statistical families a stat belongs to — what `RELEVANT_GROUPS` filters on so a quarterback isn't shown a receiving grid full of zeros. */
type StatGroup = 'passing' | 'rushing' | 'receiving' | 'tackling' | 'coverage' | 'takeaways' | 'passRush';

interface StatField<L> {
  label: string;
  /** Column header in the season-by-season table; omitted = tile only. */
  short?: string;
  group: StatGroup;
  value: (line: L) => number | string;
  /** The number that decides "did this ever happen" — Comp/Att is a string, so it can't be its own test. */
  recorded: (line: L) => number;
}

const OFFENSIVE_FIELDS: StatField<OffensiveStatLine | OffensiveGameLine>[] = [
  { label: 'Comp/Att', group: 'passing', value: (l) => `${l.passCompletions}/${l.passAttempts}`, recorded: (l) => l.passAttempts },
  { label: 'Pass Yds', short: 'Pass Yds', group: 'passing', value: (l) => l.passYards, recorded: (l) => l.passYards },
  { label: 'Pass TD', short: 'Pass TD', group: 'passing', value: (l) => l.passTDs, recorded: (l) => l.passTDs },
  // INT belongs to the passing group, so a quarterback always sees it — a clean
  // sheet is a fact worth showing, and it was missing from the season table.
  { label: 'INT', short: 'INT', group: 'passing', value: (l) => l.passInts, recorded: (l) => l.passInts },
  { label: 'Rush Att', group: 'rushing', value: (l) => l.rushAttempts, recorded: (l) => l.rushAttempts },
  { label: 'Rush Yds', short: 'Rush Yds', group: 'rushing', value: (l) => l.rushYards, recorded: (l) => l.rushYards },
  { label: 'Rush TD', short: 'Rush TD', group: 'rushing', value: (l) => l.rushTDs, recorded: (l) => l.rushTDs },
  { label: 'Rec', group: 'receiving', value: (l) => l.receptions, recorded: (l) => l.receptions },
  { label: 'Rec Yds', short: 'Rec Yds', group: 'receiving', value: (l) => l.receivingYards, recorded: (l) => l.receivingYards },
  { label: 'Rec TD', short: 'Rec TD', group: 'receiving', value: (l) => l.receivingTDs, recorded: (l) => l.receivingTDs },
];

const DEFENSIVE_FIELDS: StatField<DefensiveStatLine | DefensiveGameLine>[] = [
  { label: 'Tackles', short: 'Tkl', group: 'tackling', value: (l) => l.tackles, recorded: (l) => l.tackles },
  { label: 'Assists', short: 'Ast', group: 'tackling', value: (l) => l.assistedTackles, recorded: (l) => l.assistedTackles },
  { label: 'TFL', short: 'TFL', group: 'tackling', value: (l) => l.tacklesForLoss, recorded: (l) => l.tacklesForLoss },
  { label: 'Sacks', short: 'Sacks', group: 'passRush', value: (l) => l.sacks, recorded: (l) => l.sacks },
  { label: 'INT', short: 'INT', group: 'coverage', value: (l) => l.interceptions, recorded: (l) => l.interceptions },
  { label: 'INT Yds', group: 'coverage', value: (l) => l.interceptionReturnYards, recorded: (l) => l.interceptionReturnYards },
  { label: 'Pass Def.', short: 'PD', group: 'coverage', value: (l) => l.passDeflections, recorded: (l) => l.passDeflections },
  { label: 'Forced Fum.', short: 'FF', group: 'takeaways', value: (l) => l.forcedFumbles, recorded: (l) => l.forcedFumbles },
  { label: 'Fum. Rec.', group: 'takeaways', value: (l) => l.fumbleRecoveries, recorded: (l) => l.fumbleRecoveries },
];

/** What each position is judged on. Anything not listed still shows once it's recorded. */
const RELEVANT_GROUPS: Record<string, StatGroup[]> = {
  QB: ['passing', 'rushing'],
  HB: ['rushing', 'receiving'],
  FB: ['rushing', 'receiving'],
  WR: ['receiving'],
  TE: ['receiving'],
  // Linemen post no countable stats at all — they get Games and whatever the
  // odd fumble recovery turns up, which is the honest set.
  LT: [], LG: [], C: [], RG: [], RT: [],
  LE: ['tackling', 'passRush'],
  RE: ['tackling', 'passRush'],
  DT: ['tackling', 'passRush'],
  LOLB: ['tackling', 'passRush'],
  MLB: ['tackling', 'passRush'],
  ROLB: ['tackling', 'passRush'],
  CB: ['tackling', 'coverage'],
  FS: ['tackling', 'coverage'],
  SS: ['tackling', 'coverage'],
};

/**
 * Fields worth rendering for this player: the ones his position is judged on,
 * plus any that actually happened in `lines`. Pass every line the surface will
 * show (all seasons, for a table) so a column can't be ragged — present for one
 * row and missing for the next.
 */
function relevantFields<L>(fields: StatField<L>[], position: string | null | undefined, lines: L[]): StatField<L>[] {
  // An unknown position (or one we've no opinion on) falls back to "show
  // everything" rather than hiding the whole card.
  const groups = position ? RELEVANT_GROUPS[position] : undefined;
  if (groups === undefined) return fields;
  const relevant = new Set(groups);
  return fields.filter((field) => relevant.has(field.group) || lines.some((line) => field.recorded(line) > 0));
}

function StatLineSection({
  title,
  category,
  position,
  line,
  emptyMessage,
}: {
  title: string;
  category: 'offense' | 'defense' | undefined;
  position: string | null | undefined;
  line: OffensiveStatLine | DefensiveStatLine | null | undefined;
  emptyMessage: string;
}) {
  if (!line || !category) {
    return <EmptySection title={title} message={emptyMessage} />;
  }

  const tiles =
    category === 'offense'
      ? relevantFields(OFFENSIVE_FIELDS, position, [line as OffensiveStatLine]).map((f) => ({
          label: f.label,
          value: f.value(line as OffensiveStatLine),
        }))
      : relevantFields(DEFENSIVE_FIELDS, position, [line as DefensiveStatLine]).map((f) => ({
          label: f.label,
          value: f.value(line as DefensiveStatLine),
        }));

  return (
    <SurfaceCard>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Games" value={line.gamesPlayed} />
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

/**
 * `teamByYear` comes from the development data, which resolves each season from
 * the LEAGUE-wide roster snapshot — so it names whichever school the player was
 * actually at that year, transfers included. That's the whole point of the
 * column: a season-by-season line is misleading without it once a player moves.
 */
function ImportedSeasonHistorySection({
  seasons,
  teamByYear,
  position,
}: {
  seasons: PlayerImportedStatSeason[];
  teamByYear: Map<number, string | null>;
  position: string | null | undefined;
}) {
  if (seasons.length === 0) {
    return (
      <EmptySection
        title="Season by season"
        message="No multi-season stat history is available yet. Import more seasons to build this player timeline."
      />
    );
  }

  const category = seasons[0].category;
  /*
    Columns are chosen from EVERY row, not row by row — a column present for one
    season and absent for the next would make the table unreadable. Only fields
    with a `short` header can be a column; the rest are tile-only (Comp/Att,
    INT Yds, Fum. Rec.), because this table is already eleven columns wide.
  */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const columns = relevantFields<any>(
    ((category === 'offense' ? OFFENSIVE_FIELDS : DEFENSIVE_FIELDS) as StatField<any>[]).filter((f) => f.short),
    position,
    seasons.map((s) => s.line as any),
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
        <h3 className="font-display text-section-title font-semibold text-slate-950 dark:text-white">Season by season</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          One row per imported season for this player.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-slate-50/85 text-slate-500 dark:bg-white/5 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Season</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Class</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Pos</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">GP</th>
              {columns.map((column) => (
                <th key={column.label} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">
                  {column.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.seasonYear} className="border-t border-white/60 bg-slate-50/80 dark:border-white/5 dark:bg-white/5">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{season.seasonYear}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const teamName = teamByYear.get(season.seasonYear) ?? null;
                    // The mark alone, with the school on hover: the row is already
                    // dense and the logo is the faster read at a glance, which is
                    // what "a snapshot" of a career needs.
                    return teamName ? (
                      <TeamLogo
                        team={{ assetName: teamName, label: teamName }}
                        size="sm"
                        className="!h-6 !w-6"
                      />
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">-</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {season.schoolYear ? <ClassBadge schoolYear={season.schoolYear} /> : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{season.position ?? '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{season.line.gamesPlayed}</td>
                {columns.map((column) => (
                  <td key={column.label} className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {column.value(season.line as any)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

/** Same relevance rule as the season/career tiles — see RELEVANT_GROUPS. */
function offensiveGameTiles(line: OffensiveGameLine, position: string | null | undefined) {
  return relevantFields(OFFENSIVE_FIELDS, position, [line]).map((f) => ({ label: f.label, value: f.value(line) }));
}

function defensiveGameTiles(line: DefensiveGameLine, position: string | null | undefined) {
  return relevantFields(DEFENSIVE_FIELDS, position, [line]).map((f) => ({ label: f.label, value: f.value(line) }));
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

/**
 * Recent form — the last five results as a row of chips.
 *
 * Answers "is he trending up" before the table does, and only exists when there
 * is a trend to see: with one game played a form line is just that game, and the
 * table two inches below already says so.
 */
function RecentForm({ entries, schedule }: { entries: GameLogEntry[]; schedule: ScheduleOverview | null }) {
  const recent = entries
    .map((entry) => ({ entry, game: schedule?.games.find((g) => g.gameId === entry.gameId) }))
    .filter((r) => r.game?.result)
    .sort((a, b) => (b.game?.week ?? 0) - (a.game?.week ?? 0))
    .slice(0, 5)
    .reverse();
  if (recent.length < 2) return null;

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recent form</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {recent.map(({ entry, game }) => (
          <div
            key={entry.gameId}
            className="corner-cut-sm border border-slate-200/80 px-3 py-2 dark:border-slate-800"
          >
            <p className="flex items-baseline gap-1.5">
              <span
                className={`type-stat-sm ${
                  game?.result === 'W' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {game?.result}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {game?.isHome ? 'vs' : '@'} {game?.opponent}
              </span>
            </p>
            <p className="mt-0.5 whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
              {gameLogSummary(entry)}
            </p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

function GameLogSection({
  entries,
  schedule,
  onOpenGame,
}: {
  entries: GameLogEntry[];
  schedule: ScheduleOverview | null;
  /** When set, a row opens that game's box score — the game log becomes an index rather than a dead end. */
  onOpenGame?: (gameId: number) => void;
}) {
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
                <tr
                  key={entry.gameId}
                  onClick={onOpenGame ? () => onOpenGame(entry.gameId) : undefined}
                  onKeyDown={
                    onOpenGame
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenGame(entry.gameId);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onOpenGame ? 0 : undefined}
                  role={onOpenGame ? 'button' : undefined}
                  aria-label={onOpenGame && game ? `Open the box score for ${game.isHome ? 'vs' : '@'} ${game.opponent}` : undefined}
                  className={`border-b border-white/60 bg-slate-50/80 dark:border-white/5 dark:bg-white/5 ${
                    onOpenGame
                      ? 'cursor-pointer transition duration-fast ease-standard hover:bg-slate-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:hover:bg-white/10'
                      : ''
                  }`}
                >
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

function BestGameSection({
  entries,
  schedule,
  position,
}: {
  entries: GameLogEntry[];
  schedule: ScheduleOverview | null;
  position: string | null | undefined;
}) {
  if (entries.length === 0) {
    return <EmptySection title="Best game" message="Once a game has been played, the top performance shows up here." />;
  }

  const best = entries.reduce((top, entry) => (gameImpactScore(entry) > gameImpactScore(top) ? entry : top));
  const game = schedule?.games.find((item) => item.gameId === best.gameId);
  const resultLine = gameResultLine(game);
  const tiles =
    best.category === 'offense'
      ? offensiveGameTiles(best.line as OffensiveGameLine, position)
      : defensiveGameTiles(best.line as DefensiveGameLine, position);

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
/**
 * The five things a player profile is for, in the order the questions get asked:
 * who is he, how is he playing, how good is he, what has happened to him, and
 * what have I made of him.
 *
 * This replaced TEN tabs (Overview, Cards, Stats, Career, Awards, Media, Notes,
 * Attributes, Game Log, History). The old set wasn't ten answers — it was one
 * answer split across three tabs in several places: Stats / Career / Game Log
 * were all "how is he performing", and Awards / Media / Notes / History were all
 * "what has happened". Ten destinations made the user do the consolidating.
 */
export type ProfileTab = 'overview' | 'performance' | 'ratings' | 'journey' | 'showcase';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'performance', label: 'Performance' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'journey', label: 'Journey' },
  // Everything the user MADE of this player — the cards they built and the
  // photos they tagged. Both are authored, both are a collection, and splitting
  // them put "my stuff about him" in two different places (user direction).
  { key: 'showcase', label: 'Showcase' },
];

/** The two halves of Showcase. A pair, so it's the app's two-state switch rather than a segmented control. */
type ShowcaseMode = 'cards' | 'media';

/** Modes WITHIN Performance. SegmentedControl, not a second glider: the design system already separates navigating from mode-switching. */
type PerformanceMode = 'season' | 'career' | 'games';
const PERFORMANCE_MODES: { value: PerformanceMode; label: string }[] = [
  { value: 'season', label: 'This Season' },
  { value: 'career', label: 'Career' },
  { value: 'games', label: 'Games' },
];

/** Modes within Journey — filters over one career narrative, not four tabs wearing a different hat. */
type JourneyMode = 'all' | 'milestones' | 'honors' | 'notes';
const JOURNEY_MODES: { value: JourneyMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'honors', label: 'Honors' },
  { value: 'notes', label: 'Notes' },
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


/** Compact editorial card used across the Overview tab — title, one focal line, supporting line, optional jump-to-tab action. */
/**
 * Read-only attribute ratings, grouped exactly like the editor's Ratings tab
 * (same RATING_SECTIONS source). Current season only — ratings live in the
 * save file, and a historical season's file state no longer exists to read.
 */
/**
 * RATINGS — evaluation first, raw numbers second.
 *
 * This was "Attributes": every `RATING_SECTIONS` group rendered as an identical
 * grid of ~50 bordered boxes, in schema order, with no answer to the only
 * question a user actually brings to it — is he good, and at what. A wall of
 * equal-weight numbers makes the reader do the evaluating.
 *
 * Now it leads with Player DNA, then the rating groups that DECIDE this
 * position, and keeps the remainder behind a disclosure. Labels, abbreviations
 * and keys still come from `RATING_SECTIONS` — there is no second set — and the
 * position→relevance judgement is the same `playerRatingRelevance` utility
 * Overview's DNA module uses, so the two can't drift.
 */
function RatingsTab({
  dynastyId,
  playerId,
  isCurrentSeason,
  position,
  ovrChange,
  ovrSince,
}: {
  dynastyId: string;
  playerId: number;
  isCurrentSeason: boolean;
  position: string;
  /** OVR movement across tracked seasons, when there is more than one. */
  ovrChange: number | null;
  ovrSince: number | null;
}) {
  const [fields, setFields] = useState<PlayerEditFields | null | undefined>(isCurrentSeason ? undefined : null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!isCurrentSeason) return;
    let cancelled = false;
    setFields(undefined);
    // See the note in PlayerOverview: a rejected read must land on the honest
    // empty state, not leave this stuck on "Reading ratings…".
    window.api.editor
      .getPlayer(dynastyId, playerId)
      .then((result) => {
        if (!cancelled) setFields(result?.fields ?? null);
      })
      .catch(() => {
        if (!cancelled) setFields(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, isCurrentSeason]);

  if (!isCurrentSeason) {
    return (
      <EmptySection
        title="Ratings"
        message="Ratings are read live from the save file, so they're only available for players on the current season's roster — a past season's save state no longer exists to read."
      />
    );
  }
  if (fields === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Reading ratings from the save file...</p>;
  }
  if (fields === null) {
    return <EmptySection title="Ratings" message="This player couldn't be found in the save file." />;
  }

  const dna = playerDna(position, fields);
  const ordered = orderedRatingSections(position);
  // The two groups that decide this position lead; everything else is real but
  // secondary, and a disclosure is honest about that without hiding it.
  const lead = ordered.slice(0, 2);
  const rest = ordered.slice(2);

  const renderGroup = (section: (typeof ordered)[number]) => (
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
  );

  return (
    <div className="space-y-5">
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Player DNA</p>
        {dna.strength ? (
          <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="type-stat-sm text-slate-950 dark:text-white">
                {dna.strength.abbr} {dna.strength.value}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Strength</p>
            </div>
            {dna.weakness && dna.weakness.key !== dna.strength.key && (
              <div>
                <p className="type-stat-sm text-slate-950 dark:text-white">
                  {dna.weakness.abbr} {dna.weakness.value}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Weakness</p>
              </div>
            )}
            {dna.priority && (
              <div>
                <p className="type-stat-sm text-slate-950 dark:text-white">{dna.priority.abbr}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Develop next</p>
              </div>
            )}
            {ovrChange !== null && ovrSince !== null && (
              <div>
                <p
                  className={`type-stat-sm ${
                    ovrChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ovrChange < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-950 dark:text-white'
                  }`}
                >
                  {ovrChange > 0 ? `+${ovrChange}` : ovrChange}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">OVR since {ovrSince}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No position-relevant ratings could be read for this player.
          </p>
        )}
      </SurfaceCard>

      {lead.map(renderGroup)}

      {rest.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="text-sm font-medium text-[var(--team-accent-text)] transition duration-fast ease-standard hover:underline"
          >
            {showAll ? 'Hide the rest' : `View all ratings (${rest.length} more group${rest.length === 1 ? '' : 's'})`}
          </button>
          {showAll && (
            <div className="mt-4 space-y-5">
              {rest.map(renderGroup)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/**
 * The Journey timeline — every career event in one reverse-chronological list,
 * grouped by season.
 *
 * Replaces `HistoryTab` + `HonorsSection` + `TeamAwardsWonSection` stacked on
 * top of each other. Those three each sorted themselves, so a season's award and
 * that season's milestones could never appear next to one another; the user was
 * reading three lists and doing the interleaving. Sorting is
 * `buildJourneyEvents`' job — this only draws.
 */
function JourneyTimeline({ events, mode }: { events: PlayerJourneyEvent[]; mode: 'all' | 'milestones' | 'honors' }) {
  if (events.length === 0) {
    return (
      <EmptySection
        title={mode === 'honors' ? 'Honors' : mode === 'milestones' ? 'Milestones' : 'Journey'}
        message={
          mode === 'honors'
            ? 'No honors yet — the résumé starts with the first one.'
            : mode === 'milestones'
              ? 'No milestones yet. These appear as games are played and imported.'
              : 'Nothing recorded yet. Milestones appear as games are played; notes and media you add yourself.'
        }
      />
    );
  }

  // Grouped by season so the year is stated once, not repeated on every row.
  const bySeason: { seasonYear: number; events: PlayerJourneyEvent[] }[] = [];
  for (const event of events) {
    const last = bySeason[bySeason.length - 1];
    if (last && last.seasonYear === event.seasonYear) last.events.push(event);
    else bySeason.push({ seasonYear: event.seasonYear, events: [event] });
  }

  return (
    <div className="space-y-5">
      {bySeason.map((season) => (
        <div key={season.seasonYear} className="flex gap-4">
          <p className="type-stat-sm w-14 shrink-0 pt-0.5 text-slate-400 dark:text-slate-500">{season.seasonYear}</p>
          <div className="min-w-0 flex-1 border-l border-slate-200/70 pl-4 dark:border-white/10">
            {season.events.map((event) => (
              <div key={event.id} className="border-b border-slate-200/60 py-2 last:border-0 dark:border-white/5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{event.title}</span>
                  {event.detail && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{event.detail}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One season's roster and stat lines — what the all-seasons aggregate returns and what the player-resolution fallback searches. */
interface SeasonRosterStats {
  seasonId: number;
  seasonYear: number;
  roster: RosterPlayer[] | null;
  stats: PlayerStats[] | null;
}

interface TimelineEvent {
  seasonYear: number;
  label: string;
  detail: string | null;
}

/** One game this player actually played, in career order, with the opponent resolved. */
interface CareerGame {
  seasonYear: number;
  week: number;
  opponent: string;
  isHome: boolean;
  category: 'offense' | 'defense';
  line: OffensiveGameLine | DefensiveGameLine;
}

interface MilestoneDefinition {
  id: string;
  label: string;
  /** Position groups this can fire for. Empty = anyone. */
  positions?: string[];
  category: 'offense' | 'defense';
  test: (line: never, game: CareerGame) => boolean;
  /** The number worth showing beside the milestone ("214 yds", "3 TD"). */
  value?: (line: never) => string;
}

const SKILL_BACKS = ['HB', 'FB'];
const RECEIVERS = ['WR', 'TE'];
const FRONT_SEVEN = ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB'];
const SECONDARY = ['CB', 'FS', 'SS'];
const DEFENDERS = [...FRONT_SEVEN, ...SECONDARY];

const off = (test: (l: OffensiveGameLine, g: CareerGame) => boolean) => test as unknown as MilestoneDefinition['test'];
const def = (test: (l: DefensiveGameLine, g: CareerGame) => boolean) => test as unknown as MilestoneDefinition['test'];
const offValue = (fn: (l: OffensiveGameLine) => string) => fn as unknown as MilestoneDefinition['value'];
const defValue = (fn: (l: DefensiveGameLine) => string) => fn as unknown as MilestoneDefinition['value'];

/**
 * Career firsts, worked out from the per-game lines rather than season totals —
 * "first 100-yard game" is a fact about ONE Saturday and can't be recovered from
 * a season row. Each fires exactly once, on the earliest game that satisfies it.
 *
 * Position-scoped on purpose: a quarterback's first catch isn't a milestone,
 * it's a trick play. Anything unscoped (debut, first start, breakout) applies to
 * everyone who appears in a box score.
 *
 * NOT COVERED, honestly: offensive linemen record no countable stats, and
 * kickers/punters aren't in the game-log categories at all — those players get
 * the universal three and nothing else, which is better than inventing a
 * milestone the data can't support.
 *
 * >>> docs/MILESTONES.md IS THE SPEC FOR THIS ARRAY. <<<
 * It's written for the user to edit — every row there carries the `id` used
 * here. Change one, change the other, or they drift apart and the document
 * stops being worth reading.
 */
const MILESTONES: MilestoneDefinition[] = [
  // ── Universal ────────────────────────────────────────────────────────────
  // "Recorded", not "career" — a dynasty imported mid-career has no box scores
  // from before the first sync, and claiming a debut we can't see would be a lie.
  // The rest keep the natural wording; the same caveat is stated once, here.
  { id: 'debut', label: 'First recorded game', category: 'offense', test: off(() => true) },
  { id: 'debut-def', label: 'First recorded game', category: 'defense', test: def(() => true) },
  { id: 'first-start', label: 'First start', category: 'offense', test: off((l) => l.started) },
  { id: 'first-start-def', label: 'First start', category: 'defense', test: def((l) => l.started) },
  {
    id: 'breakout',
    label: 'Breakout game',
    category: 'offense',
    test: off((l) => l.gameRating >= 90),
    value: offValue((l) => `${l.gameRating} rating`),
  },
  {
    id: 'breakout-def',
    label: 'Breakout game',
    category: 'defense',
    test: def((l) => l.gameRating >= 90),
    value: defValue((l) => `${l.gameRating} rating`),
  },

  // ── Quarterback ──────────────────────────────────────────────────────────
  { id: 'qb-first-td', label: 'First career touchdown pass', positions: ['QB'], category: 'offense', test: off((l) => l.passTDs > 0) },
  {
    id: 'qb-300',
    label: 'First 300-yard passing game',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passYards >= 300),
    value: offValue((l) => `${l.passYards} yds`),
  },
  {
    id: 'qb-400',
    label: 'First 400-yard passing game',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passYards >= 400),
    value: offValue((l) => `${l.passYards} yds`),
  },
  {
    id: 'qb-4td',
    label: 'First four-touchdown game',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passTDs >= 4),
    value: offValue((l) => `${l.passTDs} TD`),
  },
  {
    id: 'qb-clean',
    label: 'First clean sheet (3+ TD, no picks)',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passTDs >= 3 && l.passInts === 0),
    value: offValue((l) => `${l.passTDs} TD · 0 INT`),
  },
  {
    id: 'qb-deep',
    label: 'First 50-yard touchdown strike',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passLongest >= 50 && l.passTDs > 0),
    value: offValue((l) => `${l.passLongest} yd long`),
  },
  {
    id: 'qb-dual',
    label: 'First 200-pass / 50-rush game',
    positions: ['QB'],
    category: 'offense',
    test: off((l) => l.passYards >= 200 && l.rushYards >= 50),
    value: offValue((l) => `${l.passYards} pass · ${l.rushYards} rush`),
  },

  // ── Running backs ────────────────────────────────────────────────────────
  { id: 'rb-first-td', label: 'First career rushing touchdown', positions: SKILL_BACKS, category: 'offense', test: off((l) => l.rushTDs > 0) },
  {
    id: 'rb-100',
    label: 'First 100-yard rushing game',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushYards >= 100),
    value: offValue((l) => `${l.rushYards} yds`),
  },
  {
    id: 'rb-200',
    label: 'First 200-yard rushing game',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushYards >= 200),
    value: offValue((l) => `${l.rushYards} yds`),
  },
  {
    id: 'rb-3td',
    label: 'First three-touchdown game',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushTDs + l.receivingTDs >= 3),
    value: offValue((l) => `${l.rushTDs + l.receivingTDs} TD`),
  },
  {
    id: 'rb-house',
    label: 'First 50-yard touchdown run',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushLongest >= 50 && l.rushTDs > 0),
    value: offValue((l) => `${l.rushLongest} yd long`),
  },
  {
    id: 'rb-workhorse',
    label: 'First 25-carry game',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushAttempts >= 25),
    value: offValue((l) => `${l.rushAttempts} carries`),
  },
  {
    id: 'rb-allpurpose',
    label: 'First 150 scrimmage yards',
    positions: SKILL_BACKS,
    category: 'offense',
    test: off((l) => l.rushYards + l.receivingYards >= 150),
    value: offValue((l) => `${l.rushYards + l.receivingYards} yds`),
  },

  // ── Receivers and tight ends ─────────────────────────────────────────────
  { id: 'wr-first-catch', label: 'First career reception', positions: RECEIVERS, category: 'offense', test: off((l) => l.receptions > 0) },
  { id: 'wr-first-td', label: 'First career touchdown catch', positions: RECEIVERS, category: 'offense', test: off((l) => l.receivingTDs > 0) },
  {
    id: 'wr-100',
    label: 'First 100-yard receiving game',
    positions: RECEIVERS,
    category: 'offense',
    test: off((l) => l.receivingYards >= 100),
    value: offValue((l) => `${l.receivingYards} yds`),
  },
  {
    id: 'wr-200',
    label: 'First 200-yard receiving game',
    positions: RECEIVERS,
    category: 'offense',
    test: off((l) => l.receivingYards >= 200),
    value: offValue((l) => `${l.receivingYards} yds`),
  },
  {
    id: 'wr-10rec',
    label: 'First ten-catch game',
    positions: RECEIVERS,
    category: 'offense',
    test: off((l) => l.receptions >= 10),
    value: offValue((l) => `${l.receptions} catches`),
  },
  {
    id: 'wr-2td',
    label: 'First two-touchdown game',
    positions: RECEIVERS,
    category: 'offense',
    test: off((l) => l.receivingTDs >= 2),
    value: offValue((l) => `${l.receivingTDs} TD`),
  },
  {
    id: 'wr-deep',
    label: 'First 50-yard touchdown catch',
    positions: RECEIVERS,
    category: 'offense',
    test: off((l) => l.receivingLongest >= 50 && l.receivingTDs > 0),
    value: offValue((l) => `${l.receivingLongest} yd long`),
  },

  // ── Defense ──────────────────────────────────────────────────────────────
  { id: 'def-first-tackle', label: 'First career tackle', positions: DEFENDERS, category: 'defense', test: def((l) => l.tackles + l.assistedTackles > 0) },
  { id: 'def-first-sack', label: 'First career sack', positions: DEFENDERS, category: 'defense', test: def((l) => l.sacks > 0) },
  {
    id: 'def-multisack',
    label: 'First multi-sack game',
    positions: DEFENDERS,
    category: 'defense',
    test: def((l) => l.sacks >= 2),
    value: defValue((l) => `${l.sacks} sacks`),
  },
  { id: 'def-first-int', label: 'First career interception', positions: DEFENDERS, category: 'defense', test: def((l) => l.interceptions > 0) },
  { id: 'def-pick6', label: 'First pick six', positions: DEFENDERS, category: 'defense', test: def((l) => l.interceptionTDs > 0) },
  { id: 'def-first-ff', label: 'First forced fumble', positions: DEFENDERS, category: 'defense', test: def((l) => l.forcedFumbles > 0) },
  {
    id: 'def-10tkl',
    label: 'First ten-tackle game',
    positions: DEFENDERS,
    category: 'defense',
    test: def((l) => l.tackles + l.assistedTackles >= 10),
    value: defValue((l) => `${l.tackles + l.assistedTackles} tackles`),
  },
  {
    id: 'def-3tfl',
    label: 'First three-TFL game',
    positions: FRONT_SEVEN,
    category: 'defense',
    test: def((l) => l.tacklesForLoss >= 3),
    value: defValue((l) => `${l.tacklesForLoss} TFL`),
  },
  {
    id: 'def-lockdown',
    label: 'First three-breakup game',
    positions: SECONDARY,
    category: 'defense',
    test: def((l) => l.passDeflections >= 3),
    value: defValue((l) => `${l.passDeflections} PBU`),
  },
  {
    id: 'def-takeaway-double',
    label: 'First two-takeaway game',
    positions: DEFENDERS,
    category: 'defense',
    test: def((l) => l.interceptions + l.fumbleRecoveries >= 2),
    value: defValue((l) => `${l.interceptions + l.fumbleRecoveries} takeaways`),
  },
];

/** Walks the career in order and fires each milestone on the first game that earns it. */
function buildMilestones(games: CareerGame[], position: string): TimelineEvent[] {
  const fired = new Set<string>();
  const events: TimelineEvent[] = [];

  for (const game of games) {
    for (const milestone of MILESTONES) {
      if (fired.has(milestone.id)) continue;
      if (milestone.category !== game.category) continue;
      if (milestone.positions && !milestone.positions.includes(position)) continue;
      if (!milestone.test(game.line as never, game)) continue;

      fired.add(milestone.id);
      const value = milestone.value?.(game.line as never);
      events.push({
        seasonYear: game.seasonYear,
        label: milestone.label,
        detail: [value, `${game.isHome ? 'vs' : '@'} ${game.opponent}`, `Wk ${game.week}`].filter(Boolean).join(' · '),
      });
    }
  }

  return events;
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
  development: PlayerDevelopmentSeason[],
  careerGames: CareerGame[],
  position: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  // The timeline spans seasons, so the id alone cannot name the person — a
  // recycled id would splice a stranger's years into this player's journey,
  // which is exactly how a freshman ended up with a "first recorded game" two
  // seasons before he enrolled. Fix the reference on the newest season holding
  // the id, then match every other year against that human.
  // See shared/playerIdentity.ts.
  const newestHolder = [...statsHistory]
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .map((entry) => entry.roster?.find((p) => p.id === playerId))
    .find(Boolean);
  const rosterByYear = statsHistory
    .map((entry) => ({ seasonYear: entry.seasonYear, player: findSamePlayer(entry.roster, newestHolder) }))
    .filter((e): e is { seasonYear: number; player: RosterPlayer } => !!e.player)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  rosterByYear.forEach((entry, index) => {
    if (index === 0) {
      events.push({
        seasonYear: entry.seasonYear,
        label: 'Season',
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

  /*
    Transfers. The development rows resolve each season from the LEAGUE-wide
    roster, so their `teamName` is whichever school the player was actually at
    that year — a school change between consecutive seasons is the transfer.
    (The user's own roster snapshot can't see this: a player who leaves simply
    stops appearing in it.) Filed under the arrival year.

    The class year MUST advance for it to count, and that guard is doing real
    work: the game parks not-yet-enrolled incoming players on a placeholder FCS
    roster, so every signed recruit shows a school change into your program with
    their class year and OVR frozen. In a single Auburn offseason that was 27
    fake "transfers" against 13 real ones — and the 13 real ones all advanced a
    class, while all 27 fakes did not.

    The known cost: a player who redshirts in the same year he transfers keeps
    his class year and gets skipped. Rare, and much cheaper than flooding every
    freshman's timeline with "Transferred from FCS East".
  */
  const classRank = (schoolYear: string) => CLASS_ORDER.indexOf(schoolYear);
  const schoolByYear = [...development]
    .filter((row) => !!row.teamName)
    .sort((a, b) => a.seasonYear - b.seasonYear);
  for (let i = 1; i < schoolByYear.length; i += 1) {
    const from = schoolByYear[i - 1];
    const to = schoolByYear[i];
    if (from.teamName === to.teamName) continue;
    if (classRank(to.schoolYear) <= classRank(from.schoolYear)) continue;
    events.push({
      seasonYear: to.seasonYear,
      label: `Transferred from ${from.teamName} to ${to.teamName}`,
      detail: `${to.schoolYear} season`,
    });
  }

  /*
    HONORS DELIBERATELY DO NOT LIVE HERE ANY MORE.

    This function used to merge honors and team awards in alongside seasons,
    transfers and milestones — it WAS the old History tab's whole timeline. Now
    that Journey merges every source itself (`buildJourneyEvents`), leaving them
    here merged them twice: the Milestones filter, which selects on
    `kind === 'milestone'`, showed Player of the Week. Caught by a filter test
    asserting Milestones contains no honors.

    So this is now what its name says — the player's own career events. Journey
    adds honors on top, typed as honors, with their week numbers intact.
  */
  events.push(...buildMilestones(careerGames, position));

  return events.sort((a, b) => b.seasonYear - a.seasonYear);
}


/**
 * A destination's mode switch, in the SAME language as the primary navigation.
 *
 * It was a `SegmentedControl` — a filled box with a light active pill — which
 * made the submenu look like a control borrowed from somewhere else sitting
 * under a glider nav. User direction: the submenu is navigation too, so it gets
 * the glider. The one place a switch still wins is Showcase, which is a PAIR
 * (Cards / Media) and uses the app's two-state ToggleSwitch.
 *
 * Smaller padding than the primary row so the hierarchy still reads: same
 * device, quieter voice.
 */
function ModeNav<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <GliderNav
      activeIndex={options.findIndex((o) => o.value === value)}
      ariaLabel={ariaLabel}
      emphasis="quiet"
      itemsClassName="flex-wrap gap-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-current={value === o.value}
          className={gliderItemClass(value === o.value, 'px-3 py-1.5 text-sm')}
        >
          {o.label}
        </button>
      ))}
    </GliderNav>
  );
}

export function PlayerProfileContent({
  dynastyId,
  playerId,
  seasonId,
  fallback,
  leagueTeamIndex,
  tab: controlledTab,
  onTabChange,
}: {
  dynastyId: string;
  playerId: number;
  /** The season the caller was actually browsing (e.g. Roster's currently-selected season). When the player isn't on this season's roster (or no season is given), the component falls back to searching every season, newest first, for the season that actually has them — a player who transferred/graduated/was drafted stays fully viewable, since their old season's roster/stats/gamelog/schedule snapshots are never deleted, only ever added to. */
  seasonId?: number;
  /** Display info for players who won't be found in the local roster (e.g. an opposing team's Heisman winner) — that roster snapshot only covers the user's own team. Lets this component show a real name/team instead of a bare "not found" for leaguewide award data. */
  fallback?: PlayerModalFallback;
  /** Set when the player was opened while browsing another team via the team switcher — the profile then resolves from that team's league snapshot (full bio + season stats + live attributes) instead of the user's roster, so it renders the same full layout as a user-team player. Per-player game logs aren't tracked leaguewide, so those sections show their honest empty states. */
  leagueTeamIndex?: number;
  /** Controlled tab. Supplied by the player modal so the open tab survives a Prev/Next swap. */
  tab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
}) {
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [allStats, setAllStats] = useState<PlayerStats[] | null | undefined>(undefined);
  /** This player's per-game lines for the resolved season — already scoped by the main process (see getPlayerGameLog). */
  const [playerSeasonGamelog, setPlayerSeasonGamelog] = useState<GameLogEntry[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [awardHistory, setAwardHistory] = useState<AwardsBySeason[] | undefined>(undefined);
  const [statsHistory, setStatsHistory] = useState<PlayerStatsBySeason[] | undefined>(undefined);
  /** Season-by-season production INCLUDING years at other schools — see getPlayerStatHistory. */
  const [statSeasons, setStatSeasons] = useState<PlayerStatSeason[]>([]);
  const [teamAwardWins, setTeamAwardWins] = useState<PlayerTeamAwardWin[]>([]);
  /** The season this component actually resolved and is rendering — may differ from the `seasonId` prop if that season's roster didn't have the player and a fallback scan found them in an older one. Drives the Edit button's current-season-only restriction below. */
  const [resolvedSeasonId, setResolvedSeasonId] = useState<number | undefined>(seasonId);
  const [heroTeamName, setHeroTeamName] = useState<string | null>(null);
  /*
    The tab can be driven from outside. The modal does exactly that, because it
    keys this component on the player id to play the swap animation — which
    remounts it, and a remount would otherwise reset an internally-held tab to
    Overview on every Prev/Next. Uncontrolled use still works for any caller
    that doesn't care.
  */
  const [internalTab, setInternalTab] = useState<ProfileTab>('overview');
  // Mode within a destination stays LOCAL to this component: it's a reading
  // preference for the current visit, not something Prev/Next or another
  // surface has any claim on. Promote it only if a real workflow needs it.
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('season');
  const [journeyMode, setJourneyMode] = useState<JourneyMode>('all');
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>('cards');
  const tab = controlledTab ?? internalTab;

  const setTab = (next: ProfileTab) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  /**
   * Jump from an Overview module to the destination that owns its detail —
   * and to the right MODE within it, because "Full stats" and "Game log" now
   * land in the same destination and would otherwise both dump the user on
   * whichever mode happened to be open last.
   */
  const goToPerformance = (mode: PerformanceMode) => {
    setPerformanceMode(mode);
    setTab('performance');
  };
  const goToJourney = (mode: JourneyMode) => {
    setJourneyMode(mode);
    setTab('journey');
  };
  const [seasonsList, setSeasonsList] = useState<SeasonSummary[]>([]);
  const [development, setDevelopment] = useState<PlayerDevelopmentSeason[]>([]);
  /** Every game this player has a box-score line for, oldest first — the raw material for career milestones. */
  const [careerGames, setCareerGames] = useState<CareerGame[]>([]);
  const { openPlayerEditor } = useEditorModal();
  // The game log is an index into the box score the app already has — a second
  // navigation level inside the profile would be a third place to be lost in.
  const { openGameModal } = useGameModal();

  // The player's OVR arc across every synced season (getPlayerDevelopment walks
  // each season's league roster by PresentationId) — powers the Development chart.
  useEffect(() => {
    let cancelled = false;
    setDevelopment([]);
    // Anchored on the season actually being rendered: player ids are recycled,
    // so without it a historical player whose id was reissued would be charted
    // as whoever holds that id now. See shared/playerIdentity.ts.
    window.api.db.getPlayerDevelopment(dynastyId, playerId, resolvedSeasonId).then((rows) => {
      if (!cancelled) setDevelopment(rows ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, resolvedSeasonId]);

  /*
    The season-by-season stat breakdown, from the LEAGUEWIDE snapshot so a
    transfer's years at previous schools are in it. The user's own roster
    snapshots can't supply those — a transfer's career TOTAL already counts them
    (the save accumulates across schools) while the breakdown underneath showed
    only the seasons he spent with you, so the totals never added up.
  */
  useEffect(() => {
    let cancelled = false;
    setStatSeasons([]);
    window.api.db.getPlayerStatHistory(dynastyId, playerId, resolvedSeasonId).then((rows) => {
      if (!cancelled) setStatSeasons(rows ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, resolvedSeasonId]);

  /*
    Every box score this player has ever appeared in, for the History tab's
    career milestones — "first 100-yard game" is a fact about one Saturday and
    can't be recovered from a season total.

    Deliberately its own effect, running in parallel with the main load rather
    than tacked onto the end of it: it needs every season, not the one being
    viewed, and it must also cover players opened through the team switcher
    (that path returns early from the main effect). The tabs paint from the
    main load and this fills in behind them.

    Opponents come from getLeagueScores, not the user's own schedule: the game
    log is LEAGUEWIDE (944 games in one Auburn season against a 13-game user
    schedule), so a transfer's pre-arrival games — and any opposing player's
    whole career — only resolve against the full league slate. Games that can't
    be placed are dropped rather than shown as "vs Unknown, Wk 0", which would
    also corrupt the chronological order the milestones depend on.
  */
  /*
    TIER 3 (Phase 7). These two datasets used to load on every modal open,
    whatever destination the user was on. Neither is on screen at Overview:
    career games feed Journey's milestones, and the all-seasons aggregate feeds
    Journey's honors and Performance's career table.

    `needsJourneyData` latches — once a destination has asked, the data stays
    for the session, so coming back to it is instant and doesn't repeat the IPC
    work. Both effects still key on the player, so switching players refetches
    for the new one and a late response from the old one is dropped by the
    `cancelled` flag that was already there.
  */
  /**
   * THIS SEASON's honors, for Overview's latest-event module — one `getAwards`
   * rather than the all-seasons aggregate.
   *
   * Deferring the aggregate (Phase 7) left that module claiming "nothing
   * recorded yet" for a player who had just won National Offensive Player of
   * the Week, because its only honor source didn't load until Journey was
   * opened. Overview opens by default, so the module was wrong on the one
   * destination everybody sees. A single season's awards is ~130 KB against the
   * aggregate's N × that, and the LATEST event is almost always this season's —
   * so this is the cheap source that makes the module honest rather than a
   * reason to reinstate the eager load.
   */
  const [currentSeasonAwards, setCurrentSeasonAwards] = useState<AwardsBySeason | null>(null);
  useEffect(() => {
    if (resolvedSeasonId === undefined) return;
    let cancelled = false;
    setCurrentSeasonAwards(null);
    const seasonYear = seasonsList.find((s) => s.id === resolvedSeasonId)?.seasonYear;
    if (seasonYear === undefined) return;
    void window.api.db.getAwards(dynastyId, resolvedSeasonId).then((awards) => {
      if (!cancelled && awards) setCurrentSeasonAwards({ seasonYear, awards });
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, resolvedSeasonId, seasonsList]);

  const [journeyRequested, setJourneyRequested] = useState(false);
  useEffect(() => {
    if (tab === 'journey' && !journeyRequested) setJourneyRequested(true);
  }, [tab, journeyRequested]);

  const needsCareerData = journeyRequested || tab === 'journey';


  useEffect(() => {
    let cancelled = false;
    setCareerGames([]);
    if (!needsCareerData) return;

    (async () => {
      const seasons = await window.api.db.getSeasons(dynastyId);
      if (cancelled) return;
      const perSeason = await Promise.all(
        seasons.map(async (season) => {
          const [log, scores, userSchedule] = await Promise.all([
            // Scoped to this player in the MAIN process. The leaguewide log is
            // ~16 MB for a played season and this loop wanted it once per season,
            // only ever to keep the dozen-odd rows belonging to one player.
            // Anchored: this loop spans every season, and a season where a
            // different person held this id must contribute no games — that is
            // what put a "first recorded game" on a freshman's journey two
            // years before he enrolled. See shared/playerIdentity.ts.
            window.api.db.getPlayerGameLog(dynastyId, playerId, season.id, resolvedSeasonId),
            window.api.db.getLeagueScores(dynastyId, season.id),
            window.api.db.getSchedule(dynastyId, season.id),
          ]);
          const leagueById = new Map((scores?.games ?? []).map((g) => [g.gameId, g]));
          const userById = new Map((userSchedule?.games ?? []).map((g) => [g.gameId, g]));

          return (log ?? [])
            .flatMap((entry) => {
              const game = leagueById.get(entry.gameId);
              if (!game) return [];
              // Which side was he on? teamIndex is the direct answer; seasons
              // synced before it existed only ever logged the user's own team,
              // so their schedule row is the reliable fallback.
              const userGame = userById.get(entry.gameId);
              let opponent: string;
              let isHome: boolean;
              if (entry.teamIndex === game.homeTeamIndex) {
                opponent = game.awayTeamName;
                isHome = true;
              } else if (entry.teamIndex === game.awayTeamIndex) {
                opponent = game.homeTeamName;
                isHome = false;
              } else if (userGame) {
                opponent = userGame.opponent;
                isHome = userGame.isHome;
              } else {
                return [];
              }
              return [
                {
                  seasonYear: season.seasonYear,
                  week: game.week,
                  opponent,
                  isHome,
                  category: entry.category,
                  line: entry.line,
                } satisfies CareerGame,
              ];
            });
        }),
      );
      if (cancelled) return;
      setCareerGames(perSeason.flat().sort((a, b) => a.seasonYear - b.seasonYear || a.week - b.week));
    })();

    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, needsCareerData, resolvedSeasonId]);

  /**
   * THE ALL-SEASONS AGGREGATE — award history, the per-season stat table, and
   * team-award wins. Awards alone are ~130 KB and ~20 ms PER SEASON, plus every
   * season's roster and stat line on top.
   *
   * LOADED ON DEMAND, and this shape is why. It can't be gated from inside the
   * main effect: the gate would join that effect's dependency array, and that
   * effect is the one that RESOLVES THE PLAYER — so every tab change would
   * refetch the roster and re-resolve the player underneath the user. So it
   * lives here instead, as a function anyone can call, with the two guarantees
   * that make calling it safe from several places at once:
   *
   *  • DEDUPED. The in-flight promise is cached against a (dynasty, player) key,
   *    so Performance and Journey both asking, or the player-resolution fallback
   *    asking at the same moment, all await one request.
   *  • KEY-CHECKED, not cancel-flagged. A response that arrives after the user
   *    has moved to another player is dropped by comparing the key it was
   *    started under — the failure this replaces is an older player's awards
   *    landing on the newly selected one.
   */
  const aggregateKeyRef = useRef('');
  const aggregateRef = useRef<Promise<SeasonRosterStats[] | null> | null>(null);
  const aggregateKey = `${dynastyId}:${playerId}`;
  if (aggregateKeyRef.current !== aggregateKey) {
    aggregateKeyRef.current = aggregateKey;
    aggregateRef.current = null;
  }

  const loadAggregate = useCallback(
    (seasons: SeasonSummary[]): Promise<SeasonRosterStats[] | null> => {
      if (aggregateRef.current) return aggregateRef.current;
      const key = aggregateKeyRef.current;
      const run = async (): Promise<SeasonRosterStats[] | null> => {

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

        if (aggregateKeyRef.current !== key) return null;
        setAwardHistory(
          seasonAwards
            .filter((entry): entry is AwardsBySeason => entry.awards !== null)
            .sort((a, b) => b.seasonYear - a.seasonYear),
        );
        setStatsHistory([...seasonStats].sort((a, b) => b.seasonYear - a.seasonYear));

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
        return seasonStats;
        return seasonStats;
      };
      aggregateRef.current = run();
      return aggregateRef.current;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dynastyId, playerId],
  );

  /*
    THE GATE. Performance's Career table and Journey's honors are the only things
    that read the aggregate, so it loads the first time either is opened and
    never again for this player — `loadAggregate` caches its own promise, so a
    revisit is free rather than a repeated round of N-season IPC.

    Latched in state rather than read from `tab` directly: leaving a destination
    must not throw the data away, or coming back would refetch it.
  */
  const [aggregateRequested, setAggregateRequested] = useState(false);
  useEffect(() => {
    if (tab === 'journey' || tab === 'performance') setAggregateRequested(true);
  }, [tab]);
  useEffect(() => {
    setAggregateRequested(tab === 'journey' || tab === 'performance');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynastyId, playerId]);
  useEffect(() => {
    if (!aggregateRequested) return;
    let cancelled = false;
    void (async () => {
      const seasons = await window.api.db.getSeasons(dynastyId);
      if (!cancelled) await loadAggregate(seasons);
    })();
    return () => {
      cancelled = true;
    };
  }, [aggregateRequested, dynastyId, playerId, loadAggregate]);

  useEffect(() => {
    let cancelled = false;
    setRoster(undefined);
    setResolvedSeasonId(seasonId);

    async function load() {
      const seasons = await window.api.db.getSeasons(dynastyId);
      if (!cancelled) setSeasonsList(seasons);

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
        setPlayerSeasonGamelog(null);
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

      type Resolved = { seasonId: number; roster: RosterPlayer[] | null; stats: PlayerStats[] | null };
      let resolved: Resolved | undefined;

      // THE COMMON CASE, ON ITS OWN. Nine times out of ten the player is on the
      // roster of the season the caller was already looking at — two small
      // reads, and the hero can paint. The exhaustive search below is the
      // exception (a transfer, a graduate, an award card with no season in
      // view), and making the common case wait for it is what made opening a
      // player feel slow.
      if (requestedSeason) {
        const [roster, stats] = await Promise.all([
          window.api.db.getRoster(dynastyId, requestedSeason.id),
          window.api.db.getPlayerStats(dynastyId, requestedSeason.id),
        ]);
        if (cancelled) return;
        if (roster?.some((p) => p.id === playerId)) {
          resolved = { seasonId: requestedSeason.id, roster, stats };
        }
      }

      // Missed — fall back to every season, newest first. This needs the
      // all-seasons rosters, which the aggregate is already fetching.
      if (!resolved) {
        // The one place the aggregate is required regardless of destination:
        // without every season's roster there is no player to render at all.
        const seasonStats = await loadAggregate(seasons);
        if (cancelled || !seasonStats) return;
        const searchOrder = [
          ...(requestedSeason ? [requestedSeason] : []),
          ...[...seasons].sort((a, b) => b.seasonYear - a.seasonYear),
        ];
        for (const season of searchOrder) {
          const entry = seasonStats.find((s) => s.seasonId === season.id);
          if (entry?.roster?.some((p) => p.id === playerId)) {
            resolved = entry;
            break;
          }
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
          // Player-scoped: every consumer of this state filters it to this
          // player anyway, and the unscoped call is ~16 MB on a played season.
          window.api.db.getPlayerGameLog(dynastyId, playerId, resolved.seasonId),
          window.api.db.getSchedule(dynastyId, resolved.seasonId),
        ]);
        if (!cancelled) {
          setPlayerSeasonGamelog(gamelogResult);
          setSchedule(scheduleResult);
        }
      } else {
        setPlayerSeasonGamelog(null);
        setSchedule(null);
      }

    }

    load();
    return () => {
      cancelled = true;
    };
    // `loadAggregate` is intentionally absent: it is memoised on exactly
    // (dynastyId, playerId), both of which are already here, so listing it adds
    // nothing — and this is the effect that resolves the player, so a spurious
    // re-run is precisely the thing to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynastyId, seasonId, playerId, leagueTeamIndex, fallback?.teamDisplayName]);

  /*
    THE PLAYER STANDS IN HIS OWN PHOTOGRAPHS. Same treatment as the Trophy
    Room — black and white, high contrast, the jumbotron grid, a slow drift —
    because it is literally the same component and the same stylesheet.

    Anything tagged to this player anywhere, not scoped to a season or a game:
    a masthead is about the person, not an occasion. No photographs and the
    hero is exactly the neutral field it has always been.

    ABOVE THE EARLY RETURNS, deliberately: this component bails out while the
    roster is loading and again when no player resolves, so a hook placed with
    the render code runs on some passes and not others.
  */
  const [heroMedia, setHeroMedia] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    setHeroMedia([]);
    window.api.media.listForPlayer(dynastyId, playerId).then((items) => {
      if (!cancelled) setHeroMedia(mediaPhotoUrls(items));
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId]);

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
  const playerGamelog = playerSeasonGamelog ?? [];
  const honorSeasons = buildPlayerHonorSeasons(awardHistory ?? [], playerId);
  /*
    Prefer the leaguewide history; fall back to the user-team build only if it
    hasn't loaded (or a legacy archive has no leagueRoster snapshot), so an
    older dynasty still shows the seasons it can rather than nothing.
  */
  const importedStatSeasons = buildImportedStatSeasons(statsHistory ?? [], playerId);
  const seasonBreakdown = statSeasons.length > 0 ? statSeasons : importedStatSeasons;
  const teamByYear = new Map<number, string | null>(
    statSeasons.length > 0
      ? statSeasons.map((row) => [row.seasonYear, row.teamName])
      : development.map((row) => [row.seasonYear, row.teamName]),
  );

  // Editing is only ever allowed while looking at the live, current season —
  // a historical season's roster is a frozen snapshot, and the save file
  // itself has long since moved past whatever state it was in back then, so
  // there'd be nothing real for an edit to write back to. Centralized here
  // rather than left to every page that can open this modal to remember.
  const viewedSeason = seasonsList.find((s) => s.id === resolvedSeasonId);
  const canEditPlayer = viewedSeason?.isCurrent === true;

  const timelineEvents = buildTimeline(statsHistory ?? [], playerId, development, careerGames, player.position);
  const latestGame = playerGamelog
    .map((entry) => ({ entry, game: schedule?.games.find((g) => g.gameId === entry.gameId) }))
    .sort((a, b) => (b.game?.week ?? 0) - (a.game?.week ?? 0))[0];
  // The hero strip is the tightest surface in the modal, so it keeps its own
  // stricter rule on top of the position filter: a zero never earns a tile here
  // even when the position is judged on it.
  const seasonTiles =
    stats?.season && stats.category
      ? (stats.category === 'offense'
          ? relevantFields(OFFENSIVE_FIELDS, player.position, [stats.season as OffensiveStatLine]).map((f) => ({
              label: f.label,
              value: f.value(stats.season as OffensiveStatLine),
            }))
          : relevantFields(DEFENSIVE_FIELDS, player.position, [stats.season as DefensiveStatLine]).map((f) => ({
              label: f.label,
              value: f.value(stats.season as DefensiveStatLine),
            }))
        ).filter((t) => t.value !== 0 && t.value !== '0' && t.value !== '0/0')
      : [];

  /**
   * Every stat line a card can be printed with: the season totals, and then each
   * game the player actually appeared in.
   *
   * THE GAMES ARE THE POINT (user direction, 2026-07-30). A season line makes a
   * card of a year; a game line makes a card of a Saturday — the four-touchdown
   * night against the rival, which is the card people actually want. The same
   * per-game tiles the "best game" panel already builds, filtered the way the
   * card's bottom band needs them: a zero never earns a slot on a card, so a
   * receiver's blank rushing line doesn't crowd out his receiving one, and a
   * game that produced nothing worth printing isn't offered at all.
   */
  const cardStatSources: CardStatSourceOption[] = [
    ...(seasonTiles.length > 0
      ? [
          {
            key: 'season',
            kind: 'season' as const,
            label: viewedSeason?.seasonYear ? `${viewedSeason.seasonYear} Season` : 'Season totals',
            seasonYear: viewedSeason?.seasonYear ?? null,
            tiles: seasonTiles.map((t) => ({ label: t.label, value: String(t.value) })),
          },
        ]
      : []),
    ...playerGamelog
      .map((entry) => ({ entry, game: schedule?.games.find((g) => g.gameId === entry.gameId) }))
      .sort((a, b) => (a.game?.week ?? 0) - (b.game?.week ?? 0))
      .map(({ entry, game }) => {
        const tiles = (
          entry.category === 'offense'
            ? offensiveGameTiles(entry.line as OffensiveGameLine, player.position)
            : defensiveGameTiles(entry.line as DefensiveGameLine, player.position)
        ).filter((t) => t.value !== 0 && t.value !== '0' && t.value !== '0/0');
        const matchup = game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : 'Game';
        return {
          key: `game:${entry.gameId}`,
          kind: 'game' as const,
          // `typeof`, not truthiness — week zero is a real week, and testing
          // the number for truth quietly drops the label on it.
          label: typeof game?.week === 'number' ? `Wk ${game.week} · ${matchup}` : matchup,
          seasonYear: viewedSeason?.seasonYear ?? null,
          tiles: tiles.map((t) => ({ label: t.label, value: String(t.value) })),
        };
      })
      .filter((source) => source.tiles.length > 0),
  ];

  /**
   * The whole career as one deterministically sorted list — see
   * playerJourneyEvents.ts for why the sort has to be total.
   */
  const journeyEvents = buildJourneyEvents({
    milestones: timelineEvents,
    // Once the aggregate has landed it is the fuller answer and wins; until then
    // this season's own awards keep Overview from claiming nothing happened.
    honorSeasons:
      honorSeasons.length > 0
        ? honorSeasons
        : buildPlayerHonorSeasons(currentSeasonAwards ? [currentSeasonAwards] : [], playerId),
    teamAwards: teamAwardWins,
  });

  const totalHonors =
    honorSeasons.reduce((sum, s) => sum + s.marqueeWins.length + s.honorTiers.length + s.weeklyHonors.length, 0) +
    teamAwardWins.length;
  const latestHonor = honorSeasons[0]
    ? (honorSeasons[0].marqueeWins[0] && formatAwardLabel(honorSeasons[0].marqueeWins[0].awardType)) ||
      (honorSeasons[0].honorTiers[0] && formatAwardLabel(honorSeasons[0].honorTiers[0].awardType)) ||
      null
    : (teamAwardWins[0]?.awardName ?? null);

  return (
    /*
      A COLUMN, NOT A STACK, so the masthead and the destination bar can hold
      still while the destination itself scrolls.

      Everything used to sit in one block inside the modal's single scroll area,
      which meant scrolling Performance far enough took the player's own name and
      the tabs off the top of the screen — you could be deep in a page with
      nothing on screen saying whose page it was, and no way back to the tabs
      without scrolling up. The identity of a profile and the way out of it are
      exactly the two things that should never leave.
    */
    <div className="flex h-full min-h-0 flex-col gap-5">
      {/* Hero — unboxed portrait over a neutral field (black base; team color stays in accents, not the ground). */}
      <div
        className="corner-cut relative overflow-hidden border border-slate-200/70 bg-slate-100/60 dark:border-white/10 dark:bg-white/[0.03]"
        data-lit={heroMedia.length > 0 ? 'true' : undefined}
      >
        {heroMedia.length > 0 && <MediaBackdrop photos={heroMedia} />}
        {/*
          TIGHTENED (Phase 2). The hero was ~390px before a single line of
          Overview appeared, most of it empty field to the right of the name —
          cinematic on arrival, tiring on the fifth player. Padding drops a step
          and the portrait uses the standard size rather than the `large`
          showcase step; the portrait is still the first thing you see, it just
          stops being the only thing.
        */}
        {/*
          TIGHTER AGAIN (user direction). Even at 282px the hero was mostly
          void: one line of name against a 240px portrait, with the OVR flung to
          the far edge and ~600px of nothing between them. The house style is
          tight and snug — bold where boldness earns it (the portrait, the OVR),
          not padding stretched to fill a container.

          Three changes: padding down a step, the portrait to 11rem, and the
          identity column no longer `flex-1`. That last one is what closes the
          horizontal gap — stretching it pushed the OVR to the far wall, so the
          number and the name it belongs to had a screen between them.
        */}
        {/*
          items-END, not items-center. The portrait is anchored to the masthead's
          floor and drawn TALLER than the row, so the subject rises to the top
          edge and the torso bleeds off the bottom — a player standing in the
          frame rather than a cut-out floating in it. Centring fought this: it
          re-split the PNG's transparent top evenly above and below, which is
          what left a gap over the head AND a hard slice through the jersey.
        */}
        {/*
          POSITIONED, so it paints ABOVE the backdrop. An absolutely positioned
          element outranks static in-flow content in the same stacking context
          however late that content appears in the DOM — which is why the
          jumbotron grid was landing on top of the name, the logo and the OVR.
          The Trophy Room's display case solves it the same way, with a
          `relative z-[1]` wrapper around everything it draws.
        */}
        <div className="relative z-[1] flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-6">
          {/*
            THE PORTRAIT IS FULL SIZE AGAIN, and the masthead ignores its bounds
            — the same trick the matchup helmets use.

            The problem was never the CSS padding, which was already symmetric.
            A portrait PNG is a 512² canvas with the subject sitting low in it,
            so a third of the top of that file is transparent. Laid out normally
            the box reserves height for that emptiness, which is what read as a
            fat gap above the head and a tight one below — and shrinking the
            portrait "fixed" the gap by making the art smaller, which was the
            wrong lever.

            So: draw it big and pull the box back in with a negative vertical
            margin, exactly as GameDetail's HelmetImg does. The overlap region is
            only the PNG's own transparent padding, so nothing is clipped and
            nothing collides — the hero's height now reflects the visible art
            instead of the canvas it was exported on, and the padding above the
            head matches the padding below it because it IS the container's
            padding rather than the file's.
          */}
          {/*
            THE BLEED LIVES ON THIS WRAPPER, not on the portrait.

            `PlayerPortrait`'s `className` is applied to the portrait <img>, and
            the team jersey is a second <img> positioned `absolute inset-0`
            against the wrapper span the two share. So a negative margin passed
            through `className` shortened the span while the portrait kept its
            own height — and the jersey, sized to the span, came up 40px short of
            the body it is meant to register against. That is the misalignment.

            Anything that changes LAYOUT belongs out here; `className` is for the
            portrait image itself.
          */}
          <div className="-mb-10 flex shrink-0 justify-center self-end sm:justify-start">
            <PlayerPortrait
              player={player}
              large
              largeMaxHeight="max-h-[17rem]"
              teamAssetName={heroTeamName}
            />
          </div>
          <div className="min-w-0 self-center">
            <div className="flex items-center gap-3">
              {/* The number is part of the NAME LINE now, not a chip beside it:
                  same display face, bigger, white, no fill. A filled badge was
                  competing with the name for the same glance, and over a
                  photograph it would read as a sticker. */}
              <span
                className={`font-display text-3xl font-bold leading-none ${
                  heroMedia.length > 0 ? 'text-white' : 'text-slate-950 dark:text-white'
                }`}
              >
                {player.jerseyNumber}
              </span>
              {heroTeamName && (
                <span className="flex items-center gap-2">
                  <TeamLogo team={{ assetName: heroTeamName, label: heroTeamName }} size="sm" />
                  <span className="type-eyebrow text-slate-500 dark:text-slate-400">{heroTeamName}</span>
                </span>
              )}
              {/* A FLEX ROW rather than a text run with an icon dropped into it.
                  Mixing an inline-flex badge into flowing text leaves the whole
                  group sitting on a baseline the icon has moved, which is what
                  threw this line out of line with the jersey number and the
                  season chip beside it. */}
              <span className="type-eyebrow inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <span>{player.position}</span>
                <span aria-hidden="true">·</span>
                <ClassBadge schoolYear={player.schoolYear} redshirtStatus={player.redshirtStatus} />
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
            {/*
              The archetype / development / height / weight line used to live
              here AND in Overview's Player Profile module. One owner per field
              (brief): the hero keeps number, team, position, class, name and
              overall — the six things that identify him — and Player Profile
              owns the supporting bio.
            */}
          </div>
          {/* The Hall control sits between the identity and the OVR, and draws
              nothing at all unless this coach actually coached him — see
              HallAction for why absent beats greyed out. */}
          <div className="shrink-0 self-center sm:ml-auto">
            <HallAction dynastyId={dynastyId} playerId={playerId} />
          </div>
          {/* Far right (user direction, reverted from the snug placement): the
              OVR anchors the opposite end of the bar, which is how it read
              before and how a scoreboard reads. */}
          <div className="shrink-0 self-center text-center sm:pr-4">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Overall</p>
            <p className="type-stat-xl mt-1 text-slate-950 dark:text-white">{player.overallRating}</p>
          </div>
        </div>
      </div>

      {/*
        The glider's rail replaces the divider this row used to draw with a
        `border-b`: same line, but now it's the thing the lit segment slides
        along. `w-full` keeps it spanning the panel like the old divider did.
        The wrap rule stays even at five destinations — the glider measures the
        active item's own row rather than assuming a single line, so a narrow
        modal that pushes Cards onto a second row still lights it correctly.
      */}
      <GliderNav
        activeIndex={PROFILE_TABS.findIndex((t) => t.key === tab)}
        className="w-full shrink-0"
        ariaLabel="Player profile sections"
        itemsClassName="flex-wrap gap-1.5"
      >
        {PROFILE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            // The lit segment is the only thing that said which destination was
            // active, which is a visual-only answer — nothing a screen reader
            // could read, and nothing a test could assert on.
            aria-current={tab === t.key}
            className={gliderItemClass(tab === t.key, 'px-4 py-2')}
          >
            {t.label}
          </button>
        ))}
      </GliderNav>

      {/* THE ONLY SCROLLER. -mr/pr so the scrollbar sits in the panel padding
          rather than cutting into the content. */}
      <div key={tab} className="-mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
        {tab === 'overview' && (
          <PlayerOverview
            player={player}
            dynastyId={dynastyId}
            playerId={playerId}
            ratingsAvailable={canEditPlayer}
            seasonTiles={seasonTiles.map((t) => ({ label: t.label, value: String(t.value) }))}
            development={development}
            latestGameLabel={
              latestGame?.game
                ? `${latestGame.game.isHome ? 'vs' : '@'} ${latestGame.game.opponent}${
                    latestGame.game.result ? ` ${latestGame.game.result} ${latestGame.game.teamScore}-${latestGame.game.opponentScore}` : ''
                  }`
                : null
            }
            latestGameSupport={latestGame ? gameLogSummary(latestGame.entry) : null}
            latestEvent={
              // Skip the plain season marker: it's the newest entry every year
              // and says nothing that the hero doesn't already. The first real
              // event — an award, a milestone, a transfer — is the answer.
              journeyEvents.find((e) => e.title !== 'Season') ?? journeyEvents[0] ?? null
            }
            totalHonors={totalHonors}
            latestHonor={latestHonor}
            onGoToPerformance={goToPerformance}
            onGoToJourney={goToJourney}
            onGoToShowcase={() => {
              setShowcaseMode('media');
              setTab('showcase');
            }}
            onGoToRatings={() => setTab('ratings')}
          />
        )}

        {/* PERFORMANCE — the old Stats, Career and Game Log, which were three
            tabs answering one question. The mode switch is the answer's axis
            (now / all-time / game by game), not three separate places to go. */}
        {tab === 'performance' && (
          <>
            <ModeNav
              value={performanceMode}
              onChange={setPerformanceMode}
              options={PERFORMANCE_MODES}
              ariaLabel="Performance view"
            />
            {/* Ordered by how quickly each answers "how is he playing": the
                headline numbers, then the trend, then the evidence. */}
            {performanceMode === 'season' && (
              <>
                {seasonTiles.length > 0 && (
                  <SurfaceCard>
                    <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                      {viewedSeason?.seasonYear ?? 'Season'} headline
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
                      {seasonTiles.map((t) => (
                        <div key={t.label} className="min-w-0">
                          <p className="type-stat-sm text-slate-950 dark:text-white">{String(t.value)}</p>
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{t.label}</p>
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>
                )}
                <RecentForm entries={playerGamelog} schedule={schedule ?? null} />
                <StatLineSection
                  title="Full season line"
                  category={stats?.category}
                  position={player.position}
                  line={stats?.season}
                  emptyMessage="No season stats yet. These appear once games have been played and re-imported."
                />
                <GameLogSection
                  entries={playerGamelog}
                  schedule={schedule ?? null}
                  onOpenGame={(gameId) => openGameModal(dynastyId, gameId, resolvedSeasonId)}
                />
              </>
            )}
            {performanceMode === 'career' && (
              <>
                <StatLineSection
                  title="Career totals"
                  category={stats?.category}
                  position={player.position}
                  line={stats?.career}
                  emptyMessage="No career stats yet. These appear once games have been played and re-imported."
                />
                <ImportedSeasonHistorySection
                  seasons={seasonBreakdown}
                  teamByYear={teamByYear}
                  position={player.position}
                />
              </>
            )}
            {performanceMode === 'games' && (
              <>
                {/* Best Game needs something to be best OF — with one game
                    played it's just the game, dressed up as a superlative. */}
                {playerGamelog.length > 1 && (
                  <BestGameSection entries={playerGamelog} schedule={schedule ?? null} position={player.position} />
                )}
                <GameLogSection
                  entries={playerGamelog}
                  schedule={schedule ?? null}
                  onOpenGame={(gameId) => openGameModal(dynastyId, gameId, resolvedSeasonId)}
                />
              </>
            )}
          </>
        )}

        {/* RATINGS — Attributes, renamed for what the user is actually doing
            with it: judging how good he is. */}
        {tab === 'ratings' && (
          <RatingsTab
            dynastyId={dynastyId}
            playerId={playerId}
            isCurrentSeason={canEditPlayer}
            position={player.position}
            ovrChange={
              development.length > 1
                ? development[development.length - 1].overallRating - development[0].overallRating
                : null
            }
            ovrSince={development.length > 1 ? development[0].seasonYear : null}
          />
        )}

        {/* JOURNEY — History, Awards, Media and Notes as one career narrative
            with filters, instead of four tabs that each answered "what has
            happened to him" from a different corner. */}
        {tab === 'journey' && (
          <>
            <ModeNav value={journeyMode} onChange={setJourneyMode} options={JOURNEY_MODES} ariaLabel="Journey view" />
            {/* ONE list, not four stacked sections. Milestones and honors are
                both career events with a season and sometimes a week, so they
                interleave into a single deterministic timeline — a 2026 award
                sits between the 2026 games that earned it, which is the whole
                point of calling this Journey. */}
            {(journeyMode === 'all' || journeyMode === 'milestones' || journeyMode === 'honors') && (
              <JourneyTimeline
                events={journeyEvents.filter((e) =>
                  journeyMode === 'all' ? true : journeyMode === 'milestones' ? e.kind === 'milestone' : e.kind === 'honor',
                )}
                mode={journeyMode}
              />
            )}
            {/* Notes keeps its own component — it owns its fetch and its
                editing, and duplicating note behaviour to fit a timeline row
                would be the wrong trade. Media moved to Showcase. */}
            {journeyMode === 'notes' && <PlayerNotesTab dynastyId={dynastyId} playerId={playerId} />}
          </>
        )}

        {/* SHOWCASE — everything the user MADE of this player. Two halves, so
            the app's two-state ToggleSwitch rather than a segmented control:
            a switch is for a pair, a segmented control is for a set. */}
        {tab === 'showcase' && (
          <>
            <ToggleSwitch
              value={showcaseMode}
              onChange={setShowcaseMode}
              left={{ value: 'cards', label: 'Cards' }}
              right={{ value: 'media', label: 'Media' }}
              knob={
                heroTeamName ? (
                  // 35px, the same as PairLayout's Roster/Transfers switch — the
                  // knob is DELIBERATELY taller than its 24px track so it
                  // overhangs, and shrinking it to 16px made this read as a
                  // different, smaller control than the one one layer up.
                  <TeamLogo
                    team={{ assetName: heroTeamName, label: heroTeamName }}
                    size="sm"
                    variant="gold"
                    className="h-[35px] w-[35px]"
                  />
                ) : undefined
              }
              ariaLabel="Switch between cards and media"
            />
            {/*
              A FLOOR, not a fixed height. Cards is a grid of ~360px tiles and
              Media's empty state is three lines, so flipping the switch collapsed
              the modal by a few hundred pixels and threw the switch itself up the
              screen — the control moved out from under the cursor that had just
              used it. A min-height holds the shorter side up; the taller side
              still grows past it.
            */}
            <div className="min-h-[26rem]">
            {showcaseMode === 'cards' ? (
              <PlayerCardTab
                player={player}
                teamName={heroTeamName}
                seasonYear={viewedSeason?.seasonYear ?? null}
                statSources={cardStatSources}
                playerName={`${player.firstName} ${player.lastName}`}
                dynastyId={dynastyId}
              />
            ) : (
              <PlayerMediaTab dynastyId={dynastyId} playerId={playerId} />
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
