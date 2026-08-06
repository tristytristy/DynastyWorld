# DynastyOS 4.3.4

**If you installed the August 6 game update and DynastyOS stopped importing your
save, this fixes it.** Update and everything works again.

---

## What happened

The August 6 title update changed how coach information is stored inside your
save file. DynastyOS reads saves using a "map" that says where each piece of
information lives, and the update moved things around — so the map no longer
matched.

The result was that DynastyOS couldn't find your coach, and without your coach
it couldn't tell which team the dynasty belonged to. That produced this, on
import or sync:

> Could not determine which team this dynasty belongs to.

**Nothing was wrong with your save**, and nothing was lost. Your dynasty, your
seasons, your photos and your archive were never touched. DynastyOS simply
couldn't read a file it had no map for.

It also wasn't caused by any mod or third-party tool. Other CFB tools broke the
same day for exactly the same reason — anything that reads coaches from a save
was affected.

## The fix

DynastyOS now carries the updated map and uses it automatically when it sees a
save from the new game version.

- **Patched your game?** Import and sync work normally again.
- **Haven't patched yet?** Nothing changes for you. DynastyOS still reads your
  saves exactly as before, and will keep doing so after you update.

You don't have to choose, re-import, or reconfigure anything. It picks the right
one per save file.

## Installing

Download **DynastyOS-Setup-4.3.4.exe** and run it, or let the app offer you the
update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB. This release doesn't change it.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

No database changes — your archive is untouched, and this update cannot alter
anything already stored.

Verified against five real saves before release: two created after the update
and three from before it, all reading correctly.

If a future game update causes the same symptom, it's the same cause and the fix
is the same shape — please report it rather than assuming your save is damaged.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
