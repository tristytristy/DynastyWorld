import { ALL_CARD_LAYERS } from '../../../shared/types';
import type { CardLayers } from '../../../shared/types';

const ROWS: { key: keyof CardLayers; label: string; hint: string }[] = [
  { key: 'ovr', label: 'Overall', hint: 'The big number, top right' },
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
