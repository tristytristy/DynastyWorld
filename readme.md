# College Football 27 Dynasty Hub

A desktop app for tracking an EA Sports College Football 27 dynasty save across seasons — rosters, schedules, statistics, awards, recruiting, coach careers, and program history, all read directly from your `.DYNASTY` save file and archived locally so your dynasty's story survives roster turnover, coaching changes, and re-syncs.

**Local-first**: everything lives in a SQLite database on your machine. No login, no backend, works offline. Optional HTML export for sharing.

## Quick start (development)

```
npm install
npm run build     # webpack (main + preload + renderer), cached after first run
npx electron .    # or double-click "Launch CFB Dynasty Hub.bat"
```

Common scripts: `typecheck` · `lint` · `format` · `clean` / `build:clean` (purges `dist/`) · `build:prod` + `package` (electron-builder installer into `release/`).

## How it works

1. **Import** a `.DYNASTY` save (Dashboard → Import Dynasty). Extraction reads the save via [`madden-franchise`](https://www.npmjs.com/package/madden-franchise) — rosters, schedule, stats, coaches, recruiting, awards, league history.
2. **Sync each season** before advancing in-game — each sync snapshots that season permanently (`season_snapshots` in SQLite).
3. **Browse** any past season via the season switcher; edit players/coaches/recruits (writes back to the save file); track app-calculated Team Awards; export history to HTML.

The in-app **Help** menu covers the day-to-day workflow (when to sync, History-Only seasons, editing caveats, backups).

## Repository layout

| Path | What |
|---|---|
| `src/main` | Electron main process (IPC, save-file writes, startup/recovery) |
| `src/renderer` | React UI (pages, components, design tokens in `src/design`) |
| `src/extractors` | Save-file → structured data (one extractor per domain) |
| `src/database` | SQLite layer (sql.js), snapshots, migrations, queries |
| `src/teamAwards` | App-calculated award engine (out of React by design) |
| `public/assets` | Portraits, logos, trophies, fonts (bundled into `dist/`) |
| `DevLog.md` | The development log — read this first for context |
| `docs/planning/MASTER_ROADMAP_v2.md` | Roadmap, version history, pre-release backlog |
| `docs/` | Assessments, plans, onboarding, manual, releases (see `docs/` subfolders) |

User data lives in `%APPDATA%/cfb-dynasty-hub/` (`dynasty-archive.sqlite` + rolling backups; automatic corruption recovery on startup).

## Design system

Two typefaces (DIN display via Windows' Bahnschrift — licensed DIN Pro drops in with no code change — and bundled Inter for body), design tokens in `src/design/defaultTokens.ts` feeding CSS variables + Tailwind, hard-edged shape language with a single cut corner (`.corner-cut`) echoing the game's own UI, and per-team theming (Team Mode) via `--team-primary` variables. See `docs/VISUAL_OVERHAUL_PLAN.md`.
