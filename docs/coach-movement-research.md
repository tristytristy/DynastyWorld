# Coach Career Movement — Save-Format Research & Implementation Plan

How College Football 27 represents a coach changing schools, what the app must
do to track a continuous coaching journey across those moves without breaking,
and the plan to build it. All findings verified byte-level against real saves.

> Related: [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) §4 (per-season team
> model), §9 (write safety). This is the coach-journey deep dive.

---

## The two problems

1. **Continuous identity.** When a coach moves schools (or the app imports a
   later save), the journey must stay one continuous timeline — not fragment into
   a new, disconnected dynasty. The link can't be the coach's name (users edit
   coach names).
2. **Post-bowl misattribution.** Coaches move *after* the bowl but *before* the
   season-year rolls over. So there's a window where the coach already shows the
   new school while the just-completed season was actually coached at the old
   school. A naive read attributes that finished season (e.g. an undefeated year)
   to the wrong school.

---

## What already works (the foundation)

The app went through a coach-centric redesign (schema **v3**, `seasons.user_team_id`)
precisely because dynasties aren't tied to one team:

- **Per-season team, not per-dynasty.** Each season records its own `user_team_id`,
  derived per-import by `findUserTeamIndex` = `coaches.find(c => c.isUserControlled).teamIndex`.
  This finds whichever coach the user controls — **head coach OR assistant (OC/DC)** —
  so "start as a coordinator, then get hired as HC elsewhere" is already supported.
- **Every read is per-season.** `getSeasonOverview`, `getCoaches`, `getHistory`,
  `getRankings`, `getAwards`, `getRecruits`, `getNcaaHub` all resolve the user team
  from `season.userTeamId`, never the stale dynasty value.
- **Coach Hub already shows previous teams per season** — masthead logo/name and
  the career timeline render each season with its own team (`overview.teamName`,
  `season.teamName`), plus a "record at current school" split.

**Known cosmetic gap:** the app-wide accent color (`--team-primary`) comes from
`getDynastyTheme` (dynasty-level = current team), applied once in `DynastyLayout`.
So a previous-season view shows the old school's *logos/names* correctly but keeps
the *current* school's accent color. Fix = per-season theming (see plan).

---

## Findings — Session 1 (SMU → UCLA, Rhett Lashlee)

Five chronological saves examined (S1RECAP → S2RECAP → CC(pre-move) →
UCLA(post-move) → UCLAS1).

### Stable identity: `Coach.PresentationId`

| Save | Year | Team | `PresentationId` | `PrevTeamIndex` | `SeasonsWithTeam` |
|---|---|---|---|---|---|
| S1RECAP | 2026 | SMU (81) | **710** | 255 | 5 |
| S2RECAP | 2027 | SMU (81) | **710** | 255 | 6 |
| CC (pre-move) | 2028 | SMU (81) | **710** | 255 | 6 |
| UCLA (post-move) | 2028 | **UCLA (97)** | **710** | **81 (SMU)** | 0 |
| UCLAS1 | 2029 | UCLA (97) | **710** | 81 (SMU) | 0 |

**`PresentationId` is constant across the move.** The move is independently
recorded three ways:
- `PrevTeamIndex` → the old team (81 = SMU)
- `SeasonsWithTeam` → resets to 0
- **`CoachTransactionHistoryEntry`** logs the move: transaction #328,
  `HeadCoach@SMU → HeadCoach@UCLA`, week 18 (post-season). Fields: `Coach` (ref),
  `OldTeam`/`NewTeam` (refs), `OldCoachPosition`/`NewCoachPosition`, `SeasonYear`,
  `SeasonWeek`, `SeasonStage`, `TransactionId`.

### The post-bowl window (problem #2, confirmed)

`CC` = year 2028 @ **SMU** (season concluded). `UCLA` = **still year 2028** @
**UCLA** (coach already moved, wk18). Same season-year, different team. A re-sync
in that window would upsert (`UNIQUE(dynasty_id, season_year)`) and **overwrite
the finished SMU season with the UCLA transitional state.** The coach's
`SeasonStats` at the UCLA save still holds the SMU record — the record follows the
season, but `TeamIndex` already points to UCLA.

### What the save does NOT keep

`CareerCoachStats` = career **totals** + "at current school" (which resets to 0 on
the move). `SeasonCoachStats` = **current** season only (Wins/Losses, no year/team).
So **the save does not store a coach's full year-by-year record at each past school.**
That history can only come from the app's own per-season snapshots (synced while
each season was current). The transaction log + `PresentationId` are what let us
**stitch those snapshots into one journey** and attribute the move year correctly.

---

## Findings — Session 2 (identity robustness + non-user coaches)

### The identifier survives a portrait change ✅

Tested a **created** coach (`IsCreated=true`, "Les Goh") before/after changing his
face (APPMASTER vs APPMASTERCOACHFACECHANG, simmed 1 week to lock in):

- **`PresentationId = 256` → `256`. Unchanged.**
- Only the portrait fields changed: `GenericHeadAssetName` (`Generic_0001…` →
  `Generic_0102…`), `Portrait` (1 → 112), `AssetName` (blanked). Other diffs
  (career points, job security, XP) are just the 1-week sim.

So the `_710` in the portrait filename (`nilcp_Unique_C_LashleeRhett_710.webp`) is
EA embedding the id into the asset name — **not** the source of identity.
**`PresentationId` is the safe key. `AssetName`/`GenericHeadAssetName` are NOT**
(they change with the face).

### Non-user coach history is stored by NAME, not id

- `LeagueHistoryConferenceChampion` → `WinningCoachFirstName/LastName` (names).
- `LeagueHistoryAward` → `firstName/lastName` (names).
- No coach id on history rows. The app's `extract-league-history` already reads
  these as name strings.

### Name-matching to active coaches is viable

Across **493 active coaches** in a real save:
- **Full "Firstname Lastname" collisions: exactly 1** (two coaches literally named
  *Tim Beck*).
- "F. Lastname" (abbreviated display) collisions: 4.

So matching a historical coach name to an **active** coach by **full first+last
name is ~99.8% unique.** Build a directory of active coaches (PresentationId + full
name + team + position), match history names to it, and flag the rare exact
duplicate (disambiguate by team/year). Only link **active** coaches — a name with
nothing active to attach to (a retired legend) just stays a name.

**Caveat:** the game's full per-team "Season History" screen is mostly a
current-season reconstruction; what's *persisted* for past years is champions +
award winners (by name). So non-user history is an enrichment, not a full past
record database. The user's own journey stays the richest via our snapshots.

---

## Save entities & fields (reference)

| Field / table | Use |
|---|---|
| `Coach.PresentationId` | **Stable coach id.** Survives school moves and portrait/name changes. The journey key. |
| `Coach.IsUserControlled` | Identifies the user's coach (HC or assistant) → per-season team. |
| `Coach.TeamIndex` | Current team. Points at the NEW school during the post-bowl window. |
| `Coach.PrevTeamIndex` | Previous team (255 = none). Set to the old school after a move. |
| `Coach.SeasonsWithTeam` | Resets to 0 on a move. |
| `Coach.AssetName` / `GenericHeadAssetName` / `Portrait` | Portrait data. **NOT stable** — change with the face. Do not key on these. |
| `Coach.CareerStats` → `CareerCoachStats` | Career totals + at-current-school (resets on move). |
| `Coach.SeasonStats` → `SeasonCoachStats` | Current season W/L only. |
| `CoachTransactionHistoryEntry` | Move log: `Coach`, `OldTeam`/`NewTeam`, positions, `SeasonYear`/`SeasonWeek`/`SeasonStage`, `TransactionId`. |
| `LeagueHistoryConferenceChampion` / `LeagueHistoryAward` | Historical champions/awards — coach stored as **names**, not ids. |

---

## Implementation plan

Sequenced so each step is independently shippable and testable.

### 1. Coach identity by `PresentationId`
Thread `Coach.PresentationId` through `extract-coaches` → the `coaches`/`coach_seasons`
tables and view-models as the stable coach key. On **import**, detect when the
incoming save's user-coach PresentationId matches a coach already tracked in
another dynasty and offer to **link them into one journey** (append seasons)
rather than create a disconnected block. Never key on name or asset fields.
*(Also enables the existing single-file case to stay one journey across a move.)*

### 2. Move-year season attribution
When persisting a season, attribute it to the team the coach **actually coached**
that year. Detect a move (`SeasonsWithTeam === 0` + `PrevTeamIndex` set, or a
week-18 `CoachTransactionHistoryEntry` for this coach this year) and set that
season's `user_team_id` to the **previous** team, not the current one. Fixes the
"undefeated year shows the new school" bug.

### 3. Finalize & lock concluded seasons
Once a concluded season is synced and correctly attributed, mark it **finalized**
(immutable). A later re-sync showing the coach at the new school for the same year
must not overwrite it — the new school's tenure starts the next season. This is
the "hard-snapshot previous seasons" safeguard.

### 4. Active-coach directory + non-user coach linking
Extract all active coaches (`PresentationId` + full name + team + position) into a
directory. Name-match `LeagueHistory*` coach names to it by full first+last name;
flag exact-duplicate names for team/year disambiguation. Link **active** coaches
only. Enriches non-user Coach/Team hubs with "who coached here" history.

### 5. Per-season theming + season labels
Make the app accent (`--team-primary`) follow the **selected** season's team so a
previous-season view shows the previous school's colors (logos/names already
switch). Add the school to the season dropdown label (`2028 — SMU` / `2029 — UCLA`).

### Verification discipline
Disposable save copies + isolated `CFB_USER_DATA_DIR`; test the SMU→UCLA save set
end to end (link, move-year attribution, no clobber, previous-season colors).
`PresentationId` stability is proven; still re-confirm on any new save shape.
