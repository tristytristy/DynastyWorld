import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { LeagueScoresView, ResultsHold } from '../shared/types';

/** A poll ranks every FBS team; only the first 25 are "ranked" in the sense a scoreboard means. */
const POLL_RANKED_CUTOFF = 25;

/**
 * Every game in the league for a season — the national scoreboard behind the
 * NCAA Hub Scores page. Sourced from the same leaguewide `leagueSchedule`
 * snapshot the browse pages use; games whose team names didn't resolve (bye/
 * placeholder rows) are dropped. Each row's gameId opens the full Game Info
 * modal (getGameDetail), so no rich per-game data is duplicated here.
 *
 * `heldWeek` reports the week whose non-user scores were withheld at sync time
 * (see shared/resultsHold.ts) so the page can explain an empty-looking week
 * rather than reading as a bug. Null for seasons synced before the hold
 * existed — those have no `resultsHold` snapshot.
 */
export function getLeagueScores(dynastyId: string, seasonId?: number): LeagueScoresView | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const games = getSnapshot<LeagueGameData[]>(season.id, 'leagueSchedule');
  if (!games) return null;

  const heldWeek = getSnapshot<ResultsHold>(season.id, 'resultsHold')?.week ?? null;

  // Bowl names come from the leaguewide `schedule` snapshot for the same reason
  // getLeagueTeamSchedule reads across: the leagueSchedule copy resolved null
  // for every postseason game, so the Scores page simply never showed a bowl
  // name at all. Fixes existing dynasties without a re-sync.
  /*
    The `schedule` snapshot carries the postseason identity the leaguewide copy
    doesn't: the bowl's stable asset name, whether it's a bowl at all, and the
    national championship flag. Reading across for those (as this already did
    for bowlName) is what lets the scoreboard badge a game correctly WITHOUT a
    re-sync — the data has been captured all along, it just wasn't joined here.
  */
  const scheduleByGameId = new Map(
    (getSnapshot<GameData[]>(season.id, 'schedule') ?? []).map((g) => [g.gameId, g]),
  );

  /*
    Conference and rank per team, from the `teams` snapshot. Rank is the MEDIA
    poll — the one the scoreboard convention uses — and it is the rank AS OF THE
    SYNC, not as of each week's kickoff, because a save only ever holds the
    current poll (there is no week-by-week poll history to join against). For a
    finished season that's the final poll, which is the honest basis for "was
    this an upset" after the fact; mid-season it reads as "these are the ranked
    teams right now". Callers that show it say so rather than implying the
    number was live at kickoff.
  */
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const confByIndex = new Map(teams.map((t) => [t.teamIndex, t.conferenceName ?? null]));
  /*
    The poll ranks ALL 138 FBS teams, not just the top 25 — 0 means "poll not
    released" and 255 is the FCS placeholder (see shared/fcsPool.ts). So a
    scoreboard rank has to be capped at 25 explicitly; without it every team in
    the country is "ranked" and a Top 25 filter returns the entire slate, which
    is exactly what it did on the first run.
  */
  const rankByIndex = new Map(
    teams
      .filter((t) => t.mediaPollRank > 0 && t.mediaPollRank <= POLL_RANKED_CUTOFF)
      .map((t) => [t.teamIndex, t.mediaPollRank]),
  );

  const rows = games
    .filter((g) => !!g.homeTeamName && !!g.awayTeamName)
    .map((g) => {
      const detail = scheduleByGameId.get(g.gameId);
      return {
        gameId: g.gameId,
        week: g.week,
        weekType: g.weekType,
        homeTeamName: g.homeTeamName,
        awayTeamName: g.awayTeamName,
        homeTeamIndex: g.homeTeamIndex,
        awayTeamIndex: g.awayTeamIndex,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        bowlName: detail?.bowlName ?? g.bowlName,
        bowlAssetName: detail?.bowlAssetName ?? null,
        isBowlGame: detail?.isBowlGame ?? false,
        isNationalChampionship: detail?.isNationalChampionship ?? false,
        homeConference: confByIndex.get(g.homeTeamIndex) ?? null,
        awayConference: confByIndex.get(g.awayTeamIndex) ?? null,
        homeRank: rankByIndex.get(g.homeTeamIndex) ?? null,
        awayRank: rankByIndex.get(g.awayTeamIndex) ?? null,
      };
    })
    .sort((a, b) => a.week - b.week || a.homeTeamName.localeCompare(b.homeTeamName));

  return { games: rows, heldWeek };
}
