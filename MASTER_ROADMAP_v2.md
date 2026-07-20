# College Football Dynasty Tracker - v2.0 Roadmap
## Desktop + Local-First Architecture with Premium Polish

**Status:** Pivoting from web-based (v1.0) to Electron + SQLite (v2.0)  
**Date:** 2026-07-14 (Updated 2026-07-16)  
**Version:** 2.2 (+ UI/UX Overhaul Initiative, Phases A-K)  
**Rationale:** Direct game import capability, better privacy, offline-first, faster MVP, premium UI with NCAA logos

---

# Executive Summary

Build an Electron-based desktop application that reads EA Sports College Football 27 DYNASTY save files directly, stores dynasty data locally in SQLite, and enables export to shareable HTML. This approach:

- **Eliminates manual data entry** (80% auto from game saves)
- **Respects data ownership** (local-first, optional cloud)
- **Works offline** (desktop app with no backend dependency)
- **Scales to web sharing** (export to HTML, then optional cloud hosting)
- **Faster MVP** (Electron + extraction scripts vs. full web stack)

---

# Core Product Principles

## Principle 1: Data Ownership
Users own and preserve their dynasty history locally. Data lives on their PC. Cloud storage is optional, never required.

## Principle 2: Offline-First
The app works entirely offline. No login required. No backend. SQLite database lives on the user's machine.

## Principle 3: Fast Entry
Import an entire season from a save file in seconds. No form filling for 80% of data.

## Principle 4: Manual-First Architecture
Every feature functions without game import. Import accelerates workflows, doesn't replace them. Users can override imported data at any time.

## Principle 5: Progressive Complexity
Casual users: view season overview and stats.  
Power users: dive into player archetypes, recruiting pipelines, detailed analytics.

## Principle 6: Public Storytelling
Dynasties can be exported as shareable HTML files. Optional cloud sharing later.

## Principle 7: Premium Polish
Beautiful UI with team logos, colors, responsive design. Every detail matters, and the product should feel intentional rather than purely utilitarian.

### Internal Visual Direction
The app should feel premium, calm, and sports-native while staying polished enough for long desktop sessions.

That means:
- Calm, precise hierarchy instead of cluttered dashboards
- Premium materials (glass, depth, restraint) instead of generic admin-panel chrome
- Athletic editorial energy through team identity, typography, and motion
- Fast, confident interactions that feel native on desktop
- Polish that makes the app feel collectible, not merely functional

---

# Enhanced Data Extraction Strategy

## Why We're Extending CFB Offline

The existing CFB Offline tool extracts 6 data types. We're building on this foundation but **expanding extractions** to include richer program history and coaching information.

### Standard Extractions (From CFB Offline)
1. **League Snapshot** - season metadata, user team, coach
2. **Schedule** - weekly games, opponents, results
3. **Teams** - team records, standings, polls, ratings
4. **Statistics** - player game stats, season aggregations
5. **Awards** - weekly POW, All-Americans, Heisman, etc.
6. **Recruiting** - recruit board and class info

### Enhanced Extractions (New for v2.0)

#### 1. Coach Data
**What:** Head coach profile, coordinators, staff ratings
```javascript
{
  headCoach: {
    name: string,
    personality: string,
    archetype: string,
    rating: number,
    experience: number,
    contract: {
      years_remaining: number,
      salary: number,
      buyout: number
    }
  },
  coordinators: {
    offensive: { name, rating },
    defensive: { name, rating }
  },
  staff: [
    { position, name, rating, bonus_multiplier }
  ],
  coaching_history: [
    { year, team, record, bowl_game }
  ]
}
```

#### 2. Historical Team Rosters (by Season)
**What:** Track player progression across multiple seasons
```javascript
{
  season: number,
  roster: [
    {
      player_id: number,
      name: string,
      position: string,
      class: string,      // FR, SO, JR, SR
      overall: number,
      ratings: { ... },
      archetype: string,
      status: string      // Active, Redshirt, Graduated, Left Program
    }
  ],
  depth_chart: [
    { position, depth_1_id, depth_2_id, depth_3_id }
  ]
}
```

#### 3. Championships & Trophies
**What:** Long-term program achievements
```javascript
{
  national_championships: [
    { year, final_rank, playoff_seed, opponent, score }
  ],
  conference_championships: [
    { year, conference, finalists }
  ],
  bowl_appearances: [
    { year, bowl_name, opponent, score, result }
  ],
  playoff_appearances: [
    { year, seed, final_rank, opponents_faced }
  ],
  milestones: [
    { year, achievement, detail }  // e.g., "First 10-win season", "500th program win"
  ]
}
```

#### 4. Player Career Tracking (Enhanced)
**What:** Full career stats across seasons in dynasty
```javascript
{
  player_id: number,
  name: string,
  years_in_program: [
    {
      season: number,
      position: string,
      class: string,
      games_played: number,
      stats: { ... }
    }
  ],
  career_totals: { ... },
  achievements: [
    { year, award, detail }
  ]
}
```

### Extraction Execution Strategy

**Phase 1:** Extend existing extractors (2-3 scripts added)
- `extract-coaches.js` - coach table parsing
- `extract-rosters-history.js` - multi-season roster tracking
- `extract-trophies.js` - championship/bowl/playoff parsing

**Phase 2:** Integrate into import pipeline
- Run all extractors on save import
- Store JSON snapshots in SQLite (like current approach)
- Version the extraction schema for future-proofing

---

# Logo Strategy: NCAA + Game Logos

## Phase 1: NCAA Logos (MVP - Launch Ready)

**Status:** âœ… 288 team logos ready to use  
**Location:** `assets/icons/NCAA Logos/`  
**Format:** PNG, scalable

### NCAA Logo Integration

**Asset Mapping System**
```typescript
// lib/assetMapping.ts
const TEAM_TO_NCAA_LOGO = {
  'alabama': 'alabama.png',
  'auburn': 'auburn.png',
  'clemson': 'clemson.png',
  // ... all 288 teams
};

function getLogoPath(teamAssetName: string): string {
  const normalized = teamAssetName.toLowerCase().replace(/\s+/g, '');
  return `/assets/icons/NCAA Logos/${TEAM_TO_NCAA_LOGO[normalized] || '_NCAA_logo.png'}`;
}
```

**Logo Usage in UI**
- Team headers (dashboard, season view)
- Opponent badges in schedule
- Roster/player cards
- Awards and achievements
- HTML export pages
- Nav breadcrumbs

**Benefits:**
- âœ… Professional appearance immediately
- âœ… 288 teams covered
- âœ… Consistent sizing/optimization
- âœ… Works offline (embedded in app)
- âœ… Easy to upgrade later

## Phase 2+: Game Logos (Future Enhancement)

**Research Track** (Parallel, optional before launch)

**Investigation Areas:**
1. **Game Asset Files**
   - CFB 27 game installation folder structure
   - Look for logo/texture files in game data
   - Extract from game asset bundles

2. **Save File Embedded Logos**
   - Binary analysis of DYNASTY save files
   - Check if logo data is serialized with team data
   - Use madden-franchise library to extract

3. **Community Resources**
   - Madden/CFB modding communities
   - Logo mods/packs already created
   - Reverse-engineering documentation

4. **Fallback Approach**
   - NCAA logos remain default
   - Offer user option to upload custom team logos
   - Store in local filesystem
   - Merge with app logos on display

**Upgrade Path When Game Logos Found:**
```typescript
// Future enhancement
const gameLogoPath = await resolveGameLogo(teamAssetName);
if (gameLogoPath) {
  return gameLogoPath;  // Use game logo
} else {
  return getLogoPath(teamAssetName);  // Fall back to NCAA
}
```

---

# Technology Stack

## Frontend
```
Electron (desktop shell)
React 18
TypeScript
Tailwind CSS
shadcn/ui
Recharts (charts/analytics)
```

## Local Storage
```
SQLite (via sql.js for in-process database)
Local filesystem (user's Documents folder)
```

## Data Extraction
```
madden-franchise library (parses game saves)
Custom extraction scripts (league, schedule, teams, stats, awards, recruits)
```

## Optional Future (Cloud Sharing, Not MVP)
```
Supabase (for optional public dynasty sharing layer)
Vercel (for optional public pages)
```

---

# Development Phases

## PHASE 0: Foundation & Electron Setup

### Objective
Create a working Electron shell with React, TypeScript, Tailwind CSS, and local SQLite database with NCAA logo integration.

### Timeline
1-2 weeks

### Deliverables

#### Project Structure (Complete)

```
cfb-dynasty-tracker/
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ assets/
â”‚   â”‚   â”œâ”€â”€ icons/
â”‚   â”‚   â”‚   â””â”€â”€ NCAA Logos/
â”‚   â”‚   â”‚       â”œâ”€â”€ alabama.png
â”‚   â”‚   â”‚       â”œâ”€â”€ auburn.png
â”‚   â”‚   â”‚       â””â”€â”€ ... (288 team logos)
â”‚   â”‚   â”œâ”€â”€ app-icon.png
â”‚   â”‚   â””â”€â”€ app-icon.ico
â”‚   â””â”€â”€ index.html
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ main/
â”‚   â”‚   â”œâ”€â”€ main.ts                    # Electron main process
â”‚   â”‚   â”œâ”€â”€ preload.ts                 # IPC bridge
â”‚   â”‚   â”œâ”€â”€ ipc/
â”‚   â”‚   â”‚   â”œâ”€â”€ database.ts            # DB IPC handlers
â”‚   â”‚   â”‚   â”œâ”€â”€ extraction.ts          # Extraction IPC handlers
â”‚   â”‚   â”‚   â””â”€â”€ filesystem.ts          # File access IPC handlers
â”‚   â”‚   â””â”€â”€ handlers/
â”‚   â”‚       â”œâ”€â”€ dynastyHandlers.ts
â”‚   â”‚       â”œâ”€â”€ extractionHandlers.ts
â”‚   â”‚       â””â”€â”€ settingsHandlers.ts
â”‚   â”‚
â”‚   â”œâ”€â”€ renderer/
â”‚   â”‚   â”œâ”€â”€ app.tsx                    # Root component
â”‚   â”‚   â”œâ”€â”€ index.tsx                  # Entry point
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx          # Main dashboard
â”‚   â”‚   â”‚   â”œâ”€â”€ DynastySetup.tsx       # Import/create dynasty
â”‚   â”‚   â”‚   â”œâ”€â”€ SeasonView.tsx         # Season details
â”‚   â”‚   â”‚   â”œâ”€â”€ Roster.tsx             # Roster viewing
â”‚   â”‚   â”‚   â”œâ”€â”€ Schedule.tsx           # Schedule/results
â”‚   â”‚   â”‚   â”œâ”€â”€ Stats.tsx              # Statistics
â”‚   â”‚   â”‚   â”œâ”€â”€ Awards.tsx             # Awards/achievements
â”‚   â”‚   â”‚   â””â”€â”€ Settings.tsx           # App settings
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”œâ”€â”€ common/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ Navbar.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ Sidebar.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ TeamLogo.tsx       # NEW: Logo display component
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ TeamBadge.tsx      # Team + logo badge
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ LoadingSpinner.tsx
â”‚   â”‚   â”‚   â”‚
â”‚   â”‚   â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ DynastyCard.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ QuickStatsCard.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ RecentActivityCard.tsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ SeasonOverviewCard.tsx
â”‚   â”‚   â”‚   â”‚
â”‚   â”‚   â”‚   â”œâ”€â”€ import/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ SaveFileBrowser.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ ImportPreview.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ ImportProgress.tsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ ImportSuccess.tsx
â”‚   â”‚   â”‚   â”‚
â”‚   â”‚   â”‚   â”œâ”€â”€ roster/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ RosterTable.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ PlayerCard.tsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ PlayerProgressChart.tsx
â”‚   â”‚   â”‚   â”‚
â”‚   â”‚   â”‚   â”œâ”€â”€ schedule/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ ScheduleTable.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ GameCard.tsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ RecordSummary.tsx
â”‚   â”‚   â”‚   â”‚
â”‚   â”‚   â”‚   â””â”€â”€ charts/
â”‚   â”‚   â”‚       â”œâ”€â”€ RankingChart.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ RecordChart.tsx
â”‚   â”‚   â”‚       â””â”€â”€ StatsChart.tsx
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â”œâ”€â”€ api.ts                 # IPC communication layer
â”‚   â”‚   â”‚   â”œâ”€â”€ assetMapping.ts        # NCAA logo mapping
â”‚   â”‚   â”‚   â”œâ”€â”€ formatting.ts          # Format numbers, dates
â”‚   â”‚   â”‚   â”œâ”€â”€ constants.ts           # App constants
â”‚   â”‚   â”‚   â””â”€â”€ types.ts               # Shared TypeScript types
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”‚   â”œâ”€â”€ useDynasties.ts        # Dynasty data hook
â”‚   â”‚   â”‚   â”œâ”€â”€ useImport.ts           # Import progress hook
â”‚   â”‚   â”‚   â”œâ”€â”€ useDatabase.ts         # DB access hook
â”‚   â”‚   â”‚   â””â”€â”€ useTheme.ts            # Theme management
â”‚   â”‚   â”‚
â”‚   â”‚   â””â”€â”€ styles/
â”‚   â”‚       â””â”€â”€ globals.css            # Tailwind + custom styles
â”‚   â”‚
â”‚   â”œâ”€â”€ database/
â”‚   â”‚   â”œâ”€â”€ schema.sql                 # Database schema
â”‚   â”‚   â”œâ”€â”€ migrations.ts              # Migration system
â”‚   â”‚   â”œâ”€â”€ init.ts                    # Database initialization
â”‚   â”‚   â””â”€â”€ helpers.ts                 # Query helpers
â”‚   â”‚
â”‚   â”œâ”€â”€ extractors/
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â””â”€â”€ franchise.ts           # madden-franchise wrapper
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ extract-league.ts          # League snapshot
â”‚   â”‚   â”œâ”€â”€ extract-schedule.ts        # Schedule/games
â”‚   â”‚   â”œâ”€â”€ extract-teams.ts           # Team data
â”‚   â”‚   â”œâ”€â”€ extract-stats.ts           # Player stats
â”‚   â”‚   â”œâ”€â”€ extract-awards.ts          # Awards
â”‚   â”‚   â”œâ”€â”€ extract-recruits.ts        # Recruiting
â”‚   â”‚   â”œâ”€â”€ extract-coaches.ts         # NEW: Coach data
â”‚   â”‚   â”œâ”€â”€ extract-rosters.ts         # NEW: Historical rosters
â”‚   â”‚   â””â”€â”€ extract-trophies.ts        # NEW: Championships/bowls
â”‚   â”‚
â”‚   â””â”€â”€ shared/
â”‚       â””â”€â”€ types.ts                   # Shared types
â”‚
â”œâ”€â”€ electron-builder.config.js
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ tailwind.config.js
â”œâ”€â”€ package.json
â””â”€â”€ README.md
```

#### Key Files & Configurations

**package.json Dependencies**
```json
{
  "dependencies": {
    "electron-squirrel-startup": "^1.1.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "shadcn-ui": "^0.0.4",
    "recharts": "^2.8.0",
    "sql.js": "^1.8.0",
    "madden-franchise": "latest",
    "electron-builder": "^24.0.0"
  }
}
```

**tsconfig.json Setup**
- Strict mode enabled
- Path aliases configured
- Module resolution set to bundler
- React 18 JSX support

**Tailwind + shadcn/ui**
- Dark mode support (prefers-color-scheme)
- Team color theming capability
- Custom color palette for CFB app
- Component library pre-configured

#### Database Initialization

**sql.js Setup in Main Process**
```typescript
// main/database.ts
import initSqlJs, { Database } from 'sql.js';

let SQL: any;
let db: Database;

async function initDatabase() {
  SQL = await initSqlJs();
  // Load or create dynasty-archive.sqlite
  // Run schema migrations
}
```

#### IPC Bridge Architecture

**Main â†’ Renderer Communication**
```typescript
// preload.ts
contextBridge.exposeInMainWorld('api', {
  // Database
  getDynasties: () => ipcRenderer.invoke('db:getDynasties'),
  importDynasty: (path) => ipcRenderer.invoke('db:importDynasty', path),
  
  // Extraction
  extractSave: (path) => ipcRenderer.invoke('extract:all', path),
  
  // Filesystem
  selectFile: () => ipcRenderer.invoke('fs:selectFile'),
  getDefaultSavesDir: () => ipcRenderer.invoke('fs:getDefaultSavesDir'),
});
```

#### NCAA Logo Integration

**Asset Mapping System**
```typescript
// lib/assetMapping.ts
export const TEAM_NCAA_LOGOS: Record<string, string> = {
  'alabama': 'alabama.png',
  'auburn': 'auburn.png',
  // ... 288 teams
};

export function getLogoPath(teamAssetName: string): string {
  const normalized = teamAssetName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  
  return `file://${app.getAppPath()}/public/assets/icons/NCAA Logos/${
    TEAM_NCAA_LOGOS[normalized] || '_NCAA_logo.png'
  }`;
}
```

**TeamLogo Component**
```typescript
// components/common/TeamLogo.tsx
interface TeamLogoProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function TeamLogo({ team, size = 'md' }: TeamLogoProps) {
  const logoPath = getLogoPath(team.assetName);
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  }[size];
  
  return (
    <img
      src={logoPath}
      alt={team.label}
      className={`${sizeClass} object-contain`}
    />
  );
}
```

#### Electron Configuration

**Main Process Setup**
- Window size: 1400x900 (resizable)
- Persist window state (size, position)
- App icon in taskbar
- Menu bar with File/View/Help
- Auto-update checking

**Build Configuration**
```javascript
// electron-builder.config.js
{
  appId: "com.antigracity.cfb-dynasty-tracker",
  productName: "CFB Dynasty Tracker",
  files: [
    "src/**/*",
    "public/**/*",
    "package.json"
  ],
  win: {
    target: ["nsis", "portable"],
    icon: "public/app-icon.ico"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
}
```

### Deliverables Checklist
- âœ… Electron app bootstrapped with production setup
- âœ… React 18 + TypeScript + Tailwind configured
- âœ… shadcn/ui component library initialized
- âœ… SQL.js database ready (schema not yet created)
- âœ… IPC bridge for communication
- âœ… NCAA logos copied to public/assets
- âœ… Asset mapping system ready
- âœ… File dialogs for save selection working
- âœ… ESLint + Prettier configured
- âœ… Basic Electron window chrome (navbar, sidebar)

### Claude Prompt
Set up a production Electron app using React 18, TypeScript, Tailwind CSS, shadcn/ui, and sql.js. Create the complete file structure above. Configure IPC communication between main and renderer processes. Integrate NCAA logo asset mapping system. Set up development and production builds with electron-builder. Include dark mode support and responsive layout system.

---

## PHASE 1: Local Data Storage & Enhanced Schema

### Objective
Build the complete SQLite database schema with enhanced data structures for coaching, historical rosters, and championships.

### Timeline
1 week

### Database Schema (Complete)

#### Core Tables

**dynasties**
```sql
CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,                    -- SHA1 hash of save_path (0-16 chars)
  save_path TEXT NOT NULL UNIQUE,         -- Full path to DYNASTY save file
  label TEXT NOT NULL,                    -- User-friendly name (e.g., "Alabama 2026")
  team_id INTEGER,                        -- Game team ID for coaching
  team_name TEXT,                         -- Team display name
  team_color_primary TEXT,                -- Primary color (hex #RRGGBB)
  team_color_secondary TEXT,              -- Secondary color (hex)
  created_at TEXT NOT NULL,               -- ISO timestamp
  updated_at TEXT NOT NULL,               -- ISO timestamp
  notes TEXT,                             -- User notes about dynasty
  is_active BOOLEAN DEFAULT 1             -- Active/archived flag
);

CREATE INDEX idx_dynasties_team_id ON dynasties(team_id);
CREATE INDEX idx_dynasties_created_at ON dynasties(created_at DESC);
```

**seasons**
```sql
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,               -- Foreign key to dynasties
  season_year INTEGER NOT NULL,           -- Year (e.g., 2026)
  extracted_at TEXT NOT NULL,             -- When data was extracted
  is_current BOOLEAN DEFAULT 0,           -- Currently playing season
  final_record_wins INTEGER,
  final_record_losses INTEGER,
  final_record_ties INTEGER,
  conference_record_wins INTEGER,
  conference_record_losses INTEGER,
  final_ranking_ap INTEGER,               -- Final AP ranking (0 = unranked)
  final_ranking_coaches INTEGER,          -- Final Coaches ranking
  final_ranking_cfp INTEGER,              -- Final CFP ranking
  bowl_game_name TEXT,                    -- Bowl game name if applicable
  bowl_result TEXT,                       -- Win/Loss for bowl game
  conference_championship BOOLEAN,        -- Won conference championship
  national_championship BOOLEAN,          -- Won national championship
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, season_year)
);

CREATE INDEX idx_seasons_dynasty_year ON seasons(dynasty_id, season_year DESC);
CREATE INDEX idx_seasons_extracted_at ON seasons(extracted_at DESC);
```

**season_snapshots** (stores raw extracted JSON)
```sql
CREATE TABLE season_snapshots (
  season_id INTEGER NOT NULL,
  name TEXT NOT NULL,                     -- league|schedule|teams|stats|awards|recruits|coaches|rosters|trophies
  payload TEXT NOT NULL,                  -- JSON blob from extraction
  extracted_at TEXT NOT NULL,
  extraction_version TEXT,                -- Schema version (for migrations)
  PRIMARY KEY(season_id, name),
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_snapshots_name ON season_snapshots(name);
```

#### Player Data Tables

**players** (across all seasons in a dynasty)
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  game_player_id INTEGER,                 -- Game's internal player ID
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  position TEXT,                          -- QB, RB, WR, etc.
  height_inches INTEGER,
  weight_pounds INTEGER,
  hometown TEXT,
  state TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_players_dynasty ON players(dynasty_id);
CREATE INDEX idx_players_position ON players(position);
```

**player_seasons** (track player year-by-year)
```sql
CREATE TABLE player_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  class TEXT,                             -- FR, SO, JR, SR
  overall_rating INTEGER,
  speed INTEGER,
  strength INTEGER,
  acceleration INTEGER,
  -- ... other ratings
  archetype TEXT,
  development_trait TEXT,
  games_played INTEGER,
  games_started INTEGER,
  status TEXT,                            -- Active, Redshirt, Graduated, Left Program
  jersey_number INTEGER,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(player_id, season_id)
);

CREATE INDEX idx_player_seasons_player ON player_seasons(player_id);
CREATE INDEX idx_player_seasons_season ON player_seasons(season_id);
```

**player_game_stats**
```sql
CREATE TABLE player_game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  -- Passing stats
  pass_attempts INTEGER DEFAULT 0,
  pass_completions INTEGER DEFAULT 0,
  pass_yards INTEGER DEFAULT 0,
  pass_touchdowns INTEGER DEFAULT 0,
  interceptions INTEGER DEFAULT 0,
  -- Rushing stats
  rush_attempts INTEGER DEFAULT 0,
  rush_yards INTEGER DEFAULT 0,
  rush_touchdowns INTEGER DEFAULT 0,
  -- Receiving stats
  receptions INTEGER DEFAULT 0,
  receiving_yards INTEGER DEFAULT 0,
  receiving_touchdowns INTEGER DEFAULT 0,
  -- Defense stats
  tackles INTEGER DEFAULT 0,
  tackles_for_loss INTEGER DEFAULT 0,
  sacks REAL DEFAULT 0,
  interceptions_defense INTEGER DEFAULT 0,
  forced_fumbles INTEGER DEFAULT 0,
  fumble_recoveries INTEGER DEFAULT 0,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_game_stats_player ON player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_game ON player_game_stats(game_id);
```

**player_career_stats** (cached aggregate)
```sql
CREATE TABLE player_career_stats (
  player_id INTEGER PRIMARY KEY,
  dynasty_id TEXT NOT NULL,
  total_games_played INTEGER DEFAULT 0,
  total_games_started INTEGER DEFAULT 0,
  -- Passing
  career_pass_attempts INTEGER DEFAULT 0,
  career_pass_yards INTEGER DEFAULT 0,
  career_pass_touchdowns INTEGER DEFAULT 0,
  -- Rushing
  career_rush_yards INTEGER DEFAULT 0,
  career_rush_touchdowns INTEGER DEFAULT 0,
  -- Receiving
  career_receptions INTEGER DEFAULT 0,
  career_receiving_yards INTEGER DEFAULT 0,
  career_receiving_touchdowns INTEGER DEFAULT 0,
  -- Defense
  career_tackles INTEGER DEFAULT 0,
  career_sacks REAL DEFAULT 0,
  career_interceptions INTEGER DEFAULT 0,
  last_updated TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);
```

#### Game & Schedule Tables

**games**
```sql
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week INTEGER,
  game_number INTEGER,
  opponent_name TEXT NOT NULL,
  opponent_id INTEGER,                    -- Game's opponent team ID
  location TEXT,                          -- Home, Away, Neutral
  game_date TEXT,                         -- ISO date
  opponent_ranking_ap INTEGER DEFAULT 0,  -- 0 = unranked
  opponent_ranking_coaches INTEGER DEFAULT 0,
  user_ranking_ap INTEGER DEFAULT 0,
  user_score INTEGER,
  opponent_score INTEGER,
  result TEXT,                            -- W, L, T
  game_type TEXT,                         -- Regular, Bowl, Playoff
  notes TEXT,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_games_season_week ON seasons(id, week);
CREATE INDEX idx_games_result ON games(result);
```

#### Coaching Tables (NEW)

**coaches**
```sql
CREATE TABLE coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  position TEXT,                          -- Head Coach, OC, DC, QB Coach, etc.
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_coaches_dynasty ON coaches(dynasty_id);
```

**coach_seasons**
```sql
CREATE TABLE coach_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  position TEXT,
  overall_rating INTEGER,
  -- Head coach only
  years_coaching INTEGER,
  personality TEXT,                       -- Personality archetype
  prestige_rating INTEGER,
  
  -- Contract info
  contract_years_remaining INTEGER,
  salary INTEGER,
  buyout INTEGER,
  
  -- Record when hired
  coaching_record_wins INTEGER,
  coaching_record_losses INTEGER,
  
  FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(coach_id, season_id)
);

CREATE INDEX idx_coach_seasons_season ON coach_seasons(season_id);
```

#### Awards Tables

**awards**
```sql
CREATE TABLE awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  award_name TEXT NOT NULL,               -- Heisman, POTY, Best QB, etc.
  award_type TEXT,                        -- National, Conference, Weekly, All-American
  player_id INTEGER,
  coach_id INTEGER,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE INDEX idx_awards_season ON awards(season_id);
CREATE INDEX idx_awards_player ON awards(player_id);
```

#### Championship & Trophy Tables (NEW)

**championships**
```sql
CREATE TABLE championships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  championship_type TEXT,                 -- National, Conference, Division
  conference_name TEXT,
  is_national BOOLEAN,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, season_year, championship_type)
);

CREATE INDEX idx_championships_dynasty ON championships(dynasty_id);
```

**bowl_games**
```sql
CREATE TABLE bowl_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  bowl_name TEXT NOT NULL,
  opponent_name TEXT,
  opponent_id INTEGER,
  user_score INTEGER,
  opponent_score INTEGER,
  result TEXT,                            -- W, L, T
  game_date TEXT,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_bowl_games_season ON bowl_games(season_id);
```

**program_milestones** (cached achievements)
```sql
CREATE TABLE program_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  milestone_type TEXT,                    -- e.g., "first_10_win_season", "500th_win", "consecutive_bowls"
  description TEXT,
  value TEXT,                             -- Additional data
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_milestones_dynasty ON program_milestones(dynasty_id);
```

#### Recruiting Tables

**recruits**
```sql
CREATE TABLE recruits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  game_recruit_id INTEGER,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  position TEXT,
  state TEXT,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_recruits_dynasty ON recruits(dynasty_id);
```

**recruit_seasons**
```sql
CREATE TABLE recruit_seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruit_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  stars INTEGER,                          -- 2-5 stars
  national_rank INTEGER DEFAULT 0,
  position_rank INTEGER DEFAULT 0,
  state_rank INTEGER DEFAULT 0,
  recruit_type TEXT,                      -- 4-Star, 5-Star, etc.
  commitment_status TEXT,                 -- Watching, Offered, Top 5, Committed, Signed, Lost
  signed_status TEXT,                     -- Signed, Not Signed, Decommitted
  archetype TEXT,
  FOREIGN KEY(recruit_id) REFERENCES recruits(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(recruit_id, season_id)
);

CREATE INDEX idx_recruit_seasons_season ON recruit_seasons(season_id);
```

### Data Access Layer (TypeScript)

```typescript
// database/helpers.ts

// Dynasties
async function getDynasties(): Promise<Dynasty[]>
async function getDynasty(id: string): Promise<Dynasty>
async function createDynasty(path: string, label: string): Promise<Dynasty>
async function updateDynasty(id: string, data: Partial<Dynasty>): Promise<void>
async function deleteDynasty(id: string): Promise<void>

// Seasons
async function getSeasons(dynastyId: string): Promise<Season[]>
async function getSeason(seasonId: number): Promise<Season>
async function createSeason(dynastyId: string, year: number): Promise<Season>
async function updateSeason(seasonId: number, data: Partial<Season>): Promise<void>

// Snapshots
async function saveSnapshot(seasonId: number, name: string, payload: any): Promise<void>
async function getSnapshot(seasonId: number, name: string): Promise<any>

// Players
async function getPlayersBySeason(seasonId: number): Promise<Player[]>
async function getPlayerSeasons(playerId: number): Promise<PlayerSeason[]>
async function addPlayerToSeason(playerId: number, seasonId: number, data: any): Promise<void>

// Coaches
async function getCoachesForSeason(seasonId: number): Promise<Coach[]>
async function getHeadCoach(seasonId: number): Promise<Coach>
async function addCoach(dynastyId: string, coach: CoachData): Promise<Coach>

// Rosters (historical)
async function getRosterForSeason(seasonId: number): Promise<PlayerSeason[]>
async function compareRosters(season1Id: number, season2Id: number): Promise<RosterComparison>

// Championships
async function getChampionships(dynastyId: string): Promise<Championship[]>
async function addChampionship(dynastyId: string, data: any): Promise<void>
async function getBowlGames(seasonId: number): Promise<BowlGame[]>

// Games
async function getGamesForSeason(seasonId: number): Promise<Game[]>
async function getGameDetail(gameId: number): Promise<GameDetail>
async function addGame(seasonId: number, game: GameData): Promise<Game>
```

### Deliverables Checklist
- âœ… SQL schema created with all tables
- âœ… Indexes optimized for common queries
- âœ… Migration system implemented
- âœ… TypeScript DAL helpers written
- âœ… Database initialization script
- âœ… Backup/restore utilities
- âœ… Team color extraction from save

### Claude Prompt
Implement complete SQLite database schema with tables for dynasties, seasons, players (current and historical), coaches, games, awards, championships, bowls, and recruiting. Create TypeScript data access layer with CRUD operations. Include migration system, backup utilities, and optimized indexes. Implement query helpers for common operations like "get rosters by year", "get championship history", "get coaching history", etc.

---

## PHASE 2: Save File Discovery & Enhanced Import UI

### Objective
Discover DYNASTY save files, extract comprehensive data (including coaches, rosters, championships), and import into SQLite with polished UI and NCAA logos.

### Timeline
2 weeks

### Features

#### Save File Discovery
- **Auto-scan** on app launch
  - Windows default: `Documents/EA SPORTS College Football 27/saves/`
  - Scan for `.DYNASTY` files
  - Show "X saves found" notification
  
- **Custom path support**
  - File browser dialog
  - Remember user's custom path
  - Re-scan with button
  
- **Save metadata preview** (before import)
  - Season year
  - Team name + NCAA logo
  - Head coach name
  - Current record (if mid-season)
  - Last modified date

#### Import Workflow

**Step 1: Save Selection**
```
[Browse saves]
- Alabama (2026) - last played 2 days ago
- Clemson (2026) - last played 1 week ago
- Texas (2025) - archived
```

**Step 2: Import Preview**
```
Importing: Alabama
Season: 2026
Team: Alabama Crimson Tide [LOGO]
Coach: Nick Saban (Year 5)
Current Record: 12-0
Estimated import time: ~3 seconds
```

**Step 3: Extraction Progress**
```
Extracting data...
- League snapshot       âœ“
- Schedule & games     âœ“
- Team data           âœ“
- Player stats        âœ“
- Awards              âœ“
- Recruiting board    âœ“
- Coach information   âœ“
- Historical rosters  âœ“
- Championships       âœ“
```

**Step 4: Success**
```
âœ“ Successfully imported Alabama 2026
Ready to view dynasty
[View Dynasty] [Import Another]
```

#### Enhanced Extraction Pipeline

**New Extraction Scripts**

1. **extract-coaches.ts** (NEW)
   - Parse Coach table from save
   - Extract head coach info
   - Get coordinators (OC/DC)
   - Parse contract details
   - Extract coaching history within save

2. **extract-rosters.ts** (NEW)
   - Build historical roster for current season
   - Map players â†’ player seasons with year data
   - Track player class progression
   - Identify recruited players vs. transfers

3. **extract-trophies.ts** (NEW)
   - Parse championship achievements
   - Extract bowl game history
   - Identify conference titles
   - Track playoff appearances
   - Calculate milestones

**Updated Extraction Flow**

```typescript
// extractors/extract-all.ts
async function extractAll(savePath: string) {
  const extractors = [
    { name: 'League', script: extractLeague },
    { name: 'Schedule', script: extractSchedule },
    { name: 'Teams', script: extractTeams },
    { name: 'Stats', script: extractStats },
    { name: 'Awards', script: extractAwards },
    { name: 'Recruiting', script: extractRecruiting },
    { name: 'Coaches', script: extractCoaches },        // NEW
    { name: 'Rosters', script: extractRosters },        // NEW
    { name: 'Trophies', script: extractTrophies },      // NEW
  ];
  
  const results: any = {};
  for (const extractor of extractors) {
    try {
      results[extractor.name.toLowerCase()] = 
        await extractor.script(savePath);
      // Emit progress event
      emitProgress(extractor.name, 'complete');
    } catch (err) {
      emitProgress(extractor.name, 'error', err.message);
      throw err;
    }
  }
  
  return results;
}
```

#### Component Architecture

**SaveFileBrowser Component**
```typescript
// components/import/SaveFileBrowser.tsx
interface SaveFile {
  path: string;
  name: string;
  season_year: number;
  team_name: string;
  team_logo: string;
  head_coach: string;
  last_modified: Date;
  preview?: {
    record?: string;
    ranking?: number;
  }
}

function SaveFileBrowser() {
  const [saves, setSaves] = useState<SaveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSave, setSelectedSave] = useState<SaveFile | null>(null);
  
  // Scan for saves on mount
  useEffect(() => {
    scanForSaves();
  }, []);
  
  async function scanForSaves() {
    setLoading(true);
    const found = await window.api.scanSaves();
    setSaves(found);
    setLoading(false);
  }
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={scanForSaves} disabled={loading}>
          {loading ? 'Scanning...' : 'Scan for Saves'}
        </button>
        <button onClick={() => browsePath()}>
          Browse Custom Path
        </button>
      </div>
      
      <div className="grid gap-2">
        {saves.map((save) => (
          <SaveCard
            key={save.path}
            save={save}
            selected={selectedSave?.path === save.path}
            onSelect={setSelectedSave}
          />
        ))}
      </div>
      
      {selectedSave && (
        <button
          onClick={() => importSave(selectedSave)}
          className="btn-primary"
        >
          Import {selectedSave.team_name}
        </button>
      )}
    </div>
  );
}
```

**SaveCard Component**
```typescript
// components/import/SaveCard.tsx
function SaveCard({ save, selected, onSelect }: SaveCardProps) {
  return (
    <div
      onClick={() => onSelect(save)}
      className={`
        p-4 border rounded-lg cursor-pointer transition
        ${selected ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'}
      `}
    >
      <div className="flex gap-4">
        <TeamLogo 
          team={{ assetName: save.team_name, label: save.team_name }}
          size="lg"
        />
        <div className="flex-1">
          <h3 className="font-bold">{save.team_name}</h3>
          <p className="text-sm text-gray-600">Season {save.season_year}</p>
          <p className="text-sm">Coach: {save.head_coach}</p>
          {save.preview?.record && (
            <p className="text-sm font-semibold">{save.preview.record}</p>
          )}
          <p className="text-xs text-gray-500">
            Modified: {formatDate(save.last_modified)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**ImportProgress Component**
```typescript
// components/import/ImportProgress.tsx
interface ExtractionStep {
  name: string;
  status: 'pending' | 'extracting' | 'complete' | 'error';
  error?: string;
  progress?: number;  // 0-100
}

function ImportProgress({ steps }: { steps: ExtractionStep[] }) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold">Extracting data...</h3>
      {steps.map((step) => (
        <div key={step.name} className="flex items-center gap-3">
          <div className="w-8">
            {step.status === 'complete' && <CheckIcon />}
            {step.status === 'extracting' && <SpinnerIcon />}
            {step.status === 'error' && <ErrorIcon />}
            {step.status === 'pending' && <PendingIcon />}
          </div>
          <span className="flex-1">{step.name}</span>
          {step.progress !== undefined && (
            <ProgressBar value={step.progress} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**ImportSuccess Component**
```typescript
// components/import/ImportSuccess.tsx
function ImportSuccess({ dynasty }: { dynasty: Dynasty }) {
  return (
    <div className="text-center space-y-4">
      <SuccessIcon className="w-16 h-16 mx-auto text-green-500" />
      <div>
        <h3 className="text-xl font-bold">Import Complete!</h3>
        <p className="text-gray-600">
          Successfully imported {dynasty.team_name} {dynasty.created_at.split('-')[0]}
        </p>
      </div>
      <div className="flex gap-2 justify-center">
        <Link to={`/dynasty/${dynasty.id}`} className="btn btn-primary">
          View Dynasty
        </Link>
        <button onClick={() => goBack()} className="btn btn-secondary">
          Import Another
        </button>
      </div>
    </div>
  );
}
```

#### Duplicate Detection

```typescript
// handlers/extractionHandlers.ts
async function checkDuplicateImport(savePath: string) {
  const saveNormalized = normalizePath(savePath);
  const existing = await db.dynasties.findBySavePath(saveNormalized);
  
  if (existing) {
    return {
      isDuplicate: true,
      existing: {
        id: existing.id,
        label: existing.label,
        lastExtracted: existing.updated_at
      },
      options: [
        'View existing',
        'Re-extract (refresh data)',
        'Create as new (archive first)',
        'Cancel'
      ]
    };
  }
  
  return { isDuplicate: false };
}
```

#### NCAA Logo Integration in Import

The SaveCard component automatically displays the NCAA logo for the team being imported, providing visual confirmation before starting the extraction.

### Deliverables Checklist
- âœ… Save file scanner (auto & custom paths)
- âœ… Save metadata preview system
- âœ… New extraction scripts (coaches, rosters, trophies)
- âœ… 9-step extraction pipeline (all data types)
- âœ… Progress tracking with real-time UI updates
- âœ… Error handling & recovery
- âœ… Duplicate detection with options
- âœ… NCAA logo integration in import flow
- âœ… Success confirmation screen
- âœ… IPC handlers for extraction

### Claude Prompt
Implement save file discovery and enhanced import UI. Create scanSaves() function to find DYNASTY files. Build extraction pipeline with coaches, rosters, and trophies extractors. Implement progress tracking with per-step status updates. Add NCAA logo display to save cards. Create duplicate detection with user options. Integrate all extractors into single import flow with error recovery.

---

## PHASE 3: Dashboard & Season Overview

### Objective
Display a dynasty's current season at a glance.

### Features

**Dynasty Dashboard**
- List all imported dynasties
- Quick stats (current year, team, record, ranking)
- Recent activity timeline
- Action buttons (view season, re-import, settings, delete)

**Season Overview**
- Year and team info
- Current record (W-L-T)
- Conference record
- Current ranking (AP, Coaches, CFP)
- Average opponent ranking
- Recruiting class rank
- Quick links to roster, schedule, awards

**Charts & Visualizations**
- Ranking history (line chart)
- Record by week (progress bar)
- Win/loss distribution

### Components
- **DynastiesCard**: Dynasty summary card
- **SeasonHeader**: Season title and quick stats
- **RecordTracker**: W-L-T display
- **RankingChart**: Ranking over time
- **QuickStats**: Key metrics tiles

### Claude Prompt
Build a dashboard displaying dynasty and season overviews. Show current record, ranking, recruiting class info, and charts tracking weekly progress. Include navigation to detailed views (roster, schedule, awards).

---

## PHASE 4: Roster Management

### Objective
View and track team roster with player details.

### Features

**Roster View**
- All players on current roster
- Columns: Name, Position, Class, Rating, Archetype, Development Trait
- Filters: Position, Class, Archetype
- Sort: By rating, name, position
- Search: Player name

**Player Profile**
- Photo (optional, pulled from game data)
- Position, Class, Height, Weight, Hometown
- Archetype and Development Trait
- Overall Rating and attribute breakdowns
- Career stats (if multi-season)
- Awards won

**Roster History**
- View rosters from previous seasons
- Track player progression across years

### Components
- **RosterTable**: Player list with filters/sorting
- **PlayerCard**: Player detail view
- **RatingBreakdown**: Attribute chart
- **ClassBreakdown**: Count by position/class

### Claude Prompt
Implement a roster viewer with player profiles, filtering, sorting, and search. Display player ratings, archetypes, development traits, and career progression. Include comparison tools for multi-year rosters.

---

## PHASE 5: Schedule & Results

### Objective
Track game-by-game season results.

### Features

**Schedule View**
- Week-by-week game matchups
- Columns: Week, Opponent, Location, Date, Rankings (User/Opponent), Result, Score
- Color coding: W (green), L (red), upcoming (gray)

**Game Details**
- Full game recap (if available)
- Team stats
- Player stats for the game
- Opponent info and ranking movement

**Season Summary**
- Overall record
- Conference record
- Win streak / loss streak
- Bowl eligibility status
- Postseason bowl appearance

### Components
- **ScheduleTable**: Week-by-week view
- **GameCard**: Individual game details
- **RecordSummary**: Overall stats
- **ConferenceStandings**: Conference ranking

### Claude Prompt
Build a schedule and results tracker. Display weekly games, outcomes, scores, and opponent rankings. Automatically calculate season records and statistics. Include game-by-game details and conference standings.

**Implementation status update (2026-07-16) — shipped**, including the originally-deferred standings slice. A new getStandings.ts query + IPC round-trip and Standings.tsx page/route/tab now surface real conference tables off the already-resolved TeamData.conferenceName plus each team's stored conference/non-conference record splits — no new extraction was needed. Sort order is intentionally honest rather than guessed: conference record first, then overall record, then current AP/Media rank; the save does not expose deeper tiebreak rules, so none are fabricated. See MASTER_ROADMAP_v2.md's Version History (v2.32) and the matching DevLog entry for full details.

---

## PHASE 6: Statistics Engine

### Objective
Aggregate and display game and season statistics.

### Features

**Player Statistics**
- Career stats (across all seasons)
- Season stats (passing, rushing, receiving, defense, special teams)
- Game logs (stats per game)
- Stat leaders by category

**Team Statistics**
- Offensive/defensive efficiency
- Scoring trends
- Yards allowed trends
- Season-over-season comparison

**Charts**
- Passing yards by week
- Rushing yards by week
- Opponent points allowed by week

**Stat Categories**
- Passing: Completions, Attempts, Yards, TDs, INTs, Rating
- Rushing: Attempts, Yards, Avg, TDs, Long
- Receiving: Receptions, Yards, Avg, TDs, Long
- Defense: Tackles, TFL, Sacks, Ints, FF
- Special Teams: FG%, PAT%, Punting Avg, Return Yards

### Components
- **StatLeaders**: Top 10 in each category
- **GameLog**: Per-game stats table
- **SeasonTrend**: Line charts by week
- **ComparisonView**: Multi-season stats

### Claude Prompt
Build a statistics engine that aggregates player and team stats from extracted game data. Display stat leaders, game logs, season trends, and year-over-year comparisons with interactive charts.

---

## PHASE 7: Rankings & Visualizations

### Objective
Track ranking movement throughout the season.

### Features

**Weekly Rankings**
- AP Poll position by week
- Coaches Poll position by week
- CFP Rankings (if applicable)
- User's custom ranking

**Ranking Charts**
- Ranking trajectory (line chart week-by-week)
- Highest ranking achieved
- Average ranking for season
- Ranking vs. record correlation

**Tournament Seeding**
- Playoff seed (if applicable)
- Bowl assignment
- Postseason ranking

### Components
- **RankingTracker**: Weekly AP/Coaches/CFP
- **RankingChart**: Historical trend
- **SeedingInfo**: Playoff/bowl details

### Claude Prompt
Implement ranking tracking and visualization. Display AP, Coaches, and CFP rankings by week. Create line charts showing ranking trajectory and correlation with win/loss record.

**Implementation status update (2026-07-16) â€” shipped**, with one deliberate scope adjustment: the save file only ever stores 3 fixed poll data points per team (never a per-week history array â€” confirmed directly), so "by week" is built by this app accumulating one snapshot per import rather than parsed whole from a single save; a dynasty needs to be re-imported across a season to build a full trajectory. Tournament Seeding was not duplicated as its own UI â€” that's already covered by the earlier Team Trophies work (`getTrophies.ts`). See `MASTER_ROADMAP_v2.md`'s Version History (v2.26) and the Phase 7 entry in `DevLog.md` for full details.

---

## PHASE 8: Awards & Achievements

### Objective
Track player and team awards.

### Features

**Award Categories**
- Heisman Trophy
- National Awards (POTY, Freshman of Year, etc.)
- Conference Awards (All-Conference, Conference POTY)
- Weekly Awards (Player of Week)
- All-American (Preseason, Regular, AP)
- Custom Awards

**Award Tracking**
- Award history by year
- Player award count
- Team award count
- Award winners gallery

### Components
- **AwardsList**: All awards won this season
- **PlayerAwards**: Specific player's awards
- **AwardHistory**: Historical awards table
- **HeismanTracker**: Heisman candidates

### Claude Prompt
Build award management system. Track national, conference, and weekly awards. Display award winners, create historical award records, and show award progression across seasons.

**Implementation status update (2026-07-16) â€” shipped**
- Covered: Heisman, national/position awards (POTY, Freshman POTY, all 20 `BEST_*` position awards, coach awards), All-Conference/All-American tiers, weekly Player-of-the-Week honors. `AwardsList`-equivalent (league-wide marquee grid) and `PlayerAwards`-equivalent (per-player honors on `PlayerDetail.tsx`) both shipped, plus a per-team grouped view not originally scoped.
- Deferred, not built: "Custom Awards" (no such concept in the save data), multi-season award history/progression view (works implicitly via the existing season selector once a dynasty is re-imported across years, but no dedicated history table), and a `HeismanTracker`-style in-season candidate/watchlist view (the save's `Awards`/`HeismanAwardRanking` nominee tables were found and confirmed real during investigation, but building a live Top-5 tracker wasn't asked for â€” flagged as a real, buildable follow-up if wanted).
- Full details in `DevLog.md`.

---

## PHASE 9: Recruiting Pipeline

### Objective
Track recruiting classes and prospect management.

### Features

**Recruiting Board**
- Prospects tracked
- Recruited (offered)
- Top 5 (favorites)
- Committed
- Signed
- Lost recruits

**Recruit Profiles**
- Name, Position, Star Rating
- National Rank, Position Rank
- State Rank
- Pipeline (HS location)
- Archetype
- Commitment status

**Class Rankings**
- National recruiting rank
- Average star rating
- Position breakdown
- Top recruits in class
- Class comparison to previous years

**Recruiting Timeline**
- Week-by-week recruiting updates
- Commitment tracking
- Decommit tracking

### Components
- **RecruitBoard**: Kanban-style board (Watching â†’ Offered â†’ Top 5 â†’ Committed â†’ Signed)
- **RecruitCard**: Individual recruit details
- **ClassRanking**: Overall class metrics
- **Timeline**: Recruiting activity feed

### Claude Prompt
Implement a recruiting management system with a Kanban board for prospect tracking, recruit profiles, class rankings, and historical recruiting data. Support multi-year class comparison.

**Implementation status update (2026-07-16) â€” shipped**, with two deliberate scope adjustments: no drag-and-drop Kanban (a static 5-section layout instead â€” the data isn't user-editable from this app, and "Lost" is a real 6th-ish case the original stage list didn't name), and no multi-year class comparison or decommit tracking (neither is derivable from a single save snapshot â€” same class of limitation as Phase 7's ranking history). **Same-day follow-up:** the initial Signed/Lost classification was wrong (used a field that doesn't mean what it was assumed to mean) â€” found while adding a requested team-logo feature, fixed, and re-verified. See `MASTER_ROADMAP_v2.md`'s Version History (v2.29, v2.30) and the two Phase 9 entries in `DevLog.md` for full details.

---

## PHASE 10: Program History & Records

### Objective
Create long-term dynasty records across multiple seasons.

### Features

**Program Record Book**
- All-time passing yards
- All-time rushing yards
- All-time receiving yards
- All-time touchdowns
- All-time tackles
- All-time sacks
- Single-season records

**Historical Records**
- Conference championships (years won)
- National championships
- Playoff appearances
- Bowl appearances by type
- Coaching records

**Legends Gallery**
- Top 10 all-time players
- Retired numbers
- Hall of Fame inductees
- Notable achievements

**Milestones**
- 500th win
- 10-win seasons
- Undefeated seasons
- Conference title runs

### Components
- **RecordBook**: All-time statistical leaders
- **ChampionshipList**: Historical championships
- **LegendsGallery**: Hall of fame players
- **MilestoneTimeline**: Program achievements

### Claude Prompt
Build a program history system tracking all-time records, single-season records, championships, playoff/bowl appearances, and legendary players across multiple seasons in a dynasty.

**Implementation status update (2026-07-16) - first slice shipped**, focused on the parts already supportable from real persisted snapshots rather than the still-unused normalized `championships` / `program_milestones` tables in `schema.sql`. A new `getHistory.ts` query plus IPC round-trip and `History.tsx` page/route/tab now surface a multi-season program-history view built from imported seasons only: season timeline, program resume metrics, coaching ledger, milestones, and a real record book. The all-time/single-season statistical leaders deliberately aggregate from per-game `gamelog` snapshots across imported seasons instead of trusting the save's `SeasonStats` slot layout for multi-year dynasties, because that slot mapping is still explicitly unverified once a dynasty spans multiple seasons. Same deliberate scope trim for now: no Legends Gallery / retired numbers / hall of fame layer yet, and no fabricated "all-time" claims beyond the seasons actually imported into this app. Verification: `npm.cmd run typecheck` and `npm.cmd run lint` passed; `npm.cmd run build` still hit the ongoing `public/assets/playerportrait` `ENOENT` race already documented elsewhere, so build failure was treated as an environment/asset-mutation issue rather than a Program History regression. See `DevLog.md` and Version History `v2.33` for full details.

---

**Implementation status update (2026-07-16) - first slice shipped**, focused on the single-file self-contained HTML branch of this phase rather than the full multi-page/zip/interactive-chart system below. A new `htmlExport.ts` renders the already-shipped Program History data (record book, dynasty resume, coaching ledger, timeline, milestones) into one offline `.html` file with inline CSS and dark-mode support, triggered from a new `Exports.tsx` page via a native save dialog. Deliberately not shipped yet: roster/schedule/awards exports, `.zip` archives, team logos/images in the export, interactive charts, and the `ExportDialog`/`ExportPreview`/`ExportProgress` component system described below. Verification: `npm run typecheck`, `npm run lint`, `npm run build` all clean; real diagnostic export against `DYNASTY-DYNASTYBOWL` confirmed correct save-backed content. Full details in `DevLog.md` and Version History `v2.39`.

## PHASE 11: HTML Export

### Objective
Export dynasty data as shareable static HTML.

### Features

**Export Options**
- Full dynasty (all seasons)
- Single season
- Specific sections (roster, schedule, awards, stats)

**HTML Pages Generated**
- Dynasty overview
- Season-by-season summaries
- Detailed season pages (roster, schedule, stats, awards)
- Player profiles (career stats, achievements)
- Program history (records, championships)
- Interactive charts (rankings, performance trends)

**Export Format**
- Single `.html` file (self-contained)
- `.zip` archive (multiple HTML pages + assets)

**Styling**
- Professional, responsive design
- Dark mode support
- Team colors (optional)
- Print-friendly

**Sharing**
- Export to Downloads folder
- Copy to clipboard (HTML)
- Integration with future web hosting (Phase 13)

### Components
- **ExportDialog**: Select what to export
- **ExportPreview**: Preview generated HTML
- **ExportProgress**: Show generation status
- **ShareLinks**: Post-export options

### Claude Prompt
Build an HTML export system that generates professional, responsive static pages from dynasty data. Support single-file export, multi-page archives, interactive charts, and offline viewing. Include styling with team colors and dark mode.

---

## PHASE 12: Auto-Discovery & Batch Import

### Objective
Streamline importing multiple save files.

### Features

**Auto-Discovery**
- Scan game folder on app startup
- Detect new saves automatically
- Show notification for new saves found

**Batch Import**
- Select multiple saves at once
- Import queue with progress
- Handle errors per save (don't fail all if one errors)

**Save Monitoring**
- Optional: Watch for changes to save files
- Auto-update if dynasty is being actively played
- Prompt user before re-importing

**Save Organization**
- Group by team
- Sort by date modified
- Search saves

### Components
- **SaveDiscovery**: Auto-find saves on startup
- **BatchImportDialog**: Multi-select and import
- **ImportQueue**: Show progress for multiple imports
- **SaveManager**: Organize and manage imported saves

### Claude Prompt
Implement automatic save file discovery on startup, batch import of multiple saves, error handling per save, and optional auto-update when watching an active dynasty save file.

---

## PHASE 13: Media & Storytelling (Optional)

### Objective
Turn dynasty data into narrative content (manual-first, AI-enhanced).

### Features

**Article Types**
- Game Recaps (manual writing, AI draft option)
- Season Reviews (summary of year)
- Recruiting Updates (pipeline progress)
- Coach Notes (diary entries)

**Media Center**
- Article archive
- Search and filter
- Public/private visibility

**AI Enhancement (Optional)**
- Generate recap drafts from game data
- Suggest talking points from stats
- Editor-driven workflow (draft â†’ edit â†’ publish)

### Components
- **ArticleEditor**: Rich text editor with data embeds
- **TemplateGallery**: Pre-built article templates
- **MediaCenter**: Article archive and search
- **AIAssistant**: Optional prompt for AI drafts

### Claude Prompt
Build a media system for writing and publishing dynasty content. Include article templates, rich text editing, optional AI-assisted drafting, and public/private visibility controls.

---

## PHASE 14: Public Dynasty Pages (Future)

### Objective
Optionally host dynasty pages on the web for public viewing.

### Features

**Public Pages** (powered by exported HTML or Supabase)
- Dynasty overview
- Season histories
- Player profiles
- Records and achievements
- Share links

**Social Integration**
- Shareable links
- Embed stats
- Open Graph meta tags

**Authentication** (optional)
- User accounts for dynasty management
- Dynasty access controls

### Technology
- Static HTML export (free option)
- Optional Supabase + Vercel hosting (future tier)

### Claude Prompt
Build public-facing dynasty pages with shareable links. Support static HTML export and optional Supabase hosting. Include SEO optimization and social sharing.

---

## PHASE 15: Cloud Sync (Optional Future)

### Objective
Optional cloud backup and multi-device sync.

### Features

**Cloud Backup**
- One-click backup to Supabase
- Automatic periodic backups
- Restore from backup

**Multi-Device Sync**
- Play on PC, sync to cloud
- Access dynasty on web
- Portable dynasty archive

**Account Management**
- User accounts (Supabase Auth)
- Backup storage

### Technology
```
Supabase (auth, storage, database)
Simple account linking to local SQLite
```

### Claude Prompt
Implement optional cloud sync using Supabase for backup and multi-device access. Include one-click backup, restore, and browser-based viewing of dynasties.

---

## PHASE 16: Analytics & Deep Dives (Future)

### Objective
Advanced analytics for serious dynasty trackers.

### Features

**Player Development Tracking**
- Rating changes season-over-season
- Potential vs. actual development
- Peak performance years

**Recruiting ROI**
- Compare recruit stars to performance
- Identify recruiting strengths (position/region)
- Historical recruiting trends

**Schedule Difficulty**
- Strength of schedule (SOS)
- Average opponent ranking
- Win % vs. ranked opponents

**Advanced Stats**
- Player performance vs. opponent ranking
- Home/away splits
- Conference vs. non-conference

### Components
- **DevelopmentChart**: Player rating progression
- **RecruitingAnalytics**: Recruit-to-performance correlation
- **ScheduleStrength**: SOS metrics
- **AdvancedStats**: Splits and comparisons

### Claude Prompt
Build advanced analytics dashboard with player development tracking, recruiting ROI analysis, schedule strength metrics, and performance comparisons.

---

# Development Timeline Estimate

| Phase | Scope | Timeline |
|-------|-------|----------|
| 0 | Electron setup | 1-2 weeks |
| 1 | Database schema | 1 week |
| 2 | Save import UI | 2 weeks |
| 3 | Dashboard | 2 weeks |
| 4 | Roster view | 1-2 weeks |
| 5 | Schedule/results | 1-2 weeks |
| 6 | Statistics | 2 weeks |
| 7 | Rankings | 1 week |
| 8 | Awards | 1 week |
| 9 | Recruiting | 2 weeks |
| 10 | Program history | 2 weeks |
| 11 | HTML export | 2 weeks |
| 12 | Batch import | 1-2 weeks |
| **MVP (0-12)** | **Full desktop app with export** | **~3-4 months** |
| 13 | Media & storytelling | 2-3 weeks |
| 14 | Public pages | 2-3 weeks |
| 15 | Cloud sync | 3-4 weeks |
| 16 | Advanced analytics | 2-3 weeks |

---

# MVP Definition

**Minimum Viable Product (Phases 0-11):**

A desktop Electron app that:
- âœ… Discovers EA Sports CFB 27 save files on user's PC
- âœ… Imports a season in seconds
- âœ… Stores data locally in SQLite
- âœ… Displays dynasty dashboard, roster, schedule, stats, awards
- âœ… Exports dynasty as shareable HTML
- âœ… Works entirely offline

**No MVP Features:**
- âŒ Web hosting / public pages (Phase 14)
- âŒ Cloud accounts (Phase 15)
- âŒ AI article generation (Phase 13 optional)

---

# Architecture Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Electron App (Desktop)                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  React UI (components, pages, dashboard)         â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  IPC Bridge (main <-> renderer)                  â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  Database Layer (SQLite via sql.js)              â”‚   â”‚
â”‚  â”‚  - dynasties, seasons, players, games, awards    â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  Extraction Pipeline                             â”‚   â”‚
â”‚  â”‚  - madden-franchise library                      â”‚   â”‚
â”‚  â”‚  - extract-league, schedule, teams, stats, etc.  â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  Export Engine                                   â”‚   â”‚
â”‚  â”‚  - HTML generation                              â”‚   â”‚
â”‚  â”‚  - Static file output                           â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â†“
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  Local Filesystem â”‚
    â”‚  - Dynasty saves  â”‚
    â”‚  - SQLite DB      â”‚
    â”‚  - Export HTML    â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â†“
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  Optional Future  â”‚
    â”‚  - Supabase (sync)â”‚
    â”‚  - Vercel (host)  â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

# Comparison to v1.0 Roadmap

| Aspect | v1.0 (Web) | v2.0 (Desktop) |
|--------|-------------|-----------------|
| **Platform** | Next.js web app | Electron desktop |
| **Database** | Supabase cloud | SQLite local |
| **Data Entry** | 100% manual forms | 80% auto from game |
| **Backend** | Required | Not required |
| **Offline** | No | Yes |
| **MVP Timeline** | 6+ months | 3-4 months |
| **Infrastructure Cost** | Hosting fees | Free |
| **Scalability** | Web-first | Desktop-first, web-later |
| **Initial Users** | Web browsers | PC players |
| **Public Sharing** | Web pages (built-in) | HTML export + optional web |

---

# Success Metrics

- âœ… Can import a real DYNASTY save in under 5 seconds
- âœ… Display complete roster, schedule, stats, awards from imported data
- âœ… Export HTML dynasty pages that work offline in browser
- âœ… Zero crashes on large save files (10MB+)
- âœ… Users can manage multiple dynasties simultaneously
- âœ… All data remains local until user chooses to export/share

---

# Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Save file format changes in future CFB games | Modular extraction library; update per-game-release |
| User loses local database | Auto-backup to .bak file; export feature preserves HTML |
| Large save files slow extraction | Async extraction; progress indication; caching |
| Electron distribution/updates | Auto-update system configured in Phase 0 |
| SQLite performance with large dynasties | Proper indexing; consider migration to better DB later if needed |

---

# Next Immediate Steps

1. **Verify DYNASTY-TESTER extraction** with existing CFB Offline tool
2. **Spec out Phase 0** (Electron + React setup)
3. **Finalize UI design** (mockups/Figma)
4. **Estimate team capacity** and prioritize phases
5. **Lock Phase 1 database schema** before coding begins

---

# Revised MVP Definition (Phases 0-5)

**Minimum Viable Product** ships after Phase 5 (~12-14 weeks):

A desktop Electron app that:
- âœ… Discovers EA Sports CFB 27 save files on user's PC
- âœ… Imports seasons in seconds with NCAA logos
- âœ… Extracts comprehensive data:
  - League & season metadata
  - Complete roster with player ratings
  - Game schedule & results
  - Player game statistics
  - Awards & achievements
  - Coaching staff information
  - Historical roster tracking
  - Championship & bowl history
  - Recruiting board & class info
- âœ… Stores all data locally in SQLite
- âœ… Displays polished dashboard with:
  - Dynasty overview (team, coach, record, ranking)
  - Current season roster with filters/search
  - Game schedule with results
  - Player statistics & leaders
  - Awards & achievements
  - Coach information
- âœ… Works completely offline
- âœ… Exports to shareable HTML

**Features NOT in MVP:**
- âŒ Web hosting / public pages (Phase 14+)
- âŒ Cloud accounts / backup (Phase 15+)
- âŒ AI article generation (Phase 13+)
- âŒ Advanced analytics (Phase 16+)
- âŒ Game logo extraction (researched parallel)

---

# Development Timeline (Revised)

| Phase | Focus | Timeline | Notes |
|-------|-------|----------|-------|
| **0** | Electron + React + DB setup | 1-2 weeks | Foundation only |
| **1** | Database schema + DAL | 1 week | All tables pre-designed |
| **2** | Save discovery + extraction | 2 weeks | 9 extractors, NCAA logos |
| **3** | Dashboard UI | 2 weeks | Overview, quick stats |
| **4** | Roster viewing | 1-2 weeks | Table, filters, search |
| **5** | Schedule & results | 1-2 weeks | Week-by-week view |
| **MVP Checkpoint** | **All core features working** | **~8-10 weeks** | **Ship ready** |
| 6 | Statistics engine | 2 weeks | Leaders, trends, charts |
| 7 | Rankings visualization | 1 week | AP/Coaches/CFP tracking |
| 8 | Awards display | 1 week | Historical awards |
| 9 | Recruiting pipeline | 2 weeks | Board, class tracking |
| 10 | Program history | 2 weeks | Records, championships |
| 11 | HTML export | 2 weeks | Beautiful shareable pages |
| **Post-MVP** | **Extended features** | **+4-6 weeks** | **Premium polish** |
| 12 | Batch import | 1-2 weeks | Multiple saves at once |
| 13-16 | Media, community, cloud, analytics | TBD | Future phases |

**Total MVP: 8-10 weeks**  
**Full Phase 12: ~12-14 weeks**

---

# Parallel Workstreams

While primary development proceeds on Phases 0-5, assign research to explore:

**Game Logo Extraction** (Medium priority)
- Research CFB 27 asset structure
- Check madden-franchise capabilities
- Explore modding community
- Prototype extraction approach
- Document fallback strategy
- Timeline: 2-3 weeks parallel investigation

**UI/UX Overhaul Initiative â€” Phases A-K** (High priority, independent track)

Added 2026-07-16, after Phase 5. This is a full design-system and interaction overhaul, **not blocked by and not blocking** the numbered Phase 6+ track (Statistics, Rankings, Awards, Recruiting) â€” those are paused on save data richness (see Phase 6 notes); this track is architecture/UI work that can proceed the moment work resumes, in parallel with or ahead of Phase 6.

Lettered (not numbered) deliberately, so it never collides with the data/feature phase numbering above. Ordered so nothing gets visually built twice â€” each phase consumes the one(s) before it; nothing downstream gets restyled a second time once the foundation lands.

**Data-availability caveats (Phase H shipped 2026-07-16 â€” both resolved, kept for history):**
- Team captains: real and populated on the richer save (12 leaguewide); still shows an honest empty state for any team with none assigned (e.g. Texas State itself).
- Coach alma mater: turned out to be a plain `TeamIndex` integer, not a franchise reference â€” a one-line map lookup against the teams snapshot, not the lookup-table build this note anticipated.

### Phase A â€” Design tokens (static values)
Spacing scale, border-radius scale, shadow scale, typography scale, and motion duration/easing values, all as one central token file (`src/design/defaultTokens.ts`), consumed via CSS custom properties â€” the same mechanism `src/renderer/lib/teamTheme.ts` already proved out for team colors. Foundational: nothing below can be built correctly without this existing first.

### Phase B â€” Theme resolution (dynamic/color tokens)
Generalizes `teamTheme.ts` into the full **Custom â†’ Team â†’ Default** priority chain, plus persistence. Split from Phase A because it's stateful (depends on active dynasty + user choice) where Phase A is static. Must exist before the Preferences menu (Phase G) has anything to control.

### Phase C â€” Motion primitives
Framer Motion (new dependency) plus reusable wrappers â€” page transition, fade-in, collapse/expand â€” built against Phase A's duration/easing tokens. Comes before the component library so Modal/Dropdown/Tabs get their motion built in from the start rather than bolted on after the fact.

### Phase D â€” Shared UI component library
`src/renderer/components/ui/`: Button, Card, Input, Modal, Dropdown, Tabs, Table, EmptyState, LoadingState. The actual mechanism that fixes the "generic desktop utility" feel â€” right now every page hand-rolls its own table/dropdown/card markup independently. Built on Phases Aâ€“C. Highest-leverage step for avoiding redundant, drifting per-page styles.

**Implementation status update (2026-07-15) â€” consolidation pass**
- Context: Phases E/F/G shipped the premium glass look before this library existed, so every page had copy-pasted the same markup. User confirmed keeping the glass direction and asked to remove the redundancy; this starts the `ui/` library as a pure, no-visual-change extraction.
- Files created: `src/renderer/components/ui/SurfaceCard.tsx`, `src/renderer/components/ui/StatTile.tsx`, `src/renderer/components/ui/angledClip.ts`.
- Files adjusted: `Dashboard.tsx`, `DynastySetup.tsx`, `DynastyOverview.tsx`, `Roster.tsx`, `Schedule.tsx`, `PlayerDetail.tsx`, `GameDetail.tsx`, `app.tsx`.
- Redundancies removed:
  - `SurfaceCard` glass surface â€” was duplicated across 6 sites (5 identical `function SurfaceCard` defs + 1 inline `<section>` in DynastySetup) â†’ 1 shared component.
  - Label-above metric tile â€” was 3 identical copies (`StatTile` Ã—2, `SummaryTile` Ã—1) â†’ 1 shared `StatTile`.
  - `ANGLED_PANEL` clip-path polygon formula â€” was duplicated inline in `app.tsx` and `Dashboard.tsx` â†’ shared `angledClip(inset)` helper, each caller keeps its own inset (1.25rem shell / 1.1rem cards).
- Bug fixed: a corrupted `0xB7` byte (invalid UTF-8, shown as `ï¿½`) in `Roster.tsx`'s player card separator â†’ `|`, matching the GameDetail/PlayerDetail convention.
- Left local on purpose: PlayerDetail's centered value-above stat tile and Dashboard's angular summary tile (distinct shapes, not duplicated).
- Deferred: generic Table/Dropdown/Button primitives (need a design pass, not a mechanical extract) and wiring the glass radii/shadows to Phase A tokens (needs the token scale extended with larger surface radii).
- Verification: `npm run typecheck`, `npm run lint`, `npm run build` all clean; grep-confirmed the glass class string now resolves to a single source location and the clip-path formula is gone from pages â€” a byte-identical extraction, so rendered output is unchanged.

### Phase E - App shell restructure
Centered/max-width container, navigation, page-transition wiring at the router level. Built on Phase D. Sequenced before the page sweep (Phase F) so pages migrate straight into their final container.

**Implementation status update (2026-07-15)**
- First shell-overhaul pass is now shipped with the premium shell, refined navigation, and theme controls now live in the app.
- Files adjusted:
  - `src/renderer/app.tsx`
  - `src/renderer/styles/globals.css`
  - `src/renderer/components/common/Navbar.tsx`
  - `src/renderer/components/common/Sidebar.tsx`
  - `src/renderer/components/common/PreferencesMenu.tsx`
- Work completed:
  - Wrapped the app in a centered premium frame with layered gradients, glass surfaces, and a max-width desktop shell.
  - Rebuilt the navbar into a higher-polish command bar with stronger brand framing and clearer preference controls.
  - Reworked the sidebar into a richer navigation rail with a user-facing workspace summary card and better hierarchy for current vs. upcoming surfaces.
  - Restyled the Preferences panel to feel more like a product surface than a utility dropdown while preserving the Phase G persistence logic already shipped.
- Safety / rollback step completed before implementation:
  - Backups created at `.backup/uiux-overhaul-20260715-122155/` for the shell files and roadmap before the overhaul pass began.
- Errors / gaps discovered during implementation:
  - The live app had theme logic and preferences state, but the surrounding shell still read as a straightforward utility layout, which undercut the intended premium product identity.
  - The first Preferences implementation was functionally correct but visually too plain relative to the new visual system.
  - A real post-redesign validation issue surfaced: `PreferencesMenu.tsx` still imported the `Appearance` type after the segmented-control refactor, which failed `typecheck` / `build` under the repo's strict unused-import rules.
- Fixes applied:
  - Moved the overhaul to the shell layer first so the entire app benefits immediately without blocking on a page-by-page migration.
  - Upgraded the Preferences surface styling while keeping its existing validated theme behavior and persistence model intact.
  - Removed the stale `Appearance` import and re-ran validation until all checks passed cleanly.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`

### Phase F - Migrate existing pages
Dashboard, Season Overview, Roster, Schedule, PlayerDetail swept in one deliberate pass onto Phase D's components inside Phase E's shell. This is where the visual payoff of A-E actually lands.

**Implementation status update (2026-07-15)**
- Phase F page migration is now shipped across the current app surface.
- Files adjusted:
  - `src/renderer/components/common/Navbar.tsx`
  - `src/renderer/components/common/Sidebar.tsx`
  - `src/renderer/components/common/PreferencesMenu.tsx`
  - `src/renderer/components/common/DynastyLayout.tsx`
  - `src/renderer/pages/Dashboard.tsx`
  - `src/renderer/pages/DynastySetup.tsx`
  - `src/renderer/pages/DynastyOverview.tsx`
  - `src/renderer/pages/Roster.tsx`
  - `src/renderer/pages/Schedule.tsx`
  - `src/renderer/pages/PlayerDetail.tsx`
  - `src/renderer/pages/GameDetail.tsx`
- Work completed:
  - Removed user-facing references to the internal visual direction from the live shell and preferences copy.
  - Brought dashboard, import, overview, roster, schedule, player detail, and game detail into the same premium card, spacing, and hierarchy system.
  - Updated dynasty sub-navigation so overview, roster, and schedule feel like part of the same workspace instead of separate legacy pages.
  - Cleaned text-surface encoding issues encountered during the sweep while modernizing page copy.
- Safety / rollback step completed before implementation:
  - Backups created at `.backup/uiux-pages-20260715-123000/` for the pages, shared chrome, and roadmap before the full page sweep began.
- Errors / gaps discovered during implementation:
  - The first shell pass left the app in a mixed state where the shared chrome looked premium but major route pages still read like the older utility UI.
  - Internal-only visual-direction language was still exposed in navbar, sidebar, and preferences surfaces after the shell overhaul.
  - A follow-up lint issue surfaced during the schedule rewrite because JSX text contained an unescaped apostrophe.
- Fixes applied:
  - Swept the major route pages in one pass so the visual system now reads consistently across navigation, cards, tables, and detail screens.
  - Replaced internal design-language callouts with neutral user-facing product copy while preserving the underlying visual direction in roadmap documentation.
  - Corrected the schedule note text and re-ran validation until typecheck, lint, and build all passed.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`


### Phase G - Preferences & Theme menu
Team / Default / Custom mode picker, built on Phase D's primitives, wired to Phase B's resolution logic. Contrast guardrails reuse the `ensureContrastText()` algorithm already built and verified for team colors â€” same validation, now applied to user-picked colors too.

**Implementation status update (2026-07-15)**
- Initial Phase G slice is now shipped in the live app shell. `src/renderer/components/common/PreferencesMenu.tsx` adds a navbar-accessible preferences panel with:
  - Light / Dark appearance switching
  - Team / Default / Custom color-mode selection
  - Custom primary + secondary color editing through both hex inputs and native color pickers
  - Live preview cards for the active theme and the draft custom palette
  - Apply + reset actions wired directly to the persisted Phase B `ThemeProvider` state
- `src/renderer/components/common/Navbar.tsx` now hosts both the quick dark-mode toggle and the full Preferences entrypoint, so the common one-click toggle stays fast while deeper customization lives one click away.
- Errors / gaps discovered during implementation:
  - Phase B's persistence and resolution logic already existed, but there was no user-facing control surface for it, leaving the feature effectively hidden.
  - Custom theme editing needed runtime guardrails so malformed hex input could not become the active stored palette.
- Fixes applied:
  - Built the missing Preferences UI on top of the existing `useTheme()` API instead of adding duplicate theme state.
  - Added `#RRGGBB` validation, normalization, safe preview fallback behavior, and disabled the apply action until both custom colors are valid.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`

**Readability follow-up (2026-07-15)**
- User feedback from the live shell showed that the transparent Preferences surface allowed too much of the page beneath it to compete with controls and copy, especially over roster and schedule data tables.
- Files adjusted:
  - `src/renderer/components/common/PreferencesMenu.tsx`
- Fixes applied:
  - Added a local underlay directly beneath the Preferences panel footprint so only the covered area receives stronger tinting, saturation control, and blur.
  - Increased the opacity of the panel shell and its internal cards so options stay legible without flattening the glass effect.
  - Kept the treatment scoped to the menu bounds instead of dimming the entire screen, matching the intended liquid-glass reference more closely.
- Safety / rollback step completed before implementation:
  - Backups created at `.backup/preferences-clarity-20260715-124756/` for the Preferences component and roadmap before the readability pass began.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`

**Angular shell follow-up (2026-07-15)**
- Reference direction for this pass came from `References/`, specifically the clipped corners, angular bands, bold crest treatment, and team-color-forward accents in the Bama Tech mockups.
- Files adjusted:
  - `src/renderer/app.tsx`
  - `src/renderer/styles/globals.css`
  - `src/renderer/components/common/Navbar.tsx`
  - `src/renderer/components/common/Sidebar.tsx`
  - `src/renderer/components/common/DynastyLayout.tsx`
  - `src/renderer/pages/Dashboard.tsx`
  - `src/shared/types.ts`
  - `src/main/ipc/database.ts`
- Errors / gaps discovered during implementation:
  - The live shell still leaned heavily on rounded glass styling, which conflicted with the sharper reference direction requested for this pass.
  - Native select dropdown options in dark mode were difficult to read because their popup text/background styling did not stay aligned with the app theme.
  - Dashboard cards exposed theme-related filler content instead of player-relevant season context like current wins and losses.
- Fixes applied:
  - Removed rounded corners globally in the renderer, shifted the shell/background treatment toward fixed angular planes, and kept the backdrop visually anchored while UI surfaces float above it.
  - Removed the sidebar workspace hero, removed the extra workspace label from the navbar/dynasty shell, and kept navigation focused on the actual app surfaces.
  - Added themed native select option styling for dark mode so dropdown text remains readable across roster and schedule filters.
  - Extended dynasty summary payloads with current W/L record data and rebuilt dashboard cards around school name, large transparent logos, season year, and record instead of theme messaging.
- Safety / rollback step completed before implementation:
  - Backups created at `.backup/angular-global-pass-20260715-125957/` for the shell, dashboard, shared summary types, IPC mapping, and roadmap before the angular pass began.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`

**Dashboard / Preferences refinement follow-up (2026-07-15)**
- Files adjusted:
  - `src/renderer/components/common/PreferencesMenu.tsx`
  - `src/renderer/pages/Dashboard.tsx`
  - `src/renderer/pages/DynastyOverview.tsx`
  - `src/renderer/lib/teamTheme.ts`
- Errors / gaps discovered during implementation:
  - The localized glass treatment in Preferences had become too subtle again, so dense page content underneath was competing with controls and copy.
  - Dashboard dynasty cards still carried extra chrome (left stroke, W/L box, status box) that pulled focus away from the team identity treatment.
  - The overview header still framed the logo inside its own card, which no longer matched the current direction.
  - Validation surfaced a real regression: the new dashboard gradient overlay needed a reusable `--team-primary-rgb` token, but `TeamColorVars` did not yet expose that property.
- Fixes applied:
  - Re-strengthened the Preferences underlay with a denser blur, tint, and brightness stack scoped only to the panel footprint so the glass feel stays readable without dimming the whole screen.
  - Removed the extra overview logo frame so the mark sits directly in the hero.
  - Simplified dashboard dynasty cards to a full-cell team-primary glass gradient with oversized logos and only the team/season copy retained.
  - Extended `buildTeamColorVars()` / `TeamColorVars` with `--team-primary-rgb` so renderer surfaces can build typed team-color gradients without ad hoc parsing.
- Safety / rollback step completed before implementation:
  - Backups created at `.backup/dashboard-preferences-tune-20260715-131544/` for the affected renderer files and roadmap before the refinement pass began.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`


**Preferences dark-mode sync follow-up (2026-07-15)**
- Files adjusted:
  - `src/renderer/components/common/PreferencesMenu.tsx`
- Errors / gaps discovered during implementation:
  - User testing showed the shell was in dark mode while the Preferences panel could still render with its light-surface treatment, leaving the menu visually out of sync with the active appearance.
- Fixes applied:
  - Bound a local `.dark` ancestor on the Preferences overlay directly to the shared `appearance` state so every nested `dark:` variant inside the panel tracks the toggle deterministically.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`


**Preferences dark-surface refinement follow-up (2026-07-15)**
- Files adjusted:
  - `src/renderer/components/common/PreferencesMenu.tsx`
- Errors / gaps discovered during implementation:
  - After the appearance-state sync fix, the Preferences panel was still reading too light in dark mode because its shell, section cards, and option rows were using translucent values that visually washed out against the blurred backdrop.
- Fixes applied:
  - Replaced the main Preferences surface stack with explicitly darker dark-mode shell, underlay, gradient, section, rail, and option-row values instead of relying on lighter translucent carryover.
  - Moved the key panel controls onto direct `isDark` class branches so the dark-mode material treatment is deterministic and visually heavier throughout the menu.
- Verification completed:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run build`

### Phase H â€” Coach alma mater + captains/skill players
Extraction (resolve the alma mater reference; re-verify captain data once a richer save is available) plus UI, built on the finished design system so it's styled correctly the first time. See data-availability caveats above.

**Implementation status update (2026-07-16) â€” shipped**
- Alma mater turned out not to need a franchise reference resolution at all â€” `Coach.AlmaMater` is a plain integer matching `Team.TeamIndex` (verified: rawValue 88 â†’ Temple, 21 â†’ Colorado, etc.), resolved via a map lookup against the teams snapshot in new `getCoaches.ts`.
- Captain data re-verified against the richer save as planned: real and populated (12 leaguewide), Texas State itself just has none assigned â€” confirmed genuine, not a bug.
- "Skill players" was undefined anywhere in the codebase â€” asked the user directly; confirmed as a QB/HB/WR/TE roster badge.
- Shipped: `getCoaches.ts` + IPC round-trip, `Coach`/`CoachOverview` types, `RosterPlayer.isCaptain`, `isSkillPosition()` in `rosterOrder.ts`, captain/skill badges on `Roster.tsx`, Head Coach summary on `DynastyOverview.tsx`, new `Coaches.tsx` page + route + nav tab.
- Verification: typecheck/lint/build clean; real end-to-end diagnostic-hook test against `DYNASTY-DYNASTYBOWL` through the actual import pipeline. Full details in `DevLog.md`.

### Phase I â€” Dev Mode token editor
Live editor for Phase A/B's tokens, previewing through Phase D's real components. Token config + explicit export workflow â€” never live-rewrites source files while the app is running. Independent of Phase H; the two can run in either order or interleave.

**Implementation status update (2026-07-16) - shipped.** New `DevTokenEditorMenu.tsx` navbar panel edits every Phase A token (spacing/radius/shadow/typography/motion) live, calling the existing `applyDesignTokens()` on each change so the whole app retunes in real time; previewed in-panel through real `SurfaceCard`/`StatTile` (Phase D) rather than a mockup. New `src/design/devTokenStorage.ts` persists the draft to `localStorage` (validated field-by-field against `DEFAULT_TOKENS`) so edits survive a restart, applied at boot from `index.tsx`. Per this phase's own constraint, the app never rewrites `defaultTokens.ts` itself — "Copy as TypeScript" (clipboard, with a manual-select fallback) is the explicit export step. Verified with a scripted diagnostic click test confirming a real CSS custom property changed live and persisted correctly (then cleared before finishing, so the test edit didn't leak into the real app). This closes out Phase I — only cosmetic/future polish remains anywhere in the lettered A-K track. Full details in `DevLog.md`.

### Phase J â€” Splash screen + launcher/packaging
Deliberately last. The splash screen's stage list ("Applying team theme," "Opening hub") should reflect the real, finished startup sequence â€” building it earlier risks rework once the rest of this track changes what startup does. Also finally exercises the electron-builder packaging path, flagged as untested since Phase 1 â€” more meaningful to test against a feature-complete build than an intermediate one.

**Implementation status update (2026-07-16) â€” splash screen shipped; packaging now also verified in a later pass**
- Splash screen done: real frameless `BrowserWindow`, stage list tied to actual startup (`initDatabase()` â†’ handler registration â†’ main window `ready-to-show`), swappable graphic with no code coupling. See `DevLog.md` for the full writeup.
- Phase I (Dev Mode token editor) skipped for now, by user choice â€” not done, not abandoned.
- electron-builder packaging (`npm run package`) â€” **now tested and working** (see v2.23 below / the "Packaging: first successful `npm run package`" entry in `DevLog.md`). Found a real config-filename bug (`electron-builder.config.js` isn't auto-detected), fixed it, and hit a genuine Windows Developer Mode requirement the user resolved. Phase J is now fully closed.

### Phase K â€” Integration pass
Persistence, theme switching, responsiveness, reduced-motion compliance, startup reliability, verified across everything above.

**Implementation status update (2026-07-16) â€” shipped, closes the lettered track**
- Theme switching and responsiveness audited clean, no fixes needed.
- Reduced-motion: was a complete gap, fixed with a single global CSS media-query rule.
- Startup reliability: window position from a since-disconnected/reconfigured monitor now falls back to centering instead of opening off-screen â€” verified live against this machine's real two-monitor setup.
- Minor: the one unguarded localStorage write (theme appearance) now matches the try/catch pattern used everywhere else.
- ~~Known gap flagged, not fixed: a corrupted SQLite DB file still has no in-app recovery path~~ **Resolved 2026-07-16** — see the "Corrupted-database recovery flow" entry in `DevLog.md` and Version History `v2.41`. Not itself a lettered-track item (a core reliability feature, not UI/UX), but closing it out here since this is where the gap was originally flagged.
- Full details in `DevLog.md`. ~~This closes out Phases A-K; only Phase I (skipped) and the packaging half of Phase J remain undone in the lettered track.~~ **Update 2026-07-16:** Phase I (Dev Mode token editor) has since shipped too — see its own section above and Version History `v2.40`. The lettered A-K track is now fully closed.

---

# Build & Distribution

**Windows Installer**
```
electron-builder outputs:
- CFB_Dynasty_Tracker_Setup_v1.0.0.exe (installer, 150-200MB)
- CFB_Dynasty_Tracker_v1.0.0.portable.exe (standalone)
- CFB_Dynasty_Tracker_v1.0.0.nsis (advanced installer)
```

**Auto-Update System**
- GitHub releases for version hosting
- electron-updater for auto-checks
- Staged rollout support
- Rollback capability

---

# NCAA Logo Asset Management

**Storage Strategy**
- Embed all 288 logos in app (bundle ~15-20MB)
- Compress with PNG optimization
- Cache in Electron app resources
- No external CDN dependency

**Filename Mapping**
```typescript
TEAM_NCAA_LOGOS = {
  'alabama': 'alabama.png',
  'alabama-state': 'alabamaState.png',
  'alabama-a&m': 'alabamaAM.png',
  // ... 288 teams
}

// Normalize team asset names from game
const gameAssetName = 'Alabama';  // from save file
const normalized = gameAssetName
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .trim();
// â†’ 'alabama' â†’ maps to 'alabama.png'
```

**Upgrade Path for Game Logos**
1. Research discovers extraction method
2. Create separate game-logos folder
3. Implement dual-source resolution:
   ```typescript
   function getTeamLogo(team: Team): string {
     const gameLogo = tryGetGameLogo(team.assetName);
     if (gameLogo) return gameLogo;  // Use game logo
     return getNCAA Logo(team.assetName);  // Fall back to NCAA
   }
   ```
4. No UI changes needed for upgrade

**Implementation status update (2026-07-16) â€” premium 3D logos + championship trophies**
- The dual-source resolution above is now real, not aspirational: `getLogoPath(teamAssetName, background)` in `src/renderer/lib/assetMapping.ts` tries the premium 3D set first (143 teams, `public/assets/3d_logos/`), falls back to the flat NCAA set (the pre-existing 256-team set), then the generic mark â€” exactly the pattern this section described, plus a dark/light-appearance dimension the original plan didn't anticipate (the 3D set ships separate on-dark/on-light renders; `TeamLogo.tsx` reads the app's live appearance from `ThemeProvider` and switches automatically).
- Also shipped in the same pass: team championship trophies (national/conference/bowl-win) and a bowl-appearance badge on the Season Overview page, driven by three more asset drops (`public/assets/{confchamp,bowlgames,playoffs,awards}/`) and one new extractor (`extract-conference-championship.ts`, reading `LeagueHistoryConferenceChampion` â€” the save has no other source for conference-title-game results). Full investigation notes, real verification (Ohio State's actual National Championship, Texas State's actual Alamo Bowl win), and a caught mid-session filesystem-casing bug are in `DevLog.md`'s "Dark/Light 3D Logos + Championship Trophies" entry â€” not duplicated here per this file's own convention of pointing at DevLog for phase-adjacent work outside the lettered UI/UX track.
- Known gap, not yet actioned: `public/assets/3d_logos/png_gold` (143 files) is a third logo variant nobody's asked to use yet.
- Individual player awards (`public/assets/awards/`) still unused â€” out of scope, likely relevant when Phase 8 (Awards) is picked up.

**Implementation status update (2026-07-16) â€” CFP playoff art + conference logos**
- `public/assets/playoffs/` is now used â€” direct follow-up ask, with the folder itself simplified since the line above was written (5 files now, not the 12 investigated originally). Schedule/game-detail Type display and the Season Overview postseason-appearance badge both now show the specific CFP round graphic or the appearance-correct (dark/light) national-championship mark, instead of generic bowl treatment.
- New: `public/assets/conf/` (conference logos) wired into the Schedule page's Type column, replacing the plain "Conference" text with the actual conference's logo â€” inconsistent per-conference naming in that folder (full names, acronyms, one asymmetric Pac-12 case with no dark variant) required an exact verified table, not a normalization scheme; one file (`Page-1.svg`) didn't match any real conference name and was left unmapped rather than guessed at.
- Full investigation and verification notes in `DevLog.md`'s "CFP Playoff Art + Conference Logos in Schedule" entry.

---

# Success Criteria

**Phase 0-5 Completion**
- [ ] Extract real save file in < 5 seconds
- [ ] Display all 9 data types correctly
- [ ] Zero crashes on large saves (10MB+)
- [ ] Manage 5+ dynasties simultaneously
- [ ] NCAA logos display properly (all 288 teams)
- [ ] All data remains local until export
- [ ] App works offline completely

**Phase Completion**
- [ ] Test with 3+ different save files
- [ ] Verify coach/roster/trophy extraction
- [ ] NCAA logos render at all sizes
- [ ] Database performs well (< 500ms queries)
- [ ] UI responsive on 1366x768 and above

---

# Change Handoff Rule

Every implementation change should update this roadmap before handoff so the next developer inherits both the feature state and the reasoning behind it.

For each shipped or partially shipped change, add:
- Date
- Scope / feature area
- Files or systems touched
- Errors, regressions, or missing pieces discovered
- Fixes applied or follow-up still required
- Verification run (`typecheck`, `lint`, `build`, manual QA, etc.)

Keep the entry concise, but specific enough that another dev can resume work without re-discovering the same context.

---

# Pre-Release Backlog

Actionable items to address **before public release**, distinct from the long-term phase roadmap above. Newest first.

- ✅ **DONE (2026-07-20 overnight): WebP conversion shipped** — see v2.76 and DevLog. PNG masters archived at `D:/PROJECT/portrait-master-png/`; library is now 864 MB WebP q90 with normalized names; installer verified at ~1.1 GB.

- **Portrait storage — convert PNG library to WebP (lossy q90).** Investigated 2026-07-18; full assessment in [`docs/PORTRAIT_STORAGE_ASSESSMENT.md`](docs/PORTRAIT_STORAGE_ASSESSMENT.md). `public/assets` is ~5.27 GB, dominated by 25,527 player portraits (4.70 GB) + 695 coach portraits (698 MB), all 512×512 8-bit RGBA PNG. **Measured on real files:** WebP q90 = ~17% of PNG size (→ ~835 MB total, −85%), visually indistinguishable from source with alpha preserved (mean pixel error 1.45/255; side-by-side confirmed). Lossless WebP = ~2.95 GB total (−45%) if zero-loss is required. **Decision (2026-07-19): defer to pre-release, then go lossy q90** — user is fine with q90 quality but wants to hold the change until closer to release. Implementation is small and centralized (~30 lines across 4 files: `playerAssetMapping.ts`, `coachAssetMapping.ts`, `searchPortraits` in `editorWrite.ts`, `PortraitPicker.tsx`) + a one-time offline `sharp` conversion script; **no database, IPC, or component changes**, and it also removes the current 3-candidate `_result`/`_result_result` filename `onError` fallback chain. **Important context confirmed twice:** there is no runtime DDS source to convert from — the game stores textures in proprietary Oodle-compressed Frostbite `.cas` archives (byte-scanned, no extractable DDS files), and the original export DDS folder no longer exists, so the shipped PNGs *are* the master asset set. Any "decode DDS on demand" / in-house Frosty-style extractor is out of scope (proprietary Oodle DLL dependency, game-install fragility, weeks of reverse-engineering, and it produces the same WebP output anyway). **Migration guard:** archive the PNG masters externally before deleting them (lossy is one-way; today's `CFB27-Hub-Backups` snapshot deliberately excluded `public/`). Switching q90↔lossless later is a one-flag re-run of the same script.

---

# Version History

- **v2.84** (2026-07-19): **Playtest batch #1 — nav + chrome restructuring.** History trimmed to program-only (coach "Dynasty Resume" + "Seasons Coached" removed; they live on Coach Hub) and moved to a subpage of Team Hub (new TeamHubLayout with Overview|History sub-tabs). Team Hub gained a centralized team switcher and lost the "Season/Last synced" line. Utility controls (Light mode, Preferences, Help, Stadiums) moved from the top navbar to the bottom of the left sidebar — required a new portal-based AnchoredMenuPanel so the dropdowns open upward from the bottom-left without being clipped by the sidebar's blur/overflow. Verified live. Details in DevLog. (0.2.0 installer predates this batch.)

- **v2.83** (2026-07-19): **App icon + beta package.** User-supplied DH icon (public/Icon/ICON.png) converted to multi-size build/icon.ico by new scripts/make-icon.js and wired into electron-builder. Fresh 0.2.0 installers cut with all shipped features; icon verified in the built exe, and the packaged binary passed a fresh-import smoke test including schema migration #6 and a media tag round-trip. Beta-ready artifact: release/CFB Dynasty Hub Setup 0.2.0.exe.

- **v2.82** (2026-07-19): **Media flows to player bios + game pages.** Tagged media auto-populates a new Media tab on every tagged player's bio (across all their seasons) and a Media section on the linked game's page. Shared read-only MediaGallery (grid + lightbox + links); display metadata resolved server-side against each item's own season. Fixed a real containing-block bug (backdrop-filter traps fixed overlays — lightbox now portals to body). Help topic updated. Details in DevLog.

- **v2.81** (2026-07-19): **Media gallery.** New per-season Media tab: upload photos/videos (copied into the app's own library under userData, schema migration #6 for metadata — user data, survives re-syncs like Team Awards). Tag each item with the game it's from (links to the Game page), the players in it (searchable roster picker; chips link to player bios), and a description. Thumbnail grid with caption strips → lightbox with prev/next + arrow keys, native video playback, edit/delete. Uploads land in the selected season. Help topic added. Verified live end-to-end (seed → tag → links → delete round-trip). Details in DevLog.

- **v2.80** (2026-07-19): **UX polish batch + full profiles for league players.** Statistics header controls on their own row; team dropdowns show the actual team name (no more "My Team", user team deduped from the list); Dashboard delete button un-shrunk (real cause: flex min-content squeeze to 18px — proven via new SCREENSHOT_EVAL DOM measurement — fixed with shrink-0) and restyled to match its siblings; Coach Hub hero portrait cropped tight (transparent headroom in the source PNGs removed via object-cover object-bottom); Awards is now its own player-bio tab; league players opened from Roster/NCAA Hub/Team Hub/Statistics render the SAME full profile as user players (hero, bio tiles, season stats, honors, live attributes) with the teammate rail showing the viewed team. New permanent harness hooks: SCREENSHOT_IMPORT_SAVE (self-provisioning verification runs) + SCREENSHOT_EVAL. Details in DevLog.

- **v2.79** (2026-07-19): **Team switcher on all five team-scoped pages** (Team Hub / Roster / Schedule / Statistics / History) via new ViewedTeamProvider + TeamSwitcher (logo beside dropdown; hidden on pre-league-snapshot seasons). New extract-league-schedule captures every game leaguewide (19KB/season compressed) powering any team's schedule + record. Per-page honesty: full league rosters; 4 stat categories for other teams; league-mode Team Hub summary; History titles-only for other programs. Player-bio hero now shows the season's actual team logo/name (transfer-correct). Verified live on Alabama. Details in DevLog.

- **v2.78** (2026-07-20): **League-wide roster browse.** Every team in the country browsable from NCAA Hub — full bios (16,255 players) + season stats (6,184 stat-holders) captured per season in a 1.18MB gzipped snapshot (new saveSnapshotCompressed, transparent decompression, no schema change), extraction adds <1s to sync (measured 65ms bios + 287ms stat preloads). Team selector + search + OVR-sorted rosters + player modal + leaguewide edit pencils (the write path was always PresentationId-based). Per-season snapshots preserve transferred players' pasts. New SCREENSHOT_SCROLL_SELECTOR harness hook. Verified live on Alabama's real roster. Details in DevLog.

- **v2.77** (2026-07-20): **Player Profile redesigned into the flagship experience.** ESPN-inspired (reference only), Dynasty-Hub-native: persistent hero (unboxed portrait on a team-color field, DIN name, OVR focal, past-season badge) + six subpages (Overview with editorial jump-cards / Stats / Career résumé / read-only Attributes via the editor IPC — new capability / Game Log / derived History timeline — new). Navigation: collapsible teammate rail (search, unit grouping, portraits, recents), ArrowLeft/Right player switching, wider modal. "Imported…" labels removed; redundant rollup section deleted; data layer untouched. Verified live on real data. Details in `DevLog.md`.
- **v2.76** (2026-07-20, overnight): **Release path executed.** WebP q90 conversion shipped (masters archived externally; 25,527+695 portraits converted with normalized names, self-verified; 5.4 GB → 864 MB; fallback-chain code deleted). First-ever packaging run: working NSIS + portable installers at ~1.1 GB. The packaging test caught a real ship-blocker — 705 asset files across six folders carried `_result` suffixes from the earlier PNG-compression pass (masked in dev by stale `dist/` copies; fatal in case-sensitive asar) — all normalized and every constructed path audited exact-case (684 logo + 39 trophy refs, zero misses). Packaged binary verified end-to-end on isolated data via the new permanent `CFB_USER_DATA_DIR` hook (`--user-data-dir` and `%APPDATA%` don't work on packaged builds — documented). Git initialized: initial commit `e1fcb2f` (491 files), plus the overnight work committed on top. Details in `DevLog.md`.
- **v2.75** (2026-07-20, overnight): **Both known data bugs fixed.** Stale-slot heuristic in extract-stats + extract-kicking (previous season shown as "current" until a player recorded a new-season line) fixed via exact SEAS_YEAR match to the synced season — verified both directions on real saves (fresh preseason → honest nulls; completed season → all real lines). Coach portrait write finally solved: `Coach.Portrait` proven to be an arbitrary index (the "+10 pattern" was coincidence), but asset→Portrait is conflict-free within a save (448/408 assets, zero conflicts on two saves) — writes now copy the index from the asset's current wearer and set AssetName too; round-trip verified. Details in `DevLog.md`.
- **v2.74** (2026-07-19): **Feature tracks closed — Team Awards Phase 5 + Statistics Phases 3-4.** Single-Game Performance of the Year shipped (11th and final in-scope award; dedicated per-game calculation path on the shared game-impact score; verified on a real completed season + live UI). Statistics: leader-card qualification minimums (Cmp% min 100 att, Y/C min 40 att, Y/R min 20 rec — mechanism generic), side-by-side player comparison modal, Regular/Postseason/Home/Away/opponent splits with true per-game re-aggregation (Kicking/Punting/Returns honestly noted as unsplittable — no per-game data), Hot Players (last-3-games impact trend), Milestones tracker (75%+ progress, REACHED badges). Screenshot harness: SCREENSHOT_SELECT_VALUE now multi-pair and runs before clicks. All verified live on a real 14-game season. Details in `DevLog.md`.
- **v2.73** (2026-07-19): GameDetail box score restructured Passing/Rushing/Receiving/Defense to match the Statistics page (user direction — app-wide uniformity). Per-category columns mirror the season page (per-game-nonexistent GP/Int/Lng honestly omitted), category-scoped rows (no false-zero players), per-section leader cards. New permanent `SCREENSHOT_SELECT_VALUE` diagnostic hook (React-visible `<select>` setter) to reach past-season pages in the screenshot harness. Verified on a real game. Details in `DevLog.md`.
- **v2.72** (2026-07-19): Overhaul follow-ups closed: all remaining page/section headings converted to DIN roles (tag-scoped, zero generic headings left; stat values untouched by construction), Heisman winner name included; `readme.md` written (was empty — quick start, workflow, repo layout, design-system summary). Verified live on Team Hub dark. Details in `DevLog.md`.
- **v2.71** (2026-07-19): **Visual Overhaul complete (Phases 3-5 closed).** All ~115 longhand eyebrow labels migrated to the single DIN `.type-eyebrow` class; LeaderCard gained the cut corner + DIN tabular value (styles Statistics and GameDetail together); profile heroes (player/recruit/coach) carry DIN names + stat-lg values; Awards verified ceremonial-but-restrained; Schedule verified dark-mode end-to-end; data pages inherit the full system via shared components + app-wide sweeps. P5 audit: dark/light/Team Mode verified across 6+ pages, reduced-motion covered by the existing global clamp (zero new animations added), perf unaffected (typography/shape/color only), responsive unchanged by construction. Optional non-blocking follow-ups recorded in DevLog (structural PageHeader adoption on ~7 pages, modal-shell refactor, licensed DIN Pro drop-in). Details in `DevLog.md`.
- **v2.70** (2026-07-19): Visual Overhaul — Phase 3 opened with the app-wide de-pill sweep: `rounded-full` stripped from every padded control (100 → 10 instances; survivors are genuine circles), nav tabs now hard-edged DIN rectangles with the active tab carrying the team-colored cut corner, and all navbar/menu/toggle/chip controls squared. Verified live on Statistics (light + Team Mode). Remaining P3: hero treatments, leader cards, Awards pass, PageHeader adoption. Details in `DevLog.md`.
- **v2.69** (2026-07-19): Visual Overhaul — shape language pivoted to hard edges + single angled cut corner per explicit user direction (reference: the EA game's own UI; "same universe, not a copy"). Radius tokens all `0px` (one-switch reversal; `rounded-full` reserved for true circles), new `.corner-cut`/`.corner-cut-sm` clip-path classes applied with restraint (SurfaceCard — now flat/border-defined, StatTile, primary/destructive Buttons). Remaining pill controls migrate during the Phase 3-4 page sweeps. Preference saved to durable memory. Verified live; typecheck/lint/build clean. Details in `DevLog.md`.
- **v2.68** (2026-07-19): Premium Visual Overhaul — Phase 2 (Core components) shipped. New `PageHeader` (eyebrow → DIN title → description → actions; adopted on Roster/Schedule/History, remaining pages migrate in Phases 3-4) and `Button` primitives (primary/secondary/tertiary/destructive, 6px corners, DIN labels — editor Save buttons moved off their spec-violating red pills onto the accent primary). `StatTile` now renders DIN + tabular numerals app-wide; `SurfaceCard` gained surface levels (primary/raised/overlay) on the theme-aware variables; `StatisticsTable` numerics switched to tabular figures with DIN headers. `EditButton` deduped from 3 identical copies to the single `CoachCard` export (audit follow-up). Verified live: Roster + editor modal screenshots (`visual-overhaul-p2-*`), typecheck/lint/build clean. Full details in `DevLog.md`.
- **v2.67** (2026-07-19): Premium Visual Overhaul — Phase 1 (Foundation) shipped, plus same-day startup fix + codebase audit (see DevLog). User-provided 34-section design spec; audit + full phase plan in `docs/VISUAL_OVERHAUL_PLAN.md`; timestamped backup first. DIN display identity via Windows-native Bahnschrift (licensed DIN 1451; "DIN Pro" slot ready for licensed files, nothing unlicensed bundled) + Inter body bundled legally (OFL, 97KB woff2, offline-CSP-compatible). Token system extended (role type scale, 6/10/12/14px radius language, controlled shadows, 120/180/260/320ms motion, theme-aware surface variables). The global `border-radius:0 !important` override (the old "angular pass") removed and all 107 dead arbitrary `rounded-[Npx]` values migrated to the token scale. `.type-*` component classes formalize the eyebrow/meta/stat styles with tabular numerals. Verified live in both themes with Team Mode against a copy of the real DB. Phases 2–5 pending. Full details in `DevLog.md`.
- **v2.66** (2026-07-19): Redundant recruit editing merged into one "Edit Player" modal. User flagged two separate edit entry points on a recruit doing overlapping work: the recruiting-fields-only `RecruitEditorModal` (v2.62) and the general Player editor, plus a board-row pencil with no path to recruiting fields at all. User chose (via `AskUserQuestion`) to merge rather than keep them separate. `PlayerEditorModal.tsx` gained a conditional "Recruiting Info" tab (shown only when a new `isRecruit` prop is true), ported straight from the deleted `RecruitEditorModal.tsx` — same fields, same fetch (`window.api.editor.getRecruit`), same honest "not confirmed safe to write" banner. `handleSave` now calls both `savePlayer` and `saveRecruit` in one click with one combined status message. `EditorModalProvider`/`EditorModalHost` lost their separate `recruitState`/`openRecruitEditor` third state in favor of `PlayerEditorState.isRecruit`. `RecruitProfileModal.tsx` now shows exactly one pencil instead of two; `Recruiting.tsx`'s board-row pencil now passes `isRecruit: true`, closing the pre-existing board-row gap too. Verified live against a real save (USC dynasty, 31-recruit board): merged modal opens with a visible "Recruiting Info" tab showing real fetched data matching the database exactly, and the profile modal shows a single edit icon. `npm run typecheck`/`lint`/`build` all clean. Full details in `DevLog.md`.
- **v2.65** (2026-07-19): Recruit photo editing restored — same modal as roster players, jumping straight to the Portrait tab. User: "we had it before." The general Player editor's Portrait tab already worked for recruits all along (recruits are `Player` rows; the board-row pencil in `Recruiting.tsx` never changed and always called the same `openPlayerEditor` roster players use) — the actual gap was that the recruit *profile modal* had no entry point to it, only the new recruiting-fields-only editor. Added a small edit icon on the portrait in `RecruitProfileModal.tsx` calling the same `openPlayerEditor`. `PlayerEditorModal` gained an `initialTab` prop (defaults to `'profile'` everywhere else, so no existing behavior changed) so this new entry point lands directly on the Portrait tab. Verified live: opens the identical "Edit Player" modal roster players use, already on Portrait, with the same full 25,527-portrait searchable picker. Full details in `DevLog.md`.

- **v2.64** (2026-07-19): Leaguewide player portraits + GameDetail team-name fix. User confirmed every player leaguewide has a real portrait, including CPU-controlled teams, not just recruits (v2.63). New lightweight `extract-league-portraits.ts` reads `playerId`+portrait for every non-empty `Player` record leaguewide (no team filter) — verified on a real save: 16,255 players, 100% with a real portrait, no measurable extraction slowdown since the `Player` table is already fully loaded elsewhere. Wired into `getAwards.ts` (`LeagueAward`/`HeismanCandidate`/`HonorRosterEntry` all gained a real portrait via a `playerId -> portrait` join) and threaded through every award page's player-name button plus the opposing-team-player profile modal fallback, which previously showed only a team logo. Verified live: every award winner across every team now shows a real photo, and an opposing player's profile modal now shows their real face too (full stats/bio/game-log remain correctly unavailable — only the portrait gap was closed). Also fixed: `GameDetail.tsx`'s box score tables said "You" instead of the real team name — both now read the already-existing, already-populated `ScheduleGame.teamName` field. Full details in `DevLog.md`.

- **v2.63** (2026-07-19): Real research gap found and fixed — recruit profile photos were wrongly declared impossible in v2.62's sub-phase C. User correction: recruit portrait *editing* already worked before that pass (via the existing general Player editor, untouched by this work — recruits are literally `Player` rows); the only real gap was that the recruit profile modal never *displayed* a photo. The original research checked only whether the recruiting-specific extraction type carried a `portraitAssetName` field, not whether the underlying `Player` record actually had one — a direct diagnostic against a real save confirmed every one of a real team's 35 board slots has a populated `GenericHeadAssetName`, identical to roster players. Added `portraitAssetName` to `RecruitData`/`RecruitBoardEntry` and swapped the recruit modal's hardcoded initials-only avatar for the real `PlayerPortrait` component; deleted the now-inaccurate `resolveRecruitPortrait()` helper outright rather than patch it. Verified live: a real recruit's actual photo now renders in the profile modal. Full details in `DevLog.md`.

- **v2.62** (2026-07-19): Phase 3 refinement pass shipped — Awards nav/highlighting, Rankings page removal, universal portrait linking, Team Awards retirement, recruit portraits/editing, GameDetail statistics unification. A large 17-section spec, phased into four sub-phases by risk after three parallel research agents established what was already built, what the save genuinely can't support, and what needed real write-path verification before shipping. **Sub-phase A**: Awards nav header restructured to title/description/submenu on separate rows (stops wrapping); `isUserTeam` highlighting extended to Heisman finalists and All-America/Conference; standalone Rankings page/nav/route removed while its backend (directly consumed by Coach Hub's rank tiles) was left untouched; recruit commitment timeline made clickable; `PlayerPortrait` gained an optional `onClick` and got wired into every previously text-only player mention across Awards/Team Awards; the Player/Recruit Profile Overall box now centers only the number, not the label. **Sub-phase B**: confirmed via a read-only query against the live database that Newcomer of the Year and Best Quarterback already have real confirmed historical results on a currently-active season — outright deletion would have orphaned real data. New `retired?: boolean` flag on `AwardDefinition`, orthogonal to `enabled`/`disabledAwardIds`: never offered for future calculation, but the definition stays so old results still resolve a name. Verified against a disposable copy of the real live database: both awards gone from the live workflow, the season still reaches "Ready to Finalize" without them, their real historical winners still render in Season History. **Sub-phase C**: confirmed no real recruit photo data exists anywhere in the save — new `resolveRecruitPortrait()` formalizes the existing initials fallback honestly instead of fabricating a face. Recruit editing scoped to exactly what a real diagnostic write-probe (open a disposable save directly via `madden-franchise`, write, save, reopen, verify) confirmed safe: Hometown, Star Rating, Class Year, National/Position/State Rank. Home State (a real but uncatalogued enum), Top Schools (a table reference, not a scalar), and commitment/signed-school (real game logic / derived cross-team data) excluded with honest reasons. New third `EditorModalProvider` state and `RecruitEditorModal.tsx`, gated to the current season only — which also fixed a real pre-existing gap where the board's general-editor pencil ignored season entirely. Verified end-to-end through the app's real IPC-backed save path. **Sub-phase D**: extracted `StatisticsCategorySection`/`LeaderCard`/`withMode`/`ColumnDef` out of `Statistics.tsx` into a new shared module, then rebuilt `GameDetail.tsx`'s Offense/Defense box score on top of it — real per-metric leader cards now render for a single game from the exact same component the season Statistics page uses. A real TypeScript weak-type-detection quirk was hit and fixed (a `{ gamesPlayed?: number }` generic constraint rejected per-game line types sharing zero property names with it; fixed by reading the field defensively at runtime instead). Verified live: zero regression on Statistics, real per-game leaders with real portraits and correct tie handling on GameDetail. Kicking/Punting/Returns box scores deliberately deferred — confirmed no per-game data exists for them yet. `npm run typecheck`/`lint`/`build` all clean throughout. Full details in `DevLog.md`.
- **v2.61** (2026-07-19): Team Awards — Phases 4 and 6 shipped, closing out the feature except for the deliberately-skipped Phase 5. **Phase 4 (Special Teams Player of the Year)**: unblocked by the same-day Kicking/Punting/Return extraction (v2.60). New special-teams grouping classifies each candidate into kicker/punter/returner and scores them with role-specific formulas, then compares all three fairly on one scale via the same percentile-within-subgroup mechanism already used for CB/Safety and backs/receivers — the first three-way application of it. Verified on a real save: finalists were exactly the three real special-teams standouts, one per role. **Phase 6 (season history, Player Profile / Coach Hub integration, settings panel)**: discovered mid-research that `TeamAwardSettings`'s backend (types, DB read/write, full IPC round-trip) already existed from Phase 1 with zero renderer consumer, so this phase built the UI layer only. New settings panel on `TeamAwards.tsx` (calculation timing, auto-recalculate, per-award enable/disable, and a Freshman/Newcomer eligibility toggle shipped visibly but locked with an honest reason — a real diagnostic confirmed `RedshirtStatus`'s values describe redshirt-eligibility status, not "was a redshirt freshman," so it can't be built correctly yet). New season-history view resolving each past season's confirmed winners against that season's *own* roster/team snapshot, never the dynasty's current one. New Team Awards sections on `PlayerProfileContent.tsx` and `CoachHub.tsx`. Auto-recalculate now runs on every re-sync. Verified end-to-end via a temporary diagnostic branch (removed after use) confirming three real awards on a disposable save, then live screenshots of all four new surfaces — the Coach Hub card briefly looked missing in a downscaled full-page screenshot, confirmed via a targeted crop to be a perception issue, not a bug. `npm run typecheck`/`lint`/`build` all clean. Phase 5 (Single-Game Performance of the Year) explicitly skipped per user request, not silently dropped. Full details in `DevLog.md`.
- **v2.60** (2026-07-19): Schedule season-scoping bug fixed, Breakout POY cut from Team Awards, Kicking/Punting/Return stats extracted. Three follow-ups picked off the post-overnight-pass backlog. `extract-schedule.ts`'s season-boundary bug fixed at the source using the save's own `SeasonGame.SeasonYear` relative-index field (same convention as player `SEAS_YEAR`) plus the already-extracted `baseCalendarYear` — verified on a real multi-season save caught exactly at a season boundary, where the fix correctly changed a wrongly-inherited 43-game stale schedule into an honest, empty one for the brand-new season. Breakout Player of the Year removed entirely from Team Awards scope (explicit user decision, not left disabled) — 11 of the spec's original 12 awards remain. Real-save investigation into "kicking/return stats aren't extracted yet" turned up a more serious pre-existing bug: return-duty players (kick/punt returners) have their CareerStats/SeasonStats resolve to a `*KPReturn` table variant carrying the same passing/rushing/receiving/tackle fields as normal, plus return columns — `categoryFromTableName()` didn't recognize those table names, so any player with real return duty was **silently dropped from every stat category entirely**, not just missing return numbers (confirmed on a real WR with 11 kick returns for 295 yards showing zero stats anywhere in the app). Fixed at both the season/career level and the per-game level. Kicking/punting added as a genuinely separate category (own real save table, shared by K and P) with a full new IPC round-trip and new Kicking/Punting/Returns sections on the Statistics page. A real UI bug was caught by screenshot during verification — the Returns leader cards initially showed a false "Punt Return Yards" leader at 0 yards on a team where nobody returns punts — fixed before shipping. `npm run typecheck`/`lint`/`build` all clean; real diagnostic imports and live screenshots throughout. Full details in `DevLog.md`.
- **v2.59** (2026-07-18): Overnight UX, Data Persistence & Navigation Refinement pass — full 22-section spec shipped in one authorized autonomous session. Nav cleanup (Dev Mode and Exports pages removed entirely — HTML export moved to a Dashboard icon; Team Awards folded into a new Awards submenu at `/awards/{annual,all-teams,team,weekly}`, sharing one fetched `AwardsOverview` via React Router's `Outlet` context). Two real bugs found and fixed that the spec didn't anticipate: an OC/DC-controlled dynasty **failed to import entirely** (`findUserTeamIndex()` wrongly required Head Coach specifically, not just user-control — real severity discovered while investigating a display-only Coach Hub request), and the Team Mode theme bug (`DynastyLayout.tsx` hardcoding null colors instead of calling the already-existing `getDynastyTheme` IPC). Historical player persistence — the spec's most architecturally ambitious ask, a full `HistoricalPlayerSnapshot` system — turned out to need only a surgical fix: `season_snapshots` was already durable per past season, the real bug was `openPlayerModal`/`PlayerProfileContent.tsx` never searching past the current season. Coach Hub rebuilt around a new `userCoach` (HC/OC/DC-aware, distinct from `headCoach`) instead of assuming Head Coach everywhere. Dashboard cards redesigned coach-centric (portrait layered over team logo, coach name as title). Schedule/GameDetail gained real event names instead of "Neutral Site", a genuinely computed running record (`getSchedule.ts`'s new `applyRunningRecords()`), and a shared-`StatisticsTable` box score with category-specific "meaningful stats" filtering. Statistics leader cards now show multiple real metrics per category with tie handling. New Recruiting profile modal (`RecruitModalProvider`/`RecruitProfileModal`, mounted at the app root like the player modal) — a real sizing bug was caught by screenshot (recruits have no portrait asset at all, so `PlayerPortrait`'s shrink-to-fit fallback rendered smaller than the signed-school logo, violating "portrait stays the dominant subject"; fixed with a purpose-built fixed-size avatar). History page rebuilt around a single resume-style Dynasty Resume section using the coach's real `CareerCoachStats` (rivalry/Top-25/bowl/playoff/championship-game records, draft picks) plus two new real cross-season aggregates (`bestRecruitingClassRank`, `nationalAwards` — both derived from data already read per season, no new extraction). Standings divisions and single-game record opponent-context were both investigated directly against the real save schema and deliberately not built/fabricated after confirming the save doesn't support them (`Conference.Divisions` resolves to the entire conference roster with blank division names; the school record book's `PlayerStatRecord` table carries no opponent/score reference at all). `npm run typecheck`/`lint`/`build` all clean throughout; extensive live screenshot verification against disposable save copies. Full details in `DevLog.md`.
- **v2.58** (2026-07-18): Team Awards — Phase 2 shipped (7 more awards + a real data-model fix). Direct follow-up to Phase 1: re-investigated the "no fumbles data" gap per user correction and found a real field — `RUSHFUMBLES` on the offensive stats table, confirmed by direct field-name inspection on a real save. Added honestly as `OffensiveStatLine.fumbles` (rushing-play fumbles specifically, not a fabricated "fumbles lost" total), which unblocked every Phase 2 award's Ball Security component. New `src/teamAwards/formulas.ts` factors the shared position-grouping/percentile machinery MVP introduced in Phase 1 into reusable helpers (including a new generic `percentileByGroup`); MVP itself was refactored onto it with no behavior change. `AwardDefinition` gained a `customEligibility` hook for the spec's award-specific participation minimums (QB 20% of team pass attempts, HB 15% of rush attempts, WR/TE 10% of receptions), using real `TeamStats` totals. Shipped: Offensive/Defensive Player of the Year, Best Quarterback, Best Offensive Skill Player, Best Defensive Front Player, Best Defensive Back (with the spec's own subgroup-normalization rules — backs vs. receivers, corners vs. safeties), and Freshman of the Year (true-freshman only). A real gap surfaced during verification: Freshman of the Year correctly returned "insufficient data" on a fresh-preseason save with zero eligible freshmen — an honest result, not a bug — but exposed that automatic awards had no manual-override path in that state. Fixed by adding the spec's own "Select Winner Manually" fallback. Verified end-to-end against a disposable save (all 7 new awards calculated with sensible real winners) and a live screenshot confirming all 9 enabled awards render correctly. Full details in `DevLog.md`.
- **v2.57** (2026-07-18): Team Awards — Phase 1 shipped (engine foundation + MVP + Newcomer of the Year). User provided a full spec for a position-aware, transparent, editable award-recommendation engine covering 12 end-of-season awards — calculate, recommend, confirm/override, finalize, persisted permanently across re-syncs. Distinct from the existing save-derived `Awards.tsx`: this is app-generated and user-editable. Three parallel investigations against the real codebase found genuine gaps between the spec and the data: no transfer/newcomer field exists anywhere (Newcomer of the Year ships manual-only, permanently); no fumbles-lost field for offensive players (every formula's "Ball Security" component is structurally impossible, dropped with weight redistributed); kicking/return tables were only ever confirmed to exist, never mapped to field names (Special Teams POY blocked on real extraction work, Phase 4); no historical opponent-rank data (the "ranked opponent" bonus/tiebreaker dropped from Single-Game Performance of the Year, Phase 5). Phased into 6 stages. Phase 1: new `team_award_results`/`team_award_settings` tables (migration v5) deliberately live outside `season_snapshots` — the first feature in the app to write user-entered data to local SQLite, with a genuinely new write-capable IPC pattern (`teamAwardsWrite.ts`). New `src/teamAwards/` service layer (definitions, eligibility, position-group percentile normalization, generic missing-input weight redistribution, tiebreakers, explanations, engine) kept fully out of React. All 12 awards defined up front, 10 visibly disabled with real, specific reasons rather than silently introduced later. MVP ships as a genuinely reduced formula — three spec components needing per-game context (Phase 5) are modeled as real components with null values so the generic redistribution logic honestly folds their weight elsewhere, verified live to produce a defensible recommendation with an honest missing-inputs disclosure. Verified end-to-end via a temporary diagnostic branch (removed after use): calculate → confirm → re-sync (confirmed selections survived untouched) → finalize → unlock → recalculate-while-confirmed (selection preserved) — every persistence guarantee held. Live screenshot confirmed the rendered page. Full details in `DevLog.md`.
- **v2.56** (2026-07-17): Statistics page — Phase 1 shipped (Team Statistics + Passing/Rushing/Receiving/Defense). User provided a full ESPN-style Statistics page spec (team box score + 7 player-stat categories, leader cards, comparison mode, milestones). Verified against real save data what's actually supported before building — the spec's own instruction — and phased it into 4 stages rather than one mega-build. Real find: `Team.TeamSeasonStats` (58 real fields) has never been read by this app; full team box-score totals (yards, red zone, third/fourth-down, sacks, turnovers, penalties, time of possession) genuinely exist. Verified slot 0 reliably holds the current season's live totals on two real saves (cross-checked exactly against the team's own win/loss fields — 7-6 matched precisely) — no complex slot-selection logic needed, unlike two earlier real slot-ordering bugs this session. No `POINTS` field exists in the save at all — scoring correctly derived from the schedule instead. New `extract-team-stats.ts`, `getTeamStats.ts` + IPC round-trip, reusable config-driven `StatisticsTable.tsx` (generalizing `Roster.tsx`'s sortable-table pattern instead of building 7 one-off tables), and new `Statistics.tsx` page: Team Overview Cards, a 3-column Offense/Defense/Special-Teams breakdown, and 4 full-width player categories with leader cards and sortable tables, reusing the existing roster/stats client-side join pattern. Every player row and leader card opens the existing player profile modal, per explicit user direction — verified live end-to-end against a real fully-simulated 13-game season, including a dual-threat QB correctly appearing in both Passing and Rushing. Kicking/Kick Return/Punt Return (real data confirmed, not yet wired up), qualification rules, comparison mode, and hot-players/milestones/expanded-rows explicitly deferred to Phases 2-4. Full details in `DevLog.md`.
- **v2.55** (2026-07-17): In-app Help menu shipped — a living how-to guide, distinct from `DevLog.md`. Direct follow-up to a real support conversation about season-sync timing that exposed a gap: this app had no way to communicate how-to knowledge to the person actually playing a dynasty. New `HelpMenu.tsx` matches the existing `PreferencesMenu`/`StadiumDatabaseMenu` navbar-dropdown pattern exactly, with a topic-list-plus-content two-column layout; new "Help" button sits right after Preferences in the navbar. Seven topics at launch, written in a professional-but-human-centered tone: importing a dynasty, syncing every season before advancing (the one that prompted this), the Season dropdown and "History Only" seasons, Coach Hub vs. Team Hub, Sync/Relink/Backup, editing players and coaches, and an honest-limitations list — content checked against real code before writing (e.g., confirmed coach portrait edits don't reliably carry into the game the way player portrait edits do, before stating that as a caveat). Standing convention going forward, saved to persistent memory per explicit user request: keep this Help menu current whenever a real how-to/use-case question comes up, not just `DevLog.md`. Verified live via screenshot: correct nav placement, panel open/close, topic switching all working. Full details in `DevLog.md`.
- **v2.54** (2026-07-17): Multi-season history made bulletproof — real backfill from the save's own league history, and a real conference-championship/coach-award contamination bug fixed. User reported the season switcher showed no dropdown for a new save simmed several seasons ahead before its first sync, framed as a must-be-flawless feature. Root cause, confirmed via direct inspection of a read-only copy of the user's real live database: not a bug — the app can only capture a save's state at the moment of sync, and this save was only ever synced once, already 4 years in. The real fix: found the save's own year-by-year league history table (`League`'s `YearSummary[]` — the schema's own reference to it is confirmed unresolvable, so it's located directly by table name) and built a new `extract-league-history.ts` around it, verified with real national champions/conference champions/awards for 3 completed years on a real save. Used it to (1) retroactively backfill lightweight "history-only" seasons for every year never individually synced (real champions/awards, no roster/schedule/stats — genuinely unrecoverable, clearly labeled) and (2) fix a real, independently-confirmed bug: the previous conference-championship and coach-award extractors both read flat, ever-accumulating tables with no year field, silently corrupting the Standings champion badge and Coach Hub's `BEST_HC`/`BEST_AC` awards for any dynasty 2+ seasons deep — confirmed via a real 3-year-contaminated save (each of 10 conferences had exactly 3 stale entries). New `has_full_data` column (schema v4) distinguishes real from backfilled seasons everywhere shown; a new "League History" section on the History page is the actual visible payoff. Verified end-to-end against disposable copies of two real saves (correct backfill, zero regression on an already-fully-synced dynasty, no duplicate backfill on re-sync) and a copy of the user's real 11-season live database (clean migration). Full details in `DevLog.md`.
- **v2.53** (2026-07-17): Phase 4 of the coach-centric redesign — scoped cleanup, closing out the redesign (Phases 0-4, all shipped). Deliberately scoped to only what Phases 0-3 actually left behind, not a general audit. Investigation found almost nothing dead: `formatCoachPosition` already fully replaced by `spaceCamelCase`, no dangling `/coaches` route/file references anywhere, every page/component still reachable. Tidied one stale comment in `CoachHub.tsx` naming the deleted `Coaches.tsx`. One pre-existing pattern (both `DynastyOverview.tsx` and `CoachHub.tsx` independently fetch `getCoaches` for the head coach) was surfaced and deliberately left alone — consistent with this codebase's established per-page-fetch convention, not a regression from this redesign. Moved `DevNotes_071726_V1.md` (the original design doc) from the repo root to `docs/archive/` now that its contents are fully captured in `DevLog.md`/here. Full details in `DevLog.md`.
- **v2.52** (2026-07-17): Phase 3 of the coach-centric redesign — standalone Coaches page retired. Closes out Phase 2's own stated exit condition. Before deleting `Coaches.tsx`, found a real gap: its per-coordinator "Imported Resume" (each staff member's own win-loss record across seasons they've been on staff) wasn't reproduced in Coach Hub's staff section, which was rendering coordinator cards with `resume={null}`. Ported the resume computation into `CoachHub.tsx` first — reusing the shared `CoachResume` type — so nothing regressed. Then removed `Coaches.tsx`, its route, and its nav tab; repointed `DynastyOverview.tsx`'s stale "View full staff" link (previously `/coaches`) at the Coach Hub index route. Verified live: nav bar clean, both real coordinators' Imported Resume blocks render correctly, matching the pre-removal page exactly. Full details in `DevLog.md`.
- **v2.51** (2026-07-17): Phase 2 of the coach-centric redesign — Coach Hub shipped as the new default dynasty page. The flagship page: `/dynasty/:id`'s index route is now `CoachHub.tsx` (hero, Coach Profile, dual-sourced Career Record, Current Coaching Staff, Previous Seasons Timeline); the former index page (`DynastyOverview.tsx`) is unchanged and moved to a `team-hub` tab, per the user's explicit choice to keep both. Decompressed the real CFB27 schema before scoping and found `CareerCoachStats` — a save-native, already-computed *lifetime* coaching record (wins/losses, bowl/conference/playoff/rivalry/Top-25 record, national titles, times fired, draft picks) the game tracks across the coach's whole career, independent of this app's imports — now the primary "Career Record" source, shown alongside a second "Since Importing" block scoped to this app's own tracked seasons. Real-save verification caught a genuine dead end before shipping: `OffensiveScheme`/`DefensiveScheme` resolve to a real, valid target table (confirmed via two independent reference paths) that the `madden-franchise` library never enumerates into its table list — even the library's own official `getTableById` can't find it — so it's unreachable through the same pattern every other reference field in this codebase uses. Dropped from scope rather than worked around with a fragile manual parse; everything else (`Age`, `DominantArchetype`, `SeasonsWithTeam`, `CurrentJobSecurityStatus`, `Personality`, full `CareerCoachStats`) resolved cleanly and shipped. `Coaches.tsx`'s `CoachCard` extracted into a new shared `CoachCard.tsx` so both pages reuse one real component. Verified against a real save (disposable copy, isolated diagnostics) end-to-end through extraction → persistence → queries → live screenshots; Team Hub independently confirmed unchanged at its new path. Full details in `DevLog.md`.
- **v2.50** (2026-07-17): Phase 1 of the coach-centric redesign — collapsible Dynasty submenu + Dashboard icon separation. Independent, low-risk follow-up to v2.49. The Sidebar's single static "Dynasty" link (with a redundant "Home" chip) is now an expandable tree: still navigates to the Dashboard on click, but expands (default open) to list every loaded dynasty by real team logo and real head coach name — a new `headCoachName` field on `DynastySummary`, resolved server-side via the already-existing `getCoaches` query, no new backend logic needed. Also separated the Dashboard card's Sync/Backup icons from Delete with a visible gap and divider, per the user's explicit ask to make an accidental delete click structurally harder, not just reorder what was already left-to-right. Verified live: sidebar correctly lists two real imported dynasties with correct logos/coach names, collapse toggle works, and the new icon divider renders as intended. Full details in `DevLog.md`.
- **v2.49** (2026-07-17): Phase 0 of the coach-centric redesign — per-season team tracking. User handed over a design doc proposing the app be restructured around the coach as the primary entity (not the school) and confirmed the human-controlled coach can genuinely change schools within one continuous save file — a real premise, not hypothetical. That exposed a real, previously-invisible bug: `dynasties.team_id` was fixed forever at first import and never updated on reimport, and 10 query files / 30 call sites all resolved "the user's team" against that stale constant — a real coaching change would have silently kept every future season showing the old school. Fixed by adding a `user_team_id` column to `seasons` (migration v3), populated from what the extractor already independently and correctly re-derives on every import (`findUserTeamIndex`, save-native), and switching every affected query to resolve a season's team from its own row. Also added a one-time startup backfill for already-imported seasons (which would otherwise read `NULL` after the migration) that derives each one's real historical team from that season's own already-stored coaches snapshot, not guessed from the dynasty's current value. Verified with a synthetic two-team, two-season diagnostic: every query correctly returned the right school per season, the season timeline correctly showed two different real coaches at two different schools, and the backfill correctly recovered a nulled-out season's original team rather than the dynasty's newer cached one. Data-layer only, no UI changes — the nav restructure, Dashboard icon tweak, and new Coach Hub page are separate later phases. Full details in `DevLog.md`.
- **v2.48** (2026-07-17): Dashboard icon buttons + "Sync Dynasty". Direct follow-up to v2.47: moved dynasty-management actions off the Team Hub page onto each Dashboard card as three small hover-revealed icons (Sync, Backup, Delete), replacing the text-button row there entirely. The explicit file-picker "Relink Save File" action is now "Sync Dynasty" — a one-click reimport of the dynasty's own already-known save path, no dialog — while the underlying relink/detection machinery from v2.47 stays in place for the actual renamed-file recovery case (still triggered automatically from the normal Import Dynasty flow). New `syncDynasty(dynastyId)` reuses the existing `persistExtraction` path with zero new season logic. Verified live: all three icons render correctly (a real hover state was forced visible for the screenshot via an injected stylesheet rule, since CDP can't simulate a real mouse hover), Sync executes a genuine reimport, and Team Hub is confirmed clean of the removed buttons. Full details in `DevLog.md`.
- **v2.47** (2026-07-17): Dynasty relink — fixes duplicate dynasties from a renamed/moved save file. Direct follow-up to v2.46: the user didn't see the new season switcher after reimporting. Investigated via a direct, read-only inspection of a copy of the user's real live database (never the original): found 7 orphaned `seasons` rows and confirmed the root cause in code — dynasties are matched by an exact string match on the save file's path (`getDynastyBySavePath`, `UNIQUE(save_path)`), so a save renamed or restored from backup between seasons (which is what the user had done — advanced their save into season 2 and saved it under a new filename) silently forks into a second, unrelated one-season dynasty instead of adding a season to the existing one. New "Relink Save File" button on the Dynasty page, plus automatic detection on the normal import flow that offers to link a picked file to an existing same-team dynasty instead of creating a duplicate — both paths guarded by a team-match check before ever touching data. Verified against real save data in an isolated test database: relinking correctly merges into one dynasty with both real seasons present, and relinking to a different team's save is correctly rejected with no data changed. Full details in `DevLog.md`.
- **v2.46** (2026-07-16): Multi-season correctness pass — real season-stats bug fixed, one persistent app-wide season switcher. User asked for confidence the app holds up across a 30-season dynasty and provided a real save (Miami, season 2 mid-season) to verify against. Investigation (isolated test databases throughout, never the user's live data) found season identity, re-import dedup, and player/coach career accumulation were already solid, but found and fixed two real problems: (1) `extract-stats.ts` hardcoded slot 0 of Player's 18-slot `SeasonStats` history array as "this season," but each slot carries its own `SEAS_YEAR` — any player past their first tracked season silently showed a stale prior season's stats (confirmed on the real save's starting QB, whose real 216-attempt/1636-yard current season was sitting invisible in slot 1). Fixed to pick whichever populated slot has the highest `SEAS_YEAR`. (2) The same season-dropdown pattern was duplicated across 8 pages, easy to miss and not shared between pages — replaced with one persistent dropdown next to "Exports," backed by a new `SelectedSeasonProvider` context, also extended to "Team Hub" (previously current-season-only) per the user's choice. Live-verified with a synthesized second season: the Coaches page's "Imported Resume" correctly summed to a real 2-season total (8-4) for every staff member once more than one season existed, confirming the cross-season accumulation the user was unsure about was already working — it just hadn't had a second season to prove it yet. Full details in `DevLog.md`.
- **v2.45** (2026-07-16): "Current Portrait" broken-image bug fixed. `PortraitPicker.tsx`'s small "Current Portrait" preview reconstructed a file path from the bare asset name, hardcoding a single `_result.png` suffix — but 887 of 25,527 real portrait files (~3.5%) are actually saved with a doubled `_result_result.png` suffix, so those specific portraits rendered as a broken image in that one preview spot (search-grid thumbnails were unaffected since they use the real on-disk path returned by the backend). Fixed with a one-shot `onError` fallback to the double-suffix filename. Verified live against the exact broken asset from the user's report. Full details in `DevLog.md`.
- **v2.44** (2026-07-16): Real in-game portrait bug fixed — the editor was writing `GenericHeadAssetName`, a descriptive string the game engine doesn't appear to render from. User reported a portrait change that updated this app's own preview but not the actual in-game face after loading the save. Decompressed the real CFB27 schema and cross-referenced every candidate field against a real save: `PLYR_PORTRAIT` (a plain int) is the field that actually drives the in-game 2D portrait, confirmed to equal the `Generic_<N>_` filename sequence number exactly for 7,243/7,244 real players. `writePlayerFields` now sets both fields together; verified with a genuine save → close → fresh reopen round trip, not just an in-memory check. Deliberately scoped down after presenting the findings and letting the user choose: fixed `PLYR_PORTRAIT` for Player only; left `PLYR_GENERICHEAD` (the likely 3D head-model field — only ~313 discrete templates for 5,040 portraits, strict enum, real risk of an invalid-value save failure) and the Coach-side equivalent (`Coach.Portrait` showed an unexplained `+10`/`+0` split across real coaches, not confidently fixable yet) as known follow-ups rather than guessed at. Full details in `DevLog.md`.
- **v2.43** (2026-07-16): Portrait Picker follow-up — filters, lightbox, pagination. Direct user feedback on the just-shipped Portrait tab: thumbnails were too small and there was no way to narrow 25k+ portraits by look. Investigated first rather than guessing: decoded the `Generic_..._<LETTER>_<TIER>_<STYLE>` filename taxonomy via real image inspection (verified 5,040/5,040 player and 186/186 coach Generic filenames match), confirmed `TIER` tracks skin tone, and — since the `LETTER` axis wasn't visually obvious — cross-referenced it against real player Weight/Height/Position data from a save file to resolve it decisively as a body-build class (H=Heavy, D=Default, M=Muscular, T=Athletic, the user's own final labels). New `shared/portraitTaxonomy.ts` classifies any portrait key into type/build/skin-tone; `searchPortraits` now accepts filters + a page number and returns a real total count; `PortraitPicker.tsx` gained Type/Build/Skin-Tone dropdowns, larger thumbnails, numbered pagination, and a click-to-enlarge lightbox with `ArrowLeft`/`ArrowRight` keyboard navigation and a "Use This Portrait" confirm action. `Unique_*` portraits (20,486 of 25,527 player files) have no decodable structure, so the filter only narrows the Generic subset. Full details in `DevLog.md`.
- **v2.42** (2026-07-16): Player/Coach save-file editor — the app's first write-to-save-file feature. Edit icons on Roster, Recruiting, and Coaches open a full editor modal (Player Profile, Ratings — all 61 rating fields mapped to real schema names, Skill Group Caps, Mental Abilities, Physical Abilities, a searchable Portrait picker over the 25k-file local library) built on a confirmed-real `madden-franchise` write path (`record.Field = value` + `franchise.save()`). New "Backup Save File" button on the Dynasty page. Two real bugs caught only by testing the write path against a disposable save copy: `Coach.PresentationId` isn't unique (unlike Player's, separately verified) — a real collision between two different coaches was found, fixed by switching Coach's lookup key to `TeamIndex + Position`; and `CoachPrestige` turned out to be a letter-grade enum, not the plain int assumed — the real writable field is `CoachPrestigeScore`. A third bug (UI-only) was caught by screenshot: the modal initially rendered thousands of pixels off-screen because it was nested inside `<main>`'s `clip-path`, which creates a new CSS containing block for `position: fixed` — fixed by mounting it at the app root via a new `EditorModalProvider`/`EditorModalHost`, mirroring the existing player-bio modal's own architecture. Full details in `DevLog.md`.
- **v2.41** (2026-07-16): Corrupted-database recovery flow. Previously a corrupted/unreadable `dynasty-archive.sqlite` caused a silent quit with no explanation and no way back, since the long-dormant `backupDatabase()` (present since Phase 1) was never actually called anywhere. New `DatabaseCorruptedError` + `initDatabaseWithRecovery()` in `main.ts`: on a real open failure, the bad file is quarantined (renamed aside, never deleted) and a native dialog offers Restore Backup / Start Fresh / Quit; a backup checkpoint is now taken automatically after every successful startup, capped at the 10 most recent. Real bug caught only by testing (not code review): sql.js doesn't validate the file format until the first real query runs, so the original try/catch — wrapped around just the constructor — missed the actual throw point entirely and recovery silently did nothing. Fixed by widening the try/catch to cover the first `db.run()` calls too. Re-verified end-to-end with a real imported dynasty surviving a full corrupt → quarantine → restore cycle, and the Start Fresh branch independently confirmed to produce a genuinely empty database. Full details in `DevLog.md`.
- **v2.40** (2026-07-16): Phase I — Dev Mode token editor shipped, closing out the last undone item in the lettered UI/UX track. New navbar `DevTokenEditorMenu.tsx` edits every Phase A design token (spacing/radius/shadow/typography/motion) live, retheming the whole app in real time via the existing `applyDesignTokens()` and previewed in-panel through real Phase D components (`SurfaceCard`/`StatTile`). Drafts persist to `localStorage` (new `devTokenStorage.ts`, applied at boot) so edits survive a restart, but the app itself never rewrites `defaultTokens.ts` — a "Copy as TypeScript" button is the explicit export step, matching the phase's own "never live-rewrites source files" constraint. Verified with a scripted click test confirming a real CSS variable changed live and persisted correctly, then cleared before finishing. Full details in `DevLog.md`.
- **v2.39** (2026-07-16): Phase 11 (first slice) — HTML Export. New `htmlExport.ts` renders the already-shipped Program History data (record book, dynasty resume, coaching ledger, timeline, milestones) as one self-contained offline `.html` file — inline CSS, dark-mode aware, team-colored, no external assets. New `export:historyToHtml` IPC round-trip opens a native save dialog; new `Exports.tsx` page/route/tab triggers it. Deliberately just the single-file branch of the roadmap's much bigger Phase 11 spec — no roster/schedule/awards exports, no zip archives, no logos/charts yet, stated directly in the page copy. Verified against `DYNASTY-DYNASTYBOWL` via a temporary diagnostic branch (removed after use): real 19,089-byte export with correct record-holder data (Claude Mathis, 4,694 career rushing yards) matching figures already verified in the Phase 10 work. Full details in `DevLog.md`.
- **v2.38** (2026-07-16): Verified the Standings conference-champion trophy is already leaguewide, not user-conference-only. A mid-session handoff to Codex (Claude was briefly unavailable) ended on a claim that the extractor only captured the user's own team's title; direct inspection plus a real diagnostic import showed `extract-conference-championship.ts` already reads every conference unfiltered (confirmed CUSA/Pac-12/MWC/ACC/Big 12/MAC and more in one save) and `getStandings.ts` already passes the full array through — no code change needed, just correcting a stale claim before acting on it. One real caveat carried over: dynasties imported before this array-shaped snapshot existed still only show their own conference's trophy until re-imported. Full details in `DevLog.md`.
- **v2.37** (2026-07-16): Launcher now skips Electron's own splash window entirely in favor of the pre-splash-only path — `Launch CFB Dynasty Hub.bat` sets `USE_PRE_SPLASH_ONLY=1`; `main.ts` goes straight to the main window and signals the pre-splash HTA ready once *that* window is shown, instead of building a separate Electron splash first. Direct launches (`npx electron .`, diagnostics) are unaffected. Shipped by Codex during a brief Claude outage; backfilled into `DevLog.md` after the fact since it had no log entry. Full details in `DevLog.md`.
- **v2.36** (2026-07-16): Phase 5 follow-up #2 — Standings visual cleanup. Reduced redundancy on the new Standings page: conference tile is now logo-only (no repeated conference-name text), "Your Spot"/"Team Leader" cards replaced with aggregate "Record vs Non-Conference" and "Overall Record", the extra conference-name banner removed entirely, conference champions get an in-row trophy instead of separate context elsewhere, and the "Your Team" text badge was dropped in favor of row-color highlighting alone. `Independent`/`Unassigned` (default FCS schools with no real standalone conference standings) removed from the conference selector and presentation. Full details in `DevLog.md`.
- **v2.35** (2026-07-16): Phase 5 follow-up — Conference Standings shipped. New `getStandings.ts` groups the already-resolved `TeamData.conferenceName` and existing conference/non-conference record splits into a full standings payload — no new extractor needed. New `Standings.tsx` page/route/tab: season + conference switching, user-team highlighting, and an explicitly editorial sort (conference record → overall record → current AP rank → name) since the save exposes no deeper tiebreak engine. Full details in `DevLog.md`.
- **v2.34** (2026-07-16): Removed the roster skill-position badge (small indigo "Skill" tag next to a skill-position player) from both the gallery-card and table-row views in `Roster.tsx`, per direct request. The captain "C" badge is unaffected. Full details in `DevLog.md`.
- **v2.33** (2026-07-16): Phase 10 - Program History & Records, first shipped slice. Added a real `History` dynasty tab/route/page backed by a new `getHistory.ts` query and IPC round-trip, built from imported season snapshots rather than the still-unused normalized history tables. The page currently ships four honest slices of long-term history: (1) a season timeline with record, rankings, postseason outcome, and title/playoff badges; (2) a program resume summary (overall record, conference titles, playoff appearances, national titles, bowl wins, 10-win and undefeated seasons); (3) a coaching ledger aggregated by head coach across imported seasons; and (4) a record book covering passing yards, rushing yards, receiving yards, total touchdowns, tackles, and sacks, with both all-time leaders and best single-season marks. Important implementation choice: those statistical leaders are aggregated from per-game `gamelog` snapshots across imported seasons, not the save's `SeasonStats` slot array, because multi-year slot placement is still unverified and the app should not overclaim certainty there. Deliberately did not ship the roadmap's Legends Gallery / retired numbers / hall-of-fame layer yet, and every page note makes clear this history reflects imported seasons only, not magically the dynasty's entire lifespan if older years were never imported. Verified with `npm.cmd run typecheck` and `npm.cmd run lint`; `npm.cmd run build` was blocked by the already-known live `public/assets/playerportrait` file-conversion race (`ENOENT` during asset copy), not by the new History code. Full details in `DevLog.md`.
- **v2.32** (2026-07-16): Phase 5 follow-up — Conference Standings. Closed one of the last obvious schedule-track gaps without inventing any new save semantics: the app already had real conference membership (`TeamData.conferenceName`, resolved earlier by inverting `Conference.TeamSlots`) and real conference/non-conference record splits on each team snapshot, so a new `getStandings.ts` query could build standings directly from existing data with no new extractor or schema work. New `getStandings` IPC round-trip, new `Standings.tsx` page, new route, and a new dynasty-tab entry alongside Schedule/Coaches/Awards/etc. The page defaults to the user's own conference, supports season switching plus conference switching, highlights the user's team, and shows conference logo / conference record / overall record / current AP-Coaches-CFP ranks. Deliberately did **not** guess at hidden tiebreak logic: ordering is explicitly editorial and documented in the UI as conference record -> overall record -> current AP/Media rank -> team name, because the save exposes no deeper standings engine. Verified with `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`. Full details in `DevLog.md`.
- **v2.31** (2026-07-16): Phase 9 follow-up #2 â€” logo bug fixed, gold variant, persistent Lost section, sortable columns. The v2.30 logo showed a generic NCAA fallback because `signedTeamAssetName` held the save's raw `Team.AssetName` field (e.g. `"hurricanes"`), but this app's logo lookup is keyed by normalized *display* name â€” confirmed against the one other working caller (`Awards.tsx`'s `TeamLine`) rather than guessed. Fixed by dropping that field and using the already-correct `signedTeamDisplayName` for the logo lookup too. Wired in the previously-unused `public/assets/3d_logos/png_gold/` variant (143 files, flagged as dead weight back in the original 3D-logos phase) via a new `variant="gold"` prop on `TeamLogo`, applied to the Signed section only. Fixed a real UX regression from v2.30: stage sections were hidden entirely when empty (0 recruits), making "genuinely empty" indistinguishable from "broken" â€” user feedback confirmed this was actually confusing, not a preference call. Sections now always render with an honest empty state. Rebuilt each stage's rows into real sortable `<table>`s (Nat #/Pos #/City/State/Class/Style as independent columns, matching `Roster.tsx`'s existing `SortableHeader` pattern), verified genuinely interactive via scripted real clicks, not just present in the code. Full details in `DevLog.md`.
- **v2.30** (2026-07-16): Phase 9 follow-up â€” team logos + a real "Signed vs. Lost" correctness bug. User asked for each recruit's signed-team logo next to their name in the Signed/Lost sections; building it required a new leaguewide `playerId -> destination team` lookup over every real team's `Team.CommittedPlayers` list (verified with zero cross-team collisions across all 1,538 real signees before trusting it). That verification exposed that v2.29's original signed/lost split (based on `committedWeekNumber`) was wrong â€” real Miami signees were showing as "Lost" because that field is only ever populated pre-signing, never retroactively once a prospect reaches `'Signed'`. On the real Miami save the Signed count was undercounted by nearly half (2 shown vs. the real 11). Fixed `deriveStage()` to use the newly-resolved destination team instead. Re-verified against the real save: corrected counts (11 Signed, all with the right logo; 0 genuinely Lost on this particular board), position breakdown, and totals still summing correctly. Full details in `DevLog.md`.
- **v2.29** (2026-07-16): Phase 9 â€” Recruiting Pipeline. Investigated the real save's recruiting data before designing anything: the leaguewide `Recruit` table has 4,101+ rows (almost all irrelevant to one team), but the real per-team board lives at `Team.RecruitingBoard.Recruits`, a 35-slot array of `UserRecruitTarget` rows carrying this team's own offer status, NIL numbers, and commitment week, layered over each prospect's leaguewide `Recruit`/`Player` records. Confirmed directly that a signed recruit's `Player.TeamIndex` stays a sentinel `255` even after signing. Real bug found and fixed: `ProspectStarRating` is a string enum (`"ONE_STAR"`..`"FIVE_STAR"`), not numeric â€” silently produced `null` star ratings for every recruit before the fix. Board stages (Signed/Committed/Offered/Watching/Lost) are derived, not stored â€” "Lost" (signed with a *different* school) is a real case the original roadmap spec didn't anticipate. New "Recruiting" tab shows class summary stats (reusing the already-extracted `TeamData.topClassRank`, plus a newly-added `topClassConferenceRank`), a position breakdown, a real commitment timeline, and five stacked board sections â€” a static editorial layout rather than a literal drag-and-drop Kanban, since the data isn't user-editable from this app and there's no DnD library in the project. Deliberately did not build class-comparison-across-years or decommit tracking â€” neither is derivable from a single save snapshot, flagged as real limitations rather than faked. **Note:** the initial signed/lost classification shipped here was wrong â€” see v2.30 above for the fix; the original claim that "which team" was knowable from `CommittedWeekNumber` did not hold up under further verification. Full details in `DevLog.md`.
- **v2.28** (2026-07-16): Launcher pre-splash sizing fix + loading indicator. Same-day follow-up: the user caught the v2.27 pre-splash rendering oversized (an HTA quirk â€” neither `HTA:APPLICATION WIDTH`/`HEIGHT` nor a script-based `window.resizeTo` actually took effect, confirmed by direct testing, not assumed). Fixed with a new `scripts/force-resize-pre-splash.ps1` that forces the window to spshscr.png's real native size (868Ã—420 â€” read directly from the PNG's IHDR chunk) via the Win32 `MoveWindow` API from outside the HTA; `main.ts`'s `SPLASH_WIDTH`/`SPLASH_HEIGHT` updated to match so the real Electron splash is pixel-identical. Along the way, found that plain `FindWindow` returns null for this HTA window class even for an exact title match â€” worked around with `EnumWindows` + manual title comparison instead, confirmed side-by-side in a diagnostic script rather than guessed. Also added an indeterminate animated loading bar and cycling status text to the pre-splash itself, since that phase (before Electron has even started) has no real progress to report â€” distinct from the real Electron splash's genuine step-by-step bar. Verified via `GetWindowRect` before/after (exact 868Ã—420, not just "looks right") plus a full real-launch visual confirmation. Full details in `DevLog.md`.
- **v2.27** (2026-07-16): Launcher â€” instant pre-splash + real single-instance lock. User-reported: the launcher sat on a black screen for a long stretch before anything appeared, then the splash barely flashed before the app loaded. Root cause is a hard platform constraint (Electron can't paint until its own process finishes booting), not fixable by tuning the existing splash's display timing alone. Added `scripts/pre-splash.hta` â€” a Windows HTA shown the instant the launcher starts (moved into `hidden-relaunch.vbs` itself, ahead of the `.bat`'s own second hidden `cmd.exe`), rendering the identical splash image, polling a ready-flag file that `main.ts` writes the moment its own Electron splash becomes visible for a seamless same-image handoff, with a safety timeout so a startup failure never leaves it stuck. Also added a genuine `app.requestSingleInstanceLock()` â€” a real correctness fix, not just visual discouragement, for the user's stated worry about double-launching. Verified via real `Start-Process` launches of the actual `.bat` with full-desktop screenshots (not `capturePage()`, since none of this runs inside Electron) captured at multiple timestamps in one atomic run â€” confirmed continuous visible feedback with no gap and no premature close through the full boot sequence. Full details in `DevLog.md`.
- **v2.26** (2026-07-16): Phase 7 â€” Rankings & Visualizations. Directly investigated the save format before designing anything and confirmed it only ever stores 3 fixed poll data points per team (start-of-season/last-week/current) â€” no per-week history anywhere, including in `AdvanceSeasonWeekTransaction`, which looked promising by name but is a single-row state machine, not a log. A real week-by-week trend therefore can't be parsed out of one save; it has to be built by this app accumulating one snapshot per import as a dynasty's season progresses. New `ranking_history` table (migration v2, `UNIQUE(season_id, week)` + upsert â€” re-importing the same week corrects it rather than duplicating), populated via a new `computeLastPlayedWeek()` that derives the week from the user's own played games rather than trusting `SeasonInfo.CurrentWeek` (confirmed that field reads `0` once a season reaches OffSeason/PreSeason across 5 real saves, including a fully-completed one). New `getRankings.ts` + IPC round-trip mirroring `getAwards`'s existing pattern. New `RankingChart.tsx` â€” a hand-rolled SVG line chart (no new charting dependency) built per the dataviz skill: 3 fixed-order colorblind-safe series, an inverted rank axis, unranked weeks rendered as a labeled gap rather than a fake best-possible point, real hover tooltips, an always-present legend, and a "Show as table" accessible fallback. New `Rankings.tsx` page/tab with current/season-high stat tiles and a plain-language rank-vs-record summary (not a fabricated statistical correlation). Deliberately did not duplicate "Tournament Seeding" â€” that's already covered by the earlier `getTrophies.ts`/`TeamTrophies` work. Verified against real saves: a completed 14-2 Miami season correctly recorded week 20 (not week 0) with idempotent upserts confirmed by re-importing 3 times; a legacy pre-migration dynasty correctly showed zero history rows rather than fabricated data; chart rendering, hover tooltips, and the table toggle all confirmed via live screenshots and scripted DOM interaction before GUI verification became environment-flaky late in the session (traced to process/GPU-cache contention from repeated rapid launches, not the app â€” the fully headless import path kept working throughout). One low-risk item deferred to next session: the zero-history empty state was verified by code review only, not a live screenshot. Full details in `DevLog.md`.
- **v2.25** (2026-07-16): Phase 8 follow-up â€” Awards page structural redesign + global Player Profile Modal. Fixed a real data-mapping bug reported by the user (Jet Award/Paul Hornung Award labels were swapped â€” `MOST_VERSATILE` and `BEST_SR` had each other's real-world award name; root-caused against the actual save data, not guessed) and a second bug found during verification (missing `HeismanAwardRanking[]` table preload silently returned an empty Heisman finalist list). Restructured `extract-awards.ts` to source marquee winners and All-American/Conference selections leaguewide (not just the user's team) via `PlayerAward`, enabling real clickable `playerId`s. Centralized the 22-item annual-award display order in `src/shared/awardOrder.ts` (shared by extractor and renderer, no duplicated ordering). New `PlayerModalProvider.tsx` + `PlayerProfileModal.tsx` (global, app-root-mounted, focus-trapped, Escape-to-close) built on a newly-extracted `PlayerProfileContent.tsx` shared with the `PlayerDetail.tsx` route; wired into `Roster.tsx` with Prev/Next that respects the roster's current sort/filter/search order. `Awards.tsx` rebuilt: dedicated Heisman section, exact-order Annual Awards, a compact team honor-count summary, a full leaguewide All-American/Conference roster browser (Honor Type / Team Level / Conference dropdowns, conference logo, user's own conference defaulted first), and a Weekly Honors section with correctly-resolved (never the user's own team's) opponent logos. Interactive click/keyboard verification (not just screenshots) found and fixed two more real bugs: clicking almost any leaguewide award winner hit a bare "Player not found" (the local roster snapshot only covers the user's own team) â€” fixed with a graceful fallback profile (name/team/position/honors, explicit data-scope note) instead of a dead end; and Roster's table-view rows were mouse-only with no keyboard access â€” fixed with `tabIndex`/`role="button"`/Enter-Space handling. Verified via typecheck/lint/clean build plus live `capturePage()` screenshots and scripted DOM-interaction assertions (dialog open/focus-trap/Escape-close/focus-restore, Roster Prev/Next respecting sort order) against the real Miami save. Full details in `DevLog.md`.
- **v2.24** (2026-07-16): Phase 8 â€” Awards. First-ever investigation of the save's award data found it real and rich: `LeagueHistoryAward` (24 leaguewide marquee single-winner awards, player and coach both, no ref resolution needed) and `PlayerAward` (full team award ledger including All-American tiers and weekly honors, 36 distinct real `AwardType` strings enumerated exactly). Built a reasoned AwardType-to-real-trophy mapping against the previously-unused `public/assets/awards/` pack (38 files) for the 24 marquee types. New `Awards.tsx` page in the dynasty tab bar (Overview-Roster-Schedule-Coaches-**Awards**, not the old sidebar), plus real award chips on `PlayerDetail.tsx` replacing its placeholder empty state. Also cleaned up `Sidebar.tsx`'s stale "Planned Modules" list (Statistics was mislabeled "Soon" despite being live since Phase 6). Verified end-to-end through the real import pipeline plus a live screenshot of the rendered page. Full details in `DevLog.md`.
- **v2.23** (2026-07-16): First successful `npm run package` â€” untested since Phase 1. Found and fixed a real bug: `electron-builder.config.js` isn't a filename electron-builder auto-detects (needs to be `electron-builder.js`), so the config was silently never loading and its default output directory collided with webpack's own `dist/`. Renamed the file, added the missing `author` field. Hit a genuine Windows-permission blocker (rcedit's vendor archive needs symlink privilege regular accounts don't have) â€” not a code bug; the user enabled Developer Mode and packaging succeeded immediately after. Verified by launching the packaged portable `.exe` directly and confirming sql.js/madden-franchise bundled correctly inside app.asar. Output: `release/CFB Dynasty Hub 0.1.0.exe` (portable) and `release/CFB Dynasty Hub Setup 0.1.0.exe` (NSIS installer), both real artifacts kept on disk. This closes the last open item from Phase J. Full details in `DevLog.md`.
- **v2.22** (2026-07-16): Phase K â€” Integration pass, closing out the lettered UI/UX track. Three-audit sweep (persistence/corruption-resilience, dark-mode coverage, responsiveness/reduced-motion) found theme switching and responsiveness clean, but two real gaps: zero `prefers-reduced-motion` handling anywhere (fixed with one global CSS rule, since all 41 transition usages already run through the same token-backed Tailwind utilities) and no bounds validation on saved window position (fixed â€” a stale off-screen position from a disconnected monitor now falls back to centering instead of opening invisible). Also wrapped the one remaining unguarded localStorage write. Verified live: deliberately wrote a genuinely off-screen window-state.json and confirmed the app re-centered instead of vanishing. Full details in `DevLog.md`.
- **v2.21** (2026-07-16): Launcher rework â€” `Launch CFB Dynasty Hub.bat` now hides its console entirely (via a small `scripts/hidden-relaunch.vbs` helper) so the splash screen is the first thing visible, and skips the full webpack rebuild on launches where nothing under `src/` has changed (mtime check), so the common case reaches the splash in ~1s instead of after a 15-20s rebuild every time. Failures now surface via a message box + log file instead of a silent console. Verified with real launches (fast + slow path) via `Start-Process`. Full details in `DevLog.md`.
- **v2.20** (2026-07-16): Phase J (splash screen only, Phase I skipped for now by user choice) â€” a genuinely separate frameless `BrowserWindow` shown on launch before the main window, with progress tied to real startup stages (DB init â†’ workspace prep â†’ hub ready), not a fake timer. Splash graphic (`spshscr.png`) is a plain swappable file with no code tie-in. New 4th webpack config for the splash's own preload bundle. Verified via a `capturePage()` diagnostic screenshot mid-progress. Full details in `DevLog.md`.
- **v2.19** (2026-07-16): Phase H â€” coach alma mater (a plain `TeamIndex`, not a franchise reference; resolved against the teams snapshot) plus captain/skill-position roster badges (`Roster.tsx`), a new Head Coach summary on `DynastyOverview.tsx`, and a new dedicated Coaches page/route/nav tab. New `getCoaches.ts` DB query and IPC round-trip. Verified end-to-end through the real import pipeline against `DYNASTY-DYNASTYBOWL`. Full details in `DevLog.md`.
- **v2.18** (2026-07-16): Schedule table refinement â€” Type column drops its text label and bumps the logo to 32px to match the Opponent team-logo size; Broadcast column removed (save data too coarse to be accurate); Location column widened with a stadium/city-state wrap that breaks at the venue boundary instead of an arbitrary word. Full details in `DevLog.md`.
- **v2.17** (2026-07-16): Removed the redundant Home/Away badges from the schedule Location column and game-detail header â€” real stadium/city already implies who's hosting. "Neutral Site" badge kept (no venue data exists for those games). Full details in `DevLog.md`.
- **v2.16** (2026-07-16): Editable stadium database â€” new `StadiumDataProvider.tsx` (localStorage overrides, mirrors `ThemeProvider.tsx`'s pattern, global app data not per-dynasty) layered on top of the existing 137-team `DEFAULT_TEAM_STADIUMS` table, plus a new `StadiumDatabaseMenu.tsx` glass panel (searchable team list, edit/save/reset-to-default, add a team not in the defaults, reset-all) in the navbar immediately right of Preferences. Direct response to the Fresno State research error caught last session â€” lets a user fix a wrong stadium or move a custom team without a code change. `scheduleFormat.ts`'s `getLocationDisplay` now takes the resolver as a parameter instead of importing `stadiumData.ts` directly, keeping it context-free. Full details in `DevLog.md`.
- **v2.15** (2026-07-16): Schedule Type column decluttered (conference games show logo-only, plain non-conference/non-bowl/non-rivalry games go blank) and rivalry games now called out using the save's own real named rivalries (new `extract-rivalries.ts`, reading `Team.Rival1/2/3TeamRef` + the `Rivalry`/`Rivalry[]` tables â€” verified against Ohio State/Michigan and Texas State/UTSA's real "I-35 Rivalry"). Location column gains real-world stadium/city data (138 FBS teams, researched externally per the save having zero venue data â€” confirmed again this session) via new `stadiumData.ts`. One bug caught and fixed: named-rivalry resolution initially failed because the array table is literally named `Rivalry[]`, not `Rivalry` â€” the same class of bug as an earlier `SeasonStats[]` incident. Full details in `DevLog.md`.
- **v2.14** (2026-07-16): CFP playoff art (5-image set, re-verified after the folder was simplified mid-project) wired into the schedule/game-detail Type display and the Overview postseason-appearance badge; conference logos (`public/assets/conf/`, inconsistent per-conference naming requiring an exact verified table) now shown in the schedule's Type column in place of plain "Conference" text. Postseason-appearance detection broadened to cover every CFP round + the national championship, not just literal bowls, picking the furthest round reached. Full details in `DevLog.md`.
- **v2.13** (2026-07-16): Dark/light-adaptive 3D logos (`png_OL`/`PNG_OD` â€” note the inconsistent real casing) plus team championship trophies (national/conference/bowl-win) and a bowl-appearance badge on Season Overview, driven by real save data via a new `extract-conference-championship.ts` extractor and three new asset drops (`confchamp/`, `bowlgames/`, `playoffs/`). Verified against real 2026 results: Ohio State's National Championship, Texas State's own Alamo Bowl win. Full details in `DevLog.md`. Individual awards and CFP bracket graphics unused this pass; an unrequested `png_gold` logo variant exists but isn't wired up.
- **v2.12** (2026-07-15): Premium 3D logos wired in as the preferred source at every size (flat NCAA logos kept as fallback for uncovered teams â€” the dual-source path the logo-upgrade section anticipated); standardized `TeamLogo` to 3 sizes (100/50/25%); bumped the schedule's sub-25% logo to the 25% floor and enlarged schedule rows + text one tier to match while keeping hierarchy. Files: `src/renderer/lib/assetMapping.ts` (new `TEAM_3D_LOGOS` map, 143 entries, generated with an override table for the 3D naming convention), `src/renderer/components/common/TeamLogo.tsx`, `DynastyOverview.tsx`, `Dashboard.tsx`, `Schedule.tsx`. Verified: typecheck/lint/build clean; 8 representative resolutions (3D hits, game-abbreviation aliases â†’ 3D, FCS placeholder â†’ 3D art, no-3D teams â†’ flat fallback, unknown â†’ generic) all point at files that exist; 144 PNGs confirmed copied into the build output.
- **v2.11** (2026-07-15): Phase D consolidation pass â€” extracted the copy-pasted glass surface (6 sites), label-above metric tile (3 sites), and angular clip-path formula (2 sites) into a shared `components/ui/` library; fixed a corrupted UTF-8 separator byte in the roster card. Pure no-visual-change refactor, verified byte-identical.
- **v2.10** (2026-07-15): Deepened the Preferences panel dark-mode materials so the shell, sections, and option rows read as true dark surfaces instead of washed-out translucent light cards.
- **v2.9** (2026-07-15): Fixed the Preferences panel dark-mode sync by binding a local dark ancestor to theme appearance state, keeping the menu surface aligned with the active shell theme.
- **v2.8** (2026-07-15): Restored the stronger localized Preferences blur/tint, removed the overview logo frame, simplified dashboard cards to team-gradient logo-first layouts, and added a typed `--team-primary-rgb` token for reusable renderer gradients.
- **v2.7** (2026-07-15): Applied the angular shell follow-up from the `References/` direction, removed rounded corners and workspace filler copy, fixed dark-mode select readability, anchored the background, and added current W/L data to dashboard cards.
- **v2.6** (2026-07-15): Added a localized blur-and-tint underlay to the Preferences panel so glass styling stays readable over dense page content, and documented the rollback backup for the follow-up.
- **v2.5** (2026-07-15): Removed internal visual-direction copy from user-facing surfaces, completed the premium page sweep across dashboard/import/overview/roster/schedule/detail pages, and documented the new rollback backup set.
- **v2.4** (2026-07-15): Added the internal visual direction to the roadmap and documented the first app-shell overhaul pass plus rollback backups.
- **v2.3** (2026-07-15): Phase G Preferences & Theme menu initial implementation documented in-roadmap; added the standing change-handoff update rule so future feature work records scope, issues, fixes, and verification.
- **v2.2** (2026-07-16): Added UI/UX Overhaul Initiative (Phases A-K) to Parallel Workstreams â€” design tokens, theme resolution, motion system, shared component library, shell restructure, Preferences menu, coach/captains features, Dev Mode token editor, splash screen/launcher. Independent of the numbered Phase 6+ track.
- **v2.1** (2026-07-14): Enhanced extractors + NCAA logos + detailed Phase 0-2 specs
- **v2.0** (2026-07-14): Desktop + local-first architecture, Electron + SQLite
- **v1.0** (Earlier): Web-based Next.js + Supabase approach













