import { useEffect, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { GliderNav, gliderItemClass } from '../ui/GliderNav';
import { Button } from '../ui/Button';
import { useProgramArt } from '../../data/ProgramArtProvider';
import { useStadiumData } from '../../data/StadiumDataProvider';
import { canonicalKey } from '../../lib/assetMapping';
import { programArtUrl } from '../../lib/programArt';
import { ProgramRivalsTab } from './ProgramRivalsTab';
import type { ProgramArtSlot, ProgramOverride } from '../../../shared/types';

type Tab = 'identity' | 'artwork' | 'rivals';

/**
 * What each upload is for, and what it has to be.
 *
 * The sizes are MEASURED off the shipped art, not chosen — 1024×1024 for the
 * logo and helmet (drawn at showcase size on mastheads and matchup graphics),
 * 512×512 for the jersey and polo (which overlay a 512×512 portrait one-to-one).
 * Telling the user a number the app doesn't actually use would be worse than
 * telling them nothing.
 */
const TABS: Tab[] = ['identity', 'artwork', 'rivals'];
const TAB_LABELS: Record<Tab, string> = { identity: 'Identity', artwork: 'Artwork', rivals: 'Rivals' };

const SLOTS: { key: ProgramArtSlot; label: string; size: string; hint: string }[] = [
  {
    key: 'logo',
    label: 'Program logo',
    size: '1024 × 1024',
    hint: 'Transparent PNG or WebP. Used everywhere a team mark appears; the celebration variant is tinted from this one.',
  },
  {
    key: 'helmet',
    label: 'Helmet',
    size: '1024 × 1024',
    hint: 'Transparent, facing LEFT. The right-facing side of a matchup is mirrored from it automatically.',
  },
  {
    key: 'jersey',
    label: 'Uniform',
    size: '512 × 512',
    hint: 'Overlays a player portrait exactly — the collar and shoulders must sit where they do on the portrait, or every player looks off.',
  },
  {
    key: 'polo',
    label: 'Coach polo',
    size: '512 × 512',
    hint: 'Same as the uniform, over a coach portrait.',
  },
];

/**
 * The program editor — a school's own name-on-the-stadium and its artwork.
 *
 * WHY IT EXISTS. Teambuilder imports overwrite a real school's slot with a team
 * the shipped asset library has never heard of (verified against a real save:
 * "East Point" replacing Kent State at TeamIndex 39, with a random 10-character
 * asset token). Nothing in the save can fix that — the art simply doesn't exist
 * — so the user supplies it, and the app keeps it next to the dynasty rather
 * than pretending the save knows.
 *
 * SCOPED TO YOUR OWN PROGRAM for now, but stored keyed by the save's team SLOT,
 * so opening this for any other team later is an entry point rather than a
 * migration.
 *
 * Nothing here writes to the save file. Stadium text is metadata; the art files
 * are copied into the app's own storage. Both are reversible field by field.
 */
export function ProgramEditorModal({
  open,
  onClose,
  dynastyId,
  teamIndex,
  teamName,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
  teamIndex: number;
  teamName: string;
}) {
  const { overrides, applyOverride } = useProgramArt();
  const { getStadium } = useStadiumData();
  const teamNameKey = canonicalKey(teamName);
  const row = overrides.find((o) => o.teamIndex === teamIndex) ?? null;

  const [tab, setTab] = useState<Tab>('identity');
  const [stadiumName, setStadiumName] = useState('');
  const [stadiumCity, setStadiumCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // The built-in reference row is the placeholder, so the fields show what the
  // app is using right now rather than sitting empty and implying "unknown".
  const builtIn = getStadium(teamName);

  useEffect(() => {
    if (!open) return;
    setStadiumName(row?.stadiumName ?? '');
    setStadiumCity(row?.stadiumCity ?? '');
    setTab('identity');
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamIndex]);

  async function saveIdentity() {
    setBusy(true);
    try {
      const updated = await window.api.program.setIdentity(dynastyId, teamIndex, teamNameKey, {
        stadiumName: stadiumName.trim() || null,
        stadiumCity: stadiumCity.trim() || null,
      });
      if (updated) applyOverride(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function pick(slot: ProgramArtSlot) {
    setBusy(true);
    try {
      const updated = await window.api.program.pickArt(dynastyId, teamIndex, teamNameKey, slot);
      if (updated) applyOverride(updated);
    } finally {
      setBusy(false);
    }
  }

  async function clear(slot: ProgramArtSlot) {
    setBusy(true);
    try {
      const updated = await window.api.program.clearArt(dynastyId, teamIndex, teamNameKey, slot);
      if (updated) applyOverride(updated);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <CenteredModalPanel open={open} onClose={onClose} widthRem={40} eyebrow="Program editor" title={teamName}>
      <GliderNav className="mb-5" activeIndex={TABS.indexOf(tab)} ariaLabel="Program editor sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={gliderItemClass(tab === t)}
            aria-current={tab === t}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </GliderNav>

      {tab === 'rivals' ? (
        <ProgramRivalsTab dynastyId={dynastyId} teamIndex={teamIndex} teamName={teamName} />
      ) : tab === 'identity' ? (
        <div className="space-y-4">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Stadium name</p>
            <input
              type="text"
              value={stadiumName}
              onChange={(e) => {
                setStadiumName(e.target.value);
                setSaved(false);
              }}
              placeholder={builtIn?.stadium ?? 'Stadium name'}
              aria-label="Stadium name"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">City</p>
            <input
              type="text"
              value={stadiumCity}
              onChange={(e) => {
                setStadiumCity(e.target.value);
                setSaved(false);
              }}
              placeholder={builtIn?.city ?? 'City'}
              aria-label="Stadium city"
              className={`${inputClass} mt-1.5`}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => void saveIdentity()} disabled={busy}>
              Save
            </Button>
            {(stadiumName || stadiumCity) && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setStadiumName('');
                  setStadiumCity('');
                  setSaved(false);
                }}
              >
                Use built-in
              </Button>
            )}
            {saved && <span className="text-xs text-slate-400 dark:text-slate-500">Saved</span>}
          </div>

          <p className="border-t border-slate-200/60 pt-3 text-xs text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
            Shows on the schedule and on every game&apos;s info page. Leave a field blank to keep the built-in
            reference — nothing is written to your save file.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {SLOTS.map((slot) => (
            <ArtRow
              key={slot.key}
              slot={slot}
              row={row}
              busy={busy}
              onPick={() => void pick(slot.key)}
              onClear={() => void clear(slot.key)}
            />
          ))}
          <p className="border-t border-slate-200/60 pt-3 text-xs text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
            Your files are copied into the app&apos;s own storage, so moving or deleting the originals won&apos;t break
            anything. Remove an upload and the built-in artwork comes back.
          </p>
        </div>
      )}
    </CenteredModalPanel>
  );
}

/** One art slot: what it is, what size it wants, what's in it, and the two things you can do to it. */
function ArtRow({
  slot,
  row,
  busy,
  onPick,
  onClear,
}: {
  slot: (typeof SLOTS)[number];
  row: ProgramOverride | null;
  busy: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const file = row?.art[slot.key] ?? null;
  const preview = file?.path ? programArtUrl(file.path, row?.updatedAt ?? '') : null;

  return (
    <div className="flex items-start gap-3 border border-slate-200/80 p-3 dark:border-slate-800">
      {/* Checkerboard, so a transparent upload reads as transparent rather than
          as a white rectangle the user thinks they've uploaded. */}
      <div
        className="grid h-16 w-16 shrink-0 place-items-center border border-slate-200/80 dark:border-slate-800"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 6px 6px',
        }}
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-600">Built-in</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {slot.label}
          <span className="tnum text-xs font-normal text-slate-400 dark:text-slate-500">{slot.size}</span>
        </p>
        <p className="mt-0.5 text-xs leading-5 text-slate-400 dark:text-slate-500">{slot.hint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={busy} onClick={onPick}>
            {preview ? 'Replace' : 'Upload'}
          </Button>
          {preview && (
            <Button variant="secondary" disabled={busy} onClick={onClear}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
