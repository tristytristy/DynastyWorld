# Claude Code Prompt: Dynasty Architecture & UX Refactor

The more I work with the app, the more I realize the Dynasty experience
should revolve around the **coach**, not the school. In College
Football, the program is simply where the coach currently works. Coaches
can change jobs, build legacies, and create stories that span multiple
schools. I'd like to begin restructuring the application around that
philosophy.

------------------------------------------------------------------------

## 1. Left Navigation: Dynasty Submenu

Move all loaded dynasties underneath the **Dynasty** navigation item as
expandable sub-items.

Each dynasty entry should display only:

-   Team logo
-   Coach's name

This should function like a collapsible navigation tree rather than
opening a separate page.

------------------------------------------------------------------------

## 2. Left Navigation Cleanup

Remove the unnecessary **Home** item from inside the Dynasty menu.

Selecting **Dynasty** itself should become the primary entry point.

------------------------------------------------------------------------

# 3. Shift the Entire Dynasty Structure Around the Coach

The application should no longer present the dynasty as the story of a
football program.

Instead, it should present it as the story of the **coach**.

The school is simply the coach's current employer and may change over
time.

Every structural decision moving forward should reinforce this concept.

------------------------------------------------------------------------

## 3a. Dynasty Landing Page

Redesign the Dynasty page to immediately establish the coach as the
primary character.

### Hero Section

Display:

-   Large portrait of the coach
-   Current team logo positioned behind the coach, offset slightly
    upward and to the right
-   Coach's full name

The composition should visually communicate:

> "This is the coach's story. The logo represents where he currently
> works."

The coach should visually dominate the page while the logo acts as
supporting context.

------------------------------------------------------------------------

# 4. Dynasty Management Actions

The current placement of the Delete button is risky.

Separate destructive actions from maintenance actions.

### New Layout

Move:

-   Sync
-   Backup

to the left side of the management area.

Place:

-   Delete Dynasty

in its own clearly separated section so it cannot be clicked
accidentally.

Delete should always feel intentionally isolated.

------------------------------------------------------------------------

# 5. Introduce a New Default Page: Coach Hub

Instead of opening into a Team Hub, the default landing page after
selecting a dynasty should become a brand new page called:

# Coach Hub

This page should represent the coach's entire career, not just the
current season.

Think of it as the biography and legacy page for the dynasty.

------------------------------------------------------------------------

## Coach Hub Layout

### Hero Area

-   Large coach portrait
-   Current team logo
-   Coach name
-   School
-   Years with current school
-   Career status

### Coach Profile

Include information such as:

-   Name
-   Alma mater
-   Age (if tracked)
-   Years coaching
-   Coaching archetype
-   Preferred schemes
-   Any additional profile information we already track

Move the existing **Edit Coach** button here from the Coaches page.

This should become the central place for editing coach information.

### Career Record

Display lifetime coaching statistics, including:

-   Overall record
-   Conference record
-   Bowl record
-   Playoff record
-   National Championships
-   Conference Championships
-   Coach of the Year awards
-   Other accumulated career achievements

This section should represent the coach's complete career across every
school.

### Current Coaching Staff

Display:

-   Offensive Coordinator
-   Defensive Coordinator

Include Edit buttons for each.

This makes the current staff feel connected to the coach's career rather
than buried elsewhere.

### Previous Seasons Timeline

Show every completed season in chronological order.

Each entry should include:

-   Season year
-   Team logo
-   School name
-   Overall record
-   Conference record
-   Bowl result
-   Final ranking

As coaches change schools over time, this timeline becomes the
historical record of their career.

### Coaching Tree

If feasible, introduce a Coaching Tree visualization.

The purpose is to show the evolution of coaching relationships over
time.

Think of famous coaching trees like Bill Belichick's.

Display coaches in a clean hierarchical layout with logical parent/child
relationships across one or two rows depending on depth.

This should grow organically over future seasons.

The Coaching Tree is not intended to represent the current season.

It is intended to tell the long-term story of the coach's influence
throughout his career.

------------------------------------------------------------------------

# 5a. Remove the Coaches Page

Once Coach Hub is complete, the standalone **Coaches** page becomes
redundant.

Remove it entirely.

Everything previously found there should now live inside Coach Hub.

This creates a single authoritative location for coach-related
information.

------------------------------------------------------------------------

# 6. Codebase Audit & Refactoring

After the above changes are complete, perform a comprehensive audit of
the application's architecture.

The goal is not simply to make the app work.

The goal is to make it feel like it was built by an experienced senior
engineer who values maintainability as much as functionality.

Audit the project for:

-   Dead code
-   Unused components
-   Duplicate logic
-   Redundant state
-   Overly complex functions
-   Repeated UI patterns
-   Inefficient rendering
-   Poor component boundaries
-   Unnecessary abstractions
-   Inconsistent naming
-   Styling duplication
-   Opportunities to improve folder organization

Refactor wherever appropriate while preserving existing functionality.

## Code Quality Goals

The finished codebase should be:

-   Modular
-   Highly readable
-   Predictable
-   Well organized
-   Consistently named
-   Easy for a new developer to understand
-   Easy to maintain
-   Easy to extend

When multiple implementations are possible, favor the solution that is
simpler, more maintainable, and easier to reason about over one that is
merely clever.

The objective is to leave the project feeling polished, intentional, and
professionally engineered, with an architecture that can comfortably
support years of future feature development.
