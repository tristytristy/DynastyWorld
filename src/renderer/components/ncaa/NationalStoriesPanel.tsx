import { useMemo, useState } from 'react';
import { DashboardPanel, PanelEmpty, PanelSkeleton, RowButton } from './DashboardPanel';
import { TeamLogo } from '../common/TeamLogo';
import { resolveTeamIndex } from '../common/TeamLink';
import { useGameModal } from '../../data/GameModalProvider';
import { useTeamModalOptional } from '../../data/TeamModalProvider';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';
import { canonicalKey } from '../../lib/assetMapping';
import { notebookItems } from '../../lib/ncaaHubFormat';
import type { LeagueScoresView, NcaaHubGameFeature, NcaaHubOverview } from '../../../shared/types';

/**
 * Around the Nation — the week's real storylines, in three readings of the same
 * snapshot.
 *
 * Every line here is assembled from facts the hub already computed (results,
 * ranks, records, poll movement, conference standings). Nothing is inferred
 * about intent or momentum: there is no "controls its destiny" here, because
 * nothing in the save proves it.
 */

type StoryTab = 'national' | 'conference' | 'watchlist';

const TABS: { key: StoryTab; label: string }[] = [
  { key: 'national', label: 'National' },
  { key: 'conference', label: 'Conference' },
  { key: 'watchlist', label: 'Watchlist' },
];

interface Story {
  id: string;
  tag: string;
  headline: string;
  support: string | null;
  /** The team this line is about, for its mark and its destination. */
  teamName: string | null;
  /** Set only when the line IS a game — the row then opens that game. */
  game: NcaaHubGameFeature | null;
}

function score(game: NcaaHubGameFeature): string {
  if (game.homeScore === null || game.awayScore === null) return '';
  const home = game.homeScore;
  const away = game.awayScore;
  return home > away
    ? `${game.homeTeamName} ${home}, ${game.awayTeamName} ${away}`
    : `${game.awayTeamName} ${away}, ${game.homeTeamName} ${home}`;
}

function winnerOf(game: NcaaHubGameFeature): string | null {
  if (game.homeScore === null || game.awayScore === null || game.homeScore === game.awayScore) return null;
  return game.homeScore > game.awayScore ? game.homeTeamName : game.awayTeamName;
}

function nationalStories(hub: NcaaHubOverview): Story[] {
  const stories: Story[] = [];

  if (hub.upsetOfTheWeek) {
    stories.push({
      id: 'upset',
      tag: 'Upset of the week',
      headline: score(hub.upsetOfTheWeek),
      support: hub.upsetOfTheWeek.summary,
      teamName: winnerOf(hub.upsetOfTheWeek),
      game: hub.upsetOfTheWeek,
    });
  }

  if (hub.gameOfTheWeek) {
    stories.push({
      id: 'marquee',
      tag: 'Marquee result',
      headline: score(hub.gameOfTheWeek) || `${hub.gameOfTheWeek.awayTeamName} at ${hub.gameOfTheWeek.homeTeamName}`,
      support: hub.gameOfTheWeek.summary,
      teamName: winnerOf(hub.gameOfTheWeek),
      game: hub.gameOfTheWeek,
    });
  }

  if (hub.coachSpotlight) {
    stories.push({
      id: 'coach',
      tag: 'Coach spotlight',
      headline: hub.coachSpotlight.coachName,
      support: hub.coachSpotlight.reason,
      teamName: hub.coachSpotlight.teamName,
      game: null,
    });
  }

  if (hub.heismanFeature) {
    /*
      "Award Watch", not the feature's own label. The save's Heisman standing
      exists from week one and its top entry reads as the WINNER, which would
      have this row announcing a Heisman in September — months before the award
      is actually handed out. The race is real; the result isn't yet.
    */
    stories.push({
      id: 'heisman',
      tag: 'Award Watch',
      headline: hub.heismanFeature.playerName,
      support: `Heisman · ${hub.heismanFeature.position} · ${hub.heismanFeature.teamDisplayName}`,
      teamName: hub.heismanFeature.teamDisplayName,
      game: null,
    });
  }

  // The notebook's own tagged lines (unbeaten counts, poll movement, the next
  // slate, the recruiting pace-setter) round the feed out.
  for (const item of notebookItems(hub)) {
    stories.push({
      id: `notebook-${item.tag}`,
      tag: item.tag,
      headline: item.text,
      support: null,
      teamName: item.teamName,
      game: null,
    });
  }

  return stories;
}

function conferenceStories(hub: NcaaHubOverview): Story[] {
  const rankedByConference = new Map<string, number>();
  for (const entry of hub.top25) {
    if (!entry.conferenceName) continue;
    rankedByConference.set(entry.conferenceName, (rankedByConference.get(entry.conferenceName) ?? 0) + 1);
  }

  const stories: Story[] = [];

  // Leaders first, but only where a conference game has actually been played —
  // "leads at 0-0" is a table artefact, not a story.
  for (const leader of hub.conferenceLeaders.slice(0, 6)) {
    if (leader.conferenceWins + leader.conferenceLosses === 0) continue;
    const ranked = rankedByConference.get(leader.conferenceName) ?? 0;
    stories.push({
      id: `leader-${leader.conferenceName}`,
      tag: leader.conferenceName,
      headline: `${leader.teamName} leads at ${leader.conferenceWins}-${leader.conferenceLosses} in league play.`,
      support: [
        `${leader.overallWins}-${leader.overallLosses} overall`,
        leader.mediaRank ? `No. ${leader.mediaRank}` : null,
        ranked > 0 ? `${ranked} ranked team${ranked > 1 ? 's' : ''} in the conference` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      teamName: leader.teamName,
      game: null,
    });
  }

  // A conference matchup worth watching: both sides ranked and in the same
  // league, from the upcoming slate the hub already picked.
  for (const game of hub.upcomingGames) {
    if (game.homeRank === null || game.awayRank === null) continue;
    stories.push({
      id: `upcoming-${game.week}-${game.homeTeamName}`,
      tag: 'Ranked matchup',
      headline: `No. ${game.awayRank} ${game.awayTeamName} at No. ${game.homeRank} ${game.homeTeamName}`,
      support: game.summary,
      teamName: game.homeTeamName,
      game,
    });
  }

  return stories;
}

/**
 * WATCHLIST CRITERIA — deterministic, and deliberately not about brand:
 *
 *  1. An unbeaten team the media poll does not have in its top 10 (or has left
 *     unranked entirely) — the record is doing something the poll hasn't caught
 *     up with.
 *  2. A one-loss team outside the top 15, same reasoning, one rung down.
 *  3. Any ranked team that climbed 5+ spots in the last poll.
 *  4. The week's upset winner when it was itself unranked.
 *
 * No reputation, no conference tiering, nothing about "traditional powers":
 * every rule above is a number the snapshot already holds.
 */
function watchlistStories(hub: NcaaHubOverview): Story[] {
  const stories: Story[] = [];

  for (const team of hub.undefeatedWatch) {
    if (team.mediaRank !== null && team.mediaRank <= 10) continue;
    stories.push({
      id: `unbeaten-${team.teamName}`,
      tag: 'Still unbeaten',
      headline: `${team.teamName} is ${team.wins}-${team.losses}.`,
      support: [team.conferenceName, team.mediaRank ? `No. ${team.mediaRank} in the media poll` : 'Unranked']
        .filter(Boolean)
        .join(' · '),
      teamName: team.teamName,
      game: null,
    });
  }

  for (const team of hub.oneLossWatch) {
    if (team.mediaRank !== null && team.mediaRank <= 15) continue;
    stories.push({
      id: `oneloss-${team.teamName}`,
      tag: 'One loss, no notice',
      headline: `${team.teamName} is ${team.wins}-${team.losses}.`,
      support: [team.conferenceName, team.mediaRank ? `No. ${team.mediaRank}` : 'Unranked'].filter(Boolean).join(' · '),
      teamName: team.teamName,
      game: null,
    });
  }

  for (const entry of hub.top25) {
    if ((entry.rankMovement ?? 0) < 5) continue;
    stories.push({
      id: `riser-${entry.teamName}`,
      tag: 'Climbing',
      headline: `${entry.teamName} moved up ${entry.rankMovement} to No. ${entry.rank}.`,
      support: `${entry.wins}-${entry.losses}${entry.conferenceName ? ` · ${entry.conferenceName}` : ''}`,
      teamName: entry.teamName,
      game: null,
    });
  }

  const upset = hub.upsetOfTheWeek;
  const upsetWinner = upset ? winnerOf(upset) : null;
  if (upset && upsetWinner) {
    const winnerRank = upsetWinner === upset.homeTeamName ? upset.homeRank : upset.awayRank;
    if (winnerRank === null) {
      stories.push({
        id: 'watchlist-upset',
        tag: 'Out of nowhere',
        headline: score(upset),
        support: upset.summary,
        teamName: upsetWinner,
        game: upset,
      });
    }
  }

  return stories;
}

function StoryRow({
  story,
  onOpen,
}: {
  story: Story;
  onOpen: (() => void) | null;
}) {
  return (
    <RowButton onClick={onOpen} label={`${story.tag}: ${story.headline}`} className="items-start gap-2.5 py-2">
      {story.teamName ? (
        <TeamLogo
          team={{ assetName: story.teamName, label: story.teamName }}
          size="sm"
          className="!h-6 !w-6 shrink-0"
        />
      ) : (
        <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 bg-slate-300 dark:bg-slate-700" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {story.tag}
        </span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-900 dark:text-slate-100">
          {story.headline}
        </span>
        {story.support && (
          <span className="mt-0.5 block truncate text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {story.support}
          </span>
        )}
      </span>
      {onOpen && (
        <span aria-hidden="true" className="mt-1 shrink-0 text-slate-300 dark:text-slate-600">
          ›
        </span>
      )}
    </RowButton>
  );
}

export function NationalStoriesPanel({
  hub,
  scores,
  dynastyId,
  seasonId,
}: {
  hub: NcaaHubOverview | null | undefined;
  scores: LeagueScoresView | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const [tab, setTab] = useState<StoryTab>('national');
  const { openGameModal } = useGameModal();
  const teamModal = useTeamModalOptional();
  const viewed = useViewedTeamOptional();

  const stories = useMemo(() => {
    if (!hub) return [];
    if (tab === 'conference') return conferenceStories(hub);
    if (tab === 'watchlist') return watchlistStories(hub);
    return nationalStories(hub);
  }, [hub, tab]);

  // Built once per scores payload rather than per row: a story list re-renders
  // on every tab change and this is a 900-game scan.
  const gameIdByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const game of scores?.games ?? []) {
      map.set(`${game.week}~${canonicalKey(game.awayTeamName)}~${canonicalKey(game.homeTeamName)}`, game.gameId);
    }
    return map;
  }, [scores]);

  function destinationFor(story: Story): (() => void) | null {
    if (story.game) {
      const gameId = gameIdByKey.get(
        `${story.game.week}~${canonicalKey(story.game.awayTeamName)}~${canonicalKey(story.game.homeTeamName)}`,
      );
      if (gameId !== undefined) return () => openGameModal(dynastyId, gameId, seasonId);
    }
    if (story.teamName && teamModal && viewed?.leagueTeams) {
      const teamIndex = resolveTeamIndex(story.teamName, viewed.leagueTeams);
      if (teamIndex !== null) return () => teamModal.openTeamModal(dynastyId, teamIndex, seasonId);
    }
    return null;
  }

  return (
    <DashboardPanel
      title="Around the Nation"
      controls={
        <div role="tablist" aria-label="Story category" className="flex min-w-0 gap-1 overflow-x-auto border border-slate-200/80 p-0.5 dark:border-slate-800">
          {TABS.map(({ key, label }) => {
            const active = key === tab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      }
      bodyClassName="max-h-[320px] overflow-y-auto 3xl:max-h-[420px] 4xl:max-h-[560px] 5xl:max-h-[680px]"
    >
      {hub === undefined ? (
        <PanelSkeleton rows={4} />
      ) : stories.length === 0 ? (
        <PanelEmpty>
          {tab === 'watchlist'
            ? 'No unbeaten outsiders, big risers, or unranked upset winners in this snapshot yet.'
            : tab === 'conference'
              ? 'No conference games have been played in this snapshot yet.'
              : 'National storylines appear once the season has results to read.'}
        </PanelEmpty>
      ) : (
        <div className="divide-y divide-[var(--surface-raised-border)]">
          {stories.map((story) => (
            <StoryRow key={story.id} story={story} onOpen={destinationFor(story)} />
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
