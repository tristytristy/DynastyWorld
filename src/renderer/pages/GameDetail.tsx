import { useEffect, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamLink } from '../components/common/TeamLink';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { StatisticsCategorySection, type ColumnDef, type LeaderCardRow, type LeaderMetric } from '../components/common/StatisticsCategorySection';
import type { StatTableRow } from '../components/common/StatisticsTable';
import { gameTypeLabel, getGameTypeImagePath, getLocationDisplay, isTraditionalBowl } from '../lib/scheduleFormat';
import { getBowlLogoPath, getConferenceLogoPath } from '../lib/trophyAssetMapping';
import { getHelmetPath, DEFAULT_HELMET_PATH, type HelmetSide } from '../lib/helmetAssetMapping';
import { buildTeamColorVars, type TeamColorVars } from '../lib/teamTheme';
import { gameImpactScore } from '../../shared/gameImpactScore';
import { useTheme } from '../theme/ThemeProvider';
import { useStadiumData } from '../data/StadiumDataProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { MediaGallery } from '../components/common/MediaGallery';
import type {
  DefensiveGameLine,
  GameDetailData,
  GameDetailTeamSide,
  GameLogEntry,
  MediaItemResolved,
  OffensiveGameLine,
  RosterPlayer,
  ScheduleGame,
  TeamStatLine,
} from '../../shared/types';

function formatPossession(seconds: number): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** The theme-appropriate, contrast-safe text form of a team's primary color. */
function teamTextColor(colors: TeamColorVars, appearance: 'light' | 'dark'): string {
  return appearance === 'dark' ? colors['--team-text-dark'] : colors['--team-text-light'];
}

/**
 * A team's helmet, loaded from the external image pack. `side` is the physical
 * screen position (the art in each folder faces INWARD): 'left' art faces right
 * so it belongs on the left, 'right' art faces left so it belongs on the right.
 * Falls back once to the generic Default helmet if a team's file 404s.
 */
function HelmetImg({ teamName, side, className }: { teamName: string; side: HelmetSide; className?: string }) {
  return (
    <img
      src={getHelmetPath(teamName, side)}
      alt=""
      onError={(event) => {
        const img = event.currentTarget;
        if (img.dataset.fellBack) return;
        img.dataset.fellBack = '1';
        img.src = DEFAULT_HELMET_PATH[side];
      }}
      className={className}
      draggable={false}
    />
  );
}

/** Center-anchored diverging bar: left/right fills meet at the leader's share, with a 50% reference tick. */
function StatBar({
  label,
  leftShare,
  leftDisplay,
  rightDisplay,
  leftColor,
  rightColor,
}: {
  label: string;
  leftShare: number;
  leftDisplay: string;
  rightDisplay: string;
  leftColor: string;
  rightColor: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, leftShare)) * 100);
  return (
    <div className="px-4 py-3">
      <p className="type-eyebrow text-center text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="proportional-nums w-16 shrink-0 text-right text-sm font-semibold text-slate-900 dark:text-white">{leftDisplay}</span>
        <div className="relative h-2.5 flex-1 overflow-hidden bg-slate-200/80 dark:bg-white/10">
          <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: leftColor }} />
          <div className="absolute inset-y-0 right-0" style={{ width: `${100 - pct}%`, backgroundColor: rightColor }} />
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/80 dark:bg-black/50" />
        </div>
        <span className="proportional-nums w-16 shrink-0 text-left text-sm font-semibold text-slate-900 dark:text-white">{rightDisplay}</span>
      </div>
    </div>
  );
}

/** Proportional share of a total; even split (no lean) when neither side has any. */
function share(left: number, right: number): number {
  const total = left + right;
  return total > 0 ? left / total : 0.5;
}

interface PerformerStat {
  value: string;
  label: string;
}

/**
 * The two headline stats for a top-performer card, drawn from the same
 * per-game lines the box-score tables use — a passer shows Pass Yds + Pass TD,
 * a rusher Car + Rush Yds, a receiver Rec + Rec Yds, a defender Tackles + the
 * biggest impact play they made.
 */
function performerStats(entry: GameLogEntry): PerformerStat[] {
  if (entry.category === 'offense') {
    const l = entry.line as OffensiveGameLine;
    // Dominant role by yardage — a two-way stat line still gets its best story.
    const role = Math.max(l.passYards, l.rushYards, l.receivingYards);
    if (role === l.passYards && l.passAttempts > 0) {
      return [
        { value: l.passYards.toLocaleString(), label: 'Pass Yds' },
        { value: String(l.passTDs), label: 'Pass TD' },
      ];
    }
    if (role === l.rushYards && l.rushAttempts > 0) {
      return [
        { value: String(l.rushAttempts), label: 'Car' },
        { value: l.rushYards.toLocaleString(), label: 'Rush Yds' },
      ];
    }
    return [
      { value: String(l.receptions), label: 'Rec' },
      { value: l.receivingYards.toLocaleString(), label: 'Rec Yds' },
    ];
  }
  const d = entry.line as DefensiveGameLine;
  const tackles: PerformerStat = { value: String(d.tackles + d.assistedTackles), label: 'Tackles' };
  // Second callout: the single most impactful play, in priority order.
  const bigPlay: PerformerStat =
    d.sacks > 0
      ? { value: String(d.sacks), label: 'Sacks' }
      : d.interceptions > 0
        ? { value: String(d.interceptions), label: 'Int' }
        : d.forcedFumbles > 0
          ? { value: String(d.forcedFumbles), label: 'FF' }
          : d.tacklesForLoss > 0
            ? { value: String(d.tacklesForLoss), label: 'TFL' }
            : d.passDeflections > 0
              ? { value: String(d.passDeflections), label: 'PD' }
              : { value: String(d.assistedTackles), label: 'Ast' };
  return [tackles, bigPlay];
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

/**
 * "Star of the game" card — one per team, independent of the box-score toggle
 * below, so it stays paired with the helmet-duel header. Cutout portrait
 * flanked by two headline stats, name/jersey in a team-color bar; the whole
 * card opens the player modal (same click-through as every player surface).
 */
function PerformerCard({
  entry,
  colors,
  teamName,
  roster,
  dynastyId,
  seasonId,
  appearance,
}: {
  entry: GameLogEntry;
  colors: TeamColorVars;
  teamName: string;
  roster: RosterPlayer[];
  dynastyId: string;
  seasonId: number | undefined;
  appearance: 'light' | 'dark';
}) {
  const { openPlayerModal } = usePlayerModal();
  const player = roster.find((p) => p.id === entry.playerId);
  const firstName = player?.firstName ?? entry.firstName ?? '';
  const lastName = player?.lastName ?? entry.lastName ?? '';
  const position = player?.position ?? entry.position ?? '';
  const jerseyNumber = player?.jerseyNumber ?? entry.jerseyNumber ?? 0;
  const portraitAssetName = player?.portraitAssetName ?? entry.portraitAssetName ?? null;
  const stats = performerStats(entry);
  const teamColor = colors['--team-primary'];
  const labelColor = teamTextColor(colors, appearance);

  const Callout = ({ stat, align }: { stat: PerformerStat; align: 'left' | 'right' }) => (
    <div className={`flex flex-1 flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="type-stat-md text-slate-950 dark:text-white">{stat.value}</span>
      <span className="type-eyebrow" style={{ color: labelColor }}>{stat.label}</span>
      <span className="mt-1.5 h-px w-8 bg-slate-300 dark:bg-white/20" />
    </div>
  );

  return (
    <button
      type="button"
      onClick={() => openPlayerModal(dynastyId, entry.playerId, seasonId, undefined, undefined, entry.teamIndex)}
      className="corner-cut group flex w-full flex-col border border-slate-200/80 bg-slate-50/85 p-4 text-left transition hover:border-[color:var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
      style={{ '--team-primary': teamColor } as unknown as CSSProperties}
    >
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{teamName} — Star of the game</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <Callout stat={stats[0]} align="right" />
        <PlayerPortrait player={{ firstName, lastName, portraitAssetName }} large className="max-h-[15rem]" teamAssetName={teamName} />
        <Callout stat={stats[1]} align="left" />
      </div>
      <div className="mt-3 flex items-center gap-2 px-3 py-2" style={{ backgroundColor: teamColor, color: colors['--team-on-primary'] }}>
        <span className="type-stat-sm">#{jerseyNumber}</span>
        <span className="truncate font-semibold">{firstName} {lastName}</span>
        {position && <span className="ml-auto text-sm font-medium opacity-80">{position}</span>}
      </div>
    </button>
  );
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
  const [detail, setDetail] = useState<GameDetailData | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [media, setMedia] = useState<MediaItemResolved[]>([]);
  // Which side's player box score is shown ('primary' = user's side, or the away
  // team for a non-user game; 'secondary' = the other team).
  const [side, setSide] = useState<'primary' | 'secondary'>('primary');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getGameDetail(id, Number(gameId), seasonId).then((result) => !cancelled && setDetail(result));
    // Roster still fetched so the user's own players resolve identity on seasons
    // synced before per-entry identity shipped (opponents fall back to the entry).
    window.api.db.getRoster(id, seasonId).then((result) => !cancelled && setRoster(result));
    window.api.media.listForGame(id, seasonId, Number(gameId)).then((result) => !cancelled && setMedia(result));
    return () => {
      cancelled = true;
    };
  }, [id, seasonId, gameId]);

  if (detail === undefined || roster === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading game...</p>;
  }

  if (!detail || !id) {
    return <p className="text-slate-500 dark:text-slate-400">Game not found.</p>;
  }

  // Neutral home/away framing drives the whole matchup view (helmets, stats,
  // stars) so it's identical for user and non-user games. Perspective (which
  // side is "primary") only decides the default box-score toggle + W/L chip.
  const away = detail.away;
  const home = detail.home;
  const userSide = home.isUser ? home : away.isUser ? away : null;
  const primary = userSide ?? away;
  const secondary = primary === home ? away : home;
  const primaryIsHome = primary === home;
  const played = detail.played;
  const result: ScheduleGame['result'] =
    userSide && played ? (primary.score > secondary.score ? 'W' : primary.score < secondary.score ? 'L' : 'T') : null;

  // Per-side, contrast-safe color sets (scoped to this page — the global
  // --team-primary / Team-Mode theming is untouched). Falls back to the
  // brand blue for placeholder/FCS teams with no save color.
  const awayColors = buildTeamColorVars(away.primaryColor, away.secondaryColor);
  const homeColors = buildTeamColorVars(home.primaryColor, home.secondaryColor);
  const awayColor = awayColors['--team-primary'];
  const homeColor = homeColors['--team-primary'];
  const awayWon = played && away.score > home.score;
  const homeWon = played && home.score > away.score;
  const winnerColor = homeWon ? homeColor : awayWon ? awayColor : null;

  // Adapt the neutral GameDetailData to the ScheduleGame shape the meta-line
  // formatting helpers already consume.
  const game: ScheduleGame = {
    gameId: detail.gameId,
    week: detail.week,
    teamName: primary.name,
    opponent: secondary.name,
    opponentTeamIndex: secondary.teamIndex,
    isHome: primaryIsHome,
    status: detail.status,
    dayOfWeek: detail.dayOfWeek,
    broadcastScope: '',
    kickoffTime: detail.kickoffTime,
    date: detail.date,
    teamScore: played ? primary.score : null,
    opponentScore: played ? secondary.score : null,
    result,
    opponentCurrentRank: secondary.currentRank,
    teamQuarterScores: primary.quarterScores,
    opponentQuarterScores: secondary.quarterScores,
    teamStats: primary.stats,
    opponentStats: secondary.stats,
    gameType: detail.gameType,
    bowlName: detail.bowlName,
    bowlAssetName: detail.bowlAssetName,
    isNationalChampionship: detail.isNationalChampionship,
    conferenceName: detail.conferenceName,
    isRivalryGame: false,
    rivalryName: null,
    siteType: detail.isNeutralSite ? 'neutral' : primaryIsHome ? 'home' : 'away',
    opponentRecord: null,
    runningRecord: null,
  };

  // Both teams' entries for this game; toggle between the two sides.
  const allEntries = detail.players;
  const hasBothSides =
    allEntries.some((e) => e.teamIndex === primary.teamIndex) &&
    allEntries.some((e) => e.teamIndex === secondary.teamIndex);
  const activeTeamIndex = side === 'secondary' ? secondary.teamIndex : primary.teamIndex;
  const sideEntries = hasBothSides ? allEntries.filter((e) => e.teamIndex === activeTeamIndex) : allEntries;
  const activeSideName = side === 'secondary' ? secondary.name : primary.name;

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

  // Top performer per team (by game-impact), independent of the box-score
  // toggle. Older seasons carry no per-entry teamIndex (all user-team) — those
  // degrade to a single overall card.
  const meaningfulAll = allEntries.filter(hasMeaningfulStats);
  const hasTeamIndex = allEntries.some((e) => e.teamIndex !== undefined);
  const topForTeam = (teamIndex: number): GameLogEntry | null => {
    const pool = meaningfulAll.filter((e) => e.teamIndex === teamIndex);
    return pool.length ? pool.reduce((best, e) => (gameImpactScore(e) > gameImpactScore(best) ? e : best)) : null;
  };
  const awayTop = hasTeamIndex ? topForTeam(away.teamIndex) : null;
  const homeTop = hasTeamIndex ? topForTeam(home.teamIndex) : null;
  const overallTop = meaningfulAll.length
    ? meaningfulAll.reduce((best, e) => (gameImpactScore(e) > gameImpactScore(best) ? e : best))
    : null;

  // Away-vs-home team-stat bars (both teams' lines exist once played).
  const statBars =
    played && away.stats && home.stats
      ? (() => {
          const a = away.stats as TeamStatLine;
          const h = home.stats as TeamStatLine;
          const num = (v: number) => v.toLocaleString();
          const aThird = a.thirdDownAttempts > 0 ? a.thirdDownConversions / a.thirdDownAttempts : 0;
          const hThird = h.thirdDownAttempts > 0 ? h.thirdDownConversions / h.thirdDownAttempts : 0;
          return [
            { label: 'Total Yards', leftShare: share(a.totalYards, h.totalYards), leftDisplay: num(a.totalYards), rightDisplay: num(h.totalYards) },
            { label: 'Pass Yards', leftShare: share(a.passYards, h.passYards), leftDisplay: num(a.passYards), rightDisplay: num(h.passYards) },
            { label: 'Rush Yards', leftShare: share(a.rushYards, h.rushYards), leftDisplay: num(a.rushYards), rightDisplay: num(h.rushYards) },
            { label: 'First Downs', leftShare: share(a.firstDowns, h.firstDowns), leftDisplay: num(a.firstDowns), rightDisplay: num(h.firstDowns) },
            {
              label: 'Third Down',
              leftShare: share(aThird, hThird),
              leftDisplay: `${a.thirdDownConversions}/${a.thirdDownAttempts}`,
              rightDisplay: `${h.thirdDownConversions}/${h.thirdDownAttempts}`,
            },
            { label: 'Turnovers', leftShare: share(a.turnovers, h.turnovers), leftDisplay: num(a.turnovers), rightDisplay: num(h.turnovers) },
            { label: 'Sacks', leftShare: share(a.sacks, h.sacks), leftDisplay: num(a.sacks), rightDisplay: num(h.sacks) },
            { label: 'Penalty Yards', leftShare: share(a.penaltyYards, h.penaltyYards), leftDisplay: num(a.penaltyYards), rightDisplay: num(h.penaltyYards) },
            {
              label: 'Possession',
              leftShare: share(a.possessionTimeSeconds, h.possessionTimeSeconds),
              leftDisplay: formatPossession(a.possessionTimeSeconds),
              rightDisplay: formatPossession(h.possessionTimeSeconds),
            },
          ];
        })()
      : null;

  // Hero game emblem — the conference mark for a conference game, else the
  // bowl / playoff / CFP logo — sized to roughly 80% of the eyebrow's width and
  // centered above it. Null for a plain non-conference game (no emblem exists).
  const conferenceLogoSrc =
    game.gameType === 'conference' && game.conferenceName
      ? getConferenceLogoPath(game.conferenceName, appearance)
      : null;
  const gameTypeImgSrc = getGameTypeImagePath(game, appearance);
  const gameLogo = conferenceLogoSrc ? (
    <img src={conferenceLogoSrc} alt="" className="h-32 w-32 object-contain sm:h-44 sm:w-44" draggable={false} />
  ) : gameTypeImgSrc ? (
    <img
      src={gameTypeImgSrc ?? undefined}
      alt=""
      onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
      className="h-32 w-32 object-contain sm:h-44 sm:w-44"
      draggable={false}
    />
  ) : null;

  const metaLine = (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {[
        gameTypeLabel(game),
        (() => {
          const location = getLocationDisplay(game, getStadium);
          if (location.stadium) return `${location.stadium}, ${location.cityState}`;
          return game.siteType === 'neutral' ? location.badge : null;
        })(),
      ]
        .filter(Boolean)
        .join(' | ')}
    </p>
  );

  // A team flank in the header: a big helmet over the team name + rank. The
  // helmet box is oversized for impact; negative vertical margins pull the box
  // back in so it doesn't add height (the overlap region is only the helmet
  // PNG's own transparent padding, so no art is clipped or collides).
  const TeamFlank = ({ team, sideName, teamColor }: { team: GameDetailTeamSide; sideName: HelmetSide; teamColor: string }) => (
    <div className="flex w-52 shrink-0 flex-col items-center sm:w-80">
      <HelmetImg teamName={team.name} side={sideName} className="-my-6 h-52 w-52 object-contain sm:-my-10 sm:h-80 sm:w-80" />
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="h-1 w-12" style={{ backgroundColor: teamColor }} />
        <TeamLink
          teamIndex={team.teamIndex}
          teamName={team.name}
          dynastyId={dynastyId}
          seasonId={seasonId}
          showLogo={false}
          nameClassName="font-display text-base font-bold leading-tight text-slate-950 dark:text-white sm:text-lg"
        />
        {team.currentRank && team.currentRank <= 25 && (
          <span className="type-eyebrow text-slate-400 dark:text-slate-500">#{team.currentRank}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header — helmet duel + hero score. Deliberately NOT a SurfaceCard:
          transparent ground so the helmets + score are the whole statement. */}
      <div className="relative flex items-center justify-between gap-2 overflow-visible sm:gap-4">
        {winnerColor && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120% 90% at ${homeWon ? '100%' : '0%'} 50%, color-mix(in srgb, ${winnerColor} 14%, transparent), transparent 60%)`,
            }}
          />
        )}
        <TeamFlank team={away} sideName="left" teamColor={awayColor} />

        <div className="relative flex min-w-0 flex-1 flex-col items-center gap-2">
          {gameLogo && <div className="mb-0.5 flex justify-center">{gameLogo}</div>}
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Week {game.week}</p>
          {played ? (
            <div className="flex items-baseline justify-center gap-3 sm:gap-5">
              <span
                className="font-display text-6xl font-bold leading-none tracking-tight tabular-nums sm:text-7xl"
                style={{ color: teamTextColor(awayColors, appearance), opacity: awayWon || away.score === home.score ? 1 : 0.5 }}
              >
                {away.score}
              </span>
              <span className="text-3xl font-light text-slate-300 dark:text-slate-600 sm:text-4xl">–</span>
              <span
                className="font-display text-6xl font-bold leading-none tracking-tight tabular-nums sm:text-7xl"
                style={{ color: teamTextColor(homeColors, appearance), opacity: homeWon || away.score === home.score ? 1 : 0.5 }}
              >
                {home.score}
              </span>
            </div>
          ) : (
            <p className="font-display text-5xl font-bold tracking-tight text-slate-300 dark:text-slate-600">VS</p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {game.date} · {game.dayOfWeek} {game.kickoffTime}
          </p>
          {metaLine}
        </div>

        <TeamFlank team={home} sideName="right" teamColor={homeColor} />
      </div>

      {!played || !statBars ? (
        <SurfaceCard>
          <div className="rounded-xl border border-dashed border-slate-300/80 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            This game has not been played yet. Box score and stat surfaces will populate after the result is imported.
          </div>
        </SurfaceCard>
      ) : (
        <>
          {/* Quarter by quarter — away/home rows, each keyed with its team color */}
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Quarter by quarter</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-900 text-white dark:bg-white/10">
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
                  {[
                    { row: away, color: awayColor } as const,
                    { row: home, color: homeColor } as const,
                  ].map((entry, rowIndex) => (
                    <tr key={entry.row.teamIndex} className={`bg-slate-50/80 dark:bg-white/5 ${rowIndex === 0 ? 'border-b border-white/60 dark:border-white/5' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white" style={{ borderLeft: `3px solid ${entry.color}` }}>{entry.row.name}</td>
                      {entry.row.quarterScores.map((score, index) => (
                        <td key={index} className="proportional-nums px-4 py-3 text-center text-slate-900 dark:text-white">{score}</td>
                      ))}
                      <td className="proportional-nums px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">{entry.row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>

          {/* Team stats — center-scale diverging bars */}
          <SurfaceCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Team stats</h3>
              <div className="flex items-center gap-4 type-eyebrow text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ backgroundColor: awayColor }} />{away.name}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ backgroundColor: homeColor }} />{home.name}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-200/70 border border-slate-200/80 bg-slate-50/60 dark:divide-white/5 dark:border-slate-800 dark:bg-white/5">
              {statBars.map((bar) => (
                <StatBar key={bar.label} {...bar} leftColor={awayColor} rightColor={homeColor} />
              ))}
            </div>
          </SurfaceCard>

          {/* Top performers — one per team (or a single card on legacy seasons) */}
          {awayTop || homeTop ? (
            <div className="grid gap-4 md:grid-cols-2">
              {awayTop && (
                <PerformerCard entry={awayTop} colors={awayColors} teamName={away.name} roster={roster ?? []} dynastyId={id} seasonId={seasonId} appearance={appearance} />
              )}
              {homeTop && (
                <PerformerCard entry={homeTop} colors={homeColors} teamName={home.name} roster={roster ?? []} dynastyId={id} seasonId={seasonId} appearance={appearance} />
              )}
            </div>
          ) : overallTop ? (
            <div className="grid gap-4 md:grid-cols-2">
              <PerformerCard entry={overallTop} colors={primary === home ? homeColors : awayColors} teamName={primary.name} roster={roster ?? []} dynastyId={id} seasonId={seasonId} appearance={appearance} />
            </div>
          ) : null}

          {/* Player box score — per-side toggle */}
          {hasBothSides && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 type-eyebrow text-slate-400 dark:text-slate-500">Player box score</span>
              {([
                ['primary', primary.name] as const,
                ['secondary', secondary.name] as const,
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

          {entries.length === 0 ? (
            <SurfaceCard>
              <div className="rounded-xl border border-dashed border-slate-300/80 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                No individual player stats were recorded for {activeSideName} in this game.
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
                  teamAssetName={activeSideName}
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
                  teamAssetName={activeSideName}
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
                  teamAssetName={activeSideName}
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
                  teamAssetName={activeSideName}
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
