import { Select } from '../ui/Select';
import { useEffect, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { useConfirm } from '../../data/ConfirmDialogProvider';
import type { ScandalsData, ScandalsEdit, ScandalsTreeTier } from '../../../shared/types';

/**
 * "Scandals" — the user coach's cheat panel, framed as the ways a program
 * actually gets caught bending the rules. The sections map to real save fields:
 *
 *   Tampering        → recruiting hours
 *   Sign Stealing    → coach XP, level, points, prestige, security, contracts
 *   Performance Enh. → talent progress speed + per-position XP multipliers
 *   Embezzlement     → unlock coach talents, per tree and per level
 *
 * Every value is bounded by what the save field can PHYSICALLY hold, not by
 * taste: these are bit-packed, and an over-large number wraps silently instead
 * of failing. 5,000 recruiting hours into a 12-bit field stored 904 and looked
 * like a clean save. The maxima come from the save's own offset table.
 */

/**
 * Rainmaker and Visionary are hidden. Both sit behind a real-money gate in-game
 * (an MVP+ membership and a Madden 27 coach), and because no save anywhere shows
 * a point spent in either, their two slots can't be told apart from the data —
 * the labels are a coin flip. The chord below reveals them; it is deliberately
 * undocumented, so it is named in no manual, help screen or release note.
 */
const HIDDEN_TREES = ['rainmaker', 'visionary'];
const HIDDEN_TREES_KEY = 'cfb.scandals.showGatedTrees';

const XP_SPEEDS = ['Slowest', 'Normal', 'Fastest'];
const TALENT_SPEEDS = ['Slowest', 'Slow', 'Normal', 'Fast'];

const POSITION_ORDER = [
  'QB', 'HB', 'FB', 'WR', 'TE', 'T', 'G', 'C',
  'DE', 'DT', 'OLB', 'MLB', 'CB', 'FS', 'SS', 'K', 'P', 'LS',
];

const INPUT =
  'w-full border border-slate-200/80 bg-white/80 px-3 py-2 text-sm tabular-nums text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

/**
 * One crime. Collapsed by default so the panel opens as a short list of choices
 * rather than a wall of inputs — but a section holding staged edits says so,
 * since a pending change hidden inside a closed section would otherwise be
 * written by "Commit the crime" without ever being seen.
 */
function Scandal({
  eyebrow,
  title,
  dirty,
  children,
}: {
  eyebrow: string;
  title: string;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="corner-cut-sm border border-slate-200/80 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="type-eyebrow flex items-center gap-1.5 text-red-600 dark:text-red-400">
            {eyebrow}
            {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="has pending changes" />}
          </span>
          <span className="mt-0.5 block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        </span>
        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

/** Level picker. 0 means "leave this block alone" — nothing is ever revoked. */
function LevelPicker({
  value,
  floor,
  levels,
  onChange,
  compact,
}: {
  value: number;
  floor: number;
  levels: number;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  return (
    <span className="flex">
      {Array.from({ length: levels + 1 }, (_, i) => i).map((level) => {
        const active = value >= level && level > 0;
        // Levels already owned in the save can't be taken away here, so they
        // read as locked-in rather than selectable.
        const owned = level > 0 && level <= floor;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            title={owned ? 'Already owned' : level === 0 ? 'Leave unchanged' : `Own levels 1–${level}`}
            className={`border-y border-r first:rounded-none first:border-l tabular-nums transition ${
              compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-[11px]'
            } ${
              owned
                ? 'border-slate-300 bg-slate-300 font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-200'
                : active
                  ? 'border-red-500 bg-red-500/80 font-bold text-white'
                  : 'border-slate-200 bg-white/70 text-slate-400 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500 dark:hover:bg-white/10'
            }`}
          >
            {level === 0 ? '–' : level}
          </button>
        );
      })}
    </span>
  );
}

function NumberField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="tnum text-[11px] text-slate-400 dark:text-slate-500">max {max.toLocaleString()}</span>
      </span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className={`${INPUT} mt-1`}
      />
    </label>
  );
}

export function ScandalsModal({
  open,
  onClose,
  dynastyId,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<ScandalsData | null | undefined>(undefined);
  const [edit, setEdit] = useState<ScandalsEdit>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showGated, setShowGated] = useState(() => localStorage.getItem(HIDDEN_TREES_KEY) === '1');
  const [gatedPrompt, setGatedPrompt] = useState(false);

  // The undocumented chord that brings the hidden trees back. Bound only while
  // the panel is open, since that's the only place they'd appear.
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey || !event.shiftKey || !event.altKey || event.key.toLowerCase() !== 'c') return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? '')) return;
      event.preventDefault();
      setGatedPrompt(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Escape closes the prompt rather than the whole panel underneath it. Bound on
  // window in the capture phase so it lands before the panel's own document-level
  // Escape handler ever sees the event.
  useEffect(() => {
    if (!gatedPrompt) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setGatedPrompt(false);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [gatedPrompt]);

  function setGatedVisibility(next: boolean) {
    setShowGated(next);
    localStorage.setItem(HIDDEN_TREES_KEY, next ? '1' : '0');
    // Drop any pending edits to trees that just disappeared, so a hidden tree
    // can't be written by a selection the user can no longer see.
    if (!next && data) {
      const gatedSlots = new Set(
        data.talentTrees.filter((t) => HIDDEN_TREES.includes(t.key)).flatMap((t) => t.tiers.map((tier) => tier.slot)),
      );
      setEdit((prev) => {
        if (!prev.talentUnlocks) return prev;
        const kept = Object.fromEntries(
          Object.entries(prev.talentUnlocks).filter(([slot]) => !gatedSlots.has(Number(slot))),
        );
        return { ...prev, talentUnlocks: kept };
      });
    }
  }

  /** Sets whole tiers at once — a tree row, or one tier of it. */
  function setTierLevels(tiers: ScandalsTreeTier[], level: number) {
    setEdit((prev) => {
      const next = { ...(prev.talentUnlocks ?? {}) };
      for (const tier of tiers) {
        // Clamped per tier: "level 4" on a tree that only has 1 means 1.
        next[tier.slot] = Array(tier.blocks.length).fill(Math.min(level, tier.levelsPerBlock));
      }
      return { ...prev, talentUnlocks: next };
    });
  }

  function setBlockLevel(tier: ScandalsTreeTier, block: number, level: number) {
    setEdit((prev) => {
      const next = { ...(prev.talentUnlocks ?? {}) };
      const row = [...(next[tier.slot] ?? Array(tier.blocks.length).fill(0))];
      row[block] = level;
      next[tier.slot] = row;
      return { ...prev, talentUnlocks: next };
    });
  }

  /** The level picked across a tier's blocks, or null where they differ. */
  function tierLevel(tier: ScandalsTreeTier): number | null {
    const row = edit.talentUnlocks?.[tier.slot];
    if (!row) return 0;
    return row.every((v) => v === row[0]) ? row[0] : null;
  }

  useEffect(() => {
    if (!open) return;
    setData(undefined);
    setEdit({});
    setResult(null);
    setExpanded(null);
    setGatedPrompt(false);
    window.api.editor
      .getScandals(dynastyId)
      .then(setData)
      .catch(() => setData(null));
  }, [open, dynastyId]);

  const limits = data?.limits ?? {};
  const visibleTrees = (data?.talentTrees ?? []).filter((t) => showGated || !HIDDEN_TREES.includes(t.key));
  const val = <K extends keyof ScandalsData>(key: K, editKey: keyof ScandalsEdit): number =>
    (edit[editKey] as number | undefined) ?? (data ? (data[key] as unknown as number) : 0);

  async function apply() {
    const confirmed = await confirm({
      eyebrow: 'Scandals',
      title: 'Write these changes to your save?',
      message:
        'This edits your actual College Football save file. A timestamped backup is taken first, and nothing is written if that backup fails.',
      confirmLabel: 'Commit the crime',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBusy(true);
    setResult(null);
    try {
      const res = await window.api.editor.saveScandals(dynastyId, edit);
      setResult({ text: res.message, ok: res.success });
      if (res.success) {
        setEdit({});
        setData(await window.api.editor.getScandals(dynastyId));
      }
    } finally {
      setBusy(false);
    }
  }

  const dirty = Object.keys(edit).length > 0;

  /*
    THE TALENT TREES ARE HIDDEN, because unlocking one writes to the save and the
    game does not honour it — a maxed recruiting tree left scouting speed
    unchanged (user report 2026-08-03). A control that says it did something it
    did not is worse than no control, so it is off until the save-side question
    is answered (see the audit note on the board).

    Ctrl+Shift+C brings it back for testing. Deliberately undocumented: it is a
    development affordance for verifying the fix, not a feature, and putting it
    in the manual would make a broken thing discoverable again.
  */
  const [devUnlocked, setDevUnlocked] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        setDevUnlocked((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Which sections are holding staged edits, so a collapsed one still announces
  // that something inside it is about to be written.
  const touched = {
    tampering: edit.recruitingHours !== undefined,
    signStealing:
      edit.coachXpSpeed !== undefined ||
      edit.experiencePoints !== undefined ||
      edit.level !== undefined ||
      edit.prestigeScore !== undefined ||
      edit.jobSecurity !== undefined ||
      edit.contractPoints !== undefined,
    peds: edit.talentProgressSpeed !== undefined || edit.positionXp !== undefined,
    // Coach points moved here with the field. A staged edit has to mark the
    // section it is VISIBLE in, or a collapsed section stays silent about a
    // change that is about to be written from inside it.
    embezzlement:
      edit.coachPoints !== undefined ||
      Object.values(edit.talentUnlocks ?? {}).some((row) => row.some((level) => level > 0)),
  };

  return (
    <CenteredModalPanel open={open} onClose={onClose} widthRem={40} eyebrow="Off the books" title="Scandals">
      {data === undefined && <p className="text-sm text-slate-500 dark:text-slate-400">Reading your save…</p>}
      {data === null && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Couldn&apos;t read a user-controlled coach from this save.
        </p>
      )}

      {gatedPrompt && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="corner-cut w-full max-w-sm border border-slate-300 bg-white p-4 shadow-xl dark:border-white/15 dark:bg-slate-950">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Hidden trees</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              Show Rainmaker and Visionary?
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Both are locked behind a real-money purchase in-game, and their two slots are identical in the save, so
              which name belongs to which is an unverified guess. Editing them may do nothing, or may hit the other
              tree.
            </p>

            <button
              type="button"
              role="switch"
              aria-checked={showGated}
              onClick={() => setGatedVisibility(!showGated)}
              className="mt-3 flex w-full items-center justify-between gap-3 border border-slate-200 bg-slate-50/80 px-3 py-2 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
            >
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {showGated ? 'Visible' : 'Hidden'}
              </span>
              <span
                className={`relative h-5 w-9 shrink-0 transition ${
                  showGated ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${showGated ? 'left-[1.125rem]' : 'left-0.5'}`}
                />
              </span>
            </button>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setGatedPrompt(false)}
                className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Everything here writes straight to <strong>{data.coachName}</strong>&apos;s save. Nobody has to know.
          </p>

          <Scandal eyebrow="Tampering" title="Recruiting hours boost" dirty={touched.tampering}>
            <NumberField
              label="Recruiting hours"
              value={val('recruitingHours', 'recruitingHours')}
              max={limits.recruitingHours ?? 4095}
              onChange={(recruitingHours) => setEdit((e) => ({ ...e, recruitingHours }))}
            />
          </Scandal>

          <Scandal eyebrow="Sign Stealing" title="Coach XP boost" dirty={touched.signStealing}>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Coach XP speed</span>
              <Select
                value={edit.coachXpSpeed ?? data.coachXpSpeed}
                onChange={(coachXpSpeed) => setEdit((prev) => ({ ...prev, coachXpSpeed }))}
                ariaLabel="Coach XP speed"
                className="mt-1 w-full"
                options={XP_SPEEDS.map((s) => ({ value: s, label: s }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Experience points" value={val('experiencePoints', 'experiencePoints')} max={limits.experiencePoints ?? 0} onChange={(experiencePoints) => setEdit((e) => ({ ...e, experiencePoints }))} />
              <NumberField label="Level" value={val('level', 'level')} max={limits.level ?? 0} onChange={(level) => setEdit((e) => ({ ...e, level }))} />
              <NumberField label="Prestige score" value={val('prestigeScore', 'prestigeScore')} max={limits.prestigeScore ?? 0} onChange={(prestigeScore) => setEdit((e) => ({ ...e, prestigeScore }))} />
              <NumberField label="Job security %" value={val('jobSecurity', 'jobSecurity')} max={limits.jobSecurity ?? 100} onChange={(jobSecurity) => setEdit((e) => ({ ...e, jobSecurity }))} />
              <NumberField label="Contract points (this year)" value={val('contractPoints', 'contractPoints')} max={limits.contractPoints ?? 0} onChange={(contractPoints) => setEdit((e) => ({ ...e, contractPoints }))} />
            </div>
          </Scandal>

          <Scandal
            eyebrow="Performance Enhancing Drugs"
            title="Talent progress speed & positional XP"
            dirty={touched.peds}
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Talent progress speed</span>
              <Select
                value={edit.talentProgressSpeed ?? data.talentProgressSpeed}
                onChange={(talentProgressSpeed) => setEdit((prev) => ({ ...prev, talentProgressSpeed }))}
                ariaLabel="Talent progress speed"
                className="mt-1 w-full"
                options={TALENT_SPEEDS.map((s) => ({ value: s, label: s }))}
              />
            </label>
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Position XP multipliers <span className="text-slate-400 dark:text-slate-500">— 100 is normal</span>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {POSITION_ORDER.filter((p) => p in data.positionXp).map((p) => (
                  <label key={p} className="block">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{p}</span>
                    <input
                      type="number"
                      min={0}
                      max={limits.positionXp ?? 511}
                      value={edit.positionXp?.[p] ?? data.positionXp[p]}
                      onChange={(e) =>
                        setEdit((prev) => ({
                          ...prev,
                          positionXp: {
                            ...(prev.positionXp ?? data.positionXp),
                            [p]: Math.max(0, Math.min(limits.positionXp ?? 511, Number(e.target.value) || 0)),
                          },
                        }))
                      }
                      className={`${INPUT} mt-0.5 px-2 py-1.5`}
                    />
                  </label>
                ))}
              </div>
            </div>
          </Scandal>

          <Scandal
            eyebrow="Embezzlement"
            /* The title says what is actually in the section. With the trees
               hidden, "Unlock coach talents" would promise something that is not
               there. */
            title={devUnlocked ? 'Unlock coach talents' : 'Coach points'}
            dirty={touched.embezzlement}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Coach points" value={val('coachPoints', 'coachPoints')} max={limits.coachPoints ?? 0} onChange={(coachPoints) => setEdit((e) => ({ ...e, coachPoints }))} />
            </div>
            {devUnlocked && (
            <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <span className="tnum font-semibold text-slate-800 dark:text-slate-200">
                  {visibleTrees.reduce((sum, t) => sum + t.owned, 0)} of{' '}
                  {visibleTrees.reduce((sum, t) => sum + t.total, 0)}
                </span>{' '}
                talents owned
              </span>
              <button
                type="button"
                onClick={() =>
                  setEdit((prev) => ({
                    ...prev,
                    talentUnlocks: Object.fromEntries(
                      visibleTrees.flatMap((t) =>
                        t.tiers.map((tier) => [
                          tier.slot,
                          Array(tier.blocks.length).fill(tier.levelsPerBlock),
                        ]),
                      ),
                    ),
                  }))
                }
                className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Max everything
              </button>
            </div>

            <div className="space-y-1">
              {visibleTrees.map((tree) => {
                const open = expanded === tree.key;
                const maxLevels = Math.max(...tree.tiers.map((t) => t.levelsPerBlock));
                const shared = tree.tiers.every((t) => tierLevel(t) === tierLevel(tree.tiers[0]))
                  ? tierLevel(tree.tiers[0])
                  : null;
                return (
                  <div
                    key={tree.key}
                    className="corner-cut-sm border border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : tree.key)}
                        className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                      >
                        <span className="w-3 shrink-0 text-[9px] text-slate-400">{open ? '▾' : '▸'}</span>
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {tree.name}
                        </span>
                        {!tree.confirmed && (
                          <span
                            title="Tree name inferred from league-wide spending, not confirmed in-game."
                            className="text-[10px] font-semibold text-amber-500"
                          >
                            ?
                          </span>
                        )}
                        <span className="tnum text-[10px] text-slate-400 dark:text-slate-500">
                          {tree.owned}/{tree.total}
                          {tree.spent > 0 && ` · ${tree.spent} pts`}
                        </span>
                      </button>
                      <LevelPicker
                        value={shared ?? -1}
                        floor={0}
                        levels={maxLevels}
                        onChange={(level) => setTierLevels(tree.tiers, level)}
                      />
                    </div>

                    {open && (
                      <div className="space-y-2 border-t border-slate-200/70 px-2.5 py-2 dark:border-white/10">
                        {tree.tiers.map((tier) => (
                          <div key={tier.slot}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="type-eyebrow text-slate-400 dark:text-slate-500">
                                {tier.label}
                                {tier.locked && ' · locked in-game'}
                              </span>
                              <LevelPicker
                                compact
                                value={tierLevel(tier) ?? -1}
                                floor={0}
                                levels={tier.levelsPerBlock}
                                onChange={(level) => setTierLevels([tier], level)}
                              />
                            </div>
                            <div className="mt-1 grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                              {tier.blocks.map((block, index) => (
                                <div key={block.name} className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-[10px] text-slate-500 dark:text-slate-400">
                                    {block.name}
                                    <span className="tnum text-slate-400 dark:text-slate-600">
                                      {' '}
                                      · {block.owned}/{tier.levelsPerBlock}
                                    </span>
                                  </span>
                                  <LevelPicker
                                    compact
                                    value={edit.talentUnlocks?.[tier.slot]?.[index] ?? 0}
                                    floor={block.owned}
                                    levels={tier.levelsPerBlock}
                                    onChange={(level) => setBlockLevel(tier, index, level)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500">
              Pick a level to own levels 1 through it; <span className="font-semibold">–</span> leaves a talent alone,
              and nothing is ever taken away. Grey levels are already owned. Tree shapes differ — most are 8 talents of
              4 levels, CEO is 9 one-offs, Program Builder 7 of 3. Names come from the game&apos;s tree screens; the
              save stores only positions, so a name could sit on the wrong row. No undo beyond restoring the backup.
            </p>
            </>
            )}
          </Scandal>

          {/* A real, observed quirk — surfaced so a working write doesn't look broken. */}
          <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500">
            Heads up: with XP speed set to Fastest, XP does accrue faster, but the in-game League Settings screen may
            still display the slowest value. That&apos;s the game, not a failed save.
          </p>

          {result && (
            <p className={`text-xs ${result.ok ? 'text-slate-600 dark:text-slate-300' : 'text-amber-600 dark:text-amber-400'}`}>
              {result.text}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !dirty}
              className="corner-cut-sm border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
            >
              {busy ? 'Writing…' : 'Commit the crime'}
            </button>
          </div>
        </div>
      )}
    </CenteredModalPanel>
  );
}
