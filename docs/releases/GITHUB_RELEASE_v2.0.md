# DynastyOS 2.0 🏈

**CFB Dynasty Hub is now DynastyOS.** Same app, same dynasties — new name, new look, and the biggest feature drop yet.

This is a normal in-place update. Your dynasties, media, cards and settings carry over automatically, and **your existing image library keeps working untouched.**

---

## ⬇️ Which file do I need?

| I am… | Download | Size |
|---|---|---|
| **Updating from 1.x** | `DynastyOS Setup 2.0.0.exe` | 142 MB |
| **…and I want the new coach polos** | ➕ `DynastyOS Coach Polos 2.0.0.exe` | **1 MB** |
| **Installing for the first time** | `DynastyOS Setup 2.0.0.exe` **and** `DynastyOS Image Data 2.0.0.exe` | 142 MB + 928 MB |
| **Running from a USB stick / no installer** | `DynastyOS 2.0.0.exe` (portable) | 141 MB |

**Updating? You do not need to re-download the image pack.** Your existing artwork is untouched. The only new art in 2.0 is the coach polos, and they ship as a **1 MB standalone add-on** that drops straight into the image folder you already use — it pre-fills the location for you.

> **This is an in-place update, not a fresh install.** Despite the new name, Windows sees the same app: it installs over 1.x, and your dynasties, media, cards and settings all carry across automatically. Nothing to export first.

> **First run shows a Windows SmartScreen warning.** The app isn't code-signed. Click **More info → Run anyway.**

---

## 🕵️ Scandals

A new **Scandals** button on your Coach Hub masthead — for *your* coach only. Off-the-books adjustments, written straight into your save:

- **Tampering** — recruiting hours
- **Sign Stealing** — coach XP speed, experience, level, coach points, prestige, job security, contract points
- **Performance Enhancing Drugs** — talent progress speed and all 18 positional XP sliders
- **Embezzlement** — coach talents, unlocked per tree **and per level**

Talent unlocking is properly fine-grained: open a tree, expand it, set any individual talent to the level you want. **Nothing is ever taken away** — picking a level below what you already own does nothing.

It **backs your save up first and refuses to write anything if that backup fails.** Every value is capped at what the save can physically hold.

> ⚠️ This edits your real save file. There's no undo beyond restoring the backup it makes — especially for talent unlocks.

## 📦 Back up a dynasty — and actually own the file

**Dynasty → Backup** writes a single portable `.zip` wherever you choose.

- **You pick what goes in** — archive, media + card photos, latest game save — each with its size and a running total.
- **One dynasty per file.** Not a dump of everything.
- **Plain zip on purpose**, with readable folders and a README, so the file still means something on a machine that may never run this app.
- **Restore** tells you what's inside — including whether it would replace a dynasty you already have — before it changes anything, and leaves your other dynasties alone.

## 📥 Import reads your saves, not your filenames

Point DynastyOS at your saves folder and it lists what's actually there:

> **Sac State — Patrick Evanz, 2026, Week 1**

instead of `DYNASTY-NDSUBUZZ`. Autosaves and backups are tucked under the dynasty they belong to, the folder is remembered, and **Restore Backup** sits right beside the file picker.

## 🧹 Storage you can finally see

The app had been keeping automatic backups it never told you about. Fixed, and made visible.

- **Preferences → Storage** lists every folder DynastyOS writes to, in plain language, with sizes.
- Backups now only happen when something actually **changed**, are **compressed**, and are **capped**.
- **Delete now means gone** — deleting a dynasty removes its data *and* its files, and reclaims the space.
- **Cache from deleted dynasties** shows leftovers from before, with a **Clear Cache** button.

*On one real machine this reclaimed about 1.9 GB.*

## 🧊 Your history stops being rewritten

Opponent ranks and records are **frozen at kickoff**. Beat a #4 team in Week 2 and they stay #4 in your schedule, game info and scores forever — instead of being quietly rewritten to wherever they finished the season. Applies to other teams' schedules too. The NCAA Hub stays live, as it should.

## 🙈 No more spoilers

Scores for games you haven't played yet stay hidden until you've played your own game that week — matching how the game reveals things, instead of the save handing you results early.

## 👕 Coach polos

Coaches now wear their school's polo, the staff counterpart to player jerseys.

**Already have the image library? Grab `DynastyOS Coach Polos 2.0.0.exe` — it's 1 MB.** It pre-fills the image folder you're already using, so the polos land beside your existing artwork. Nothing else is touched, and there's no reason to re-download the full pack.

*(Installing fresh instead? The full `Image Data` installer includes the polos, and also has a components page if you ever want to pick and choose.)*

## 🖼️ Your photos, your folder

Media Hub photos can now live **wherever you want** — set the library folder yourself and move your existing photos there in one step.

---

## ✨ Also in this release

- **A new look** — black, silver and gold. No blue anywhere, backgrounds to true black, gradients throughout.
- **Far less text.** Wordy page subtitles are now a small **ⓘ** you hover for the detail.
- **Position groups** in recruiting filters — RG/LG → OG, LT/RT → OT, LOLB/ROLB → OLB, LE/RE → EDGE, plus IOL and SFTY.
- **Charts label themselves** — the actual number sits on the chart, with ranks beside the dots on recruiting.
- **Ctrl+Shift+Z** toggles light/dark from anywhere.
- **New app icon** and splash.
- Portraits fixed for the ~0.7% of players whose long names showed initials instead.
- Coach alma maters now resolve to the right school.
- Rivalries: no more duplicate logos in All-Time Series.
- National Recruits: *My Board* no longer defaults to checked; Season Yearbook moved to the bottom.
- Smaller download — build sourcemaps no longer ship.

## 🐛 Notable fixes under the hood

- **Deleting a dynasty didn't fully delete it.** A quirk in how the database was saved silently switched off cascading deletes after the first write of a session, stranding orphaned rows — on one archive, 137 MB of them. Fixed, and the space is reclaimed.
- **Installers were shipping the app's own source code.** Build sourcemaps embedded the full original TypeScript inside every download. They're now excluded.

---

## ⚠️ Known issues

- **Scandals hasn't been through a full in-game playtest yet.** Every field was verified by writing to disposable copies of a real save and reading it back, but the panel itself is new. Take a backup before your first edit — it makes one for you, but be deliberate.
- **Two coach talent trees are hidden** (Rainmaker and Visionary). Both are locked behind a real-money purchase in-game and can't be reliably told apart in the save data.
- The app is unsigned, so SmartScreen will warn on first run.

## 🔐 Checksums (SHA-256)

```
b3b2083cbaebdf68ce87ccc25666d09c2fb696f5fe1a4891feb044cf00553d72  DynastyOS Setup 2.0.0.exe
8855944e628d76a3c93d4acc9fe517270a9ab645a8af07c43fb8de1c8880fcc4  DynastyOS 2.0.0.exe
11abb92952a7a054a71b79c9f177df5d074aba685ae0b98d89279eb2f2dc9a01  DynastyOS Coach Polos 2.0.0.exe
eac690fbfbf4a43e1f84a5b25f453a3d19dbba7e8096dd7639b4f5f9c02e8ac8  DynastyOS Image Data 2.0.0.exe
```

Verify with `Get-FileHash -Algorithm SHA256 "DynastyOS Setup 2.0.0.exe"` in PowerShell.
