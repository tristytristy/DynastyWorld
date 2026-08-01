# DynastyOS 3.0.1 🏈

**Every school gets its history back.**

3.0 rebuilt the player. 3.0.1 rebuilds everything around them: real program history for all 138 schools, a scoreboard you can actually filter, keyboard shortcuts you define yourself, and a live overall rating in the editor.

This is a normal in-place update. Your dynasties, media, cards and settings carry over automatically, and **your existing image library keeps working untouched.**

---

## ⬇️ Which file do I need?

| I am… | Download |
|---|---|
| **Updating from 3.0 or 2.x** | `DynastyOS Setup 3.0.1.exe` |
| **Installing for the first time** | `DynastyOS Setup 3.0.1.exe` **and** `DynastyOS Image Data 3.0.0.exe` |
| **Running from a USB stick / no installer** | `DynastyOS 3.0.1.exe` (portable) |

**Updating? You do not need to re-download the image pack.** No new artwork ships in 3.0.1.

> **⚠️ Sync once after updating.** Program history is new data read from your save, so it appears after the next sync. Everything else works immediately.

> **First run shows a Windows SmartScreen warning.** The app isn't code-signed. Click **More info → Run anyway.**

---

## 🏛️ Program history — for every school

The History page could only ever say *"no titles in the tracked years"* about a school you weren't coaching. That was true of the two seasons the app had, and a useless description of a program. The save has carried the real thing all along.

**All-time.** Auburn: **791-480-47** (.618), 553-172-17 at home, **25-23 in bowls**, 9 of 17 New Year's Six, 8 conference titles, 2 national titles, **604 weeks ranked**, 3 Heismans, 32 All-Americans, **311 players drafted**. Air Force: 439-364-13, 16 of 30 bowls, football since 1956.

**The record book**, with names on it. Bo Jackson's 4,303 rushing yards from 1985. Pat Sullivan's 53 touchdown passes from 1971. Career and single-season, on a switch.

**And your players take it over.** Auburn's single-season passing record already belongs to Byrum Brown — 3,652 yards in 2026, a quarterback that dynasty produced. That's the point: real history your playthrough writes into.

**Season by season** fills in as you play. The all-time totals and record book cover the program's whole life; the year-by-year table starts when your dynasty does, and the page says so rather than blurring the two.

## 🏟️ Scores

- **Filter the whole country.** All NCAA, Top 25, **Upsets**, or any single conference — with live counts on each option so you can see what's there before you pick it.
- **Every box says what kind of game it was**, with the artwork to match: the bowl's logo, the playoff round, the conference championship mark, the rivalry shield, or the conference. Large and centred, the way a broadcast graphic reads.
- **Ranks sit before the team**, scoreboard-style.

*An upset means an unranked team beating a ranked one — measured against the poll as it stood at your last sync, which the page tells you.*

## ⌨️ Keyboard shortcuts

A new keyboard icon in the title bar opens a shortcut editor listing **all 24 destinations**. Nothing ships bound: which page deserves a key depends entirely on how you play, so the app offers the list and you spend the keys.

Click a field, press the combination. It refuses a bare letter, refuses combinations the app already owns (and says which), and never fires while you're typing.

## 🧮 Live overall rating

The player editor's Ratings tab now shows what the ratings you're editing actually come to, using the game's own per-archetype weights — **99.97% exact** against a real 14,838-player check.

It doesn't apply itself: the computed value sits beside the saved one with a button to commit it. Kickers, punters and free safeties are declined outright and say why — their formulas changed in CFB 27 and ours reproduce them under a fifth of the time. A confidently wrong number is worse than none.

## 🎓 Redshirts

**RS Fr. · RS So. · RS Jr. · RS Sr.** on the class line — no new column, no badge, just the two characters the sport actually uses. The class filter on Roster and National Players offers each redshirt year, and the breakdown chips count them separately. On a typical roster that's about half the team.

## 🐛 Fixes

- **Recruits are no longer treated as players.** Searching a common surname returned high-school prospects labelled as "FCS West" players **with their overall rating printed** — a hole straight through the hidden-ratings rule. Prospects now say "Recruit", withhold the rating until revealed, and open the recruit view instead of the full player workspace.
- **Typing a note works.** The form was rebuilding itself on every keystroke, so you got one character and had to click back in. Escape also closed the whole player profile instead of the note; now it just backs out of the note. Ctrl/Cmd+Enter saves.
- **NCAA pages no longer highlight "Coach".** Scores, Statistics, Players and Record Book all lit the wrong section in the main nav.
- **Sub-menus stay put in every hub.** Team Hub's tabs pinned while NCAA's and Recruiting's scrolled away.
- **Pinned rows stack instead of colliding.** The Statistics filter bars pinned underneath the section nav and vanished on a season with enough stats to scroll.
- **Standings is a page about standings again** — the headline, the paragraph and a conference logo that had grown to 340px are gone, so the table starts where you're looking.
- **Team Stats / Player Stats and Season / Per Game** are proper switches now, with the gold team mark, sitting together.

---

## Known limitations

- **Program history needs one sync.** It's read from your save, so it appears after the next one. Seasons synced earlier say so rather than showing an empty program.
- **Season-by-season history starts with your dynasty.** The save itemises seasons from that point forward; all-time totals and the record book are the program's whole history.
- **The multi-season development curve needs successive syncs.** A save carries only the current season's roster.
- **Ratings come from the live save**, so they're only available for the current season's roster.
- **Program editor covers your own program.** Other imported teams still use fallback artwork.
