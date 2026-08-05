import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { Select } from '../ui/Select';
import type { ManualSeason, ManualSeasonGap } from '../../../shared/types';

/**
 * "Seasons before DynastyOS" — the one place a user types facts into this app.
 *
 * WHY A GRID AND NOT A WIZARD. Someone bridging a fourteen-year gap is doing a
 * repetitive task, and a wizard turns fourteen rows into fourteen screens. A
 * grid lets them work down a column, which is how the notes they are copying
 * from are usually laid out.
 *
 * SPEED IS THE WHOLE DESIGN. A dropdown is safer than a text field (no typo can
 * invent a team) but slower to operate, and that trade only pays if the
 * dropdowns are rarely needed:
 *
 *   • Years are PRE-FILLED from the gap the save proves — never typed.
 *   • Team CARRIES FORWARD from the row above, so a coach who stayed put sets
 *     it once; a move is one change on the year it happened.
 *   • Postseason fields stay COLLAPSED until the row is opened, because most
 *     seasons don't have one.
 *   • Tab moves along the row and into the next, so the common case — two
 *     numbers per year — is pure typing.
 *
 * So a typical row is W and L. The dropdowns only appear for the years where
 * something happened.
 *
 * BLANK STAYS BLANK. An empty field is stored as null, not zero, and renders as
 * a dash in the timeline. "I don't remember" is a real answer and must not
 * become a 0-0 that looks like a season played and lost.
 */

/** A row while it is being edited — strings, because a half-typed number is not a number. */
interface DraftRow {
  seasonYear: number;
  teamName: string;
  wins: string;
  losses: string;
  conferenceWins: string;
  conferenceLosses: string;
  bowlName: string;
  bowlResult: '' | 'W' | 'L';
  conferenceChampion: boolean;
  nationalChampion: boolean;
  playoffAppearance: boolean;
  finalRank: string;
  expanded: boolean;
}

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

function toDraft(year: number, existing: ManualSeason | undefined, carriedTeam: string): DraftRow {
  return {
    seasonYear: year,
    teamName: existing?.teamName ?? carriedTeam,
    wins: existing?.wins != null ? String(existing.wins) : '',
    losses: existing?.losses != null ? String(existing.losses) : '',
    conferenceWins: existing?.conferenceWins != null ? String(existing.conferenceWins) : '',
    conferenceLosses: existing?.conferenceLosses != null ? String(existing.conferenceLosses) : '',
    bowlName: existing?.bowlName ?? '',
    bowlResult: existing?.bowlResult ?? '',
    conferenceChampion: existing?.conferenceChampion ?? false,
    nationalChampion: existing?.nationalChampion ?? false,
    playoffAppearance: existing?.playoffAppearance ?? false,
    finalRank: existing?.finalRank != null ? String(existing.finalRank) : '',
    // Open a row that already has postseason detail, so nothing is hidden.
    expanded: Boolean(
      existing && (existing.bowlName || existing.conferenceChampion || existing.nationalChampion || existing.playoffAppearance),
    ),
  };
}

function toManual(r: DraftRow): ManualSeason {
  return {
    seasonYear: r.seasonYear,
    teamName: r.teamName || null,
    wins: numOrNull(r.wins),
    losses: numOrNull(r.losses),
    conferenceWins: numOrNull(r.conferenceWins),
    conferenceLosses: numOrNull(r.conferenceLosses),
    bowlName: r.bowlName.trim() || null,
    bowlResult: r.bowlResult || null,
    conferenceChampion: r.conferenceChampion,
    nationalChampion: r.nationalChampion,
    playoffAppearance: r.playoffAppearance,
    finalRank: numOrNull(r.finalRank),
    headCoachName: null,
    note: null,
  };
}

const CELL = 'w-full border border-slate-300 bg-transparent px-2 py-1 text-sm tabular-nums dark:border-white/15';
/** The one field of a half-filled pair that still needs a number. */
/** A value the save supplies: readable, obviously not an input. */
const CELL_LOCKED =
  'w-full border border-transparent bg-slate-500/10 px-2 py-1 text-sm tabular-nums text-slate-500 dark:text-slate-400';
const CELL_MISSING = 'w-full border border-amber-500/80 bg-amber-500/5 px-2 py-1 text-sm tabular-nums';

const filled = (v: string) => v.trim() !== '';
/** A pair is incomplete when exactly one half has a number. */
const halfPair = (a: string, b: string) => filled(a) !== filled(b);
/** Which numbers this row is still missing, for the message. */
function missingFields(r: DraftRow): string[] {
  const out: string[] = [];
  if (halfPair(r.wins, r.losses)) out.push(filled(r.wins) ? 'losses' : 'wins');
  if (halfPair(r.conferenceWins, r.conferenceLosses))
    out.push(filled(r.conferenceWins) ? 'conference losses' : 'conference wins');
  return out;
}

export function ManualHistoryEditor({
  open,
  onClose,
  dynastyId,
  gap,
  teamOptions,
  defaultTeamName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
  gap: ManualSeasonGap;
  /** Every real team, so a chosen name always matches a program the app knows. */
  teamOptions: { value: string; label: string; keywords?: string }[];
  /**
   * The dynasty's OWN team — the seed for the carry-forward.
   *
   * Seeding from `teamOptions[0]` instead put "Air Force" (alphabetically
   * first) on all fourteen rows of a UCLA dynasty, so the carry-forward saved
   * nobody anything and every row needed correcting. The overwhelmingly likely
   * answer is the school they are coaching now; a coach who moved changes it
   * once on the year of the move and it cascades.
   */
  defaultTeamName: string | null;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  /*
    HALF-FILLED ROWS ARE FLAGGED WHEN YOU LEAVE THEM, not while you type. A
    record is two numbers; entering one and moving on is almost always a slip
    rather than a decision, and silently storing it renders as a dash — the
    typed number disappears and the row looks identical to an untouched one.

    `touched` gates the warning so it appears on exit, and `focusedYear` keeps
    it quiet while the row still has focus: tabbing from W to L must not flash a
    complaint in the moment before L is typed.
  */
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [focusedYear, setFocusedYear] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ManualSeason[]>([]);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void window.api.manualSeasons.list(dynastyId).then((saved) => {
      if (cancelled) return;
      setExisting(saved);
      const byYear = new Map(saved.map((s) => [s.seasonYear, s]));
      // Every year the gap names, plus any year already filled in (so a second
      // visit shows the user's own work even if the gap has since narrowed).
      /*
        Game-known years are INCLUDED, not hidden. Leaving them out would make
        the grid look like it had forgotten them, and someone would go add them
        again somewhere else. Shown locked, they read as "already handled".
      */
      const years = [
        ...new Set([
          ...gap.gameKnownSeasons.map((g) => g.year),
          ...gap.missingYears,
          ...saved.map((s) => s.seasonYear),
        ]),
      ].sort((a, b) => a - b);
      // A game-known year is drafted from the SAVE's numbers, not from any
      // manual row — so the locked cells show what the game states rather than
      // sitting empty, which would read as data you are forbidden to supply.
      const byGameYear = new Map(gap.gameKnownSeasons.map((g) => [g.year, g]));
      let carried = defaultTeamName ?? teamOptions[0]?.value ?? '';
      const drafts: DraftRow[] = [];
      for (const y of years) {
        const g = byGameYear.get(y);
        const d = g
          ? {
              ...toDraft(y, byYear.get(y), g.teamName || carried),
              teamName: g.teamName || carried,
              wins: String(g.wins),
              losses: String(g.losses),
              conferenceWins: String(g.conferenceWins),
              conferenceLosses: String(g.conferenceLosses),
            }
          : toDraft(y, byYear.get(y), carried);
        carried = d.teamName || carried;
        drafts.push(d);
      }
      setRows(drafts);
      loadedFor.current = dynastyId;
    });
    return () => {
      cancelled = true;
    };
  }, [open, dynastyId, gap.missingYears, gap.gameKnownSeasons, teamOptions, defaultTeamName]);

  /** Wired onto every numeric cell so the row knows when focus enters and leaves it. */
  const cellFocus = (year: number) => ({
    onFocus: () => setFocusedYear(year),
    onBlur: () => {
      setFocusedYear((cur) => (cur === year ? null : cur));
      setTouched((prev) => (prev.has(year) ? prev : new Set(prev).add(year)));
    },
  });

  const set = (year: number, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.seasonYear === year ? { ...r, ...patch } : r)));

  /*
    Changing a team CASCADES DOWNWARD to rows the user hasn't set themselves.
    A coach who moves in 2034 was at the new school for every year after, and
    making them set that fourteen times is the difference between a tool and a
    chore. Rows below that already differ are left alone — an explicit choice
    always beats a carried default.
  */
  const setTeamCascading = (year: number, teamName: string) =>
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.seasonYear === year);
      if (idx < 0) return prev;
      const previousValue = prev[idx].teamName;
      return prev.map((r, i) => {
        if (i === idx) return { ...r, teamName };
        if (i > idx && r.teamName === previousValue) return { ...r, teamName };
        return r;
      });
    });

  /*
    IMMERSION SAFETY. A year the save already accounts for cannot be edited: the
    number is on the timeline already, and letting someone retype it invites two
    different answers to the same question with no way to tell which is real.
    The save wins by construction, so the field is simply not a field.
  */
  const lockedYears = useMemo(() => new Set(gap.gameKnownSeasons.map((g) => g.year)), [gap.gameKnownSeasons]);
  const isLocked = (year: number) => lockedYears.has(year);

  const filledCount = useMemo(() => rows.filter((r) => r.wins.trim() || r.losses.trim()).length, [rows]);
  /** Rows carrying half a pair — surfaced in the footer so Save is never a surprise. */
  const incompleteRows = useMemo(() => rows.filter((r) => missingFields(r).length > 0), [rows]);

  /*
    THE SAVE'S OWN CAREER TOTAL IS THE PROOF-READER. CareerCoachStats is
    authoritative — if the typed rows disagree with it, the notes have a gap,
    not the game. Shown as an observation, never as a block: someone may be
    filling this in over several sittings, and half-finished is a normal state.
  */
  const typedWins = rows.reduce((n, r) => n + (numOrNull(r.wins) ?? 0), 0);
  const typedLosses = rows.reduce((n, r) => n + (numOrNull(r.losses) ?? 0), 0);

  async function save() {
    setSaving(true);
    try {
      // Locked rows are the save's, not the user's — writing them into
      // manual_seasons would duplicate a fact the timeline already shows and
      // create a second answer to the same question.
      await window.api.manualSeasons.save(
        dynastyId,
        rows.filter((r) => !isLocked(r.seasonYear)).map(toManual),
      );
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <CenteredModalPanel
      open={open}
      onClose={onClose}
      widthRem={64}
      eyebrow="From your own records"
      title="Seasons before DynastyOS"
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          This dynasty has run <strong>{gap.coachSeasonCount || gap.syncedYearCount}</strong> seasons; DynastyOS has{' '}
          <strong>{gap.syncedYearCount}</strong>. Fill in whatever you have — anything you leave blank stays blank
          rather than becoming a zero, and you can come back to this at any time.
        </p>

        <div className="max-h-[52vh] overflow-y-auto pr-1">
          <table className="w-full border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="type-eyebrow text-slate-400 dark:text-slate-500">
                <th className="w-14 px-1 text-left font-normal">Year</th>
                <th className="px-1 text-left font-normal">Team</th>
                <th className="w-14 px-1 text-left font-normal">W</th>
                <th className="w-14 px-1 text-left font-normal">L</th>
                <th className="w-16 px-1 text-left font-normal">Conf W</th>
                <th className="w-16 px-1 text-left font-normal">Conf L</th>
                <th className="w-10 px-1 text-left font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                // Key on the FRAGMENT, not the inner rows: a row can render one
                // or two <tr>s, and keying the children would let React reuse
                // the wrong expanded panel when rows are added or reordered.
                <Fragment key={r.seasonYear}>
                  <tr>
                    <td className="px-1 font-semibold tabular-nums text-slate-900 dark:text-white">
                      <span className="flex items-center gap-1.5">
                        {r.seasonYear}
                        {isLocked(r.seasonYear) && (
                          <span
                            title="Already in your save — DynastyOS read this season from the game, so it can't be edited here."
                            className="text-[10px] font-normal text-slate-400 dark:text-slate-500"
                          >
                            from save
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="w-full px-1">
                      <Select
                        value={r.teamName}
                        onChange={(v) => setTeamCascading(r.seasonYear, v)}
                        options={teamOptions}
                        ariaLabel={`Team for ${r.seasonYear}`}
                        disabled={isLocked(r.seasonYear)}
                        searchable
                        searchPlaceholder="Search schools…"
                      />
                    </td>
                    <td className="px-1">
                      <input
                        className={isLocked(r.seasonYear) ? CELL_LOCKED : halfPair(r.wins, r.losses) && !filled(r.wins) ? CELL_MISSING : CELL}
                        inputMode="numeric"
                        value={r.wins}
                        onChange={(e) => set(r.seasonYear, { wins: e.target.value })}
                        {...cellFocus(r.seasonYear)}
                        disabled={isLocked(r.seasonYear)}
                        readOnly={isLocked(r.seasonYear)}
                        aria-label={`Wins in ${r.seasonYear}`}
                        aria-invalid={touched.has(r.seasonYear) && halfPair(r.wins, r.losses) && !filled(r.wins)}
                      />
                    </td>
                    <td className="px-1">
                      <input
                        className={isLocked(r.seasonYear) ? CELL_LOCKED : halfPair(r.losses, r.wins) && !filled(r.losses) ? CELL_MISSING : CELL}
                        inputMode="numeric"
                        value={r.losses}
                        onChange={(e) => set(r.seasonYear, { losses: e.target.value })}
                        {...cellFocus(r.seasonYear)}
                        disabled={isLocked(r.seasonYear)}
                        readOnly={isLocked(r.seasonYear)}
                        aria-label={`Losses in ${r.seasonYear}`}
                        aria-invalid={touched.has(r.seasonYear) && halfPair(r.losses, r.wins) && !filled(r.losses)}
                      />
                    </td>
                    <td className="px-1">
                      <input
                        className={isLocked(r.seasonYear) ? CELL_LOCKED : halfPair(r.conferenceWins, r.conferenceLosses) && !filled(r.conferenceWins) ? CELL_MISSING : CELL}
                        inputMode="numeric"
                        value={r.conferenceWins}
                        onChange={(e) => set(r.seasonYear, { conferenceWins: e.target.value })}
                        {...cellFocus(r.seasonYear)}
                        disabled={isLocked(r.seasonYear)}
                        readOnly={isLocked(r.seasonYear)}
                        aria-label={`Conference wins in ${r.seasonYear}`}
                        aria-invalid={touched.has(r.seasonYear) && halfPair(r.conferenceWins, r.conferenceLosses) && !filled(r.conferenceWins)}
                      />
                    </td>
                    <td className="px-1">
                      <input
                        className={isLocked(r.seasonYear) ? CELL_LOCKED : halfPair(r.conferenceLosses, r.conferenceWins) && !filled(r.conferenceLosses) ? CELL_MISSING : CELL}
                        inputMode="numeric"
                        value={r.conferenceLosses}
                        onChange={(e) => set(r.seasonYear, { conferenceLosses: e.target.value })}
                        {...cellFocus(r.seasonYear)}
                        disabled={isLocked(r.seasonYear)}
                        readOnly={isLocked(r.seasonYear)}
                        aria-label={`Conference losses in ${r.seasonYear}`}
                        aria-invalid={touched.has(r.seasonYear) && halfPair(r.conferenceLosses, r.conferenceWins) && !filled(r.conferenceLosses)}
                      />
                    </td>
                    <td className="px-1 text-right">
                      <button
                        type="button"
                        onClick={() => set(r.seasonYear, { expanded: !r.expanded })}
                        aria-expanded={r.expanded}
                        className="px-1 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        title="Postseason for this year"
                      >
                        {r.expanded ? '−' : '+'}
                      </button>
                    </td>
                  </tr>
                  {/*
                    The alert itself: shown only after focus has LEFT the row, so
                    tabbing from W to L never flashes a complaint at someone who
                    is mid-entry. It explains what is missing rather than just
                    marking the field red, and it does not block saving — a user
                    may genuinely not remember, and a half-remembered season is
                    still theirs to keep.
                  */}
                  {touched.has(r.seasonYear) && focusedYear !== r.seasonYear && missingFields(r).length > 0 && (
                    <tr>
                      <td />
                      <td colSpan={6} className="px-1 pb-1">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {r.seasonYear} still needs {missingFields(r).join(' and ')} — a record needs both numbers, so
                          this year will show a dash until it has them.
                        </p>
                      </td>
                    </tr>
                  )}
                  {r.expanded && (
                    <tr>
                      <td />
                      <td colSpan={6} className="px-1 pb-2">
                        <div className="flex flex-wrap items-center gap-3 border-l-0 pl-0 text-xs">
                          <input
                            className={`${CELL} !w-48`}
                            placeholder="Bowl or playoff game"
                            value={r.bowlName}
                            onChange={(e) => set(r.seasonYear, { bowlName: e.target.value })}
                            aria-label={`Bowl for ${r.seasonYear}`}
                          />
                          <div className="w-24">
                            <Select
                              value={r.bowlResult}
                              onChange={(v) => set(r.seasonYear, { bowlResult: v })}
                              options={[
                                { value: '', label: '—' },
                                { value: 'W', label: 'Won' },
                                { value: 'L', label: 'Lost' },
                              ]}
                              ariaLabel={`Bowl result for ${r.seasonYear}`}
                            />
                          </div>
                          <input
                            className={`${CELL} !w-24`}
                            inputMode="numeric"
                            placeholder="Final rk"
                            value={r.finalRank}
                            onChange={(e) => set(r.seasonYear, { finalRank: e.target.value })}
                            aria-label={`Final rank for ${r.seasonYear}`}
                          />
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={r.playoffAppearance}
                              onChange={(e) => set(r.seasonYear, { playoffAppearance: e.target.checked })}
                            />
                            Playoff
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={r.conferenceChampion}
                              onChange={(e) => set(r.seasonYear, { conferenceChampion: e.target.checked })}
                            />
                            Conf title
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={r.nationalChampion}
                              onChange={(e) => set(r.seasonYear, { nationalChampion: e.target.checked })}
                            />
                            National title
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {incompleteRows.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {incompleteRows.length} {incompleteRows.length === 1 ? 'year needs' : 'years need'} a second number
                {' · '}
              </span>
            )}
            {filledCount} of {rows.length} filled
            {typedWins + typedLosses > 0 && (
              <>
                {' · '}
                {typedWins}-{typedLosses} typed in
              </>
            )}
            {existing.length > 0 && ` · ${existing.length} saved previously`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="corner-cut-sm border border-slate-300 px-3 py-1.5 text-sm dark:border-white/15">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="corner-cut-sm border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:border-white dark:bg-white dark:text-slate-900"
            >
              {saving ? 'Saving…' : 'Save seasons'}
            </button>
          </div>
        </div>
      </div>
    </CenteredModalPanel>
  );
}
