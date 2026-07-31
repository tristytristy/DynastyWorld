import { Select, type SelectOption } from '../ui/Select';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../lib/useScrollLock';
import { PlayerPortrait } from './PlayerPortrait';
import type { DefensiveStatLine, KickingStatLine, OffensiveStatLine } from '../../../shared/types';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

/**
 * Side-by-side player comparison (Statistics Phase 3). Rendered through a
 * portal to document.body — the page content sits inside clip-path ancestors
 * (the app shell's angled frame, SurfaceCard corner cuts), which would turn
 * a position:fixed overlay into a clipped, mispositioned one (the same real
 * bug the editor modals hit before moving to the app root).
 */
export interface ComparablePlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  offense: OffensiveStatLine | null;
  defense: DefensiveStatLine | null;
  kicking: KickingStatLine | null;
}

interface CompareRow {
  group: string;
  label: string;
  get: (p: ComparablePlayer) => number | null;
  format?: (v: number) => string;
  /** e.g. interceptions thrown — highlight the smaller value as better. */
  lowerIsBetter?: boolean;
}

const oneDec = (v: number) => v.toFixed(1);
const pctFmt = (v: number) => `${v.toFixed(1)}%`;
const int = (v: number) => Math.round(v).toLocaleString();

const ROWS: CompareRow[] = [
  { group: 'Passing', label: 'Pass Yards', get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passYards : null), format: int },
  { group: 'Passing', label: 'Pass TDs', get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passTDs : null), format: int },
  { group: 'Passing', label: 'Interceptions', get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passInts : null), format: int, lowerIsBetter: true },
  { group: 'Passing', label: 'Completion %', get: (p) => (p.offense && p.offense.passAttempts > 0 ? (100 * p.offense.passCompletions) / p.offense.passAttempts : null), format: pctFmt },
  { group: 'Passing', label: 'Yards / Attempt', get: (p) => (p.offense && p.offense.passAttempts > 0 ? p.offense.passYards / p.offense.passAttempts : null), format: oneDec },
  { group: 'Rushing', label: 'Carries', get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushAttempts : null), format: int },
  { group: 'Rushing', label: 'Rush Yards', get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushYards : null), format: int },
  { group: 'Rushing', label: 'Yards / Carry', get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushYards / p.offense.rushAttempts : null), format: oneDec },
  { group: 'Rushing', label: 'Rush TDs', get: (p) => (p.offense && p.offense.rushAttempts > 0 ? p.offense.rushTDs : null), format: int },
  { group: 'Receiving', label: 'Receptions', get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receptions : null), format: int },
  { group: 'Receiving', label: 'Receiving Yards', get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receivingYards : null), format: int },
  { group: 'Receiving', label: 'Yards / Catch', get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receivingYards / p.offense.receptions : null), format: oneDec },
  { group: 'Receiving', label: 'Receiving TDs', get: (p) => (p.offense && p.offense.receptions > 0 ? p.offense.receivingTDs : null), format: int },
  { group: 'Defense', label: 'Tackles', get: (p) => (p.defense ? p.defense.tackles : null), format: int },
  { group: 'Defense', label: 'TFL', get: (p) => (p.defense ? p.defense.tacklesForLoss : null), format: int },
  { group: 'Defense', label: 'Sacks', get: (p) => (p.defense ? p.defense.sacks : null), format: oneDec },
  { group: 'Defense', label: 'Interceptions', get: (p) => (p.defense ? p.defense.interceptions : null), format: int },
  { group: 'Defense', label: 'Forced Fumbles', get: (p) => (p.defense ? p.defense.forcedFumbles : null), format: int },
  { group: 'Defense', label: 'Pass Deflections', get: (p) => (p.defense ? p.defense.passDeflections : null), format: int },
  { group: 'Kicking', label: 'FG Made', get: (p) => (p.kicking && p.kicking.fgAttempts > 0 ? p.kicking.fgMade : null), format: int },
  { group: 'Kicking', label: 'FG Long', get: (p) => (p.kicking && p.kicking.fgAttempts > 0 ? p.kicking.fgLongest : null), format: int },
  { group: 'Punting', label: 'Punts', get: (p) => (p.kicking && p.kicking.puntAttempts > 0 ? p.kicking.puntAttempts : null), format: int },
];

function PlayerColumnHeader({ player }: { player: ComparablePlayer | null }) {
  if (!player) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Select a player</p>;
  }
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <PlayerPortrait player={player} size="md" />
      <div>
        <p className="font-display text-card-title font-semibold text-slate-950 dark:text-white">
          {player.firstName} {player.lastName}
        </p>
        <p className="type-meta text-slate-500 dark:text-slate-400">
          {player.position} #{player.jerseyNumber} · {player.schoolYear}
        </p>
      </div>
    </div>
  );
}

export function PlayerComparison({ players, onClose }: { players: ComparablePlayer[]; onClose: () => void }) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),
    [players],
  );
  // Both dropdowns show the same roster, so the option list is built once.
  // `keywords` carries the jersey number so "#12" finds a player the way the
  // Media tagger already lets you search.
  const playerOptions = useMemo<SelectOption<string>[]>(
    () =>
      sorted.map((p) => ({
        value: String(p.playerId),
        label: `${p.lastName}, ${p.firstName} — ${p.position} #${p.jerseyNumber}`,
        keywords: `${p.position} #${p.jerseyNumber}`,
      })),
    [sorted],
  );
  const [leftId, setLeftId] = useState<number | ''>('');
  const [rightId, setRightId] = useState<number | ''>('');
  const left = sorted.find((p) => p.playerId === leftId) ?? null;
  const right = sorted.find((p) => p.playerId === rightId) ?? null;

  useScrollLock(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const visibleRows = ROWS.filter((row) => (left && row.get(left) !== null) || (right && row.get(right) !== null));
  const groups = [...new Set(visibleRows.map((r) => r.group))];

  return createPortal(
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare players"
        className="corner-cut relative flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden modal-panel md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Statistics</p>
            <h3 className="font-display text-section-title font-semibold text-slate-950 dark:text-white">Compare Players</h3>
          </div>
          <ModalCloseButton label="comparison" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            {/* A whole roster in each list, so both get search. */}
            <Select
              value={leftId === '' ? '' : String(leftId)}
              onChange={(next) => setLeftId(next ? Number(next) : '')}
              ariaLabel="First player"
              className="w-full"
              searchable
              searchPlaceholder="Find a player…"
              options={[{ value: '', label: 'Select player...' }, ...playerOptions]}
            />
            <Select
              value={rightId === '' ? '' : String(rightId)}
              onChange={(next) => setRightId(next ? Number(next) : '')}
              ariaLabel="Second player"
              className="w-full"
              searchable
              searchPlaceholder="Find a player…"
              options={[{ value: '', label: 'Select player...' }, ...playerOptions]}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <PlayerColumnHeader player={left} />
            <PlayerColumnHeader player={right} />
          </div>

          {left || right ? (
            <div className="mt-5 space-y-5">
              {groups.map((group) => (
                <div key={group}>
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">{group}</p>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {visibleRows
                        .filter((row) => row.group === group)
                        .map((row) => {
                          const lv = left ? row.get(left) : null;
                          const rv = right ? row.get(right) : null;
                          const bothPresent = lv !== null && rv !== null && lv !== rv;
                          const leftWins = bothPresent && (row.lowerIsBetter ? lv! < rv! : lv! > rv!);
                          const rightWins = bothPresent && !leftWins;
                          const fmt = row.format ?? int;
                          return (
                            <tr key={row.label} className="border-b border-slate-200/60 last:border-b-0 dark:border-white/5">
                              <td className={`tnum w-1/3 px-3 py-2 text-right font-semibold ${leftWins ? 'text-[var(--team-accent-text)]' : 'text-slate-800 dark:text-slate-100'}`}>
                                {lv === null ? '-' : fmt(lv)}
                              </td>
                              <td className="type-meta w-1/3 px-3 py-2 text-center uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                {row.label}
                              </td>
                              <td className={`tnum w-1/3 px-3 py-2 text-left font-semibold ${rightWins ? 'text-[var(--team-accent-text)]' : 'text-slate-800 dark:text-slate-100'}`}>
                                {rv === null ? '-' : fmt(rv)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Pick two players to compare their season stat lines side by side.
            </p>
          )}
        </div>
      </div>
    </ModalOverlay>,
    document.body,
  );
}
