# Codebase Audit — 2026-07-18

Scope: bloat, build/startup processes, naming conventions, modularity, dead code. All numbers are real measurements from this machine.

## Headline

**The source code is in excellent shape.** 128 TS/TSX files, 23,772 lines, 3 debt markers total, 2 (legitimate) `console.log`s, zero dead files, and 100%-consistent naming. The "bloat" is almost entirely **regenerable build output and archival reference material outside `src/`** — not code problems. One real startup performance bug was found and fixed (see §2).

## 1. Bloat inventory (non-`src`)

| Path | Size | Nature | Recommendation |
|---|---|---|---|
| `dist/` | **7.6 GB** | Regenerable webpack output. Bloated well beyond a fresh build (~5.5 GB) because it accumulates assets deleted from `public/` long ago (old 1.68 GB `3d_logos`, etc.) and is never cleaned. | Add an `npm run clean` (delete `dist/` before build) — see §2. Safe to delete anytime; next launch rebuilds. |
| `release/` | **3.2 GB** | Old electron-builder package output (installer + unpacked). | Regenerable. Safe to delete; only needed when cutting a release. |
| `References/` | **109 MB** | The 39 Frostbite `.toc` files. `References/EA_FILES_FINDINGS.md` explicitly concludes they are "not usable, nothing to build. Safe to delete." | Delete (or move to external archive). Keep the `.md` findings. |
| `.backup/` | 1.6 MB | 7 timestamped **source snapshots** from 2026-07-15/16, superseded by later work. | User's own manual safety net — their call. The `CFB27-Hub-Backups/` snapshot + a future `git init` replace this. |
| `sharp` devDep | ~100 MB+ native | Added this session for the portrait assessment; unused after deferring WebP. | **Removed this session.** Re-add with `npm i -D sharp` when the WebP conversion runs. |
| `node_modules/` | 5.9 GB | Normal for Electron (the runtime + prebuilt binaries dominate). Regenerable via `npm install`, already gitignored. | No action — expected. |

Deleting `dist/` + `release/` + `References/` reclaims **~11 GB** immediately, all regenerable/archival. Not done unilaterally — `dist/` is the current working build (deleting forces a one-time 34s rebuild), and `.backup/` is your manual history.

**`.gitignore` status (relevant to the earlier `git init` suggestion):** one exists and correctly excludes `node_modules/`, `dist/`, `release/`, `*.sqlite`, and logs — so a future `git init` cleanly skips the big regenerables. **Gap:** it does *not* exclude `public/assets/` (5.3 GB of portraits) or `.backup/`/`References/`. If you ever `git init` this repo, add `public/assets/` to `.gitignore` first (or the initial commit balloons by 5.3 GB); the WebP conversion would shrink that to ~835 MB but it still shouldn't live in git.

## 2. Startup / build process — one real bug fixed

Full profiling in the DevLog entry. Summary of what was measured and fixed:

- **The Electron app itself is fast**: whenReady→DB-loaded 60 ms, →window-content-painted ~620 ms. Not the problem.
- **BUG (fixed): the launcher's rebuild-check took ~15 s on every launch.** `Launch CFB Dynasty Hub.bat` passed individual config-file paths *into* a `Get-ChildItem -Recurse` call alongside `src`. That specific mixed-path + `-Recurse` form triggers a PowerShell path-resolution pathology — measured **15,066 ms** vs **404 ms** for the split form (scan `src` recursively, check the config files separately). Fixed. **~14.6 s saved on every dev launch.**
- **The "splash vanishes, then ~10 s of nothing, then app" gap** was the pre-splash HTA's 30 s safety timeout expiring *mid-work*: 15 s check + up-to-34 s webpack rebuild exceeded 30 s, so the splash closed itself while the build was still running. Fixed two ways: (a) the 15 s→0.4 s check above, and (b) raised the HTA safety cap to 120 s — safe because the normal close is the ready-flag, and the launcher's `:failed` path already closes it on real failure.
- **Webpack persistent filesystem cache added** — unchanged-source rebuild ~50 s → ~16 s. (Residual is `CopyWebpackPlugin` statting the 26k asset files; a future optimization could skip asset re-copy when unchanged.)

**Dev vs. packaged — important:** all of the above is the **dev `.bat` launcher**. End users run the packaged `.exe`, which has no `.bat`, no PowerShell check, no rebuild, and no pre-splash HTA — it uses the Electron splash tied to window-ready. Measured packaged-equivalent cold start is ~2-4 s (Electron process spawn ~1.3 s, then splash, then ~0.6 s to content). The 10 s gap does **not** affect end users. If the packaged first-paint gap ever feels long, the lever is the Electron splash appearing sooner, not the `.bat`.

## 3. Code quality — clean

- **Debt markers:** 3 total (`TODO`/`FIXME`/`HACK`/`XXX`) across 128 files.
- **Stray logging:** 2 `console.log`s, both legitimate (screenshot-debug renderer-console forwarding; the diagnostic-import path). No debug noise.
- **Dead files:** none. An automated basename-reference scan flagged 3, all false positives — `sql.d.ts` and `global.d.ts` (ambient type declarations, no import needed) and `splash-preload.ts` (a webpack entry point, referenced in config not `src`).
- **Dependencies:** 5 production deps (`madden-franchise`, `react`, `react-dom`, `react-router-dom`, `sql.js`) — all necessary, none redundant. Dev toolchain standard.

## 4. Naming conventions — 100% consistent

| Area | Convention | Verified |
|---|---|---|
| `src/extractors` | kebab-case (`extract-*.ts`) | ✓ no exceptions |
| `src/database` | camelCase (`getX.ts`) | ✓ no kebab |
| `src/renderer/pages`, `components` | PascalCase (`X.tsx`) | ✓ no lowercase |
| `src/renderer/lib` | camelCase | ✓ no PascalCase |

No cross-convention leakage in any direction.

## 5. Modularity — minor opportunities only

Largest files: `shared/types.ts` (1,219), `PlayerProfileContent.tsx` (934), `TeamAwards.tsx` (874), `NcaaHub.tsx` (846), `Statistics.tsx` (650). All are legitimately feature-dense; none are god-objects. Optional, low-priority:

- **`EditButton` is defined 3×** — `CoachCard.tsx` (which already *exports* one), `Recruiting.tsx`, `Roster.tsx`. The latter two could import the shared one. Small DRY win, cosmetic.
- **`shared/types.ts` (1,219 lines)** could split by domain (awards, roster, schedule…) if it keeps growing. A single shared types module is defensible today; not urgent.
- **Empty `readme.md`** (0 bytes) — worth a short project README before any public/repo release.

## 6. Recommended actions, by priority

1. **Done this session:** fixed the 15 s rebuild-check, raised the HTA safety cap, added webpack cache, removed unused `sharp`.
2. **Low-effort, do soon:** add `npm run clean` (rm `dist/` before build) so `dist/` rot doesn't recur; write a real `readme.md`.
3. **Reclaim ~11 GB when convenient (your call):** delete `dist/`, `release/`, `References/*.toc` — all regenerable/archival.
4. **Optional/cosmetic:** dedupe `EditButton`; consider splitting `types.ts` later.
5. **Tracked separately:** WebP portrait conversion (Pre-Release Backlog in the roadmap) — the one genuinely large storage win (~5.4 GB → ~835 MB).

Nothing here blocks release. The codebase is tight; the wins are in build output hygiene and the (already-fixed) launcher startup path.
