import { useEffect, useMemo, useState } from 'react';
import { DashboardPanel, MovementChip, PanelEmpty, PanelSkeleton, RowButton } from './DashboardPanel';
import { TeamLogo } from '../common/TeamLogo';
import { resolveTeamIndex } from '../common/TeamLink';
import { useTeamModalOptional } from '../../data/TeamModalProvider';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';
import type { NcaaHubOverview, NcaaHubTop25Entry } from '../../../shared/types';

/**
 * The three polls the save actually keeps. "AP / Media" is deliberately
 * double-named: the app has always called this the media poll (it is
 * `MediaPoll_CurrentRank` in the save), and the reference scoreboard calls it
 * AP — renaming it in one place and not the other is how two names for one
 * number start to look like two numbers.
 */
type PollKey = 'media' | 'coaches' | 'cfp';

const POLL_LABELS: Record<PollKey, string> = {
  media: 'AP / Media',
  coaches: 'Coaches',
  cfp: 'CFP',
};

function listFor(hub: NcaaHubOverview, poll: PollKey): NcaaHubTop25Entry[] {
  if (poll === 'coaches') return hub.coachesTop25;
  if (poll === 'cfp') return hub.cfpTop25;
  return hub.top25;
}

function RankRow({
  entry,
  onOpen,
  showFlatMovement,
}: {
  entry: NcaaHubTop25Entry;
  onOpen: ((teamName: string) => void) | null;
  showFlatMovement: boolean;
}) {
  const record = `${entry.wins}-${entry.losses}`;
  return (
    <RowButton
      onClick={onOpen ? () => onOpen(entry.teamName) : null}
      label={`Open ${entry.teamName}, ranked ${entry.rank}, ${record}`}
      highlight={entry.isUserTeam}
      className="min-h-[30px] flex-1"
    >
      <span className="tnum w-5 shrink-0 text-right text-xs font-semibold text-slate-950 dark:text-white">
        {entry.rank}
      </span>
      <span className="w-6 shrink-0">
        <MovementChip entry={entry} showFlat={showFlatMovement} />
      </span>
      <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" className="!h-5 !w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900 dark:text-slate-100">
        {entry.teamName}
      </span>
      <span className="tnum shrink-0 text-xs text-slate-500 dark:text-slate-400">{record}</span>
    </RowButton>
  );
}

export function PollRankingsPanel({
  hub,
  dynastyId,
  seasonId,
}: {
  hub: NcaaHubOverview | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const modal = useTeamModalOptional();
  const viewed = useViewedTeamOptional();
  const [poll, setPoll] = useState<PollKey>('media');

  /*
    Which polls exist at all this season. The CFP is the one that genuinely
    comes and goes: every team reads 0 until the committee's first release, so
    `cfpTop25` is empty for most of the year and the tab must not be offered —
    a CFP tab that opens onto the media poll's teams would be a lie told
    silently.
  */
  const available = useMemo<PollKey[]>(() => {
    if (!hub) return ['media'];
    return (['media', 'coaches', 'cfp'] as PollKey[]).filter((key) => listFor(hub, key).length > 0);
  }, [hub]);

  // A season change can take the selected poll away with it (this year's CFP is
  // out, last year's wasn't) — fall back rather than render an empty panel.
  useEffect(() => {
    if (available.length > 0 && !available.includes(poll)) setPoll(available[0]);
  }, [available, poll]);

  const entries = hub ? listFor(hub, poll) : [];
  // Proof that a previous week exists at all: if nothing in the poll moved,
  // this is the preseason release and "unchanged" would be a claim about a week
  // that never happened.
  const pollHasMoved = entries.some((entry) => (entry.rankMovement ?? 0) !== 0);
  const openTeam =
    modal && viewed?.leagueTeams
      ? (teamName: string) => {
          const teamIndex = resolveTeamIndex(teamName, viewed.leagueTeams);
          if (teamIndex !== null) modal.openTeamModal(dynastyId, teamIndex, seasonId);
        }
      : null;

  return (
    <DashboardPanel
      title="College Football Top 25"
      /* The panel stretches to the column's full height (the column spans both
         grid rows) and the list scrolls inside it, so the poll fills the space
         beside the hero + stories instead of stopping short and leaving the
         left third of the page empty. */
      className="h-full"
      bodyClassName="flex flex-col overflow-y-auto"
      controls={
        hub && available.length > 1 ? (
          <div
            role="tablist"
            aria-label="Poll"
            className="flex min-w-0 gap-1 overflow-x-auto border border-slate-200/80 p-0.5 dark:border-slate-800"
          >
            {available.map((key) => {
              const active = key === poll;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPoll(key)}
                  className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    active
                      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {POLL_LABELS[key]}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      {hub === undefined ? (
        <PanelSkeleton rows={8} />
      ) : !hub || entries.length === 0 ? (
        <PanelEmpty>
          {poll === 'cfp'
            ? 'The committee has not released a CFP poll in this snapshot yet.'
            : 'No poll has been released in this season snapshot yet.'}
        </PanelEmpty>
      ) : (
        /* Every row GROWS to share whatever height the column has, so all 25
           land flush with the bottom of the stories panel instead of stopping
           two thirds of the way down. `min-h` is the floor that keeps a short
           window from squashing them into unreadable slivers — at that point
           the list scrolls instead. */
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--surface-raised-border)]">
          {entries.map((entry) => (
            <RankRow
              key={`${poll}-${entry.teamName}`}
              entry={entry}
              onOpen={openTeam}
              showFlatMovement={pollHasMoved}
            />
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
