# DynastyOS 4.3.3

Several of you reported an empty Trophy Room, and coordinators from last season
being replaced by this season's. Both turned out to be the same thing: data that
depends on *when* you sync. This release puts back everything your save still
remembers, stops the parts that were being overwritten, and explains how to keep
a season whole.

> Everything here is new since **4.3.1**. (4.3.2 was pulled before release —
> all of it is included below, so you're not missing anything by skipping it.)

---

## Your titles are back

If your Trophy Room was empty despite a conference championship you know you won,
it's there now.

Conference titles come from a row the game doesn't fill in until a season
*closes*. Sync in week 10 and play on, and that row stays empty forever — so the
title was never recorded, even though your save knew you'd won it.

**They're recovered from your save's own program history**, which keeps a
year-by-year record for every school. No re-sync needed: it reads what's already
in your archive, and works retroactively for every past season.

## Seasons that were cut short show what actually happened

A season synced early used to be reported from whatever the app last saw. One
dynasty synced 2029 in week 0, so a **12-2 conference-winning season showed as
1-0** — and every dynasty total was built from that.

Now, where your save knows more than the app captured, your save wins. Record,
conference record, final ranking and titles all come back. Affected seasons carry
a **Recovered** tag on the History page; click it to see exactly how much was
captured and what can't come back.

Nothing changes for seasons you synced properly.

## Your coordinators stay put

**Reported by Barcode.** The coaching carousel moves coordinators right after the
national championship — so syncing during the offseason was overwriting the
finished season's staff with their replacements. Last year's Overview and Staff
showed coordinators who were never there, and the ones who actually won it
disappeared.

Staff is now locked once a season is over. An offseason sync no longer replaces a
capture taken while the season was live.

## A History Only season can become a real one

If a season was added from league history and you later synced that year for
real, it kept the "History Only" label permanently — and worse, several pages
(schedule, standings, stats, awards) refused to open it at all, even though the
data was sitting right there.

Syncing that year now promotes it properly, and every page opens.

## Knowing when to sync

A short guide appears on startup, led by the thing most people don't realise:

**You never need to exit your dynasty.** Advance the week, save in-game, then hit
Sync. Leave the game running — no quitting, no re-importing.

It also covers keeping one save file for syncing so Sync always works, why weekly
syncing matters, and why the End of Season Recap is the sync that makes a season
permanent. There's a **Don't show this on startup** box.

## Backups around updates

- **A full backup is now taken automatically before an update installs** — the
  last moment your archive still belongs to the version you're running.
- **A "Back up now" button** on the update card, so you can take one yourself and
  see it worked.

## Restoring a backup can hand the save back to the game

Restoring already brought your save file with it, but put it somewhere only
DynastyOS could see. There's now a checkbox to put it back in your College
Football saves folder.

**It never overwrites anything.** If a save of that name is already there, that's
your live dynasty, so the restored copy is added alongside as
`YOURSAVE-OS-RESTORED`.

---

## What still can't be recovered

Once your dynasty advances to the next year, your save overwrites the previous
season's detail. What comes back is the record, ranking and titles. What doesn't:

- individual game results and box scores
- player and team stats
- week-by-week poll movement
- which bowl you played, and its trophy

Anything you *did* capture at any sync is kept permanently and stays fully
browsable — only what happened after a season's last sync is gone.

## Installing

Download **DynastyOS-Setup-4.3.3.exe** and run it, or let the app offer you the
update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB. This release doesn't change it.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

**No database changes in this release.** Your archive format is untouched, so
this update cannot alter what's already stored — the recovery is computed as your
pages load rather than written into your archive. Verified directly: no
migrations, and the only code that can change a season's "History Only" status
sets it to *full*, never the other way.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
