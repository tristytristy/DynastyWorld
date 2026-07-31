# DynastyOS 3.0 🏈

**Your players finally have a workspace worth opening.**

3.0 rebuilds the player profile from ten tabs into five destinations, turns trading cards into a real collection, gives imported Teambuilder schools their own identity, and makes the whole thing considerably faster.

This is a normal in-place update. Your dynasties, media, cards and settings carry over automatically, and **your existing image library keeps working untouched.**

---

## ⬇️ Which file do I need?

| I am… | Download |
|---|---|
| **Updating from 2.x** | `DynastyOS Setup 3.0.0.exe` |
| **Installing for the first time** | `DynastyOS Setup 3.0.0.exe` **and** `DynastyOS Image Data 3.0.0.exe` |
| **Running from a USB stick / no installer** | `DynastyOS 3.0.0.exe` (portable) |

**Updating? You do not need to re-download the image pack.** No new artwork ships in 3.0 — your existing library is untouched.

> **This is an in-place update.** It installs over 2.x, and your dynasties, media, cards and settings all carry across automatically. Nothing to export first.

> **First run shows a Windows SmartScreen warning.** The app isn't code-signed. Click **More info → Run anyway.**

---

## 👤 The player profile, rebuilt

Ten tabs became **five destinations**:

**Overview · Performance · Ratings · Journey · Showcase**

The old set was never ten answers. Stats, Career and Game Log were one question asked three ways. Awards, Media, Notes and History were another. You were doing the consolidating.

### Overview — who is this player

A two-column read separated by hairlines rather than a wall of boxes: **Player profile** and **Development** on top, **Season snapshot** and **Player DNA** beneath, with your latest career event across the foot. The hero owns identity — number, team, position, class, name, overall — and nothing appears twice.

### Performance — how is he playing

`This Season · Career · Games`, ordered by how fast each part answers: headline numbers, then recent form, then the full line, then the log. **Game-log rows are now clickable** and open that game's box score.

Recent form and Best Game only appear when there's more than one game to compare — one game isn't a trend, and it isn't a "best" either.

### Ratings — how good is he

Leads with **Player DNA**: his strength, his weakness, and what to develop next, chosen from the ratings that actually decide his position. Then the rating groups that matter for that position, with **View all ratings** holding the rest.

### Journey — what has happened to him

One chronological career narrative instead of four separate lists. Milestones, national awards, All-America selections, weekly honors and team awards all interleave into a single timeline, filtered by `All · Milestones · Honors · Notes`.

### Showcase — what you've made of him

Your cards and your tagged photos, together, on a switch.

---

## 🃏 Trading cards

- **A real collection.** Equal cards, three to a row. Click one and it opens full size with ← → to walk the set.
- **Everything for one card lives with that card** — edit, export, favourite, set-as-default and delete are all in the expanded view, where there's no wrong card to hit.
- **A card can celebrate one game.** Pick the season line or any single Saturday — the four-touchdown night against the rival is now a card you can actually make.
- **Choose what the card shows.** Overall, name, profile line, stat row and team logo each toggle on or off, and the card keeps that look everywhere — the book, the hover preview and the exported PNG.
- **A card is a printed moment.** The year, the school and the profile line lock in when you make it. A transfer, a class change or a re-sync will never quietly reprint an old card as this season.

## 🖼️ Media

- **Zoom and pan any photo** — the slider, the scroll wheel, or drag to move around. Double-click snaps back.
- **Save the framing.** Found the crop you want? Keep it, and the photo opens that way every time with its thumbnail matching. **Nothing is done to the file** — the full original is always underneath, and Reset gives it straight back.
- Because of that, the same shot can be cropped one way in your gallery and framed completely differently on a card.

## 🏟️ Program editor — for imported teams

Teambuilder schools import over a real school's slot, so the app has no artwork for them: placeholder logo, generic helmet, no uniform, no coach polo.

**Program editor**, on your Team Hub above Program budget, fixes that:

- **Stadium name and city** — shows on your schedule and every game's info page
- **Program logo** — 1024 × 1024
- **Helmet** — 1024 × 1024 (the other side is mirrored for you)
- **Uniform** — 512 × 512, sits over a player portrait
- **Coach polo** — 512 × 512, sits over a coach portrait

Four uploads dress a team completely, and the art appears everywhere team art appears — mastheads, matchup graphics, roster portraits, coach cards, trading cards.

Your files are copied into the app's own storage, so moving or deleting the originals won't break anything, and nothing is written to your save. Edits belong to **that dynasty only** — an imported team sharing a name with a real school never changes that school in your other saves.

## ⚡ Speed

- **Opening a player is roughly five times faster** — a second on a busy dynasty became about two-tenths.
- **Moving between players is near-instant.** Prev/Next now lands in about 50 ms instead of pausing to re-read your entire save file each time.
- Destination data loads when you open that destination and stays loaded, so going back is free.
- **Big galleries load what you're looking at, not the whole page.** A roster or national player gallery used to fetch every portrait, jersey and logo on the page at once — 600 images before it settled. Artwork below the fold now waits until you scroll to it, cutting the opening burst by about **85%** on the national gallery and **two-thirds** on your roster. Nothing looks different; it just stops doing the work you didn't ask for.
- **The app download is ~42 MB smaller.** A handful of art folders with no reference anywhere in the app were being copied into every build. They're gone from the installer — the image library is untouched.

## 📌 Navigation

- **The menus stay put.** Section tabs, team tabs and the season switcher pin to the top, so a long page no longer means scrolling back up to change year or tab.

## 🐛 Fixes

- **Media photos on a card no longer show a stale image** after you replace one.
- **Awards no longer duplicate** across a player's career.
- **Conference championship and bowl venues resolve on existing dynasties** without a re-sync.
- **Kickers, punters and thin rosters** get honest empty states instead of grids of zeros.
- **Viewing another team's History** no longer shows your own program's record book under their name.
- **Arrow keys in the User Manual** print as arrows instead of empty boxes.

---

## 📖 Documentation

The **User Manual** is rewritten for 3.0 — the five-destination player profile, the card collection and card book, the Program editor, and Media's zoom-and-framing all have proper sections, and the honest-limitations list is current. It's in the app (sidebar → User Manual) and ships as a PDF.

---

## Known limitations

- **The multi-season development curve needs successive syncs.** A save file only carries the current season's roster, so one import gives you one full season. Sync each year and the curve builds.
- **Ratings come from the live save**, so they're only available for the current season's roster. Past-season profiles say so rather than guessing.
- **Program editor covers your own program.** The other imported teams in a save still use fallback artwork for now.
