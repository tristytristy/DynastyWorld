# NCAA Hub Overview — Storytelling Phase A (template variety + streak awareness)

**Status:** Shipped 2026-08-03 — see the DevLog entry "The NCAA Hub stops narrating every week the same way" for what was built, what the save actually carries (`CFPPoll_LastWeeksRank` turned out to be dead weight), and the two correctness bugs the work exposed. Originally: ready to implement. **Author context:** drafted by the project's AI strategist (Claude, Cowork) after reading `getNcaaHub.ts`, `NcaaHub.tsx`, `shared/types.ts`, the extractor types, and a reference screenshot of a competing dynasty-hub UI directly — not from memory. This doc is meant to be handed to Claude Code / Antigravity with no other context required.

## Objective

The NCAA Hub → Overview page's "stories" (Lead Story, Upset Tracker, Storylines, Coach Spotlight, hero headline, National Notebook) are currently built from **fixed, single-shot sentence templates** — one hard-coded string shape per story type, every week, regardless of context. That's why the page reads stale after a few synced seasons: the facts change, the sentence never does, and nothing acknowledges what's happened across prior weeks.

This phase fixes that **without introducing any LLM, API key, or network call** — it stays fully inside the app's "no backend, no network" architecture. Three things ship together:

1. A **facts/prose split** — story builders keep computing the same reliable facts they do today, but instead of composing one fixed sentence, they hand those facts to a small variant-picking layer that chooses from several phrasings. This split is deliberate groundwork: a later phase (already scoped separately, not part of this brief) will swap the variant-picker's internals for an LLM call without touching fact computation or rendering at all. Do not build that phase now — just don't design this one in a way that would make swapping it out harder later (i.e., keep "compute facts" and "turn facts into a sentence" as clearly separate functions).
2. **Intra-season streak awareness** — win/loss streaks and result trends computed from the season's already-stored schedule, so storylines can reference "third straight ranked win" instead of only a snapshot.
3. **Single-week poll movement** — a cheap, leaguewide "up 3 / down 2 since last week" fact per team (not a full trend history), which unlocks both a Top 25 movement indicator and richer narration ("climbing," "in freefall," "steady at #4").

## Scope

**In scope:**
- A shared, deterministic (non-random) variant-picking utility.
- Phrase-pool rewrites for: Game of the Week, Upset of the Week, Upcoming Games (watchlist), Coach Spotlight, hero headline/summary, and National Notebook items — the last of these restructured into short tagged/categorized lines (see Part 4) rather than a flat sentence list.
- Intra-season win/loss streak computation for any team (not just the user's), sourced from the existing per-season schedule snapshot.
- Single-week poll rank movement (current vs. last week) for any team, sourced from save fields the extractor doesn't currently pull — see Part 1. This is new extractor surface area, but a small, low-risk one (reading two more fields off a table the extractor already reads for every team), distinct from the bigger schema change described below.
- Minor, additive type changes to `NcaaHubGameFeature`/`NcaaHubTop25Entry`/related types where a builder needs to preserve a fact it currently discards (e.g., rank-swing magnitude on an upset, rank movement on a Top 25 entry).

**Out of scope — do not do these in this pass:**
- Any LLM/AI API integration, local or cloud (that's a separate future phase; this doc is deliberately not it).
- Any network call of any kind.
- The bigger `ranking_history` schema change (add `team_id`, capture every team's rank on every import, to get a real multi-week trend/streak for any team — e.g. "ranked five straight weeks"). Part 1 below gets you a single-week movement arrow cheaply without this; a genuine week-by-week history for every team still needs this separate, bigger decision.
- Cross-season storylines (rivalry history, multi-year coach arcs). Seasons are archived so the data exists, but it needs new cross-season query logic — separate scope.
- "Record broken this week" storylines. Appealing (see Reference UI notes below) but not confirmed feasible in this pass — the NCAA record book snapshot (`getNcaaRecords.ts`) reflects current state only; detecting that a record specifically changed *this sync* requires diffing against a prior snapshot, and it's not yet confirmed whether the app retains a prior version to diff against or overwrites in place on re-sync. Worth a dedicated investigation later, not a same-pass assumption.
- Leaguewide "Player of the Week" storylines. Confirmed infeasible with current data — `WeeklyHonors.tsx`/`extract-awards.ts` are explicit that weekly player honors are only ever populated for the user's own team; the save doesn't carry them leaguewide.
- Any new extractors beyond the two poll-rank fields in Part 1. `NcaaHubOverview` already flows end-to-end via `window.api.db.getNcaaHub`; this phase only changes what's inside the object that already crosses that boundary.
- UI/layout changes beyond what's needed to show the new rank-movement fact. `NcaaHub.tsx`'s cards (`StoryCard`, `LeadGameCard`, etc.) already just render whatever string is handed to them — this phase changes the strings (and adds one small new visual: a movement chip), not the overall page layout.

## Reference UI notes

A screenshot of a competing dynasty-hub product surfaced a few patterns worth reacting to explicitly, so the reasoning is on record rather than silently adopted or silently skipped:

- **Top 25 rank-movement arrows** (▲3 / ▼2 next to each ranked team) — adopted, see Part 1. Turned out to be cheaper than expected once the actual save fields were checked (see below), not just a nice-to-have copied from a reference.
- **"Around the League" feed with a bolded category hook** ("History Made:", "Staying On Track:") before each headline — adopted as a restructuring of the National Notebook, see Part 4. Costs nothing new data-wise; it's a formatting change to output that's already being generated.
- **A persistent all-games score ticker across the top of the page** — deliberately **not** included here. It's a real, well-scoped idea, but it's a new UI surface (a scoreboard strip), not a narration/storytelling improvement, and pulling it into this pass would blur what's supposed to be a tightly-scoped template/streak upgrade. Flag it separately if you want it — it doesn't need any of this doc's groundwork to build.
- **Leaguewide "Players of the Week" strip** — considered, ruled out. See "Out of scope" above; the save doesn't carry this data outside the user's own team.
- **"History Made" record-broken callouts** — considered, provisionally out of scope pending the snapshot-diffing question above.

## Architecture

### Where the new code lives (matches existing conventions — don't invent new patterns)

The renderer never imports from `src/database` or `src/extractors` (typed-IPC-only boundary — see `DEVELOPER_ONBOARDING.md`). That constraint splits this work into two sides that share one small utility:

- `src/shared/storyVariants.ts` **(new)** — a tiny, pure, dependency-free utility: given a pool of candidate strings/builders and a stable seed, deterministically pick one. Pure logic shared across the main/renderer boundary already has precedent here (`src/shared/gameImpactScore.ts`, `src/shared/awardOrder.ts`) — follow that file's style (small pure functions, a doc comment explaining the *why*, no side effects).
- `src/database/ncaaHubNarration.ts` **(new)** — phrase pools + `narrate*()` functions for the story types built in the main process: game of the week, upset of the week, upcoming games, coach spotlight. Imports the picker from `shared/storyVariants.ts`. Used by `getNcaaHub.ts`.
- `src/database/ncaaHubStreaks.ts` **(new)** — streak computation off the season's schedule snapshot. Used by `getNcaaHub.ts`.
- `src/renderer/lib/ncaaHubFormat.ts` **(new)** — phrase pools for the renderer-side composition that currently lives inline in `NcaaHub.tsx` (`heroHeadline`, `heroSummary`, the `notebookItems` array, `gameScoreLine`). Follows the existing `renderer/lib/*Format.ts` naming convention (see `scheduleFormat.ts`, `recruitFormat.ts`, `awardFormat.ts`). Imports the same picker from `shared/storyVariants.ts`.

No IPC or preload changes are needed beyond the two new fields described in Part 1 — `NcaaHubOverview` and its sub-types already carry everything else across the boundary; this phase mostly changes what populates the fields that are already there.

### The deterministic-seed rule

Stories are recomputed fresh on every `getNcaaHub()` call (nothing is cached/stored). If variant selection used `Math.random()`, the same real-world event would read differently every time the page is opened or re-synced — which would feel *more* broken than the current staleness, not less. Instead, seed the picker off something stable to the event itself: e.g. `` `${season.id}-${week}-${homeTeamName}-${awayTeamName}` `` for a game, or `` `${season.id}-${coachName}` `` for a coach spotlight. Same underlying event → same phrasing, every time, until the facts themselves change (new week, new result). A simple string hash is enough — no crypto needed:

```ts
// src/shared/storyVariants.ts
export function pickVariant<T>(pool: readonly T[], seed: string): T {
  if (pool.length === 0) throw new Error('pickVariant: empty pool');
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return pool[Math.abs(hash) % pool.length];
}
```

Treat this as a starting point, not a spec to copy verbatim — adjust as needed, but keep the "same seed → same output, always" property.

## Part 1 — Single-week poll movement (extractor + `getNcaaHub.ts`)

`extract-teams.ts` currently reads `MediaPoll_CurrentRank`, `CoachesPoll_CurrentRank`, and `CFPPoll_CurrentRank` off the save's `Team` table for every team in the league — but not the sibling fields. DevLog's Phase 7 notes confirm the save also carries `LastWeeksRank` and `StartOfSeasonRank` per team (verified with real, differentiated values on an actual save — not placeholders), which is what the existing `ranking_history` table's doc comment is also describing. Nobody has piped those two sibling fields into `TeamData` yet.

**Before writing code:** confirm the exact save field names (they may or may not be poll-prefixed like `MediaPoll_LastWeeksRank`/`MediaPoll_StartOfSeasonRank` — check against the franchise field browser/existing extractor patterns rather than assuming) for all three poll types the app tracks (media, coaches, CFP), since `NcaaHubTop25Entry` shows all three.

Once confirmed:
1. Add the matching fields to the `FIELDS` array in `extract-teams.ts` and to `TeamData` (e.g. `mediaPollLastWeekRank: number`, `mediaPollStartOfSeasonRank: number`, and the coaches/CFP equivalents if present — same 0-means-unranked convention already used).
2. In `getNcaaHub.ts`, compute movement (`currentRank - lastWeekRank`, accounting for the 0/unranked convention — a team entering the poll from unranked, or dropping out entirely, isn't a simple subtraction) and add it to `NcaaHubTop25Entry` (e.g. `mediaRankMovement: number | null`, where positive/negative/`null` map to "up"/"down"/"unranked-related edge case" — exact shape your call).
3. In `NcaaHub.tsx`'s `Top25Row`, render a small movement chip (▲/▼/— plus the delta) next to the rank — this is the one small, intentional UI addition in this pass, directly modeled on the reference screenshot.
4. Feed movement into narration too (Part 3/4) — "climbing," "cracked the top 10," "in freefall," "holding steady at #4" are all more alive than a bare rank number.

This gets you the reference screenshot's rank-movement indicator, leaguewide, for a small extractor change — **not** the bigger `ranking_history` schema change (that's still separately out of scope; this only ever gives you *this week vs. last week*, never a full trend).

## Part 2 — Intra-season streak computation (`src/database/ncaaHubStreaks.ts`)

`getNcaaHub()` in `getNcaaHub.ts` already loads the full season schedule via `getSnapshot<GameData[]>(season.id, 'schedule')` — every game, every team, every week, refreshed each sync. `GameData` (see `extract-schedule.ts`) has `week`, `status`, `homeTeamIndex`/`awayTeamIndex`, `homeTeamName`/`awayTeamName`, `homeScore`/`awayScore`. That's sufficient, today, with no extraction changes, to compute for **any** team:

- Current win/loss streak entering a given week (consecutive results, most recent first, stopping at the first break or season start).
- Record over the last N games.
- Whether a given result extended, snapped, or started a streak.

Write a function along the lines of `computeTeamStreak(schedule: GameData[], teamIndex: number, throughWeek: number): { kind: 'win' | 'loss' | 'none'; length: number }` (exact shape is your call) that filters the schedule to that team's played games up to `throughWeek`, sorted by week, and walks backward from the most recent result. This needs to work for both home and away appearances of a team.

This streak data feeds into Part 3's narration calls — e.g., the upset/game-of-the-week/coach-spotlight builders should compute the relevant team's streak-entering-this-result and pass it as a fact, so phrasing can say things like "make it four straight" or "snapped a three-game skid" when true, and fall back to plain result phrasing when there's no streak to reference (a streak of length 1 isn't a storyline).

## Part 3 — Story builders → facts/prose split (`getNcaaHub.ts` + `ncaaHubNarration.ts`)

Four builder functions in `getNcaaHub.ts` currently compose one fixed sentence inline. Each should instead: keep computing exactly the facts it computes today (plus the new streak fact from Part 2 and the new movement fact from Part 1 where relevant), then call a `narrate*()` function from the new `ncaaHubNarration.ts` to produce the sentence from a pool of variants.

- **`buildGameOfTheWeek`** (via `toGameFeature`'s `summary` param) — today: `"${winner} won ${high}-${low}"` or `"Finished ${homeScore}-${awayScore}"`. Add variants keyed off margin size (blowout vs. nail-biter reads differently) and, when available, the winning team's streak.
- **`buildUpsetOfTheWeek`** — today computes a `swing` (rank differential between winner and loser) purely to *pick* the upset, then discards it before building the summary string. Keep `swing` and pass it into narration so a 20-spot upset and a 3-spot squeaker don't get the same tone of sentence. Consider adding an optional `rankSwing: number | null` field to `NcaaHubGameFeature` if you want the UI (or a future pass) to be able to read the magnitude directly rather than only embedding it in prose — not required, but cheap while you're in there.
- **`buildUpcomingGames`** — today has ~5 branches (championship / bowl / ranked matchup / neutral site / default). Turn each branch into a small pool instead of one line.
- **`buildCoachSpotlight`** — today: one fixed sentence combining wins/losses/rank/prestige. Vary phrasing by which fact is most notable (a big prestige mismatch reads differently than a slow build with a modest record), and reference the team's current streak (Part 2) when it's a real one (3+).

Keep the facts each function computes exactly as reliable as they are today — the narration layer only ever *chooses wording*, it never invents a number. That guarantee matters more here than it would in a typical app: this is a save-archival tool, and a storyline that states a wrong score or rank would be a trust-breaking bug, not a cosmetic one.

## Part 4 — Renderer-side prose (`NcaaHub.tsx` + `ncaaHubFormat.ts`)

Four spots in `NcaaHub.tsx` compose prose from data the renderer already has, independent of the builders above:

- `heroHeadline(hub)` — 4 branches based on what's available (game of the week / upcoming game / Heisman / fallback).
- `heroSummary(hub)` — joins several fragments together.
- `notebookItems` (inline array in `NcaaHub()`) — 4 template lines: undefeated count, one-loss count, next slate, recruiting leader.
- `gameScoreLine(game)` — tied/win templates, reused across several cards.

Move the phrase-pool logic for these into `src/renderer/lib/ncaaHubFormat.ts`, importing `pickVariant` from `shared/storyVariants.ts`, following the same seeding rule (seed off season year + week + the relevant team names, not randomness).

**Restructure `notebookItems` while you're in there,** taking the cue from the reference screenshot's "Around the League" feed: instead of a flat list of plain sentences, give each item a short category tag (e.g. `RECORD WATCH`, `STREAK`, `RECRUITING`, `RANKED WIN`, `CONFERENCE RACE`) alongside its sentence, and render the tag the way `type-eyebrow` labels already look elsewhere on this page (small, uppercase, muted — that's an existing style, not a new one). This costs no new data — it's a restructuring of output the app already generates — but it reads as a real sports ticker instead of a paragraph list. `NcaaHub.tsx` itself should otherwise shrink to calling these functions, same as it calls `gameMetaLine`/`eventLabel` today.

## Acceptance checklist

- No new network calls, no new npm dependencies, no new IPC channels beyond the two poll-rank fields in Part 1.
- Same real event (same season, week, matchup/coach) always renders the same phrasing across repeated loads — verify by opening the same season twice.
- Loading a season with a real synced save shows visibly varied phrasing across different weeks/events, not just the same shape with different names swapped in.
- Streak-aware phrasing only appears when a streak is actually meaningful (length ≥ 3 or similar threshold you choose) — a 1-game "streak" isn't a storyline and shouldn't be forced into a sentence.
- Top 25 movement chips correctly handle the unranked-boundary cases (a team entering the poll from unranked, a team dropping out entirely) rather than showing a nonsense delta.
- Empty/edge states (no game of the week, no coach spotlight, no upcoming games) still render the existing fallback copy — don't let variant selection break the `null`-handling that's already in place in `NcaaHub.tsx`.
- `npm run build` (or the project's usual typecheck/lint command) is clean — `noUnusedLocals` is on, so don't leave the old single-template code dead in place.

## Appendix — the seam for later (context only, not part of this pass)

Because this phase separates "compute facts" from "turn facts into a sentence," the follow-up phase (hybrid LLM prose pass, opt-in/BYOK, discussed separately) will be able to swap only the *inside* of `narrate*()`/the `ncaaHubFormat.ts` functions for a model call — same facts in, richer prose out — without touching streak computation, fact-building, or `NcaaHub.tsx`'s rendering at all. That's the payoff of doing this phase first.
