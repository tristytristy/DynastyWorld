import { useMemo, useState } from 'react';
import { DashboardPanel, PanelEmpty, PanelLink, PanelSkeleton, RowButton } from './DashboardPanel';
import { TeamLogo } from '../common/TeamLogo';
import { resolveTeamIndex } from '../common/TeamLink';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useTeamModalOptional } from '../../data/TeamModalProvider';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';
import type { NationalRecruit, NcaaHubOverview, RecruitingOverview } from '../../../shared/types';

/**
 * Recruiting News — the national board, the class rankings, and the user's own
 * class, in one panel.
 *
 * THE COMMITMENT TRUTH RULE lives here. `topSchools` is interest, not a
 * destination, and `commitScore` is a score, not a signature — so nothing in
 * this panel says a national prospect committed anywhere. The save DOES hold
 * that fact (every team's `CommittedPlayers` list), but only the user's own
 * board captures it at extraction time (`signedTeamDisplayName`, see
 * extract-recruits.ts); the national pool doesn't carry it. So the Commits tab
 * shows the user's proven timeline and says plainly what the snapshot cannot
 * tell it about everyone else.
 */

type RecruitTab = 'top' | 'commits' | 'classes' | 'mine';

const TABS: { key: RecruitTab; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'commits', label: 'Commits' },
  { key: 'classes', label: 'Classes' },
  { key: 'mine', label: 'My Team' },
];

function Stars({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="shrink-0 text-[11px] font-semibold text-amber-500 dark:text-amber-400" aria-label={`${count} stars`}>
      {'★'.repeat(count)}
    </span>
  );
}

function TopRecruitRow({
  recruit,
  onOpen,
}: {
  recruit: NationalRecruit;
  onOpen: () => void;
}) {
  const name = `${recruit.firstName} ${recruit.lastName}`;
  return (
    <RowButton
      onClick={onOpen}
      label={`Open ${name}, ${recruit.position}, national rank ${recruit.nationalRank}`}
      highlight={recruit.onUserBoard}
    >
      <span className="tnum w-6 shrink-0 text-right text-xs font-semibold text-slate-950 dark:text-white">
        {recruit.nationalRank > 0 ? recruit.nationalRank : '—'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{name}</span>
          <Stars count={recruit.stars} />
        </span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {recruit.position}
          {recruit.hometown ? ` · ${recruit.hometown}, ${recruit.homeState}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {recruit.topSchools.slice(0, 3).map((school) => (
          <TeamLogo
            key={school.teamIndex}
            team={{ assetName: school.teamName, label: school.teamName }}
            size="sm"
            className="!h-4 !w-4"
          />
        ))}
      </span>
    </RowButton>
  );
}

export function RecruitingNewsPanel({
  hub,
  nationalRecruits,
  recruiting,
  dynastyId,
  seasonId,
}: {
  hub: NcaaHubOverview | null | undefined;
  nationalRecruits: NationalRecruit[] | null | undefined;
  recruiting: RecruitingOverview | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const [tab, setTab] = useState<RecruitTab>('top');
  const { openPlayerModal } = usePlayerModal();
  const teamModal = useTeamModalOptional();
  const viewed = useViewedTeamOptional();

  // Ranked prospects only, best first. A national rank of 0 means unranked in
  // this pool, and sorting those to the top would put the least notable names
  // in the most prominent rows.
  const topRecruits = useMemo(() => {
    return [...(nationalRecruits ?? [])]
      .filter((recruit) => recruit.nationalRank > 0)
      .sort((a, b) => a.nationalRank - b.nationalRank)
      .slice(0, 10);
  }, [nationalRecruits]);

  function openRecruit(recruit: NationalRecruit, list: NationalRecruit[]) {
    // The player provider reroutes a recruit id to the Recruit Profile modal —
    // see its recruit guard. The fallback names the prospect's HOME TOWN as the
    // affiliation because a recruit has no team, and printing a school he is
    // merely interested in would read as a commitment.
    openPlayerModal(
      dynastyId,
      recruit.playerId,
      seasonId,
      list.map((entry) => entry.playerId),
      {
        name: `${recruit.firstName} ${recruit.lastName}`,
        position: recruit.position,
        teamDisplayName: [recruit.hometown, recruit.homeState].filter(Boolean).join(', ') || 'Uncommitted prospect',
        portraitAssetName: recruit.portraitAssetName,
      },
    );
  }

  const openTeam =
    teamModal && viewed?.leagueTeams
      ? (teamName: string) => {
          const teamIndex = resolveTeamIndex(teamName, viewed.leagueTeams);
          if (teamIndex !== null) teamModal.openTeamModal(dynastyId, teamIndex, seasonId);
        }
      : null;

  const summary = recruiting?.classSummary;

  return (
    <DashboardPanel
      title="Recruiting News"
      action={<PanelLink to={`/dynasty/${dynastyId}/recruiting`}>View recruiting</PanelLink>}
      controls={
        <div role="tablist" aria-label="Recruiting view" className="flex min-w-0 gap-1 overflow-x-auto border border-slate-200/80 p-0.5 dark:border-slate-800">
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
      {tab === 'top' &&
        (nationalRecruits === undefined ? (
          <PanelSkeleton rows={5} />
        ) : topRecruits.length === 0 ? (
          <PanelEmpty>
            No national recruit pool in this season snapshot — re-sync to capture it.
          </PanelEmpty>
        ) : (
          <div className="divide-y divide-[var(--surface-raised-border)]">
            {topRecruits.map((recruit) => (
              <TopRecruitRow
                key={recruit.playerId}
                recruit={recruit}
                onOpen={() => openRecruit(recruit, topRecruits)}
              />
            ))}
          </div>
        ))}

      {tab === 'commits' && (
        <div className="space-y-3">
          <p className="border border-dashed border-slate-300/80 px-3 py-2.5 text-[11px] leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            National commitment destinations aren&rsquo;t captured in this snapshot — the save records which school a
            prospect signed with, but only your own board stores it. Below is your team&rsquo;s proven commitment
            timeline, by the week each one committed.
          </p>
          {recruiting === undefined ? (
            <PanelSkeleton rows={3} />
          ) : !recruiting || recruiting.timeline.length === 0 ? (
            <PanelEmpty>No commitments to your class yet this season.</PanelEmpty>
          ) : (
            <div className="divide-y divide-[var(--surface-raised-border)]">
              {[...recruiting.timeline]
                .sort((a, b) => b.week - a.week)
                .slice(0, 8)
                .map((entry) => (
                  <RowButton
                    key={entry.playerId}
                    onClick={() =>
                      openPlayerModal(
                        dynastyId,
                        entry.playerId,
                        seasonId,
                        recruiting.timeline.map((item) => item.playerId),
                        {
                          name: entry.playerName,
                          position: entry.position,
                          teamDisplayName: recruiting.teamName,
                        },
                      )
                    }
                    label={`Open ${entry.playerName}, committed week ${entry.week}`}
                  >
                    <span className="tnum w-9 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                      Wk {entry.week}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {entry.playerName}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{entry.position}</span>
                    <Stars count={entry.stars} />
                  </RowButton>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === 'classes' &&
        (hub === undefined ? (
          <PanelSkeleton rows={5} />
        ) : !hub || hub.recruitingBuzz.length === 0 ? (
          <PanelEmpty>No class rankings are recorded in this season snapshot.</PanelEmpty>
        ) : (
          <div className="divide-y divide-[var(--surface-raised-border)]">
            {hub.recruitingBuzz.map((entry) => (
              <RowButton
                key={entry.teamName}
                onClick={openTeam ? () => openTeam(entry.teamName) : null}
                label={`Open ${entry.teamName}, No. ${entry.rank} recruiting class`}
                highlight={entry.isUserTeam}
              >
                <span className="tnum w-5 shrink-0 text-right text-xs font-semibold text-slate-950 dark:text-white">
                  {entry.rank}
                </span>
                <TeamLogo
                  team={{ assetName: entry.teamName, label: entry.teamName }}
                  size="sm"
                  className="!h-5 !w-5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                    {entry.teamName}
                  </span>
                  {entry.conferenceName && (
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {entry.conferenceName}
                      {entry.conferenceRank ? ` · No. ${entry.conferenceRank} in conference` : ''}
                    </span>
                  )}
                </span>
              </RowButton>
            ))}
          </div>
        ))}

      {tab === 'mine' &&
        (recruiting === undefined ? (
          <PanelSkeleton rows={4} />
        ) : !recruiting || !summary ? (
          <PanelEmpty>No recruiting board is captured for this season.</PanelEmpty>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Class', value: summary.nationalClassRank ? `#${summary.nationalClassRank}` : '—' },
                { label: 'In conf', value: summary.conferenceClassRank ? `#${summary.conferenceClassRank}` : '—' },
                { label: 'Signed', value: String(summary.signedCount) },
                { label: 'Avg ★', value: summary.averageStars === null ? '—' : summary.averageStars.toFixed(1) },
              ].map((tile) => (
                <div key={tile.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {tile.label}
                  </p>
                  <p className="tnum mt-0.5 font-display text-lg font-bold text-slate-950 dark:text-white">
                    {tile.value}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {summary.committedCount} committed · {recruiting.board.length} on the board
            </p>
            {recruiting.timeline.length > 0 && (
              <div className="divide-y divide-[var(--surface-raised-border)] border-t border-[var(--surface-raised-border)] pt-1">
                {[...recruiting.timeline]
                  .sort((a, b) => b.week - a.week)
                  .slice(0, 4)
                  .map((entry) => (
                    <RowButton
                      key={entry.playerId}
                      onClick={() =>
                        openPlayerModal(
                          dynastyId,
                          entry.playerId,
                          seasonId,
                          recruiting.timeline.map((item) => item.playerId),
                          { name: entry.playerName, position: entry.position, teamDisplayName: recruiting.teamName },
                        )
                      }
                      label={`Open ${entry.playerName}`}
                    >
                      <span className="tnum w-9 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        Wk {entry.week}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {entry.playerName}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{entry.position}</span>
                    </RowButton>
                  ))}
              </div>
            )}
          </div>
        ))}
    </DashboardPanel>
  );
}
