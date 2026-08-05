# Player identity across seasons

**What this answers:** when two season snapshots both contain "player 5208", is
that the same human being?

**Short answer:** not necessarily. About one time in eight it is a different
person, because the save recycles player ids.

Researched 2026-08-04 against two real multi-season dynasties. Implemented in
`src/shared/playerIdentity.ts`.

---

## The problem

A user opened the profile of an incoming freshman — a true first-year who had
never played a down — and found:

- a **Development chart** running back to 2026, showing a 7-point OVR decline
- a **Journey** entry reading *"First recorded game vs Charlotte · Wk 0"*

Neither belonged to him. Both belonged to whoever previously held his player id.

The natural first guess was duplicate names. It isn't. It's id recycling: when a
player graduates, transfers out or is drafted, **EA hands his id slot to an
incoming recruit.**

### How often

Counting ids present in two or more seasons of the same dynasty, and asking
whether the name attached to that id changed:

| Dynasty | Seasons | Shared ids | Name changed | Rate |
| --- | --- | --- | --- | --- |
| Auburn | 2026–2027 | 13,830 | 1,527 | **11.0%** |
| UCLA | 2026–2028 | 15,308 | 1,964 | **12.8%** |

Examples, all real:

```
id 5208:  2026 "Gavin Abbey"    ->  2027 "Matthew Shumake"
id 4928:  2026 "Will Abraham"   ->  2028 "Nathan Ross"
id 655:   2026 "Cole Adams"     ->  2027 "Malik Frazier"
```

The same ids recur across unrelated dynasties (5208, 3240, 655, 5701 all appear
in both), which is the tell: these are EA's global roster slots being reissued,
not anything specific to one save.

### Why it was invisible for so long

**Within a single season, ids are perfectly reliable and unique.** Every
box score, roster page, stat table and leaderboard looks up players by id inside
one season, and all of them are correct. The bug only exists in code that walks
*across* seasons — career arcs, journeys, hall eligibility — which is a small
minority of lookups.

---

## The rule

> Two rows are the same player when the **id matches**, AND
> (**the name matches** OR **the origin matches**),
> where origin is `hometown` + `homeState` + `heightInches`.

```ts
isSamePlayer(a, b)
  = a.id === b.id
    && ( (a.firstName === b.firstName && a.lastName === b.lastName)
       || (a.hometown === b.hometown
           && a.homeState === b.homeState
           && a.heightInches === b.heightInches) )
```

### Why both halves exist

Measured across **25,647 genuine same-person links** in those two dynasties:

| Attribute | Times it changed for a genuine link |
| --- | --- |
| hometown / homeState | **0** |
| heightInches | **0** |

So requiring origin costs nothing. And of the ~3,500 recycled ids, only **five**
happened to share a hometown, of which exactly **one** also shared a height.

**Why not name alone?** It was 100% precise on this data — but renaming a player
is a supported feature of the in-app editor, and a name-only rule would sever a
player's career the moment you used it. `hometown` is **not editable anywhere in
the editor**, so it survives a rename.

**Why not origin alone?** It admits those five big-city coincidences (two Miami
pairs, an Atlanta pair, a Jacksonville pair, a Lubbock pair), and the name is the
stronger signal in the ordinary case.

Requiring **either** means each covers the other's failure mode: an edited name
falls back to origin, and a coincidental origin is rejected by the name.

### Measured result

Running the implemented rule over every cross-season id in the live archive:

| | Auburn | UCLA |
| --- | --- | --- |
| Genuine links kept | 12,304 | 23,139 |
| Genuine links broken | **0** | **0** |
| Recycled ids correctly rejected | 1,579 | 2,995 |
| Recycled ids still leaking | 1 | 0 |

**4,574 wrong career links removed; nothing legitimate lost.**

The single residual is `id 1763` — "KK Meier" (2026) and "Dante Doubs" (2027),
both from Lubbock, Texas, both 72 inches. No further field separates them, and
chasing it would cost more precision elsewhere than it buys.

---

## Anchoring: *which* occupant do you mean?

Knowing two rows are the same person isn't enough. A career view starts from one
id and has to decide **whose** career to build.

`getPlayerDevelopment` and `getPlayerStatHistory` take an optional
`anchorSeasonId`. The caller passes the season the player is being *viewed* in,
and that row becomes the reference every other season is compared against.

Without an anchor they fall back to the **newest** season holding the id. That is
right for a current player and **wrong for a historical one** whose id has since
been reissued — open a 2026 Hall of Legends player and the newest holder is a
stranger. This is why the player modal passes `resolvedSeasonId` rather than
relying on the default.

---

## Where it applies

Cross-season, and therefore fixed:

| Site | What it drives |
| --- | --- |
| `database/getPlayerDevelopment.ts` | the OVR-over-seasons chart |
| `database/getPlayerStatHistory.ts` | season-by-season production, incl. other schools |
| `PlayerProfileContent.tsx` — `rosterByYear` | the Journey timeline |
| `database/hallOfLegends.ts` — `isEligibleForCoachHall` | who a coach may enshrine |
| `database/getGameLog.ts` — `getPlayerGameLog` | career milestones, "first recorded game" |

**`getPlayerGameLog` is the subtle one, and it was nearly missed.** It reads a
*single* season, which looks safely single-season — but the career-milestones
loop calls it once **per season**, which makes the aggregate cross-season. Its
identity gate therefore engages only when an anchor is supplied and names a
different season; a genuinely single-season caller keeps the cheap path.

That call is what produced the reported *"First recorded game vs Charlotte ·
Wk 0"* on a freshman who had never played. Fixing the roster-level lookups alone
would have corrected his OVR chart and left the false debut on his journey.

Single-season, and therefore deliberately left on a plain id comparison — adding
identity checks here would be pure cost:

`getGameLog`, `getRoster`, `getPlayerStats`, box scores, statistics tables,
national players, media tagging, the recruit board.

**Rule of thumb:** if the lookup is inside one season's snapshot, use `id`. If it
crosses seasons, use `isSamePlayer` / `findSamePlayer`.

---

## Consequences and limits

**No re-sync needed.** Every field the rule uses is already in existing
snapshots. Matching happens at read time, so archives correct themselves as soon
as the code ships.

**Nothing is ever destroyed.** Season snapshots are immutable records. A link
that doesn't form only means two seasons aren't shown as one career — every
per-season view still reads correctly, and restoring the field restores the link.

**The known hole:** editing a player's name *and* his height together breaks his
career link. Height is editable; hometown is not. Deliberate, rare, reversible.

**Older snapshots degrade gracefully.** `sameOrigin` returns false when any
component is missing rather than treating absent as equal — so a snapshot
predating those fields falls back to the name test instead of matching everyone
who lacks a hometown.

---

## Reproducing this

The measurements above came from reading the app's own archive directly:

```
%APPDATA%/DynastyOS/dynasty-archive.sqlite
```

Work on a **copy** — the running app holds the live file. Rosters live in
`season_snapshots` under `name='leagueRoster'`, gzipped and base64'd behind a
`gz:` prefix:

```js
JSON.parse(zlib.gunzipSync(Buffer.from(payload.slice(3), 'base64')).toString('utf8'))
```

Group players by id across a dynasty's seasons, then compare names. Any id whose
name changes is a recycled slot.
