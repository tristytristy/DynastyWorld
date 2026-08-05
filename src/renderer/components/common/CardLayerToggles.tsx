import { ALL_CARD_LAYERS, CARD_SCRIM_MAX, CARD_SCRIM_MIN } from '../../../shared/types';
import type { CardLayers, CardScrim } from '../../../shared/types';

const ROWS: { key: keyof CardLayers; label: string; hint: string }[] = [
  { key: 'ovr', label: 'Overall', hint: 'The big number, top right' },
  { key: 'opponent', label: 'Opponent', hint: 'Only on a card made from one game' },
  { key: 'name', label: 'Name', hint: 'Up the left edge' },
  { key: 'profile', label: 'Profile', hint: 'Position · school · class · year' },
  { key: 'stats', label: 'Stats', hint: 'The line across the bottom' },
  { key: 'teamLogo', label: 'Team logo', hint: 'Gold mark, bottom right' },
];

/**
 * Which parts of the card are drawn, as press-to-toggle chips.
 *
 * One control shared by the card editor and the export dialog, because they are
 * the same decision seen twice and a card that looked one way in the editor and
 * another in the export would be the app arguing with itself. Chips rather than
 * a checkbox list: five short labels in a wrapped row take a third of the height
 * and read as a set of switches on the artwork, which is what they are.
 *
 * `on` chips wear the team colour, matching the stat picker directly below them
 * in the editor — same shape, same accent, same meaning ("this is on the card").
 */
export function CardLayerToggles({
  layers,
  onChange,
  disabled = false,
}: {
  layers: CardLayers;
  onChange: (next: CardLayers) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROWS.map((row) => {
        const on = layers[row.key];
        return (
          <button
            key={row.key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            title={row.hint}
            onClick={() => onChange({ ...ALL_CARD_LAYERS, ...layers, [row.key]: !on })}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition duration-fast ease-standard disabled:opacity-40 ${
              on
                ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                : 'border-slate-300/80 text-slate-500 hover:border-[var(--team-primary)] dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {row.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * THE BOTTOM FADE — on/off, and how far up the card it reaches.
 *
 * Separate from the layer chips above it even though it looks like one more
 * thing you can switch off, and the split is deliberate: every chip is a binary
 * about a piece of PRINTED CONTENT, and this is a continuous property of the
 * artwork. Folding a slider into a row of chips would have made the row two
 * different kinds of control wearing one costume.
 *
 * WHY IT EXISTS. The fade used to be a constant covering the bottom 58% of the
 * card. Over a generated portrait that is invisible — a head on a flat
 * background, nothing below the chin worth seeing. Over a photograph it is more
 * than half the picture, so anyone framing their own shot was composing against
 * it: the moment they were trying to place either sat in the dark or had to be
 * dragged up out of frame to escape it.
 *
 * The default now stops just above the team mark. The slider is for the cases
 * the default gets wrong in either direction — a busy shot that needs more
 * backing under the name, a clean one that wants almost none.
 */
export function CardScrimControl({
  scrim,
  onChange,
}: {
  scrim: CardScrim;
  onChange: (next: CardScrim) => void;
}) {
  const pct = Math.round(scrim.height * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Bottom fade</p>
        <button
          type="button"
          onClick={() => onChange({ ...scrim, enabled: !scrim.enabled })}
          aria-pressed={scrim.enabled}
          className={`px-2.5 py-1 text-[11px] font-semibold transition ${
            scrim.enabled
              ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
              : 'border border-slate-300/70 text-slate-500 dark:border-slate-700 dark:text-slate-400'
          }`}
        >
          {scrim.enabled ? 'On' : 'Off'}
        </button>
      </div>
      {/*
        The slider stays MOUNTED but disabled when the fade is off, rather than
        unmounting. A control that vanishes takes its own explanation with it —
        you switch the fade off, the slider disappears, and there is nothing left
        on screen to tell you the height is still there waiting.
      */}
      <div className={`flex items-center gap-3 ${scrim.enabled ? '' : 'opacity-40'}`}>
        <input
          type="range"
          min={Math.round(CARD_SCRIM_MIN * 100)}
          max={Math.round(CARD_SCRIM_MAX * 100)}
          value={pct}
          disabled={!scrim.enabled}
          onChange={(e) => onChange({ ...scrim, height: Number(e.target.value) / 100 })}
          aria-label="How far up the card the fade reaches"
          className="h-1 w-full flex-1 cursor-pointer appearance-none rounded-none bg-slate-300 accent-[var(--team-primary)] disabled:cursor-not-allowed dark:bg-slate-700"
        />
        <span className="tnum w-9 shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">{pct}%</span>
      </div>
    </div>
  );
}
