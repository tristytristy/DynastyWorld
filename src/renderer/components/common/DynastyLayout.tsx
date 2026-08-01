import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { GliderNav, gliderItemClass } from '../ui/GliderNav';
import { Select, type SelectOption } from '../ui/Select';
import { TeamLogo } from './TeamLogo';
import { SelectedSeasonProvider, useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { ViewedTeamProvider } from '../../data/ViewedTeamProvider';
import { CommandPalette } from './CommandPalette';
import { TEAM_TABS } from '../../pages/TeamHubLayout';
import { NCAA_TABS } from '../../pages/NcaaHubLayout';
import { RECRUIT_TABS } from '../../pages/RecruitHubLayout';
import { TeamProfileModal } from './TeamProfileModal';
import type { DynastyTheme } from '../../../shared/types';

// A bare glyph — no border, no fill. It sits beside the season switcher, and a
// second bordered box there read as a second control of equal weight when this is
// really just a way in. It still STRETCHES to the row's height, which costs
// nothing visually and keeps the click target full-size rather than icon-size.
const NAV_SEARCH_TRIGGER_CLASS =
  'flex w-[38px] shrink-0 self-stretch items-center justify-center text-slate-400 transition-colors duration-base ease-standard hover:text-slate-900 dark:text-slate-500 dark:hover:text-white';

// The top nav is three sections (IA reorg 2026-07-19). Team and league pages
// keep flat URLs (pathless layout shells), so a section highlights by
// membership, not URL prefix.
/*
  WHICH TOP-LEVEL SECTION A PAGE BELONGS TO — derived from each hub's own tab
  list, not a second hand-kept copy.

  These were literal sets, and they drifted: `scores`, `national-stats`,
  `players` and `ncaa-records` were never added to the NCAA set, so opening any
  of those four fell through to the default and lit up "Coach" in the main nav
  while you were plainly in the NCAA hub. `watchlist` had the same problem under
  Recruiting. Deriving from the lists the sub-navs already render means adding a
  page to a hub cannot leave the section nav behind again.

  The pair routes (Roster|Transfers, Schedule|Rivalries, …) contribute both of
  their paths, which is why Team uses `paths` rather than `to`.
*/
const stripSlash = (path: string) => path.replace(/^\//, '');

const TEAM_PATHS = new Set(TEAM_TABS.flatMap((tab) => tab.paths).filter(Boolean));
const LEAGUE_PATHS = new Set(NCAA_TABS.map((tab) => stripSlash(tab.to)));
const RECRUIT_PATHS = new Set(RECRUIT_TABS.map((tab) => stripSlash(tab.to)));
const MEDIA_PATHS = new Set(['media']);

function SeasonSwitcher() {
  const { seasons, selectedSeasonId, setSelectedSeasonId } = useSelectedSeason();

  if (seasons.length <= 1) return null;

  /*
    Logo · team · year (user direction). The school is what a coach-journey
    dynasty is actually scanning for — a list of bare years tells you nothing
    about which of them was the Sac State era. The year moves to the row's
    trailing slot so the school names stay left-aligned and readable as a column.
  */
  const options: SelectOption<string>[] = seasons.map((season) => ({
    value: String(season.id),
    label: [
      season.teamName ?? `${season.seasonYear} season`,
      season.isCurrent ? '(current)' : '',
      season.hasFullData ? '' : '· History Only',
    ]
      .filter(Boolean)
      .join(' '),
    meta: String(season.seasonYear),
    keywords: String(season.seasonYear),
    icon: season.teamName ? (
      <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" className="shrink-0" />
    ) : undefined,
  }));

  return (
    <Select
      value={String(selectedSeasonId ?? '')}
      onChange={(next) => setSelectedSeasonId(next ? Number(next) : undefined)}
      options={options}
      ariaLabel="Season"
      // Bare in the nav: the row is chrome, and a boxed switcher next to a bare
      // search glyph read as two controls of different weight. The dropdown
      // panel keeps its own border — it floats over the page and needs the edge.
      variant="bare"
      // No `ml-auto` — the nav row positions this as part of its right-hand
      // group, and a second auto-margin was what split it from the search.
      className="shrink-0"
    />
  );
}

/**
 * A history-only season (backfilled from the save's own league-wide history
 * — see extract-league-history.ts) has no roster/schedule/stats/teams
 * snapshot, so every per-season page on this tab bar will just show its own
 * generic "not found" state. That's technically correct but gives no
 * context on its own — this banner supplies the missing "why," once, above
 * whichever tab is active, instead of rewriting every page's empty state.
 */
function HistoryOnlySeasonBanner({ dynastyId }: { dynastyId: string }) {
  const { seasons, selectedSeasonId } = useSelectedSeason();
  const selected = seasons.find((season) => season.id === selectedSeasonId);
  if (!selected || selected.hasFullData) return null;

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/90 px-5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="font-semibold">{selected.seasonYear} — History Only.</span>{' '}
      This season wasn&apos;t individually synced, so only league-wide results (national/conference champions, season
      awards) are available — see the{' '}
      <Link to={`/dynasty/${dynastyId}/history`} className="font-medium underline underline-offset-2">
        Team Hub → History tab
      </Link>
      . Full roster, schedule, and stats require syncing while that season is current.
    </div>
  );
}

/** Top-level section nav: Coach · Program · NCAA · Recruiting · Media. Highlights by section membership since pages keep flat URLs. */
function DynastyNav({ id }: { id: string }) {
  const location = useLocation();
  const sub = location.pathname.split(`/dynasty/${id}`)[1]?.replace(/^\//, '').split('/')[0] ?? '';
  const section = TEAM_PATHS.has(sub)
    ? 'team'
    : LEAGUE_PATHS.has(sub)
      ? 'league'
      : RECRUIT_PATHS.has(sub)
        ? 'recruit'
        : MEDIA_PATHS.has(sub)
          ? 'media'
          : 'coach';
  // The glider is driven by position, so the sections need a declared order —
  // the same order they're rendered in below.
  const activeIndex = ['coach', 'team', 'league', 'recruit', 'media'].indexOf(section);

  /*
    Publishes this row's real height as `--section-nav-h` so the rows that pin
    beneath it (Team Hub's sub-nav) can offset by what it ACTUALLY measures.
    It used to be a hard-coded `4rem` guess, which was 7px short — the sub-nav
    pinned underneath this row and lost its top edge behind it.

    Measured rather than constant because this row's height is not fixed: the
    tabs, the season switcher and search share one `flex-wrap` row, so at a
    narrow width it wraps to two lines and grows. A literal would be wrong again
    the moment that happens; an observer just follows it.
  */
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty('--section-nav-h', `${el.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    /*
      No box. The section bar was a bordered, filled card with its own padding —
      the last framed surface left after sections lost theirs. It's a plain row
      now, closed off by a single divider-weight rule, the same hairline used
      between sections.

      THIS ROW OWNS THE TOP EDGE. It is the first thing in the panel and
      everything else scrolls underneath it, so it pins flush at `top-0` with no
      negative margin: <main>'s scroller no longer has top padding (App.tsx), and
      that is what makes `top-0` mean the top of the panel rather than the top of
      the padding box.

      That padding is exactly what broke this before. A sticky row pins to its
      scroll container's CONTENT box, so while the scroller had `p-5 md:p-8` the
      row sat 20–32px down with a live band of scrolling page above it — on Coach
      Hub the masthead portrait showed over the tabs and the polo below them,
      with the row floating mid-page. The old `-mt-5` was an attempt to claw that
      back and never could: it is a single value against a padding step that
      changes at `md`, and a margin doesn't move the sticky offset anyway.

      `pt-3.5` is the alignment, and it is measured, not guessed: the sidebar's
      "Dynasty" label centres on y=79 and the tab row carries 6px of its own lead
      above the text, so 14px of padding from a flush top edge lands the tabs on
      that same line. Snug against the panel, level with the sidebar.

      The background is opaque so content passes UNDER the row rather than beside
      it (`bg-black` in dark is the panel's own value; white in light is a hair
      brighter than its `white/82` but doesn't ghost the text scrolling beneath,
      which a translucent row would). z-30 clears page content without reaching
      the modal layers, which live in their own stacking context at <body>.

      The Team Hub sub-nav pins directly beneath this row and measures its own
      `top` from the same origin — change this row's height and that one has to
      follow, or a band of page opens up between them.
    */
    <nav
      ref={navRef}
      className="sticky top-0 z-30 border-b border-[color:var(--section-divider)] bg-white pb-2 pt-3.5 dark:bg-black"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {/* The glider spans the TABS only — the season switcher and search that
            follow are controls, not destinations, so the rail must not run under
            them. px-3.5 (gliderItemClass's default) matches the hub sub-navs
            exactly: the two rows sit directly above one another, so their text
            has to start on the same pixel. */}
        <GliderNav activeIndex={activeIndex} ariaLabel="Dynasty sections" itemsClassName="gap-1.5">
          <Link to={`/dynasty/${id}`} className={gliderItemClass(section === 'coach')}>
            Coach
          </Link>
          <Link to={`/dynasty/${id}/team-hub`} className={gliderItemClass(section === 'team')}>
            Program
          </Link>
          <Link to={`/dynasty/${id}/ncaa-hub`} className={gliderItemClass(section === 'league')}>
            NCAA
          </Link>
          <Link to={`/dynasty/${id}/recruiting`} className={gliderItemClass(section === 'recruit')}>
            Recruiting
          </Link>
          <Link to={`/dynasty/${id}/media`} className={gliderItemClass(section === 'media')}>
            Media
          </Link>
        </GliderNav>
        {/* Switcher and search travel together as one right-hand group. They
            each carried their own `ml-auto` before, which pushed them apart —
            the switcher to the middle, the search to the far edge — and left the
            gap the user asked to close. One `ml-auto` on the group, the row's
            own gap between them. Search keeps the whole archive company with
            navigation rather than being filed under utilities. */}
        <div className="ml-auto flex items-stretch gap-2">
          <SeasonSwitcher />
          <CommandPalette triggerClassName={NAV_SEARCH_TRIGGER_CLASS} />
        </div>
      </div>
    </nav>
  );
}

/**
 * Applies the team theme for the SELECTED season, so viewing a previous season
 * paints the app in the previous school's colors (the coach-journey goal). Lives
 * inside SelectedSeasonProvider so it can read the selected season; getSeasonTheme
 * falls back to the dynasty's current-team theme for a history-only season.
 */
function SeasonThemedShell({ id }: { id: string }) {
  const { resolveColorVars } = useTheme();
  const { selectedSeasonId } = useSelectedSeason();
  const [theme, setTheme] = useState<DynastyTheme | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    window.api.db.getSeasonTheme(id, selectedSeasonId).then((result) => {
      if (!cancelled) setTheme(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, selectedSeasonId]);

  const colorVars = resolveColorVars({
    primary: theme?.primaryColor ?? null,
    secondary: theme?.secondaryColor ?? null,
  });

  return (
    <div style={colorVars as unknown as CSSProperties} className="space-y-6">
      <DynastyNav id={id} />
      <HistoryOnlySeasonBanner dynastyId={id} />
      <Outlet />
      <TeamProfileModal />
    </div>
  );
}

export function DynastyLayout() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  return (
    <SelectedSeasonProvider dynastyId={id}>
      <ViewedTeamProvider dynastyId={id}>
        <SeasonThemedShell id={id} />
      </ViewedTeamProvider>
    </SelectedSeasonProvider>
  );
}
