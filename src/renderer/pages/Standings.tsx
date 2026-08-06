import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Select } from '../components/ui/Select';
import { ConferenceMark } from '../components/common/ConferenceMark';
import { TeamLink } from '../components/common/TeamLink';
import { getConferenceChampionshipTrophyPath } from '../lib/trophyAssetMapping';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useTheme } from '../theme/ThemeProvider';
import type { ConferenceStandingTeam, ConferenceStandingsGroup, StandingsOverview } from '../../shared/types';

function formatRank(rank: number | null): string {
  return rank ? `#${rank}` : 'NR';
}

function ConferenceLogoTile({
  conferenceName,
  appearance,
  label,
}: {
  conferenceName: string | null;
  appearance: 'light' | 'dark';
  label: string;
}) {
  return (
    <div className="flex h-[5.25rem] border border-transparent bg-transparent p-0">
      <div className="flex flex-1 items-center justify-center">
        {conferenceName ? (
          <ConferenceMark
            conferenceName={conferenceName}
            background={appearance}
            context="standings"
            alt={label}
          />
        ) : (
          <p className="text-center text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{label}</p>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-[5.25rem] flex-col border border-slate-200/80 bg-slate-50/85 px-4 py-3 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  conferenceChampionshipTrophyPath,
}: {
  team: ConferenceStandingTeam;
  conferenceChampionshipTrophyPath: string | null;
}) {
  return (
    <tr
      className={[
        'border-b border-white/60 last:border-b-0 dark:border-white/5',
        team.isUserTeam
          ? 'bg-[color:color-mix(in_srgb,var(--team-primary)_14%,transparent)]'
          : 'bg-slate-50/80 dark:bg-white/5',
      ].join(' ')}
    >
      <td className="proportional-nums px-5 py-4 font-semibold text-slate-900 dark:text-white">#{team.place}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <TeamLink teamIndex={team.teamIndex} teamName={team.teamName} nameClassName="truncate font-semibold text-slate-900 dark:text-white" />
            {/* No division-leader badge: this table is already grouped by
                division and sorted, so the team on top IS the leader. The chip
                restated the row's own position back to it. */}
            {team.isConferenceChampion && conferenceChampionshipTrophyPath && (
              <img
                src={conferenceChampionshipTrophyPath}
                alt="Conference champion"
                className="h-6 w-6 shrink-0 object-contain"
                draggable={false}
              />
            )}
          </div>
        </div>
      </td>
      <td className="proportional-nums px-5 py-4 text-slate-600 dark:text-slate-300">
        {team.conferenceWins}-{team.conferenceLosses}
      </td>
      <td className="proportional-nums px-5 py-4 text-slate-600 dark:text-slate-300">
        {team.overallWins}-{team.overallLosses}
      </td>
      <td className="proportional-nums px-5 py-4 text-slate-500 dark:text-slate-400">{formatRank(team.mediaPollRank)}</td>
      <td className="proportional-nums px-5 py-4 text-slate-500 dark:text-slate-400">{formatRank(team.coachesPollRank)}</td>
      <td className="proportional-nums px-5 py-4 text-slate-500 dark:text-slate-400">{formatRank(team.cfpRank)}</td>
    </tr>
  );
}

function StandingsTable({
  teams,
  conferenceChampionshipTrophyPath,
  caption,
}: {
  teams: ConferenceStandingTeam[];
  conferenceChampionshipTrophyPath: string | null;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto">
      {caption && (
        <p className="border-b border-slate-200/80 bg-slate-100/70 px-5 py-2.5 type-eyebrow text-slate-500 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400">
          {caption}
        </p>
      )}
      <table className="w-full min-w-[840px] text-base">
        <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
          <tr>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">#</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Team</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Conf</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Overall</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">AP</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Coaches</th>
            <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">CFP</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <TeamRow key={team.teamIndex} team={team} conferenceChampionshipTrophyPath={conferenceChampionshipTrophyPath} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Standings() {
  const { id } = useParams<{ id: string }>();
  const { appearance } = useTheme();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [standings, setStandings] = useState<StandingsOverview | null | undefined>(undefined);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setStandings(undefined);
    window.api.db.getStandings(id, seasonId).then((result) => {
      if (!cancelled) setStandings(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  useEffect(() => {
    if (!standings) return;
    if (standings.groups.length === 0) {
      setSelectedGroupId('');
      return;
    }

    const stillExists = standings.groups.some((group) => group.id === selectedGroupId);
    if (!selectedGroupId || !stillExists) {
      setSelectedGroupId(standings.userConferenceId ?? standings.groups[0].id);
    }
  }, [selectedGroupId, standings]);

  /*
    SHIFT + ← / → STEPS THROUGH CONFERENCES (user direction).

    That combination is the app's reserved "previous / next team", and this page
    deliberately takes it over: Standings is the one destination where the thing
    you page through is not a team but a conference, and switching the viewed
    TEAM here does nothing you can see — the table is the same table.

    CAPTURE PHASE, and that is what makes the override work rather than fight.
    The team switcher listens on `window` in the bubble phase, which runs last;
    a capture listener on `document` runs first, so stopping propagation there
    means the switcher never sees the keystroke and the two cannot both act on
    it. The guards below are copied from the switcher on purpose — a page that
    claims a shortcut has to honour the same "not while typing, not under an
    overlay" rules, or it reintroduces the bugs those guards exist to prevent.
  */
  useEffect(() => {
    const groups = standings?.groups ?? [];
    if (groups.length < 2) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? '')) return;
      // A modal or an open dropdown owns the keyboard while it is up.
      if (document.querySelector('[role="dialog"]')) return;
      if (document.querySelector('[role="listbox"]')) return;

      event.preventDefault();
      event.stopPropagation();
      setSelectedGroupId((current) => {
        const at = groups.findIndex((group) => group.id === current);
        const from = at === -1 ? 0 : at;
        // Wraps at both ends, so the conferences are a loop in either
        // direction rather than stopping dead at the last one — same rule the
        // team switcher uses, so the gesture feels identical.
        const next = (from + (event.key === 'ArrowRight' ? 1 : -1) + groups.length) % groups.length;
        return groups[next].id;
      });
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [standings]);

  const selectedGroup = useMemo<ConferenceStandingsGroup | null>(() => {
    if (!standings || standings.groups.length === 0) return null;
    return standings.groups.find((group) => group.id === selectedGroupId) ?? standings.groups[0];
  }, [selectedGroupId, standings]);

  if (standings === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading standings...</p>;
  }

  if (standings === null) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Standings not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (standings.groups.length === 0 || !selectedGroup) {
    return (
      <div className="space-y-6">
        <SurfaceCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Standings
              </p>
              <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
                Conference race snapshots for every season you import.
              </h2>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
          No conference standings data is available for this season yet.
        </SurfaceCard>
      </div>
    );
  }

  const conferenceChampionshipTrophyPath = selectedGroup.conferenceName
    ? getConferenceChampionshipTrophyPath(selectedGroup.conferenceName)
    : null;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Standings</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {standings.groups.length > 1 && (
              <Select
                value={selectedGroupId}
                onChange={setSelectedGroupId}
                ariaLabel="Conference"
                options={standings.groups.map((group) => ({ value: group.id, label: group.label }))}
              />
            )}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ConferenceLogoTile
          conferenceName={selectedGroup.conferenceName}
          appearance={appearance}
          label={selectedGroup.label}
        />
        <SummaryTile label="Teams in Top 25" value={String(selectedGroup.top25Count)} />
        <SummaryTile
          label="Record vs Non-Conference"
          value={`${selectedGroup.nonConferenceWins}-${selectedGroup.nonConferenceLosses}`}
        />
        <SummaryTile label="Overall Record" value={`${selectedGroup.overallWins}-${selectedGroup.overallLosses}`} />
      </div>

      {selectedGroup.divisions ? (
        <div className="space-y-4">
          {selectedGroup.divisions.map((division) => (
            <SurfaceCard key={division.name} className="overflow-hidden p-0">
              <StandingsTable
                teams={division.teams}
                conferenceChampionshipTrophyPath={conferenceChampionshipTrophyPath}
                caption={division.name}
              />
            </SurfaceCard>
          ))}
        </div>
      ) : (
        <SurfaceCard className="overflow-hidden p-0">
          <StandingsTable
            teams={selectedGroup.teams}
            conferenceChampionshipTrophyPath={conferenceChampionshipTrophyPath}
          />
        </SurfaceCard>
      )}
    </div>
  );
}
