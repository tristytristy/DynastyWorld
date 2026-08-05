# DynastyOS 3.0.2 🏈

**Your roster, in a spreadsheet — and a departures list that tells the truth.**

A maintenance release built almost entirely from things people hit while playing. The roster exports to CSV, the Roster page now reports how good your offense and defense actually are, and the "Left the program" list stops naming players who never left while finally naming the ones who did.

This is a normal in-place update. Your dynasties, media, cards and settings carry over automatically, and **your existing image library keeps working untouched.**

---

## ⬇️ Which file do I need?

| I am… | Download |
|---|---|
| **Updating from 3.0.x or 2.x** | `DynastyOS Setup 3.0.2.exe` |
| **Installing for the first time** | `DynastyOS Setup 3.0.2.exe` **and** `DynastyOS Image Data 3.0.0.exe` |
| **Running from a USB stick / no installer** | `DynastyOS 3.0.2.exe` (portable) |

**Updating? You do not need to re-download the image pack.** No new artwork ships in 3.0.2.

> **First run shows a Windows SmartScreen warning.** The app isn't code-signed. Click **More info → Run anyway.**

---

## 📊 Export a roster to a spreadsheet

**Export Roster** on the Roster page saves whatever the page is showing — the team in the switcher, at the season you've selected.

The save dialog offers **CSV** (the default) and XML. CSV is the one to pick for **Google Sheets, Excel, or LibreOffice/OpenOffice Calc**: one row per player, 69 columns — the full profile plus all 51 individual ratings — ready to sort, filter and chart. Team and season ride on every row, so several exports paste into one sheet and stay distinguishable.

The XML export from 3.0.1 is still there for other tools, but no spreadsheet app opens it — that's a shape problem, not a bug in the file, and it's why CSV now leads.

*Ratings come from your save, which only holds the current season, so exporting a past season fills the profile columns and leaves the ratings blank. The message under the button says how many players came out with full ratings.*

## 🧮 The Roster page tells you about the roster

**Team · Offense · Defense** replace the old Players / Filtered / Average OVR counters — the average overall of each unit, with the player count underneath each one.

**And they follow what you're looking at.** Click the freshman chip and the row becomes "how good is this class". Pick Defense in the units menu and the defensive number is the only one with players behind it. Unfiltered, it's your team.

*These are the roster's averages, not the team rating the game shows — that one is built from the depth chart, which the save doesn't store. Compare them between teams and seasons rather than against the in-game number.*

## 🎓 The class row is now the filter

The **All classes** dropdown is gone. The class breakdown that was already sitting one row underneath it — `21 Freshman`, `7 RS Freshman`, `24 RS Sophomore`… — does the job instead.

Click one to filter. Click several to combine: freshmen *and* RS freshmen are a recruiting class; seniors *and* RS seniors are who's leaving. A **Clear** button appears at the end of the row while anything is selected.

## 🐛 Fixes

- **"Left the program" was showing declarations, not departures.** It came from the game's Players-Leaving list, which is what players *said* — so it named players who declared and came back, and completely missed graduating seniors, who are never in that list at all. On one test dynasty that was 5 names shown where 27 had left. It now checks who's actually gone from the next season's roster; the game's list only supplies the reason. Seniors read *Graduated*, anyone younger who dropped off FBS reads *Left FBS*, and until the following season is synced the card says these are declarations that aren't final.
- **The delete button on a dynasty card did nothing.** On a narrower window the coach portrait was drawn on top of it and swallowed the click — which is why only *that* button broke and Sync, Export and Backup were fine.
- **Restoring a backup could fail outright.** A dynasty with a lot of Media Hub photos hit `UNIQUE constraint failed: media_items.id`, and separately, restoring into an archive that already had seasons could fail with "could not be renumbered safely". Both are fixed, and a restore that does fail no longer touches your existing copy of that dynasty.
- **The hover preview is legible now.** The card is designed at a size the hover doesn't use, so the profile line and stat row arrived too big for their boxes. Hovering a player shows the name, the school's mark and the OVR; the full card is one click away in the modal.
- **The Export button sits on the class row** instead of its own strip, and the roster stat tiles no longer waste space on numbers you could already see.

---

## Known limitations

- **The corrected departures list needs the following season.** A season resolves once you've synced the next one; before that it shows the game's declarations and says so.
- **NFL draft results aren't in the save.** Only a projected round is stored — no pick, no team — so "Proj. Rd 4" can differ from what the game showed you. We checked the save's own draft tables directly: they're empty.
- **Ratings come from the live save**, so they're only available for the current season's roster — in the editor and in the CSV export alike.
- **The multi-season development curve needs successive syncs.** A save carries only the current season's roster.
- **Program editor covers your own program.** Other imported teams still use fallback artwork.
