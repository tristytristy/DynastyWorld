# Hall of Legends — Claude Code Implementation Specification

## Overview

Build a new **Hall of Legends** submenu under the main **Coach** tab in DynastyOS.

The Hall of Legends is a coach-owned, dynasty-scoped archive of the greatest and most memorable players the user has coached across their career. It follows the coach across schools and must never be tied only to the currently controlled team.

The feature should answer:

> Who were the best and most memorable players this coach ever worked with?

This is not a school Hall of Fame. A player added while the user coaches Texas State must remain in the Hall if the coach later moves to Auburn, Alabama, or another school. Only players who were on a user-controlled team during the active coach's career are eligible.

The Hall should feel like DynastyOS has opened a protected archive: premium and ceremonial, but still unmistakably part of the existing product.

---

## Feature location and navigation

Add **Hall of Legends** as a submenu beneath the primary **Coach** tab.

Suggested Coach navigation:

- Overview
- Career
- Hall of Legends

Do not call the primary section **Coach Hub**. The current product uses **Coach**.

Suggested route:

```text
/coach/:coachId/hall-of-legends
```

Follow the app's existing routing convention if it uses state-driven tabs instead. Preserve the selected team tier and unit in the route or view state.

Optional query parameters:

```text
?team=first&unit=offense
```

---

## Initial release scope

Build three related areas:

1. First Team
2. Second Team
3. Legends Pool

Do not build the Trophy Room, retired numbers, record holders, custom formations, or additional recognition tiers in this release. Structure the data so those features can be added later without rewriting the Hall.

---

## Product principles

- The formation view is the visual centerpiece.
- The Legends Pool is the management layer.
- Eligible player profiles are the entry point.
- Hall records belong to a dynasty and coach, not the current school.
- Manual user curation always takes precedence over automatic ranking.
- Presentation and atmosphere should feel special without abandoning the DynastyOS design system.
- Click-based controls are required; drag and drop may supplement them but must never be the only interaction.
- Preserve historical Hall entries even if source roster data is later missing or pruned.

---

## Main page structure

### Page header

Create a restrained, editorial header containing:

- Hall of Legends title
- Coach name
- Coach career span
- Total players in the Legends Pool
- Number of filled First-Team slots
- Number of filled Second-Team slots

Example:

```text
HALL OF LEGENDS

Hayden Fox Jr.
The players who defined a coaching career.

18 Legends    11 First-Team Selections    8 Second-Team Selections
```

Do not present these figures as a row of equally weighted dashboard cards. The header should feel composed and editorial rather than analytical.

### Primary controls

Directly beneath the header, add two segmented controls and a separate pool action.

Team tier toggle:

```text
First Team | Second Team
```

Default: **First Team**

Unit toggle:

```text
Offense | Defense
```

Default: **Offense**

Pool action:

```text
Legends Pool 18
```

Recommended hierarchy:

```text
[ First Team | Second Team ]    [ Offense | Defense ]
                                      [ Legends Pool 18 ]
```

The pool action should be visually distinct because it opens a different mode rather than changing the current formation view.

### Suggested composition

```text
┌─────────────────────────────────────────────────────────────┐
│ HALL OF LEGENDS                                             │
│ Hayden Fox Jr.                                              │
│ The players who defined a coaching career.                  │
│                                                             │
│ 18 Legends       11 First Team       8 Second Team          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ [ First Team | Second Team ]   [ Offense | Defense ]        │
│                                      [ Legends Pool 18 ]     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ WR    LT    LG    C    RG    RT    TE    WR                 │
│                                                             │
│                         QB                                  │
│                                                             │
│                  RB            RB                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The control bar and formation field should feel related, but they should not be merged into one oversized container.

---

## Formation view

The selected legends must be arranged like a football play on a field. Do not use a standard card grid or roster table.

Use responsive CSS Grid or an equivalent layout system rather than fixed pixel coordinates. The layout should read clearly as a formation, but readability takes priority over exact field geometry.

### Offensive formation

Use this initial 11-player formation:

```text
WR     LT     LG      C      RG     RT     TE     WR

                         QB

                  RB           RB
```

Slot count:

- 2 WR
- 1 LT
- 1 LG
- 1 C
- 1 RG
- 1 RT
- 1 TE
- 1 QB
- 2 RB

The offensive line must follow normal left-to-right field logic:

```text
LT - LG - C - RG - RT
```

### Defensive formation

Use this initial 11-player defense:

```text
CB     DE     DT     DT     DE     CB

          OLB     MLB     OLB

              FS       SS
```

Slot count:

- 2 CB
- 2 DE
- 2 DT
- 2 OLB
- 1 MLB
- 1 FS
- 1 SS

Do not implement custom defensive schemes in the first release. Keep formation definitions separate from Hall entries so alternate formations can be supported later.

### Field presentation

The formation surface should resemble a premium tactical board, not a literal video-game football field.

Use:

- Dark charcoal surface
- Very faint field markings
- Subtle horizontal yard guides
- Soft vignette
- Restrained coach or team accent near the center
- Slight matte-turf or painted-board texture
- Minimal formation guides that reinforce placement

Avoid:

- Bright green turf
- Strong painted yard lines
- Large stadium backgrounds
- Literal grass effects
- Visual noise that competes with player cards

---

## Legend player cards

Use compact cards inspired by the small roster rollover cards already in DynastyOS. They should feel like a refined Hall variation, not an unrelated card system.

Each card should contain:

- Player portrait
- Player name
- Position
- Jersey number
- School logo
- School name or abbreviation
- Seasons coached by the user
- Peak overall rating
- Optional small recognition badge

Example:

```text
[Portrait]

Bryum Brown
QB #17

Auburn
2026–2028

Peak OVR 92
```

Do not include the following on formation cards:

- Height or weight
- Hometown
- Archetype
- Development trait
- Full stat lines
- Dense award lists

Those details belong in the player modal.

### Premium card treatment

Retain the existing black, charcoal, and team-accent design language while making the Hall cards subtly more ceremonial.

Recommended treatment:

- Dark matte background
- Subtle metallic edge highlight
- Very restrained team-color ambient glow
- Slightly larger portrait crop than standard roster cards
- Small etched or embossed position label
- Soft inner shadow
- Thin border with stronger hover contrast
- Optional faint Hall monogram or pattern behind the portrait

Avoid:

- Large gold gradients
- Bright glowing outlines
- Trading-card pack effects
- Excessive particles
- Heavy glass blur
- Fake marble
- Holographic styling

The full formation should fit without excessive scrolling at normal desktop sizes.

### Card interaction

Clicking an assigned legend card opens the existing player modal in a Hall-aware state. Keep the player's complete profile and add a Hall status area.

Example:

```text
Hall of Legends

Legends Pool
First-Team QB
```

Available actions:

- Change Assignment
- Remove from Team
- Remove from Legends Pool

Removing a player from a First- or Second-Team slot returns them to the unassigned Legends Pool. Removing a player from the pool must also remove any formation assignment after confirmation.

---

## Empty slots and empty states

### Empty position slots

Every formation position remains visible when empty. An empty slot should include:

- Position label
- Add icon
- “Select Legend” prompt
- Subtle dashed or muted border

Example:

```text
QB
Select Legend
+
```

Clicking an empty slot opens the Legends Pool filtered to eligible, compatible players for that slot.

Examples:

- QB slot filters to quarterbacks.
- LT filters to left tackles and compatible offensive linemen.
- CB filters to cornerbacks.

Empty positions must feel intentional rather than broken.

### Empty Hall

When no players have been added, keep the empty formation visible and show:

```text
Your Hall of Legends is waiting.

Add players from their profile as they earn a permanent place in your coaching story.

[Browse Current Roster]
```

Do not hide the field until the first player is added; the empty formation teaches the user what they are building.

### Empty Legends Pool

```text
No players have been added to the Legends Pool.

Open any eligible player profile and select “Add to Legends Pool.”

[Browse Current Roster]
[Browse Former Players]
```

Show the former-player action only when historical roster browsing is available.

---

## Legends Pool

The Legends Pool is the staging area between an eligible player profile and First- or Second-Team placement.

Required flow:

```text
Player Modal
    ↓
Add to Legends Pool
    ↓
Legends Pool
    ↓
Assign to First Team or Second Team
```

A player must be in the Legends Pool before they can be assigned to a formation. Do not place formation-specific assignment controls in the standard player modal.

### Player modal entry point

Add a Hall action to eligible player profiles.

Initial state:

```text
Add to Legends Pool
```

After addition:

```text
In Legends Pool
```

Optional overflow actions:

- View in Legends Pool
- Remove from Legends Pool

Adding a player to the pool should not require confirmation.

### Pool presentation

Open the pool as a large dedicated modal or full-width overlay using the product's established premium modal language:

- Dark overlay
- Background blur
- Large centered content area
- Clear close control
- Strong heading
- Scrollable content
- No tiny nested popups

Suggested header:

```text
LEGENDS POOL

18 players honored across Hayden Fox Jr.'s career

[Search] [Position] [School] [Season] [Assignment]
```

Filters:

- Player name search
- Position
- School
- Season
- Current assignment
- Offense or defense
- First-Team eligible
- Second-Team eligible
- Unassigned only

Use compact horizontal rows or small premium cards. Each pool entry should show:

- Portrait
- Name
- Position
- School
- Seasons coached
- Peak OVR
- Current Hall assignment
- Assignment action

Assigned example:

```text
Bryum Brown
QB | Auburn | 2026–2028
Peak OVR 92

First-Team QB
```

Unassigned action:

```text
Assign to Team
```

### Assignment flow

Selecting **Assign to Team** opens a compact assignment panel.

Step 1 — choose tier:

```text
First Team
Second Team
```

Step 2 — show compatible slots for that player. Empty compatible slots should appear first.

Example for a quarterback:

```text
First-Team QB
Second-Team QB
```

If a compatible slot is occupied, display the current occupant:

```text
First-Team QB
Currently: Bryum Brown
```

Selecting an occupied slot must trigger replacement confirmation:

```text
Replace Bryum Brown with Jayson Moses at First-Team QB?
```

The replaced player remains in the Legends Pool as unassigned.

### Drag and drop

Drag and drop is optional convenience, not a required first-release dependency and never the only assignment method.

If implemented:

- Allow dragging from the pool to a compatible slot.
- Highlight compatible slots.
- Dim incompatible slots.
- Confirm replacement of an occupied slot.
- Keep click and keyboard alternatives fully functional.

Prioritize the click-based workflow for the initial implementation.

---

## Eligibility rules

A player is eligible only if they played for a user-controlled team during the active coach's career in the active dynasty.

Eligible examples:

- Current player on the coach's current team
- Former player from an earlier season at the current school
- Former player from a previous school coached by the same coach
- Transfer who was previously coached by the user
- Graduated or drafted player previously coached by the user

Ineligible examples:

- CPU-controlled player never coached by the user
- Opponent player
- Recruit who never joined a user-controlled roster
- Player associated only with another coach profile
- Player from another dynasty save

Eligibility must use historical coach-tenure and roster relationships, not current roster or current team membership alone.

Recommended API:

```ts
function isEligibleForCoachHall(
  playerId: string,
  coachId: string,
  dynastyId: string
): boolean
```

Return `true` when at least one historical season satisfies all of the following:

```text
player.teamId === coach.userControlledTeamId for that season
player.seasonId overlaps the coach's tenure at that team
player.dynastyId === coach.dynastyId
```

Do not determine eligibility only from the current roster or current team ownership.

---

## Ownership and persistence

Hall data must be owned by both the dynasty and coach. It must not live only beneath the currently controlled team.

Minimum ownership keys:

```ts
dynastyId
coachId
playerId
```

Retain the team and season context from when the player was coached.

Suggested model:

```ts
interface CoachLegendEntry {
  id: string;
  dynastyId: string;
  coachId: string;
  playerId: string;

  addedAt: string;
  addedFromSeasonId?: string;
  addedFromTeamId?: string;

  poolStatus: 'active' | 'removed';

  firstTeamSlot?: LegendSlotAssignment;
  secondTeamSlot?: LegendSlotAssignment;

  inductionNote?: string;
  customSortOrder?: number;
  playerSnapshot: LegendPlayerSnapshot;
}
```

Suggested assignment model:

```ts
interface LegendSlotAssignment {
  unit: 'offense' | 'defense';
  slotId: string;
  assignedAt: string;
}
```

Store formation definitions separately:

```ts
interface LegendFormationSlot {
  id: string;
  unit: 'offense' | 'defense';
  position: string;
  label: string;
  row: number;
  column: number;
  compatiblePositions: string[];
}
```

### Persistence guarantees

When a coach changes teams:

- Existing pool entries remain.
- First-Team assignments remain.
- Second-Team assignments remain.
- Historical school context remains attached.
- Old legends are visible by default.
- Players from the new user-controlled team become eligible.
- CPU-only players remain ineligible.

When the user switches coaches:

- Each coach sees only their own Hall.
- The same player may appear in multiple coaches' Halls if both historically coached that player.
- Assignments never leak across coach profiles.

When the user switches dynasty saves:

- Hall entries remain isolated by dynasty ID.

---

## Assignment rules and data integrity

- A player remains in the Legends Pool while assigned to a team.
- A player may occupy only one Hall formation slot total.
- A player may not occupy multiple slots in one tier.
- A player should not appear on First Team and Second Team simultaneously.
- Moving a player between tiers should move the existing assignment, not duplicate it.
- Replacing a player in a slot returns the former occupant to the unassigned pool.
- Removing a player from a team slot leaves them in the pool.
- Removing a player from the pool also clears their assignment after confirmation.

Moving between tiers requires confirmation:

```text
Move Bryum Brown from First Team to Second Team?
```

Do not silently duplicate the record.

### Confirmation behavior

Require confirmation for:

- Replacing an occupied slot
- Moving a player between First and Second Team
- Removing a player from the Legends Pool
- Removing a pool entry that currently occupies a formation slot

Do not require confirmation for:

- Adding a player to the Legends Pool
- Removing a player from a team slot while keeping them in the pool
- Changing the unit or tier toggle
- Opening a player profile

---

## Position compatibility

Only allow players to occupy compatible formation slots. Centralize normalization and compatibility in one utility rather than scattering it across UI components.

Initial mapping:

```ts
const LEGEND_POSITION_COMPATIBILITY = {
  QB: ['QB'],

  RB: ['RB', 'HB', 'FB'],
  WR: ['WR'],
  TE: ['TE'],

  LT: ['LT', 'OL'],
  LG: ['LG', 'OL'],
  C: ['C', 'OL'],
  RG: ['RG', 'OL'],
  RT: ['RT', 'OL'],

  DE: ['DE', 'LE', 'RE', 'EDGE'],
  DT: ['DT', 'NT'],

  OLB: ['LOLB', 'ROLB', 'OLB', 'LB'],
  MLB: ['MLB', 'LB'],

  CB: ['CB'],
  FS: ['FS', 'S'],
  SS: ['SS', 'S'],
} as const;
```

Adapt aliases to the game's actual position vocabulary while keeping normalization in a single module.

---

## Historical snapshots and edge cases

### Missing or deleted player data

Do not silently remove a Hall entry if the player is absent from a later import or historical roster data is pruned. Render a fallback historical card using stored snapshot data.

Fallback card should contain:

- Stored player name
- Stored school
- Stored position
- Missing portrait placeholder
- **Historical Player** label

Suggested snapshot:

```ts
interface LegendPlayerSnapshot {
  name: string;
  position: string;
  jerseyNumber?: number;
  schoolName?: string;
  schoolId?: string;
  peakOverall?: number;
  portraitPath?: string;
  coachedSeasonStart?: string;
  coachedSeasonEnd?: string;
}
```

### Player position changes

Keep the existing assignment unless it becomes invalid. Do not automatically move the player. Allow the user to reassign them manually.

### Duplicate imported IDs

Use dynasty-scoped identity logic. Never assume a player ID is globally unique across every save.

---

## Visual and interaction direction

### Preserve from DynastyOS

- Dark backgrounds
- DIN-style typography
- Angular or clipped corners
- Thin borders
- Team accent colors
- Strong labels
- Compact controls
- Existing modal treatment
- Existing player portraits
- Existing player modal behavior

### Make the Hall special through

- Larger negative space
- Formation-based composition
- Lower information density
- Subtle metallic detailing
- Softer ambient lighting
- Deliberate entry animation
- A distinct editorial header
- Fewer visible management controls until they are needed

The Hall should differentiate itself through composition, spacing, and atmosphere—not through a disconnected visual theme.

### Motion

Use restrained animation:

- Cards fade in and rise slightly when switching units.
- Formation cards reveal in a soft sequence.
- First Team and Second Team crossfade or transition horizontally.
- Eligible empty slots brighten during assignment.
- Hovering subtly enlarges the portrait, not the entire card.
- Selected cards gain a thin, crisp accent border.
- The Legends Pool opens with a smooth scale-and-opacity transition.

Avoid bouncy or showy motion. Respect the product's existing easing and reduced-motion settings.

Recommended timings:

```text
Fast interaction: 140–180ms
Panel transition: 220–280ms
Formation reveal: 280–420ms
```

---

## Responsive behavior

The feature is desktop-first but must scale gracefully.

### Wide desktop

- Display the complete formation in one view.

### Medium width

- Reduce card width.
- Tighten horizontal gaps.
- Permit controlled horizontal scrolling when necessary.
- Do not collapse into a generic grid too early.

### Narrow width

Use a formation-inspired stacked layout while retaining positional grouping.

Example:

```text
Receivers
Offensive Line
Quarterback
Running Backs
```

Preserve positional hierarchy even when exact field geometry is no longer practical.

---

## Accessibility

- Make every player card keyboard accessible.
- Give every slot a clear accessible label.
- Expose selected state on both segmented controls.
- Do not use color alone to distinguish First and Second Team.
- Trap focus correctly within the Legends Pool modal.
- Allow Escape to close the pool.
- Provide a non-drag alternative for all drag-and-drop behavior.
- Respect reduced-motion preferences.
- Include the position and tier in empty-slot labels.

Example:

```text
Empty First-Team quarterback slot
```

---

## Recommended architecture

Suggested component structure:

```text
CoachHallOfLegendsPage
├── HallHeader
├── HallControlBar
│   ├── TeamTierToggle
│   ├── UnitToggle
│   └── LegendsPoolButton
├── LegendFormation
│   ├── FormationBackdrop
│   ├── LegendSlot
│   │   ├── LegendPlayerCard
│   │   └── EmptyLegendSlot
│   └── FormationTransition
├── LegendsPoolModal
│   ├── LegendsPoolHeader
│   ├── LegendsPoolFilters
│   ├── LegendsPoolList
│   ├── LegendsPoolPlayerRow
│   └── LegendAssignmentPanel
└── HallConfirmationModal
```

Suggested hooks:

```text
useCoachHall
useLegendFormation
useLegendEligibility
useLegendAssignments
useLegendsPoolFilters
```

Suggested utilities:

```text
normalizePlayerPosition
getCompatibleLegendSlots
isPlayerEligibleForCoachHall
getCoachPlayerHistory
```

Keep domain rules outside presentation components wherever possible. Eligibility, normalization, compatible-slot lookup, assignment movement, replacement, and persistence should be independently testable.

---

## Acceptance criteria

### Navigation

- Hall of Legends appears beneath the **Coach** tab.
- It is not placed under **Team**.
- It is not called **Coach Hub**.
- The route and data are scoped to the active coach.

### Formation

- First Team and Second Team are available.
- Offense and Defense are available.
- Offense displays 11 positional slots.
- Defense displays 11 positional slots.
- Cards are arranged like football formations.
- Empty positions remain visible and actionable.

### Legends Pool

- Eligible player modals include **Add to Legends Pool**.
- Added players appear in the pool.
- Players can be assigned from the pool to First or Second Team.
- Assignment is limited to compatible positions.
- Replaced players remain in the pool.
- A player cannot occupy multiple Hall slots or both tiers simultaneously.
- Click and keyboard assignment work without drag and drop.

### Persistence

- Hall data follows the coach across team changes.
- Hall data is isolated by dynasty.
- Hall data is isolated by coach.
- Former user-controlled team players remain available.
- CPU-only players cannot be added.
- Missing source players continue to render from snapshots.

### UI and experience

- Cards use the compact roster-rollover scale.
- The Hall feels more ceremonial than standard data pages.
- The design remains consistent with DynastyOS.
- The field is dark and abstract rather than bright green.
- Animations are restrained and respect reduced motion.
- The page avoids horizontal overflow at normal desktop sizes.
- Empty Hall and empty pool states are intentional and instructive.

### Data integrity

- Moving a player between tiers does not duplicate them.
- Replacing a slot keeps the former occupant in the pool.
- Removing a team assignment does not remove the pool entry.
- Removing an assigned pool entry requires confirmation and clears its assignment.
- Coach changes, team changes, and dynasty changes do not leak or discard Hall records.

---

## Recommended build order

### Phase 1 — Data foundation

- Create the coach-owned, dynasty-scoped Hall model.
- Add player display snapshots.
- Create historical eligibility logic.
- Create offense and defense slot definitions.
- Centralize position normalization and compatibility.
- Implement assignment, movement, replacement, and removal rules.
- Add migration or default empty Hall state.
- Add domain-level tests for persistence and integrity.

### Phase 2 — Core Hall page

- Add the Coach submenu and route.
- Build the editorial header.
- Build First/Second Team toggle.
- Build Offense/Defense toggle.
- Build responsive formation layouts.
- Build compact legend cards.
- Build accessible empty slots and empty Hall state.

### Phase 3 — Legends Pool

- Add the action to eligible player modals.
- Build the large pool modal or overlay.
- Add search and filters.
- Build click-based assignment workflow.
- Add replacement and tier-movement confirmations.
- Add removal behavior.
- Connect empty slots to pre-filtered pool views.

### Phase 4 — Polish and verification

- Add restrained transitions and hover treatment.
- Add the abstract tactical-field backdrop.
- Add reduced-motion support.
- Verify keyboard navigation and focus management.
- Test common desktop resolutions and narrow layouts.
- Test coach changes, school changes, and dynasty changes.
- Test missing historical player data and duplicate imported IDs.
- Confirm that no current-team filter hides past legends by default.

---

## Final product direction

The Hall of Legends should feel like a private archive assembled across the coach's entire career.

The formation view is the centerpiece. The Legends Pool is the deliberate management layer. Eligible player profiles are the entry point. The data follows the coach rather than the current school.

Keep the initial release focused: First Team, Second Team, Offense, Defense, and Legends Pool are enough. The feature should distinguish itself through composition, atmosphere, interaction quality, historical persistence, and careful data integrity—not by adding more categories.

