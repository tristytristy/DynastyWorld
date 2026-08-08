# DynastyOS 4.4.0

The coach gets a stat line of his own, rivalry weeks finally look like rivalry
weeks, and quarterbacks get a passer rating the game never wrote down.

> Everything here is new since **4.3.5**.

---

## Your coach has a career stat line

A new **Statistics** tab on the coach page adds up everything your players
produced while you coached them — passing, rushing, defense, plays from
scrimmage, yards per play, and the best single season anyone has given you.

It counts **seasons, not careers**. A transfer's freshman year at his old school
isn't yours, and a returning starter shouldn't be counted once for every year he
shows up. So each season is added on its own, and only the seasons you were
actually there for. If a season can't be counted, the page says so rather than
quietly handing you a smaller number.

Underneath, **fifteen top-25 leaderboards** — passing, rushing, receiving,
tackles, sacks, interceptions, pancakes, return touchdowns and more — ranked over
each player's whole career under you. One row per player, not one per season, so
a four-year starter is one entry with four years behind it.

The **Hall of Champions** now stocks its legend pool from those boards
automatically, keeps the record boards beneath the formation, and lets you hover
any leaderboard name for a card or click through to the full profile.

## Passer rating, on every passing line

Game statlines, season stats, career stats and the statistics pages all carry
**RTG** now.

The game never stores it — it computes it live and throws it away. But the five
numbers it's built from are already on every passing line the save keeps, so
DynastyOS calculates the real NCAA formula instead. **No re-sync needed** — every
season already in your archive gets it immediately.

A quarterback who has never thrown a pass shows nothing rather than a zero,
because a zero would sort him below the worst quarterback in the country.

## Offensive linemen exist

Linemen had **no stat line at all** — their numbers live in a different table
that DynastyOS never read, so twelve players on a typical roster came back empty.

**Pancakes and sacks allowed** now come through, and rank on the coach
leaderboards. *This needs one sync to appear.*

## Rivalry games announce themselves

Michigan–Ohio State looked like any other Saturday. Two things were wrong: The
Game has no dedicated crest in the artwork, and DynastyOS only knew about **your
own** team's rivals — so browsing anyone else's schedule went silent.

The save knew all along. Every one of the 138 programs carries its rivals, and
reading all of them turns up **272 rivalries**, named by the game itself. Every
one now shows a shield, falling back to the standard rivalry crest where there's
no dedicated art.

**Game Info names the occasion** — the rivalry, the bowl, the conference
championship. Rivalries the game never named simply read *RIVALRY*. And if the
game is played for a trophy, you see **the trophy** instead of the shield.

The schedule itself stays quiet on purpose: it already shows the shields and the
rankings, and a third marker on every row is clutter, not information.

*The full rivalry list needs one sync.*

## A Score Summary for every game

A new tab on Game Info: who scored, when, and what it made the score. The drive
chart in words.

## The schedule reads better

- Your record moves out of the **Result** column into its own, beside the
  opponent's record — **Opp Rec** and yours, no longer crowding the score.
- **Non-user teams show location too**, and their running record, the same way
  yours does.
- **CFP games show their bowl** beside the round — on your schedule and on
  anyone else's.
- The blue *Neutral Site* and *CFP Quarterfinal* chips are gone. The stadium and
  city stay; it was the boxes that were shouting.

## Photos look the same everywhere

The Media page had grown a proper gallery plate — the photo, its caption
underneath, the program and the occasion in the corners. The player profile's
Showcase and the Game Info media section were still running an older viewer with
a *PHOTO DETAILS* sidebar: same photograph, same three facts, presented as a form
instead of a print.

There is now **one plate**, and it draws every photo in the app.

## Recruiting

- A signed recruit shows **the school's crest** instead of the word SIGNED. Where
  he signed is the news; that he signed is already in the column.
- **Archetype** gets a column, and takes over the filter from *All Stages* —
  stage was already visible in its own column, while archetype, the thing that
  actually separates two recruits at the same position, had no way in.
- The player panel **collapses**, giving the board the full width.
- The recruiting news lists no longer truncate — the top 100 recruits, all 138
  classes, and your whole timeline.

*Signed recruits from other schools show their crests after one sync.*

## The page wears the right team's colours

Browsing Baylor while the app was painted UCLA blue. Any page showing another
program now takes **that program's colours**.

The **Theme Source** preference is gone with it. It offered a choice between your
team's colours and a custom palette, and the team's colours are the entire point.

## DynastyOS tells you when there's new artwork

Portraits and logos live outside the app so you never re-download a gigabyte to
get a bug fix. The cost of that split was silent: when a game patch added new
artwork, no app update could deliver it and **nothing told you it existed**. You
just kept seeing a generic capped model where Bill Belichick should be.

DynastyOS now checks your image folder at launch and puts a card in the corner if
there's artwork you don't have, with a download button. These are small — the
2026-08-06 coach portraits are **190 KB**, not another library.

It checks the actual files, so if you get the artwork some other way it never
asks again. Dismiss with **Not now** and it stays dismissed.

And if you've never installed the image folder at all, the setup screen now has a
**Download content library** button instead of telling you to go and find an
installer it didn't give you a link to.

---

## Fixes

- **Award winners open their real profile.** Clicking a winner from another
  school gave you *"Full profile unavailable"* — the profile only ever searched
  your own roster.
- **The Heisman reaches the Journey and the Trophy Room.** It was the one award
  that appeared on neither. It also no longer crowns anyone mid-season: the
  ranking is a live race, so until the season is decided you'll see *Leader* and
  *Contenders*, not a winner.
- **A second bowl in one season opens its own game.** Both bowls shared an
  identity, so the second one pulled up the first one's data.
- **Playoff first-round games land in the right bracket slot**, including games
  your team wasn't in.
- **The team map is visible again** — it was loading from the wrong address and
  showed almost nobody anything.
- **Update notes read as text**, not raw markup.
- Panels that had asked for spacing between their sections for as long as they've
  existed now get it. Affected the recruit panel, Weekly Honors and one Media
  card.
- Four stat leaders sit in a 2×2 block instead of leaving a hole in a three-wide
  row.
- National leaders switch metric per category — passing by yards, completion
  percentage or touchdowns, and the same for rushing and receiving.

---

## Installing

Download **DynastyOS-Setup-4.4.0.exe** and run it, or let the app offer you the
update — your dynasties, cards, media and settings are untouched.

**First time installing DynastyOS?** You also need the one-time image library —
**DynastyOS.Image.Data.3.0.0.exe** on the [3.0 release][imgdata]. It's a separate
~927 MB download that installs once and survives every update, which is why the
app itself is only ~110 MB.

[imgdata]: https://github.com/matevanz/DynastyHub/releases/tag/v3.0

## Notes

**Three things need one sync to appear:** the full rivalry list, offensive line
stats, and the crests on other schools' signed recruits. Everything else —
passer rating included — works on the seasons already in your archive.

No database changes. Your archive format is untouched and this update cannot
alter what's already stored.

**DynastyOS is not code-signed.** Updates download and install normally, but
Windows SmartScreen may still warn on the installer.
