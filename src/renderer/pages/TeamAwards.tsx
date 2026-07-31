import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PageMasthead } from '../components/common/PageMasthead';
import { TeamLogo } from '../components/common/TeamLogo';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import type {
  CoachOverview,
  RosterPlayer,
  SeasonOverview,
  TeamAwardCandidateScore,
  TeamAwardDefinitionSummary,
  TeamAwardHistorySeason,
  TeamAwardResult,
  TeamAwardSettings,
} from '../../shared/types';

type MinimalPlayer = Pick<
  RosterPlayer,
  'id' | 'firstName' | 'lastName' | 'position' | 'jerseyNumber' | 'schoolYear' | 'portraitAssetName'
>;

function deriveSeasonStatus(results: TeamAwardResult[], enabledIds: string[]): string {
  const relevant = results.filter((r) => enabledIds.includes(r.awardDefinitionId));
  if (relevant.length === 0) return 'Ready to Calculate';
  if (relevant.every((r) => r.status === 'finalized')) return 'Awards Finalized';
  if (relevant.every((r) => r.status === 'confirmed' || r.status === 'finalized')) return 'Ready to Finalize';
  if (relevant.some((r) => r.status === 'confirmed')) return 'Partially Confirmed';
  if (relevant.some((r) => r.status === 'calculated' || r.status === 'insufficientData')) return 'Recommendations Generated';
  return 'Ready to Calculate';
}

function PlayerChip({
  dynastyId,
  seasonId,
  player,
  subtitle,
  size = 'sm',
}: {
  dynastyId: string;
  seasonId?: number;
  player: MinimalPlayer;
  subtitle: string;
  size?: 'sm' | 'lg';
}) {
  const { openPlayerModal } = usePlayerModal();
  return (
    <button
      type="button"
      onClick={() => openPlayerModal(dynastyId, player.id, seasonId)}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-3 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <PlayerPortrait player={player} size={size === 'lg' ? 'lg' : 'sm'} />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-slate-900 dark:text-white ${size === 'lg' ? 'text-lg' : ''}`}>
          {player.firstName} {player.lastName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </button>
  );
}

function PlayerPicker({
  roster,
  excludeIds,
  onPick,
  onCancel,
}: {
  roster: RosterPlayer[];
  excludeIds?: number[];
  onPick: (playerId: number) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((p) => !excludeIds?.includes(p.id))
      .filter((p) => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [roster, query, excludeIds]);

  return (
    <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          placeholder="Search roster..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 border border-slate-200/80 bg-white/85 px-4 py-2 text-sm text-slate-700 outline-none focus:border-[var(--team-primary)] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={onCancel}
          className="border border-slate-300/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
      <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-3 text-sm text-slate-400">No matching players.</p>}
        {filtered.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onPick(player.id)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white dark:hover:bg-white/10"
          >
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {player.firstName} {player.lastName}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {player.position} #{player.jerseyNumber} — {player.schoolYear}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CalculationDetails({
  dynastyId,
  seasonId,
  scores,
  roster,
}: {
  dynastyId: string;
  seasonId?: number;
  scores: TeamAwardCandidateScore[];
  roster: Map<number, RosterPlayer>;
}) {
  const { openPlayerModal } = usePlayerModal();
  const ranked = [...scores]
    .filter((s) => s.eligibilityPassed)
    .sort((a, b) => b.normalizedScore - a.normalizedScore);
  const ineligible = scores.filter((s) => !s.eligibilityPassed);

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm dark:border-slate-800 dark:bg-white/5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Eligible candidates ({ranked.length})</p>
        <div className="mt-2 space-y-2">
          {ranked.map((score) => {
            const player = roster.get(score.playerId);
            return (
              <div key={score.playerId} className="rounded-lg border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {player && (
                      <PlayerPortrait
                        player={player}
                        size="sm"
                        onClick={() => openPlayerModal(dynastyId, score.playerId, seasonId)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => openPlayerModal(dynastyId, score.playerId, seasonId)}
                      className="truncate font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-slate-100"
                    >
                      {player ? `${player.firstName} ${player.lastName}` : `Player #${score.playerId}`}
                    </button>
                  </div>
                  <span className="proportional-nums font-semibold text-slate-900 dark:text-white">
                    {score.normalizedScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {score.components.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-2">
                      <span>
                        {c.label} (weight {(c.weight * 100).toFixed(0)}%)
                      </span>
                      <span className="proportional-nums">
                        {c.rawValue === null ? 'unavailable' : `${c.normalizedValue?.toFixed(1)} → ${c.weightedScore.toFixed(1)}`}
                      </span>
                    </div>
                  ))}
                </div>
                {score.missingInputs.length > 0 && (
                  <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
                    Calculated without: {score.missingInputs.join(', ')}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {ineligible.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Ineligible ({ineligible.length})
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {ineligible.map((score) => {
              const player = roster.get(score.playerId);
              return (
                <p key={score.playerId}>
                  {player ? `${player.firstName} ${player.lastName}` : `Player #${score.playerId}`}:{' '}
                  {score.eligibilityReasons.join(' ')}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AwardCard({
  dynastyId,
  seasonId,
  definition,
  result,
  roster,
  rosterById,
  onChanged,
  hero,
}: {
  dynastyId: string;
  seasonId: number;
  definition: TeamAwardDefinitionSummary;
  result: TeamAwardResult;
  roster: RosterPlayer[];
  rosterById: Map<number, RosterPlayer>;
  onChanged: (result: TeamAwardResult) => void;
  hero?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const isLocked = result.status === 'finalized';
  const isManual = definition.calculationMode === 'manual';

  async function run<T>(action: () => Promise<T>, onSuccess: (value: T) => void) {
    setBusy(true);
    setError(null);
    try {
      onSuccess(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
      setShowPicker(false);
    }
  }

  const recommendedPlayer = result.recommendedWinnerId !== null ? rosterById.get(result.recommendedWinnerId) : undefined;
  const selectedPlayer = result.selectedWinnerId !== null ? rosterById.get(result.selectedWinnerId) : undefined;
  const finalists = result.finalistIds.map((id) => rosterById.get(id)).filter((p): p is RosterPlayer => !!p);
  const recommendationChanged =
    result.status === 'confirmed' &&
    result.recommendedWinnerId !== null &&
    result.recommendedWinnerId !== result.selectedWinnerId;

  // The hero award used a team-coloured BORDER to stand out; sections carry no
  // border now, so the emphasis moved to a faint team wash — same signal, no frame.
  return (
    <SurfaceCard
      className={hero ? 'bg-[color-mix(in_srgb,var(--team-primary)_8%,var(--surface-primary))]' : ''}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500 ${hero ? 'text-xs' : 'text-[11px]'}`}>
            {definition.name}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{definition.description}</p>
        </div>
        {isLocked && (
          <span className="shrink-0 bg-emerald-100 px-3 py-1 type-eyebrow text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            Finalized
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {/* Manual award, no winner yet */}
      {isManual && result.status === 'notCalculated' && (
        <div className="mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">No winner selected yet.</p>
          {!showPicker ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowPicker(true)}
              className="mt-3 bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)]"
            >
              Select Winner
            </button>
          ) : (
            <PlayerPicker
                            roster={roster}
              onCancel={() => setShowPicker(false)}
              onPick={(playerId) =>
                run(
                  () => window.api.db.selectManualAwardWinner(dynastyId, seasonId, definition.id, playerId),
                  onChanged,
                )
              }
            />
          )}
        </div>
      )}

      {/* Automatic award, not yet calculated */}
      {!isManual && (result.status === 'notCalculated' || result.status === 'insufficientData') && (
        <div className="mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {result.status === 'insufficientData'
              ? 'Not enough eligible players with recorded statistics to recommend a winner yet.'
              : 'Not yet calculated.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => window.api.db.calculateTeamAward(dynastyId, seasonId, definition.id), onChanged)}
              className="bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] disabled:opacity-50"
            >
              {busy ? 'Calculating...' : result.status === 'insufficientData' ? 'Recalculate' : 'Calculate'}
            </button>
            {result.status === 'insufficientData' && (
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Select Winner Manually
              </button>
            )}
          </div>
          {showPicker && result.status === 'insufficientData' && (
            <PlayerPicker
              roster={roster}
              onCancel={() => setShowPicker(false)}
              onPick={(playerId) =>
                run(() => window.api.db.confirmTeamAwardWinner(dynastyId, seasonId, definition.id, playerId), onChanged)
              }
            />
          )}
        </div>
      )}

      {/* Automatic award, calculated but not confirmed */}
      {!isManual && result.status === 'calculated' && recommendedPlayer && (
        <div className="mt-4 space-y-3">
          <p className="type-eyebrow text-slate-400">Recommended Winner</p>
          <PlayerChip
            dynastyId={dynastyId}
            seasonId={seasonId}
            player={recommendedPlayer}
            subtitle={`${recommendedPlayer.position} #${recommendedPlayer.jerseyNumber} — ${recommendedPlayer.schoolYear}`}
            size={hero ? 'lg' : 'sm'}
          />
          {result.explanation && <p className="text-sm text-slate-600 dark:text-slate-300">{result.explanation}</p>}
          {finalists.length > 1 && (
            <div>
              <p className="type-eyebrow text-slate-400">Finalists</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {finalists.map((f) => (
                  <PlayerChip key={f.id} dynastyId={dynastyId} seasonId={seasonId} player={f} subtitle={`${f.position} #${f.jerseyNumber}`} />
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    window.api.db.confirmTeamAwardWinner(dynastyId, seasonId, definition.id, result.recommendedWinnerId as number),
                  onChanged,
                )
              }
              className="bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] disabled:opacity-50"
            >
              Confirm Winner
            </button>
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Select Different Winner
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {showDetails ? 'Hide Calculation' : 'View Calculation'}
            </button>
          </div>
          {showPicker && (
            <PlayerPicker
                            roster={roster}
              onCancel={() => setShowPicker(false)}
              onPick={(playerId) =>
                run(() => window.api.db.confirmTeamAwardWinner(dynastyId, seasonId, definition.id, playerId), onChanged)
              }
            />
          )}
        </div>
      )}

      {/* Confirmed or finalized */}
      {result.status === 'confirmed' || result.status === 'finalized' ? (
        selectedPlayer && (
          <div className="mt-4 space-y-3">
            <p className="type-eyebrow text-slate-400">
              {isLocked ? 'Team Award Winner (Finalized)' : 'Team Award Winner'}
            </p>
            <PlayerChip
              dynastyId={dynastyId}
              seasonId={seasonId}
              player={selectedPlayer}
              subtitle={`${selectedPlayer.position} #${selectedPlayer.jerseyNumber} — ${selectedPlayer.schoolYear}`}
              size={hero ? 'lg' : 'sm'}
            />
            {recommendationChanged && (
              <p className="rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Updated statistics now recommend a different player. Your confirmed winner has been preserved.
              </p>
            )}
            {!isLocked && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  Edit Selection
                </button>
                {!isManual && (
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {showDetails ? 'Hide Calculation' : 'View Calculation'}
                  </button>
                )}
              </div>
            )}
            {showPicker && !isLocked && (
              <PlayerPicker
                                roster={roster}
                excludeIds={result.selectedWinnerId !== null ? [result.selectedWinnerId] : undefined}
                onCancel={() => setShowPicker(false)}
                onPick={(playerId) =>
                  run(
                    () =>
                      isManual
                        ? window.api.db.selectManualAwardWinner(dynastyId, seasonId, definition.id, playerId)
                        : window.api.db.confirmTeamAwardWinner(dynastyId, seasonId, definition.id, playerId),
                    onChanged,
                  )
                }
              />
            )}
          </div>
        )
      ) : null}

      {showDetails && result.candidateScores.length > 0 && (
        <CalculationDetails dynastyId={dynastyId} seasonId={seasonId} scores={result.candidateScores} roster={rosterById} />
      )}
    </SurfaceCard>
  );
}

function SettingToggleButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
          : 'border border-slate-300/80 text-slate-500 dark:border-slate-700 dark:text-slate-400'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {label}
    </button>
  );
}

/**
 * Coaching-philosophy preferences for this dynasty (one row per dynasty, not
 * per season — see schema_v5_team_awards.sql). Freshman/Newcomer eligibility
 * toggles are shown but locked: RedshirtStatus's real values ("Previous" /
 * "Ineligible" / "Eligible") don't cleanly identify a "redshirt freshman"
 * without deeper verification, and no transfer/newcomer field exists in the
 * save at all — both stay honest rather than pretending to work.
 */
function TeamAwardsSettingsPanel({
  dynastyId,
  definitions,
  settings,
  onSaved,
}: {
  dynastyId: string;
  definitions: TeamAwardDefinitionSummary[];
  settings: TeamAwardSettings;
  onSaved: (settings: TeamAwardSettings) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function save(next: TeamAwardSettings) {
    setSaving(true);
    const saved = await window.api.db.saveTeamAwardSettings(dynastyId, next);
    setSaving(false);
    onSaved(saved);
  }

  function toggleAward(id: string) {
    const disabledAwardIds = settings.disabledAwardIds.includes(id)
      ? settings.disabledAwardIds.filter((x) => x !== id)
      : [...settings.disabledAwardIds, id];
    save({ ...settings, disabledAwardIds });
  }

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Team Awards Settings
          </p>
          
        </div>
        {saving && <span className="text-xs text-slate-400 dark:text-slate-500">Saving...</span>}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Calculation Timing</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SettingToggleButton
              active={settings.calculationTiming === 'postseasonOnly'}
              label="Postseason Only"
              onClick={() => save({ ...settings, calculationTiming: 'postseasonOnly' })}
            />
            <SettingToggleButton
              active={settings.calculationTiming === 'allowPreliminary'}
              label="Allow Preliminary"
              onClick={() => save({ ...settings, calculationTiming: 'allowPreliminary' })}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Postseason Only blocks calculation until every one of this season&apos;s scheduled games has a result.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto-Recalculate on Sync</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SettingToggleButton active={settings.autoRecalculate} label="On" onClick={() => save({ ...settings, autoRecalculate: true })} />
            <SettingToggleButton active={!settings.autoRecalculate} label="Off" onClick={() => save({ ...settings, autoRecalculate: false })} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Refreshes any award still awaiting confirmation after every sync. A confirmed or finalized winner is never touched.
          </p>
        </div>

        <div title="RedshirtStatus's real values don't cleanly identify a &quot;redshirt freshman&quot; yet — locked to True-only until verified.">
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">Freshman Eligibility</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SettingToggleButton active label="True Freshmen Only" onClick={() => {}} disabled />
            <SettingToggleButton active={false} label="True + Redshirt" onClick={() => {}} disabled />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Locked — the save&apos;s redshirt field doesn&apos;t cleanly identify a &quot;redshirt freshman&quot; yet.
          </p>
        </div>

        <div title="No transfer/newcomer field exists anywhere in the save.">
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">Newcomer Eligibility</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SettingToggleButton active label="Transfers Only" onClick={() => {}} disabled />
            <SettingToggleButton active={false} label="All First-Year" onClick={() => {}} disabled />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Locked — no transfer/newcomer field exists anywhere in the save; Newcomer of the Year stays a manual pick.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-white/10">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Awards in Play</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Turning an award off hides it from the live workflow here — it never deletes a past result.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {definitions
            .filter((d) => d.enabled && !d.retired)
            .map((def) => {
              const isOff = settings.disabledAwardIds.includes(def.id);
              return (
                <label
                  key={def.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm dark:border-slate-800"
                >
                  <input type="checkbox" checked={!isOff} onChange={() => toggleAward(def.id)} className="h-4 w-4" />
                  <span className={isOff ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}>
                    {def.name}
                  </span>
                </label>
              );
            })}
        </div>
      </div>
    </SurfaceCard>
  );
}

/** Confirmed/finalized winners across every full-data season in the archive — the "at a glance" companion to browsing each season individually via the nav's season switcher. */
function SeasonHistorySection({ dynastyId }: { dynastyId: string }) {
  const [history, setHistory] = useState<TeamAwardHistorySeason[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    window.api.db.getTeamAwardHistory(dynastyId).then((r) => {
      if (!cancelled) setHistory(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId]);

  if (history === undefined || history.length === 0) return null;

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">
        Season History
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
        Confirmed Team Awards winners, every season on record.
      </h3>
      <div className="mt-4 space-y-4">
        {history.map((season) => (
          <div
            key={season.seasonId}
            className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" />
              <p className="font-semibold text-slate-900 dark:text-white">
                {season.seasonYear} — {season.teamName}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {season.wins.map((win) => (
                <PlayerChip
                  key={win.awardDefinitionId}
                  dynastyId={dynastyId}
                  seasonId={season.seasonId}
                  player={{
                    id: win.playerId,
                    firstName: win.playerName.split(' ')[0] ?? win.playerName,
                    lastName: win.playerName.split(' ').slice(1).join(' '),
                    position: win.position,
                    jerseyNumber: 0,
                    schoolYear: '',
                    portraitAssetName: win.portraitAssetName,
                  }}
                  subtitle={`${win.awardName} — ${win.position}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function TeamAwards() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [coaches, setCoaches] = useState<CoachOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [definitions, setDefinitions] = useState<TeamAwardDefinitionSummary[] | undefined>(undefined);
  const [results, setResults] = useState<TeamAwardResult[] | undefined>(undefined);
  const [settings, setSettings] = useState<TeamAwardSettings | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!id || seasonId === undefined) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((r) => !cancelled && setOverview(r));
    window.api.db.getCoaches(id, seasonId).then((r) => !cancelled && setCoaches(r));
    window.api.db.getRoster(id, seasonId).then((r) => !cancelled && setRoster(r));
    window.api.db.getTeamAwardResults(id, seasonId).then((r) => !cancelled && setResults(r));
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  useEffect(() => {
    let cancelled = false;
    window.api.db.getTeamAwardDefinitions().then((d) => !cancelled && setDefinitions(d));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getTeamAwardSettings(id).then((s) => !cancelled && setSettings(s));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rosterById = useMemo(() => new Map((roster ?? []).map((p) => [p.id, p])), [roster]);

  function updateResult(updated: TeamAwardResult) {
    setResults((prev) => (prev ? prev.map((r) => (r.awardDefinitionId === updated.awardDefinitionId ? updated : r)) : prev));
  }

  if (!id) return null;

  if (overview === undefined || roster === undefined || definitions === undefined || results === undefined || settings === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Awards...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>;
  }

  if (seasonId === undefined || roster === null || results === null) {
    return <p className="text-slate-500 dark:text-slate-400">No roster data recorded for this season.</p>;
  }

  const enabledDefinitions = definitions.filter((d) => d.enabled && !d.retired && !settings.disabledAwardIds.includes(d.id));
  const disabledDefinitions = definitions.filter((d) => !d.enabled && !d.retired);
  const enabledIds = enabledDefinitions.map((d) => d.id);
  const seasonStatus = deriveSeasonStatus(results, enabledIds);
  const resultByAward = new Map(results.map((r) => [r.awardDefinitionId, r]));
  const readyToFinalize = seasonStatus === 'Ready to Finalize';
  const headCoachName = coaches?.headCoach ? `${coaches.headCoach.firstName} ${coaches.headCoach.lastName}` : null;

  async function handleFinalize() {
    if (!id || seasonId === undefined) return;
    const updated = await window.api.db.finalizeTeamAwards(id, seasonId);
    setResults(updated);
  }

  async function handleUnlock() {
    if (!id || seasonId === undefined) return;
    const updated = await window.api.db.unlockTeamAwards(id, seasonId);
    setResults(updated);
  }

  return (
    <div className="space-y-6">
      <PageMasthead
        eyebrow="Team Awards"
        title={overview.teamName}
        subtitle={`Season ${overview.seasonYear}${headCoachName ? ` — ${headCoachName}` : ''} — ${overview.record.wins}-${overview.record.losses} (${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses} conf.)`}
        mark={{ kind: 'helmet', teamAssetName: overview.teamName }}
        actions={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className="border border-slate-200/80 bg-slate-50/90 px-4 py-1.5 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
              {seasonStatus}
            </span>
            {readyToFinalize && (
              <button
                type="button"
                onClick={handleFinalize}
                className="bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)]"
              >
                Finalize Team Awards
              </button>
            )}
            {seasonStatus === 'Awards Finalized' && (
              <button
                type="button"
                onClick={handleUnlock}
                className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Unlock Awards
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="border border-slate-300/80 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {showSettings ? 'Hide Settings' : '⚙ Settings'}
            </button>
          </div>
        }
      />

      {showSettings && (
        <TeamAwardsSettingsPanel dynastyId={id} definitions={definitions} settings={settings} onSaved={setSettings} />
      )}

      {enabledDefinitions.map((def) => {
        const result = resultByAward.get(def.id);
        if (!result) return null;
        return (
          <AwardCard
            key={def.id}
            dynastyId={id}
            seasonId={seasonId}
            definition={def}
            result={result}
            roster={roster}
            rosterById={rosterById}
            onChanged={updateResult}
            hero={def.id === 'mvp'}
          />
        );
      })}

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          More Awards Coming
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {disabledDefinitions.map((def) => (
            <div key={def.id} className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-white/5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{def.name}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{def.disabledReason}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SeasonHistorySection dynastyId={id} />
    </div>
  );
}
