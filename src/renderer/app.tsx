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
import { NcaaHub } from './pages/NcaaHub';
import { Roster } from './pages/Roster';
import { Schedule } from './pages/Schedule';
import { Standings } from './pages/Standings';
import { Statistics } from './pages/Statistics';
import { TeamAwards } from './pages/TeamAwards';
import { AnnualAwards } from './pages/awards/AnnualAwards';
import { AllTeams } from './pages/awards/AllTeams';
import { WeeklyHonors } from './pages/awards/WeeklyHonors';
import { Recruiting } from './pages/Recruiting';
import { NationalRecruits } from './pages/NationalRecruits';
import { History } from './pages/History';
import { Media } from './pages/Media';
import { PlayerProfileModal } from './components/common/PlayerProfileModal';
import { GameDetailModal } from './components/common/GameDetailModal';
import { EditorModalHost } from './components/common/EditorModalHost';
import { RecruitProfileModal } from './components/common/RecruitProfileModal';
import { angledClip } from './components/ui/angledClip';

const ANGLED_PANEL = angledClip('1.25rem');

export function App() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div
          style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 12rem) 100%, 0 100%)' }}
          className="absolute left-0 top-0 h-[24rem] w-[38rem] bg-[linear-gradient(135deg,rgba(37,99,235,0.22),rgba(37,99,235,0.03))] dark:bg-[linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.03))]"
        />
        <div
          style={{ clipPath: 'polygon(10rem 0, 100% 0, 100% 100%, 0 100%)' }}
          className="absolute right-0 top-0 h-[22rem] w-[34rem] bg-[linear-gradient(225deg,rgba(14,165,233,0.18),rgba(14,165,233,0.02))] dark:bg-[linear-gradient(225deg,rgba(34,211,238,0.14),rgba(34,211,238,0.03))]"
        />
        <div
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8rem 100%)' }}
          className="absolute bottom-0 left-[18%] h-[20rem] w-[42rem] bg-[linear-gradient(180deg,rgba(2,132,199,0.1),rgba(148,163,184,0.04))] dark:bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(15,23,42,0.02))]"
        />
      </div>

      <div className="relative flex min-h-full flex-col">
        <Navbar />

        <div className="flex flex-1 px-4 pb-4 pt-3 md:px-6 md:pb-6">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 overflow-hidden md:gap-6">
            <Sidebar />

            <main
              style={ANGLED_PANEL}
              className="relative flex-1 overflow-hidden border border-white/60 bg-white/76 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,rgba(37,99,235,0),rgba(37,99,235,0.9),rgba(37,99,235,0))]" />
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
                      <Route path="recruiting" element={<Recruiting />} />
                      <Route path="recruits" element={<NationalRecruits />} />
                    </Route>

                    <Route element={<NcaaHubLayout />}>
                      <Route path="ncaa-hub" element={<NcaaHub />} />
                      <Route path="standings" element={<Standings />} />
                      <Route path="annual-awards" element={<AnnualAwards />} />
                      <Route path="all-america" element={<AllTeams />} />
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
    </div>
  );
}
