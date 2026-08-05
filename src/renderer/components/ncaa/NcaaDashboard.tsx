import { TopScoresRibbon } from '../common/TopScoresRibbon';
import { GameOfTheWeekHero } from './GameOfTheWeekHero';
import { NationalStoriesPanel } from './NationalStoriesPanel';
import { DefenseLeadersPanel, OffenseLeadersPanel } from './NationalLeadersPanel';
import { PollRankingsPanel } from './PollRankingsPanel';
import { RecruitingNewsPanel } from './RecruitingNewsPanel';
import { useNcaaDashboardData } from './useNcaaDashboardData';

/**
 * The NCAA Overview dashboard: rankings on the left, the Game of the Week and
 * the week's storylines through the middle, national statistical leaders on the
 * right, and a pulse rail underneath.
 *
 * Column widths are `minmax(...)` pairs rather than fixed pixels so the middle
 * takes the slack — the hero is the one thing on this page that should get
 * wider when the window does. Every panel is `min-w-0` because a grid item's
 * default `min-width: auto` refuses to shrink below its content, which is how a
 * long team name in one column silently widens the whole document.
 *
 * READING ORDER ON A NARROW WINDOW is set with `order`, not by DOM sequence:
 * the hero must come first when the columns stack (it is the point of the
 * page), while on a wide screen it belongs in the middle column.
 */
export function NcaaDashboard({ dynastyId, seasonId }: { dynastyId: string; seasonId?: number }) {
  const { hub, scores, leaders, nationalRecruits, recruiting, standings } = useNcaaDashboardData(
    dynastyId,
    seasonId,
  );

  return (
    <div className="space-y-4">
      {/* The scoreboard strip reads the same `scores` payload the panels below
          do — one request, two surfaces. */}
      <TopScoresRibbon view={scores} dynastyId={dynastyId} seasonId={seasonId} />

      {/*
        One grid with EXPLICIT placement rather than three column wrappers. The
        DOM order is the narrow-window reading order — hero, rankings, stories +
        recruiting, leaders — and `col-start`/`row-start` put each item back
        where it belongs once there is room for three columns. Wrapping the hero
        and the stories in a shared centre column would have been simpler and
        would have forced the rankings BELOW both when the columns stack, which
        is the wrong first thing to read on a small window.
      */}
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(215px,0.72fr)_minmax(0,2.7fr)_minmax(225px,0.78fr)]">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <GameOfTheWeekHero
            game={hub?.gameOfTheWeek ?? null}
            scores={scores}
            standings={standings}
            dynastyId={dynastyId}
            seasonId={seasonId}
            loading={hub === undefined}
          />
        </div>

        <div className="flex min-w-0 flex-col xl:col-start-1 xl:row-start-1 xl:row-span-2">
          <PollRankingsPanel hub={hub} dynastyId={dynastyId} seasonId={seasonId} />
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:col-start-2 xl:row-start-2">
          <NationalStoriesPanel
            hub={hub}
            scores={scores}
            dynastyId={dynastyId}
            seasonId={seasonId}
          />
          <RecruitingNewsPanel
            hub={hub}
            nationalRecruits={nationalRecruits}
            recruiting={recruiting}
            dynastyId={dynastyId}
            seasonId={seasonId}
          />
        </div>

        {/* Two panels sharing the column's height equally (`flex-1` + `min-h-0`),
            each scrolling its own list rather than leaving the column half
            empty under five rows. */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-3 xl:row-start-1 xl:row-span-2">
          <OffenseLeadersPanel leaders={leaders} dynastyId={dynastyId} seasonId={seasonId} />
          <DefenseLeadersPanel leaders={leaders} dynastyId={dynastyId} seasonId={seasonId} />
        </div>
      </div>
    </div>
  );
}
