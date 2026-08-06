# DynastyOS 4.3.5

A maintenance release. The Hall of Champions now works for modded and custom
coaches, and your archive gets roughly half its size back.

> Everything here is new since **4.3.4**.

---

## The Hall of Champions opens for modded coaches

If your Hall was stuck on *"This dynasty has no coach identity recorded yet. Sync
once…"* — no matter how many times you synced — that's fixed.

Every coach carries an ID that DynastyOS uses to know which one is **you**. Some
coaches don't have one, and the app was treating that as "no coach at all", so
the Hall had nobody to open for. Everything else worked, which is why it looked
so strange: Trophy Room, Standings and the NCAA hub were all fine.

This mainly affected **community roster mods** — the '07 mod's historical coaches
ship without IDs, and in one save 69 of 144 head coaches had none.

Coaches without an ID now get their own, so the Hall opens normally. **Just sync
once** and it's there. If you edited your coach's ID by hand to work around this,
you can leave it — nothing will conflict.

Two things this doesn't change: if you took over an existing in-game coach, or
created your own, you already had a proper ID and were never affected.

## Your archive is about half the size

Some of the data DynastyOS stores each season was being kept uncompressed. On a
real archive that was 20.8 MB of 38.4 MB.

**A 38.4 MB archive becomes 21.2 MB.** The saving grows with every season you
play, and it makes backups and dynasty exports smaller too.

Nothing is lost and nothing changes on screen — seasons convert automatically as
you sync, and DynastyOS reads both old and new formats.

The app also now tidies the file after a sync when there's meaningful space to
recover. Previously that only happened when you deleted a dynasty or restored a
backup, so the file could stay at its largest size indefinitely.

## More reliable coach matching

Coach IDs turn out not to be unique — in one save, 53 IDs were shared between two
or more coaches, and one ID belonged to six of them. A couple of places matched
on the ID alone, which could pick the wrong coach and put a stranger's name on
your Hall or miscount your seasons. Those now confirm the team as well.

## Installing

Download **DynastyOS-Setup-4.3.5.exe** and run it, or let the app offer you the
update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB. This release doesn't change it.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

No database changes — your archive format is untouched and this update cannot
alter what's already stored.

Verified before release against four real saves covering every case: a coach
taken over from the game, a created coach, and two modded rosters.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
