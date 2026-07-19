import { useTheme } from '../../theme/ThemeProvider';
import { PreferencesMenu } from './PreferencesMenu';
import { HelpMenu } from './HelpMenu';
import { StadiumDatabaseMenu } from './StadiumDatabaseMenu';

export function Navbar() {
  const { appearance, toggleAppearance } = useTheme();
  const isDark = appearance === 'dark';

  return (
    <header className="relative z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 border border-white/65 bg-white/72 px-5 py-4 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/72">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--team-primary)] text-sm font-semibold tracking-[0.24em] text-[var(--team-on-primary)] shadow-[0_18px_40px_-22px_rgba(37,99,235,0.9)]">
            HUB
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                College Football 27 Dynasty Hub
              </h1>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleAppearance}
            className="border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <PreferencesMenu />
          <HelpMenu />
          <StadiumDatabaseMenu />
        </div>
      </div>
    </header>
  );
}
