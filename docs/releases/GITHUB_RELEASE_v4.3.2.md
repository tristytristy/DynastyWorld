# DynastyOS 4.3.2

Several of you reported an empty Trophy Room. It wasn't the Trophy Room — the
titles had never been recorded, and the same gap was quietly costing you whole
seasons. This release puts back everything your save still remembers, and
explains how to stop it happening again.

> Everything here is new since **4.3.1**.

---

## Your titles are back

If your Trophy Room was empty despite a conference championship you know you
won, it's there now.

**What was happening.** DynastyOS reads your save at the moment you sync, and
conference titles come from a row the game doesn't fill in until a season
*closes*. Sync in week 10 and play on, and that row stays empty forever — so the
title was never recorded, even though your save knew perfectly well you'd won it.

**They're recovered from your save's own program history**, which keeps a
year-by-year record for every school and survives everything else. No re-sync
needed: it reads what's already in your archive, and it works retroactively for
every past season, whether or not you synced correctly at the time.

## Seasons that were cut short now show what actually happened

A season synced early used to be reported from whatever the app last saw. One
dynasty synced 2029 in week 0, so a **12-2 conference-winning season showed as
1-0** — and every dynasty total was built from that.

Now, where your save knows more than the app captured, your save wins. Record,
conference record, final ranking, conference and national titles all come back.
Affected seasons carry a **Recovered** tag on the History page; click it and it
tells you exactly how much was captured ("we only ever saw 1 of 14 games") and
what can't come back.

Nothing changes for seasons you synced properly — those already had it right.

## Knowing when to sync

A short guide now appears on startup. The headline is the thing most people
don't realise:

**You never need to exit your dynasty.** Advance the week, save in-game, then
hit Sync. Leave the game running — no quitting, no re-importing.

It also covers keeping one save file for syncing so Sync always works, why
syncing weekly matters, and why the End of Season Recap is the one that makes a
season permanent. There's a **Don't show this on startup** box for anyone who
doesn't need it.

## Restoring a backup can hand the save back to the game

Restoring a backup already brought your save file with it — but put it somewhere
only DynastyOS could see, so you couldn't actually load it. There's now a
checkbox to put it back in your College Football saves folder.

**It never overwrites anything.** If a save of that name is already there, that's
your live dynasty, so the restored copy is added alongside as
`YOURSAVE-OS-RESTORED` instead.

---

## What still can't be recovered

Being straight about this, because the recovery above has limits. Once your
dynasty advances to the next year, your save overwrites the previous season's
detail. What comes back is the record, ranking and titles. What doesn't:

- individual game results and box scores
- player and team stats
- week-by-week poll movement
- which bowl you played, and its trophy

Anything you *did* capture at any sync is kept permanently and stays fully
browsable — only what happened after a season's last sync is gone.

## Installing

Download **DynastyOS-Setup-4.3.2.exe** and run it, or let the app offer you the
update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB. This release doesn't change it.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

**No database changes in this release.** The recovery is computed as your pages
load rather than written into your archive, so it costs nothing, corrects itself
the moment a good sync arrives, and cannot damage anything. Verified against a
real archive: byte-identical before and after.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
