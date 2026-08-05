import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GliderNav, gliderItemClass } from '../ui/GliderNav';
import { TeamLogo } from './TeamLogo';
import type { DynastySummary } from '../../../shared/types';

const UPCOMING_LINKS: string[] = [];

/**
 * Whether the rail is collapsed, PERSISTED — unlike the dynasty list's own
 * expand/collapse, which is a glance and resets.
 *
 * The reason is the user's: once you've picked the dynasty you coach, the panel
 * is a permanent 290px reminder of a choice you already made. Someone who
 * collapses it means it, and means it tomorrow too.
 */
const COLLAPSED_KEY = 'cfb.sidebarCollapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
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

/** Points the way the panel will move — into the edge to collapse, out of it to reopen. */
function RailToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M3 3.5v13" strokeLinecap="round" />
      <path
        d={collapsed ? 'M8 10h8M12.5 6.5 16 10l-3.5 3.5' : 'M17 10H9M12.5 6.5 9 10l3.5 3.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar() {
  const location = useLocation();
  const [dynasties, setDynasties] = useState<DynastySummary[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      /* non-fatal: the rail simply reopens next launch */
    }
  }, [collapsed]);

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
  // Collapsed, the list is the ONLY thing left in the rail, so it stays open
  // regardless — a rail with its one row hidden would be an empty strip.
  const rows = expanded || collapsed ? dynasties : [];
  // -1 (no glider) when the active dynasty's row is collapsed out of view — the
  // alternative is parking the indicator on a row that isn't where you are.
  const activeIndex = activeDynastyId
    ? rows.findIndex((dynasty) => dynasty.id === activeDynastyId) + 1 || -1
    : location.pathname === '/'
      ? 0
      : -1;

  /*
    COLLAPSED IS A RAIL, NOT A DISAPPEARANCE.

    The panel exists to switch dynasties, and someone who collapses it hasn't
    stopped being able to — they've stopped needing the names. So it keeps the
    team marks and drops everything that was only there to label them: 290px of
    list becomes a 64px strip of logos, and the ~226px goes to the page, which
    is the point on a recruiting board with eight columns.

    Hiding it entirely was the other option and it's worse: the way back has to
    live somewhere, and a floating handle over the content is a second piece of
    chrome to explain. The rail IS the way back.
  */
  return (
    <aside
      className={`hidden shrink-0 overflow-y-auto transition-[width] duration-base ease-standard lg:block ${
        collapsed ? 'w-[64px]' : 'w-[290px]'
      }`}
    >
      <nav
        className={`flex h-full flex-col border border-slate-900/10 bg-white/85 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] backdrop-blur-md dark:border-white/10 dark:bg-black ${
          collapsed ? 'px-2 py-4' : 'p-4'
        }`}
      >
        {/*
          Above the list, not below it, and icon-only (user's call). It sits
          outside the GliderNav on purpose: that nav is a positional indicator
          over its own children, so a button among them would be a row the
          glider could land on.

          Right-aligned when open, because it points at the edge it collapses
          toward; centred when the rail is 64px wide and there is no other
          alignment to have.
        */}
        <div className={`mb-1 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand the dynasty panel' : 'Collapse the dynasty panel'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand the dynasty panel' : 'Collapse the dynasty panel'}
            className="flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
          >
            <RailToggleIcon collapsed={collapsed} />
          </button>
        </div>

        <GliderNav
          activeIndex={activeIndex}
          orientation="vertical"
          ariaLabel="Dynasties"
          itemsClassName="gap-1"
        >
          <div className="flex items-center gap-1">
            <Link
              to="/"
              title={collapsed ? 'All dynasties' : undefined}
              className={`flex-1 ${gliderItemClass(activeIndex === 0, collapsed ? 'px-0 py-3 text-center' : 'px-4 py-3')}`}
            >
              {/* The full word doesn't fit a 64px rail, and shrinking it to fit
                  would make the one label in the panel the smallest text in the
                  app. "All" says the same thing at this width. */}
              {collapsed ? 'All' : 'Dynasty'}
            </Link>
            {dynasties.length > 0 && !collapsed && (
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
              // Collapsed, the logo is the whole row, so the name it stands for
              // has to be reachable some other way.
              title={collapsed ? (dynasty.coachName ?? dynasty.teamName) : undefined}
              className={`block ${gliderItemClass(
                activeIndex === index + 1,
                collapsed ? 'px-0 py-2.5' : 'pl-10 pr-4 py-3',
              )}`}
            >
              <span className={`flex min-w-0 items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
                <TeamLogo
                  team={{ assetName: dynasty.teamName, label: dynasty.teamName }}
                  size="sm"
                  className="shrink-0"
                />
                {!collapsed && <span className="truncate">{dynasty.coachName ?? dynasty.teamName}</span>}
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
