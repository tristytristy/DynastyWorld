# Multi-User-Coach Leagues — Save-Format Research & Implementation Plan

What a College Football 27 save with several human-controlled coaches actually
contains, what this app does with one today (quietly the wrong thing), and what
it would take to support one properly. All findings verified against a real
28-coach save, `DYNASTY-PRESEASON3`, imported end to end.

> Status: **researched, not built.** Deferred by the user on 2026-08-07 —
> "we will probably implement it at a later update." Nothing in this document
> has been implemented; the numbers are measurements, not estimates.

> Related: [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) §4 (per-season team
> model), [coach-movement-research.md](coach-movement-research.md) (why the
> dynasty is coach-centric rather than team-centric in the first place).

---

## 1. What the save carries

`DYNASTY-PRESEASON3` holds **28 user-controlled coaches on 28 different teams**.

- `Coach.IsUserControlled` is true for 28 of the save's 493 coach rows.
- They are **not all head coaches**: Will Muschamp is Texas' Defensive
  Coordinator, P.J. Volker is Navy's, Cam Newton is Auburn's Offensive
  Coordinator. Any position can be user-controlled.
- `FranchiseUser` has a matching **28 rows**, and each row's `UserEntity`
  reference resolves **directly to the Coach record**. Two rows carry
  `AdminLevel = Owner`; the other 26 share a non-Owner value.

So the save hands over an authoritative, unambiguous list of who the humans are
and which team each one coaches. Nothing here has to be guessed.

Teams involved in that save: Illinois, Tennessee, Indiana, Iowa, Ohio State,
Alabama, Arizona State, Wisconsin, Michigan State, Virginia Tech, Notre Dame,
Bowling Green, USF, Miami, USC, Kansas State, Oregon, Texas, Boston College,
Nebraska, West Virginia, Georgia, Clemson, Navy, Boise State, Auburn, Florida,
NDSU.

---

## 2. What the app does with it today

**It imports cleanly — and silently becomes one of the 28.**

Verified by importing the save: the archive comes out as **"Illinois Dynasty"**,
`seasons.user_team_id = 33`. Nobody chose Illinois. `findUserTeamIndex`
(extract-coaches.ts) returns the **first** coach with `IsUserControlled`, and
Bret Bielema happens to sit first in the Coach table.

That function's own doc comment says:

> `IsUserControlled` is true for exactly one coach regardless of their position,
> so matching on it alone is strictly correct and still deterministic.

This save disproves that 28 times over. It is **deterministic but arbitrary** —
re-importing gives the same wrong answer, which is worse than a visible failure
because nothing ever looks broken.

**This is a correctness bug independent of any feature work.**

---

## 3. What already works, with no rebuild

The browse work already in the app means every one of the 28 teams is fully
present in the archive, single-copy and leaguewide:

| Snapshot | Covers |
| --- | --- |
| `leagueRoster` | every team's players + season stat lines |
| `schedule`, `leagueSchedule` | every game in the country |
| `gamelog` | leaguewide per-game box scores, both sides |
| `awards` | leaguewide marquee awards, All-America, Heisman |
| `nationalRecruits` | the whole recruit pool |
| `teams`, `teamHistory`, `leagueRivalries`, `coaches` | all 138 programs |

The team switcher already opens any of them, and every page renders a browsed
team the same way it renders your own.

**The user-controlled flag is already stored.** The `coaches` snapshot carries
`isUserControlled` per coach — confirmed on the imported archive: 493 coaches,
28 flagged, with their team indices. So *detecting* a multi-coach league needs
**no extraction change and works on archives already imported**.

---

## 4. What is genuinely single-coach

Seven snapshots are extracted for one team only:

`roster` · `recruits` · `stats` · `teamStats` · `kicking` · `rivalries` ·
`departures` — plus the `weeklyHonors` slice inside `awards`.

And the app-side identity layered on a dynasty: Coach Hub, Trophy Room, Team
Awards, Media, player cards, notes, Hall of Legends.

**22 files** in `src/database/` read `season.userTeamId`.

### Measured sizes (from the imported 28-coach preseason save)

```
leagueRoster      1087 KB     ┐
nationalRecruits   773 KB     │
leaguePortraits    262 KB     ├─ leaguewide, ONE copy serves all 28
teams               84 KB     │
teamHistory         67 KB     │
coaches             53 KB     ┘
roster              30 KB     ┐
stats               16 KB     ├─ per-coach: ~48 KB here (preseason),
teamStats            1 KB     │   ~80 KB in-season once recruits and
kicking              1 KB     ┘   game data fill in
```

**28 coaches ≈ 2 MB per season on top of a ~2.3 MB leaguewide base** — not
28× anything.

---

## 5. The three options

### A. Ask who you are at import

Detect `> 1` user-controlled coach, present the list with their teams, store the
choice, allow changing it later. Extract user-scoped data for the chosen coach
only.

- Needs **no extraction change** — the flag is already in `coaches`.
- Fixes the arbitrary-Illinois bug immediately.
- Works on archives already imported.
- Small.

### B. One archive, N coach profiles *(the real feature)*

Extract the seven user-scoped snapshots **per user coach**, add a coach-profile
dimension to the season, and give the app a "playing as" switch beside the
existing "viewing" switch.

- ~2 MB per season for 28 coaches (§4).
- Most of the 22 `userTeamId` readers just need it to mean "the active
  profile's team".
- The hard architectural work — every page rendering *any* team — is already
  done.

### C. One dynasty record per coach

**Don't.** It duplicates the leaguewide snapshots 28 times: 150–280 MB per
season for byte-identical data.

**Recommendation: A now, B as the feature. C is the trap.**

---

## 6. Does this harm single-coach users?

Asked directly by the user, and worth recording because it shapes the design.

**A: no impact.** Gated on a count. One user coach → the existing path exactly,
no prompt, no new column read.

**B: no runtime or storage cost, by construction.** The loop is over the *actual*
user list, not over teams. One user coach = one iteration = the same seven
extractions, the same snapshots, the same bytes. A single-coach archive after B
is what it is today.

### The one way to get that wrong

`extract-roster` and `extract-stats` both read the **entire ~16,000-row Player
table** and filter to one team. Called once per coach, a 28-coach league does
that 28 times.

They must be restructured to **read once and partition** — take a set of team
indices, return a map. That is better for the multi-coach case *and* it keeps
single-coach users on the identical read path rather than a new one that happens
to run once.

### The real risk is correctness, not speed

1. **22 files** read `season.userTeamId`. Under B that becomes "the active
   profile's team" — 22 chances to show the wrong team's data to somebody who
   only ever had one.
2. **A schema migration on every existing archive.** Additive-only, backfilling
   a single profile from today's `userTeamId`. This codebase has been bitten by
   a migration before (the sql.js FK-reset-on-export bug that left 137 MB of
   orphans), so it earns real care.

### How to bound it

- One profile resolves to today's value from a **column on a row the query
  already loads** — no extra snapshot read on any hot path.
- The "playing as" switch **renders nothing** when there is one profile, so the
  UI is unchanged for the overwhelming majority.
- Verify against the existing single-coach saves (Auburn, Sac State) before and
  after, so "unchanged" is measured rather than asserted.

---

## 7. The open design question

**Is a coach profile a LENS or a TENANT?**

- **Lens** — one archive, switch who you are playing as. Media, cards, notes and
  the Trophy Room are shared across the league. Much less work.
- **Tenant** — each coach gets their own Trophy Room, notes, media and cards,
  sharing only the league data. What you would want if 28 real people were each
  using the app for their own team.

This has to be answered before B is scoped properly; it changes the schema, not
just the UI. **Undecided — to be discussed when the work is picked up.**
