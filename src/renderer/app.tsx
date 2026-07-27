import { Route, Routes } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { DynastyLayout } from './components/common/DynastyLayout';
import { Dashboard } from './pages/Dashboard';
import { CoachHub } from './pages/CoachHub';
import { DynastyOverview } from './pages/DynastyOverview';
import { TeamHubLayout } from './pages/TeamHubLayout';
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
import { EditorModalHost } from './components/common/EditorModalHost';
import { RecruitProfileModal } from './components/common/RecruitProfileModal';
import { UpdateNotice } from './components/common/UpdateNotice';
import { angledClip } from './components/ui/angledClip';

const ANGLED_PANEL = angledClip('1.25rem');


export function App() {
  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Phase 10: the blue/cyan aurora beams that used to sit behind the shell
          were removed — they read as "glow" against the analog-matte direction.
          The ground's own subtle vertical falloff (globals.css) is the only
          surface variation now; team color lives in accents, not the backdrop. */}

      <div className="relative flex min-h-full flex-col">
        <Navbar />

        <div className="flex flex-1 px-4 pb-4 pt-3 md:px-6 md:pb-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 overflow-hidden md:gap-6">
            <Sidebar />

            <main
              style={ANGLED_PANEL}
              className="relative flex-1 overflow-hidden border border-slate-900/10 bg-white/82 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.32)] backdrop-blur-md dark:border-white/10 dark:bg-black"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
              {/* Signature left edge — the selected team's color, a thin accent so the program is present in the chrome (accent only — the ground stays black). */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,transparent,var(--team-primary),transparent)] opacity-90" />
              <div className="relative h-full overflow-y-auto p-5 md:p-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dynasty/:id" element={<DynastyLayout />}>
                    <Route index element={<CoachHub />} />
                    {/* Team Hub section — persistent masthead + switcher; pages keep flat URLs. */}
                    <Route element={<TeamHubLayout />}>
                      <Route path="team-hub" element={<DynastyOverview />} />
                      <Route path="roster" element={<Roster />} />
                      <Route path="schedule" element={<Schedule />} />
                      <Route path="rivalries" element={<Rivalries />} />
                      <Route path="statistics" element={<Statistics />} />
                      <Route path="trends" element={<DynastyTrends />} />
                      <Route path="transfers" element={<Transfers />} />
                      <Route path="media" element={<Media />} />
                      <Route path="team-awards" element={<TeamAwards />} />
                      <Route path="weekly-honors" element={<WeeklyHonors />} />
                      <Route path="history" element={<History />} />
                    </Route>
                    {/* NCAA Hub section — the nation. */}
                    <Route element={<RecruitHubLayout />}>
                      <Route path="recruiting" element={<NationalRecruits boardOnly />} />
                      <Route path="recruits" element={<NationalRecruits />} />
                      <Route path="watchlist" element={<NationalRecruits watchlistOnly />} />
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
  );
}
