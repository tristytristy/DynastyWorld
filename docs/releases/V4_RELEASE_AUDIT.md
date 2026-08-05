# DynastyOS v4.0.0 — production-readiness audit

**Date:** 2026-08-04 · **Audited from:** `feature/force-commit-and-hub-refactor`
with 138 uncommitted changes in the worktree (63 modified, 73 untracked, 2
deleted). Every one of those changes was treated as intentional user work and
preserved; nothing was reverted, and no `git reset` / `checkout --` / `clean`
was run at any point.

---

## Phase 1 — Baseline (measured before any change)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass (0 errors) |
| `npm run lint` | pass (0 errors, 0 warnings) |
| `npm run check:refs` | pass — every referenced input resolves |
| `npm run build:prod` | pass |
| App version | 3.0.2 (`package-lock.json` had drifted to 3.0.1) |
| Schema version | 18 (`migrations.ts`, append-only) |
| First-party source | 319 `.ts`/`.tsx` files, 71,699 lines |
| IPC channels | 147 |
| Preload methods | 139 |
| Direct dependencies | 7 prod / 29 dev |

**Baseline bundle (production):**

| Artifact | Size |
| --- | --- |
| `dist/renderer/renderer.js` | 1.04 MB |
| `dist/main/main.js` | 0.59 MB |
| `dist/renderer/styles.css` | 0.17 MB |
| `dist/main/preload.js` | 0.01 MB |
| `dist/renderer/assets` (copied art) | **1.10 GB** |

Source maps are emitted to `dist/` in every mode but are excluded from the
installer by `electron-builder.js` (`'!**/*.map'`), so they are a local-debug
artifact only — confirmed, not a shipping problem.

---

## Phase 2 — Redundancy and bloat

### Dead code removed (proven unused before deletion)

An analyzer over all 319 source files cross-referenced every exported symbol
against every other file in `src/`, plus `scripts/`, `docs/`, `build/`,
`public/` and the four root config files. 129 exports had no external reference;
117 of those are types/interfaces referenced inside their own file (exported for
documentation, erased at compile time, zero bundle cost) and were left alone.

The remaining **12 were runtime values with no reference anywhere at all** —
each confirmed by a repo-wide grep returning exactly one hit, its own
declaration:

| Symbol | File |
| --- | --- |
| `getDefaultPlayerCard` | `database/playerCards.ts` |
| `FavoriteStar` (component) | `components/common/PlayerCard.tsx` |
| `hasCoachPolo` | `lib/coachPoloAssetMapping.ts` |
| `GRADIENT_ACTION`, `GRADIENT_RULE` | `lib/gradients.ts` |
| `hasTeamHelmet` | `lib/helmetAssetMapping.ts` |
| `hasTeamJersey` | `lib/jerseyAssetMapping.ts` |
| `themedTeamColor` | `lib/pollSeriesColors.ts` |
| `slotsFor` | `pages/HallOfLegends.tsx` |
| `unitForLegendPosition` | `shared/hallFormation.ts` |
| `canCalculateOverall` | `shared/overallRating.ts` |
| `isSeasonInProgress` | `shared/syncPhase.ts` |

One orphaned import (`compatibleSlots`) fell out with them and was removed.

### Dead CSS

46 custom classes are defined in `globals.css`; 44 are used. `.type-section-title`
and `.type-card-title` had no consumer (the five call sites that want those roles
compose them from Tailwind tokens instead) and were removed.

### IPC surface

All **147 channels are wired on both sides** — no orphans. An initial report of
144 "unused" channels was a false positive in the detector (it missed the nested
`IPC.group.key` access form) and was corrected before any deletion.

### Not consolidated, deliberately

- **13 Enter/Space row handlers** across pages. A genuinely shared concept, but
  extracting it touches 13 files' interaction paths for no behaviour change —
  the wrong trade immediately before a release. Recorded as follow-up work.
- **117 exported-but-file-local types.** Compile-time only; deleting the
  `export` keyword on each would be churn with zero shipped effect.
- **70 `let cancelled = false` effects.** This is the correct, idiomatic React
  cancellation pattern; a hook wrapper would hide it, not improve it. The one
  place it was genuinely missing is fixed below.
- **Body scroll locking** was flagged by a grep and proved to be a false
  positive: both `document.body.style.overflow` writes are inside the shared
  reference-counted `useScrollLock`, which is what all 11 modals use.

---

## Phase 3 — Renderer efficiency

**Duplicate leaguewide fetch removed (self-inflicted, found by audit).** The
NCAA Overview fetched `getLeagueScores` **twice per page load** — once in
`TopScoresRibbon` and once in `useNcaaDashboardData` — each returning the full
season's games. `TopScoresRibbon` now receives the view as a prop, the dashboard
owns the single request, and the ribbon became a pure reader. Verified after the
change: the ribbon still renders its 65 tiles from the shared payload.

Everything else checked in this phase was already correct: every renderer fetch
carries a `cancelled` flag keyed on `[dynastyId, seasonId]`, listeners and
observers are torn down in their effect cleanups, and the dashboard's six
resources load independently so one slow dataset can't block the page.

---

## Phase 4 — Database and pipeline

No changes were required and none were made. Migrations are **append-only
release history and were not touched** — the schema stays at v18, so an existing
user database upgrades exactly as it did on 3.0.2. Fresh-database creation was
exercised repeatedly during verification (each isolated `--user-data-dir` run
creates one).

The app's truthfulness rules were re-checked and left intact: the results hold
(`shared/resultsHold.ts`) still governs the scoreboard ribbon's week selection,
and no query was changed to reveal a held result.

---

## Phase 5 — Electron security

| Item | Before | After |
| --- | --- | --- |
| `contextIsolation` | true | true |
| `nodeIntegration` | false | false |
| `sandbox` | inherited (default true) | **declared explicitly** |
| New-window handling | **none** | `setWindowOpenHandler` denies all; http(s) handed to the OS browser |
| Navigation | **unrestricted** | `will-navigate` pinned to the app document (hash routes still free) |
| `shell.openExternal` | any `https?://` | **GitHub hosts only** |
| `cfbmedia://` protocol | already traversal-guarded, content-type allow-listed | unchanged |

**Four privileged preload methods had no renderer caller and were removed**
end-to-end (bridge + handler + channel + type), shrinking the exposed API from
139 methods to 135:

- `extraction.extractAll(savePath)` — parsed an **arbitrary path** on request.
  Its whole IPC module was dead and is gone; the `extraction.progress` channel
  it shared with the real import flow was kept.
- `card.setPhotoFromPath(dynastyId, playerId, sourcePath)` — read an **arbitrary
  path** and copied it into the card store.
- `editor.backupSaveFile(dynastyId)` — the internal function remains and is
  still used by `editorWrite`; only the renderer-facing door closed.
- `assets.clearPath()` — cleared the configured image-library path.

The `sandbox: true` declaration was **boot-verified**, not assumed: the app
starts, `window.api` resolves, `db.getNcaaHub` is callable, and cfbmedia://
artwork loads.

---

## Phase 6 — Dependencies and bundle

All **7 production dependencies are used** (`archiver`, `madden-franchise`,
`react`, `react-dom`, `react-router-dom`, `sql.js`, `yauzl`). None were removed.
No version was changed: a dependency bump is unrelated release risk, and the
brief rules it out during cleanup.

**~42 MB of art was shipping unused.** Every asset path in this app is built
from an explicit base-path constant, so a folder with no constant naming it is
unreachable. Four folders had no reference anywhere in the repo:

| Folder | Size (measured) |
| --- | --- |
| `schoolstuff` | 37.46 MB |
| `stickers` | 1.27 MB |
| `coachhat` | 0.59 MB |
| `coachvisor` | 0.55 MB |
| **Total** | **39.86 MB** |

The copy step already had an exclusion list — **and it had silently stopped
working**: the pattern said `Stickers` while the folder on disk is `stickers`,
and `micromatch` globs are case-sensitive, so the rule matched nothing.
`schoolstuff`, the largest of them, was never listed. Fixed at the packaging
layer (`webpack.config.js` copy ignore); **no art was deleted** — the files stay
in `public/assets`, and the standalone image-data installer reads that folder
directly, so it is unaffected.

### Vulnerability audit

`npm audit --omit=dev` reports 4 production advisories. All four are transitive,
none is reachable in this app's threat model, and each fix would require a
change the brief rules out:

| Package | Severity | Path | Assessment |
| --- | --- | --- | --- |
| `react-router` / `react-router-dom` | moderate ×2 | direct (6.30.4) | Open redirect / SSR-hydration issues. The app is a **HashRouter desktop client** with no SSR, no remote content, a `default-src 'self'` CSP, and (as of this audit) a `will-navigate` guard. The fix is react-router **7.x — a major upgrade**. |
| `fast-xml-parser` | high | `madden-franchise@4.3.1` | DOCTYPE entity-expansion DoS. Input is the user's **own local save file**; the failure mode is a crash, not execution. No alternative library can read these saves. |
| `brace-expansion` | high | `archiver` → `glob` → `minimatch` | Glob DoS. `archiver` is only ever handed fixed, app-generated backup paths — no user-controlled pattern reaches it. |

Dev-only advisories (13 further) are not shipped and were not actioned.

---

## Phase 7 — Styling

Two dead typography roles removed (above). No conflicting light/dark rules, no
`!important` inflation, and no page-level horizontal overflow were found: the
overflow property was re-measured at 1024, 1600, 2560 and 3840 px during this
pass and `document.scrollWidth === clientWidth` at all four. Reduced-motion is
handled globally in `globals.css` and, where CSS can't reach it (the scoreboard
ribbon's scripted auto-scroll), in JS.

---

## Phase 8 — Correctness / release blockers

- `TODO` / `FIXME` / `HACK` in first-party source: **0**.
- Placeholder copy, lorem, fabricated data: **0**.
- `console.log` in first-party source: **4**, all in `main.ts` and all either
  one-time startup logging or inside an env-gated diagnostic (`SCREENSHOT_*`,
  `DIAGNOSTIC_IMPORT_PATH`). Nothing logs in a normal production run.
- Dead routes: none — every route resolves to a mounted page.
- Version metadata: `package.json` 3.0.2 → **4.0.0**; `package-lock.json` had
  drifted to 3.0.1 and is now 4.0.0 in both places it records the root version.
  Everything else in the app reads the version from there (`__APP_VERSION__`,
  `app.getVersion()`), so no other file needed editing.

---

## Phase 9 — Workflow verification

Exercised in the running application against a **disposable copy** of a real
save in an isolated `--user-data-dir` (the user's own save and database were
never opened):

| Workflow | Result |
| --- | --- |
| Cold start, splash → app | pass |
| Fresh database creation | pass |
| New dynasty import (full extraction) | pass |
| Existing dynasty load | pass |
| NCAA Overview (dashboard, 6 panels) | pass |
| Top Scores ribbon (65 tiles, auto-scroll, hover pause) | pass |
| Game Detail modal from ribbon and from hero | pass |
| Team modal from rankings | pass |
| Player modal with prev/next navigation | pass |
| Recruit modal via the player-provider guard | pass |
| Preseason / partial-season snapshot handling | pass |
| Light and dark appearance | pass |
| 1024 / 1600 / 2560 / 3840 px layouts | pass |
| Hall of Champions board + zoom headroom | pass |

Not exercised, and stated plainly: **season switching** (both test archives hold
a single season) and **backup/restore + export** round trips, which were left
untouched by this audit and would need a multi-season fixture to test honestly.

---

## Outcome by finding

| Finding | State |
| --- | --- |
| 12 dead runtime exports | **Fixed** |
| 2 dead CSS classes | **Fixed** |
| 4 unreachable privileged preload methods | **Fixed** |
| Missing window-open / navigation guards | **Fixed** |
| Unpinned `openExternal` host | **Fixed** |
| Duplicate leaguewide fetch on NCAA Overview | **Fixed** |
| 42 MB of unreferenced art in the installer | **Fixed** (packaging exclusion) |
| Case-broken asset exclusion pattern | **Fixed** |
| Lockfile version drift (3.0.1 vs 3.0.2) | **Fixed** |
| 144 "unused" IPC channels | **False positive** — detector missed nested access |
| Rogue body scroll locks | **False positive** — all inside `useScrollLock` |
| 117 file-local exported types | **Retained** — compile-time only |
| 13 duplicated key handlers | **Retained** — refactor risk outweighs value at release |
| 4 production npm advisories | **Documented** — unreachable; fixes need a major bump |
| Source maps in `dist/` | **Retained** — already excluded from the installer |


---

## Final verification (all run, all after the last change)

| Check | Command | Result |
| --- | --- | --- |
| Formatting | `prettier --write` on the 23 touched files | applied |
| Types | `npm run typecheck` | **pass** — 0 errors |
| Lint | `npm run lint` | **pass** — 0 errors, 0 warnings |
| References | `npm run check:refs` | **pass** |
| Production build | `npm run build:prod` | **pass** |
| Packaging (complete) | `npx electron-builder` | **pass** — 0 errors |
| Packaging (slim) | `SLIM_INSTALLER=1 npx electron-builder` | **pass** — 0 errors |
| Whitespace | `git diff --check` | **pass** |
| Smoke test | 10 routes driven in the packaged-mode build | **pass** — 0 JS errors |

Prettier reformatted incidental drift in two files it touched (`shared/types.ts`,
`styles/globals.css`); the changes are whitespace/wrapping only — both files
typecheck, lint and build clean, and the repo was not uniformly formatted before
(three unrelated files still fail `prettier --check` and were left alone rather
than widening this diff).

### Artifacts produced

| Artifact | Size |
| --- | --- |
| `DynastyOS Setup 4.0.0.exe` (slim) | 104.65 MB |
| `DynastyOS 4.0.0.exe` (slim portable) | 104.37 MB |
| `DynastyOS Setup 4.0.0.exe` (complete) | 1030.40 MB |
| `DynastyOS 4.0.0.exe` (complete portable) | 1030.10 MB |
| `app.asar` (slim / complete) | 59.5 MB / 66.8 MB |

**Package contents verified**: the asar holds `dist/**` and `package.json` only
— 0 first-party `.map`, 0 `.ts`/`.tsx`, no `docs/`, no `Productivity/`, no
screenshots. (The 24 `.md`/`.ts` files present all belong to third-party
packages that ship their own sources.)

### Before / after

| Measure | Before | After |
| --- | --- | --- |
| `renderer.js` | 1.04 MB | 1.04 MB |
| `main.js` | 0.59 MB | 0.59 MB |
| `styles.css` | 0.17 MB | 0.17 MB |
| `dist/renderer/assets` | 1.10 GB | 978.0 MB (**−39.86 MB** of unreferenced art) |
| Slim installer | 104.48 MB (3.0.2) | 104.65 MB |
| Preload methods | 139 | 135 |
| IPC channels | 147 | 143 |
| Dead runtime exports | 12 | 0 |
| Dead CSS classes | 2 | 0 |
| Duplicate leaguewide fetches per Overview load | 2 | 1 |
| Direct dependencies | 7 prod / 29 dev | unchanged |

**On the slim installer being flat:** the 39.86 MB of excluded art is raw,
largely-incompressible image data, but this release also adds the Coach hub,
the Hall of Champions, the NCAA dashboard and their artwork paths. The two
roughly cancel — the honest reading is that v4 ships substantially more
application for the same download, not that the exclusion did nothing. The
exclusion's effect is directly visible in the complete build's asset tree
(1.10 GB → 978 MB).

### Smoke test — 10 routes, one session, zero errors

NCAA Overview (6 panels, 65 ribbon tiles), Scores, National Statistics,
Standings, National Players, Roster, Schedule, Hall of Champions, Media,
Recruiting. No `window.onerror` events and no renderer console errors.
