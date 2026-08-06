# DynastyOS 4.3.1

A Media release. The photo library gets albums you make yourself, three ways to
look at it, and a drag-to-reorder that actually feels like moving photographs.
Plus a handful of things in there that weren't working properly.

> Everything here is new since **4.3.0**.

---

## Albums

- **Make your own albums.** The **+** beside the view switch creates one. To put
  a photo in it, open the photo and use the new **Game | Album** switch next to
  the game picker — "Create new album…" is always the last option, and the only
  one when you don't have any yet. Naming an album there files that photo into
  it straight away.
- **A photo lives in one place.** Filing it in an album takes it out of its game
  folder, and vice versa — so nothing is ever counted twice on the shelf.
- **Deleting an album never deletes photos.** They go back to "Not from a game".
- **Rename any folder** — your albums *and* the game folders — with the pencil
  beside its name. Rename a game folder and the game it came from stays
  underneath, so you never lose track of which Saturday it was.

## Three ways to look at it

- **List** — the folder shelf, one collapsible row per album, each showing a
  single cover thumbnail rather than a stack of five.
- **Album** — one box per album, each running a slow slideshow of its own
  photos. Click one to open it in place; **← All albums** goes back.
- **All photos** — the whole season with no folders at all. This is the one to
  use when you want to select and delete shots that live in different games,
  since a selection can only reach what's on screen.

Whichever you pick is remembered, and game folders now run **later weeks first**
— the folder you want is nearly always the game you just played.

## Reordering

**Drag a photo and the others flow out of the way as you go**, so you can see
exactly where it will land before you let go. It works in every view, and the
**first photo in a folder is the one that folder shows** — so dragging a shot to
the front makes it the cover.

## Fixes

- **The "Drop to add" overlay could get stuck.** Dragging a file onto the page
  and back out left it up over everything with no way to dismiss it. It's now
  driven by the drag itself rather than by an event that Chromium doesn't
  reliably send.
- **Drag-and-drop import** reads file paths through Electron's supported API
  rather than one that's being removed, so dropping a batch of screenshots keeps
  working on future versions.
- **Creating an album looked like it did nothing** if you were in a view with no
  folders in it. It always worked — now it takes you where you can see it.
- **Captions and the delete button** only appear when you point at a photo, so
  the grid reads as a contact sheet instead of a list of filenames.
- **Select is called Select again**, and its panel now does more (see below).

## Select

- A **bin** for deleting the whole selection, kept at the opposite end from
  Apply.
- **Set the game** for everything selected at once.
- **Tag players across the selection** — added to each photo, so tags already on
  a photo are kept.

## The darkroom

- **Vignette is much stronger.** It reaches true black in the corners and starts
  far further in; a middle setting now does what the old maximum did.
- **Grain is visible at last.** Three separate things were holding it back —
  including a grain size below one screen pixel, which averaged out to flat grey.
- **A saturation slider**, 0–200 with neutral marked at 100.
- **A rule-of-thirds grid** you can toggle while framing.
- **The zoom control moved to the bottom centre**, off the team mark it used to
  sit on.

---

## Installing

Download **DynastyOS-Setup-4.3.1.exe** and run it, or just let the app offer you
the update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB. This release doesn't change it.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

Your archive upgrades itself on first launch — this release adds two tables for
albums and touches nothing that was already there. Verified against a real
45 MB archive: no existing row changed, and all 470 media items came through
intact.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
