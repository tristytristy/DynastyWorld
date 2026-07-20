import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { useStadiumData } from '../../data/StadiumDataProvider';
import { DEFAULT_TEAM_STADIUMS } from '../../lib/stadiumData';
import { canonicalKey } from '../../lib/assetMapping';
import { AnchoredMenuPanel } from './AnchoredMenuPanel';

interface TeamEntry {
  key: string;
  team: string;
  overridden: boolean;
}

const NEW_TEAM_KEY = '__new__';

function useCombinedTeamList(overrides: Record<string, { team: string }>): TeamEntry[] {
  return useMemo(() => {
    const keys = new Set<string>([...Object.keys(DEFAULT_TEAM_STADIUMS), ...Object.keys(overrides)]);
    return Array.from(keys)
      .map((key) => ({
        key,
        team: (overrides[key] ?? DEFAULT_TEAM_STADIUMS[key]).team,
        overridden: key in overrides,
      }))
      .sort((a, b) => a.team.localeCompare(b.team));
  }, [overrides]);
}

export function StadiumDatabaseMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const { overrides, getStadium, getDefaultStadium, isOverridden, setOverride, resetOverride, resetAllOverrides } =
    useStadiumData();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draftTeam, setDraftTeam] = useState('');
  const [draftStadium, setDraftStadium] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftState, setDraftState] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const teamList = useCombinedTeamList(overrides);
  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teamList;
    return teamList.filter((entry) => entry.team.toLowerCase().includes(query));
  }, [teamList, search]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedKey(null);
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedKey === null) return;
    if (selectedKey === NEW_TEAM_KEY) {
      setDraftTeam('');
      setDraftStadium('');
      setDraftCity('');
      setDraftState('');
      return;
    }
    const entry = teamList.find((item) => item.key === selectedKey);
    if (!entry) return;
    const info = getStadium(entry.team);
    setDraftTeam(entry.team);
    setDraftStadium(info?.stadium ?? '');
    setDraftCity(info?.city ?? '');
    setDraftState(info?.state ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);


  const panelUnderlayClass = isDark
    ? 'bg-slate-950/78 shadow-[0_42px_120px_-44px_rgba(2,6,23,0.88)] backdrop-blur-[52px] backdrop-saturate-[1.55] backdrop-brightness-[0.28]'
    : 'bg-white/18 shadow-[0_42px_120px_-44px_rgba(15,23,42,0.72)] backdrop-blur-[44px] backdrop-saturate-[1.8] backdrop-brightness-[0.68]';
  const panelGradientClass = isDark
    ? 'border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(15,23,42,0.78)_18%,rgba(2,6,23,0.96)_100%)]'
    : 'border border-white/38 bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0.22)_16%,rgba(248,250,252,0.9)_100%)]';
  const panelShellClass = isDark
    ? 'border border-slate-800/90 bg-slate-950/96 shadow-[0_44px_120px_-44px_rgba(2,6,23,0.9)] backdrop-blur-2xl'
    : 'border border-white/72 bg-white/80 shadow-[0_40px_120px_-44px_rgba(15,23,42,0.45)] backdrop-blur-2xl';
  const sectionClass = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/84 p-4'
    : 'rounded-xl border border-slate-200/90 bg-white/72 p-4';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const strongTextClass = isDark ? 'text-white' : 'text-slate-900';
  const inputClass = isDark
    ? 'w-full rounded-lg border border-slate-700/85 bg-slate-950/84 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--team-primary)]'
    : 'w-full rounded-lg border border-slate-200/90 bg-white/85 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[var(--team-primary)]';
  const closeButtonClass = isDark
    ? 'border border-slate-700/85 bg-slate-950/94 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-slate-900 hover:text-white'
    : 'border border-slate-300/85 bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';
  const secondaryButtonClass = isDark
    ? 'border border-slate-700/85 bg-slate-950/92 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900'
    : 'border border-slate-300/80 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100';
  const rowBaseClass = isDark
    ? 'border-slate-800/70 hover:bg-white/5'
    : 'border-slate-200/70 hover:bg-slate-100/70';
  const rowActiveClass = isDark
    ? 'bg-white/10 border-[var(--team-primary)]'
    : 'bg-slate-100 border-[var(--team-primary)]';
  const badgeClass = isDark
    ? 'border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300'
    : 'border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-700';

  const isAddingNew = selectedKey === NEW_TEAM_KEY;
  const trimmedTeam = draftTeam.trim();
  const trimmedStadium = draftStadium.trim();
  const trimmedCity = draftCity.trim();
  const trimmedState = draftState.trim();
  const canSave = trimmedTeam.length > 0 && trimmedStadium.length > 0 && trimmedCity.length > 0 && trimmedState.length > 0;
  const selectedOverridden = selectedKey !== null && selectedKey !== NEW_TEAM_KEY ? isOverridden(draftTeam) : false;
  const selectedDefault =
    selectedKey !== null && selectedKey !== NEW_TEAM_KEY ? getDefaultStadium(draftTeam) : null;

  function handleSave() {
    if (!canSave) return;
    setOverride(trimmedTeam, { stadium: trimmedStadium, city: trimmedCity, state: trimmedState });
    setSelectedKey(canonicalKey(trimmedTeam));
  }

  function handleReset() {
    if (selectedKey === null || selectedKey === NEW_TEAM_KEY) return;
    resetOverride(draftTeam);
  }

  function handleResetAll() {
    if (window.confirm('Reset every stadium correction back to the built-in defaults? This cannot be undone.')) {
      resetAllOverrides();
      setSelectedKey(null);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Stadiums
      </button>

      <AnchoredMenuPanel anchorRef={triggerRef} open={isOpen} onClose={() => setIsOpen(false)} widthRem={42} isDark={isDark}>
        <div className="relative isolate">
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${panelUnderlayClass}`} />
            <div aria-hidden="true" className={`pointer-events-none absolute inset-[1px] ${panelGradientClass}`} />
            <div className={`relative overflow-hidden p-5 ${panelShellClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`type-eyebrow ${subtleTextClass}`}>
                    Stadium Database
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold tracking-tight ${strongTextClass}`}>
                    Correct or add stadium locations.
                  </h2>
                  <p className={`mt-2 text-sm leading-6 ${subtleTextClass}`}>
                    Edits are saved on this computer and apply across every dynasty. Nothing here changes the save file itself.
                  </p>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className={closeButtonClass} aria-label="Close stadium database">
                  Close
                </button>
              </div>

              <div className="mt-5 grid grid-cols-[13rem,1fr] gap-4">
                <section className={`flex max-h-[26rem] flex-col ${sectionClass}`}>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search teams..."
                    spellCheck={false}
                    className={`${inputClass} mb-3`}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedKey(NEW_TEAM_KEY)}
                    className={`mb-2 shrink-0 rounded-lg border border-dashed px-3 py-2 text-left text-sm font-medium transition ${
                      isAddingNew ? rowActiveClass : rowBaseClass
                    } ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-700'}`}
                  >
                    + Add new team
                  </button>
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                    {filteredTeams.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setSelectedKey(entry.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                          selectedKey === entry.key ? rowActiveClass : `border-transparent ${rowBaseClass}`
                        } ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                      >
                        <span className="truncate">{entry.team}</span>
                        {entry.overridden && <span className={badgeClass}>Edited</span>}
                      </button>
                    ))}
                    {filteredTeams.length === 0 && (
                      <p className={`px-2 py-4 text-center text-xs ${subtleTextClass}`}>No teams match.</p>
                    )}
                  </div>
                </section>

                <section className={sectionClass}>
                  {selectedKey === null && (
                    <div className="flex h-full min-h-[20rem] items-center justify-center text-center">
                      <p className={`max-w-xs text-sm leading-6 ${subtleTextClass}`}>
                        Select a team on the left to edit its stadium, or add a team that isn&apos;t listed.
                      </p>
                    </div>
                  )}

                  {selectedKey !== null && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="block">
                            <span className={`mb-1 block type-eyebrow ${subtleTextClass}`}>
                              Team
                            </span>
                            <input
                              type="text"
                              value={draftTeam}
                              onChange={(event) => setDraftTeam(event.target.value)}
                              readOnly={!isAddingNew}
                              placeholder="Team name"
                              spellCheck={false}
                              className={`${inputClass} ${!isAddingNew ? 'opacity-80' : ''}`}
                            />
                          </label>
                        </div>
                        {selectedOverridden && <span className={`mt-6 ${badgeClass}`}>Edited</span>}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className={`mb-1 block type-eyebrow ${subtleTextClass}`}>
                            Stadium
                          </span>
                          <input
                            type="text"
                            value={draftStadium}
                            onChange={(event) => setDraftStadium(event.target.value)}
                            placeholder="Stadium name"
                            spellCheck={false}
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className={`mb-1 block type-eyebrow ${subtleTextClass}`}>
                            City
                          </span>
                          <input
                            type="text"
                            value={draftCity}
                            onChange={(event) => setDraftCity(event.target.value)}
                            placeholder="City"
                            spellCheck={false}
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className={`mb-1 block type-eyebrow ${subtleTextClass}`}>
                            State
                          </span>
                          <input
                            type="text"
                            value={draftState}
                            onChange={(event) => setDraftState(event.target.value)}
                            placeholder="State"
                            spellCheck={false}
                            className={inputClass}
                          />
                        </label>
                      </div>

                      {selectedOverridden && selectedDefault && (
                        <p className={`text-xs leading-5 ${subtleTextClass}`}>
                          Default: {selectedDefault.stadium}, {selectedDefault.city}, {selectedDefault.state}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={!canSave}
                          className="bg-[var(--team-primary)] px-4 py-2 text-sm font-medium text-[var(--team-on-primary)] transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAddingNew ? 'Add team' : 'Save'}
                        </button>
                        {selectedOverridden && (
                          <button type="button" onClick={handleReset} className={secondaryButtonClass}>
                            Reset to default
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className={`text-xs ${subtleTextClass}`}>
                  {teamList.length} teams · {Object.keys(overrides).length} edited
                </p>
                <button type="button" onClick={handleResetAll} className={secondaryButtonClass}>
                  Reset all to defaults
                </button>
              </div>
            </div>
          </div>
      </AnchoredMenuPanel>
    </div>
  );
}
