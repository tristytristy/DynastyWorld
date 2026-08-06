/**
 * Whether a game has actually been played.
 *
 * WHY THIS ISN'T `status !== 'Unplayed'`. That was the rule everywhere in the
 * app, and it is wrong for one specific and very visible case: the CFP bracket.
 *
 * `SeasonGame.GameStatus` has five values, verified by scanning every game row
 * across three real saves (2,736 games):
 *
 *   HomeWon | AwayWon     the game was played — 2,693 rows
 *   Unplayed             not played — 36 rows
 *   HomeScheduled        one side known, opponent still TBD — 4 rows
 *   Unscheduled          neither side known yet — 3 rows
 *
 * There is no tie value; college football's overtime rules mean the save never
 * produces one, which is why "played" can be stated as a positive test rather
 * than as "not one of the unplayed things".
 *
 * The last two are the eleven CFP bracket slots before the bracket resolves —
 * 4 quarterfinals + 2 semifinals + 1 national championship = the exact 7 rows
 * seen above. And those rows are NOT blank: they carry the PREVIOUS season's
 * scores and full team stat lines, which the game never clears. A save sitting
 * in week 15 of season two has a quarterfinal reading 35-47 and a national
 * championship reading 44-19, for games that have not been played and whose
 * participants are not yet known.
 *
 * Because `HomeScheduled` and `Unscheduled` are not the literal string
 * `'Unplayed'`, the old test called all seven of them played. That surfaced as
 * a phantom win or loss on a team's schedule (reported from the wild: a "week
 * 18 CFP Quarterfinal vs TBD" with a result on it, every season after the
 * first), a corrupted current-streak readout, and one game's worth of bogus
 * yardage in the team stat aggregate.
 *
 * Season and conference records are NOT affected — those are read from the
 * save's own `Team.confWins`/`nonConfWins` rather than summed from games.
 */
export function isGamePlayed(status: string | null | undefined): boolean {
  return status === 'HomeWon' || status === 'AwayWon';
}

