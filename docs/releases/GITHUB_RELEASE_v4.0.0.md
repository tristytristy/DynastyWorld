# DynastyOS 4.0.0

The national picture, rebuilt. This release turns the NCAA Hub into a real
broadcast-style command centre, gives the app a coach's own wing, adds a Hall of
Champions, and does a full production audit on the way out the door.

---

## Highlights

### The NCAA Overview is a dashboard now

The old page was eleven stacked cards saying overlapping things. It is now one
dense three-column read, and every fact has exactly one home.

- **Top Scores ribbon** — a leaguewide scoreboard strip across the top, ordered
  by how national each game is (both teams ranked first, upsets leading the
  one-ranked band). It auto-scrolls slowly and stops the moment your pointer or
  keyboard focus is anywhere near it. Every tile opens the real Game Info modal.
- **Game of the Week hero** — two 400px opposing helmets lit in each team's own
  colours, with ranks, records, kickoff, setting and the narrated result.
- **College Football Top 25** — AP/Media and Coaches polls, each with its own
  true week-over-week movement. The CFP tab appears only once the committee has
  actually released a poll.
- **Around the Nation** — National, Conference and Watchlist readings of the
  same week, built only from facts the save proves.
- **Recruiting News** — top prospects, class rankings, and your own board.
- **Offense / Defense leaders** — national statistical leaders using the exact
  stat definitions and formatting the National Statistics page uses.

### Storytelling that stops repeating itself

Story text used to be one fixed sentence shape per card, so the page read stale
after a few seasons. Facts and prose are now separate: builders compute the same
exact numbers and hand them to a phrase-picker seeded off the event itself — so
the same result always reads the same way, and different results read
differently. Streak awareness ("that's seven straight"), poll movement, and
margin-aware phrasing all come from real schedule and poll data.

### Coach's wing and Hall of Champions

A dedicated Coach hub (Overview, Season, Career, Staff, Milestones, Trophy Room)
and a **Hall of Champions** that arranges the players you kept as a real
formation on a field.

### DynastyOS updates itself now

No more downloading an installer from a browser and hunting for it in your
Downloads folder. DynastyOS checks GitHub for you, and when there's a new
version it says so in a small card in the corner — not a dialog across your
screen.

Click **Update DynastyOS** and it downloads inside the app, with a progress bar,
the size so far, and the speed. When it's done you choose when to install:
**Restart and Update** closes DynastyOS, installs, and reopens it for you.

Before it closes, it checks that nothing important is still running. If you're
part-way through an import, a sync or a backup, it says so and waits for you
rather than restarting over the top of it — your archive is never left half
written.

### It scales to your monitor

New breakpoints at 1920, 2560 and 3200 px. On a 4K display the shell now opens
to 2760 px with larger helmets, taller lists and more columns instead of sitting
in a 1600 px island. Everything from 1024 to 1920 px is pixel-identical to
before.

---

## Fixes and cleanup in this release

- **Scoreboard truthfulness.** The ribbon never picks a week whose results the
  game is still withholding, even when your own game in it has a score.
- **The polls rank all 138 FBS teams**, not 25 — so a rank chip no longer reads
  "#112", every upcoming game no longer claims "2 ranked teams", and prose only
  calls a team ranked when it is inside the top 25.
- **Coaches poll movement is the coaches poll's own**, never the media poll's.
- **"Heisman Winner" in September** is gone; the row is an Award Watch.
- **Team-modal button contrast.** A viewed team's colour now computes its own
  text colour, so a navy team's button no longer inherits near-black text.
- **Hall of Champions zoom** no longer clips the top row of cards.
- **One duplicate leaguewide request** removed from the NCAA Overview.
- **~42 MB of never-loaded artwork** removed from the installer.

## Security hardening

- New-window handling and navigation are now locked down: nothing may open a
  window, and the frame cannot be navigated away from the app document. External
  links go to your real browser.
- The renderer sandbox is declared explicitly.
- Four privileged bridge methods that no screen called — including two that
  accepted an arbitrary filesystem path — were removed entirely.
- Update downloads only ever open GitHub hosts.

## Data safety

- **No schema change.** The database stays at version 18; migrations are
  append-only release history and were not touched, so an existing database
  upgrades exactly as it did on 3.0.2.
- Nothing in this release deletes or rewrites saves, snapshots, media or cards.
- No artwork was deleted — the unused folders are excluded from the installer
  only, and the standalone image-data installer is unaffected.

## Upgrade notes

- Install over your existing DynastyOS; your dynasties, media and cards carry
  over untouched.
- **This is the last update you have to install by hand.** Auto-updating starts
  working from 4.0.0 onward — earlier releases were built before the updater
  existed and carry no update feed for the app to read.
- Some new surfaces (rank movement, short team abbreviations in the ribbon,
  league rosters) read fields captured **at sync time**. Seasons synced before
  those fields existed simply omit them rather than guessing — re-sync a dynasty
  to fill them in.

## Known limitations

- **National commitment destinations** are not shown. The save records which
  school a prospect signed with, but only your own board captures it at
  extraction time — so the Commits tab shows your proven, week-stamped timeline
  and says plainly what it cannot know about everyone else.
- **CFP poll movement** is unavailable: the save's CFP "last week" value mirrors
  its current rank on every save tested, so no honest delta exists.
- **Season switching and backup/restore round trips were not re-verified** in
  this pass — both test archives hold a single season. They are unchanged from
  3.0.2.
- **DynastyOS is not code-signed.** Updates download and install normally, but
  Windows SmartScreen may still warn on the installer. Signing needs a paid
  certificate; it changes nothing about how the update works.
- Four transitive npm advisories remain open (react-router, fast-xml-parser,
  brace-expansion). None is reachable in a desktop hash-routed app with no
  remote content; each fix needs a major upgrade, which is deliberately not part
  of a cleanup release. See `docs/releases/V4_RELEASE_AUDIT.md`.

## Verification completed

TypeScript, ESLint, the reference-integrity check and the production build all
pass. The application was booted and driven for every workflow listed in the
audit document — import, dashboard, all modals, both appearances, and four
window widths from 1024 to 3840 px — against a disposable copy of a real save in
an isolated data directory.
