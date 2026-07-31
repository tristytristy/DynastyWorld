# Analytics Expansion — Phase 0 audit

Read-only audit against a **copy of the live archive** (`dynasty-archive.sqlite`, 15.9 MB,
2 dynasties / 3 seasons). No production code was modified.

---

## 1. What the archive actually holds

> **Method correction.** The first pass ran against a copy taken at 07:22 and reported it as
> current. The user synced their own dynasty during the session, so the live archive moved
> underneath the audit — season 107 was a 0-game preseason in the copy and a finished
> 12-game season by 11:02. Findings that are *properties of the data* (§3.1, §2) are
> unaffected; the season inventory below is the re-verified live state. **Audit a copy for
> speed, but re-check anything time-sensitive against the live file before reporting it.**

### Current state, after ingesting the save chain (§1a)

| Dynasty | Season | Games | Usable for |
|---|---|---|---|
| Texas State `520e872f` | 2026 | **13 / 13** finalized | **Season Lab reference** |
| Texas State `520e872f` | 2027 | **12 / 12** finalized | **Program Arc: prior season** |
| Texas State `520e872f` | 2028 | **4 / 12** current | partial / in-progress |
| Tulane `70166811` | 2029 | **0**, no schedule | **preseason empty state** |
| Tulane `70166811` | 2026–2028 | history-only (1 snapshot each) | **history-only seasons** |
| Sac State `bcd5d624` | 2026 | 1 / 12 | early-season edge case |
| Texas State `4a55a7e6` | 2026, 2027 | 13/13, 12/12 | second multi-season dynasty |

**Every state the brief names now exists as a real fixture** — complete, partial,
in-progress, preseason-with-no-schedule, and history-only. Nothing needs to be synthesised.

The Tulane import is especially useful: it backfilled **three history-only seasons**
(2026–2028) carrying a single snapshot each, which is the state Program Arc must render as
"visible but clearly limited" without inventing per-game values.

**Only one season in the *current* archive has a complete schedule** — but see §1a: a
sequential chain of test saves exists that produces two complete seasons plus a live
partial, which unblocks Phase 2.

## 1a. Sequential test saves — Phase 2 IS verifiable

Peeked directly (`SeasonInfo` + `Coach` + `Team`). All five are **the same dynasty**:
Hayden Fox Jr., Texas State.

| Save | Year | Phase | Value |
|---|---|---|---|
| `Dynasty Save Test/DYNASTY-DYNASTYBOWL` | 2026 | OffSeason stage 1 | **complete 2026** |
| `…/Saves/DYNASTY-TESTER` | 2027 | PreSeason | superseded by TESTER2 |
| `…/Saves/DYNASTY-TESTER2` | 2027 | OffSeason stage 1 | **complete 2027** |
| `…/Saves/DYNASTY-TESTER3` | 2028 | PreSeason | superseded by TESTER4 |
| `…/Saves/DYNASTY-TESTER4` | 2028 | Week 5 Regular | **partial 2028** |

Per the sync phase map, **OffSeason stage 1 is the point where a season's results are
final**, so DYNASTYBOWL and TESTER2 are the two complete-season captures.

**Ingest order for a test archive:** DYNASTYBOWL → TESTER2 → TESTER4, into one dynasty.
That yields 2 full-data seasons + 1 partial — enough to verify every Phase 2 state
(year-over-year deltas, differing game counts, a season still in progress).

Do this against a **scratch profile**, not the live archive:
`electron . --user-data-dir=<scratch>` (Electron honours the switch; `getDbPath()` derives
from `app.getPath('userData')` and has no other override).

## 2. Field inventory

### Directly extracted

| Field | Source |
|---|---|
| Per-game scores, opponent, week, home/away/neutral, bowl flags | `schedule` snapshot (944 league games, **all teams**) |
| **Per-game team stats** — totalYards, passYards, rushYards, firstDowns, thirdDownConversions/Attempts, fourthDown…, turnovers, takeaways, sacks, sacksAllowed, penalties, penaltyYards, possessionTimeSeconds, punts, puntYards | `schedule[].homeTeamStats` / `awayTeamStats` — present on **944/944** games |
| **Quarter scores** | `schedule[].homeQuarterScores` / `awayQuarterScores` — present on **944/944**, always length 4 |
| Season totals incl. **red zone** (`offRedZones`, `offRedZoneTds`, `offRedZoneFgs`, def equivalents) | `teamStats` snapshot |
| Position grades **qb, rb, wr, te, ol, dl, lb, db, st + offense, defense, overall** | `teams[].positionGrades` |
| `teamPrestige`, `topClassRank` (recruiting class rank), `mediaPollRank`, `coachesPollRank`, `cfpRank`, conference/division records | `teams[]` — populated for **143/143** teams |
| Roster: `id`, position, `overallRating`, `developmentTrait`, `schoolYear`, archetype | `roster` (85), `leagueRoster.players` |
| Recruits: stars, `overallRating`, `nationalRank`, `positionRank`, `signedTeamDisplayName`, `committedWeekNumber` | `recruits` (31) |

### Safely derived

| Metric | Method |
|---|---|
| PPG / PA/G / margin per game | sum from played games ÷ games played |
| Turnover margin per game | `(takeaways − turnovers) / games` |
| Third-down % | `conversions / attempts` (already `ratioPct` in `teamStats.ts`) |
| **National percentiles** | aggregate all 944 games by teamIndex → **139 teams** with ≥1 game → rank. **Verified working**, see §5 |
| Quarter differential | `teamQuarter[i] − oppQuarter[i]` |
| Halftime lead, first/second-half splits | Q1+Q2 vs Q3+Q4 |

### Conditional on sync timing

- **Weekly poll history** — `ranking_history` holds **exactly 1 row per season** in this archive (season 71 has week 17 only; 101 and 107 have week 0 only). See §3.
- `yearSummary` only after the season concludes.
- `schedule` / `leagueSchedule` absent entirely in a preseason season.

### Unavailable — do not attempt

- Drive and play-by-play data, EPA, success rate, pressure rate, explosive-play rate.
- **Per-game red zone** — confirmed absent from the per-game stat block; season totals only.
- **`departures` snapshot does not exist** in this archive (see §3).

---

## 3. Five limitations found, with evidence

### 3.1 Quarter scores are REGULATION ONLY

47 of 944 games have quarter sums that disagree with the final score. Hypothesis tested:

```
mismatched games: 47
  ...of which regulation was TIED (=> overtime): 47
  ...NOT tied (unexplained): 0
```

**47/47, zero unexplained.** Quarter arrays are always length 4; overtime points appear only
in the final score. Consequences for Quarter Pulse:

- A row's four cells will **not** sum to the game's final margin in an OT game.
- The chart must either mark OT games explicitly or show the OT delta as a fifth element.
- Silently letting the numbers disagree with the scoreboard is the failure mode to avoid.

*Texas State 2026 happens to have 0 OT games, so this will not show up in testing on the
reference season. It must still be handled.*

### 3.2 `has_full_data = 1` does not mean the season is analysable

All three seasons carry `has_full_data = 1`, including one with **0 games and no schedule
snapshot at all**. Gate Season Lab on **games played**, never on `has_full_data`.

Three distinct states, all real and all present in the archive:

1. **No schedule snapshot** (2027 preseason) — "this season hasn't started"
2. **Schedule exists, 0–few games played** (Sac State, 1 of 12) — partial
3. **Complete** (Texas State, 13 of 13)

### 3.3 Weekly poll history is effectively empty

`ranking_history` accumulates only when the user syncs during the season. Re-verified
against the live archive across all six seasons:

```
season  71: 1 row    season 101: 1 row    season 107: 2 rows
season 108: 1 row    season 114: 1 row    season 115: 1 row
```

One row per season in five of six; two in the sixth. A poll *trajectory* needs many.

The existing **Poll trajectory chart therefore has nothing to draw** for this dynasty.
Recommend keeping it, but rendering an explicit "needs weekly syncs" state rather than a
one-point line — and not promoting it to a marquee exhibit in Season Lab.

### 3.4 No `departures` snapshot

The brief lists `departures` as available. Re-verified across the live archive:
`SELECT COUNT(*) FROM season_snapshots WHERE name='departures'` → **0**, across all six
seasons. The full set of snapshot names actually written is: `awards, coaches,
conferenceChampionship, gamelog, kicking, league, leaguePortraits, leagueRoster,
leagueSchedule, nationalRecruits, ncaaRecords, recruits, resultsHold, rivalries, roster,
schedule, stats, teamStats, teams, yearSummary`. Phase 3
roster churn must be derived by diffing consecutive `leagueRoster` snapshots on `playerId`,
which also means churn is only computable **between two full-data seasons**.

### 3.5 Snapshot payloads may be gzipped

Payloads are stored as `gz:<base64>` (`GZIP_MARKER`, `helpers.ts:523`). Any new query must
go through the existing snapshot reader rather than `JSON.parse` on the column.

---

## 4. Reusable calculations already present

Do **not** reimplement:

| Existing | Location | Use for |
|---|---|---|
| `getTeamGameStats(dynastyId, teamIndex, seasonId)` → `TeamGameStat[]` | `src/database/getTeamGameStats.ts` | **The Season Journey backbone already exists** — gameId, week, opponent, gameType, siteType, played, scores, teamStats/opponentStats. Only quarter scores need adding. |
| `filterTeamGames`, `aggregateTeamGames`, `ratioPct`, `perGame`, `turnoverMargin` | `src/renderer/lib/teamStats.ts` | All Season Lab aggregation |
| `getNationalTeamStats` | `src/database/getNationalTeamStats.ts` | Its header states it uses "the same source + arithmetic … via `getTeamGameStats`" — **inspect before writing new percentile code** |
| `DynastyTrendSeason` | `types.ts:1562` | Already carries wins/losses, pointsFor/Against, `recruitingClassRank`, final poll ranks, `rankingWeeks` |

**Gap in the existing trend shape:** `pointsFor`/`pointsAgainst` are season **totals** and
there is no `gamesPlayed`, so per-game normalisation is impossible today. That is the single
most important Phase 2 backend change.

---

## 5. Sample output — real data, Texas State 2026

### Season Journey

```
wk 0 A L  20-24   -4  Wisconsin        wk 9 A L  21-30   -9  Fresno State
wk 1 H W  40-23  +17  Washington St.   wk10 H W  29-20   +9  Utah State
wk 3 A L  20-21   -1  Louisiana        wk11 A L  27-33   -6  UConn
wk 4 A W  35-31   +4  Oregon State     wk12 H W  31-14  +17  San Diego St.
wk 5 H W  27-17  +10  Boise State      wk13 A L  17-37  -20  Colorado State
wk 6 H W  31-10  +21  FCS West         wk17 N W  24-23   +1  Arizona  [BOWL]
wk 7 H L  28-30   -2  Charlotte

record 7-6   PPG 26.9   PA/G 24.1   margin/G +2.8
```

### Quarter Pulse — season totals by quarter

```
Q1 −3    Q2 −30    Q3 +21    Q4 +49
```

A real, defensible finding: this team was outscored by 30 in second quarters and outscored
opponents by 49 in fourth quarters. Exactly the kind of observation the exhibit exists for.

### National percentiles — computed league-wide, 139 teams

```
scoring       26.9 ppg    pct 53
defense       24.1 pa/g   pct 63
total offense 425.5 ypg   pct 34
third down    39.6 %      pct 65
TO margin      0.00 /g    pct 28
sacks          1.62 /g    pct 36
```

**National comparison is honest and fully supportable** — it is computed from all 944 real
league games, not estimated. Note 139 teams aggregate, not 143: teams with no played games
(the FCS pool) are correctly excluded.

---

## 6. Recommended changes to the plan

1. **Phase 2 is verifiable** using the save chain in §1a — no synthetic fixture needed, and
   no assumptions of mine encoded into test data. Build the scratch archive first.
2. **Demote poll trajectory.** It has one data point per season here. Keep it, state its
   requirement plainly, don't build an exhibit around it.
3. **Season Lab gating** on `gamesPlayed`, with three distinct empty states (§3.2).
4. **Quarter Pulse** must handle OT (§3.1) even though the reference season has none.
5. **Red zone** stays a season-total tile — never a per-game series.

---

## 7. Proposed response shapes

```ts
/** One played game, for the Season Journey and Quarter Pulse exhibits. */
export interface SeasonGamePoint {
  gameId: number;
  week: number;
  opponent: string;
  opponentTeamIndex: number | null;
  siteType: 'home' | 'away' | 'neutral';
  gameType: 'conference' | 'non-conference' | 'bowl';
  teamScore: number;
  opponentScore: number;
  /** teamScore − opponentScore. */
  margin: number;
  result: 'W' | 'L' | 'T';
  /** Regulation only, always 4 entries. Null when the snapshot lacks them. */
  quarterDifferential: number[] | null;
  /** True when the quarter scores do not reconcile with the final — an OT game. */
  wentToOvertime: boolean;
}

/** Percentile is null wherever a league-wide comparison isn't supportable. */
export interface SeasonIdentityMetric {
  key: 'scoring' | 'defense' | 'totalOffense' | 'yardsAllowed'
     | 'turnoverMargin' | 'thirdDown' | 'sacks' | 'discipline';
  label: string;
  value: number;
  format: 'perGame' | 'percent' | 'ratio';
  /** Lower is better for defense, yardsAllowed and discipline. */
  lowerIsBetter: boolean;
  nationalPercentile: number | null;
  nationalRank: number | null;
  /** Teams the percentile was computed across — shown so the basis is never implied. */
  comparedTeams: number | null;
}

/** Deterministic, descriptive. Never causal. */
export interface SeasonFinding {
  id: 'turnover-battle' | 'half-split' | 'home-away' | 'conference-split'
    | 'halftime-lead' | 'workload-concentration' | 'closing-stretch';
  label: string;
  statement: string;
  /** The numbers behind the sentence, so the UI can show its working. */
  support: { label: string; value: string }[];
  sampleSize: number;
}

export interface SeasonAnalytics {
  seasonId: number;
  seasonYear: number;
  /** 'preseason' = no schedule snapshot at all; see audit §3.2. */
  state: 'preseason' | 'partial' | 'complete';
  gamesPlayed: number;
  gamesScheduled: number;

  summary: {
    wins: number;
    losses: number;
    ties: number;
    pointsPerGame: number | null;
    pointsAllowedPerGame: number | null;
    scoringMarginPerGame: number | null;
    turnoverMarginPerGame: number | null;
  };

  journey: SeasonGamePoint[];
  identity: SeasonIdentityMetric[];
  findings: SeasonFinding[];

  /** True when any played game went to OT, so Quarter Pulse can disclose it. */
  hasOvertimeGames: boolean;
}
```

### Phase 2 additions to `DynastyTrendSeason`

```ts
  /** REQUIRED for honest year-over-year: seasons differ in length. */
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  pointsAllowedPerGame: number | null;
  scoringMarginPerGame: number | null;
  totalOffensePerGame: number | null;
  yardsAllowedPerGame: number | null;
  turnoverMarginPerGame: number | null;
  thirdDownPct: number | null;
  sacks: number | null;
  sacksAllowed: number | null;
  teamPrestige: number | null;
  /** qb, rb, wr, te, ol, dl, lb, db, st, offense, defense, overall. */
  positionGrades: Record<string, number> | null;
  averageRosterOvr: number | null;
  rosterOvrDistribution: number[] | null;
```

Every added field is nullable by design: a preseason season legitimately has grades,
prestige and recruiting rank but **no** per-game anything, and that distinction has to
survive into the UI rather than being flattened to zero.

---

## 8. Acceptance criteria

| Criterion | Status |
|---|---|
| Every planned metric has a named source | ✅ §2 |
| Missing-data behaviour defined | ✅ §3, and null-by-design in §7 |
| No speculative fields | ✅ — red zone per-game, EPA and drive data explicitly excluded |
| Calculations have real-data samples | ✅ §5 |
| No production UI modified | ✅ |
