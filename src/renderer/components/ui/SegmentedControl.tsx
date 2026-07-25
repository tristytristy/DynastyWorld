/**
 * A premium two-plus-option segmented control (visual overhaul shape language:
 * hard edges, active segment fills with the team accent). Keyboard-accessible
 * via role="tab". Used for the Statistics Team/Player mode and Total/Per-Game
 * switches, and reusable anywhere a compact exclusive choice is needed.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 border border-slate-200/80 bg-slate-50/90 p-1 dark:border-slate-800 dark:bg-white/5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`${pad} font-medium transition-colors duration-base ${
              active
                ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
