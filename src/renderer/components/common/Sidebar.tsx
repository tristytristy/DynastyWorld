import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TeamLogo } from './TeamLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { PreferencesMenu } from './PreferencesMenu';
import { HelpMenu } from './HelpMenu';
import { StadiumDatabaseMenu } from './StadiumDatabaseMenu';
import type { DynastySummary } from '../../../shared/types';

const UPCOMING_LINKS: string[] = [];

// Shared full-width trigger styling for the utility controls now docked at the
// bottom of the sidebar (theme toggle + the three menus).
const UTILITY_TRIGGER_CLASS =
  'w-full border border-slate-200/80 bg-white/80 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10';

function navClass(isActive: boolean): string {
  return [
    'group flex items-center justify-between border border-transparent px-4 py-3 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'border-[var(--team-primary)] bg-[linear-gradient(90deg,rgba(37,99,235,0.14),rgba(37,99,235,0.03))] text-slate-950 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.45)] dark:text-white'
      : 'text-slate-700 hover:border-slate-200 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-3.5 w-3.5 transition-transform duration-base ${expanded ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { appearance, toggleAppearance } = useTheme();
  const isDark = appearance === 'dark';
  const [dynasties, setDynasties] = useState<DynastySummary[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.api.db.getDynasties().then((result) => {
      if (!cancelled) setDynasties(result);
    });
    return () => {
      cancelled = true;
    };
    // Refetching on every navigation is the simplest way to pick up a dynasty
    // just imported/deleted elsewhere without needing a shared live-refresh
    // context just for this list — cheap, and covers the common case of
    // importing then immediately opening the new dynasty.
  }, [location.pathname]);

  return (
    <aside className="hidden w-[290px] shrink-0 overflow-y-auto lg:block">
      <nav className="flex h-full flex-col border border-white/65 bg-white/70 p-4 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.38)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={({ isActive }) => `flex-1 ${navClass(isActive)}`}>
              <span>Dynasty</span>
            </NavLink>
            {dynasties.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-label={expanded ? 'Collapse dynasty list' : 'Expand dynasty list'}
                aria-expanded={expanded}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                <ChevronIcon expanded={expanded} />
              </button>
            )}
          </div>

          {expanded && dynasties.length > 0 && (
            <div className="ml-3 space-y-1 border-l border-slate-200/80 pl-3 dark:border-slate-800">
              {dynasties.map((dynasty) => (
                <NavLink
                  key={dynasty.id}
                  to={`/dynasty/${dynasty.id}`}
                  className={({ isActive }) => navClass(isActive)}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TeamLogo
                      team={{ assetName: dynasty.teamName, label: dynasty.teamName }}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="truncate">{dynasty.coachName ?? dynasty.teamName}</span>
                  </span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {UPCOMING_LINKS.length > 0 && (
          <div className="mt-6 border border-slate-200/80 bg-slate-50/85 p-4 dark:border-white/5 dark:bg-white/5">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Planned Modules
            </p>
            <div className="mt-3 space-y-2">
              {UPCOMING_LINKS.map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between border border-transparent px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500"
                >
                  <span>{label}</span>
                  <span className="border border-slate-300/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] dark:border-slate-700">
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Utility controls, docked at the bottom (mt-auto) so they sit far from the Dynasty list at the top. */}
        <div className="mt-auto space-y-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={toggleAppearance}
            className={UTILITY_TRIGGER_CLASS}
            aria-label="Toggle dark mode"
          >
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <PreferencesMenu triggerClassName={UTILITY_TRIGGER_CLASS} />
          <HelpMenu triggerClassName={UTILITY_TRIGGER_CLASS} />
          <StadiumDatabaseMenu triggerClassName={UTILITY_TRIGGER_CLASS} />
        </div>
      </nav>
    </aside>
  );
}
