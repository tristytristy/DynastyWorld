import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GliderNav, gliderItemClass } from '../ui/GliderNav';
import { TeamLogo } from './TeamLogo';
import type { DynastySummary } from '../../../shared/types';

const UPCOMING_LINKS: string[] = [];

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

  /*
    The glider is positional, so the rows are ONE flat list: the "Dynasty" index
    row at 0, then each dynasty. That's why the dynasty rows carry their own
    indent (pl-10) instead of sitting in a nested wrapper — a wrapper would be a
    single child holding many rows, and the indicator could no longer find them.
    Its own left border is gone too: the glider's rail is that vertical line now.
  */
  const activeDynastyId = location.pathname.startsWith('/dynasty/')
    ? location.pathname.split('/')[2]
    : undefined;
  const rows = expanded ? dynasties : [];
  // -1 (no glider) when the active dynasty's row is collapsed out of view — the
  // alternative is parking the indicator on a row that isn't where you are.
  const activeIndex = activeDynastyId
    ? rows.findIndex((dynasty) => dynasty.id === activeDynastyId) + 1 || -1
    : location.pathname === '/'
      ? 0
      : -1;

  return (
    <aside className="hidden w-[290px] shrink-0 overflow-y-auto lg:block">
      <nav className="flex h-full flex-col border border-slate-900/10 bg-white/85 p-4 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur-md dark:border-white/10 dark:bg-black">
        <GliderNav
          activeIndex={activeIndex}
          orientation="vertical"
          ariaLabel="Dynasties"
          itemsClassName="gap-1"
        >
          <div className="flex items-center gap-1">
            <Link to="/" className={`flex-1 ${gliderItemClass(activeIndex === 0, 'px-4 py-3')}`}>
              Dynasty
            </Link>
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

          {rows.map((dynasty, index) => (
            <Link
              key={dynasty.id}
              to={`/dynasty/${dynasty.id}`}
              className={`block ${gliderItemClass(activeIndex === index + 1, 'pl-10 pr-4 py-3')}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <TeamLogo
                  team={{ assetName: dynasty.teamName, label: dynasty.teamName }}
                  size="sm"
                  className="shrink-0"
                />
                <span className="truncate">{dynasty.coachName ?? dynasty.teamName}</span>
              </span>
            </Link>
          ))}
        </GliderNav>

        {/* The Tools group (Preferences / Quick Help / User Manual / About)
            moved into the title bar as icons — the pattern every browser uses,
            and it hands the sidebar its full height back for the dynasty list.
            Quick Help was retired at the same time: the manual covers it, and
            two doors to the same room is one too many. HelpMenu itself is left
            in the tree, unreferenced, so restoring it is a one-line change. */}

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

      </nav>
    </aside>
  );
}
