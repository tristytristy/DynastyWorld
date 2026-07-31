import { useEffect, useState } from 'react';
import { GRADIENT_TEAM_BLOCK } from '../lib/gradients';
import type { ReactNode, SyntheticEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { MASTHEAD_ART_SLOT } from '../components/common/PageMasthead';
import { boundsFor, markGeometry } from '../lib/markBounds';
import { getLogoPath } from '../lib/assetMapping';
import { TopPlayersCard } from '../components/common/TopPlayersCard';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { ProgramEditorModal } from '../components/common/ProgramEditorModal';
import { useTheme } from '../theme/ThemeProvider';
import {
  getBowlLogoPath,
  getPostseasonAppearanceImagePath,
  getTrophyImagePath,
} from '../lib/trophyAssetMapping';
import type { BowlAppearance, GameSummary, LeagueTeamHonors, LeagueTeamRoster, RankingsOverview, RosterPlayer, SeasonOverview, TeamTrophies, Trophy } from '../../shared/types';

function rankLabel(rank: number | null): string {
  return rank === null ? 'Unranked' : `#${rank}`;
}

/**
 * Bowl asset matching is a normalized-name guess (see trophyAssetMapping.ts) —
 * a handful of real bowls (confirmed: Bahamas Bowl, Camellia Bowl) aren't in
 * the asset pack under any matching filename. Rather than showing a broken
 * image icon, fail over to the generic bowl mark at render time.
 */
function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

/**
 * A trophy in the masthead's case, at the FULL height of the row.
 *
 * No caption. The name under a 64px thumbnail was carrying the whole message,
 * which meant the trophy itself was decoration next to it — the wrong way round
 * for the one thing on this page worth celebrating. Sized to the same slot as
 * the team mark so the two read as equals, with the name moved to the tooltip
 * rather than deleted (it's still the accessible label).
 */
function TrophyBadge({ trophy }: { trophy: Trophy }) {
  const imagePath = getTrophyImagePath(trophy);
  if (!imagePath) return null;

  return (
    <img
      src={imagePath}
      alt={trophy.label}
      title={trophy.label}
      onError={trophy.kind === 'bowl-win' ? fallbackToDefaultBowlLogo : undefined}
      style={{ height: MASTHEAD_ART_SLOT.logo.maxHeight }}
      className="w-auto shrink-0 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.25)]"
      draggable={false}
    />
  );
}

function BowlAppearanceBadge({ bowl }: { bowl: BowlAppearance }) {
  const { appearance } = useTheme();
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <img
        src={getPostseasonAppearanceImagePath(bowl, appearance)}
        alt={bowl.bowlName}
        onError={bowl.kind === 'bowl' ? fallbackToDefaultBowlLogo : undefined}
        className="h-28 w-28 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.3)]"
        draggable={false}
      />
      <p className="max-w-[8rem] text-[10px] font-semibold uppercase leading-tight tracking-wide opacity-80">
        {bowl.bowlName}
      </p>
    </div>
  );
}

/** Shared affordance for opening the program-budget editor (Program Points / NIL funding). */
/** The masthead's action buttons. One class, so the stack can't drift apart. */
const MASTHEAD_BTN =
  'inline-flex w-full shrink-0 items-center justify-center gap-2 border border-slate-300/80 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition duration-fast ease-standard hover:border-[var(--team-primary)] hover:text-[var(--team-accent-text)] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300';

/**
 * Program editor above Program budget, both the same width.
 *
 * `w-full` inside a stretched column rather than each sizing to its own text —
 * two buttons of different widths stacked on top of each other reads as an
 * accident, and "Program editor" and "Program budget" are near enough in length
 * that matching them costs nothing.
 */
function MastheadActions({ onEditor, onBudget }: { onEditor: () => void; onBudget: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2">
      <button type="button" onClick={onEditor} className={MASTHEAD_BTN}>
        Program editor
      </button>
      <button type="button" onClick={onBudget} className={MASTHEAD_BTN}>
        Program budget
      </button>
    </div>
  );
}

/**
 * The team mark at the SAME size every other team page's masthead uses. This
 * page's header is hand-rolled rather than a `PageMasthead` (it carries
 * trophies and the record banner, which that component has no slot for), and it
 * had been rendering a plain 128px `TeamLogo` — visibly smaller than the marks
 * on Roster, Schedule and the rest.
 *
 * It borrows PageMasthead's own slot and geometry rather than picking a bigger
 * number: the art floats inside a much larger transparent canvas and fills a
 * different fraction of it for every school (a 3.19x spread), so matching by
 * raw box size would leave Auburn and Texas State visibly different heights.
 * See lib/markBounds.ts. `slotLeft: 0` because here the slot IS this element,
 * not a position inside a wider card.
 */
function MastheadMark({ teamAssetName }: { teamAssetName: string }) {
  const { appearance } = useTheme();
  const src = getLogoPath(teamAssetName, appearance);
  const geometry = markGeometry(boundsFor(src, 'logo'), {
    ...MASTHEAD_ART_SLOT.logo,
    slotLeft: 0,
    textGap: 0,
  });

  return (
    <div
      className="relative shrink-0"
      style={{ width: MASTHEAD_ART_SLOT.logo.maxWidth, height: MASTHEAD_ART_SLOT.logo.maxHeight }}
    >
      <img src={src} alt={teamAssetName} draggable={false} className="absolute max-w-none" style={geometry.style} />
    </div>
  );
}

/**
 * Team Hub's header, shared by the user's own hub and a browsed league team so
 * the two can't drift.
 *
 * The row is `items-end`: the actions column (Program budget) lines up with the
 * BOTTOM of the identity block — i.e. with the coach line — instead of floating
 * at the vertical centre of a header whose height is set by the mark.
 */
function TeamHubMasthead({
  teamName,
  headCoach,
  trophies,
  actions,
}: {
  teamName: string;
  headCoach?: { firstName: string; lastName: string } | null;
  trophies?: Trophy[];
  actions?: ReactNode;
}) {
  return (
    <SurfaceCard>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
        <MastheadMark teamAssetName={teamName} />
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-6">
          <div className="min-w-0">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Team Hub</p>
            <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">{teamName}</h2>
            {headCoach && (
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {headCoach.firstName} {headCoach.lastName} · Head Coach
              </p>
            )}
          </div>
          {trophies && trophies.length > 0 && (
            <div className="flex flex-wrap items-end gap-5 border-l border-slate-200/80 pl-6 dark:border-slate-800">
              {trophies.map((trophy) => (
                <TrophyBadge key={trophy.id ?? trophy.kind} trophy={trophy} />
              ))}
            </div>
          )}
          {actions && <div className="ml-auto shrink-0">{actions}</div>}
        </div>
      </div>
    </SurfaceCard>
  );
}

/**
 * The record banner is a SIBLING of the masthead card, not a child of it
 * (2026-07-29, user direction). Inside the card it inherited the card's `p-5`,
 * so it sat 20px inside the stat tiles below it on both edges — the one block
 * on the page that didn't line up with anything. As its own block it spans the
 * same column as everything else.
 *
 * Hard edges with the signature cut corner, matching the tiles it now aligns
 * with; the old `rounded-xl` was the only rounded surface left on the page. The
 * drop-shadow went with it — clip-path clips box-shadow (see `.corner-cut`).
 */
function OverallRecordBanner({
  record,
  conferenceRecord,
  trailing,
}: {
  record: { wins: number; losses: number };
  conferenceRecord: { wins: number; losses: number };
  trailing?: ReactNode;
}) {
  return (
    <div className={`corner-cut overflow-hidden ${GRADIENT_TEAM_BLOCK} p-5 text-[var(--team-on-primary)]`}>
      <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <p className="proportional-nums text-5xl font-semibold tracking-tight">
            {record.wins}-{record.losses}
          </p>
          <p className="text-sm opacity-80">
            Conference {conferenceRecord.wins}-{conferenceRecord.losses}
          </p>
        </div>
        {trailing}
      </div>
    </div>
  );
}

/**
 * Recent | Upcoming, split by a hairline (2026-07-29, user direction). The
 * divider is a real 1px grid column rather than a border on either card, so it
 * sits centred in the gap and spans the taller of the two — and it collapses
 * with the columns at narrow widths, where the two cards stack and a vertical
 * rule would mean nothing.
 */
function GamesPair({ recent, upcoming }: { recent: ReactNode; upcoming: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1px_1fr]">
      {recent}
      <div aria-hidden className="hidden bg-[color:var(--section-divider)] xl:block" />
      {upcoming}
    </div>
  );
}

/** The rule closing off a stacked-then-paired run of sections, where the automatic card-to-card divider can't reach (see globals.css). */
function SectionRule() {
  return <div aria-hidden className="h-px bg-[color:var(--section-divider)]" />;
}

function GameRow({ game }: { game: GameSummary }) {
  const resultColor =
    game.result === 'W'
      ? 'text-green-600 dark:text-green-400'
      : game.result === 'L'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5">
      <span className="text-slate-700 dark:text-slate-200">
        Week {game.week} {game.isHome ? 'vs' : '@'} {game.opponent}
      </span>
      {game.result ? (
        <span className={`font-semibold ${resultColor}`}>
          {game.result} {game.teamScore}-{game.opponentScore}
        </span>
      ) : (
        <span className={resultColor}>Upcoming</span>
      )}
    </li>
  );
}

/**
 * League-mode Team Hub — now identical in layout to the user's own Team Hub:
 * the full overview (record, conference record, poll ranks, recruiting-class
 * rank, prestige, recent/upcoming games, top players, trophies), all sourced
 * from the same per-season snapshots via getLeagueTeamOverview. The only thing
 * still user-team-only is season-high ranking history (not tracked leaguewide).
 */
function LeagueTeamHub({ dynastyId, teamIndex, teamName, seasonId }: { dynastyId: string; teamIndex: number; teamName: string; seasonId?: number }) {
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<LeagueTeamRoster | null | undefined>(undefined);
  const [honors, setHonors] = useState<LeagueTeamHonors | null>(null);
  const { openPlayerModal } = usePlayerModal();
  const { openTeamBudgetEditor } = useEditorModal();

  useEffect(() => {
    let cancelled = false;
    setOverview(undefined);
    setRoster(undefined);
    setHonors(null);
    window.api.db.getLeagueTeamOverview(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setOverview(r));
    window.api.db.getLeagueTeamRoster(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setRoster(r));
    window.api.db.getLeagueTeamHonors(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setHonors(r));
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, seasonId]);

  const topPlayers = [...(roster?.players ?? [])].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10);
  const avgOvr =
    roster && roster.players.length > 0
      ? (roster.players.reduce((s, p) => s + p.overallRating, 0) / roster.players.length).toFixed(1)
      : '—';

  const teamTrophies: Trophy[] = [];
  if (honors?.nationalChampion) {
    teamTrophies.push({ kind: 'national-championship', label: 'National Champions', assetKey: null });
  }
  if (honors?.conferenceChampion && honors.conferenceName) {
    teamTrophies.push({
      kind: 'conference-championship',
      label: `${honors.conferenceName} Champions`,
      assetKey: honors.conferenceName,
    });
  }

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Hub...</p>;
  }

  return (
    <div className="space-y-6">
      <TeamHubMasthead
        teamName={teamName}
        headCoach={overview?.headCoach}
        trophies={teamTrophies}
        actions={
          /* Another team's hub: budget only. The program editor is for YOUR
             program — it's stored per team slot, so opening it here later is
             an entry point rather than a change of shape. */
          <button
            type="button"
            onClick={() => openTeamBudgetEditor({ dynastyId, teamIndex, teamLabel: teamName })}
            className={MASTHEAD_BTN}
          >
            Program budget
          </button>
        }
      />

      <OverallRecordBanner
        record={overview?.record ?? { wins: 0, losses: 0 }}
        conferenceRecord={overview?.conferenceRecord ?? { wins: 0, losses: 0 }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Conference record" value={`${overview?.conferenceRecord.wins ?? 0}-${overview?.conferenceRecord.losses ?? 0}`} />
        <StatTile label="Media poll" value={rankLabel(overview?.rankings.media ?? null)} />
        <StatTile label="Coaches poll" value={rankLabel(overview?.rankings.coaches ?? null)} />
        <StatTile label="CFP rank" value={rankLabel(overview?.rankings.cfp ?? null)} />
        <StatTile label="Recruiting class" value={rankLabel(overview?.recruitingClassRank ?? null)} />
        <StatTile label="Program prestige" value={overview?.teamPrestige == null ? 'Not available' : String(overview.teamPrestige)} />
        <StatTile label="Roster" value={String(roster?.players.length ?? 0)} />
        <StatTile label="Average OVR" value={avgOvr} />
      </div>

      <GamesPair
        recent={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recent games</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Latest results</h3>
            {!overview || overview.recentGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games played yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.recentGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
        upcoming={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Upcoming games</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">What is next</h3>
            {!overview || overview.upcomingGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.upcomingGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
      />

      <SectionRule />

      <TopPlayersCard
        players={roster?.players ?? []}
        teamAssetName={teamName}
        onSelect={(p) =>
          openPlayerModal(
            dynastyId,
            p.id,
            roster?.seasonId,
            topPlayers.map((x) => x.id),
            {
              name: `${p.firstName} ${p.lastName}`,
              position: p.position,
              teamDisplayName: teamName,
              portraitAssetName: p.portraitAssetName,
            },
            teamIndex,
          )
        }
      />
    </div>
  );
}

export function DynastyOverview() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [trophies, setTrophies] = useState<TeamTrophies | null | undefined>(undefined);
  const [rankings, setRankings] = useState<RankingsOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();
  const { openTeamBudgetEditor } = useEditorModal();
  const { openPlayerModal } = usePlayerModal();
  const [yearbookMsg, setYearbookMsg] = useState<string | null>(null);
  const [yearbookBusy, setYearbookBusy] = useState(false);
  const [programEditorOpen, setProgramEditorOpen] = useState(false);

  async function exportYearbook() {
    if (!id || seasonId === undefined) return;
    setYearbookBusy(true);
    setYearbookMsg(null);
    try {
      const result = await window.api.export.seasonYearbookToHtml(id, seasonId);
      setYearbookMsg(result.message);
    } finally {
      setYearbookBusy(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getTeamTrophies(id, seasonId).then((result) => {
      if (!cancelled) setTrophies(result);
    });
    window.api.db.getRankings(id, seasonId).then((result) => {
      if (!cancelled) setRankings(result);
    });
    window.api.db.getRoster(id, seasonId).then((result) => {
      if (!cancelled) setRoster(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (id && viewedTeamIndex !== null) {
    const teamName = leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team';
    return <LeagueTeamHub dynastyId={id} teamIndex={viewedTeamIndex} teamName={teamName} seasonId={seasonId} />;
  }

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Hub...</p>;
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

  // The user's own teamIndex isn't on SeasonOverview, but overview.teamName IS
  // userTeam.displayName (see getSeasonOverview) — the same field leagueTeams
  // carries — so this resolves the index for the budget editor. Null (button
  // hidden) only when league snapshots predate this season.
  const userTeamIndex = id ? (leagueTeams?.find((t) => t.displayName === overview.teamName)?.teamIndex ?? null) : null;

  return (
    <div className="space-y-6">
      {/* Season Yearbook moved to the foot of the page — see the export row at
          the bottom. It's an end-of-visit action, not part of the team's
          identity header, and stacked up here it crowded the masthead. */}
      <TeamHubMasthead
        teamName={overview.teamName}
        headCoach={overview.headCoach}
        trophies={trophies?.trophies}
        actions={
          userTeamIndex !== null && id ? (
            <MastheadActions
              onEditor={() => setProgramEditorOpen(true)}
              onBudget={() => openTeamBudgetEditor({ dynastyId: id, teamIndex: userTeamIndex, teamLabel: overview.teamName })}
            />
          ) : undefined
        }
      />

      <OverallRecordBanner
        record={overview.record}
        conferenceRecord={overview.conferenceRecord}
        trailing={trophies?.bowlAppearance ? <BowlAppearanceBadge bowl={trophies.bowlAppearance} /> : undefined}
      />

      {/* ONE grid, not two. The season-high tiles used to be their own grid, so
          the gap above that row was the page's 24px section spacing while the
          rows inside each grid were 12px apart — the third row visibly sat lower
          than the first two. Same grid, same gap everywhere. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Conference record"
          value={`${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses}`}
        />
        <StatTile label="Media poll" value={rankLabel(overview.rankings.media)} />
        <StatTile label="Coaches poll" value={rankLabel(overview.rankings.coaches)} />
        <StatTile label="CFP rank" value={rankLabel(overview.rankings.cfp)} />
        <StatTile label="Recruiting class" value={rankLabel(overview.recruitingClassRank)} />
        <StatTile
          label="Program prestige"
          value={overview.teamPrestige === null ? 'Not available' : String(overview.teamPrestige)}
        />
        {rankings && (
          <>
            <StatTile label="Season-High Media/AP" value={rankLabel(rankings.highestMediaPollRank)} />
            <StatTile label="Season-High Coaches" value={rankLabel(rankings.highestCoachesPollRank)} />
            <StatTile label="Season-High CFP" value={rankLabel(rankings.highestCfpRank)} />
          </>
        )}
      </div>

      <GamesPair
        recent={
          <SurfaceCard>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Recent games
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Latest results
                </h3>
              </div>
              <Link to={`/dynasty/${id}/schedule`} className="text-sm font-medium text-[var(--team-accent-text)] hover:underline">
                Schedule
              </Link>
            </div>
            {overview.recentGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games played yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.recentGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
        upcoming={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Upcoming games
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              What is next
            </h3>
            {overview.upcomingGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.upcomingGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
      />

      {/* Top players — the same shared card the league-team view uses (Phase 4 unification). */}
      {roster && roster.length > 0 && userTeamIndex !== null && (
        <SectionRule />
      )}
      {roster && roster.length > 0 && userTeamIndex !== null && (
        <TopPlayersCard
          players={roster}
          teamAssetName={overview.teamName}
          onSelect={(p) =>
            openPlayerModal(
              id ?? '',
              p.id,
              seasonId,
              [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10).map((x) => x.id),
              {
                name: `${p.firstName} ${p.lastName}`,
                position: p.position,
                teamDisplayName: overview.teamName,
                portraitAssetName: p.portraitAssetName,
              },
              userTeamIndex,
            )
          }
        />
      )}

      {/* Export row — the last thing on the page, where "I'm done reading this
          season, now save it" naturally belongs. */}
      {id && seasonId !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200/70 pt-6 dark:border-white/10">
          <button
            type="button"
            onClick={exportYearbook}
            disabled={yearbookBusy}
            title={`Export a shareable ${overview.seasonYear} Season in Review page`}
            className="inline-flex items-center gap-2 border border-slate-300/80 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
          >
            {yearbookBusy ? 'Exporting…' : `Export ${overview.seasonYear} Season Yearbook ↗`}
          </button>
          {yearbookMsg && <p className="text-xs text-slate-400 dark:text-slate-500">{yearbookMsg}</p>}
        </div>
      )}

      {id && userTeamIndex !== null && (
        <ProgramEditorModal
          open={programEditorOpen}
          onClose={() => setProgramEditorOpen(false)}
          dynastyId={id}
          teamIndex={userTeamIndex}
          teamName={overview.teamName}
        />
      )}
    </div>
  );
}
