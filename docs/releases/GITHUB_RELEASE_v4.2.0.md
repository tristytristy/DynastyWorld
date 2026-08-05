# DynastyOS 4.2.0

The playoff release. DynastyOS now draws the twelve-team bracket, knows which
bowl every quarterfinal and semifinal actually is, and hands your program the
trophies it wins on the way to the title. Alongside it: a long run of
truthfulness fixes, several of them things the app had been quietly getting
wrong for a while.

> Everything here is new since **4.0.0**. There is no 4.1.0 — it was prepared
> and rolled into this release rather than shipped separately.

---

## The College Football Playoff bracket

A new page under NCAA, and it appears once there is a bracket to show.

- **The real thing, laid out properly.** Four rounds across the page, first
  round through the National Championship, with every game's seeds, logos and
  score in place. Teams that lose are dimmed to ash so the surviving path reads
  at a glance.
- **Teams place and advance themselves.** The bracket is built from the save's
  own slot numbers, and where a save doesn't carry them it is derived from the
  seeding and results instead — so it reproduces the game's own bracket either
  way, including a seed order that changed because championship week changed it.
- **Hover any bowl or CFP mark** and that game's card appears next to it —
  matchup, seeds, score, setting. Click the card and the full Game Info modal
  opens, the same one the schedule uses.
- **Nothing is clipped.** The whole bracket fits, scales down on smaller
  windows rather than cropping, and can be dragged if it still needs room.

## Quarterfinals and semifinals are real bowls now

The playoff doesn't happen at "Quarterfinal" — it happens at the Cotton, the
Orange, the Rose. DynastyOS now resolves which of the six New Year's bowls each
playoff game was played at, from the venue the save records.

- The **bowl's own logo** appears beside the CFP round mark on the bracket, the
  Scores page and Game Info — the round tells you how deep the run is, the bowl
  tells you what silverware is on the table.
- **Those bowls now count.** Winning a quarterfinal at the Fiesta puts the
  Fiesta Bowl trophy in your Trophy Room, exactly as the real thing does.
- The **National Championship** shows the championship trophy rather than a
  generic bowl mark.

This is resolved when the page is read, not when the save is imported, so it
fills in for **seasons you have already synced** — no re-sync needed.

---

## Fixes

### Results that were never played

Unplayed bracket slots carry the *previous* season's scores and stat lines in
the save. The app's "has this been played?" test accepted them, so a quarterfinal
could report a 35–47 result, complete with a 573-yard stat line, for a game
nobody had played. Every surface now agrees on what "played" means. This is also
the cause behind the report of last season's games appearing in a schedule.

### Ranks now match the game's scoreboard

The in-game scoreboard shows the **CFP committee ranking** once it has been
released; DynastyOS was showing the **media poll** everywhere. From about week 9
onward those two disagree for almost every team — measured on a real season,
**122 of 138**, including three of the top four. Worse, a team could sit inside
the CFP top 25 and outside the media top 25, so the game showed a number and the
app showed no rank at all.

Game Info, Scores, Schedule and program History now all prefer the CFP rank once
released and fall back to the media poll before that. They share one rule, so
they can't disagree with each other either. Point-in-time captures are unchanged
— this only changes which of the two stored numbers is read.

### Total offense was actually all-purpose yards

The save's `TOTALYARDS` includes kick and punt returns. The app printed it under
labels that say offense — the box score, a team profile's "Total Off / G", the
national offensive ranking, the coach metrics. Reported against the game's own
box score: our USC line read 530 where the game said 422, the difference being
that afternoon's kick returns.

The defensive side was worse in kind: **yards allowed** summed the opponent's
all-purpose total, charging a defense for kickoff returns it was never on the
field for.

Total offense is now pass + rush everywhere. On a real 139-team league **127
offensive ranking positions moved**, and yards allowed had been overstated by an
average of **796 yards per team per season**. All-purpose yardage is kept and
honestly labelled — a new **All-Purpose Yards** row under Special Teams, an
**All-P** column on the national table, and Game Info now shows **Total Offense**
and **Return Yards** as separate rows. No re-sync: offense is derived from
fields every archive already stores.

### National statistical leaders

The leaders lists were built by taking the top 100 players by tackles and then
asking that group every other question — so "sacks leader" meant "the best
pass-rusher among the hundred busiest tacklers", 2.7% of the league. Sacks read
5.5 where the truth was 23. Every stat now ranks the whole country.

### Other fixes

- **Coaching trees recorded nothing** on some dynasties. Coaches were identified
  by `PresentationId` alone, which is not unique — one id belonged to both a
  user's head coach and a Memphis assistant. Identity is now first name + last
  name + id, which resolves every coach distinctly.
- **FCS teams appeared in the national player pool.** Five different FCS display
  names share one team index, so thousands of players rendered as "FCS West".
- **Transfers, graduations and NFL departures piled up across seasons** instead
  of showing who arrived and left in the season you're looking at.
- **Transferred players now bring their history.** A player who arrives from
  another school shows his production there, not a blank record before he
  joined you.
- **Three bowls were missing art** because the save names them by sponsor —
  Xbox, Salute to Veterans and Rate now resolve their logos and trophies.
- **Exported photos included the viewer's own buttons.** The controls were being
  hidden before the capture, but they *faded* over 180ms while the capture
  happened in about 32ms, so they were photographed most of the way visible.
- **The card editor's bottom-fade slider did nothing** in the live preview
  beside it, though the setting was correct on the card itself.
- **A card's opponent line never appeared for away games.** Away matchups are
  written "@ Opponent" and the parser only accepted "vs" or "at".
- **Recruit dealbreakers and ideal pitches** were labelled by a generic
  name-splitter rather than the game's own wording, so 41% of prospects showed
  something slightly wrong — "Coachs Favorite", "TVTime", "Student Of The Game".
  Existing dynasties are corrected on read, without a re-sync.

---

## Data safety

- **No schema change.** The database stays at version 18, so an existing
  archive upgrades exactly as it did on 4.0.0.
- Nothing in this release deletes or rewrites saves, snapshots, media or cards.
- **Most of the corrections apply to seasons you have already synced**, because
  they are made when data is read rather than when it is imported. The playoff
  bowl identity, the yardage split, the rank rule and the recruit labels all
  work on existing archives.

## Upgrade notes

- Install over your existing DynastyOS; your dynasties, media and cards carry
  over untouched.
- The playoff bracket needs a season that has reached the playoff to show
  anything — it stays hidden until there is a bracket.

## Known limitations

- **The bracket's first round has no bowl identity** because those games are
  played on campus, not at a bowl. That is correct, not missing.
- **CFP poll movement** is still unavailable: the save's CFP "last week" value
  mirrors its current rank on every save tested, so no honest delta exists.
- **DynastyOS is not code-signed.** Updates download and install normally, but
  Windows SmartScreen may still warn on the installer.
- Four transitive npm advisories remain open (react-router, fast-xml-parser,
  brace-expansion). None is reachable in a desktop hash-routed app with no
  remote content. See `docs/releases/V4_RELEASE_AUDIT.md`.

## Verification completed

TypeScript, ESLint, the reference-integrity check and the production build all
pass. Beyond that, the corrections in this release were checked against **real
save files** rather than reasoned about: the playoff bowl mapping against the
user's own in-game bracket screenshots, the yardage formulas against 2,168 team
game lines across two unrelated saves, the recruit label maps against both saves
plus the save's own schema enum, and the rank rule against a live week-15
dynasty's two polls.
