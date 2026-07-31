# Career milestones — the editable list

**This file is the spec you edit.** Change a threshold, rename a milestone, add
or delete a row, and hand it back — the code follows this document, not the
other way round. The implementation lives in the `MILESTONES` array in
[`src/renderer/components/common/PlayerProfileContent.tsx`](../src/renderer/components/common/PlayerProfileContent.tsx),
and every row below carries its `id` so a change here maps to exactly one entry
there.

These appear in the **player modal → History tab**, filed under the season the
game was played in.

---

## How they work

- **Each fires once, ever** — on the earliest game in the player's career that
  satisfies it. Not once a season.
- **Built from per-game box scores**, walked in order (season, then week). A
  season total can't tell you whether 1,200 yards came in one game or twelve, so
  none of this is derivable from the season line.
- **Position-scoped.** A milestone only fires for the position groups listed. The
  scope is taken from the player's **current** position — someone who moves from
  HB to WR is judged on where he is now.
- **Every row renders the same shape:** the label, then `value · opponent · week`
  — e.g. *First 100-yard rushing game* / `117 yds · vs Florida State · Wk 3`.
  Rows with no `Shows` value just get opponent and week.

### What it can't cover

| Gap | Why |
|---|---|
| Offensive line (LT, LG, C, RG, RT) | The game records no countable stats for them — no pancakes, no sacks allowed. They get the three universal milestones only. |
| Kickers and punters (K, P) | Not present in the game-log categories at all (offense/defense only). Universal three only. |
| Anything before your first sync | A dynasty imported mid-career has no box scores from earlier years. This is why the debut is worded "First **recorded** game" rather than "College debut". |
| Full-season stat lines for opponents | Not a gap in practice — the game log is leaguewide, so a transfer's years at his old school resolve properly against that school's real schedule. |

---

## Universal — anyone who appears in a box score

| id | Milestone | Fires when | Shows |
|---|---|---|---|
| `debut` / `debut-def` | First recorded game | Earliest box score we hold | — |
| `first-start` / `first-start-def` | First start | `started` is true | — |
| `breakout` / `breakout-def` | Breakout game | Game rating ≥ 90 | rating |

> Each of these exists twice — once for the offensive box score and once for the
> defensive one — because a player appears in one or the other. One `id`, one
> milestone, as far as the timeline is concerned.

---

## Quarterback (QB)

| id | Milestone | Fires when | Shows |
|---|---|---|---|
| `qb-first-td` | First career touchdown pass | Passing TD ≥ 1 | — |
| `qb-300` | First 300-yard passing game | Pass yards ≥ 300 | yards |
| `qb-400` | First 400-yard passing game | Pass yards ≥ 400 | yards |
| `qb-4td` | First four-touchdown game | Passing TD ≥ 4 | TD count |
| `qb-clean` | First clean sheet (3+ TD, no picks) | Passing TD ≥ 3 **and** INT = 0 | TD · 0 INT |
| `qb-deep` | First 50-yard touchdown strike | Longest pass ≥ 50 **and** a passing TD | long |
| `qb-dual` | First 200-pass / 50-rush game | Pass yards ≥ 200 **and** rush yards ≥ 50 | pass · rush |

---

## Running backs (HB, FB)

| id | Milestone | Fires when | Shows |
|---|---|---|---|
| `rb-first-td` | First career rushing touchdown | Rushing TD ≥ 1 | — |
| `rb-100` | First 100-yard rushing game | Rush yards ≥ 100 | yards |
| `rb-200` | First 200-yard rushing game | Rush yards ≥ 200 | yards |
| `rb-3td` | First three-touchdown game | Rushing + receiving TD ≥ 3 | TD count |
| `rb-house` | First 50-yard touchdown run | Longest run ≥ 50 **and** a rushing TD | long |
| `rb-workhorse` | First 25-carry game | Carries ≥ 25 | carries |
| `rb-allpurpose` | First 150 scrimmage yards | Rush + receiving yards ≥ 150 | yards |

---

## Receivers and tight ends (WR, TE)

| id | Milestone | Fires when | Shows |
|---|---|---|---|
| `wr-first-catch` | First career reception | Receptions ≥ 1 | — |
| `wr-first-td` | First career touchdown catch | Receiving TD ≥ 1 | — |
| `wr-100` | First 100-yard receiving game | Receiving yards ≥ 100 | yards |
| `wr-200` | First 200-yard receiving game | Receiving yards ≥ 200 | yards |
| `wr-10rec` | First ten-catch game | Receptions ≥ 10 | catches |
| `wr-2td` | First two-touchdown game | Receiving TD ≥ 2 | TD count |
| `wr-deep` | First 50-yard touchdown catch | Longest catch ≥ 50 **and** a receiving TD | long |

---

## Defense

**All defenders** = LE, RE, DT, LOLB, MLB, ROLB, CB, FS, SS
**Front seven** = LE, RE, DT, LOLB, MLB, ROLB · **Secondary** = CB, FS, SS

| id | Milestone | Who | Fires when | Shows |
|---|---|---|---|---|
| `def-first-tackle` | First career tackle | All defenders | Solo + assisted ≥ 1 | — |
| `def-first-sack` | First career sack | All defenders | Sacks > 0 (a half sack counts) | — |
| `def-multisack` | First multi-sack game | All defenders | Sacks ≥ 2 | sacks |
| `def-first-int` | First career interception | All defenders | INT ≥ 1 | — |
| `def-pick6` | First pick six | All defenders | INT returned for TD ≥ 1 | — |
| `def-first-ff` | First forced fumble | All defenders | Forced fumbles ≥ 1 | — |
| `def-10tkl` | First ten-tackle game | All defenders | Solo + assisted ≥ 10 | tackles |
| `def-takeaway-double` | First two-takeaway game | All defenders | INT + fumble recoveries ≥ 2 | takeaways |
| `def-3tfl` | First three-TFL game | Front seven | TFL ≥ 3 | TFL |
| `def-lockdown` | First three-breakup game | Secondary | Pass deflections ≥ 3 | PBU |

---

## Fields available to build new milestones from

Anything in this list can be tested, in any combination. If you want a milestone
that needs something **not** here, it isn't in the save's per-game data and can't
be built without new extraction work.

**Offensive box score** — `started`, `gameRating`, `passAttempts`,
`passCompletions`, `passYards`, `passTDs`, `passInts`, `passLongest`,
`rushAttempts`, `rushYards`, `rushTDs`, `rushLongest`, `receptions`,
`receivingYards`, `receivingTDs`, `receivingLongest`

**Defensive box score** — `started`, `gameRating`, `tackles`, `assistedTackles`,
`tacklesForLoss`, `sacks`, `interceptions`, `interceptionReturnYards`,
`interceptionTDs`, `forcedFumbles`, `fumbleRecoveries`, `passDeflections`

**Per game, also known** — opponent name, week, home or away, season year.

---

## Other History-tab events (not milestones, listed for completeness)

| Event | Source |
|---|---|
| `Season` | One per tracked season: class, position, OVR and the year-over-year change, plus any position or jersey change. |
| `Transferred from X to Y` | A school change between consecutive seasons in the leaguewide roster. **Requires the class year to advance** — without that guard, every incoming recruit reads as a transfer from the game's placeholder FCS roster (27 false positives against 13 real ones in one Auburn offseason). |
| Awards and honors | National awards, All-American / All-Conference tiers, weekly honors, and team awards. |
