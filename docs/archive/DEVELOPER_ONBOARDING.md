# CFB 27 Dynasty Hub — Developer Onboarding & Architecture Guide

> Everything a new developer (or an LLM answering questions about this app) needs:
> what it is, how it's built, how the data flows, the hard-won discoveries about
> the save format, the write-safety rules that keep it from corrupting saves, and
> the conventions the project runs by. Written to be comprehensive enough to
> answer fine-grained questions about any corner of the codebase.

**App:** `cfb-dynasty-hub` · **Current version:** 0.3.21 · **Platform:** Windows desktop (Electron)

---

## 1. What it is

Dynasty Hub is a **companion app for EA Sports College Football 27**. It reads a
user's dynasty **save file**, extracts everything of interest (roster, schedule,
stats, standings, recruiting, awards, coaches, the whole nation of teams and
players), and stores a **per-season snapshot** in a private local database so the
user can browse a beautiful, living archive of their dynasty across many seasons.

The framing that matters for product decisions: it is a **journal of the user's
coaching career**. The game only ever holds the *current* season; advance a year
and the previous season is gone from the save forever. Dynasty Hub's core value
is that it **remembers every season the user syncs**, so year 12 can still look
back at year 1.

**It is read-only by default.** Importing, syncing, and browsing never modify the
save. There are exactly two subsystems that *write* to the save, both explicit and
guarded: the **player/coach/recruit editors** and the **experimental tools**
(currently **Force Commit**). Everything about how those writes stay safe is in
§9.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Shell | **Electron** (main + preload + renderer, `contextIsolation: true`, `nodeIntegration: false`) |
| UI | **React 18** + **react-router-dom v6** (HashRouter) |
| Language | **TypeScript** (strict; `noUnusedLocals` on — unused module-level decls are errors) |
| Bundler | **webpack 5** (three configs: main, preload, renderer) |
| Styling | **Tailwind CSS** + a CSS-variable design-token layer, `globals.css` |
| Local DB | **sql.js** (SQLite compiled to WASM; the DB is a file in userData) |
| Save parsing | **madden-franchise** v4.3.1 (decodes EA's franchise save format) |
| Image tooling | **sharp** (dev-only; icon generation, logo trimming, manual asset baking) |
| Packaging | **electron-builder** (NSIS installer + portable exe) |

There is **no backend and no network**. Everything is local. No cloud login.

---

## 3. High-level architecture

Three Electron processes, each its own webpack bundle emitted to `dist/`:

```
┌─────────────────────────── main process (src/main) ───────────────────────────┐
│  main.ts            window/splash lifecycle, single-instance lock, screenshot   │
│                     harness, corrupted-DB recovery                              │
│  ipc/*.ts           IPC handlers (database, editor, extraction, export,         │
│                     filesystem, media)                                          │
│  editorWrite.ts     save-file WRITE path for players/coaches + backups          │
│  recruitingWrite.ts save-file WRITE path for recruiting incl. Force Commit      │
│  htmlExport.ts      self-contained dynasty-history HTML export                  │
│  preload.ts         contextBridge: exposes window.api (typed IPC surface)       │
└────────────────────────────────────────────────────────────────────────────────┘
        ▲  IPC (ipcRenderer.invoke ⇄ ipcMain.handle), channel names in shared/ipcChannels.ts
        ▼
┌───────────────────────── renderer process (src/renderer) ──────────────────────┐
│  React app: pages, providers (context), components, theming                    │
│  Talks ONLY through window.api — never imports node/db/extractors directly      │
└────────────────────────────────────────────────────────────────────────────────┘

  Shared (src/shared): types.ts (the whole IPC/data contract), ipcChannels.ts,
                       playerEditorFields.ts, portraitTaxonomy.ts, awardOrder.ts
  Data engine (src/database): reads/writes the sql.js DB, builds view-models
  Extraction (src/extractors): madden-franchise → typed extraction objects
```

**Data flow for a read:** renderer calls `window.api.db.getX()` → preload
`ipcRenderer.invoke` → main `ipcMain.handle` → a `src/database/getX.ts` function
reads the sql.js DB (usually a season **snapshot**) and returns a typed
view-model → back across IPC → React renders it.

**Data flow for a sync/import:** `src/extractors/extract-all.ts` opens the save
via madden-franchise, runs ~19 extractors, returns one big `ExtractionData`
object → `src/database/importExtraction.ts` persists it as a set of per-season
snapshots (+ some normalized rows) → the renderer re-fetches.

---

## 4. The core data model & lifecycle

### 4.1 Entities

- **Dynasty** — one save file the app tracks. Matched to the save by its **exact
  file path**. Row in `dynasties`. Has a stable `id` derived from the path.
- **Season** — one synced point-in-time for a dynasty. Row in `seasons`. A dynasty
  accrues one season per year the user syncs. Carries `seasonYear`, `isCurrent`,
  `extractedAt`, final record/ranking/bowl fields, and a **`historyOnly`** flag.
- **Season snapshot** — a serialized blob of one extraction slice for one season,
  in `season_snapshots (season_id, name, payload, extraction_version)`. This is the
  primary storage mechanism (see §4.4). Names: `league`, `teams`, `coaches`,
  `roster`, `leaguePortraits`, `leagueRoster` (compressed), `leagueSchedule`
  (compressed), `schedule`, `recruits`, `nationalRecruits` (compressed),
  `ncaaRecords`, `stats`, `teamStats`, `kicking`, `gamelog`,
  `conferenceChampionship`, `rivalries`, `awards`, `yearSummary`.

### 4.2 The golden rule (product + data)

**Sync once near the end of every season, before advancing in-game.** A sync
captures the save exactly as it is now; the next in-game year overwrites it in the
save. If the user misses a season, the next sync **backfills** what the save's
league-wide history still knows (national champ, conference champs, major awards)
as a **History-Only season** — but that year's own roster/schedule/game stats are
gone for good. History-Only seasons are recovered via `extract-league-history.ts`
(`YearSummaryData`) and marked `historyOnly = 1`.

### 4.3 Import / Sync / Relink / Backup / Delete

- **Import** (`db:importDynasty`) — pick a save, create the dynasty + first season.
- **Sync** (`db:syncDynasty`) — re-read the already-known save path (no picker);
  refreshes the current season in place (idempotent) and backfills missed years.
- **Relink** (`db:relinkDynasty` / `db:checkDynastyMatch`) — because dynasties are
  keyed by exact path, a renamed/moved/restored save looks new. `checkDynastyMatch`
  detects "this is the same dynasty from a different file" and offers to relink
  instead of duplicating. See `relinkDynasty.ts`.
- **Backup** (`editor:backupSaveFile`) — timestamped copy of the *actual save*,
  stored outside the game folder. Also auto-invoked before every write.
- **Delete** (`db:deleteDynasty`) — removes the dynasty from the app DB only;
  never touches the game save.

### 4.4 Storage: snapshots first, normalized second

Persistence lives in `importExtraction.ts::persistExtraction()`. Most data is
stored as **JSON snapshots** (`saveSnapshot`) keyed `(season_id, name)` with
`ON CONFLICT DO UPDATE` (so a re-sync refreshes in place). Large league-wide blobs
(`leagueRoster`, `leagueSchedule`, `nationalRecruits`) use **`saveSnapshotCompressed`**
to keep the DB lean. There are also **normalized tables** in `schema.sql`
(players, player_seasons, games, player_game_stats, coaches, coach_seasons, awards,
championships, recruits, …) used where relational queries help (history, trends,
cross-season rollups). The pragmatic rule: **snapshot for "show me this season as it
was," normalized for "aggregate across seasons."**

The DB is a single sql.js file in Electron `userData` (per-user; **not** bundled
with the app — a fresh install starts empty). Schema is versioned by
**migrations** (`migrations.ts`): v1 initial, v2 `ranking_history`, v3 `season_team`,
v4 `season_history_only`, v5 `team_awards`, v6 `media`. Add a migration by appending
`{version, name, sql}` — never edit a shipped migration. Corrupted-DB startup is
recoverable (quarantine → restore-backup / start-fresh / quit); see
`main.ts::initDatabaseWithRecovery`.

---

## 5. The extraction pipeline (`src/extractors`)

### 5.1 The madden-franchise wrapper — `lib/franchise.ts`

This ~115-line file is the **only** place that touches madden-franchise directly;
everything else works with our typed interfaces. It encodes the library's quirks:

- **`openFranchiseFile(path)`** → `Franchise.create(path)`. Records are runtime
  **Proxies** (`record.DisplayName` is dynamic), so there is no useful static type;
  `FranchiseRecord` is the hand-written boundary type.
- **`getLargestTable(franchise, name)`** — a table name is **fragmented** across
  several small placeholder instances plus one real data table (observed: 9 tables
  named "Team" with capacities 1×7 + 6 + 143 — only the 143 is real). Always take
  the largest-capacity instance.
- **`readRecords()` must be called before `table.records`** or you get an empty
  array. This is the single most common footgun (see §9/§14).
- **`preloadAllInstances(franchise, name)`** — loads *every* same-named instance,
  needed before resolving a reference whose target could land in any fragment.
- **`resolveReference` / `resolveReferenceWithTable`** — follow a reference field
  to its target record (and its table, when the target table varies by context, e.g.
  a player's `CareerStats` resolves to Offensive/Defensive/Kicking/OLine stats).
  The target table must already be loaded.
- **`findRecordByPresentationId`** — the editor's anchor: `PresentationId` is the
  **stable per-record id** the app keys players/coaches/recruits by everywhere.
- **`nonEmpty(records)`** — filters `record.isEmpty` placeholder rows.

### 5.2 Orchestration — `extract-all.ts`

`extractAll(filePath, onProgress?)` opens the franchise once and runs the
extractors in order, emitting progress steps (the import UI's progress bar). It
returns a single `ExtractionData` object. The ~19 extractors:

`extract-league` (season year, base calendar year, week), `extract-teams` (all
teams, conference map, poll ranks, prestige, recruiting-class rank),
`extract-coaches`, `extract-roster` (user team), `extract-league-portraits`,
`extract-league-roster` (**every player in the league** — the National Players
source), `extract-league-schedule`, `extract-schedule` (user team, enriched with
rivalry/stadium/bowl), `extract-recruits` (user board), `extract-national-recruits`
(~2,950 prospects), `extract-ncaa-records` (record book), `extract-stats`,
`extract-team-stats`, `extract-kicking`, `extract-gamelog`,
`extract-league-history` (year summaries / History-Only backfill), `extract-rivalries`,
`extract-awards`.

Season-relative years are computed as `league.seasonYear - league.baseCalendarYear`
(the save stores stat "seasons" as relative indices; exact scoping matters for
multi-season correctness).

---

## 6. The IPC surface

The **contract** is `src/shared/ipcChannels.ts` (channel-name constants) and the
`DynastyApi` interface in `src/shared/types.ts` (the typed `window.api`). `preload.ts`
wires each channel to `ipcRenderer.invoke`; `src/main/ipc/*.ts` register the handlers.
Groups: `fs` (file dialogs / save scan), `db` (all the read view-models + import/sync),
`extraction` (extractAll + progress events), `export` (HTML export), `editor` (all
save writes + backup + portrait search), `media` (gallery CRUD). To add a feature
that needs data: add a channel constant → a `getX.ts` in `src/database` → a handler
in `ipc/database.ts` → a preload binding → the `DynastyApi` type → call it from the
renderer. (This exact five-step pattern is how National Players was added; see
`getAllLeaguePlayers`.)

---

## 7. The renderer (`src/renderer`)

### 7.1 Provider tree (`index.tsx`)

Context providers wrap `<App/>`, order matters:
`ThemeProvider` → `RecruitingExperienceProvider` → `StadiumDataProvider` →
`ConfirmDialogProvider` → `PlayerModalProvider` → `EditorModalProvider` →
`RecruitModalProvider` → `GameModalProvider` → `HashRouter` → `App`.

Notable providers (`src/renderer/data`):
- **PlayerModalProvider / RecruitModalProvider / GameModalProvider** — global
  modals mounted at the app root (they must portal to `document.body`; a
  page-local modal gets clipped by `<main>`'s clip-path).
- **EditorModalProvider + EditorModalHost** — the player/coach/recruit editor;
  `playerState`/`coachState` with an `isRecruit` flag path.
- **ConfirmDialogProvider** — app-styled `useConfirm()` async modal that replaced
  all native `window.confirm` calls (corner-cut, team-colored/red-danger).
- **SelectedSeasonProvider** — the season dropdown; every page reads the selected
  season from here.
- **ViewedTeamProvider** — the Team Hub team switcher; `viewedTeamIndex === null`
  means "the user's own team," otherwise a league team (league-mode reads).
- **RecruitingExperienceProvider** — hidden-recruit-ratings state + the
  experimental-save-editing toggle.
- **StadiumDataProvider** — user-editable stadium name/location overrides (local
  only, never touches the save).

### 7.2 Information architecture (a hard convention — see §13)

**Two-level, scope-based nav.** Four top sections by *whose story a page tells*:

- **Coach Hub** (`/dynasty/:id` index) — the coach as a person, across schools.
- **Team Hub** (`TeamHubLayout`) — the selected team; persistent masthead (logo ·
  name · record · **team switcher**) over sub-tabs: Overview, Roster, Schedule,
  Statistics, Trends, Transfers, Media, Team Awards, Weekly Honors, History.
- **NCAA Hub** (`NcaaHubLayout`) — the nation: Overview, **Players** (every player
  in the country), Standings, Annual Awards, All-America & All-Conf, Record Book.
- **Recruit Hub** (`RecruitHubLayout`) — My Board (`/recruiting`) and National
  Recruits (`/recruits`).

Routes live in `app.tsx` as children of **pathless layout shells**, so URLs stay
flat (`/roster`, `/schedule`, …) and the top nav highlights a section via a
path-membership Set in `DynastyLayout.tsx`. **Rule: never add a third menu level.**
Anything finer than a sub-tab (a player, a game, a recruit, an editor) is a modal.

### 7.3 Components & UI kit

- `components/ui`: `Button`, `SurfaceCard`, `StatTile`, `PageHeader`, `angledClip`.
- `components/common`: the big shared set — `PlayerProfileContent/Modal`,
  `RecruitProfileModal`, `GameDetailModal`, `PlayerEditorModal`/`CoachEditorModal`,
  `PortraitPicker`, `PlayerPortrait`/`CoachPortrait`/`TeamLogo`/`ConferenceMark`,
  `StatisticsCategorySection`/`StatisticsTable`, `PlayerComparison`, `TeamSwitcher`,
  `TeamBudgetModal`, `MediaGallery`, `Sidebar`/`Navbar`, `CenteredModalPanel`, and
  the four sidebar menus (`PreferencesMenu`, `StadiumDatabaseMenu`, `HelpMenu`,
  `UserManualMenu`).
- **`CenteredModalPanel`** is the one standard modal shell (glass chrome, centered,
  Escape/click-outside close, scroll lock). All four sidebar menus use it.

### 7.4 Theming & shape language

- Design tokens in `src/design/defaultTokens.ts` applied as CSS variables by
  `applyTokens.ts` before first render. Fonts = **Inter** (bundled woff2).
- **Team color** runs through the app via `--team-primary` / `--team-on-primary`
  (from `lib/teamTheme.ts`); Theme Source can be Team or Default.
- **Dark base is near-black `#0A0A0A`** with a subtle team-accent radial glow in the
  bottom-right corner (body canvas + main panel). Chrome (navbar/sidebar) `#0e0f12`.
- **Shape language (hard rule):** hard rectangular edges with a single cut corner.
  All radius tokens are `0px`; **zero `rounded-full` anywhere**. The signature cut
  is `.corner-cut` / `.corner-cut-sm` (a top-right 45° clip-path) applied with
  restraint. Never reintroduce a rounded corner. The intent: feel same-universe as
  EA's own sharp, angled game UI.

---

## 8. Feature deep-dives

- **National Players** (`getAllLeaguePlayers` → `NationalPlayers.tsx`) — the whole
  field (~15,000 players incl. FCS on a real save), flattened from the `leagueRoster`
  snapshot with team name + conference joined on. Mirrors the Team Hub Roster (same
  search/filter/sort/list+gallery/edit) plus conference + team filters and a Team
  column. Large-list perf via `RENDER_CAP = 200` + a "showing N of M" notice.

- **Recruiting** — My Board (`getRecruits`) + National Recruits (`getNationalRecruits`,
  ~2,950). Prospect **overall/athletic ratings start hidden** (recruit on rank/stars/
  film); reveal one at a time or all via Preferences (`RecruitingExperienceProvider`).

- **Team Awards** (`src/teamAwards`, schema v5) — an app-*calculated* awards engine
  (separate from the save's native annual awards). Definitions in `awardDefinitions.ts`;
  scoring/eligibility/tiebreakers/normalization modules; a workflow
  (calculate → confirm/manual-select → finalize → unlock). Supports a **`retired`**
  flag (award kept for historical results but out of the active package).

- **Media gallery** (schema v6, `media.ts`, `Media.tsx`, `MediaGallery.tsx`) — per-
  season screenshots/clips copied into the app library; tag a game + players + write
  a description. Tags auto-surface on each tagged **player's bio** and the linked
  **game page**. Extras: `#`-prefix jersey-number search in the tag picker; on-tile
  trash button.

- **Editing** (`editorWrite.ts`, `PlayerEditorModal`/`CoachEditorModal`) — ratings,
  attributes, caps, portraits; recruit-specific fields (`RecruitEditFields`: hometown,
  stars, class year, ranks). **Current-season only** (a past season is a frozen
  snapshot). Enum dropdowns pulled from the field schema (`field.offset.enum.members`).
  Includes recruiting levers: Deal Breaker / Ideal Pitch, plus affordability editors
  — **Program Budget** (Team page), **Coach Points** (Coach Hub), **recruit NIL Demand**.

- **Force Commit** — the flagship save-write feature; see §9.3 and
  `docs/force-commit-recruit-hard-signing.md`.

- **HTML export** (`htmlExport.ts`) — a self-contained dynasty-history web page
  (record book, résumé, timeline, milestones) that opens in any browser.

- **In-app User Manual** — sidebar "User Manual" opens `manual.html` in an iframe
  modal. Single source `docs/manual/manual.template.html` produces **two outputs**:
  the standalone **PDF** (assets baked as data URIs, print media = paged Letter, via
  `docs/manual/make-manual-pdf.js` → `npm run manual`) and the **in-app HTML**
  (webpack `CopyWebpackPlugin` transform → `manual.html`, assets referenced from the
  app's own `assets/`, screen media = fluid responsive). See `docs/manual/README.md`.

---

## 9. Save-editing & write safety (the critical subsystem)

Getting this wrong corrupts a user's dynasty. The whole thing is built around one
hard-won distinction.

### 9.1 The two write classes

- **SAFE — field edits on EXISTING records, and reference-writes into an existing
  empty array slot.** Editing `Player`/`Coach`/`Recruit` fields, swapping a
  `ProspectTargetSchool.TeamId`, or dropping a player reference into an empty
  `Team.CommittedPlayers` slot. These round-trip *and* load in-game cleanly.
- **DANGEROUS — record CREATION / structural writes.** Allocating a new record
  (e.g. adding a recruit to the board = creating a `UserRecruitTarget`), or building
  array rows. **A clean madden-franchise round-trip is NOT proof of safety here** —
  the file can re-read fine yet still crash the game on load, because the game
  expects a whole nested object graph (e.g. `UserRecruitTarget.ActivePitches` →
  `ActiveRecruitingPitch[]`) that a naive create leaves null. Board add/remove was
  **shelved** for exactly this (crash to desktop confirmed in-game).

**Rule: for any write that creates a record or changes save structure, the only
proof of safety is an in-game load — reconstruct the entire object graph. For plain
field edits on existing records, a verified round-trip is sufficient.**

### 9.2 The write wrapper (backup → mutate → save → validate → rollback)

Every write goes through the same shape (`withRecruitWrite`, and the explicit
version inside `forceCommitRecruit`):

1. **Auto-backup the save first.** A failed backup aborts the write — never mutate
   a save you couldn't first copy.
2. Open, mutate, `franchise.save()`.
3. **Reopen the just-saved file and validate** the change actually persisted.
4. If validation fails, **copy the pre-edit backup back over the save** — never
   leave a half-applied write. On any thrown error, restore from backup too.
5. Re-extract + persist so the app reflects the new state.

### 9.3 Force Commit (the marquee discovery)

Problem: forcing a boarded recruit to actually join the roster next season.

**Discovery:** the game builds next year's roster from **`Team.CommittedPlayers`** —
a `Player[]` array row (~35 slots) on the team record, read at the offseason
rollover to assign `Player.TeamIndex`. Natural signs are in it; a force-signed
recruit that was never added gets **dropped**. `Recruit.RecruitStage = Signed` is
**cosmetic** — the roster conversion ignores it.

**The recipe** (`recruitingWrite.ts::forceCommitRecruit`), two parts:
1. *Make it look signed* — on the board entry (`UserRecruitTarget`):
   `ScholarshipStatus = 'Offered'`, `CommittedWeekNumber = 0`, meet NIL
   (`CurrentNILOffer ≥ NILExpectation`); on the `Recruit`: `RecruitStage = 'Signed'`,
   strong `CommitScore`; and make the user's team the **sole influence leader** in
   the `TopSchoolsList` (`ProspectTargetSchool.TeamInfluence = 99`, cap rivals).
2. *Make it actually roster* — append the player's reference into an empty
   `CommittedPlayers` slot via `playerTable.getBinaryReferenceToRecord(rowIndex)`
   (a 32-bit array-slot reference; the method exists at runtime but isn't in the
   lib's TS types, so it's reached through a cast).

Guards: refuse recruits **not already on the board** (board-add crashes — §9.1);
skip if already enrolled; warn if the ~35-slot class list is full. Then
validate-on-reopen (Signed + on board + in `CommittedPlayers`) and roll back if it
fails. Gated behind the **Experimental save editing** toggle.

**Golden rule for users:** run it with **CFB 27 fully closed**, then reload the save
in-game. A running game's autosave can overwrite the write or show stale info.

### 9.4 Relevant save entities (glossary)

- **`Player`** — the roster/player record; recruits are literally `Player` rows too
  (resolved via `Recruit.Player`). Carries `PresentationId` (stable id), ratings,
  `TeamIndex` (255 = free/pool), portrait (`GenericHeadAssetName`/`PLYR_PORTRAIT`),
  `BaseNILValue`.
- **`Recruit`** — recruiting-specific record; `RecruitStage` (Top10/Top5/Top3/
  SoftCommitted/HardCommitted/Signed), `CommitScore`, `TopSchoolsList`.
- **`UserRecruitTarget`** — the **user's board entry** (user-only table; AI teams
  don't use it). `ScholarshipStatus` (None/Revoked/New/Offered/Committed/Invalid),
  `CommittedWeekNumber`, `CurrentNILOffer` vs `NILExpectation`, `ActivePitches`.
- **`ProspectTargetSchool`** — a school pursuing a recruit; `TeamId`, `TeamInfluence`
  (0–99). Ties at 99 across schools = no leader = the recruit never commits.
- **`Team`** — team record; `TeamIndex`, `DisplayName`, poll ranks, prestige,
  `ProgramPointBudget`/`RemainingProgramPoints`, and **`CommittedPlayers`** (the
  incoming-class array).
- **`Coach`** — `IsUserControlled` (identifies the user's team via `TeamIndex`),
  `CoachPoints`, portrait.

---

## 10. Key discoveries & hard-won solutions (consolidated)

1. **`Team.CommittedPlayers` is the roster-conversion mechanism**, not
   `RecruitStage`. (Force Commit; §9.3.)
2. **Round-trip ≠ in-game safe for record creation.** Board-add round-tripped
   perfectly and still crashed the game (incomplete `ActivePitches` graph). Shelved.
3. **Data-absence discipline.** "Recruits have no portrait" was wrong — recruits are
   `Player` rows and `Player` carries a real portrait. Before declaring a field
   absent, check the **terminal** save record a feature resolves to, not the current
   extraction type. (Recruit portraits/coach-face limitations were later corrected.)
4. **Empty array = maybe a not-loaded probe bug.** madden-franchise array fields
   (`Conference.Divisions`, `Team.CommittedPlayers`, etc.) resolve through a separate
   container table whose records are lazy — you must `getTableById(ref.tableId)`
   then `readRecords()` **before** reading slot keys, or every save looks "empty."
   A wrong "divisions don't exist" conclusion across five saves came from this.
5. **Fragmented tables** — always `getLargestTable`; a name maps to many instances.
6. **Portrait field correctness** — the editor once wrote a coach-portrait field the
   game doesn't render from; player portraits write reliably. (History in DevLog.)
7. **Multi-season stat scoping** must use exact relative-season indices
   (`seasonYear - baseCalendarYear`), not "most recent," or years bleed together.
8. **Relink** solved duplicate dynasties from renamed/moved saves (path-keyed identity).

Full narrative history is in **`DevLog.md`** (1,700+ lines, phase-by-phase: what
shipped, what broke, root causes, how it was verified). The
`docs/force-commit-recruit-hard-signing.md` doc is the standalone Force Commit writeup.

---

## 11. Build, packaging, release

Scripts (`package.json`):
- `build` (dev webpack) / `build:prod` (prod) / `build:clean` / `clean`.
- `start` = build + `electron .`.
- `package` = `build:prod` + `electron-builder` → NSIS installer **+ portable exe**
  in `release/` (config in `electron-builder.js`, output dir `release`).
- `typecheck` (`tsc --noEmit`), `lint` (eslint), `format` (prettier).
- `manual` = regenerate the standalone PDF.

**Version** is `package.json.version`, surfaced everywhere via a webpack
`DefinePlugin` (`__APP_VERSION__`) in the renderer (navbar tag) and by build-time
substitution in the manual. Bump `version`, rebuild, and it propagates (navbar,
manual, exe filenames). Installers are ~1.15 GB — almost entirely the **game-art
assets** (25k+ player portraits, 3D logos, etc. under `public/assets`, which is
**gitignored** and distributed out-of-band). The renderer JS bundle is ~632 KB.
The exe is **unsigned** (Windows SmartScreen prompt on first launch). The `manual.html`
in-app manual rides along inside the bundle; the PDF is intentionally **not** in the
installer (separate download).

---

## 12. Dev tooling — the screenshot harness

`main.ts` has a permanent, env-gated screenshot mechanism (inside the
`USE_PRE_SPLASH_ONLY` branch) for visually verifying UI changes headlessly:
`SCREENSHOT_ROUTE`, `_DIR`, `_NAME`, `_RECT`, `_EVAL`, `_CLICK_SELECTOR`(+`_2`),
`_SELECT_VALUE`, `_FORCE_HOVER_SELECTOR`, `_IMPORT_SAVE`, `_DEBUG_CONSOLE`.
Launch from Git Bash: `unset ELECTRON_RUN_AS_NODE` first (stale value breaks fresh
launches), and **`export MSYS2_ENV_CONV_EXCL="SCREENSHOT_ROUTE;SCREENSHOT_EVAL"`**
(separator is `;`, not `::`) so MSYS doesn't mangle the hash route into a fake path.
`SCREENSHOT_IMPORT_SAVE` self-provisions a disposable dynasty into an isolated
`CFB_USER_DATA_DIR`. Full details in the `reference_screenshot_diagnostics` memo.

**Testing discipline:** always work on a **disposable COPY** of a save in scratchpad
+ an isolated `CFB_USER_DATA_DIR`. Never open/import the user's real saves in place.
The real saves live at `C:\Users\matev\Documents\EA SPORTS College Football 27\Saves`
(`DYNASTY-<NAME>`); **ECMaster** is the go-to populated save.

---

## 13. Conventions & house rules

- **DevLog.md** — read the Status section + latest entry before new work; append a
  `## Phase N — <name>` entry after finishing (what shipped, real bugs + root causes,
  scope decisions, how verified). It is the durable cross-session memory.
- **Productivity/agenda.html** — a data-driven personal task board (a single
  `const TASKS = [...]`). Set a task `in-progress` when work starts, `shipped`/`done`
  when it lands. Edit `TASKS`, never the rendered HTML. Not part of the app.
- **In-app Help** (`HelpMenu.tsx` `HELP_TOPICS`) — capture real how-to/limitation
  knowledge here (plain, second-person), not just DevLog.
- **Information architecture** (§7.2) — four hubs, flat URLs, never a third level,
  drill-downs are modals.
- **Shape language** (§7.4) — hard edges + single cut corner, zero rounded corners.
- **Data-absence discipline** (§10.3) — verify the terminal save record before
  declaring a field absent.
- **Write safety** (§9) — field-edit safe, record-create dangerous; backup +
  validate-on-reopen + rollback around every write.
- **TypeScript** — `noUnusedLocals` is on; unused module-level functions/consts are
  build errors. Keep `typecheck` + `lint` + `build` green.

---

## 14. Gotchas cheat-sheet

- Call **`table.readRecords()` before `table.records`** — else empty.
- Use **`getLargestTable`** — table names are fragmented across instances.
- **`preloadAllInstances`** before resolving references whose target fragment varies.
- To read an **array-of-references**: load the container table (`getTableById(ref.tableId).readRecords()`) **before** reading slot keys.
- **`getBinaryReferenceToRecord`** exists at runtime but not in the lib's TS types — cast to reach it.
- **`PresentationId`** is the stable id to key by (not row index — rows shift).
- **`TeamIndex = 255`** means free-agent/pool (not on a team yet).
- **`IsUserControlled`** may read as boolean or string `'true'` — compare loosely.
- Global modals must **portal to `document.body`** (page-local ones get clipped by `<main>`'s clip-path).
- Screenshot harness: `unset ELECTRON_RUN_AS_NODE`; `MSYS2_ENV_CONV_EXCL` separator is `;`.
- Editing is **current-season only**; past seasons are frozen snapshots.
- `public/assets` is **gitignored** (huge game art) — the only copy is local/out-of-band.

---

## 15. Where things live (file map)

```
src/
  main/            main.ts, preload.ts, editorWrite.ts, recruitingWrite.ts, htmlExport.ts
    ipc/           database.ts, editor.ts, extraction.ts, export.ts, filesystem.ts, media.ts
  extractors/      extract-all.ts + ~18 extract-*.ts ; lib/franchise.ts (the wrapper)
  database/        getX.ts view-models, importExtraction.ts, helpers.ts, init.ts,
                   migrations.ts, schema*.sql, media.ts, relinkDynasty.ts, teamAwardsWrite.ts
  shared/          types.ts (the contract), ipcChannels.ts, playerEditorFields.ts,
                   portraitTaxonomy.ts, awardOrder.ts, gameImpactScore.ts
  teamAwards/      the app-calculated awards engine (definitions/scoring/eligibility/…)
  design/          defaultTokens.ts, applyTokens.ts
  renderer/
    app.tsx, index.tsx
    pages/         Coach/Team/NCAA/Recruit hub pages + layouts; awards/
    data/          context providers (modals, season, viewed team, confirm, …)
    components/    common/ (shared), ui/ (kit), charts/
    lib/           asset mapping, formatting, theme, rosterOrder, playerEditorOptions
    theme/         ThemeProvider, themePreference
    styles/        globals.css
docs/
  DEVELOPER_ONBOARDING.md         ← this file
  force-commit-recruit-hard-signing.md
  manual/                         manual.template.html, make-manual-pdf.js, README.md
DevLog.md            phase-by-phase history (the deep narrative)
Productivity/agenda.html   personal task board (not shipped)
webpack.config.js, electron-builder.js, tailwind.config.js, tsconfig.json
```

---

### How to use this doc with a Claude Project

Drop this file (plus `DevLog.md`, `docs/force-commit-recruit-hard-signing.md`, and
`src/shared/types.ts`) into a Claude Project's knowledge. This guide gives the map
and the reasoning; `DevLog.md` gives the blow-by-blow history and every real bug's
root cause; `types.ts` is the exact data/IPC contract. Together they can answer
almost any question about the app's behavior, data, and constraints.
