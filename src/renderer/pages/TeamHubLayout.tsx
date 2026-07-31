import { Outlet, Link, useParams, useLocation } from 'react-router-dom';
import { TeamSwitcher } from '../components/common/TeamSwitcher';
import { GliderNav, gliderItemClass } from '../components/ui/GliderNav';

/**
 * The tabs in render order — the glider is driven by position, and each tab
 * highlights for every route in its pair (merged tabs, see below).
 */
const TABS: { to: string; label: string; paths: string[] }[] = [
  { to: 'team-hub', label: 'Overview', paths: ['team-hub', ''] },
  // Labelled "Team" rather than "Roster": the tab holds the Roster|Transfers
  // pair, so naming it after one half read as a broken link to the other.
  { to: 'roster', label: 'Team', paths: ['roster', 'transfers'] },
  { to: 'schedule', label: 'Schedule', paths: ['schedule', 'rivalries'] },
  { to: 'statistics', label: 'Statistics', paths: ['statistics', 'trends'] },
  { to: 'team-awards', label: 'Honors', paths: ['team-awards', 'weekly-honors'] },
  { to: 'history', label: 'History', paths: ['history'] },
];

/**
 * Team Hub shell — the home for everything about the selected team. Phase 4
 * unification (2026-07-21): the old standalone team-identity masthead was
 * removed (it duplicated the Overview page's own hero); the team selector now
 * lives in the sub-nav row itself. The single source of team identity is the
 * page hero (Team Overview Hero on the Overview tab, page headers elsewhere).
 * The switcher re-scopes every switcher-aware sub-tab at once. URLs stay flat.
 */
export function TeamHubLayout() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  if (!id) return null;

  // Flat URLs, so highlight by membership. Merged tabs (Roster, Schedule,
  // Statistics, Honors) stay active across either page in their pair.
  const sub = location.pathname.split(`/dynasty/${id}`)[1]?.replace(/^\//, '').split('/')[0] ?? 'team-hub';
  const activeIndex = TABS.findIndex((entry) => entry.paths.includes(sub));

  return (
    <div className="space-y-5">
      {/* Sub-nav + team selector on one row — the selector carries team identity across every tab. */}
      {/*
        STICKY, BELOW the section nav. Without it the History and Statistics
        pages scrolled the team tabs and the team switcher out of reach — which
        is where the user actually needs them on a long page.

        The offset is `--section-nav-h`, which DynastyLayout measures off the
        real section row and republishes whenever it resizes. This was a
        hard-coded `4rem`, which under-measured the row by 7px and tucked this
        row's top edge behind it; a literal also can't survive that row wrapping
        to two lines at a narrow width. The fallback matches the row's current
        height and only applies if this ever renders outside DynastyLayout.
      */}
      <div className="sticky top-[var(--section-nav-h,4.4375rem)] z-20 -mx-1 flex flex-col gap-3 bg-white px-1 py-2 dark:bg-black lg:flex-row lg:items-center lg:justify-between">
        {/*
          The bordered, filled strip is gone: the glider's own rail is what
          groups these tabs now, and a box around them as well read as two
          competing frames. `overflow-x-auto` stays on this WRAPPER rather than
          on GliderNav — the rail is positioned in the tab row's coordinates, so
          it scrolls with the tabs instead of staying pinned to the visible edge.
          Quiet emphasis because the section bar directly above carries the
          bloomed version; see the glider notes in globals.css.
        */}
        <div className="overflow-x-auto">
          <GliderNav
            activeIndex={activeIndex}
            emphasis="quiet"
            ariaLabel="Team Hub sections"
            itemsClassName="gap-1.5"
          >
            {TABS.map((entry) => (
              <Link
                key={entry.to}
                to={`/dynasty/${id}/${entry.to}`}
                className={gliderItemClass(entry.paths.includes(sub), 'px-3.5 py-1.5')}
              >
                {entry.label}
              </Link>
            ))}
          </GliderNav>
        </div>
        <div className="shrink-0">
          <TeamSwitcher />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
