import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Select } from '../components/ui/Select';
import { PageMasthead } from '../components/common/PageMasthead';
import { StatTile } from '../components/ui/StatTile';
import {
  StatisticsCategorySection,
  LeaderCard,
  type StatMode,
} from '../components/common/StatisticsCategorySection';
import {
  pct,
  pctFormat,
  oneDecimal,
  PASSING_COLUMNS,
  RUSHING_COLUMNS,
  RECEIVING_COLUMNS,
  DEFENSE_COLUMNS,
  KICKING_COLUMNS,
  PUNTING_COLUMNS,
} from '../lib/statColumns';
import { PlayerComparison, type ComparablePlayer } from '../components/common/PlayerComparison';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import {
  filterTeamGames,
  aggregateTeamGames,
  opponentOptions,
  availableGameTypes,
  ratioPct,
  perGame as perGameAvg,
  turnoverMargin,
  type TeamGameTypeFilter,
  type TeamAggregate,
} from '../lib/teamStats';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { gameImpactScore } from '../../shared/gameImpactScore';
import type {
  DefensiveGameLine,
  DefensiveStatLine,
  GameLogEntry,
  KickingStatLine,
  OffensiveGameLine,
  OffensiveStatLine,
  PlayerKickingStats,
  PlayerStats,
  RosterPlayer,
  ScheduleOverview,
  SeasonOverview,
  TeamStats,
  TeamGameStat,
} from '../../shared/types';

interface PlayerRow {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  offense: OffensiveStatLine | null;
  defense: DefensiveStatLine | null;
}

function buildPlayerRows(roster: RosterPlayer[], stats: PlayerStats[]): PlayerRow[] {
  const statsByPlayer = new Map(stats.map((s) => [s.playerId, s]));
  return roster.map((player) => {
    const stat = statsByPlayer.get(player.id);
    const offense = stat?.category === 'offense' ? (stat.season as OffensiveStatLine | null) : null;
    const defense = stat?.category === 'defense' ? (stat.season as DefensiveStatLine | null) : null;
    return {
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      schoolYear: player.schoolYear,
      portraitAssetName: player.portraitAssetName,
      offense,
      defense,
    };
  });
}

interface PlayerKickingRow {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  kicking: KickingStatLine | null;
}

function buildKickingRows(roster: RosterPlayer[], kickingStats: PlayerKickingStats[]): PlayerKickingRow[] {
  const statsByPlayer = new Map(kickingStats.map((s) => [s.playerId, s]));
  return roster.map((player) => ({
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    schoolYear: player.schoolYear,
    portraitAssetName: player.portraitAssetName,
    kicking: statsByPlayer.get(player.id)?.season ?? null,
  }));
}

/** A return specialist can be either an offense- or defense-category player (return duty is orthogonal to side of ball) — this normalizes both into one shape so a single leader-card grid can cover the whole roster. */
interface ReturnCandidate {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTDs: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTDs: number;
}

function buildReturnCandidates(rows: PlayerRow[]): ReturnCandidate[] {
  return rows
    .map((row) => {
      const line = row.offense ?? row.defense;
      if (!line) return null;
      return {
        playerId: row.playerId,
        firstName: row.firstName,
        lastName: row.lastName,
        position: row.position,
        jerseyNumber: row.jerseyNumber,
        schoolYear: row.schoolYear,
        portraitAssetName: row.portraitAssetName,
        kickReturns: line.kickReturns,
        kickReturnYards: line.kickReturnYards,
        kickReturnTDs: line.kickReturnTDs,
        puntReturns: line.puntReturns,
        puntReturnYards: line.puntReturnYards,
        puntReturnTDs: line.puntReturnTDs,
      };
    })
    .filter((row): row is ReturnCandidate => row !== null && (row.kickReturns > 0 || row.puntReturns > 0));
}

function ReturnsLeadersSection({
  dynastyId,
  seasonId,
  candidates,
}: {
  dynastyId: string;
  seasonId?: number;
  candidates: ReturnCandidate[];
}) {
  // Kick and punt return duty don't always overlap on the same roster (a team
  // can have a kick returner with zero punt returns, or vice versa) — every
  // metric here needs onlyIfPositive, not just the TD ones, otherwise a
  // "leader" card would show a false 0-yard leader for whichever return type
  // nobody on the team actually does.
  const metrics: { label: string; value: (c: ReturnCandidate) => number; onlyIfPositive: boolean }[] = [
    { label: 'Kick Return Yards', value: (c) => c.kickReturnYards, onlyIfPositive: true },
    { label: 'Kick Return Touchdowns', value: (c) => c.kickReturnTDs, onlyIfPositive: true },
    { label: 'Punt Return Yards', value: (c) => c.puntReturnYards, onlyIfPositive: true },
    { label: 'Punt Return Touchdowns', value: (c) => c.puntReturnTDs, onlyIfPositive: true },
  ];

  const cards = metrics
    .map((metric) => {
      if (candidates.length === 0) return null;
      const max = Math.max(...candidates.map(metric.value));
      if (metric.onlyIfPositive && max <= 0) return null;
      const tied = candidates.filter((c) => metric.value(c) === max);
      return { metric, leader: tied[0], tiedCount: tied.length - 1, value: max };
    })
    .filter((entry): entry is { metric: (typeof metrics)[number]; leader: ReturnCandidate; tiedCount: number; value: number } => entry !== null);

  if (candidates.length === 0) return null;

  return (
    <SurfaceCard>
      <CollapsibleSection
        title="Returns"
        eyebrow
        defaultOpen={false}
        right={
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {candidates.length} {candidates.length === 1 ? 'player' : 'players'}
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ metric, leader, tiedCount, value }) => (
            <LeaderCard
              key={metric.label}
              dynastyId={dynastyId}
              seasonId={seasonId}
              label={metric.label}
              row={leader}
              value={value.toLocaleString()}
              tiedCount={tiedCount}
            />
          ))}
        </div>
      </CollapsibleSection>
    </SurfaceCard>
  );
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function Statistics() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [teamStats, setTeamStats] = useState<TeamStats | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [playerStats, setPlayerStats] = useState<PlayerStats[] | null | undefined>(undefined);
  const [kickingStats, setKickingStats] = useState<PlayerKickingStats[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [gamelog, setGamelog] = useState<GameLogEntry[] | null | undefined>(undefined);
  const [teamGameStats, setTeamGameStats] = useState<TeamGameStat[] | null | undefined>(undefined);
  const [mode, setMode] = useState<StatMode>('season');
  /** Which half of the page is showing — the team-focused or player-focused stats. */
  const [view, setView] = useState<'team' | 'player'>('team');
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();
  const viewedTeamName =
    viewedTeamIndex === null ? null : (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? null);
  // Shared filters — drive BOTH team and player stats off one filtered game set.
  const [gameType, setGameType] = useState<TeamGameTypeFilter>('all');
  const [opponentFilter, setOpponentFilter] = useState<string>('all');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    if (viewedTeamIndex !== null) {
      // League mode: another team's players from the per-season league
      // snapshot. Season-cumulative TeamStats / kicking / gamelog / schedule
      // aren't tracked for non-user teams (those get honest empty states or a
      // "—"), but per-game team stats ARE — the schedule snapshot is
      // league-wide, so getTeamGameStats reconstructs any team's Team Stats
      // view (season-only rows like red-zone % fall back to "—").
      setTeamStats(null);
      setKickingStats([]);
      setSchedule(null);
      setGamelog([]);
      window.api.db.getTeamGameStats(id, viewedTeamIndex, seasonId).then((result) => {
        if (!cancelled) setTeamGameStats(result);
      });
      window.api.db.getLeagueTeamRoster(id, viewedTeamIndex, seasonId).then((result) => {
        if (cancelled) return;
        setRoster(result?.players ?? null);
        setPlayerStats(
          result
            ? result.players
                .filter((p) => p.seasonStat !== null)
                .map((p) => ({
                  playerId: p.id,
                  category: p.seasonStat!.category,
                  career: null,
                  season: p.seasonStat!.season,
                }))
            : null,
        );
      });
      return () => {
        cancelled = true;
      };
    }
    window.api.db.getTeamStats(id, seasonId).then((result) => {
      if (!cancelled) setTeamStats(result);
    });
    window.api.db.getRoster(id, seasonId).then((result) => {
      if (!cancelled) setRoster(result);
    });
    window.api.db.getPlayerStats(id, seasonId).then((result) => {
      if (!cancelled) setPlayerStats(result);
    });
    window.api.db.getKickingStats(id, seasonId).then((result) => {
      if (!cancelled) setKickingStats(result);
    });
    window.api.db.getSchedule(id, seasonId).then((result) => {
      if (!cancelled) setSchedule(result);
    });
    window.api.db.getGameLog(id, seasonId).then((result) => {
      if (!cancelled) setGamelog(result);
    });
    window.api.db.getTeamGameStats(id, viewedTeamIndex, seasonId).then((result) => {
      if (!cancelled) setTeamGameStats(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId, viewedTeamIndex]);

  const allRows = useMemo(() => {
    if (!roster || !playerStats) return [];
    return buildPlayerRows(roster, playerStats);
  }, [roster, playerStats]);

  const passingRows = useMemo(
    () =>
      allRows
        .filter((row): row is PlayerRow & { offense: OffensiveStatLine } => !!row.offense && row.offense.passAttempts > 0)
        .map((row) => ({ ...row, line: row.offense })),
    [allRows],
  );
  const rushingRows = useMemo(
    () =>
      allRows
        .filter((row): row is PlayerRow & { offense: OffensiveStatLine } => !!row.offense && row.offense.rushAttempts > 0)
        .map((row) => ({ ...row, line: row.offense })),
    [allRows],
  );
  const receivingRows = useMemo(
    () =>
      allRows
        .filter((row): row is PlayerRow & { offense: OffensiveStatLine } => !!row.offense && row.offense.receptions > 0)
        .map((row) => ({ ...row, line: row.offense })),
    [allRows],
  );
  const defenseRows = useMemo(
    () =>
      allRows
        .filter((row): row is PlayerRow & { defense: DefensiveStatLine } => !!row.defense)
        .map((row) => ({ ...row, line: row.defense })),
    [allRows],
  );

  const allKickingRows = useMemo(() => {
    if (!roster || !kickingStats) return [];
    return buildKickingRows(roster, kickingStats);
  }, [roster, kickingStats]);

  const kickingRows = useMemo(
    () =>
      allKickingRows
        .filter((row): row is PlayerKickingRow & { kicking: KickingStatLine } => !!row.kicking && row.kicking.fgAttempts > 0)
        .map((row) => ({ ...row, line: row.kicking })),
    [allKickingRows],
  );
  const puntingRows = useMemo(
    () =>
      allKickingRows
        .filter((row): row is PlayerKickingRow & { kicking: KickingStatLine } => !!row.kicking && row.kicking.puntAttempts > 0)
        .map((row) => ({ ...row, line: row.kicking })),
    [allKickingRows],
  );

  const returnCandidates = useMemo(() => buildReturnCandidates(allRows), [allRows]);

  /**
   * Splits (Phase 4). When a game filter is active, the four gamelog-backed
   * categories (Passing/Rushing/Receiving/Defense) are re-aggregated from
   * per-game lines over just the matching played games — the per-game lines
   * carry everything the season columns read (including longs and INT TDs),
   * so the same column sets render unchanged. Kicking/Punting/Returns have
   * no per-game data in the save (confirmed — no KickingGameLine exists), so
   * those sections show an honest note instead of fake filtered numbers.
   * "Postseason" = the save's own bowl game type, which includes CFP rounds
   * and the national championship (see ScheduleGame.gameType docs).
   */
  // The single filtered game set (Phase 1 lib) — the source of truth both the
  // team aggregates and the player gamelog sections derive from.
  const splitActive = gameType !== 'all' || opponentFilter !== 'all';
  const filteredGames = useMemo(
    () => (teamGameStats ? filterTeamGames(teamGameStats, { gameType, opponent: opponentFilter }) : []),
    [teamGameStats, gameType, opponentFilter],
  );
  const filteredGameIds = useMemo(
    () => (splitActive && teamGameStats ? new Set(filteredGames.map((g) => g.gameId)) : null),
    [splitActive, teamGameStats, filteredGames],
  );

  const splitLines = useMemo(() => {
    if (!filteredGameIds || !gamelog) return null;
    const offense = new Map<number, OffensiveStatLine>();
    const defense = new Map<number, DefensiveStatLine>();
    for (const entry of gamelog) {
      if (!filteredGameIds.has(entry.gameId)) continue;
      if (entry.category === 'offense') {
        const line = entry.line as OffensiveGameLine;
        const acc =
          offense.get(entry.playerId) ??
          ({
            gamesPlayed: 0, gamesStarted: 0, passAttempts: 0, passCompletions: 0, passYards: 0, passTDs: 0,
            passInts: 0, passLongest: 0, rushAttempts: 0, rushYards: 0, rushTDs: 0, rushLongest: 0,
            fumbles: 0, receptions: 0, receivingYards: 0, receivingTDs: 0, receivingLongest: 0,
          } as OffensiveStatLine);
        acc.gamesPlayed += 1;
        acc.gamesStarted += line.started ? 1 : 0;
        acc.passAttempts += line.passAttempts;
        acc.passCompletions += line.passCompletions;
        acc.passYards += line.passYards;
        acc.passTDs += line.passTDs;
        acc.passInts += line.passInts;
        acc.passLongest = Math.max(acc.passLongest, line.passLongest);
        acc.rushAttempts += line.rushAttempts;
        acc.rushYards += line.rushYards;
        acc.rushTDs += line.rushTDs;
        acc.rushLongest = Math.max(acc.rushLongest, line.rushLongest);
        acc.receptions += line.receptions;
        acc.receivingYards += line.receivingYards;
        acc.receivingTDs += line.receivingTDs;
        acc.receivingLongest = Math.max(acc.receivingLongest, line.receivingLongest);
        offense.set(entry.playerId, acc);
      } else {
        const line = entry.line as DefensiveGameLine;
        const acc =
          defense.get(entry.playerId) ??
          ({
            gamesPlayed: 0, gamesStarted: 0, tackles: 0, assistedTackles: 0, tacklesForLoss: 0, sacks: 0,
            interceptions: 0, interceptionReturnYards: 0, interceptionTDs: 0, forcedFumbles: 0,
            fumbleRecoveries: 0, passDeflections: 0, kickReturns: 0, kickReturnYards: 0, kickReturnTDs: 0,
            kickReturnLongest: 0, puntReturns: 0, puntReturnYards: 0, puntReturnTDs: 0, puntReturnLongest: 0,
          } as DefensiveStatLine);
        acc.gamesPlayed += 1;
        acc.gamesStarted += line.started ? 1 : 0;
        acc.tackles += line.tackles;
        acc.assistedTackles += line.assistedTackles;
        acc.tacklesForLoss += line.tacklesForLoss;
        acc.sacks += line.sacks;
        acc.interceptions += line.interceptions;
        acc.interceptionReturnYards += line.interceptionReturnYards;
        acc.interceptionTDs += line.interceptionTDs;
        acc.forcedFumbles += line.forcedFumbles;
        acc.fumbleRecoveries += line.fumbleRecoveries;
        acc.passDeflections += line.passDeflections;
        defense.set(entry.playerId, acc);
      }
    }
    return { offense, defense };
  }, [filteredGameIds, gamelog]);

  /** Category rows under an active split — same identity shape as the season rows, lines re-aggregated. */
  const effectiveRows = useMemo(() => {
    if (!splitLines) {
      return { passing: passingRows, rushing: rushingRows, receiving: receivingRows, defense: defenseRows };
    }
    const identity = new Map(allRows.map((r) => [r.playerId, r]));
    const offenseRows = [...splitLines.offense.entries()]
      .map(([playerId, line]) => {
        const player = identity.get(playerId);
        return player ? { ...player, line } : null;
      })
      .filter((r): r is (typeof allRows)[number] & { line: OffensiveStatLine } => r !== null);
    const defRows = [...splitLines.defense.entries()]
      .map(([playerId, line]) => {
        const player = identity.get(playerId);
        return player ? { ...player, line } : null;
      })
      .filter((r): r is (typeof allRows)[number] & { line: DefensiveStatLine } => r !== null);
    return {
      passing: offenseRows.filter((r) => r.line.passAttempts > 0),
      rushing: offenseRows.filter((r) => r.line.rushAttempts > 0),
      receiving: offenseRows.filter((r) => r.line.receptions > 0),
      defense: defRows,
    };
  }, [splitLines, allRows, passingRows, rushingRows, receivingRows, defenseRows]);

  const opponents = useMemo(() => opponentOptions(teamGameStats ?? []), [teamGameStats]);
  const gameTypeOptions = useMemo(() => availableGameTypes(teamGameStats ?? []), [teamGameStats]);

  const [compareOpen, setCompareOpen] = useState(false);
  // Everyone with any recorded stat line this season — offense/defense from
  // the player-stats rows, kicking joined in by playerId.
  const comparablePlayers = useMemo<ComparablePlayer[]>(() => {
    const kickingById = new Map(allKickingRows.map((row) => [row.playerId, row.kicking]));
    return allRows
      .map((row) => ({
        playerId: row.playerId,
        firstName: row.firstName,
        lastName: row.lastName,
        position: row.position,
        jerseyNumber: row.jerseyNumber,
        schoolYear: row.schoolYear,
        portraitAssetName: row.portraitAssetName,
        offense: row.offense ?? null,
        defense: row.defense ?? null,
        kicking: kickingById.get(row.playerId) ?? null,
      }))
      .filter((p) => p.offense || p.defense || p.kicking);
  }, [allRows, allKickingRows]);

  if (overview === undefined || teamStats === undefined || roster === undefined || playerStats === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Statistics...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!id) return null;

  // The Team Stats view derives EVERYTHING from the per-game aggregate over the
  // currently-filtered game set (filteredGames) — so game-type / opponent filters
  // actually drive the numbers, and Season-Total vs Per-Game is a pure render choice
  // over the same totals. Summing per-game team+opponent stat lines exactly reproduces
  // the season TeamStats (verified in Phase 0), so nothing is lost versus the old
  // TeamStats-only path; what's gained is filterability + honest 3rd-down-allowed.
  const teamAggregate = aggregateTeamGames(filteredGames);

  return (
    <div className="space-y-6">
      <PageMasthead
        eyebrow="Statistics"
        title={viewedTeamName ?? overview.teamName}
        subtitle={`Season ${overview.seasonYear} — last synced ${new Date(overview.lastSyncedAt).toLocaleDateString()}`}
        mark={{ kind: 'helmet', teamAssetName: viewedTeamName ?? overview.teamName }}
      />

      {/* Sticky controls — mode switcher + shared filters that drive both views.
          Restrained treatment (§4): fine border, subtle depth, no floating panel. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border border-slate-200/70 bg-white/90 px-4 py-3 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-white/10 dark:bg-[#0d0d10]/90">
        <SegmentedControl<'team' | 'player'>
          value={view}
          onChange={setView}
          ariaLabel="Statistics mode"
          options={[
            { value: 'team', label: 'Team Stats' },
            { value: 'player', label: 'Player Stats' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={gameType}
            onChange={setGameType}
            ariaLabel="Game type"
            options={gameTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Select
            value={opponentFilter}
            onChange={setOpponentFilter}
            ariaLabel="Opponent filter"
            options={[
              { value: 'all', label: 'All Opponents' },
              ...opponents.map((opp) => ({ value: opp, label: `vs ${opp}` })),
            ]}
          />
          <SegmentedControl<StatMode>
            value={mode}
            onChange={setMode}
            ariaLabel="Totals or per game"
            size="sm"
            options={[
              { value: 'season', label: 'Season Total' },
              { value: 'per-game', label: 'Per Game' },
            ]}
          />
        </div>
      </div>

      {view === 'team' ? (
        /* ===== TEAM STATS VIEW ===== */
        <TeamStatsView
          agg={teamAggregate}
          teamStats={teamStats ?? null}
          mode={mode}
          splitActive={splitActive}
        />
      ) : (
        /* ===== PLAYER STATS VIEW ===== */
        <>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setCompareOpen(true)} disabled={comparablePlayers.length < 2}>
          Compare Players
        </Button>
      </div>
      <HotPlayersSection gamelog={gamelog ?? []} schedule={schedule} players={allRows} teamAssetName={viewedTeamName ?? overview.teamName} />
      <MilestonesSection players={allRows} />

      {/* Player Statistics */}
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Passing"
        rows={effectiveRows.passing}
        columnDefs={PASSING_COLUMNS}
        mode={mode}
        collapsible
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="passYards"
        leaders={[
          { label: 'Passing Yards', value: (l) => l.passYards, format: (v) => v.toLocaleString() },
          { label: 'Passing Touchdowns', value: (l) => l.passTDs, format: (v) => v.toLocaleString() },
          {
            label: 'Completion %',
            value: (l) => (l.passAttempts > 0 ? (100 * l.passCompletions) / l.passAttempts : 0),
            format: pctFormat,
            qualifies: (l) => l.passAttempts >= 100,
            qualifierLabel: 'min 100 att',
          },
        ]}
        emptyStateMessage="No passing statistics have been recorded for this season."
      />
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Rushing"
        rows={effectiveRows.rushing}
        columnDefs={RUSHING_COLUMNS}
        mode={mode}
        collapsible
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="rushYards"
        leaders={[
          { label: 'Rushing Yards', value: (l) => l.rushYards, format: (v) => v.toLocaleString() },
          { label: 'Rushing Touchdowns', value: (l) => l.rushTDs, format: (v) => v.toLocaleString() },
          {
            label: 'Yards per Carry',
            value: (l) => (l.rushAttempts > 0 ? l.rushYards / l.rushAttempts : 0),
            format: oneDecimal,
            qualifies: (l) => l.rushAttempts >= 40,
            qualifierLabel: 'min 40 att',
          },
        ]}
        emptyStateMessage="No rushing statistics have been recorded for this season."
      />
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Receiving"
        rows={effectiveRows.receiving}
        columnDefs={RECEIVING_COLUMNS}
        mode={mode}
        collapsible
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="receivingYards"
        leaders={[
          { label: 'Receptions', value: (l) => l.receptions, format: (v) => v.toLocaleString() },
          { label: 'Receiving Yards', value: (l) => l.receivingYards, format: (v) => v.toLocaleString() },
          { label: 'Receiving Touchdowns', value: (l) => l.receivingTDs, format: (v) => v.toLocaleString() },
          {
            label: 'Yards per Catch',
            value: (l) => (l.receptions > 0 ? l.receivingYards / l.receptions : 0),
            format: oneDecimal,
            qualifies: (l) => l.receptions >= 20,
            qualifierLabel: 'min 20 rec',
          },
        ]}
        emptyStateMessage="No receiving statistics have been recorded for this season."
      />
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Defense"
        rows={effectiveRows.defense}
        columnDefs={DEFENSE_COLUMNS}
        mode={mode}
        collapsible
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="tackles"
        leaders={[
          { label: 'Tackles', value: (l) => l.tackles, format: (v) => v.toLocaleString() },
          { label: 'Sacks', value: (l) => l.sacks, format: oneDecimal },
          { label: 'Interceptions', value: (l) => l.interceptions, format: (v) => v.toLocaleString() },
          { label: 'Defensive Touchdowns', value: (l) => l.interceptionTDs, format: (v) => v.toLocaleString(), onlyIfPositive: true },
        ]}
        emptyStateMessage="No defensive statistics have been recorded for this season."
      />
      {splitActive ? (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
          Kicking, Punting, and Returns can&apos;t be filtered by game — the save records those stats as season
          totals only, with no per-game breakdown. Clear the game filters to see them.
        </SurfaceCard>
      ) : (
        <>
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Kicking"
        rows={kickingRows}
        columnDefs={KICKING_COLUMNS}
        mode={mode}
        collapsible
        defaultOpen={false}
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="fgMade"
        leaders={[
          { label: 'Field Goals Made', value: (l) => l.fgMade, format: (v) => v.toLocaleString() },
          { label: 'Field Goal Long', value: (l) => l.fgLongest, format: (v) => `${v} yd` },
        ]}
        emptyStateMessage="No kicking statistics have been recorded for this season."
      />
      <StatisticsCategorySection
        dynastyId={id}
        seasonId={seasonId}
        title="Punting"
        rows={puntingRows}
        columnDefs={PUNTING_COLUMNS}
        mode={mode}
        collapsible
        defaultOpen={false}
        teamAssetName={viewedTeamName ?? overview.teamName}
        defaultSortKey="puntYards"
        leaders={[
          { label: 'Punting Yards', value: (l) => l.puntYards, format: (v) => v.toLocaleString() },
          {
            label: 'Punting Average',
            value: (l) => (l.puntAttempts > 0 ? l.puntYards / l.puntAttempts : 0),
            format: oneDecimal,
          },
        ]}
        emptyStateMessage="No punting statistics have been recorded for this season."
      />
      <ReturnsLeadersSection dynastyId={id} seasonId={seasonId} candidates={returnCandidates} />
        </>
      )}

        </>
      )}

      {compareOpen && <PlayerComparison players={comparablePlayers} onClose={() => setCompareOpen(false)} />}
    </div>
  );
}

/**
 * Hot Players (Phase 4) — who's producing RIGHT NOW: total game-impact
 * (shared/gameImpactScore.ts, the same score behind Top Performer and
 * Single-Game Performance of the Year) summed over the team's last three
 * played games, top five shown with their per-game trend. Hidden until at
 * least two games have been played — one game is a headline, not a trend.
 */
function HotPlayersSection({
  gamelog,
  schedule,
  players,
  teamAssetName,
}: {
  gamelog: GameLogEntry[];
  schedule: ScheduleOverview | null | undefined;
  players: PlayerRow[];
  teamAssetName?: string | null;
}) {
  const { openPlayerModal } = usePlayerModal();
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();

  const hot = useMemo(() => {
    const played = (schedule?.games ?? []).filter((g) => g.result !== null).sort((a, b) => b.week - a.week);
    const recent = played.slice(0, 3);
    if (recent.length < 2 || gamelog.length === 0) return null;
    const recentIds = recent.map((g) => g.gameId);
    const byPlayer = new Map<number, { total: number; perGame: Map<number, number> }>();
    for (const entry of gamelog) {
      if (!recentIds.includes(entry.gameId)) continue;
      const score = gameImpactScore(entry);
      if (score <= 0) continue;
      const acc = byPlayer.get(entry.playerId) ?? { total: 0, perGame: new Map<number, number>() };
      acc.total += score;
      acc.perGame.set(entry.gameId, score);
      byPlayer.set(entry.playerId, acc);
    }
    const identity = new Map(players.map((p) => [p.playerId, p]));
    const ranked = [...byPlayer.entries()]
      .map(([playerId, acc]) => ({ player: identity.get(playerId), acc }))
      .filter((e): e is { player: PlayerRow; acc: { total: number; perGame: Map<number, number> } } => !!e.player)
      .sort((a, b) => b.acc.total - a.acc.total)
      .slice(0, 5);
    return ranked.length > 0 ? { recent, ranked } : null;
  }, [gamelog, schedule, players]);

  if (!hot || !id) return null;

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">Hot Players — last {hot.recent.length} games</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {hot.ranked.map(({ player, acc }) => (
          <button
            key={player.playerId}
            type="button"
            onClick={() => openPlayerModal(id, player.playerId, seasonId)}
            className="corner-cut-sm flex flex-col items-center gap-2 border border-slate-200/80 bg-slate-50/85 p-3 text-center transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
          >
            <PlayerPortrait player={player} size="sm" teamAssetName={teamAssetName} />
            <div>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {player.firstName} {player.lastName}
              </p>
              <p className="type-meta text-slate-500 dark:text-slate-400">
                {player.position} #{player.jerseyNumber}
              </p>
            </div>
            <p className="type-stat-sm text-slate-950 dark:text-white">{acc.total.toFixed(1)}</p>
            <p className="type-meta text-slate-400 dark:text-slate-500">
              {hot.recent
                .map((g) => {
                  const v = acc.perGame.get(g.gameId);
                  return v === undefined ? '—' : v.toFixed(0);
                })
                .join(' · ')}
            </p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Combined game impact over the most recent games (newest first below each name) — the same production score
        behind Top Performer and Single-Game Performance of the Year.
      </p>
    </SurfaceCard>
  );
}

interface MilestoneHit {
  player: PlayerRow;
  label: string;
  value: number;
  threshold: number;
  achieved: boolean;
}

/**
 * Milestone tracker (Phase 4) — season counting-stat marks worth celebrating
 * or chasing. A player appears once they're within 75% of a threshold;
 * achieved milestones sort first. Thresholds are classic college benchmarks,
 * not tuned to any specific roster.
 */
const MILESTONES: { label: string; threshold: number; get: (p: PlayerRow) => number | null }[] = [
  { label: '3,000 Passing Yards', threshold: 3000, get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passYards : null) },
  { label: '30 Passing TDs', threshold: 30, get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passTDs : null) },
  { label: '1,000 Rushing Yards', threshold: 1000, get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushYards : null) },
  { label: '15 Rushing TDs', threshold: 15, get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushTDs : null) },
  { label: '1,000 Receiving Yards', threshold: 1000, get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receivingYards : null) },
  { label: '60 Receptions', threshold: 60, get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receptions : null) },
  { label: '100 Tackles', threshold: 100, get: (p) => (p.defense ? p.defense.tackles : null) },
  { label: '10 Sacks', threshold: 10, get: (p) => (p.defense ? p.defense.sacks : null) },
  { label: '5 Interceptions', threshold: 5, get: (p) => (p.defense ? p.defense.interceptions : null) },
];

function MilestonesSection({ players }: { players: PlayerRow[] }) {
  const { openPlayerModal } = usePlayerModal();
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();

  const hits = useMemo(() => {
    const list: MilestoneHit[] = [];
    for (const milestone of MILESTONES) {
      for (const player of players) {
        const value = milestone.get(player);
        if (value === null || value < milestone.threshold * 0.75) continue;
        list.push({ player, label: milestone.label, value, threshold: milestone.threshold, achieved: value >= milestone.threshold });
      }
    }
    return list.sort((a, b) => Number(b.achieved) - Number(a.achieved) || b.value / b.threshold - a.value / a.threshold).slice(0, 8);
  }, [players]);

  if (hits.length === 0 || !id) return null;

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">Milestones</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hits.map((hit) => (
          <button
            key={`${hit.player.playerId}-${hit.label}`}
            type="button"
            onClick={() => openPlayerModal(id, hit.player.playerId, seasonId)}
            className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-3 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {hit.player.firstName} {hit.player.lastName}
              </p>
              {hit.achieved ? (
                <span className="type-meta shrink-0 bg-emerald-100 px-2 py-0.5 font-semibold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Reached
                </span>
              ) : (
                <span className="type-meta tnum shrink-0 text-slate-400 dark:text-slate-500">
                  {(hit.threshold - hit.value) % 1 === 0 ? hit.threshold - hit.value : (hit.threshold - hit.value).toFixed(1)} to go
                </span>
              )}
            </div>
            <p className="type-meta mt-1 text-slate-500 dark:text-slate-400">{hit.label}</p>
            <div className="mt-2 h-1 w-full bg-slate-200/80 dark:bg-white/10">
              <div
                className="h-1 bg-[var(--team-primary)]"
                style={{ width: `${Math.min(100, (hit.value / hit.threshold) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </SurfaceCard>
  );
}

function StatRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2 dark:border-slate-800/60">
      <dt className="text-slate-500 dark:text-slate-400">
        {label}
        {note && (
          <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-slate-400/80 dark:text-slate-500">
            {note}
          </span>
        )}
      </dt>
      <dd className="proportional-nums font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

/**
 * The Team Stats view — every filterable number is derived from `agg` (the
 * aggregate over the currently-filtered game set), so game-type / opponent filters
 * genuinely drive the numbers. `mode` toggles Season Total vs Per Game as a pure
 * presentation choice over the same totals. A handful of stats have no per-game
 * source (red-zone %, return yards, INTs, fumble recoveries — see Phase 0) and come
 * from the full-season `teamStats`; those are always tagged "season" so it's never
 * ambiguous that they ignore the filter and the per-game toggle. `teamStats` is null
 * when viewing a league (non-user) team — the per-game aggregate still works from the
 * league-wide schedule, but those season-only fields aren't tracked, so they show "—".
 */
function TeamStatsView({
  agg,
  teamStats,
  mode,
  splitActive,
}: {
  agg: TeamAggregate;
  teamStats: TeamStats | null;
  mode: StatMode;
  splitActive: boolean;
}) {
  const perGame = mode === 'per-game';
  const games = agg.games;

  if (games === 0) {
    return (
      <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
        {splitActive
          ? 'No games match this filter yet — try a different game type or opponent.'
          : 'No games have been played yet this season.'}
      </SurfaceCard>
    );
  }

  // Countable totals: season mode shows the sum; per-game mode shows the average.
  const yards = (total: number) =>
    perGame ? `${Math.round(perGameAvg(total, games)).toLocaleString()} yd` : `${total.toLocaleString()} yd`;
  const yardsPlain = (total: number) =>
    perGame ? Math.round(perGameAvg(total, games)).toLocaleString() : total.toLocaleString();
  const points = (total: number) => (perGame ? oneDecimal(perGameAvg(total, games)) : String(total));
  const count = (total: number) => (perGame ? oneDecimal(perGameAvg(total, games)) : String(total));
  const ratio = (made: number, att: number) => {
    const p = ratioPct(made, att);
    return p === null ? '—' : pctFormat(p);
  };
  const sfx = perGame ? ' / G' : '';
  const margin = turnoverMargin(agg);
  const seasonNote = splitActive ? 'full season' : 'season';
  // Season-only fields (no per-game source, and not tracked for league teams → null).
  const seasonNum = (pick: (t: TeamStats) => number) => (teamStats ? String(pick(teamStats)) : '—');
  const seasonYds = (pick: (t: TeamStats) => number) => (teamStats ? pick(teamStats).toLocaleString() : '—');
  const seasonRedZone = (att: number, tds: number, fgs: number) =>
    teamStats && att > 0 ? pctFormat(pct(tds + fgs, att) ?? 0) : '—';

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`Points${sfx}`} value={points(agg.points)} />
        <StatTile label={`Total Offense${sfx}`} value={yards(agg.totalYards)} />
        <StatTile label={`Passing${sfx}`} value={yards(agg.passYards)} />
        <StatTile label={`Rushing${sfx}`} value={yards(agg.rushYards)} />
        <StatTile label={`Points Allowed${sfx}`} value={points(agg.pointsAllowed)} />
        <StatTile label={`Total Defense${sfx}`} value={yards(agg.defTotalYards)} />
        <StatTile label="Turnover Margin" value={`${margin > 0 ? '+' : ''}${margin}`} />
        <StatTile label="3rd Down %" value={ratio(agg.thirdDownConv, agg.thirdDownAtt)} />
      </div>

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Team Performance Breakdown</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {perGame ? 'Per-game averages' : 'Season totals'} over {games} game{games === 1 ? '' : 's'}
          {splitActive ? ' matching the current filter' : ''}.
        </p>
        {/* Generous top gap: the caption above is small, low-contrast type and
            the section bands are heavy, so a tight margin read as the two
            touching. */}
        <div className="mt-7 grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
          <CollapsibleSection title="Offense">
            <dl className="space-y-2 text-sm">
              <StatRow label={`Points${sfx}`} value={points(agg.points)} />
              <StatRow label={`Total Yards${sfx}`} value={yardsPlain(agg.totalYards)} />
              <StatRow label={`Passing Yards${sfx}`} value={yardsPlain(agg.passYards)} />
              <StatRow label={`Rushing Yards${sfx}`} value={yardsPlain(agg.rushYards)} />
              <StatRow label={`First Downs${sfx}`} value={count(agg.firstDowns)} />
              <StatRow label="3rd Down %" value={ratio(agg.thirdDownConv, agg.thirdDownAtt)} />
              <StatRow label="4th Down %" value={ratio(agg.fourthDownConv, agg.fourthDownAtt)} />
              <StatRow label={`Turnovers${sfx}`} value={count(agg.giveaways)} />
              <StatRow label="Time of Possession / G" value={formatSeconds(perGameAvg(agg.possessionSeconds, games))} />
              <StatRow
                label="Red-Zone %"
                note={seasonNote}
                value={teamStats ? seasonRedZone(teamStats.offRedZones, teamStats.offRedZoneTds, teamStats.offRedZoneFgs) : '—'}
              />
            </dl>
          </CollapsibleSection>

          <CollapsibleSection title="Defense">
            <dl className="space-y-2 text-sm">
              <StatRow label={`Points Allowed${sfx}`} value={points(agg.pointsAllowed)} />
              <StatRow label={`Total Yards Allowed${sfx}`} value={yardsPlain(agg.defTotalYards)} />
              <StatRow label={`Passing Yards Allowed${sfx}`} value={yardsPlain(agg.defPassYards)} />
              <StatRow label={`Rushing Yards Allowed${sfx}`} value={yardsPlain(agg.defRushYards)} />
              <StatRow label={`Sacks${sfx}`} value={count(agg.sacks)} />
              <StatRow label="3rd Down % Allowed" value={ratio(agg.defThirdDownConv, agg.defThirdDownAtt)} />
              <StatRow label="Interceptions" note={seasonNote} value={seasonNum((t) => t.defInts)} />
              <StatRow label="Fumble Recoveries" note={seasonNote} value={seasonNum((t) => t.fumbleRec)} />
              <StatRow
                label="Red-Zone % Allowed"
                note={seasonNote}
                value={teamStats ? seasonRedZone(teamStats.defRedZones, teamStats.defRedZoneTds, teamStats.defRedZoneFgs) : '—'}
              />
            </dl>
          </CollapsibleSection>

          <CollapsibleSection title="Special Teams" defaultOpen={false}>
            <dl className="space-y-2 text-sm">
              <StatRow label={`Punts${sfx}`} value={count(agg.punts)} />
              <StatRow label={`Punt Yards${sfx}`} value={yardsPlain(agg.puntYards)} />
              <StatRow label={`Penalties${sfx}`} value={count(agg.penalties)} />
              <StatRow label={`Penalty Yards${sfx}`} value={yardsPlain(agg.penaltyYards)} />
              <StatRow label="Kick Return Yards" note={seasonNote} value={seasonYds((t) => t.kickReturnYards)} />
              <StatRow label="Punt Return Yards" note={seasonNote} value={seasonYds((t) => t.puntReturnYards)} />
            </dl>
          </CollapsibleSection>
        </div>
      </SurfaceCard>
    </>
  );
}
