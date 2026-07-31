# Claude Code Brief: DynastyOS Player Profile Premier UX Refactor

## Mission

Refactor the DynastyOS player profile modal from ten overlapping tabs into a fast, fluid, premier five-destination player workspace:

`Overview · Performance · Ratings · Journey · Cards`

This is an information-architecture and experience refactor, not a visual reset. Preserve DynastyOS's established identity: cinematic player presentation, editorial typography, team-aware accents, black/dark surfaces, restrained cut corners, hairline section dividers, glider navigation, and controlled motion.

The result should feel **premier**, not merely premium. Premier means:

- Immediate comprehension
- Confident hierarchy
- Purposeful motion
- Excellent keyboard and modal behavior
- Near-instant perceived response
- No redundant information or code
- No decorative clutter masquerading as polish

Work phase by phase. Keep the app functional at the end of every phase. Before modifying code, inspect the repository instructions, the relevant components, existing UI primitives, and current git state. Preserve unrelated user changes.

---

## Current implementation context

The main files already in use are:

- `src/renderer/components/common/PlayerProfileModal.tsx`
- `src/renderer/components/common/PlayerProfileContent.tsx`
- `src/renderer/components/common/PlayerCardTab.tsx`
- `src/renderer/components/common/CardGrid.tsx`
- `src/renderer/components/common/CardFocusModal.tsx`
- `src/renderer/components/common/ModalOverlay.tsx`
- `src/renderer/components/ui/GliderNav.tsx`
- `src/renderer/components/ui/SegmentedControl.tsx`
- `src/renderer/components/ui/SurfaceCard.tsx`
- `src/renderer/styles/globals.css`

Important existing behavior to preserve:

- The player modal is globally owned by `PlayerModalProvider`.
- Focus is trapped correctly and restored to the opener.
- Escape closes the profile.
- Left and right arrow keys move between players when focus is not in a form field.
- The teammate rail can be opened without leaving the modal.
- The selected profile destination survives Previous/Next player changes.
- The modal returns to Overview when opened as a fresh session.
- Player changes currently use the existing `content-enter` motion.
- `GliderNav` is the app's established navigation-selection treatment.
- `SegmentedControl` is the established treatment for switching modes within a destination.
- `SurfaceCard` and the global section-divider rules establish the app's non-boxy section rhythm.
- The app already honors `prefers-reduced-motion` globally.
- Multiple player cards already exist. `PlayerCardTab`, `CardGrid`, and `CardFocusModal` provide collection, creation, default selection, focus, editing, export, favorite, and delete behavior.
- Card records freeze their year and player profile when created. Do not weaken that rule.

Do not replace these systems with a new modal library, animation package, navigation primitive, card implementation, or parallel design system.

---

## Non-negotiable product decisions

### Primary navigation

Replace the current ten destinations with exactly:

1. Overview
2. Performance
3. Ratings
4. Journey
5. Cards

Use Cards as a normal `GliderNav` destination placed after Journey. It is a persistent player-owned collection, not a one-time action. Do not style it as a different kind of button beside the navigation.

The profile tab type should become conceptually equivalent to:

```ts
export type ProfileTab = 'overview' | 'performance' | 'ratings' | 'journey' | 'cards';
```

### Overview order

The Overview module order is:

```text
Player Profile      | Development
Season Snapshot     | Player DNA
Latest Journey Event (full width)
```

Player Profile and Season Snapshot are intentionally swapped from the first wireframe.

### Consolidation map

- Current `Stats`, `Career`, and `Game Log` become **Performance**.
- Current `Attributes` becomes **Ratings**.
- Current `History`, `Awards`, `Media`, and `Notes` become **Journey**.
- Current `Cards` remains a collection, moves to the final primary-nav position, and reuses the existing card system.

### Internal destination controls

Use the shared `SegmentedControl` for mode changes inside a destination:

- Performance: `This Season | Career | Games`
- Journey: `All | Milestones | Honors | Media | Notes`

Do not use a second glider nav for these controls. The distinction between navigation and mode switching is already encoded in the design system.

---

## Experience north star

The profile should answer these questions in order:

1. Who is this player?
2. How is he performing?
3. How good is he?
4. What has happened during his career?
5. What cards have I created for him?

Every visible element should help answer one of those questions. Remove legacy content that survives only because it existed in an old tab.

The hero remains cinematic, but the modal must not make the user repeatedly scroll past oversized empty space. Keep the player's portrait visually important while tightening the hero enough to expose meaningful content sooner.

Avoid repeating the same field in the hero and Overview. The hero should own identity essentials:

- Number
- Team
- Position
- Class
- Name
- Overall

Player Profile should own supporting identity:

- Height
- Weight
- Archetype
- Hometown
- Development trait, if it is not already required in the hero

Choose one owner for every field.

---

# Phased implementation

## Phase 0 — Baseline, contracts, and performance inventory

Do not change visible behavior yet.

1. Read the repository instructions and relevant source files completely.
2. Record the current modal behavior and verify:
   - Open and close behavior
   - Focus trap and focus restoration
   - Escape behavior
   - Previous/Next buttons
   - Arrow-key player navigation
   - Teammate rail
   - Tab persistence while changing players
   - Card focus modal layering
3. Identify every IPC request triggered by opening a player on Overview.
4. Identify which requests are needed for first paint and which exist only for inactive tabs.
5. Note obvious duplicate requests, especially season, roster, stats, schedule, award, and game-log reads.
6. Run the existing validation baseline:

```text
npm run typecheck
npm run lint
npm run build
```

If baseline checks already fail, document the pre-existing failures and do not silently mix them with this work.

### Phase 0 deliverable

A short implementation note listing:

- First-paint data
- Deferred destination data
- Duplicate calls to eliminate
- Existing behaviors that must remain unchanged

---

## Phase 1 — Establish the five-destination shell

Change the information architecture without redesigning all destination content yet.

### Required work

1. Replace the old `ProfileTab` union and `PROFILE_TABS` list with the five destinations.
2. Preserve controlled tab state in `PlayerProfileModal` so the chosen destination survives Previous/Next player changes.
3. Preserve the reset-to-Overview behavior when a new modal session opens.
4. Continue using `GliderNav` and `gliderItemClass` for primary navigation.
5. Render destination content through one explicit switch or destination map. Avoid ten independent `tab === ...` fragments scattered through a giant return block.
6. Reuse existing content temporarily:
   - Performance can initially compose existing season, career, and game-log sections.
   - Ratings can wrap the current attributes content.
   - Journey can compose current history, awards, media, and notes.
   - Cards must reuse `PlayerCardTab` unchanged unless a later phase requires a narrowly scoped adjustment.
7. Delete obsolete tab definitions and unreachable render branches once the new shell is working.

### Motion

- Keep the glider's existing measured movement and easing.
- Apply the existing `content-enter` treatment to the newly selected destination content.
- Do not animate the hero on every tab change.
- Do not use large horizontal page slides; they add travel, can imply browser navigation, and become tiring during rapid comparison.
- Do not add Framer Motion or another dependency.

### Acceptance criteria

- Exactly five primary destinations are visible.
- Cards appears after Journey.
- Previous/Next retains the selected destination.
- Closing and reopening starts on Overview.
- No regression to focus, Escape, arrow navigation, roster rail, or nested card modals.
- Typecheck, lint, and build pass.

---

## Phase 2 — Rebuild Overview around hierarchy, not tiles

Create the new Overview composition:

```text
Player Profile      | Development
Season Snapshot     | Player DNA
Latest Journey Event
```

### Player Profile

Show the compact supporting bio in a single editorial module. Do not return to six separate BioTile boxes.

Suggested content:

- Class and position context
- Height and weight
- Archetype
- Hometown
- Development trait if it is not shown in the hero

### Development

Reuse the existing development data and chart infrastructure.

Show:

- Current OVR
- Starting or previous tracked OVR
- Change over time
- Development trait
- A concise fallback when only one season exists

The chart should be the primary visual, not a row of summary boxes that repeats its values.

### Season Snapshot

Only display position-relevant statistics or categories in which the player has actual production. Reuse one shared stat-selection/formatting utility across Overview, Performance, and Cards where their rules genuinely overlap.

Do not show grids dominated by zeros. Do not show receiving statistics for a quarterback unless receiving production exists.

Include the latest game as secondary context and link the module to Performance.

### Player DNA

Create a concise evaluation summary from available ratings:

- Best relevant rating
- Largest relevant weakness
- Development priority
- Change since the prior tracked season when available

Do not invent qualitative labels when ratings are unavailable. Historical players whose live ratings cannot be read should receive an honest state, not synthetic analysis.

Centralize position-to-relevant-rating selection in one typed utility. Do not duplicate position maps inside Overview and Ratings.

### Latest Journey Event

Show one meaningful latest event when available. If no event exists, show a compact prompt to add a note or media item. Do not use a full-page empty state.

### Hero refinement

Tighten the hero enough to bring Overview content higher without losing the cinematic portrait. Reuse current typography, team theme variables, surfaces, cut-corner language, and edit action.

Avoid repeating Profile data in the hero. Keep the hero stable during destination changes.

### Acceptance criteria

- The requested Profile/Snapshot order is implemented.
- Identity information has a single owner.
- Overview is useful with zero games, one game, and a mature multi-season career.
- Position-irrelevant zero stats are suppressed.
- No new boxed-card wall is introduced.
- Typecheck, lint, and build pass.

---

## Phase 3 — Consolidate Performance with progressive disclosure

Build one Performance destination using the shared `SegmentedControl`:

`This Season | Career | Games`

Keep the selected Performance mode local to the destination. It does not need to become global provider state unless a demonstrated workflow requires it.

### This Season

Order:

1. Position-relevant headline statistics
2. Recent form when multiple games exist
3. Game log preview or full log depending on available space
4. Secondary production only when meaningful

### Career

Show:

- Career headline totals
- Season-by-season table
- Career highs or milestones only when enough data exists
- Development relationship where useful, without duplicating the full Overview chart

Do not reuse the exact This Season tile grid with a different heading. Career should emphasize comparison across time.

### Games

Use the game log as the index. Prefer expandable rows or the existing game-detail modal pattern rather than building another full navigation level.

Only show Best Game when at least two qualifying games exist. With one game, the game itself is not a comparative best.

### Code reuse

Extract and reuse shared formatting and row components only where they reduce real duplication:

- Position-aware stat selection
- Stat value formatting
- Game result formatting
- Game-row presentation

Do not create a generic abstraction whose prop surface is larger than the repeated code it replaces.

### Acceptance criteria

- Stats, Career, and Game Log no longer exist as primary destinations.
- All their useful behavior exists in Performance.
- One-game and zero-game states do not show misleading Best Game content.
- Switching Performance modes feels immediate and does not refetch unchanged data.
- Typecheck, lint, and build pass.

---

## Phase 4 — Turn Attributes into decision-oriented Ratings

Rename Attributes to Ratings in user-facing language.

### Ratings summary

Lead with Player DNA:

- Best relevant rating
- Weakest relevant rating
- Development priority
- OVR change when tracked history exists

### Detailed ratings

Order:

1. Position-specific ratings
2. Athletic/physical ratings
3. Durability and awareness
4. Secondary ratings

Initially show the decision-relevant groups. Provide a clear **View all ratings** disclosure for the complete raw grid.

Continue sourcing definitions from `RATING_SECTIONS` and `playerEditorFields`. Do not create a second set of rating labels, abbreviations, or keys.

Respect the existing rule that live ratings are only available from the current save state. Historical profiles must show a concise honest explanation.

### Acceptance criteria

- The primary destination is named Ratings.
- Player DNA and the detailed grid use the same rating-selection utility.
- Full raw ratings remain accessible.
- The first view is not a wall of identical boxes.
- Typecheck, lint, and build pass.

---

## Phase 5 — Build Journey as one chronological career narrative

Combine History, Awards, Media, and Notes into Journey.

Use `SegmentedControl`:

`All | Milestones | Honors | Media | Notes`

### Canonical event model

Create one typed presentation model for the timeline, for example:

```ts
type PlayerJourneyEvent = {
  id: string;
  kind: 'milestone' | 'honor' | 'media' | 'note';
  seasonYear: number | null;
  week?: number | null;
  occurredAt?: string | null;
  title: string;
  detail?: string | null;
  media?: MediaItemResolved;
};
```

Use stable IDs and one deterministic reverse-chronological sort. Do not merge arrays ad hoc in JSX.

### All

Show a balanced chronological timeline. Avoid flooding it with low-value events. A meaningful note, award, debut, OVR milestone, position change, or tagged media item belongs; every routine game does not.

### Milestones

Reuse existing history/milestone logic, but ensure expensive career-game analysis is loaded only when Journey requires it.

### Honors

Combine team awards, national awards, All-American selections, and weekly honors using existing award-formatting helpers.

### Media

Reuse `MediaGallery`. Do not duplicate gallery or lightbox behavior.

### Notes

Reuse `PlayerNotesTab` behavior. If its markup needs to fit Journey, separate its reusable content from tab-specific outer framing rather than copying it.

### Empty states

Use compact, actionable states inside the destination:

- Honors: no honors yet
- Media: attach or tag a photo/highlight
- Notes: add the first scouting note

Do not restore four separate full-page empty tabs inside Journey.

### Acceptance criteria

- Awards, Media, Notes, and History no longer exist as primary destinations.
- All useful actions and content remain accessible through Journey.
- Timeline sorting is deterministic.
- Journey does not load its expensive historical datasets before it is opened.
- Typecheck, lint, and build pass.

---

## Phase 6 — Present Cards as a premier collection

Cards is the fifth primary destination. Reuse the current multiple-card system rather than rebuilding it.

### Preserve

- Lazy creation of the first saved card
- Legacy card adoption
- Frozen season and player identity per card
- Equal-sized collection tiles
- Default-card radio behavior
- Favorite state
- Focus modal
- Photo framing
- Stat and layer editing
- Export and delete behavior
- Card-to-card navigation

### Refine only where needed

- Ensure the collection has a clear destination heading and card count after the collection has loaded.
- Keep the existing equal-card grid; do not introduce a featured-card hero that makes the remaining cards look secondary.
- Keep Add Card as the intentional empty-cell plus treatment unless usability testing demonstrates it is being missed.
- If a labeled Create Card action is added for accessibility or discoverability, do not duplicate creation with multiple equally prominent controls.
- Keep destructive and single-card actions inside `CardFocusModal`, where the selected card is unambiguous.
- Continue using the existing modal layering system so the focused card appears correctly above the player profile.

Do not fetch or render the full card collection merely to decorate the primary tab label. Use `Cards` as the stable tab label. If a count is later required in the tab itself, add a lightweight count source rather than loading photo-heavy card records on modal open.

### Motion

- Retain the existing restrained tile lift.
- Use the established modal scrim/panel entrance for card focus.
- Do not add pointer-tracked glare, looping effects, or showpiece animation.
- Keep editing attached to the card with local, immediate visual feedback.

### Acceptance criteria

- Multiple cards remain fully supported.
- Cards is the last primary destination.
- Opening and closing CardFocusModal preserves player-modal state and focus behavior.
- No card data is loaded until Cards is opened, unless already cached during the current modal session.
- Typecheck, lint, and build pass.

---

## Phase 7 — Data architecture and performance pass

The current profile component starts several all-season requests even when the user only views Overview. Refactor this deliberately.

### Loading tiers

#### Tier 1: first paint

Load only what is needed to establish the player and render the hero:

- Requested/current season roster resolution
- Player identity
- Current-season stats required by the hero or Overview
- Team identity/theme

Do not gate the hero on awards, every historical roster, every historical stat line, media, notes, cards, or all career games.

#### Tier 2: Overview enhancement

Load in parallel after core identity is available:

- Development history
- Current-season game log/latest game if needed by Overview
- Ratings summary only when available without blocking the hero

#### Tier 3: destination data

Load on first destination activation:

- Performance Career: historical stats and seasons
- Performance Games: full required game/schedule data
- Ratings: live editor ratings
- Journey: awards, milestones, media, and notes as required by the active filter
- Cards: card records and photo paths

### Request ownership

Create a small, explicit player-profile data layer rather than leaving unrelated effects in one 1,900-line component.

A suitable shape is a small set of focused hooks or resource modules such as:

- Core player/season resolution
- Performance data
- Ratings data
- Journey data
- Card data remains inside `PlayerCardTab`

Share resolved core data downward. Do not let Overview and Performance independently request the same current roster, stats, schedule, or game log.

Use React state, refs, memoization, and a small request cache if necessary. Do not add React Query or another dependency solely for this modal.

Cache promises/results by stable keys such as dynasty, player, and season for the lifetime of the open modal where it prevents repeated IPC calls. Invalidate when those keys change. Never allow an older player's late response to replace the newly selected player's state.

### Render performance

- Memoize genuinely expensive derived arrays, maps, timeline merges, and rating selections.
- Do not memoize trivial strings or tiny JSX fragments.
- Keep the hero mounted during destination changes.
- Avoid recreating large card or media structures while unrelated state changes.
- Use stable keys; never use array indexes for cards, journey events, games, or seasons.
- Keep photo transforms local while dragging and persist only on commit, matching the existing card editor behavior.
- Avoid layout-measurement loops beyond the existing `GliderNav` measurement.

### Perceived performance

- The modal shell and hero should appear as soon as core player data resolves.
- Destination skeletons should match the final layout and be used only when latency is perceptible.
- Avoid a global spinner that blanks the already-known hero.
- Never shift the hero or navigation when destination data arrives.
- Prefetch only the most likely next data after idle time if profiling shows a real benefit. Do not eagerly recreate the current all-tab load under the name of prefetching.

### Performance targets

Use these as engineering targets, measured in the packaged or production build where practical:

- Modal shell responds to the click in the next frame.
- Already-available hero content paints without waiting on inactive destinations.
- Switching to a previously visited destination is immediate and does not repeat IPC work.
- Tab interaction remains visually responsive under rapid switching.
- Player Previous/Next does not show stale content from the prior player.
- No unnecessary full card images are decoded outside Cards.

Document before/after request counts for opening Overview. Favor evidence over adding complexity for theoretical optimization.

---

## Phase 8 — Modal, motion, accessibility, and premier-polish QA

### Modal behavior

Verify all of the following:

- Profile uses the existing `ModalOverlay`/layer system.
- Focus begins on the dialog, remains trapped, and returns to the opener.
- Escape closes the topmost modal first.
- Card focus, export, confirmation, editor, and media overlays layer correctly.
- Clicking the profile scrim closes only when the actual scrim is clicked.
- Player arrows do not fire while typing in inputs, selects, or textareas.
- The teammate rail remains usable and does not reset the active destination.

### Motion language

Use only the established motion vocabulary:

- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- Existing standard/enter easing
- `content-enter`
- Glider motion
- Modal scrim/panel motion

Motion should explain continuity:

- The glider shows which destination changed.
- The content entrance confirms the new content.
- The stable hero confirms the user is still looking at the same player.
- The keyed player content confirms Previous/Next changed the player.

Do not stack multiple animations on the same interaction. Do not animate height from unknown content. Do not add looping decorative motion. Honor reduced motion through the existing global clamp.

### Visual consistency

- Use typography roles such as `type-eyebrow`, `type-section-title`, and `type-stat-*`.
- Use tabular numerals for statistics.
- Use team theme variables and contrast-corrected team accent text.
- Use `SurfaceCard` and section dividers instead of rebuilding bordered boxes.
- Use cut corners selectively, not on every metric.
- Preserve alignment across hero, navigation, and content columns.
- Keep zero values quiet and relevant values prominent.
- Avoid new hardcoded colors when an existing token or team variable exists.

### Responsive QA

Test at minimum:

- Wide desktop with teammate rail closed
- Wide desktop with teammate rail open
- Standard laptop width
- Narrow supported modal width
- Light mode
- Dark mode
- Several team themes, including very dark and very bright primaries

The primary navigation may scroll horizontally when necessary, but it must not wrap unpredictably or cause the glider to jitter.

### Data-state QA matrix

Test:

- Zero games
- One game
- Full season
- One tracked season
- Multi-season career
- Current roster player
- Historical/graduated player
- League-team player with limited data
- No awards/media/notes/cards
- Multiple awards/media/notes/cards
- Cards with and without custom photos
- Rapid Previous/Next navigation
- Rapid destination switching
- Slow IPC response and rejected/null responses

### Final validation

Run:

```text
npm run typecheck
npm run lint
npm run build
```

Then perform manual interaction QA in the running Electron app. A successful build is not proof that modal layering, focus, motion, image decoding, and rapid player switching feel correct.

---

## Code quality constraints

1. Do not leave the old ten-tab implementation commented out.
2. Delete dead types, helpers, branches, and imports as their replacements land.
3. Do not duplicate position-stat maps, rating maps, or timeline sorting rules.
4. Reuse existing UI primitives before introducing new ones.
5. Create a new primitive only when it has at least two honest call sites and a stable responsibility.
6. Prefer typed domain helpers over prop-heavy generic presentation components.
7. Keep data fetching out of small presentational components unless the data truly belongs only to that component, as card records belong to `PlayerCardTab`.
8. Do not add dependencies without a demonstrated need.
9. Do not perform broad unrelated visual cleanup during this refactor.
10. Preserve current database and card-record contracts unless a measured bottleneck requires a narrowly scoped addition.

Suggested organization, if extraction is warranted:

```text
components/common/PlayerProfileModal.tsx
components/common/PlayerProfileContent.tsx
components/common/player-profile/
  PlayerOverview.tsx
  PlayerPerformance.tsx
  PlayerRatings.tsx
  PlayerJourney.tsx
  playerProfileStats.ts
  playerJourneyEvents.ts
  usePlayerProfileCore.ts
  usePlayerPerformanceData.ts
  usePlayerJourneyData.ts
```

Treat this as a direction, not a requirement to manufacture files. Keep cohesive code together. Avoid both a 2,000-line god component and dozens of tiny one-use files.

---

## Reporting after each phase

After each phase, report:

1. What changed
2. Files changed
3. Data-loading or duplication improvements
4. Validation performed
5. Remaining risks or deferred work

Do not claim a performance improvement without either request-count evidence, timing evidence, or a clearly demonstrated removal of blocking/eager work.

Do not proceed past a failed validation without fixing the regression or clearly identifying it as pre-existing.

---

## Definition of done

The work is complete when:

- The modal has exactly five primary destinations.
- Overview uses the agreed Profile/Development then Snapshot/Player DNA order.
- Performance replaces Stats, Career, and Game Log without losing useful content.
- Ratings presents evaluation before raw attributes.
- Journey replaces History, Awards, Media, and Notes with a coherent filtered timeline.
- Cards remains a complete multiple-card collection and sits after Journey.
- Existing modal, focus, keyboard, teammate rail, editor, and card-overlay behavior is preserved.
- Inactive destinations no longer trigger their expensive data work on initial Overview open.
- Revisited destinations do not repeat unchanged IPC work.
- The UI remains recognizably DynastyOS in light mode, dark mode, and team themes.
- Motion is restrained, consistent, and reduced-motion safe.
- Typecheck, lint, build, and manual Electron QA pass.
- Dead code from the old information architecture is removed.

The final experience should feel like a premier sports product: cinematic at first glance, clear at the second, and effortlessly fast in repeated use.
