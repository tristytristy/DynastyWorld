# DynastyOS — 2.0 🏈

The app has a new name. **DynastyOS** brings per-dynasty **backups you own**, an **Import picker** that reads your saves by school and coach instead of filenames, honest **storage controls**, a black-and-gold look, and **Scandals** — a save editor for your own coach.

It's a normal in-place update: your dynasties, media and cards come with it, and your existing image library keeps working untouched.

**Two downloads, as usual.** The app installer is the small one. The separate **Image Data** installer only matters this time if you want the new coach polos — see below.

---

## 📦 Back up a dynasty — and actually own the file

**Dynasty → Backup** now writes a single portable `.zip` wherever you choose.

- **You pick what goes in.** Archive, media + card photos, latest game save — each with its own size, and a running total, so you know what you're making before you make it.
- **One dynasty per file.** Not a dump of everything.
- **Plain zip on purpose.** Readable folders and a README inside, so the file still means something on a machine that may never run this app.
- **Restore** brings it back without disturbing the dynasties already here, and tells you what's in the file — including whether it would replace one — before anything changes.

## 📥 Import reads your saves, not your filenames

Point DynastyOS at your game's saves folder and it lists what's actually there: **"Sac State — Patrick Evanz, 2026, Week 1"** rather than `DYNASTY-NDSUBUZZ`.

- Autosaves and backups are grouped under the dynasty they belong to, behind a **Show older versions** toggle.
- The folder is remembered, and **Pick a file myself…** is still there.
- Already-imported saves are labelled as such.
- **Restore Backup** sits right here too, next to the file picker.

## 🧹 Storage you can see

The app was keeping automatic backups you were never told about. That's fixed, and visible.

- **Preferences → Storage** lists every folder DynastyOS writes to, in plain language, with sizes.
- Backups now only happen when something actually **changed**, are **compressed**, and are **capped** — no more silent growth.
- **Delete now means gone.** Deleting a dynasty removes its rows *and* its files, and reclaims the space.
- **Cache from deleted dynasties** shows anything left over from before, with a **Clear Cache** button.

*On one real machine this reclaimed about 1.9 GB.*

## 🖼️ Your photos, your folder

Media Hub photos can now live **wherever you want** — set the library folder yourself and move your existing photos there in one step.

## 🕵️ Scandals

A new **Scandals** button on the Coach Hub masthead, for your own coach only. Off-the-books adjustments, written straight to your save:

- **Tampering** — recruiting hours
- **Sign Stealing** — coach XP speed, experience, level, coach points, prestige, job security, contract points
- **Performance Enhancing Drugs** — talent progress speed and all 18 positional XP sliders
- **Embezzlement** — coach talents, unlocked per tree *and per level*

Talent unlocking is genuinely fine-grained: pick a tree, expand it, and set any individual talent to the level you want. Nothing is ever taken away — choosing a level below what you already own does nothing.

**It backs your save up first, and refuses to write anything if that backup fails.** Every value is capped at what the save can physically hold; these fields are packed to the bit, and an over-large number wraps silently rather than erroring.

## 🧊 Your history stops being rewritten

Opponent ranks and records are now **frozen at kickoff**. A team you beat in Week 2 when they were #4 stays #4 in your schedule, game info and scores forever, instead of being quietly rewritten to wherever they finished. Applies to other teams' schedules too. The NCAA Hub stays live, as it should.

## 🙈 No more spoilers

Scores for games you haven't played yet stay hidden until you've played your own game that week — matching how the game reveals things, instead of the save handing you results early.

## 👕 Coach polos

Coaches now wear their school's polo, the staff counterpart to player jerseys.

**Already have the image library installed separately?** The **Image Data installer** now
lets you add just the new artwork: it opens on a components page where you can untick the
full library, and the folder box is **pre-filled with the image folder you already use** —
so the polos drop straight into it instead of creating a second copy of a gigabyte of art.

## ✨ Also in this release

- **A new look** — black and gold, no blue, with gradients and cleaner selection.
- **Less text everywhere.** Wordy subtitles are now a small **ⓘ** you can hover for the detail.
- **Position groups** in recruiting filters — RG/LG → OG, LT/RT → OT, plus IOL and SFTY groupings.
- **Charts show their numbers** on the chart itself, with ranks beside the dots on recruiting.
- **Ctrl+Shift+Z** toggles light/dark from anywhere.
- Portraits fixed for the ~0.7% of players whose long names showed initials.
- Coach alma maters now resolve to the right school.
- Rivalries: no more duplicate logos in All-Time Series.
- Sourcemaps no longer ship, making the installer smaller.

---

## ⚠️ Notes

- **Scandals writes to your real save file.** It backs up first, but there's no undo beyond restoring that backup — especially for talent unlocks.
- Two coach talent trees (**Rainmaker** and **Visionary**) are hidden: both are locked behind a real-money purchase in-game and can't be told apart in the save data.
- The app is unsigned, so Windows SmartScreen will warn on first run — **More info → Run anyway**.
