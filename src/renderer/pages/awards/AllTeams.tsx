import { useMemo, useState } from 'react';
import { InfoHint } from '../../components/ui/InfoHint';
import { ConferenceMark } from '../../components/common/ConferenceMark';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatTile } from '../../components/ui/StatTile';
import { PlayerNameButton, TeamLine } from './AwardsShared';
import { useTheme } from '../../theme/ThemeProvider';
import { getHonorKind, getHonorTier, type HonorKind, type HonorTier } from '../../lib/awardFormat';
import { useAwardsOverview } from '../../data/useAwardsOverview';
import type { AwardsOverview } from '../../../shared/types';

function TeamHonorSummary({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <StatTile key={item.label} label={item.label} value={String(item.value)} />
      ))}
    </div>
  );
}

type HonorPhase = 'postseason' | 'preseason';

const PHASE_OPTIONS: { value: HonorPhase; label: string }[] = [
  { value: 'postseason', label: 'Postseason' },
  { value: 'preseason', label: 'Preseason' },
];

const KIND_OPTIONS: { value: HonorKind; label: string }[] = [
  { value: 'all-american', label: 'All-American' },
  { value: 'all-conference', label: 'All-Conference' },
];

const TIER_OPTIONS: { value: HonorTier; label: string }[] = [
  { value: 'first', label: 'First Team' },
  { value: 'second', label: 'Second Team' },
  { value: 'freshman', label: 'Freshman' },
];

/** Honest label distinguishing this from "every school" — these are the leaguewide honor TEAMS (All-American/All-Conference rosters), not a school directory. */
export function AllTeams() {
  const { dynastyId, seasonId, awards } = useAwardsOverview();
  if (awards === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading awards...</p>;
  if (awards === null) return <p className="text-slate-500 dark:text-slate-400">No awards recorded for this season yet.</p>;
  return <AllTeamsContent dynastyId={dynastyId} seasonId={seasonId} awards={awards} />;
}

function AllTeamsContent({ dynastyId, seasonId, awards }: { dynastyId: string; seasonId: number | undefined; awards: AwardsOverview }) {
  const { appearance } = useTheme();
  const [phase, setPhase] = useState<HonorPhase>('postseason');
  const [kind, setKind] = useState<HonorKind>('all-american');
  const [tier, setTier] = useState<HonorTier>('first');
  const [conference, setConference] = useState<string>(awards.userConferenceName ?? awards.conferences[0] ?? '');

  const isPreseason = phase === 'preseason';
  // Preseason has no freshman team in the save, so drop that tier and never
  // let a leftover 'freshman' selection filter to an empty preseason list.
  const tierOptions = isPreseason ? TIER_OPTIONS.filter((t) => t.value !== 'freshman') : TIER_OPTIONS;
  const effectiveTier: HonorTier = isPreseason && tier === 'freshman' ? 'first' : tier;
  const roster = isPreseason ? awards.preseasonHonorsRoster : awards.honorsRoster;

  const filtered = useMemo(() => {
    return roster.filter((entry) => {
      if (getHonorKind(entry.awardType) !== kind) return false;
      if (getHonorTier(entry.awardType) !== effectiveTier) return false;
      if (kind === 'all-conference' && entry.conferenceName !== conference) return false;
      return true;
    });
  }, [roster, kind, effectiveTier, conference]);

  const summaryItems = isPreseason
    ? [
        { label: `${awards.teamName} Preseason First Team All-Americans`, value: awards.preseasonTeamHonorCounts.allAmericanFirst },
        { label: `${awards.teamName} Preseason Second Team All-Americans`, value: awards.preseasonTeamHonorCounts.allAmericanSecond },
        { label: `${awards.teamName} Preseason First Team All-Conference`, value: awards.preseasonTeamHonorCounts.allConferenceFirst },
        { label: `${awards.teamName} Preseason Second Team All-Conference`, value: awards.preseasonTeamHonorCounts.allConferenceSecond },
      ]
    : [
        { label: `${awards.teamName} First Team All-Americans`, value: awards.teamHonorCounts.allAmericanFirst },
        { label: `${awards.teamName} Second Team All-Americans`, value: awards.teamHonorCounts.allAmericanSecond },
        { label: `${awards.teamName} Freshman All-Americans`, value: awards.teamHonorCounts.allAmericanFreshman },
        { label: `${awards.teamName} First Team All-Conference`, value: awards.teamHonorCounts.allConferenceFirst },
        { label: `${awards.teamName} Second Team All-Conference`, value: awards.teamHonorCounts.allConferenceSecond },
        { label: `${awards.teamName} Freshman All-Conference`, value: awards.teamHonorCounts.allConferenceFreshman },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          <span>All-America &amp; All-Conference Teams</span>
          <InfoHint label="About honor teams">Honor teams selected leaguewide — not a directory of every school.</InfoHint>
        </h3>
        <div className="mt-4">
          <TeamHonorSummary items={summaryItems} />
        </div>
      </div>

      <SurfaceCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 p-5 dark:border-white/5">
          <select
            value={phase}
            onChange={(event) => {
              const next = event.target.value as HonorPhase;
              setPhase(next);
              if (next === 'preseason' && tier === 'freshman') setTier('first');
            }}
            className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as HonorKind)}
            className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={effectiveTier}
            onChange={(event) => setTier(event.target.value as HonorTier)}
            className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
          >
            {tierOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {kind === 'all-conference' && (
            <>
              <select
                value={conference}
                onChange={(event) => setConference(event.target.value)}
                className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
              >
                {awards.conferences.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {conference && (
                <ConferenceMark conferenceName={conference} background={appearance} context="picker" alt={conference} />
              )}
            </>
          )}
          <span className="ml-auto text-sm text-slate-400 dark:text-slate-500">{filtered.length} players</span>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No players match this selection.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Pos.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">School</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, index) => (
                  <tr
                    key={`${entry.playerId}-${index}`}
                    className={
                      entry.isUserTeam
                        ? 'border-b border-l-4 border-white/60 bg-[var(--team-primary)]/10 dark:border-white/5'
                        : 'border-b border-slate-200/70 bg-slate-50/80 dark:border-white/5 dark:bg-white/5'
                    }
                    style={entry.isUserTeam ? { borderLeftColor: 'var(--team-primary)' } : undefined}
                  >
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{entry.position}</td>
                    <td className="px-4 py-3">
                      <PlayerNameButton
                        dynastyId={dynastyId}
                        playerId={entry.playerId}
                        seasonId={seasonId}
                        name={entry.playerName}
                        position={entry.position}
                        teamDisplayName={entry.teamDisplayName}
                        className={entry.isUserTeam ? 'font-semibold text-slate-950 dark:text-white' : 'font-medium text-slate-900 dark:text-white'}
                        showPortrait
                        portraitAssetName={entry.portraitAssetName}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TeamLine teamName={entry.teamDisplayName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
