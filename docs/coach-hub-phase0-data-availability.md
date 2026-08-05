# Coach Hub — Phase 0: data-availability note

Audit only. No visible behaviour changed. Baseline `npm run typecheck`, `npm run lint`,
`npm run build` all pass with no pre-existing failures.

Test dynasty for all measurements: UCLA, 3 full seasons (2026–2028).

---

## 1. What the Coach page does today

`src/renderer/pages/CoachHub.tsx` — 788 lines, one file, one long scroll:
coach hero → Coach Profile tiles → Contract → Career Record → Coaching Staff →
Career Résumé → Coaching Tree. Route is the `/dynasty/:id` index, paired with
`/dynasty/:id/hall` through `PairLayout` (`Overview | Hall of Legends`).

Modals reached from here: Edit Coach (`EditorModalProvider`), Scandals, Cardbook.
All three are already provider/prop driven and move without change.

### Data requests it starts

| Effect | Calls | Scope |
|---|---|---|
| Coaching tree | `getCoachingTree` | dynasty |
| Unit stats | `getTeamStats` + `getSchedule` | selected season |
| Page core | `getSeasonOverview` + `getCoaches` + `getHistory` | selected season / dynasty |
| **Staff résumés** | **`getCoaches` + `getSchedule` per season** | **every season** |

Total = **6 + 2N** requests, N = seasons. 12 today; ~30 for a 12-season dynasty.

### What the all-seasons loop costs, and what it produces

Measured payload actually read and `JSON.parse`d in main (these two snapshots are
stored uncompressed — `saveSnapshot`, not `saveSnapshotCompressed`):

| Snapshot | Per season |
|---|---|
| `coaches` | 0.39 / 0.47 / 0.46 MB |
| `schedule` | 0.97 / 0.94 MB (2028 unplayed) |
| **Total** | **3.23 MB for 3 seasons — ~1.1 MB per additional season** |

From all of that, `buildCoachResumeMap` keeps exactly three things: each staffer's
cumulative W/L, a `firstYearWithTeam` estimate, and the user's own position per
year. Everything else is parsed and discarded. **This is the single biggest
finding of the audit** and it is what Phase 7 should target: the work is not
merely eager, it is ~1.1 MB of parsing per season to derive a handful of scalars.

There is no normalised per-coach-season table to shortcut it — `coaches` and
`coach_seasons` are both empty (0 rows); coach data lives only in the snapshot.
So staff history genuinely requires N snapshot reads. The fix is to **defer** them
to the Staff and Career destinations, not to add an API.

### Measurement constraint worth recording

`window.api.db` is **frozen, non-writable, non-configurable** (verified in the running
app: `Object.isFrozen` true, descriptor `writable:false, configurable:false`).
Renderer-side call counting is therefore impossible. Any Phase 7 before/after
request-count evidence has to come from the main process — an env-gated counter in
the IPC layer, in the same spirit as the existing `SCREENSHOT_*` diagnostics. The
6 + 2N figure above is code-derived and exact, not measured.

---

## 2. Reliable — current season

From `ScheduleOverview` / `ScheduleGame`:

- Overall record, conference record, current streak, bowl eligibility
- Points for/against **per game** → margin, averages, recent form, best/worst result
- **Yardage per game** — `ScheduleGame.teamStats` / `opponentStats` are a full
  `TeamStatLine` per game (yards, first downs, third/fourth down, turnovers, sacks,
  penalties, possession). Better than the spec assumed; per-game offensive and
  defensive trend lines are supported without new extraction.
- Splits with real denominators: home/away (`isHome`), conference/non-conference
  (`gameType`), bowl/playoff (`gameType === 'bowl'` + `bowlName`, which also carries
  the CFP round names), **rivalry (`isRivalryGame`, plus the named rivalry)**,
  one-score, 14+ margin
- Game rows already open the existing game-detail experience — no parallel surface needed

From elsewhere:

- Job security status + percentage, contract years remaining, coach points (`Coach`)
- Recruiting summary — `RecruitingClassSummary` gives `nationalClassRank`,
  `conferenceClassRank`, `signedCount`, `committedCount`, `averageStars`
- **National and conference ranks for team performance ARE supported.**
  `getNationalTeamStats` returns points, points allowed and yardage for every team
  in the league, so ranking the user's offence/defence is a real computation, not an
  inference. The spec's "only if a trustworthy comparison dataset supports them"
  is satisfiable.

## 3. Reliable — career

`CareerCoachStats` is save-native and complete: overall W/L, W/L at current school,
bowl, conference-championship, national-title, playoff and rivalry records, top-25
record, `top5RecruitClasses`, `playersMaxProgressed`, `timesFired`,
`numPrestigeIncreases`.

`ProgramHistoryOverview.seasons` gives the season-by-season résumé: year, the real
team for that year (dynasties span schools), W/L, conference W/L, media/coaches/CFP
final ranks, head coach, conference + national champion flags, playoff appearance,
bowl name + asset key, postseason summary. Enough for the résumé table, school and
role splits, and career highs.

## 4. Reliable — staff

Current staff, positions, tenure, alma mater, age, years coaching — all on
`CoachOverview.staff`. Per-unit points and yards per game already exist via
`buildUnitStats`. Change-from-prior-season is computable (prior season's schedule +
team stats), at the cost of one extra season's requests.

Staff continuity and per-season staff history are derivable but require the N
snapshot reads described above — correct to load when Staff opens.

## 5. Reliable — legacy

`getCoachingTree` gives coaches produced, head coaches produced, role under the
user, first/last year together, and where they went. `ProgramHistoryOverview`
already carries a computed `milestones[]` — including the signature-win and
poll-climb milestones added earlier today — plus `schoolsCoached`,
`bestRecruitingClassRank`, `bestMediaRank` and the dynasty aggregates.

## 6. Unsupported — omitted, not inferred

- **Draft picks / first-round picks.** Removed from the Coach UI per the spec.
  Independently confirmed unreliable this session: the user reported a 2027 save
  where a player who never entered the draft appeared as drafted and an actual
  late-round pick was missing. The fields stay on `CareerCoachStats` for
  compatibility; they will not render.
- **AD goal wording and rewards.** The save stores the verdict, not the question —
  the goal text lives in catalogue table 16483, outside the dynasty file. Already
  documented in `CoachHub.tsx`; stays unrendered.
- **Opponent rank at the time a game was played.** This is the sharpest honesty
  risk in the spec. `ScheduleGame.opponentCurrentRank` is the opponent's rank
  *today*, not at kickoff, unless `opponentContextCaptured` is true (games predating
  context tracking have no capture). So "beat the #3 team", ranked-opponent splits
  and "highest-ranked opponent defeated" are retroactively wrong on uncaptured
  games. **Every rank-at-the-time claim will be gated on `opponentContextCaptured`**
  and simply omitted otherwise, rather than shown with today's number.
- **Coach Grade / any composite score.** Spec forbids it; not building one.
- Weekly opponent poll history — does not exist in the save. The user's *own*
  weekly rank does (`ranking_history`), so ranking-movement charts for the user's
  team are fine.

## 7. Deferrable until a destination opens

- All-seasons `getCoaches` + `getSchedule` (the 2N loop) → **Staff** and **Career** only
- `getCoachingTree` → **Legacy** only
- `getHistory` → **Career** / **Legacy** (Overview needs at most a headline, which the
  coach's own `careerStats` already supplies without it)
- Prior-season team stats for change-vs-last-year → **Season** / **Staff**
- `getNationalTeamStats` for ranks → **Season** (and Overview only if it stays cheap)

Overview then needs only: `getSeasonOverview`, `getCoaches`, `getSchedule`,
`getTeamStats` — **4 requests, flat, regardless of dynasty length**, against today's
6 + 2N.
