import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamLink } from '../components/common/TeamLink';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { StatisticsCategorySection, type ColumnDef, type LeaderCardRow, type LeaderMetric } from '../components/common/StatisticsCategorySection';
import type { StatTableRow } from '../components/common/StatisticsTable';
import { gameTypeLabel, getCfpBowlImagePath, getGameTypeImagePath, getLocationDisplay, isTraditionalBowl } from '../lib/scheduleFormat';
import { getBowlLogoPath, getConferenceChampionshipGamePath, getConferenceLogoPath } from '../lib/trophyAssetMapping';
import { getRivalryLogoPath } from '../lib/rivalryAssetMapping';
import { HelmetImg } from '../components/common/HelmetImg';
import type { HelmetSide } from '../lib/helmetAssetMapping';
import { useProgramStadium } from '../data/ProgramArtProvider';
import { buildTeamColorVars, type TeamColorVars } from '../lib/teamTheme';
import { gameImpactScore } from '../../shared/gameImpactScore';
import { offenseYards, returnYards } from '../../shared/teamYards';
import { useTheme } from '../theme/ThemeProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { MediaGallery } from '../components/common/MediaGallery';
import { GliderNav, gliderItemClass } from '../components/ui/GliderNav';
import { usePlayerHoverCard } from '../data/PlayerHoverProvider';

/**
 * The three things a game HAS. A SUB-MENU rather than a mode switch (user
 * direction): these are destinations within the game, and the app marks a
 * destination with the glider — the filled toggle is for modes.
 */
type GameView = 'team' | 'player' | 'scoring' | 'media';
const GAME_VIEWS: { key: GameView; label: string }[] = [
  { key: 'team', label: 'Team' },
  { key: 'player', label: 'Player' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'media', label: 'Media' },
];
import type {
  DefensiveGameLine,
  GameDetailData,
  GameDetailTeamSide,
  GameLogEntry,
  MediaItemResolved,
  ScoringPlay,
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

/** Center-anchored diverging bar: left/right fills meet at the leader's share, with a 50% reference tick. */
/**
 * How far apart two team colours are, 0-1, in plain RGB distance.
 *
 * Crude on purpose. The question is not whether these are the same hue but
 * whether a reader can tell a 10px bar into two halves, and for that a
 * straight-line distance through RGB is both good enough and predictable —
 * unlike a perceptual space, where two navies can score further apart than they
 * look and the fix would fire on the wrong pairs.
 */
function colorDistance(a: string, b: string): number {
  const rgb = (hex: string): [number, number, number] => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 441.67;
}

/**
 * Below this, two primaries are close enough that a flat diverging bar reads as
 * one solid block. Tuned against the reported case: UTSA against UTEP, two blues.
 */
const COLOR_CLASH = 0.22;

/**
 * A colour that will actually SHOW on a given fill.
 *
 * MEASURED, NOT ASSUMED: of the 138 real FBS teams in the save, four — Ball
 * State, Georgia, Hawai'i and Louisville — carry a black or empty secondary, and
 * App State has no usable primary. A rule painted in a missing secondary is a
 * black line on a dark bar: the mark silently fails on exactly the matchups it
 * was added for.
 *
 * So the team's own secondary is used when it is real and reads against the
 * fill, and otherwise the rule falls back to whichever of white or black
 * separates further from that fill. It never returns something invisible.
 */
function readableRule(secondary: string | null | undefined, against: string): string {
  const usable = secondary && /^#?[0-9a-f]{6}$/i.test(secondary.trim());
  if (usable && colorDistance(secondary!, against) >= 0.18) return secondary!;
  return colorDistance('#ffffff', against) >= colorDistance('#000000', against) ? '#ffffff' : '#000000';
}

/**
 * The fill for the side that YIELDS, given what the anchored side is wearing.
 *
 * ONE SIDE IS FIXED AND ONLY THE OTHER MOVES. That is what makes the swap
 * legible rather than confusing — a reader always has something stable to read
 * against. Which side is anchored is decided by `anchorIsHome` below, not here.
 *
 * The yielding side keeps its primary too, until the two are close enough to
 * read as one block; then it takes its own SECONDARY, which is still genuinely
 * that team's colour. UTSA blue against UTEP blue becomes UTSA blue against
 * UTEP's orange, and the bar splits.
 *
 * REPLACES A MARK ON THE FILL. Hatching, then a centre rule, both tried to
 * annotate two colours that looked alike; changing the colour removes the
 * problem instead of labelling it, and needs no extra ink on a 10px bar.
 *
 * The last resort is white or black — for the case where the yielding side's
 * SECONDARY is also too close to the anchor, which no current matchup hits but
 * which two black-and-red teams would.
 */
function yieldingFill(primary: string, secondary: string | null | undefined, anchor: string): string {
  if (colorDistance(primary, anchor) >= COLOR_CLASH) return primary;
  const usable = secondary && /^#?[0-9a-f]{6}$/i.test(secondary.trim());
  if (usable && colorDistance(secondary!, anchor) >= COLOR_CLASH) return secondary!;
  return readableRule(null, anchor);
}

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
 * genuinely don't exist on per-game lines (GP, Lng). Interceptions DO exist
 * per game and are now shown — an earlier version of this note listed Int as
 * unavailable, which was simply wrong.
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
  // Interceptions were captured per game all along (extract-gamelog's passInts)
  // but never shown — a box score that reports touchdowns and hides picks only
  // tells half of how the quarterback played.
  { key: 'passInts', label: 'INT', raw: (l) => l.passInts },
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
        /*
          The row's OWN team, carried through so a click can resolve the player
          against that team's league snapshot. Without it both the table and the
          leader cards fell back to the page's viewed team — which is null when
          the box score is open as an app-root modal — so every non-user player
          resolved against the user's roster and came back "Player not found".
        */
        ...(entry.teamIndex !== undefined ? { teamIndex: entry.teamIndex } : {}),
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

/** 564 seconds remaining reads 9:24 on a stadium clock. */
function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

const PLAY_LABEL: Record<ScoringPlay['playType'], string> = {
  touchdown: 'Touchdown',
  fieldGoal: 'Field goal',
  safety: 'Safety',
};

/**
 * SCORE SUMMARY — every score in order, the way the game's own game-info page
 * lists them.
 *
 * The save keeps scoring summaries for the CURRENT WEEK ONLY (see
 * extract-scoring.ts), so this is the one surface in the app whose emptiness is
 * expected rather than a fault. A game synced a week late has none and never
 * will, so the empty state EXPLAINS that instead of showing a blank list —
 * otherwise it reads as a bug in a feature working exactly as designed.
 *
 * Scorers are named only where the save's three-man snapshot happened to
 * contain them, which covers most touchdowns and no field goals at all. A play
 * with nobody named simply omits the name rather than printing "unknown": the
 * row still says what happened and when, which is the part that always holds.
 */
function ScoreSummary({
  played,
  plays,
  home,
  away,
  homeColor,
  awayColor,
  roster,
  dynastyId,
  seasonId,
}: {
  played: boolean;
  plays: ScoringPlay[];
  home: GameDetailTeamSide;
  away: GameDetailTeamSide;
  homeColor: string;
  awayColor: string;
  roster: RosterPlayer[];
  dynastyId: string;
  seasonId: number | undefined;
}) {
  const { openPlayerModal } = usePlayerModal();
  const { hoverProps } = usePlayerHoverCard();

  /*
    Names arrive already resolved (getGameDetail reads the whole season's log,
    which is the only place a current-week scorer can be found). The roster is
    still indexed here for ONE thing the name can't carry: the hover card needs a
    full roster row, so opponents get a clickable name without a card, exactly as
    they do on every other player surface.
  */
  const rosterById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);

  function hoverFor(playerId: number) {
    const player = rosterById.get(playerId);
    if (!player) return {};
    return hoverProps({ player, teamName: null, seasonYear: null, dynastyId });
  }

  if (plays.length === 0) {
    return (
      <SurfaceCard>
        <div className="corner-cut-sm border border-dashed border-slate-300/80 px-5 py-10 text-center dark:border-slate-700">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Score summary</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {played ? (
              <>
                No scoring summary was captured for this game. The save only carries them for the
                week being played, so they&apos;re recorded when you sync during that week — and
                can&apos;t be recovered afterwards.
              </>
            ) : (
              <>This game hasn&apos;t been played yet. Its scoring plays appear once the result is synced.</>
            )}
          </p>
        </div>
      </SurfaceCard>
    );
  }

  // Grouped into quarters so the reader gets the same landmarks the broadcast
  // does. Overtime arrives as quarter 5 and up and is labelled as such rather
  // than printed as "Q5".
  const quarters = [...new Set(plays.map((p) => p.quarter))].sort((a, b) => a - b);

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Score summary</h3>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {plays.length} scoring {plays.length === 1 ? 'play' : 'plays'} · clock shows time remaining
        </p>
      </div>

      {quarters.map((quarter) => (
        <div key={quarter}>
          <div className="bg-slate-100/80 px-5 py-2 dark:bg-white/5">
            <span className="type-eyebrow text-slate-500 dark:text-slate-400">
              {quarter <= 4 ? `Quarter ${quarter}` : quarter === 5 ? 'Overtime' : `Overtime ${quarter - 4}`}
            </span>
          </div>
          {plays
            .filter((p) => p.quarter === quarter)
            .map((play, index) => {
              const side = play.isHome ? home : away;
              const color = play.isHome ? homeColor : awayColor;
              const scorers = play.scorers;
              return (
                <div
                  key={`${quarter}-${play.clockSeconds}-${index}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/70 px-5 py-3 dark:border-white/5"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <span className="tnum w-12 shrink-0 text-sm text-slate-400 dark:text-slate-500">
                    {formatClock(play.clockSeconds)}
                  </span>
                  <span className="w-32 shrink-0 truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {side.name}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
                    {PLAY_LABEL[play.playType]}
                    {scorers.length > 0 && (
                      <>
                        {' — '}
                        {scorers.map((s, i) => (
                          <span key={s.playerId}>
                            {i > 0 && ' from '}
                            <button
                              type="button"
                              onClick={() => openPlayerModal(dynastyId, s.playerId, seasonId, undefined, undefined, side.teamIndex)}
                              className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                              {...hoverFor(s.playerId)}
                            >
                              {s.name}
                            </button>
                          </span>
                        ))}
                      </>
                    )}
                    {/*
                      Only ever said about a touchdown. A field goal or safety
                      carries no try, so "no good" against one would be inventing
                      a play that never took place.
                    */}
                    {play.playType === 'touchdown' && play.conversionPoints === 0 && (
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">conversion no good</span>
                    )}
                    {play.conversionPoints === 2 && (
                      <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">2-PT</span>
                    )}
                  </span>
                  {/* The leader's number carries the weight, so the run of play reads down the column. */}
                  <span className="tnum shrink-0 text-sm text-slate-500 dark:text-slate-400">
                    <span className={play.awayScore >= play.homeScore ? 'font-semibold text-slate-950 dark:text-white' : ''}>
                      {play.awayScore}
                    </span>
                    <span className="mx-1 text-slate-300 dark:text-slate-600">–</span>
                    <span className={play.homeScore >= play.awayScore ? 'font-semibold text-slate-950 dark:text-white' : ''}>
                      {play.homeScore}
                    </span>
                  </span>
                </div>
              );
            })}
        </div>
      ))}

      <div className="border-t border-slate-200/80 px-5 py-3 text-xs text-slate-400 dark:border-white/5 dark:text-slate-500">
        {away.name} listed first. Kickers aren&apos;t named in the save&apos;s summary, so field goals
        show no scorer.
      </div>
    </SurfaceCard>
  );
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

  /*
    `basis-0` splits the leftover space evenly; `min-w-[4.5rem]` is what stops
    the labels being cut off.

    Measured in the modal, where these two cards sit side by side: the column
    came to 51px and the labels want up to 70px. The multi-word ones survived
    that ("Rush Yds" wraps onto two lines), which is why the clipping only ever
    showed on the single words — TACKLES at 62px and SACKS have nowhere to
    break, so they ran straight off the card. 4.5rem clears the widest of them.
  */
  const Callout = ({ stat, align }: { stat: PerformerStat; align: 'left' | 'right' }) => (
    <div className={`flex min-w-[4.5rem] flex-1 basis-0 flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
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
      {/*
        The height cap goes through `largeMaxHeight`, NOT `className`. Both land
        on the same <img>, so passing `max-h-[15rem]` as a class just put two
        max-heights on one element and let CSS source order decide — the
        component's own `max-h-[22rem]` won, and the portrait rendered 352px
        instead of the 240px this card asked for. That extra 112px came straight
        out of the two stat columns.

        The portrait is also the element that gives way now: `min-w-0` lets it
        shrink so the callouts keep the width their labels need, rather than the
        labels being pushed off the card. It's the right one to yield — a
        slightly narrower portrait reads fine, a half-printed "TACKLES" doesn't.
      */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <Callout stat={stats[0]} align="right" />
        <div className="flex min-w-0 shrink justify-center">
          <PlayerPortrait
            player={{ firstName, lastName, portraitAssetName }}
            large
            largeMaxHeight="max-h-[15rem]"
            teamAssetName={teamName}
          />
        </div>
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
  // Program-editor overrides layered over the built-in reference data.
  const getStadium = useProgramStadium();
  const [detail, setDetail] = useState<GameDetailData | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [media, setMedia] = useState<MediaItemResolved[]>([]);
  const [view, setView] = useState<GameView>('team');
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
  /*
    THE BAR'S visiting COLOUR, which is not always that team's primary.

    Only the STAT BARS and their key use this — the helmets, the score and the
    glows above keep true team colour, because a helmet identifies a team on its
    own and there is nothing to disambiguate up there. Down here the two fills
    are the only thing telling the halves apart, so the visitor yields when it
    has to.
  */
  const homeColor = homeColors['--team-primary'];
  /*
    THE USER'S TEAM NEVER CHANGES COLOUR (user direction 2026-08-03).

    Anchoring on HOME was wrong the moment the user played away: their own team
    became the side that yielded, and the whole point of this is that a user can
    find their team on a bar without reading the key. So the anchor is the USER's
    side whenever this game has one, and only falls back to home for a
    CPU-vs-CPU game, where neither side is anyone's team and home is the
    conventional anchor.

    Reported after seeing it happen in a real game — the rule was right, the
    thing it was pinned to was not.
  */
  const anchorIsHome = home.isUser || !away.isUser;
  const anchorColor = anchorIsHome ? homeColor : awayColors['--team-primary'];
  const yielder = anchorIsHome ? awayColors : homeColors;
  const yielderColor = yieldingFill(yielder['--team-primary'], yielder['--team-secondary'], anchorColor);
  const awayBarColor = anchorIsHome ? yielderColor : awayColors['--team-primary'];
  const homeBarColor = anchorIsHome ? homeColor : yielderColor;
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
    // getGameDetail already resolved this side's rank through the captured
    // context where one exists, so the value above is historical when it can be.
    opponentContextCaptured: true,
    teamQuarterScores: primary.quarterScores,
    opponentQuarterScores: secondary.quarterScores,
    teamStats: primary.stats,
    opponentStats: secondary.stats,
    gameType: detail.gameType,
    bowlName: detail.bowlName,
    bowlAssetName: detail.bowlAssetName,
    isNationalChampionship: detail.isNationalChampionship,
    isConferenceChampionship: detail.isConferenceChampionship,
    neutralVenueId: detail.neutralVenueId,
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
          /*
            Total Offense, not the save's TOTALYARDS — that field is ALL-PURPOSE
            (offense + kick + punt returns), so this row used to disagree with
            the game's own box score by exactly a team's return yardage while
            the Pass and Rush rows beneath it already summed to the right
            number. Return Yards now carries the remainder explicitly, so the
            all-purpose figure is still on the page and honestly labelled.
            See shared/teamYards.ts.
          */
          const aOff = offenseYards(a);
          const hOff = offenseYards(h);
          const aRet = returnYards(a);
          const hRet = returnYards(h);
          return [
            { label: 'Total Offense', leftShare: share(aOff, hOff), leftDisplay: num(aOff), rightDisplay: num(hOff) },
            { label: 'Pass Yards', leftShare: share(a.passYards, h.passYards), leftDisplay: num(a.passYards), rightDisplay: num(h.passYards) },
            { label: 'Rush Yards', leftShare: share(a.rushYards, h.rushYards), leftDisplay: num(a.rushYards), rightDisplay: num(h.rushYards) },
            { label: 'Return Yards', leftShare: share(aRet, hRet), leftDisplay: num(aRet), rightDisplay: num(hRet) },
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

  /*
    Hero game emblem, most specific occasion first: the rivalry mark, then the
    conference mark, then the bowl / playoff / CFP logo. Null for a plain
    non-conference game — no emblem exists and inventing one would say nothing.

    Rivalry outranks conference because the Iron Bowl is not "an SEC game" to
    anyone who cares that it's being played. It does NOT outrank a bowl: if two
    rivals meet in the Playoff, the round is the occasion, and the bowl art is
    the thing you'd actually want on the wall.
  */
  const rivalryLogoSrc = getRivalryLogoPath(home.name, away.name);
  const conferenceLogoSrc =
    game.gameType === 'conference' && game.conferenceName
      ? // The championship game's own mark, falling back to the plain
        // conference logo for a conference with no championship art.
        (game.isConferenceChampionship ? getConferenceChampionshipGamePath(game.conferenceName) : null) ??
        getConferenceLogoPath(game.conferenceName, appearance)
      : null;
  const gameTypeImgSrc = getGameTypeImagePath(game, appearance);
  const cfpBowlImgSrc = getCfpBowlImagePath(game);
  const nonBowlLogoSrc = game.gameType === 'bowl' ? null : rivalryLogoSrc ?? conferenceLogoSrc;
  const gameLogo = nonBowlLogoSrc ? (
    <img src={nonBowlLogoSrc} alt="" className="h-32 w-32 object-contain sm:h-44 sm:w-44" draggable={false} />
  ) : gameTypeImgSrc ? (
    /*
      A playoff quarterfinal or semifinal shows TWO marks: the CFP round graphic
      for how deep into the bracket this is, and the bowl's own logo for which
      trophy is on the table. Neither answers the other's question. The bowl is
      the smaller of the two — the round is the primary identity here, the bowl
      the qualifier.
    */
    <div className="flex items-center gap-2 sm:gap-3">
      <img
        src={gameTypeImgSrc ?? undefined}
        alt=""
        onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
        className="h-32 w-32 object-contain sm:h-44 sm:w-44"
        draggable={false}
      />
      {cfpBowlImgSrc && (
        <img
          src={cfpBowlImgSrc}
          alt=""
          className="h-20 w-20 object-contain sm:h-28 sm:w-28"
          draggable={false}
        />
      )}
    </div>
  ) : null;

  /*
    Three stacked lines — date, what the game IS, then where it's played —
    rather than one pipe-joined string. Combined, it ran long enough to wrap at
    the hero's width and the break landed mid-venue ("Simmons Bank Liberty /
    Stadium, Memphis, TN"), splitting the stadium's own name across two rows.
    Giving each fact its own line means the wrap point is never inside one.
  */
  const eventName = gameTypeLabel(game);
  const location = getLocationDisplay(game, getStadium);
  // Stadium + CITY, not city+state: the state orphaned onto a line of its own
  // in a column this narrow, and "Memphis" carries the meaning by itself.
  const venueLine = location.stadium
    ? `${location.stadium}, ${location.city}`
    : game.siteType === 'neutral'
      ? location.badge
      : null;

  const metaLine = (
    <div className="flex flex-col items-center gap-0.5">
      {eventName && <p className="text-sm text-slate-500 dark:text-slate-400">{eventName}</p>}
      {venueLine && <p className="text-sm text-slate-500 dark:text-slate-400">{venueLine}</p>}
    </div>
  );

  // A team flank in the header: a big helmet over the team name + rank. The
  // helmet box is oversized for impact; negative vertical margins pull the box
  // back in so it doesn't add height (the overlap region is only the helmet
  // PNG's own transparent padding, so no art is clipped or collides).
  const TeamFlank = ({ team, sideName, teamColor }: { team: GameDetailTeamSide; sideName: HelmetSide; teamColor: string }) => (
    <div className="relative z-10 flex w-52 shrink-0 flex-col items-center sm:w-80">
      <HelmetImg teamName={team.name} side={sideName} className="-my-6 h-52 w-52 object-contain sm:-my-10 sm:h-80 sm:w-80" />
      <div className="flex flex-col items-center gap-1 text-center">
        {/* Rank leads the stack, above the colour rule — it's the loudest thing
            about a matchup ("#3 vs #7"), and it was buried under the name in
            eyebrow grey. Bold and a step larger than the name; only ever shown
            for a real top-25 position. */}
        {team.currentRank !== null && team.currentRank <= 25 && (
          <span className="font-display text-lg font-extrabold leading-none text-slate-950 dark:text-white sm:text-xl">
            #{team.currentRank}
          </span>
        )}
        <span className="h-1 w-12" style={{ backgroundColor: teamColor }} />
        <TeamLink
          teamIndex={team.teamIndex}
          teamName={team.name}
          dynastyId={dynastyId}
          seasonId={seasonId}
          showLogo={false}
          nameClassName="font-display text-base font-bold leading-tight text-slate-950 dark:text-white sm:text-lg"
        />
        {/* The record as it stood going INTO this game, not today's — the same
            captured-at-kickoff rule the schedule page follows. Absent for games
            played before context capture existed, which is honest: the save
            can't reconstruct it. */}
        {team.recordAtGame && (
          <span className="tnum type-eyebrow text-slate-400 dark:text-slate-500">
            {team.recordAtGame.wins}-{team.recordAtGame.losses}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header — helmet duel + hero score. Deliberately NOT a SurfaceCard:
          transparent ground so the helmets + score are the whole statement. */}
      <div className="relative flex items-center justify-between gap-2 overflow-visible sm:gap-4">
        {/* A glow under EACH helmet, in that team's own colour — it used to
            appear on the winning side alone, which made half the header look
            unlit. The result is still unmistakable from the score's opacity and
            the colour rule under each name, so the glow is free to be pure
            staging. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 0% 50%, color-mix(in srgb, ${awayColor} 14%, transparent), transparent 60%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 100% 50%, color-mix(in srgb, ${homeColor} 14%, transparent), transparent 60%)`,
          }}
        />
        {/* Sparks drift in from the winner's outer edge, across their glow and
            behind their helmet, and are masked out well before the score column
            — see .hero-sparks. Only ever on the winning side, and only once a
            game has actually been played: that's what makes it read as
            celebration rather than as decoration. */}
        {winnerColor && (
          <div
            aria-hidden
            className={`hero-sparks pointer-events-none ${homeWon ? 'right-0' : 'left-0'}`}
            data-side={homeWon ? 'right' : 'left'}
          >
            <span className="hero-spark-field" data-layer="far" />
            <span className="hero-spark-field" data-layer="near" />
          </div>
        )}
        <TeamFlank team={away} sideName="left" teamColor={awayColor} />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2">
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
              {/* The scoreboard convention: the marker rides beside the score,
                  because "20–23" and "20–23 OT" are different games. */}
              {detail.isOvertime && (
                <span className="type-eyebrow self-center text-slate-400 dark:text-slate-500">OT</span>
              )}
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

      {/*
        THE BODY IS THREE DESTINATIONS, NOT ONE COLUMN. Team stats, player
        stats and the photographs used to stack, so a game's media was always a
        scroll away and the player box score sat below a wall of team bars. A
        SUB-MENU rather than a mode switch: these are places within the game,
        and the app marks a place with the glider.
      */}
      <div className="overflow-x-auto">
        <GliderNav
          activeIndex={GAME_VIEWS.findIndex((v) => v.key === view)}
          emphasis="quiet"
          ariaLabel="Game sections"
          itemsClassName="gap-1.5"
        >
          {GAME_VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={gliderItemClass(v.key === view, 'px-3.5 py-1.5')}
            >
              {v.label}
            </button>
          ))}
        </GliderNav>
      </div>

      {/*
        SCOPED TO THE TWO STAT VIEWS. This used to guard the whole body, so it
        printed above whichever destination was open — including Scoring, which
        has its own empty state and was left explaining itself underneath a card
        saying the game hadn't happened. Media was never affected only because it
        sits outside this block entirely.

        `!statBars` stays part of the condition for team/player because both are
        built from the team stat lines; it deliberately does NOT gate the score
        summary, which comes from a different snapshot and can be complete on a
        game whose stat caches never arrived.
      */}
      {(view === 'team' || view === 'player') &&
        (!played || !statBars ? (
        <SurfaceCard>
          <div className="rounded-xl border border-dashed border-slate-300/80 px-5 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            This game has not been played yet. Box score and stat surfaces will populate after the result is imported.
          </div>
        </SurfaceCard>
      ) : (
        <>
          {view === 'team' && (
          <>
          {/* Quarter by quarter — away/home rows, each keyed with its team color */}
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Quarter by quarter</h3>
              {/*
                Said once, here, because it's the question the OT column raises:
                the save stores one overtime total per side, not a period-by-
                period split, so a double overtime is one column. Better to
                explain the column than to leave someone counting periods that
                aren't there.
              */}
              {detail.isOvertime && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Overtime is a single total — the save doesn&apos;t break it out by period.
                </p>
              )}
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
                    {detail.isOvertime && (
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em]">OT</th>
                    )}
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
                      {detail.isOvertime && (
                        <td className="proportional-nums px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                          {entry.row.overtimePoints}
                        </td>
                      )}
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
                {/* The key has to use the SAME fill the bars do, or it names the
                    wrong team the moment the visitor falls back. */}
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ backgroundColor: awayBarColor }} />{away.name}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ backgroundColor: homeBarColor }} />{home.name}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-200/70 border border-slate-200/80 bg-slate-50/60 dark:divide-white/5 dark:border-slate-800 dark:bg-white/5">
              {statBars.map((bar) => (
                <StatBar
                  key={bar.label}
                  {...bar}
                  leftColor={awayBarColor}
                  rightColor={homeBarColor}
                />
              ))}
            </div>
          </SurfaceCard>
          </>
          )}

          {view === 'player' && (
          <>
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
                  collapsible
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
                  collapsible
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
                  collapsible
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
                  collapsible
                />
              )}
            </>
          )}
          </>
          )}
        </>
        ))}

      {/*
        Renders for an unplayed game too, and says so itself — the shared
        "not played yet" card no longer covers this view, and a tab that goes
        blank reads as broken.
      */}
      {view === 'scoring' && (
        <ScoreSummary
          played={played}
          plays={detail.scoringPlays ?? []}
          home={home}
          away={away}
          homeColor={homeColor}
          awayColor={awayColor}
          roster={roster ?? []}
          dynastyId={id}
          seasonId={seasonId}
        />
      )}

      {/* Auto-populated from Media-page tags: every upload linked to this game. Hidden when empty — the Media page is the hub; this is a bonus surface. */}
      {view === 'media' &&
        (media.length > 0 ? (
          <SurfaceCard>
            <MediaGallery dynastyId={id} items={media} hideGameChip />
          </SurfaceCard>
        ) : (
          /* A destination that leads nowhere is worse than one that says why. */
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Media</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No photographs are tagged to this game yet. Tag an upload to it on the Media page and it appears here.
            </p>
          </SurfaceCard>
        ))}
    </div>
  );
}
