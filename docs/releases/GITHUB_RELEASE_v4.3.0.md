# DynastyOS 4.3.0

The rivalries release. Your save keeps three rival slots per team and a fixed
list of names for them, and neither can be changed from inside the game — so a
dynasty that has run for a decade grows rivalries it has no room for. Now you
can name your own. Alongside it: keyboard shortcuts that finally tell you what
they are, the Program editor opened up to every school in the league, and a
handful of things the app had been quietly getting wrong.

> Everything here is new since **4.2.0**.

---

## Name your own rivalries

A new **Rivals** tab in the Program editor.

- **Your save's rivals sit at the top, marked EA and read-only.** They drive
  in-game scheduling and commentary, so they stay exactly as the game has them.
- **Name your own underneath.** Pick the team, name the rivalry, and add a logo
  at 1024 × 1024 if you want one. Without a logo it still gets the generic
  rivalry shield, which is a perfectly good place to stop.
- **A rivalry belongs to both teams, so you only create it once.** Whichever
  program you declare it from, the name and the mark turn up on both teams'
  schedules, in each game's info page, in Scores, on the Media page's game
  grouping, and on both Rivalries pages.
- **A rivalry you've named but not yet played** shows at 0-0 on the Rivalries
  page until you meet, instead of being invisible on the page named after it.

**Nothing is written to your save file.** This is decoration for DynastyOS and
nothing more — delete a rivalry and everything goes back to how the save has it.

## Keyboard shortcuts you can actually find

- **Dark ⇄ light mode arrives on Ctrl + Shift + Z**, and it's rebindable,
  clearable and restorable like anything else. Pages still ship with no key,
  deliberately: which page deserves a shortcut depends entirely on how you play.
- **The built-in keys are listed at last.** Ctrl + K for search, Esc to close a
  panel, Shift + ← / → to step through teams. They have been live for a long
  time and were written down nowhere, so the only way to learn them was to press
  one by accident — and anyone who tried to bind Ctrl + K got a refusal naming a
  shortcut they had never seen.
- **Clear a default and it stays cleared** across restarts, with a per-row
  **Restore** if you change your mind — without costing you every other binding
  you set.

## The Program editor works on every team

It was only ever available on your own program, but it was always stored against
the save's own team slot rather than "mine". If you have imported a dozen
Teambuilder schools, you can now give each of them its stadium name and its
artwork, not just the one you coach.

- **Bowl and rivalry trophies now show on other teams' hubs too.** A browsed
  program's case was only counting conference and national titles, so it was
  missing every bowl that team won and every trophy it holds.
- **The record bar wears the program it is about.** Browsing to another school
  and reading their record off your team's colours said the page belonged to
  you. Your own hub, and any custom theme you picked in Preferences, are
  unchanged.
- **The trophy case stays on one row**, scaling down on a narrower window
  instead of folding into a ragged two-column block.

## Fixes

- **Upset of the Week was picking your team beating an FCS opponent.** The
  placeholder pool has no poll rank, and the missing value fell back to a number
  that made it sort better than two thirds of the league — so "Akron 33, FCS
  Northwest 30" could be reported as the shock of the week. FCS games now count
  only when the FCS side **wins**, and selection follows a proper hierarchy: a
  top-ten team losing to anyone outside the top ten, then a ranked team losing to
  an unranked one, then the largest rank gap. Beating an FCS opponent is the
  expected result of a tune-up; losing to one is still one of the worst results
  in the sport, and it is still reported.
- **15 more stadiums on the Team Hub map** — 137 of 138 programs now have one.
  A pre-existing wrong campus point (Louisiana, 116 miles from its own stadium)
  was corrected while checking them.
- **The All-Time Legends panel named the wrong coach.** The Hall spans a whole
  career across whatever schools and coaches it touched, so no single name is
  right for it — the same correction already made on the page header.
- **The Coaching Tree stopped repeating you.** "Where your people went" and the
  boxed root node with your own name are gone; the Coach Hub's identity line a
  few pixels above already says who you are.

## Media

- **Captions and the delete button only appear on hover.** A wall of thumbnails
  each wearing a dark band and a line of text was a list of filenames; without
  them it's a contact sheet, which is what the page is for.
- **Game folders run in schedule order**, and you can switch which end of the
  season they start from with the new **OLDEST ⇄ NEWEST** switch on the left.
  They used to fall out in whichever order you happened to tag them, so tagging
  week 10 before week 1 opened your season at week 10. The order of photos
  *inside* a folder is untouched — that one is yours to drag.
- **Card book and Scandals moved to the Coach tab rail**, so your card book is
  reachable from every Coach page instead of only from Overview.
- **Add photos / videos** is now **+ Media**.

---

## Installing

Download **DynastyOS-Setup-4.3.0.exe** and run it. It updates an existing
install in place — your dynasties, cards, media and settings are untouched.

Already running 4.2.0? The app will offer this update itself.

## Notes

Your archive upgrades automatically (schema v20 adds one table for custom
rivalries and touches nothing that was already there — verified against a real
45 MB archive with no existing row changed). No re-sync is needed for anything
in this release except the Team Hub maps, which are artwork and appear
immediately.
