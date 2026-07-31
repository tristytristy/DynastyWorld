import { Route, Routes } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { DynastyLayout } from './components/common/DynastyLayout';
import { Dashboard } from './pages/Dashboard';
import { CoachHub } from './pages/CoachHub';
import { DynastyOverview } from './pages/DynastyOverview';
import { TeamHubLayout } from './pages/TeamHubLayout';
import { PairLayout } from './components/common/PairLayout';
import { NcaaHubLayout } from './pages/NcaaHubLayout';
import { RecruitHubLayout } from './pages/RecruitHubLayout';
import { DynastyTrends } from './pages/DynastyTrends';
import { Transfers } from './pages/Transfers';
import { Rivalries } from './pages/Rivalries';
import { NcaaHub } from './pages/NcaaHub';
import { NcaaRecords } from './pages/NcaaRecords';
import { Roster } from './pages/Roster';
import { Schedule } from './pages/Schedule';
import { Standings } from './pages/Standings';
import { Scores } from './pages/Scores';
import { Statistics } from './pages/Statistics';
import { TeamAwards } from './pages/TeamAwards';
import { AnnualAwards } from './pages/awards/AnnualAwards';
import { AllTeams } from './pages/awards/AllTeams';
import { WeeklyHonors } from './pages/awards/WeeklyHonors';
import { NationalRecruits } from './pages/NationalRecruits';
import { NationalPlayers } from './pages/NationalPlayers';
import { NationalStatistics } from './pages/NationalStatistics';
import { History } from './pages/History';
import { Media } from './pages/Media';
import { PlayerProfileModal } from './components/common/PlayerProfileModal';
import { GameDetailModal } from './components/common/GameDetailModal';
import { ProgramArtProvider } from './data/ProgramArtProvider';
import { EditorModalHost } from './components/common/EditorModalHost';
import { RecruitProfileModal } from './components/common/RecruitProfileModal';
import { UpdateNotice } from './components/common/UpdateNotice';
import { angledClip } from './components/ui/angledClip';

const ANGLED_PANEL = angledClip('1.25rem');


export function App() {
  return (
    /*
      ProgramArtProvider wraps the ENTIRE shell, global modal hosts included.
      Team artwork and a user-defined stadium have to resolve wherever a team is
      drawn, and the game box score is a modal mounted outside the dynasty route
      — inside the route, its venue line came back blank while the Schedule page
      behind it showed the override correctly. It reads the dynasty from a route
      match rather than from params, which is what lets it sit up here.
    */
    /*
      h-full, NOT min-h-full — and that one letter is what keeps the title bar
      on screen.

      With `min-height: 100%` these wrappers grow to fit their content, so on a
      long page the shell became 6,313px tall inside a 900px window: the
      DOCUMENT scrolled, the title bar scrolled away with it, and the panel's
      own `overflow-y-auto` never fired because its content had all the room it
      wanted. Measured directly — zero elements on the page had a scrollable
      overflow, and the header sat at top: -2000px after a scroll.

      Pinning the shell to the viewport puts the height back under the panel, so
      the panel scrolls and the chrome around it cannot move. That matters
      beyond tidiness: the title bar is the window's drag region and carries
      Preferences / Manual / About, so scrolling it off the top takes away the
      ability to move the window or reach settings until you scroll back up.
    */
    <ProgramArtProvider>
    <div className="relative h-full overflow-hidden">
      {/* Phase 10: the blue/cyan aurora beams that used to sit behind the shell
          were removed — they read as "glow" against the analog-matte direction.
          The ground's own subtle vertical falloff (globals.css) is the only
          surface variation now; team color lives in accents, not the backdrop. */}

      <div className="relative flex h-full flex-col">
        <Navbar />

        {/*
          ONE spacing value for the whole shell: 8px, from the window edge to
          the panels and between the sidebar and the main area alike. It used to
          be three different numbers — 12px under the header, 16px between the
          panels, widening to 24px at md — so the header appeared welded to the
          body while the two panels drifted apart, and the difference read as
          negative space rather than rhythm. Same gap everywhere, at every
          breakpoint, tight enough that the panels read as one surface.
        */}
        {/* min-h-0: a flex item defaults to min-height:auto, which refuses to
            shrink below its content — so without it these two wrappers hand the
            panel an unbounded height and the document starts scrolling again,
            h-full above notwithstanding. */}
        <div className="flex min-h-0 flex-1 gap-2 p-2 pt-1">
          <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-2 overflow-hidden">
            <Sidebar />

            <main
              style={ANGLED_PANEL}
              className="relative flex-1 overflow-hidden border border-slate-900/10 bg-white/82 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.32)] backdrop-blur-md dark:border-white/10 dark:bg-black"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0))] dark:bg-none" />
              {/* Signature left edge — the selected team's color, a thin accent so
                  the program is present in the chrome (accent only — the ground
                  stays black). 1px, matching SELECTION_BASE's border: every
                  other stroke in the app is a hairline, so a 3px bar here read
                  as a different design language rather than the same one. */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,transparent,var(--team-primary),transparent)] opacity-90" />
              <div
                /*
                  `scrollbar-gutter: stable` is the fix for the page "jitter":
                  without it, arriving on a page long enough to scroll made the
                  scrollbar appear, which stole ~15px of width and reflowed every
                  panel inside — then leaving for a shorter page gave it back and
                  everything sprang out again. Reserving the gutter permanently
                  means the layout never changes width, at the cost of that strip
                  always being spoken for.
                */
                style={{ scrollbarGutter: 'stable' }}
                className="relative h-full overflow-y-auto p-5 md:p-8"
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dynasty/:id" element={<DynastyLayout />}>
                    <Route index element={<CoachHub />} />
                    {/* Media Hub — its own top-level section (dynasty-wide, season-scoped), not team-scoped. */}
                    <Route path="media" element={<Media />} />
                    {/* Team Hub section — persistent masthead + switcher; pages keep flat URLs. */}
                    <Route element={<TeamHubLayout />}>
                      <Route path="team-hub" element={<DynastyOverview />} />
                      <Route element={<PairLayout items={[{ to: 'roster', label: 'Roster' }, { to: 'transfers', label: 'Transfers' }]} />}>
                        <Route path="roster" element={<Roster />} />
                        <Route path="transfers" element={<Transfers />} />
                      </Route>
                      <Route element={<PairLayout items={[{ to: 'schedule', label: 'Schedule' }, { to: 'rivalries', label: 'Rivalries' }]} />}>
                        <Route path="schedule" element={<Schedule />} />
                        <Route path="rivalries" element={<Rivalries />} />
                      </Route>
                      <Route element={<PairLayout items={[{ to: 'statistics', label: 'Statistics' }, { to: 'trends', label: 'Analytics' }]} />}>
                        <Route path="statistics" element={<Statistics />} />
                        <Route path="trends" element={<DynastyTrends />} />
                      </Route>
                      <Route element={<PairLayout items={[{ to: 'team-awards', label: 'Season Awards' }, { to: 'weekly-honors', label: 'Weekly Honors' }]} />}>
                        <Route path="team-awards" element={<TeamAwards />} />
                        <Route path="weekly-honors" element={<WeeklyHonors />} />
                      </Route>
                      <Route path="history" element={<History />} />
                    </Route>
                    {/* NCAA Hub section — the nation. */}
                    {/* All three render the SAME component with different props,
                        so React reconciles them as one element and PRESERVES its
                        state across the tabs — which meant walking from My Board
                        to National Recruits carried the board filter with it, and
                        the national page opened showing "0 of 4,100" with My Board
                        silently ticked. Its filter state is seeded from `boardOnly`
                        at mount, and without distinct keys that mount never
                        happens again. The keys force a real remount per tab, so
                        each page starts with its own filters. */}
                    <Route element={<RecruitHubLayout />}>
                      <Route path="recruiting" element={<NationalRecruits key="my-board" boardOnly />} />
                      <Route path="recruits" element={<NationalRecruits key="national" />} />
                      <Route path="watchlist" element={<NationalRecruits key="watchlist" watchlistOnly />} />
                    </Route>

                    <Route element={<NcaaHubLayout />}>
                      <Route path="ncaa-hub" element={<NcaaHub />} />
                      <Route path="scores" element={<Scores />} />
                      <Route path="national-stats" element={<NationalStatistics />} />
                      <Route path="players" element={<NationalPlayers />} />
                      <Route path="standings" element={<Standings />} />
                      <Route path="annual-awards" element={<AnnualAwards />} />
                      <Route path="all-america" element={<AllTeams />} />
                      <Route path="ncaa-records" element={<NcaaRecords />} />
                    </Route>
                  </Route>
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </div>

      <PlayerProfileModal />
      <GameDetailModal />
      <RecruitProfileModal />
      <EditorModalHost />
      <UpdateNotice />
    </div>
    </ProgramArtProvider>
  );
}
