import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TrashIcon } from './ActionIcons';
import { useCustomRivals } from '../../data/CustomRivalsProvider';
import { useViewedTeam } from '../../data/ViewedTeamProvider';
import { canonicalKey } from '../../lib/assetMapping';
import { programArtUrl } from '../../lib/programArt';
import { rivalryPairKey } from '../../lib/rivalryAssetMapping';
import type { CustomRival, SaveRival } from '../../../shared/types';

/**
 * The Rivals tab of the Program editor — EA's rivals, then the user's own.
 *
 * TWO LISTS, AND THE ORDER IS THE ARGUMENT. What the save already believes
 * comes first and is READ-ONLY, so a user can see what they are adding to
 * rather than duplicating it by accident. Those three slots drive in-game
 * scheduling and commentary and are not editable from inside the game either;
 * presenting them locked is honest reporting, not a limitation being papered
 * over.
 *
 * Everything below the divider is the user's, is cosmetic, and NEVER reaches
 * the save file. That sentence is on the panel too, because "I edited my
 * rivals" is exactly the kind of thing someone would otherwise assume had
 * changed their dynasty.
 *
 * A RIVALRY IS SYMMETRIC and stored once, keyed by the matchup (schema v20). So
 * declaring it from either program's editor produces the same row, and the mark
 * appears on both teams' schedules, in the box score, and on both Rivalries
 * pages — see CustomRivalsProvider.
 */
export function ProgramRivalsTab({
  dynastyId,
  teamIndex,
  teamName,
}: {
  dynastyId: string;
  teamIndex: number;
  teamName: string;
}) {
  const { leagueTeams } = useViewedTeam();
  const { rivalsFor, applyRival, removeRival } = useCustomRivals();
  const [saveRivals, setSaveRivals] = useState<{ isUserTeam: boolean; rivals: SaveRival[] } | null | undefined>(
    undefined,
  );
  const [opponentIndex, setOpponentIndex] = useState('');
  const [rivalryName, setRivalryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaveRivals(undefined);
    void window.api.db.getSaveRivals(dynastyId, teamIndex).then((r) => {
      if (!cancelled) setSaveRivals(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex]);

  const teamKey = canonicalKey(teamName);
  const mine = rivalsFor(teamKey);

  /*
    THE PICKER EXCLUDES THIS PROGRAM AND ANYONE ALREADY PAIRED WITH IT. Offering
    a team you already have a rivalry with would look like a second rivalry and
    then silently rename the first (the DAL upserts on the pair), and offering
    the program itself would produce a pair key of one team whose logo fired on
    every game they played.
  */
  const taken = useMemo(
    () => new Set(mine.map((r) => (r.teamNameKey === teamKey ? r.opponentTeamIndex : r.teamIndex))),
    [mine, teamKey],
  );
  const options = useMemo(
    () => [
      { value: '', label: 'Choose a team…' },
      ...(leagueTeams ?? [])
        .filter((t) => t.teamIndex !== teamIndex && !taken.has(t.teamIndex))
        .map((t) => ({ value: String(t.teamIndex), label: t.displayName })),
    ],
    [leagueTeams, teamIndex, taken],
  );

  async function add() {
    const opponent = (leagueTeams ?? []).find((t) => String(t.teamIndex) === opponentIndex);
    const name = rivalryName.trim();
    if (!opponent || !name) {
      setError(!opponent ? 'Pick the team you play.' : 'Give the rivalry a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await window.api.rivals.save(dynastyId, {
        teamIndex,
        teamName,
        teamNameKey: teamKey,
        opponentTeamIndex: opponent.teamIndex,
        opponentName: opponent.displayName,
        opponentNameKey: canonicalKey(opponent.displayName),
        pairKey: rivalryPairKey(teamName, opponent.displayName),
        rivalryName: name,
      });
      if (!saved) {
        setError("That rivalry couldn't be saved — check the name and the team.");
        return;
      }
      applyRival(saved);
      setOpponentIndex('');
      setRivalryName('');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className="space-y-5">
      <div>
        <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">From your save</p>
        {saveRivals === undefined && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Reading your save&apos;s rivals…</p>
        )}
        {saveRivals && !saveRivals.isUserTeam && (
          /* NOT "this team has no rivals". The save records rival slots for the
             user's own team only (see getSaveRivals), and reporting missing
             extraction as missing data is exactly the mistake to avoid. */
          <p className="border border-slate-200/80 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Your save only records rival slots for the team you coach, so there is nothing to show for {teamName}. You
            can still name your own below.
          </p>
        )}
        {saveRivals?.isUserTeam && saveRivals.rivals.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Your save has no rivals set for {teamName}.
          </p>
        )}
        {saveRivals?.isUserTeam && saveRivals.rivals.length > 0 && (
          <div className="space-y-1">
            {saveRivals.rivals.map((r) => (
              <div
                key={r.opponentTeamIndex}
                className="flex items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 dark:border-slate-800 dark:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {r.opponentName}
                  </span>
                  {r.rivalryName && (
                    <span className="block truncate text-xs text-[var(--team-accent-text)]">{r.rivalryName}</span>
                  )}
                </span>
                <span className="shrink-0 border border-slate-300/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  EA
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/60 pt-4 dark:border-slate-800/60">
        <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">Your own</p>

        {mine.length > 0 && (
          <div className="mb-3 space-y-2">
            {mine.map((rival) => (
              <CustomRivalRow
                key={rival.pairKey}
                rival={rival}
                thisTeamKey={teamKey}
                dynastyId={dynastyId}
                onChanged={applyRival}
                onRemoved={removeRival}
              />
            ))}
          </div>
        )}

        <div className="space-y-2 border border-dashed border-slate-300/80 p-3 dark:border-slate-700">
          <Select
            value={opponentIndex}
            onChange={(v) => {
              setOpponentIndex(v);
              setError(null);
            }}
            options={options}
            searchable
            searchPlaceholder="Search schools…"
            ariaLabel="Team to make a rival"
          />
          <input
            type="text"
            value={rivalryName}
            onChange={(e) => {
              setRivalryName(e.target.value);
              setError(null);
            }}
            placeholder="Name the rivalry — e.g. The Battle for the Bell"
            aria-label="Rivalry name"
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => void add()} disabled={busy}>
              Add rivalry
            </Button>
            {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
          </div>
        </div>

        <p className="mt-3 border-t border-slate-200/60 pt-3 text-xs text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
          Rivalries you name here show on both teams&apos; schedules, in each game&apos;s info page and on the
          Rivalries page. They live in DynastyOS only — <strong>nothing is written to your save file</strong>, and
          your save&apos;s own rivals above are left exactly as they are.
        </p>
      </div>
    </div>
  );
}

/** One user-declared rivalry: who it's against, what it's called, and its mark. */
function CustomRivalRow({
  rival,
  thisTeamKey,
  dynastyId,
  onChanged,
  onRemoved,
}: {
  rival: CustomRival;
  /** Which side of the pair we're looking from, so the row names the OTHER team. */
  thisTeamKey: string;
  dynastyId: string;
  onChanged: (row: CustomRival) => void;
  onRemoved: (pairKey: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const opponent = rival.teamNameKey === thisTeamKey ? rival.opponentName : rival.teamName;
  const preview = rival.logo?.path ? programArtUrl(rival.logo.path, rival.updatedAt) : null;

  async function run(action: () => Promise<CustomRival | null>) {
    setBusy(true);
    try {
      const updated = await action();
      if (updated) onChanged(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border border-slate-200/80 p-3 dark:border-slate-800">
      {/* Checkerboard, so a transparent upload reads as transparent rather than
          as a white square the user thinks they uploaded. */}
      <div
        className="grid h-14 w-14 shrink-0 place-items-center border border-slate-200/80 dark:border-slate-800"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%)',
          backgroundSize: '12px 12px',
        }}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Shield</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{rival.rivalryName}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">vs {opponent}</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
          Logo: 1024 × 1024, transparent PNG or WebP
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            compact
            disabled={busy}
            onClick={() => void run(() => window.api.rivals.pickLogo(dynastyId, rival.pairKey))}
          >
            {preview ? 'Replace logo' : 'Add logo'}
          </Button>
          {preview && (
            <Button
              variant="tertiary"
              compact
              disabled={busy}
              onClick={() => void run(() => window.api.rivals.clearLogo(dynastyId, rival.pairKey))}
            >
              Remove logo
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (await window.api.rivals.remove(dynastyId, rival.pairKey)) onRemoved(rival.pairKey);
          } finally {
            setBusy(false);
          }
        }}
        aria-label={`Delete the ${rival.rivalryName} rivalry`}
        title="Delete this rivalry"
        className="shrink-0 border border-slate-200/80 p-1.5 text-slate-400 transition hover:border-red-400/70 hover:text-red-600 disabled:opacity-40 dark:border-slate-800 dark:text-slate-500 dark:hover:text-red-400"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
