# Claude Code Prompt: DynastyOS Coach Hub Premier UX Refactor

## Mission

Refactor the existing DynastyOS Coach page from one long, undifferentiated scroll into a fast, cohesive Coach Hub with five substantial destinations:

`Overview · Season · Career · Staff · Legacy`

The result must feel like a premier college-football coaching command center: cinematic, information-rich, easy to examine, quick to navigate, and unmistakably DynastyOS.

This is not permission to scatter the current sections across five thin pages. Each destination must answer a distinct coaching question, have its own editorial hierarchy, and contain enough meaningful analysis to feel complete.

Work in phases. Keep the application usable and validated after every phase. Inspect repository instructions and existing components before changing code. Preserve unrelated user work.

---

## Critical data constraint

**Do not display draft picks or first-round draft picks anywhere in the Coach Hub.**

The game does not provide dependable draft-pick data for this experience. Do not infer it, estimate it, preserve the existing Draft Picks tiles, or substitute another value under the same label.

Remove these existing Coach page metrics from the rendered experience:

- Draft picks
- First-round picks

If related fields remain in shared types for compatibility elsewhere, they may remain untouched unless removal is clearly safe. The Coach Hub must not render them.

Only show facts supported by real imported or stored DynastyOS data. If a proposed national rank, award relationship, recruiting measure, historical split, or milestone cannot be computed reliably, omit it and preserve the layout without inventing a placeholder statistic.

---

> **Amendment — 2026-08-02, user direction (supersedes this section's navigation rules).**
> Hall of Legends **is** a tab in the Coach submenu's glider, not a separate
> right-aligned button. The button has been removed. And the **Legacy**
> destination is now **Coaching Tree** — the page is the tree, so the tab says
> so; program imprint and the milestone timeline are not part of it.
> Everything else below still stands, including "do not rebuild Hall of
> Legends" and "do not add a second Hall button inside every subpage".

## Existing Hall of Legends

The Hall of Legends already exists in:

- `src/renderer/pages/HallOfLegends.tsx`
- Route: `/dynasty/:id/hall`

Do not rebuild, duplicate, or redesign that page as part of this work.

Replace the current two-item `PairLayout` treatment with the new Coach Hub navigation. Add one clearly separated **Hall of Legends** button at the far right of the Coach submenu:

```text
Overview   Season   Career   Staff   Legacy                 Hall of Legends
────────────────────────────────────────────────────────────────────────────
```

The five Coach destinations belong to the primary glider navigation. Hall of Legends does not: it is a cross-coach comparison destination rather than a section of the current coach’s profile.

Requirements for this button:

- Keep the existing `/dynasty/:id/hall` route.
- Use the existing visible label, **Hall of Legends**.
- Place it at the far right of the sticky Coach submenu on desktop.
- Visually separate it from the five glider items using spacing, not a competing navigation rail.
- Use an existing low- or medium-emphasis button/link treatment.
- On narrow layouts, keep it accessible after the Coach destinations, wrapping or moving into a clearly labeled trailing action area. Do not hide it behind an unexplained icon.
- Do not add a second equally prominent Hall button inside every subpage.

---

## Current implementation context

Inspect these files completely before implementation:

- `src/renderer/pages/CoachHub.tsx`
- `src/renderer/pages/HallOfLegends.tsx`
- `src/renderer/components/common/CoachCard.tsx`
- `src/renderer/components/common/CoachPortrait.tsx`
- `src/renderer/components/common/ScandalsModal.tsx`
- `src/renderer/components/common/CardBookModal.tsx`
- `src/renderer/components/ui/GliderNav.tsx`
- `src/renderer/components/ui/SegmentedControl.tsx`
- `src/renderer/components/ui/SurfaceCard.tsx`
- `src/renderer/components/ui/StatTile.tsx`
- `src/renderer/styles/globals.css`
- `src/renderer/app.tsx`

Important existing behavior and systems to preserve:

- Team-aware theme variables
- Light and dark themes
- DynastyOS typography roles
- Glider navigation language
- Hairline section separation instead of excessive boxed panels
- Cut-corner visual language used with restraint
- Existing duration and easing tokens
- Existing reduced-motion behavior
- Coach editing behavior
- Scandals modal behavior
- Cardbook modal behavior
- Global selected-season behavior
- Current coach, staff, schedule, team-stat, history, and coaching-tree data contracts

Do not add a new animation package, design system, charting dependency, or data-fetching library solely for this refactor.

---

## Experience model

Each destination answers one primary question:

1. **Overview:** How am I doing right now?
2. **Season:** What is happening this year?
3. **Career:** What have I accomplished?
4. **Staff:** Who is helping build the program, and how are their units performing?
5. **Legacy:** What lasting impact have I created?

### Information ownership

| Information | Primary destination | Overview treatment |
|---|---|---|
| Current role and identity | Overview | Full |
| Current record and job security | Overview | Full |
| Contract | Overview | Full |
| Current-season trends and splits | Season | Short teaser only |
| Career record and championships | Career | Headline only |
| Current coordinators | Staff | Compact snapshot |
| Staff history and continuity | Staff | None |
| Coaching tree | Legacy | Latest branch or count only when inexpensive |
| Career journey by school and role | Career/Legacy | One recent milestone |
| Recruiting success | Season/Career | Current summary only when reliable |
| Players developed to maximum | Career/Legacy | One supporting metric |
| Draft picks | Nowhere | Never render |
| Scandals | Modal action | More/Actions menu |
| Cardbook | Modal action | More/Actions menu |

Every major fact should have one primary home. Overview may tease deeper information, but it must not duplicate entire sections from the other destinations.

---

## Shared page-composition rule

Every destination should use the same editorial rhythm:

1. **Headline:** one dominant answer, comparison, or visual
2. **Analysis:** two to four meaningful sections with context and trends
3. **Detail:** tables, timelines, expandable rows, or drill-down actions

Do not begin every page with a wall of equally weighted `StatTile` components. A premier experience establishes hierarchy. Raw totals should be contextualized through percentages, comparisons, trends, ranks when genuinely available, or concise editorial sentences.

Use empty states only when they help the user understand how the page will grow. Do not create large empty panels for unsupported or unavailable statistics.

---

# Phased implementation

## Phase 0 — Audit data truth, current behavior, and baseline

Do not change visible behavior yet.

1. Read the repository instructions and relevant files.
2. Record the current Coach page behavior, route behavior, selected-season behavior, editor actions, Cardbook modal, Scandals modal, and Hall of Legends link.
3. Inventory every data request currently started by `CoachHub`.
4. Identify which data belongs to:
   - Shared Coach shell
   - Overview
   - Season
   - Career
   - Staff
   - Legacy
5. Confirm which proposed metrics can be reliably derived from existing schedule, team stats, coaches, career, program history, recruiting, awards, and coaching-tree data.
6. Explicitly mark unsupported metrics and omit them from implementation.
7. Confirm that Draft Picks and First-Round Picks will be removed from the Coach UI.
8. Run the baseline:

```text
npm run typecheck
npm run lint
npm run build
```

Document pre-existing failures separately.

### Phase 0 deliverable

A short data-availability note containing:

- Reliable current-season metrics
- Reliable career metrics
- Reliable staff metrics
- Reliable legacy metrics
- Unsupported metrics being omitted
- Requests that can be deferred until a destination is opened

---

## Phase 1 — Build the Coach Hub shell and routes

Split the current monolithic `CoachHub.tsx` into a shared Coach layout plus five routed destinations.

Recommended route behavior:

- Existing `/dynasty/:id` remains Coach Overview so current navigation and deep links continue to work.
- Add stable routed destinations for Season, Career, Staff, and Legacy under a consistent Coach namespace or route structure that does not collide with existing Dynasty routes.
- Preserve `/dynasty/:id/hall` for Hall of Legends.

Create a cohesive shared layout, conceptually:

```text
CoachHubLayout
├── Coach submenu
│   ├── Overview
│   ├── Season
│   ├── Career
│   ├── Staff
│   ├── Legacy
│   └── Hall of Legends action
├── Compact shared coach identity when appropriate
└── Outlet
```

### Navigation

- Use `GliderNav` for the five Coach destinations.
- Keep the submenu sticky within the content area when useful.
- Place Hall of Legends at the far right outside the glider.
- Support browser back/forward and direct links.
- Preserve the global season selector.
- Do not store the selected destination only in local component state when a route provides better navigation semantics.

### Shared identity

- Overview receives the full cinematic coach hero.
- Other destinations use a compact coach masthead or identity line rather than repeating the full portrait hero.
- Keep the coach name, role, team, and selected-season context visible without consuming a large portion of every page.

### Code structure

Use cohesive components rather than one giant file or dozens of one-use fragments. A reasonable direction is:

```text
pages/coach/
  CoachHubLayout.tsx
  CoachOverview.tsx
  CoachSeason.tsx
  CoachCareer.tsx
  CoachStaff.tsx
  CoachLegacy.tsx
  coachMetrics.ts
  coachData.ts
```

Treat this as guidance, not an instruction to manufacture abstractions.

### Acceptance criteria

- Five Coach destinations exist and are routable.
- Hall of Legends remains at `/dynasty/:id/hall` and opens from the right-aligned button.
- Hall of Legends itself has not been rebuilt.
- The selected-season control continues to work.
- Coach editing, Cardbook, and Scandals remain accessible.
- Typecheck, lint, and build pass.

---

## Phase 2 — Build the Overview command center

Overview should answer: **How am I doing right now?**

### A. Refined coach hero

Reduce unused hero space while retaining the cinematic portrait.

Own these fields in the hero:

- Coach name
- Current role
- Current school
- Tenure at the school
- Current-season overall and conference record
- Job-security status

Use the right side for live context instead of empty space.

Move these into one restrained Actions/More area:

- Edit Coach
- Open Cardbook
- Scandals

Do not render Cardbook and Scandals as large competing hero buttons.

### B. Current pulse

Create one focused summary containing supported values such as:

- Overall record
- Conference record
- Current ranking when reliably available
- Recent form
- Job security
- Contract years remaining

Add one generated but factual editorial line, for example:

> Auburn is 8–5 in Golesh’s second season and finished 3–2 over its last five games.

Only generate sentences from confirmed values. Handle preseason and incomplete data naturally.

### C. Season trajectory teaser

Show a compact trend or recent-results strip using schedule data:

- Recent five games
- Current streak
- Scoring margin direction
- Important recent result

Link to Season for full analysis.

### D. Program performance snapshot

Show offense and defense together using the current team-stat and schedule data:

- Points per game
- Points allowed per game
- Yards per game
- Yards allowed per game
- Change from prior season when reliably computable
- National or conference ranks only if an existing trustworthy comparison dataset supports them

Do not present unsupported ranks.

### E. Staff snapshot

Show OC and DC compactly:

- Identity and role
- Tenure
- Unit points/yards
- Change from prior season when supported

Link to Staff.

### F. Career teaser

Show only:

- Career record
- Win percentage
- Bowl record
- Championships
- Best tracked season when computable

Do not show Draft Picks or First-Round Picks.

### G. Latest milestone

Use one meaningful supported event, such as:

- First season at current school
- Rivalry win
- Bowl win
- Conference championship
- Career-win threshold
- Former assistant becoming a head coach
- Top-five recruiting class

If determining this requires expensive Legacy data, load it after the primary Overview content or use a compact honest empty state.

### Acceptance criteria

- The hero is visually strong but materially shorter or better utilized.
- Overview fits the most important live coaching information into the first viewport at common desktop sizes.
- Full Career, Staff, and Legacy content is not duplicated.
- No draft-pick metric is visible.
- Typecheck, lint, and build pass.

---

## Phase 3 — Build the Season analysis page

Season should be the page users examine after each game or import.

The global season selector controls this destination, including historical seasons when their data exists.

### A. Season scorecard

Lead with supported values:

- Overall record
- Conference record
- Current/final ranking when available
- Win percentage
- Average scoring margin
- Postseason status
- Job-security evaluation for the selected current season where applicable

Do not create an opaque Coach Grade. If a future composite is introduced, every input and weighting must be visible.

### B. Performance trends

Create one meaningful visual or result strip using schedule/team data:

- Points scored and allowed by game
- Margin by game
- Offensive and defensive yardage when available per game
- Ranking movement only if historical ranking data exists

Prefer one well-designed selectable chart or aligned game strip over several disconnected charts.

### C. Record splits

Derive supported splits from schedule results:

- Home and away
- Conference and non-conference
- Ranked opponents when opponent-rank data exists
- Rivalries when rivalry identification exists
- One-score games
- Games decided by 14 or more
- Current/longest streak
- Bowl or playoff

Only render a split when it has a meaningful denominator.

### D. Signature results

Highlight supported results such as:

- Best win
- Toughest loss
- Largest margin
- Closest game
- Highest-ranked opponent defeated, when opponent ranking exists

Every game entry should open the existing game-detail experience rather than create another parallel detail surface.

### E. Unit report

Show offense and defense side by side with their coordinator:

- Points and yards per game
- Points and yards allowed per game
- Change from previous season
- Additional reliable unit metrics already present in team stats

### F. Recruiting summary

Use a compact executive summary only if the existing Recruiting data supports it reliably:

- Current class rank
- Commit count
- Best commit or class strength
- Top-five-class status

Link to the existing Recruiting destination for full detail. Do not duplicate its tables.

### G. Season timeline

Build a concise event list from confirmed events:

- Signature win
- Entered or finished in a ranking
- Bowl eligibility
- Rivalry outcome
- Championship appearance/win
- Postseason result

Do not manufacture events to fill the page.

### Acceptance criteria

- Season contains analysis, comparisons, and game context—not merely record tiles.
- The page behaves correctly in preseason, midseason, and completed-season states.
- Historical season selection does not show current-only contract claims as historical facts.
- Typecheck, lint, and build pass.

---

## Phase 4 — Build the Career résumé

Career should answer: **What have I accomplished?**

### A. Career headline

Show:

- Overall record
- Win percentage
- Record at current school
- Total tracked seasons
- Schools coached
- Roles held

### B. Achievement cabinet

Use existing trophy assets and real data for earned accomplishments:

- National championships
- Conference championships
- Playoff appearances/results
- Bowl victories
- Rivalry achievements where supported

Do not render prominent empty trophy slots for every unearned achievement.

### C. Career performance

Use reliable existing metrics:

- Bowl record
- Conference-championship record
- Playoff record
- Rivalry record
- Top-25 record
- Top-five recruiting classes
- Players developed to maximum
- Times fired, presented discreetly where contextually appropriate

Do not render Draft Picks or First-Round Picks.

### D. Season-by-season résumé

Create an expandable timeline or table with:

- Season
- School
- Role
- Overall record
- Conference record when available
- Final ranking when available
- Postseason result
- Championships

Selecting a season may reveal supported details such as best win, scoring margin, coordinators, and recruiting-class result.

### E. School and role splits

When the data supports multiple schools or roles, allow examination by:

- School
- Head Coach / OC / DC role
- Conference

Do not show empty controls for a coach with only one school or role.

### F. Career records and highs

Compute only reliable achievements:

- Best season record
- Most wins in one season
- Highest final ranking
- Longest winning streak
- Best scoring margin
- Best offense/defense by supported measures

### Acceptance criteria

- Existing Career Record and Career Résumé content is consolidated without repetition.
- Season rows are genuinely useful and drillable.
- Draft-related UI has been removed.
- Typecheck, lint, and build pass.

---

## Phase 5 — Build the Staff operations page

Staff should answer: **Who is helping build the program, and what impact are they having?**

### A. Staff hierarchy

Use a clear visual relationship:

```text
                         HEAD COACH

           OFFENSIVE COORDINATOR   DEFENSIVE COORDINATOR
```

Do not simply place unrelated cards in a generic grid.

### B. Coordinator summaries

Each coordinator needs:

- Portrait and identity
- Role
- Tenure at the school
- Total experience
- Alma mater
- Record while on this staff
- Current unit performance
- Change from previous season when supported

### C. Unit comparison

Create one shared comparison surface:

| Unit metric | Current | Previous | Change |
|---|---:|---:|---:|
| Points/game | 31.4 | 27.2 | +4.2 |
| Points allowed/game | 22.8 | 26.4 | -3.6 |

Only include supported metrics and ensure positive/negative direction is interpreted correctly for offense versus defense.

### D. Staff continuity

Derive supported context:

- Seasons together
- Current staff’s record
- Coordinator changes by season
- Combined experience
- Longest-serving assistant

### E. Staff history

Build a season-by-season timeline showing who held each role. When a former assistant appears in the coaching tree, link the departure to Legacy.

### F. Coordinator detail

Clicking a coordinator should open a focused modal or existing-pattern detail surface with:

- Career history available to DynastyOS
- Seasons on this staff
- Roles held
- Unit performance by year
- Edit action

Do not navigate away merely to inspect one coordinator.

### Acceptance criteria

- Staff feels like an organization, not two static cards.
- Unit ownership and performance are immediately understandable.
- Staff résumé calculations are shared and not recomputed independently in several components.
- Typecheck, lint, and build pass.

---

## Phase 6 — Build the Legacy experience

Legacy should answer: **What lasting impact have I created?**

### A. Legacy headline

Summarize real accomplishments without inventing a synthetic score:

> 12 seasons · 108 wins · 3 conference titles · 4 assistants promoted

Use only supported values.

### B. Coaching tree centerpiece

Promote the existing coaching tree from the bottom of a long page to the primary Legacy experience.

Show:

- Coaches produced
- Former assistants now serving as head coaches
- Their role under the user
- Seasons together
- School and role after departure
- Their later record only when reliably available

Use a responsive branching diagram when enough entries exist. With one or two entries, use a strong vertical lineage rather than a mostly empty diagram.

### C. Program imprint

For each school coached, show supported information:

- Seasons
- Record and win percentage
- Championships
- Best season
- Best ranking when available
- Recruiting success
- Players developed to maximum

Do not include draft picks.

### D. Coaching lineage

Highlight supported relationships:

- Longest-serving assistant
- Former assistants who became head coaches
- Most successful former assistant when record data exists
- Shared championships

### E. Milestone timeline

Build deterministic career events from real data:

- First season at a school
- Role change
- First bowl win
- Rivalry win
- Conference championship
- National championship
- Career-win thresholds
- Assistant promotion
- Top-five recruiting class

Use stable event IDs and one documented chronological sort. Do not merge event arrays ad hoc in JSX.

### F. Hall of Legends relationship

Do not add another large Hall button to Legacy. The persistent right-aligned Hall of Legends button in the Coach submenu is the primary path.

At most, Legacy may include a quiet inline sentence near relevant comparison content, but avoid redundant CTAs.

### Acceptance criteria

- Coaching tree is the centerpiece rather than an afterthought.
- Legacy grows gracefully from one tracked season to a long dynasty.
- No draft-related claims appear.
- Hall of Legends remains existing and separately routed.
- Typecheck, lint, and build pass.

---

## Phase 7 — Data architecture and performance

The current `CoachHub` starts current-season, dynasty-history, all-season staff, team-stat, schedule, and coaching-tree work from one page. Split request ownership by destination.

### Shared shell data

Load only what the layout needs:

- Dynasty/team identity
- Selected season
- Current coach identity

### Overview data

- Current season overview
- Current coaches
- Current schedule/team stats
- Current career headline if inexpensive or already part of the coach response

### Season data

- Selected-season schedule
- Selected-season team stats
- Only additional season datasets required by visible analysis

### Career data

- Program/career history
- All-season records required for résumé calculations

### Staff data

- Current staff
- Historical coach/schedule snapshots needed for staff résumés and continuity
- Unit data

### Legacy data

- Coaching tree
- Career milestones
- Historical school/role relationships

Do not load the entire coaching tree and all-season staff résumé data simply to open Overview unless a small Overview teaser genuinely needs it. If it does, load it after first paint or provide a lightweight summary API only when profiling proves the benefit.

### Reuse and caching

- Share current season schedule/team-stat results between Overview and Season.
- Share career history between Career and Legacy when both have been opened.
- Cache resolved results for the current dynasty/season during the session.
- Prevent late responses from an old dynasty or season from replacing current data.
- Do not add React Query or another dependency solely for this feature.
- Memoize expensive derived timelines, maps, splits, and comparisons—not trivial strings.

### Perceived performance

- Navigation reacts immediately.
- Shared identity and submenu remain mounted while destination content changes.
- Already visited destinations do not repeat unchanged IPC work.
- Use destination-shaped skeletons only when latency is visible.
- Do not blank the entire Coach shell behind a global spinner.
- Preserve layout height where practical so data arrival does not shift the navigation.

### Acceptance criteria

- Overview no longer waits on Legacy or Staff-history data.
- Repeated schedule/stat requests are shared or cached.
- Switching to a visited destination is immediate.
- Rapid season changes cannot show stale results.
- Typecheck, lint, and build pass.

---

## Phase 8 — Motion, responsive behavior, accessibility, and QA

### Motion language

Use the existing DynastyOS motion vocabulary:

- Existing fast/base/slow durations
- Existing enter/standard easing
- Glider navigation movement
- Existing restrained content entrance
- Existing modal scrim and panel behavior

Rules:

- The submenu glider explains destination changes.
- Destination content may use the established short fade and slight rise.
- The shared Coach shell and compact identity remain stable.
- Do not animate the full coach hero on every submenu change.
- Do not add long horizontal page slides, looping decoration, or bounce-heavy motion.
- Honor the existing reduced-motion clamp.

### Responsive behavior

Test:

- Wide desktop
- Standard laptop
- Narrow supported desktop window
- Light mode
- Dark mode
- Several team themes, including very bright and very dark primary colors

At narrow widths:

- Coach destinations may scroll horizontally as one glider row.
- Hall of Legends remains visibly labeled and accessible.
- Tables use responsive wrappers only when their columns truly cannot reflow.
- Staff hierarchy stacks without losing role relationships.
- Charts remain legible without internal page-level horizontal scrolling.

### Accessibility

- Use semantic links for routed destinations.
- Preserve visible focus states.
- Provide accessible chart summaries.
- Never rely on team color alone to communicate good/bad or selected state.
- Use tabular numerals for records and metrics.
- Ensure modal focus and Escape behavior remain correct for Edit Coach, Scandals, Cardbook, coordinator detail, and game detail.

### QA matrix

Test:

- Preseason with no games
- Midseason
- Completed season
- One tracked season
- Multi-season dynasty
- One school and multiple schools
- Head Coach and coordinator career roles
- No championships
- Multiple championships
- No coaching-tree entries
- One coaching-tree entry
- Large coaching tree
- Missing ranking/recruiting/unit data
- Rapid submenu switching
- Rapid season switching
- Cardbook, Scandals, Edit Coach, and Hall of Legends navigation

### Final validation

Run:

```text
npm run typecheck
npm run lint
npm run build
```

Then perform manual QA in the Electron application. A successful build does not prove that sticky navigation, chart resizing, modal layers, focus restoration, season changes, and perceived speed are correct.

---

## Code-quality constraints

1. Do not leave the old monolithic page commented out.
2. Delete dead sections, imports, helpers, and rendered draft metrics as replacements land.
3. Do not duplicate record formatting, tenure calculations, season splits, unit calculations, or timeline sorting.
4. Reuse `CoachCard`, `SurfaceCard`, `GliderNav`, shared typography, existing modals, and game-detail behavior where appropriate.
5. Refactor a shared component when its current outer framing prevents reuse; do not copy its markup.
6. Avoid both a single giant Coach file and dozens of tiny one-use components.
7. Do not add a generic abstraction with more configuration than the duplicated code it replaces.
8. Do not add dependencies without a demonstrated need.
9. Do not perform broad unrelated visual cleanup.
10. Do not infer unsupported data.
11. Never render Draft Picks or First-Round Picks in the Coach Hub.
12. Do not rebuild Hall of Legends.

---

## Reporting after each phase

After each phase, report:

1. What changed
2. Files changed
3. Data ownership or loading improvements
4. Validation performed
5. Remaining risks or intentionally omitted unsupported metrics

Do not claim performance gains without request-count evidence, timing evidence, or a clear removal of eager/blocking work.

---

## Definition of done

The refactor is complete when:

- Coach has five distinct, substantial destinations: Overview, Season, Career, Staff, and Legacy.
- The existing Hall of Legends page is reached through a right-aligned persistent button and has not been rebuilt.
- The original long-scroll Coach page no longer owns every section.
- Overview works as a concise current command center.
- Season provides meaningful trends, splits, unit analysis, and signature results.
- Career consolidates record and résumé information without repetition.
- Staff communicates hierarchy, continuity, and coordinator impact.
- Legacy makes the coaching tree and long-term program impact the centerpiece.
- Draft Picks and First-Round Picks do not appear anywhere in the Coach Hub.
- Unsupported metrics are omitted rather than inferred.
- Shared navigation, modal behavior, editing, selected-season behavior, light/dark themes, and team themes remain correct.
- Destination data is loaded only when needed and reused when already available.
- Motion feels controlled and continuous and respects reduced motion.
- Typecheck, lint, build, and manual Electron QA pass.

The finished Coach Hub should feel like a premier sports product: impressive at first glance, analytically rewarding on repeat visits, and fast enough that users explore it instinctively.
