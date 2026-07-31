# Dev Log

**Read this before starting a new phase.** It's the fast way to re-load context: what's built, what broke and why, what decisions were made and why, what's next.

**Update this after completing a phase** â€” append a new `## Phase N â€” <name>` section following the template at the bottom. Keep entries factual and terse: what shipped, what broke, what was deliberately deferred and why. Skip narrating routine work that had no surprises.

---

## Status

- **2026-07-31: Pinned section nav — sits at the top now, and nothing shows above it (3.0.0 re-cut, same version).** User reported the Coach Hub masthead scrolling through the pinned nav — "the same problem we had with our game info page." **Root cause:** a `position: sticky` row pins to its scroll container's **CONTENT** box, not the top of the scrollport. `<main>`'s scroller carried `p-5 md:p-8`, so the section nav pinned 32px down with a live 32px band of scrolling page above it — measured, not eyeballed: scrollport top 41, nav top 73, and `elementFromPoint` across the band returned the masthead `<img>`. DynastyLayout's `-mt-5` was an old attempt to claw that back and never could: one value against a padding step that changes at `md`, and a margin doesn't move the sticky offset anyway. **Fix, structural rather than a mask:** the scroller gives up its top padding (`px-5 pb-5 md:px-8 md:pb-8`), so `top-0` now means the top of the panel and the band cannot exist — `navTop === scrollportTop === 41`, band probes empty. Dashboard (the only other top-level route) carries its own `pt-5 md:pt-8`; the dynasty tree gets its spacing from the nav's own padding. **Alignment (user direction: "align with the Dynasty side menu text", snug):** `pt-3.5` on the nav, derived from measurement — the sidebar "Dynasty" label centres on y=79, the tab row carries 6px of its own lead, so 14px from a flush edge lands the tabs on that exact line (verified: tab centre 79). **Knock-on caught before it shipped:** Team Hub's sub-nav pinned at a hard-coded `top-[4rem]`, which under-measured the new row by 7px and tucked its top edge behind it. DynastyLayout now publishes the row's real height as `--section-nav-h` via ResizeObserver and the sub-nav offsets by that — a literal would also break the moment that flex-wrap row wraps to two lines at a narrow width. Verified flush: sub-nav pins at 112, nav bottom 112, zero gap and zero overlap. **Incidental:** the rebuild surfaced a latent `TS1149` — `index.tsx` imported `./app` while the file is `App.tsx` (git tracked it lowercase); the persistent webpack cache had been masking it. Normalised to `App.tsx` via `git mv` + the import. Build-time only (the asar ships a bundle, not the .tsx), but it would have bitten on any case-sensitive checkout. typecheck/lint clean; app + portable exe re-cut at the SAME 3.0.0, image pack untouched.
- **2026-07-31: v3.0.0 packaged — performance audit, manual rewrite, leaner installer.** Release checkpoint for 3.0 (`package.json` 2.2.0 → 3.0.0 + lock). **Performance audit, measured not guessed.** Instrumented the `cfbmedia://` handler and drove real routes through the `USE_PRE_SPLASH_ONLY` + `SCREENSHOT_EVAL` harness against a copy of the real 44 MB archive. Found one genuine lag: **every portrait, jersey overlay and team logo on a page loaded eagerly** — the National Players gallery fetched **606 images (306 requests / ~20 MB)** before it settled, the roster gallery 179. Fixed with `loading="lazy"` + `decoding="async"` in `PlayerPortrait`, `CoachPortrait` and `TeamLogo`, deliberately **excluding** the cases that must stay eager: `large`/`fill` portraits, `xl` coach heroes and `size="lg"` logos — those are the hero and the trading card, and a lazy image would export as a blank PNG. Result: national gallery **252 → 44 requests (6.8 → 1.1 MB, −84%)**, roster **86 → 31 (2.7 → 0.9 MB, −64%)**, visually identical. **What was checked and left alone:** scroll is 8.3 ms/frame median, p99 9.3 ms, **zero** frames over 33 ms even with 204 `backdrop-blur` layers on screen — so the blur is NOT a cost and the design was not touched; player-modal open measured **13–34 ms** (the release-note claim of ~200 ms is conservative); typecheck and lint clean. **Installer slimmed ~42 MB.** `Stickers` (37.5 MB), `GameShots`, `Screenshots`, `coaches_added` and `NFL` have **no reference anywhere in `src/`** (verified for both `assets/<folder>` and `cfbmedia://`) yet were copied into every build; now ignored by the CopyWebpackPlugin — build only, files stay in the repo, image pack unaffected. **Setup 2.2.0 147.2 MB → 3.0.0 109.5 MB.** **Image pack repackaged at 3.0.0** and its completeness *proved*, not assumed: the 11 folders it ships are exactly the 11 `cfbmedia://` roots the renderer can construct **and** exactly `electron-builder.js`'s `MEDIA_GLOBS` — a comment in the .nsi now records that those two lists must stay identical, and that every other folder travels inside the app. It also writes the `HKCU\Software\DynastyOS` assets pointer alongside the legacy `CFB Dynasty Hub` one (assetRoot.ts reads DynastyOS first). **Manual rewritten for 3.0** — the five-destination player profile, the card collection + card book, the Program editor, Media zoom/save-framing, pinned navigation, and three new honest-limitations entries; also fixed a **pre-existing** bug where every arrow keycap rendered as an empty box (`.kbd` had no font with arrow glyphs in its stack). Help menu's stale "Cards tab" wording updated to Showcase. **Verified end-to-end:** packaged binary boots at v3.0.0 with zero broken images across five routes, and the asar carries exactly `splash/rivalry/fonts/conf/Logo` with all media excluded. **Deferred (on the agenda board):** the 3D logo marks average ~240 KB but 28 of 33 `TeamLogo` uses render at 32px — a 64px variant would cut the visible-row cost too, but it changes the image pack so it wants its own release.
- **2026-07-27: v1.5.0 — trading cards, black theme, Media Hub, decluttered Team Hub.** A big update to 1.0 (kept COMPLETE so app updates carry the graphics; an earlier 2.0-beta build was reframed to 1.5 at the user's request). This session: the player **Trading Card** (Card tab + name-hover preview, team-correct colors via `getTeamTheme`, drop/frame your own photo or reuse a tagged media shot, pickable stats, cut-corner shape, rule-of-thirds crop, auto-fit names); an **all-black** dark theme (team color only in accents — remapped Tailwind `slate` to neutral + killed the team-tinted ambient glows); **Media Hub** promoted to its own top-level section with **batch edits** (assign-game / delete many), **drag-drop upload + progress bar**, **drag-reorder** (migration v10 `sort_order` + `media.reorder`), a `<body>`-portaled centered viewer, and verified on-disk delete cleanup (incl. fixing an orphan-folder leak on dynasty delete); **Team Hub** 11→6 tabs via nested `PairLayout` toggles; Preferences start collapsed. Manual + release notes updated; loose root docs filed into `docs/` subfolders. Detail in the phase entries at the bottom.
- **2026-07-20: Player editor — enum dropdowns + Deal Breaker / Ideal Pitch (recruiting levers).** Player editor upgrades so users don't have to type raw enum strings. **Pulled the real enum members** straight from each field's schema (`field.offset.enum.members`, sentinels like First_/Last_/Count_/Invalid dropped) into `renderer/lib/playerEditorOptions.ts`, and converted the free-text **Trait Development, Personality, Scheme, Role** inputs to **dropdowns** (Scheme grouped into Offense/Defense optgroups). **Added Deal Breaker + Ideal Pitch** as new editable Player fields (`RecruitingDealbreaker`/`IdealRecruitingPitch` added to `PlayerEditFields` read/write) with their own dropdowns — so a user who can't land a recruit because of a dealbreaker their school doesn't satisfy can change the dealbreaker (or ideal pitch) to one they do. A reusable `EnumSelect` shows any unexpected current value as its own option so opening the editor never silently changes a saved value. **Renamed the National Recruits "Edit ratings" button → "Edit recruit"** (the editor does far more than ratings). Round-trip verified the new writes on a disposable UHMASTER copy (RecruitingDealbreaker → ChampionshipContender, IdealRecruitingPitch → FootballInfluencer, TraitDevelopment → College_Elite — all persist); these are plain field edits on existing Player records (the safe category, unlike the shelved board-add record creation). Verified live: the editor Profile tab shows all six as dropdowns with humanized labels. typecheck/lint/build clean; screenshot player-editor-enum-dropdowns.
- **2026-07-20: Board add/remove DISABLED — crashes the game; root cause found.** In-game testing (user, on UHMASTER + a fresh AFMASTER) crashed CFB27 to desktop on dynasty load after adding a prospect to the board — even though the edit round-tripped cleanly in the tool (the exact residual risk flagged when it shipped). **Root cause** (probed a real board entry vs our added one): a game-created `UserRecruitTarget` carries a second reference, **`ActivePitches` → `ActiveRecruitingPitch[]`** (a nested sub-record), which our add left null — the game crashes when it reads that board entry's pitches. So a board entry isn't a single record; it's a sub-graph the game constructs, each level needing the risky empty-record allocation and only validatable by repeated in-game crash tests. **Pulled the Add/Remove button** (commit 5d37371); the read-only "On board" badge stays; backend handlers are dormant/unreachable. Remove is also risky (orphans the URT + its ActivePitches → the "unreachable records" the library warns cause crashes). **Assessment: board add/remove is likely not safely feasible via save-file editing** — recommend keeping it shelved and leaning on the recruiting writes that DO work in-game (commitment, stage, top-school swap/interest, all user-confirmed). Lesson reinforced: a clean madden-franchise round-trip is necessary but NOT sufficient — a write can re-read fine yet still crash the game if it leaves the game's own object graph incomplete; the only real proof for a structural/record-creating write is an in-game load.
- **2026-07-20: Recruiting Phase 2 Step 2a — add/remove prospects from your board.** Board management writes (round-trip verified earlier). `getNationalRecruits` now merges the user's board snapshot so each prospect carries `onUserBoard`. New write handlers in `recruitingWrite.ts` (auto-backup path): `removeRecruitFromBoard` (clears the board slot) and `addRecruitToBoard` (fills an empty slot — populates a fresh `UserRecruitTarget` at the pool's `nextRecordToUse`, allocates it out of the empty-record chain via `setNextRecordToUse`, points the board slot at it; idempotent, errors if the board is full at 35). Both go through IPC (`editor:addRecruitToBoard`/`removeRecruitFromBoard`). Recruits panel gains an "On board" badge (hero) + a full-width **Add to board / Remove from board** button (current-season only) with a busy state and a result toast. **Bug caught in testing:** the board handlers resolve through the Team table, which wasn't in the preload list — `loadBoardSlots` found no team and every op returned "not found"; fixed by adding `Team` to the board-table preloads. **Verified live end-to-end** on a disposable UHMASTER copy through the real app IPC: add → board 2→3 with the prospect's `onUserBoard` flipping true; remove → 3→2, false. **Board-ADD is the one op flagged for a one-time in-game confirm** (it round-trips at the file level but relies on the "advanced" empty-record allocation) — recommend loading a copy in CFB27 once after adding. Remaining Step 2b: on-board recruiting actions (Send The House / visits / scholarship / NIL / favorite). typecheck/lint/build clean; screenshot recruits-board-add-remove.
- **2026-07-20: Recruiting edit — top-school SWAP (force a team into a recruit's interest).** Follow-up to Step 1 after the user confirmed the write loop works in-game (they set a recruit to Signed w/ their team at 99 and CFB27 showed "SIGNED to Ohio State"). The recruiting editor's school-interest rows are now **team dropdowns**, not just influence inputs — you can swap which school is in a slot (e.g. drop a rival for your own program), then set its interest. Backend: `RecruitTopSchoolEdit` gains `originalTeamIndex` (identifies the slot by the team currently in it — order-independent, swap-safe); `saveRecruitInfluence` writes the new `ProspectTargetSchool.TeamId` + `TeamInfluence` (no extraction change; the team dropdown is fed by `getLeagueTeams`). Verified live on a disposable UHMASTER copy: swapped Makiri Gibson's Penn State slot → Hawai'i @ influence 95, reopened the save FILE and confirmed Hawai'i present at 95 / Penn State gone (and the user's own Ohio State=99/Signed edit persisting in their real save). typecheck/lint/build clean; screenshot recruiting-edit-school-swap.
- **2026-07-20: Recruiting Phase 2, Step 1 — first save-WRITE features (commitment + top schools), test-first.** The first features that write back to the save. **Test-first spike (all round-trip verified on disposable UHMASTER copies: write → save → reopen → confirm):** `Recruit.CommitScore` (640→777) ✅, `Recruit.RecruitStage` (Top10→Top5) ✅, `ProspectTargetSchool.TeamInfluence` (69→42) ✅, `ProspectTargetSchool.TeamId` (Alabama→Ohio State swap) ✅, on-board `UserRecruitTarget` toggles (SendTheHouse/ScholarshipStatus/IsFavorite/VisitRecruitsSchool) ✅, `CurrentNILOffer` (10-bit field, 0–1023 in $K) ✅, board **REMOVE** (clear slot, 2→1) ✅, and board **ADD** (2→3) ✅ — add needs the "advanced" empty-record allocation (`setNextRecordToUse` after populating `nextRecordToUse`; naive populate leaves the row flagged empty and the write is reclaimed on save). **Shipped (Step 1, the universal zero-residual-risk writes):** new `recruitingWrite.ts` `saveRecruitInfluence(dynastyId, playerId, {stage, commitScore, topSchools[]})` — writes commitment stage + commit score + each top school's interest (matched by TeamId, order-independent), mirroring the editor's proven open→mutate→`franchise.save`→re-extract path, with an **automatic save-file backup before every write** (a failed backup aborts the write; matched by teamIndex). Wired through IPC (`editor:saveRecruitInfluence`). New `RecruitInfluenceModal` on the Recruits profile panel ("Edit recruiting" button, gated to the current season): Commitment (stage dropdown + commit-score input) + School interest (each top school with logo + 0–99 input) + "backup made automatically" note + Save. **Verified live end-to-end** on a disposable UHMASTER copy (dynasty save_path = the copy, real save untouched): drove `saveRecruitInfluence` through the real app IPC → `success` → reopened the save FILE and confirmed persistence (Mike Pugh: RecruitStage=Signed, CommitScore=888, Alabama influence=33) and the timestamped auto-backup in `save-backups/`. **Deferred to Step 2 (board management):** add/remove-from-board + on-board recruiting actions (Send The House/visits/scholarship/NIL/favorite) — grouped together since they share board plumbing and board-ADD is the one op with residual risk (round-trips at file level but the empty-record surgery warrants a one-time in-game load on a copy before trusting). typecheck/lint/build clean; screenshot recruiting-edit-commitment-schools.
- **2026-07-20: Version 0.3.0 — release checkpoint before the next big wave.** Rolled the whole session's work into a new version and snapshotted the codebase before the (larger) updates ahead. **Version bump**: `package.json` 0.2.0 → 0.3.0 (drives `app.getVersion()` in the About dialog + the electron-builder exe filenames); package-lock synced. **Git tag** `v0.3.0` (annotated) at commit — the canonical, restorable marker for this state. **Local dev backup**: `.backup/v0.3.0-<timestamp>/` (src + top-level config + a BACKUP_INFO.txt noting the version/commit) — `.backup/` is gitignored (line 20), so these are intentional local-only snapshots, matching the existing convention. **Repackage**: `npm run package` cut a fresh `CFB Dynasty Hub Setup 0.3.0.exe` + portable exe (also bakes in the user's updated splash image, which only takes effect at build time). What's in 0.3.0 vs the 0.2.0 beta: team switcher across team pages, the IA reorg into four scope-based hubs (Coach/Team/NCAA/**Recruit**), Dynasty Trends + Transfer Portal, the Recruiting Pipeline geo-map, conference divisions, conference/national champion trophies (standings + Team Hub), the non-user-schedule results fix, the full **National Recruits** browser, and the OVR/athletic reveal-locks. (Testers still get the unsigned-exe SmartScreen prompt.)
- **2026-07-20: Independent OVR reveal-lock + Recruit Hub promoted to a top-level section.** Two playtest asks. **(1) OVR lock**: the overall rating now has its own reveal-lock, fully INDEPENDENT of the athletic-snapshot lock (revealing one never reveals the other). Both default locked; each has its own per-recruit/all reveal with the same app-styled warning modal (now generalized to a `StatUnlockModal` parameterized by stat label). In the panel the "Overall" row shows a lock pill until revealed; in the table the OVR column shows a per-row lock icon (click → warning → reveal this/all). `RecruitingExperienceProvider` rewritten around a reusable `useLockSet()` used twice (ovr + athletic), dropping the old single `hideUnscoutedStats` flag; the EXPERIENCE → Recruiting menu is now a master "Reveal all recruit ratings" toggle (flips both ovr+athletic unlock-all at once). Verified live that revealing OVR leaves athletic locked (eval: `ovrRevealed:true, athleticStillLocked:true`). **(2) Recruit Hub**: recruiting is now its own **4th top-level section** (Coach · Team · NCAA · **Recruit Hub**, right of NCAA Hub) — the user wanted it front-and-center since it's where players spend the most time. New `RecruitHubLayout` (pathless shell) with two sub-tabs: **My Board** (`/recruiting`, the user's own class — moved out of Team Hub) and **National Recruits** (`/recruits`, the browser — moved out of NCAA Hub). `DynastyLayout` gains a `RECRUIT_PATHS` set + the 4th nav link (lands on My Board); `recruiting`/`recruits` removed from `TEAM_PATHS`/`LEAGUE_PATHS` and their old sub-tabs. URLs stay flat (existing links unaffected — no deep links pointed at them). IA memory updated to four sections. Verified live on UHMASTER: Recruit Hub highlighted with both sub-tabs, My Board renders the board page, National Recruits OVR-locked by default. typecheck/lint/build clean.
- **2026-07-20: Recruits page refinements from playtest feedback.** (1) **Dashboard → full star distribution**: the six cards are now Recruits / 5★ / 4★ / 3★ / 2★ / 1★ (replaced Gems/States/Positions) so you see how many of each star tier exist (UHMASTER: 32 / 325 / 2,056 / 373 / 164). (2) **Filter bar de-crowded**: search moved to its own full-width row with the dropdowns beneath; the Gems filter removed. (3) **Profile actions simplified**: dropped the "Full profile" button (the name/portrait still opens the full player modal), and "Edit recruit" now spans the panel width. (4) **Athletic snapshot is now a deliberate reveal**: it starts LOCKED (padlock + "click to reveal" prompt) and unlocking pops an app-styled warning modal ("Reveal athletic ratings? The game keeps a prospect's detailed ratings hidden until you've scouted them...") offering **Reveal only this recruit** / **Reveal all recruits** / **Keep hidden** — unlock-all reveals every recruit's athletic snapshot, and locking any re-locks all back to the default. State lives in `RecruitingExperienceProvider` (in-memory, so a fresh launch always defaults to locked — immersion-safe; per-recruit unlocks + an unlock-all flag). The EXPERIENCE → Recruiting spoiler-free toggle now scopes to the OVR number only (athletic has its own lock). Verified live on UHMASTER: star cards correct, search on its own row, athletic locked by default, warning modal renders, and "Reveal only this recruit" correctly surfaces the ratings (Speed 84, Acceleration 86...) with the toggle flipping to Hide (screenshots national-recruits-star-cards-locked / -unlock-warning / -athletic-revealed). typecheck/lint/build clean.
- **2026-07-20: National Recruits browser — the full ~2,950-prospect command center (NCAA Hub → Recruits), Phase 1 read-only.** User wants to browse/filter/sort the whole national recruit pool holistically, with the same player-modal style and editable prospects; pointed at the RO27 mod (`Fangs Recruit Overhaul 27`) as the reference and their real ECMaster/UHMASTER saves. **Research (RO27 is a Rosetta Stone):** its own extracted `data/recruiting-data.csv/json` from UHMASTER confirmed 2,950 recruits with rich fields, and named the exact save tables — `Recruit` (rank/class/stage/CommitScore/TotalScholarshipOffers/QualityModifier gem-bust/TopSchoolsList), `Player`/PLAY (names/pos/ratings/portrait/HomePipeline/RecruitingDealbreaker/IdealRecruitingPitch/TraitDevelopment/BaseNILValue), `ProspectTargetSchool[]`→`ProspectTargetSchool` (10 top schools each with TeamId + 0-99 TeamInfluence). Probed UHMASTER directly for exact raw field names + verified the top-3 (Makiri Gibson/Latrell Gallenda/Demetrius Wilson) match RO27's screenshots down to NIL/height/pipeline. **IA decision (user-confirmed):** national pool → **NCAA Hub → Recruits** subpage (nation scope); the existing Team Hub → Recruiting stays as the user's own board. **Write appetite (user-confirmed):** read-only first — board add/remove, force/change commit, top-school edits deferred to Phase 2 pending verified write-path research; recruit regeneration + regional name generation (RO27's weightedNamePools.json) is Phase 3. **Built (Phase 1):** new `extract-national-recruits.ts` iterating the whole Recruit table (skips empty rows, resolves Player + TopSchoolsList→schools, humanizes enum fields, compact universal-athletic ratings) → compressed `nationalRecruits` snapshot → `getNationalRecruits` getter + IPC. New `NationalRecruits.tsx` page: dashboard cards (2,950 / 5★ 32 / 4★ 325 / Gems / 49 states / 21 positions), full filter bar (search, position, stars, state, class, stage, gems-only) with clickable column sort, a sticky-identity table (rank + portrait + name + pos + stars pinned; OVR/ranks/class/town/state/pipeline/stage/commit/NIL scroll), capped at 200 rendered rows (narrow with filters). Rich right-side **profile panel** — hero + quick summary (national/pos/state rank) + Prospect & Recruiting cards + **commit-score bar** + **school-interest bars with team logos** + **athletic snapshot** (auto strengths/weaknesses from ratings) + Full-profile (opens the shared player modal) + Edit-recruit (the existing player editor, recruits are editable Player rows). **EXPERIENCE sidebar reorg (user request):** new "Experience" group holding Recruiting (settings) + Stadium, with Help moved LAST; new `RecruitingSettingsMenu` + `RecruitingExperienceProvider` add a **spoiler-free "immersion" toggle** — hides recruit OVR/overall/athletic ratings across the browser (recruit on rank/stars/film like the game intends; no clean per-recruit "scouted" flag exists in the save, so it's an honest app-side preference), persisted in localStorage. **Extraction change — re-sync to populate the national pool.** Verified live on the real UHMASTER import (Hawai'i dynasty, 543KB compressed snapshot) in BOTH themes + immersion mode: real portraits, Mike Pugh's school interest (Alabama 69, LSU 68, USC 65...) matching the probe, immersion correctly hiding ratings and persisting across relaunch (screenshots national-recruits-browser-dark / -profile-light / -immersion-mode). typecheck/lint/build clean. **Saved the real save folder + ECMaster/UHMASTER pointers to memory.**
- **2026-07-20: Conference divisions (Sun Belt East/West, American Div 1/2) in Standings — turned out to be a PROBE bug, not missing data.** Earlier I'd deferred divisions claiming membership "wasn't resolvable" (all local test saves showed empty `Division.Teams`). The user pointed me at their real save folder (`C:\Users\matev\Documents\EA SPORTS College Football 27\Saves`, ECMaster the go-to) — and the real cause surfaced: **my probe wasn't calling `readRecords()` on the array-container table before reading its slots**, so every array-of-references (Conference.TeamSlots, Conference.Divisions, Division.Teams) silently read empty. `extract-teams`'s conference map always worked precisely because it *does* load the slots table first. Loading the container table first, division membership resolves perfectly: ECMaster's Sun Belt → East (App St., C. Carolina, Ga Southern, Georgia State, JMU, Marshall, ODU) / West (Arkansas State, Louisiana, La Tech, South Alabama, Southern Miss, Troy, UL Monroe) — matches real CFB alignment exactly; ACC + American split into Division 1/2. **Built**: `extract-teams` now resolves each team's `divisionName` (via `Conference.Divisions → Division.Teams`, loading each container table) plus `divisionStanding` (the game's own 0-based in-division rank, `CurSeasonDivStanding`) and division W-L; `getStandings` treats a conference as divided only when its members carry **2+ distinct real division names** (so undivided conferences and single-unnamed-division ones keep the flat table), and when divided it emits `divisions[]` sub-groups ordered by the game's own division standing with the leader (standing 0) flagged; `Standings.tsx` renders a titled sub-table per division with a "◆ DIV" leader badge (theme-aware, shape-language hard edges), user team still highlighted. **Extraction change — re-sync to populate.** Verified live on the real ECMaster import in both themes: American split into Division 1 (Memphis leads) / Division 2 (FLA Atlantic leads) with East Carolina (user) highlighted in Div 1 (dark); Sun Belt East (App St. leads) / West (Southern Miss leads despite a 5-3 conf record, because it won its division) (light) — screenshots standings-divisions-american-dark / standings-divisions-sunbelt-light. typecheck/lint/build clean. **Lesson (memory updated): an "empty" array-reference resolution can be a table-not-loaded bug, not true data absence — load the container table before concluding data doesn't exist.**
- **2026-07-20: Conference + national champion trophies on Team Hub (league view).** Follow-up to the schedule fix — the other half of "show the trophy near their name in standings, and also on their team hub." Standings already renders the conference-champion trophy (confirmed working on a completed-season import); this adds the same to the **Team Hub league view** for any browsed team. New `getLeagueTeamHonors(dynastyId, teamIndex, seasonId)` reads the leaguewide `yearSummary` snapshot (the same completed-year data behind the user's own trophy case) — `nationalChampion.teamName` for the national title and the `conferenceChampions[]` array (falling back to the standalone `conferenceChampionship` snapshot) for the conference title — matched by team display name. Returns all-false (no trophy) when the season isn't decided yet, so a mid-season browse never shows a wrong trophy. Team Hub's `LeagueTeamHub` builds the same `Trophy[]` shape `getTrophies` uses and renders them through the existing `TrophyBadge` — so browsed teams get the exact national-championship / conference-championship trophy assets the user's own team gets. Wired through IPC (`getLeagueTeamHonors`). Verified live on a completed-season import in both themes: Boise State (Pac-12 champ) shows the PAC-12 CHAMPIONS trophy + real 12-2 record (dark), Ohio State (national champ) shows the NATIONAL CHAMPIONS trophy + 14-2 (light) — screenshots teamhub-conference-champ-trophy-dark / teamhub-national-champ-trophy-light. **Divisions still deferred**: confirmed ALL FIVE local test saves have empty `Division.Teams` membership arrays, so team→division mapping genuinely can't be verified against any save on hand — needs a save where the in-game standings actively show populated East/West. typecheck/lint/build clean.
- **2026-07-20: Non-user team schedules now show real results + conference/bowl classification (confirmed extraction bug).** User reported every non-user team's Schedule showed all "Upcoming" / 0-0 despite standings showing real records. Probed a real save (disposable copy, madden-franchise): game results ARE present (`Oregon State 17-30 Georgia State`), but the save's `GameStatus` enum values are **`"HomeWon"`/`"AwayWon"`, never the literal `"Played"`** — and `extract-league-schedule.ts` gated scores on `=== 'Played'`, which is never true, so it nulled every non-user score. The user's OWN schedule always worked because `extract-schedule.ts` uses the correct `!== 'Unplayed'` convention. **Fix**: one line in `extract-league-schedule.ts` to match (`played = String(r.GameStatus) !== 'Unplayed'`). **Also added conference/bowl classification** the league schedule lacked: `LeagueTeamGame` gained `gameType` (`conference`|`non-conference`|`bowl`) + `conferenceName`, computed in `getLeagueTeamSchedule` from the teams snapshot's `conferenceName` (same rule `getSchedule` uses — conference only when both teams share one); the Schedule league-view Type column now renders the conference icon (`ConferenceMark`) for conference games, the bowl name for bowls, and "Non-Conf" otherwise — matching the user's own-schedule treatment. **Caveat: this is an extraction change, so existing seasons must be RE-SYNCED to pick up results** (the null scores are baked into already-saved snapshots). Verified live end-to-end on a fresh completed-season import: Southern Miss now shows real per-game results (L 16-41, W 42-14…), record 4-8 (was 0-0), the Sun Belt "SBC" icon on conference games, "Non-Conf" on non-conference — both dark and light mode (screenshots league-schedule-results-dark / -light). **Separately confirmed the conference-champion trophy in Standings already works** (Boise State, Pac-12 champ 6-1, renders a trophy on the completed-season import — the data is a leaguewide 10-conference-champions array from YearSummary, and `getStandings` already flags `isConferenceChampion` per team) — if a user isn't seeing it, they synced before the championship games were decided, not a bug (screenshot standings-conf-champ-trophy). **Divisions (Sun Belt East/West) investigated, NOT built**: the save models divisions (Sun Belt has real `East`/`West` division records, teams carry `DivisionWin/Loss` + `CurSeasonDivStanding`), but the `Division.Teams` membership arrays are empty on the test save and `DIV_SLOTNUMBER` gives a 4-vs-10 split (not a real 7/7 East/West) — so which teams belong to which division isn't reliably resolvable on the save available; deferred rather than ship a wrong split, pending a save where divisions are actively populated. typecheck/lint/build clean.
- **2026-07-20: Recruiting map — the REAL drag-freeze fix, full-width layout, frame removed.** The prior round's Pointer Events fix did not resolve the user's actual reported bug ("drag too far → whole screen goes blank, must refresh") — testing confirmed the app never threw a catchable JS exception, which pointed at a different failure class: a **rendering-thread freeze**, not a crash. Root cause: `onPointerMove` called `setView(...)` synchronously on every raw pointermove with no throttling, and each resulting re-render re-created/re-diffed all 51 state `<path>` elements (real geometry, ~2.7KB each) inline — a fast real drag firing far more events than the screen can paint could flood the renderer badly enough to read as a hung tab. Fixed with two structural changes: (1) **`requestAnimationFrame`-batched pan updates** — `onPointerMove` now stores the latest pointer position in a ref and schedules at most one `setView` per animation frame, matching the update rate to what the screen can actually show; (2) **the 51-path layer split into its own `React.memo`'d `StatePaths` component** — panning/zooming only ever changes the wrapping `<g transform>`, so React now bails out of re-rendering the paths entirely during a drag (they only re-render on a real counts/theme/hover change). Verified with a synthetic 400-step rapid-drag stress test dragging to a far corner at max zoom (`SCREENSHOT_EVAL`, not just a single dispatch batch like the prior failed verification) — page survived intact, fully interactive, all data still rendering correctly afterward. **Also per this round's feedback:** map now spans its own full-width row (`RecruitingPipeline`'s internal grid + `Recruiting.tsx`'s outer grid both restructured to stack vertically instead of splitting the map into half-width columns); removed the tinted frame background (`bg-slate-50/60`/`dark:bg-white/5`) so the map sits directly on the page surface; state outline color changed from a surface-matched near-white/near-black (which would've vanished once the frame was removed) to a genuine mid-tone slate (`#94a3b8` light / `#64748b` dark), visible against both the ramp fills and the page in either theme. **`References/mapdata.js` assessed and NOT used**: confirmed it's SimpleMaps.com's widget *configuration* (colors, zoom/label settings, per-state label x/y positions) with no `d` path geometry anywhere in it — the actual map paths live in SimpleMaps' separate commercial/licensed library file, which isn't present and shouldn't be pulled in. The already-bundled MIT-licensed `@svg-maps/usa` geometry remains correct. Verified live in both themes (screenshots recruiting-map-dark-fullwidth / -light-fullwidth / -postdrag-survives). typecheck/lint/build clean.
- **2026-07-19: Recruiting map crash fix (attempt 1, superseded above) + a full "All Recruits" filter board + Team Needs.** User feedback on the geographic map plus two new asks. **Map fixes**: zoom buttons moved out of the map box into their own row below it (were overlapping the northeastern states); the drag mechanism switched from plain mouse events to **Pointer Events + `setPointerCapture`** — the actual fix for the reported "drag to the edge → blank screen, must refresh" bug. Plain mouse events silently stop arriving the instant the cursor leaves the element, which could leave the internal drag-tracking ref in a state nothing would ever clear; pointer capture guarantees this element keeps receiving move/up events for that pointer no matter where the cursor physically goes, so the drag session is always well-formed. Also: pan clamp bounds get generous slack beyond the strict minimum (`PAN_SLACK`) so the numeric edge is never actually felt as a hard wall, masked by a genuine `overflow-hidden` on the container per the user's own suggested fix; `clampZoom` now guards non-finite input so a transform can never receive NaN; `setPointerCapture` wrapped in try/catch (found by a synthetic stress test dispatching malformed pointer sequences — confirmed the app survives an uncaught event-handler exception without crashing in this React version, but hardened it anyway). **"View ALL recruits" + filters**: the five always-open per-stage tables (Signed/Committed/Offered/Watching/Lost) replaced with **one filterable, sortable table** defaulting to showing every recruit — filters for pipeline stage, stars, position, home state, style (archetype), and class year, plus a name/hometown search; a Stage column + badge added so mixed-filter results stay legible. **Team Needs**: real save data, not computed — `Team.TEAM_RATINGQB/RB/WR/TE/OL/DL/LB/DB/ST/OFF/DEF/OVR`, the exact numbers behind the in-game Team Ratings screen (confirmed via a real-save field dump: Alabama 76-94, Akron 66-71 — sane, differentiated, not placeholders). Added to the ALREADY-leaguewide `extract-teams.ts` read (zero new extractor/snapshot/IPC — the `teams` snapshot already resolves the user's team everywhere), surfaced as a sorted-weakest-first bar panel with a "⚠ Need" badge (text+icon, never color-alone) on any group ≥5 points under the team's own overall. Verified live: filters correct against real board data (Stage=signed → 21 of 31 matching the stat tile; Position=QB → 2 of 31 matching the pipeline's own bar), Team Needs panel showing this save's real graded groups, map buttons no longer overlapping content. typecheck/lint/build clean.
- **2026-07-19: Recruiting Pipeline visualization (from the Ideas board).** A "Recruiting Pipeline" section on the Recruiting page (a Team Hub sub-tab per the IA convention — page content, no new nav level) showing where the incoming class comes from and what it's made of. **Verified first (per the prompt):** probed a real save — 31 recruits, **zero empty** hometown/state, and `homeState` is a **full state name** ("Texas", "Colorado", …), so a full-name→2-letter map drives the tiles. **Built via the dataviz skill:** a **real geographic US-state choropleth** — inline SVG with actual state outlines from `@svg-maps/usa` (MIT), **bundled locally** into `usStatesGeo.ts` (139KB) so the app stays fully offline (no map tiles, no external requests) — colored by recruit count with a **sequential single-hue blue ramp** (monotonic lightness, theme-aware: darkens with count in light mode, brightens in dark). **Zoom + pan**: +/−/reset buttons and cursor-anchored wheel zoom (non-passive listener) plus drag-to-pan on a `<g transform>`, `non-scaling-stroke` so borders stay crisp when zoomed, clamped so the map can't leave frame; hover highlights a state and shows its count. (First shipped as a stylized tile-grid; upgraded to the geographic map + zoom on user request.) Alongside it, three single-hue **ranked-bar** panels — top states, star-rating distribution (gold, to read as a separate measure; full 5→1 scale so the shape shows even when a class is all one tier), and by-position counts. Replaced the old plain "Class by Position" chips (superseded). Verified live in **both themes** on real data (Texas 17, all 2★ for this mid-major class, real position spread) — screenshots recruiting-pipeline-dark / -light. typecheck/lint/build clean.
- **2026-07-19: Information-architecture reorganization — three scope-based sections.** From the IA review (published as an artifact), collapsed the ten flat dynasty tabs — which mixed a coach, the team, and the nation — into **three top-level sections by whose story they tell**: **Coach Hub** (person, stays top-level), **Team Hub** (the selected team), **NCAA Hub** (the nation). Everything finer than a sub-tab is now a modal. **Team Hub** gained a **persistent masthead** (logo · name · record · team switcher, always above the sub-nav) and holds all team pages as sub-tabs: Overview · Roster · Schedule · Statistics · Trends · Transfers · Recruiting · Media · Awards · Weekly Honors · History. **NCAA Hub** became a section: Overview · Standings · Annual Awards · All-America. **Awards split by scope** (the biggest structural win — removed the only 3-level nest): Team Awards + Weekly Honors → Team Hub; Annual + All-America → NCAA Hub; the old AwardsLayout (Outlet-context data source) was deleted and the three consuming pages now self-fetch via a shared `useAwardsOverview` hook. **Game box score → modal** (user decision): GameDetail refactored into a props-based `GameDetailContent` rendered inside a new portaled `GameDetailModal` (GameModalProvider, `openGameModal`); Schedule rows + media game-chips open it instead of navigating. Legacy `/roster/:playerId` route retired (the player modal already covers it). **Token-efficient technique:** used **pathless React Router layout shells** so team/league pages keep their existing FLAT urls (`/roster`, `/schedule`, `/standings`…) — only the award routes and trends/transfers/history flattened — so the vast majority of internal links kept working untouched; the top-nav highlights a section by path-membership (a small Set lookup) since URLs no longer prefix-nest. Removed the now-duplicate inline `<TeamSwitcher>` from Roster/Statistics/Schedule (the masthead owns it). Verified live: Team Hub masthead persists across sub-tabs with the top "Team Hub" tab correctly lit on the flat `/roster` URL; NCAA Hub section; game box score opening as a modal over Schedule. typecheck/lint/build clean; screenshots ia-team-hub-masthead-subnav / ia-ncaa-hub-section / ia-game-box-score-modal.
- **2026-07-19: Dynasty Trends dashboard + Transfer Portal tracker — two of the archive's biggest payoffs.** Both are new sub-tabs under Team Hub (now Overview / Trends / Transfers / History). **Investigation first (per the plan):** confirmed the player `id` in every snapshot is `Number(PresentationId)` — the save's stable persistent id (same one the editor writes by), so cross-season player matching is sound; the transfer diff additionally matches on team *display name* per season (not raw index) to stay correct even if team slots ever reshuffle. **Trends** (`getDynastyTrends`): assembles per-season series from data already archived — W-L (season overview), points for/against (summed from schedule results — the save stores no season points total), recruiting-class rank (season overview), and the week-by-week poll trajectory (the `ranking_history` table, the only real weekly trend since the save keeps just current/last/start ranks). Four theme-aware **inline-SVG charts** built via the **dataviz skill**: a validated categorical palette (blue/green/magenta — run through the skill's `validate_palette.js` in BOTH light and dark against the app surfaces, all checks pass; magenta darkened to `#c94f7c` in light for contrast), one-axis only, recessive grid, 2px lines, markers, legend + direct end-labels (identity never color-alone), inverted y for ranks, and a crosshair+tooltip hover layer. The weekly-trajectory chart follows the season switcher; the rest span all seasons. **Transfers** (`getTransfers`): diffs consecutive per-season league-wide roster snapshots by PresentationId — a player present in two seasons whose team changed = a transfer; disappeared = graduated/left (not a transfer); newly appeared = recruit (whole league is tracked, no untracked origin). Team-scoped in/out lists, driven by the shared team switcher (any program, not just yours), each row linking to the player's league-resolved bio via `toTeamIndex`. **Verified with realistic multi-season data:** since a single save is one season, built a disposable scratch archive — real import (2026) + an injected synthetic 2027 (copied snapshots, 3 players moved each way between Texas State and Air Force, multi-week ranking rows). Live result: all 4 charts render correctly in dark AND light mode (screenshots dynasty-trends-dashboard, transfer-portal-tracker), and the tracker detected exactly the 6 injected moves (3 in from Air Force, 3 out to Air Force), correctly inverting when switched to Air Force's view. typecheck/lint/build clean.
- **2026-07-19, playtest batch #1: Navigation + chrome restructuring from first playtest feedback.** Six user-requested changes: **(1) History trimmed to program-only** — removed the coach-centric "Dynasty Resume" card (that lifetime record already lives on Coach Hub's Career Record panel) and the "Seasons Coached" tile; kept genuine program history by slimming the card's national-awards + coach-lineage strips into a small `ProgramHonors` card; retitled the page "The program story and record book" and renamed the dynasty W-L tile "Program Record". **(2) History is now a subpage of Team Hub** — new `TeamHubLayout` with Overview|History sub-tabs (mirrors AwardsLayout); routing nested `team-hub` → index=DynastyOverview, `team-hub/history`=History; removed the top-level History tab; banner deep-link updated to `team-hub/history`. **(3) Team switcher on Team Hub** — centralized ONE `<TeamSwitcher/>` in TeamHubLayout (governs both sub-tabs via the shared ViewedTeamProvider), removed the now-duplicate inline switchers from DynastyOverview's league branch and History. **(4) Team Hub header cleanup** — dropped the "Season X for Y Dynasty / Last synced" lines. **(5) Utility controls relocated to the sidebar bottom** — Light-mode toggle + Preferences/Help/Stadiums moved out of the top navbar (now just the HUB logo + title) into a bottom-docked (`mt-auto`) group in the left sidebar. **Real engineering for (5):** the three dropdown menus' panels used `absolute right-0 top-14` (opens down-right from a top button) which breaks from a bottom-left button, and the sidebar's `backdrop-blur` (containing block) + `overflow-y-auto` (clip) would trap any absolute/fixed child — so built a shared `AnchoredMenuPanel` that **portals the panel to `document.body`** and positions it `fixed`, opening UPWARD from the trigger's rect (recomputed on resize/scroll), owning outside-click + Escape (excluding both panel and anchor so the toggle isn't double-fired). Each menu gained a `triggerClassName` prop for full-width sidebar styling. Verified live: History subpage trimmed correctly; Team Hub shows sub-tabs + switcher, no season line; Help opens upward from the sidebar fully on-screen (not clipped), portal confirmed. typecheck/lint/build clean. **Deferred/flagged to user:** History's remaining "Schools Coached" tile is mildly coach-scoped (left in per precise-scope); offered to move it too if wanted. **Note:** the shipped 0.2.0 installer predates this batch.
- **2026-07-19 late: App icon + fresh beta package — BETA READY.** User supplied `public/Icon/ICON.png` (512px "DH" over the night-stadium art); new re-runnable `scripts/make-icon.js` builds `build/icon.ico` (256/128/64/48/32/16, PNG-compressed ICO entries via sharp — no new deps) and `electron-builder.js` now points `win.icon` at it. Fresh `npm run package` cut with EVERYTHING (media gallery + auto-surfaces + icon): the "default Electron icon" builder warning is gone, and the icon was verified by extracting it from the built exe (ExtractAssociatedIcon → real DH icon). Packaged-binary smoke test on a fresh scratch userData: import ran schema migration #6 cleanly, media add → tag → listForPlayer round-trip all working (resolved player name correct). `release/CFB Dynasty Hub Setup 0.2.0.exe` (~1.2 GB, 2026-07-19 19:42) is the artifact to distribute; portable exe alongside. Testers should expect the unsigned-exe SmartScreen prompt.
- **2026-07-19 night: Media auto-populates player bios + game pages.** Follow-up user request to the gallery: tags now do double duty. New DB queries `listMediaForPlayer` (every item a player is tagged in, ALL seasons, newest first) and `listMediaForGame`, both returning **server-resolved display metadata** (`MediaItemResolved`: game label + tagged players' names/positions/portraits) resolved against each item's OWN season's roster/schedule snapshots — that's what keeps a sophomore-year photo labeled with the sophomore-year game on a bio spanning seasons. New shared read-only `MediaGallery` component (grid + lightbox + prev/next + links; management stays on the Media page, with a pointer in the sidebar): **Media tab on player bios** (lazy-fetch, between Awards and Attributes; the player's own chip is omitted — no self-link) and **Media section on GameDetail** (renders only when the game has media; the game chip is hidden — you're already there). **Real bug found by verification:** the lightbox's `fixed inset-0` overlay was trapped inside the card at y=3540 because ancestor `backdrop-filter` (SurfaceCard/modal blur) creates a containing block for fixed descendants — fixed with `createPortal(document.body)` + z-[110] (above the player modal; player-chip clicks close the lightbox first so the modal never opens beneath it). Verified live: Chandler Alexander's bio Media tab showing both tagged items with game captions; game 63's section + portaled lightbox with description/players and no game chip. Help topic updated. typecheck/lint/build clean.
- **2026-07-19 eve: Media gallery shipped — per-season photo/video library with game + player links.** New "Media" tab (user request): upload images/videos via native multi-select dialog; files are **copied into `<userData>/media/<dynastyId>/`** (collision-proof timestamped names, originals never touched) with metadata in a new `media_items` table (**schema migration #6** — user-entered data like team_award_results, structurally untouchable by re-sync). Per item: linked game (season schedule dropdown, stored as the save-native gameId the /schedule/:gameId route already uses), tagged players (searchable roster picker, stored as the app's opaque player ids so names resolve from that season's roster snapshot), free-text description. **Gallery**: aspect-video thumbnail grid, caption strip (game label > description > "Add details") + tagged count; click → **lightbox** with prev/next buttons + arrow keys + Escape, video plays with native controls, sidebar shows description / clickable game chip (→ Game page) / player chips with portraits (→ player bio modal) / Edit + Delete. Uploads land in the currently-selected season (Help topic added — the established convention). **Architecture notes**: `media:pickFiles` (dialog) deliberately split from `media:addFiles(paths)` so the SCREENSHOT_EVAL harness can seed media without a native dialog — which is exactly how it was verified live (import → addFiles → tag to the Wk 1 Washington St. win with 2 players → grid + lightbox screenshots → delete round-trip confirmed row+file both removed). File-serving is just `file://` URLs (renderer is file://-origin, same-origin loads fine, no custom protocol needed). Deleting a dynasty leaves orphan media files on disk (DB rows cascade) — acceptable, noted for a future cleanup pass. typecheck/lint/build clean; screenshots in Productivity/screenshots (media-gallery-grid, media-lightbox-tagged).
- **2026-07-19 pm: Seven-item UX polish batch + full profiles for league players.** User's screenshot-driven punch list, all shipped: **(1) Statistics header decluttered** — controls (switcher / Compare Players / game & opponent filters / Season-Per Game toggle) moved to their own bordered row under the title. **(2) "My Team" label retired** — `ViewedTeamProvider` now also resolves `userTeamName` (season overview) and `TeamSwitcher` reads it from context, so every page's dropdown says e.g. "Texas State"; the user's team is also deduped out of the league list (139 options, no twin). **(3) Dashboard delete button** — the real bug was NOT styling: `SCREENSHOT_EVAL` DOM measurement proved the button was being **flex-shrunk to 18×36** (min-content) in the tight card column while its siblings held 36×36; fixed with `shrink-0` (+ on the divider and CARD_ICON_BUTTON_CLASS), and its border/shadow unified to the neutral style so only the icon is red. **(4) Coach Hub hero tightened** — xl portrait 450px→336px wide and 280px tall with `object-cover object-bottom`, which crops the transparent headroom baked into the game's coach PNGs (that headroom was the "negative space above the image"; shoulders sit at the bottom edge so nothing real is cropped); also removed two stray `rounded-xl`s (shape language). **(5) Awards tab in player bios** — Team Awards + Honors sections moved out of Career into their own tab (tab order: Overview/Stats/Career/Awards/Attributes/Game Log/History); the Overview honors card now jumps there. **(6+7) League players get the REAL full profile** — new `leagueTeamIndex` threaded through PlayerModalProvider → modal → `PlayerProfileContent`, which resolves the player from that team's league snapshot (LeagueRosterPlayer extends RosterPlayer) and renders the SAME full layout: hero with portrait/jersey/OVR/team logo, all bio tiles, season stats, leaguewide honors (playerId matching works — verified: Keelon Russell's Shaun Alexander Award shows), **live Attributes** (editor.getPlayer was always PresentationId-based), honest empties only where data truly isn't tracked (game log). The TeammateRail also switches to the viewed team's league roster (`useViewedTeamOptional` — null-safe because StatisticsTable/StatisticsCategorySection also render inside the app-root modal outside DynastyLayout). Callers wired: Roster, NCAA Hub, LeagueTeamHub, both statistics table/leader-card components. **Harness upgrades (permanent):** `SCREENSHOT_IMPORT_SAVE` (self-provision a disposable dynasty via the real preload import API — no pre-seeded test DB needed) and `SCREENSHOT_EVAL` (arbitrary page JS → stdout, for DOM measurement instead of pixel-eyeballing). **Gotcha burned twice:** Git Bash MSYS path-conversion silently mangles `SCREENSHOT_ROUTE` into `#C:/Program Files/Git/...` → blank content that looks like a rendering bug; fix is `MSYS2_ENV_CONV_EXCL="SCREENSHOT_ROUTE;SCREENSHOT_EVAL"` — separator is `;`, NOT `::` (`::` excludes nothing, silently). Verified live end-to-end on a fresh scratch import (screenshots in Productivity/screenshots/, 2026-07-19 set). typecheck/lint/build clean.
- **2026-07-19: Team switcher shipped across the five team-scoped pages + team logos in headers and the player-bio hero.** Direct follow-up to the league browse: new `ViewedTeamProvider` (dynasty-level context; `null` = user's team, resets on dynasty/season change) + shared `TeamSwitcher` dropdown (active team's logo beside it; hides itself entirely on seasons without league snapshots so old seasons behave exactly as before). **Per-page support, honest about data**: *Roster* — full league roster (LeagueRosterPlayer extends RosterPlayer, so every existing filter/sort/gallery works unchanged; player clicks pass a leaguewide fallback; edit pencils work — the editor was always PresentationId-based); *Statistics* — the four player categories from league stat lines mapped into the page's own PlayerStats shape (team tiles/kicking/splits/Hot Players show their existing honest empty states for non-user teams); *Schedule* — new `extract-league-schedule.ts` captures EVERY game in the league per season (rides the same SeasonGame read, **19 KB compressed**), new `getLeagueTeamSchedule` maps any team's games to their perspective (their opponent, their W/L), compact league table with record tiles; *Team Hub* — league-mode summary (logo, record from league games, roster size, average OVR, top-10 players with modal links); *History* — league-mode shows that program's national/conference titles filtered from the already-tracked league history, with the record book/resume honestly marked user-only. **Player bio hero** now shows the season's actual team logo + name — a transferred player's profile shows the school they were on *that year* (heroTeamName resolves from the season being viewed, not the dynasty's current team). Verified live: Roster switched to Alabama — their logo, 85 real players, avg OVR 78.5, full filter machinery intact (`team-switcher-alabama-roster-2026-07-19.png`). typecheck/lint/build clean.
- **2026-07-20: League-wide roster browse shipped — every team in the country, browsable and editable, preserved per season.** User direction (with CFB Offline as a fast-reference example — inspected its runtime: it does focused single-table reads from the save with JSON-per-concern and has NO multi-season history, so our per-season snapshots are a real differentiator, especially for the user's stated transfer case). **Measured before building** (house rule): full 16,255-player bio read = 65ms, all stat-table preloads = 287ms — the "league data is too slow" fear was false. **Architecture:** new `extract-league-roster.ts` (bios for every player + season stat lines for stat-holders only, reusing the exported `mapPlayer`/`categoryFromTableName`/`mapLineForCategory` from the existing extractors and the same exact-SEAS_YEAR season matching), stored via new `saveSnapshotCompressed()` — gzip+base64 with a `gz:` marker that `getSnapshot()` transparently decompresses, no schema change — because sql.js holds the whole DB in memory and rewrites the full file on persist; raw JSON at league scale would compound badly. **Real numbers:** full import including league extraction = 5.05s total; one season's entire league (16,255 players + 6,184 stat lines) = **1.18 MB compressed**. New `getLeagueTeams`/`getLeagueTeamRoster` queries + IPC round-trip. **UI:** "League Rosters — browse any team in the country" section on NCAA Hub: team selector (all ~134 teams with player counts), per-roster search (name/#/position), OVR-sorted table (top 120 + narrow-by-search note), compact season stat summaries, click → the shared player modal (leaguewide portrait fallback), and **edit pencils on the current season** — the editor's PresentationId lookup was always leaguewide; this is its first non-user-team entry point. Honest empty state for seasons synced before this feature (no back-fill possible). Harness: new permanent `SCREENSHOT_SCROLL_SELECTOR` hook (scrollIntoView pre-capture, for below-the-fold sections). Verified live: Alabama's real 85-man roster with real stats (QB 3,758 yds/26 TD) on a team the user doesn't control. Follow-ups: player-profile season resolution could search league snapshots (full profiles for non-user players + transfer timelines), league-wide player search across all teams at once.
- **2026-07-20: Player Profile redesigned — hero + six subpages + full navigation; the flagship profile experience.** User direction with ESPN reference material (`References/ESPN`, design inspiration only): the profile felt like "scrolling through a database" — one flat ~10-section scroll with stats three screens down, honors at the bottom, three stacked stat presentations, and a portrait boxed in a rectangle. **Audit-first, data layer untouched**: the battle-tested season-resolution/historical-fallback/leaguewide-fallback logic (and every fetch) is exactly as before; this was a presentation restructure. **New structure**: a persistent **hero** — unboxed portrait over a subtle team-color gradient (`color-mix` on `--team-primary`), jersey chip, DIN name at page-title scale, archetype/development/measurables meta line, OVR as the focal `stat-xl`, and the past-season warning converted from a banner to a compact amber badge in the hero — above **six tabs** in the app's established DIN cut-corner tab language: *Overview* (bio grid + three editorial cards — Season Snapshot with top-4 nonzero stats, Latest Game with result-colored score + statline, Honors & Awards count with latest honor — each with a jump-link into its full tab), *Stats* (season line + game log), *Career* (career totals + "Season by season" table — the "Imported career totals"/"Imported season history" labels removed per spec, one redundant rollup section deleted outright — + Team Awards + Honors: the résumé), *Attributes* (**new capability**: read-only ratings grouped by the editor's own RATING_SECTIONS, fetched through the existing `editor.getPlayer` IPC — current-season only, honest note for historical players since the save's past state no longer exists), *Game Log* (best game + full log), *History* (**new**: a per-year timeline derived strictly from held data — first tracked season, per-season class/OVR delta/position/jersey changes, national awards, honor tiers, weekly honors, team awards — no fabricated events). **Navigation**: modal widened to `max-w-6xl` with a collapsible **teammate rail** (own small roster fetch per the per-page convention; instant search by name/number/position; grouped Offense/Defense/Special Teams sorted by position then OVR; portraits; active player highlighted in the team-colored cut corner; **Recent players** section — session-scoped module state, capped at 8), plus **ArrowLeft/ArrowRight keyboard navigation** through the opening context's player order (suppressed while typing in inputs), and Prev/Next buttons with keyboard hints. **Motion**: player swaps animate via a new `content-enter` utility (fade+4px rise on the shell's keyed remount, zeroed automatically by the global reduced-motion clamp); a nested per-tab-remount animation was tried, produced a stuck-invisible tab panel in verification, and was deliberately dropped — tab switches are instant, which reads snappier anyway. Orphaned helpers from the removed rollup section deleted (`buildImportedCareerTotals`, empty/add line builders). Verified live on real data (Texas State 2026, Brad Jackson): Overview shows real snapshot (14 games/3,991 yds/23 TD), real latest game (vs Florida State L 16-21 with statline), real honors count; Career shows totals, the season table, and honors grouped 2026/2027 (cross-season résumé working); rail renders the full grouped roster with portraits and search. `npm run typecheck`/`lint`/`build` clean. Follow-ups deliberately deferred: related-players/award-competitor suggestions, position-cycle quick buttons, Coach/Recruit profile alignment to this pattern.
- **2026-07-20, overnight: Release path — WebP portrait conversion shipped, and the packaging test caught a real release-blocking asset bug.** **WebP conversion** (the approved lossy-q90 plan): PNG masters first moved OUT of the project to `D:/PROJECT/portrait-master-png/` (they're the only masters — the DDS exports no longer exist; this archive step is the rollback path). New re-runnable `scripts/convert-portraits.js` (sharp, dev-only dep) converted all 25,527 player + 695 coach portraits to q90 WebP with **fully normalized names** (`nilpp_<asset>.webp`, legacy `_result` suffix variants gone), self-verifying count + sampled dimensions. **Portraits: 4.70 GB → 846 MB; coaches: 698 MB → 18 MB** (matches the assessment's estimate). Code updates were as small as planned: `playerAssetMapping` (single candidate, 3-candidate onError chain deleted), `coachAssetMapping`, `searchPortraits` suffix regex, `PortraitPicker` (the doubled-suffix fallback machinery deleted). Verified live: real portrait renders in the profile modal at full quality (mean pixel error 1.45/255 vs master on the reference asset). **Packaging test found a real ship-blocker:** the first-ever `npm run package` run of this app produced a working installer (1.1 GB, down from a projected ~5+ GB) — but the packaged app's team logos were broken while dev looked fine. Root cause: the user's earlier PNG-compression pass appended `_result` to **705 files across six asset folders** (3d_logos OD/OL/gold, awards, bowlgames, confchamp, playoffs, rivalry) — the old `dist/` still carried pre-compression copies, masking it in dev until tonight's clean rebuild; assetMapping/trophyAssetMapping constants all expect unsuffixed names. Fixed by normalizing all 705 filenames at the source and **auditing every constructed path exact-case against disk: 684 logo paths + 39 trophy refs, zero misses** (exact-case matters — asar archives are case-sensitive even on Windows, unlike the dev filesystem). Two packaging-test infrastructure findings, both permanent: the packaged binary rejects `--user-data-dir` and ignores `%APPDATA%` overrides (Electron resolves appData via the OS API), so main.ts gained a `CFB_USER_DATA_DIR` env hook (set before the single-instance lock) for isolated packaged-build testing — during discovery one packaged run landed on the real user DB (side effect: one extra rolling backup, harmless by design); and a stale `ELECTRON_RUN_AS_NODE` in the shell makes the packaged exe boot as bare Node and exit silently (the known dev-launch gotcha, now confirmed for packaged too). Also: **git initialized** — `.gitignore` extended (public/assets, .backup, References, Dynasty Save Test, local Claude settings), initial commit `e1fcb2f` with 491 files / 43,917 lines, working tree clean, no large/sensitive files staged (verified before commit).
- **2026-07-20, overnight: Both known data bugs fixed and verified.** (1) **Stale-slot heuristic** (`extract-stats.ts` + the same pattern in `extract-kicking.ts`): "highest populated SEAS_YEAR slot = current season" silently showed a player's *previous* season as current until they recorded a new-season stat line — the exact case confirmed live earlier on the Tulane fresh-preseason save, whose Statistics page showed full player stat lines against a 0-0 team. Fixed by matching the slot whose `SEAS_YEAR` **equals** the season being synced (`league.seasonYear - league.baseCalendarYear`, the identical 0-based relative-year convention `extract-schedule.ts`'s own fix already uses); no matching slot now honestly means `season: null`. Verified both directions on disposable imports: Tulane fresh preseason → 0 of 34 players with season lines (was: all stale), careers intact; DYNASTYBOWL completed season → all 44 players with real lines (sample QB 3,165 pass yds) — no regression. (2) **Coach portrait write field** (`Coach.Portrait`) — the long-blocked "+10/+0 offset pattern" finally decoded by dumping all 493 coaches on a real save: the offset between the asset-name number and `Portrait` is *scattered across ~250 distinct values* — the "+10 for 121 coaches" was coincidental clustering, and Portrait is an **arbitrary baked-in index with no derivable relationship to the asset name**. What IS provable: within a save, every asset name maps to exactly ONE Portrait value (zero conflicts across 448 and 408 distinct assets on two real saves) — so `writeCoachFields` now copies the Portrait index from whichever coach already wears the chosen asset (empirical lookup against the already-loaded Coach table), and also writes `AssetName` (not just `GenericHeadAssetName` — reads prefer AssetName, so unique coaches previously kept their old face even in-app). Unmapped assets (no current wearer) leave Portrait untouched — the same honest limitation as before, now narrowed to genuinely unknowable cases. Verified with a real write→save→reopen round trip on a disposable copy: both AssetName and Portrait persisted exactly.
- **2026-07-19: Feature work completed — Team Awards Phase 5 + Statistics Phases 3-4, closing out both feature tracks.** **Team Awards Phase 5 (Single-Game Performance of the Year)**: the 11th and final in-scope award, unblocked by the same-day GameDetail gamelog-to-schedule join. Structurally different from every other automatic award — candidates are (player, game) pairs, not season lines — so it runs through a dedicated pure calculation (`teamAwards/singleGame.ts`) rather than the generic component engine: each player is represented by their single best played game scored with the shared `gameImpactScore` (moved from `renderer/lib` to `shared/` since the main process now consumes it), keeping winner/finalists distinct players as the existing result model/UI expects. Explanation carries real game context ("Week 5 vs Boise State (W 37-34): 28/41 for 374 yds, 3 TD passing..."). Ranked-opponent bonus stays permanently dropped (no historical rank data — Phase 1 research); opponent context is descriptive only. `runTeamAwardCalculation` branches on the award id; definition enabled (the "More Awards Coming" section is now empty — all 11 in-scope awards live). Verified via temporary diagnostic (removed) on a real completed season: a 40.5-impact QB game won over 24.8/23.0 finalists — a defensible pick — then verified rendering live in the Team Awards UI with portraits, finalists, and the confirm/override workflow intact. **Statistics Phase 3**: `LeaderMetric` gained `qualifies`/`qualifierLabel` — qualification minimums for rate stats (excluded rows are excluded from that card only, never the table; nobody-qualifies hides the card) — applied as three new leader cards: Completion % (min 100 att), Yards per Carry (min 40 att), Yards per Catch (min 20 rec). Plus a full side-by-side player comparison (`PlayerComparison.tsx`, portal-mounted to body because the page sits inside clip-path ancestors — same containing-block gotcha as the editor modals): pick any two players with recorded stats, grouped Passing/Rushing/Receiving/Defense/Kicking rows, better value highlighted in team color (lower-is-better handled for INTs), category rows shown only where either player has data. **Statistics Phase 4**: Regular Season/Postseason/Home/Away + per-opponent **splits** — when active, the four gamelog-backed categories are re-aggregated from per-game lines over matching played games (per-game lines carry longs and INT TDs, so the *same* season column sets render unchanged; GP becomes games-in-split; longs are maxes). Kicking/Punting/Returns show an honest note under splits (no per-game kicking data exists in the save — confirmed limitation). "Postseason" = the save's own bowl gameType (includes CFP + NC). **Hot Players** — top 5 by combined game impact over the last 3 played games with per-game trend, hidden until 2+ games. **Milestones** — classic season benchmarks (3,000 pass yds, 1,000 rush/rec yds, 60 rec, 100 tkl, 10 sacks, 5 INTs...) shown from 75% progress with team-colored progress bars, REACHED badges, achieved-first sort, capped at 8. Verified live on a real 14-game season (Texas State 2026): Hot Players trends real (69.2 QB), 7 real REACHED milestones + one 80-to-go, all three qualified rate cards correct, and the Home split correctly re-aggregated (QB 8 GP/2,291 yds at home vs 14/3,991 season — and the Y/C leader honestly *changed* under the split because the season leader's home-only carries fell below the 40-att minimum, proving qualification applies to filtered lines). Screenshot-harness upgrade while verifying (permanent, memory updated): `SCREENSHOT_SELECT_VALUE` now takes multiple `;;`-separated selector::value pairs and runs BEFORE the click hooks. `npm run typecheck`/`lint`/`build` clean.
- **2026-07-19: GameDetail box score restructured to Passing/Rushing/Receiving/Defense — matches the Statistics page.** User direction: the per-game box score was split Offense/Defense with one wide combined offense table (players showing "-" across whole column groups); they want the same category structure as the season Statistics page for app-wide uniformity. Replaced `OFFENSE_GAME_COLUMNS`/`OFFENSE_GAME_LEADERS` with three per-category sets mirroring the Statistics page's columns (Passing: Cmp/Att/Cmp%/Yds/Y-per-A/TD; Rushing: Att/Yds/Y-per-C/TD; Receiving: Rec/Yds/Y-per-R/TD — GP/Int/Lng omitted honestly: they don't exist on per-game lines) and per-section leader cards (Passing Yds/TDs; Rushing Yds/TDs; Receptions/Rec Yds/Rec TDs). Rows are category-scoped (a player appears in a section only if they attempted/carried/caught in that game — same no-false-zero-rows principle as `hasMeaningfulStats`). Defense unchanged. **New permanent screenshot-tooling hook while verifying:** `SCREENSHOT_SELECT_VALUE="selector::value"` in main.ts sets a `<select>` the React-visible way (native prototype setter + bubbled change event) — needed because every dynasty's *current* season is a fresh preseason, so a populated GameDetail is only reachable through the season switcher, which clicks can't operate; memory updated. Verified live on a real game (Texas State @ Louisiana, L 26-34, season 2026 via the new hook): three clean category sections with leaders and only-relevant players, Team Mode maroon headers (`gamedetail-category-split-2026-07-18.png`). typecheck/lint/build clean.
- **2026-07-19: Overhaul follow-ups closed — every heading in DIN, real readme.** The two optional items from the completion entry (below), done: (1) **All remaining `<h2>`/`<h3>` headings converted to the DIN roles** via tag-scoped sed (`text-3xl` titles → `font-display text-page-title font-bold`, `text-2xl` → `text-section-title`; zero generic headings remain) plus the Heisman winner-name button — numeric stat displays sharing those size classes were deliberately left alone (they're values, not titles; tag-scoping the sed kept them safe by construction). This delivers the visible half of the "structural PageHeader adoption" follow-up — every page title now carries identical DIN identity; the structural component swap remains purely a code-dedup nicety. (2) **`readme.md` written** (was 0 bytes): what the app is, quick start, how import/sync/browse works, repo layout table, user-data location, design-system summary. Verified live: Team Hub dark mode (`visual-overhaul-final-teamhub-dark-2026-07-18.png`) — DIN title, DIN-eyebrow tiles with cut corners, hard tabs. typecheck/lint/build clean.
- **2026-07-19: Visual Overhaul — Phases 3-5 completed; the overhaul is done.** Closing pass on the remaining spec items. **Eyebrow migration (the last big consistency win):** all ~115 longhand eyebrow labels (`text-[10/11px] font-semibold uppercase tracking-[0.14–0.28em]`, 9 distinct orderings) migrated to the single `.type-eyebrow` class via exact-pattern sed — every eyebrow in the app now renders identically in the DIN face; only 2 intentionally-different compact trophy labels remain longhand. **Leader cards (P3):** `LeaderCard` gained the signature cut corner and its value now renders `.type-stat-md` (DIN + tabular numerals) — this styles every leader card on Statistics *and* GameDetail (shared component). **Awards (P3):** verified the ceremonial-but-restrained result live — DIN sub-tabs with the active tab as a hard team-colored cut-corner rectangle, DIN eyebrows on trophy/finalist sections, editorial Heisman hero with real portraits (`visual-overhaul-p3-awards-2026-07-18.png`). **Data pages (P4):** Schedule verified in dark mode end-to-end (PageHeader + DIN stat tiles with cut corners + DIN table headers, `visual-overhaul-p4-schedule-dark-2026-07-18.png`); Standings/NcaaHub/Recruiting/GameDetail inherit the full system through the shared components and the app-wide sweeps (eyebrows, de-pill, radius tokens, table treatment). **Theme/motion/perf audit (P5):** dark + light + Team Mode verified across Dashboard/Statistics/Coach Hub/Roster/Awards/Schedule this session; reduced-motion remains covered by the existing global clamp (the overhaul added zero new animations — all transitions are still Tailwind transform/opacity utilities); performance unaffected (typography/shape/color changes only — no layout-property animation, no new runtime work). Responsive behavior is unchanged by construction: the overhaul deliberately touched no grid/flex/breakpoint classes, and the window's 1024px minimum is enforced in main.ts. **Known optional follow-ups, deliberately not blocking:** structural `PageHeader` adoption on the ~7 pages still using the (now visually-identical via `.type-eyebrow`) hand-rolled header; the modal-shell focus-trap refactor; licensed DIN Pro files if ever purchased (drop into the font stack's first slot with zero code change). `npm run typecheck`/`lint`/`build` clean throughout.
- **2026-07-19: Phase 3 heroes — DIN treatment on the three profile surfaces.** Player profile modal, recruit profile modal, and Coach Hub heroes: names now render `font-display text-page-title font-bold` (DIN at page-title scale) and the headline stat values (player/recruit Overall box, Coach Hub overall record) use `.type-stat-lg` (DIN + tabular numerals), replacing the generic `text-3xl/4xl font-semibold` treatment. Verified live on Coach Hub (`visual-overhaul-p3-coachhub-hero-2026-07-18.png`); typecheck/lint/build clean. Remaining P3: leader-card pass, Awards ceremonial pass, PageHeader adoption on remaining pages.
- **2026-07-19: De-pill completed to 100% — zero `rounded-full` anywhere.** User caught the stragglers my conditional sweep deliberately spared as "genuine circles" (Dashboard card Sync/Export/Backup/Delete icon buttons, the pencil EditButton, PortraitPicker pagination, PreferencesMenu toggle containers, NcaaHub rank badges) and asked for those too — with portraits already square via the radius tokens, full consistency means no circular controls at all. Removed every remaining instance (10 → 0). Verified live: Dashboard card action buttons render as hard squares (force-hover capture, `visual-overhaul-p3-depill2-dashboard-2026-07-18.png`); typecheck/lint/build clean.
- **2026-07-19: Visual Overhaul — Phase 3 opened with the full de-pill sweep.** The flagged follow-up from the shape pivot (below), done app-wide in one pass: stripped `rounded-full` from every padded *control* across the renderer (100 instances → 10, the survivors all genuine circles — avatars, dots, the shared pencil button) via a conditional sed (only lines carrying control padding `px-`/`p-1*`, so true circles were untouchable by construction). Nav tabs (`DynastyLayout.tsx`) are now hard-edged DIN-face rectangles with the active tab carrying the team-colored `.corner-cut-sm`; the tab-row container swapped its pill shape for `.corner-cut`; the season switcher, navbar buttons, Preferences/Help/Stadiums triggers and their internal toggles, Statistics' Season Total/Per Game toggle, filter chips, class-count chips, and badge tags all render as hard rectangles now. Verified live (Statistics page, light mode, Tulane Team Mode): the app now genuinely reads as the same universe as the game's own UI — hard panels, one cut corner on emphasis elements, DIN identity, flat surfaces (`visual-overhaul-p3-depill-statistics-2026-07-18.png`). `npm run typecheck`/`lint`/`build` all clean. Remaining Phase 3 work: editorial hero treatments (Coach Hub, player/recruit profile modals), leader-card premium pass, Awards ceremonial pass, PageHeader adoption on the remaining pages.
- **2026-07-19: Visual Overhaul — shape language pivoted to hard edges + single cut corner, per explicit user direction.** After seeing Phases 1-2, the user set a firm design constraint with reference screenshots of the actual EA game UI: **no rounded corners** — hard rectangular edges with one angled corner ("futuristic Minority Report feel"), so the app and game "feel like they could live in the same universe" without copying outright. This retroactively explains the old "angular global pass" (`border-radius:0 !important`, removed in Phase 1 — that override was the same taste expressed as a blunt hack). Implemented properly through the token system this time: all four radius tokens set to `0px` in `defaultTokens.ts` (one reversible switch — every `rounded-*` utility app-wide instantly renders square; `rounded-full` kept strictly for circular elements), plus new `.corner-cut` (1rem) / `.corner-cut-sm` (0.5rem) classes in globals.css — a top-right 45° clip-path applied with restraint: `SurfaceCard` (now flat and border-defined; clip-path clips box-shadow anyway, and flat matches the reference aesthetic), `StatTile`, and the high-emphasis `Button` variants (primary/destructive) only — cutting every control would cheapen it. The app shell keeps its established two-corner `angledClip()` frame. Known follow-up for Phases 3-4 page sweeps: the remaining `rounded-full` *pill* controls (navbar buttons, nav tabs, filter chips, class-count chips) predate the Button primitive and still read as pills — they migrate to hard rectangles/cuts as each page gets its pass. Saved as a durable memory (`feedback_shape_language.md`) so future sessions never reintroduce rounded corners. Verified live: Roster screenshot (`visual-overhaul-shape-pivot-roster-2026-07-18.png`) shows cards/tiles/table with hard edges + cut corners over the Phase 1-2 DIN/tnum system; typecheck/lint/build clean.
- **2026-07-19: Premium Visual Overhaul — Phase 2 (Core components) shipped.** Direct continuation of Phase 1 (below). **New shared primitives:** `PageHeader` (`components/ui/PageHeader.tsx`) — the standard eyebrow → DIN page-title → description → optional actions/children structure, replacing the header block previously hand-assembled on 13 pages with drifting spacing; adopted on Roster, Schedule, and History this phase (the API is proven; remaining pages migrate during their Phase 3/4 passes). `Button` (`components/ui/Button.tsx`) — primary (team-colored)/secondary/tertiary/destructive variants, `rounded-sm` per the §8 shape language (pills reserved for genuinely circular controls), DIN labels, `compact` size; adopted on both editor modals' Save buttons — which also fixed a real spec violation: Save was previously a hardcoded **red** pill, and §6 reserves red for destructive actions only (it's now the accent/team primary). **Upgrades to existing shared components:** `StatTile` now renders its label as `.type-eyebrow` and value as `.type-stat-md` (DIN + tabular numerals) — instant DIN identity on every metric tile app-wide from one file; `SurfaceCard` gained a `surface` prop (`primary`/`raised`/`overlay`) resolving through the theme-aware `--surface-*` variables (default `primary` preserves the existing look); `StatisticsTable` numeric cells switched from `proportional-nums` to the new `.tnum` class (columns now align vertically) and its team-colored header row renders in the display face. **Dedupe (audit follow-up):** `EditButton`/`EditIcon` were defined identically in 3 files — `Roster.tsx` and `Recruiting.tsx` now import the one `CoachCard.tsx` exports, whose `onClick` signature was widened to pass the mouse event (needed by row-embedded call sites for stopPropagation; zero-arg handlers remain assignable). Verified: typecheck/lint/build clean; live screenshots — Roster (DIN page title, DIN stat tiles, DIN table headers on the Tulane-green header row, shared pencils intact) and the player editor modal (new Button primitive, correct fallback accent when opened outside a Team-Mode context) — saved as `visual-overhaul-p2-*`. Deliberately deferred from this phase: the structural modal-shell refactor (all four modals already share identical shell classes — visual consistency holds; a focus-trap refactor is high-risk/low-visual-gain and can ride a later phase), portrait size-token unification, and the full 13-page PageHeader sweep (Phases 3-4 do it page-by-page as each page gets its pass).
- **2026-07-19: Premium Visual Overhaul — Phase 1 (Foundation) shipped.** User provided a 34-section "Premium Visual System and Motion Design Overhaul" spec (DIN typography, tokens, surfaces, shape language, motion, phased implementation). Full audit + plan in `docs/VISUAL_OVERHAUL_PLAN.md`; timestamped backup taken first (`CFB27-Hub-Backups/2026-07-18_203800`, DB byte-verified). Key audit findings: the Phase-A token plumbing already existed with Tailwind-default values (so this is a values-and-vocabulary upgrade on working infrastructure); the app was rendering **fully square** via a `border-radius: 0 !important` global override with 107 arbitrary `rounded-[10–28px]` classes sitting dead beneath it; no fonts were bundled (CSP is `default-src 'self'` — network fonts impossible); the signature eyebrow style existed as ~130 hand-written `text-[11px]`+`tracking-[0.2em]`-style repetitions. **Phase 1 shipped:** (1) Typography — display stack `"DIN Pro", Bahnschrift, "Roboto Condensed", …` (Bahnschrift is Microsoft's licensed DIN 1451, present on every Win10/11 machine — real DIN identity with zero licensing risk on this Windows-only app; DIN Pro slot ready for licensed files, nothing unlicensed bundled per spec) + Inter body (SIL OFL, bundled via @fontsource → `public/assets/fonts`, 97KB total, license file alongside, `@font-face` in globals.css with css-loader `url:false` so runtime-relative paths pass through). (2) Extended `DesignTokens`: role-based type scale (display-xl/page-title/section-title/card-title/eyebrow/meta/stat-xl→sm), retuned radius (6/10/12/14px — spec §8 "strong and athletic"), controlled shadows, motion retuned to 120/180/260/320ms with `cubic-bezier(0.2,0,0,1)` standard easing. (3) Removed the global radius-0 override and migrated **all 107** arbitrary radii to the token scale (20–28→xl, 14–18→lg, 10–12→md) via mechanical sed; zero remain. (4) Theme-dependent surface tokens (`--surface-primary/raised/interactive/overlay` + border pairs, light+dark) in globals.css. (5) `.type-eyebrow/meta/page-title/section-title/card-title/stat-*` component classes with `tabular-nums` on all stat styles (numbers-dense app — `tnum` prevents column jitter). Tailwind wired for `font-display`/`font-body` + the role sizes. Verified: typecheck/lint/build clean; live screenshots against a copy of the real 3-dynasty DB — Dashboard dark, Statistics dark (Team-Mode green tables/leader cards intact), Coach Hub light (Tulane Team Mode) — all in `Productivity/screenshots/visual-overhaul-p1-*`. Phases 2–5 (core components incl. PageHeader/Button primitives, signature pages, data pages, theme/motion/perf audit) are planned in the doc and tracked on the agenda board.
- **2026-07-19: Startup slowness root-caused and fixed + full codebase audit.** User reported the app taking "over 10 seconds" to open with a "splash goes away, then nothing, then app" gap, worried users would double-launch. Profiled the real boot timeline (temporary instrumentation, since removed): **the Electron app itself is fast** — whenReady→DB-loaded 60ms, →window-content-painted ~620ms. The slowness was entirely in the dev `.bat` launcher, and one bug dominated: **the rebuild-check `powershell` call took ~15s on every launch** because it passed individual config-file paths (`webpack.config.js`, `package.json`, `tsconfig.json`) *into* the same `Get-ChildItem -Recurse` call as `src` — that mixed-path + `-Recurse` form triggers a PowerShell path-resolution pathology (measured 15,066ms vs 404ms for the split form: scan `src` recursively, `Get-Item` the config files separately). Fixed → ~14.6s saved on every dev launch. The "splash vanishes mid-gap" symptom was the pre-splash HTA's 30s safety timeout expiring *during* a legitimate long startup (15s check + up-to-34s webpack rebuild > 30s), so the splash closed itself while work was still happening; raised the HTA cap to 120s (safe — the normal close is the ready-flag, and the launcher's `:failed` path already closes it on real failure). Also added webpack persistent filesystem cache (unchanged-source rebuild ~50s → ~16s; residual is `CopyWebpackPlugin` statting 26k asset files). **Key clarification for release: none of this affects end users** — the packaged `.exe` has no `.bat`, no PowerShell check, no rebuild, and no pre-splash HTA; it uses the Electron splash tied to window-ready, with a measured ~2-4s cold start. The 10s gap was a dev-only artifact. Alongside the fix, ran a full codebase audit (findings in `docs/CODEBASE_AUDIT.md`): source is clean — 128 files/23.7k lines, 3 debt markers, 2 legitimate console.logs, zero dead files, 100%-consistent naming (kebab extractors / camel db+lib / Pascal components), 5 lean production deps. The real "bloat" is regenerable/archival and outside `src`: `dist/` 7.6GB (stale, never cleaned — added `npm run clean`/`build:clean` scripts), `release/` 3.2GB (old package output), `References/` 109MB (`.toc` files the findings doc says are safe to delete), and `.backup/` 1.6MB (old source snapshots) — ~11GB reclaimable, all the user's call. Removed the unused `sharp` devDep added earlier this session for the portrait assessment (re-add when the deferred WebP conversion runs). Minor optional items flagged, not done: `EditButton` defined in 3 files could dedupe to the one `CoachCard.tsx` exports; `shared/types.ts` (1,219 lines) could split by domain later; empty `readme.md`. `npm run typecheck`/`lint`/`build` all clean; verified a real launch still boots correctly after removing the instrumentation.
- **2026-07-19: Redundant recruit editing merged into one "Edit Player" modal.** User flagged that recruits had two separate edit entry points doing overlapping work — the recruiting-fields-only `RecruitEditorModal` (added in the Phase 3 refinement pass) and the general Player editor, each with its own pencil icon on the recruit profile modal, and the board row's pencil only opening the general editor with no path to recruiting fields at all. Asked the user to choose between keeping them separate vs. merging (`AskUserQuestion`); they chose merging. `PlayerEditorModal.tsx` gained a new conditional "Recruiting Info" tab (shown only when a new `isRecruit` prop is true) — ported straight from `RecruitEditorModal.tsx`: Hometown, Star Rating, Class, National/Position/State Rank, plus the same "not confirmed safe to write" banner for Home State/Top Schools/commitment status/signed school. The tab lazily fetches via the existing `window.api.editor.getRecruit` IPC call (unchanged backend, just re-wired), and `handleSave` now calls both `savePlayer` and (when applicable) `saveRecruit` in one click, combining both results into a single status message. `RecruitEditorModal.tsx` deleted outright; `EditorModalProvider`/`EditorModalHost` lost their separate `recruitState`/`openRecruitEditor` third state in favor of `PlayerEditorState.isRecruit`. `RecruitProfileModal.tsx` now shows exactly one pencil (next to the name, matching every other player-profile pattern in the app) instead of two; `Recruiting.tsx`'s board-row pencil now also passes `isRecruit: true`, closing a pre-existing gap where editing from the board never had access to recruiting fields at all. Verified live against a real save (USC dynasty, 31-recruit board): clicking a board row's pencil opens the merged modal on the Player Profile tab with a visible "Recruiting Info" tab alongside the standard ones; switching to it shows real fetched data (Bellflower/4 Stars/High school/#360/#25/#30 for a real recruit, matching the underlying database snapshot exactly); the recruit profile modal itself now shows a single edit icon next to the name. `npm run typecheck`/`lint`/`build` all clean.
- **2026-07-19: Recruit photo editing restored — same modal as roster players, jumping straight to the Portrait tab.** Direct follow-up to the leaguewide-portraits work below. User: "we had it before" — the general Player editor's Portrait tab (`PortraitPicker`) already supported editing a recruit's face all along, unchanged throughout this session (recruits are `Player` rows; `Recruiting.tsx`'s board-row pencil has always called the same `openPlayerEditor` roster players use). What was actually missing was a direct entry point from the recruit *profile modal* itself — previously the only edit action there opened the new recruiting-fields-only editor, with no path to the photo without navigating back to the board. Added a small edit icon overlaid on the portrait in `RecruitProfileModal.tsx`'s hero box, calling the exact same `openPlayerEditor` as the roster editor. To land directly on the Portrait tab instead of Player Profile, `PlayerEditorModal` gained an `initialTab` prop (threaded through `EditorModalProvider`'s `PlayerEditorState` and `EditorModalHost`, exported as `PlayerEditorTab` so the type isn't duplicated) — defaults to `'profile'` everywhere else, so no existing caller's behavior changed. Verified live: clicking the new icon on a recruit's photo opens the identical "Edit Player" modal roster players use, already on the Portrait tab, with the same full 25,527-portrait searchable picker and Save button. `npm run typecheck`/`lint`/`build` all clean.
- **2026-07-19: Leaguewide player portraits shipped, plus a GameDetail team-name fix.** Direct follow-up to the recruit-portrait fix below — user confirmed every player leaguewide has a real portrait, including CPU-controlled teams, not just recruits. New lightweight `extract-league-portraits.ts` reads `PresentationId`+`GenericHeadAssetName` for every non-empty `Player` record leaguewide (no team filter) into a new `leaguePortraits` snapshot — verified on a real save: 16,255 players extracted, 100% with a real portrait, no measurable extraction slowdown (the full `Player` table is already loaded by several other extractors for other reasons, so this is a near-free second minimal-field pass over already-read data). Wired into `getAwards.ts`: `LeagueAward`, `HeismanCandidate`, and `HonorRosterEntry` all gained a real `portraitAssetName` via a `playerId -> portrait` join, replacing what was previously always `null` for anyone not on the user's own team. Threaded through every `PlayerNameButton` call site that already had `showPortrait` wired (Annual Awards, Heisman winner/finalists, All-America/Conference) and through `PlayerModalProvider`'s `PlayerModalFallback` + `PlayerProfileContent.tsx`'s opposing-team-player branch, which previously showed a `TeamLogo` with no portrait at all. Verified live against a real save: every award winner across every team now shows a real photo instead of initials, and opening an opposing-team player's profile modal (previously a "Full profile unavailable" card with just a team logo) now shows their real face too — full stats/bio/game-log remain correctly unavailable for opposing players, only the portrait gap was closed. Same pass also fixed a real, unrelated small bug: `GameDetail.tsx`'s "Quarter by quarter" and "Team stats" sections hardcoded the literal text "You" instead of the real team name — both now read `ScheduleGame.teamName`, a field that already existed and was already reliably populated (no new extraction needed). `npm run typecheck`/`lint`/`build` all clean.
- **2026-07-19: Real research gap found and fixed — recruit profile photos were wrongly declared impossible.** Direct follow-up to the Phase 3 refinement pass below, prompted by a user correction: recruit portrait *editing* had already worked before this pass (via the existing general Player editor — recruits are literally `Player` rows in the save, and that editor was never touched by this work) — the only actual gap was that the recruit profile modal never *displayed* a photo, always showing initials. Sub-phase C's research had concluded "no real recruit photo data exists," but that check only looked at whether the recruiting-specific extraction (`RecruitData`/`RecruitBoardEntry`) carried a `portraitAssetName` field — it never checked whether the underlying `Player` record recruits resolve to (the same record roster players use) actually has one. A direct diagnostic against a real save confirmed it does: every one of a real team's 35 board slots has a populated `GenericHeadAssetName`, identical in shape to roster players'. Fixed by adding `portraitAssetName` to `RecruitData` (`extract-recruits.ts`, same field/format as `extract-roster.ts`) and `RecruitBoardEntry`, threading it through `getRecruits.ts`, and swapping the recruit modal's hardcoded initials-only avatar for the real `PlayerPortrait` component (shows the real photo when present, falls back gracefully otherwise, exactly like every other player-portrait spot in the app). The now-inaccurate `resolveRecruitPortrait()` helper (added in sub-phase C) was deleted outright rather than patched, since its entire premise was wrong. Verified live against a real save: a real recruit's actual photo now renders in the profile modal. `npm run typecheck`/`lint`/`build` all clean. **Lesson for future research passes**: when a spec says "we don't have X," verify against the actual underlying save record a feature resolves to, not just whether the current extraction type happens to carry that field — an extraction gap and a genuine data-absence gap look identical from the type system but require completely different fixes.
- **2026-07-19: Phase 3 refinement pass shipped (Awards nav/highlighting, Rankings page removal, universal portrait linking, Team Awards retirement, recruit portraits/editing, GameDetail statistics unification).** User handed over a large 17-section spec spanning nav polish, Awards, Recruiting, portraits, and a Statistics/GameDetail unification. Given the size, three parallel research agents investigated the *actual current state* of every area before planning anything — several sections turned out already partially/fully built, one section (a real recruit photo) asked for something the save data genuinely can't provide, and two sections needed real write-path/extraction verification before any UI could safely ship, matching this project's established discipline that every past editor feature which skipped that step shipped a real bug (Coach `PresentationId` collisions, `CoachPrestige` enum). Phased into four sub-phases by risk. **Sub-phase A** (low-risk, no new data): `AwardsLayout.tsx`'s header restructured to title/description/submenu on separate rows so the submenu no longer wraps at normal desktop widths; `isUserTeam` highlighting (a pattern already shipped for Annual Awards) extended to Heisman finalists and the All-America/Conference table; the standalone Rankings page/nav/route removed while its backend (`ranking_history`, `getRankings`) was confirmed still directly consumed by Coach Hub's season-high rank tiles and left untouched; the recruit commitment timeline made clickable (the one genuinely unwired spot on the recruiting board); `PlayerPortrait` gained an optional `onClick` prop and got wired into every text-only player mention found (Annual Awards, Heisman, All-Teams, Weekly Honors, Team Awards candidate list and season history); the Player Profile (and Recruit Profile) Overall box now centers only the number, matching the spec's own example, not the label. **Sub-phase B** (a real design decision, real data at stake): confirmed via a read-only query against the live database that Newcomer of the Year and Best Quarterback — the two Team Awards the user wants removed — already have one real confirmed historical result each on a currently-active season, meaning outright deletion would have orphaned real user data. Added a new `retired?: boolean` flag on `AwardDefinition`, orthogonal to `enabled`/`disabledAwardIds`: never offered for future calculation, finalists, or settings, but the definition object stays so `getAwardDefinition()` still resolves a name for old results. Verified against a disposable copy of the real live database: both awards are gone from the live workflow and "More Awards Coming," the season still correctly reaches "Ready to Finalize" without them, and their real historical winners still render correctly in Season History on the very same season. **Sub-phase C** (recruit portraits + investigation-gated editing): ~~confirmed (again) that no real recruit photo data exists anywhere in the save~~ **this was wrong — see the "Latest" entry above.** The recruit modal's initials-only avatar shipped here as a `resolveRecruitPortrait()` helper documenting an honest-but-mistaken fallback; both were corrected the same day. Recruit editing was scoped strictly to what a real diagnostic write-probe (open a disposable save directly via `madden-franchise`, write, save, reopen, verify) confirmed safe: Hometown, Star Rating, Class Year, and National/Position/State Rank all round-tripped correctly. Home State turned out to be a real enum (`StateName`) whose valid member list wasn't catalogued this pass, "Top Schools" resolved to a reference into another table (a tracking structure, not a scalar), and commitment status/signed school were excluded on principle (real recruiting-stage game logic / derived cross-team data, not simple field edits) — all three excluded with honest reasons rather than guessed at. New third `EditorModalProvider` state (`recruitState`) and `RecruitEditorModal.tsx`, reachable via a new Edit button in the recruit profile modal's hero box, gated to the current season only — which also surfaced and fixed a real pre-existing gap where the board's general-editor pencil ignored season entirely. Verified end-to-end through the app's actual IPC-backed save path (not just the standalone probe): a real save → reopen round trip confirmed the new value. **Sub-phase D** (GameDetail statistics unification): extracted `StatisticsCategorySection`/`LeaderCard`/`withMode`/`ColumnDef` out of `Statistics.tsx` into a new shared `StatisticsCategorySection.tsx`, then rebuilt `GameDetail.tsx`'s Offense/Defense box score on top of it — real per-metric leader cards (Passing/Rushing/Receiving Yards and Touchdowns, Tackles/Sacks/Interceptions, portrait + name + position/jersey) now render for a single game, for free, from the exact same component the season Statistics page uses, replacing a bespoke box-score table with no leader concept. A real TypeScript quirk was hit and fixed along the way: constraining the shared generic to `{ gamesPlayed?: number }` tripped TS's weak-type-detection heuristic against `OffensiveGameLine`/`DefensiveGameLine` (which share zero property names with it), rejecting an otherwise-valid call — fixed by dropping the constraint and reading `gamesPlayed` defensively at runtime instead. Verified live: Statistics page shows zero regression after the extraction, GameDetail correctly shows real per-game leaders with real portraits and correct tie handling, and a metric with no real data this game (Rushing Touchdowns) correctly stays hidden rather than showing a false 0 leader. Kicking/Punting/Returns box scores deliberately deferred, not bundled in — confirmed no per-game data exists for them anywhere (no `KickingGameLine` type, no such gamelog category), flagged as its own future extraction phase. `npm run typecheck`/`lint`/`build` all clean across every sub-phase; all verification used disposable save copies and isolated `--user-data-dir` paths, and one read-only query against a copy of the real live database, never the user's actual data.
- **2026-07-19: Team Awards — Phases 4 and 6 shipped, closing out the feature except for the deliberately-skipped Phase 5.** Direct continuation of Phases 1-2 (above). **Phase 4 — Special Teams Player of the Year**: unblocked by the same-day Kicking/Punting/Return extraction work (see the entry below). New `specialTeamsGroup()`/`specialTeamsProductionRaw()`/`specialTeamsEfficiencyRaw()` in `formulas.ts` classify each candidate into exactly one of kicker/punter/returner (K with kicking stats, P with kicking stats, or anyone with real KR/PR yardage) and score them with role-specific formulas (kickers: FG/XP makes plus a 50+-yard bonus; punters: net yards plus inside-20 bonus minus touchback penalty; returners: return yardage plus TDs), then compares all three roles fairly on one scale via the same `percentileByGroup` percentile-within-subgroup mechanism already used for CB/Safety and backs/receivers — the first time that mechanism has handled three subgroups instead of two. Real bug hit during this phase: a doc comment literally containing `*/` (describing "extra KRET*/PRET* return columns") prematurely closed its own block comment, cascading into ~50 TypeScript syntax errors — fixed by rewording, not suppressing. Verified end-to-end via a temporary diagnostic branch in `main.ts` (removed after use) against a real save: finalists were exactly the three real special-teams standouts, one per role, with a defensible kicker winner. **Phase 6 — Season history, Player Profile / Coach Hub integration, settings panel**: closes out the feature's remaining UI surface. Discovered mid-research that `TeamAwardSettings`'s backend (types, DB read/write, full IPC round-trip) already existed from Phase 1 with zero renderer consumer — this phase built the UI layer only. New settings panel on `TeamAwards.tsx` (dropdown-panel pattern from `PreferencesMenu.tsx`): Calculation Timing (Postseason Only vs. Allow Preliminary, gated by a new `isSeasonComplete()` check on the schedule), Auto-Recalculate on/off, per-award enable/disable checkboxes, and Freshman/Newcomer eligibility toggles shipped visibly but locked with an honest reason — direct diagnostic verification against a real save confirmed `RedshirtStatus`'s real values (`Previous`/`Ineligible`/`Eligible`) describe redshirt-eligibility status, not "was redshirted as a freshman," so the toggle can't be built correctly yet. New `getTeamAwardHistory()` resolves each past season's confirmed winners against *that season's own* roster/team snapshot (never the dynasty's current one, matching the same principle used by `getHistory.ts`), rendered as a new Season History section at the bottom of `TeamAwards.tsx` with clickable award chips opening the player profile modal. New `TeamAwardsWonSection` on `PlayerProfileContent.tsx` (between Game Log and Honors, primary render path only — Team Awards only ever apply to the user's own roster, so the opposing-team fallback branch correctly has no equivalent) and a compact `TeamAwardsSummaryCard` on `CoachHub.tsx` (own independent fetch, matching this app's per-page-fetch convention). `autoRecalculateTeamAwards()` now runs after every `syncDynasty()` re-import, respecting the new settings. Verified end-to-end via a temporary diagnostic branch confirming three real awards (MVP, Offensive POY, Special Teams POY) on a disposable save copy, then live screenshots of all four new surfaces (settings panel, season history, Player Profile section, Coach Hub card) — the Coach Hub card initially looked missing in a downscaled full-page screenshot, which turned out to be a false alarm (a genuine perception issue at that zoom level, confirmed by a targeted `capturePage(rect)` crop, not a code bug). `npm run typecheck`/`lint`/`build` all clean. **Phase 5 (Single-Game Performance of the Year) explicitly skipped for now, not silently dropped** — user asked for "4 then 6" specifically. All 10 automatic/manual awards other than Single-Game Performance are now enabled and fully wired end-to-end.
- **2026-07-19: Schedule season-scoping bug fixed, Breakout POY cut from Team Awards scope, Kicking/Punting/Return stats extracted and wired into Statistics.** Three focused follow-ups, picked from the open backlog. (1) Root-caused and fixed the `extract-schedule.ts` season-boundary bug flagged in an earlier session: the save's own `SeasonGame.SeasonYear` field (a 0-based relative index, same convention as player `SEAS_YEAR`) plus the already-extracted `baseCalendarYear` now scope every game to the season actually being synced — verified on a real save caught mid-transition (a fresh preseason with only 43 leftover bowl games from the just-finished season and zero real games for the new one; before the fix those 43 games would have been wrongly attributed to the new season, after the fix that season correctly and honestly shows 0 games). (2) Breakout Player of the Year removed entirely from Team Awards (explicit user decision, not just left disabled) — 11 of the spec's original 12 awards remain. (3) Real-save investigation turned up a more serious pre-existing bug than "kicking stats aren't extracted": return-duty players (kick/punt returners) have their `CareerStats`/`SeasonStats` reference resolve to a `*KPReturn` table variant carrying the same passing/rushing/receiving/tackle fields plus return columns — `categoryFromTableName()` didn't recognize those table names, so any player with real return duty was **silently dropped from every stat category entirely**, not just missing return numbers (confirmed on a real WR, 11 kick returns for 295 yards, showing zero stats anywhere in the app). Fixed at both the season/career level (`extract-stats.ts`) and the per-game level (`extract-gamelog.ts`), plus added real kicking/punting as a genuinely separate category (new `extract-kicking.ts`, own `CareerKickingStats`/`SeasonKickingStats` table shared by K and P) with a full IPC round-trip and new Kicking/Punting/Returns sections on the Statistics page. A real UI bug was caught by screenshot during verification and fixed before shipping: the Returns leader cards initially showed a false "Punt Return Yards" leader at 0 yards on a team where nobody actually returns punts (only `onlyIfPositive` on the TD metrics, not the yardage ones) — fixed by requiring a positive value for all four return metrics. See the dedicated "Schedule fix, Breakout POY removal, Kicking/Return stats" entry below for the full breakdown.
- **2026-07-18: Overnight UX/Data Persistence/Navigation Refinement pass shipped, full 22-section spec.** User authorized a full autonomous overnight pass on a large multi-section spec (nav cleanup, Dynasty/Coach Hub/Team Hub redesign, historical player persistence, Schedule/GameDetail rework, Statistics leader cards, Awards restructure, Recruiting profile modal, History page rebuild). Two real bugs found and fixed that weren't anticipated by the spec: an OC/DC-controlled dynasty **failed to import at all** (`findUserTeamIndex()` wrongly required Head Coach specifically), and the Team Mode theme bug (`DynastyLayout.tsx` hardcoding null colors). Historical player persistence turned out to need only a surgical `seasonId`-threading fix, not the new snapshot system the spec proposed — the underlying `season_snapshots` table was already durable. Standings divisions and single-game record opponent context were both investigated and deliberately not built/fabricated after confirming the save doesn't support them. See the dedicated "UX, Data Persistence & Navigation Refinement" entry below for the full breakdown.
- **2026-07-18: Team Awards — Phase 2 shipped (7 more awards + a real data-model fix).** Direct follow-up to Phase 1, per explicit user correction: the "no fumbles-lost field" gap flagged in Phase 1 was re-investigated rather than left as a permanent limitation, and it turned up real data — `CareerOffensiveStats`/`SeasonOffensiveStats` has a genuine `RUSHFUMBLES` field, confirmed by direct field-name inspection on a real save (`Noah Aaronson`, a real player, field present and populated). It's rushing-play fumbles specifically, not a "fumbles lost" total (no such field exists, and receiving/passing-play fumbles aren't tracked separately anywhere) — added honestly as `OffensiveStatLine.fumbles` with a doc comment stating exactly that scope, not relabeled to sound more complete than it is. Wired into `extract-stats.ts`, `shared/types.ts`, and the one other consumer that constructs `OffensiveStatLine` literals (`PlayerProfileContent.tsx`'s season-summing helpers). This unblocked every Phase 2 award's real "Ball Security" component. New `src/teamAwards/formulas.ts` factors out the shared position-grouping/production-score/team-share machinery MVP introduced in Phase 1 (plus a new generic `percentileByGroup` helper) so every new award reuses proven code instead of re-deriving it — MVP itself was refactored onto this shared layer with no behavior change (re-verified). `AwardDefinition` gained a `customEligibility` hook for award-specific participation rules the generic position/class/games-played checks don't cover (QB needing 20% of team pass attempts, HB needing 15% of team rush attempts, WR/TE needing 10% of team receptions — all straight from the spec's own numbers, using real team-level totals already on `TeamStats`). Shipped: Offensive Player of the Year, Defensive Player of the Year, Best Quarterback, Best Offensive Skill Player (HB/FB/WR/TE, with backs and receivers normalized as separate subgroups per the spec's own instruction), Best Defensive Front Player, Best Defensive Back (corners and safeties normalized separately, same reasoning), and Freshman of the Year (true-freshman only — the redshirt-inclusive toggle stays deferred until `redshirtStatus`'s real values are verified). Quarterback Hurries still doesn't exist anywhere in the save (confirmed in Phase 1) — Best Defensive Front Player's formula keeps it as a real, always-missing component so its weight is honestly redistributed every calculation rather than quietly dropped from the formula's own definition. **Real gap found and fixed during verification, not just anticipated in planning**: Freshman of the Year correctly returned `insufficientData` on a fresh-preseason save (no true freshman had any recorded production, starts, or participation yet — a real, honest "nothing to recommend" result, not a bug), which exposed that the Phase 1 UI had no way to hand-pick a winner for an automatic award stuck in that state. Fixed by adding the spec's own called-for "Select Winner Manually" fallback, wired through the same `confirmTeamAwardWinner` endpoint already used for finalist overrides — automatic awards aren't a dead end when the data genuinely can't support a recommendation. Verified end-to-end via a temporary diagnostic branch in `main.ts` (removed after use) against a disposable save: all 7 new awards calculated with real, sensible winners (e.g. Offensive POY and Best Offensive Skill Player both correctly landed on the same real leading receiver; Best Defensive Back correctly separated from Best Defensive Front's winner) and honest missing-input disclosures where genuinely appropriate. Live screenshot confirmed all 9 enabled awards rendering correctly in the actual UI, including the new manual-override path. `npm run typecheck`/`lint`/`build` all clean. **Explicitly deferred, not silently dropped**: Breakout Player of the Year (Phase 3), Special Teams Player of the Year (Phase 4), Single-Game Performance of the Year (Phase 5), season history/Player Profile/Coach Hub integration/settings panel (Phase 6).
- **2026-07-18: Team Awards — Phase 1 shipped (engine foundation + MVP + Newcomer of the Year).** User provided a full spec for a "Team Awards" page: a position-aware, transparent, editable award-recommendation engine covering 12 end-of-season awards, with a calculate → recommend → confirm/override → finalize workflow and permanent persistence across re-syncs. Distinct from the existing save-derived `Awards.tsx` — this is app-generated and user-editable, the coach's own call supported by data, never presented as unquestionable. Before planning, ran three parallel investigations (player/roster data, stats/gamelog data, UI/persistence patterns) and found real gaps between the spec and what the save actually supports: no transfer/newcomer field exists anywhere (Newcomer of the Year ships **manual-only, permanently**, not a temporary gap); no fumbles-lost field exists for offensive players (every formula's "Ball Security" component for skill positions is structurally impossible, dropped with weight redistributed); no passer rating or QB-hurry fields; kicking/return tables were only ever confirmed to *exist*, never actually mapped to field names (Special Teams POY blocked on real extraction work, deferred to Phase 4, to be built once and shared with the Statistics page's own already-deferred Kicking/Return phase); no historical opponent-rank-at-time-of-game data (the "ranked opponent" context bonus and tiebreaker are dropped from Single-Game Performance of the Year, Phase 5). Real position values (`QB, HB, FB, WR, TE, LT/LG/C/RG/RT, LE/RE/DT/LOLB/MLB/ROLB, CB/SS/FS, K, P`) and class values (`Freshman/Sophomore/Junior/Senior`, no "Redshirt Freshman" compound value) were confirmed directly from `rosterOrder.ts` rather than assumed. Phased into 6 stages (matching this project's established discipline for large builds) — Phase 1 ships the foundation everything else depends on: new `team_award_results`/`team_award_settings` tables (migration v5, deliberately outside `season_snapshots` — that table is fully overwritten by `saveSnapshot()` on every re-import, so a confirmed winner living there would be silently wiped on the next sync; these tables never are, which is what structurally guarantees survival, not just convention). This is the **first feature in the app that writes user-entered data to local SQLite** — every prior write path (`editorWrite.ts`) only ever wrote to the `.DYNASTY` save file itself and re-extracted; a genuinely new write-capable IPC pattern was built for it (`teamAwardsWrite.ts`, mirroring `helpers.ts`'s `run`/`get`/`all` primitives). New `src/teamAwards/` service layer (`awardDefinitions.ts`, `eligibility.ts`, `normalization.ts` — percentile-within-position-group, the real hard part for cross-position comparisons, `scoring.ts` — generic missing-input weight redistribution, `tiebreakers.ts`, `explanations.ts`, `calculationVersions.ts`, `awardEngine.ts`), calculation logic kept fully out of React per the spec's own architecture ask. All 12 awards are defined up front (even the 10 not yet buildable, each with a real, specific `disabledReason` — "Planned for Phase 2", "Blocked on new extraction work", etc.) so the full scope is honest and visible on the page itself, not silently introduced later — confirmed via a live screenshot showing the "More Awards Coming" section listing all 10 with their real reasons. MVP ships as a genuinely reduced formula: the spec's Game Impact/Big-Game Performance/Consistency components all need per-game context that doesn't exist until gamelog is joined to schedule (Phase 5), so they're modeled as real components with a null `rawValue` and let the generic redistribution logic fold their weight into Position-Adjusted Performance and Share of Team Production — verified live on a real save that this produces a defensible result (a DT with 40 tackles/2 sacks/7 TFL, 96th percentile among defensive front/back candidates, correctly recommended) and an honest missing-inputs list ("Share of Team Production, Game Impact, Big-Game Performance, Consistency") when the team hasn't recorded any games yet this season. Newcomer of the Year ships as a pure manual pick from the roster — no calculation, no finalists — deliberately shipped alongside MVP in this same phase specifically because it exercises the structurally different manual code path with zero scoring-engine involvement. Verified end-to-end via a temporary diagnostic branch in `main.ts` (removed after use, per standing discipline) against a disposable save copy: calculate → confirm → **re-sync** (re-ran the full extraction/import pipeline against the same save) → both MVP's and Newcomer's confirmed selections survived completely untouched → finalize (bulk confirmed→finalized, correctly blocked until every enabled award is confirmed) → unlock (bulk finalized→confirmed) → recalculate-while-confirmed (recommendation refreshed, confirmed selection preserved, status stayed `confirmed` rather than resetting) — every one of the spec's core persistence guarantees held. Live screenshot confirmed the actual rendered page: team header with logo/coach/record, "Ready to Finalize" status with the Finalize button correctly gated, both award cards showing their confirmed winners with the right action buttons, and the full 12-award roadmap listed transparently. `npm run typecheck`/`lint`/`build` all clean. **Explicitly deferred, not silently dropped**: Offensive/Defensive POY, the four position/unit awards, Freshman of the Year (Phase 2); Breakout Player of the Year, pending its own cross-season stat-slot verification (Phase 3); Special Teams POY, pending kicking/return extraction (Phase 4); Single-Game Performance of the Year, pending a schedule-join fix and the game-log-to-schedule join itself (Phase 5); season history, Player Profile/Coach Hub integration, and the settings panel (Phase 6).
- **2026-07-17: Statistics page — Phase 1 shipped (Team Statistics + Passing/Rushing/Receiving/Defense).** User provided a full ESPN-style Statistics page spec (team box score + 7 player-stat categories, leader cards, comparison mode, milestones, qualification rules). Rather than building all 20 sections at once, verified against real save data what's actually supported (the spec's own instruction: never fabricate unsupported statistics) and phased the build — this is Phase 1 of 4. **Real find**: `Team.TeamSeasonStats` (schema type `TeamStats[]`, 58 real fields) has never been read by this app — full team box-score totals (yards, red zone, third/fourth-down, sacks, turnovers, penalties, time of possession) genuinely exist in the save. Verified slot 0 always holds the *current* season's live-accumulating totals on two real saves (cross-checked exactly against the team's own separately-extracted win/loss fields — a 7-6 record matched precisely) — no complex slot-selection logic needed here, unlike the two real slot-ordering bugs found and fixed earlier this session (`SeasonStats`, `YearSummary`). No `POINTS`/`POINTS ALLOWED` field exists anywhere in `TeamStats` — scoring is correctly derived from the already-extracted schedule instead of guessed. New `extract-team-stats.ts`, new `teamStats` snapshot key, new `getTeamStats.ts` query + IPC round-trip (mirroring `getPlayerStats.ts` exactly). New reusable `StatisticsTable.tsx` (config-driven columns, click-to-sort/reverse, generalizing `Roster.tsx`'s existing sortable-table pattern instead of hand-rolling seven separate tables) and new `Statistics.tsx` page: Team Overview Cards, a 3-column Offense/Defense/Special-Teams breakdown, and four full-width player categories (Passing/Rushing/Receiving/Defense) each with a leader card and sortable table, reusing `getRoster`/`getPlayerStats` with the same client-side join pattern already used by `PlayerProfileContent.tsx` — no new server-side join needed. Per explicit user direction, every player row/leader card is clickable and opens the existing player profile modal (`usePlayerModal`), verified live: clicking a real player's stat row (Brad Jackson, QB) opened his full profile with matching numbers and working Prev/Next navigation. New "Statistics" tab in the nav bar (12th tab). Verified end-to-end against a real fully-simulated season (13 games): Points Per Game 26.9, Total Offense 426 yd/g, real Passing/Rushing/Receiving/Defense leaders and tables all cross-checked (e.g. a dual-threat QB correctly appearing in both Passing and Rushing sections, matching the save's own combined offensive-stat-table design). **Explicitly deferred to Phases 2-4** (not silently dropped — flagged directly): Kicking/Kick Return/Punt Return (real tables found and verified resolvable, `CareerKickingStats`/`CareerOffensiveKPReturnStats`/`CareerDefensiveKPReturnStats`, just not wired up yet), qualification-rule minimums on leader cards, comparison mode, Regular/Postseason splitting, Home/Away/Opponent filters, Hot Players, Milestones, and expanded per-game rows. `npm run typecheck`/`lint`/`build` all clean. See the dedicated "Statistics page — Phase 1" entry below.
- **Same-day follow-up (2026-07-17): Statistics page verified across multi-season boundaries, two real bugs fixed, one deeper pre-existing issue found and deliberately deferred.** Direct follow-up to the Phase 1 ship above — user asked for confidence that the new Statistics page (and the season-snapshot architecture it depends on) holds up across multiple seasons, both for the normal "sync once per season" workflow and for browsing already-available History-Only backfilled seasons. Verified via direct SQL inspection of a disposable multi-season save copy: `season_snapshots` are correctly isolated per `season_id` with zero cross-contamination between a full season and a History-Only one, and re-syncing the same season twice is idempotent (no duplication or staleness). Two real bugs found and fixed along the way: (1) **misleading "Dynasty not found" on History-Only seasons** — `getSeasonOverview` correctly returns `undefined` when a season has no `user_team_id` (true for every backfilled History-Only season), but `Statistics.tsx` was treating that the same as a genuinely missing dynasty; fixed with the same `hasFullData` check already used in `CoachHub.tsx`/`DynastyOverview.tsx`, now showing an accurate "No detailed data for this season" message instead. (2) **Team Overview Cards internally inconsistent at a season boundary** — at the exact moment a new season starts (fresh preseason, 0 games played), the page showed a nonsensical "16.0 PPG" (schedule-derived) simultaneously with "Total Offense: 0 yd/g" (correctly-zero `teamStats`-derived) — scoring 16 points with 0 total yards is impossible. Root cause: `extractSchedule()` in `extract-schedule.ts` reads the entire `SeasonGame` table with no season-year filtering, so right at a season transition it can transiently contain only the just-finished season's leftover bowl games. Fixed in `Statistics.tsx` specifically by deriving `gamesPlayed` from `teamStats.wins + teamStats.losses + teamStats.ties` (correctly scoped) instead of counting schedule "played" entries, and gating `pointsScored`/`pointsAllowed` on `gamesPlayed > 0`. **Found but deliberately NOT fixed this pass** (flagged directly, not silently patched around): the underlying `extract-schedule.ts` un-scoped `SeasonGame` read, and a second related issue in `extract-stats.ts` — its existing "highest SEAS_YEAR slot = current season" heuristic (from an earlier session's fix) can return a player's only, stale, prior-season stat slot as "this season's" when they haven't played any games yet in the new one (confirmed on a real player, Ryan Browne: his only tracked slot is genuinely his completed 2026 season but reads as "current" in the fresh 2027 preseason). Both are pre-existing, cross-cutting issues that predate this page and also affect `Schedule.tsx`, `GameDetail.tsx`, `PlayerDetail.tsx`, and Roster stat displays — too broad to fix safely in this verification pass without the same full-rigor treatment already given to the two real slot-ordering bugs found earlier this session (`SeasonStats`, `YearSummary`). Recommended as a dedicated follow-up. `npm run typecheck`/`lint`/`build` all clean; all verification used disposable save copies and isolated `--user-data-dir` paths, never the user's real data.
- In-app Help menu shipped — a living how-to guide, distinct from this DevLog. Direct follow-up to a real support conversation about season-sync timing that exposed a gap: important how-to knowledge (when to sync, what "History Only" means, Coach Hub vs. Team Hub, Sync vs. Relink vs. Backup, editing caveats) only ever existed in chat or in this DevLog, which documents *what shipped and why* for future development, not *how to use it* for someone playing their dynasty. New `HelpMenu.tsx`, matching the existing `PreferencesMenu`/`StadiumDatabaseMenu` navbar-dropdown pattern exactly (same panel chrome, click-outside/Escape-to-close), with a two-column topic-list-plus-content layout. New "Help" button sits in the navbar right after Preferences, before Stadiums. Seven topics shipped at launch, written in a professional-but-human-centered tone (plain language, explains the *why*, not just the *what*): Importing your dynasty, Sync every season before you advance (the one that prompted this), The Season dropdown & History Only seasons, Coach Hub vs. Team Hub, Sync/Relink/Backup, Editing players and coaches, and a short honest-limitations list. Content was checked against real code behavior before writing it (e.g., confirmed via `editorWrite.ts` that coach portrait edits update the picker/preview correctly but don't reliably carry into the game itself, unlike player portraits, before writing that caveat). **Standing convention going forward, per explicit user request:** update this Help menu — not just DevLog.md — whenever a real use-case/how-to question comes up; saved as a durable memory so future sessions carry this forward automatically. Verified live: Help button renders in the correct nav position, panel opens/closes correctly, topic switching works, content renders cleanly in both themes. `npm run typecheck`/`lint`/`build` all clean.
- Multi-season history made bulletproof — real backfill from the save's own league history, and a real conference-champion/coach-award contamination bug fixed.** User reported the season switcher showed no dropdown for a new save (`DYNASTY-TULANEMASTER`, Tulane, 4-5 seasons already simmed) while an older save worked fine, framed as a must-be-flawless feature. Root cause, confirmed via direct inspection of a read-only copy of the user's real live database plus both save files: not a bug — Texas State has 2 season rows because it was synced twice; Tulane has exactly 1 because it was only ever synced once, *after* already being simmed 4 years in. The app can only capture what a save looks like at the moment of sync — no mechanism can see backward from a single snapshot. What turned this into a real fix rather than just an explanation: the save has a genuine year-by-year league history table (`League`'s `YearSummary[]`, real 30-slot array — the schema calls it `League.LeagueHistory` but that reference is confirmed unresolvable, so it's located by table name directly instead) that resolves, for every *completed* year, a real national championship result, every conference's champion, and that year's season awards — verified with real data for 3 full years on the Tulane save (real teams, real coaches, real scores). Built a new `extract-league-history.ts` extractor around it and used it to (1) **retroactively backfill lightweight "history-only" seasons** for every year never individually synced — Tulane went from 1 season row to 4, with the 3 recovered years clearly labeled and showing real champions/awards but no roster/schedule/stats (genuinely unrecoverable) — and (2) **fix a real, independently-confirmed bug**: the previous `extract-conference-championship.ts` and `extract-awards.ts` coach-award extraction both read flat, ever-accumulating tables with no year field, treating the *whole* multi-year history as "this season's" data — confirmed on Tulane's 3-completed-year save that each of the 10 conferences had exactly 3 stale entries, one per year, silently corrupting the Standings champion badge and Coach Hub's `BEST_HC`/`BEST_AC` awards for any dynasty 2+ seasons deep. Both extractors now source from the correctly year-scoped path. New `has_full_data` column (schema v4) distinguishes real synced seasons from backfilled ones everywhere a season is shown — season-switcher dropdown labels history-only entries, a contextual banner explains the limitation in plain language when one is selected, and a new "League History" section on the History page shows every year's national/conference champions (backfilled and full seasons alike) — the actual payoff of the whole feature. Verified end-to-end against disposable copies of both real saves: Tulane correctly backfilled exactly 2026-2028 with real data; Texas State (already fully synced, no gaps) correctly backfilled *nothing*, and re-syncing twice in a row created no duplicates; the schema migration applied cleanly to a copy of the user's real 11-season live database. `npm run typecheck`/`lint`/`build` all clean. See the dedicated "Multi-season history backfill + conference-championship bug fix" entry below.
- Phase 4 of the coach-centric redesign — scoped cleanup, closing out the redesign. Deliberately scoped to only what Phases 0-3 actually left behind (per the user's original design-doc feedback exchange), not a general audit. A dedicated investigation found the prior phases left almost nothing dead: `formatCoachPosition` was already fully replaced by `spaceCamelCase` with zero stray references, no dangling `/coaches` route/file references remain anywhere, and every page/component is still reachable from `app.tsx`. Tidied one stale comment in `CoachHub.tsx` that referenced the deleted `Coaches.tsx` by name. One real but pre-existing pattern was surfaced and deliberately left alone: `DynastyOverview.tsx` and `CoachHub.tsx` each independently fetch `getCoaches` for the head coach on their own page visits — consistent with this codebase's established per-page-fetch convention (the same choice Phase 1 made deliberately for the sidebar), not a regression from this redesign, and not worth a new shared-data abstraction for one small local IPC call. Separately, moved `DevNotes_071726_V1.md` (the original design doc that started this redesign) from the repo root into a new `docs/archive/` folder now that all 4 phases are shipped and its contents are captured in `DevLog.md`/`MASTER_ROADMAP_v2.md`. `npm run typecheck`/`lint` clean; no other files changed. This closes out the coach-centric redesign (Phases 0-4, all shipped).
- Phase 3 of the coach-centric redesign — standalone Coaches page retired. Direct follow-up to Phase 2, closing out its own stated exit condition ("removes it once Coach Hub is verified to cover everything it did"). Before deleting `Coaches.tsx`, found one real gap: its per-coordinator "Imported Resume" (each staff member's own win-loss record for the seasons they've actually been on staff, computed by matching coach names across every imported season) wasn't reproduced in Coach Hub's Current Coaching Staff section — it was rendering coordinator cards with `resume={null}`. Ported `buildCoachResumeMap` into `CoachHub.tsx` (same computation, same shared `CoachResume` shape from `CoachCard.tsx`) rather than shipping a quiet regression. Then removed `Coaches.tsx` entirely: its route and `DynastyLayout.tsx`'s "Coaches" nav tab deleted, and `DynastyOverview.tsx`'s stale "View full staff" link (previously `/dynasty/:id/coaches`) repointed at the Coach Hub index route, which now shows the same staff. Verified live against a real save: nav bar confirmed clean (no dangling "Coaches" tab), and both coordinators' Imported Resume blocks render with the correct real record (4-2, 1 imported season, Conf 2-1) — matching what `Coaches.tsx` showed before removal. `npm run typecheck`/`lint`/`build` all clean. See the dedicated "Phase 3 — Coaches page retired" entry below.
- **Phase 2 of the coach-centric redesign — Coach Hub shipped as the new default dynasty page.** The flagship page of the redesign: `/dynasty/:id`'s index route is now a new `CoachHub.tsx` (hero, Coach Profile, dual-sourced Career Record, Current Coaching Staff, Previous Seasons Timeline), with the former index page (`DynastyOverview.tsx`) kept as-is and moved to `/dynasty/:id/team-hub`, per the user's explicit choice to keep both as separate tabs. Before scoping, decompressed the real CFB27 schema and checked every `Coach` field rather than assuming — found `CareerCoachStats`, a save-native, already-computed *lifetime* coaching record (wins/losses, bowl/conference/playoff/rivalry/Top-25 record, national titles, times fired, draft picks, recruit classes) that the game tracks across the coach's entire career, independent of what this app has imported; that's now the primary "Career Record" source, shown alongside (not merged with) a second "Since Importing" block scoped to this app's own tracked seasons — same deliberate dual-labeling precedent as `yearsCoaching` vs. imported-season counts. Real-save verification (disposable copy, isolated diagnostics) caught a genuine dead end before it shipped: `OffensiveScheme`/`DefensiveScheme` resolve to a real, valid target table (confirmed via two independent reference paths — the coach's own field and a `Scheme[]` 19-slot container) that the `madden-franchise` library never enumerates into its table list, so it's unreachable through the same resolution pattern every other reference field in this codebase uses (`getTableById` returns nothing even from the library's own official API). Rather than hand-rolling a workaround outside the library's supported surface, scheme was dropped from scope — everything else (`Age`, `DominantArchetype`, `SeasonsWithTeam`, `CurrentJobSecurityStatus`, `Personality`, full `CareerCoachStats`) resolved cleanly and shipped. `Coaches.tsx`'s `CoachCard` was extracted into a new shared `src/renderer/components/common/CoachCard.tsx` (also exporting `spaceCamelCase`, `coachKey`, `EditButton`) so both pages reuse the identical card instead of a second copy. See the dedicated "Phase 2 — Coach Hub" entry below.
- **Phase 1 of the coach-centric redesign — collapsible Dynasty submenu + Dashboard icon separation.** Sidebar's single static "Dynasty → Home" link replaced with an expandable tree: clicking "Dynasty" still goes to the Dashboard, but it now expands to list every loaded dynasty by real team logo + real head coach name (a new `headCoachName` field on `DynastySummary`, resolved server-side via the existing `getCoaches` query). Also widened the gap between the Dashboard card's Sync/Backup icons and Delete, adding a visible divider between them, per the user's request to make an accidental delete click structurally harder. Verified live: sidebar correctly showed two real imported dynasties (Lincoln Riley/USC, Mario Cristobal/Miami) with real logos, expand/collapse toggle works, and the icon divider renders as intended. See the dedicated "Phase 1" entry below.
- **Phase 0 of the coach-centric redesign — per-season team tracking.** User is redesigning the app around the coach as the primary entity (not the school), after confirming the human-controlled coach can genuinely be fired/hired and change schools within one continuous save file. That broke a real, previously-invisible assumption: `dynasties.team_id` was a fixed-forever value set once at first import and never revised on reimport — every query (10 files, 30 call sites) resolved "the user's team" against it, so a real coaching change would have silently kept showing every future season under the old school. Fixed by adding a real `user_team_id` column to `seasons` (migration v3) populated from what the extractor already independently re-derives correctly on every import (`findUserTeamIndex`, save-native, zero dependency on prior state), and switching every query to resolve a season's team from its own row instead of the dynasty-level cache. Also added a one-time startup backfill for already-imported seasons (which would otherwise all read `user_team_id: NULL` after the migration) that derives each one's real historical team from that season's own already-stored coaches snapshot — not guessed from the dynasty's current value, which would be wrong for anyone who already changed schools before this fix shipped. Verified end-to-end with a synthetic two-season, two-team diagnostic: every affected query correctly returned the right school per season, `getHistory`'s season timeline correctly showed two different coaches at two different schools, and the backfill correctly recovered a nulled-out season's *original* team, not the dynasty's newer cached one. See the dedicated "Phase 0 — per-season team tracking" entry below.
- **Dynasty management moved to the Dashboard as icon buttons; "Relink" replaced by one-click "Sync Dynasty".** Direct follow-up to the relink feature: user asked for "Backup Save File" and the relink action to live as small icons next to the existing trash icon on each Dashboard card instead of as text buttons on the Team Hub page, for the relink action to be renamed "Sync Dynasty" and skip the file picker entirely (just re-read the save file already on record for that dynasty), and for "Delete Dynasty" to be removed from Team Hub (Dashboard-only, as it already was there too). New `syncDynasty(dynastyId)` — a plain one-click reimport of a dynasty's own already-known save path, no dialog, distinct from the explicit relink flow which is still used internally when the automatic same-team-different-path detection on the normal import flow prompts to link. Team Hub's whole action-button row is gone; the Dashboard's dynasty cards now show three hover-revealed icon buttons (Sync, Backup, Delete). Verified live: icons render correctly in a row, Sync executes a real reimport, Team Hub confirmed clean of the removed buttons.
- **Dynasty relink — fixes a real duplicate-dynasty bug found while the user tried out the new season switcher.** The user reported not seeing the switcher after reimporting; investigation (direct, read-only inspection of a copy of their real live database, never modifying the original) found the real cause: dynasties are matched by an exact save-file path, and the user had advanced their save into season 2 and saved it under a new filename rather than overwriting the original — so the import silently created a second, unrelated one-season dynasty instead of adding a season to the existing one. New "Relink Save File" button on the Dynasty page, plus automatic detection on the normal import flow (prompts to link when a picked file looks like the same team as an already-tracked dynasty under a different path), both funneling through a shared, team-match-guarded relink operation. Verified against real save data: relinking correctly merges into one dynasty with both seasons, and relinking to a different team's save is correctly rejected. See the dedicated "Dynasty relink" entry below.
- **Multi-season correctness pass — a real season-stats bug fixed, and one persistent app-wide season switcher replacing 8 duplicated per-page ones.** User asked for confidence the app holds up across a full 30-season dynasty (browsing any past season's roster/schedule/stats/awards, coach and player career stats accumulating correctly), and provided a real save (`DYNASTY-MIAMITESTS2`, Miami, season 2 mid-season) to verify against. Investigation against that real save (isolated test database throughout, never the user's live data) found the underlying season/history architecture already solid — season identity, re-import dedup, and both player- and coach-career accumulation were already built and working — but surfaced two real, concrete problems, both fixed and verified against the real save: (1) `extract-stats.ts` hardcoded `SeasonStats0` as "this season's" stats, but `SeasonStats` is an 18-slot **history** array (one slot per season, each with its own `SEAS_YEAR`) — any player past their first tracked season was silently reading last season's stale stats instead of the current season's (real player example: Lance Medlock's 216 attempts/1636 yards were sitting in slot 1, invisible, while slot 0 showed 0/0). (2) The exact same season-dropdown pattern was independently duplicated across 8 pages, hidden inline and easy to miss — replaced with one persistent dropdown next to "Exports" in the nav, shared by every dynasty page via a new `SelectedSeasonProvider`. See the dedicated "Multi-season correctness pass" entry below for the full investigation and fix.
- **"Current Portrait" broken-image bug fixed.** User reported the small "Current Portrait" thumbnail in the Portrait Picker sometimes rendered as a broken image icon (while the identical portrait rendered fine in the search grid below it). Root cause: ~3.5% of real portrait files (887/25,527) are saved on disk with a doubled `_result_result.png` suffix instead of the usual single `_result.png`, and `PortraitPicker.tsx`'s "Current Portrait" preview was the one spot that reconstructed a file path from a bare asset name (hardcoding the single-suffix form) rather than using the real on-disk filename the backend search already returns. Fixed with an `onError` fallback that retries the double-suffix path once. Verified live against the exact asset from the user's screenshot (`Generic_0001_P_T0000_D_1_1`) — now renders correctly instead of a broken-image icon. `npm run typecheck`/`lint`/`build` all clean.
- **Real in-game portrait bug found and fixed — the editor was writing a field the game doesn't render from.** User reported that a portrait changed via the Portrait Picker updated correctly in this app's own preview, but the real EA Sports College Football 27 game still showed the player's old face after loading the edited save — while other edits in the same session (stats, etc.) did apply correctly in-game. Decompressed the real CFB27 schema and cross-referenced every field against a real save: `GenericHeadAssetName` (the only field this app was writing) turned out to be a descriptive string that the game engine doesn't appear to consume for rendering — a separate `PLYR_PORTRAIT` int field is what actually drives the in-game 2D portrait, confirmed to equal the `Generic_<N>_...` sequence number exactly for 7,243 of 7,244 real players checked. Player edits now write both fields; verified with a real save/reopen round trip (not just a code read) that the value persists correctly. See the dedicated "Portrait field fix" entry below for the full investigation, including why the Coach-side equivalent (`Coach.Portrait`) was deliberately left unfixed — it shows an inconsistent, not-yet-understood offset pattern that isn't safe to write blindly.
- **Portrait Picker filters + lightbox shipped.** Direct follow-up to the Player/Coach editor's Portrait tab: decoded the previously-cryptic `Generic_..._<LETTER>_<TIER>_<STYLE>` filename taxonomy (verified via real image inspection and cross-referenced against real player Weight/Height/Position data) into Type/Build (Heavy/Default/Muscular/Athletic)/Skin-Tone filters, added numbered pagination, and a click-to-enlarge lightbox with keyboard arrow navigation. See the dedicated "Portrait Picker follow-up" entry below.
- **Player/Coach save-file editor shipped — the app's first write-to-save-file feature, and two real bugs caught only by testing the actual write path against a disposable save copy.** New edit-pencil icons (Roster list/gallery, Recruiting board, Coaches cards) open a full editor modal — Player Profile, Ratings (all 61 rating fields across 6 sections, mapped to real schema field names), Skill Group Caps, Mental Abilities, Physical Abilities, and a searchable Portrait picker (25k+ local portrait library) — backed by a real `madden-franchise` write path confirmed to work: `record.Field = value` + `franchise.save()` genuinely persists to the `.DYNASTY` file, verified by round-tripping through a disposable copy of a real save, never the user's actual saves. A new "Backup Save File" button on the Dynasty page (next to Delete) lets the user manually snapshot the save file before editing. **Bug #1 (serious):** Coach edits were silently corrupting the *wrong coach* — `Coach.PresentationId`, assumed reliable by analogy to `Player.PresentationId` (separately verified unique), turned out **not** to be: 64 of 493 real coaches share `id=0`, and a genuine collision was found between two different real coaches both carrying `id=256`. Verified `TeamIndex + Position` is unique for every real team instead and switched the Coach lookup key to that composite — Player kept `PresentationId`, which remains correctly verified unique. **Bug #2 (real, lower stakes):** `CoachPrestige` looked like a plain int field but is actually a letter-grade enum (`"Dplus"`) — writing a number to it threw inside the library's enum validator. The real writable integer is the separate `CoachPrestigeScore` field; fixed the mapping. **Bug #3 (UI, caught by screenshot):** the editor modals were originally rendered inline on each page, nested inside `<main>` — which has a `clip-path` (via `angledClip()`). Per the CSS spec, `clip-path` on an ancestor creates a new *containing block* for `position: fixed` descendants, so the modal was rendering thousands of pixels off-screen instead of centered — confirmed via a real screenshot, not assumed. Fixed by moving to the same architecture the existing player-bio modal already uses: a new `EditorModalProvider` (context, mirrors `PlayerModalProvider`) + `EditorModalHost` mounted once at the app root in `app.tsx`, outside `<main>`, alongside `PlayerProfileModal`. Re-verified via screenshot after the fix: modal renders centered and fully visible with real data. Deliberately not resolved: Physical Ability slot *names* (e.g. "360", "Cutter") — these are archetype/position-specific and not present as static schema data; the save's own per-player signature-ability join tables (`GrantedSignatureAbility`/`ActiveSignatureData`) could theoretically resolve them but weren't read this pass, so slots show generic "Physical Ability N" labels with just a tier dropdown, flagged directly in the tab's own warning banner. `npm run typecheck`/`lint`/`build` all clean.
- **Corrupted-database recovery flow shipped — and a real lazy-validation bug caught by testing it, not just reading it.** Previously, if `dynasty-archive.sqlite` ever became unreadable (unclean shutdown mid-write, disk full, filesystem hiccup), the app just quit silently — no error dialog, no explanation, no way back short of manually finding and deleting the file, and no backups existed anywhere to restore from (`backupDatabase()` had existed since Phase 1 but nothing ever called it). Fixed: `src/database/init.ts` now throws a distinguishable `DatabaseCorruptedError` when the on-disk file exists but can't be opened, and a new `initDatabaseWithRecovery()` in `main.ts` catches specifically that (any other startup failure — missing wasm binary, out of memory — still falls through to the original silent-quit handler unchanged, since there's nothing to "recover" there). On corruption: the unreadable file is quarantined (renamed into a `corrupted/` folder, never deleted — always recoverable by hand later) and a native dialog offers **Restore Backup** (if one exists) / **Start Fresh** / **Quit**, replacing the previous total silence. A backup checkpoint is now taken automatically after every successful startup (fresh, normal, or just-recovered), capped at the 10 most recent via a new `pruneOldBackups()`. **Real bug found only by actually testing the corrupted-open path, not by reading the code**: the first implementation wrapped only `new SQL.Database(buffer)` in the try/catch that produces `DatabaseCorruptedError`, but sql.js/SQLite doesn't validate the file format at construction time — a garbage buffer "opens" successfully and only throws once a real statement runs against it (the very next line, `db.run('PRAGMA foreign_keys = ON;')`, which was *outside* the try/catch). The raw, unwrapped SQLite error ("file is not a database") was silently escaping past the `instanceof DatabaseCorruptedError` check and falling through to the generic top-level handler — recovery looked correct by inspection but did nothing on a real corrupted file. Caught via a real diagnostic test (isolated temp `userData` dir via `app.setPath()`, never touching the real database) that imported a real save, manually corrupted the live file, and asserted on the actual outcome rather than trusting that the code "should" work. Fixed by moving both initial `db.run()` calls inside the same try/catch as the constructor. Re-verified after the fix: real imported dynasty data survived a full corrupt → quarantine → restore-from-backup cycle intact (`dynastyCountAfterRestore: 1`, matching pre-corruption state), and the Start Fresh branch independently verified to correctly produce an empty database (`dynastyCountAfterStartFresh: 0`) rather than accidentally restoring. `npm run typecheck`/`lint`/`build` all clean.
- **Phase I — Dev Mode token editor shipped**, closing out the last undone item in the lettered UI/UX track (only the packaging half of Phase J's testing remains, and that's already done too — see the "Packaging" entry below). New `DevTokenEditorMenu.tsx` (navbar, matching `PreferencesMenu`/`StadiumDatabaseMenu`'s existing panel convention) lets every Phase A design token — spacing, radius, shadow, typography, motion duration/easing — be edited live: each change calls the existing `applyDesignTokens()` immediately, so the whole app re-themes in real time, previewed directly in the panel through real Phase D components (`SurfaceCard`/`StatTile`), not a separate mockup. New `src/design/devTokenStorage.ts` persists the draft to `localStorage` (field-by-field validated merge against `DEFAULT_TOKENS`, same rigor as the existing `StadiumDataProvider` pattern) so edits survive a restart; `index.tsx` now applies the saved draft (if any) at boot instead of always the shipped defaults. Per the roadmap's own constraint, nothing here ever rewrites `defaultTokens.ts` on disk — a "Copy as TypeScript" button (clipboard, with a manual-select textarea fallback if the clipboard API fails) is the explicit export step for turning a live draft into a real permanent default. Verified end-to-end via a scripted diagnostic click test (not just code review): opened the panel, edited the radius-sm field, and confirmed the actual `--radius-sm` CSS custom property changed on `document.documentElement` (`0.125rem` → `2rem`) and was correctly persisted to `localStorage` — then cleared that test edit via the same diagnostic-hook mechanism before finishing, since it would otherwise have silently changed the real running app's corner radii. `npm run typecheck`/`lint`/`build` all clean.
- **Import flow folded into the Dashboard; app title corrected; a real file-dialog bug fixed.** User feedback: the empty-dashboard state showed two import buttons at once ("Import Dynasty" in the header + "Open Import Flow" in the empty-state card), both of which just navigated to a separate `/setup` page — redundant, and an unnecessary extra hop. Fixed by moving the entire import flow (native file picker → extraction progress → success/error banner) directly onto `Dashboard.tsx`; the `/setup` route and `DynastySetup.tsx` are now deleted entirely rather than left as dead code. Only one "Import Dynasty" button ever renders: centered in the empty state when there are zero dynasties, or back at the header's top-right position once at least one exists — never both. While importing, a compact row of extraction-step chips (reusing `EXTRACTION_STEPS`) shows live progress inline; on completion a dismissible success/error banner appears and the dynasty list refreshes in place. **Real bug found and fixed along the way**: the native file picker's default filter was `Dynasty Saves (*.DYNASTY)`, but real save files (e.g. `DYNASTY-DYNASTYBOWL`) carry no literal `.DYNASTY` extension — confirmed directly from the user's own saves folder listing — so that filter matched nothing and the files were invisible unless the user manually switched to "All Files". Initially "fixed" in `src/main/ipc/filesystem.ts` by reordering the filters so "All Files" was first — the user confirmed the dialog **still** defaulted to `*.DYNASTY`. Root cause of the reorder not working: Windows' native open dialog remembers the last-picked filter *by position* across app runs (independent of what's actually in that slot), so simply swapping two filters' order doesn't reliably change the default once a position has been "learned." Real fix: removed the second filter option entirely, leaving a single `All Files` filter with nothing else to default to. Also renamed the Sidebar's "Dashboard" nav label to "Dynasty" and removed the redundant "Import Dynasty" sidebar link (per the prior turn's decluttering, the Dashboard page already has its own import entry point). Separately, corrected the app's displayed name from "CFB Dynasty Hub" to "College Football 27 Dynasty Hub" and dropped the Navbar subline — updated everywhere it appears as plain user-facing text (Navbar, window/tab title in `public/index.html`, the Help menu's About dialog, and the HTML-export footer/header copy). **Deliberately did not** touch `package.json`'s `name` field, `electron-builder.js`'s `productName`/`appId`, or the `Launch CFB Dynasty Hub.bat` filename — those drive Electron's `userData` storage path and the pre-splash HTA's window-title matching respectively, and changing them carries the same real risk the original Tracker→Hub rename hit (silently orphaned user data, broken desktop shortcuts) for something the request didn't ask for; flagged here rather than guessed at. Verified via `npm run typecheck`/`lint`/`build` (all clean) plus a live screenshot confirming the new title, the single relocated import button, and the decluttered sidebar/header.
- **Sidebar + Dashboard decluttered.** Direct follow-up request: `Sidebar.tsx` dropped its "Navigate" section label and the "Import Dynasty" nav link (redundant with the Dashboard page's own "Import Dynasty" button — only the "Dashboard" link remains). `Dashboard.tsx` dropped the "Dashboard" eyebrow label, the three summary tiles (Dynasties/Active seasons/Teams tracked — `SummaryTile` component and `activeSeasonCount` removed as now-unused), and the subline under the heading; the heading itself changed from "Track every program from one sharp home base." to "Track every program from one place." Verified via a live screenshot (temporary diagnostic hook, removed after use) — confirmed the sidebar shows just "Dashboard" with no section label, and the dashboard header is down to the heading + Import Dynasty button + dynasty cards. `npm run typecheck`/`lint`/`build` all clean.
- **Phase 11 first slice — HTML export shipped.** Priority-list correction first: "Program history / records" was proposed as the next priority item, but turned out to already be comprehensively shipped (Phase 10 + 3 follow-ups, see below) — caught before duplicating work. Checked the rest of the list against real code state before picking a target; HTML export (Principle 6, "Public Storytelling") was confirmed genuinely unbuilt, so it's the real next slice. New `src/main/htmlExport.ts` (`buildHistoryExportHtml`) renders the same data already on the History page — school record book, dynasty resume, coaching ledger, season timeline, milestones — as one self-contained, dependency-free `.html` file (inline CSS, `prefers-color-scheme` dark mode, team-colored header gradient, no external assets). New `export:historyToHtml` IPC channel (`src/main/ipc/export.ts`) opens a native save dialog and writes the file; new `Exports.tsx` page/route/nav tab triggers it. `Sidebar.tsx`'s "Planned Modules" list (down to just `Exports`) is now empty, so that panel is hidden rather than shown empty. Deliberately out of scope for this slice (real Phase 11 features, not fabricated ones, per the roadmap's own bigger spec): roster/schedule/awards exports, multi-page zip archives, team logos/images in the export, and interactive charts — the Exports page copy says so directly. Verified against `Dynasty Save Test/DYNASTY-DYNASTYBOWL` via a temporary diagnostic branch in `main.ts` (removed after use): a real 19,089-byte export with correct real record holders (Claude Mathis, 4,694 career rushing yards, RB, 1997 — matching the exact figures already verified in the Phase 10 follow-up entry). `npm run typecheck`/`lint`/`build` all clean.
- **Two undocumented Codex changes backfilled into this log** — found while catching back up after the mid-session Claude outage. (1) **Roster skill-position badge removed**: the small indigo "Skill" badge next to a skill-position player's position (added in the earlier "coach alma mater + roster badges" pass) was removed from both the gallery-card and table-row views in `Roster.tsx`, per direct request. The captain "C" badge is untouched. (2) **Launcher now skips Electron's own splash window entirely**: `Launch CFB Dynasty Hub.bat` sets a new `USE_PRE_SPLASH_ONLY=1` env var; `main.ts` reads it (`USE_PRE_SPLASH_ONLY` const) and, when set, goes straight to `createWindow()` + `showWhenReady()` and signals the pre-splash HTA ready only once the *real* main window is shown, instead of building and showing Electron's own separate splash window first. Direct launches (`npx electron .`, diagnostics) don't set the flag, so they still get the original Electron-splash path — this only changes the `.bat` launcher's behavior. Neither change had a DevLog entry from the handoff session; verified both by reading the current file contents rather than trusting the chat transcript.
- **Standings conference-champion trophy confirmed leaguewide, not just the user's conference.** Mid-session handoff to Codex (Claude was briefly down) ended with Codex describing `extract-conference-championship.ts` as filtering to only the user's own team and offering to widen it next. On resuming, direct inspection plus a real diagnostic import against `Dynasty Save Test/DYNASTY-DYNASTYBOWL` showed this was already fixed in code — the extractor reads `LeagueHistoryConferenceChampion` unfiltered and returns every conference's real result (verified output included CUSA, Pac-12, MWC, ACC, Big 12, MAC, and more in one save), and `getStandings.ts`'s `normalizeConferenceChampionships` passes the full array straight through for any newly-persisted dynasty. So the Standings page's champion trophy already works for whichever conference is selected, not just the user's — no further extractor change was needed. One caveat carried over from the original implementation: dynasties imported *before* this array-shaped snapshot existed still have the old single-object shape on disk, so `normalizeConferenceChampionships`'s legacy-fallback branch only reconstructs the trophy for the user's own conference until that dynasty is re-imported.
- **Conference standings page shipped** — the longtime standings gap is now closed with a new `Standings.tsx` page in the dynasty tab bar plus a matching `getStandings.ts` query + IPC round-trip. No new extraction was needed: it reuses the already-resolved `TeamData.conferenceName` and the real conference/non-conference record splits already stored in the teams snapshot. The table defaults to the user's own conference, highlights the user's team, supports season switching, and uses an explicit editorial sort (conference record ? overall record ? current AP rank) instead of inventing hidden tiebreakers the save does not expose. Verified via `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`. See the dedicated entry below.
- **Latest (2026-07-16): Dashboard delete button** â€” a small trash-icon button now appears bottom-right on each dynasty card on the Dashboard when hovered (`opacity-0` â†’ `group-hover:opacity-100`, matching the existing `.group` card wrapper), letting a dynasty be deleted without opening it first. Reuses the exact confirm-then-delete flow already shipped on `DynastyOverview.tsx` (`window.confirm(...)` + `window.api.db.deleteDynasty(id)`), with `event.preventDefault()`/`event.stopPropagation()` added since the button sits inside the card's own `<Link>`. Verified via a scripted click test with `window.confirm` stubbed to auto-cancel: confirmed the dialog fires exactly once and the card's navigation is fully suppressed (`location.hash` unchanged after the click) â€” the actual-deletion path wasn't separately re-tested against real dynasty data since it's the identical, already-proven `deleteDynasty` call from `DynastyOverview.tsx`.
- **Phase 9 follow-up #2 â€” logo bug fixed (wrong field used), gold variant, persistent Lost section, sortable table columns** â€” see the dedicated entry below. The team-logo feature was showing a generic NCAA fallback because it used the save's raw `AssetName` field instead of the display name this app's logo lookup actually keys on; fixed, plus wired in the previously-unused `png_gold` 3D logo variant for the Signed section specifically. Also fixed a real UX regression from the prior follow-up: stage sections (especially Lost) were hidden entirely when empty, indistinguishable from "broken" â€” they now always render with a clear empty state. Rebuilt each stage's rows into real sortable tables (Nat #/Pos #/City/State/Class/Style as independent columns), matching this app's existing `Roster.tsx` table conventions.
- **Phase 9 follow-up â€” team logos + a real "Signed vs. Lost" correctness bug fixed** â€” see the dedicated follow-up entry below. Adding a requested team-logo feature required resolving each recruit's real signed team (`Team.CommittedPlayers`, verified leaguewide with zero cross-team collisions across 1,538 real signees), and that work exposed that the original Phase 9 board was misclassifying real Miami signees as "Lost" (signed count was undercounted by nearly half: 2 shown vs. the real 11). Root cause: the original signed/lost split used `committedWeekNumber`, a field that's only ever populated pre-signing, not `'Signed'`-stage status itself. Fixed and re-verified against the real save.
- **Phase 9 (Recruiting Pipeline) shipped** â€” see the dedicated Phase 9 entry below. New "Recruiting" tab reads the user's real 35-slot recruiting board (`Team.RecruitingBoard`), deriving Kanban-style stages (Signed/Committed/Offered/Watching/Lost â€” "Lost" being a real case the roadmap didn't anticipate: a recruit who signed with a *different* school) from the save's real fields rather than a single stored status. Found and fixed a real bug along the way: `ProspectStarRating` is a string enum (`"ONE_STAR"`..`"FIVE_STAR"`), not numeric â€” a plain `Number(...)` silently produced `null` for every recruit's star rating. Class comparison across years and decommit tracking were both explicitly not built â€” neither is derivable from a single save snapshot, and both are called out as real limitations in the DevLog entry rather than faked.
- **Launcher â€” instant pre-splash + real single-instance lock** â€” see the dedicated entry below. Direct fix for user-reported feedback that the launcher sat on a black screen for a long stretch before the splash appeared, then the splash barely flashed before the app loaded. Root cause: Electron can't paint anything until its own process finishes booting, so no splash-timing tweak alone could fix the pre-boot gap â€” added a genuinely separate instant pre-splash (`scripts/pre-splash.hta`, a Windows HTA) shown the moment the launcher starts, handed off seamlessly to the real Electron splash. Also added a real `app.requestSingleInstanceLock()`, directly addressing the user's stated worry about accidentally launching two instances. **Same-day follow-up:** the first shipped version rendered oversized (an HTA quirk â€” `WIDTH`/`HEIGHT` and `resizeTo` both failed to take effect) â€” fixed with an external Win32 `MoveWindow` call (`scripts/force-resize-pre-splash.ps1`), constrained to spshscr.png's real native size (868Ã—420, applied to both splashes). Also added an indeterminate loading bar + cycling status text to the pre-splash for "something is happening" feedback during the phase before Electron has any real progress to report.
- **Phase 7 (Rankings & Visualizations) shipped** â€” see the dedicated Phase 7 entry below. The save file only ever stores 3 fixed poll data points (no per-week history anywhere), so this app now builds a real trend by accumulating one ranking snapshot per import into a new `ranking_history` table; a new "Rankings" tab shows a hand-rolled SVG trajectory chart (AP/Coaches/CFP, colorblind-safe, hover tooltips, table fallback) plus season-high/average stats and a rank-vs-record summary. One low-risk item flagged for next session: the zero-history empty state was verified by code review only, not a live screenshot, after GUI verification became unresponsive late in the session (unrelated to this feature's code â€” see the entry's "Errors hit & fixes").
- **Awards page redesign + global Player Profile Modal shipped** â€” see the "Phase 8 follow-up" entry below. Fixed a real data bug (Jet Award/Paul Hornung Award labels were swapped), added a leaguewide All-American/Conference roster browser with conference filtering, and introduced a reusable `PlayerProfileModal` now used from both the Roster and Awards pages (with Prev/Next navigation on Roster that respects the current sort/filter/search state).
- **Phase H shipped** â€” coach alma mater (resolved as a plain TeamIndex, not a franchise reference) and captain/skill-position roster badges, plus a new Coaches page and Head Coach summary on Overview. See the dedicated Phase H entry below. This and the whole batch of schedule/stadium-database/UI work logged in `MASTER_ROADMAP_v2.md`'s Version History (v2.11â€“v2.19) postdates the rest of this Status section, which is stale in places (e.g. the "no venue/stadium names" gap noted below was resolved by the stadium-database work) â€” treat `MASTER_ROADMAP_v2.md`'s Version History as the more current source for what's shipped.
- **Older status, kept for history:** Phase 6 complete (core + Game Log/Box Score follow-up + Schedule enrichment follow-up) â€” career/season/per-game stats on `PlayerDetail.tsx`, clickable box scores from `Schedule.tsx`, and the schedule table now shows Rank (Top 25 highlighted), Game Type (Conference/Non-Conference/Bowl with real bowl names), Location (Home/Away/Neutral Site), and a correctly-labeled Broadcast column â€” see the dedicated Schedule Enrichment entry below for the full investigation (conference realignment, bowl/neutral-site detection, and the root cause of the "everything is National" broadcast pattern).
- **Phase 6 was unblocked on 2026-07-15** when the user provided a new save (`Dynasty Save Test/DYNASTY-DYNASTYBOWL`) with a full season simulated (944/944 leaguewide games played, Texas State 7-6).
- **Phase 7 (Rankings & Visualizations) and Phase 8 (Awards) remain unstarted.** The new save does give Phase 7 a genuine (if thin) unblock â€” `MediaPoll_CurrentRank`/`LastWeeksRank`/`StartOfSeasonRank` are now `102`/`114`/`86` (real movement, not identical placeholders) â€” but a full week-by-week trend chart still needs `season_snapshots` history, which nobody's built. Phase 8 hasn't been re-investigated against the new save yet.
- **Two independent next-step tracks, as of 2026-07-16:**
  1. **Data track:** Phase 6 (core + follow-up) now shipped, then paused by user choice to switch tracks. When resumed: decide whether to invest in Phase 7's 3-point rank trend (cheap, now-real data) before or after Phase 8 (Awards, not yet investigated).
  2. **UI/UX Overhaul Initiative (Phases Aâ€“K):** the active track, by user decision. **Phases A (tokens) and B (theme resolution)** shipped on my track; **Phases E (shell), F (page sweep), G (Preferences menu)** shipped in parallel by the user/another session â€” logged only in `MASTER_ROADMAP_v2.md` (v2.3â€“v2.10), not here, and built *on top of* my Phase B `ThemeProvider` (verified they integrate: typecheck/lint clean). The user reviewed that parallel work, chose to keep the premium "glass" visual direction, and asked for a redundancy cleanup â€” done in the **Phase D (partial) â€” Shared component consolidation** entry below. **Next up: Phase C (motion primitives) and the rest of Phase D (Table/Dropdown/Button primitives), then token-wiring the glass values.**
- **Premium 3D team logos + championship trophies shipped 2026-07-16** (see the dedicated entry below) â€” dark/light-adaptive 3D logos everywhere, and real conference/national-championship/bowl-win trophies + bowl-appearance badge on the Season Overview page, driven entirely by real save data (verified against Texas State's actual 2026 Alamo Bowl win and Ohio State's actual National Championship). **Note for future sessions:** the `public/assets/3d_logos/` subfolder casing is `PNG_OD` / `png_OL` (inconsistent case, confirmed via PowerShell exact-case listing â€” `ls`/`find` will lie about this on Windows since NTFS is case-insensitive). There's also an unwired third variant, `png_gold` (143 files, same team coverage) â€” not used anywhere, no instructions covered it; flagged for the user, not guessed at.
- **UI/UX work already shipped during the pause (2026-07-15):** team-color theming and the roster/schedule redesign â€” see the dedicated sections below. Not numbered roadmap phases at the time, but real shipped work that Phases Aâ€“K above now formally build on top of (in particular, `teamTheme.ts`'s contrast-safety algorithm is the direct basis for Phase B's theme resolution and Phase G's custom-theme guardrails).
- **Launch app:** double-click `Launch CFB Dynasty Hub.bat`, or `npm start` in a terminal
- **Verify changes:** `npm run typecheck && npm run lint && npm run build`
- **App renamed** 2026-07-14: "CFB Dynasty Tracker" â†’ "CFB Dynasty Hub" (`package.json` name, window title, Navbar, About dialog, electron-builder `productName`/`appId`, launcher `.bat`). This changes Electron's `userData` path (`%APPDATA%/cfb-dynasty-tracker/` â†’ `%APPDATA%/cfb-dynasty-hub/`) since it's derived from `package.json`'s `name`. The already-imported Texas State dynasty was copied over to the new folder so it wasn't lost. Historical phase entries below still say "Tracker" â€” that's accurate to what it was called at the time, left as-is.
- **Known gaps:**
  - ~~`npm run package` (electron-builder) has never been run...~~ **Resolved 2026-07-16** â€” see the "Packaging: first successful `npm run package`" entry below. Real bug was a config-filename typo (`electron-builder.config.js` vs. the `electron-builder.js` electron-builder actually looks for), not the node_modules-bundling risk this note anticipated â€” that part turned out fine.
  - sql.js's `sql-wasm.wasm` (~644 KB) is a fixed cost of the chosen DB engine; not something further code changes can shrink.
  - Extraction covers league/teams/coaches/roster/schedule/recruits/stats/gamelog (offense+defense skill-position career/season/per-game only). Awards extraction still deferred â€” Phase 8's job.
  - Stats coverage is deliberately partial: Kicking, O-Line, and KP-return-specialist stats are extracted-and-discarded (identified but not mapped â€” those tables' field names haven't been inspected). Team-wide stat leaderboards and team efficiency-over-time (not per-game â€” that's covered now) weren't built this pass. See Phase 6 entries for the full list and why.
  - Box score / "top performer" only covers the user's own roster â€” opponent players' full stats/bio/game-log are never extracted, so `GameDetail.tsx` explicitly labels its top-performer callout as scoped to the user's team, not a true whole-game MVP. **Portraits are the one exception** (2026-07-19): a lightweight leaguewide `playerId -> portrait` pass now exists (`extract-league-portraits.ts`), so opposing players can show a real photo in Awards/profile-fallback contexts even though their stats still can't.
  - Extracted data is stored as JSON snapshots (`season_snapshots`), not yet normalized into the `players`/`games`/`coaches` relational tables from the Phase 1 schema. Phase 6 will read the snapshots and populate those tables as it needs structured queries over the data.
  - ~~No historical ranking/record trend charts...~~ **Resolved 2026-07-16** â€” see the Phase 7 entry. The save itself never stores per-week poll history (confirmed directly), so this is built by a new `ranking_history` table that accumulates one snapshot per import rather than reading a time series out of the save. A dynasty imported only once still gets a real (if single-point) chart; it fills in as the user re-imports across a season.
  - No player-profile detail view (attribute breakdowns, career stats, awards) â€” deferred in Phase 4.
  - ~~No conference standings page. Conference *membership* is now solved (see Schedule Enrichment entry — `TeamData.conferenceName`, built by inverting `Conference.TeamSlots`) and used for schedule game-type classification, but a dedicated standings table (all teams in a conference, sorted by conference record) wasn't built — that's more work than the schedule needed and would need its own scoping pass.~~ **Resolved 2026-07-16** — see the `Phase 5 follow-up — Conference Standings` entry below.
  - "Rank" shown on the schedule is each opponent's *current* poll rank, not their rank at the time each game was/will be played â€” confirmed via direct investigation (see Schedule Enrichment entry) that no weekly poll history exists anywhere in the save, only current-state singleton tables. The UI states this limitation directly rather than mislabeling it.
  - No venue/stadium names on the schedule or box score â€” confirmed via direct investigation that the `Stadium` reference on both `SeasonGame` and `BowlGame` points to table IDs that don't exist anywhere among either save file's ~2,269 tables (base-game static content, not stored per-dynasty). Home/Away/Neutral Site is shown; a specific venue name never can be, in this data.

---

## Phase 0 â€” Foundation & Electron Setup

**Shipped:**
- Full project scaffold: Electron + React 18 + TypeScript (strict) + Tailwind, webpack build for main/preload/renderer as three separate configs in one `webpack.config.js`.
- IPC bridge (`src/shared/ipcChannels.ts`, `src/shared/types.ts`) â€” typed contract shared by main, preload, and renderer so the three can't drift out of sync.
- `src/main/ipc/filesystem.ts` â€” real implementation (native file dialog, default saves-dir lookup, `.DYNASTY` file scan). `database.ts` and `extraction.ts` were stubs by design (DB/extraction are Phases 1â€“2).
- `src/renderer/lib/assetMapping.ts` â€” NCAA logo mapping, generated programmatically from the actual files in `assets/icons/NCAA Logos/` (not hand-typed, to avoid transcription errors). 255 team keys + `_NCAA_logo.png` fallback. Logos copied to `public/assets/icons/ncaa-logos/` (renamed, no space, to avoid URL-encoding issues).
- Dashboard (empty state) + DynastySetup (real file browse/scan, stub import) pages, Navbar (dark mode toggle), Sidebar (nav + "coming soon" list).

**Errors hit & fixes:**
- **Blank white screen on `npm start`.** Root cause: webpack's default `devtool: 'eval'` in development mode wraps every module in `eval(...)`. The page's CSP (`script-src 'self'`, no `unsafe-eval`) blocked that eval, so the renderer bundle threw immediately and React never mounted â€” nothing in the console visible without a display. Diagnosed by temporarily forwarding `webContents.on('console-message', ...)` to the terminal (this sandbox has no real display, so that's the only way to see renderer errors from here). Fixed by setting `devtool: 'source-map'` instead of weakening the CSP.
- This sandbox sets `ELECTRON_RUN_AS_NODE=1` by default (blocks GUI launches). Verified real launches with `env -u ELECTRON_RUN_AS_NODE ... --dangerously-disable-sandbox`.

**Scope decisions:**
- Skipped `sql.js` / `madden-franchise` dependencies entirely in Phase 0 (per "skip DB/extraction" instruction) rather than installing-but-not-using them.
- Skipped `shadcn-ui` as an npm dependency â€” the published package is a defunct placeholder; real shadcn is copy-in component source, not a runtime dependency. Left clean Tailwind in place.

**Audit pass (requested separately, applied before Phase 1):**
- CSS was shipping via `style-loader` (JS-injected `<style>` tags), which forced `'unsafe-inline'` into the CSP. Switched to `MiniCssExtractPlugin` â†’ real cached `styles.css`, dropped `'unsafe-inline'` from `style-src`.
- Menu's About-dialog handler closed over one specific `BrowserWindow` â€” harmless with one window, but an implicit assumption. Menu is now built once at startup; About dialog resolves its parent via `BrowserWindow.getFocusedWindow()` at click-time.
- `scanForSaves` failed the *entire* scan if a single file vanished between `readdir` and `stat` (race condition). Now skips just that file.
- `DynastySetup.tsx`'s async handlers had no failure path â€” a rejected IPC call left `scanning` stuck `true` forever. Added try/catch/finally with user-facing error messages.
- Removed dead `.scrollbar-thin` CSS class (never referenced) and a hack where Dashboard faked a team named `'ncaa'` just to trigger the logo fallback (replaced with an explicit `FALLBACK_LOGO_PATH` export).

---

## Phase 1 â€” Local Data Storage & Enhanced Schema

**Shipped:**
- `src/database/schema.sql` â€” all 16 tables from the roadmap (dynasties, seasons, season_snapshots, players, player_seasons, player_game_stats, player_career_stats, games, coaches, coach_seasons, awards, championships, bowl_games, program_milestones, recruits, recruit_seasons), fully indexed.
- `src/database/migrations.ts` + `init.ts` â€” versioned migration runner (`schema_migrations` table tracks applied versions), sql.js WASM bootstrap, transactional migration application with rollback on failure, `persist()` after every write, `backupDatabase()` utility.
- `src/database/helpers.ts` â€” three generic query primitives (`run`/`get`/`all`) instead of repeating sql.js prepare/bind/step boilerplate per call, plus CRUD for **dynasties, seasons, and snapshots only**.
- `ipc/database.ts`'s `getDynasties` now reads real SQLite data instead of a hardcoded `[]`. `importDynasty` stays a stub â€” correctly Phase 2's job (needs the save-file extractor).
- `Launch CFB Dynasty Tracker.bat` â€” double-click dev launcher (auto `npm install` on first run, then `npm start`, pauses on error).

**Scope decision:** Did *not* write CRUD for players/coaches/awards/recruits/etc. even though the roadmap's Phase 1 lists them. Those tables belong to their own dedicated phases (4, 8, 9, 10) and would be untested dead code with zero callers today. The full schema exists now (DDL is cheap, retrofitting migrations onto real user data later is expensive); the matching DAL functions get added incrementally when each phase actually needs them.

**Errors hit & fixes (all found by actually launching the app and inspecting the resulting `.sqlite` file, not just typecheck):**
1. Webpack tried to bundle sql.js's `.wasm` file as a WebAssembly module â†’ externalized `sql.js` in `webpack.config.js`.
2. First externals attempt was a bare regex external with no module type â†’ emitted a broken global-variable reference (`ReferenceError: sql is not defined`) instead of `require("sql.js")`. Fixed with an explicit `{ 'sql.js': 'commonjs sql.js' }` mapping.
3. **The real one:** `require.resolve('sql.js/dist/sql-wasm.wasm')` â€” webpack does not route `require.resolve()` calls through custom externals handling, so it silently degraded to the bare string, which then resolved against `process.cwd()` instead of `node_modules`, throwing `ENOENT`. Fixed by computing the wasm path from the bundle's own real `__dirname` (`node: { __dirname: false }` in webpack config) instead of `require.resolve`.
4. Two TypeScript errors: `SqlValue` vs `unknown` in the generic `buildSetClause` helper, and `Buffer` vs `ArrayBuffer` for the wasm binary passed to `initSqlJs`.
5. Removed 3 `eslint-disable` comments for a rule (`@typescript-eslint/no-non-null-assertion`) that isn't even enabled in `.eslintrc.json` â€” dead noise.
6. Caught one bug transcribing the roadmap's own schema: `idx_games_season_week` was specified on `seasons(id, week)`, but `seasons` has no `week` column. Corrected to `games(season_id, week)`.

**Verification:** launched the real (unsandboxed) Electron process, confirmed zero startup errors, then opened the actual generated `dynasty-archive.sqlite` with a separate script and read `sqlite_master` directly â€” all 16 tables plus `schema_migrations` (version 1, `initial_schema`) confirmed present.

**Filesize:** `main.js` grew 17.9 KB â†’ 44 KB (schema + DAL + migrations, main process only). `renderer.js` unchanged at 1.49 MB (still just React/ReactDOM) â€” the DB layer never touches the renderer bundle. sql.js's `sql-wasm.wasm` (~644 KB) ships as-is from `node_modules`, never bundled.

---

## Phase 2 â€” Save File Discovery & Enhanced Import UI

**Shipped:**
- `src/extractors/` â€” real extraction pipeline against `madden-franchise` (confirmed "College Football 27 âœ… Full" support): `extract-league`, `extract-teams`, `extract-coaches`, `extract-schedule`, `extract-recruits`, orchestrated by `extract-all.ts`. Each emits `start`/`done` progress per step.
- `src/extractors/lib/franchise.ts` â€” thin wrapper around the library's dynamically-proxied records (no useful static types exist for them). Key helper: `getLargestTable(name)` â€” several table names are fragmented across many small placeholder instances plus one real data table (e.g. 9 tables named `Team`, capacities `1Ã—7 + 6 + 143` â€” only 143 is real); the real one is always the largest.
- `src/database/importExtraction.ts` â€” `persistExtraction()` converts an extraction into `dynasties`/`seasons` rows + `season_snapshots` JSON blobs (league/teams/coaches/schedule/recruits). Re-importing the same `save_path` reuses the existing dynasty (refresh, not error) â€” the common case is a user re-importing weekly to pull the latest week, not creating a new dynasty.
- `db:importDynasty` and `extract:all` IPC handlers are real now (were Phase 0/1 stubs). Progress streams to the renderer via a new `extract:progress` event (`preload.ts` exposes `extraction.onProgress()`).
- `DynastySetup.tsx` shows a live per-step checklist during import and a link to the Dashboard on success.

**Scope decision:** Extraction covers league, teams, coaches, schedule, recruits â€” not stats or awards. Player game/season stats is a huge dataset (16,500 players Ã— many stat categories) with no consumer yet (Phase 6 owns it); awards needed more schema investigation than was worth doing blind. Both are additive later â€” nothing here needs to change to support them.

Also deliberately did **not** populate the normalized `players`/`games`/`coaches` tables from Phase 1's schema. Data is stored as JSON snapshots per the roadmap's own architecture ("store JSON snapshots... version the extraction schema"). Normalizing into relational rows is deferred to the phases that actually query them structurally (Roster Management, Schedule & Results, Statistics Engine) â€” building that now would be guessing at access patterns those phases haven't defined yet.

**Errors hit & fixes (all found by actually running extraction against the user's real test save, not synthetic data):**
1. `madden-franchise` resolves its own schema/data files (`data/schemas/27/C27_468_2.gz`) using a self-referential `__filename`/`__dirname` baked in at its own build time (rollup-style `url.fileURLToPath(...)` pattern). Bundling it would rewrite that location to `dist/main` and break the lookup â€” the exact same class of bug as the sql.js wasm path issue in Phase 1. Externalized it in `webpack.config.js` before writing a single extractor, based on directly reading the compiled library code rather than guessing.
2. `getReferencedRecord()` (used to resolve fields like a game's `HomeTeam`) looks up `targetTable.records[rowNumber]` internally â€” the **target** table's records must already be loaded via `readRecords()` before resolution works, or it silently returns `undefined`. Not documented; found by reading the library's own source after a resolution attempt failed silently.
3. Several table names are fragmented (see `getLargestTable` above) â€” naively calling `getTableByName('Team')` returns one of the near-empty placeholder instances, not the real 143-row table. Found by comparing capacities across `getAllTablesByName('Team')`.

**Verification:** ran the real extraction + persist pipeline against the user's actual test save (`Dynasty Save Test/DYNASTY-TESTER`, 9.6 MB, real FBCHUNKS/zlib CFB 27 format) via a temporary diagnostic hook in `main.ts` (removed after testing), not synthetic data. Confirmed via direct SQLite inspection: 1 dynasty (Texas State, correctly identified via the user-controlled head coach rather than a hardcoded team), 1 season (2026), 5 snapshots (teams 25.8 KB, coaches 65 KB, schedule 141 KB, recruits 542 KB) containing real team names, real schedule matchups (e.g. Oregon State vs. Georgia State), and real recruit names/positions/star ratings. Re-ran the same import a second time and confirmed the upsert path â€” dynasty/season/snapshot counts stayed at 1/1/5, no duplicates.

**Filesize:** `main.js` unchanged in kind (extractors are all main-process-only, madden-franchise stays external â€” confirmed `require("madden-franchise")` in the bundle, 60 KB total). `renderer.js` unaffected â€” extraction never touches the renderer bundle, only IPC messages cross that boundary.

---

## Phase 3 â€” Dashboard & Season Overview

**Shipped:**
- Extended `extract-teams.ts` with fields Phase 2 didn't pull: `MediaPoll_CurrentRank`, `CoachesPoll_CurrentRank`, `CFPPoll_CurrentRank`, `TopClassRank` (recruiting), `TeamPrestige`. Field names were already known from Phase 2's exploration of the `Team` table's 300+ fields â€” no new reverse-engineering needed.
- `src/database/getSeasonOverview.ts` â€” new aggregation layer. Reads the `teams` and `schedule` snapshots for a dynasty's current season, finds the user's team by `teamId`, and assembles a purpose-built `SeasonOverview` DTO (record, conference record, three poll rankings, recruiting class rank, prestige, last 3 played games, next 3 scheduled games) â€” keeping the "snapshots are the interchange format" pattern from Phase 2 rather than normalizing into relational tables prematurely.
- `db:getSeasonOverview` and `db:deleteDynasty` IPC channels (the latter just wires the `deleteDynasty` DAL function that's existed since Phase 1 but had no caller yet).
- `DynastyOverview.tsx` â€” new per-dynasty page at `/dynasty/:id`: hero record figure, stat tiles (conference record, three polls, recruiting class, prestige), recent/upcoming game lists with W/L badges, delete action (with a confirm prompt â€” deleting cascades to seasons/snapshots and can't be undone). Dashboard's dynasty card now links here instead of being static.
- Loaded the `dataviz` skill before building the stat tiles: followed its stat-tile contract (sentence-case label, semibold proportional-figure value), used `text-green-600`/`text-red-600` paired *with* the "W"/"L" text label rather than color alone (the skill's status-color rule), and skipped building an actual chart â€” a single-snapshot 0-0 preseason record has nothing worth charting yet.

**Scope decision:** No ranking-history or record-by-week trend charts. The roadmap's Phase 3 feature list mentions them, but they need week-by-week data points and `season_snapshots` currently overwrites in place on every import (no history retained) â€” see the new Known Gap. The roadmap itself gives trend charting its own dedicated phase (7 â€” Rankings & Visualizations), which is the more honest owner for that work once snapshot history exists to chart. Building it now would mean charting a single data point.

Also didn't duplicate the new stat tiles onto the Dashboard cards themselves â€” `DynastySummary` (the dashboard list type) stays lightweight; the card links through to the detail page for anything beyond team/season. Avoids either bloating the summary IPC payload or N+1-calling `getSeasonOverview` per card.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the same temporary-diagnostic-hook technique used in Phases 1â€“2 (added to `main.ts`, removed after): re-imported the user's actual test save (refreshing the snapshot with the new ranking fields, since the dynasty already sitting in the DB predated them) and called `getSeasonOverview` directly. Confirmed real output: Texas State, 0-0 record (correct â€” preseason), Media poll #86, Coaches poll #73, CFP unranked, recruiting class unranked, prestige 2, and three real upcoming opponents (Wisconsin, Washington St., Louisiana) with correct home/away.

---

## Phase 4 â€” Roster Management

**Shipped:**
- `src/extractors/extract-roster.ts` â€” new extractor, filters the 16,500-row league-wide `Player` table down to one team (~85 players) *at extraction time* rather than storing all 16,500 and filtering later â€” keeps the roster snapshot proportional instead of 190x oversized.
- `extract-all.ts` reordered: `roster` now runs right after `coaches`, since it needs `userTeamIndex` (only known once coaches identifies the user-controlled team) to filter the Player table.
- `DynastyOverview.tsx` gets a "View Roster" link; new `Roster.tsx` page at `/dynasty/:id/roster` â€” sortable columns (name/position/class/rating), position/class filters, name search, a class-distribution summary (e.g. "22 Freshman, 20 Sophomore..."), all client-side over the ~85-row roster (no pagination needed at that size).
- `getRoster(dynastyId, seasonId?)` â€” season-scoped by design, not just "current season". Each imported year already gets its own `seasons` row (established in Phase 1/2), so browsing a past season's roster was already supported by the existing schema â€” this just exposes it. The season selector in `Roster.tsx` only renders when a dynasty has more than one imported season.
- Loaded the `dataviz` skill again before touching the stat/table UI (same as Phase 3); a dense sortable table is exactly the kind of proportional-figures / `tabular-nums`-for-columns case its `marks-and-anatomy.md` covers â€” used `proportional-nums` for the OVR figures but kept table alignment default.

**Errors hit & fixes (found by direct experimentation against the real save before writing extraction code, not by guessing field semantics):**
1. `Weight` is not raw pounds. Extracted values (21, 40, 168, 214...) are nonsensical as body weight until you add a **+160 offset** â€” then they land exactly where you'd expect per position (LT â†’ 328 lbs, TE â†’ 246 lbs, Safety â†’ 209 lbs). No documented formula for this; derived empirically by testing the offset against realistic position-weight expectations across 8 real players before committing to it in `extract-roster.ts` (documented inline with the reasoning, since it's a reverse-engineered constant, not ground truth).
2. `Age` looked plausible as a field name but the real data was mostly `0` with a `51` outlier for a college player â€” unreliable, dropped it. It also isn't in the Phase 1 schema, so nothing was lost.
3. `PlayerType` (the archetype field) comes back as `"HB_ElusiveBack"` style strings â€” stripped the leading position-code prefix and split camelCase for display (`"Elusive Back"`). Not perfect for every archetype (`"CB_MantoMan"` â†’ `"Manto Man"`, not `"Man to Man"`) since it's a generic regex heuristic, not a lookup table for ~50+ archetype names â€” acceptable, not worth hand-mapping every value.

**Scope decision:** No player-profile detail view (the roadmap's `PlayerCard`/`RatingBreakdown` components â€” individual attribute charts, career stats, awards won). The roster table's columns already surface position/class/rating/archetype/dev trait, which is what's actually extractable right now; career stats and awards are still unextracted (Phase 2's deferral) so a profile page would have empty sections for exactly the parts meant to make it worth a separate page. Revisit once Phases 6/8 add that data.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the same diagnostic-hook technique: re-imported the user's actual test save and queried `getRoster` directly. Confirmed 85 real players (correct NCAA roster size), realistic per-position weights after the +160 fix (WR ~175-177 lbs, QB 197 lbs, LT 374 lbs), and correctly formatted archetypes ("Shifty Route Runner", "Pure Scrambler", "Agile").

---

## Phase 5 â€” Schedule & Results

**Shipped:**
- Extended `extract-schedule.ts` with `DayOfWeek`, `BroadcastNetwork`, `TimeOfDay` (kickoff, minutes-since-midnight â€” verified real/populated against the actual save before using it, unlike `GameDateMonth`/`GameDateDay` which come back `0` for a preseason save and were left unused rather than displaying a fake date).
- `src/database/getSchedule.ts` â€” new aggregation: full week-by-week game list for the user's team (home/away, opponent, kickoff time formatted from raw minutes, network, result), record, conference record, **current win/loss streak** (computed by walking played games newest-first and counting until the result changes), and bowl eligibility (6-win FBS threshold).
- `Schedule.tsx` at `/dynasty/:id/schedule` â€” stat tiles (record/conference/streak/bowl status) + full season table, W/L color-coded rows (green/red background, but always paired with the "W"/"L" text + score, not color alone â€” same status-color rule as Phases 3/4). Linked from `DynastyOverview.tsx` alongside the existing roster link. Season selector reused from `Roster.tsx`'s pattern.
- Each schedule row shows the opponent's **current** poll rank as context, explicitly not claimed to be their rank at the time of the game (see Known Gap â€” no historical snapshots to know that).

**Scope decision:** No conference standings (`ConferenceStandings` component from the roadmap). Investigated whether `Team` records carry a conference-membership field â€” they don't; conference rosters live only in the `Conference` table's `TeamSlots`, an array-of-references structure, the same class of resolution that Phase 2's schedule work already had to handle carefully (`getReferencedRecord` needing the target table pre-loaded, fragmented table instances, etc.). Rather than bundle a second nontrivial reference-resolution investigation into schedule work, deferring it as its own scoped task.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the same diagnostic-hook technique: re-imported the user's actual test save and queried `getSchedule` directly. Confirmed the full real 12-game regular-season schedule (Wisconsin, Washington St., Louisiana, Oregon State, Boise State, an unassigned "FCS West" placeholder game, Charlotte, Fresno State, Utah State, UConn, San Diego St., Colorado State), correct home/away, real kickoff times formatted correctly (e.g. `1320` â†’ `10:00 PM`), real broadcast networks, and record/streak/bowl-eligibility all correctly reflecting the 0-0 preseason state.

---

## Phase 6 â€” Statistics Engine (core scope)

Unblocked 2026-07-15 when the user provided `Dynasty Save Test/DYNASTY-DYNASTYBOWL`, a save with a full season simulated (944/944 games leaguewide, Texas State 7-6) â€” the original test save had zero games played anywhere, which is what paused this phase after Phase 5.

**Shipped:**
- `src/extractors/extract-stats.ts` â€” new extractor. For each roster player, resolves `Player.CareerStats` (direct reference) and `Player.SeasonStats` (an 18-slot history array â€” see below) to position-appropriate stat tables, routing by the *resolved table's own name* rather than guessing from position, and maps career + season lines into `PlayerStatsData`.
- `lib/franchise.ts` gained two reusable helpers for this: `preloadAllInstances()` (loads every same-named table instance, not just the largest â€” needed because a reference is resolved by table ID, and the ID-matching instance isn't guaranteed to be the largest one) and `resolveReferenceWithTable()` (resolves a reference field to both its target record *and* the table it landed in, since `CareerStats`/`SeasonStats` can point to four different tables depending on position).
- Wired into `extract-all.ts` (new `stats` step), `EXTRACTION_STEPS`, `persistExtraction()` (new `stats` snapshot), a new `getPlayerStats.ts` DAL function (same season-scoped snapshot pattern as `getRoster.ts`), IPC channel + handler + preload binding, and `shared/types.ts` (`PlayerStats`, `OffensiveStatLine`, `DefensiveStatLine`).
- `PlayerDetail.tsx`'s "Career stats" and "Season stats" sections now render real stat-tile grids (Games, Comp/Att, Pass Yds/TD/INT, Rush Att/Yds/TD, Rec/Yds/TD for offense; Games, Tackles, Assists, TFL, Sacks, INT, INT Yds, Forced/Recovered Fumbles, Pass Def. for defense) instead of the placeholder empty state, falling back to the same honest empty state for players with no resolvable stat line (bench players who never appeared in a game).

**Scope decisions (deliberately out of this pass):**
- **Kicking, O-Line, and KP-return-specialist stats** â€” `CareerKickingStats`/`CareerOLineStats`/`CareerOffensiveKPReturnStats` all confirmed to exist as real, populated tables (discovered via the same table-name routing this extractor already does), but their field names weren't inspected and no UI was built for them. O-Line and Kicking aren't conventional "box score" stat categories the way passing/rushing/receiving/defense are; return-specialist stats are a smaller, separate concern. Players routing to these tables are simply excluded from `PlayerStatsData` this pass (42 of 85 roster players got a stat line â€” the other 43 are either bench players with no `CareerStats` reference set at all, or these three excluded categories; verified the exact breakdown against the real save, not assumed).
- **Per-game logs** â€” `Player.GameStats` (an array table, capacity 8875) is identified but not extracted. Resolving it for every player Ã— every game would be substantially more reference-chasing than season/career stats; `PlayerDetail.tsx`'s "Game log" section keeps its original honest empty state.
- **Team-wide stat leaders / leaderboards and team efficiency stats** â€” roadmap-listed Phase 6 features, not built. Straightforward to add on top of `extract-stats.ts`'s existing per-player output once prioritized; deferred to keep this pass focused on the PlayerDetail gap that's been sitting empty since Phase 4.
- **`SeasonStats`'s 18-slot array, slot semantics** â€” only slot 0 (`SeasonStats0`) is read. Confirmed to exactly match career totals on this single-season save (proof the resolution path is correct), but which slot holds "the current season" once a dynasty has multiple completed seasons is unverified â€” there's only ever been one season's worth of data available to test against. Revisit when a save with 2+ completed seasons exists.

**Errors hit & fixes (found via the diagnostic-hook + real-save verification, not assumed):**
1. **Season stats resolved to `null` for every player on the first pass.** Root cause: the array table's real name is literally `SeasonStats[]` (brackets included), not `SeasonStats` â€” `preloadAllInstances(franchise, 'SeasonStats')` matched zero tables, so the real table's records were never loaded, and `resolveReferenceWithTable` silently returned `undefined` at the first hop for every player. Found by writing a standalone scratch script that dumped the actual table name mid-resolution rather than assuming the descriptive name from earlier investigation notes was the literal one. Fixed by preloading `'SeasonStats[]'` instead.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`: confirmed 42/85 roster players got a resolved stat line, cross-checked that exact count against a standalone position-by-position breakdown (sum of players whose `CareerStats` resolves to `CareerOffensiveStats`/`CareerDefensiveStats` â€” matched exactly, 42). Verified real values for the roster's best QB (Brad Jackson, Texas State): 433 att / 267 comp / 3,165 yds / 24 TD / 8 INT passing, 154 att / 576 yds / 9 TD rushing, 13/13 games played/started â€” season and career identical, correct for a one-season dynasty. Verified a real defensive line (walk-on CB, mostly zeros with `gamesPlayed: 1`) renders correctly as genuinely-zero rather than missing. Confirmed the bench-player exclusion is legitimate (no `CareerStats` reference set at all â€” `{tableId: 0, rowNumber: 0}`), not a bug swallowing real data.

---

## UI/UX â€” Roster Sortable Columns

Small follow-up requested directly: clicking a column header (No./Name/Pos./Ht./Wt./Yr./OVR/Hometown) in `Roster.tsx`'s table sorts by that column, toggling direction on repeat clicks â€” previously sorting only worked through a separate dropdown + arrow-button pair, and OVR wasn't sortable at all.

**Shipped:**
- `SortableHeader` component wraps each `<th>` in a button with a direction indicator (â†‘/â†“ next to the active column's label).
- `handleSort(key)`: clicking the already-active column toggles asc/desc; clicking a different column switches to it at a **per-column default direction** (`DEFAULT_SORT_DIR`) â€” magnitude columns (OVR, weight, height) default to highest-first ("top to bottom" as requested for OVR specifically), text/identity columns (name, position, class, hometown, jersey) default to first-alphabetically/lowest-first. The existing dropdown and arrow-toggle button now call the same `handleSort`, so both control paths stay in sync with header clicks.
- Added `'overall'` as a real `SortKey` â€” OVR had no sort option anywhere before this (dropdown or header), not just missing from headers.

**Verification:** typecheck/lint/build clean. No visual check possible in this sandbox (no display) â€” logic verified by reading the sort/toggle code path, not by clicking it.

---

## Phase 6 â€” Game Log, Box Score & Best Game (follow-up)

Requested directly as a follow-up once Phase 6's core scope shipped: fill in `PlayerDetail.tsx`'s remaining Game Log and Best Game empty states, and make the Schedule page's games clickable through to a full box score (game stats, team comparison, "player of the game" if available).

**Investigated first** (real save, before writing extraction code, per this project's standing discipline):
- `Player.GameStats` resolves to an array table named `GameStats[]` (23 slots â€” not a fixed/meaningful count, so slots are enumerated dynamically at runtime rather than hardcoded like `SeasonStats`'s 18) whose populated slots resolve to `GameOffensiveStats`/`GameDefensiveStats` records â€” same category-routing pattern as Phase 6 core, plus each per-game record carries a `SeasonGame` back-reference (row number) and a `GAMERATING` field (the game's own computed per-game performance score, 0-99ish).
- `SeasonGame` itself carries `HomeTeamStatCache`/`AwayTeamStatCache` references that resolve to a real, fully-populated per-game team box score (`TeamStats` table: total/pass/rush yards, first downs, 3rd/4th down conversions, turnovers, sacks, penalties, time of possession, punting) â€” no extra extraction needed beyond what schedule already touches.
- `HomePlayerStatCache`/`AwayPlayerStatCache`/`ScoringSummaries`/`BowlGame` on `SeasonGame` are all **unset** on every real played game checked â€” no pre-built roster-wide box score shortcut, and no stored "Player of the Game" field anywhere in the save. Confirmed by inspection, not assumed.
- `SeasonGame` is fragmented (5 table instances, real data in the largest) â€” verified that the `SeasonGame` reference resolved from a `GameOffensiveStats` record's row number lands in that same largest instance (`resolvedTable === gameTable`, checked by object identity), so using that row index as a stable `gameId` is safe.

**Shipped:**
- `src/extractors/extract-gamelog.ts` â€” new extractor, mirrors Phase 6 core's category-routing pattern but per-game: for each roster player, enumerates all populated `GameStats` slots, maps to `PlayerGameLogEntry[]` (`playerId`, `gameId`, `category`, per-game stat line incl. `gameRating`/`started`).
- `lib/franchise.ts`: added `fields` to the `FranchiseRecord` interface so array-row slot keys can be enumerated dynamically (`Object.keys(record.fields)`) instead of assuming a fixed slot count.
- `extract-schedule.ts` extended: `GameData` gains a stable `gameId` (row index in the real `SeasonGame` table â€” assigned via `gameTable.records.forEach` with the *original* index, since the earlier `nonEmpty().filter()` pattern would have reindexed and broken the gameIdâ†”gamelog link), quarter-by-quarter scores, and `homeTeamStats`/`awayTeamStats: TeamStatLine | null` (resolved from the stat-cache references, null pre-game).
- New `getGameLog.ts` DB function (same raw-snapshot-exposure pattern as `getRoster`/`getPlayerStats` â€” no bespoke joined DTO; pages compose it client-side against roster/schedule they already fetch, matching `PlayerDetail.tsx`'s existing pattern).
- `PlayerDetail.tsx`: **Game Log** section is a real per-game table (week, opponent, stat-line summary, rating) sorted by week. **Best Game** section shows a full stat-tile grid for whichever game has the highest `GAMERATING` â€” reusing the game's own rating rather than inventing a "best game" heuristic.
- `Schedule.tsx`: every game row is now clickable (played or upcoming) â†’ new `GameDetail.tsx` page at `/dynasty/:id/schedule/:gameId`. Shows quarter-by-quarter score, side-by-side team stat comparison, an offense/defense box score table for the user's roster (sorted by rating), and a "top performer" callout â€” explicitly labeled as scoped to the user's own roster, **not** a real Player-of-the-Game across both teams, since opponent players aren't extracted anywhere in this app. Upcoming games show an honest "hasn't been played yet" state instead of a broken/empty box score.

**Scope decisions:**
- "Player of the Game" doesn't exist as a stored field in the save (confirmed above) â€” computed instead from the real per-game `GAMERATING` field, and honestly labeled as your-roster-only rather than presented as a true whole-game MVP the game itself decided.
- Box score individual player lines only cover the user's own roster, same as every other player-level feature in this app (Roster, PlayerDetail, Phase 6 stats) â€” extracting opponent rosters league-wide was never in scope and isn't started by this either.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`: 470 total gamelog entries across the roster; Brad Jackson (QB) has exactly 13 game entries (matches games played), and his per-game pass yards **sum to exactly 3,165** â€” matching his season total from the Phase 6 core entry exactly, cross-validating both extraction paths independently arrived at the same real number. Verified `gameId` correctly links a `GameOffensiveStats` record back to the real `SeasonGame` row (object-identity check, not just matching numbers). Verified quarter scores sum to the final score for a real game (7+3+7+3=20, matching `teamScore: 20`). Verified `POSSESSIONTIME`'s unit assumption (seconds) by summing both teams' possession time for one real game and getting exactly 3600 (60:00) â€” confirmed, not just plausible.

---

## Phase 6 â€” Schedule Enrichment (follow-up)

Requested directly: add Game Type (Conference/Non-Conference/Bowl with bowl name), separate the Rank into its own column with Top-25 highlighting, investigate whether game-time (not just current) rankings are available, add a Location column (especially neutral-site detection), and â€” explicitly â€” investigate the root cause of a suspicious network pattern (`DYNASTY-TESTER` showed ~6 "National" games, `DYNASTY-DYNASTYBOWL` showed nearly all of them "National") rather than patching the symptom. Investigated thoroughly against both real save files before writing any code, per this project's standing discipline and the user's explicit instruction to do so.

**Investigation findings (required deliverable, per the request):**
- **Ranking source:** `ScheduleGame.opponentCurrentRank` already came from `Team.MediaPoll_CurrentRank` (Phase 3) â€” the *current* media poll rank, unchanged by this work. Checked for a game-time/pregame rank stored directly on `SeasonGame` (none) and for any weekly poll history table â€” found `TeamRanking_UpdateTeamRankings`, `PollsWeeklyStartEvent`, `FranchiseServer_PollsFlow`, all **capacity-1 singleton tables** (current-state game-logic tables, not time-series storage). Conclusion: no historical/game-time ranking exists anywhere in either save file. Not faked; the UI states this directly instead.
- **Conference vs. non-conference:** `Team` records carry no direct conference field (confirmed again). Built by inverting `Conference.TeamSlots` (an array-of-references, same resolution pattern as `Player.SeasonStats`) into a `teamIndex â†’ conferenceName` map in `extract-teams.ts`, then comparing both teams' conference in `getSchedule.ts`. Verified against real data: Texas State's dynasty-universe conference realignment actually placed it in a rebuilt "Pac-12" with Boise State/Colorado State/Fresno State/Oregon State/San Diego St./Utah State/Washington St. â€” all 7 of those games classified `conference`, matching the real `Conference.TeamSlots` membership exactly (checked by an independent script, not inferred from the classification output itself).
- **Bowl names:** `SeasonGame.BowlGame` resolves to a real `BowlGame` table with a `Name` field (e.g. Texas State's actual 2026 bowl game resolved to `"Alamo Bowl"`, confirmed in `DYNASTY-DYNASTYBOWL`). `SeasonGame.SeasonWeekType` (`RegularSeason` / `BowlSeason1-3` / `NationalChampionship`) gives a clean, reliable bowl/playoff signal independent of team names or rankings, exactly as instructed.
- **Neutral sites:** No single flag covers every case â€” combined three real, independently-verified signals: (1) any bowl/playoff game (always neutral), (2) `SeasonGame.IsKickoffGame` (verified against real season-opening matchups â€” Clemson-Georgia, LSU-Iowa, Texas A&M-Louisville, SMU-Notre Dame â€” all real neutral-site "kickoff classic"-style games), (3) the `ScheduleNeutralStadium` table, a separate list of recurring neutral rivalries (Army-Navy, etc.) that do **not** overlap with the kickoff-game set (checked directly â€” zero overlap), confirming both signals are needed. **Venue name is not available**: the `Stadium` reference on both `SeasonGame` and `BowlGame` resolves to table IDs (e.g. 16434, 16437) that don't exist anywhere among either save file's ~2,269 real tables â€” confirmed by scanning the full table list directly, not by a failed lookup alone. This is base-game static content, not stored per-dynasty; only Home/Away/Neutral Site can ever be shown.
- **The "Network" field:** `SeasonGame.BroadcastNetwork` â€” checked its full leaguewide value distribution directly (bypassing all extraction code) in both files. It contains **exactly three values in both save files, never a real channel name**: `Streaming` / `National` / `TBD`. This is a broadcast-scope/tier classification, not network data â€” renamed throughout the pipeline (`GameData.broadcastScope`, `ScheduleGame.broadcastScope`, UI column "Broadcast") rather than continuing to call it "Network," per the explicit instruction not to label it that unless it's genuinely network data.
- **Root cause of the "everything is National" pattern:** **Not a bug.** Verified by reading the raw field directly, independent of any extractor code, across the *entire* leaguewide game table (not just the user's team) in both files: `DYNASTY-TESTER` (0 of 934 games played) is 540 Streaming / 351 National / 43 TBD; `DYNASTY-DYNASTYBOWL` (944 of 944 played) is 237 Streaming / 707 National / 0 TBD. The shift is 100%-correlated with played/unplayed status in each file (every game in `DYNASTY-TESTER` is unplayed, every game in `DYNASTY-DYNASTYBOWL` is played) â€” this is the save's own preseason-projected broadcast assignment vs. its post-simulation actual assignment, and the actual assignment genuinely skews heavily toward "National" once a season is simulated. Texas State's own 13-game `DYNASTY-DYNASTYBOWL` schedule specifically is 12 National / 1 Streaming, which is what the user was seeing and reporting â€” a real, faithfully-read property of the save data, not a parsing/indexing/enum-mapping defect. No enum offset, wrong field, or fallback-to-National bug was found anywhere in the extraction pipeline.

**Shipped:**
- `extract-teams.ts`: `TeamData.conferenceName: string | null`, built by `buildConferenceMap()` (new, inverts `Conference.TeamSlots`).
- `extract-schedule.ts`: `GameData` gains `isBowlGame`, `isNationalChampionship`, `bowlName`, `isNeutralSite`; `broadcastNetwork` renamed to `broadcastScope` (same raw value, honest name). New `buildNeutralSitePairs()` helper resolves the `ScheduleNeutralStadium` table. `FIELDS` extended with `SeasonWeekType`, `BowlGame`, `IsKickoffGame`.
- `getSchedule.ts`: new `classifyGameType()` (conference/non-conference/bowl, using the teams snapshot's `conferenceName` â€” centralized here, not duplicated per-component per the acceptance criteria). `ScheduleGame` gains `gameType`, `bowlName`, `isNationalChampionship`, `siteType` (`'home' | 'away' | 'neutral'`).
- `Schedule.tsx`: table restructured to `Wk / Date / Rank / Opponent / Type / Location / Kickoff / Broadcast / Result` â€” Rank and ranking text fully removed from the Opponent cell into its own column. `RankBadge` gives Top 25 a distinct amber pill (not a team-color accent â€” deliberately theme-independent so it stays legible across every team's colors and both light/dark mode, per the requirement); unranked shows a clean "NR". `LocationCell` gives neutral-site games a distinct indigo pill. A footnote states the rank/broadcast data limitations directly in the UI, not just in code comments.
- New `src/renderer/lib/scheduleFormat.ts` â€” `gameTypeLabel()`/`locationLabel()` extracted here specifically so `GameDetail.tsx` (the box score page) could reuse the identical classification/label logic instead of a second copy, per the "centralized, not duplicated" requirement. `GameDetail.tsx`'s header now also shows game type, location, and a Top 25 badge for the opponent.

**Scope decisions:**
- No venue/city/stadium name anywhere (schedule or box score) â€” confirmed unavailable in the save (see investigation above), not a corner deliberately cut.
- No dedicated conference-standings page â€” only game-level conference/non-conference classification was needed for this pass; a full standings table (every team in a conference, ranked by conference record) is separate scope, now easier future work since `conferenceName` exists.
- `broadcastScope` still only ever shows `Streaming`/`National`/`TBD` â€” this is a complete, honest rename of what the data actually contains, not a partial fix; there is no real channel-name data to add.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against **both** `DYNASTY-TESTER` and `DYNASTY-DYNASTYBOWL`, per the requirement not to claim this fixed without testing both. `DYNASTY-TESTER` (preseason): Texas State's 12 games classify 7 conference / 5 non-conference, broadcastScope split 6 Streaming / 6 National. `DYNASTY-DYNASTYBOWL` (full season): 7 conference / 5 non-conference / 1 bowl (`"Alamo Bowl"`, `siteType: "neutral"`, confirmed correct), broadcastScope 12 National / 1 Streaming â€” matching the user's original bug report exactly, and now explained rather than silently "fixed" by masking it. Independently re-verified the conference classification against a standalone script reading `Conference.TeamSlots` directly (not the classification code's own output), confirming Texas State's real in-save conference membership matches what the schedule page shows.

---

## UI/UX â€” Team Color Theming

Not a numbered roadmap phase â€” done during the Phase 5â†’6 pause at the user's request, to work on UI/UX while waiting for a save with more played games. The ask: dynasty pages, links, and accents should pick up each team's real brand colors for immersion.

**Shipped:**
- Extended `extract-teams.ts` to pull `TEAM_BACKGROUNDCOLOR{R,G,B}`/`{R2,G2,B2}` and convert to hex. Despite the field name, these are the team's actual brand colors, not a UI background â€” verified against 5 real teams before trusting it (Oregon â†’ green `#007934`/yellow `#fde021`, Michigan â†’ navy `#091f40`/maize `#f0c319`, Ohio State â†’ scarlet/gray, Alabama â†’ crimson `#b30839`, all exactly right).
- `dynasties.team_color_primary`/`team_color_secondary` â€” Phase 1's schema already had these columns; nothing had populated them until now. Wired through both `createDynasty` and `updateDynasty` (the latter needed a new `teamColorPrimary`/`teamColorSecondary` patch field) so colors backfill on re-import too, not just first import.
- `src/renderer/lib/teamTheme.ts` â€” the real substance of this work. Team colors are used as-is for solid fills (a button/banner background), but used directly as *text* color, several real team colors fail WCAG contrast outright (Oregon's and Michigan's bright yellows against a white page). Rather than fall back to a generic blue and lose team identity, `ensureContrastText()` nudges the color toward black (light surface) or white (dark surface) in small steps, preserving hue, until it clears 4.5:1 â€” implements the same "pick text color by fill luminance" principle the `dataviz` skill teaches for text-on-colored-fill, applied here to link/accent text sitting *beside* a colored fill rather than inside one. `textColorOn()` handles the inverse case (white or dark ink on top of a solid team-color fill).
- `DynastyLayout.tsx` â€” new shared layout wrapping all three per-dynasty pages (`Overview`/`Roster`/`Schedule`) via nested routes and `<Outlet />`. Fetches the dynasty's theme once, sets `--team-primary`/`--team-secondary`/`--team-on-primary`/`--team-text-light`/`--team-text-dark` as CSS custom properties on a wrapping div, and renders a tab nav using the team's colors for the active tab â€” replacing three pages' worth of duplicated "back to X" / "view Y" links with one consistent nav. Child pages don't fetch or know about colors at all; they just reference the CSS vars via Tailwind arbitrary-value classes (`text-[var(--team-text-light)] dark:text-[var(--team-text-dark)]`, `bg-[var(--team-primary)]`), which cascade down from the layout.
- Dashboard cards get a left-border accent in each dynasty's own primary color (computed per-card, since each card can be a different team) â€” immersion starts at the dashboard, before a dynasty is even opened.
- Record hero figure, stat tile top-borders, and the roster's OVR column all pick up the team's colors as accents.

**Deliberately not team-colored:** W/L result indicators (schedule and season overview) stay fixed green/red regardless of team color â€” win/loss is a universal status convention, not a brand moment, and overriding it with team colors would actually hurt scanability.

**Verification:** typecheck/lint/build clean. Two real tests, not just typecheck:
1. Re-imported the user's actual test save and confirmed via direct SQLite inspection that real hex colors landed on the dynasty row: `#572a31` / `#b4985a` for Texas State, matching the raw RGB values found during investigation exactly.
2. Extracted `teamTheme.ts`'s contrast logic into a standalone script and ran it against 5 real team colors including the two hardest cases (Oregon yellow `#fde021`, Michigan maize `#f0c319`). Confirmed the algorithm does what it was built for: on a light surface, Oregon's raw yellow (which would be nearly unreadable as text) gets darkened to `#7f7011` (4.75:1, passes AA) while staying vivid `#fde021` on dark surfaces (15.24:1); already-safe colors like Alabama crimson and Michigan navy pass through with only a small dark-surface adjustment. This was the specific failure mode the whole feature needed to avoid, confirmed working rather than assumed.

---

## UI/UX â€” Roster Redesign & Player Detail Pages

Also done during the Phase 5â†’6 pause, at the user's request, following a reference screenshot (a real college roster page: yellow header, No./Name/Pos./Ht./Wt./Yr./Hometown columns) plus a second screenshot showing a list/gallery view toggle and a sort dropdown.

**Shipped:**
- `src/renderer/lib/rosterOrder.ts` â€” canonical position order (`QB, HB, FB, WR, TE, LT, LG, C, RG, RT, LE, RE, DT, LOLB, MLB, ROLB, CB, SS, FS, K, P`) matching the game's own default depth-chart ordering, plus Offense/Defense/Special-Teams unit classification and class abbreviation (Fr./So./Jr./Sr.). Investigated the real position values before hardcoding this â€” verified all 21 distinct positions leaguewide, and separately confirmed all 21 classify into the correct unit with no fallthrough.
- Roster table redesigned to match the reference: separate No. and Name columns (previously crammed into one `#9 Chandler Alexander` cell), team-colored header (`bg-[var(--team-primary)]`, reusing the theming work above instead of a generic yellow), height formatted `6' 2"`, Yr. abbreviated, kept OVR as a column (not in the reference, but core to a game-stats app â€” the reference is a real-world athletics site with no such concept).
- List/Gallery view toggle. Gallery is a card grid â€” jersey number badge instead of a photo (explicitly not needed), name, position/class, archetype, OVR.
- Sort dropdown (Jersey/Name/Position/Class/Hometown/Height/Weight, matching the reference exactly â€” deliberately did not add "Rating" as an extra option even though it'd be useful, since the user asked for that specific set) plus a direction toggle. Default sort is Position in game order, which is itself the answer to "put default positions in the same order as the game."
- New Offense/Defense/Special Teams filter, alongside the existing position/class filters.
- Every row/card is clickable â†’ `/dynasty/:id/roster/:playerId`, a new `PlayerDetail.tsx` page. Needed a stable per-player identifier that survives across the season, which the roster snapshot didn't have â€” added `PresentationId` (verified unique, 85/85) to `extract-roster.ts` as `RosterPlayer.id`.
- `PlayerDetail.tsx` shows real bio data (height, weight, hometown, archetype, dev trait â€” all already-extracted, real) plus five sections the user asked for â€” Career Stats, Season Stats, Game Log, Honors, Best Game â€” each with an honest, designed empty state rather than either faking data or hiding the section. This is deliberate: those five sections need Phase 6 (Statistics) and Phase 8 (Awards) data, which is exactly what's currently paused pending a save with played games (see Status above). The empty states say so directly rather than just showing nothing.

**Investigated and confirmed not extractable:** the reference screenshot's "Hometown / High School" format â€” there is no high-school field anywhere on the `Player` table. Shows hometown/state only rather than fabricating a school name.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique: re-imported the user's actual test save and confirmed 85/85 unique player IDs, all 21 real position values present and correctly ordered, and a full sample player record (Chandler Alexander, QB #9, Freshman, 61 OVR, "Field General" archetype, 6'4"/200 lb) matching exactly what direct game-file inspection showed. Separately re-verified the unit-classification map against the real position list outside the app (all 21 positions land in the correct bucket, no silent fallthrough to the wrong unit).

**Note:** this entire session (this UI/UX work included) was built and verified without a display available in the environment â€” every check here is typecheck/lint/build plus direct data verification (SQLite inspection, diagnostic console output), not a visual screenshot. The user should sanity-check the actual rendered layout once they're back at the app; flagged this directly rather than claiming visual confirmation I don't have.

---

## UI/UX â€” Schedule: Team Logos & Game Dates

**Shipped:**
- Team logos on every schedule row (`TeamLogo` next to the opponent name), plus a new Date column.
- Extended `extract-schedule.ts` with `GameDateMonth`/`GameDateDay`. Checked first, as usual: 0 of 934 games leaguewide have a date assigned in this preseason save â€” the game hasn't generated the calendar schedule yet. Built the formatting (`formatGameDate` in `getSchedule.ts`) to show "TBD" for now and real dates automatically once a save with an in-progress season is re-imported. Flagged one real unverified assumption in a code comment: month is assumed 1-indexed (August = 8, standard calendar convention) since no save with an actual non-zero date existed to confirm the indexing against.

**Real bug found and fixed while verifying the logo feature (not by guessing):** checked the schedule's actual opponent `DisplayName` values against the logo mapping and found **33 of 143 teams (23%) don't match** â€” the game frequently uses abbreviated names for scheduled opponents ("Washington St.", "UConn", "C. Carolina", "App St.") that don't correspond to the full-name logo filenames ("washingtonState.png", "connecticut.png", etc.). Investigated all 143 real team names, not just the ones that happened to show up in one schedule, and separated the findings into two real categories:
- **28 genuine mismatches** â€” added an explicit alias map (`TEAM_NAME_ALIASES` in `assetMapping.ts`) translating each verified abbreviated form to its real logo key. Cross-checked all 28 alias targets actually exist in the logo mapping before shipping it â€” an alias pointing at a typo'd key would silently fall back to the generic logo with no error.
- **5 "FCS East/West/North/South/Midwest" placeholders** â€” these aren't real teams, they're generic unassigned-opponent slots the game fills with an actual FCS team later. Left unmapped on purpose; they correctly show the fallback NCAA logo, which is the honest answer until the game assigns a real opponent.

**Verification:** typecheck/lint/build clean. Re-imported the user's actual test save and confirmed via diagnostic output that `date` reads `"TBD"` for every game (matches the leaguewide 0/934 finding). Separately tested the alias-resolution logic directly against the real broken cases (`"Washington St." â†’ washingtonstate`, `"UConn" â†’ connecticut`, etc.) and confirmed the untouched "FCS West" placeholder still correctly falls through to the fallback logo rather than silently matching something wrong.

---

## Phase A â€” Design Tokens (UI/UX Overhaul track)

First phase of the lettered UI/UX Overhaul Initiative (see `MASTER_ROADMAP_v2.md` Parallel Workstreams). Started 2026-07-16 by user decision to switch from the data track.

**Shipped:**
- `src/design/defaultTokens.ts` â€” the single source of truth for every static design value: semantic spacing steps (xsâ€“3xl), radius scale (sm/md/lg/xl/full), shadow scale (sm/md/lg), typography (font stack + size/line-height pairs xsâ€“3xl), and motion (durations as **numbers in ms** â€” so Framer Motion in Phase C can consume them directly â€” plus standard/enter/exit easing curves). `tokenCssVars()` flattens the typed object into 36 CSS custom properties (`--radius-lg`, `--text-sm`/`--text-sm-lh`, `--duration-fast`, `--ease-standard`, `--space-2xl`, `--font-sans`, ...).
- `src/design/applyTokens.ts` â€” `applyDesignTokens(root, tokens?)` writes the variables onto an element. Called once in `index.tsx` against `document.documentElement` **before the first React render** â€” nothing ever paints without the variables set, which is what makes the no-fallback design safe. Takes a tokens argument so the Phase I Dev Mode editor can call it again with edited values to retheme live.
- `tailwind.config.js` â€” `borderRadius`, `boxShadow`, `fontSize`, `fontFamily.sans`, and new semantic `transitionDuration`/`transitionTimingFunction`/`spacing` keys now resolve through the CSS variables. Token values deliberately match Tailwind's own defaults exactly, so every existing page now flows through tokens with **zero visual change** â€” the point of Phase A is plumbing, not restyling (that's Phase F).

**Design decisions:**
- **No `var()` fallbacks in tailwind.config.js, on purpose** â€” fallbacks would duplicate every value as a hardcoded string that could silently drift from `defaultTokens.ts`. Safe because `applyDesignTokens()` runs pre-render (documented in both files). The variable names are a string contract between `tokenCssVars()` and the Tailwind config â€” flagged in comments on both sides since it can't be typechecked.
- **Semantic spacing is additive** (`p-xs`, `gap-md`, ... alongside Tailwind's numeric scale) rather than remapping the whole numeric spacing scale through a base-unit `calc()` â€” remapping every `w-*`/`p-*`/`gap-*` in the app through `calc()` for zero visible benefit now was all risk, no reward. Existing pages keep numeric utilities until the Phase F sweep migrates them. Radius/shadow/font *were* remapped in place because their usage is small and enumerable (checked: only `rounded-md/lg/full` and `text-xs/sm/lg/xl/2xl` exist in the codebase today; zero shadow or duration utilities yet).

**Verification (three independent layers, not just build-passes):**
1. typecheck/lint/build clean.
2. Contract check: compiled `defaultTokens.ts` standalone and cross-referenced every `--*` string in `tailwind.config.js` against `tokenCssVars()` output â€” 36 generated, 36 referenced, 0 missing, 0 orphaned.
3. **Live end-to-end in the real app** (temporary `DIAGNOSTIC_TOKENS` hook in `main.ts`, removed after): launched the actual Electron window, read `getComputedStyle(document.documentElement)` â€” all sampled variables present with correct values â€” then injected a real `rounded-lg text-sm` element and confirmed it resolves to `borderRadius: 8px` / `fontSize: 14px`, pixel-identical to Tailwind's pre-token defaults. The var chain works in the running app, not just in emitted CSS.

---

## Phase B â€” Theme Resolution (UI/UX Overhaul track)

Second phase of the UI/UX Overhaul. Generalizes the ad-hoc team-color application (previously `buildTeamColorVars` called directly in `DynastyLayout` and per-card in `Dashboard`, with dark mode as separate self-contained state in `Navbar`) into one persisted **Custom â†’ Team â†’ Default** priority chain owned by a single provider â€” the thing the Preferences menu (Phase G) will drive.

**Shipped:**
- `src/renderer/theme/themePreference.ts` â€” the pure resolution core (no React), the clean split from `teamTheme.ts`: `teamTheme.ts` answers "given colors, produce WCAG-safe vars"; this answers "*which* colors" via `resolveThemeColors(preference, team?)`. Plus `ThemePreference` model (`colorMode: 'team' | 'default' | 'custom'` + custom hex pair) and `loadThemePreference`/`saveThemePreference` with strict validation (any malformed/unknown value coerces back to defaults). Storage key `cfb-dynasty-hub:color-theme`.
- `src/renderer/theme/ThemeProvider.tsx` â€” React context owning both the color preference **and** dark/light appearance (consolidated from `Navbar` â€” preserves the existing `cfb-dynasty-hub:theme` key and the "stored-or-system" initial logic, so no existing choice is lost). Persists on change, applies the dark class, and applies the resolved *baseline* color vars to `document.documentElement`. Exposes `resolveColorVars(team?)` plus `setColorMode`/`setCustomColors`/`setAppearance`/`toggleAppearance` â€” the setters Phase G will wire to UI.
- Wiring: `index.tsx` wraps the app in `<ThemeProvider>` (inside StrictMode, outside HashRouter). `Navbar.tsx` now consumes `useTheme()` for the dark toggle (its own `useState`/localStorage logic deleted). `DynastyLayout.tsx` calls `resolveColorVars({primary, secondary})` with the active dynasty's colors instead of `buildTeamColorVars` directly â€” so team mode shows team colors while default/custom modes override app-wide.

**Design decisions:**
- **"Team mode with no active team" resolves identically to "Default" by construction** â€” `buildTeamColorVars(null, null)` already substitutes the brand color, so the Dashboard (no active dynasty) in team mode correctly shows brand accents with zero special-casing. Verified this equivalence explicitly.
- **`Dashboard`'s per-card `buildTeamColorVars` left untouched, deliberately.** Those cards are little per-team identity badges (each dynasty in its own colors); they are not "the active theme." Overriding them all to one custom/default color would make them indistinguishable and defeat their purpose. The priority chain governs the *active* theme (inside a dynasty + the app baseline), not identity previews.
- **Provider applies baseline vars to the root, `DynastyLayout` overrides on its subtree.** This means custom/default modes are genuinely app-wide (not just inside a dynasty), there's a sensible baseline before any dynasty theme loads (no flash), and the CSS cascade handles team-mode override cleanly without the provider needing to know the active route.
- Appearance kept as a two-state light/dark (no tri-state 'system') to exactly preserve the shipped Navbar behavior; a 'system' option is a clean future Phase G addition, not needed now.

**Verification (two layers):**
1. Standalone logic test (compiled `themePreference.ts` + `teamTheme.ts`, ran against a fake Storage): 7/7 â€” empty storage â†’ defaults; malformed JSON/invalid enum/non-hex â†’ coerced to defaults; save/load round-trips; and the full priority chain (customâ†’custom color, defaultâ†’brand ignoring the team argument, team+teamâ†’team color, team+**no** teamâ†’brand and provably `=== default`).
2. **Live in the running Electron app** (temporary `DIAGNOSTIC_THEME` two-phase hook in `main.ts`, removed after): phase 1 fresh load showed root `--team-primary: #2563eb` (brand default, team mode no active dynasty â€” correct fallback) with `--team-on-primary: #ffffff`; then injected a `custom`/`#ff8800` preference + dark into localStorage and reloaded; phase 2 showed root `--team-primary: #ff8800` with `--team-on-primary` correctly flipping to `#0f172a` (near-black) â€” proving the resolution drives `teamTheme.ts`'s contrast math through the new layer, applies app-wide, and both the color preference and appearance persisted across the reload.

---

## Phase D (partial) â€” Shared Component Consolidation

Context: a parallel UI/UX push (roadmap v2.3â€“v2.10) jumped ahead to Phases E/F/G and swept all pages into a premium "glass" look **before** Phase D's shared component library existed â€” so each page hand-rolled and copy-pasted the same markup, exactly the drift Phase D was meant to prevent. The user reviewed this, chose to keep the glass direction, and asked to remove the redundancy. This is the start of Phase D's `src/renderer/components/ui/` library, done as a pure consolidation (no visual change).

**Shipped:**
- `src/renderer/components/ui/SurfaceCard.tsx` â€” the glass surface, previously copy-pasted **6 times** (identical `function SurfaceCard` in DynastyOverview/GameDetail/PlayerDetail/Roster/Schedule + one inline `<section>` in DynastySetup). Now one component; all six sites import it.
- `src/renderer/components/ui/StatTile.tsx` â€” the label-above metric tile, previously **3 identical** copies (`StatTile` in DynastyOverview/Schedule, `SummaryTile` in Roster). One component now.
- `src/renderer/components/ui/angledClip.ts` â€” `angledClip(inset)` helper for the clipped-corner ("angular") panel shape, whose clip-path polygon formula was duplicated inline in `app.tsx` (1.25rem inset) and `Dashboard.tsx` (1.1rem). Both now derive their `ANGLED_PANEL` const from the helper, each keeping its own inset.
- Bug fix: `Roster.tsx` had a corrupted `0xB7` byte (invalid UTF-8, rendered as `ï¿½`) where the `position | class` separator should be â€” replaced with `|` to match the redesign's separator convention (GameDetail/PlayerDetail use `|`).

**Left local, deliberately (not redundant):** PlayerDetail's centered value-above stat tile (a distinct shape, used only there) and Dashboard's angular `SummaryTile` (uses `angledClip`, distinct from the glass tile). These aren't duplicated across files, so extracting them now would be premature.

**Not done this pass (flagged for the rest of Phase D):** per-page tables, dropdowns, and buttons are still hand-rolled and share styling conventions but differ enough that a generic `Table`/`Dropdown`/`Button` needs a real design pass, not a mechanical extract. Also: the glass values (`rounded-[28px]`, the big shadows) are still hardcoded in the shared components rather than referencing Phase A's `--radius-*`/`--shadow-*` tokens â€” the token scale doesn't include these larger surface radii yet, so wiring them means extending the token set, a deliberate follow-up.

**Verification:** typecheck/lint/build all clean. Confirmed the consolidation is visually a no-op by grepping the emitted className strings: the glass surface string now appears in exactly **1** source location (the shared component, was 6), the clip-path formula literal appears **0** times in pages (moved to the helper), and the corrupted `0xB7` byte is gone. Because the extracted markup is byte-identical to the originals, the rendered output is unchanged â€” no live re-check needed for a pure extraction.

---

## Premium 3D Logos + Logo Sizing

User dropped a folder of premium 3D-rendered team logos (`public/assets/3d_logos/png`, 144 files) and asked to use them wherever large logos appear, shrink them for smaller sizes, standardize on 3 sizes (100/50/25%), and â€” since the schedule used a sub-25% logo â€” bump that to 25% and enlarge the schedule rows/text to match.

**Shipped:**
- `assetMapping.ts`: added `TEAM_3D_LOGOS` (143 entries; the 144th, `BringGloryHome.png`, is a marketing graphic, skipped), keyed on the **same canonical team keys** as the existing flat `TEAM_NCAA_LOGOS` so the existing normalizeâ†’alias resolution just works. `getLogoPath()` now prefers 3D â†’ falls back to flat NCAA logo â†’ falls back to generic mark. The 3D filenames use a different casing/abbreviation convention (`CAL.png`, `ECU.png`, `MiamiUniversity.png`, `ULMonroe.png`, `UTSA.png`, `USF.png`, `MidTennState.png`, `BostonCollege.png`, etc.), so the map was generated by a script with a 12-entry override table mapping those to canonical keys â€” not hand-transcribed. Bonus: the 3D set includes FCS region placeholders (`FCSWest.png` etc.), so the schedule's "FCS West" placeholder opponent now shows real art instead of the generic fallback.
- `TeamLogo.tsx`: collapsed from 4 sizes (sm/md/lg/xl) to exactly **3** â€” `sm` = 25% (32px), `md` = 50% (64px), `lg` = 100% (128px). The 3D art is the same source at every step, just scaled via CSS (per the "shrink down" instruction). Call sites using the removed `xl` moved to `lg` (DynastyOverview hero, Dashboard card showcase â€” the latter keeps its own oversized `className` override).
- `Schedule.tsx`: the row logo was `sm`=24px (below the new 25% floor), now `sm`=32px. Rows enlarged (`px-4 py-3` â†’ `px-5 py-4`) and text stepped up one tier to preserve hierarchy: table body `text-sm`â†’`text-base` (16px), header labels `text-xs`â†’`text-sm` (kept uppercase/tracked, staying a step below body), Rank/Location badges bumped `text-xs`â†’`text-sm` with proportionally larger padding. Table min-width raised 980â†’1080px so the larger text doesn't crowd.

**Design decisions:**
- 3D is preferred at *every* size, not just large â€” matches "use whenever large logos are needed" + "for smaller sizes shrink down." Flat NCAA logos remain the fallback for the ~113 teams the 3D set doesn't cover, so nothing regresses.
- Kept the flat `TEAM_NCAA_LOGOS` map intact as the fallback tier rather than deleting it â€” this is exactly the dual-source resolution the roadmap's "Upgrade Path for Game Logos" anticipated.

**Verification:** typecheck/lint/build clean. Compiled `assetMapping.ts` standalone and resolved 8 representative cases against the real filesystem â€” 3D hits (Texas State, Ohio State), game-abbreviation aliases resolving to 3D ("Washington St."â†’`WashingtonState.png`, "UConn"â†’`Connecticut.png`), the FCS placeholder â†’ 3D art, teams with no 3D logo (Abilene Christian, Yale) â†’ flat NCAA fallback, and an unknown name â†’ generic mark. **All 8 resolved to files that actually exist on disk.** Confirmed all 144 3D PNGs are copied into `dist/renderer/assets/3d_logos/png` by the build. No live render check (no display in this environment) â€” the size changes are plain Tailwind and the paths are the same same-origin asset mechanism the flat logos already used, so the user should eyeball the actual rendering.

**Superseded by the entry below** â€” the base `png/` folder this entry describes was reorganized into dark/light variants shortly after shipping; `getLogoPath()`'s signature and behavior changed accordingly.

---

## Dark/Light 3D Logos + Championship Trophies

User added three more asset drops: dark/light logo variants (`3d_logos/PNG_OD` and `.../png_OL`, "use on dark"/"use on light"), plus `awards/` (individual player trophy icons), `bowlgames/` (84 files: per-bowl event logo + trophy pairs), `playoffs/` (12 CFP bracket-round graphics), and `confchamp/` (21 files: per-conference championship logo + trophy pairs). Ask: swap logos by dark/light appearance everywhere; if a team wins a trophy show it beside the team logo/info on the Season Overview page; if a team makes a bowl game show that bowl's logo in the overall-record section.

**Investigated first, real save (`DYNASTY-DYNASTYBOWL`), before writing extraction code:**
- `BowlGame.Name` is a **mutable, sponsor-rebrandable display string** (e.g. "Xbox Bowl") â€” `BowlGame.AssetName` is the **stable identity** (e.g. "Bahamas_Bowl") meant for asset matching. Confirmed by finding real save data where they diverge. Extraction already only captured `Name`; this session added `AssetName` too, since display text and asset lookup need different values.
- No team-level "won a championship" field exists anywhere on `Team`. **National championship**: fully derivable from schedule data already extracted (`isNationalChampionship` + game result) â€” no new extraction needed. **Conference championship**: needed a table nothing else touches â€” `LeagueHistoryConferenceChampion` holds real per-conference title-game results (10 non-empty of 330 capacity in the real save, matching exactly the number of conferences with an actual championship game that season â€” 2 of the league's 12 conferences have no title game at all, confirmed via `Conference.ChampionshipGameType === 'NONE'`). No season/year field exists on that table, so it's treated as "this season's results," an inference from the populated count, not a certainty â€” flagged in code for revisit if a multi-season save ever shows it accumulating stale rows.
- Real positive test cases found and used for verification (not synthetic): **Ohio State won the 2026 National Championship** (42â€“34 over Oregon), **Boise State won the Pac-12** (34â€“10 over Fresno State â€” the same conference Texas State plays in), and â€” discovered mid-investigation â€” **Texas State itself won the Alamo Bowl**, 34â€“10 over Arizona. That last one meant the actual persisted dynasty exercised the full `bowl-win` trophy path for real, not just a side-channel check.
- Bowl asset matching: normalizing `AssetName` (strip non-alphanumerics) and matching `bowl_<name>.png` / `bowl_<name>Trophy.png` hits **30 of 32 real bowls** (the other 13 of the 45 `BowlGame` records are CFP bracket placeholder entries â€” "CFP First Round/Quarterfinal/Semifinal" â€” which have a **blank** `AssetName` in the save, confirmed directly, and correctly fall back rather than false-matching). The 2 real misses (Bahamas Bowl, Camellia Bowl) are confirmed genuinely absent from the asset pack, not a naming mismatch â€” `bowl_Default.png` covers them.
- Conference-name-to-trophy-asset mapping is an **exact table of real, verified strings** (not fuzzy normalization) â€” three conferences needed an explicit alias because their in-game name doesn't resemble the asset filename at all: "Big Ten" â†’ `BIG10`, "American" â†’ `AAC`, plus a `Conference USA` alias for safety even though the save's real string is already the acronym "CUSA".
- **Mid-session filesystem drift, caught before shipping**: the on-disk folder is `png_OL` (lowercase "png", the "OD"/"OL" suffix casing is inconsistent â€” `PNG_OD` vs `png_OL`), not `PNG_OL` as `ls`/`find` reported â€” Windows' case-insensitive filesystem let the wrong-case path resolve successfully during development, masking the bug. Caught it by re-checking with PowerShell's `Get-ChildItem` (exact case) after noticing an unrelated dist-artifact anomaly, before the wrong casing shipped. Also found a third, unrequested variant folder, `png_gold` (143 files, same coverage) â€” left completely unwired since no instructions covered it.

**Shipped:**
- `assetMapping.ts`: `getLogoPath(teamAssetName, background: 'light' | 'dark' = 'light')` â€” derives the OD/OL filename from the existing single `TEAM_3D_LOGOS` map (inserts `_OD`/`_OL` before `.png`) rather than a second 143-entry table that could drift. Removed the now-dead base `png/` path entirely (superseded, see above).
- `TeamLogo.tsx`: reads `useTheme().appearance` and passes it straight through â€” every existing call site (Dashboard, Overview, Schedule, GameDetail) gets dark/light-adaptive logos with zero per-callsite changes.
- `extract-schedule.ts`: `GameData` gains `bowlAssetName: string | null` (blank `AssetName` â†’ `null`, not `''`).
- New `extract-conference-championship.ts`: the one new extractor this feature needed (see investigation above). New `trophies` extraction step.
- New `getTrophies.ts` (DB layer): composes national-championship + bowl-win/appearance from the `schedule` snapshot with conference-championship from its own snapshot into one `TeamTrophies` DTO (`trophies: Trophy[]`, `bowlAppearance: BowlAppearance | null`). A bowl **appearance** badge shows regardless of win/loss (per the literal ask); a bowl **trophy** only fires on a win.
- New `trophyAssetMapping.ts` (renderer): resolves a `Trophy`/`BowlAppearance` DTO to an actual image path â€” the exact conference-name table, the normalized bowl-name matcher, and the fixed national-championship trophy path.
- `DynastyOverview.tsx`: trophy badges (image + label) rendered to the right of the team logo/info block, separated by a divider; the bowl-appearance badge rendered inside the existing team-colored "Overall record" block. Both use an `onError` handler that fails over to `bowl_Default.png` at render time, since bowl-name normalization is a heuristic (~94% real match rate) rather than a verified 1:1 table like the conference map.

**Scope decisions:**
- Individual player awards (`awards/` folder â€” Heisman, Biletnikoff, etc.) are **not** wired up. The user's ask was specifically team trophies ("if a team wins a trophy"); individual season awards need their own save investigation (who won what) and belong to the still-unstarted Phase 8 (Awards), not this pass.
- `playoffs/` (CFP bracket-round graphics) not used â€” nothing in this ask needed bracket visualization, only win/appearance detection, which the `confchamp`/`bowlgames` trophy assets already cover.
- `png_gold` variant left unwired â€” no instructions covered it; flagging for the user rather than guessing at intent.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`: the actual persisted Texas State dynasty produced a real `bowl-win` trophy ("Alamo Bowl Champions") and a real bowl appearance (Alamo Bowl vs. Arizona, W) â€” not a synthetic case. Separately exercised `extractConferenceChampionship` directly against "Boise State" (bypassing the persisted dynasty's own team) to prove the conference-championship path against real winning data too, since Texas State itself didn't win its conference this season. Checked **five** resolved asset paths (national-championship trophy, Boise State's Pac-12 trophy, Texas State's Alamo Bowl logo, Texas State's Alamo Bowl trophy) against the actual built `dist/` output â€” all five exist. After fixing the `PNG_OL`â†’`png_OL` casing bug, re-verified `getLogoPath()` for both dark and light against six cases (3D hits, an alias case, a flat-fallback case) â€” all six resolved to real files in `dist`. Also found and cleaned unrelated stale `.dds` build artifacts left over in `dist/` from before these asset folders were reorganized (harmless â€” nothing in the code referenced them â€” but doubled those folders' shipped size for no reason).

---

## CFP Playoff Art + Conference Logos in Schedule

Direct follow-up: the user supplied the exact five playoff images to use (the `playoffs/` folder had actually been simplified since the prior entry â€” 5 files now, not the 12 per-game-slot files investigated before) and a new `conf/` folder of conference logos, asking for CFP-round art in place of generic bowl treatment and the conference's own logo in the schedule's Type column instead of the word "Conference". **Supersedes the previous entry's "`playoffs/` not used" scope note.**

**Investigated first:**
- Re-confirmed the `playoffs/` folder's contents via exact-case PowerShell listing (not `ls`/`find`, per the casing lesson from the prior entry) â€” now exactly the 5 files the user named: `playoff_Round_1.png`, `playoff_Qtr_Final.png`, `playoff_Semi_Game.png`, `playoff_NationalChampionship.png`, `playoff_NationalChampionshipWhite.png`.
- `conf/` folder inspected the same way: **inconsistent naming per conference**, not a uniform convention â€” full descriptive names (`Atlantic_Coast_Conference.svg`), bare acronyms (`SEC.svg`), one with a stray `_logo` suffix (`Mid-American_Conference_logo.svg`), some with real `_OD`/`_OL` dark/light pairs (Big Ten, CUSA), most with none (per the user's "no suffix = usable for both" rule). **One real asymmetry found**: Pac-12 has a light variant (`Pac-12_OL.svg`) but no matching `Pac-12_OD.svg` â€” instead there's a separately-named `Pac12.svg` with no suffix, used as the dark fallback since it's the only other Pac-12 asset that exists. **One file, `Page-1.svg`, doesn't match any of the 10 real conference names** the save produces (checked by elimination against all of them) â€” left out of the map entirely rather than guessed at.
- Re-verified the three real `BowlGame.Name` strings the CFP bracket uses â€” "CFP First Round", "CFP Quarterfinal", "CFP Semifinal" â€” directly against the leaguewide save data again (not just recalled from the prior session), confirming the hardcoded match set is still accurate.

**Shipped:**
- `trophyAssetMapping.ts`: added `getConferenceLogoPath(conferenceName, background)` (exact table, mirrors the conference-trophy table's verified-not-guessed approach), `getPlayoffRoundImagePath(bowlName)` (exact 3-entry table keyed on the real BowlGame.Name strings), `getNationalChampionshipAppearanceImagePath(background)`, and `getPostseasonAppearanceImagePath(bowl, background)` (replaces the old bowl-only `getBowlAppearanceLogoPath` â€” now kind-aware).
- `shared/types.ts`: `BowlAppearance` gains `kind: 'bowl' | 'cfp-round' | 'national-championship'`; `ScheduleGame` gains `conferenceName` (set only when `gameType === 'conference'`) and `bowlAssetName` (mirrors `bowlName`, for Type-column bowl logos). Also corrected a stale doc comment claiming the national championship game has no `BowlGame` reference â€” it does; only its `AssetName` is blank (confirmed in the prior session, comment just hadn't been fixed).
- `getTrophies.ts` **broadened**: postseason-appearance detection previously excluded the national championship game entirely (`!isNationalChampionship` filter) and had no CFP-round concept, so a team that made the playoffs got either nothing or a wrong bowl-style badge. Now classifies every postseason game played (`classifyPostseasonKind`) and picks the **furthest one by week** as the single appearance badge â€” a team that wins its first-round game and loses in the quarterfinal shows the quarterfinal, not the first round. Bowl-**win** trophies now only fire for `kind === 'bowl'` â€” advancing a CFP round isn't a trophy, only the eventual national-championship win (already handled separately) is.
- `getSchedule.ts`: `classifyGameType`'s conference match now also surfaces which conference, not just that it matched.
- `scheduleFormat.ts`: new `getGameTypeImagePath(game, background)` (conference logo / CFP round art / national-championship mark / bowl logo, in that priority) and `isTraditionalBowl(game)` (tells callers when the heuristic bowl-name fallback is worth wiring up â€” not needed for the three CFP/NC cases, which are exact matches).
- `Schedule.tsx`: Type column now renders an icon (whichever of the above resolves) beside the existing text label, matching the Opponent column's established icon+text convention. `GameDetail.tsx`'s header line gets the same icon treatment for consistency, since it already showed the same text.

**Scope decision:** extended past the literal ask (CFP art + schedule conference logos) to also make **regular bowl games** show their logo in the same Type column and to make the **Overview appearance badge** cover CFP rounds/national-championship appearances, not just literal named bowls â€” leaving only conference games with logos and everything else as plain text would have been visually inconsistent within the same column/badge slot, and the infrastructure (bowl logo resolution, kind-based dispatch) already existed from the prior session. Flagged directly rather than silently expanding scope.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`: Texas State's real conference game (vs. Washington St., Pac-12) resolved both light (`Pac-12_OL.svg`) and dark (`Pac12.svg`) logo paths, both confirmed to exist. Texas State's real Alamo Bowl game resolved its bowl logo, confirmed to exist. All three CFP round images and both national-championship images resolved and confirmed to exist. Directly re-queried the real save's leaguewide `BowlGame.Name` values and confirmed "CFP First Round"/"CFP Quarterfinal"/"CFP Semifinal" are exactly what the hardcoded match set expects â€” not re-typed from memory, re-read from the file.

---

## Schedule Refinement: Rivalry Detection, Real Stadiums, Cleaner Type Column

Direct follow-up: declutter the Type column (conference games show the logo alone â€” the word "Conference" is redundant next to it; plain non-conference/non-bowl/non-rivalry games go blank instead of saying "Non-Conference"; rivalry games get called out instead of going blank too) and add real stadium/city info to the Location column, since the save has none.

**Investigated first, real save (`DYNASTY-DYNASTYBOWL`):**
- Rivalry detection: `Team.Rival1TeamRef`/`Rival2TeamRef`/`Rival3TeamRef` are real, always-present, and accurate â€” verified two ways. Texas State's three resolve to UTSA, Sam Houston, and North Texas (all real in-state rivalries). Ohio State's Rival1 resolves to **Michigan** â€” about as strong a real-world confirmation as this project has found for any field.
- Found something richer than expected: `Team.Rivalries` resolves (via an array table, same "literal `[]` in the name" pattern as `SeasonStats[]`/`GameStats[]`) to up to 12 slots in a `Rivalry` table with **real named rivalries and full history** â€” Texas State/UTSA resolves to `"I-35 Rivalry "` (trimmed the trailing space) with `Team1Wins`/`Team2Wins`/`StreakTeam`/`StreakLength`/`FirstYearPlayed` all populated. Not every `Rival1/2/3TeamRef` opponent has a matching named record (North Texas didn't, for Texas State) â€” handled as an honest two-tier fallback: real rivalry name when one resolves, generic "Rivalry" text when the opponent is a confirmed rival but has no named record.
- Stadiums: **re-confirmed** (this was already established last session, re-verified here since it's directly load-bearing for this feature) that `SeasonGame.Stadium`/`Team.Stadium` reference table IDs absent from the save entirely â€” there is no venue data in the file. Per the user's explicit instruction, sourced real-world FBS stadium/city/state data externally instead (Wikipedia's "List of NCAA Division I FBS football stadiums", fetched directly via automated tooling, not typed from memory) â€” **138 teams**, matching the 3D-logo set's realistic-dynasty-team coverage. One real extraction error was caught and corrected mid-research: an early fetch pass invented a stadium name for Fresno State that doesn't exist; a dedicated follow-up search confirmed the real current name (Valley Children's Stadium).

**Shipped:**
- New `extract-rivalries.ts`: reads a team's `Rival1/2/3TeamRef` (reliable detection) and cross-references the `Rivalries` array for a named-rivalry label where one resolves. New `rivalries` extraction step.
- New `stadiumData.ts` (renderer): the 138-team real-world stadium table, keyed on the **same canonical team key** `assetMapping.ts` already uses for logos (`canonicalKey()` exported from there specifically so this file â€” and any future one â€” resolves identically to a logo lookup, no separate alias table to maintain).
- `shared/types.ts`: `ScheduleGame` gains `isRivalryGame`, `rivalryName`, and `teamName` (the user's own team's display name â€” needed so the Location lookup can resolve either side's stadium, mirroring how `opponent` already works).
- `getSchedule.ts`: joins the new `rivalries` snapshot against each game's resolved opponent index, same pattern as the existing conference/bowl joins.
- `scheduleFormat.ts`: `gameTypeLabel()` now returns `''` for conference games (logo carries the meaning) and for plain non-conference/non-rivalry games (intentionally blank), and the rivalry name/generic label for rivalry games. New `getLocationDisplay(game)` resolves the real stadium for the actual hosting team (home team on a home game, opponent on the road) via `stadiumData.ts`; neutral-site games stay badge-only since no specific-venue data exists for those either.
- `Schedule.tsx`/`GameDetail.tsx`: Type cells render icon-only for conference games (empty label collapses to nothing) and the Location cell gains a small muted stadium/city line beneath the Home/Away/Neutral badge.

**Errors hit & fixed (both found via the diagnostic-hook + real-save verification, not assumed):**
1. **Named rivalries resolved to `null` for every opponent on the first pass** â€” same root cause as the `SeasonStats[]` bug from a prior session: `Team.Rivalries` resolves into a table literally named `Rivalry[]` (brackets included), not `Rivalry` â€” the extractor preloaded `Rivalry` but never `Rivalry[]`, so the array row was never actually loaded and the lookup silently found nothing. Fixed by preloading both. Should have remembered this class of bug from the earlier incident; didn't, until real-data verification caught it again.
2. Confirmed (not a bug): Texas State's real rivals aren't on this specific season's schedule at all â€” conference realignment scrambled the whole league enough that none of UTSA/Sam Houston/North Texas ended up scheduled this year. Verified this is genuinely true (not a detection failure) by separately checking the raw extracted rivalry list against the real save independent of the schedule â€” the extractor found all three real rivals correctly; they just didn't happen to play this season.

**Scope note:** stadium coverage is real-world FBS only (138 teams) â€” FCS and lower-tier programs fall back to the existing Home/Away/Neutral badge with no stadium line, same honest-gap handling used everywhere else in this app. Given the data was pulled via ~5 automated fetches rather than exhaustively hand-verified team-by-team, treat it as high-confidence but not guaranteed error-free â€” flagged directly rather than presented as certain, especially since one real error was already caught and fixed during research.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`: raw rivalry extraction correctly found Texas State's real 3 rivals with 2 of 3 named correctly ("I-35 Rivalry", "Sam Houston/Texas State Rivalry") before the fix confirmed all were `null`, and after the fix confirmed both names resolved correctly. Stadium lookups verified against two real games: a home game correctly resolved to UFCU Stadium, San Marcos, TX (Texas State's actual stadium); a real away game at Wisconsin correctly resolved to Camp Randall Stadium, Madison, WI. Confirmed `gameTypeLabel()` returns an empty string for both a real conference game and a real plain non-conference game, matching the new blank/logo-only design.

---

## Editable Stadium Database

Direct follow-up to the stadium-research work above: the Fresno State fabricated-name incident (caught and fixed manually) proved the ~137-team real-world stadium table can't be 100% guaranteed correct, and real stadiums do move/rename over time anyway. User asked for a user-editable override layer, accessible from the app, sitting to the right of the Preferences button.

**Shipped:**
- `stadiumData.ts`: added a `team: string` display name to every one of the 137 entries (added via a one-off verified script â€” cross-checked a hand-compiled name map against the file's actual keys, refusing to write unless the sets matched exactly with 0 missing/0 extra â€” then deleted). Renamed the table `TEAM_STADIUMS` â†’ `DEFAULT_TEAM_STADIUMS` and exported it (was private); renamed `getStadiumInfo` â†’ `getDefaultStadiumInfo` to make clear it's the un-overridden original, now that a second, override-aware lookup exists.
- New `StadiumDataProvider.tsx` (renderer context, mirrors `ThemeProvider.tsx`'s established localStorage pattern): persists user overrides under `cfb-dynasty-hub:stadium-overrides`, keyed by the same `canonicalKey()` as everything else. Exposes `getStadium` (override-or-default-or-null), `getDefaultStadium` (always the original, for "what was this before" display), `isOverridden`, `setOverride`, `resetOverride`, `resetAllOverrides`. Wired into `index.tsx` alongside `ThemeProvider`.
- **Architecture decision:** overrides live in `localStorage`, not the SQLite dynasty database â€” a stadium correction is global app data (applies no matter which save is open), the same category as theme/appearance preferences, not per-dynasty data.
- `scheduleFormat.ts`'s `getLocationDisplay` now takes the resolver (`getStadium`) as an explicit parameter instead of importing `stadiumData.ts` directly â€” keeps it a pure, context-free function (same pattern `getGameTypeImagePath` already used for `background`). `Schedule.tsx` and `GameDetail.tsx` both updated to pass `useStadiumData().getStadium` through.
- New `StadiumDatabaseMenu.tsx`: a Preferences-style glass panel (trigger button in `Navbar.tsx`, immediately right of Preferences) with a searchable team list on the left (default + user-added teams, "Edited" badge for overridden ones) and an edit form on the right (Team/Stadium/City/State fields, Save, "Reset to default" when overridden, shows the original default value for comparison). Supports adding an entirely new team not in the default 137. "Reset all to defaults" at the bottom, gated by `window.confirm`.

**Verification:** typecheck/lint/build clean. Since this feature is pure localStorage/React state with no save-file involvement, verified the actual shipped override logic (round-trip through `JSON.stringify`/`parse`, `canonicalKey` collapsing case/spacing variants to the same key and being idempotent, `resetOverride` removing only its target key, malformed/corrupted localStorage entries being filtered instead of crashing the app) via a standalone script mirroring the real functions verbatim, run against a fake `Storage` â€” all checks passed, script deleted after use.

---

## Schedule Location cleanup: drop Home/Away tags

Direct follow-up: with real stadium/city now showing in the Location column, the Home/Away badge above it was redundant (the venue itself already tells you who's hosting). Removed it in both `Schedule.tsx`'s `LocationCell` and `GameDetail.tsx`'s header line â€” home/away games now show just the stadium/city (or a plain `-` when no stadium data exists for that team), promoted from `text-xs` muted to `text-sm` since it's now the primary content of the cell rather than a caption under a badge. "Neutral Site" is kept as a badge since neutral games have no venue data to fall back on otherwise.

**Verification:** typecheck/lint/build clean.

---

## Schedule table: bigger Type logos, Broadcast column removed, Location breathing room

Direct follow-up: with the Home/Away tags gone, the Type column's text label ("National Championship", a bowl name, a rivalry name) was the next thing crowding the row without adding much â€” removed it, freeing space to size the Type logo up to `h-8 w-8` (32px) to match the Opponent column's team-logo size (`TeamLogo size="sm"`, also 32px), so the two logo columns now read at the same visual weight. Removed the Broadcast column entirely (header + cell + its disclaimer sentence about limited accuracy) â€” the save only exposes a coarse exposure tier, not real network names, so the column wasn't earning its space.

**Location column:** widened (`min-w-[16rem]` on the `<th>`, table `min-w` dropped from 1080px to 960px now that Broadcast is gone) so stadium + city/state normally fit on one line. For names too long to fit (e.g. "Allegacy Federal Credit Union Stadium, Winston-Salem, NC"), the wrap now happens exactly at the stadium/city boundary instead of at an arbitrary word â€” implemented by putting the stadium name and the city/state in two separate `whitespace-nowrap` spans inside a `flex flex-wrap` container, so each chunk stays intact and the second chunk drops to its own line only when the row runs out of room.

**Verification:** typecheck/lint/build clean.

---

## Phase H â€” Coach alma mater + captains/skill-position badges

First data-track work since the UI/UX overhaul took over. Two roadmap caveats resolved: coach alma mater (assumed to need a franchise-table reference lookup) and team captains (assumed still unset on any test save).

**Investigated first, real save (`DYNASTY-DYNASTYBOWL`):**
- `Coach.AlmaMater` turned out simpler than the roadmap assumed: it's a plain integer matching `Team.TeamIndex`, not a franchise reference (`getReferenceDataByKey` returns null for it) â€” resolves via a direct map lookup against the already-extracted teams snapshot, no new reference-resolution machinery needed. Verified against real coaches: rawValue 88 â†’ Temple, 21 â†’ Colorado, 19 â†’ Cincinnati, all real FBS schools. 6 of 493 real coaches (1.2%) carry an out-of-range value (150/151) that matches no real team â€” resolved to `null` rather than guessed.
- `PLYR_ISCAPTAIN` is real and populated on this save: 12 captains leaguewide out of ~16,255 real players. The user's own team (Texas State) happens to have zero â€” confirmed this is genuine sparsity, not a detection bug, by checking the full leaguewide list independently.
- "Skill players" was an unelaborated placeholder phrase in the roadmap heading with zero supporting definition anywhere in the codebase â€” asked the user directly rather than guessing; confirmed as a QB/HB/WR/TE roster badge (this game's real position code is `HB`, not `RB`).
- Also asked where coach data should surface, since there was no coach UI anywhere in the app at all (data was extracted but never displayed) â€” user chose both a Head Coach summary on the Overview page and a full dedicated Coaches page.

**Shipped:**
- `extract-coaches.ts`: `CoachData` gains `almaMater: number` (raw TeamIndex).
- `extract-roster.ts`: `RosterPlayerData` gains `isCaptain: boolean` (from `PLYR_ISCAPTAIN`).
- `rosterOrder.ts`: new `isSkillPosition(position)` (QB/HB/WR/TE).
- New `src/database/getCoaches.ts`: joins the coaches snapshot against the teams snapshot to resolve `almaMaterName`, filters to the user's team, sorts Head Coach first, splits into `{ headCoach, staff }`.
- New IPC round-trip: `IPC.db.getCoaches` â†’ `main/ipc/database.ts` handler â†’ `preload.ts` â†’ `DynastyApi.db.getCoaches`.
- `shared/types.ts`: new `Coach`/`CoachOverview` interfaces; `RosterPlayer` gains `isCaptain`.
- `Roster.tsx`: small amber "C" badge next to a captain's name, small indigo "Skill" badge next to a skill-position player's position â€” both in the gallery card and table row views.
- `DynastyOverview.tsx`: Head Coach summary block (name + alma mater) in the hero row alongside the trophy case, with a "View full staff" link; omitted entirely when no head coach resolves (honest empty state, matching how the trophy row already behaves).
- New `Coaches.tsx` page: full staff cards (position, years coaching, alma mater), wired into the router at `coaches` and into `DynastyLayout.tsx`'s tab bar.

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL`, through the actual import â†’ persist â†’ query pipeline (not just the raw franchise read used during investigation): `getCoaches` correctly returned Texas State's real Head Coach (Hayden Fox Jr., 1 year, Air Force) and full 3-person staff (both coordinators' real alma maters resolved correctly) sorted Head Coach first. Captains query correctly returned an empty array for Texas State's roster â€” matching the raw investigation showing 0 of the team's players are captains, not a bug. Skill-position count came back 24 of 85 roster players, the expected fraction for QB/HB/WR/TE on a full roster.

---

## Phase J â€” Splash screen

Skipped Phase I (Dev Mode token editor) for now, by user choice. This is the splash-screen half of Phase J only â€” packaging/launcher testing (electron-builder, never run at the time) wasn't asked for and isn't started here. (Packaging was tested and fixed in a later pass â€” see "Packaging: first successful `npm run package`" below.)

**Shipped:**
- A genuinely separate, frameless `BrowserWindow` (not the React renderer) shown the instant the app launches, before the main window â€” `createSplashWindow()` in `main.ts`. Its own tiny preload (`src/main/splash/splash-preload.ts`) bridges a `splash:progress` IPC event to a plain-HTML/CSS/JS page (`src/main/splash/splash.html`) that updates a status label and a progress bar width.
- Progress is tied to the app's real startup stages (loading the database engine â†’ preparing workspace/registering IPC handlers â†’ opening the hub â†’ main window ready), not a fake animated timer â€” matching the roadmap's original intent that the splash "reflect the real, finished startup sequence." A 1200ms minimum-display floor keeps it from just flashing by when startup is fast on a warm cache.
- `createWindow()` no longer auto-shows itself on `ready-to-show`; a new `showWhenReady()` helper lets the caller coordinate exactly when the main window appears and the splash closes, used both on first launch and on the macOS `activate` re-open path.
- The splash graphic is a plain image file (`splash-image.png`, copied verbatim from `public/assets/splash/` at build time) with zero code tie-in beyond its filename â€” swapping in new art later is just replacing that file.
- **Asset mid-flight update:** the user dropped two more files into `public/assets/splash/` while this was being built â€” `splashbg.png` (a raw background layer, no text) and `spshscr.png` (the finished composite: the background layer plus the two-line title, matching the originally-provided placeholder's layout but with real stadium/football-field art and a gold "DYNASTY HUB" line). Switched the webpack copy source to `spshscr.png` since it's clearly the intended polished asset, not the plain gray placeholder used during initial investigation â€” flagged to the user rather than silently guessed. Same 868Ã—420 dimensions as the original placeholder, so no window-sizing changes were needed.
- New 4th webpack config (`splashPreloadConfig`) compiles the splash preload separately from the main preload; `mainConfig` gained a `CopyWebpackPlugin` pass to place `splash.html` + the renamed `splash-image.png` alongside `main.js`/`preload.js` in `dist/main/splash/` â€” fully independent of the renderer bundle, since the whole point of a splash screen is to display before the React app is necessarily ready.

**Verification:** typecheck/lint/build clean. Visual verification via a temporary diagnostic hook (`SPLASH_SCREENSHOT_PATH` env var, same pattern as the franchise-file diagnostic hook elsewhere in this project) that called `webContents.capturePage()` on the live splash window mid-progress and wrote it to disk â€” confirmed the image, status text, and a partially-filled progress bar all render correctly together, not just each piece in isolation. Hook removed after use. Separately ran a full real launch (no diagnostic env vars) for 8 seconds with no thrown errors, confirming the splash-to-main-window handoff completes cleanly.

---

## Launcher: hidden console + skip-unneeded-rebuild

Direct follow-up to the Phase J splash screen: the user wanted the splash to be the first thing visible on launch instead of a black cmd window sitting there through `npm`/webpack output.

**Root cause investigated first:** `Launch CFB Dynasty Hub.bat` ran `npm start` = `npm run build && electron .` â€” a **full webpack rebuild on every single launch** (main/preload/splash-preload/renderer, ~15-20s), not just a console-visibility issue. Hiding the console alone would've left the user staring at nothing for that whole time on every launch.

**Shipped:**
- `scripts/hidden-relaunch.vbs`: a small helper â€” a `.bat` can never hide its own console window; the only reliable way on Windows is having a windowed script host (`wscript.exe`, unlike `cscript.exe`, has no console of its own) re-launch the `.bat` with `WshShell.Run(..., 0, False)` (window style 0 = hidden). The user's double-click target stays exactly the same file (`Launch CFB Dynasty Hub.bat`) â€” no shortcut needs updating.
- Rewrote the `.bat`: on first invocation it immediately hands off to the hidden relaunch and exits (the brief flash of the initial cmd window is unavoidable â€” Windows always briefly shows a console for a directly-executed `.bat` â€” but it's now sub-100ms instead of the full run duration); the actual work happens in the hidden re-invocation.
- **Skip-rebuild optimization** (the bigger real fix): a PowerShell one-liner compares the newest file mtime under `src/` + the root build-config files against `dist/main/main.js`'s mtime. If `dist` is already current, `npm run build` is skipped entirely and `electron .` launches directly â€” splash appears in about a second. Only a genuine source change triggers a real rebuild.
- Failure fallback: `npm install`/`npm run build`/`electron` output now goes to a log file (`%TEMP%\cfb-dynasty-hub-launch.log`) instead of a visible console; on failure, a `System.Windows.Forms.MessageBox` alert pops up and Notepad opens the log â€” so a hidden failure doesn't look like nothing happened at all.

**Verification:** typecheck/lint/build clean. Real end-to-end launches tested via `Start-Process` (simulating a double-click) with `ELECTRON_RUN_AS_NODE` explicitly cleared first â€” **this env var is injected into every one of my own tool sessions in this sandbox** (confirmed: set at the process level, not User/Machine registry, so it doesn't affect the real user's normal desktop environment) and makes `electron.exe` run as plain Node instead of launching the app, which is exactly what happened on the first test attempt (`TypeError: Cannot read properties of undefined (reading 'whenReady')` â€” `require('electron')` returns a non-API value under plain Node). With it cleared to match a real launch: fast path (no changes) reached a titled `CFB Dynasty Hub` window in 1.5s; slow path (forced a rebuild by touching `main.ts`'s mtime) completed in ~15s and also reached the titled window correctly. Both log files came back clean (no errors). The MessageBox failure-path command was parse-checked but not fired live (would require actually breaking the build to trigger).

---

## Phase K â€” Integration pass

Closes out the lettered UI/UX track. Scope per the roadmap: persistence, theme switching, responsiveness, reduced-motion compliance, startup reliability â€” verified across everything shipped in Phases A-J. Backed up `src/`, `scripts/`, `webpack.config.js`, `package.json`, the launcher `.bat`, and both log files to `.backup/phase-k-integration-20260715-192924/` before starting, per user request.

**Investigated first** (three parallel audits, read-only): persistence/corruption-resilience across every localStorage consumer + window-state.json + the SQLite DB file; dark-mode (`dark:`) class-pairing coverage across all 8 pages plus the two dense popup components; and responsiveness at the 1024Ã—700 window minimum plus reduced-motion handling.

**Findings:**
- **Theme switching / dark-mode coverage: clean.** No real gaps across any page â€” every light-mode utility class is paired with a `dark:` variant (or, in `PreferencesMenu.tsx`/`StadiumDatabaseMenu.tsx`, both branches of an equivalent `isDark ? ... : ...` ternary). Team-color CSS variable fallback confirmed solid for pages outside a dynasty context (Dashboard, DynastySetup) â€” `ThemeProvider` applies a contrast-safe brand-blue default at the document root regardless of route.
- **Responsiveness: clean.** At the 1024px minimum window width, Roster's and Schedule's `min-w-[960px]` tables are permanently in horizontal-scroll mode (~598px of actual content width available), but that scroll is correctly scoped to the table's own `overflow-x-auto` wrapper â€” no whole-page horizontal scrollbar, sidebar/content never fight for space. Tight but not broken; left as-is.
- **Reduced-motion: a real, total gap** â€” confirmed zero `prefers-reduced-motion` handling anywhere in the codebase. Fixable in one place since every transition in the app already runs through Tailwind's token-backed `transition*` utilities (no Framer Motion, no keyframe `animate-` classes).
- **Startup reliability: a real gap** â€” `window-state.json`'s saved `x`/`y` were used verbatim with no validation against currently-connected displays. A stale position (monitor unplugged/resolution changed since last session) could open the app fully off-screen with no in-app recovery, only manual file deletion.
- **Minor persistence gap** â€” `ThemeProvider.tsx`'s appearance-preference `localStorage.setItem` was the one write in the app not wrapped in try/catch (every other localStorage consumer already followed that pattern).

**Shipped:**
- `globals.css`: global `@media (prefers-reduced-motion: reduce)` block clamping `animation-duration`/`transition-duration` to `0.01ms` (not `0ms`, so a future `transitionend` listener would still fire) plus `scroll-behavior: auto` â€” covers all 41 existing transition usages across 12 files in one rule.
- `main.ts`: new `sanitizeWindowState()` â€” clamps width/height to the real minimum (1024Ã—700, now named constants instead of duplicated magic numbers) and drops `x`/`y` entirely (falling back to Electron's default centering) if the saved position doesn't intersect any currently-connected display's bounds (`screen.getAllDisplays()`).
- `ThemeProvider.tsx`: wrapped the appearance `localStorage.setItem` in try/catch, matching the non-fatal pattern already used by `themePreference.ts` and `StadiumDataProvider.tsx`.
- **Deliberately not fixed, flagged instead:** a corrupted/truncated SQLite DB file still throws out to the top-level catch and quits with no recovery UI (same class of issue as the window-state gap, but building a "reset database" recovery flow is a real feature, not a one-line integration fix â€” out of scope for this pass).

**Verification:** typecheck/lint/build clean. Real end-to-end tests via live launches (not just reasoning about the code): (1) wrote a deliberately corrupted window-state.json with a BOM, confirmed the existing try/catch fallback already handled it correctly (defaulted to 1400Ã—900, no crash) â€” an unplanned bonus check; (2) wrote a genuinely off-screen position (`x:9999,y:9999`, verified via a diagnostic hook against this machine's real two-monitor bounds â€” 5120Ã—1440 and 3073Ã—1728) and confirmed the app centered itself on the primary display instead of opening off-screen; (3) restored the real window-state.json from a backup taken before the test and confirmed a normal launch still opens at the correct saved position. All diagnostic hooks removed after use.

---

## Packaging: first successful `npm run package`

Direct follow-up to Phase K: tested `npm run package` (electron-builder) for the first time ever â€” flagged as untested since Phase 1. Two real bugs found and fixed, one genuine Windows-permission blocker that needed the user's own action.

**Bug 1 â€” the whole custom config was silently never loading.** `electron-builder.config.js` is not a filename electron-builder actually auto-detects (it searches for a file base-named exactly `electron-builder` â€” `.yml`/`.json`/`.js`/etc. â€” via cosmiconfig-style resolution; the extra `.config` segment breaks the match, confirmed by reading `app-builder-lib`'s `configFilename: "electron-builder"` search config directly rather than guessing). With the config never found, electron-builder fell back to all defaults â€” critically, a default output directory of `dist`, colliding directly with webpack's own `dist/` output. First run failed with `Application entry file "dist\main\main.js" ... does not exist` because electron-builder was trying to read its input from and write its packaged output into the same folder simultaneously. **Fix:** renamed to `electron-builder.js` â€” confirmed via the next run's log (`loaded configuration file=...electron-builder.js`, `appOutDir=release\win-unpacked`) that the config now actually loads and the real `directories.output: 'release'` setting takes effect.

**Bug 2 (cosmetic) â€” missing `author` field** in `package.json`, which electron-builder warns about. Added (`"Antigracity"`, matching the existing `appId`'s `com.antigracity.*` branding).

**Blocker â€” real, not a code bug.** Packaging still failed after the config fix: `rcedit` (the tool that stamps icon/name/version metadata onto the packaged `.exe`) needs a vendor package (`winCodeSign` â€” bundles `rcedit.exe` alongside unrelated macOS signing tools) that failed to extract with `Cannot create symbolic link : A required privilege is not held by the client.`. Traced this properly rather than guessing: instrumented `winPackager.js`'s `sign()` method directly with temporary `console.log` calls to test the "maybe it's trying to auto-sign with a phantom certificate" theory (a red herring â€” a first attempt to fix this via `CSC_IDENTITY_AUTO_DISCOVERY=false` had no effect, and it turned out that env var is macOS-only anyway, unrelated to Windows signing at all; reverted). The instrumentation proved `sign()` was never even called â€” the real trigger is the win32 `rcedit` embed step (unconditional on every Windows build, unrelated to code signing), which needs `SeCreateSymbolicLinkPrivilege` to extract the vendor archive's Darwin dylib symlinks. Regular Windows user accounts don't have that privilege by default. Confirmed via a direct registry write attempt (`HKLM:\...\AppModelUnlock`) that this session has no path around it â€” genuinely needs either Windows Developer Mode or an elevated terminal, both of which are the user's call, not something to force. Asked the user; they enabled Developer Mode via Windows Settings (confirmed via registry read: `AllowDevelopmentWithoutDevLicense = 1`) and packaging succeeded immediately on the next attempt with no further changes.

**Output:** `release/CFB Dynasty Hub 0.1.0.exe` (portable, ~295MB) and `release/CFB Dynasty Hub Setup 0.1.0.exe` (NSIS installer, ~295MB) â€” both real, working artifacts, not deleted after verification (unlike scratch/diagnostic files).

**Verification:** launched the packaged portable `.exe` directly (not just the dev `electron .` flow) and confirmed the main window comes up with the correct title and stays stable â€” the meaningful proof here is that `sql.js`'s wasm binary and `madden-franchise`'s data files resolved correctly from inside the packaged `app.asar`/`node_modules`, the exact class of bug flagged as a risk since Phase 1 (`initDatabase()` would throw and silently quit before showing any window if that bundling were broken). Did not run the NSIS installer itself (would install the app + registry entries + Start Menu shortcuts on the dev machine, more invasive than this verification needed) â€” the installer wraps the same validated payload as the portable build.

---

## Phase 8 â€” Awards

First data-track feature since Phase 6/Phase H. Direct follow-up to the "what's next" discussion: user picked Awards, with two explicit requirements â€” everything lives in the dynasty tab bar (Overview-Roster-Schedule-Coaches-**Awards**), not the old disconnected sidebar list, and awards must also show up on the player's own detail page using real trophy art. Also cleaned up `Sidebar.tsx`'s stale "Planned Modules" placeholder list while here â€” it still said "Soon" next to Statistics, which has actually been live since Phase 6.

**Investigated first, real save (`DYNASTY-DYNASTYBOWL`):** nobody had ever looked at award data before this. Found it's real and rich:
- `PlayerAward` (1,960 real rows leaguewide): the full per-player award ledger. Fields `Team`/`Player`/`Conference` (refs), `Period` (`"Season"` or `"Game"`), `PeriodIndex` (week number for weekly awards), `AwardType` (plain string, no enum lookup needed), `AwardScore`, `Position`.
- `LeagueHistoryAward` (24 real rows): a flattened "this season's single winner" list â€” **includes both player and coach awards** (`BEST_HC`â†’Ryan Day/Ohio State, `BEST_AC`â†’Chris Ash/Notre Dame were right there alongside `HEISMAN`â†’Kevin Jennings/SMU), with the winner's name/team/position already inlined as strings (`firstName`/`lastName`/`TeamDisplayName`/`Position` â€” note the inconsistent casing, verified exactly via a real field dump rather than trusted from a research summary). No reference resolution needed at all, which meant a separate `CoachAward` table read wasn't necessary once this was confirmed.
- Exact, complete enumeration of all 36 real `AwardType` strings pulled directly (not estimated): 20 `BEST_*` position awards, `HEISMAN`, `MOST_VERSATILE`, 10 `ALL_AM_*` tier variants (`1ST`/`2ND`/`FR` Ã— `_CONF`/`_PRE_CONF` combinations), and 4 weekly `*_Player_of_Week*` variants. Of these, 22 (plus the 2 coach-only types) are genuine single-winner "marquee" awards; the other 14 are multi-winner (a whole team of All-Americans) or repeatable-per-week, so they don't fit a "one winner" model.
- Real winners confirmed, not hypothetical: Heisman â†’ Kevin Jennings (SMU), Best RB â†’ Mark Fletcher Jr. (Miami), and Texas State's own Chris Dawn Jr. (WR) with a real `ALL_AM_1ST_CONF` selection plus several conference weekly honors.

**Trophy art mapping (`public/assets/awards/`, 38 files, previously unused since a prior session's asset drop):** the save's `AwardType` strings are generic position names (`BEST_QB`, `BEST_LB`, â€¦), not the literal real-world trophy names the asset pack ships â€” only `HEISMAN` matches literally. Built a reasoned equivalence table for the 24 marquee types (e.g. `BEST_REC`â†’Biletnikoff, `BEST_LB`â†’Butkus, `BEST_KICK`â†’Lou Groza, `BEST_AC`â†’Broyles, `BEST_HC`â†’Bear Bryant), falling back to the pack's generic `CFB_Generic_Trophy_*` art for the two types with no clean real-world equivalent (`BEST_DE`, `BEST_SR`). Every filename verified against the real folder via PowerShell (exact case) before wiring in, per this project's established Windows-case-lies-via-`ls` gotcha. All-American tiers and weekly honors get no dedicated art (not single-winner awards) â€” formatted as text-only badges via a small procedural parser instead of an exhaustive per-variant lookup table.

**Shipped:**
- `extract-awards.ts`: reads `LeagueHistoryAward` (leaguewide marquee winners, all fields already flat strings) and `PlayerAward` (full award ledger, scoped to the user's own team â€” same scoping convention as roster/stats/gamelog).
- `awardFormat.ts`: `formatAwardLabel()` (exact lookup for the 24 marquee types + procedural parsers for the 10 All-American variants and 4 weekly-honor variants), `groupWeeklyHonors()` (collapses repeat weekly nods into one count each, shared between the Awards page and PlayerDetail).
- `trophyAssetMapping.ts`: `getAwardTrophyPath()`.
- `getAwards.ts` + full IPC round-trip (`getAwards` on `DynastyApi.db`): returns `{ leagueAwards, teamAwards }`, joining `PlayerAward`'s raw `playerId` against that season's roster snapshot for display names.
- New `Awards.tsx` page: league-wide marquee award grid (trophy art, winner, team, highlighted if it's the user's own team) plus a per-player grouped view of the user's own team's honors. Wired into `DynastyLayout.tsx`'s tab bar and `app.tsx`'s router.
- `PlayerDetail.tsx`: the "Honors" section's placeholder empty-state replaced with a real `HonorsSection` â€” season awards as trophy-icon chips, weekly honors collapsed to counts.
- `Sidebar.tsx`: "Planned Modules" trimmed from 6 items to 3 (`Recruiting`, `History`, `Exports`) â€” removed `Statistics` (live since Phase 6, mislabeled), `Awards` (now a real tab), and `Settings` (redundant with Preferences + the Stadium Database editor).

**Verification:** typecheck/lint/build clean. Real end-to-end test via the diagnostic-hook technique against `DYNASTY-DYNASTYBOWL` through the actual import â†’ persist â†’ query pipeline: 24 league awards extracted exactly matching the investigation (Ryan Day/BEST_HC, Kevin Jennings/HEISMAN, etc.), 14 real team-award entries for Texas State correctly joined to real roster names. Also did a live visual check (screenshot via a temporary `capturePage()` diagnostic route, same pattern as the splash-screen verification) of the actual rendered Awards page against a previously-imported real dynasty â€” confirmed real trophy images load correctly (no broken images), layout is clean, stats tiles compute correctly (24 league awards / 0 won by Texas State / 11 unique players honored â€” correctly collapsed from 14 raw entries since some players had multiple award entries). Diagnostic hooks and screenshots removed/deleted after use.

---

## Phase 8 follow-up â€” Awards page redesign + global Player Profile Modal

Direct follow-up to Phase 8, driven by a detailed user spec plus a real data-error report (Jet Award showing the wrong winner). Two deliverables: a structural (not cosmetic) redesign of the Awards page, and a new reusable global player-profile modal used everywhere a player name appears.

**Jet Award root cause (real bug, found by comparing against the user's own in-game knowledge, not guessed):** `MOST_VERSATILE` was mislabeled `'The Jet Award'` and `BEST_SR` was mislabeled `'Outstanding Senior'` â€” backwards from the real award names (the Jet Award is for return specialists via `BEST_SR`; "most versatile player" is the Paul Hornung Award via `MOST_VERSATILE`). This was a **label-mapping bug, not a data pipeline bug** â€” the correct `playerId`/winner was already flowing through extraction correctly; only the display name was swapped. Verified directly against the real Miami save's `LeagueHistoryAward` table: `MOST_VERSATILE â†’ John Mateer (QB, Oklahoma)`, `BEST_SR â†’ Eugene Wilson III (WR, LSU)`, exactly matching the user's report once corrected. Fixed by swapping the two labels/trophy-image mappings in `awardFormat.ts`/`trophyAssetMapping.ts`. Also corrected `BEST_ACADEMIC â†’ 'William V. Campbell Trophy'`, `BEST_LB â†’ 'Dick Butkus Award'`, `BEST_SR_QB â†’ 'Unitas Golden Arm Award'`, `BEST_REC â†’ 'Fred Biletnikoff Award'`. Cross-checked all 22 other marquee mappings against the user's exact requested display order â€” no further errors found.

**Second real bug found during verification (not from a user report):** `extractHeismanRanking()` initially returned `heismanWinner: null, heismanFinalists: []` against the real Miami save despite confirmed-real underlying data. Root cause: the `HeismanRanking` reference resolves into the array table `HeismanAwardRanking[]` â€” a **literal `[]` in the table's real name**, the same recurring gotcha this project has hit before with `SeasonStats[]`/`GameStats[]`/`Rivalry[]` â€” which wasn't preloaded via `preloadAllInstances()` before resolution was attempted. Fixed by preloading both `HeismanAwardRanking[]` and `HeismanAwardRanking` before resolving. Re-verified: correct winner (John Mateer) and 3 correct finalists resolved on the next diagnostic run.

**Data model change â€” leaguewide vs. team-scoped split:** the spec's "full All-American/Conference roster browser" needs every conference's selections, not just the user's team's, so `extract-awards.ts` was restructured to source marquee-award winners and All-American/Conference selections from `PlayerAward` **leaguewide** (a deliberate expansion beyond this project's prior "user's team only" convention), while weekly honors stay scoped to the user's own team (unchanged convention, since the spec only asked for the user's own team's weekly honors). Marquee winners were also switched from the convenient-but-ID-less `LeagueHistoryAward` table to `PlayerAward`, after first empirically confirming (scratch script against the real save, deleted after use) that every one of the 21 non-coach marquee `AwardType`s has exactly one row at `Period === 'Season'` leaguewide â€” ruling out picking an arbitrary/wrong entry among duplicates. This is what makes marquee-winner names clickable (real `playerId`, not just a flattened string).

**Global Player Profile Modal:** new `PlayerModalProvider.tsx` (React context at the app root, alongside `ThemeProvider`/`StadiumDataProvider`) exposes `openPlayerModal(dynastyId, playerId, navigationIds?)`/`closePlayerModal()`/`goToPlayer()`. `PlayerProfileModal.tsx` is the single global overlay instance, rendered once at the root of `app.tsx`. Player-profile rendering itself was extracted out of the old route-only `PlayerDetail.tsx` into `PlayerProfileContent.tsx`, now shared by both the modal and the (now much thinner) `PlayerDetail.tsx` route â€” one rendering implementation, two entry points. Modal behavior: blur+dark backdrop, focus trap (Tab/Shift+Tab cycled across focusable descendants), Escape closes, background scroll locked (`document.body.style.overflow`), focus restored to the triggering element on close. `Roster.tsx` passes its currently-sorted/filtered player-ID list as `navigationIds` so the modal's Prev/Next buttons walk the roster's *visible* order (respecting active sort/filter/search), not raw database order, and disable correctly at the ends.

**Awards page â€” structural redesign, not a cosmetic pass:** compact header (was an oversized banner); the 3 old summary cards (League Awards count, Won by Your Team, Your Players Honored) removed with no replacement metrics row; new dedicated Heisman section (large trophy + winner as primary visual focus, finalists as a secondary column, all names clickable); "Annual Awards" section in the exact 22-item order the user specified (centralized in `src/shared/awardOrder.ts` so both the extractor and the renderer's sort function read the same list â€” no duplicated ordering logic); "Annual Awards Won by [Team]" as a small inline subsection, not another oversized card; the old mixed "your team's honors" grid removed entirely and replaced by three separate pieces: (1) a compact 6-item team honor-count summary (First/Second/Freshman Ã— All-American/All-Conference), (2) a full leaguewide All-American/Conference roster browser with three dropdowns (Honor Type â†’ Team Level â†’ Conference, the last shown only for All-Conference and defaulting to the user's own conference, alphabetical thereafter, with a conference logo shown next to the selector), (3) a Weekly Honors section scoped to the user's own team only, opponent resolved by joining each honor's week against the schedule snapshot (home/away-aware, so the opponent shown is never the user's own team).

**Third and fourth real bugs found â€” via actual click/keyboard interaction, not just code review:**
1. **Modal showed a bare "Player not found." for the large majority of leaguewide award data.** `getRoster()` only ever returns the user's own team's roster (by design â€” see the data-model note above), but Heisman/Annual Award/All-American winners are now sourced leaguewide, so clicking almost any marquee winner (e.g. Oklahoma's John Mateer, from the Miami dynasty) hit a player the local roster snapshot simply doesn't contain. Caught by scripting a real click on the Heisman winner's name via `executeJavaScript` and reading back the rendered dialog text â€” it said "Player not found," not a crash, so this wouldn't have surfaced from typecheck/lint/build at all. **Fix:** `PlayerModalProvider`/`PlayerNameButton` now carry an optional `fallback` (name/position/team) captured at click time from data already on hand; when the local roster lookup misses, `PlayerProfileContent` renders a lightweight degraded profile (team logo, name, position, an explicit "full profile unavailable â€” opposing team" note, plus that player's real Honors pulled from the leaguewide awards data, which *is* available) instead of a dead end. Re-verified both paths afterward: an opposing player (John Mateer) now shows the degraded-but-real card; a real roster player (Mark Fletcher Jr.) still gets the full bio/stats/game-log profile, confirming the fallback path doesn't leak into the normal case.
2. **Roster's table-view rows were mouse-only** â€” `<tr onClick=...>` with no `tabIndex`, no `role`, no `onKeyDown`, so Tab could never reach a player name and Enter/Space did nothing, violating the spec's explicit "keyboard-accessible player names" requirement (the gallery-view `PlayerCard` was already a real `<button>` and was fine). **Fix:** added `tabIndex={0}`, `role="button"`, an `aria-label`, an Enter/Space `onKeyDown` handler, and a visible `focus-visible` outline to the table row.

**Verification â€” real interactive testing via scripted click/keyboard events, not just visual screenshots or code review:** `npx tsc --noEmit`, `npx eslint`, and a clean `rm -rf dist && webpack` build all pass with zero errors, both before and after the two fixes above. Live-rendered screenshots (via a temporary `capturePage()` diagnostic route in `main.ts`, removed after use) against the real Miami dynasty save confirmed, in order: Heisman winner (John Mateer) + 3 finalists with correct team logos; all 22 Annual Awards in the exact requested order with the corrected Jet Award (Eugene Wilson III) and new Paul Hornung Award (John Mateer) both showing correctly, team logos before school names; the 6-item team honor-count summary with real non-zero numbers; the All-American/First-Team roster browser (25 players) as the correct default state; and â€” after programmatically driving the Honor Type `<select>` to "All-Conference" via `executeJavaScript` (a real React `onChange`, not just a data-layer check) â€” the conference dropdown appearing, defaulting to ACC (Miami's real conference, confirmed first in the alphabetical list per the spec's Texas State/Pac-12 worked example), the ACC logo rendering, and the roster correctly re-filtering to First-Team All-ACC players only; Weekly Honors showing Miami-only entries with correct, distinct opponent logos (Notre Dame, Ole Miss, North Carolina, Arkansas State, Oregon) in chronological order. Beyond screenshots, real interaction was scripted and its DOM effects asserted programmatically: clicking a player name opens `role="dialog"` with `aria-label="Player profile"`, locks `document.body`'s overflow to `hidden`, and moves focus to the Close button; dispatching a real `Escape` `KeyboardEvent` closes the dialog, unlocks body scroll, and returns focus to the exact element that opened it; on Roster, clicking the first table row opens the modal with Previous correctly disabled (first player) and Next correctly enabled, and clicking Next advances to the next player in the table's current sort order with Previous now enabled â€” confirming `navigationIds` actually drives Prev/Next rather than just being plumbed through unused.

**Tool/environment note for future sessions:** hit a repeated false alarm where `npx electron .` appeared to crash with a giant one-line `TypeError` dump from `main.js:1` â€” this is `ELECTRON_RUN_AS_NODE=1` being set in the shell (this sandbox's default, noted back in Phase 0), which makes `require('electron')` return a plain path string instead of the module, so `app.whenReady()` throws. Because each Bash/PowerShell tool call starts a fresh shell, `Remove-Item Env:\ELECTRON_RUN_AS_NODE` has to be re-run in *every* command block that launches Electron, not just once per session. Separately, redirecting a native command's stderr to a file in PowerShell 5.1 (`2>` or `2>&1`) wraps each line in a formatted `ErrorRecord` (`NativeCommandError` boilerplate) even when writing to a file, not just the console â€” don't redirect stderr for native commands; let it print directly or capture via `$out = & cmd 2>&1` into a variable instead.

**Remaining limitation, by design, not a bug:** the degraded fallback profile for opposing-team players shows name/position/team/honors only â€” no bio, ratings, career/season stats, or game log, since none of that is extracted for any team but the user's own. A true full profile for every leaguewide award winner would require extracting full rosters/stats for all ~130+ teams, which is out of scope here and would be a large standalone feature.

**Filenames created:** `src/shared/awardOrder.ts`, `src/renderer/data/PlayerModalProvider.tsx`, `src/renderer/components/common/PlayerProfileContent.tsx`, `src/renderer/components/common/PlayerProfileModal.tsx`.

**Filenames substantially rewritten:** `src/extractors/extract-awards.ts`, `src/database/getAwards.ts`, `src/shared/types.ts` (awards-related interfaces), `src/renderer/lib/awardFormat.ts`, `src/renderer/pages/Awards.tsx`, `src/renderer/pages/PlayerDetail.tsx` (now a thin wrapper), `src/renderer/pages/Roster.tsx` (modal wiring), `src/renderer/index.tsx`/`app.tsx` (provider/modal mounted at root).

**No new dependencies added.**

---

## Phase 7 â€” Rankings & Visualizations

First data-track feature since the Awards redesign. User picked this over the remaining UI/UX polish track. Roadmap scope: weekly AP/Coaches/CFP rank tracking, a trajectory line chart, highest/average ranking, rank-vs-record correlation, and tournament seeding.

**Investigated first, real saves (Miami, Texas State, several others):** confirmed directly by dumping every `rank`/`poll`/`week` field on the `Team` table that the save format itself only ever stores **3 fixed poll data points per team** â€” `StartOfSeasonRank`, `LastWeeksRank`, `CurrentRank` (Ã—3 for AP/Media, Coaches, CFP) â€” never a full per-week history array, and no other table (`AdvanceSeasonWeekTransaction` looked promising by name but is a single-row state-machine tracker, not a log) stores historical rankings either. This is a **hard data constraint**, not a gap in this pass's extraction: a real week-by-week trend cannot be read whole out of one save file. It can only be *built* by this app accumulating one snapshot per import as the user's dynasty progresses across multiple sessions â€” a materially different feature shape than "parse it out of the save," which is why this phase is schema + accumulation logic, not just another extractor.

Also confirmed `SeasonInfo.CurrentWeek` reads `0` once a season reaches `OffSeason`/`PreSeason` stage (checked across 5 real saves, including one fully-completed season) â€” so it can't be used to label a ranking snapshot's week. Fixed by deriving "last played week" from the user's own schedule instead (`Math.max` over played games' `week`), which works correctly in every stage: 0 for a fresh preseason save, the real in-progress week mid-season, and the actual bowl/CFP week for a finished season (verified: a real completed 14-2 Miami season correctly resolved to week 20, not 0).

**Tournament Seeding** (the roadmap's third feature area) was **not duplicated here** â€” postseason info (bowl appearance, CFP rounds, national/conference championships) was already fully built in an earlier phase as `getTrophies.ts`/`TeamTrophies`, shown on the Overview page. Re-investigated its real playoff-related fields (`PlayoffStatus`, `PlayoffRoundReached`) during this phase and confirmed `PlayoffStatus` is a dead/non-differentiating field (identical value across every team in a real save) not worth surfacing, while `PlayoffRoundReached` is exactly what the existing trophy system already consumes. Building a second, overlapping "seeding" UI here would have fragmented one real concept across two pages.

**Shipped:**
- `src/database/schema_v2_ranking_history.sql` + `migrations.ts` (version 2, append-only per the project's migration discipline) â€” new `ranking_history` table, `UNIQUE(season_id, week)`.
- `helpers.ts`: `recordRankingSnapshot()` (upsert â€” re-importing the same week corrects it in place rather than duplicating; advancing to a new week adds a row) and `getRankingHistory()`.
- `importExtraction.ts`: `computeLastPlayedWeek()` plus a `recordRankingSnapshot()` call on every `persistExtraction()`, using the user's own team's current poll ranks and record.
- `database/getRankings.ts` + full IPC round-trip (`getRankings` on `DynastyApi.db`, mirroring `getAwards`'s pattern exactly): returns chronological history plus per-poll highest/average (each computed only over weeks that poll actually ranked the team in, since AP/Coaches/CFP don't always agree on who's ranked).
- `RankingChart.tsx`: hand-rolled SVG line chart (no new charting dependency â€” matches this project's existing zero-extra-deps posture) per the dataviz skill's method: 3 fixed-order Okabe-Ito colorblind-safe series colors (never cycled), inverted rank axis (#1 at top), unranked (`0`) weeks render as a labeled "NR" gap rather than a fake best-possible point, 2px lines with rounded joins, ~4px/6px-on-hover markers, a real per-point hover tooltip, an always-present legend, and a "Show as table" toggle as the accessible non-chart fallback.
- `Rankings.tsx`: new dynasty page â€” current/season-high stat tiles per poll, the chart (or an honest "only one snapshot so far" message below 2 points), and a plain-language rank-vs-record summary (first-vs-last comparison, not a fabricated statistical correlation â€” not enough data points to support one, and the roadmap only asked to relate the two, not to compute a coefficient). New "Rankings" tab in `DynastyLayout.tsx`, routed in `app.tsx`.

**Errors hit & fixes:**
- None in the data/logic layer â€” typecheck/lint were clean on every pass, and the live diagnostic runs matched expectations on the first real-data test (correct week derivation, correct upsert idempotency, correct highest/average math).
- Environment-only: mid-session, live GUI screenshot verification via the `capturePage()` diagnostic route started hanging indefinitely â€” reproduced across both a previously-broken dynasty route and a previously-*working* one, which rules out a code regression (the identical route had already rendered correctly multiple times earlier in the same session). Traced to process/GPU-cache contention from many rapid sequential Electron launches in one sitting, not the app itself â€” the fully headless `DIAGNOSTIC_IMPORT_PATH` path (no `BrowserWindow`) kept working perfectly throughout, including in a final post-cleanup sanity check. Diagnostic hooks were still fully removed from `main.ts` afterward per this project's standing discipline, whether or not the last capture succeeded.

**Verification:** `npx tsc --noEmit`, `npx eslint`, and a clean `rm -rf dist && webpack` build all pass with zero errors, both mid-session and in the final post-cleanup state. Real end-to-end testing against actual saves, not just reasoning about the code:
- Headless diagnostic import against a real completed-season Miami save (14-2) correctly recorded `week: 20, mediaPollRank: 1, coachesPollRank: 1, cfpRank: 3` â€” re-running the identical import twice more left exactly one row for week 20 (upsert idempotency confirmed, not just assumed).
- A legacy dynasty imported in an earlier session (predating this migration) correctly showed `historyRows: 0` after the migration ran â€” confirming the migration doesn't retroactively fabricate data for dynasties that haven't been re-imported since.
- Visually confirmed (screenshots, before the environment issue above) the full Rankings page render â€” header, 6 stat tiles, the chart with 3 correctly-colored/ordered series, the inverted axis, the "NR" gap for a synthetic unranked week, and the rank-vs-record summary sentence â€” using 4 temporarily-seeded synthetic weeks (deleted immediately after, verified deleted via a follow-up diagnostic read showing the real single week-20 row again, nothing fabricated left behind).
- Scripted real DOM interaction (not just static screenshots): hovering a chart point produced the correct tooltip text ("Week 20 / CFP Rank: #3 / Record: 14-2"); clicking "Show as table" correctly swapped in a 5-row table matching the seeded data exactly.
- Did **not** get a live screenshot of the zero-history empty state before the environment became unresponsive â€” verified instead by reading the code path directly (`rankings.history.length === 0` short-circuits before the chart is even mounted, `getRankings()`'s highest/average helpers already correctly return `null` for an empty array by construction). Low-risk gap: worth a quick live confirmation next session before considering this fully closed.

**No new dependencies added.**

---

## Launcher â€” instant pre-splash + real single-instance lock

Direct response to user feedback: launching via `Launch CFB Dynasty Hub.bat` showed the hidden-console handoff correctly, but then sat on a black/empty desktop for a long stretch before anything appeared, and once the splash finally showed it was only up for "about half a second" before the main app popped in â€” the opposite of reassuring, and the user was specifically worried it looked like nothing was happening (risking a second double-click and two instances fighting over the same SQLite file).

**Root cause, not just a timing tweak:** Electron cannot paint anything until its own process finishes booting â€” a hard platform constraint, not a bug. Everything before that (the `.bat`'s hidden-console relaunch, the `node_modules`/rebuild-needed checks, `npx` resolving the local `electron` binary, Electron's own native cold start) is real wall-clock time with nothing on screen, and no amount of tuning the *existing* Electron splash's own display-minimum could fix that â€” it was already showing correctly, it just couldn't start until deep into the sequence.

**Fix â€” a genuinely separate, non-Electron pre-splash:** `scripts/pre-splash.hta` (a Windows HTML Application â€” one of the few things the OS can render close to instantly without a compiled native binary) shows the exact same image as the real Electron splash (`public/assets/splash/spshscr.png`), sized/centered identically, launched as close to the very first instant of the double-click as possible â€” moved into `hidden-relaunch.vbs` itself (which now also launches it) rather than waiting for the `.bat`'s second hidden `cmd.exe` to boot and reach its own launch line, shaving one extra process-spinup off the critical path. It polls a ready-flag file every 100ms and closes itself the moment `main.ts` writes that flag â€” which now happens the instant the *real* Electron splash becomes visible (`ready-to-show`), so the handoff between the two is a same-image swap, not a visible transition. A 30s safety timeout (and an explicit close on the `.bat`'s `:failed` path) means a startup failure never leaves it stuck on screen. `HTA:APPLICATION SINGLEINSTANCE="yes"` means the `.bat`'s own later (now redundant, kept for resilience) launch of the same file just re-activates the existing window instead of opening a second one. An indeterminate animated bar plus a cycling status label ("Starting..." â†’ "Preparing workspace..." â†’ "Almost there...") give this phase its own "something is happening" signal, distinct from the real Electron splash's genuine step-by-step progress bar â€” this phase has no real progress to report yet (Electron hasn't even started), so it's honest about being indeterminate rather than faking a percentage.

**Sizing follow-up (same day, user caught it live):** the first shipped version rendered the pre-splash at some much-larger-than-intended default size (close to 75% of the primary screen â€” IE's classic fallback for a rejected requested size), with the image stranded in a corner of a big gray field, rather than the intended 868Ã—420 (spshscr.png's exact native resolution â€” confirmed by reading the PNG's own IHDR chunk directly rather than assuming; `SPLASH_WIDTH`/`SPLASH_HEIGHT` in `main.ts` were updated to the same 868Ã—420 so the real Electron splash matches exactly too, with neither ever scaling or cropping the image). Tried three in-HTA mechanisms first â€” `HTA:APPLICATION WIDTH`/`HEIGHT` attributes, and a script-based `window.resizeTo`/`moveTo` â€” none took effect reliably when actually tested. A `screen.deviceXDPI`/`logicalXDPI` probe ruled out DPI virtualization as the cause (both 96, no scaling on this display). The fix that actually worked: a new `scripts/force-resize-pre-splash.ps1`, launched by `hidden-relaunch.vbs` right after `mshta.exe`, that forces the window's bounds from *outside* via the Win32 API (`MoveWindow`) â€” deterministic where the HTA-internal mechanisms weren't. One more real bug surfaced building even that: the obvious approach, `FindWindow(NULL, title)`, returned a null handle for this specific HTA host window class even for an exact title match â€” confirmed directly by comparing it against `EnumWindows` (which found the same window fine) in a side-by-side diagnostic, not assumed. Fixed by matching via `EnumWindows` + manual `GetWindowText` comparison instead of `FindWindow`. The pre-splash's window title is deliberately `"CFB Dynasty Hub Pre-Splash"`, not `"CFB Dynasty Hub"` (which the real Electron splash/main window use), specifically so this resize logic can never grab and resize one of Electron's own windows in a race.

**Real single-instance lock, not just visual discouragement:** added `app.requestSingleInstanceLock()` â€” a genuine correctness fix for the "risk of multi opening the app" the user named as their actual worry, independent of how fast the splash appears. A second launch while the first is still starting now quits immediately and focuses the existing window instead of racing it for the same SQLite file.

**Errors hit & fixes:**
- First verification attempt showed the pre-splash and app taking an oddly long time and the launch log full of a giant one-line `TypeError` dump â€” traced (matching a pattern this project already hit repeatedly earlier this session) to `ELECTRON_RUN_AS_NODE=1`, but this time confirmed it's persisted as a real **User-scope Windows environment variable** (`HKCU\Environment`, not just an ephemeral property of one shell), which any *newly-spawned* process picks up â€” including my own test automation's `Start-Process` calls. Confirmed this does **not** affect the user's actual double-click launches: their already-running Explorer session predates whenever that variable was set, and Windows only refreshes a running process's environment at its own creation time, not live. Left the variable alone (it's outside this app's control and plausibly deliberate for this dev sandbox, per the Phase 0 note it was already documented against) and just made sure my own verification commands cleared it before spawning test processes.
- The VBS's earlier pre-splash launch initially created a race: if a stale ready-flag file from a previous run was still on disk, the newly-launched HTA's very first 100ms poll could see it and close itself instantly, before the `.bat` got a chance to clear it. Fixed by having the VBS itself delete the stale flag before launching the HTA, rather than relying solely on the `.bat`'s later cleanup.

**Verification:** typecheck/lint/clean build all pass, both before and after the sizing follow-up. Real end-to-end launches (not just reasoning about the script) via actual `Start-Process` invocations of the real `.bat` file, with full-desktop screenshots (`System.Drawing`/`CopyFromScreen`, not `capturePage()` â€” nothing here is inside an Electron `webContents`) captured at multiple timestamps within a single atomic PowerShell run to avoid cross-tool-call latency contaminating the timing: confirmed the pre-splash renders the correct image and appears well before the real app, stays up continuously with no gap or premature close through the entire boot sequence, and hands off cleanly to the fully-loaded main window with no crashes, no stuck states, and no leftover flag/log files after a normal run. For the sizing fix specifically, verified with `GetWindowRect` before/after the resize call (exact `868Ã—420` at the requested position, not just "looks about right" from a screenshot) and then re-confirmed visually via the real `.bat` launch end-to-end. Total observed boot time in this session's testing was longer than a clean machine would see (heavy accumulated system load from many hours of continuous Electron/webpack/screenshot work in this same session) â€” the property actually being verified, continuous visible feedback with no black gap and no early flash, held regardless.

**Filenames created:** `scripts/pre-splash.hta`, `scripts/force-resize-pre-splash.ps1`.

**Filenames modified:** `src/main/main.ts` (single-instance lock, `signalPreSplashReady()`, `SPLASH_WIDTH`/`SPLASH_HEIGHT` â†’ 868Ã—420), `Launch CFB Dynasty Hub.bat`, `scripts/hidden-relaunch.vbs`.

**No new dependencies added.**

---

## Phase 9 â€” Recruiting Pipeline

Next feature after Rankings, by user choice. The existing `extract-recruits.ts` from Phase 1 was a rough placeholder â€” no team scoping, no commitment status, no bio fields â€” clearly never built out; this phase replaced it entirely after investigating the real save data first, per this project's standing discipline.

**Investigated first, real save (Miami):** the leaguewide `Recruit` table has 4,101+ real rows â€” almost all irrelevant to a single team. The real per-team data lives at `Team.RecruitingBoard` â†’ `RecruitingBoard.Recruits` (a fixed 35-slot array, 31 filled on the real save) â†’ `UserRecruitTarget` rows, each with team-specific fields (`ScholarshipStatus`: `'Offered'`/`'None'`, `IsFavorite`, NIL expectation/offer, `CommittedWeekNumber`) layered over the prospect's own leaguewide `Recruit` record (`RecruitStage`: `Top10`/`Top5`/`Top3`/`SoftCommitted`/`Signed`/`Battle`/`Invalid`, plus national/position/state rank) and that recruit's `Player` bio (name, position, stars, archetype, hometown â€” same `Player` table real roster players live in). Confirmed directly, not assumed, that a signed recruit's `Player.TeamIndex` stays a sentinel `255` even after signing (checked 5 real "Signed" recruits) â€” so which team they signed with is **not** derivable from the roster-side data at all; it only exists via this team's own `CommittedWeekNumber`.

**Real bug found during verification:** `ProspectStarRating` looked numeric in the roadmap's mental model but is actually a string enum (`"ONE_STAR"`..`"FIVE_STAR"`) â€” a plain `Number(...)` silently produced `NaN` (`null` in the extracted JSON) for every recruit, caught by actually reading the diagnostic output rather than assuming the field worked because nothing threw. Fixed with a small word-to-number parser (`parseStarRating`).

**Design decision â€” derived board stage, not a stored field:** the roadmap's Kanban stages (Watching â†’ Offered â†’ Committed â†’ Signed, plus a real "Lost" case the roadmap didn't anticipate) don't exist as a single save field. They're derived in `getRecruits.ts` from the combination of this team's `scholarshipStatus`/`committedWeekNumber` and the recruit's own leaguewide `recruitStage`: a recruit with `recruitStage === 'Signed'` but `committedWeekNumber === 0` signed with a **different** school (`'lost'`) â€” a real, common case (9 of 31 on the real Miami board), not an edge case worth hiding.

**Scope decisions (what the roadmap asked for that the save doesn't support):**
- **National class rank / conference class rank** â€” no new extraction needed; reused the already-extracted `TeamData.topClassRank` (added `topClassConferenceRank`, one real field, same table read) rather than crawling the full leaguewide recruit pool to compute a rank ourselves.
- **"Class comparison to previous years"** â€” not built. Would need multiple seasons' recruiting boards, and a signing class isn't necessarily "final" at the moment of any given import â€” flagged as a real gap rather than faking it with data that might not represent a completed class.
- **Decommit tracking** â€” not built. A single save snapshot has no record of "was committed, now isn't" (same class of limitation as the Rankings' rank history â€” nothing in this save is a time series, only current state). The commitment timeline explicitly says so in its own UI copy rather than silently omitting the caveat.
- **Recruit profile modal / deep-dive view** â€” not built as a separate modal. Recruits aren't real roster players (no stats/gamelog/career â€” `PlayerProfileContent` would hit the same "not on this team's roster" case the Awards fallback profile handles), and the board's own cards already carry enough real fields (stars, ranks, hometown, archetype, class year, OVR, NIL) that a second view would mostly repeat the same data â€” kept the cards information-dense instead of building a redundant modal.

**Shipped:**
- `extract-recruits.ts` rewritten: resolves the full `Team â†’ RecruitingBoard â†’ Recruits[35] â†’ UserRecruitTarget â†’ Recruit â†’ Player` reference chain (same `preloadAllInstances`/`resolveReferenceWithTable` pattern used throughout this codebase; `RecruitTarget[]` has the same literal-brackets array-table naming this project has hit repeatedly â€” `SeasonStats[]`/`GameStats[]`/`HeismanAwardRanking[]` and now this).
- `extract-teams.ts`: added `topClassConferenceRank` (one new field, `TopClassConferenceRank`, same `Team` read already in place).
- `database/getRecruits.ts` + full IPC round-trip (`getRecruits` on `DynastyApi.db`, same pattern as `getAwards`/`getRankings`): derives board stage, class summary (signed/committed counts, average stars, position breakdown, class ranks), and a real commitment timeline, all from the single `recruits` snapshot â€” nothing computed here can drift out of sync with the board itself since it's all derived in one place.
- New `Recruiting.tsx` page/tab: class summary stat tiles, position breakdown, commitment timeline, and five stacked sections (Signed/Committed/Offered/Watching/Lost) rather than a literal drag-and-drop Kanban â€” this app has no drag-and-drop library and the data isn't user-editable from here anyway, so a static editorial layout (matching the Awards/Rankings visual language) was the right fit, not a generic project-management widget. Removed "Recruiting" from `Sidebar.tsx`'s "Planned Modules" list.

**Verification:** typecheck/lint/clean build all pass. Real end-to-end diagnostic import against the real Miami save confirmed the exact 31-recruit board total, the star-rating fix (real values 1-5 instead of `null`), and the class/conference rank numbers (`#11` national, `#2` conference, matching `TeamData.topClassRank`/`topClassConferenceRank` read directly). Full-page visual verification via a live screenshot against the real Miami save confirmed all five board sections, the position breakdown, and the commitment timeline (Week 10 Jelani Boger, Week 14 Austin Mauldin) render correctly with real data, not placeholders. ~~2 Signed, 0 Committed, 19 Offered, 1 Watching, 9 Lost â€” the 5 stage counts summed to exactly 31~~ â€” **this specific split was wrong.** The "5 stage counts sum correctly" check verified the *total* was right, not that each recruit landed in the *correct* stage â€” the signed/lost split itself was based on a field (`committedWeekNumber`) that doesn't actually mean what it was assumed to mean. See the "Phase 9 follow-up" entry below: real counts are 11 Signed / 19 Offered / 1 Watching / 0 Lost. Left here as a record of the gap between "the math checks out" and "the classification is correct" â€” they're not the same claim.

**Filenames created:** `src/database/getRecruits.ts`, `src/renderer/pages/Recruiting.tsx`.

**Filenames substantially rewritten:** `src/extractors/extract-recruits.ts`.

**Filenames modified:** `src/extractors/extract-teams.ts` (`topClassConferenceRank`), `src/extractors/extract-all.ts` (pass `userTeamIndex` to `extractRecruits`), `src/shared/types.ts` (`RecruitBoardStage`/`RecruitBoardEntry`/`RecruitingClassSummary`/`RecruitingTimelineEntry`/`RecruitingOverview`), `src/shared/ipcChannels.ts`, `src/main/ipc/database.ts`, `src/main/preload.ts`, `src/renderer/components/common/DynastyLayout.tsx` (new tab), `src/renderer/components/common/Sidebar.tsx` (removed "Recruiting" from planned modules), `src/renderer/app.tsx` (new route).

**No new dependencies added.**

---

## Phase 9 follow-up â€” team logos + a real "signed team" correctness bug

User feedback: add each recruit's signed-team logo next to their name in the Signed and Lost sections. Investigating that turned up a real, visible bug in the *original* Phase 9 work â€” not just a missing feature.

**The ask required data that hadn't been extracted yet.** The board only carried this team's own view of a prospect (offer status, `committedWeekNumber`); nothing said *which* school a "Signed" prospect actually landed at. Investigated before building anything: `Player.TeamIndex` stays a sentinel `255` for a prospect even after signing (already known from the original Phase 9 pass), and a new leaguewide field, `Team.CommittedPlayers` (a 35-slot array of real `Player` rows per team â€” the same shape as a recruiting board, but for prospects who signed *with that team*), turned out to be the answer. Verified before trusting it: built a full leaguewide reverse lookup (playerId â†’ team) from every real team's own list and confirmed **zero cross-team collisions** across all 1,538 real signed players leaguewide â€” a clean, exclusive, authoritative source, not a guess.

**That verification exposed the real bug.** The original Phase 9 "Signed vs. Lost" split used `committedWeekNumber > 0` as the deciding signal. Cross-checking real "Lost" recruits from the shipped page against the new `CommittedPlayers`-based lookup found they'd actually signed **with the user's own team** â€” `committedWeekNumber` only gets populated during the pre-signing soft-commit phase and is never retroactively set once a prospect reaches `'Signed'`, so any recruit who signed without an intermediate tracked soft-commit was being misclassified as lost. On the real Miami save this wasn't a one-off: the Signed count was undercounted by nearly half (2 shown vs. the real 11), and every one of those 9 "Lost" cards was actually a real Miami signee shown as having gone elsewhere â€” exactly the kind of confidently-wrong data this project's verification discipline exists to catch. Fixed `deriveStage()` to compare the newly-resolved `signedTeamDisplayName` against the team's own name instead, and corrected the doc comments in both `shared/types.ts` and `getRecruits.ts` to explain why `committedWeekNumber` isn't the right signal, so this doesn't get reintroduced later.

**Shipped:**
- `extract-recruits.ts`: new `buildSignedDestinationMap()` â€” one leaguewide pass over every real team's `CommittedPlayers` list, building the `playerId -> {displayName, assetName}` lookup described above. `RecruitData` gains `signedTeamDisplayName`/`signedTeamAssetName` (both null until a prospect reaches `'Signed'`).
- `getRecruits.ts`: `deriveStage()` fixed to use the resolved destination team instead of `committedWeekNumber` for the signed/lost split.
- `Recruiting.tsx`: each recruit row now shows a small (25%) `TeamLogo` for their signed destination â€” present for both the Signed section (the user's own team) and the Lost section (whichever school actually signed them), exactly as asked. Nothing shown for recruits who haven't signed yet.

**Verification:** typecheck/lint/clean build all pass. Re-verified against the real Miami save after the fix: Signed count corrected from 2 to 11, all 11 showing the correct (Miami) logo; the board's totals still sum correctly (11 Signed + 0 Committed + 19 Offered + 1 Watching = 31, matching the known board size) â€” and, tested honestly rather than assumed, this particular board currently has zero genuinely-lost recruits. ~~so the Lost section correctly renders nothing rather than fabricating an empty-but-present section~~ â€” **superseded same day**, see the next follow-up entry: the user wanted the section to stay visible with an honest empty state rather than disappear, which is a real, reasonable preference this entry got backwards. Full-page live screenshots confirmed the corrected counts, the position breakdown, and the logo rendering in the Signed list.

**No new dependencies added.**

---

## Phase 9 follow-up #2 â€” fixed logo (wrong field used), gold variant, persistent Lost section, sortable columns

Direct user feedback on the just-shipped logo feature, all real and addressed:

**"The logo is only showing a generic NCAA logo."** Real bug: `signedTeamAssetName` was populated from the save's own raw `Team.AssetName` field (e.g. `"hurricanes"` for Miami), but this app's logo lookup (`getLogoPath`/`TEAM_3D_LOGOS`) is keyed by *normalized display name* (`"miami"` â†’ `Miami.png`), not the game's internal asset-name string â€” confirmed by checking the one other place in this codebase that successfully renders another team's logo (`Awards.tsx`'s `TeamLine`), which passes `teamDisplayName`, not any raw asset field. `"hurricanes"` matched nothing, silently fell back to the generic mark. Fixed by dropping `signedTeamAssetName` entirely and using `signedTeamDisplayName` (already resolved correctly) for both the label and the `TeamLogo` lookup.

**"Signed should use the gold variant."** `public/assets/3d_logos/png_gold/` (143 files, `{Team}_gold.png`) already existed on disk but had never been wired into any code (flagged as an unwired asset back in the original 3D-logos work). Added a `'gold'` option to `getLogoPath`'s background parameter and a `variant="gold"` prop on `TeamLogo`, explicit per-usage rather than tied to theme appearance (a celebratory choice, not a light/dark one). Applied to the Signed section only â€” Lost still uses the normal light/dark logo of whichever other school actually signed them, since "gold" specifically signals "joined our program."

**"The Lost section disappeared â€” I liked that feature."** This was **not a bug** â€” the previous follow-up's fix correctly found that this particular board currently has zero genuinely-lost recruits (all 11 "Signed"-stage prospects on Miami's board actually signed with Miami). But hiding the section entirely when empty was a real UX regression the user rightly flagged: there's no way to tell "this feature is empty right now" from "this feature broke." Fixed by never hiding a stage section â€” each of the five now always renders, showing "No recruits currently in this stage" instead of nothing when empty. Real, not fabricated: the moment this board actually has a lost recruit, the table (with their real signed-team logo) replaces the empty state automatically, no additional wiring needed.

**"Nat #, Pos #, City, State, Class, and Style in separate sortable columns."** Rebuilt each stage's flowing text-block rows into a real `<table>`, matching this app's existing `Roster.tsx`/`Awards.tsx` table conventions exactly (`SortableHeader` pattern, click-to-sort with a visible direction indicator, sensible per-column default direction â€” rank/position columns default ascending since #1 is best, stars/OVR default descending). Each of the five stage sections owns independent sort state, so e.g. Offered can be sorted by star rating while Signed stays sorted by national rank. Unranked (`0`) values sort last regardless of direction rather than appearing as a misleading "best."

**Shipped:**
- `assetMapping.ts`: `getLogoPath` gains a `'gold'` background option; new `THREE_D_GOLD_BASE_PATH`.
- `TeamLogo.tsx`: new `variant?: 'gold'` prop, overrides the theme-driven light/dark choice when set.
- `extract-recruits.ts`: dropped `signedTeamAssetName` (was wrong on principle, not just in this instance); `buildSignedDestinationMap` now returns a plain `Map<number, string>` (display name only).
- `Recruiting.tsx`: full table rewrite â€” `RecruitTable` (sortable, per-section state), `SortableHeader`, a `showLogo`/`logoVariant` pair on each `STAGE_ORDER` entry, and `BoardSection` now always renders (empty state instead of `null`).

**Verification:** typecheck/lint/clean build all pass. Re-verified against the real Miami save: cropped a screenshot down to pixel level on the "Signed With" column to confirm the logo is visibly gold-toned, not the standard color (a real visual check, not just "the code path looks right"); confirmed the Lost section renders its empty state rather than disappearing; confirmed sorting is genuinely interactive by scripting real clicks on the Stars column header and reading back the resulting row order changing twice (ascending then descending), not just checking that a sort function exists.

**No new dependencies added.**

---

## Phase 5 follow-up — Conference Standings

Direct follow-up to one of the oldest honest gaps left in the app: conference membership had already been solved for schedule classification (`TeamData.conferenceName` via inverted `Conference.TeamSlots`), but there was still no actual standings page using it.

**Shipped:**
- `src/database/getStandings.ts` — new standings aggregation over the existing `teams` season snapshot. No new extractor or schema change needed; it groups by the already-resolved `conferenceName`, computes overall record from the existing conference/non-conference splits, and returns every conference in one payload.
- `src/shared/types.ts`, `src/shared/ipcChannels.ts`, `src/main/preload.ts`, `src/main/ipc/database.ts` — added a new `getStandings` IPC round-trip mirroring the existing season-scoped pages.
- `src/renderer/pages/Standings.tsx` — new page with season selector, conference selector, conference logo when available, a 7-column standings table (`# / Team / Conf / Overall / AP / Coaches / CFP`), and user-team highlighting.
- `src/renderer/app.tsx` + `src/renderer/components/common/DynastyLayout.tsx` — new `/dynasty/:id/standings` route and a new `Standings` tab in the dynasty nav, placed alongside Schedule/Coaches/Awards/etc rather than hidden in the old sidebar-planned-modules area.

**Scope decisions:**
- No fabricated tiebreak logic. The save exposes conference and overall records plus current poll ranks, but not a full internal standings/tiebreak engine, so sort order is explicitly editorial and documented in the UI: conference record first, then overall record, then current AP/Media rank, then team name.
- No separate conference-champion inference here. The page is a live table snapshot, not a replacement for the already-existing conference-championship trophy work.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---
## Phase 5 follow-up #2 — Standings visual cleanup + conference-card logo treatment

Direct follow-up to the first standings ship. This pass was entirely about reducing redundancy, making the summary strip carry more useful conference-wide context, and making the conference logos behave like real hero assets instead of tiny labels inside padded boxes.

**Shipped:**
- `src/renderer/pages/Standings.tsx` was reworked so the top summary strip now uses four fixed cards: logo-only conference card, `Teams in Top 25`, `Record vs Non-Conference`, and `Overall Record`.
- Removed the duplicate conference-name text block, the old "Your Spot" / "Team Leader" cards, and the separate explanatory banner that repeated the conference name again.
- Conference champions are now surfaced directly in the standings table with a trophy icon in-row instead of relying only on separate trophy-case context elsewhere.
- User-team identification is now handled by row treatment alone rather than an extra "Your Team" badge, which cleaned up repeated labeling and made the table scan more like a real standings board.
- `src/renderer/components/common/ConferenceMark.tsx` was tuned specifically for standings-card use so conference marks can fill the fixed tile footprint much more aggressively while still respecting odd SVG aspect ratios.
- The standings conference tile now behaves like a floating logo treatment: fixed card dimensions, centered content, no visible interior logo box chrome, and logo scaling that prefers using the full available width for long horizontal marks and the full available height for taller marks.
- The standings summary cards were kept at fixed dimensions even when different conference logos changed, so swapping assets no longer shifts neighboring tiles or causes page-level jitter.

**Scope decisions:**
- `Independent` / `Unassigned` were removed from the conference selector and standings presentation. These default FCS schools do not maintain meaningful standalone conference standings in this save flow, so showing them created noise without real user value.
- Conference-logo sizing remains a renderer concern, not a per-asset hardcoded map. The recent SVG replacements fixed many bounding-box inconsistencies at the source, and the app now aims for a single large baseline presentation rather than conference-by-conference manual exceptions.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- Follow-up standings-card/logo pass re-checked with `npm.cmd run typecheck` and `npm.cmd run build`

**No new dependencies added.**

---

## Phase H follow-up — Coach portraits wired from extracted save data

User added a real coach-portrait asset pack under `public/assets/coaches` and asked that coach images resolve automatically anywhere the app already mentions those coaches.

**Investigated first, real save schema:**
- The `Coach` table exposes multiple portrait-adjacent fields (`AssetName`, `GenericHeadAssetName`, `Portrait`, `PresentationId`), so this pass first confirmed which one was actually stable enough to map onto the imported asset filenames rather than guessing from the coach name.

**Shipped:**
- `src/extractors/extract-coaches.ts` now emits a portrait-facing asset key (`portraitAssetName`) alongside the existing coach snapshot fields.
- `src/database/getCoaches.ts` and `src/shared/types.ts` were updated so portrait metadata survives the extraction → persistence → IPC → renderer path cleanly.
- New `src/renderer/lib/coachAssetMapping.ts` resolves extracted coach portrait identifiers into `public/assets/coaches` image paths.
- New `src/renderer/components/common/CoachPortrait.tsx` centralizes fallback behavior instead of duplicating `<img>` error handling across pages.
- Coach portraits were wired into the main staff-facing surfaces that already mention those coaches, including `src/renderer/pages/Coaches.tsx` and the coach spotlight/hero usage on `src/renderer/pages/DynastyOverview.tsx`.

**Verification:**
- Real save-field inspection to compare available `Coach` portrait identifiers against on-disk coach asset naming before wiring the mapper
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---

## Phase Overview follow-up — "Team Hub" rename + new NCAA Hub page

The old `Overview` page was renamed to `Team Hub`, and a second editorial page was added to cover the broader national picture instead of only the user's team.

**Shipped:**
- `src/renderer/components/common/DynastyLayout.tsx` and route wiring now label the existing season-overview page as `Team Hub`.
- New `NCAA Hub` page/route was added to the dynasty navigation so the app has a league-wide editorial surface alongside the team-specific one.
- `src/database/getNcaaHub.ts` and its IPC plumbing were added to derive a national snapshot from the imported save: AP / media Top 25 context, Heisman winner/finalists, featured game, upset-of-the-week style storytelling, upcoming matchups, playoff picture, recruiting buzz, and coach spotlight material.
- `src/renderer/pages/NcaaHub.tsx` was built as a magazine-style hub rather than another plain stats screen, with logo-first matchup presentation for marquee games and postseason contexts.
- `src/renderer/pages/DynastyOverview.tsx` kept its original purpose as the current-season overview for the user's team; only the title and framing changed.

**Scope decisions:**
- No fabricated poll-movement arrows were added in the first NCAA Hub pass. The save gives a strong current national snapshot, but without reliable week-by-week accumulation in this view, fake up/down indicators would have implied precision the data did not yet support.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---

## NCAA Hub follow-up — editorial polish pass + broader national story mix

Direct follow-up to the initial NCAA Hub ship. User wanted the page to feel more like a sports homepage with tighter flow, more storylines, and richer league context.

**Shipped:**
- `src/shared/types.ts` gained `NcaaHubRecordWatchEntry` and `NcaaHubConferenceLeader`, and `NcaaHubOverview` now carries `undefeatedWatch`, `oneLossWatch`, and `conferenceLeaders`.
- `src/database/getNcaaHub.ts` now derives those extra national-story buckets directly from the team snapshot rather than leaving the page too dependent on one or two feature cards.
- `NcaaHubCoachSpotlight` now includes `coachPortraitAssetName`, allowing the spotlight to use the same real coach-image pipeline as the rest of the app.
- `src/renderer/pages/NcaaHub.tsx` added more editorial sections such as `National Notebook`, `Undefeated Watch`, `One-Loss Radar`, and `Around The Conferences`, plus a tighter front-page layout that carries more "sports site" energy without cutoff text or oversized dead space.
- Marquee matchup treatments were kept logo-first so big games, bowls, and playoff contexts read visually before the user has to parse the text.

**Errors hit & fixes:**
- User referenced `devlod.md`, but the real project handoff file is `DevLog.md`. Logged here so the next dev does not waste time searching for a second parallel journal file that does not exist.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- Did not treat `npm.cmd run build` as reliable during this pass because portrait asset conversion in `public/assets/playerportrait` was actively mutating files mid-session

**No new dependencies added.**

---

## Phase roster/profile follow-up — Player portrait pipeline restored (asset conversion still in flight)

User wanted player portraits shown in roster gallery cards and on the player profile page, but only if the app could resolve the real face assets cleanly. The first pass was intentionally rolled back when only a subset of players rendered; once the user confirmed the missing issue was an unfinished DDS → PNG conversion, the pipeline was restored so it can immediately begin resolving faces as those conversions finish.

**Shipped:**
- `src/extractors/extract-roster.ts` again emits `portraitAssetName` from the real roster snapshot so player portraits can be matched by extracted asset identifier rather than guessed from player names.
- `src/shared/types.ts` now carries `portraitAssetName` through the roster/player profile data flow.
- New `src/renderer/lib/playerAssetMapping.ts` resolves extracted player portrait identifiers against `public/assets/playerportrait`.
- New `src/renderer/components/common/PlayerPortrait.tsx` centralizes portrait candidate resolution and fallback behavior.
- Portraits are intentionally scoped to `src/renderer/pages/Roster.tsx` gallery view and `src/renderer/components/common/PlayerProfileContent.tsx`, per the user's request. Table views remain text-first.
- Player profile portraits were sized to read large when available, but are capped so they do not upscale past their base asset dimensions.

**Scope decisions:**
- No player portrait is fabricated from name matching. This stays keyed off the extracted portrait asset identifier so once the DDS → PNG conversion completes, newly available portraits can resolve automatically without changing the matching logic again.
- The feature remains intentionally absent from other pages until coverage is confirmed good enough to avoid a patchwork "some players have faces, some do not" presentation everywhere.

**Errors hit & fixes:**
- `npm.cmd run build` was not stable during this pass because the user's ongoing portrait conversion process was actively changing files inside `public/assets/playerportrait` while Webpack was copying them, causing transient `ENOENT` failures against different portrait filenames on different build attempts. This is an environment race, not a code-path error.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build` attempted, but not considered trustworthy until the portrait conversion process finishes

**Handoff note:**
- After the DDS → PNG conversion completes, rerun a clean build and visually re-check roster gallery coverage.
- Dynasties imported before `portraitAssetName` was restored will need to be re-imported if full player portrait coverage is expected from their saved extraction snapshot.

**No new dependencies added.**

---

## Phase 10 - Program History & Records (first shipped slice)

Next roadmap item after Recruiting / Standings / NCAA Hub follow-ups. The app had no real long-view history page yet, but enough persisted snapshot data already existed to ship a useful first slice without inventing any new save semantics.

**Key architecture decision before building anything:** the schema already had planned normalized tables like `championships` and `program_milestones`, but those were never actually wired into the live import path; the real source of truth is still the per-season snapshot store. This pass therefore builds Program History directly from imported `teams`, `schedule`, `coaches`, `roster`, `gamelog`, and `conferenceChampionship` snapshots plus the existing season list, instead of pretending those dormant normalized tables are populated.

**Second important data decision:** the roadmap's all-time / single-season stat leaders could have been built from the `stats` snapshot's season totals, but `extract-stats.ts` still explicitly documents that the multi-year `SeasonStats[]` slot layout is unverified once a dynasty spans more than one season. Rather than overclaim certainty, this pass aggregates all-time and single-season records from the per-game `gamelog` snapshot across imported seasons. That gives a season-accurate record book from data already known-good, even if it means "history" only covers seasons that have actually been imported into this app.

**Shipped:**
- New `src/database/getHistory.ts` query: derives a full `ProgramHistoryOverview` from imported seasons only. Includes:
  - season timeline entries (record, conference record, current imported ranks, head coach, postseason summary, conference/national/playoff flags)
  - program summary metrics (overall record, conference titles, national titles, playoff appearances, bowl appearances/wins, 10-win seasons, undefeated seasons)
  - coaching ledger aggregated by head coach across imported seasons
  - milestone timeline derived from real season outcomes (conference titles, national titles, playoff appearances, bowl wins, 10-win seasons, undefeated seasons)
  - record book categories for passing yards, rushing yards, receiving yards, total touchdowns, tackles, and sacks, each with all-time leaders plus the best imported single-season mark
- `src/shared/types.ts`, `src/shared/ipcChannels.ts`, `src/main/preload.ts`, `src/main/ipc/database.ts`: new `ProgramHistoryOverview` type family and a new `getHistory` IPC round-trip.
- New `src/renderer/pages/History.tsx`: the first real Program History page, with a clear "imported seasons only" caveat in the header so users do not assume missing older years were magically reconstructed.
- `src/renderer/app.tsx` + `src/renderer/components/common/DynastyLayout.tsx`: new `/dynasty/:id/history` route and `History` tab.
- `src/renderer/components/common/Sidebar.tsx`: removed `History` from the old "Planned Modules" list, leaving only `Exports` there.

**Scope decisions:**
- This is intentionally a first slice, not the entire original roadmap dream for Phase 10.
- Not shipped yet: Legends Gallery, retired numbers, hall of fame, or a "top 10 all-time players" composite ranking. Those need a more opinionated scoring model and/or broader longitudinal data than this pass could support honestly.
- No fabricated "500th win" style milestones unless the imported-season window actually supports them; current milestone logic only surfaces events directly derivable from imported outcomes.
- The record book is "all-time across imported seasons," not "all-time across the dynasty's entire lifespan." That distinction is surfaced in the UI copy on purpose.

**Errors hit & fixes:**
- TypeScript caught a real type-safety gap while wiring the record book: `PlayerGameLogEntry.line` is a plain offensive/defensive union, not a discriminated union tied to `category`, so the first pass's offensive/defensive property reads failed typecheck even though the runtime branch was correct. Fixed by narrowing locally inside each branch before reading offense-only or defense-only fields.
- Re-hit the already-known build instability from the player's live portrait conversion work: `npm.cmd run build` failed in the renderer asset-copy phase with many transient `ENOENT` errors under `public/assets/playerportrait/*.dds` (different filenames than earlier passes, same underlying issue). This is the same environment race previously documented, not a Program History code bug.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build` attempted; main/preload bundles compiled successfully, but renderer asset copy failed with transient `public/assets/playerportrait/*.dds` `ENOENT` errors while the portrait folder was being mutated. Did not treat that as a regression in the new History code.

**Filenames created:** `src/database/getHistory.ts`, `src/renderer/pages/History.tsx`.

**Filenames modified:** `src/shared/types.ts`, `src/shared/ipcChannels.ts`, `src/main/preload.ts`, `src/main/ipc/database.ts`, `src/renderer/app.tsx`, `src/renderer/components/common/DynastyLayout.tsx`, `src/renderer/components/common/Sidebar.tsx`, `MASTER_ROADMAP_v2.md`.

**No new dependencies added.**

---

## Phase 10 follow-up - Real school record book + cross-season player honors

Direct follow-up to the first History ship. The user correctly called out that the page was mixing up two different things: real school history already carried in the save, versus this app's own imported-season accumulation.

**Key save-data finding:**
- The real school record book is present on every `Team` record via `CareerStatRecords`, `SeasonStatRecords`, and `GameStatRecords`.
- Those references resolve through `PlayerStatRecords` into `PlayerStatRecord`, which carries the actual historical holder name, position, calendar year, and stat value. This is the game's own school-history data, not something this app needs to derive from imported gamelogs.
- Verified directly against Texas State in `Dynasty Save Test/DYNASTY-DYNASTYBOWL`: built-in records such as Bradley George (career passing yards), Claude Mathis (career rushing yards), Brad Jackson (single-season passing yards), and Tyler Jones (single-game passing yards) all resolve cleanly from this path.

**Second save-data finding, important caveat:**
- The save also exposes `TeamSeriesHistory` on each team, and its current-season row resolves cleanly with fields like year, coach, record, final rank, conference, and postseason result.
- However, older historical rows pointed at very high table IDs (`16491` in the investigated Texas State case) that did not resolve through the current library/save surface, so built-in all-time counts for conference titles, national titles, and bowl wins were **not** wired from a trustworthy school-history source yet.
- Because of that, the page now explicitly separates `school record book` from `dynasty resume` instead of falsely presenting imported-dynasty counts as full school-history totals.

**Shipped:**
- `src/extractors/extract-teams.ts` now persists a real `schoolRecords` object on each `TeamData`, carrying the built-in career / season / game school records for passing, rushing, receiving, sacks, and interceptions.
- `src/database/getHistory.ts` was refactored so `records` now come from `userTeam.schoolRecords` instead of imported-season gamelog aggregation.
- `src/shared/types.ts` was updated to model this honestly:
  - school-record categories now hold `careerRecord`, `seasonRecord`, and `gameRecord`
  - top-line History summary fields were renamed to explicit `dynasty...` fields so they cannot be mistaken for full-school totals
- `src/renderer/pages/History.tsx` was redesigned around that split:
  - new header copy explaining the data source distinction
  - top summary tiles now read as dynasty-resume metrics
  - main record-book cards now show the save-backed school holders for career / season / game in each category
  - the imported-seasons framing was pushed down into a clearly-labeled `Dynasty Timeline` instead of leading the page
- `src/renderer/components/common/PlayerProfileContent.tsx` now loads awards across **all imported seasons** and groups them by year on the Honors card, so a current junior can still show earlier-season achievements like Heisman wins, weekly awards, or freshman All-Conference selections.
- The same multi-season honors aggregation also applies to leaguewide fallback profiles opened from Awards / Heisman contexts.

**Scope decisions:**
- Did **not** fake built-in school title counters. Until the unresolved historical team-history rows can be read reliably, conference-title / national-title / bowl-win totals remain dynasty-resume counts derived from imported seasons only.
- Did not yet build a fully merged longitudinal player-stat table beyond the save's own current career numbers. This pass specifically solved honors persistence and the school record book first.

**Verification:**
- Direct save inspection against `Dynasty Save Test/DYNASTY-DYNASTYBOWL` for the `Team -> {Career,Season,Game}StatRecords -> PlayerStatRecord` path and the partial `TeamSeriesHistory` behavior
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---

## Phase 10 follow-up #2 - Historical title-count probe blocked, imported multi-season stat rollups shipped

Follow-up to the school-history investigation. The next target was the game's built-in all-time title counts (conference titles / national titles / bowl wins), but the direct save probe hit a real data-boundary issue, so this pass pivoted into true imported multi-season rollups for players and coaches instead of faking the unreachable counts.

**Historical title-count investigation result:**
- `TeamSeriesHistory` looked like the most promising school-history path. The current-season entry resolved cleanly through `TeamHistoricSeriesYear` and exposes real fields like year, coach, record, conference, final rank, and postseason result.
- Older `TeamSeriesHistory` slots did **not** resolve inside the dynasty file. Their references pointed to table IDs like `16491`, while the readable dynasty file only exposes ~2,264 tables and `franchise.getTableById(16491)` / `getTableByUniqueId(16491)` both returned null.
- Similar "missing target" behavior also showed up on nearby history/trophy-style references like `16434` and `16455` from `LeagueHistoryManager`, `HistoryManager`, and `TeamAwardEvent`.
- Conclusion for now: the dynasty save clearly contains hooks into deeper historical/trophy data, but some of those references appear to leave the readable local save surface. Until that is solved with a verified companion/common-file source or a different parsing path, the app should **not** claim it can read full built-in school title counts.

**Shipped instead:**
- `src/renderer/components/common/PlayerProfileContent.tsx`
  - now loads roster + stat snapshots across **all imported seasons**, not just awards
  - adds `Imported career totals`, built by summing each imported season's season stat line for that player
  - adds an `Imported season history` table so a player profile now shows year-by-year imported production instead of only the current snapshot
  - preserves the earlier cross-season honors work, so stats and awards now both carry longitudinal context
- `src/renderer/pages/Coaches.tsx`
  - now builds an imported staff resume for each current coach using per-season `getCoaches(...)` + `getSchedule(...)` snapshots
  - each coach card now shows imported overall record, conference record, and imported season range on the user's staff
  - this is intentionally a team-result rollup for seasons on staff, not a fabricated coordinator-only performance metric

**Scope decisions:**
- Did not wire any "all-time school titles" tile from unresolved save references. Better to leave that gap explicit than misstate history.
- Multi-season player rollups are derived from imported season snapshots, not from the save's live `career` number alone, so the app can keep its own longitudinal view as the dynasty grows.
- Coaching rollups currently summarize staff tenure and team results on staff. They do not attempt invented coordinator-specific stats the save does not expose.

**Verification:**
- Direct save probing against `Dynasty Save Test/DYNASTY-DYNASTYBOWL` for `TeamSeriesHistory`, `LeagueHistoryManager`, `HistoryManager`, `TeamAwardEvent`, and related missing-table refs
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---
## Phase 10 follow-up #3 - History page honesty pass after the title-count blocker

This pass closes the loop on the school-history investigation from a product perspective, even though the underlying all-time title-count source is still blocked.

**What changed:**
- `src/database/getHistory.ts`
  - now tracks `bestMediaRank` across the dynasty archive so the summary can surface a useful result metric instead of a raw imported-season count
- `src/shared/types.ts`
  - added `bestMediaRank` to `ProgramHistoryOverview`
- `src/renderer/pages/History.tsx`
  - removed the low-value `Seasons Imported` resume tile and replaced it with `Best AP Finish`
  - added an explicit source note clarifying that all-time school title counts are **not** currently exposed by the readable dynasty save, so title totals shown on the page are dynasty-era only
  - tightened copy from "imported seasons" / "imported run" to cleaner archive- and dynasty-based wording

**Important product decision:**
- The page now favors honesty over pretending the unresolved title counters are full-school totals.
- Real school stat records remain save-backed and trustworthy.
- Title totals remain dynasty-archive rollups until a verified common-data / FTC extraction path is available.

**Verification:**
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

**No new dependencies added.**

---

## Phase 11 (first slice) — HTML Export

Handoff continuation: Claude was briefly down and ChatGPT/Codex covered several follow-ups (standings polish, roster badge removal, launcher pre-splash-only mode — all backfilled into this log above). On resuming, the proposed next priority ("Program history / records") turned out to already be fully shipped across Phase 10 and three follow-ups — re-verified by reading the actual current `getHistory.ts`/`History.tsx` rather than trusting the priority list, the same lesson as the earlier conference-championship mix-up this session. HTML export was the next item that direct inspection confirmed was genuinely still unbuilt (no `htmlExport`-anything existed anywhere in `src/`).

**Scope decision, made explicit before writing any code:** the roadmap's full Phase 11 spec (multi-page zip archives, ExportDialog/ExportPreview/ExportProgress components, interactive charts, team logos) is a multi-feature system, not a single slice. This pass ships the single-file, self-contained HTML branch of that spec only — the "Single `.html` file (self-contained)" bullet — using data already fully built and verified on the History page, so the new code is purely presentation (a template-literal HTML/CSS renderer) rather than new data extraction.

**Shipped:**
- `src/main/htmlExport.ts` — `buildHistoryExportHtml(history, { primaryColor, secondaryColor })`: pure function, no Electron/DOM dependency, renders a `ProgramHistoryOverview` (the exact same type `getHistory.ts` already produces) into a complete standalone HTML document. Inline `<style>` only (no external stylesheet/font/script references), `prefers-color-scheme` media query for dark mode, team-colored header gradient, all user-facing strings passed through a local `escapeHtml()` (the team name, coach names, and record-holder names are real user save data reflected back into raw HTML, so this isn't optional).
- `src/main/ipc/export.ts` — new `registerExportHandlers()`, mirroring the existing `registerFilesystemHandlers()`/`registerDatabaseHandlers()` pattern. Handles `export:historyToHtml`: loads the dynasty + history, builds the HTML, opens a native `dialog.showSaveDialog` defaulting to `"<Team> Program History.html"`, writes the file, returns an `ExportResult` (`{ success, message, filePath? }` — same shape family as the existing `ImportResult`).
- `src/shared/ipcChannels.ts`, `src/shared/types.ts` (`ExportResult`, `DynastyApi.export`), `src/main/preload.ts` — new `export.historyToHtml` round-trip, wired the same way every other `db.*` call already is.
- `src/main/main.ts` — `registerExportHandlers()` called alongside the other `register*Handlers()` calls in all three startup paths (diagnostic, pre-splash-only launcher mode, normal splash mode).
- `src/renderer/pages/Exports.tsx` (new) — single card explaining what's exported, an "Export as HTML" button with working/done/error states (shows the saved file path on success), and an explicit line naming what's *not* built yet (roster/schedule/awards exports, multi-page archives, logos, charts) so the page doesn't imply more than it does.
- `src/renderer/app.tsx`, `src/renderer/components/common/DynastyLayout.tsx` — new `/dynasty/:id/exports` route and `Exports` nav tab.
- `src/renderer/components/common/Sidebar.tsx` — `UPCOMING_LINKS` is now empty (Exports was the last item in it); the "Planned Modules" panel is now conditionally rendered instead of showing an empty box.

**Verification:**
- `npm run typecheck`, `npm run lint` (caught and fixed one real issue: an unescaped `'` in JSX text, `react/no-unescaped-entities`), `npm run build` — all clean.
- Real end-to-end test against `Dynasty Save Test/DYNASTY-DYNASTYBOWL` via a temporary diagnostic branch added to `main.ts`'s existing `DIAGNOSTIC_IMPORT_PATH` path (calls `getHistory` + `buildHistoryExportHtml` directly and writes to a scratch path, bypassing the native save dialog since that would block a headless run) — removed after verification. Confirmed a real 19,089-byte HTML file, correct team name (Texas State), correct counts (1 season, 1 milestone, 1 coach, 9 record categories), and spot-checked real record-holder data inline (Claude Mathis: 4,694 career rushing yards / RB / 1997, 1,595 single-season, 310 single-game — matching the exact figures already verified in the Phase 10 follow-up entry, confirming the export pulls the same real save-backed record book rather than a different/stale path).

**Scope decisions (deliberately deferred, not forgotten):**
- No roster, schedule, or awards export yet — only Program History.
- No multi-page `.zip` archive — single file only.
- No team logos or other images embedded — keeps the export a single dependency-free artifact; also sidesteps re-solving the asset-path problem for a file that will be opened outside this app's own `file://` context.
- No interactive charts — Program History has no chart content to export yet anyway (that's Rankings' job, not exported at all this pass).
- No `ExportDialog`/`ExportPreview`/`ExportProgress` component system from the original roadmap spec — a single button with inline status covers this slice's one export type.

**No new dependencies added.**

---

## Phase I — Dev Mode token editor

Live editor for Phase A's design tokens, previewing through Phase D's real components, with an explicit export workflow rather than ever rewriting source files while the app runs — per the roadmap's own constraint for this phase. Closes out the last undone item in the lettered A–K UI/UX track.

**Shipped:**
- New `src/renderer/components/common/DevTokenEditorMenu.tsx` — a navbar panel (matching `PreferencesMenu`/`StadiumDatabaseMenu`'s existing glass-panel convention: same underlay/gradient/shell classes, outside-click and Escape to close) that edits every field in `DesignTokens` (spacing ×7, radius ×5, shadow ×3, typography fontSans + fontSize ×7, motion duration ×3 + easing ×3 — 36 fields total) grouped into labeled sections.
- Every edit calls the existing `applyDesignTokens()` immediately, so the whole app re-themes live — no separate "apply" step. A "Live preview (real components)" strip at the top of the panel renders the actual `SurfaceCard`/`StatTile` components plus a sample button, so the preview can't drift from what real pages render.
- New `src/design/devTokenStorage.ts` — `loadDraftTokens()`/`saveDraftTokens()`/`clearDraftTokens()`, persisting the draft to `localStorage` under `cfb-dynasty-hub:dev-tokens`. `loadDraftTokens()` does a field-by-field validated merge against `DEFAULT_TOKENS` (same rigor as `StadiumDataProvider`'s `isStadiumInfo` pattern) rather than a bare `JSON.parse` cast, so a malformed or old-shape saved draft can't crash the app or apply `undefined` as a CSS value.
- `src/renderer/index.tsx` now calls `applyDesignTokens(document.documentElement, loadDraftTokens())` instead of always the shipped defaults, so a saved edit actually survives an app restart.
- "Copy as TypeScript" serializes the current draft as a paste-ready `export const DEFAULT_TOKENS: DesignTokens = {...}` block via `navigator.clipboard.writeText`, with a manual-select `<textarea>` fallback shown if the clipboard write fails. This is the explicit, deliberate step for turning a live draft into a real permanent default — the app itself never touches `defaultTokens.ts`.
- "Reset all to defaults" reverts to `DEFAULT_TOKENS` and clears the saved draft.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real scripted click test (not just code review): opened the panel via a synthetic click, edited the radius-sm field via a native input-value setter + `input` event (React-controlled inputs don't respond to a plain `.value =` assignment), and confirmed via `getComputedStyle` that the actual `--radius-sm` CSS custom property on `document.documentElement` changed (`0.125rem` → `2rem`) and was correctly persisted to `localStorage`. Cleared that test edit via the same diagnostic-hook mechanism afterward so it didn't leak into the real running app.

**No new dependencies added.**

---

## Corrupted-database recovery flow

Previously flagged as a known gap (Phase K's integration-pass entry above) rather than fixed: a corrupted/unreadable `dynasty-archive.sqlite` caused the app to quit silently with no explanation and no way back short of manually finding and deleting the file — and no backups existed anywhere to restore from, since `backupDatabase()` (present since Phase 1) had never actually been wired into any code path.

**Shipped:**
- `src/database/init.ts`:
  - New `DatabaseCorruptedError` — thrown specifically when the on-disk file exists but can't be successfully opened, distinct from other startup failures (missing wasm binary, out-of-memory) that have no defined recovery.
  - `initDatabase()` now catches that failure and throws the typed error, carrying the `dbPath` for the caller.
  - New `listBackups()` (every backup on disk, newest first), `pruneOldBackups(keep = 10)` (deletes anything beyond the most recent 10), `quarantineCorruptDatabase(dbPath)` (renames — never deletes — an unreadable file into a `corrupted/` folder so it's never silently destroyed, only ever moved aside), and `restoreFromBackup(backupPath)` (copies a backup over the live path; caller re-runs `initDatabase()` to actually load it).
- `src/main/main.ts`: new `initDatabaseWithRecovery()` wraps `initDatabase()`. On `DatabaseCorruptedError`: closes the pre-splash immediately (so it doesn't sit there for its full safety timeout while the dialog below waits), quarantines the bad file, and shows a native `dialog.showMessageBoxSync` with **Restore Backup** (only offered if a backup exists) / **Start Fresh** / **Quit**. Any other startup error still falls through to the original top-level `.catch()` unchanged — this only adds a recovery path for the one failure mode that's actually recoverable. On any successful init (normal, fresh, or just-recovered), a backup checkpoint is taken automatically and old ones pruned, so there's always a recent recovery point going forward — this is what finally puts the long-dormant `backupDatabase()` to real use.
- Wired into both real user-facing startup paths (`USE_PRE_SPLASH_ONLY` launcher mode and the normal splash mode). The one-shot `DIAGNOSTIC_IMPORT_PATH` headless path intentionally still calls plain `initDatabase()` — a diagnostic run corrupting mid-test isn't a scenario that needs a recovery UI.

**Errors hit & fixes (found only by actually testing the corrupted-file path, not by reading the code):**
1. **The recovery logic silently did nothing on a real corrupted file, despite looking correct on inspection.** Root cause: sql.js/SQLite doesn't validate the file format when `new SQL.Database(buffer)` is constructed — a garbage buffer "opens" without error and only throws once a real statement actually runs against it. The first implementation wrapped only the constructor call in the try/catch that produces `DatabaseCorruptedError`; the very next line, `db.run('PRAGMA foreign_keys = ON;')`, was outside that block and is where the real "file is not a database" exception actually threw, unwrapped, past the `instanceof DatabaseCorruptedError` check and out to a generic top-level failure. Found via a real diagnostic test (isolated temp `userData` directory via `app.setPath()`, never touching the real database) that imported a real save, manually corrupted the live file, and asserted on the literal outcome — the bug wouldn't have been caught by code review alone. Fixed by moving both initial `db.run()` calls inside the same try/catch as the constructor.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Full real-data round trip, isolated from the real database via a temporary `app.setPath('userData', <temp dir>)` diagnostic branch (removed after use): imported `DYNASTY-DYNASTYBOWL` for real, took a real backup, corrupted the live file, and confirmed `DatabaseCorruptedError` was correctly detected, the corrupt file was quarantined (not deleted), the correct (most recent, non-empty) backup was selected, and the restored file reopened successfully with the real imported dynasty intact (`dynastyCountAfterRestore: 1`).
- Independently verified the "Start Fresh" branch in the same run: corrupted the file again and chose Start Fresh instead of restoring, confirming it correctly produces a genuinely empty database (`dynastyCountAfterStartFresh: 0`) rather than accidentally restoring anyway.
- Confirmed the normal (non-corrupted) startup path is unaffected by the `initDatabase()` restructuring via a plain real import against the actual test save.

**Scope decisions:**
- No attempt to recover a *partially* corrupted database (e.g. a valid SQLite file with some damaged rows) — only the "file won't open at all" case, which is what sql.js can actually detect. A file that opens but has row-level damage is a different, harder problem not addressed here.
- Backups are taken once per successful startup, not on every write — `persist()` already runs after every single mutation (writing the whole file each time), so backing up at that same frequency would create excessive disk churn for little added protection; a per-session checkpoint was judged the more honest scope.

**No new dependencies added.**

---

## Player/Coach Save-File Editor

This app's first feature that writes back to the real `.DYNASTY` save file, not just reads it. Confirmed feasible in an earlier investigation pass (madden-franchise is a genuine read/write library — `record.Field = value` + `franchise.save()`), then designed and built end to end: edit icons on Roster, Recruiting, and Coaches open a full editor modal with live save-file field edits.

**Investigated first, real schema + a real save (not guessed):**
- Decompressed and parsed the CFB27 schema (`node_modules/madden-franchise/data/schemas/27/C27_468_2.gz`) to map every rating abbreviation shown in the target UI (OVR/STR/AGI/COD/SPD/... through PBK/RBK/.../IBLK) to its real schema field name — none were unresolvable; all are plain `int` fields, 0-127 except `OverallRating` (0-100).
- Confirmed `MentalAbility1-3` are a real 20-value enum (`None, RoadFanFavorite, Toughness, ...`), `MentalAbilityRank1-3`/`PhysicalAbility1-5` share a real `AbilitiesRank` tier enum (`None/Bronze/Silver/Gold/Platinum`), and `SkillGroupCap1-6` are plain 0-20 ints.
- Confirmed `franchise.save(outputFilePath, options)` overwrites the same file by default when given its own path back (`packFile()` under the hood — `save()` is a literal pass-through); field writes are fully synchronous with no flush step; compression (zlib, matching this project's earlier-documented FBCHUNKS finding) is handled automatically by the library, not something this app needs to manage.
- Confirmed `Player.PresentationId` is genuinely unique (already established in an earlier phase) and is the right key for relocating a player across a fresh franchise-file open.

**Shipped:**
- `src/shared/playerEditorFields.ts` — the full rating-abbreviation-to-schema-field map (61 rating fields across 6 sections), skill-cap/mental-ability/physical-ability field lists, and the two real enum option lists.
- `src/main/editorWrite.ts` — the write engine: `getPlayerEditData`/`savePlayerEdits`, `getCoachEditData`/`saveCoachEdits`, `backupSaveFile`, `searchPortraits`. Every write follows the same open-find-edit-save-reextract sequence: fresh franchise open (never a stale in-memory handle), locate the exact record, apply edits, `franchise.save()`, then re-run this app's own `extractAll`/`persistExtraction` pipeline so the SQLite snapshot — and every other page — reflects the edit immediately instead of showing stale data until a manual re-import.
- `src/main/ipc/editor.ts`, IPC channels, preload bindings, and `PlayerEditData`/`CoachEditData`/`PlayerEditFields`/`CoachEditFields`/`SaveFileBackupResult`/`PortraitSearchResult` types in `shared/types.ts`.
- `src/renderer/components/common/PlayerEditorModal.tsx` — six tabs (Player Profile, Ratings, Skill Group Caps, Mental Abilities, Physical Abilities, Portrait), each a controlled draft synced to a single "Save Player" action; warning banners matching the reference tool's own caveats (OVR may be recalculated by the game; mental abilities aren't position-limited; physical-ability slot names aren't resolvable from this data).
- `src/renderer/components/common/CoachEditorModal.tsx` — a smaller Profile + Portrait pair (name, personality, prestige score, contract fields) — intentionally not attempting a ratings/abilities system Coach doesn't have.
- `src/renderer/components/common/PortraitPicker.tsx` — debounced search over the local portrait asset library (main-process `searchPortraits`, since the renderer has no filesystem access), shared by both editors.
- `src/renderer/data/EditorModalProvider.tsx` + `EditorModalHost.tsx` — global modal state/host mounted once at the app root (`app.tsx`, alongside the existing `PlayerProfileModal`), following the exact same split already established for the player-bio modal.
- Edit-pencil entry points: `Roster.tsx` (list column before jersey #, gallery card), `Recruiting.tsx` (column before Position), `Coaches.tsx` (coach card). `DynastyOverview.tsx` gained a "Backup Save File" button next to Delete Dynasty, wired to the new `backupSaveFile` IPC call.

**Errors hit & fixes (all found only by actually exercising the write path against a disposable save copy, not by code review):**
1. **Coach edits silently targeted the wrong coach.** `Coach.PresentationId` was assumed reliable by analogy to `Player.PresentationId` (separately verified unique). It isn't: a real-save check found 64 of 493 coaches sharing `id=0`, and a genuine collision between two different real coaches both carrying `id=256` (one an OC, one a head coach, on different teams) — `.find()` silently grabbed whichever came first in table order. Verified `TeamIndex + Position` is unique for every real team instead (the only collisions were `TeamIndex=255`, an "unassigned" sentinel with no real editable coaches), and switched the entire Coach edit path — types, IPC signatures, modal props — to that composite key. `Coach`/`CoachData`'s short-lived `id`/`PresentationId` field was removed rather than left in as dead/misleading code.
2. **`CoachPrestige` write threw `"name.toLowerCase is not a function"`.** Looked like a plain int (fuzzy-matched alongside `CoachPrestigeScore` in an earlier grep, then the wrong one was picked). It's actually a letter-grade enum (`"Dplus"`, etc.); assigning a number to it hit the library's internal enum-name validator with a non-string value. The real writable integer is the sibling field `CoachPrestigeScore`. Isolated by testing each coach field write individually against a disposable save copy until the exact failing field was found, rather than guessing from the error message.
3. **The editor modal rendered thousands of pixels off-screen.** First implementation rendered `PlayerEditorModal`/`CoachEditorModal` inline within each page (Roster/Recruiting/Coaches), nested inside `app.tsx`'s `<main>`, which has a `clip-path` via `angledClip()`. Per the CSS spec, a `clip-path` (like `transform`/`filter`/`will-change`) on an ancestor creates a new containing block for `position: fixed` descendants — so the modal's `fixed inset-0` was positioned relative to `<main>`'s internal scrollable content instead of the true viewport, landing at `y≈2200px` in a real screenshot instead of centered. The existing player-bio modal (`PlayerProfileModal`) already avoids this by mounting once at the app root, outside `<main>` — the editor modals just weren't following that same pattern yet. Fixed by introducing `EditorModalProvider`/`EditorModalHost` mirroring `PlayerModalProvider`/`PlayerProfileModal` exactly, mounted at the app root. Re-verified via screenshot: modal now centers correctly (`y≈505px`) with all tabs and real save data rendering (Darian Mensah's real ratings — OVR 93, SPD 93, THP 91, etc. — all showing exactly as extracted).

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean throughout.
- Full write-path round trip against a **disposable copy** of `DYNASTY-TESTER` (never the user's real saves), isolated via a temporary `app.setPath('userData', ...)` diagnostic branch (removed after use): edited a real player's name and OVR, confirmed the change via both a direct fresh re-read of the save file *and* the app's refreshed SQLite snapshot (`getRoster`) — both matched. Edited a real coach's name after the `TeamIndex`/`Position` fix, confirmed the same coach (not a different one) was found and updated correctly before and after the save. Confirmed `searchPortraits` returns real matching asset keys and `backupSaveFile` produces a real, existing backup file.
- Live screenshot verification of the actual UI against the real Miami dynasty: Player Profile tab and Ratings tab both confirmed rendering correctly with real extracted data, in the correct on-screen position after the containing-block fix.
- The disposable save copy, isolated userData directory, and every temporary diagnostic branch used for this verification were deleted before finishing; the real user database and real save files were never touched by any write operation during development.

**Scope decisions:**
- Physical Ability slot *names* (e.g. "360", "Cutter") are not resolved — they're archetype/position-specific and not present as static schema data; the save's own per-player signature-ability join tables (`GrantedSignatureAbility`/`ActiveSignatureData`, which does have a `SlotIndex` field) could theoretically resolve them, but reading and joining those per-player wasn't attempted this pass. Slots show as generic "Physical Ability 1-5" with a tier dropdown only, with the limitation stated directly in the tab's own warning banner rather than silently guessed at.
- Several Player fields confirmed to be real save enums (`Role`, `Personality`, `Scheme`) are edited as free text rather than dropdowns — the madden-franchise library doesn't expose a runtime enum-options list for arbitrary fields the way it does for the two ability enums (which were separately confirmed against the parsed schema), and reverse-engineering every such field's full option set wasn't in scope this pass. `Position` and `SchoolYear` do get real dropdowns, reusing this app's own already-verified `POSITION_ORDER`/class-year lists.
- Coach editing intentionally has no ratings/abilities system — Coach doesn't have anything analogous to Player's rating grid in the reference design, so the Coach modal stays a smaller Profile + Portrait pair.
- No roster-wide bulk-edit or CSV import — one player/coach at a time, matching the reference tool's own per-record editing model.

**No new dependencies added.**

---

## Portrait Picker follow-up — filters, lightbox, pagination

Direct user feedback on the just-shipped Portrait Picker: thumbnails were too small to tell portraits apart, and there was no way to narrow down 25k+ player portraits by look. User proposed a filter (generic/unique, skin tone, hair style, etc.) plus a click-to-enlarge lightbox with keyboard nav and pagination; asked for my opinion, then said "investigate" when I proposed that the cryptic filename codes (`H_6_3`-style) might already encode visual traits, which would make filtering far cheaper than bulk image classification.

**Investigated first — decoded the portrait filename taxonomy, didn't guess:**
- Generic portrait keys follow `Generic_<seq>_P_T<seq>_<LETTER>_<TIER>_<STYLE>` (player) / `Generic_<seq>_C_[T]<seq>_<LETTER>_<TIER>_<STYLE>` (coach, `T` sometimes omitted). Verified the regex against every real file: 5,040/5,040 player Generic filenames and 186/186 coach Generic filenames matched. The vast majority of player portraits (20,486 of 25,527) are `Unique_<Name>_<num>` and have no decodable structure — the filter only ever applies to the Generic subset.
- Used direct multimodal image inspection (the Read tool can view PNGs and describe skin tone/hair/facial hair) to sample real portraits across letter/tier/style combinations. `TIER` (1-8) cleanly tracks skin tone — confirmed by finding the *same* tier looked consistently Black-appearing across all four letters, proving tier is an independent axis from letter, not entangled with it.
- The `LETTER` axis (D/H/M/T) wasn't decodable from face crops alone — all four looked like differently-shaped white men at tier=1 with no obvious skin-tone or build signal from a headshot. Per the user's own suggested methodology ("cross check it with certain player weights or positions"), wrote a diagnostic script against a real save (`DYNASTY-TESTER`) that read every `Player.GenericHeadAssetName`/`Weight`/`Height`/`Position`, parsed the letter out via regex, and aggregated real averages per letter. This resolved it decisively: **H = Heavy** (linemen, highest avg weight), **D = Default**, **M = Muscular**, **T = Athletic** (skill positions, lowest avg weight) — the user's own final labels, used verbatim in the shipped UI rather than my initially-proposed "Thin"/"Medium" wording.

**Shipped:**
- `src/shared/portraitTaxonomy.ts` — `classifyPortrait(assetName)` decodes a portrait key into `{ type: 'generic' | 'unique', build: 'H'|'D'|'M'|'T'|null, skinTone: 'light'|'tan'|'deep'|null }` (tier 1-3 → light, 4 → tan, 5-8 → deep) via the verified regex; `Unique_*` names fall back to `type: 'unique'` with no build/skin-tone. `BUILD_LABELS`/`SKIN_TONE_LABELS` carry the display strings (Heavy/Default/Muscular/Athletic; Light/Tan/Deep).
- `searchPortraits` (`src/main/editorWrite.ts`) rewritten to accept `PortraitFilters` (`type`/`build`/`skinTone`, each `'all'`-able) and a `page` number, classifying and filtering every candidate file before paginating at 60/page; returns `{ results, totalCount }` so the UI can render real page counts instead of guessing. Types/IPC/preload (`shared/types.ts`, `main/ipc/editor.ts`, `main/preload.ts`) updated to the new 4-arg signature and response shape.
- `PortraitPicker.tsx` rebuilt: Type/Build/Skin-Tone filter dropdowns (query/filters reset `page` to 0 on change, debounced 200ms before querying); thumbnails enlarged (14→24 px tile); a result-count line ("Showing 1-60 of 1,336..."); numbered pagination (Prev/Next + a windowed set of page-number buttons, current ±2 plus first/last, with an ellipsis gap — 425 pages for the full unfiltered library made rendering every page number impractical). Clicking a thumbnail opens a lightbox (portrait enlarged, asset name + type/build/skin-tone badges, Prev/Next by click or `ArrowLeft`/`ArrowRight`, `Escape` to close, "Use This Portrait" to confirm) rather than selecting immediately on click.

**Scope decisions:**
- Lightbox Prev/Next is scoped to the current page's 60 results, not the full filtered set — advancing past the last item on a page just disables the button rather than silently fetching the next page mid-lightbox. Closing and clicking "Next" in the grid covers that case; auto-advancing pages from inside the lightbox wasn't built this pass.
- Hair length/style and facial-hair-specific filters from the original request were not built: `STYLE` (the third filename number) is a bundled hairstyle+facial-hair look, not independently decodable into separate axes from the filename alone, and confirming what each of the 4 style values actually looks like across every letter/tier combination would need much more image sampling than the build/skin-tone axes did. Only Type/Build/Skin-Tone shipped, matching what the user explicitly approved building.

**Errors hit & fixes:**
- Coach Generic filenames initially matched only 181/186 against the player-shaped regex — 5 coach files omit the `T` prefix before the second sequence number (e.g. `Generic_0074_C_0073_D_2_1`). Fixed by making that `T` optional (`T?\d+`); re-verified 186/186.
- `editorWrite.ts`'s rewritten `searchPortraits` initially dropped `PortraitSearchResult` from its type-only import list (kept only the new `PortraitFilters`/`PortraitSearchResponse`) while the function body still built a `PortraitSearchResult[]` internally — caught immediately by `tsc --noEmit`.
- Live diagnostic screenshots against the real UI (see Verification) initially came back showing the "Heavy" filter still displaying "All builds" and all-default results — a first run whose synthetic `change` event apparently landed during a render/debounce race. Added return-value logging from the diagnostic's `executeJavaScript` calls (select's post-dispatch `.value`, the rendered result-count text) to confirm cause rather than guess; a clean re-run applied the filter correctly (1,336 real Heavy-build results, matching the earlier letter-distribution count) — not chased further as a product bug since the manual synthetic-event dispatch (not a real user click) is diagnostic-only.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Live screenshots via a temporary `capturePage()` diagnostic route in `main.ts` (removed after use, along with all scratch output) against a real dynasty's roster: opened a real player's editor, clicked into the Portrait tab (larger thumbnails, filter row, "Showing 1-60 of 25,527" rendering correctly), set the Build filter to Heavy via a real dispatched `change` event and confirmed the count updated to a real, correct 1,336 and every visible filename carried `_H_` in the right position, clicked a thumbnail to open the lightbox (correct asset name + "Generic · Heavy · Light · 1 of 60 on this page" metadata), and dispatched a real `ArrowRight` `KeyboardEvent` — confirmed the lightbox advanced to the next portrait in the page (`Generic_0041...` → `Generic_0042...`) with updated image and metadata, not just a static mock.
- A one-off environment snag during this verification: two earlier diagnostic runs produced zero output/screenshots because a stray `ELECTRON_RUN_AS_NODE=1` in the shell environment forced Electron to boot as plain Node (`app` came back `undefined`), and separately because leftover `electron.exe` processes from earlier in the session were holding the app's own single-instance lock. Both were shell/process state, not app bugs — resolved by unsetting the env var and killing the stray processes before the run that actually produced the screenshots above.

**No new dependencies added.**

---

## Portrait field fix — the editor was writing a field the game doesn't render from

User picked a new portrait via the just-shipped filter/lightbox UI, saved, confirmed this app's own preview showed the new face — then loaded the save in the real game and found the in-game portrait unchanged, while other same-session edits (stats, etc.) did take effect. Investigated rather than guessed at a fix, since writing the wrong field again risked another silent no-op.

**Investigated first — decompressed the real schema, cross-checked against real save data:**
- Decompressed `node_modules/madden-franchise/data/schemas/27/C27_468_2.gz` and searched the `Player` schema (288 fields) for every head/portrait/asset-related name. Found three candidates beyond the `GenericHeadAssetName` string this app was already writing: `PLYR_PORTRAIT` (plain int, 0–65535), `PLYR_GENERICHEAD` (a fixed 313-member enum, e.g. `"6_H_BD_01"`), and `PLYR_ASSETNAME`.
- Opened a disposable copy of a real save (`DYNASTY-TESTER`) and read all three fields for every real player (16,255 named records). `PLYR_PORTRAIT` matched the numeric sequence embedded in `Generic_<N>_...`-style `GenericHeadAssetName` values exactly for **7,243 of 7,244** real Generic-templated players — the one mismatch is plausible evidence of some other in-game system independently reassigning a portrait without the descriptive string field being kept in sync, which further confirms `PLYR_PORTRAIT`, not the string, is what's actually live. `PLYR_PORTRAIT` values ranged 1–5,040 for Generic portraits and 5,041–26,235 for Unique portraits (a separate, non-filename-derived numbering space for real/scanned players).
- Also checked `PLYR_GENERICHEAD` (the likely driver of the actual in-game 3D head/face model, not just the 2D portrait): its leading number matches our decoded skin-tone tier reliably, and its letter code matches our decoded build letter directly for Heavy/Muscular/Athletic — but our "Default" build consistently maps to the enum's `"B"` letter instead of `"D"`. Only ~313 discrete head templates exist for 5,040 Generic portraits (many-to-one), and it's a strict enum — an invalid value throws on save (the same class of bug as the earlier `CoachPrestige` incident). Given the user's own portrait-picker scope check confirmed a player-only, `PLYR_PORTRAIT`-only fix, `PLYR_GENERICHEAD` was investigated but deliberately not wired up this pass — see Scope decisions.
- Checked the Coach-side equivalent (`Coach.Portrait`, same int shape, 0–8,191) the same way: only 13 of 134 real Generic-templated coaches matched the filename sequence number exactly; the other 121 were all off by exactly `+10`, no other offsets observed. A clean bimodal split like that suggests two different underlying portrait "libraries" (the schema separately carries a `Portrait_Swappable_Library_Path` field on both `Player` and `Coach`) rather than random drift, but the actual rule wasn't confirmed — left untouched rather than writing a value with an 8%-observed chance of being wrong.

**Shipped:**
- `src/main/editorWrite.ts`'s `writePlayerFields` now also sets `PLYR_PORTRAIT` (parsed from the `Generic_<N>_` prefix) alongside the existing `GenericHeadAssetName` write, whenever a Generic portrait is selected. Unique portrait selections still only update the descriptive string, unchanged from before — per the user's explicit scope decision, since correctly reassigning another real player's scanned likeness would require resolving the source player's own record and copying their real `PLYR_PORTRAIT`, not deriving it from the filename.
- Coach portrait writes and `PLYR_GENERICHEAD` (either table) were **not** touched this pass — see Scope decisions.

**Scope decisions (explicitly confirmed with the user before implementing):**
- Fixed `PLYR_PORTRAIT` only, not `PLYR_GENERICHEAD` — the 2D-portrait fix is exact and safe; the 3D in-game head-model fix would need an approximate tier/build crosswalk (only ~313 templates for 5,040 portraits) and carries real risk of an invalid-enum save failure. Flagged as a known follow-up, not silently attempted.
- Coach portraits left unfixed — the `+10`/`+0` split in `Coach.Portrait` isn't understood well enough yet to write confidently; picked "don't guess" over a fix that would be wrong roughly 1 in 10 times.
- Unique portrait selection intentionally still only updates the cosmetic string field, not `PLYR_PORTRAIT` — out of scope this pass by explicit user choice.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real save/reopen round trip against a disposable copy of `DYNASTY-TESTER` (never the user's real saves): opened a real player record, applied the exact same edit `writePlayerFields` now performs (`GenericHeadAssetName` + derived `PLYR_PORTRAIT`), called `franchise.save()`, then did a **completely fresh** `Franchise.create()` re-open (not the same in-memory handle) and re-found the same player by `PresentationId` — both fields read back exactly as written (`PLYR_PORTRAIT: 1234` for a `Generic_1234_...` selection), confirming the value genuinely persists to disk rather than just existing in memory.
- All disposable save copies and scratch investigation scripts deleted after use; the real user database and save files were never touched.

**No new dependencies added.**

---

## Multi-season correctness pass (30-season dynasty support)

User asked for confidence this app holds up across a full 30-season dynasty — browsing any previous season's roster/schedule/stats/awards, and coach/player career stats accumulating correctly — and provided a real save (`Dynasty Save Test/DYNASTY-MIAMITESTS2`, Miami, season 2 mid-season) to verify against.

**Investigated first — real diagnostic imports against the real save, isolated test databases throughout, never the user's live data:**
- Season identity is `(dynasty_id, season_year)`, where `season_year` is the save's real in-game calendar year (confirmed `2027` for this "season 2" file) — no collision risk across 30 real years. Re-importing the same save file mid-season (simulating a weekly catch-up import) correctly reuses the existing dynasty + season row rather than duplicating it — verified live: `dynastyId`/`seasonId` identical, `seasons after second import: 1`.
- Player career-stat accumulation already existed (`PlayerProfileContent.tsx`'s "Imported career totals", built by iterating every imported season and summing that player's stats) and rides on `Player.PresentationId`, already separately verified unique — solid identity, no changes needed.
- Coach career accumulation already existed too, more completely than expected: `Coaches.tsx`'s `buildCoachResumeMap` iterates every imported season and accumulates wins/losses/conference record/season range for **every** staff member, not just the head coach, matched by name (no stable coach ID exists in the save — user confirmed accepting that risk rather than engineering around it).
- `Coach.yearsCoaching` (16 years for a coach only one season into this dynasty) is not a bug — user confirmed it's intentionally the coach's real-life full coaching career length, unrelated to tenure at this specific program.

**Two real, concrete problems found and fixed:**
1. **`extract-stats.ts` was reading a stale season's stats.** `SeasonStats` is an 18-slot **history** array on each Player record — one slot per season of that player's tracked career, each slot carrying its own `SEAS_YEAR` field (confirmed via the decompressed CFB27 schema: `SeasonStats`/`SeasonOffensiveStats` both have a `SEAS_YEAR` member). The extractor hardcoded `SeasonStats0` as "this season," which is only correct for a player's very first tracked season. Direct inspection of the real save's starting QB, Lance Medlock (`PresentationId` 10923): slot 0 (`SEAS_YEAR=0`) held 3 games and zero passing stats (his rookie year, mostly bench time); slot 1 (`SEAS_YEAR=1`, the actual current season) held his real line — 6 games, 216 attempts, 1636 yards — which summed exactly with slot 0 to match his `CareerStats` totals (9 games, 216 att, 1636 yds), confirming the slot semantics precisely. Fixed by iterating every populated `SeasonStats{N}` slot (same "enumerate whatever exists" pattern `extract-gamelog.ts` already used for its own per-game array) and keeping whichever slot has the highest `SEAS_YEAR` — falls back to the single slot unchanged for a season-1-only dynasty, no regression there.
2. **No persistent, app-wide season switcher.** The identical `seasonId` state + `getSeasons` fetch + inline dropdown pattern was independently duplicated across 8 pages (`Roster.tsx`, `Schedule.tsx`, `Awards.tsx`, `Coaches.tsx`, `NcaaHub.tsx`, `Standings.tsx`, `Rankings.tsx`, `Recruiting.tsx`), each only rendering once `seasons.length > 1` — easy to miss entirely, and each page tracked its own independent selection (switching the season on Roster didn't affect Schedule). `DynastyOverview.tsx` ("Team Hub") had no season parameter at all, always current-only.

**Shipped:**
- New `src/renderer/data/SelectedSeasonProvider.tsx` — one shared `seasons`/`selectedSeasonId` context (same provider pattern as the existing `EditorModalProvider`/`PlayerModalProvider`), fetching the season list once per dynasty and defaulting to whichever season is flagged current.
- `src/renderer/components/common/DynastyLayout.tsx` now mounts the provider around the whole dynasty `<Outlet/>` and renders one season `<select>` in the tab nav, positioned after "Exports."
- All 8 pages above refactored to consume `useSelectedSeason()` instead of their own local state/fetch/dropdown — each dropped ~15-20 lines of now-duplicated boilerplate. `Coaches.tsx`'s cross-season resume-building effect also now reuses the shared season list instead of its own separate `getSeasons` call.
- `src/database/getSeasonOverview.ts` gained an optional `seasonId` param (same `seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId)` pattern already used by `getCoaches`/`getTrophies`), threaded through the IPC handler, preload binding, and `DynastyApi` types; `DynastyOverview.tsx` ("Team Hub") now consumes the shared season selection too, per the user's explicit choice to make it fully consistent with every other tab rather than staying current-only.
- `History.tsx` is unchanged — it's inherently all-seasons already, nothing to switch there.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean throughout every step.
- Real-save round trip for the stats fix: isolated diagnostic (no BrowserWindow, no database — a pure `extractAll()` call) against the real `DYNASTY-MIAMITESTS2` file confirmed Lance Medlock's extracted `season` line changed from the old empty/stale read to the real current-season numbers (6 games, 216 attempts, 1636 yards, 14 TDs) — before/after comparison against the exact same real save.
- Live screenshot verification (temporary `capturePage()` diagnostic route, isolated test userData directory, removed after use): imported the real Miami save, then synthesized a second season from the same extraction (decrementing `league.seasonYear` before a second `persistExtraction` call) purely so the switcher had two real options to toggle between, since the user's real dynasty only has one season imported so far. Confirmed live: the season dropdown renders next to Exports; a real dispatched `change` event switches it and Roster's content updates; the selection **persists across page navigation** within the same dynasty (Roster → Team Hub → Coaches all showed "Season 2027" after one switch, not reset per-page); and — most importantly — the Coaches page's "Imported Resume" correctly summed to **8-4 across 2 imported seasons** for all three staff members (head coach and both coordinators) once a second season actually existed, directly confirming the cross-season accumulation the user was unsure about was working correctly — it had only looked single-season because only one season had been imported yet, not because of a bug.
- All disposable save copies, isolated test databases, and diagnostic scaffolding deleted before finishing; the real user database and save files were never touched by any of this investigation or verification.

**Scope decisions:**
- Coach identity in the cross-season resume stays name-matched, not a more elaborate position-continuity heuristic — user explicitly chose to accept the (real but low-probability) risk of two different real coaches sharing a name over a 30-year span, since no stable coach ID exists in the save data to do meaningfully better.
- The Coach-side equivalent of the `SEAS_YEAR` bug (`Coach.Portrait`'s earlier-discovered `+10`/`+0` offset split, unrelated to this pass's `SeasonStats` finding) remains a known, separately-flagged gap — not touched here, out of scope for this request.
- Season data already imported *before* this fix ships keeps showing the old (possibly stale/empty) season-stat numbers until that season is re-imported — the fix only corrects extraction going forward, since the original save state at that past point generally isn't re-derivable after the fact. Re-importing the current save resolves it immediately for the active season.

**No new dependencies added.**

---

## Dynasty relink — fixes duplicate dynasties from a renamed/moved save file

Direct follow-up to the multi-season pass: the user tried the new season switcher and didn't see it after reimporting their Miami save. Investigated rather than guessed, since the switcher itself had already been screenshot-verified working — something about their specific case had to be different.

**Investigated first — direct inspection of a copy of the user's real live database, never the original:**
- Copied `dynasty-archive.sqlite` from the live `userData` directory (never modified — read-only inspection only, deleted after use) and queried it directly. Found the Miami dynasty had exactly one season (2027) on record, and — more tellingly — **7 orphaned `seasons` rows** referencing `dynasty_id`s that no longer exist in the `dynasties` table at all.
- Asked the user directly what they'd done: they'd taken an original test save ("MiamiTest"), advanced it in-game to mid-way through the next season, and saved that as a **new file** ("MiamiTestS2") rather than overwriting the original.
- Root cause confirmed in code: `getDynastyBySavePath` (`src/database/helpers.ts:129`) and the `UNIQUE(save_path)` constraint in `schema.sql` mean dynasty identity is an **exact string match on the save file's path**. A save renamed, moved, or restored from backup between seasons — even though it's genuinely the same dynasty — imports as a brand-new, unrelated dynasty with no way to merge back. This also explains the 7 orphaned rows: leftovers from earlier same-pattern test imports that were later deleted from the Dashboard.
- For a user who always saves back to the same file path (the normal EA workflow), this never surfaces. It only bites when a save file gets deliberately renamed or restored — which is a real, if occasional, possibility over a 30-season dynasty's lifetime, not just a testing artifact.

**Shipped:**
- `src/database/helpers.ts` — `UpdateDynastyInput` gained `savePath?: string`, threaded into `updateDynasty`'s `buildSetClause` call.
- New `src/database/relinkDynasty.ts`:
  - `checkDynastyMatch(filePath)` — short-circuits to `null` immediately for the common case (an already-tracked exact path, i.e. a normal reimport — no extraction needed). Otherwise runs a preview `extractAll` and checks every existing dynasty for a `teamId` match on a *different* `savePath`; returns that candidate's id/label/season years if found.
  - `relinkDynasty(dynastyId, filePath)` — validates the new file's resolved team matches the target dynasty's `teamId` (the core safety guard — rejects with a clear message otherwise, no data touched), validates the path isn't already owned by a *different* dynasty (rejects rather than violating the `UNIQUE(save_path)` constraint or silently clobbering another tracked dynasty), then updates `save_path` and runs the normal `persistExtraction` pipeline unchanged — the already-correct season-matching-by-year logic does the rest, no new season logic needed.
- New `db:checkDynastyMatch` / `db:relinkDynasty` IPC channels, wired through `ipcChannels.ts` → `ipc/database.ts` → `preload.ts` → `shared/types.ts`, matching every other `db.*` channel's existing pattern.
- `src/renderer/data/SelectedSeasonProvider.tsx` gained a `refresh()` function so a successful relink (which doesn't change `dynastyId`, so the provider's own effect wouldn't otherwise refire) can force the season list to pick up the newly-linked season immediately.
- New "Relink Save File" button on `DynastyOverview.tsx`, next to the existing Backup/Delete buttons, same pattern as `handleBackup` — opens the file picker, calls `relinkDynasty`, shows a status message, refreshes the season context on success.
- `Dashboard.tsx`'s normal import flow now calls `checkDynastyMatch` right after a file is picked; if it finds a candidate, a `window.confirm()` (matching the existing lightweight-confirm convention already used for delete flows) offers to link instead of creating a new dynasty. Declining falls through to the exact same import-as-new behavior as before — no change for the common case.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real-save round trip against an isolated test database (never the user's live one): imported a real save under path A at a synthesized earlier season, then ran `checkDynastyMatch` against the *same real save content* under a different path B — correctly detected the team match and returned dynasty A as the candidate. `relinkDynasty` produced **exactly one dynasty** (not two) with **both seasons** correctly present (`[2027, 2026]`), and the dynasty's `save_path` updated to the new file. Separately confirmed relinking to a real save for a *different* team (USC) is rejected with a clear message and leaves the target dynasty's data completely unchanged.
- Live screenshot verification (temporary `capturePage()` diagnostic route, isolated test userData, removed after use): confirmed the "Relink Save File" button renders correctly in the Team Hub button row; confirmed that after a real relink, the global season switcher (from the prior pass) picks up the merged data and correctly shows "2027 (current)" with 2 seasons now available — end-to-end, not just the backend logic in isolation.
- All disposable save copies, the live-database read-only copy, and diagnostic scaffolding deleted before finishing; the user's real save files and live database were never modified.

**Scope decisions:**
- The Dashboard's detection prompt is a plain `window.confirm()`, not a custom modal — matches the project's existing lightweight-confirm convention (used for delete flows) rather than introducing a new UI pattern for a relatively rare situation.
- No attempt to retroactively "un-fork" the user's existing test dynasties (the 7 orphaned season rows, or the already-separate Miami/MiamiTestS2 history) — those are one-off test artifacts from before this fix existed; the fix prevents it from happening again, not from cleaning up stale test data.
- Recommended the user keep a single, consistently-overwritten save file for their real dynasty going forward — the relink feature is a recovery path for when that slips (a rename, a restored backup), not a replacement for it.

**No new dependencies added.**

---

## Dashboard icon buttons + "Sync Dynasty" (relocated dynasty actions)

Direct follow-up request after shipping the relink feature: move dynasty-management actions off the Team Hub page and onto the Dashboard cards as small icons, replace the explicit file-picker "Relink Save File" button with a one-click "Sync Dynasty" that just re-reads the same file already on record, and drop "Delete Dynasty" from Team Hub entirely (Dashboard already had its own delete).

**Shipped:**
- New `syncDynasty(dynastyId)` in `src/database/importExtraction.ts` — looks up the dynasty's own already-stored `savePath`, re-runs `extractAll`/`persistExtraction` against it. No new season-matching logic needed (it's the exact same path, so the existing `getDynastyBySavePath` match in `persistExtraction` just works); the only new thing is not needing a file dialog, since the path is already known server-side. New `db:syncDynasty` IPC channel, wired the same way as every other `db.*` channel.
- `src/renderer/pages/DynastyOverview.tsx` — removed the Relink/Backup/Delete button row and all of its handlers/state entirely (`handleRelink`, `handleBackup`, `handleDelete`, and their loading/message state). The page no longer manages any dynasty-level actions, only season-level data display.
- `src/renderer/pages/Dashboard.tsx` — each dynasty card's hover-revealed action row (previously just the delete trash icon) now has three icon buttons: a new `SyncIcon` (circular-arrows) calling `syncDynasty`, a new `BackupIcon` (download-into-tray) calling the already-existing `backupSaveFile`, and the existing `TrashIcon` for delete — all matching the same compact circular-icon-button styling, each with `aria-label`/`title` since there's no visible text label. Sync and Backup both stop propagation so they don't trigger the card's own navigation `Link`, same pattern the delete button already used.
- The automatic same-team-different-path detection built for the relink feature (`checkDynastyMatch` on the normal "Import Dynasty" flow) is unchanged and still in place — "Sync Dynasty" only ever re-reads a dynasty's own known path, so it can't hit that case; the detection prompt is still the path for recovering a dynasty whose save file genuinely got renamed or moved.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Live screenshot verification (temporary `capturePage()` diagnostic route, isolated test userData, removed after use): confirmed all three icons render correctly in a row on a real dynasty card (a real mouse hover can't be scripted via CDP, so the hover-only opacity was forced visible via an injected stylesheet rule — `webContents.insertCSS()`, which survives React re-renders where a one-off inline-style mutation didn't); confirmed clicking the Sync icon executes a real reimport through the actual IPC path (not just a mock); confirmed Team Hub no longer renders any of the three removed buttons.
- All diagnostic scaffolding and scratch screenshots deleted before finishing.

**No new dependencies added.**

---

## Phase 0 — per-season team tracking (coach-centric redesign foundation)

User handed over a design doc (`DevNotes_071726_V1.md`) proposing a full architectural pivot: the app should be organized around the coach as the primary entity, not the school, since a coach's story can span multiple programs. Before agreeing to build any of that (a new Coach Hub page, career records spanning schools, a season timeline showing school changes), I asked whether the human-controlled coach can actually change schools within one continuous save file in this game — user confirmed yes: hired away, fired, hires/fires their own staff, staff leave for other jobs. That's a real, load-bearing fact this whole redesign depends on, so it got investigated and fixed first, before any UI work.

**Investigated first — confirmed the real scope, not guessed:**
- `grep`'d every query file for `dynasty.teamId`: **10 files, 30 call sites** (`getAwards`, `getCoaches`, `getHistory`, `getNcaaHub`, `getRankings`, `getRecruits`, `getSchedule`, `getSeasonOverview`, `getStandings`, `getTrophies`), all treating "the user's team" as a single fixed-forever value.
- Re-read `persistExtraction`: confirmed `dynasty.team_id`/`team_name` were set once at first import and genuinely never revised on reimport — only `label` and team colors refreshed.
- Checked how the extractor itself identifies "the user's team": `findUserTeamIndex(coaches)` in `extract-coaches.ts` — `coaches.find(c => c.isUserControlled && c.position === 'HeadCoach')?.teamIndex`. This is independently re-derived fresh from the save on **every single import**, with zero dependency on anything previously stored. The hard part (detecting a job change) was already solved; the app just wasn't trusting it.

**Shipped:**
- `src/database/schema_v3_season_team.sql` (migration v3, registered in `migrations.ts`) — `ALTER TABLE seasons ADD COLUMN user_team_id INTEGER`. Each season now records which team was actually the user's for that specific season, instead of inheriting a dynasty-wide constant.
- `src/database/helpers.ts` — `Season`/`SeasonRow`/`mapSeason` thread the new column through; `createSeason` gained a required `userTeamId` param (set once at creation, never revised on a same-year reimport — a real team change always means the season year has moved on too). `UpdateDynastyInput`/`updateDynasty` gained `teamId`/`teamName` support.
- `src/database/importExtraction.ts` — `persistExtraction` now passes `extraction.userTeam.teamIndex` into `createSeason`, and refreshes the dynasty's cached `teamId`/`teamName` on *every* import (not just first) — that cache is now explicitly just a "most recently known" convenience value for the Dashboard card list, never used to resolve a specific season's data again.
- All 10 query files switched from filtering against `dynasty.teamId` to resolving `season.userTeamId` after resolving the season — same one mechanical pattern applied consistently. A few (`getStandings`, `getRankings`, `getRecruits`, `getAwards`) also had their display `teamName` upgraded from the stale dynasty-level cache to that season's own resolved team name, so a school-change season shows the *right* school, not whichever one was cached most recently.
- **Backward compatibility for already-imported seasons** (not in the original plan — found mid-implementation): the migration adds the column with no default, so every pre-existing season row starts `NULL`. New `backfillMissingSeasonTeamIds()` in `helpers.ts`, called once at startup (`main.ts`, right after the database is confirmed open) — for any season still missing `user_team_id`, it re-derives the correct value from that season's own already-stored `coaches` snapshot using the exact same `isUserControlled`+`HeadCoach` signal the extractor uses live, rather than guessing from the dynasty's current (possibly newer) cached team. Falls back to the dynasty's current team only if a season's coaches snapshot is somehow unreadable. Cheap no-op once every row has a value.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real-save synthetic diagnostic against an isolated test database (never the user's live data): imported a real save as season 1 (real team, Miami), then persisted a second, fabricated season using the *same* extraction with `userTeam` swapped to a different real team from the same save's league (Air Force) and the season year incremented — simulating a genuine job change without needing an actual save where one occurred. Confirmed: `getCoaches` and `getSeasonOverview` correctly resolved Miami for season 1 and Air Force for season 2 (previously both would have resolved to whichever team was recorded first); `getHistory`'s season timeline correctly showed two different real head coaches (Mario Cristobal at Miami, Troy Calhoun at Air Force) across the two entries — the actual "coach's story across schools" feature this fix exists for.
- Backward-compat check in the same run: manually nulled season 1's `user_team_id` (simulating a pre-migration row), ran the backfill, and confirmed it recovered the *original* team (Miami/47) — not the dynasty's now-current cached value (Air Force/0, since the second persist had since updated it) — proving the backfill genuinely reads each season's own historical data rather than copying whatever's newest.
- All diagnostic scaffolding and the disposable test database removed before finishing; the user's real save files and live database were never touched.

**Scope decisions:**
- `relinkDynasty.ts`'s team-match safety guard deliberately stays keyed on the dynasty's cached `team_id` (not any specific season's) — it's answering "does this new file look like the same coach's next job," which is inherently a comparison against wherever the coach *most recently* was, not a fixed historical season.
- This phase is data-layer only — no renderer changes. Nothing about what the UI receives changed shape; only which team a given season's data resolves to. The nav restructure, Dashboard icon reorder tweak, and the new Coach Hub page are separate, later phases per the plan discussed with the user.

**No new dependencies added.**

---

## Phase 1 — collapsible Dynasty submenu + Dashboard icon separation

Quick, low-risk UI phase from the coach-centric redesign plan — independent of Phase 0's data-model work, no dependency between them.

**Shipped:**
- `src/shared/types.ts` — `DynastySummary` gained `headCoachName: string | null`.
- `src/main/ipc/database.ts` — the `getDynasties` handler now resolves each dynasty's current head coach via the existing `getCoaches(dynasty.id, currentSeason?.id)` (already-built query, no new logic) and includes the name in the response.
- `src/renderer/components/common/Sidebar.tsx` rebuilt: the old single static `NavLink` (labeled "Dynasty" with a "Home" chip) is now an expandable tree. The "Dynasty" link itself is unchanged (still navigates to the Dashboard), with a chevron toggle next to it; expanded (the default state), it lists every loaded dynasty as its own `NavLink` to `/dynasty/:id`, showing that dynasty's real team logo (`TeamLogo`, small size) and real head coach name — falling back to team name if no coach data is available. The dynasty list refetches on every navigation (`useLocation().pathname` as the effect dependency) rather than a dedicated live-refresh context, which is enough to pick up a dynasty just imported or deleted elsewhere without over-building for what's a fairly rare event.
- `src/renderer/pages/Dashboard.tsx` — the three hover-revealed card icons (Sync, Backup, Delete) are now visually grouped: Sync+Backup together, then a `gap-3` + a 1px vertical divider, then Delete — a deliberate structural gap per the user's explicit ask ("ensure user doesn't accidentally click a critical delete button"), not just an ordering change (the icons were already left-to-right Sync/Backup/Delete before this).

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Live screenshot verification (temporary `capturePage()` diagnostic route, isolated test userData with two real imported dynasties, removed after use): confirmed the sidebar correctly lists both real dynasties with their real logos and real head coach names (Lincoln Riley for USC, Mario Cristobal for Miami) when expanded; confirmed the collapse toggle correctly hides the list and rotates the chevron back; confirmed the Dashboard icon cluster (hover-only opacity forced visible via an injected stylesheet rule, same technique as prior sessions) shows the new divider cleanly separating Sync/Backup from Delete.
- All diagnostic scaffolding and scratch screenshots deleted before finishing.

**Scope decisions:**
- No persisted expand/collapse preference (resets to expanded on next launch) — not worth the storage/plumbing for a toggle state this cheap to re-set.
- The sidebar's dynasty list refetches on navigation rather than through a shared push-based refresh context (like `SelectedSeasonProvider` from the multi-season pass) — simpler, and the staleness window it accepts (an import that happens without any subsequent navigation) is minor and self-corrects on the next route change.

**No new dependencies added.**

---
## Phase 2 — Coach Hub

Flagship page of the coach-centric redesign (`DevNotes_071726_V1.md`) — the coach's career/legacy page, now the default landing page per dynasty. Team Hub (the former index page) kept exactly as-is, moved to its own `team-hub` tab, per the user's explicit choice to keep both as separate tabs rather than merging or replacing.

**Real fields investigated first, not assumed:** decompressed the CFB27 schema (`node_modules/madden-franchise/data/schemas/27/C27_468_2.gz`, same technique used all session) and checked every field on the 137-field `Coach` table before scoping the UI. Confirmed real: `Age`, `DominantArchetype` (`CoachTalentArcheType` enum — ProgramBuilder, EliteRecruiter, etc.), `SeasonsWithTeam`, `CurrentJobSecurityStatus` (`JobSecurityStatus` enum — Safe/SafeForNow/Low/HotSeat), `Personality`, and `CareerStats` — a reference to `CareerCoachStats`, a save-native, already-computed **lifetime** coaching record (`Wins`/`Losses`/`WinsAtCurrentSchool`/`LossesAtCurrentSchool`, `BowlWins`/`BowlLosses`, `ConfChampWins`/`ConfChampLosses`(+streak), `NCWins`/`NCLosses`, `PlayoffWins`/`PlayoffLosses`, `TimesFired`, `RivalWins`/`RivalLosses`(+streak), `Top25Wins`/`Top25Losses`, `DraftPicks`/`FirstRoundDraftPicks`, `Top5RecruitClasses`, `PlayersMaxProgressed`, `NumPrestigeIncreases`) that the game tracks across the coach's entire career — not scoped to this app's imports, and may predate the user's own save.

**Real dead end found and dropped from scope, not worked around:** `OffensiveScheme`/`DefensiveScheme` (type `Scheme`, with real `Description`/`Value` sub-fields per the schema) looked resolvable via the same `resolveReferenceWithTable` pattern already proven for player and coach career stats. Verified against a real save (disposable copy) instead of assuming: both fields' `getReferenceDataByKey` correctly returns a real, consistent `tableId` (16433) and a real `rowNumber` — confirmed genuinely valid by cross-checking against a second, independent path to the same table (a `Scheme[]` container record with 19 `Scheme0`..`Scheme18` slots, one per real `BaseScheme` enum value, whose own resolved row numbers land in exactly the same narrow band). But `franchise.getTableById(16433)` — the library's own official lookup, the same one every other reference resolution in this codebase depends on — returns nothing; the table simply isn't enumerated into `franchise.tables` for this file, even though the reference into it is genuinely valid. This is a `madden-franchise` library limitation, not a bug in this app's extraction code. Rather than hand-rolling a workaround outside the library's supported surface (parsing raw table offsets ourselves), scheme was dropped from this phase's scope — a real, evidence-based reduction, not a guess.

**Shipped:**
- `src/extractors/extract-coaches.ts` — new `CareerCoachStats` interface (25 fields, listed above) and `CoachData` gained `age`, `dominantArchetype`, `seasonsWithTeam`, `currentJobSecurityStatus`, `personality`, `careerStats: CareerCoachStats | null`. `CareerStats` resolved via `resolveReferenceWithTable` + `preloadAllInstances(franchise, 'CareerCoachStats')`, same pattern already proven for player stats in `extract-stats.ts` — no new resolution mechanics invented.
- `src/shared/types.ts` — `CareerCoachStats` interface added; `Coach` gained the same new fields; `ProgramHistorySeasonEntry` gained `teamName: string` (purely additive — `History.tsx`, which also consumes this type, is unaffected).
- `src/database/getCoaches.ts` / `getHistory.ts` — thread the new fields through (`toCoach` mapping; `teamName: userTeam.displayName`, a value `getHistory.ts` already computed internally but hadn't attached to the per-season entry).
- `src/renderer/components/common/CoachCard.tsx` (new) — `Coaches.tsx`'s local `CoachCard`/`EditButton`/`formatCoachPosition`(renamed `spaceCamelCase`, generalized beyond just positions)/`coachKey`/`CoachResume` extracted here so both `Coaches.tsx` and the new Coach Hub reuse one real component instead of a second copy. `Coaches.tsx` updated to import from here; its local duplicate deleted.
- `src/renderer/pages/CoachHub.tsx` (new) — Hero (portrait + team-logo badge, name, school, `SeasonsWithTeam`, job-security status line with a `TimesFired` footnote when nonzero), Coach Profile (age, alma mater, years coaching, archetype, personality, an Edit action reusing `useEditorModal().openCoachEditor` exactly as `Coaches.tsx` already does), Career Record (two side-by-side blocks: save-native lifetime `CareerCoachStats`, and "Since Importing" reusing `getHistory()`'s per-coach summary), Current Coaching Staff (OC/DC via the existing `getCoaches()` query, reusing the shared `CoachCard`), Previous Seasons Timeline (reuses `getHistory()`'s `seasons` array, now showing each season's real team logo/name via the new `teamName` field). No Coaching Tree — explicitly skipped per the user's direction.
- `src/renderer/app.tsx` — index route for `/dynasty/:id` is now `CoachHub`; `DynastyOverview` moved to `team-hub`.
- `src/renderer/components/common/DynastyLayout.tsx` — nav tabs gained "Coach Hub" (index) ahead of "Team Hub" (now pointing at `team-hub`); everything else in the tab bar unchanged.

**Scope decisions:**
- `OffensiveScheme`/`DefensiveScheme` dropped — see the dead-end investigation above. Flagged here rather than silently omitted.
- `CoachPrestige`/`CoachPrestigeScore`/`HomeTown`/`HomeState` — real, confirmed-resolvable fields surfaced during the schema investigation but not part of the actual approved page design (only mentioned as available extras); left unextracted rather than added speculatively.
- Coaching Tree explicitly out of scope per the user's direction when the plan was approved.
- `Coaches.tsx` deliberately left as-is this phase (still reachable at its own tab) — Phase 3, a separate later phase, removes it once Coach Hub is verified to cover everything it did.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real-save verification (disposable copy of `Dynasty Save Test/DYNASTY-MIAMITESTS2`, isolated diagnostics, never the user's real saves): a temporary diagnostic branch in `main.ts` ran the new fields all the way through extraction → persistence → `getCoaches`/`getHistory` queries — confirmed sane real values (Mario Cristobal, age 59, ProgramBuilder, Safe, career record 18-4 with a real bowl/conference/playoff/rivalry/Top-25/draft breakdown) before trusting any of it in the UI.
- Live screenshot verification (temporary `capturePage()` diagnostic route + programmatic scroll, isolated userData, removed after use): confirmed Coach Hub renders as the default page with the "Coach Hub" tab active first; hero/profile/career-record/staff/timeline sections all show the real data matching the diagnostic logs exactly; "Team Hub" independently confirmed still fully functional and unchanged at its new `team-hub` path, tab order correct.
- All diagnostic scaffolding (temporary `main.ts` branches, disposable save copy, scratch schema dumps, screenshots) removed before finishing.

**No new dependencies added.**

---
## Phase 3 — Coaches page retired

Closes out Phase 2's own stated exit condition: "`Coaches.tsx` is left as-is this phase — Phase 3, a separate later phase, removes it once Coach Hub is verified to cover everything it did." Everything Coach Hub's design covered was already verified in Phase 2; this phase is the actual removal, plus one real gap caught and closed before deleting anything.

**Real gap found before deleting, not after:** `Coaches.tsx` gave every staff member — including coordinators, not just the head coach — their own "Imported Resume": a per-coach win-loss record computed by matching coach names across every season imported into this app (`buildCoachResumeMap`). Coach Hub's Current Coaching Staff section (shipped in Phase 2) rendered coordinator cards with `resume={null}` — it never wired this up, since the design plan's own coverage claim ("same `CoachCard`-style presentation") was true of the card component but not yet true of the data feeding it. Deleting `Coaches.tsx` as originally planned would have silently dropped this feature for coordinators. Fixed first: ported `buildCoachResumeMap` (identical computation, reusing the shared `CoachResume` type from `CoachCard.tsx`) into `CoachHub.tsx`, fetching each season's coaches+schedule the same way `Coaches.tsx` did, before removing anything.

**Shipped:**
- `src/renderer/pages/CoachHub.tsx` — added the `buildCoachResumeMap` computation (ported from `Coaches.tsx`) and a second `useEffect` that fetches every season's `getCoaches`/`getSchedule` to build the resume map; Current Coaching Staff's `CoachCard`s now pass `resume={coachResumes?.get(coachKey(coach)) ?? null}` instead of always `null`.
- `src/renderer/pages/Coaches.tsx` — deleted.
- `src/renderer/app.tsx` — `Coaches` import and its `coaches` route removed.
- `src/renderer/components/common/DynastyLayout.tsx` — "Coaches" nav tab removed from the tab bar.
- `src/renderer/pages/DynastyOverview.tsx` — the Head Coach card's "View full staff" link, previously pointing at the now-deleted `/dynasty/:id/coaches`, repointed at `/dynasty/:id` (Coach Hub's index route, which shows the same staff in its Current Coaching Staff section).

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Live screenshot verification (disposable copy of `Dynasty Save Test/DYNASTY-MIAMITESTS2`, isolated userData, temporary `capturePage()` diagnostic route, all removed after use): nav bar confirmed to show no dangling "Coaches" tab; both real coordinators (Shannon Dawson/OC, Corey Hetherman/DC) show correct "Imported Resume" blocks (4-2, 1 imported season on staff, Conf 2-1, Range 2027) matching exactly what `Coaches.tsx` displayed before its removal.
- All diagnostic scaffolding and the disposable save copy removed before finishing.

**No new dependencies added.**

---
## Multi-season history backfill + conference-championship bug fix

User reported the season switcher didn't show a dropdown for a new save (`DYNASTY-TULANEMASTER`, Tulane, already several seasons simmed) despite working fine for another save, and asked for this to be made "flawless" since it's a deciding feature for the app.

**Root cause — not a bug, confirmed by direct inspection:** read a read-only copy of the user's real live database (`%APPDATA%/cfb-dynasty-hub/dynasty-archive.sqlite`) plus both save files directly. Texas State has 2 `seasons` rows because it was synced twice (2026, then 2027). Tulane has exactly 1 (2029) because it was only ever synced once — *after* already being simmed to year 4. The app can only capture a save's state at the moment of sync; there's no mechanism to see backward from a single snapshot. The season-switcher logic itself was working correctly the whole time.

**The real fix — a genuine data source the app never read.** Decompressed the CFB27 schema and found `League`'s `LeagueHistory` field (schema type `YearSummary[]`, a real 30-slot per-dynasty-year array). The schema's own reference from `League` to it is confirmed unresolvable (`getReferenceDataByKey` returns null even though the League record itself reads fine) — the `YearSummary[]` table is real and fully populated regardless, so the new extractor locates it directly by table name instead of chaining through League. Verified with real data for 3 completed years on the Tulane save: each year resolves a real national championship result (winner/loser, score, rank, coach), every conference's real champion (via `YearSummary.ConferenceChampions`), and that year's season awards (via `YearSummary.AnnualAwards`) — all independently confirmed against real team/coach/player names, not guessed. `seasonYear = SeasonInfo.BaseCalendarYear + YearSummary.PeriodIndex`, verified exact on two real saves (2026+3=2029, 2026+1=2027).

**A second, real, independently-confirmed bug found while building this:** the previous `extract-conference-championship.ts` and `extract-awards.ts`'s coach-award extraction both read flat, ever-accumulating tables (`LeagueHistoryConferenceChampion` capacity 330, `LeagueHistoryAward` capacity 750) with no year field, and had always been treating the *entire* multi-year table as "this season's" data — the original code's own comment already flagged this as an unverified assumption ("flagged for revisit if a multi-season save ever shows this table accumulating stale entries"). Confirmed on Tulane's 3-completed-year save: each of the 10 conferences had exactly 3 stale entries in the flat table, one per year, with no way to disambiguate — meaning the Standings conference-champion badge and Coach Hub's `BEST_HC`/`BEST_AC` awards have likely been showing wrong-year data for any dynasty 2+ seasons deep, independent of this backfill feature. Both now source from the correctly year-scoped `YearSummary` sub-arrays instead.

**Shipped:**
- `src/extractors/extract-league-history.ts` (new) — `extractLeagueHistory(franchise, baseCalendarYear)` resolves every completed year (the current in-progress year is present but zeroed — detected via an empty `WinningCoachLastName` and skipped) into a self-contained `YearSummaryData` (national champion, runner-up, conference champions, awards). Two real `YearSummary` table instances exist on a real save (both capacity 30) — preloaded via `preloadAllInstances`, same gotcha as `CareerCoachStats`/`Scheme` elsewhere in this codebase.
- `src/extractors/extract-conference-championship.ts` — deleted, fully superseded.
- `src/extractors/extract-awards.ts` — `extractCoachAwards()` (the buggy flat-table read) removed; `extract-all.ts` now merges the current year's `BEST_HC`/`BEST_AC` in from the new extractor instead.
- `src/extractors/extract-league.ts` — `LeagueData` gained `baseCalendarYear` (`SeasonInfo.BaseCalendarYear`).
- `src/extractors/extract-all.ts` — calls the new extractor, derives `conferenceChampionship` and merged coach awards from the current year's entry, adds the full `leagueHistory: YearSummaryData[]` to `ExtractionData` for the backfill step.
- `src/database/schema_v4_season_history_only.sql` (migration v4) — `seasons.has_full_data INTEGER NOT NULL DEFAULT 1`, distinguishing real synced seasons from backfilled ones.
- `src/database/helpers.ts` — `Season`/`SeasonRow` gain `hasFullData`; `createSeason` gains a `hasFullData` param and accepts `userTeamId: number | null` (a backfilled season genuinely doesn't know its team — every existing per-season query already treats `null` as "nothing to show," which is exactly the right behavior here).
- `src/database/importExtraction.ts` — `persistExtraction` backfills every completed year from `leagueHistory` that doesn't already have a season row (full or partial — a backfill never overwrites an existing row), saving only a `yearSummary` snapshot for each. New `formatBackfillSuffix()` appends a clear, honest explanation to the import/sync/relink success message when seasons were recovered (all three funnel through `persistExtraction`, so one helper covers all of them).
- `src/shared/types.ts` — `SeasonSummary` gains `hasFullData`; new `LeagueChampionSummary`/`LeagueConferenceChampion`/`LeagueHistoryYearEntry` types; `ProgramHistoryOverview` gains `leagueHistory`.
- `src/renderer/components/common/DynastyLayout.tsx` — season-switcher `<option>` labels history-only seasons ("2026 — History Only"); new `HistoryOnlySeasonBanner` explains the limitation in plain language above whichever tab is active, instead of rewriting every page's individual empty state.
- `src/renderer/pages/CoachHub.tsx` / `DynastyOverview.tsx` — their "Dynasty not found" fallback was actively wrong for a history-only season (the dynasty *is* found — only that season lacks data); both now check the selected season's `hasFullData` and show an accurate message instead.
- `src/database/getHistory.ts` / `src/renderer/pages/History.tsx` — new "League History" section, built from every season's `yearSummary` snapshot (full and history-only alike, unlike the rest of the page which stays scoped to full seasons since team win-loss data isn't recoverable for a history-only year) — the actual visible payoff of the backfill.

**Scope decisions:**
- Backfilled seasons never get roster/schedule/stats/teams/coaches snapshots — genuinely not recoverable from a single later snapshot, and not faked. Every existing per-season page already handles `userTeamId: null` gracefully; the new banner supplies the missing context in one place rather than rewriting ~8 pages' empty states individually.
- A backfill never overwrites an existing season row, full or partial — `persistExtraction` checks `getSeasonByYear` first and skips entirely if anything's already there for that year.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real-save diagnostics (disposable copies, isolated userData — never the user's real files): fresh Tulane import correctly backfilled exactly 2026-2028 (3 rows) alongside the real full 2029 season, all with correct real national/conference champion data; re-running the identical import a second time produced zero new/duplicate rows. Texas State (already fully synced 2026+2027, no gaps) correctly backfilled *nothing* on import, and double-import likewise produced no duplicates or changes.
- Migration safety: applied schema v4 to a copy of the user's real, existing 11-season live database — every pre-existing row correctly defaulted to `has_full_data = 1`, no data loss, no crash.
- Live screenshot verification: season-switcher dropdown showed all 4 Tulane entries with correct "History Only" labeling; selecting a history-only season correctly showed the new banner and the corrected (non-misleading) empty state; History page's new League History section rendered all 3 backfilled years with real national champions, coaches, and full 10-conference breakdowns.
- All diagnostic scaffolding and disposable save/database copies removed before finishing.

**No new dependencies added.**

---
## In-app Help menu

Direct follow-up to a real support conversation (season-sync timing — see the multi-season history entry above) that surfaced a gap: this app had no way to communicate how-to knowledge to the person actually playing a dynasty. DevLog.md answers "what shipped and why" for future development sessions; nothing answered "how do I use this" for the user in the moment.

**Shipped:**
- `src/renderer/components/common/HelpMenu.tsx` (new) — a navbar dropdown matching `PreferencesMenu.tsx`/`StadiumDatabaseMenu.tsx`'s existing panel pattern exactly (same underlay/gradient/shell chrome, click-outside-to-close, Escape-to-close), with a two-column layout: a topic list on the left, selected topic's content on the right (same shape as `StadiumDatabaseMenu`'s team-list/detail-pane split).
- `src/renderer/components/common/Navbar.tsx` — new "Help" button between Preferences and Stadiums.
- Seven topics at launch, defined in `HELP_TOPICS`: Importing your dynasty; Sync every season before you advance (the one that prompted this — explains the season-snapshot limitation and the "sync near the end of each season" habit in plain language); The Season dropdown & History Only seasons; Coach Hub vs. Team Hub; Sync/Relink/Backup — which one do I need; Editing players and coaches; and a short honest-limitations list (opponent stats not in box scores, no historical week-by-week poll trend, History Only seasons can't become full seasons after the fact).
- Content was checked against real code before writing it, not assumed: confirmed via `editorWrite.ts`'s `writeCoachFields` (only writes `GenericHeadAssetName`, no equivalent to the `PLYR_PORTRAIT` field players get — see the "Portrait field fix" entry) that a coach portrait change updates the picker/preview correctly but isn't confirmed to carry into the actual in-game render, unlike a player portrait change — that caveat is stated accurately in the Editing topic rather than glossed over.

**Scope decisions:**
- Seven topics, not an exhaustive feature-by-feature manual — per the user's own framing ("update the Help section whenever a use case situation needs to be mentioned"), this is meant to grow from real support needs over time, not front-load every nav tab's self-explanatory behavior on day one.
- **Standing project convention, saved to persistent memory:** keep this Help menu current going forward whenever a real how-to/use-case question comes up, not just DevLog.md — the two serve different audiences (future-developer-context vs. in-the-moment-player-guidance) and both need to stay accurate.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Live screenshot verification (temporary `capturePage()` + scripted button-click diagnostic, removed after use): confirmed the Help button renders in the correct nav position (right after Preferences); confirmed the panel opens with the topic list visible; confirmed clicking a topic switches the content pane correctly, rendering cleanly in dark mode.
- All diagnostic scaffolding removed before finishing.

**No new dependencies added.**

---
## Statistics page — Phase 1 (Team Statistics + Passing/Rushing/Receiving/Defense)

User handed over a full, detailed spec for an ESPN-style "Statistics" page — team-level box score stats plus seven player-stat categories (Passing, Rushing, Receiving, Defense, Kicking, Kick Return, Punt Return), leader cards, qualification rules, comparison mode, milestone tracking, hot players, expanded rows. The spec itself said "do not invent unsupported statistics" — matching this project's own standing discipline — so before planning, checked what's actually real against the save's own schema and a real save, the same way every extractor this session was built.

**Real find, previously unread by this app:** `Team.TeamSeasonStats`/`Team.TeamGameStats` (schema type `TeamStats[]`) resolve to a genuine 58-field team box-score table — total/pass/rush yards, first downs, 3rd/4th-down conversions, red-zone splits (offense and defense separately), sacks, turnovers, penalties, time of possession, punt/kick-return yards. Verified on two real saves: slot 0 always holds the *current* season's live-accumulating totals, cross-checked exactly against the team's own already-extracted `ConfWin`/`ConfLoss`/`NonConfWin`/`NonConfLoss` fields (a 7-6 record matched precisely on `DYNASTY-DYNASTYBOWL`). Unlike the two real slot-ordering bugs found and fixed earlier this session (player `SeasonStats`, league `YearSummary`), no complex "find the right slot" logic was needed here — slot 0 is reliably correct. Also confirmed: no `POINTS`/`POINTS ALLOWED` field exists anywhere in `TeamStats` — scoring is derived from the already-extracted schedule's own game scores instead of guessed or fabricated.

Also confirmed real and resolvable (verified against real players on a real save) but deliberately not wired up this phase: `CareerKickingStats` (a real punter, 70 attempts/3,083 yards), `CareerOffensiveKPReturnStats`/`CareerDefensiveKPReturnStats` (a real return specialist, 8 kick returns/207 yards) — these are Phase 2.

**Shipped:**
- `src/extractors/extract-team-stats.ts` (new) — `extractTeamStats(franchise, teamIndex)` reads slot 0 of `TeamSeasonStats`, mapped to a new `TeamStatsData` (58 real fields, camelCased).
- `src/extractors/extract-all.ts` / `src/database/importExtraction.ts` — `teamStats` added to `ExtractionData` and persisted as a new `teamStats` snapshot key, piggybacked on the existing `'stats'` progress step (no new extraction-step UI needed).
- `src/database/getTeamStats.ts` (new) — mirrors `getPlayerStats.ts`'s exact snapshot-read pattern. New `db:getTeamStats` IPC channel/handler/preload binding, new `TeamStats` shared type.
- `src/renderer/components/common/StatisticsTable.tsx` (new) — a reusable, config-driven sortable table: pass a `StatColumn[]` (key/label/`getValue`/optional `format`) and rows, get click-to-sort/click-again-to-reverse for free. Generalizes the sortable-header pattern already established in `Roster.tsx` (`SortableHeader`, `SortKey`) instead of hand-rolling seven separate table implementations across all planned phases. Whole-row click opens the player modal, matching `Roster.tsx`'s exact list-view convention (not a separate clickable name/link) — `null` values render as `-`, never a fabricated `0`.
- `src/renderer/pages/Statistics.tsx` (new) — Team Overview Cards (PPG, Total Offense, Pass/Rush YPG, Points Allowed, Total Defense, Turnover Margin, 3rd-Down%) computed from the new team-stats snapshot plus schedule-derived scoring; a 3-column Offense/Defense/Special-Teams breakdown (an honest "Not available" placeholder for 3rd-Down% Allowed, since the save only tracks one third-down conversion pair, not separate offense/defense splits — confirmed by the field list, not assumed); four full-width player categories (Passing/Rushing/Receiving/Defense), each with a leader card (top performer, portrait, clickable) and a sortable `StatisticsTable`. Season Total / Per Game toggle divides counting stats by `gamesPlayed` at display time (rates/longest-play columns are correctly excluded from the divide). Rows for each category are built by joining the existing `getRoster`/`getPlayerStats` snapshots client-side by `playerId` — the exact same join pattern `PlayerProfileContent.tsx` already uses — filtered to players who actually recorded a stat in that category (e.g. `passAttempts > 0` for Passing), so a QB who also rushes correctly appears in both Passing and Rushing without a table full of fabricated zero-rows for players who never touched a category.
- `src/renderer/app.tsx` / `DynastyLayout.tsx` — new `statistics` route and "Statistics" nav tab (12th tab, inserted after Standings).
- Every player row and leader card is clickable and opens the existing player profile modal (`usePlayerModal().openPlayerModal`) with the table's current sorted list as `navigationIds` for Prev/Next — a standing, explicit user requirement for this page (and, going forward, anywhere a player name appears), not just a Phase 1 nicety.

**Scope decisions (Phase 1 of 4, all flagged directly rather than silently dropped):**
- Kicking, Kick Return, Punt Return — real data confirmed resolvable (see above), deferred to Phase 2 since it needs new `extract-stats.ts` category recognition, not new table architecture.
- Qualification-rule minimums on leader cards, and player comparison mode — Phase 3.
- Regular Season/Postseason split, Home/Away/Opponent filters, Hot Players, Milestone tracker, expanded per-game rows — Phase 4; these need aggregating the existing `gamelog` per-game snapshot (already extracted for offense/defense) against the schedule's `isBowlGame`/CFP flags, which isn't wired up yet. Kicking/Return per-game splits specifically aren't available even for Phase 4 without further extraction work — `extractGameLog` skips those tables today for the same reason `extractStats` used to.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean.
- Real-save diagnostics (disposable copy of `Dynasty Save Test/DYNASTY-DYNASTYBOWL`, a fully-simulated 13-game season, isolated userData — never the user's real saves): confirmed `TeamStats` slot 0 resolution against two real saves before trusting it in the UI (see above).
- Live screenshot verification: full page rendered with real cross-validated data (13 games × 24.1 points allowed/game ≈ 313 total, matching the breakdown table exactly); Passing/Rushing/Receiving/Defense leader cards and tables all showed real players with correct stats (a dual-threat QB, Brad Jackson, correctly appeared in both Passing — 267/433, 3,165 yds, 24 TD — and Rushing — 154 att, 576 yds); clicking his stat row opened the existing player profile modal with matching numbers and working Prev/Next navigation.
- All diagnostic scaffolding and the disposable save copy removed before finishing.

**No new dependencies added.**

---

## Phase — UX, Data Persistence & Navigation Refinement (overnight autonomous pass)

User provided a full 22-section spec covering navigation cleanup, Dynasty/Coach Hub/Team Hub redesign, historical player persistence, Schedule/GameDetail rework, Statistics leader cards, Awards restructure, Recruiting profile modal, and a History page rebuild, then authorized a full overnight autonomous pass with no further check-ins. Worked through it in the spec's own suggested phase order, adapting scope wherever real investigation contradicted the spec's assumptions — documented per item below rather than blindly implementing every literal sub-request.

**Shipped:**
- **Team Mode theme bug fixed** — `DynastyLayout.tsx` was hardcoding `{primary: null, secondary: null}` into `resolveColorVars` instead of fetching the dynasty's real saved theme; now fetches via the already-existing `getDynastyTheme` IPC channel.
- **Player modal season-context bug fixed app-wide** — `openPlayerModal` gained a `seasonId` parameter (breaking change, threaded through every call site: Roster, Statistics, StatisticsTable, TeamAwards, Awards subpages, GameDetail). `PlayerProfileContent.tsx` now resolves the requested season first, falling back to scanning every season for the player, instead of always assuming the current one — this was the real fix for "player not found" on departed players, not a new persistence system. Investigation confirmed the existing `season_snapshots` table already fully satisfies historical durability (immutable per past season) — the bug was purely a lookup-layer gap, which de-scoped the spec's proposed `HistoricalPlayerSnapshot` rebuild down to this surgical fix.
- **Centralized edit-gating**: `canEditPlayer`/`canEditRoster` now derive from `viewedSeason.isCurrent`, hiding Edit icons app-wide (Roster, Player Profile Modal) when browsing a past season.
- **Game log Rating removed everywhere** (Player Profile Modal, GameDetail box score, Top Performer callout) — replaced with a real Win/Loss + score line (new `gameResultLine`) and a new counting-stat-only `gameImpactScore` (`src/renderer/lib/gameImpactScore.ts`) for "best game"/"top performer" selection, replacing the save's own distrusted `gameRating` field.
- **Dev Mode removed** — `DevTokenEditorMenu.tsx` and `src/design/devTokenStorage.ts` deleted; boot now always applies `DEFAULT_TOKENS`. Real dev tooling (diagnostic env-gated branches in `main.ts`, logging) was explicitly preserved, per the spec's own carve-out.
- **Exports page removed** — `Exports.tsx` and its route/nav deleted; the one real feature it provided (HTML history export) moved to an icon button directly on the Dashboard card, next to Sync.
- **Coach Hub rewritten for OC/DC-controlled dynasties** — real, higher-severity bug found while investigating: `findUserTeamIndex()` (`extract-coaches.ts`) hard-required `position === 'HeadCoach'` AND `isUserControlled`, meaning **importing an OC/DC-controlled dynasty threw and failed entirely at import time**, not just displayed wrong. Fixed to match on `isUserControlled` alone. `getCoaches()` now returns a separate `userCoach` (whoever the user actually is) alongside `headCoach` (the real HC); Coach Hub's staff list correctly excludes only the user, never assumes HC. Hero rewritten: large (450×450, `object-contain`) portrait with no overlapping team-logo badge, a new "Current Position" line. Archetype/Personality removed from Coach Profile, remaining 4 fields now fill the grid evenly. "Since Importing" panel removed entirely (Career Record is the single authoritative source, same precedent as the coach-centric redesign's earlier "dual-sourced" choice, now simplified to one source). Previous Seasons Timeline rows gained real per-season trophy/logo icons (national championship, conference championship, bowl), sourced from new `conferenceChampionName`/`bowlAssetName` fields on `ProgramHistorySeasonEntry` so the right asset resolves even after future realignment/rebranding.
- **Dashboard redesigned coach-centric** — cards now show the coach's portrait (layered in front of, and offset from, the team logo) with coach name as the title and team name secondary; new `coachPortraitIdentity` helper. `DynastySummary.headCoachName` renamed to `coachName` (now resolves to the real user-controlled coach, not always the HC) with a new `coachPortraitAssetName` field.
- **Team Hub**: bowl-appearance badge doubled in size, Head Coach panel removed (redundant with Coach Hub), a "Schedule" link added to Recent Games, and season-high AP/Coaches/CFP rank moved here from Rankings.
- **Rankings trimmed** — the entire Ranking Trajectory section (chart, `RankingChart.tsx` deleted entirely, dead explanatory text) removed, since the save doesn't reliably store week-by-week history and a sparse-point chart would look more authoritative than the underlying data supports. Season-high tiles moved to Team Hub (not duplicated).
- **Schedule + GameDetail reworked**: real event names (e.g. "Alamo Bowl") instead of generic "Neutral Site"; a new opponent-record column and a genuinely computed running record (`getSchedule.ts`'s new `applyRunningRecords()`, iterating completed games chronologically, correctly skipping ties/unplayed games) — verified live against a real 13-game season, both columns rendering correct real values. Type-column icons enlarged ~50%. GameDetail's box score rebuilt on the shared `StatisticsTable` component (same header/sort/numeric-alignment styling as the Statistics page) with a new category-specific `hasMeaningfulStats` filter (QB needs pass attempts, RB needs rush attempts, etc.) — verified against real data that this correctly includes players with real reception stats even when a screenshot's visible columns happened to be scrolled to the pass/rush side showing "-".
- **Statistics leader cards**: Player Search removed entirely; each category now shows multiple real leader metrics (Passing: Yards+TDs; Rushing: Yards+TDs; Receiving: Receptions+Yards+TDs; Defense: Tackles+Sacks+INTs+Defensive TDs when ≥1 exists) with explicit tie handling ("— Tied" + "+N other(s)").
- **Standings investigated, not changed** — direct real-save schema inspection (`Conference.Divisions` → `Division0`/`Division1`) confirmed `Division0` resolves but its `Teams` field contains the *entire* conference roster with blank names, `Division1` never resolves, and `Team.DIV_SLOTNUMBER` is a near-constant `7` across nearly every team — no real per-dynasty division split exists in this save format (matching real-world FBS's own elimination of divisions in most conferences). Deliberately not built, to avoid fabricating a structure the save doesn't track.
- **Awards restructured into a submenu** — `Awards.tsx` split into `src/renderer/pages/awards/` (`AwardsLayout` fetching `AwardsOverview` once, `AnnualAwards`, `AllTeams`, `WeeklyHonors`, sharing state via React Router's `Outlet` context) plus the existing `TeamAwards.tsx` moved under `/awards/team` unchanged. Standalone "Team Awards" nav tab removed. Verified live via screenshots: Annual Awards, All Teams (with correct sub-nav highlighting), Schedule, and GameDetail all confirmed rendering correctly against real data.
- **Recruiting profile modal built** — new `RecruitModalProvider`/`RecruitProfileModal`, mounted at the app root (mirrors `PlayerModalProvider`'s architecture, avoiding the known `<main>` clip-path issue). Unlike the player modal, holds the full `RecruitBoardEntry` directly (already in memory from the board) rather than re-fetching by id. Shows portrait (see bug below), stars, national/position/state rank, bio tiles, and a status panel with the signed school's logo (gold variant, only for the user's own signed recruits, plain variant for recruits lost to another school). **Real bug caught by screenshot, not code review**: recruits have no `portraitAssetName` field anywhere (confirmed — the initials fallback is not a rare edge case, it's what every recruit shows, always), and `PlayerPortrait`'s `large` fallback shrinks to fit its text content with no fixed size — the school logo (128px) rendered visually larger than the recruit's own initials avatar, violating the spec's explicit "portrait stays the dominant subject" rule. Fixed with a purpose-built fixed-size (160px) `RecruitAvatar` instead of reusing `PlayerPortrait`'s fallback. Re-verified via screenshot: avatar now clearly reads as the dominant element next to the 128px logo.
- **History page rebuilt** — new `Historical Summary` row (Seasons Coached, Career Record, Schools Coached, Conference/National Titles, Bowl/Playoff Appearances, 10-Win Seasons); the old scattered 2-column "Dynasty Resume" + separate "Coaching Ledger" cards replaced with one resume-style `DynastyResume` section using the coach's real save-native `CareerCoachStats` (rivalry/Top-25/bowl/playoff/conference/national-championship game records, draft picks, first-round picks, top-5 recruiting classes) — the same authoritative-career-stats precedent Coach Hub already established, not a fabricated dynasty-only slice. Added two new real cross-season aggregates to `getHistory.ts`: `bestRecruitingClassRank` (mirrors the existing `bestMediaRank` pattern, using `TeamData.topClassRank` already read every loop iteration) and `nationalAwards` (scans every season's real `awards` snapshot for `leagueAwards` entries — including Heisman — where `teamDisplayName` matches the program, no new extraction needed). The old per-coach "Coaching Ledger" card is gone; its unique data (per-coach win/loss splits) folds into a compact sub-list inside Dynasty Resume, shown only when the archive actually has more than one coach. School Record Book changed from a 2-column card grid to one full-width row per category, per the spec's explicit "never side-by-side just to save space" instruction.

**Scope decisions (deliberately trimmed from the spec, flagged directly):**
- **Game-record opponent context** (spec wanted "vs. Marshall, 2027" on single-game school records) — confirmed via direct inspection of `extract-teams.ts` that the save's own built-in `PlayerStatRecord` table only carries `firstName/lastName/position/calendarYear/statValue/statType`, no opponent/week/score reference at all. Cross-referencing against this app's own gamelog/schedule archive was considered and rejected: most legacy school records predate the dynasty archive entirely (the record book is cumulative across the save's full simulated history), so a matching attempt would silently fail for the vast majority of records — not worth the complexity for a low hit rate. Documented directly in the page copy instead of fabricating context.
- **Diagnostic screenshot scaffolding in `main.ts`** (`SCREENSHOT_ROUTE`/`SCREENSHOT_DIR`/`SCREENSHOT_NAME`, plus a new `SCREENSHOT_CLICK_SELECTOR` added tonight for modal verification) — kept rather than removed. Reconsidered mid-pass: this is env-gated, zero-risk when unset, and has been this project's standing verification mechanism across many sessions (disposable-save-copy + isolated `--user-data-dir` + live screenshot), not one-off scaffolding — removing it would just mean rebuilding it next session.
- A small trophy-icon artifact previously flagged from an earlier screenshot (Coach Hub timeline, winless season) couldn't be reproduced with the disposable save state still available; direct code review of the timeline row confirmed every icon is gated behind a real boolean + non-null check with no path for a stray render — most likely a screenshot-scaling artifact, not a code defect.

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean after every major change and again at the end of the full pass.
- Extensive live screenshot verification against disposable copies of two real saves (`DYNASTY-TESTER` for a fresh preseason dynasty, `DYNASTY-DYNASTYBOWL`/Texas State for a completed 13-game season with real recruits), isolated `--user-data-dir` paths throughout: Dashboard card composition (two iterations — first attempt had the team logo overlapping the coach's face, fixed and re-verified), Coach Hub hero/timeline, Awards Annual/All Teams, Schedule (real event names, opponent record column, running record), GameDetail box score, Recruiting modal (both before and after the portrait-sizing fix), History page (all-new resume layout).
- All disposable saves, diagnostic scripts, and scratch screenshots cleaned up at the end of the pass.

**No new dependencies added.**

---

## Phase — Schedule fix, Breakout POY removal, Kicking/Return stats (2026-07-19)

Direct follow-up to the overnight pass, picking three items off the resulting backlog: fix the flagged `extract-schedule.ts` season-scoping bug, cut Breakout Player of the Year from Team Awards scope, and build the kicking/return stat extraction that both Statistics Phase 2 and Team Awards' Special Teams POY were blocked on.

**Shipped:**
- **`extract-schedule.ts` season-scoping bug fixed at the source.** Real-save investigation (a plain Node script against the `madden-franchise` library directly, no ts-node needed) found `SeasonGame` records carry their own `SeasonYear` field — a 0-based relative index (0 = the dynasty's first tracked season), same convention as player `SEAS_YEAR` slots. Converting to an absolute calendar year is `baseCalendarYear + SeasonYear`, already verified exact elsewhere in this codebase (`extract-league.ts`'s own doc comment). `extractSchedule()` now takes the expected relative year for the season actually being synced (computed once in `extract-all.ts` as `league.seasonYear - league.baseCalendarYear`) and filters to just those games. Verified on two real saves: a normal single-season save was unaffected (944/944 games, unchanged); a real multi-season save caught exactly at a season boundary (fresh 2029 preseason, `SeasonGame` holding only 43 leftover 2028 bowl games, all `SeasonYear` index 2) previously would have wrongly attributed those 43 stale games to the new 2029 season snapshot — after the fix, season 2029 correctly and honestly persists 0 games (nothing generated yet), rather than borrowing the prior season's leftovers.
- **Breakout Player of the Year removed from Team Awards scope entirely** — explicit user decision, not just left disabled. Deleted from `AWARD_DEFINITIONS` in `awardDefinitions.ts`; the file's own header comment updated from "12 awards" to "11 of the spec's original 12 awards."
- **Kicking, Punting, and Return stats extracted — and a real "players silently dropped from all stats" bug fixed along the way.** Real-save investigation (same direct-library diagnostic approach) found the actual structure was different from what "kicking/return stats aren't extracted yet" implied:
  - Kicking and punting share one real save table (`CareerKickingStats`/`SeasonKickingStats`), used by both K and P — genuinely a separate stat category, not merged into the offense/defense binary. New `extract-kicking.ts` (mirrors `extract-stats.ts`'s structure exactly: same "highest SEAS_YEAR slot" season-resolution pattern), new `kicking` snapshot key, new `getKickingStats.ts` query, full IPC round-trip (`ipcChannels.ts` → `types.ts` → `preload.ts` → `main/ipc/database.ts`).
  - Return duty (kick/punt returner) is **not** a separate category at all — a player with real return snaps has their `CareerStats`/`SeasonStats` reference resolve to `CareerOffensiveKPReturnStats`/`CareerDefensiveKPReturnStats` (or the `Season*` equivalents) instead of the plain offense/defense table: same passing/rushing/receiving/tackle fields, plus extra `KRET*`/`PRET*` return columns. `categoryFromTableName()` in `extract-stats.ts` didn't recognize these table names, so **any player with real return duty was silently dropped from every stat category entirely** — not just missing return numbers. Confirmed on a real player (a WR with 11 kick returns for 295 yards, genuinely zero stats shown anywhere in the app before this fix). Fixed by recognizing both table-name variants as their real offense/defense category, and adding 8 new return fields (`kickReturns/Yards/TDs/Longest`, `puntReturns/Yards/TDs/Longest`) to `OffensiveStatLine`/`DefensiveStatLine`, populated via a field-presence check (`'KRETATTEMPTS' in r.fields`) since the plain offense/defense tables have no return columns at all — 0 for those players is a real "not a designated returner" fact, not a placeholder. Same fix applied at the per-game level in `extract-gamelog.ts` (`GameOffensiveKPReturnStats`/`GameDefensiveKPReturnStats` now recognized, reusing the existing mappers unchanged since the relevant fields are already common to both table variants) — per-game return *yardage* itself stays deferred, matching the already-documented Phase 4 scope.
  - New "Kicking" and "Punting" sections on the Statistics page (leader cards + sortable tables, reusing the existing `StatisticsCategorySection`/`StatisticsTable` machinery — `KickingStatLine` already has `gamesPlayed`, so no new generic helper was needed), plus a new "Returns" leader-card section covering both offense- and defense-category return specialists in one view (`ReturnCandidate`, normalizing both into one shape since return duty is orthogonal to side of ball). `LeaderCard`'s `row` prop was generalized from a hardcoded `PlayerRow` type to a minimal structural `LeaderCardRow` interface so the same card component works for all three new row shapes without an unsafe cast.
  - `PlayerProfileContent.tsx`'s cross-season stat-summing helpers (`createEmptyOffensiveLine`/`addOffensiveLines`/etc., used to total a player's stats across multiple imported seasons) needed the same 8 new fields added — caught immediately by `tsc`, not a runtime surprise.
  - Team Awards' Special Teams Player of the Year `disabledReason` updated to reflect the real current state (data now exists, scoring engine itself still not built) — status moved from "Blocked" to "Planned" on the agenda board.

**Errors hit & fixes:**
- A doc comment containing a literal `*/` (`KRET*/PRET*`) inside a `/** */` block comment closed the comment early, spilling the rest of the sentence into the code and producing a wall of cascading syntax errors — caught immediately by `tsc`, fixed by rewording to avoid the character sequence.
- Real UI bug caught by live screenshot, not code review: the Returns leader cards initially only guarded the two touchdown metrics with `onlyIfPositive`, not the two yardage metrics — on a real team where every returner only returns kicks (never punts), the "Punt Return Yards" card showed a false leader at 0 yards instead of not appearing at all. Fixed by requiring a positive value for all four return metrics; re-verified via a second screenshot showing only the genuinely-earned "Kick Return Yards" card.
- The diagnostic screenshot tooling's `SCREENSHOT_FORCE_HOVER_SELECTOR` capture only shows the window's initial viewport height (2600px) — the new Kicking/Punting/Returns sections render below that fold on the Statistics page. Temporarily widened the diagnostic capture height to verify, then reverted it back to 2600 before finishing (not a permanent tooling change).

**Verification:**
- `npm run typecheck`, `npm run lint`, `npm run build` all clean after every step.
- Direct real-save schema investigation via plain Node scripts against the `madden-franchise` library (no ts-node in this project) — confirmed `SeasonGame.SeasonYear`, `CareerKickingStats`, `CareerOffensiveKPReturnStats`/`CareerDefensiveKPReturnStats`, and their `Season*`/`Game*` equivalents, all before writing any extraction code.
- Real diagnostic imports (disposable save copies, isolated `--user-data-dir`, never the user's real data) against both a single-season save (regression check — unaffected) and a real multi-season save caught exactly at a season boundary (the actual bug scenario) for the schedule fix; a real 13-game season for the kicking/return work, confirming a real punter (69 punts, 3,036 yards) and kicker (15/19 FG) correctly split into separate rows, and two real HBs with genuine rushing/receiving production *and* real return yardage (485 and 359 yards) showing up correctly where they were previously invisible.
- Live screenshot verification of the new Statistics sections (Kicking, Punting, Returns), including the one real bug caught and fixed mid-verification (see above).
- All disposable saves, diagnostic scripts, and scratch screenshots cleaned up at the end.

**No new dependencies added.**

---

## Phase — Annual awards year-scoping fix + save award-pruning finding (2026-07-22)

Playtest bug report: in a multi-season dynasty the Annual Awards page showed the *same* award with multiple winners (2 John Mackey, 2 Butkus, 2 Shaun Alexander…), a player's Honors repeated identically every year (a QB shown "Freshman All-American" in 2026, 2027 *and* 2028), and at the start of a new season prior-year All-Americans/All-Conference already appeared (last year's now-upperclassmen still on the "freshman" teams). User also asked that awards not display until actually handed out in-game.

**Shipped:**
- **Root cause (confirmed on a disposable copy of a real 3-season save):** `PlayerAward` is an *accumulating* per-year ledger — one `Period="Season"` row per award per year, keyed by `PeriodIndex` = season index (`0` = `baseCalendarYear`). `extract-awards.ts` read the whole table unscoped and stamped every year still present onto the season being synced. Same bug-class `extract-league-history.ts` already fixed for the flat `LeagueHistoryAward`/coach-awards table.
- **Fix (going-forward, `extract-awards.ts`):** `extractAwards` now takes `currentSeasonIndex` (`league.seasonYear - league.baseCalendarYear`) and skips any `Season`-period row whose `PeriodIndex` ≠ current season, so each sync captures only its own year no matter how much stale data the table holds at that moment. `extract-all.ts` passes the index through. Also tightened the loop so *only* `Game`-period rows reach the weekly-honors ledger — previously a Heisman/other non-marquee Season award on the user's own team could leak into weekly honors (`PeriodIndex` there is the week, not a year).
- **"Not until handed out in-game" — satisfied by the same fix:** a year's postseason rows are only written when that season finishes, and `getAwards.ts` already filters out preseason `_PRE` watch-list rows at display time, so scoped current-year awards only appear once real.

**Scope decisions — retroactive repair attempted, then reverted (the important finding):**
- Built a sync-time repair that re-derived each already-recorded season's awards from the current save (one-pass `byYearIndex` map + a repair loop in `persistExtraction`). Tested it against a **copy of the real archive DB** (never the live one) before shipping.
- The test proved it **lossy and harmful**: the game **prunes older years' award detail from the save over time**. A season whose live snapshot captured **1,498** All-American rows retained only **~499** for that same year two seasons later; individual marquee winners (e.g. that year's Best DB / Best Receiver) were gone entirely. Re-deriving a past year from a later save therefore *deletes* honors the live sync had captured correctly.
- Set-difference between adjacent stored snapshots was also rejected — it silently drops legitimate repeat 1st/2nd-team All-Americans (a star honored two years running).
- **Conclusion (durable):** a season's awards can only be captured faithfully by the sync taken **while that season is current**, which the year-scoping fix now guarantees. Already-polluted past seasons in existing archives are a bounded, one-time cosmetic artifact and are **not** auto-repairable without data loss. The whole repair path (`byYearIndex`, the extra `ExtractionData` field, the loop) was reverted; only the going-forward scoping remains.

**Verification:**
- `npm run typecheck` + `npm run lint` clean (before the revert with the repair, and again after reverting to the going-forward-only fix).
- Data-level proof via plain Node scripts against `madden-franchise` on a disposable save copy: unscoped extraction = 31 marquee (9 duplicated types) + 2,844 All-Americans across 3 years → scoped = 20 marquee (0 duplicates) + 1,497 All-Americans (exactly one year, matching the per-`PeriodIndex` tally).
- Pruning confirmed by reading a **copy** of the real archive DB (`season_snapshots`): per-season award counts + cross-year player overlap (2026's freshman All-Americans literally present in the 2027 snapshot), and the 1,498→499 shrinkage of a past year in the live save vs its stored snapshot.
- All disposable copies + scratch scripts kept out of the repo (session scratchpad only).

**No new dependencies added.**

---
## Phase — Game Info rework, helmets & jersey overlays, Schedule premium, native menu → v0.6.0 release (2026-07-24)

**Shipped:**
- **Helmet + jersey asset libraries.** User-supplied team helmet renders (`public/assets/helmet/{left,right}`) and team jerseys (`public/assets/jersey`) converted to WebP (helmets q90; jerseys q90 + `alphaQuality:100` so the collar edge on skin stays pixel-perfect). Both key 1:1 with the existing 3D-logo token, so `helmetAssetMapping.ts` / `jerseyAssetMapping.ts` DERIVE paths from the shared token (no drift-prone second table), routed through `canonicalKey` so abbreviated schedule names resolve.
- **Game Information matchup rework** (`GameDetail.tsx`, universal for every league game): threaded each team's real save colors through `GameDetailTeamSide`; transparent helmet-duel header (away helmet faces right on the left, home faces left on the right — verified against the art, the source folder names are the opposite of the facing) with a big/bold hero score, winner tint, and a per-side W/L chip; the bowl/conference/CFP emblem moved to the top-center above the eyebrow and scaled up (square box, since the logos are square 1024² canvases); quarter table recolored per-team; team stats became 9 center-anchored diverging bars (third-down by conversion RATE, possession by seconds, zero-safe); Top Performer became a two-player "Star of the game" duel by game-impact.
- **Jersey overlays on portraits** — `PlayerPortrait` gained an optional `teamAssetName`; when it maps to a jersey, the jersey is stacked 1:1 in the same 512×512 box (matched object-fit, only over a real portrait, hidden on the initials fallback / on 404). Applied at RENDER time so a transfer just changes the team and the jersey follows. Threaded into Roster, Statistics (leaders + Hot Players + split card), National Players, Player Profile (hero + opposing-team fallback), Game Detail, Awards (AwardsShared), Top Players.
- **Schedule premium pass** — shared `ScheduleHero` masthead (team helmet facing right + eyebrow + big team name + stat chips + team-color edge) on both the user's own and any league team's schedule; shared `ResultChip` (W/L pill) + per-row W/L accent bars.
- **Native menu bar restored for DEV ONLY** — `buildAppMenu()` (role-based: Reload/DevTools/zoom/clipboard/quit), gated on `!app.isPackaged`, plus a `before-input-event` F12 / Ctrl+Shift+I DevTools shortcut. Packaged releases stay menu-less. (Root cause of "DevTools stopped working": the earlier `setApplicationMenu(null)` killed the menu accelerators.)
- **v0.6.0 release — COMPLETE installer.** Bumped 0.5.0→0.6.0. `electron-builder.js` now takes a `SLIM_INSTALLER` env toggle: default = COMPLETE (app + all graphics in one installer, media `asarUnpack`ed so cfbmedia:// serves real files); `SLIM_INSTALLER=1` = the 0.5.0 slim-app + separate image-pack path (kept wired for next update). Jersey folder added to the slim exclude list + `assets-installer.nsi`.

**Scope decisions:**
- Jersey overlay deliberately NOT wired on Team Awards thumbs, Player Comparison, Transfers, the 32px player-switcher nav thumbnails, or Media (team not cleanly available / tiny / team-less); recruits correctly get none (not on a team). Easy follow-ups.
- Reverted to the COMPLETE installer for 0.6.0 by user's call (the graphics library just grew, so one download is simpler); the slim two-installer split is intact behind the env flag for the following update.

**Errors hit & fixes:**
- Helmet facing: the `left`/`right` source folders are named for the side of the helmet shown, which is the OPPOSITE of the facing — verified visually before wiring so the duel faces inward.
- Hero emblem read small until I measured it: the bowl logos are square 1024² canvases, so a height cap was shrinking them — switched to a square box.
- `NationalPlayer` has `teamDisplayName` (not `teamName`) — typecheck caught the first pass.

**Verification:**
- typecheck + lint + prod build clean throughout. Live screenshots (temporary throwaway `gdtest` route for the modal-only GameDetail, removed after) of: Game Info in light+dark (Clemson@LSU, App St@ECU) incl. bowl/conference/CFP emblems; the 2× helmets; the Schedule hero (App St own + Toledo league); jersey overlays on the Alabama roster gallery + the GameDetail Top Performer duel. `app.isPackaged=false` confirmed for the unpackaged (.bat) launch so the dev menu shows.
- Jersey feasibility proven up front by compositing a jersey over real portraits with `sharp` before committing (and re-checked from the WebP).

**Filesize:** helmets 92.7→24.0 MB; jerseys 12.9→2.1 MB. 0.6.0 is the COMPLETE installer (app + full graphics, ~1 GB) rather than the 103 MB slim app.

---
## Phase — NIL on the roster + 0.6.1 slim release (app + graphics pack) (2026-07-24)

**Shipped:**
- **NIL on the roster.** Probed a real save first (data-absence discipline): `Player.CurrentNILCompensation` is the actual per-player NIL pay in $K — 0 for no deal, never negative (verified league-wide, ~92% populated) — the right field, vs the signed `BaseNILValue` "demand" which sums negative. Threaded via the shared `mapPlayer` (so BOTH the user's roster and any viewed league team get it) → `RosterPlayer.nilCompensation?`. Roster page: sortable NIL column right of OVR (list + gallery card badge), and the old UNITS stat tile is now **NIL = total team spend**. `formatNil`: `$XK` / `$X.XM` / "—". Verified end-to-end via a fresh import — user team $335K; Texas State (viewed) $620K + Brad Jackson $175K, matching the raw-save probe to the dollar. NOTE: extraction change → needs a re-sync to populate.
- **0.6.1 = SLIM release (app + separate graphics pack).** Reverting to the two-installer model after 0.6.0's one-time complete build. `SLIM_INSTALLER=1 npm run package` → ~103 MB app (media excluded, served over cfmedia:// from an external folder); `npm run package:assets` → the one-time Image Data pack (assets-installer.nsi, VERSION 0.6.1, now includes helmet + jersey). This also fixes 0.6.0's slow install (no 27k-file asarUnpack — the slim app carries no media at all).

**Scope decisions:**
- Chose slim-app + graphics-pack (user's call) over an app-only installer: a slim app upgrading over 0.6.0 removes 0.6.0's *bundled-in-app* media, so without a persistent external pack the app would show the "Locate image data folder" gate. The pack writes the HKCU registry pointer to a persistent folder, so every future app-only update stays tiny and images keep working.

**Verification:**
- typecheck/lint/build clean. NIL verified against DYNASTY-APPMASTER on a disposable copy + a fresh in-app import (both roster paths). Slim app packaged + confirmed it excludes the media and resolves an external asset folder (config/registry) for the new helmet/jersey assets too.

**Filesize:** 0.6.1 app ~103 MB + Image Data pack (~900 MB, one-time). vs 0.6.0's single ~1 GB complete installer.

---
## Phase — Weekly-honor opponent fix → 0.6.2 (app-only) (2026-07-24)

**Shipped:**
- **Bug fix (user-reported): Weekly Honors showed the wrong opponent past week 0.** `getAwards` built its week→game lookup from the LEAGUE-WIDE `schedule` snapshot keyed by week alone, so dozens of games per week collapsed to whichever was last in the array (almost never the honored team's game) — the opponent then resolved to a random school (NDSU's honors showed Notre Dame / Ole Miss / C. Carolina, teams it never played; week 0 matched by luck). Fix: filter the schedule to the honored team's own games (`home/awayTeamIndex === userTeamId`) before building the map. It's a READ-TIME fix — **no re-sync needed**, corrects existing saves on the updated app. Verified against a real import: wk3 Charlotte, wk6 Old Dominion, wk8 James Madison all match the schedule.
- **0.6.2 = app-only slim rebuild.** Bumped app to 0.6.2; the 0.6.1 graphics pack is unchanged and still valid (assets identical), so only `SLIM_INSTALLER=1 npm run package` was rebuilt (~139 MB). nsi/pack VERSION stays 0.6.1.

**Verification:** typecheck/build clean; weekly-honor opponents verified to match the schedule via a fresh in-app import.

---
## Phase — Team Hub Statistics: Team/Player split + filter-driven team stats (2026-07-25)

**Shipped (Phases 0–6 of the Statistics refactor — COMPLETE; not yet released):**
- **The core bug fixed: team stats now respond to the filters.** Previously the game-type/opponent filters only re-scoped the *player* leaderboards; the team summary + breakdown were frozen at static full-season per-game values (`perGame(teamStats.X)`), silently ignoring every filter. Rebuilt the whole Team view on a per-game aggregate.
- **New data layer.** `getTeamGameStats(dynastyId, teamIndex, seasonId)` (+ IPC/preload/types) returns a per-game team+opponent stat line for any team, derived from the league-wide `schedule` snapshot (`homeTeamStats`/`awayTeamStats`), tagged with gameType (conference/non-conference/bowl) + siteType (home/away/neutral) + rivalry. `renderer/lib/teamStats.ts` is the shared filter+aggregate layer: `filterTeamGames`, `aggregateTeamGames` (ratio-correct — sums conv/att, never averages percentages), `opponentOptions`, `availableGameTypes` (only buckets that actually occur), `ratioPct`, `perGame`, `turnoverMargin`.
- **Phase 0 proof:** summing per-game team+opponent stat lines EXACTLY reproduces the season `TeamStats` (totalYards 3860=3860, 3rd-down conv 54=54, takeaways 9=9), so nothing is lost vs the old TeamStats-only path — and per-game opponent lines give us a stat we never had.
- **New capability: 3rd Down % Allowed** (from `opponentStats` per game) — was hardcoded "Not available". Verified 29.9% season / 28.6% conference-only.
- **Team Stats / Player Stats become an explicit `SegmentedControl` switch** (default Team) in a new sticky filter bar shared by both views (replaces the old "Compare Players" entry point; Compare now lives inside Player Stats). New reusable `ui/SegmentedControl.tsx` + `ui/CollapsibleSection.tsx`.
- **Season Total vs Per Game** is now a real, correct toggle — labels flip ("Points" ↔ "Points / G"), values switch between summed totals and per-game averages over the *filtered* game count.
- **Honest labeling.** Stats with no per-game source (red-zone %, kick/punt return yards, INTs, fumble recoveries) come from full-season `teamStats` and are tagged **SEASON** (or **FULL SEASON** when a filter is active) so it's unambiguous they ignore the filter. Empty state when a filter matches 0 played games.
- Offense/Defense/Special Teams breakdown is now collapsible (Special Teams collapsed by default).
- **Phase 4 — Player Stats view:** every category section (Passing/Rushing/Receiving/Defense/Kicking/Punting/Returns) is now collapsible via a shared `collapsible`/`defaultOpen` prop on `StatisticsCategorySection` (reusing `CollapsibleSection`), with a live player-count on the header right. Main four default open, Kicking/Punting/Returns collapsed. Compare Players was already relocated to a secondary top-right button (Phase 2). GameDetail's use of the same component is untouched (collapsible defaults off).
- **Phase 5 — responsive/visual pass.** The app's real floor is `minWidth: 1024` (desktop Electron — no phone widths exist), so verification targets 1024→1400, not mobile. Team breakdown grid → `md:grid-cols-2 lg:grid-cols-3` so at the 1024 floor Offense+Defense sit side-by-side instead of one full-width column with a huge label→value gap. Confirmed the sticky filter bar fits one row at 1024, summary tiles reflow 2-up, and the player tables already scroll inside their own `overflow-x-auto min-w-[720px]` container (no page-level horizontal scroll). Added a hover affordance to `CollapsibleSection` (chevron + eyebrow brighten to the team accent) now that those headers are the primary interactive element in both views. Added a permanent `SCREENSHOT_SIZE="W,H"` override to the main.ts screenshot harness so responsive widths can be captured.
- **Phase 6 — QA/acceptance matrix + a real gap fixed.** Ran a full acceptance pass via the live IPC path (SCREENSHOT_EVAL against the real DB): **parity confirmed programmatically** — per-game sums exactly equal the season `TeamStats` on all 8 spot-checked fields (totalYards/passYards/rushYards/3rd-down conv+att/takeaways/sacks/penalties). **QA caught a real gap:** the fetch effect early-returned in league mode and never called `getTeamGameStats`, so viewing any non-user team showed an EMPTY Team Stats view — even though the league-wide `schedule` snapshot means `getTeamGameStats` reconstructs any of the 143 teams' per-game stats (verified: Alabama returns 9 played games with real scores). Fixed: league mode now fetches `getTeamGameStats(viewedTeamIndex)`; `TeamStatsView` accepts a null `teamStats` and renders the season-only rows (red-zone %, return yards, INTs, fumble recoveries) as "—" for league teams (those cumulative fields genuinely aren't tracked per non-user team — `getTeamStats` is user-only), while all filterable/per-game stats (incl. the new 3rd-down-allowed) work for every team. Reworded the no-data empty state ("No games have been played yet this season.") since it's no longer only the user's-unsynced case.

**Scope decisions:** Sacks-allowed left out of the breakdown (always 0 per-game — no real source). No sub-1024 responsive work — the window can't get there. Multi-season boundary + never-synced-season cases weren't screenshotted (the ss-userdata copy is single-season 2026): both reduce to the `games===0` empty-state branch (verified via the 0-match and league-season paths) and the standard season-scoped `getSnapshot` resolution every other verified page already uses — no new season-boundary code was introduced.

**Verification:** typecheck + lint + prod build clean. Live screenshots (ss-userdata isolated copy): (1) user unfiltered Season-Total; (2) Conference + Per-Game — numbers change with the filter (Points 218→28.3/G ×4g=113 ✓; Total Offense 3,860→457/G ×4=1,828 ✓; Turnover Margin −3→+4; 3rd-down-allowed 29.9%→28.6%), matching the Phase 1 hand-verified conference subset; (3) Player view — collapsible headers + player counts (Passing 2 / Rushing 6 / Receiving 10 / Defense 27), leaders + tables intact; (4) responsive 1024 (breakdown 2-up, filter bar one row); (5) **league team (Alabama)** — full Team Stats over 9 games (269 pts, +10 margin, 3rd-down-allowed 52.0%), season-only rows honestly "—"; (6) **0-match filter** (Conference + vs FCS Southeast) → "No games match this filter"; (7) user-team regression — season-only rows still show real numbers (INT 5, FR 4, RZ-allowed 77.3%). Parity + league-capability + 0-match reachability all confirmed by a live IPC eval.

---
## Phase — Bug: high-school recruits shown as transfers (FCS logos) (2026-07-25)

**User report:** high school recruits appearing in the Transfers section, rendered with FCS logos.

**Root cause (probed a real multi-season league snapshot):** EA parks every player who isn't on a real, uniquely-indexed FBS/FCS roster into a generic "FCS" pool at **teamIndex 255** (0xFF = "none"). It's five buckets — FCS West/East/Midwest/Northwest/Southeast — ALL sharing index 255, all `conferenceName: null`, `teamPrestige: 0`, poll ranks 255, empty records — holding ~3,545 players on the test save (a real team has ~85). Incoming recruits live there modeled as **"Freshman"** until they sign (there is no "High School" school-year value). `getTransfers` flags a transfer as *any* player whose team-NAME changed between consecutive league-roster snapshots, with no notion of the pool being unreal — so a recruit signing (`255 → your FBS team`) showed as "transferred in from FCS West" with the generic FCS logo. The reverse (`FBS → 255`, a player dropping off FBS) showed as a bogus "transferred out to FCS West." Because all five buckets collapse to one name in the index→name map, the pool must be identified by **raw index**, not name.

**Fix (`src/database/getTransfers.ts`, read-time — no re-sync):** track each player's previous teamIndex (was only keeping the name) and exclude any move where either side is the pool. Pool set = `{255}` plus, defensively, any null-conference bucket found in either season's teams snapshot. Real FBS↔named-FCS transfers (NDSU, Sac State — real indices, real conferences) are untouched.

**Verification:** replicated old vs new diff on a real league snapshot with two synthetic injections — a recruit signing (`255 → Alabama`) and a genuine transfer (`Troy → San Jose State`). Before fix: 3 detected (recruit-signing + a real `FBS → 255` departure already in the data + the genuine one). After fix: **1 — only the genuine Troy→San Jose State transfer survives**; both pool artifacts removed. typecheck + lint + prod build clean.

---
## Phase — Global Team modal + clickable team names (Phase 1 of the Team-modal / NCAA-stats plan) (2026-07-25)

**Shipped:** a premier, global Team modal (the team counterpart to the player modal) that any team name across the app can open, plus clickable team names on the four priority surfaces (Schedule, Scores, Awards, Game Detail).

- **Data:** new `getTeamCard(dynastyId, teamIndex, seasonId)` (`database/getLeagueRoster.ts`) — one bundled fetch reusing `getLeagueTeamOverview` (record/rankings/recent+upcoming games) + top-5 roster by OVR + `getTeamGameStats` (raw per-game lines) + the team's colors/asset/conference from the `teams` snapshot. IPC/preload/types wired (`TeamCard`/`TeamCardPlayer`). Verified via live IPC: Alabama → record 2-6, CFP #91, SEC, #b30839, top players, 12 games, recent/next games.
- **Modal system:** `data/TeamModalProvider.tsx` (mirrors PlayerModalProvider) + `components/common/TeamProfileModal.tsx` (premier single-column card: team-color header wash + logo + record + rank chip, 6-tile stat strip aggregated from the games via the shared `teamStats` lib, last/next game cards, top-players rail with jersey portraits → player modal, and a team-colored **View Team Hub →** CTA). **Provider mounted at app-root (index.tsx)** so it opens from anywhere incl. the app-root game modal; **host mounted inside DynastyLayout** (needs ViewedTeamProvider + router for the CTA), at z-[110] so it stacks above the app-root game/player modals.
- **CTA navigation** reuses the existing league-browse mechanism: `setViewedTeamIndex(teamIndex)` + `navigate('/dynasty/:id/team-hub')` (the same path the TeamSwitcher already uses; viewedTeamIndex persists across in-dynasty navigation).
- **`components/common/TeamLink.tsx`** — the reusable clickable team name (+ optional logo). Prefers an explicit `teamIndex`; else resolves the name via `canonicalKey` (+ alias table) over `leagueTeams`. Falls back to plain, non-clickable text when unresolved, when it's the **FCS pool (index 255)**, or when outside a dynasty/modal context. Optional `dynastyId`/`seasonId` props let it work in the app-root game modal (GameDetail) where the route `:id`/SelectedSeasonProvider aren't in scope; added `useSelectedSeasonOptional`.
- **Surfaced `teamIndex`** on Schedule (`ScheduleGame.opponentTeamIndex`, `LeagueTeamGame.opponentTeamIndex`) and Scores (`LeagueScoreGame.home/awayTeamIndex`) so those pass a real index (no fuzzy matching). GameDetail already had `home/awayTeamIndex`; Awards `TeamLine` is name-only → resolver.

**Scope decisions:** Scores card changed from a `<button>` to a role="button" `<div>` so the team-name buttons aren't nested inside a button (invalid HTML) — game-modal click preserved, team-name click stops propagation. FCS-pool opponents (idx 255, e.g. "FCS Southeast") correctly render as plain non-clickable text.

**Verification:** typecheck/lint/build clean. Live IPC eval confirmed getTeamCard + the new schedule/scores indices. Screenshots (dark): opened the modal from a Scores team name → Ohio card rendered premier (real green logo, green wash/rank-chip/CTA, stat strip 17.2 PPG/+5/27.5%, @ Akron W 30-27 / @ Miami OH next, top players with jersey portraits). Schedule opponents render as clean one-line TeamLinks (fixed an over-truncation from a baked-in `truncate`, now opt-in). Light mode not screenshotted (fiddly to force in the harness) — the modal uses the same slate light/dark class system as the verified PlayerProfileModal.

**Remaining (this plan):** Phase 2 = NCAA Hub Statistics page (national team + player-stat leaderboards). Phase 3 = roll TeamLink out to the remaining surfaces (Standings, Transfers, NcaaHub, History, GameDetail sub-labels) + polish. Team-modal "View Team Hub" navigation logic in place but not yet screenshot-verified end-to-end.

---
## Phase — NCAA Hub Statistics page (Phase 2 of the Team-modal / NCAA-stats plan) (2026-07-25)

**Shipped:** a new NCAA Hub → **Statistics** tab (route `national-stats`, between Scores and Players) with a Team/Player mode switch — national leaderboards across all of FBS.

- **Backend (new):** `database/getNationalTeamStats.ts` — walks the league-wide `schedule` snapshot ONCE, summing each real FBS team's per-game team+opponent stat lines into one season row (same arithmetic as `getTeamGameStats`; verified App St. row = 3860 total yds, exact match to the season TeamStats). Excludes the generic FCS pool (index 255 / null conference). `database/getNationalStatLeaders.ts` — reuses `getAllLeaguePlayers`, ranks stat-holders SERVER-SIDE and returns the top 100 per category (passing/rushing/receiving from the offensive line, defense from the defensive line) so only ~400 rows cross IPC instead of ~16k. Types `NationalTeamStatRow`/`NationalLeaderEntry`/`NationalStatLeaders`; IPC/preload/handlers wired. Verified via live IPC: 138 teams (pool excluded), LSU tops scoring at 41.0 PPG, 100/category leaders (top passer Denegal SDSU 3028).
- **Shared refactor:** the per-category stat-table column defs (PASSING/RUSHING/RECEIVING/DEFENSE/KICKING/PUNTING) + the `pct`/`pctFormat`/`oneDecimal` helpers moved out of `Statistics.tsx` into a shared `renderer/lib/statColumns.ts`, imported by both the Team Hub and National pages (one source of truth). `StatisticsTable`/`StatTableRow` gained an optional `teamName`/`teamIndex` — national tables show each player's team as a clickable `TeamLink` under the name; single-team tables (Team Hub, GameDetail) are unchanged. `StatisticsTable.openPlayer` and `LeaderCard` now resolve a clicked player against **their own team's** league snapshot via a per-row `teamIndex` (falling back to the page's viewed team) — so national leaders open correctly, like the Players page already does.
- **Frontend:** `pages/NationalStatistics.tsx`. Team mode = a sortable `NationalTeamTable` (rank + team logo/TeamLink + conference, then PF / Total O / Pass / Rush / PA / Total D / 3rd % / TO Margin; click any column header to sort; Season Total / Per Game toggle). Player mode reuses `StatisticsCategorySection` (collapsible leader cards + top-100 table) fed by the national leaders, with the team column. Player names → player modal, team names → team modal.

**Scope decisions:** Leader cards remain season-total-based even in Per-Game mode (same established behavior as the Team Hub Statistics leader cards — not a regression). Kept the existing scouting-directory "Players" tab separate from this production-stats "Statistics" tab (per the design chat — they answer different questions).

**Verification:** typecheck/lint/build clean. Live IPC eval (parity + pool-exclusion + 100/category). Screenshots: Team leaderboard (real logos, sorted by PPG — LSU 41.0 / USC 40.7 / Kansas State 40.6…, per-game) and Player leaderboard (Passing top-100, leader cards, team+logo per row, per-game). NOT yet released.

**Remaining (this plan):** Phase 3 = roll `TeamLink` out to the remaining surfaces (Standings, Transfers, NcaaHub, History, GameDetail sub-labels) + a polish pass (both themes, responsive, the season-total-vs-leader-card note).

---
## Phase — TeamLink rollout everywhere + polish (Phase 3 — plan COMPLETE) (2026-07-25)

**Shipped:** rolled the clickable `TeamLink` out to the remaining team-name surfaces and finished the polish pass. The Team-modal / NCAA-stats plan (Phases 1–3) is now complete.

- **Standings** (`Standings.tsx`) — each team row's name is a `TeamLink` (real `team.teamIndex`), division-leader / conf-champ badges preserved.
- **Transfers** (`Transfers.tsx`) — the other school in each move is a `TeamLink` (outgoing carries `toTeamIndex`; incoming resolves by name). Row changed from a `<button>` to a role="button" div so the team link isn't a nested button (same pattern as Scores).
- **NCAA Hub Overview** (`NcaaHub.tsx`) — the #1-team headline plus every ranking / recruiting-class / record-watch / conference-leader row: team names are now `TeamLink`s (name-resolved; logos kept as-is via `showLogo={false}`). One `replace_all` covered the five identical ranking rows.
- **History** (`History.tsx`) — the national-champion team in each `LeagueHistoryRow` is a `TeamLink` (inline, no logo); the viewed-team masthead stays a plain logo (it's the page's own identity).
- **Weekly Honors** (`awards/WeeklyHonors.tsx`) — the "vs. <opponent>" team is a `TeamLink`.

**Scope decisions:** Deliberately did NOT linkify own-team identity surfaces (Team Hub / Coach Hub / Dashboard mastheads, Sidebar, TeamSwitcher, player-profile hero) — opening a modal of the team you're already looking at is pointless. GameDetail's small "X — Star of the game" eyebrow was left plain: its `PerformerCard` is a `<button>` (opens the player), so linking the team would need a button→div refactor for low value, and Phase 1 already made the prominent helmet-flank team names clickable. NcaaRecords' holder team sits inside mixed subtitle text — skipped as fiddly/low-value.

**Polish:** Light mode — diagnosed the harness can't fully show it (removing the `.dark` class flips the Tailwind variants — `main` correctly goes transparent/light — but the body's dark gradient follows the Electron env's `prefers-color-scheme`, which the harness can't override); every new component uses the same `text-slate-X dark:…` token conventions as the rest of the verified app, and the only custom color (the team-modal wash) is a theme-independent `color-mix` on the team's hex. Responsive — the national team table scrolls inside its own `overflow-x-auto` at the 1024 floor (no page-level horizontal scroll); the team modal is `max-w-2xl` and fits. Unknown / FCS-pool teams render as plain non-clickable text everywhere (the `TeamLink` guard, verified in Phase 1).

**Verification:** typecheck / lint / prod build clean across all edits. Screenshots: national team table at 1024 (scrolls cleanly), light-mode diagnostic (confirmed component-level light styling applies). The plan's three phases — global Team modal + clickable names (P1), NCAA Statistics page (P2), full rollout + polish (P3) — are done. NOT yet released.

---
## Phase — Bug fixes: modal scroll-lock (stuck page) + Team modal positioning (2026-07-25)

Two user-reported bugs from playtesting the new Team modal.

**Bug 1 — page stuck with no scroll, only an app restart fixes it.** Every modal used the per-instance pattern `prev = body.style.overflow; body.style.overflow = 'hidden'; …restore prev`. It's fine for one modal but breaks when modals STACK — which the new Team modal made common (team links inside the player/game/national modals; player links inside the Team modal). Ordering example: open player modal (saves prev='', sets hidden) → open Team modal from a team link (saves prev='hidden') → close player modal (restores '') → close Team modal (restores 'hidden' with NOTHING open) → body permanently `overflow:hidden`. Fix: a shared reference-counted lock `renderer/lib/useScrollLock.ts` (a module-level counter; the body is locked while ANY modal is open and unlocked only when the last closes). Converted ALL nine scroll-locking modals to it — TeamProfileModal, PlayerProfileModal, GameDetailModal, RecruitProfileModal, PlayerComparison, CenteredModalPanel, CoachEditorModal, PlayerEditorModal, TeamBudgetModal, ConfirmDialogProvider — so none can leave the body stuck regardless of stack order. (Partial adoption would still interleave, so it had to be all of them.)

**Bug 2 — Team modals opened too low, not centered.** The other global modals (`GameDetailModal`, `PlayerComparison`, `CenteredModalPanel`) already `createPortal` to `document.body` — precisely because surrounding surfaces use `backdrop-blur`, and a `backdrop-filter` ancestor becomes the containing block for a `position: fixed` child, anchoring it to that panel instead of the viewport. The Team modal host is mounted inside `DynastyLayout`'s `<main>` (which has `backdrop-blur`), so its `fixed inset-0` was relative to the panel → pushed low. Fix: portal `TeamProfileModal`'s overlay to `document.body` too. The React tree is unchanged, so the `useViewedTeam`/router context the "View Team Hub" button needs still resolves — only the DOM parent moves. Verified: the modal is now dead-centered.

**Verification:** typecheck/lint/build clean; centered-modal screenshot confirmed. NOT yet released.

---
## Phase — Bug fix: players/coaches showing initials despite a portrait in the pack (2026-07-25)

**User-reported:** some players (e.g. Lesterlaisene Lagafuaina, Hawai'i) render as initials / a broken image even though their portrait is in the pack (the manual picker finds it).

**Root cause (probed a real save):** EA truncates long combined names in the save's `GenericHeadAssetName` field and leaves a `-` truncation marker at the cutoff — `Unique_LagafuainaLesterl-_21542` — but the game's exported portrait texture files DROP that dash (`Unique_LagafuainaLesterl_21542.webp`; the master PNGs are already de-dashed). The app builds the portrait URL straight from `GenericHeadAssetName`, so those URLs 404 → initials. Scale: on a real 15,105-player leagueRoster, exactly 105 (~0.7%) have a `-` (the only special char, always right before `_<id>`, always long names); checked against the actual webp files on disk — 0 resolve at the dashed name, ALL 105 resolve with the dash removed. Coaches: 2 of 493, same pattern.

**Fix (read-time, no re-sync):** `renderer/lib/playerAssetMapping.ts` now returns `[exactName, deDashedName]` when the name has a `-` (PlayerPortrait already does onError candidate-fallback, so it tries the exact file first, then the de-dashed one). `renderer/lib/coachAssetMapping.ts` is single-src (no fallback chain) and no dashed name ever matches a file, so it de-dashes directly. No-op for the 99%+ of normal names.

**Verification:** typecheck/build clean; data check (105/105 players + 2/2 coaches resolve de-dashed against the real files); screenshot — Lagafuaina's portrait now renders in Hawai'i's team modal (was "LL" initials). Recorded the EA naming quirk in memory (reference-portrait-truncation-dash). NOT yet released.

---
## Phase — Release 0.6.3 (app-only) (2026-07-25)

Version checkpoint rolling up this session's work. `package.json` 0.6.2 → 0.6.3 (+ package-lock; drives `app.getVersion()` in About + the electron-builder exe filenames). Graphics pack stays 0.6.1 — no bundled assets changed this session, so it's an **app-only** slim rebuild (`SLIM_INSTALLER=1 npm run package`); existing users just update the app and keep their image pack. Git tag `v0.6.3` + a local `.backup/v0.6.3-<timestamp>/` snapshot per the release convention.

**What's in 0.6.3 vs 0.6.2** (all detailed in the entries above): the Team Hub Statistics refactor (Team/Player split, filter-driven team stats, collapsible sections, honest per-game/season, 3rd-down-allowed, league-team stats); the new **NCAA Hub → Statistics** page (national team + player-stat leaderboards); the global **Team modal + clickable team names** everywhere (Phases 1–3); the **Check-for-Update** feature (this is the bootstrapping release that seeds it — it can detect the NEXT one); and the bug fixes — transfers showing HS recruits as FCS logos, the modal stuck-scroll + off-center positioning, and players/coaches showing initials instead of their portrait (EA truncation-dash). This is the first release built from committed history (the branch had accumulated 0.6.0–0.6.2's work uncommitted).

---
## Phase — Research: save-phase map + sync-gating spec (2026-07-25)

**Goal:** stop broken data by making sync phase-aware — the save is one mutable snapshot and different data is final at different calendar points (e.g. by Signing Day, TeamIDs have shuffled for next year). User captured a **full Auburn cycle** (2026→2027, 32 weekly saves) into `Dynasty Save Test/Full Season Saves`; I built a reusable `scratchpad/save-inspector.js` (phase fingerprint for any save) and read every transition.

**Key finding — a clean numeric gate exists:** `SeasonInfo.CurrentWeekType` (PreSeason/RegularSeason/NationalChampionship/OffSeason) + `CurrentOffseasonStage` (1–9). Mapped the whole cycle: schedule editable in PreSeason (934 games) → locks in RegularSeason (944); postseason awards finalize during bowls; **OffSeason stage 1 = End of Season Recap** (season final, rosters still intact, pool 4,525) ← the clean anchor; **stage 2 = Players Leaving** (`LeavingPlayer` table populates, 2,618 rows); **stage 3–4 = roster churn** (pool → 9,793, TeamIDs change, awards thinned 600→243); **stage 7 = National Signing Day** (Signed → 4,369); new season resets in PreSeason.

**Departures / draft reality:** `LeavingPlayer` (at stage 2) gives who left + why (`LeaveType`: `EarlyNFL_1..7` NFL declares by projected round, or `Transfer_<reason>`) + `ProjectRound` 1–7. But `PLYR_DRAFTROUND`/`PLYR_DRAFTPICK` stayed at sentinel the whole cycle — **CFB doesn't simulate the NFL draft pick-by-pick**, so a Departures log shows "declared, projected Round N," never a real pick number.

**Coach carousel:** coach flips to the new team right AFTER the natty (user-confirmed from the JMU→Cincinnati work; ~week-18 `CoachTransactionHistoryEntry` + `PrevTeamIndex`). Rule: capture coach→team at **PreSeason Wk0**, lock it, don't re-read until the next Wk0 → the concluded season can't be corrupted by a carousel sync; `PrevTeamIndex` is the fallback if the first sync is post-flip. This retires the fragile "sync old school at bowl / not in carousel / new school at Wk0" instructions.

**Deliverable:** full spec written to memory `reference-sync-phase-map` (phase detection, the cycle table, per-category capture rules mapping the user's wishlist, roster-churn timeline, coach rule + PrevTeamIndex fallback, finalize/lock). Enables: phase-aware sync + a sync-time phase notice; a **Departures log** (transfers-out w/ reason, NFL declares w/ projected round, graduations); **transfer reasons** on the Transfers page; a **coaching tree** (where former assistants took jobs, growing over seasons).

**Still to confirm before building:** the offseason stage numbers hold in a 2nd offseason; weekly-honor capture timing; a real carousel save to pin the exact coach-flip stage. NO app code yet — research/spec only.

---
## Phase — Phase-aware sync: gating + season-lock + Departures log (2026-07-26)

**Goal:** turn the research spec above into structure. Sync whenever you want without corrupting a concluded season — the gate is **silent** (normal "Synced" confirmation), the timing rules become code instead of advice.

**Shipped:**
- **Phase 1 — detection.** `extract-league.ts` now reads `SeasonInfo.CurrentWeekType` + `CurrentOffseasonStage` into `LeagueData`. New pure helper `shared/syncPhase.ts` (`deriveSyncPhase` → `{kind, offseasonStage, weekType, label}` + predicates `isScheduleFinal` / `isSeasonFinalizing` (offseason stage ≤ 2) / `isSeasonLocked` (stage ≥ 3)). Migration #9 `schema_v9_season_phase.sql` adds `seasons.synced_week_type`, `synced_offseason_stage`, `finalized`; `helpers.ts` gains `updateSeasonPhase()` + Season/SeasonRow fields.
- **Phase 2 — gated ingestion.** `importExtraction.ts` classifies the save's phase and computes `blockWrite = finalizedElsewhere || isSeasonLocked || (existing.finalized && !finalizing)`. In-progress → writes all (but **skips schedule/leagueSchedule snapshots in PreSeason** — the 934→944 editable window). OffSeason stage ≤ 2 → writes final data + sets `finalized = 1`. Stage ≥ 3 or already-finalized → **overwrite blocked**, protecting the concluded season from stage-3+ roster churn (pool 4,525→9,793) and award thinning (600→243). Folds the existing coach-move lock into the one gate.
- **Phase 3 — coach→team.** Satisfied by the phase-lock: coach→team is set when the season row is created and the offseason lock guarantees the post-natty flip can't touch the concluded season until the next Wk0. `PrevTeamIndex` fallback preserved. (Exact flip stage still to pin against a real carousel save.)
- **Phase 4 — Departures.** New `extract-departures.ts` reads the `LeavingPlayer` table (most-populated instance), resolves each Player ref, classifies `EarlyNFL_1..7` → `nfl` (+ projected round), `Transfer_<reason>` → `transfer` (humanized reason), else `other` (graduation). Wired through `extract-all.ts` → `persistExtraction` (write-once snapshot during the finalize window) → new `getDepartures.ts` getter + IPC/preload/types (`PlayerDeparture`). `pages/Transfers.tsx` expanded into **"Transfers & Departures"**: a new **"Left the program"** card (NFL declarations with `Proj. Rd N` badge, graduations) + each transfers-out row tagged with its `Transfer_<reason>`.

**Scope decisions:** NFL shows projected round only — CFB doesn't sim the draft, so no team/pick (user-confirmed). Phase 5 (coaching tree) deferred to its own plan.

**Errors hit & fixes:** `reasonByPlayer` Map typed `Map<number, string|null>` (reason is nullable) — narrowed with an explicit `Map<number, string>` + cast after the truthy filter.

**Verification:** typecheck + lint + build clean. Imported the real **W23 Players-Leaving** fixture into an isolated `CFB_USER_DATA_DIR` and queried through the actual preload API: `getDepartures` returned **2,618** departures (224 NFL w/ projected rounds + team names, 2,394 transfers, 0 other) — e.g. Jeremiah Smith WR 99 nfl R1 [Ohio State]. Screenshotted the Transfers page: "Left the program" correctly filters the 2,618 league-wide down to **Auburn's 3 NFL declarations** (Byrum Brown QB 92 Proj. Rd 4; Xavier Atkins ROLB 91 Rd 2; Jeremiah Cobb HB 89 Rd 6) with badges; transfers grid correctly shows its "needs two synced seasons" state (single-season import).

**Still open:** confirm offseason stage numbers across a 2nd offseason; pin coach-flip stage with a real carousel save. Uncommitted as of this entry.

---
## Phase — Coach alma-mater fix + manual/Quick-Help rewrite (2026-07-26)

**Coach alma mater was wrong for basically every coach (bug fix).** User reported custom-coach alma maters looking wrong. Probed the real SMU + Auburn saves: `Coach.AlmaMater` is a plain int but it is **NOT `Team.TeamIndex`** (the long-standing assumption in extract-coaches). It indexes the **TEAM_LOGO id space** — EA's full alphabetical school master list (FBS + FCS + others). Resolving by teamIndex produced confidently-wrong schools that drift down the alphabet as interspersed FCS schools push indices up (offset grows: BYU +1, Georgia +5, Oklahoma +10, Texas Tech +13). Smoking gun: **Kirby Smart alma=34 → teamIndex 34 = Indiana, but logoId 34 = Georgia** (his real school); the user's own **Rhett Lashlee showed "Arkansas State" instead of Arkansas**. The original "it's a TeamIndex" note only checked values were in-range, never against ground truth — that was the flaw. The in-save `College` table is an empty template (the real list is a static game asset), so TEAM_LOGO on the Team rows is the only in-save handle on that id space.

**Fix:** `extract-teams.ts` now extracts `logoId` (TEAM_LOGO) onto `TeamData`; `getCoaches.ts` resolves `almaMater` against a `logoId → displayName` map (`buildLogoNameMap`) that **excludes the FCS pool (teamIndex 255)**, so non-FBS almas and sentinels (150/151) resolve to null instead of showing "Practice"/"FCS East". Only `getCoaches` resolves alma mater anywhere. **Verified end-to-end** on a real SMU import through the actual preload API: Lashlee→Arkansas, Applewhite→Texas, Loepp→UTSA — and confirmed correct for every coach with an FBS real-alma (Fickell→Ohio State, Heupel→Oklahoma, Riley→Texas Tech, Sarkisian→BYU, Bielema→Iowa). **Requires a re-sync** of existing seasons (new extraction field). typecheck/lint/build clean. Memory: `reference-coach-alma-mater`.

**Manual + in-app help rewrite (phase-aware sync made the old advice obsolete).** With the silent phase-gating live, the fragile coaching-carousel sync instructions are wrong, so rewrote the guidance:
- **Manual (`docs/manual/manual.template.html`):** added a prominent **"When to sync — the whole cheat sheet"** callout at the very top of Section 01 (users don't read far); Section 02 gained a "you can't sync at the wrong time" paragraph and swapped the "changing schools = careful order" bullet for an "awards week" one; **Section 05 "Moving to a new school" fully rewritten** — deleted the 4-step danger-zone procedure + warn callout, replaced with "the app handles carousel timing for you"; Section 13 tip updated to match; Section 06 renamed to **"Transfers & Departures"** with the new departures/NFL-projection copy; Section 11 documents the new "Check for updates on startup" toggle.
- **Help → "Quick Help":** renamed the in-app tool (button + eyebrow in HelpMenu.tsx, sidebar shows "Quick Help", manual references updated). Rewrote the sync topic into a scannable "When to sync (read this first)" with the key weeks + the "you can't sync wrong / carousel handled for you" reassurance. Verified via screenshot (sidebar now Preferences · Stadium · Quick Help · User Manual · About).

**Version note:** user has designated this the **1.0** release (this tightening pass is the stability work they wanted). **Bumped package.json + package-lock.json 0.6.3 → 1.0.0** (app version only; the iconv-lite@0.6.3 dep line was deliberately left alone). The single package.json version feeds the header, About panel, and manual (`__APP_VERSION__` / `__VERSION__`), so all three now read v1.0.0.

**Follow-ups (same day):** (1) the "When to sync" cheat sheet (manual Section 01 + the Quick Help topic) was reordered **chronologically for a new dynasty** — Week 0 first, then in-season, then End of Season Recap last — so it no longer reads as if season 1 skips the Week 0 sync. (2) Added a **dev-only build stamp**: webpack injects `__BUILD_LABEL__` ("dev build · <time>") on `--mode=development` (the playtest .bat) and an empty string on `--mode=production` (release). Shown in amber next to the version in the Navbar header + About panel, and on the manual cover (`.build-stamp:empty{display:none}` collapses it on release). So a playtest session can confirm at a glance it's running the newest build (the timestamp changes every rebuild); `make-manual-pdf.js` always renders it empty for the shipped PDF. (3) **Added the "Players Leaving" sync moment** — user caught that the cheat sheet stopped at the End of Season Recap, but the Departures data (`LeavingPlayer`: NFL declarations, graduations, transfer reasons) doesn't populate until the offseason **Players Leaving** step (OffSeason stage 2), one step *after* the recap (stage 1). Added it to the manual cheat sheet, Section 02 golden rule + extra-sync list, Section 13 tips, and the Quick Help topic. **Verified the real two-sync sequence** on the Auburn saves: import at recap (stage 1) → departures 0; swap file to Players Leaving (stage 2) → `syncDynasty` → departures **2,618** (224 NFL) added to the SAME finalized 2026 season, no duplicate. Confirms the finalize window (offseason stages 1–2) correctly lets the Players-Leaving sync land on an already-finalized season.

**Also:** parked **Phase 5 (coaching tree)** as a `backlog` item in the Command Center for later, with the two research prereqs (real carousel save to pin the coach-flip stage; confirm offseason stages across a 2nd offseason).

---
## Phase — Editable Skill Points on the player editor (2026-07-26)

**Ask:** user asked whether a player's **skill points** are editable / already in the app. They weren't — the editor's "Skill Group Caps" (`SkillGroupCap1..6`) are the per-group rating *ceilings*, a different thing from the spendable skill-points currency. Probed the save: `Player.SkillPoints` (unsigned 15-bit int, real max 32,767; real rosters sit single/low-double digits — observed 0–61) is the spendable currency; `Player.ExperiencePoints` (20-bit) is the XP that accrues toward it.

**Shipped:** added **Skill Points** and **XP Points** as editable fields, mirroring the existing coach `CoachPoints` pattern — `PlayerEditFields.skillPoints` / `.experiencePoints`, read in `readPlayerFields`, written in `writePlayerFields` clamped to their real ranges (`[0, 32767]` and `[0, 1048575]`; wrap guard, same as NIL/CoachPoints), with number inputs on the editor Profile tab right after NIL Demand. (XP added alongside Skill Points at the user's request, ahead of the 1.0 package.)

**Verified:** typecheck/lint/build clean; **round-tripped on a disposable SMU copy** — SkillPoints 11 → 42, saved, reopened, persisted. (Player editing is the normal safe write path — Section 10, not the experimental Force-Commit path.)

---
## Phase — Recruit Hub Watchlist (2026-07-26)

**Ask:** a new Recruit Hub page, **Watchlist** — mark recruits from the national pool with a checkbox to "watch for later," looking no different from the other recruit pages. Plus (conditionally) a "Recommended" filter *if* that data exists in the save.

**Recommended — not available:** probed the save (EVANZSYNC, the user's current active dynasty; the SMU/Auburn saves are gone). No `Recommend`/`Suggest` table and no such field on `Player` or `UserRecruitTarget`; the recruiting tables are all board/scouting/draft. The game's "Recommended" list is a live UI computation from team needs/fit, not persisted — so the recommended filter was skipped (per the ask).

**Shipped:** the watchlist is app-side local state, not a save write — mirrors how the recruiting-experience prefs persist. New `data/useWatchlist.ts` hook stores a per-dynasty `Set<playerId>` in localStorage (`cfb.watchlist.<dynastyId>`), keyed by the recruit's **PresentationId** (what the app already exposes as `playerId`) so a flagged recruit survives re-syncs. `NationalRecruits.tsx` gained a `watchlistOnly` mode (reusing the same browser as `boardOnly`), a ☆/★ star toggle in each table row's prospect cell, and a "Watchlist" checkbox in the profile panel; the star dashboard + count line are watchlist-aware, with an empty-state hint. New **Watchlist** tab in `RecruitHubLayout` + `/watchlist` route → `<NationalRecruits watchlistOnly />`.

**Design note:** used a plain hook (not a provider) — the three recruit sub-pages are separate routes never mounted together, so each loads fresh from localStorage on mount and stays correct; skipped a live tab-count badge since a second hook instance in the layout would read stale (no shared reactive store). Fine trade for zero extra wiring.

**Verified:** typecheck/lint/build clean; imported EVANZSYNC (4,100 recruits) into an isolated dir, seeded 6 watchlist ids via localStorage, and screenshotted — Watchlist page shows "6 of 6" with filled stars and reads identically to National Recruits; the National Recruits page shows hollow stars per row and the panel's "☆ Watchlist" checkbox on a selected recruit.

---
## Phase — National Recruits: checkbox filters (My Board + Interested in my school) (2026-07-26)

**Ask:** turn the "On my board" dropdown into a simple **My Board** checkbox, and add an **Interested in <my school>** checkbox (default off) that shows only recruits with the user's team among their top schools.

**Shipped (`NationalRecruits.tsx`):** new `FilterCheck` inline component (checkbox styled to match the filter dropdowns, team-accent when active). Replaced the 3-state board `<select>` (All / On board / Not on board) with a **My Board** checkbox (checked → board scope 'on', unchecked → all). Added an **Interested in {userTeamName}** checkbox → `interestedOnly` state (default false); filter keeps a recruit only when `userTeamIndex` is in its `topSchools` (the game stores up to 10 pursuing schools per recruit in `TopSchoolsList`, so this is the real "top 10 interest"). The user's team index is resolved from `useViewedTeamOptional().userTeamName` via `resolveTeamIndex` against the league list. Wired into `clearFilters` + `filtersActive`. Both checkboxes render on the National Recruits and Watchlist pages (`!boardOnly`).

**Verified:** typecheck/lint/build clean. On the user's EVANZSYNC dynasty (Sacramento State, 4,100 recruits), the checkbox reads **"Interested in Sac State"** and toggling it (real onChange) filtered to **198** recruits — those with Sac State in their top schools. Screenshot confirms both checkboxes render, default unchecked, correct team name. (Note: the screenshot harness can't visually hold a React controlled-checkbox's checked state via synthetic events — a tooling limitation, not a bug; real mouse clicks toggle normally, as the 4,100→198 onChange result proved.)

---
## Phase — Dashboard cards: coach position + in-game save week (2026-07-26)

**Ask:** on the dynasty-select (Dashboard) cards, show the user coach's **position** and the **in-game week** the save sits at.

**Shipped:** `DynastySummary` gained `coachPosition` + `savePhaseLabel`. The `getDynasties` IPC now sets `coachPosition` from the resolved `userCoach.position`, and `savePhaseLabel` from the current season's **league snapshot** (which carries `currentWeek` + the phase fields) via a new `formatSaveWeek()` in `shared/syncPhase.ts` — "Preseason" / "Week N" / "Postseason" / the offseason stage label ("End of Season Recap", "Players Leaving", …). Dashboard card renders the position as a small uppercase eyebrow under the coach name, and the week as a team-tinted chip under the season line (`formatCoachPosition` humanizes the role enum: HeadCoach → "Head Coach", etc.).

**Notes:** `coachPosition` works on any full-data season (it's in the coaches snapshot). The `savePhaseLabel` chip only appears for seasons synced with the phase-aware extractor (v1.0+) — older league snapshots have no `currentWeekType`, so the label is suppressed until a re-sync rather than guessing.

**Verified:** typecheck/lint/build clean. Live on the user's EVANZSYNC dynasty via IPC + screenshot — Patrick Evanz shows **Offensive Coordinator** + a **Preseason** chip (Sac State, 2026). (Nice real-world confirmation the user plays as an OC, not a HC — so the position line is genuinely informative.)

---
## Phase — Coach tenure phrasing + NCAA-hub FCS exclusion (2026-07-26)

**Two user asks.**

**1. Coach Hub tenure line.** Was "{teamName} — 0 years with the program". Now reads **"1st year as {Position} with {teamName}"** — ordinal counting from `seasonsWithTeam + 1` (0→1st, 1→2nd, 2→3rd, …) via a new `ordinal()` helper in `CoachHub.tsx`. Verified on EVANZSYNC: Patrick Evanz shows "1st year as Offensive Coordinator with Sac State".

**2. NCAA hub — no FCS pool.** The Overview's "Early CFP bracket watch" was listing the five FCS/placeholder buckets (all teamIndex 255) because they carry a sentinel `cfpRank` of 255 that slipped past the `cfpRank > 0` filter (especially in preseason when no real team is CFP-ranked). Fixed by excluding `FCS_POOL_TEAM_INDEX` (255) from the `teams` list at the top of `getNcaaHub` — so it's gone from the playoff picture, Top 25, recruiting buzz, record watch, and conference leaders in one place. Standings already skipped null-conference teams (the pool), and national stats/players already excluded 255, so no other changes needed. Verified: playoff picture returns 0 entries in preseason (was 5 FCS buckets), `anyFCS: false`.

**Verified:** typecheck/lint/build clean; both confirmed via IPC + screenshot on the user's EVANZSYNC dynasty.

---
## Phase — Global Search (2026-07-26)

**Premium feature #2 of 4** (the batch: Coach Résumé ✓, Global Search ✓, Player Dev Tracker, Yearbook). A one-box search to jump to any player, coach, or team.

**Backend:** new `globalSearch.ts` (`globalSearch(dynastyId, query, seasonId?)` → `{players, coaches, teams}`) runs server-side over a season's snapshots — reuses `getAllLeaguePlayers` (filters the ~16k league roster by name, sorts by OVR, top 12), reads the `coaches` snapshot (all staffs, name match, top 8) and `teams` snapshot (name match, top 8), all excluding the FCS pool (255). Keeps 16k players off the wire. New `GlobalSearchResults`/`Player`/`Coach`/`Team` types + IPC channel/preload/handler.

**UI:** new `GlobalSearch.tsx` in the Sidebar Tools — a command-palette modal (reuses `CenteredModalPanel`) opened by the sidebar button or **Cmd/Ctrl+K**. Debounced (180ms) query; grouped results with portraits/logos; Enter opens the top hit; a player result opens the player modal, a team opens the team modal, a coach jumps to their team's modal (no standalone coach modal exists). Dynasty id parsed from the URL (searches the current season); the trigger/shortcut only exist inside a dynasty. Controlled-input + provider hooks all sit under the root PlayerModal/TeamModal providers, so it works from the shared sidebar.

**Verified:** typecheck/lint/build clean; on EVANZSYNC, "smith" returns the ranked player list (Jeremiah Smith WR Ohio State 99 OVR → …) with portraits + team + OVR, screenshot-confirmed.

---
## Template for new entries

```markdown
## Phase N â€” <name>

**Shipped:**
- ...

**Scope decisions:** (only if something from the roadmap was deliberately trimmed/deferred, and why)

**Errors hit & fixes:** (only real bugs found during verification â€” not routine work)

**Verification:** (what was actually run/checked, not just "typecheck passed")

**Filesize:** (only if bundle sizes moved meaningfully)
```




## Phase — Player Development Tracker (2026-07-27)

**Premium feature #3 of 4.** A player's OVR arc across every synced season — the payoff of syncing yearly.

**Backend:** new `getPlayerDevelopment.ts` (`getPlayerDevelopment(dynastyId, playerId)` → `PlayerDevelopmentSeason[]`) walks each full-data season's **league-wide** roster snapshot (works for any player, not just the user's team), finds them by stable PresentationId, returns per-season `{ seasonYear, overallRating, position, schoolYear, teamName }` oldest→newest. New type + IPC/preload/handler.

**UI:** a **Development** card on the player modal's Overview tab (`PlayerProfileContent`) — a header strip (current OVR, change since first tracked, peak) + a reused `TrendLineChart` (the app's validated dataviz line chart) plotting OVR by season. With one season it shows a friendly "grows into a curve" note instead of a one-point line; the chart draws from 2 seasons on.

**Verified:** typecheck/lint/build clean; `getPlayerDevelopment` returns correct per-season lines via IPC (e.g. "Jide Abasiri → 2026:87 Junior, USC"); screenshot of Carson Conklin's modal shows the Development card (73 current OVR · 0 since 2026 · 73 peak, single-season note). Multi-point chart reuses the proven TrendLineChart. NOT released.

## Phase — Season-in-Review Yearbook (2026-07-27)

**Premium feature #4 of 4 — batch complete** (Coach Résumé ✓, Global Search ✓, Player Dev Tracker ✓, Yearbook ✓). A shareable, self-contained per-season recap page — extends the program-history HTML export to a single season.

**Backend:** new `yearbookExport.ts` `buildYearbookHtml(overview, historySeason, awards, schedule, colors)` — a dependency-free, image-free HTML file (same philosophy as htmlExport.ts) with a team-colored header (year, team, coach, record, champion badges), a resume-tile strip (record/conf/AP/coaches/CFP/recruiting-class/prestige), a postseason line, an Honors panel (the user team's national award winners, All-Americans, the Heisman with a "YOUR PLAYER" flag, weekly-honor count), and the game-by-game schedule (W/L colored). New export IPC `seasonYearbookToHtml(dynastyId, seasonId)` gathers `getSeasonOverview` + the matching `getHistory` season + `getAwards` + `getSchedule`, then save-dialog + writeFile (mirrors historyToHtml). Blocks history-only seasons.

**UI:** a **"Season Yearbook ↗"** button in the Team Hub Overview masthead (uses the selected season) with an inline result message.

**Verified:** typecheck/lint/build clean; rendered `buildYearbookHtml` with mock Sac State data in a headless window and screenshotted — header/badges, tiles, postseason, honors (Heisman "YOUR PLAYER", All-Americans, weekly count), and the game-by-game table all render correctly in team colors. Getter wiring mirrors the proven history export. NOT released.

**All four premium features are committed on the working branch, part of the next update (not in the 1.0 .exe).**

## Phase — Rivalries & Head-to-Head (2026-07-27)

**Premium add.** All-time series record vs every opponent the program has played across synced seasons. New `getHeadToHead.ts` walks each full-data season's `getSchedule` (played games only), aggregates by opponent into series W-L-T, current streak, average scoring margin, and the game-by-game list (newest first), flagging the game's designated rivals (`isRivalryGame`/`rivalryName` were already on each game). New types + IPC/preload/handler. UI: a new **Rivalries** tab on Team Hub (`Rivalries.tsx` + `/rivalries` route) — rival cards up top (series / avg margin / meetings + game list) and an all-time series table for everyone else, opponent names are TeamLinks. Verified: typecheck/lint/build clean; getter returns [] correctly on a preseason save (no played games) and the tab/header/empty-state render. Populated view reuses the same rendering; the aggregation mirrors the proven getTransfers season-diff pattern. Grows with each synced season. NOT released.

## Phase — Coaching Tree (2026-07-27)

**The deferred Phase-5 feature, now built — no special carousel save needed.** The user's insight was right: every Wk0 sync already snapshots every staff on every team (keyed by stable PresentationId), so the tree is a season-over-season staff diff, same mechanic as Transfers.

**Backend:** `getCoachingTree.ts` (`getCoachingTree(dynastyId)` → `CoachingTree`) walks full-data seasons oldest→newest, building (a) everyone who was ever on the user's staff (excluding the user coach, skipping the shared-id-0 generated coordinators) with the role(s) + years they served, and (b) each coach's most-recent sighting anywhere in the league. A "branch" = a former staffer whose latest team ≠ the user's current team → returns name, role-under-you, years, and where they are now, with head-coach promotions flagged and sorted first. New `CoachingTree`/`CoachingTreeEntry` types + IPC/preload/handler.

**UI:** a premium **Coaching Tree** section on Coach Hub — a stat strip (coaches produced / now head coaches), a root node (you + your team), and branch rows: portrait + "Your {role} · {years}" → arrow → destination team logo + role, HC promotions with a gold left-accent + "HEAD COACH" badge, opponent/destination names as TeamLinks. Empty-state until an assistant actually leaves.

**Verified:** typecheck/lint/build clean; empty-state renders on the single-season EVANZSYNC; populated design confirmed via a standalone mock render (root + 4 branches, 2 HC promotions gold-flagged). Needs 2+ synced seasons with a departing coach to populate live. NOT released.

## Phase — Player Trading Card (2026-07-27)

**Built the card the mockups designed.** A premium, shareable player card as a new **"Card" tab** on the player modal.

**Component:** `PlayerCard.tsx` renders the v5 design — photo hero (real `PlayerPortrait` + team jersey), the name vertical up the left (first smaller beside the larger last, 16px gap), position chip + gold OVR top corners, a jersey-number watermark, foil sheen, and a season stat strip (the same position-appropriate `seasonTiles` the overview uses) along the bottom. Auto-themed via the `--team-*` vars. `PlayerCardTab` wraps it with a **Download card (PNG)** action.

**Theme fix:** the player modal is portaled to `<body>`, outside the dynasty container that sets `--team-*`, so the card first rendered in the default blue. Fixed by resolving the dynasty's colors in `PlayerCardTab` (fetch `getDynastyTheme` + `useTheme().resolveColorVars`, React context flows through the portal) and applying them to the card wrapper — now correctly team-colored.

**Download:** new `export.playerCardToPng(fileName, rect)` IPC — the renderer sends the card element's bounding rect, main `capturePage(clip)`s that region and saves a PNG via a save dialog (pixel-perfect, includes the rendered portrait/jersey).

**Verified:** typecheck/lint/build clean; in-app on EVANZSYNC the Card tab renders Carson Conklin's card in Sac State green + gold with the real portrait/jersey, vertical names, gold OVR, and the Download button. Stat strip appears once the player has season stats. (Phase 2, not built: drop-your-own-photo pan/zoom editor.) NOT released.

## Phase — Player-card custom photo (drop your own image) (2026-07-27)

**The deferred "phase 2" of the trading card.** Users can now put their own image (a game screenshot) on a player's card, reposition and zoom it, and it exports with the card.

**Storage (main):** new `ipc/card.ts` (`registerCardHandlers`, wired in all three main branches) — `card.pickPhoto` opens an image picker and copies the file into `userData/card-photos/<dynastyId>/<playerId>.<ext>` (one per player, replacing any prior), `card.getPhoto` finds it, `card.removePhoto` deletes it. The file is copied in (never referenced in place), same philosophy as the media gallery. New `card` IPC namespace + types + preload.

**UI (PlayerCard/PlayerCardTab):** when a custom photo exists it replaces the portrait as the hero — an `<img>` (object-cover) with a `translate()/scale()` transform driven by **drag-to-pan** (pointer events) and a **Zoom slider**; the pan/zoom framing persists in localStorage keyed by dynasty+player. Controls: **Add/Change photo**, **Remove photo**, the zoom slider + "drag to reposition" hint, and the existing **Download card (PNG)** — the capturePage export includes the framed photo automatically.

**Verified:** typecheck/lint/build clean; in-app the Card tab shows "Add your photo" with no photo, and — with a seeded image + transform — the photo fills the hero framed by the pan/zoom, overlays on top, with the Zoom slider + Change/Remove/Download controls. (Native file-pick can't be driven headless but the whole render/transform/persist path is verified.) NOT released.

## Phase — Player Trading Card: full-bleed redesign + finalize (2026-07-27)

**Iterated the card to a finished, premium object across many rounds of user feedback.**

- **Full-bleed** photo (portrait or uploaded) fills the whole card (was a top hero crop), per the user's reference SVG. Added a `fill` mode to `PlayerPortrait` (spans a positioned parent across all three render paths — portrait, portrait+jersey, initials); the old `!absolute` className trick collapsed the jersey wrapper to 0×0, so a jersey'd player (e.g. Matthew Coleman) showed no portrait. `fill` fixed it everywhere.
- **Team-correct colors:** the card now themes to the *player's own team*, not the user's dynasty. New `getTeamTheme(dynastyId, teamName)` reads brand colors from the `teams` snapshot (+ IPC); PlayerCardTab and the hover card resolve by team (a UMass card is maroon, Sac State green).
- **Shape:** dropped rounded corners for the app's signature single cut corner (`corner-cut`); depth via a `drop-shadow` filter on a wrapper (clip-path would clip a box-shadow).
- **Name:** vertical first+last, snug; **auto-fit** shrinks only names too long to fit (measured vs the card's own height, so it works in the small hover card too) — pro-card behavior.
- **Portrait crop:** rule-of-thirds — a `translateY(-23%) scale(1.08)` on the fill image puts the eyes on the upper-third line (shared 512² composition ⇒ one transform reads right for all).
- **Stats:** single-line marquee row spanning the bottom; position-appropriate defaults (QB → Pass Yds/TD…), user picks up to 4 via chips (saved per player). Gold 3D team logo.
- **Photos:** import whole (`object-contain`) then zoom (to 5×) + drag to frame; **"From media"** reuses a gallery photo already tagged to the player (new `card.setPhotoFromPath` IPC).
- **Clean by default:** all controls hidden; rollover reveals **Edit | Export** (centered scrim, dropped during PNG capture so it can't land in the export); Edit opens the full editor until Done.
- **Hover preview:** resting on a player's name pops the card (`PlayerHoverProvider` + `usePlayerHoverCard`, delegated per-row handlers, themes cached; portaled, flips off-screen edges, dismisses on scroll). Wired into the Roster (list + gallery). Preferences: enable toggle (default ON) + delay slider (0.2–2.0s, default 0.85s) via `hoverCardPrefs`.

**Verified** live across each round (Conklin, Sharman, Scruggs, Coleman, UMass long name). typecheck/lint/build clean throughout.

## Phase — Black base theme (2026-07-27)

**User: the dark theme read as navy.** Two causes — Tailwind `slate` is blue-tinted, and the ambient grounds glowed with the team color (bled through translucent surfaces). Remapped `slate` to a true-neutral ramp (near-black deep end) in `tailwind.config.js` — one change neutralizes ~127 slate backgrounds; gray text/borders stay, team-colored buttons/text untouched. Body ground now pure `#000` with no team radial glow; dropped the app-shell team glow; neutralized the player-modal hero + NCAA-hub hero; neutral text selection. Team color lives only in accents now. Verified live (black-modal, black-hub). typecheck/lint/build clean.

## Phase — Team Hub declutter: Media Hub section + merged tab pairs (2026-07-27)

**Team Hub sub-nav had 11 tabs and overflowed.** Media promoted to its own top-level section **Media Hub** (next to Recruit Hub) — dynasty-wide + season-scoped, not team-scoped; standalone route under DynastyLayout, `MEDIA_PATHS` added, URL unchanged. Four related pairs merged behind one tab each via a small nested `PairLayout` (segmented toggle over the two pages; pages/URLs untouched): **Roster**|Transfers, **Schedule**|Rivalries, **Statistics**(Season Stats)|Trends, **Honors**(Season Awards|Weekly Honors). Parent tab highlights for either route in its pair (manual membership check in `TeamHubLayout`, not NavLink isActive). Team Hub now 6 tabs. Also fixed: `rivalries` was missing from `TEAM_PATHS` (wasn't highlighting the section). Verified live. IA memory updated.

## Phase — Media Hub upgrades: batch, drag-drop, reorder, progress, delete cleanup (2026-07-27)

**Big Media upgrade + an orphan-file fix.**
- **Batch:** a Select mode with per-tile checkboxes + a toolbar to **assign a game to many photos at once** (the "20 shots from one game" case) and batch-delete.
- **Drag & drop** OS files onto the grid (or empty state) to upload (drop-zone highlight); import runs **file-by-file behind a real progress bar**.
- **Drag to reorder** tiles — new `sort_order` column (**migration v10**, backfilled newest-first so nothing reshuffles) + `media.reorder` IPC; new uploads sort to the front.
- **Centering fix:** the lightbox now portals to `<body>`. It was rendered inside the app shell's `backdrop-blur` `<main>`, whose containing block trapped the `fixed` overlay and loaded it off-center (top/bottom) — same reason MediaGallery already portals.
- **Delete-from-disk verified** (8→5 files on disk + DB) and **fixed an orphan leak:** `deleteDynasty` only dropped DB rows, leaving the whole `media/` + `card-photos/` folders on the user's drive forever — now `fs.rm`s both (verified gone).
- **Preferences** sections now start **collapsed** (`CollapsibleSection defaultOpen=false`).

## Phase — Working-folder cleanup + v1.5 release (2026-07-27)

- **Docs organized:** filed loose root docs into `docs/` subfolders (nothing deleted) — `MASTER_ROADMAP_v2.md`→`docs/planning/`, `RELEASE_NOTES`→`docs/releases/`, the duplicate `DEVELOPER_ONBOARDING.md`→`docs/archive/`, the generated manual PDF→`docs/manual/` (generator + `.gitignore` + readme link repointed), `player-card.svg`→`References/`. `DevLog.md` + `readme.md` stay at root.
- **Manual updated** to match everything above (five hubs incl. Media Hub; Team Hub's 6 merged tabs; Media Hub section reworked; new Player Trading Cards + hover-preview; Preferences card-preview toggle + black theme + collapsed sections) and PDF regenerated.
- **Release: v1.5.0** — an *update to 1.0* (not a v2), kept **COMPLETE** (graphics bundled) so an app update carries the files; users don't manage a separate image pack. Bumped `package.json`, wrote consumer release notes, built the installer + portable into `release/`. (An earlier 2.0.0-beta build was reframed to 1.5.0 at the user's request.)

## Phase — No-spoiler results hold (2026-07-27)

**User report from playtesting:** finish a game, advance a week, sync — and the hub is already showing the rest of the country's scores for a week the game still has hidden.

**Confirmed the mechanism** against the week-by-week Auburn captures (`Dynasty Save Test/Full Season Saves`, W0→W31): the save **pre-simulates the entire current week the moment you enter it**. At `SeasonInfo.CurrentWeek = W`, every week-W game except the user's own is already final in `SeasonGame` — score, quarter-by-quarter lines, both teams' stat caches. `CurrentWeek=2` → wk2 played 85/86 (the 1 unplayed = Auburn's); `CurrentWeek=4` → 70/71; `CurrentWeek=17` (bowl round 1) → 27/28.

**Scoped the leak — measured, not assumed.** Only `SeasonGame`'s result fields leak:
- **team W-L records:** 127 of 128 current-week teams matched games played *before* the current week ⇒ standings, rankings and polls are already gated by the game itself.
- **per-game player stat lines:** **zero** exist for the current week (wks 0–3 had 847/5103/5183/5022 lines; wk 4 had none) ⇒ season stat totals, national leaders and box scores can't leak either.

**Fix — new `shared/resultsHold.ts`, applied at ingest** (`persistExtraction`), one choke point every page inherits:
- `resolveHeldWeek()` — held week = `CurrentWeek`, unless the user's **own** game that week is already played (the game's real reveal trigger — "hidden until after you play your game"), and never in preseason/offseason (`CurrentWeek` reads 0 at both, which would otherwise hold the whole season).
- Held non-user games are rewritten to look exactly unplayed (`status='Unplayed'`, scores/quarters 0, stat caches null; `null` scores in the compact `leagueSchedule`), so every downstream `!== 'Unplayed'` check just works — no per-page changes. Game-log rows for held games are dropped defensively (currently a no-op).
- Nothing is lost: the save always carries the full season, so the next sync writes the real results back in.
- A `resultsHold` snapshot records the held week each sync (always written, so a hold clears the moment it's revealed); `getLeagueScores` now returns `{ games, heldWeek }` and the Scores page explains the held week instead of reading as a bug. New Help topic *"Why this week's other scores are blank."*

**Verified end-to-end** by running the real extractors + the exact hold logic over the captures: preseason → nothing held; Week Zero (`CurrentWeek=0`, user bye) → its 11 games held; `CurrentWeek=4` → wk4 70/71 → 0/71 stored, wks 0–3 untouched, user's own 3 games intact, 0 leaked scores in `leagueSchedule`; conf-champ week (user bye) → 10 games held; bowl round 1 → 27 held; End of Season Recap → nothing held. Reveal path checked by replaying with the user's own current-week game marked played: `heldWeek` → null (bye weeks correctly stay held). typecheck/lint/build clean.

**Deferred:** no user toggle to switch the hold off — it's the default and only behavior for now. Worth adding to Preferences if anyone wants the raw save view.

## Phase — User-settable media library folder (2026-07-27)

**User ask:** `%APPDATA%\cfb-dynasty-hub\media\<dynastyId>` is a fine fallback, but people want their screenshots somewhere they can reach.

**Confirmed first** that uploads are already copy-in (`fs.copyFile`), with no source path stored anywhere — deleting the original never affects the app. The only real gap was that the destination wasn't choosable.

**New `main/mediaRoot.ts`** — mirrors `assetRoot.ts`'s shape (JSON config in userData, cached resolve, status getter) but deliberately separate: assetRoot locates *app content* (portraits/logos), this is the user's *irreplaceable* screenshots. Setting persists in `media-config.json`; default stays `userData/media`. `mediaDirFor()` in `ipc/media.ts` was already the single choke point for reads, writes and deletes, so pointing it at `getMediaRoot()` moved the whole feature — the DB stores only file names, so **not one row changes** when the root moves.

**Move semantics — copy-everything-then-commit.** The config only flips after every file lands; a mid-way failure removes the copies it made and leaves the old folder live. A half-moved library the app has already started writing into would be genuinely hard to unpick, so it's all-or-nothing. Destination files that already exist are treated as already-moved and skipped, never overwritten (names carry timestamp+random, so a collision *is* the same file). Only `<dynastyId>/<file>` entries are touched — anything else in the user's folder is left alone. Nesting either way (new root inside old or vice versa) is rejected up front rather than walking a tree while writing into it.

**IPC/UI:** four new `media:*` channels (`getLibraryStatus`, `chooseLibraryFolder`, `resetLibraryFolder`, `openLibraryFolder`); Preferences → Storage gains a "Media library folder" section — current path, Change folder…, **Open folder** (the point of choosing a real folder is getting at the files), Reset to default when custom, a moved-file count, and an amber warning when a configured folder has gone missing (unplugged drive).

**Also fixed:** `mediaFileUrl` produced `file://///NAS/share/...` for UNC paths — broken, and a NAS is a plausible target now that the folder is user-chosen. Now emits `file://NAS/share/...`; PlayerCard's duplicate copy of the helper was deleted in favour of the shared one.

**Verified** with a scripted harness against a stubbed Electron `app` (22 assertions, all passing): happy-path move (3 files, content intact, old folder emptied, config persisted); re-picking the same folder is a no-op; nesting rejected; merging onto a folder holding a pre-existing copy (2 of 3 copied, pre-existing file NOT overwritten, user's unrelated file untouched); **rollback** on a broken destination (0 moved, source intact, still on the old folder, partial copies cleaned up); reset-to-default (files come home, config cleared). typecheck/lint/build clean.

**Known gap (unchanged, now documented in Help):** `backupDatabase()` copies only `dynasty-archive.sqlite` — media files aren't in the backup. Restoring is harmless day to day (the media folder sits untouched next to it), but backups alone don't carry the images. Folding the media folder into the backup is the obvious follow-up.

## Phase — Storage honesty, per-dynasty backup/restore, Import picker (2026-07-27)

Four connected pieces, prompted by the user asking where Media Hub photos live and where an individual dynasty's data goes. Vocabulary settled this session: the tile on the Dashboard is a **dynasty card**, the data behind it is that dynasty's **archive** (matching `dynasty-archive.sqlite`), and the file you save is a **dynasty backup**.

### 1. Auto-backup bloat (~1.7 GB of waste on a real machine)

`backupDatabase()` ran on EVERY launch regardless of change, so ten launches left ten near-identical copies of a 170 MB file. Now: **only when the archive actually changed** (size+mtime fingerprint in `backups/.checkpoint.json` — `persist()` rewrites on every write, so an untouched archive keeps an untouched mtime and a read-only session produces nothing); **gzipped, streamed, level 1** (measured on the real archive: 170.1 → 57.6 MB in 1.54 s; level 6 saved only 4 MB more for +55% time); **unawaited** in `main.ts` so startup never pays for it; retention **10 → 5** (each is now a distinct state, not a duplicate). Legacy uncompressed `.sqlite` backups stay listed and restorable — a recovery path that can't read a user's existing backups is worse than useless. `save-backups` was growing **forever** with no prune at all (248 MB) — now capped at 5 per save file. Both folders surfaced in Preferences → Storage with sizes and a cleanup button.

### 2. Delete now actually deletes — a real bug, found by testing on real data

**`db.export()` silently resets `PRAGMA foreign_keys` to 0**, and `persist()` (which calls export) runs after every write. So enforcement survived only until the first save of a session; after that `ON DELETE CASCADE` quietly stopped firing and deleting a dynasty removed its name row while stranding every season/snapshot/note underneath. That is where **137.5 MB of a 170 MB archive** came from — 27 test dynasties deleted over two weeks of development. Verified directly: pragma reads 1 before `export()` and 0 after. Fix: re-assert in `persist()`, plus `deleteDynasty` asserts for itself. Second, independent gap: SQLite never returns freed pages, so even correct deletes freed nothing visible — `deleteDynasty` now `VACUUM`s. Plus a defensive orphan sweep. Surfaced as **"Cache from deleted dynasties" + Clear cache** (the user's wording: not literally a cache, but the word people know). Measured on a copy of the real archive: clear cache 170.1 → 20.6 MB, then deleting Sac State 20.59 → 16.15 MB with full cascade and no violations.

**Two wrong diagnoses were stated to the user before this** (first "the pragma is never set" — it is, line 256, since the initial commit; then "cascades therefore work" — they don't, per the above). The synthetic test passed because it never saved between operations; only running against the real archive reproduced it.

### 3. Per-dynasty backup + restore

New `main/dynastyBackup.ts` / `main/dynastyRestore.ts`, `archiver`+`yauzl` promoted to real dependencies (already present transitively via electron-builder; types pinned to v5 to match the runtime). Plain **`.zip`**, deliberately: the point is a file that still means something on a machine that may not run this app, so a `README.txt` and readable folders beat a bespoke container. Layout: `dynastyos-backup.json`, `README.txt`, `archive/dynasty-archive.sqlite`, `media/`, `card-photos/`, `save/`. Media/saves are **stored** (already-compressed), the archive **deflated**.

Single-dynasty extraction works by opening a throwaway copy and deleting the OTHER dynasties — inheriting the schema's cascade correctness instead of re-implementing a dozen table relationships by hand — then VACUUM. Verified: Sac State out of a 3-dynasty 170 MB archive → **4.71 MB**, nothing of Miami or Texas State in it.

Restore's hard part is the merge: backups carry their own autoincrement numbering that collides with dynasties already present. Every incoming id is shifted clear of the live max via a **declared** table/reference map (introspection would silently mis-link on a missed reference). **A first round-trip run failed here**: renumbering a parent and its references can't be atomic, and the scratch copy's own FK enforcement rejected the intermediate state. Fixed by shifting with enforcement off on the throwaway copy, then `PRAGMA foreign_key_check` before a single row reaches the user's archive. It failed *safely* — bystander dynasties untouched, no orphans. A full checkpoint is taken before any restore, non-optionally.

### 4. Import Dynasty picker

`scanForSaves` existed, was **never called by anything**, and was broken: it matched a `.DYNASTY` extension while a comment in the same file correctly said real saves have none. Now matches the `DYNASTY-` prefix and groups `-AUTOSAVE` / `.backup-<ts>` variants under the dynasty they belong to. New `extractors/peek-save.ts` reads SeasonInfo+Coach+Team only (~500 ms/save) so the list shows **"Sac State — Patrick Evanz, 2026, Week 1"** instead of `DYNASTY-EVANZSYNC`; the modal lists filenames instantly and fills identities in behind. Saves folder is user-settable and remembered (`saves-config.json`). Verified on the real folder: 7 files → 3 dynasty files → 1 row + 2 variants, with PROFILE/ROSTER/TEAMBUILDER correctly excluded.

**Verification totals:** 15 checks (backup checkpoint), 12 (delete/cascade), 10 (extraction), 23 (backup zip round-trip), 25 (restore round-trip incl. replace-in-place and bystander integrity), plus the real-folder scan. typecheck/lint/build clean throughout.

**Deferred:** the dynasty-card backup button replaced the old one-click game-save backup (that save is now a checkbox in the modal) — a button labelled "Backup" that didn't back up the dynasty was the exact confusion that started this thread. Per-dynasty size is deliberately NOT shown on the card or on hover: sizes appear only in the backup picker and the storage panel, where the user is already thinking about disk space.

**Coming next (user flagged, not started):** rebrand to **DynastyOS** — new name, logo, splash. NB: `userData` resolves from the app name, so a rename points Electron at an empty folder and every user's data "vanishes". Needs a migration step; the backup/restore work above is a usable safety net for it.

## Phase — Scandals: coach save editor + talent trees decoded (2026-07-28)

A "Scandals" panel on the Coach Hub masthead for the **user's** coach only, themed as the ways a program gets caught: **Tampering** (recruiting hours), **Sign Stealing** (coach XP speed, experience, level, coach points, prestige, job security, contract points), **Performance Enhancing Drugs** (talent progress speed + the 18 positional XP sliders) and **Embezzlement** (coach talent unlocks).

Pointed at PocketScout-Utilities first, per the user, which unstuck two dead ends: `CoachXPSpeedSetting` / `TalentProgressSpeed` live on **LeagueSetting**, not Coach — which is why a field scan of the coach record found nothing — and the talent tree is a four-hop chain, `Coach.ActiveTalentTree → TalentSubTreeStatusList → TalentSubTreeStatus[] → TalentStatus0..32`, where the middle hop is an intermediate array table (a naive deref fails there).

**The finding that mattered:** a write spike on a disposable copy wrote 5,000 recruiting hours and read back **904** — 5000 − 4096. The field is 12-bit and **wraps silently**: no error, save still loads, value quietly wrong. Every field is now clamped to its real bit width taken from the save's own offset table (hours 4095, XP 1048575, level 127, coach points 4095, prestige 16383, contract 1023, position XP 511; job security capped at 100 rather than 127 because it's a percentage). `saveScandals` backs the save up first and **aborts if the backup fails**.

### Talent trees have no names in the save

Nothing anywhere names a tree: the subtree record carries only `Version` and `CoachPointsSpent`, `ActiveTalentTree` has a single pointer field, and `CoachTalentEffects` turned out to be 158 columns of *per-coach effect values*, not a talent catalog. The names live in the game's data files.

So the map was **derived from the league** — 414 coaches with points spent:

- `Coach.DominantArchetype` names the archetype a coach invested in, cross-tabbed against their top-spend slot (Architect → slot 4 for 25 head coaches, Strategist → 6 for 24, and so on).
- Slots 3/5/7 are **strictly nested** inside 0/1/2 — across 414 coaches, not one had spent in 3 without 0, 5 without 1, or 7 without 2. Those are the **Elite tiers** (Elite Recruiter, Scheme Guru, Master Motivator), gated on "Spend 200 In ‹tree›", which is why 13 subtree slots render as the 10 trees the game shows.
- Slots 9–12 are head-coach only; 0–8 are shared with coordinators. The picker is therefore built from the slots a given coach actually has, not a fixed list.

### Shapes, and an assumption that was wrong

First pass assumed every tree was 8 talents × 4 levels (1 header + 8×4 = 33). **User screenshots of the remaining trees disproved it**: CEO is 9 talents × 1 level, Program Builder 7 × 3. Re-derived the shapes from the save instead of assuming — per slot, the highest node index any league coach has ever had `Owned`/`Purchasable` gives the live-node count:

| Slots | Shape | Live nodes |
|---|---|---|
| 0–8 | 8 × 4 | 32 |
| 11 | 7 × 3 | 21 → **Program Builder** |
| 12 | 9 × 1 | 9 → **CEO** |
| 9, 10 | 4 × 1 | 4 → Rainmaker / Visionary |

That **independently confirmed slots 11 and 12 by shape** rather than by the thin spending evidence they'd had, and revealed that the earlier "361 sequential violations" were just the unused tail of the short trees. Node index is `1 + block*levelsPerBlock + level`, so the old 4-stride would have scattered CEO and Program Builder writes across the wrong talents entirely — silently, since every index is a valid node. Node 0 is a **header that gates the tier** (only ever Purchasable/Owned/Locked, never NotOwned), so opening any tier means writing its header too.

Talent *names* come from the game's tree screens and are hardcoded in `SLOT_LAYOUTS`; their **order is assumed row-major and is NOT verified** — the shapes and counts are.

**Verified on copies:** single-tree isolation (Architect alone → 33 nodes to slot 4, twelve other slots byte-identical); partial levels (Recruiter blocks 1–2 from level 1→3, Architect at 1,1,1,1,2,2,2,2 → 17 nodes, exact, nothing revoked); and all three shapes (CEO talents 3+5, Program Builder talent 2 at level 3, Rainmaker talent 1 → 9 nodes, every one on the right index, unused tails untouched).

**Hidden:** Rainmaker and Visionary are not shown. Both sit behind a real-money gate (MVP+ membership; a Madden 27 coach), their two slots are identically shaped, and no save will ever show spend in either — so the labels are a coin flip. An undocumented key chord in `ScandalsModal.tsx` toggles them back, persisted in localStorage; hiding also clears any staged edits for them so a hidden tree can't be written unseen.

**Still true:** none of this has been exercised through the app's own IPC path — every result above came from standalone spikes against disposable copies.

## Phase — v2.0 release: sourcemaps sealed, rename shipped (2026-07-28)

**A real leak, found while checking whether the Scandals key chord could stay private.** The shipped `app.asar` contained `dist/renderer/renderer.js.map` — 2.2 MB, with `sourcesContent` embedded. `webpack.config.js` sets `devtool: 'source-map'` unconditionally on all four configs, and electron-builder's default `files` packaged them, so **every installer carried the original TypeScript source of the renderer, comments and all**. Fixed by adding `'!**/*.map'` to `files` in `electron-builder.js`: maps are still written to `dist/` for local debugging, they just don't ship.

Version → **2.0.0**. Release notes at `docs/releases/RELEASE_NOTES_v2.0.md`.

**Coach polos** added to the Image Data installer (150 files, the staff counterpart to player jerseys). Built for the real case rather than just appending a folder: a **components page** splits the ~1 GB full library from the small polos pack, so an existing user unticks the library and takes only the new art; and `InstallDirRegKey` pre-fills the folder box from `HKCU\Software\CFB Dynasty Hub\AssetsPath`, so the polos land in the library they already have instead of creating a second copy. Compile-verified only — the components page hasn't been exercised by running the installer.

**The app icon was nearly missed.** v2.0 packaged with the OLD CFB Dynasty Hub mark — `build/icon.ico` hadn't been regenerated since 2026-07-19, so taskbar, Alt-Tab and Add/Remove Programs would all have shown the previous icon under the DynastyOS name. New art supplied (circular night-stadium with the gold OS, 512×512 with alpha). Filename normalised `Icon.png` → `ICON.png` to match what `scripts/make-icon.js` actually reads — it had only resolved by accident on case-insensitive Windows. Regenerated to 6 PNG-compressed entries (256→16) and verified by **parsing the ICO directory and re-rendering 48/32/16 from its own payloads**, rather than re-deriving from the source PNG: the stadium detail turns to dark texture at 16px, but the gold OS carries, which is the part that has to survive. Note for next time: `make-icon.js` resizes with `fit: 'cover'`, so a non-square source is centre-**cropped**, not letterboxed.

**A packaging error, caught by the output size.** The first v2.0 build was made COMPLETE (media bundled) on the stated rationale of "continuity with 1.5.0". That was **wrong**: 1.5.0 and 1.6.0 are ~142 MB, with the artwork shipping separately as `Image Data 0.6.1.exe` (971 MB) — i.e. the current model is **SLIM**, per the two-installer split from 0.5.0. COMPLETE produced a **1.12 GB** installer and would have pushed a gigabyte download onto users who already have the library. The user's own polos request was the tell — asking the *Image Data* installer to add art to an existing assets folder only makes sense on the slim model — and it was read past. Rebuilt with `SLIM_INSTALLER=1`; the wrong artifact was deleted rather than left in `release/` to be picked up by mistake.

## Phase — Analytics expansion: Phase 0 audit + Season Lab (2026-07-28)

Brief: turn Statistics/Trends into two polished experiences — **Season Lab** (one season explained) and **Program Arc** (year over year) — phase by phase, with a data audit first and no fabricated statistics.

### Phase 0 — audit

Full report at `docs/planning/ANALYTICS_PHASE0_AUDIT.md`. Read-only against a copy of the live archive; no production code touched.

**The good news:** the `schedule` snapshot is **league-wide** (944 games), and every game carries both `homeQuarterScores`/`awayQuarterScores` AND a per-game team stat block — 944/944 for both. So Quarter Pulse is real data, and national percentiles are *computed from 139 actual teams* rather than estimated.

**Five limitations, each verified rather than assumed:**

1. **Quarter scores are regulation only.** 47 of 944 games had quarter sums disagreeing with the final score. Tested the hypothesis: **47/47 were tied after regulation** — overtime, whose points land only in the final. Zero unexplained. So a quarter row will not sum to an OT game's margin, and the UI says so.
2. **`has_full_data` is not a usable signal** — it reads 1 for a season with zero games and no schedule snapshot. State is derived from games played + schedule presence. It IS used for one thing: telling a backfilled history-only season (never gains a schedule) from a preseason one (will).
3. **Weekly poll history is nearly empty** — `ranking_history` holds one row per season in five of six seasons.
4. **No `departures` snapshot exists** anywhere in the archive, despite the brief listing it. Phase 3 churn must diff `leagueRoster` on playerId.
5. **Snapshot payloads may be gzipped** behind a `gz:` marker.

**A methodology mistake worth recording:** the first pass audited a *copy* taken at 07:22 and reported it as current. The user synced their own dynasty mid-session, so the live archive moved underneath the audit and a season I documented as "0-game preseason" was a finished 12-game season by the time I wrote it up. I also briefly flagged it as possible damage from my own ingest — it wasn't; the diff against a pre-ingest backup showed it was the user's sync. **Audit a copy for speed, but re-check anything time-sensitive against the live file before reporting it.**

**Fixtures.** The archive had only one complete season, so Phase 2 wasn't verifiable. The user supplied a sequential save chain (DYNASTYBOWL 2026 → TESTER2 2027 → TESTER4 2028, all one dynasty) plus a preseason save (TULANEMASTER) that also backfilled three history-only seasons. Ingested through the app's own path (`extractAll` → `persistExtraction`, Electron stubbed only for path lookups). First attempt created three separate dynasties — they match on save path, not identity — so the strays were deleted and `relinkDynasty` used to sync one dynasty forward, which is the real upgrade path. Every state the brief names now exists as a real fixture.

### Phase 1 — Season Lab

`src/database/getSeasonAnalytics.ts` (+ types, IPC, preload, handler) and `src/renderer/components/charts/SeasonLab.tsx`. Reuses `getTeamGameStats` for classified games rather than re-implementing bowl/conference/site logic. Exhibits: summary strip, **Season Journey** (diverging bars, one per game), **Quarter Pulse** (heatmap + OT disclosure), **Team Identity** (percentile dots vs 139 teams), and a deterministic, descriptive **findings engine** (turnover battle, halves, home/away, conference split, one-score games, closing stretch — each with its own minimum sample, capped at four).

**Verified against all nine seasons in the archive.** Numbers match the Phase 0 hand-calculations, and journey margins reconcile against the summary on every season. 2027 contains real overtime games, so that path is exercised rather than theoretical.

**Structure, corrected mid-build.** First attempt put Season Lab on the Statistics page and made Statistics ⇄ Trends a toggle pair. Wrong: Statistics stays exactly as it was (Team/Players), **Trends is relabelled "Analytics"**, and a **Season ⇄ Yearly** toggle lives *inside* it. Poll Trajectory moved to the Season view, where a single-season week-by-week line belongs.

**Three bugs found only by looking at it:**
- Season Journey rendered at a hardcoded 320px SVG inside a ~1050px panel. Rebuilt in CSS so it fills its column.
- Opponent labels floated beside each bar and collided with each other and the bars at 12 games. Moved to their own truncating row.
- **The whole Analytics page bailed early** with "No trend data for this dynasty yet" for a dynasty with no trends, so the toggle never rendered and Season Lab's own empty states were unreachable. Guard split so only the Yearly view depends on trend data. **Partially fixed** — the Season view still falls through instead of showing Season Lab's preseason copy.

**Toggle** (`components/ui/ToggleSwitch.tsx`, from `UI/toggle.md`): the spec's `#1d9bf0` is Twitter blue, so the track uses the masthead's `GRADIENT_SURFACE` instead; the spec's absolute `translate(-50%,-50%)` centres on a point and breaks in a header row, so it's inline. Knob is a **gold team logo**, 26px in a 24px track so it deliberately overhangs, centred with `top-1/2 / -translate-y-1/2` rather than a hardcoded offset. Generic and controlled — the app's toggle from here on.

**Screenshot harness gotchas** (both cost real time): the capture branch requires **`USE_PRE_SPLASH_ONLY=1`**, and **a second instance quits silently** on `requestSingleInstanceLock()`, producing no file and no error — close the app before capturing. Theme can't be flipped by dispatching Ctrl+Shift+Z, since `.dark` is re-applied by an effect keyed on React state; write `cfb-dynasty-hub:color-theme` to localStorage and capture on a *second* run. Also: `CFB_USER_DATA_DIR` overrides userData — the Phase 0 doc wrongly said no override existed.

**Verified:** dark + light themes, complete/partial seasons, typecheck/lint/build clean. **Not verified:** narrow layout, bar-click → game modal, and the preseason/history-only empty states (blocked on the half-fixed guard above).

### Queued next (user request, not started)

- **Poll Trajectory rework.** Gridlines to the subdued stroke grey. Dark: CFP **gold, evenly dashed**; Coaches = team primary; AP = team secondary — with CFP falling back to grey when the team's own palette contains gold. Light: white secondaries (Alabama) → graphite; gold team colours (Wake Forest) → grey. **Hide CFP until the first real CFP poll** — the flat `#0` line is unranked being plotted as rank zero. Unranked teams don't plot until they enter the top 25; a team that drops out stops recording and resumes only if it returns. Drop the printed numbers; hover carries it. *Open question: the save stores only TWO team colours, so "team colour #3" was read as the secondary — needs confirming.*
- **Rivalries** — remove the duplicate leftmost logo in Your Rivals (same fix as All-Time Series).
- **Archive cards** — enlarge coach portraits and mask them against the card's lower-right edge so they sit inside the box rather than floating on it; scale the team logo behind them to match.
- **Yearly series colours** — still blue/green/pink. Deliberately deferred: `TrendCharts.tsx` avoids team colour so multiple series stay distinguishable, so this needs a real palette pass, not a find-replace.

## Phase — Poll Trajectory rework, Analytics guard, rivals + archive cards (2026-07-28)

The queued follow-ups from the Season Lab phase, all four shipped.

### The open question, closed by probing

The note asked whether "team colour #3" was really the secondary. It was: dumping every `COLOR` field on the `Team` table across three saves returns exactly **six** — `TEAM_BACKGROUNDCOLOR{R,G,B}` and the same three with a `2` suffix — plus a `TEAM_HAS_SECONDARY_COLOR` flag. There is no third colour, so CFP has to come from outside the palette.

The same probe answered a question I hadn't thought to ask, and it's the reason the chart was wrong rather than merely ugly: **the save ranks all 138 FBS teams, 1-138, in every poll** (255 marks the five FCS placeholder rows). The in-game polls are 25 deep; everything past that is private ordering. This dynasty's own recorded week read media 102 / coaches 94 / cfp 110 — those were being drawn as poll positions. And **CFP reads 0 for every team until the first CFP poll is released** (confirmed: 0 across 138 teams on two in-season saves, real 1-138 values on a completed one), which is exactly the flat `#0` line that prompted the rework.

### Poll Trajectory

Anything outside the top 25 is now a genuine gap: the line starts the week a team breaks in, stops when it drops out, resumes if it returns. CFP is omitted entirely — series, legend and all — until that poll is first released. The y-axis is pinned to #1-#25 so a season spent at #23 can't stretch to fill the panel and read like a top-5 run. Printed values are gone; hover carries the number.

**A real bug found on the way**: `ChartSeries` documented null as "never drawn or interpolated across", but `TrendLineChart` filtered the nulls out and drew ONE path — so a gap was silently bridged. Split into segments; the drop-out week now reads as a break rather than a straight line through it.

**Colours** (`lib/pollSeriesColors.ts`): Coaches = team primary, AP = team secondary, CFP = the logo's gold, dashed. Three substitutions, each earning its place — near-white → graphite and gold → grey, both **light-mode only** (on black, a dark maroon just needs lifting and a team's gold reads beautifully; it's CFP that steps off gold when the team already owns it), plus a duplicate-secondary guard so a team with no real second colour doesn't draw AP and Coaches as one line.

**Two attempts at "are these two colours too close":** plain RGB distance called Texas State's maroon and gold a collision at 58 units and pushed both lines to neutrals — a chart with no team colour in it at all. Replaced with a hue+lightness test: far-apart hues are always distinct however close their brightness, greys are distinguished by brightness alone. Maroon and gold survive; primary-twice still collapses.

### The rest

- **Analytics guard finished.** The Season view no longer falls through when a dynasty has no trend data — team name falls back to the season analytics, and each view owns its absence. The preseason and history-only empty states are now reachable, which is what the last phase left half-done.
- **Rivalries** — the standalone logo in a rival card sat left of a `TeamLink` that draws its own, the same duplication already fixed in All-time series. Removed; `TeamLink` carries the mark at the size the standalone one was.
- **Archive cards** — the coach portrait is anchored INTO the card's lower-right corner (negative margins cancelling the card padding, cropped by the card's own clip-path) at 16.25rem, which is the row's height plus the padding it bleeds through, so it grew ~20% without making the card taller. Team logo scaled h-16 → h-20 behind it. Right and bottom are card edges so those cuts are meant to be hard; the left one isn't an edge of anything — `object-cover` slices through the shoulder — so it fades out under a mask instead of ending in a seam. Hover scales from the bottom-right so it swells into its corner rather than lifting off the edge.

**Verification.** Disposable scratch archives (`CFB_USER_DATA_DIR`), never the live one. DYNASTYBOWL imported, then a 14-week `ranking_history` seeded covering every case the chart handles: unranked start, break-in, drop-out, return, CFP from week 9. Confirmed in **both themes** by reading the rendered strokes, not just eyeballing — dark: maroon `#927579` / gold `#b4985a` / graphite dashed; light: `#572a31` / grey `#6c6c72` / graphite dashed — plus a #1-#25 axis, two segments per team series, and no value labels. Also verified live: the **preseason** empty state (Tulane 2029) and the **history-only** one (Tulane 2028) that were previously unreachable, the rival card's single logo (East Carolina, whose Charlotte rivalry is the only flagged one on hand), the dynasty card in both themes, and **bar-click → game box score modal** (also unverified last phase — opens the Wisconsin game correctly). typecheck/lint/build clean.

**Still unverified:** narrow/responsive layout of the Season Lab exhibits.

**Gotcha worth keeping:** `ELECTRON_RUN_AS_NODE=1` is set in this shell, and it makes `npx electron .` boot as bare Node — `app` comes back undefined and the crash points at `setPath`, which reads like a `CFB_USER_DATA_DIR` bug rather than what it is. `unset` it in the same command.

### Correction, same day — the top-25 rule was wrong, and the user's own data proved it

The user came back with "the AP and Coaches polls are there all season, the CFP poll isn't active until the poll week — unless you heard me right, the polls aren't showing anymore." Both halves were true at once.

**Read their live archive (a copy, read-only) instead of guessing.** Auburn 2026 has nine recorded weeks: AP `30, 29, 27, 36, 31, 40, 30, 46, 69`, Coaches `32, 32, 29, 38, 31, 35, 25, 38, 63`, CFP `0` until week 9. Texas State's three seasons read 102/94, 74/74, 92/95; Sac State's reads 138/137.

So the CFP gating was right, and the **top-25 truncation destroyed the chart**: Auburn touches #25 in exactly one week, so eight of nine data points were discarded and the panel went empty. Every dynasty that isn't a national power would have seen the same. The earlier instruction ("unranked teams don't plot until they enter the top 25") was reasoning about the flat `#0` CFP line — a different problem, already fixed on its own.

**Reverted the truncation.** AP and Coaches plot every recorded week at their real national rank; `0` is still a genuine absence (an unreleased poll), so CFP still starts at its first week. The top 25 is now a **labelled dashed reference line** across the plot (new `yReference` prop on `TrendLineChart`, skipped when the season never goes near it) — so "in the published poll" stays readable without throwing the season away. The y-axis scales to the data again.

**Also:** toggle knob 26 → **35px** (+35% as asked), the track widened 44 → 52 alongside it so the slide stayed as legible as before (travel 20 → 19px, symmetric 1px overhang at both ends), and the knob's centre sits **5px above** the track's — deliberate, because a mascot mark's ink sits low inside its own square and true geometric centring reads as sitting low. Verified by measuring the live DOM: knob 35×35, track 52×24, knob centre − track centre = exactly −5.

**Lesson, and it's the second time this project has paid for it:** a display rule that sounds principled ("only show real poll positions") has to be checked against the archive it will run on before it ships. One query against the user's own `ranking_history` would have caught this before they had to look at an empty chart.

## Phase — Program Arc: the Yearly view gets three real modules (2026-07-28)

The Yearly view had three charts (record, class rank, points) and the user called it thin. **Audited the archive before proposing anything**, and the finding reframed the whole task: every season already stores **20 snapshots**, and the Yearly view was reading three numbers out of them. Nothing here needed a new extractor, a schema change or a re-sync — it all fills in retroactively for seasons synced months ago.

**Shipped** (`getProgramArc.ts`, `charts/ProgramArc.tsx`, types + IPC):

- **Program prestige** — `teams[].teamPrestige`, the game's own 0-10 program rating, with national and conference rank per season. Verified spread across the league (28 teams at 3, only 5 at 10), so a rank is meaningful rather than decorative.
- **How the roster was built** — `teams[].positionGrades` (the numbers behind the in-game Team Ratings screen) as a units × seasons heat map.
- **Program efficiency** — eight metrics per season, each with its national rank and how far that rank has moved since the first season.

**National context everywhere**, at the user's request. The `teams` snapshot is league-wide, so prestige and unit grades rank against every real program for free; efficiency reuses Season Lab's league aggregation — `aggregateLeagueFromSchedule` / `derive` / `EFFICIENCY_DIMENSIONS` were **extracted and exported rather than copied**, so "Third down" cannot come to mean two different things in the two views.

**Three judgement calls worth recording:**
- **Shade the percentile, not the value.** Position grades cluster in the 60s and 70s nationwide; colouring cells by grade produced twelve rows of identical beige. Shading by national percentile is what makes a 72 in a weak year look different from a 72 in a strong one — which is the actual story.
- **Prestige needed a track, not a bar.** A bar sized to the value can't show that 3 is 3-*out-of-10*; two seasons a point apart read as a rout. Each season is now a full-height track with the value filled from the bottom, so the ceiling is visible.
- **Red-zone rate and time of possession were deliberately left out.** The season `teamStats` snapshot has them, but only for the user's team — they could never carry a national rank, and the whole point of this view is that every number is placed.

**Verified against the user's own archive** (a copy, in a scratch `CFB_USER_DATA_DIR`), which holds a real three-season Texas State chain — and the data tells a story the app couldn't previously show: prestige 2 (#103) → 3 (#77), conference 8th → 5th; the RB room rebuilt from **#136 to #9 nationally** then back to #32; points allowed #51 → #116 → #22; third down #48 → #115. Ran the getter across all three dynasties in the archive including two single-season ones (sparklines correctly degrade to "—" under two points), captured both themes, and confirmed the mid-sync 2028 season is flagged as in-progress rather than plotted as a collapse. typecheck/lint/build clean.

**Two layout bugs found only by looking at it:** the heat map at `w-full` stretched three seasons into ~350px blocks (fixed column widths now; more seasons scroll right, which is the correct direction for a timeline), and a half-width heat map left a hole in the grid — it now pairs with efficiency, prestige pairs with the record chart.

**Proposed and not built, all verified present in the archive:** school record book chase (`teams[].schoolRecords` carries career/season/game records including pre-dynasty legends — e.g. Bradley George, 9,556 pass yards, 2009), résumé/quality wins (the `game_context` table already holds **3,627 rows** of opponent ranks and records at kickoff, entirely unused by analytics), the national picture per season (`yearSummary`), and the coach ladder (salary/contract/job security per season from `coaches`).

## Phase — Schedule masthead helmet + placeholder bowls hidden until bowl week (2026-07-28)

**The helmet.** The Schedule masthead helmet ran 13rem and read as an icon sitting politely inside the padding. Now 22rem, eating its own vertical padding and the card's left padding, so it leans out of the masthead and gets cropped by the card's clip-path — the same "sits IN the card, not on it" treatment as the dynasty cards. Checked the source art first: the helmets are 1024², so there's plenty of resolution to nearly double the render size without softening. Drop shadow is on the artwork, not the panel — SurfaceCard stays flat by design.

**The bowl bug, confirmed in the user's own archive before touching anything.** The save carries bowl games from the start of the season with participants already filled in: an Auburn dynasty sitting at **4-4 in `RegularSeason`** already listed "Week 18 · Reliaquest Bowl · USC @ Auburn (Unplayed)". Those are the game's pre-assignments and get rewritten once bowls are genuinely set, so listing them is worse than listing nothing — it tells a user their bowl before it exists, and tells them the wrong one.

**The gate lands exactly where the calendar does.** Bowls are assigned the week after conference championship week, and that's precisely where the save's own week type flips: conference championship week is still `RegularSeason`, the postseason is `NationalChampionship`. So "not PreSeason and not RegularSeason" *is* "bowl week has started" — new `isBowlSlateSet()` in `shared/syncPhase.ts`, no new data needed.

Paired with "…or the game has been played", which is what makes it safe on legacy data: a season archived before phase tracking has no week type, and the gate can then only ever hide an UNPLAYED bowl, never a real result. Applied to `getSchedule` (your own), `getLeagueTeamSchedule` and `getLeagueTeamOverview` — that last one wasn't in the ask, but its "upcoming games" list is the same snapshot with the same defect, and it would have shown the phantom bowl as an upcoming fixture.

**Verified both directions** on the real archive: Auburn's in-progress season 13 games → 12 with the phantom bowl gone and upcoming reading wk10/11/12; the finished 2026 Texas State season still shows "Alamo Bowl W"; 2027 (3-9, not bowl eligible) correctly shows none. Helmet checked in both themes. typecheck/lint/build clean.

## Phase — Yearly view: efficiency chart, on-brand colours, and the ST label tested (2026-07-28)

**`ST` is Special Teams, not Safeties — the one instruction not carried out, because it was testable and false.** Asked to relabel `ST` → `S`. Tested it across 143 teams instead of assuming either way: the grade correlates with the best K/P on the roster (r=0.36) and no better with safeties (0.22) than with corners (0.21). The bottom of the league settles it — Sac State ST 71 / kicker 71, Troy ST 72 / kicker 72 — while an FCS side carrying a 94 safety still grades ST 73. Meanwhile `db` correlates with safeties (0.48) and corners (0.52) alike, i.e. it already IS the whole secondary and the save has no separate safety grade. Relabelled **"Special teams"** rather than "ST", which fixes the real problem (two letters that invite exactly this misreading) without putting a wrong name on the data. Reasoning recorded at the constant so nobody re-derives it.

**Program efficiency gained a chart.** The paragraph of narration under the rows is gone — that text belongs in the panel's info hint, which is where the rest of the app keeps its narration — and the dead space it left is now a **toggleable line chart**: chip per metric, click to add or drop it, seeded with Scoring + Points allowed. It plots **national rank, not raw values**, which is the only thing that works: scoring ~34, total offense ~555, third down ~37%, turnover margin ~1.4 — on one axis the yardage line flattens everything else onto the baseline. Rank puts all eight on one scale, inverted so up is better, and rank is what the reader is comparing anyway.

**The blue is gone.** Every chart on this page is one program's story, so they're painted in that program's colours: wins bar, class rank and Points-For all take the team primary; Points-Against takes the secondary. New `teamSeriesPalette()` reuses the poll chart's normalisation, so the same rules apply — a near-white secondary becomes graphite, a gold one becomes grey on the light page, and a program with no real secondary doesn't draw two identical series. Past two series it falls back to the logo's gold then neutrals: the save only HAS two team colours, and inventing hues a program doesn't own is what made this look foreign in the first place.

**Chased the tint into the chart internals too.** The bright blue wasn't only the series colour — `TrendCharts` was still full of stock Tailwind slate (`#475569` ink, `#cbd5e1` losses, `#334155` grid) and, worst of it, a `#0b1220` navy as the label knockout colour. All moved to the app's own true-neutral ramp. That's what made the page read blue even where nothing was explicitly coloured.

**Also:** the white ring marking a top-25 unit in the heat map is gone (it belonged to no part of the brand) — those cells are called out by weight now, which still isn't colour-alone; and the toggle knob came back down 3px, since the earlier 5px lift was overdone.

Verified in both themes against the real three-season archive. typecheck/lint/build clean.

## Phase — Frameless window: the Windows title bar is gone (2026-07-28)

The app wore the standard purple Windows title bar while Slack/Discord/Figma don't. Now it doesn't either.

**Chose the Figma/VS Code route, not the Slack/Discord one.** `titleBarStyle: 'hidden'` + `titleBarOverlay` — the Windows Control Overlay. Windows still *draws* the minimise/maximise/close buttons, just as a transparent overlay on our own page, which keeps **Snap Layouts (hover-maximise), correct hit targets, tooltips and accessibility working for free**. Drawing our own buttons (`frame: false`) would have looked equally good and made every one of those our problem forever.

**Two things made this cheap, both pre-existing:**
- The masthead is a strip with **nothing interactive in it** (the utility controls moved to the sidebar back in July), so it could become the drag region as-is. A drag region swallows clicks from its children, so this mattered.
- **Packaged builds already ship with no menu** (`Menu.setApplicationMenu(app.isPackaged ? null : buildAppMenu())`), and a hidden title bar has nowhere to draw one. So users lose nothing; dev keeps it behind Alt via `autoHideMenuBar`.

**The parts that aren't obvious:**
- The caption buttons are drawn by the OS *over* the page and inherit nothing from CSS — so flipping to light mode left a black band across the top-right corner until `setTitleBarOverlay` was wired to the appearance change (new `IPC.window.setTitleBarTheme`, handler registered per-window and torn down with it). Strip colour matches the page ground exactly in each theme so it disappears.
- The masthead's top padding now clears `--titlebar-height`, so the buttons float over the page ground rather than landing on the card. That constant is duplicated in `main.ts` and `globals.css` and the comment in each points at the other.
- Right-hand gutter uses Chromium's `env(titlebar-area-width)` where available — the real button width changes with DPI and Windows' own sizing — with a 140px fallback for first paint and non-Windows builds.

**Verified with real desktop captures, not `capturePage`.** The screenshot harness renders web contents only and would have shown nothing about the frame; these were taken by grabbing the actual screen and cropping to the window rect via `GetWindowRect`. Both themes confirmed: no OS title bar, page content starts at the window's top edge, and the three buttons sit colour-matched at the top right (light strip + dark glyphs in light mode, black strip + light glyphs in dark). typecheck/lint/build clean.

**Note for future screenshot runs:** page content now starts ~36px lower, so any hardcoded `SCREENSHOT_RECT` from before this change is off by that much.

## Phase — Card line-up changes; card system scoped (2026-07-28)

**Done:** jersey watermark hidden (left in the tree behind `SHOW_JERSEY_WATERMARK` — the `bottom-[62px]` and `z-2` values were both arrived at by measurement, and deleting them would mean re-deriving solved work), and the position folded into the profile line at the same type and weight: "Quarterback · Texas State · Freshman · 2026". Verified by capture.

**Deliberately NOT started in the same pass** — the remaining five asks are a feature, not a batch of tweaks, and each needs its own foundation:

1. **Favorite (star) on a card** — needs persistence. No table holds per-player card state today; `card-photos/<dynastyId>` is filesystem-only. Wants a `player_cards` table (schema migration), which is also the foundation for 2 and 4.
2. **Multiple cards per player + a chosen default** — same table, plus a card id, plus "which one does hover use". Changes `PlayerCard`'s single-photo assumption and the hover provider.
3. **Export dialog** (toggle OVR / Name / Profile / Stats / Team Logo) — the card renderer currently has no notion of optional layers; each becomes a prop, and the existing export path grows a pre-flight modal.
4. **Coach Hub → "Coach", + a Cards entry above Scandals** — small on its own, but it's the entry point for 5.
5. **The card book** — a new page: every favorited card, paginated by season year, select / select-all, and export through the same dialog as 3.

Order that actually works: **(1) the table → (2) multi-card + default → (3) layer toggles + export dialog → (4) nav → (5) the book**, since 5 consumes all of 1-4 and 3's dialog is shared between the single-card export and the book's bulk export. Doing 5 first would mean building a book with nothing to put in it.

### Handoff — what a fresh session needs

Written down because these are the facts that cost real time to rediscover, not because they're hard.

**Where things are.** Schema is at **version 11** (`src/database/migrations.ts` + `schema_v11_game_context.sql`) — v12 follows that pattern. Card photos are filesystem-only today: `<userData>/card-photos/<dynastyId>`, IPC `window.api.card.{pickPhoto,setPhotoFromPath,getPhoto,removePhoto}`. There is **no** per-player card row anywhere in the DB yet. The nav label lives in `components/common/DynastyLayout.tsx`; the Scandals trigger is in `pages/CoachHub.tsx` (~line 312, near `ScandalsModal`).

**Card state as left.** The jersey watermark is hidden behind `SHOW_JERSEY_WATERMARK = false` in `PlayerCard.tsx` — kept rather than deleted because its `bottom-[62px]` / `z-2` values were measured against the art, not guessed. The profile line is now a single row: `Position · School · Class · Year`.

**Traps, all of which have already bitten once in this codebase:**
- Modals must use `ModalOverlay` — it portals to `<body>` and assigns z-order on open. `#root` carries `isolation: isolate`, so a non-portalled modal loses to a portalled one *regardless* of z-index.
- `SurfaceCard`'s cut corner is a `clip-path`: no descendant can ever overflow it. Anything meant to break the card's edge has to be a sibling.
- Screenshot harness: `unset ELECTRON_RUN_AS_NODE` first (it's set in this shell and makes Electron boot as bare Node), and a second instance quits **silently** on the single-instance lock — kill any running Electron before a capture run.
- Verify against a COPY of the archive in a scratch `CFB_USER_DATA_DIR`, never the live one.

**Sequencing note for whoever picks this up:** build the export dialog (3) as a standalone component even though the single-card export is the only caller at first — the book's bulk export needs the identical thing, and retrofitting it for multi-select afterwards is the more painful direction.

## Phase — "Player not found" on opponent players in the box score (2026-07-28)

Clicking a non-user player in the Game Info stat tables returned an empty "Player not found" modal.

**Cause:** `buildGameRows` in GameDetail never put `teamIndex` on the row. `StatisticsTable` resolves a click as `rowTeamIndex ?? viewedTeamIndex`, so with no row index it fell back to the page's *viewed* team — which is `null` when the box score is open as an app-root modal. With no `leagueTeamIndex`, `PlayerProfileContent` searched the USER's roster, and an opponent is never in it.

The data was there the whole time: the gamelog entries already carry `teamIndex`; the row builder just dropped it. One line to add it back, and it fixes the leader cards at the same time — they read `leader.teamIndex` and were getting `undefined` too.

**A wrong first fix, worth recording.** I initially passed `leagueTeamIndex={activeTeamIndex}` to each `StatisticsCategorySection` — which doesn't accept that prop (it derives it per row), so it didn't compile. Fixing the row builder is both correct and narrower: per-row means a table containing both sides still resolves each player against their own team.

TypeScript caught a second detail: `exactOptionalPropertyTypes` rejects `teamIndex: number | undefined` against `teamIndex?: number`, so the key is spread in only when the entry actually has one.

**Proven at the data layer** rather than by driving the UI, after the click path proved fiddly to automate. On Texas State @ Wisconsin (user 124, opponent 112): opponent gamelog entries carry `teamIndex` ✓; sample opponent player 968 is **not** in the user's roster (exactly why the modal said "not found") and **is** in Wisconsin's league roster (what the modal now searches).

## Phase — New splash + app icon (2026-07-28)

Both supplied art assets installed. Neither was a straight copy.

**Icon — would have been clipped.** The source is **528×512, not square**, and `make-icon.js` resizes with `fit: 'cover'`, which centre-CROPS a non-square source. Measured the alpha bounds: the art spans x 2-525 of 528, while a square crop removes everything outside x 8-519 — so roughly 6px of the mark on each side would have been shaved off. Padded the source to 528×528 with transparency instead, so the crop is a no-op and every pixel survives. `public/Icon/ICON.png` (that exact filename — the script only resolves by accident on case-insensitive Windows).

Verified by **parsing the ICO and decoding its own payloads** rather than re-deriving from the PNG: 6 entries, 256→16, each decoding at its declared size, and the gold OS still reads at 16px.

**Splash — a resolution drop worth knowing about.** The new `Splash.png` is 868×420, which matches `SPLASH_WIDTH`/`SPLASH_HEIGHT` and the pre-splash HTA exactly. But the file it replaced was **1736×839** — a 2× asset for HiDPI. Both render correctly at the window's 868×420; the previous one was simply sharper on a high-DPI screen. Flagged rather than silently swapped.

That also corrected a comment in main.ts which claimed the constants "match spshscr.png's native resolution exactly (868×420)" — untrue of the old 2× file. They're a layout size, not the artwork's pixel size.

Previous assets moved to `DynastyOS/logo/_previous/` — out of `public/`, so they don't get packaged, while staying available as a rollback.

**Not verified:** the splash rendering on screen. It's shown for ~1.2s and two timed capture attempts missed the window. Placement and dimensions are confirmed; the visual is not.

## Phase — The page ground is now a theme setting (2026-07-28)

The ground was hardcoded in globals.css. It's now `--ground`, driven by the theme preference and editable in **Preferences → Background**, for both appearances.

**Stored per appearance** (`groundDark` / `groundLight`), because one value can't serve both: a colour that reads behind light text is unreadable behind dark text. ThemeProvider applies only the ACTIVE one, so globals.css needs a single declaration and a theme flip is a one-property change.

**Defaults reproduce exactly what was hardcoded** (#000000 / #e8eaed) and preferences saved before this existed fall back to them, so nothing moves until someone deliberately picks a colour. The CSS keeps those same values as `var()` fallbacks, covering the first paint before React runs.

**One thing genuinely lost:** the light theme's three-stop gradient. A gradient can't honour a chosen ground without generating its stops from it, and a flat colour is the honest reading of "set the background to this." Light mode is now flat.

**Verified end to end:** default reads `--ground: #000000` with body and html both `rgb(0,0,0)`; seeding `groundDark: '#dedede'` and relaunching gives `--ground: #dedede` with body `rgb(222,222,222)`.

**Worth knowing before using it:** the ground is the only thing that moves. Panels stay black in dark mode (`--surface-*` and `dark:bg-black`), so a light ground under dark mode puts black panels on a pale page — and the title-bar wordmark, which is drawn light for a dark chrome, gets hard to read. That's a legitimate look if chosen deliberately, but it is not a full light/dark inversion.

## Phase — The dark-mode grey was a class on <body> (2026-07-28)

Asked for repeatedly, "fixed" twice, still grey. The reason every previous pass missed it: **the paint wasn't in the CSS at all.** `public/index.html` had `<body class="… dark:bg-slate-950 …">` — #0a0a0b — and a Tailwind utility outranks an `@layer base` rule, so the `.dark body { background-color: #000000 }` declaration in globals.css never won. Fixing surfaces, gradients and card fills couldn't reach it.

**Found by sampling pixels, not by reading code.** `PrintWindow` + `GetPixel` down a column: the top 40px read exactly rgb(10,10,11) and stayed there through two rounds of CSS fixes. Then `elementFromPoint` walked the ancestor chain and named `<body>` with `rgb(10, 10, 11)` while `--surface-primary` and `html` both correctly reported black. That's the whole diagnosis in one call — worth remembering next time a colour "won't change".

One wrong turn worth recording: two different off-blacks (rgb(10,10,11) top, rgb(13,13,13) bottom) looked exactly like Windows 11 compositing a system backdrop behind a frameless window, so the window got an explicit `backgroundColor: '#000000'` and `html` got the ground painted. Neither changed the pixel. Both are correct hardening and stayed — a frameless window with no opaque backing genuinely can leak the desktop — but they were not the bug.

Confirmed by re-sampling the same column: **rgb(0,0,0) from y=0 to y=39**, with only the panel's intentional 1px border at y=40.

## Phase — Dark mode is actually black now (2026-07-28)

Asked for repeatedly and only half-done each time, because the grey came from FIVE separate layers and fixing any one of them left the rest. Found them by enumerating every painted surface in the live DOM instead of reasoning about the CSS:

1. `--surface-primary: rgba(10,10,11,0.92)`
2. `--surface-raised: rgba(15,15,17,0.97)`
3. `--surface-overlay: #0d0d0f`
4. **`GRADIENT_SURFACE`'s `dark:from-white/[0.055]`** — a 5.5% white wash on the top edge of *every* SurfaceCard. The biggest contributor by far, because it compounds across every panel at once.
5. The dashboard card's own `inset-[1px]` 5% white sheen, plus its `dark:bg-slate-950/74` fill.

All five are now pure black in dark mode (the sheen and wash are light-mode only). The near-blacks existed to separate panels from the page by value — but the page is `#000`, so instead of reading as depth they read as grey slabs floating on black. Separation comes from the borders alone now, which is enough on a black ground and matches how the rest of the shape language already works.

**Verified by re-running the same enumeration**: exactly one painted layer survives, the dashboard cards' team-colour wash (`rgba(87,42,49,0.34)` for Texas State) — which is program identity, not chrome, and is meant to be there.

The one deliberate exception is `--surface-interactive-hover`: hover has to register as a change, so it stays lifted.

## Phase — Game header: rank above the rule, record at kickoff (2026-07-28)

The team flanks on the game box score now read **#19 → colour rule → team name → 10-3**.

**Rank moved up and grew.** It was sitting under the name in eyebrow grey — the loudest fact about a matchup ("#3 vs #7") rendered as the quietest thing on the card. Now it leads the stack above the rule, bold and a step larger than the name, and still only for a genuine top-25 position.

**Record at kickoff took its place**, from the same `game_context` capture the schedule page reads — so it follows the schedule's rules exactly, including its limits: the record is null for games played before context capture existed, because the save only ever exposes a team's CURRENT record and a point-in-time one can't be reconstructed after the fact. On a season synced once at the end, every game therefore shows that season's final record; on one synced week by week it shows the record going in. Same data, same caveat, same behaviour as the schedule — which is what "following the same rules" has to mean.

Verified on a played game: Wisconsin renders #19 above the rule with 10-3 beneath the name, and an unranked Texas State correctly shows no rank line at all.

## Phase — Player modal navigation + trading-card layout (2026-07-28)

**The open tab now survives Prev/Next.** Stepping to the next player always dropped you back to Overview — because `PlayerProfileContent` is keyed on the player id to animate the swap, and that remount destroyed its internally-held tab. The tab moved UP into `PlayerProfileModal`, outside the keyed subtree, so the remount can't touch it; `PlayerProfileContent` takes an optional controlled `tab`/`onTabChange` and still works uncontrolled for any other caller. It resets to Overview when the modal OPENS (a fresh profile shouldn't inherit a tab from a previous session) but not when stepping.

Arrow navigation itself already existed; it now carries the tab with it. Verified end to end: opened on **Overview** → clicked **Card** → **ArrowRight** → next player, still on **Card**.

**Trading card, four changes:**
- Jersey number dropped to sit on the profile line's baseline (`bottom-[62px]`, clearing the stat row and the line's own margin) and its opacity went 10% → **50%**.
- It also moved **above the bottom fade** (z-1 → z-2). At z-1 the fade painted over it and 50% still read as a faint smudge — the number was doing the work and the gradient was undoing it. Still under the name and the bottom band, so it stays a watermark.
- **Position spelled out** above the profile line ("Tight End", not "TE") at one step up in size and weight — enough to lead the line, not enough to pull off the name. New `lib/positionNames.ts` maps the save's depth-chart codes; sides collapse deliberately (LOLB/ROLB → Outside Linebacker), and unknown codes fall through unchanged.
- **DynastyOS mark in the top-left**, where the position chip was — the Topps/Fleer corner convention. Inlined as `DynastyOSMark` rather than referenced by path: its source lives in `/DynastyOS/logo`, which isn't part of the packaged assets, so an `<img>` would have resolved in dev and 404'd in a release — the same trap that broke the portrait picker. Its gradient ids are namespaced, since SVG ids are document-global.

**Verified:** the tab/arrow behaviour by driving the real keystrokes, and the card's mark, spelled-out position and profile line by capture. The watermark's z-2 lift is the one thing not seen rendered — two capture runs lost the modal before the frame.

## Phase — Modal stacking: last-opened wins (2026-07-28)

Opening a player from the game box score put the player card BEHIND the game modal. Two causes, and **the obvious one was only half of it**.

**Cause 1 — everyone claimed the same z-index.** Every modal hardcoded `z-[100]` or `z-[110]`, so with two open the tie fell through to DOM order, which is decided by where each provider happens to sit in `app.tsx`. New `lib/modalLayer.ts` hands out depth on OPEN instead: base 100, +10 per open modal, slot released on close so the numbers can't creep over a session. Whatever you opened last is on top, however the tree is arranged.

**Cause 2 — and this is the one that would have made a z-index-only fix look like it worked.** After the depth fix the numbers were right (player 120 over game 110) and the bug was still there. `#root` carries `isolation: isolate` (globals.css), making it its own stacking context: the player modal rendered inside the tree, the game modal portalled to `<body>`. A portalled sibling of `#root` paints above the entire subtree no matter what z-index something inside claims. So `ModalOverlay` portals to `<body>` too — six of the eleven modals weren't.

**Caught only because the check was a hit test, not a number.** Reading the computed z-indexes said 120 > 110 and looked like success; `document.elementFromPoint(centre)` still answered "Game box score". After portalling it answers "Player profile". A screenshot would have shown it too, but the run that was supposed to capture it lost the modals before the frame — the hit test is the reliable form of this check.

All eleven overlays now share one `ModalOverlay`, so this can't drift back one component at a time.

**Also:** the player modal's teammate rail now defaults CLOSED. It's a jump-to-teammate convenience, not part of reading a player, and opening every profile with it already out pushed the content sideways before you'd asked for anything. Verified via the trigger's own label reading "Show teammate list" on open.

## Phase — Logos stay inside the card; helmets keep the overhang (2026-07-28)

The pop-out works for helmets and doesn't for logos, so the two now differ on purpose rather than by accident: **helmets 250px (overhanging a ~194px card), logos 170px (inset ~12px inside it)**.

Why the same treatment reads differently on the two: a helmet is one silhouette with a soft edge, so breaking the frame reads as depth. A logo is a dense, high-contrast shape with a hard outline — crossing the card edge reads as a clipping bug, not a flourish. Same geometry, opposite impression.

Nothing else moved: the 300px width cap and the fixed slot still hold, so the headline starts on the same pixel and no wordmark runs away sideways. Verified both — Auburn's logo now clears the card edge top and bottom, and the Statistics helmet still breaks it.

## Phase — Shift + arrows step through teams (2026-07-28)

**Shift + ← / →** cycles the team switcher and wraps at both ends.

Bound in `TeamSwitcher` rather than in the provider on purpose: the shortcut should only exist where a switcher is actually on screen, and the component's own mounting is the most honest signal for that — no list of "pages that have a switcher" to keep in sync as pages come and go.

**It collided with something, and only a check caught it.** The player modal already binds bare ArrowLeft/ArrowRight and did NOT test `shiftKey`, so Shift+Arrow would have stepped a player *and* silently changed the team on the page behind it. The modal now ignores shifted arrows, and the switcher additionally stands down whenever anything with `role="dialog"` is open — the app's overlays all portal to `<body>`, so they aren't ancestors of the switcher and no focus/containment check would have seen them.

Also skipped while a text field has focus, so it can't hijack shift-select in a search box.

**Verified by driving the real keystrokes:** from Auburn, three Shift+→ gave Air Force → Akron → Alabama; four Shift+← walked back and then wrapped past the first option to **Wyoming**, the last of 138. Plain arrows changed nothing.

Manual updated — the "Getting around" section also still described Tools as living in the sidebar with Quick Help, both of which changed earlier today.

## Phase — The FCS pool crash (2026-07-28)

**Found the mechanism before removing anything**, because hiding a link doesn't fix a getter that falls over.

The save has no real FCS teams. It has ONE bucket at **teamIndex 255** (0xFF = "none") holding every non-FBS entity — the five "FCS East / West / Midwest / Northwest / Southeast" rows plus practice squads — and on a real archive **4,525 players sit on that single index**. `getLeagueTeams` counted players per index with no exclusion, so **the team switcher offered "FCS West"**, and picking it asked the app to render a 4,525-player roster with portraits. That's the crash.

Closed at the data layer rather than per-surface, so a deep link or stale state can't reach it either: `getLeagueTeams` drops the pool, and `getLeagueTeamRoster` / `getTeamCard` / `getLeagueTeamOverview` / `getLeagueTeamSchedule` / `getLeagueTeamHonors` all return null for it at their entry.

**Head-to-head had a second, quieter bug.** It buckets opponents by index, so games against FCS West, Southeast and Midwest all merged into ONE series row labelled after whichever was seen last — a won-loss record for a team that doesn't exist. Those now skip the series entirely.

**Deliberately kept: your games against FCS opponents.** That result is real, it counts in your record, and dropping it would quietly corrupt the season — Auburn's week-12 FCS Southeast game still shows, the 4-4 record is unchanged. Those rows simply aren't clickable.

**The constant lived in eight places.** `FCS_POOL_TEAM_INDEX = 255` was independently re-declared across seven getters plus TeamLink — which is precisely how one of them ends up forgetting the guard, as `getLeagueTeams` did. Now one `shared/fcsPool.ts` with the reasoning attached.

**Verified through the real IPC:** switcher 139 → 138 teams with zero FCS entries; roster / card / schedule / honors for index 255 all return null; head-to-head has 8 real opponents and no FCS row; the week-12 game still renders; and of 11 clickable team links on the schedule page, **0** point at the pool.

## Phase — Marks fit a BOX, not a height (2026-07-28)

Normalising on height alone was half a solution, and JMU proved it. Every mark came out 210px tall — right for a round emblem, absurd for a wordmark: **JMU rendered 638px wide, UAB 689px**, against a 257px median. A 6.4× spread sideways, with the widest marks swallowing the card they sat on.

`markGeometry` now fits each mark inside a **300 × 230 slot**, taking whichever limit binds first — `object-fit: contain` applied to the ARTWORK rather than to its mostly-empty canvas. Verified across all 144 logos: widths **117-300px** (was 107-689), heights 91-230, and **zero** exceeding the slot.

The slot width is fixed and the art is centred inside it, so the headline starts on the same pixel for every team — a narrow mark leaves a gap rather than dragging the text left with it.

The trade-off is worth stating plainly: a 3:1 wordmark constrained to a sane width **cannot** also be as tall as a round emblem, so JMU sits 99px tall against Auburn's 230 and doesn't overhang the card. That's not a compromise so much as the honest answer — those marks genuinely are wide and short, and the alternative is the 689px monster.

## Phase — Nav alignment, and the bounds map was measuring the wrong folder (2026-07-28)

**Ball State exposed a real bug, not a spacing problem.** The report was that big logos cover the toggle above them. The cause was the bounds map: it measured `PNG_OD` (69 files), but `getLogoPath` serves **`png_OL`** for most teams — the OD folder only holds the ~69 "genuine two-variant" teams. So **75 of 144 teams had no measurement and were silently falling back to the median**, and Ball State (74% fill vs the 61% median) rendered **22% larger than intended**: a 345px box where 283px was correct.

Fixed by measuring all three logo folders — gold, on-dark, then on-light, with the complete set last so it wins. Coverage is now **144 of 144, zero fallbacks**. Every logo normalises to the same 210px, which means the overhang above the card is a constant 8px for every team rather than a per-team lottery. That's the part that actually prevents this recurring.

Worth noting how it hid: a median fallback doesn't error, doesn't warn, and looks plausible for teams near the median. It only shows up at the extremes — which is why it surfaced as "Ball State looks wrong" rather than as a bug report about the map.

**Three nav rows now start on the same pixel.** They were at x=38 (top nav), x=20 (sub-nav) and x=0 (pair toggle). The top nav's offset was structural: a `p-4` card wrapping a *second* bordered `p-1.5` strip, so the nesting itself was the misalignment. The inner strip's border and fill are gone and the outer card took over its padding, making the two nav rows structurally identical — they line up by construction now, not by a tuned number. Tab padding matched to `px-3.5`, and the toggle takes `pl-5`. Measured after: **360 / 360 / 359**.

**Gap below the toggle doubled** (`space-y-5` → `space-y-10`), so an overhanging mark has room rather than reaching up into the switch.

## Phase — Chrome: tools into the title bar, nav renamed, pair toggles (2026-07-28)

**Tools moved out of the sidebar into the title bar**, as icons, hard against the Windows caption buttons with a rule between the two sets so it's clear which belong to the app and which to the OS. Preferences = gear, User Manual = book, About = the InnerActivity mark. Standalone marks, no chip or border. **Quick Help retired** — the manual covers it, and two doors to the same room is one too many; `HelpMenu` is left in the tree unreferenced so restoring it is a one-line change.

**The move cost nothing because of an earlier decision.** All three menus already open a `CenteredModalPanel`, so relocating their triggers from the sidebar's bottom to the window's top needed no positioning work at all — nothing is anchored to them. Had they still used the old upward-opening anchored panel, every one would have opened off-screen.

Two things the icons needed:
- `app-no-drag`. The title bar is the window's drag region, which swallows clicks from its children — without it the buttons would have looked right and done nothing.
- **The InnerActivity mark needed its strokes rebuilt.** Its art is drawn for a 1920px canvas; at 18px the ring is a 0.26px hairline. It now carries an explicit stroke over its fill to reach the same 1.7-on-24 weight as the gear and book, because a smudge next to two crisp icons doesn't read as a set.

**Nav renamed** — Team Hub → **Program**, NCAA Hub → **NCAA**, Recruit Hub → **Recruiting**, Media Hub → **Media**; Coach Hub left as-is since it wasn't listed. The Team Hub sub-tab **Roster → Team**, which also fixes a small lie: that tab holds the Roster|Transfers pair, so naming it after one half read as a broken link to the other.

**`PairLayout` now uses the app's ToggleSwitch** instead of its own pills, with the gold team logo as the knob. All four pairs get it, not just Roster|Transfers — the same interaction was wearing a segmented-button costume there and a switch costume inside Analytics, often on the same screen. Verified it actually navigates (`/roster` → `/transfers`, `aria-checked` true), since swapping a `NavLink` for a controlled switch moves routing from the browser to an onChange.

Verified in both themes; typecheck/lint/build clean.

## Phase — One masthead across every team page + the scroll jitter fixed (2026-07-28)

**Measured before building, and the measurement changed the plan.** The ask was to give seven pages the Schedule's popped-out mark. Helmets were safe — sampled across 40 teams they fill 53.0-57.5% of their canvas, a **1.085× spread**, so one constant works. Logos were not: across all 69 3D logos the fill runs **25% (LSU) to 80% (Texas State) — a 3.19× spread**. In one fixed box LSU renders a third the height of Texas State's, so some teams' marks would bulge past the card and others wouldn't reach it. That is the precise opposite of the uniformity being asked for, so it went back to the user rather than shipping quietly.

**The fix is a measured map, not magic numbers.** New re-runnable `scripts/measure-mark-bounds.js` reads the alpha bounding box of every mark (69 logos + 151 helmets, a few seconds at a 256px sample) and emits `lib/markBounds.generated.ts` — fill fraction and art centre per asset, ~19 KB. `lib/markBounds.ts` then solves the placement arithmetically: box size = target art height ÷ fill, with a negative left offset cancelling the baked-in margin. Every team's mark now presents at the same visible size — LSU gets an 840px box, Texas State 264px, Auburn 351px, all producing a 210px logo.

Bounds are keyed off the **resolved asset path**, not the team name, deliberately: the app already resolves a team to a file through `getLogoPath`/`getHelmetPath` (alias table and all), so reusing that answer means the bounds can never describe a different file than the one being rendered.

**`PageMasthead`** replaces eight hand-built headers (the seven asked for plus Schedule, whose one-off hero became the shared component). Same card height everywhere, mark as a sibling so it overhangs without growing the card, optional stat chips (Schedule) and right-side actions (Team Awards). Team Hub left alone as requested.

Pages now read eyebrow → **team name** → context line, matching the two examples given; the explanatory sentences moved behind the info hint, which is where PageHeader already puts them. Rivalries had no team name in scope at all and now takes the user's team, which is correct for a page built entirely from their own schedules.

**Scroll jitter: diagnosed, not guessed.** It wasn't jitter — arriving on a page long enough to scroll made the scrollbar appear, which stole ~15px of width and reflowed every panel; leaving for a shorter page handed it back. `scrollbar-gutter: stable` on the scroll container reserves the strip permanently so the layout never changes width. Confirmed no horizontal overflow followed (`scrollWidth === clientWidth`, 1150 = 1150) — worth checking, since the largest normalised box (LSU's 840px) is wider than the card it sits on.

typecheck/lint/build clean. Verified live: Roster, Statistics, History (gold), Team Awards.

**Follow-up — the schedule helmet, done properly this time.** The first attempt misread the ask: it made the helmet bigger *inside* the card, so the card grew to fit it. What was wanted was the helmet overhanging the card's top and bottom edges with the card's height unchanged.

That was impossible as long as the helmet was a child, and the reason is worth recording: **`SurfaceCard`'s cut corner is a `clip-path`, which clips every descendant** — `overflow: visible` can't opt out of it. So the helmet is now a **sibling** layered over the card. Card height is driven by its text alone (`min-h` holds it where the helmet used to prop it open); the helmet is absolutely positioned and vertically centred, taking no part in layout, so resizing it moves nothing else on the page.

**Then the art fought back.** Sized to the target directly, the rendered helmet came out ~40% too small. Measuring the alpha bounds explained it: every helmet is a 1024² canvas whose actual artwork occupies only the middle **578×588 — 56% each way, inset 222px** from every edge. So the box has to be ~1.8× the helmet you want to see, and its left edge has to start negative to cancel the baked-in margin. Those constants are documented at the element, since the numbers look arbitrary otherwise.

Result, measured rather than eyeballed: card 194px (its original height), visible helmet 250px, overhanging **26px above and 30px below**. Verified in both themes.

**Follow-up — the shell tightened onto one spacing value.** The chrome was three different gaps: 12px under the header, 16px between sidebar and main, widening to 24px at `md`. So the header looked welded to the body while the two panels drifted apart, and the difference read as dead space rather than rhythm. Now **8px everywhere**, at every breakpoint — window edge to panel, and panel to panel.

The bigger win was structural: the identity strip moved ONTO the title-bar plane, left-justified against the caption buttons, so the bordered header card is gone entirely. The window used to stack two bands of chrome before any content (an empty 36px title-bar reserve, then the header card, then a gap under it); now the reserve IS the header.

Also: the main panel's team-colour left edge went 3px → **1px, matching `SELECTION_BASE`**. Every other stroke in the app is a hairline, so a 3px bar was speaking a different design language than the thing right next to it.

**Verified with `PrintWindow`, not a desktop grab.** A plain screen capture kept returning whatever window was on top (Photoshop, twice) and `SetForegroundWindow` is unreliable when called from a background process — `PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT)` renders the target window directly whether or not it's occluded. Worth remembering for any future frame-level check.

**Follow-up — the wordmark halved.** 36px → 18px. At the old size it was the loudest thing on every screen, competing with the page title directly beneath it. Two knock-on adjustments came with it rather than being left to look wrong: the version stamp dropped 12px → 10px (against a 36px mark it read as a footnote; against an 18px one it started competing with what it annotates), and the bar's own padding tightened `py-3.5` → `py-2.5`, since a 48px band around an 18px mark is mostly air. Checked in both themes.

## Phase — Trading cards, part 1: a card is a row now (schema v12) + the star (2026-07-29)

**The foundation the other four parts stand on.** Before this, a card's state lived in three places and none of them could answer "which cards does this dynasty have?" — the photo was a file at `card-photos/<dynastyId>/<playerId>.<ext>`, the pan/zoom framing was a localStorage key, and the chosen stat labels were another. That is enough to redraw ONE card while you're looking at the player, and not enough for a star, a second card, or a book.

**`player_cards` (migration 12, `schema_v12_player_cards.sql`).** Same family as `player_notes` (v7) and `media_items` (v6): user-authored data kept OUT of `season_snapshots`, so a re-sync never touches a card.

**The one design decision worth arguing about: the display data is FROZEN on the row** (`player_json`, `stats_json`, `season_year`, `team_name`). A card is a printed moment. The book has to show a 2026 freshman card years after that player graduated and left the roster — there is no live `RosterPlayer` to re-render it from, and re-deriving one from the old snapshot would give the player as they *ended* that season, not as the card was made. It costs ~400 bytes a card and it's the difference between the book being possible and not. The modal card still renders live and rewrites those fields on every edit, so a card kept current stays current.

**Given an `id` from the start**, even though part 1 only ever shows one card per player. Part 2 needs it, migrations are append-only, and `ALTER TABLE` on shipped rows to add a primary key is the expensive direction.

**Two invariants live in the DAL, not the schema** (`database/playerCards.ts`): at most one default per (dynasty, player) — promoting demotes the siblings in the same call — and a player with any cards always HAS a default, so deleting the default promotes the next. A partial unique index would only have turned a mistake into a crash.

**Rows are created lazily**, on the first thing the user actually does (a photo, a stat pick, a star) rather than on opening the Card tab, so browsing a roster doesn't quietly mint a card for every player looked at. Until then the tab renders a live draft.

**Legacy state is adopted, not abandoned.** A player with a pre-v12 photo or saved stat picks gets a row built from them the first time the tab opens, and the photo file stays exactly where it already sits — `photo_file` stores whatever the file is actually *called* (a basename, not a path), so old `<playerId>.<ext>` files are adopted in place rather than renamed underneath the user. New photos are card-scoped (`<playerId>-<cardId>.<ext>`) via a new `*ForCard` IPC trio; the four legacy per-player photo channels stay for exactly that adoption path.

**The star is outside the card, and that's load-bearing.** The PNG export clips to the card element's own bounding rect, so anything drawn *inside* has to be hidden for the capture (as the Edit/Export rollover already is). A control placed outside that rect is simply never in the picture — which is what lets it stay visible all the time, and a favourite you can't see isn't much of a favourite. It's a fixed gold rather than `var(--team-secondary)`: the star means the same thing on every card, and half the league's secondary colour is a near-white that reads as "off" even when it's on. Caught in the first capture, where Sac State's cream secondary made a starred card look unstarred.

**Hover now reads the row too.** `PlayerHoverProvider` was pairing the photo file with a localStorage transform — two sources that can disagree. It reads the default card, which carries both, and falls back to the legacy file + localStorage only for a player who has no row yet.

**Verified against a copy of the real archive** in a scratch `CFB_USER_DATA_DIR` (3 dynasties, 5 seasons, 1 media item, and a genuine pre-v12 card photo). Migration applied cleanly: ledger at 12, table and both indexes present, every pre-existing row count unchanged. Then the whole IPC surface exercised through the app's own preload: legacy photo adopted by basename and resolved to a live path; first card auto-defaults and the second doesn't; promoting the second demotes the first; `update` leaves `favorite` alone; deleting the default promotes the survivor; deleting the last card takes its photo file with it (`getPhoto` → null afterwards). Then driven in the real UI — Carson Conklin's Card tab, star clicked, `aria-pressed` false → true and the tooltip flips to "In your card book". typecheck/lint/build clean.

**One thing found and deliberately not fixed** (pre-existing, outside this scope): `dynastyRestore.ts` lists `player_notes.player_id` under the `players` ID space, which re-maps it as if it were a relational `players.id`. It isn't — it's the opaque `PresentationId`, same as `RosterPlayer.id`. Restoring a backup would therefore point notes at the wrong player. `player_cards` is registered only in `STANDALONE_ID_TABLES` (its own `id` gets shifted, `player_id` left alone), which is correct; the notes case is worth a separate look.

## Phase — Trading cards, part 2: more than one card per player (2026-07-29)

**A player can keep several cards now, and one of them is *the* card.** No explainer anywhere, because the shape carries it: the tiles under the big card ARE the cards — real ones, rendered small — clicking one opens it, `+` makes another, and a radio dot marks the one that stands for the player everywhere else. A radio is the right control precisely because it already means "exactly one of these", which is the rule the DAL enforces underneath.

**The thumbnails are scaled, not laid out small.** `PlayerCard`'s type sizes are fixed pixels (a 46px surname), so a 78px-wide container would have produced a full-size name on a postage stamp. `SavedPlayerCardThumb` renders the card at its real 330px width and applies `transform: scale()`, which is also what makes the strip honest — those are the actual cards, not icons standing in for them.

**Strip order is creation order, deliberately not the DAL's.** `setDefault` returns the list re-sorted default-first (right for "which card opens"), and using that order in the strip made the tiles jump out from under the cursor at the exact moment you clicked one. The dot already says which is which without anything moving.

**A file split, forced by the dependency graph.** The tab needs the strip, the strip renders saved cards, and a saved card renders a `PlayerCard` — with the tab living in `PlayerCard.tsx` that is a cycle. `PlayerCardTab` moved to its own module, leaving `PlayerCard.tsx` as the renderer plus `FavoriteStar`. New `SavedPlayerCard` (+ `Thumb`) draws a card from its ROW rather than from live data, which is the thing part 5 is made of.

**One shared team-theme resolver.** `lib/cardTheme.ts` — three components were about to hold their own copy of "fetch the team's colours, cache them, turn them into `--team-*` vars". The hover provider's private cache is gone in favour of it.

**The hover fix that mattered, and it wasn't the one I set out to make.** First pass had hover read the default card's *photo and framing* while still drawing the live player. Verified it and the number came back wrong: with the default card's OVR set to 99 and the other card's to 11, the preview read **73** — the live roster value. It was showing a card the user never made. So the preview now renders the saved default card outright (`SavedPlayerCard`), which is what "the default is what shows on hover" has to mean. Re-verified: **99**. Falls back to a live card only when the player has no saved card at all.

Verified in the app on a copy of the real archive: starring creates card one and the strip appears; `+` makes a second (and opens the editor, since a blank card with no controls showing looks like nothing happened); the second is correctly not the default; promoting it flips both flags in the database, not just the DOM. typecheck/lint/build clean.

## Phase — Trading cards, part 3: the export dialog — and a capture bug it exposed (2026-07-29)

**Turn parts of the card off, then export.** Five toggles — Overall, Name, Profile, Stats, Team logo — over a live preview that IS the thing being saved.

**Built standalone before either caller needed it to be**, because both do: the player modal exports one card, the book exports a selection, and the only difference is the length of the list. Retrofitting a single-card dialog for multi-select afterwards is the more painful direction. Both speak one `ExportableCard` shape, which is also what lets the modal export a card that isn't a saved row yet.

**The dialog draws the card itself rather than photographing one already on the page.** It has to — the book's cards aren't all on screen at capture size, and the modal's card is behind this very dialog. The bonus is that the preview and the PNG are the same element, so what you see is exactly what lands, and the old "hide the rollover overlay for one frame so it doesn't get into the picture" dance is gone.

**One card goes through the save dialog** so the user names the file; **several pick a folder once** and are written into it, never overwriting (a second card of the same player in the same season becomes `(2)`). Twenty cards through a save dialog would be twenty dialogs.

**Layers are `Partial<CardLayers>` with everything defaulting ON**, so every existing call site renders the card exactly as before. The DynastyOS mark and the photo are deliberately not toggleable: the mark is the card's maker's mark, and a card with the photo off is a blank rectangle.

**The name layer uses `display:none`, not a conditional render, and that's on purpose.** Its auto-fit is a `ResizeObserver` on the name box; unmounting the box would leave the observer with nothing to watch and the scale stuck at whatever it last computed. Kept mounted, the observer sees 0 → full height and recomputes. Verified across a round trip: `flex / 340px / scale(1)` → `none / 0` → `flex / 340px / scale(1)`.

### The bug this uncovered, which had nothing to do with the dialog

Exporting the same card twice with a layer flipped between produced **byte-identical PNGs**. Not similar — the same md5. Isolated it to three captures with one checkbox flipped between each, the page's own `textContent` confirming the change every time, and all three files identical to the first.

**`capturePage` returns whatever the compositor last submitted, and a window Windows considers occluded stops submitting.** The page keeps running: React re-renders, rAF fires, the DOM is correct — and the pixels are frozen at the last frame produced while the window was visible. `webContents.invalidate()` did not help, which ruled out "needs a repaint hint" and pointed at the frames not being produced at all.

Fixed with `--disable-features=CalculateNativeWinOcclusion` before app ready. This is **not** a test-harness accommodation: a user who alt-tabs during a twenty-card export would otherwise get twenty copies of card one, with every call reporting success and nothing to suggest anything was wrong. It also affects the single-card export that has been shipping since the card was built — a second export in the same session, after the window had been covered, would have re-saved the first card's image. The cost is a little idle GPU when the window is fully hidden.

`captureRegion()` now wraps both export paths with the invalidate + settle, kept even though it wasn't the fix, since it costs milliseconds and makes the intent explicit at the call site.

**Verified** by writing real PNGs to disk through the production handler: three captures, three distinct hashes matching three DOM states, and the exported image checked by eye — OVR present, stats gone, logo present, exactly as the toggles said. typecheck/lint/build clean.

## Phase — Trading cards, parts 4 & 5: "Coach", and the card book (2026-07-29)

**Nav: "Coach Hub" → "Coach".** One label in `DynastyLayout`. The page's own eyebrow still reads "Coach Hub", which matches what the earlier rename pass did to NCAA Hub — the tabs got short names, the pages kept theirs. Corrected the one sentence in the manual that listed the old tab names.

**A Cards button above Scandals** on the Coach Hub masthead — the two now stack in the same right-hand column. Cards is deliberately NOT coach-gated the way Scandals is: Scandals writes to the save and there's nothing to cheat on behalf of a CPU staff, but a book of your own cards is yours whoever you happen to be coaching.

### The book

Every starred card, a page per season, oldest first. **A new year is a new page** — that's the whole pagination rule, which is why a page label can just be the year. Cards with no season get a `—` page at the end rather than being folded into a year they don't belong to.

**Almost no text, on purpose.** The title, the year on each tab, and the count of what's selected. A book that explains itself in prose is a report about cards rather than a book of them.

**Clicking a card selects it**, because there is nothing else a click could usefully mean here — the cards are already at a readable size and the only action the book offers is export. **Selection carries across pages** so a set can be built from several seasons; **Select all** applies to the page you're on, which is the only scope where "all" is unambiguous. Export hands the selection straight to part 3's dialog.

**Theming, three times now.** The book, the export dialog and the card strip all portal to `<body>`, outside the dynasty container that defines `--team-*` — so every accent (season tabs, selection outline, Export button) came out grey until each got the vars applied explicitly. Worth stating as a rule: **anything portalled that uses a team colour has to carry its own vars.** The cards inside still resolve their own school's, so a card of a player's previous team stays that team's colour inside a book themed to the current one.

### Two bugs found by looking at the output rather than the code

**1. The exported PNGs were screenshots of the whole window.** Four files, four correct filenames, four "success" results — and every one of them was a picture of the app with the export dialog in it. The dialog was passing `getBoundingClientRect()`'s **DOMRect** across IPC. Its `x/y/width/height` are prototype getters, and structured clone carries own enumerable properties, so the main process received `{}`, `Math.round(undefined)` gave NaN, and `capturePage` silently ignored the clip. Now a plain object. Nothing about this was visible from the calling code — the types are satisfied, the call succeeds, and the file is written.

**2.** The stale-frame bug from part 3, which this loop is exactly the shape to be ruined by (twenty cards, twenty copies of card one) — see that entry.

**Verified by running the real export loop**, not a stand-in: four cards selected in the book, the Stats layer switched off in the dialog, and four **distinct**, correctly-cropped 330×496 cards written to disk under `<Player> <Year>.png` with the stat line gone and everything else intact. The loop swaps the preview to each card as it saves, which doubles as the progress indicator and is honest — the card on screen is the one being written.

The folder picker is a native dialog and can't be driven from a verification run, so `pickCardFolder` honours `SCREENSHOT_EXPORT_DIR` when set — same family as the existing `SCREENSHOT_*` hooks in main.ts, and it makes the part most worth testing (the loop behind the picker) testable from here on.

**Also verified:** the nav reads "Coach"; the Cards button sits above Scandals (measured, 371 vs 417); the book pages as 2026 / 2027 / 2028 with 4 / 2 / 1 cards; an unstarred card of a player on the 2027 page is correctly absent; Select all flips to "Clear page" and enables Export; selection survives a page change (4 → 5 after adding one from the next year); and the export dialog opens on top of the book (hit test, not a z-index read).

## Phase — Import and sync: 8.6s → 3.0s, and why (2026-07-29)

Asked to check that importing and syncing a dynasty are as fast as they can be. Profiled the real pipeline against a real save (`DYNASTY-TESTER4`, Texas State 2028) rather than reading the code, which was the right call — the three things that mattered were all invisible from the source.

**Measured, on the user's own 30 MB archive:**

| | before | after |
|---|---|---|
| Import | 8,595 ms | 3,043 ms |
| Sync | 8,102 / 9,782 ms | 2,927 / 2,954 ms |
| Extraction alone | 7,974 ms | 2,482 ms |

### 1. `getTableById` was a linear scan over 2,400 tables, called 316,000 times

The library's implementation is `this.tables.find(t => t.header && t.header.tableId === id)`. That would be unremarkable if it ran occasionally — but it is the innermost operation of the entire extraction. Every reference resolution goes through it (`resolveReferenceWithTable`, and the library's own `getReferencedRecord`), and one import performs **316,095** of them: a single player's per-game stats mean ~23 resolutions, times 16,500 players. A real save holds **2,400 tables**, so that's on the order of a hundred million comparisons per import.

`openFranchiseFile` now wraps the instance with an indexed lookup built once, lazily. Wrapping the instance rather than our own helper is deliberate: it also fixes `getReferencedRecord`, which takes the same path, without reimplementing the library's reference decoding. Misses are memoised too — a null reference decodes to a table id that doesn't exist, and those are common enough that re-scanning for them would give most of the win straight back.

Measured in isolation: the two heaviest traversals went **2,704 ms → 128 ms** and **2,009 ms → 129 ms**. The scan was ~95% of both.

### 2. Five places pulled every attribute of the biggest table in the save

`readRecords()` with no arguments loads every attribute of every row, and `Player` is ~16,500 rows with 100+ attributes: **767 ms**, against **82 ms** for the subset actually used. `extract-league-roster` called it directly, and `preloadAllInstances(franchise, 'Player')` in awards, recruits, national recruits and departures did the same — so the cost was paid by whichever ran first and the rest rode along on the cache. `extract-roster`'s careful 18-field read immediately beforehand was pure waste, superseded one step later.

New `lib/playerFields.ts` holds **one** shared list of every Player attribute the pipeline reads, and `preloadAllInstances` takes an optional attribute list. One list rather than one per call site, because an attribute that isn't loaded doesn't throw — the field simply isn't there, so `Number(...)` yields NaN and `String(...)` yields `"undefined"`, and the wrong value goes into the archive silently.

The write paths (`editorWrite.ts`, `recruitingWrite.ts`) deliberately keep the unrestricted read: they write arbitrary fields back.

**Verified by diffing the whole extraction output** — 22.4 MB of JSON, before and after — which came back **byte-identical (same md5)**. That's the check this change needed: an unloaded attribute shows up as NaN or `"undefined"`, so an identical dump means every field survived.

### 3. A sync rewrote the entire archive ~25 times

`run()` in helpers.ts calls `persist()` after every statement, and `persist()` serialises and rewrites the **whole database file**. Right for a single edit; badly wrong for an import, where `persistExtraction` performs about 25 writes. On the 30 MB archive that was ~1.9 s of persist per sync — roughly 750 MB of file writes for one sync — and it gets worse every season, which is exactly the wrong direction.

New `withBatchedPersist` in init.ts defers the flush and does it once at the end. Nested batches are safe, and the flush is in a `finally` so a bulk operation that throws part-way still writes what landed — the file can't silently drift from the in-memory database. `syncDynasty` wraps the extraction persist and the team-award recalculation in ONE batch, so the awards pass doesn't trigger a second full flush.

**Checked the invariant this could have broken.** `persist()` re-asserts `PRAGMA foreign_keys = ON` because sql.js's `export()` silently resets it — the bug that once stranded 137 MB of orphans. Batching means `export()` runs once instead of 25 times, so enforcement is if anything harder to lose, but it was worth proving: imported, synced, then deleted the dynasty, and the cascade took everything with it — **0 orphans** across seasons, snapshots, cards, notes and media.

**And that the same data still lands.** Ran the identical import+sync sequence on two copies of the real archive, one on each build: identical row counts in every table, and all **38 snapshot payloads for the imported season md5-identical**.

### Not changed

- **`openFranchiseFile` itself is ~450 ms** and is now the single largest item. That's the library parsing a 9.6 MB save; nothing to do about it short of caching parsed files across a session, which would risk serving stale data after the user plays a week.
- **A small bug, found and left alone:** `syncDynasty(undefined)` throws a raw sql.js "tried to bind a value of an unknown type" through IPC as an unhandled rejection, rather than returning the usual `{ success: false }`. Only reachable from a malformed caller (I hit it with a broken test path), so it isn't affecting anyone — noting it rather than widening this pass into error handling.

## Phase — The title bar scrolled away (2026-07-29)

The whole page scrolled, so the title bar left the screen — taking the window's drag region and the Preferences / Manual / About buttons with it. You couldn't move the window or reach settings without scrolling back to the top first.

**The panel was never scrolling.** Measured before touching anything, and the numbers named the bug outright: the document was **6,313px tall in a 900px window**, `document.scrollingElement` scrolled to 2000 happily, the header sat at **top: -2000px** — and there were **zero elements on the page with a scrollable overflow**. The `overflow-y-auto` container the app has always had (the one carrying `scrollbar-gutter: stable`) had `scrollTop` stuck at 0: setting it to 3000 did nothing, because its content had all the room it wanted.

**Cause: `min-h-full` where the shell needed `h-full`.** Two wrappers in `app.tsx` used `min-height: 100%`, which is a floor, not a ceiling — they grew to fit their content. That growth passed straight down: the panel's `h-full` resolved against a parent that was itself 6,313px tall, so the panel was never smaller than its content and never had anything to scroll. The document scrolled instead, and the title bar is inside the document.

Pinned both to `h-full`, plus **`min-h-0` on the two flex items between them** — a flex item defaults to `min-height: auto` and refuses to shrink below its content, which would have handed the panel an unbounded height again regardless of the `h-full` above it. That pair is the whole fix.

**Verified with the same measurement that exposed it**, across six routes (Dashboard, Coach, Roster, Schedule, Statistics, History): header at **top: 0** on every one, document **not scrollable** on any, and exactly **one** vertical scroller per content page — the panel — which now actually scrolls. Confirmed by capture at 2,500px down: wordmark, version, build stamp and all three tool icons still there, sidebar still there.

**Three things checked because this class of change breaks them:**
- **The chrome still works while scrolled** — the gear button hit-tests to itself at its own coordinates, and the header still computes `-webkit-app-region: drag`, so dragging the window works at any scroll position.
- **Modals** — the page behind no longer scrolls where `useScrollLock` expected the *body* to be the scroller. A wheel over the backdrop leaves the panel exactly where it was (1200 → 1200), because a portalled modal's ancestors are `body`/`html` and neither scrolls now. Position survives open and close, and the lock releases.
- **Horizontal scrolling is untouched.** Roster / Schedule / History each still report their own horizontal scroll container — those tables scroll sideways by design, and the earlier `scrollbar-gutter` work's "no horizontal overflow on the panel" property still holds.

## Phase — Card follow-ups: a team column, icon controls, and a browsable book (2026-07-29)

Three changes off the back of using the card system for real.

### Career: which school, that season

Season-by-season now reads **Season · Team · Class · Pos · …**, the team as its own logo column. Players move, and a career table without it quietly implies one program for the whole run.

**No new data needed.** `getPlayerDevelopment` already resolves each season from the LEAGUE-wide roster snapshot — which is exactly "whichever school they were actually at that year" — and the profile already had it loaded for the OVR chart. The table just takes a `seasonYear → teamName` map off it.

The mark alone, with the school as the title: the row is already eleven columns wide, and a logo is the faster read at a glance, which is what a career snapshot is for.

**Verified on the case that motivates the column** — the archive holds a real transfer, **Amarion Atwood: Texas State 2026 → UConn 2027**. Header order confirmed in the DOM (`Season, Team, Class, Pos, GP, …`) and the cell renders a real asset (`TexasState_OD.webp`).

### The card's controls are icons now

The centred **Edit | Export** pills are gone, replaced by the app's own pencil and export glyphs tucked into the card's bottom-right.

Two reasons, and the second is the one that mattered: words in the middle of the artwork read as a dialog laid over the card rather than controls belonging to it — and the centred pills needed a **full-card scrim** to stay legible, which meant the one moment you're looking hardest at the art was the moment it was dimmed. The scrim is gone entirely.

**They're the app's icons, made literally so.** The pencil, export and bin glyphs existed as four private copies across CoachCard, Dashboard and Media. New `ActionIcons.tsx` holds one of each and those three now import it — otherwise "the icon we use throughout the app" would have become a fourth lookalike.

**Placement took a second pass.** At `p-3` the pill sat a few pixels inside the team logo and the gold mark poked out from behind it, which looked like a collision. `p-4` matches the bottom band's own padding so the pill's edges land on the logo's, and at 44px it covers the 48px mark almost exactly — it reads as replacing it while you hover instead of sitting on top of it. Caught by looking at the capture, not by reading the CSS.

### The book is browsable, and selecting is a mode

**A click opens the card.** It expands into its own portalled overlay at 380px (against 220px on the page), with **← / →** stepping through the page and Escape closing just the expanded card, not the book under it. Its own `ModalOverlay` rather than something drawn inside the book, because the book is a panel with a max width and its own scroll — a card blown up inside it would be constrained by both — and portalling also gets it the layer above the book for free.

**One click can't mean two things**, so selecting is now a mode. **Select** switches clicks over to picking; **Export** and **Delete** appear only once at least one card is chosen, as icons where the old Export button sat, and are simply absent otherwise rather than sitting there greyed out. Leaving the mode drops the selection — a set you can no longer see isn't a set you meant to keep.

Delete is new, and it confirms first (it destroys the card row and any photo on it, permanently) — the confirm says plainly that the players are untouched and only the cards go.

`SavedPlayerCardThumb` → **`ScaledSavedPlayerCard`**: it now renders at 78px in the strip, 220px on a page and 380px expanded, and a component called "Thumb" driving a hero-sized card is exactly the kind of drift that misleads later.

**Verified by driving it:** default toolbar is Select alone (no Export); a click expands to 380 vs 220 and selects nothing; arrows walk 1/4 → 2/4 → 1/4; Escape closes the expanded card and leaves the book open; Select flips the button to Done and makes clicks select; Export and Delete icons appear with a selection; Done clears it. Captures confirm both states. typecheck/lint/build clean.

---

## Phase — v2.2.0 packaged: slim app only (2026-07-29)

Version checkpoint over this session's work (trading cards, the card book, the import/sync speed-up, the masthead + sticky title bar). `package.json` **2.0.0 → 2.2.0** at the user's call — 2.1 is skipped, which is fine: the version only has to move forward, and `app.getVersion()` plus the electron-builder exe names are the only things reading it.

**The lockfile was stale at 1.6.0.** `package-lock.json` still carried `1.6.0` in both places it records the root package's own version — the 2.0.0 bump never reached it. Both are now 2.2.0. Nothing installs differently either way, but a lockfile that disagrees with the manifest is the kind of thing that gets believed later.

**Slim app only, per the request and the shipping model.** `SLIM_INSTALLER=1 npm run package` — media excluded, served over `cfbmedia://` from the user's external folder. Nothing else was rebuilt: the **Image Data 2.0.0** pack (972 MB) and the standalone **Coach Polos 2.0.0** installer are unchanged because no bundled artwork changed this session, so existing users update the app and keep the library they already have.

Artifacts in `release/`:
- `DynastyOS Setup 2.2.0.exe` — 147.2 MB (NSIS installer)
- `DynastyOS 2.2.0.exe` — 146.9 MB (portable)

**Slim was verified from the output, not from the flag.** `release/win-unpacked/resources/` holds `app.asar` alone at 100.5 MB with **no `app.asar.unpacked/`** — which is the proof: in a COMPLETE build the media globs are `asarUnpack`ed, so that folder exists and carries all 25,527 portraits. This is the check the v2.0 mistake needed (COMPLETE produced a 1.12 GB installer before it was caught by the size).

The in-app manual is version-stamped by webpack's `__VERSION__` transform, so it came out of this build reading v2.2.0 on its own. The standalone PDF is generated separately and was regenerated (`docs/manual/DynastyOS - User Manual.pdf`, 436 KB, v2.2.0) so the repo copy doesn't sit a release behind. **Gotcha for next time:** the agent shell has `ELECTRON_RUN_AS_NODE=1` set, which makes `npm run manual` fail with `Cannot read properties of undefined (reading 'whenReady')` — Electron starts in node mode and there is no `app`. `unset ELECTRON_RUN_AS_NODE` first; nothing is wrong with the script.

`npm run typecheck` clean before packaging. Not committed or tagged — the session's feature work is still uncommitted on `feature/force-commit-and-hub-refactor`, and no consumer release notes were written for 2.2 yet.

---

## Phase — The glider: one nav indicator, and the filled tab is gone (2026-07-29)

The user brought a menu style (`UI/RadioMenu.md`) and asked how realistic it was to adopt: a hairline rail with a lit segment that slides to the active item, the line along the **bottom** for the horizontal menus rather than the side, in our colour system, themed, and working in both light and dark. Answer: realistic, and now shipped across every nav row — but almost none of the reference's *mechanism* survived.

### The reference is pure CSS. It couldn't be.

That CSS drives everything off radio inputs (`input:nth-of-type(n):checked ~ .glider-container`), a hand-maintained `--total-radio`, and a glider sized `100% / --total-radio` moved by `translate(n * 100%)`. Three problems, and the third is fatal: our items are router anchors (they stay anchors — routing, keyboard, middle-click), the sidebar's list is data-driven, and **the fixed fraction assumes every item is the same size**. Our tabs are words of different lengths and the sidebar has two row heights, so a fractional glider could never sit under the active item.

So the look stayed CSS and only the geometry moved into JS: `GliderNav` measures the active child and pushes `--glider-offset` / `--glider-size` / `--glider-cross`; the stylesheet does the rest. Variable-width items and dynamic lists come free, and `--glider-cross` means a *wrapped* tab bar underlines the active tab's own row instead of the last one.

### Light and dark are different treatments, not one with a swapped colour

Dark gets the reference's full read: gold segment, blurred bloom, wash rising into the tab. Gold rather than team colour because the ground is pure black — a navy or maroon segment sinks into it — and gold is already the dark-mode selection accent, so it doesn't fight the team colours the page is themed in. Light **drops the bloom entirely**: `filter: blur()` reads as light emission, which is meaningless on a white page and lands as a smudge. The label uses `--team-accent-text` (the contrast-corrected form) — a raw maize or navy is unreadable at this size.

Two things only the captures could have told us:

- **The segment needed a solid core.** The reference fades across its whole length, which works there because the bloom carries the brightness. With no bloom (light mode, and the quiet sub-nav in both), a fully-faded 1–2px line has almost no ink left in it and the active tab stopped reading as active. Now it fades only at its ends (`--glider-core: 22%`).
- **Light keeps the quiet sub-nav at 2px**; only dark thins it to 1px. Gold on black carries at a hairline; a team colour on a light ground doesn't.

### A 1px bloom overhang raised two scrollbars

The sub-nav came out with **both** scrollbars on a six-tab row that fits its space with room to spare. Measured rather than guessed: `clientWidth 496 === scrollWidth 496` but `clientHeight 32` vs `scrollHeight 33`. The bloom was centred on the segment, so ~1px of its box sat below the nav row — and because `overflow-x: auto` forces the y axis to `auto` too, that 1px of scrollable overflow was enough to raise the vertical bar, which then narrowed the box and raised the horizontal one. Anchoring the bloom to the segment's bottom edge and growing it upward fixed it (`ch 32 === sh 32`), and spilling upward is the truer read for a bottom rail anyway. The vertical orientation had the mirror-image bug against the sidebar's own scroller.

### What changed, and what deliberately didn't

Converted: the section bar (`DynastyLayout`, bloomed), the Team Hub / NCAA Hub / Recruit Hub sub-navs (quiet), the player-profile modal's ten tabs, and the sidebar (vertical). The filled team-colour tab and its cut corner are gone from all of them; the cut corner still marks cards and panels, so the shape signature is intact.

**Mode switches keep the fill** — `SegmentedControl` and PairLayout's toggle are untouched, at the user's call. They change a view, not a page, and the difference in treatment is what tells you which one you're touching. The hierarchy between the two stacked nav rows is the same reasoning: both bloomed would have put two competing light sources ~10px apart.

Structural notes: the hub sub-navs lost their bordered, filled strip (the rail groups the tabs now; a box as well read as two frames), `overflow-x-auto` moved to a wrapper *around* GliderNav so the rail scrolls with the tabs, the sidebar's dynasty rows are a flat list carrying their own indent (a nested wrapper would be one child holding many rows, and the indicator could no longer find them), and their old `border-l` is gone because the glider's rail is that line. `matchTabIndex` reproduces NavLink's matching rule once, since a positional glider needs to know *which* link won — and returns -1 for no match, which hides the glider rather than parking it on tab 0. Same for a collapsed sidebar: the active dynasty's row isn't on screen, so nothing is marked.

`lib/selectionClass.ts` is now unreferenced (the sidebar was its last consumer) and is kept, annotated, as the non-navigation selection contract.

**Verified by capture in both themes** — section bar and sub-nav in dark (bloom + gold labels) and light (maroon core + wash), the glider tracking `roster` → **Team** and `statistics` → **Statistics** and `standings` → **Standings** (positional matching working off the real routes), the 8-tab NCAA row with no scrollbars, the modal's tab rail replacing its old `border-b`, and the sidebar spine on the active dynasty in both themes. Evidence in `Productivity/screenshots/glider-nav-{dark,light,modal-tabs}-2026-07-29.png`. Recruit Hub wasn't captured individually — it's the same component with the same props as the NCAA row. typecheck/lint/build clean. **Not released:** this is on top of the 2.2.0 build, which predates it.

---

## Phase — Sections aren't boxes any more (2026-07-29)

User direction, straight after the glider: the page's main sections (Coach Profile, Contract, Career Record, Current Coaching Staff) each sat in a bordered box; drop the borders and put **a thin horizontal rule between sections instead**. Goal stated plainly — move away from a boxy look.

**One component, ~240 call sites.** `SurfaceCard` is the section container across 29 files, so the border came off there rather than page by page. `overlay` keeps its border: it's the modal-grade panel, floating over a scrim rather than sitting in page flow, and without an edge it bleeds into whatever is behind it.

### Why the divider selects on the PARENT's class

The rule is `[class*='space-y-'] > .surface-card + .surface-card::before`. A plain `.surface-card + .surface-card` would have drawn a line above the right-hand card of every side-by-side pair — Recent Games | Upcoming Games, the awards pairs — because those are adjacent siblings too. In this codebase a vertical stack is always a `space-y-*` container and a row is always a `grid`/`flex` + `gap-*` one, so the parent's own class is the honest signal, and it needs no per-page opt-in across ~30 files. Verified on Team Hub: the Recent/Upcoming pair has no line between them, the stacked sections above and below do.

The line sits **on** the lower section's top edge rather than floating in the gap, because `.corner-cut` is a clip-path and clip-path clips pseudo-elements too — anything drawn outside the card's own box is simply not painted.

### Light mode had two more layers drawing the box

Removing the border fixed dark immediately (its surface is `#000` on a `#000` ground, so the border *was* the box). Light still looked identical, and the captures showed why — two separate opaque layers underneath:

1. `--surface-primary` was a near-white fill. A white block on the light grey ground reads as a framed card with no frame on it. Now `transparent`, so a section sits on the page the way it already did in dark.
2. **`GRADIENT_SURFACE` was still painting the panel** — in light it's an opaque `white → slate-50` wash on its own layer inside every card (dark carries none, which is why dark looked right and light didn't). It's now skipped for `primary` and kept for `raised`/`overlay`, which are meant to read as lifted paper.

That second one is worth remembering: the fill and the border were the obvious suspects, and neither was the whole answer — a third layer was doing the work, and only looking at the light capture after fixing the first two showed it.

**One caller changed with it.** The hero award card used a team-coloured *border* to stand out (`TeamAwards`); it now uses a faint team wash instead — same signal, no frame.

**Verified in both themes** on Coach Hub (all four sections the user named, hairlines between each) and Team Hub (the grid pair correctly untouched). Evidence in `Productivity/screenshots/sections-borderless-{dark,light}-2026-07-29.png`. typecheck/lint/build clean.

**Still bordered, deliberately, and easy to take next if wanted:** the top nav card and the sidebar panel (app chrome, not sections), `StatTile` and the small in-card data tiles, table containers, and modal panels. The page mastheads (`raised`) lost their border but keep their paper fill in light mode.

---

## Phase — Program → Overview: everything lines up (2026-07-29)

Seven asks off a screenshot of Team Hub → Overview, all of them alignment or hierarchy.

**The record banner was inside the masthead card.** That's why it didn't line up with the stat tiles: it inherited the card's `p-5`, so it sat 20px inside them on both edges — the one block on the page that shared an edge with nothing. It's now a sibling of the masthead, spanning the same column as everything else. It also lost `rounded-xl` for the signature cut corner (it was the last rounded surface on the page, sitting directly above cut-corner tiles) and the drop-shadow with it, since clip-path clips box-shadow.

**The deeper cause, though, was `SurfaceCard`'s side padding.** While sections were boxes, `p-5` was the inset from the box's edge. With the box gone (previous phase) it just pushed every section's content 20px right of every grid that ISN'T a section — the tile rows, the game pair — so nothing on any page shared a left edge. `primary` is now `py-5`: vertical padding is the section's rhythm, horizontal padding was its frame. `raised`/`overlay` keep theirs, since those still paint a panel and text shouldn't run to its edge. That one change is what makes the user's "every page should be aligned visually" true beyond this page.

**The masthead mark now uses PageMasthead's own slot and geometry** rather than the plain 128px `TeamLogo` it had — visibly smaller than every other team page's mark. It borrows `MASTHEAD_ART_SLOT` + `markGeometry` instead of just picking a bigger number, because the art floats inside a much larger transparent canvas and fills a different fraction of it per school (a 3.19× spread): matching by raw box size would leave Auburn and Texas State at different heights. `slotLeft: 0`, since here the slot *is* the element rather than a position inside a wider card.

**Program Budget** moved onto the coach line by making the header row `items-end` — it now aligns with the bottom of the identity block instead of floating at the centre of a header whose height is set by the mark.

**The tile rows were two grids.** Six tiles in one, the three season-high tiles in another, so the gap above the third row was the page's 24px section spacing while the rows inside each grid were 12px apart — which is exactly the "further down" the user saw. One grid now, the season-high tiles as a conditional fragment inside it, so all nine rows share one gap.

**Recent | Upcoming** are split by a real 1px grid column (`xl:grid-cols-[1fr_1px_1fr]`) rather than a border on either card, so the rule sits centred in the gap and spans the taller side — and it collapses with the columns at narrow widths, where the cards stack and a vertical rule would mean nothing. A `SectionRule` closes the pair off above Top Players, which is where the automatic card-to-card divider can't reach (a grid sits between them).

**Top players is Offense | Defense**, not one top-ten wrapped into two columns. A straight top-10 is usually lopsided — a good team's ten best are often seven offensive players — so the reader can't see their defense at all. `limit` still means the total, so callers passing 10 get five a side. Special-teams players appear in neither column: a third unit with two spots would leave a column mostly empty.

All of it landed in **both** views — the user's own hub and a browsed league team — because the header, banner and games pair were extracted into shared local components rather than edited twice in a file that already had them duplicated. **Verified by capture on both** (Texas State and Akron), which also confirmed the league branch still renders after the refactor. typecheck/lint/build clean. Evidence: `Productivity/screenshots/overview-alignment-pass-2026-07-29.png`, `overview-league-team-2026-07-29.png`.

---

## Phase — Coach tab rework, and the AD expectations that ARE in the save (2026-07-29)

A batch of Coach Hub changes, plus one real research question: the page carried a note saying AD-goal expectations "aren't exposed as readable targets in the save data," and the user asked for three AD Expectation boxes anyway, pointing at the in-game screen. That note was **half wrong**, and finding out which half took the save apart.

### What the save actually holds

Searched a save's 1,368 table names for goal/expectation/objective, then chased the hits. `UserCoachSeasonalGoal`, `ObjectiveProgress`, `PersonaGoalTracker` are all EMPTY — including in **DYNASTY-JMUTESTER**, the save behind the screenshot the user supplied, which is the check that mattered (per the data-absence discipline: go to the save that actually has the feature on screen, not a convenient one).

The data is in two places:

- **The Coach record** carries `CurrentContractExpectation` (`Win8Games` — a readable AD expectation), `CurrentJobSecurityPercentage` (**98**, the exact number on the user's screenshot, which is what confirms these are the right fields), `SeasonStartJobSecurityStatus`, `EarnedContractPoints_ThisYear`, and `CoachPoints`.
- **Three `CoachContractGoalSummaryEntry` tables** — one goal each, and note they're three separate single-row TABLES, not three rows in one, so the extractor reads every instance rather than the largest. Each holds `StatusGoal`, `ProgressGoal`, `IsHotSeat`, `JobSecurity`, and a reference to the goal itself.

### What it does NOT hold, and how that was settled

The goal wording and rewards ("Make a Bowl Game in the next 4 seasons", 100 coach points) are **not in the dynasty file**. Each slot's `CoachContractGoal` reference points at **table 16483**, and this save's tables run **4096–6385** — the catalogue ships with the game. A raw byte scan of the save for the goal text returns nothing either. Two saves agree on the shape, and one goal id (118389) appears in both, so the ids are stable catalogue rows rather than per-dynasty text.

So a slot can honestly say it's live and how far along it is. It cannot say what it asks for. The three boxes are built on that: status per slot, with the readable pieces — the headline expectation and the job-security percentage — as chips beneath.

### The rest of the batch

**Masthead:** "Coach Hub" → "Coach", "Cards" → "Cardbook", and the standing job-security line is gone from the hero — it lives in the Contract section now, beside the AD's evaluation, which is the one place it means something. The "fired N times" note moved with it.

**Contract:** the "School — Position" heading is gone (the masthead already says both), as are the Contract year, Contract length and Job security tiles and the explanatory paragraph. What's left is the 2×2 the user specified — Years remaining | AD expectation 1, AD expectation 2 | AD expectation 3 — with the evaluation chip joined by a status chip (`Safe · 98%`) and an expectation chip (`Win 8 games`).

**Career record** lost Prestige gains. **Staff** is now "2026 Coaching Staff", and its grid takes its column count from the staff size — two coordinators in a three-column grid left a third of the row empty, which read as a missing card rather than a layout.

**Coordinators are judged on their own unit now.** The card used to show the team's conference record and the imported-season range — the head coach's number, and an artefact of the app's sync history. An OC shows offensive yards and points per game; a DC shows yards and points allowed. Yardage comes off the team-stats snapshot, scoring off the schedule (the snapshot carries yards but not points), and the average divides by games actually played. Driven by POSITION rather than by whether the numbers exist yet, so a week-0 coordinator reads "Off. yards —" instead of falling back to the head coach's record. "2 imported seasons on staff" → "1st year with Texas State", and the "Imported Resume" label is gone.

**Verified end to end on two dynasties.** The JMU save was re-imported through the new extractor and the real IPC returned `jsPct: 98`, `exp: Win8Games`, and three goal slots (ids 118389/118383/118379, all InProgress) — then rendered. Texas State (a full 13-game season) confirmed the coordinator numbers: 425.5 yds/g and 26.9 pts/g on offence, 378.7 and 24.1 allowed. typecheck/lint/build clean. **Existing seasons need a re-sync** for the new coach fields; they read "Not available" until then.

---

## Phase — The AD-goal text isn't reachable, and the tiles came back out (2026-07-29)

Follow-up to the Coach tab rework. The user asked, fairly: *are you not able to find the text for the expectations?* — and sent a second in-game shot (Auburn, Alex Golesh: "Maintain National Powerhouse Facilities for the next 3 seasons" 1,000 · "Beat Alabama" 200, failed · "Have 15 or fewer Turnovers on Offense this season" 50, passed).

**The answer is no, and it's now a finding rather than a shrug.** The save side was already settled: each goal slot references table 16483 while a dynasty file's tables run 4096–6385. This pass checked the other half — the game itself, at `D:\Arcade\EA SPORTS College Football 27` (found via the uninstall registry, not guessed). Scanned `CollegeFB27.exe` (238 MB) and 14 Frostbite `.cas` archives, the English localisation bundle included, for `Turnovers on Offense`, `Beat Alabama`, `Ring of Honor`, `Conference Competitor` and `School Demeanor`, in ASCII **and** UTF-16. Zero hits, and the exe was scanned twice by two different methods to be sure.

That's the expected result once you look at what it is: Frostbite keeps those strings in Oodle-compressed chunks, so reading them means parsing the `.toc`/`.sb` layout and decompressing the EBX payloads — a Frosty-Toolsuite-class extractor, not a lookup. The only lighter route is a hand-built id→text catalogue seeded from screenshots; the two shots so far pin five ids (JMU 118389/118383/118379, Auburn 118390/118389/118453, with 118389 shared).

**So the three AD tiles came back out, same day they went in** — the user's call and the right one. A tile reading "Passed" beside no question is a verdict on something the page can't show. Years remaining now sits next to **Coach points** (a real, readable number rather than a lone tile in an otherwise empty row), and the chips are the AD's evaluation plus the standing status: `Exceeding expectations` · `Safe · 98%`.

**The "Expectation · Win 8 games" chip went too.** Worth its own line, because it was subtly wrong rather than merely redundant: `CurrentContractExpectation` is a WIN-COUNT enum, while the game's own AD screen states a TIER ("Conference Competitor", "Conference Contender"). The chip claimed to be the AD's expectation while saying something that screen never says.

Everything stays extracted — the goal slots, the expectation enum, job-security percentage, coach points. If the catalogue ever becomes readable, the tiles are a render change and nothing else. typecheck/lint/build clean.

---

## Phase — "2nd year with Auburn" in both 2026 and 2027 (2026-07-29)

The tenure line on the staff cards didn't advance between seasons. It was `seasonsWithTeam + 1`, straight off the save.

**Measured rather than guessed, on a full Auburn cycle** (`DYNASTY-AUBURNW0` → `W22SEASONRECAP` → `W30ENDSEASON` → `W31SEASON2W0`):

| save | Gordon | Durkin |
|---|---|---|
| 2026 PreSeason wk0 | 0 | 2 |
| 2026 OffSeason wk0 | 1 | 3 |
| 2027 PreSeason wk0 | **1** | **3** |

So `SeasonsWithTeam` counts **completed** seasons, and it bumps during the OFFSEASON OF THE SEASON IT BELONGS TO — not at the next season's start. `+ 1` is therefore right for a season synced while it's being played, one too high for that same season synced after its offseason, and the next season repeats the number. Which is precisely what was reported.

**Reproduced the user's case end to end** rather than reasoning about it: imported the post-offseason 2026 save, then copied the 2027 save over the same path and synced — the way a real dynasty advances. Both seasons came back carrying identical counters (`Gordon:1`, `Durkin:3`), so both rendered "2nd year" and "4th year".

**The fix estimates the coach's FIRST year here instead of trusting the counter.** Each observation gives `year - seasonsWithTeam`, and the LATEST estimate wins: an in-season observation yields the true first year, a post-offseason one yields a year too early, and the maximum throws the too-early answer away as soon as any single in-season observation exists — which one more synced season almost always supplies. Tenure is then arithmetic against the season on screen, so it cannot fail to advance. With one season, synced post-offseason, and nothing to cross-check, it still reads one high — the same answer as before, never worse.

**A first attempt was wrong and got replaced before it shipped.** It anchored on the EARLIEST observation's counter and counted observed seasons forward — which breaks in exactly the reported case, because the earliest observation is the post-offseason one carrying the inflated value. Writing out the arithmetic against the measured table is what caught it.

**Verified on both seasons of the reproduced dynasty:** 2026 renders "1st year with Auburn" / "3rd year with Auburn", 2027 renders "2nd" / "4th" — counting up, and matching the ground truth in the saves (Gordon's first Auburn year is 2026, Durkin's 2024). The user coach's masthead line had the identical bug and got the same helper. typecheck/lint/build clean.

**Addendum (same day):** the masthead's Cardbook / Scandals buttons were different widths — the column was `items-end`, so each sized to its own label. Now `items-stretch`, so both take the column's width (the wider label's) and stay matched if a label ever changes, rather than being pinned to a hardcoded width. Measured after: both 100×38.

---

## Research — Why a year-shifted mod save reads empty (DYNASTY-FL2007) (2026-07-29)

No code changed. A user-supplied save from a 2007 conversion mod (rosters, coaches, recruits all replaced) imported with no games and no stats. This is the investigation, kept because the fix is a decision, not an obvious follow-up.

### One number, and it isn't the mod's data

```
                     FL2007      normal save (AUBURNW10)
CurrentSeasonYear    2007        2026
BaseCalendarYear     2026        2026
index the app computes  -19      0
index the DATA uses      0       0
```

Every year-scoped extractor resolves its season as `CurrentSeasonYear − BaseCalendarYear` and matches that against each record's own 0-based index. The mod moved the displayed year and left the base, so the app hunts for season −19 while all 926 `SeasonGame` rows (861 with scores) and every sampled player's `SEAS_YEAR` slot sit at 0. Nothing matches, so nothing is written — the emptiness is in the SNAPSHOTS, not in a filter at read time, which is why it can't be fixed by toggling something at display time.

**Measured by importing into a throwaway profile:** schedule 0 games, game log 0, player stats 50 rows with **every** `season` line null. What survived: school/coach identity, the 2007 label, a 10-1 record, team stats (6,590 yards), 70-man roster, 3 coaches, 138 league teams. Team stats live because `TeamSeasonStats` is read by ARRAY SLOT, not by year — which is exactly why the page shows a record with no games behind it.

### Both candidate fixes were tested, on copies

**A — set `BaseCalendarYear` to 2007 in the save** (edited a copy; the user's file's checksum is unchanged). Full recovery: 13 games / 12 played, 50 of 50 stat lines populated, 35,494 box-score rows, history "2007: 10-1", CFP Quarterfinal appearance.

**B — app-side: override the index, leave the base alone** (temporary patch to `extract-all.ts`, since reverted and `dist/` rebuilt clean). **Identical on every measurable surface.**

### The prediction that was wrong, and the one that survived

I expected B to mislabel the History page as 2026. It doesn't — that page reads the app's own `seasons` table, which stores 2007 from `CurrentSeasonYear`. Never at risk.

The real gap is elsewhere and is currently INVISIBLE: `extractAll` matches league-history years (labelled `baseCalendarYear + PeriodIndex`) against `league.seasonYear` to find the current year's summary. FL2007 holds exactly one `YearSummary` row, `PeriodIndex 0`, **undecided** (no winning coach — it's week 13), and the extractor drops undecided years. So league history is empty under BOTH options, which is why they tied. Once a season completes, A labels that row 2007 and matches; B labels it 2026 and never matches — losing conference-champion trophies and the BEST_HC/BEST_AC coach awards, and reading 2026, 2027… for any backfilled league-history years.

**So if we ever do the app-side fix: normalise the BASE YEAR, not the index.** Derive one value at extraction — when the computed index isn't present in the data, treat the base as `CurrentSeasonYear − dataIndex` — and feed it to the six year-scoped extractors *and* `extractLeagueHistory`. That makes it exactly equivalent to editing the save, with no residual gap, and needs no user-facing toggle: a normal save derives the base it already has, so non-mod users are unaffected by construction.

### Where a toggle would have had to live (if we'd wanted one)

Extraction runs in the MAIN process, so renderer preferences are invisible to it; it would need a column on `dynasties` (append-only migration, the pattern `schema_v9` used for `finalized`) set at import. And because the decision bakes into the snapshots, flipping it later means a **re-sync** of that dynasty — cheap, since `save_path` is stored, but note `finalized` seasons refuse overwrites outside the finalize window.

### Chosen direction (2026-07-29): ask the mod author

Cleanest, because it fixes the file for every tool, not just ours. The rule to give him is **shift `BaseCalendarYear` by the same delta as `CurrentSeasonYear`** — not "set base = current". They coincide only on a fresh dynasty (index 0); on one already two seasons in, setting them equal would zero the index and break it the other way.

**Not tested, and flagged to him:** whether the game itself is happy with a shifted `BaseCalendarYear` (class years, recruiting, in-game history screens). We only verified our own read path.

**Gap that leaves:** a mod-side fix only helps saves made after it ships. Existing 2007 dynasties keep failing, and today they fail confusingly — a 10-1 record with zero games looks like our bug. The cheap insurance is a detection + message at import, not the toggle: no schema, no setting, and it covers any other mod that does this later.

---

## Phase — The dropdown, wave 1: a listbox that moves like the sidebar (2026-07-29)

User brought a reference (`UI/Dropdown.md`) and asked for it app-wide: premium feel, artwork left of the names, team logos for team switching, logo · team · year for seasons, plain labels elsewhere. Their constraints: our motion and shape language, snug sizing, no rounded corners, **black on dark / white on light**, team colour on light, **no check mark**, and — the line that shaped the whole thing — *"make it feel fluid like our side menu selector."*

### Why none of this could be a restyle

All 49 dropdowns were native `<select>`s, and a native popup is drawn by WINDOWS, not by the page: no artwork in the rows, no panel styling, no motion, and a highlight colour we don't own. The reference isn't a select either — it's `<el-select>` from Tailwind Plus, a licensed library pulled from a CDN. The user doesn't have that licence and the app runs offline, so neither the runtime nor the markup came across; what transferred was the *pattern*, written as our own component.

**The highlight is the glider.** Taking "fluid like our side menu selector" literally, the panel reuses `GliderNav` (vertical) rather than painting a filled row: the lit segment slides between rows as you arrow or hover, at the app's own ease. A dropdown that moves like the sidebar belongs to this app — a blue filled row is a component from somewhere else. `GliderNav` gained one optional prop for it (`itemsRole="listbox"`), because a dropdown's rows are `option`s and their container has to be the `listbox`; without that the glider's own wrapper would have quietly broken the required ARIA pairing.

Everything native gave away for free is re-implemented deliberately: arrows, Home/End, Enter, Escape, type-ahead, focus return to the trigger, and scrolling the active row into view. **That is the real cost of leaving `<select>`** — and losing it is how this kind of change ends up prettier and worse.

### Two bugs the captures caught, both about width

The panel is WIDER than its trigger (search field, logos, long school names), so left-aligning it blindly pushed it off screen — and both switchers live at the right edge. The clamp took two attempts:

1. **It measured a panel that didn't exist.** On the first open `rect` is null, so nothing is rendered; a one-shot effect measured nothing and never re-ran. Fixed by making placement a dependency (`isPlaced`).
2. **It measured too early.** The width settles a beat later — the search field, the scrollbar arriving on a 138-team list — so the clamp used a stale number and the panel sat flush against the window edge anyway (measured: `gapFromEdge: 0`). Now a **ResizeObserver** watches the panel, which also keeps it honest while the list FILTERS and rows come and go. Measured after: `left 1167, right 1392, gapFromEdge 8`.

Neither was visible in the code; both came from measuring the rendered result.

### Depth, and the shortcut that would have fought it

The panel takes its z-index from `useModalLayer` — the app's depth-on-open stack — rather than a fixed value. That's deliberate groundwork: wave 3 converts 12 selects inside `PlayerEditorModal`, and depth-on-open means a dropdown opened inside a modal automatically sits above it.

`TeamSwitcher`'s **Shift + ← / →** shortcut had to learn about it too. It skips keystrokes aimed at inputs by tag name, which can't see this: the trigger is a `button` and the panel is portalled to `<body>`. Without the new `[role="listbox"]` check, Shift+Arrow would change the team behind the list you're reading.

### The harness had to be taught the new dropdown

`SCREENSHOT_SELECT_VALUE` drove `HTMLSelectElement.prototype` directly — the hook I use to verify anything season- or team-scoped (it's how the coach-tenure fix was checked hours ago). Converting these switchers would have silently cost me that. It now falls back for a custom select: click the trigger, wait for the panel, click `[data-select-option="…"]`. **Verified end to end** — `[data-select-root="Season"]::1` switched the page to 2026 and the tenure lines read 1st/3rd year, matching the earlier fix.

### Shipped in wave 1

`ui/Select.tsx`, plus the two switchers the user named. Team switcher: logo per school, **type-to-filter** (typing "ala" → Alabama, South Alabama), 138 rows mounted only while open. Season switcher: logo · team · year, with the year in the trailing slot so school names stay a readable left-aligned column. Verified in both themes — black panel on dark with the gold segment, white panel on light with the team accent, 8px off the window edge, cut corner, no rounded anything. typecheck/lint/build clean.

**Still native: 47 selects.** Wave 2 is the page filters (Roster, Statistics, the National pages, Media, Standings, Scores, AllTeams); wave 3 the editors (`PlayerEditorModal` alone has 12, plus Scandals and PortraitPicker), which is where the modal-layering groundwork pays off.

---

## Phase — Dropdown wave 2: the page filters, and a lighter edge (2026-07-29)

**The border first.** Panel, trigger and the search field's rule now all use `--section-divider` — the same hairline that separates sections — instead of a slate step. A panel floating over the page shouldn't announce itself with a heavier frame than the page's own dividing lines; at divider weight it reads as part of the same drawing. The hover state came down with it, to a 55% team-colour mix rather than the full accent.

**Then the filters.** Converted in this pass: Roster (4), Statistics (2), Standings, Scores, NCAA Hub team picker, Media (2), All-America teams (4), National Players (6), National Recruits (5) — **26 dropdowns across 9 files**.

Three things the sweep turned up rather than the plan predicting:

- **`disabled` had to exist.** Media's batch "Set game" control is disabled until something is selected — the primitive had no such prop, so it gained one (plus the matching cursor/opacity treatment). A native select gave that away for free.
- **A `<label>` can't wrap the new control.** Media had `<label>Set game <select/></label>`; a label wrapping a BUTTON doesn't forward clicks the way it does for a native input, so the text would have looked clickable and done nothing. It's a `<span>` now.
- **`<optgroup>` has no equivalent.** National Recruits grouped its wider position groupings under a "Groups" heading. The new list is flat, so those entries carry a `(group)` suffix instead — they deliberately overlap the list above, and inline without a marker they'd read as duplicates.

Two lists got search automatically by crossing the 12-option threshold (position filters at 22 options), and the NCAA Hub's team picker and National Players' team filter were opted in explicitly for the same reason the team switcher was: typing beats scrolling a conference list.

**Verified in the app** on Roster — six triggers on the page, the position panel opening with 22 rows inside the viewport, glider highlight tracking, snug hard-edged triggers at divider weight. typecheck/lint/build clean.

**21 native selects left, all in editors:** `PlayerEditorModal` (12), `PortraitPicker` (3), `ScandalsModal` (2), `PlayerComparison` (2), and National Recruits' own edit panel (2). That's wave 3, and it's where the `useModalLayer` groundwork from wave 1 gets exercised — every one of those opens inside a modal.

**Addendum — no horizontal scrollbars (same day).** Narrow panels ("All stars", "All stages") were rendering a horizontal scrollbar. Cause: the row list is `overflow-y-auto`, and CSS computes the OTHER axis to `auto` as soon as one axis isn't `visible` — and the glider's wash is a fixed 9rem hanging off a 1–2px segment, so on a 101px panel it overflowed by ~43px. Wide panels never showed it, which is how it survived wave 1. Fixed with an explicit `overflow-x: hidden`; the wash is a fade, so clipping it at the panel edge costs nothing.

Worth recording how it was verified, because the first check was wrong: `scrollWidth > clientWidth` STILL reports overflow under `overflow-x: hidden` (the content is scrollable programmatically, just not by the user), so two dropdowns looked broken when they weren't. The honest test is whether a bar is rendered — `offsetHeight − clientHeight`. Measured across all six dropdowns on Roster plus the stars filter: `overflow-x: hidden`, bar height **0px**, on panels from 101px to 231px wide.

---

## Phase — Dropdown wave 3: the editors, and the layering it was groundwork for (2026-07-29)

The last 21 native selects, all inside modals: `PlayerEditorModal` (12), `PortraitPicker` (3), `ScandalsModal` (2), `PlayerComparison` (2), and National Recruits' own edit panel (2). **Zero `<select>` elements remain in the app.**

### The two hazards, checked before converting anything

A portalled panel sits OUTSIDE its modal in the DOM, so both of the modal's dismissal paths had to be examined rather than assumed:

- **Click-outside was already safe.** `CenteredModalPanel`'s backdrop closes only when `event.target === event.currentTarget` — the click has to land on the backdrop itself. A click inside a panel portalled to `<body>` never reaches it.
- **Escape was not.** Every modal listens on `document`, so one Escape would have closed the dropdown AND the editor behind it, losing unsaved edits. The Select now calls `stopPropagation()` on Escape — the innermost thing closes, which is the list. Enter stops too, so committing a choice can't submit the form it sits in.

**Both verified live inside the player editor:** panel at **z-120** over the modal's **z-110** (the depth-on-open stack from wave 1, doing exactly what it was put there for), Escape closing the dropdown with `modalStillOpen: true`.

### What the conversion turned up

- **`EnumSelect` carried nine of the twelve.** Converting that one helper did most of `PlayerEditorModal`; two more helpers (`BoolSelect`, `StringSelect`) absorbed the repetitive true/false and ability-tier fields, so the file lost markup rather than gaining it.
- **The unknown-value guard had to survive.** Several editor fields deliberately keep an unrecognised enum selectable so opening the editor can never silently rewrite a legacy value. That's preserved everywhere it existed — the enum select, the scheme picker, the recruit's commitment stage, and the team slot that must stay selectable before the league list loads.
- **A second `<optgroup>` casualty:** the scheme picker's Offense/Defense groups became `· Offense` / `· Defense` suffixes, same treatment as National Recruits' position groups.
- **Three lists got search** where the old native control offered only scrolling: both player pickers in the comparison modal (with jersey numbers as keywords, so "#12" works) and the recruit's top-school slots.

typecheck/lint/build clean.

**Addendum — staff tenure moved (2026-07-30).** On the coaching-staff cards, "Nth year with <school>" moved out of the record block and up under the coach's position, matching the head coach's masthead shape (role, then tenure). In the record block it read as another statistic; with the role it reads as identity. The block below is now the record plus the coordinator's own per-game numbers, nothing else.

**Addendum — the nav jitter on History, and the staff-card smudge (2026-07-30).**

**The jitter was the overshoot, exactly as the user guessed.** `--glider-ease` is `cubic-bezier(0.34, 1.28, 0.64, 1)` — the 1.28 means the segment travels PAST its target before settling. Moving to the LAST tab (History) therefore pushed it beyond the row's right edge, and inside the `overflow-x-auto` wrapper that is genuine scrollable overflow: a horizontal scrollbar flashed in for a frame or two, stole height from the row, and the whole nav jumped.

Fixed by giving the rail and segment their own clipped `.glider-track` (`position:absolute; inset:0; overflow:hidden`). Clipping THERE rather than on the root is the point: the tabs are siblings of the track, so a nav too wide for its wrapper still scrolls normally while the overshoot has nowhere to spill. **Measured both halves** — sampling every frame of the animation to History: max overflow 0px, max scrollbar height 0px across 32 frames. And at 1024px the 8-tab NCAA nav still reports `scrollWidth 856 > clientWidth 629` and scrolls under a programmatic `scrollLeft` — so the fix didn't trade the jitter for an unreachable tab.

**The "element floating behind" the staff cards was `shadow-[0_20px_70px_-44px_rgba(15,23,42,0.38)]`** on CoachCard — a soft drop shadow tuned for a light theme, which on the black ground reads as a grey haze sitting behind the card rather than as depth. Removed; the border carries the edge, which is how every other surface in the app already works.

**Addendum — the section bar loses its box (2026-07-30).** Four asks on the top nav: lift it so the tabs align with the sidebar's "Dynasty" row, drop the border, add a rule under the menu, and close the gap between the season switcher and search.

The bar was the last framed surface left after sections lost theirs — bordered, filled, shadowed, with its own padding. It's a plain row now, closed by one divider-weight hairline.

**Why it sat low is structural, not this component's doing:** the shell gives `<main>`'s scroller `p-8` while the sidebar's nav uses `p-4` (app.tsx), and the sidebar's row is taller (`py-3` vs `py-2`) — about 20px between them. Cancelled with `-mt-5` on the nav rather than by trimming the shell, which would have moved every page's content instead of this one bar. Measured after: Coach's text centre at 78 against Dynasty's 79.

**The gap was two auto-margins.** The switcher and the search each carried `ml-auto`, so the first pushed the switcher to the middle and the second threw the search to the far edge. They're one right-hand group now with a single `ml-auto` — measured 8px apart.

---

## Phase — The command palette (2026-07-30)

The on-screen search modal becomes a Ctrl/Cmd+K palette that reaches **pages as well as people**. `GlobalSearch.tsx` is gone; `CommandPalette.tsx` replaces it.

### Most of this already existed, which is why it's one component

`Ctrl+K` was already bound (it just opened a modal), and `globalSearch(dynastyId, query)` already returned players, coaches and teams. The keyboard contract — arrows, Home/End, Enter, Escape, scroll-into-view, the sliding highlight — came straight from the dropdown work: **each section is its own `GliderNav`**, and the sections that don't hold the cursor pass `-1`, which hides their mark. That's what lets one indicator span grouped results, and it's why the palette feels like the sidebar rather than like a new widget bolted on.

### The grey was the blur, not the dimming

The old shell put `backdrop-blur-md` on the scrim and `backdrop-blur-2xl` on the panel — that, not the darkness, is what turned the page behind into mush. The palette's scrim is `rgba(0,0,0,0.55)` with **`backdrop-filter: none`** (measured), so the page stays sharp underneath and the palette reads as a light switched on over your work.

### What's genuinely new

- **A page registry with human labels.** Written out rather than derived from the route table: someone types toward "Standings" or "Analytics", not `trends`. Each entry carries `keywords` for the words people actually reach for that aren't in the label — "depth chart" finds Roster, "polls" finds Standings, "heisman" finds Annual Awards.
- **Ranking, because list order isn't relevance.** Label-prefix beats word-start beats substring beats keyword. Typing `stan` puts **Standings above every player named Stanton** — verified.
- **A useful empty state.** Recent searches (localStorage, last 5) plus "Jump to" — every page, one keystroke away. The old modal's empty state said "Start typing to search."
- **Ghost autofill, and deliberately not the other kind.** The completion is a muted span layered *under* the input, accepted with Tab; the input's value is never rewritten as you type. Writing it in means fighting the caret and the selection on every keystroke and being wrong the instant the guess is wrong — a ghost is honest about being a guess. Only offered when what's typed is a real prefix of the armed row.

**Ctrl+K is ignored while a `[role="dialog"]` is open** — a palette stacked on an unsaved player edit is a way to lose work by reflex. The nav keeps a slim trigger, since a shortcut-only feature is invisible to anyone who doesn't read release notes.

**Verified by driving it:** opens on the shortcut; `stan` → Standings ranked first with `dings` ghosted and a Tab chip appearing; Enter navigates to `#/dynasty/…/standings` and closes; reopening shows "Recent searches → standings" and "Jump to"; Escape closes. Scrim measured at `rgba(0,0,0,0.55)`, no backdrop filter. typecheck/lint/build clean.

**Addendum — palette: nav vocabulary and a shorter open (2026-07-30).**

**The page labels were teaching retired words.** The registry shipped with "Coach Hub", "Team Hub", "NCAA Hub", "Media Hub" and "My Board" — names the nav stopped using. Someone who has only ever seen the current nav has no idea what "Team Hub" is, so typing `program` found nothing at all. The five section landings now carry the words ON the nav — Coach, Program, NCAA, Recruiting, Media — with the retired names kept as keywords so they still resolve for anyone who remembers them, and the sublabel says what the page holds ("Team overview") rather than repeating the section name back. Verified: `coach` → Coach, `program` → Program, `ncaa` → NCAA, `recruiting` → Recruiting, `media` → Media, and `team hub` → Program.

**The empty state was a wall.** Opening the palette listed every page under "Jump to" — 28 rows before typing a character. It's recents only now, with a single line for a first run that has none. Every page is still one keystroke away; they just don't greet you.

---

## Phase — One modal treatment across the app (2026-07-30)

Every overlay now shares a scrim and a panel: `.modal-scrim` / `.modal-panel` in globals.css, applied across **15 files, 30 class strings**.

### What was actually there

Thirteen overlays had each hand-written their own chrome, and it had drifted into four scrim values across two base colours (`slate-950/60`, `/80`, `black/75`), three blur radii, and half the panels rounded while the other half already carried the cut corner. None of that was a decision — it was thirteen separate afternoons.

### The scrim darkens and nothing else

Same call the command palette made, now everywhere. Every one of these previously stacked `backdrop-blur` on the scrim **and** `backdrop-blur-2xl` on the panel, which is what turned the page behind into grey mush. Dimming alone keeps it legible, so a modal reads as something laid on your work rather than a wall replacing it. Two values survive: **55%** standard, **80%** for media and portrait viewers, where there's no page content worth keeping legible and artwork reads better against a deeper ground.

Panels lost their `shadow-[0_60px_160px_-40px_…]` with the blur — the same lesson the coach cards taught, that a soft shadow on a dark ground is a smudge, not depth. They're solid `--surface-overlay`, bordered at `--section-divider` weight, cut corner, no radius.

**Motion joins the family:** dropdown rises 6px, palette 8px, modal 12px, all on the same curve and duration. A bigger surface travelling further reads as weight rather than as a different animation.

**Measured on a real modal:** scrim `rgba(0,0,0,0.55)` with `backdrop-filter: none`; panel `rgb(0,0,0)`, border `rgba(255,255,255,0.09) 1px` (identical to the page's section dividers), no blur, no shadow, `modal-panel-in 0.18s`.

### The action dialog

The one idea worth taking from the reference pattern: **a glyph on destructive dialogs only**. It makes "this deletes something" register before the sentence is read, and it only works as a signal because it isn't on every dialog — so ordinary confirms don't get one. Squared with the cut corner in a tinted box rather than the usual round badge, since nothing else in the app is round. Verified live on the delete-dynasty confirm.

The rest of that anatomy was already right and is now written down in `UI/ModalAction.md`: the title is a question, the body is the consequence, the confirm button says the verb (someone skimming reads only the buttons), cancel is quiet and first, and a destructive primary is **outlined** in the danger colour rather than filled with it — a big red block reads as the recommended action.

`UI/ModalAction.md` now carries the full spec, including the layering and dismissal rules the sweep depended on. typecheck/lint/build clean.

---

## Phase — The History tab tells a career, not a sync log (2026-07-30)

Three changes to the player modal's History tab: the "First tracked season" row is gone, transfers show up as their own event, and the timeline now carries **position-specific career milestones** built from per-game box scores.

### "First tracked season" was talking about us, not him

It labelled the earliest imported season as if it were an event in the player's life. It wasn't — it was a fact about when the dynasty started syncing. Year one renders as a normal `Season` row now, same as every other year.

### Transfers, and the 27 fake ones

Development rows resolve each season from the **leaguewide** roster, so `teamName` names whichever school the player was actually at that year — a school change between consecutive seasons is the transfer. The user's own roster snapshot can't see this at all: a player who leaves simply stops appearing in it.

The naive version was wrong in a way that only showed up on real data. The game parks not-yet-enrolled incoming players on a placeholder FCS roster, so **every signed recruit** reads as a school change into your program. One Auburn offseason: 27 of those against 13 real transfers. The discriminator is clean — all 13 real ones advanced a class year (Freshman → Sophomore, and their OVR moved); all 27 fakes had class year *and* OVR frozen, because it's the same snapshot carried forward. So a transfer requires `CLASS_ORDER` to advance. Known cost: a player who redshirts the same year he transfers is skipped. Rare, and far cheaper than flooding every freshman's timeline with "Transferred from FCS East".

### Milestones need Saturdays, not seasons

"First 100-yard game" is a fact about one game and cannot be recovered from a season total, so this walks every box score the player has ever appeared in, in order, and fires each milestone once — on the earliest game that earns it. 34 distinct milestones (37 definitions — the universal three exist once per box-score category), scoped by position group (QB / HB-FB / WR-TE / front seven / secondary), plus three universal ones.

**The opponent lookup is the part that had to be redone.** The first pass resolved game IDs against the user's own schedule and produced `vs Unknown · Wk 0` for a transfer's pre-arrival games — which also destroyed the chronological ordering the whole mechanism depends on. The game log turns out to be **leaguewide**: 944 distinct game IDs in one Auburn season against a 13-game user schedule. Opponents now come from `getLeagueScores`, with the side resolved from the entry's `teamIndex` (falling back to the user's schedule row for seasons synced before `teamIndex` existed). Games that still can't be placed are dropped rather than rendered as "Unknown".

That also means milestones work for players opened through the team switcher, so the fetch is its own effect running in parallel with the main load rather than tacked onto the end of it.

**Not covered, honestly:** offensive linemen record no countable stats and kickers/punters aren't in the game-log categories at all — those players get the three universal milestones and nothing else, which beats inventing one the data can't support. The universal debut is worded "First **recorded** game" for the same reason: a dynasty imported mid-career has no box scores from before the first sync.

**Verified on the two-season Auburn save.** AK Dear (HB, Alabama → Auburn): "Transferred from Alabama to Auburn", then his 2026 Alabama season resolving against Alabama's real slate — first rushing TD @ Kentucky Wk 2, first 100-yard game vs Florida State Wk 3, 50-yard TD run and 155 scrimmage yards @ Mississippi St Wk 5, in order. Byrum Brown (QB): first TD pass and a 3-TD/0-INT game vs Baylor Wk 1, then 445 yards / 5 TD vs Southern Miss Wk 2 firing the 300-, 400-, four-TD and dual-threat milestones together. Bryce Deas (MLB): first tackle vs Southern Miss Wk 2, first start @ Georgia Wk 7, 14 tackles and a 100 rating vs LSU Wk 8. Marcus Pullard (the FCS East placeholder case) correctly shows no transfer. typecheck/build clean.

---

## Phase — The close button is an X (2026-07-30)

Every overlay header's bordered **CLOSE** pill is now a bare glyph, via one new `ModalCloseButton` — and the milestone list from the previous phase is now an editable document at `docs/MILESTONES.md`.

### Twelve copies of the same class string

The pill existed as twelve hand-written copies across the profile modals, the editors, the media and portrait viewers, the box score and the recruiting editor — the same drift `ActionIcons.tsx` was created to stop for the pencil/export/bin. `CloseIcon` joins that file; `ModalCloseButton` wraps it with the behaviour.

A glyph rather than a word for the reason the nav search trigger became one: a bordered box in a header reads as a control of equal weight to whatever else is up there, and an X in the corner of an overlay is the most universally understood control in software. No border, no fill, muted resolving to full contrast on hover. `label` is a **required** prop rather than an optional `aria-label`, so a nameless button can't ship.

### The focus ring put the box straight back

Caught by looking at the capture rather than the CSS: the first build rendered the X inside a white rectangle, on every open. Nothing in the component drew it — the player profile, recruit profile and team profile all call `closeButtonRef.current?.focus()` on open to start the focus trap, and the browser's default focus ring was outlining the glyph. The bordered pill had absorbed it; a bare 18px mark cannot.

Two changes, and the second is the real fix:

1. `focus-visible` instead of `focus`, so a mouse user never sees a ring.
2. **The panel takes focus on open, not the close button.** Both are valid trap entries, but focusing a *control* lands it in its focused state every time you open the thing, and focusing the dialog announces its own label ("Player profile") rather than "Close player profile, button". `tabIndex={-1}` to make it programmatically focusable, `outline-none` so the panel doesn't ring itself. The Tab handler already worked off `panelRef`, so the trap is unchanged.

**Deliberately not converted:** the quiet `Close` in a footer action pair — PortraitPicker's `Close | Use this portrait` and ScandalsModal's `Close | Commit the crime`. Those are the cancel half of a pair and have to read as a word beside the verb they're declining; an X there loses the pairing and contradicts the action-dialog anatomy in `UI/ModalAction.md`.

**Verified in both themes** on the player profile: no border, transparent background, no ring on open, `aria-label="Close player profile"`, and a DOM sweep finding zero remaining buttons whose text is "Close". `UI/ModalAction.md` carries the rule now. typecheck/lint/build clean.

### docs/MILESTONES.md

The 34 career milestones are now a document the user edits — every row carries the `id` of its entry in the `MILESTONES` array, so a change in one maps to exactly one change in the other, and the array's comment points back at the file. It also lists the full set of per-game fields available to build new milestones from, which is the honest boundary: anything not in that list isn't in the save's per-game data and can't be added without new extraction work.

---

## Phase — Stats that fit the position, a modal that clips, and bowls with names (2026-07-30)

Four fixes off one round of screenshots.

### Career totals stopped leading with eleven zeros

The save stores one row shape per side of the ball, so every offensive player carries all eleven offensive counters. Rendering them unconditionally meant a receiver's Career tab opened with **Comp/Att 0/0 · Pass Yds 0 · Pass TD 0 · INT 0 · Rush Att 0** before the first number anyone opened the card to see.

Each field now belongs to a group (passing / rushing / receiving; tackling / pass rush / coverage / takeaways), each position declares which groups it's judged on, and **anything with a recorded value shows regardless**. That second half is what makes the filter safe rather than lossy: a receiver's jet-sweep touchdown, a lineman's fumble recovery, a corner's sack — none are "relevant to the position" and all appear the moment they happen. A zero is the only thing ever hidden, and only where the position wouldn't be expected to post one. Games stays unconditional; it's the denominator for everything else.

One rule, four surfaces: the Stats tab's season tiles, the Career tab's totals, the Overview hero strip (which keeps its stricter "no zeros at all" rule on top), the Best game tiles, **and the season-by-season table's columns** — chosen from every row at once so a column can't be present for one season and missing the next.

**INT is now in the season-by-season table**, which is what the request was really pointing at: it lived in the tiles but the table went Pass Yds · Pass TD · Rush Yds · Rush TD, skipping it entirely. Putting it in the `passing` group means a quarterback always sees it, including a clean sheet.

Measured on Auburn 2026: the WR went from 11 tiles to 4 (Games · Rec · Rec Yds · Rec TD) with a 7-column table down to Season · Team · Class · Pos · GP · Rec Yds · Rec TD; the QB kept Comp/Att · Pass Yds · Pass TD · INT · Rush Att/Yds/TD and dropped the three receiving zeros, with INT added to his table.

### The box-score modal scrolled the wrong thing

Its scrim carried `overflow-y-auto` and the panel had no height cap, so the whole panel scrolled inside the scrim with the header held by `sticky top-0`. A sticky header sticks to the **scrollport**, not to the panel it belongs to — and with no `overflow-hidden` on the panel there was nothing to clip what escaped, so the helmets rode up past the header and out the top.

Now the same shell every other overlay uses and that `UI/ModalAction.md` specifies: `max-h` on the panel, `flex flex-col overflow-hidden`, a `shrink-0` header, and a `min-h-0 flex-1 overflow-y-auto` body. The blur went with it, per the same spec. Verified by driving it: 3,086px of internal scroll with the panel's top and bottom unchanged at 32/968 in a 1000px viewport, and the page behind still at scrollTop 0.

### "BowlSeason3" was a week bucket, not a round

A Louisville CFP Semifinal read **BowlSeason3** in the Schedule table while the same game's box score said *CFP Semifinal*. Two separate faults on top of each other.

**The data.** `extract-league-schedule.ts` resolves the save's BowlGame reference — but it runs *before* `extract-schedule.ts`, which is what preloads the BowlGame table, and `resolveReference` needs the target table's records loaded. So it silently returned undefined for **every postseason game in the league**: all 43 bowls in one Auburn season came back with `bowlName: null`. Fixed with the preload plus `resolveReferenceWithTable`, matching extract-schedule exactly.

That only helps seasons synced from now on, so the query layer reads across instead: `GameData` (the `schedule` snapshot) is already **leaguewide** — every game, with the reference properly resolved — so `getLeagueTeamSchedule` and `getLeagueScores` take bowl identity from there and fall back to the league copy. **Existing dynasties are fixed with no re-sync.** That also repaired the Scores page, which had been silently rendering no bowl name at all for the same reason.

**The display.** The Type cell printed `game.weekType` whenever the name was missing, and that string can never be shown to anyone: it's a week bucket, and one Auburn season put **28 games in BowlSeason1** — every December bowl mixed in with the Playoff first round. There is nothing in it to derive a round from. The league Type cell now runs the identical code path as the user's own (`getGameTypeImagePath` + a new `bowlLabel`), so a Playoff semifinal renders the CFP round graphic whichever team's schedule you're looking at; those helpers took a structural `GameTypeFields` parameter instead of `ScheduleGame` so there's one implementation rather than two that drift. The fallback is the generic bowl mark and the words "Bowl Game" — honest, where the enum was just wrong.

Verified on Louisville's 2026 schedule: CFP round logos on weeks 18/19/20, and no "BowlSeason" string anywhere in the document. typecheck/lint/build clean.

---

## Phase — Rivalry logos on the schedule and in the box score (2026-07-30)

New art landed in `public/assets/rivalry/rivalrylogo` — 31 matchup badges plus a generic shield. Trophies were supplied too and are **deliberately untouched** at the user's request, pending a pass to weed out redundant ones.

### Keyed on the matchup, not the rivalry name

The obvious route was the save's own rivalry name, and it's the wrong one twice over. The art is named by pairing (`AlabamaVsAuburn`), not by rivalry (`Iron Bowl`) — and `extract-rivalries.ts` only ever runs for the **user's team**, so a browsed program's schedule and any league game's box score carry no rivalry data at all. Keying on the two team names makes all three surfaces work off one map with no new extraction.

**The pairs are written out rather than parsed from the filenames**, because the filenames disagree with each other and with the save. The art ships `TexasAM` in one file and `Texasam` in another; the save says `New Mexico St.` where the art says `NewMexicoState`, `USF` where the art says `SouthFlorida`, `Washington St.` where the art says `WashingtonState`. A parser would need every one of those exceptions anyway and would fail *silently* on the next one. Names verified against the real 138-team display list; lookup normalises case and punctuation and sorts the pair, so home/away doesn't matter.

The generic shield only appears when the save actually flags a rivalry (`isRivalryGame`, user's team only) and the pairing has no dedicated art — "these two teams played" is not evidence of a rivalry, so a browsed schedule shows nothing rather than guessing. It renders for upcoming games as well as played ones: a rivalry you can see coming is the point of a schedule.

### Its own column, not the Type cell

`Record` → `Rec` bought the width, per the request. The column header is intentionally blank — a label over a column that's empty on eleven of thirteen rows reads as missing data. Both schedule tables get it: the user's own and the league browse view.

**The first build rendered it crushed.** Measured at **16×40** where it should have been 40×40: the `<td>` inherited the row's `px-5`, so a 56px column had 40px of padding and a 16px content box, and the table squeezed the image sideways to fit. `px-2` on that one cell and a 64px column fixed it — caught by measuring, not by looking, since a 40px-tall badge squashed to 16px wide still looks like *an* icon.

### The box score

Rivalry mark replaces the conference mark in the hero, between the two helmets. It does **not** replace a bowl logo: if two rivals meet in the Playoff, the round is the occasion. So the priority is rivalry → conference → bowl/playoff, with bowl short-circuiting the first two.

**Verified on Auburn 2026:** week 13 @ Alabama renders the Iron Bowl badge in both the schedule column and the box-score hero; weeks 7 (Georgia) and 8 (LSU) are real flagged rivalries with no dedicated art and correctly fall back to the generic shield; headers read `Wk · Date · Rank · Rec · (blank) · Opponent · Type · Location · Kickoff · Result`. typecheck/lint/build clean.

---

## Phase — Rivalry trophies renamed from save data, not from memory (2026-07-30)

The ask was to research 106 rivalry-trophy filenames and rename them to carry their schools, with an honest question attached: *"is this something you could do accurately?"*

**From memory, no. From the save, yes — for 89 of them.**

### The Rivalry table has a Trophy reference

Before guessing at a single one, the question worth asking was whether the save already knows. It does: `Rivalry` carries `Trophy` alongside `Team1`/`Team2`, plus `Name` and an `AssetName` that spells out both schools. 233 rivalries in `DYNASTY-TULANEMASTER`, 91 with a trophy.

The `Trophy` reference points at tables 16443–16488, which are **outside the save** — the same wall the AD-goal text hit. So the trophy's *name* is unreachable. That turned out not to matter: the reference is still a stable catalogue id, every rivalry sharing an id shares a trophy, and the ids line up one-for-one with the art files. 82 files pinned that way with zero recall involved, including several nobody would have gotten right by hand — `KuterTrophy` is Air Force/Hawaiʻi, `GanszTrophy` is Navy/SMU (Frank Gansz coached both), `IrelandTrophy` is the Boston College/Notre Dame game.

Seven more came from exact rivalry-name matches in the same save's list, and `SouthwestClassicTrophy` from the artwork itself — the trophy has the Arkansas and Texas A&M logos on it.

### 26 of the 106 files are the same image

Hashing the folder answered the "some are redundant" suspicion with a number: **80 distinct images across 106 files.** One generic gold "RIVALRY TROPHY" render is shared by 26 differently-named files, `PurdueCannon`/`VictoryCannon` are a second identical pair, and `DefaultRivalryTrophy` is a small EA SPORTS badge rather than a trophy.

That reframes the remaining 17 unnamed files: 16 of them ship the placeholder, so there is no artwork behind the name to identify. They were left untouched rather than guessed at.

### The rename

`rvlt-TrophyName-CODE1-CODE2[-CODE3].webp`, schools in the save's own Team1/Team2 order so the document and the filenames can't drift apart. The codes are what let four `VictoryBell` files and three `GovernorsCup` files coexist legibly — the shipped `_C_M` / `_K_KS` suffixes were doing the same job unreadably. `FloridaCup` is the only three-school trophy: two save rows are both named "Battle for the Florida Cup" (Florida/Miami and Florida State/Miami).

**The file list moved mid-task** — 112 files on the first read, 106 by the time the plan was built, with five mapped trophies (two Commander-in-Chief variants, two Michigan MAC, one Shillelagh) no longer present. The rename script reconciles against the live folder rather than the earlier read and reports anything mapped-but-missing, which is how that surfaced instead of silently failing.

Also worth recording: **9 rivalries the save ties to a trophy have no art in the pack at all** — Apple Cup, Bedlam, the Big Game, Bayou Bucket, Battle Line, Battle of I-75, Marshall/Ohio's Bell, the Holy War, Utah/Utah State.

Full mapping, placeholder flags and a reverse manifest in `docs/RIVALRY_TROPHIES.md`. Nothing in the app reads these yet — trophies stay unwired until the redundant ones are settled.

---

## Phase — The Overview trophy case: bigger, unlabelled, and it counts rivalries (2026-07-30)

### The caption was doing the work the trophy should

A 64px thumbnail under the words "LIBERTY BOWL CHAMPIONS" meant the *name* carried the message and the trophy was decoration beside it — backwards for the one thing on the page worth celebrating. The badge is now a bare image at `MASTHEAD_ART_SLOT.logo.maxHeight` (170px), the same slot the team mark uses, so the two read as equals. The name moved to `title`/`alt` rather than being deleted; it's still the accessible label, just not competing with the artwork.

### Any trophy won that season, not just the bowl

Rivalry trophies now appear alongside national/conference/bowl. There's no new data source for this — a rivalry trophy is won by beating the school it's contested with, so every won game is checked against the pairing map derived last phase from the save's own `Rivalry` table.

**Deliberately NOT gated on the save's `isRivalryGame` flag.** That flag only covers the user's own three `Rival1/2/3` slots, while a program can hold trophies against schools outside them — Auburn's slots are Alabama, Georgia and LSU, but the James E. Foy is the only trophy among those three. The pairing map is the authority on whether a trophy exists at all; the flag was never the right question.

`shared/rivalryTrophies.ts` holds the map, in `shared/` because both sides need it — the database layer decides whether a trophy was *won*, the renderer decides what to draw. `Trophy` gained an optional `id` so several rivalry wins in one season don't collide on a React key that used to be `trophy.kind`.

Labels are split from the filename stem, with a dozen overrides where splitting on capitals mangles the name: "Floydof Rosedale", "Kegof Nails", "James EFoy", "ORourke Mc Fadden", "Waron I4". No rule to find there, it's a closed set.

### Verified

The Liberty Bowl trophy renders at 170×170 against a 170px team mark, captioned nowhere, titled "Liberty Bowl Champions". The lookup was checked against the save's own display names verbatim: **77 of 91 trophy-bearing rivalries resolve**, order-independent, every one pointing at a file that exists; the 14 that don't are exactly the expected set (9 with no art in the pack, 5 whose files were removed). The three-way Florida Cup resolves from all three pairings, and a non-rivalry pairing returns null.

Auburn 2026 shows no rivalry trophy, correctly — they beat Georgia, Arkansas, Mississippi St and Southern Miss, none of which contest one with Auburn, and lost the Iron Bowl. typecheck/lint/build clean.

**Untested and worth watching:** a season with four or more trophies. They wrap, so the masthead would grow a second 170px row.

---

## Phase — Conference championship identity, and where those games are actually played (2026-07-30)

### The division badge is gone

The standings table is already grouped by division and sorted within it, so the team on top IS the leader. The `◆ DIV` chip was restating the row's own position back to it.

### Week 16 games now carry their championship logo

`public/assets/confchamp` had ten `*Championship.webp` event marks sitting unused beside the `*ChampionshipTrophy.webp` files the trophy case already uses. A championship game was rendering the plain conference roundel — the same mark as the other eight conference games that season.

**The championship week is derived, not hardcoded.** The save does NOT give these games their own `SeasonWeekType`: on a real week-16 save all ten championships sit in `RegularSeason` alongside the rest of the year (weeks 0–14, then 16; week 15 carries no games at all). `shared/championshipWeek.ts` takes the last regular-season week on the calendar, which stays true if a user shifts the schedule where a literal `week === 16` would silently stop matching. A game is the championship when it's a conference game in that week — both halves matter, since the week alone would catch a stray non-conference game and the type alone catches the whole season.

Wired into the Type cell on both schedules, the Game Info hero, and `gameTypeLabel`, so the meta line now reads "SEC Championship" instead of nothing. Verified live on `DYNASTY-AUBURNW17CONFCHAMPS`: Oklahoma vs Ole Miss, week 16, flagged in the schedule row *and* the box score, with `confchamp__SECChampionship.webp` loading (1024×1024) in both places.

### Where the championship is played — the save DOES know

The venue problem turned out to be answerable, and the answer is better than expected.

**`Conference.ChampionshipStadium` exists**, and it is populated for exactly five conferences — ACC, Big 12, Big Ten, MAC, SEC — and **empty** for American, CUSA, MWC, Pac-12 and Sun Belt. That is a perfect 10-for-10 match with the real-world list: the five with a reference are the ones played at a fixed neutral venue, the five without are the ones hosted by a qualifying team.

The same signal is on the game itself: every week-16 game's `SeasonGame.Stadium` reference is **identical to its conference's** `ChampionshipStadium`, or absent when the conference has none. So neutral-vs-hosted is readable per game, with no inference.

**The venue's NAME is not in the save.** Those references point at tables 16433/16434, outside the file — the same wall as the AD-goal catalogue and the rivalry trophies. The in-save `Stadium` table (id 4111, capacity 183) is entirely empty, and `ScheduleStructure`'s championship defaults are literally `"TBA"/"TBA"/"TBA"`. Worth noting this is not special to championships: `Team.Stadium` is unresolvable too, which is why the app's stadium names have always been a bundled lookup.

**The reference is stable.** Checked across three unrelated saves (AUBURNW17CONFCHAMPS, TULANEMASTER, JMUTESTER): every conference's id is byte-identical, and so are `ConfChampGameName`, `ConfChampGameLogoID` (300–309) and `ChampionshipGameType` (`TOPTEAMS`, except Sun Belt's `TOPDIVISIONS`).

That makes a stable-id lookup viable and, importantly, *not* a hardcode of conference→venue: keying on the save's own stadium id means a user who moves a championship elsewhere in-game gets the new venue resolved, and a conference that switches from neutral to hosted simply loses its id and flips to the host's stadium automatically.

**Confirmed the bug is live:** the Oklahoma/Ole Miss SEC Championship currently reads "SEC Championship | Gaylord Family Oklahoma Memorial Stadium, Norman, OK". It's at Mercedes-Benz Stadium in Atlanta.

Extraction and the venue lookup are not built yet — recommendation shared with the user first. typecheck/lint/build clean.

**Addendum — the venue fix, built (2026-07-30).**

`SeasonGame.Stadium` turned out to be a **general neutral-site signal**, not a championship-only one. Measured across a full season: 46 games leaguewide carry the reference and **every single one differs from the home team's own stadium** — neutral-site kickoff games, Army-Navy in week 14, every bowl, and the five conference championships played at a fixed venue. Presence means "somewhere that isn't a home field".

The extractor now records it as `neutralVenueId` (a stable `tableId:rowNumber` string), and only when it differs from the home team's stadium — comparing rather than just checking presence costs nothing and keeps the signal honest if EA ever starts stamping the home stadium on ordinary games. It also feeds `isNeutralSite`, which previously relied on `isBowlGame || IsKickoffGame || ScheduleNeutralStadium pairs` and therefore missed championships entirely.

`lib/neutralVenues.ts` resolves the id to a real venue, **keyed on the save's id rather than the conference** — move a championship in-game and the id moves with it, switch a conference from neutral to hosted and the id simply disappears, and realignment is irrelevant because we never key on who's in which conference. **Two ids cross-validate against a second, independent appearance**, which is what makes them evidence rather than assertion: `16433:99895` is both the SEC Championship *and* Auburn's week-1 neutral kickoff game — both really are at Mercedes-Benz Stadium; `16434:85121` is both the MAC Championship *and* a Central/Eastern Michigan regular-season game — both really are at Ford Field. An unknown id resolves to null and keeps the bare "Neutral Site" badge, never a guessed stadium.

`getLocationDisplay` no longer falls through to the host's stadium for a neutral game. That fall-through *was* the bug.

**All ten championships verified after re-import:** SEC → Mercedes-Benz, Big Ten → Lucas Oil, Big 12 → AT&T, ACC → Bank of America, MAC → Ford Field, and American / CUSA / MWC / Pac-12 / Sun Belt correctly hosted with no venue override. A 10-for-10 match with the real-world list. The SEC title game now reads **"SEC Championship | Mercedes-Benz Stadium, Atlanta, GA"** where it previously claimed Gaylord Family Oklahoma Memorial Stadium.

**Needs a re-sync** — `neutralVenueId` is new extraction, so existing seasons keep their old (championship-less) neutral classification until re-imported. No editable venue database was built: keying on the save's own id means an in-game venue move follows automatically, so an override table would only cover venues we can't name, and none showed up in the FBS championship set. typecheck/lint/build clean.

**Addendum 2 — bowl venues named, and CFP first round corrected (2026-07-30).**

The first pass only named the five conference-championship venues, so every bowl still read "Neutral Site" with no city. Pairing each postseason game's `BowlGame` identity with its `Stadium` reference gave **40 distinct (bowl, venue) pairs** and, with them, the whole postseason map.

**Keying on the venue rather than the bowl is what makes this work**, and the data insisted on it: Camping World Stadium hosts the Citrus, Cure AND Pop-Tarts bowls; Raymond James hosts Gasparilla and ReliaQuest; Bank of America hosts Duke's Mayo *and* the ACC Championship. One entry serves all of them. And the CFP rounds carry a **blank** `AssetName`, so a bowl-keyed table could never have resolved them at all — a venue key picks them up for free wherever they land.

Most entries are confirmed by the same id appearing somewhere independent: `16433:99895` is the SEC Championship, a CFP Quarterfinal *and* Auburn's week-1 kickoff (all Mercedes-Benz); `16434:85219` is the Las Vegas Bowl *and* the National Championship (Allegiant); `16434:85072` is the Armed Forces Bowl *and* TCU's own home-stadium id (Amon G. Carter — the bowl is played there); `16434:85244` likewise matches UAB's home id (Protective Stadium, where the Birmingham Bowl is played). Four ids seen only on CFP quarterfinals/semifinals plus one week-0 opener are **deliberately left unmapped** — those rounds carry no bowl name, so there's nothing to identify the venue by, and they keep the honest "Neutral Site" badge rather than a confidently-wrong stadium.

**CFP first-round games were being mislabelled**, in the opposite direction to the championships. They're played on the higher seed's campus, and the save says so by giving them no `Stadium` reference while every other bowl gets one — but `isNeutralSite` treated any postseason game as neutral, so the app claimed "Neutral Site" and refused to name the host. Now scoped to that round specifically rather than "any bowl missing a venue", because a bowl whose matchup isn't set yet also has no reference and must not be reported as a home game for whoever is penciled in. Verified: all four first-round games report hosted, at Miami, Ole Miss, SMU and Texas Tech.

Auburn's Liberty Bowl now reads **"Liberty Bowl | Simmons Bank Liberty Stadium, Memphis, TN"** in both the schedule row and the box score. typecheck/lint/build clean.

---

## Phase — Both flanks glow, and the winner gets sparks (2026-07-30)

### The glow is staging, not a scoreboard

It only appeared under the winning helmet, which left half the header unlit. Now each flank carries its own radial glow in that team's own colour. Nothing is lost by making it symmetric: the result is already unmistakable from the losing score's 0.5 opacity and the colour rule under each name, so the glow is free to just be lighting.

### Sparks, built the cheap way

Adapted from the starfield in `UI/Particle.md`: **one element carrying a long `box-shadow` list, moved by a single transform**, with a `::after` copy offset by exactly one loop-span so the field wraps seamlessly. Fifty-two particles cost one composited layer and *zero* DOM nodes each — the naive version (a div per particle, or a canvas) would cost fifty of both in a header that re-renders whenever the box-score team toggle changes.

One improvement on the reference: the wrap copy uses `box-shadow: inherit` instead of repeating the entire list by hand. Same result, half the CSS, and the two can't drift apart.

Two layers at different sizes and speeds (1px/19s and 2px/13s) so it reads as depth rather than one sheet sliding past. Gold is `#e9d28c`, the same logo gold the nav glider uses.

**The mask is what keeps it disciplined.** Sparks fade in at the outer edge, hold, and are fully gone by 78% of the flank — so nothing ever crosses into the logo/week/score column. Verified by measurement rather than by eye: the spark band spans 900–1220px against a centre column at 599–884, no overlap.

**Direction is one animation, not two.** The right-hand flank is the same field mirrored with `scaleX(-1)`, so "inward" is inward on both sides and there's a single keyframe set to maintain.

Only on the winning side, and only once a game has been played — that's what makes it read as celebration rather than as decoration. The flanks and centre column took `relative z-10` so the helmets paint above the effect layers; without it an absolutely-positioned sibling wins the paint order and the sparks would have drifted *over* the helmet instead of behind it.

Reduced motion needs nothing here — the global clamp in globals.css already stops the drift.

Verified: two glows (left + right), sparks on the winner's side only, 2 layers, 52 + 14 particles, `overflow: hidden`, masked, gold `rgb(233, 210, 140)`, flanks at `z-index: 10`. typecheck/lint/build clean.

---

## Phase — Venues resolve without a re-sync (2026-07-30)

### The mistake in the previous phase

"Needs a re-sync" was not a viable answer, and the reason is one I should have caught: **a dynasty's past seasons can never be re-synced.** The save has long since moved past week 16 of 2026 and there is no way to regenerate that state. Keying venue resolution solely on the extracted `neutralVenueId` therefore left every championship already sitting in a user's archive permanently wrong — the Big Ten title game reading "Ohio Stadium, Columbus, OH" because Ohio State was nominally the home team. That's what users were reporting.

### The fix doesn't need the id

`isConferenceChampionship`, `conferenceName` and `bowlAssetName` are all derived or stored on the OLD snapshots — the championship week is computed at query time from `week` + `isBowlGame`, both of which predate any of this work. So two name-keyed fallbacks repair history with no re-sync at all:

- **Conference championship → conference name.** The neutral/hosted split is still read from the save (`Conference.ChampionshipStadium`, populated for exactly ACC/Big 12/Big Ten/MAC/SEC and empty for the other five) rather than from recall, so this is the same fact arriving by a different route.
- **Bowl → `bowlAssetName`.** The asset name rather than the display name, because EA rebrands bowls by sponsor year to year: "Salute to Veterans Bowl" and "Xbox Bowl" are the Camellia and Bahamas bowls wearing a sponsor.

**`hosted` is recorded explicitly, not left out.** A conference we don't recognise and a conference we know is hosted are different answers: the first should fall through, the second should stop the lookup and let the host's stadium stand. Five of the ten championships genuinely are at the higher seed's field.

**The championship check runs BEFORE the `siteType` test**, which is the part that's easy to get wrong: on an old snapshot the game was never flagged neutral in the first place, so anything waiting for `siteType === 'neutral'` would never reach it.

The extracted id still wins when present, so an in-game venue move is respected and the fallbacks stay a floor rather than a ceiling.

**Verified against a genuinely pre-fix import** (`venueId: null`, `neutral: false` on all ten championships — the exact shape of a user's existing archive): Big Ten → **Lucas Oil Stadium, Indianapolis, IN** where it previously said Ohio Stadium, and American → **Skelly Field at H.A. Chapman Stadium, Tulsa, OK**, correctly hosted. typecheck/lint/build clean.

**Addendum — the hero's meta line is three rows (2026-07-30).**

Date, then what the game IS, then where it's played, each on its own line, replacing the single pipe-joined string. Combined it ran long enough to wrap at the hero's width and the break landed *mid-venue* — "Simmons Bank Liberty / Stadium, Memphis, TN" — splitting the stadium's own name across two rows. Giving each fact its own line means the wrap point can never fall inside one.

The venue row is **stadium + city, not city + state**. Dropping the state is what the layout needed (with it, "TN" orphaned onto a fourth line) and "Memphis" carries the meaning by itself. `LocationDisplay` gained a `city` field alongside `cityState` rather than changing it — the Schedule page's Location column has room for the full address and keeps it.

Measured after: all three rows 20px, i.e. single-line each, at a 1280px modal.

---

## Phase — Agenda board audit (2026-07-30)

Asked to check whether the lists were caught up. They weren't, and the first problem was the board itself.

**`Productivity/agenda.html` had a JavaScript syntax error and rendered nothing.** An orphaned `prompt:` line was left behind when the conference-divisions idea was converted into a shipped row — it sat outside any object literal, so the whole inline script failed to parse and the page came up blank. It predates today; the version in the last commit is broken too, which means the board has been dark for a while. One line removed; the script now parses and the array evaluates to 197 entries.

**Three rows claimed "planned" for work that had already shipped:** the Season Yearbook export (button on Team Hub → Overview), Head-to-Head / Rivalry history (`getHeadToHead` + the Rivalries page) and the coaching tree (`getCoachingTree`, on Coach Hub). Marked done with a note on where each actually lives.

**Three "By Design" limitations are no longer true**, which matters more than a stale idea row — those are the entries that stop a feature being attempted again:
- *No real conference divisions* — resolved back on 2026-07-20 (there's a shipped row for it); Standings renders real East/West tables. The original note recorded a wrong read of the schema and was never revised.
- *No opponent player stats* — game logs are leaguewide now (944 distinct game ids in one season against a 13-game user schedule), and the box score has a both-teams toggle.
- *No stadium/venue names* — the save limitation still holds, but the app no longer shows blanks: real-world home stadiums plus `lib/neutralVenues.ts` for neutral venues.

All three rewritten to say what changed rather than deleted, so the correction is on the record.

**Four open items added** from this session's loose ends: the two deferred decisions (past-season backfill, venue override editor) with the research and recommendation captured in the row, plus the 4 unnamed CFP venue ids and the CFP round graphics washing out on the light theme.

Standing: **179 done, 18 open** — 12 planned ideas, 2 code-health items, 4 limitation entries (3 of which are now historical rather than active).

---

## Research — card flip: what's possible (2026-07-30)

`UI/cardflip.md` is empty (0 bytes), so this is grounded in the codebase rather than a reference. Nothing implemented.

### The trap, measured — and then corrected

**Only a grouping property on the SAME element as `preserve-3d` flattens it.** My first pass over-claimed this and I had it wrong for a full pass: I said `PlayerCard`'s root `filter: drop-shadow` would break a flip. It doesn't, because that filter sits on the *perspective* wrapper, not on the rotating element.

The measurement that started it still holds — a child at `translateZ(400px)` under `perspective: 800px` renders 200px wide with `preserve-3d` alive and 100px once flattened, and `filter`, `clip-path`, `overflow: hidden` and `opacity < 1` each flatten *the element they're on*. What I got wrong was which element that is in this card.

`getComputedStyle` still reports `preserve-3d` in every flattened case, so the CSS reads correct either way. That part is worth keeping in mind.

### What actually decides it: where the cut corner goes

Rendered the reference's own structure with only one variable — which element carries `.corner-cut` / `overflow-hidden`:

| | result |
|---|---|
| clip on the **faces**, inner untouched | works — back shows, cut corner intact |
| clip **+ overflow:hidden** on the faces | works |
| clip on the **inner** (the `preserve-3d` element) | **broken — the front renders mirrored** |
| `filter` on the outer `.flip-card` | works (this is where PlayerCard's already is) |

So the reference works essentially as-is. **One rule: the clip and any overflow belong on the two faces, never on the rotating wrapper.** An independent-face variant (no `preserve-3d` at all, each face rotated separately) also works and is immune to the whole class of problem, but it isn't required.

### The back face is free

`PlayerCardRecord` already stores `player` (the full `RosterPlayer` — bio, class, jersey, OVR, archetype, dev trait, height/weight, hometown), the computed `stats` pairs, `seasonYear`, `teamName`, `favorite` and `createdAt`. A back showing full bio + the complete stat line + card metadata needs **no new queries and no extraction**. In the player modal there's more still loaded (career totals, attributes, honors, milestones).

### Two constraints worth designing around

**Click is already taken in the card book.** A click expands a card into its overlay, and in Select mode it picks. Flip needs either a different affordance there or to live inside the expanded overlay. `PlayerCardTab` (single card) and the export preview have click free.

**Export is a live screenshot, not a re-render.** `capturePage` with a clip rect grabs whatever is on screen — so a flipped card exports its back (a feature if intended, a footgun if not), and a mid-animation capture exports a smeared card. Export has to force a settled state, and "export front / export back / export both" becomes a real question rather than an accident.

### Smaller notes

- `ScaledSavedPlayerCard` draws at 330px and CSS-`scale()`s down to 78/220/380. A flip composes fine with that, but `perspective` has to be set relative to the scaled box or the rotation reads wrong at 78px — where a flip probably shouldn't be offered at all.
- Reduced motion: the global clamp kills the transition, so the flip must stay *usable* as an instant swap, not merely degrade.
- The face turned away needs `aria-hidden` and its controls need removing from the tab order, or keyboard focus lands on an invisible side.

**Addendum — working prototype + confirmed scope (2026-07-30).**

`UI/cardflip-prototype.html` — standalone, no app code or assets, opens straight in a browser. Confirmed working by the user.

It carries the card at its real 330×496 with a front approximating `PlayerCard` and a back built only from fields `PlayerCardRecord` already stores; controls for flip duration, perspective, click-vs-hover and three team colour schemes; a **"break it on purpose"** toggle that moves the cut corner onto `.flip-card-inner` so the 3D collapse into a mirrored front can be watched happening; and a correct/broken/unflipped triptych.

**Scope, decided:** the flip is for the **full-size card only** — the Card Book's *expanded* overlay, and the full-size card on the player modal's Cardbook page. Not the book's grid thumbnails, not the 78px strip.

That settles the interaction collision raised in the research. In the grid, click already means expand (or pick, in Select mode), so putting the flip one level down in the expanded overlay means nothing has to be renegotiated — click keeps meaning expand, and flip is a separate gesture on a card that is already the user's sole focus. The player modal's single card has click free anyway.

It also keeps export out of it: `CardExportDialog` renders its own preview card rather than reusing the book's expanded one, so exports continue to capture the front and the "front / back / both" question can stay closed until someone actually asks for it.

**The cut corner costs nothing.** The user's call was that they wouldn't fight for it if the flip demanded a compromise — but it doesn't. The clip simply lives on the two faces instead of the rotating wrapper, which is where the prototype already puts it, so the shape language keeps its exception-free record.

Not implemented; the user is picking it up later.

---

## Player Cards — the tab became a collection (2026-07-30)

User request, eleven numbered items (three withdrawn before work started). The
Cards tab had grown popular enough to attract requests, which is a good sign and
also a diagnosis: it was still shaped like the single-card feature it started as.

### The shape

**The hero-plus-strip is gone.** One card at full size with the rest as 78px
tiles beneath it says *the big one is the card and the others are a filing
detail* — exactly wrong for a set, where the second card you made is not a lesser
version of the first. `CardGrid.tsx` replaces `CardStrip.tsx` with equal tiles,
three to a row.

**The row is capped, not stretched.** Across the full width of the player modal
three cards come out at ~350px — near their 330px design size — which turns a
collection into three posters and puts the second row a full screen below the
first. Capped at 48rem they land at 243px, which is what a card measures on a
page of the card book. Two surfaces, one object, one scale.

**Add is a bare plus.** No dashed box: a box reads as a card that hasn't loaded,
a plus on its own reads as the one thing on the page that isn't a card.

### The expanded card, and where editing went

Clicking a tile opens `CardFocusModal` — the card centred on a deep scrim, ← / →
through the rest of the set, and a control pill (star, edit, export, default,
delete) borrowed wholesale from the card's own hover rollover so the gesture
language doesn't change just because the card got bigger.

**Every one-card action moved there.** The grid keeps only the default dot; there
is no wrong card to hit in a view that contains exactly one, and a grid you were
browsing shouldn't be wearing five controls per tile.

**The card book's expanded view was replaced with the same component**, editor
omitted. That collapses two implementations into one and gives the planned card
flip a single place to land — which the flip research had already concluded was
where it belonged.

**The editor is a panel beside the card, never over it.** Every control in it
changes what the card looks like, so you have to be able to watch that happen.
Four equal buttons two-by-two (Upload Photo / Media Photo / Remove Photo / Done)
under the zoom, with the "the full photo shows at first…" line removed.

### Two new capabilities

**A card can celebrate one game.** The stat line now comes from the season *or*
from a single Saturday, picked from a dropdown built out of the same per-game
tiles the "best game" panel already computed. No new queries. This is the ask
behind the ask: the four-touchdown night against the rival is the card people
actually want to make, and until now the card could only ever be a card of a
year.

**Layers belong to the card.** Turning the OVR, name, profile line, stat row or
team logo off used to be a property of the *export dialog* — checkboxes that
reset to all-on every time it opened. So a card designed as a clean
photo-and-name piece looked like that once, in a PNG, and never again. They now
live on the row (`CardLayerToggles` is shared by the editor and the dialog), so
the book, the hover preview and the export all agree. The dialog's copy of the
control is labelled "Show in this export" and seeds from the card.

### The lock, and where it is enforced

Items 13 and 14 — cards are independent of the selected season, and a card locks
its year and profile when made — are one rule, and it is enforced in the DAL
rather than in the editor: `updatePlayerCard` no longer writes `season_year`,
`team_name` or `player_json` at all.

The bug that motivates it was silent. `update` previously re-froze all three from
whatever the app happened to be showing, so opening a 2026 freshman card two
seasons later and nudging the zoom quietly reprinted it as a 2028 senior. Nothing
in the UI would have said so; the card just stopped being the card you made.
Alongside it, the tab stopped reloading when the season switches, and the stat
line can only be re-picked from the season the card was printed in — the editor
shows the frozen line and says so rather than offering this year's numbers for
another year's card.

Schema **v13** adds `layers_json` (defaults `'{}'`, merged over all-on, so every
existing card draws exactly as it did) and `stat_source_json` (null on pre-v13
cards, i.e. a season line by construction).

### Three bugs the verification runs caught

- **`transform: scale()` doesn't change layout.** The fluid grid card was left in
  normal flow, so it still occupied its full 496px however small it was drawn —
  a 140px hole under every row. Measured (row 1 bottom 983, row 2 top 1015 after)
  rather than eyeballed. Fixed by taking the scaled card out of flow.
- **The drag delta needed dividing by the render scale.** Framing is stored in the
  card's own 330px space; the drag happens in screen pixels. Miss it and a card
  drawn at 260px slides slower than the cursor.
- **The pointer handlers had to read through a ref, not capture dependencies.**
  `setDraft` re-renders on every pointer move, so a callback rebuilt each render
  had its own cleanup tear the listeners off mid-drag.

### Two small honesty fixes found on the way

Negatives are no longer auto-picked for the default stat line — a quarterback's
rushing line is often `-30 Rush Yds` once sacks are counted, and it ranks high
enough to walk straight onto the card. They stay pickable. And game labels test
`typeof week === 'number'`: Week Zero is a real week and a falsy one, and testing
for truth silently dropped the label on it.

Help menu gained a "Trading cards and the card book" section. typecheck / lint /
build clean; verified against a real imported save (screenshots in
`Productivity/screenshots/player-cards-*-2026-07-30.png`).

**Addendum (2026-07-30).** The pointer-tracked sheen on the expanded card was
removed at the user's request — the card keeps the fixed diagonal highlight it is
drawn with, and that is all. The expanded view shows the card; it doesn't perform
it. Six follow-ups (rarity treatment, the card flip, serial numbering, an
auto-caption from `game_context`, a 3×3 print-sheet export, and milestone
prompts) went to the Command Center as a single backlog item,
`cards-premium-next`, with a matching row on the agenda board.

---

## Why the player modal was slow — measured, then fixed (2026-07-30)

User report: opening a player takes a while. Asked whether prefetching the
not-yet-visible tabs in the background would help. **It would not have**, and the
measurements say why.

### The measurement

Instrumented against real imported saves in an isolated `CFB_USER_DATA_DIR`
(`Dynasty Save Test/DYNASTY-TESTER`, and `AUBURNW16` for a season with a full
slate of games actually played).

| call | one played season |
|---|---|
| `getGameLog` | **721 ms, 16.5 MB** |
| `getAwards` | 20 ms, 130 KB |
| `getLeagueScores` | 24 ms, 174 KB |
| `getPlayerDevelopment` | 58 ms |
| `getRoster` / `getPlayerStats` | 2 ms each |

Click-to-hero: **916 ms** on AUBURNW16, **224 ms** on TESTER (which has no games
played yet, and so never paid the big one).

### Three findings

**1. The game log is leaguewide, and the modal asked for it twice.** 944 games ×
~50 lines is every player in the country. The modal fetched the whole 16.5 MB
across IPC — once for the Stats/Game Log tabs, once more for the History tab's
career milestones, per season — to keep the ~13 rows belonging to one player.
That single call was ~80% of the wait, and it scales with seasons: a
three-full-season dynasty pays it four times.

**2. Nothing was cached, and sql.js is synchronous on the main thread.** Every
`getSnapshot` was a fresh gunzip + `JSON.parse` of the whole blob, so a second
read cost exactly as much as the first — and blocked everything else while it
ran. Prev/Next inside the modal paid full price on every step. "Concurrent" IPC
calls are not concurrent here; they queue behind one thread.

**3. The hero was gated on data the hero doesn't use.** `setRoster` — the call
that ends "Loading player…" — sat behind awards + roster + stats + team-award
results for EVERY season. `getAwards` alone is 130 KB per season, and it feeds
the Awards tab.

### The fix

- **`getPlayerGameLog(dynastyId, playerId, seasonId)`** — the same filter, run in
  the main process instead of the renderer. 16.5 MB → 3 KB, 721 ms → 1 ms.
- **A bounded LRU snapshot cache** in `helpers.ts`, charged in DECOMPRESSED JSON
  length rather than stored bytes — league snapshots are gzipped and expand by an
  order of magnitude, so charging the row size would let a nominally-8 MB cache
  pin hundreds of megabytes. The 48 MB budget was sized by measurement: one
  season's working set is the gamelog (16.5 MB) plus that season's leagueRoster
  and some small ones, and at 24 MB the two biggest evicted each other on every
  open — second player back to 190 ms, `getPlayerDevelopment` back to its full
  64 ms. At 48 MB they coexist and the second player opens in 47 ms.
  Correctness over hit rate: every write path
  clears the whole thing (`saveSnapshot`, `saveSnapshotCompressed`,
  `deleteDynasty`, the restore's direct row copy), and a `dbEpoch` counter in
  `init.ts` covers handle swaps. A generation counter rather than an import,
  because `helpers` already imports `init` and the reverse would be a cycle —
  and it can't be forgotten at a new call site, since replacing `db` is both what
  invalidates and what bumps it.
- **The common case resolves on its own.** Nine times out of ten the player is on
  the roster of the season the caller was already viewing: two small reads, and
  the hero paints. The exhaustive newest-first search across all seasons stays,
  as the exception it always was. The all-seasons aggregate runs alongside and
  fills in behind the tabs that need it.

### After

| | before | after |
|---|---|---|
| AUBURNW16, first open | 916 ms | **192 ms** |
| AUBURNW16, next player | — | **46–56 ms** |
| TESTER, first open | 224 ms | **90 ms** |
| TESTER, next player | — | **40 ms** |

Verified the data is still right, not just fast: Stats shows 12 game-log rows,
Career totals present, and History still builds the full milestone timeline
("First 400-yard passing game", "First four-touchdown game", weekly honors) —
all of which are exactly the things that would have gone blank if the scoped
fetch or the deferred aggregate were wrong.

### On prefetching

Worth writing down, because it's the intuitive answer and it's wrong here.
Prefetching the other tabs in the background would have moved the stall, not
removed it: the cost was one call shipping 16.5 MB to find thirteen rows, and
doing that early — on the main process's single synchronous thread — would have
made the *rest of the app* janky while the user browsed, in exchange for a modal
that opened faster. Fix the call, and there is nothing left worth prefetching;
the snapshot cache gives the same warm-second-open benefit for free, without
speculative work.

---

## Media photos zoom, using the card's control (2026-07-30)

User request: the same zoom the trading cards have, on media images.

**One control, two viewers.** The Media page's lightbox and the `MediaGallery`
used on player bios and the Game info page had structurally identical image
stages, so `ZoomableImage.tsx` replaces the bare `<img>` in both rather than
either growing its own copy. Same collapse the card work made a week's worth of
surfaces do.

**Same gesture, deliberately.** It's the card editor's slider — 1×–5×, 0.02 step,
team-coloured track — plus drag-to-move once past 1×. Someone who has framed a
card photo already knows how to use this, which is the entire reason for taking
the control from there instead of inventing one.

**Two things it does that the card's doesn't**, because a viewer is not an
editor:

- **It doesn't persist.** Card framing is part of the card and is written to the
  row. Here the zoom is how you're looking at a photo right now, so `src`
  changing resets it — which also covers Prev/Next swapping the photo under an
  open viewer.
- **The pan is clamped.** A card's framing is allowed to hang the photo off the
  edge; that's how you crop to a face. In a viewer it just loses the picture. At
  scale `s` the image overflows its box by `(s-1)/2` each way, so translation is
  bounded to exactly that. Verified by dragging 4000 px in one gesture and
  landing on the computed bound to the pixel: `translate(-581px, -348.6px)`
  against a predicted `-581 / -348.6`.

Two additions beyond the card, both because an image viewer invites them: the
wheel zooms, and a double-click snaps back to fit.

**The wheel listener is attached by hand, and has to be.** React registers
`wheel` on its root as PASSIVE, so `preventDefault()` inside an `onWheel` prop is
silently ignored (with a console warning) — and the page behind the overlay
scrolls away underneath the photo while you zoom. A non-passive listener on the
element is the only version that works. Worth remembering: the JSX form looks
correct and fails quietly.

The stages gained `overflow-hidden`, since a zoomed photo has to be clipped by
something. Verified in both viewers against real imported media; Help's Media
section documents it.

---

## A saved framing for media photos — the crop sticks, the file doesn't move (2026-07-30)

Follow-up to the media zoom. Users wanted the zoomed look kept: crop out the HUD
clutter, push in on the one player who matters, and have the photo read that way
from then on instead of re-doing it every open.

**Three numbers next to the row, and nothing else** (schema v14: `frame_x`,
`frame_y`, `frame_scale` on `media_items`). The image on disk is never
re-encoded, re-cropped or rewritten, and Reset returns the whole frame. Verified
rather than assumed: the media file's sha256 is byte-identical to the source PNG
after a framing was saved.

**That is exactly why a card is unaffected.** Pulling a media photo onto a
trading card already COPIES the file into `card-photos/<dynasty>/` and stores
that card's own pan/zoom on the card row (v12) — the two were always independent,
and keeping the framing as metadata is what preserves it. Proved end to end: the
same shot ended up at `{x: -0.145, y: -0.120, scale: 2.5}` in the gallery and
`{x: 77, y: -33, scale: 3.3}` on a card built from it, with the card reading from
its own copy at a different path, and neither disturbed the other.

### Fractions, not pixels

`frame_x`/`frame_y` are fractions of the photo's own displayed size. Pixels would
be wrong the moment the same framing is drawn at another size — and it is,
constantly: a full-screen viewer, a grid thumbnail, a laptop, a 4K monitor. As
fractions the value means the same thing everywhere, `translate()` takes it as a
percentage with nothing to measure, and the pan limit falls out as a pure number:
at scale `s` the photo overhangs its box by `(s-1)/2` each way, so both offsets
are bounded to exactly that. (The earlier pixel version needed `offsetWidth` to
clamp; this one doesn't need it at all except to convert a drag, which arrives in
screen pixels by definition.)

### Two decisions worth recording

**Transient until saved.** Zooming to read a scoreboard must not quietly become
how that photo looks forever, so nothing persists until asked. `Save framing`
only appears once the framing differs from what's stored, and `Reset` only once
there's something stored. Moving to another photo drops an unsaved zoom and picks
up that photo's own framing.

**The thumbnail follows.** A crop you saved and then couldn't see anywhere would
read as not having saved. Tiles stay `object-cover` with the framing riding on
top, so an un-framed tile looks exactly as it always did (no letterboxing, no
regression) and a framed one lands on the same part of the photo, cropped to the
tile's shape.

**Framing is the exception to MediaGallery's read-only rule**, deliberately.
Re-tagging which game a shot belongs to from a player's bio would be confusing —
the item spans seasons and the bio isn't where it's managed — but "this photo
should be cropped like THIS" is unambiguous wherever you're looking at it, and
refusing it there would mean walking to the Media page to fix a crop you're
staring at. It also gets its own IPC call rather than a field on
`MediaItemPatch`: that patch is the details form submitted as a unit, and folding
them together would mean either the form silently rewriting a framing set
elsewhere, or the viewer sending a whole patch it doesn't own.

Verified end to end: saved at 2.5× off-centre, survived a full app restart, the
thumbnail re-cropped to match, the original file unchanged, and a card built from
the same photo kept its own framing.

---

## Teambuilder imports, and the Program editor (2026-07-30)

User asked a direct question — did an imported "East Point" take Kent State's
TeamID? — and proposed an editor for stadium name and team artwork.

### The save, measured

`Dynasty Save Test/DYNASTY-EPUY01WK0START`, read with madden-franchise and
diffed against a stock save.

**No. East Point took Kent State's SLOT, not its identity.** `TeamIndex` 39 is
unchanged — it's the slot the whole app keys on, and it's stable — but every
field inside it was overwritten: `TEAM_ORIGID` 1148 → **1803**, `TEAM_LOGO` 48 →
**602**, `AssetName` `KENTXX` → **`CrcEPmcoLi`** (a random 10-character token),
and the display/short/nick names with it. Kent State is gone from the 143-team
table entirely.

**It is ten teams, not one**: UNH (slot 1, was Akron), Illinois State (9),
Montana (18), Montana State (25), Hawaii (31), East Point (39), Idaho (59), SDSU
(111), Florida A&M (132), Furman (135).

**And there is a reliable detector.** Stock `TEAM_ORIGID` runs 1100–1504 and
`TEAM_LOGO` 0–151; every imported team here sits at origId **1801+** / logoId
**600+**.

### Why their art breaks — and the alias trap

The app resolves logo, helmet, jersey and coach polo from the team's DISPLAY
NAME through the shipped library. Seven of the ten resolve fine, because the
library already carries FCS art (Illinois State, Montana, Montana State, Hawaii,
Idaho, Florida A&M, Furman). Three don't: UNH, SDSU, East Point.

My first instinct was that UNH and SDSU were a free two-line alias fix — the art
exists under `newhampshire` and `sandiegostate`. **Rejected on inspection**:
`southdakotastate` and `sanjosestate` are also in the library, so "SDSU" is
genuinely ambiguous and an alias would quietly hand some other user's team the
wrong school's helmet. Guessing from an abbreviation fails silently, which is the
worst way to fail. Upload is the honest answer.

### The editor

`Program editor` sits above `Program budget` on the Team Hub masthead, same
width (both `w-full` in a stretched column — two stacked buttons of different
widths read as an accident). Two tabs: **Identity** (stadium name, city) and
**Artwork** (four uploads).

Sizes shown in the UI are MEASURED off the shipped art, not chosen: 1024×1024 for
logo and helmet, 512×512 for jersey and polo. Telling a user a number the app
doesn't actually use would be worse than telling them nothing.

**Four uploads dress a team completely.** One logo serves the on-light and
on-dark variants, and the gold celebration variant is CSS-tinted from it rather
than demanding a gold version nobody has. One helmet serves both sides, with the
right-hand one mirrored at the call site — shipped art has a real right-side
render and is left alone.

### Two decisions that carry the design

**Keyed by `teamIndex`, scoped to one dynasty.** This is correctness, not taste:
the same save has a custom "Montana" and a custom "Hawaii", and the existing
global, name-keyed stadium store would have rewritten the REAL Montana and Hawaii
in every other dynasty the user opens. The row's identity is the slot; a
`team_name_key` rides alongside purely so the renderer can find it from a
component that only knows a name — safe because only one dynasty's rows are ever
loaded at a time.

**A registry in front of the resolvers, not props.** Team art resolves through
four pure functions called from a dozen components — mastheads, matchup
graphics, roster portraits, coach cards, trading cards, the hover preview, the
PNG export. Threading an override map through all of them would still have missed
the next caller. `programArt.ts` sits in front of the four resolvers instead, so
an uploaded logo appears everywhere a logo appears. `ProgramArtProvider` owns the
lifecycle and publishes a VERSION through context, because a plain module
variable can't tell React that a logo changed.

### Verified end to end

Imported EPUY01 into an isolated user-data dir, seeded a program row and art
files, and launched: the uploaded mark renders on the Team Hub masthead, the team
switcher and the roster portraits (12 program-art images on one page); the
`Program editor` button sits above `Program budget` at matching width; the saved
stadium name and city reach the Schedule page; and the modal opens on both tabs
with live previews on a checkerboard (so a transparent upload reads as
transparent rather than as a white rectangle). typecheck / lint / build clean.

Not covered: the file-picker dialog itself is Electron's, so the upload path was
exercised by seeding the row and files directly rather than by clicking through
a native dialog.

**Follow-up — the venue was blank in Game Info (2026-07-30).** User-defined
stadium showed on the Schedule page and nowhere else. The cause was mounting:
`ProgramArtProvider` sat inside `DynastyLayout`, but the game box score is a
GLOBAL modal (`GameDetailModal`, rendered in `app.tsx` alongside the player and
recruit modals) — outside the dynasty route, so `useProgramStadium` fell through
to its inert fallback and returned no override.

Only the STADIUM broke, which is what made it look arbitrary: artwork kept
working in the same modal, because the art registry is a plain module and reads
fine from anywhere — it's the React context carrying the stadium text that
wasn't there.

Fixed by hoisting the provider to wrap the whole shell, modal hosts included,
and reading the dynasty from `useMatch('/dynasty/:id/*')` instead of `useParams`
(params require being a descendant of the route that declares it; a match
doesn't). Both matches are called unconditionally and combined afterwards — `a
?? b` would have skipped the second hook whenever the first fired, which is the
conditional-hook rule exactly.

Also fixed while there: `getLocationDisplay` built `cityState` by interpolation,
so a user-defined venue — which has a city but no state, because the editor asks
for a city rather than an address — produced a dangling "East Point, " in the
Schedule page's Location column. Filtered and joined now.

Verified on the same save: the box score for a home game reads "Green Storm
Field, East Point", away games keep their real venues, and the uploaded helmet
renders inside the modal too.

---

## Player profile — five destinations (Phase 1 of the PlayerModal brief, 2026-07-31)

`docs/PlayerModal.md`, phases 0 and 1.

### Phase 0 — what opening a player actually costs

Baseline typecheck/lint/build: clean before starting (no pre-existing failures to
disentangle). Three effects fire on open, and the request inventory splits like
this:

**Tier 1, needed for first paint** — `getSeasons`, then `getRoster` +
`getPlayerStats` for the resolved season, and `getSeasonOverview` for the team
name. This is already the fast path after yesterday's perf work.

**Tier 2, Overview enhancement** — `getPlayerDevelopment` (the chart), and
`getPlayerGameLog` + `getSchedule` for the resolved season (latest game).

**Tier 3, currently EAGER and shouldn't be** — two whole effects:

- `loadAggregate`: `getAwards` × every season, `getRoster` + `getPlayerStats` ×
  every season, `getTeamAwardDefinitions`, `getTeamAwardResults` × every season.
  Only Performance/Career and Journey/Honors need any of it.
- the career-games effect: `getSeasons` again, then `getPlayerGameLog` +
  `getLeagueScores` + `getSchedule` for every season. Only Journey/Milestones
  needs it.

**Remaining duplicate**: `getSeasons` is called by both effects. Cheap (5 ms) but
it's the same call twice and belongs in the core resolver Phase 7 will build.

Deferring Tier 3 is Phase 7's job; Phase 1 deliberately didn't touch loading, so
the shell change and the data change stay separately reviewable.

### Phase 1 — the shell

Ten destinations became five: **Overview · Performance · Ratings · Journey ·
Cards**. The old set wasn't ten answers — Stats / Career / Game Log were all
"how is he performing", and Awards / Media / Notes / History were all "what has
happened to him". Ten tabs made the user do the consolidating.

Modes within a destination use the shared `SegmentedControl`, not a second
glider: Performance gets `This Season | Career | Games`, Journey gets
`All | Milestones | Honors | Media | Notes`. Mode is local state — a reading
preference for the current visit, with no claim from Prev/Next or any other
surface.

Overview's jump links now carry a mode with them (`goToPerformance('games')`
rather than `setTab('gamelog')`), because "Full stats" and "Game log" land in the
same destination and would otherwise both dump the user on whatever mode was open
last.

**One thing fixed beyond the brief**, because verification tripped over it: the
primary nav had no programmatic active state at all — the lit glider segment was
the only signal, which is a visual-only answer that no screen reader could read.
Added `aria-current`.

**Best Game now needs two games.** It was in the old Game Log tab unconditionally;
with one game played it's not a comparative best, it's just the game wearing a
superlative.

Verified in the running app: five destinations present, all eight old tab labels
gone, both mode switches render their content, and the selected destination
survives a Prev/Next player change. typecheck / lint / build clean.

**Deferred to later phases:** Overview is still the old tile composition (Phase
2), Ratings still wraps the raw attributes grid (Phase 4), Journey stacks its
existing sections rather than merging them into one sorted timeline (Phase 5),
and all Tier-3 loading is still eager (Phase 7).

### Phase 2 — Overview rebuilt around hierarchy (2026-07-31)

The brief's layout, implemented exactly:

```
Player profile   |  Development
Season snapshot  |  Player DNA
Latest journey event
```

**What it replaced:** six `BioTile` boxes stacked above three `OverviewCard`
boxes above the development chart — eleven bordered rectangles at the same
visual weight. That's a wall, not a hierarchy. Modules now carry structure in a
heading and a hairline (`SurfaceCard` + the app's section rhythm), and each owns
exactly one question. `BioTile` and `OverviewCard` are deleted, not left behind.

**One owner per field.** The hero was repeating the archetype, development trait,
height and weight that Overview's Player Profile also listed. The hero now keeps
only the six identity essentials — number, team, position, class, name, overall —
and Player Profile owns the supporting bio.

**Hero tightened**: 390px → **282px**, and the nav row moved from ~530px to
394px below the dialog top. Padding drops one step and `PlayerPortrait` gained a
`largeMaxHeight` prop so the hero could shorten the portrait WITHOUT losing the
full-body `object-contain` composition — dropping to a `size` step would have
cropped the cinematic shot into a headshot.

**Player DNA** is new: strength, weakness, develop-next, from
`player-profile/playerRatingRelevance.ts` — one typed position→rating map that
Phase 4's Ratings destination will share rather than duplicate. It returns nulls
rather than guesses: a historical player has no live ratings (the save state is
gone) and gets an honest sentence, not synthetic analysis. Its ratings read is
Tier 2 — fired inside the module, gating nothing, so the hero and the other four
modules are on screen before it resolves.

Verified on a real save: all five modules present, DNA reading `BSK 95 / TUP 77 /
TUP` for a scrambling QB, no duplicated bio, whole Overview visible without
scrolling. typecheck / lint / build clean.

**Still open:** Phase 3 (Performance is composed but not re-ordered around
progressive disclosure), Phase 4 (Ratings is still the raw grid — the DNA
utility is ready for it), Phase 5 (Journey stacks its sections under filters
instead of one merged timeline), Phase 7 (Tier-3 loading still eager).

### Phase 3 — Performance ordered by how fast each part answers the question (2026-07-31)

`This Season` now reads: **headline numbers → recent form → full season line →
game log**. Each step answers "how is he playing" more slowly and more completely
than the one above it, which is the progressive disclosure the brief asked for —
previously it opened straight into a full stat table and a log.

**Recent form** is new: the last five results as chips with each game's line. It
only renders with **two or more** results, for the same reason Best Game does —
one game isn't a trend, and the table two inches below already says what
happened.

**The game log became an index.** Rows are now keyboard-focusable buttons that
open the box score through the existing `GameDetailModal` rather than dead-ending.
The brief explicitly preferred this over building another navigation level inside
the profile, and it reuses a modal the app already has. Verified the layering:
clicking a row opens the box score above the profile, and Escape closes the box
score first, leaving the profile open — the Phase 8 requirement, met early
because this is the change that could have broken it.

Career is unchanged and deliberately so: career totals plus the season-by-season
table already emphasise comparison across time, and the brief's warning was
against re-showing the This Season tile grid under a new heading — which it
doesn't.

typecheck / lint / build clean; verified in the running app.

### Phase 4 — Ratings, and part of Phase 7 (2026-07-31)

**Ratings** replaced Attributes. It was ~50 identical bordered boxes in schema
order, which makes the reader do the evaluating. It now leads with **Player DNA**
(strength, weakness, develop-next, and OVR change when more than one season is
tracked), then the two rating groups that decide THIS position, with the
remaining four behind a **View all ratings** disclosure. Group order comes from
`orderedRatingSections` in the same `playerRatingRelevance` utility Overview's
DNA module uses — one position→relevance judgement, not two that drift. Labels,
abbreviations and keys still come only from `RATING_SECTIONS`.

**Phase 7, partially.** The career-games effect — `getSeasons` plus
`getPlayerGameLog` + `getLeagueScores` + `getSchedule` for EVERY season — no
longer runs on modal open. It's gated on Journey having been opened, and the gate
latches, so returning to Journey doesn't repeat the work. Verified both
directions: Overview open no longer triggers it, and Journey still renders its
8 milestones and honors afterwards.

**The all-seasons aggregate is still eager, deliberately.** Gating it the same way
does not work from inside the effect that owns it: the gate would have to join
that effect's dependency array, and that effect is the one that resolves the
player — so every tab change would refetch the roster and re-resolve the player
underneath the user. Doing it properly means lifting it into its own keyed hook,
which is the data-layer extraction Phase 7 describes and is too large to bolt on
to the existing effect. Left explicitly, with the reasoning in the code.

typecheck / lint / build clean.

### Phase 5 — Journey as one timeline (2026-07-31)

`playerJourneyEvents.ts` holds the canonical model and the merge. Milestones,
national awards, honor tiers, weekly honors and team awards become one
`PlayerJourneyEvent[]`, sorted once: season desc → week desc → a fixed kind
weight → the stable id. The final tiebreak matters — without it two awards from
the same season swap places between renders depending on array order, and a
timeline that reshuffles when you click a filter reads as broken. Verified by
asserting that entering All, leaving, and re-entering produces byte-identical
text.

`JourneyTimeline` replaced `HistoryTab` + `HonorsSection` + `TeamAwardsWonSection`
stacked together. Those three each sorted themselves, so a season's award could
never sit next to the milestones that earned it; the user was reading three lists
and interleaving them by eye.

**A bug the filter test caught.** `buildTimeline` had itself been merging honors
and team awards — it WAS the old History tab's whole timeline — so feeding its
output in as "milestones" merged honors twice, and the Milestones filter (which
selects on `kind === 'milestone'`) showed Player of the Week. `buildTimeline` is
now what its name says: the player's own career events. Journey adds honors on
top, typed as honors, with their week numbers intact — which is also how weekly
honors now sort into the right place within a season, something the old stacked
version couldn't do at all.

Media and Notes keep `PlayerMediaTab` / `PlayerNotesTab` under their own filters
rather than being folded into the merged stream: they own their fetches and their
editing, and the brief is explicit about reusing them rather than duplicating
gallery or note behaviour. The consequence is that `All` is milestones + honors,
not literally everything — see the open items below.

Verified: All interleaves both kinds, Milestones shows no honors, Honors shows no
milestones, Media and Notes still render, and the sort is deterministic across
filter changes. typecheck / lint / build clean.

### Review pass — Showcase, glider submenus, Overview rules (2026-07-31)

Four changes from the user's review of the refactored modal.

**Cards + Media became Showcase.** Both are things the USER made about this
player — cards they built, photos they tagged — and splitting them put "my stuff
about him" in two destinations. Journey drops its Media filter and keeps
`All | Milestones | Honors | Notes`; Media now lives beside Cards.

**Showcase uses the app's ToggleSwitch, not a mode nav**, because it is a PAIR.
A switch is for two states, a nav is for a set — and the switch carries the gold
team logo as its knob, so it reads as the same control the Roster ⇄ Transfers
row uses one layer up.

**Submenus now speak the navigation language.** Performance and Journey were
`SegmentedControl` — a filled box with a light active pill — which made the
submenu look like a component borrowed from elsewhere sitting under a glider nav.
Both now use `GliderNav` at `emphasis="quiet"` with smaller padding: same device,
quieter voice, so hierarchy still reads. One `ModeNav` helper, so the two can't
diverge.

**Overview is separated by rules, not gaps.** A vertical hairline down the middle
of the 2×2 and horizontals between the rows, in `--section-divider` — the app's
own line, not a new colour. The modules dropped `SurfaceCard`: cards would have
drawn four full outlines on top of the rules, which is two systems saying the
same thing. `divide-*` doesn't apply to grid tracks, so each cell carries its own
edge (left column a right rule, top row a bottom rule) with padding inside the
line to keep the columns off it.

Verified: nav reads Overview · Performance · Ratings · Journey · Showcase; the
Overview cells measure 1px rules on both axes; Journey's submenu renders as a
quiet glider with Media gone; Showcase exposes a real `role="switch"` and
flipping it swaps Cards for Media. typecheck / lint / build clean.

### Closing items (2026-07-31)

**Latest journey event** stopped showing the season marker. It was picking
`timelineEvents[0]` — newest, but "2026 Season · Senior · QB · 92 OVR" says
nothing the hero hasn't. It now takes the first event off the merged model that
isn't a plain season row, so it reads "National Offensive Player of the Week ·
Week 2". Only possible because Phase 5 built the canonical list; before that
there was no single sorted stream to take the first meaningful item from.

**Showcase gained its heading and count** — "Cards / 3 cards", or "None yet",
rendered only once the collection has loaded so a count never flickers in from
nothing. Overview's local `OverviewJourneyEvent` type was deleted in favour of
the canonical `PlayerJourneyEvent`; two shapes for one concept was exactly what
the model was built to stop.

**Light mode checked.** Rules resolve to `rgba(15, 23, 42, 0.12)` — the light
`--section-divider`, not a hardcoded colour — the hero surface stays the app's
own, and the whole Overview reads correctly. The glider is deliberately quieter
in light than the gold-and-bloom dark treatment; that's the established rule, not
a regression.

**Still open, and honestly:** the all-seasons aggregate is still eager (Phase 7's
last piece — it needs its own keyed hook, and the effect it currently lives in is
the one that resolves the player, so it isn't a small edit). The Phase 8 QA
matrix is partial: layering, keyboard, focus, filters, determinism and light mode
are verified; team-theme variety, responsive widths, and the data-state grid
(historical player, league-team player, slow/rejected IPC) are not.

### Toggle fixes from review (2026-07-31)

**Knob size.** I'd passed `!h-4 !w-4` on the Showcase switch's team logo — 16px
in a slot built for 35. The knob is deliberately TALLER than its 24px track so it
overhangs top and bottom; shrinking it removed the overhang and made this read as
a different, smaller control than the Roster ⇄ Transfers switch one layer up.
Now `h-[35px] w-[35px]`, matching `PairLayout` exactly. Measured against the real
reference on the page behind the modal: both 35×35.

**The modal no longer jumps on toggle.** Cards is a grid of ~360px tiles and
Media's empty state is three lines, so flipping the switch collapsed the modal by
a few hundred pixels — and threw the switch itself up the screen, out from under
the cursor that had just used it. The Showcase content sits on a `min-h-[26rem]`
FLOOR rather than a fixed height: the shorter side is held up, the taller side
still grows past it. Measured after: 949px on Cards vs 936px on Media, a 13px
delta, and the switch moves 6px.

Not zero, and worth saying why: the residual comes from the two sides' own
headings differing slightly in height. A fixed height would zero it and cost dead
space on every short state, which is the worse trade.

### Phase 7 complete — the aggregate loads on demand (2026-07-31)

The last eager Tier-3 load is gone. `loadAggregate` lifted out of the main effect
into a memoised loader with two guarantees that make it safe to call from several
places at once:

- **Deduped.** The in-flight promise is cached against a `(dynasty, player)` key,
  so Performance asking, Journey asking, and the player-resolution fallback
  asking at the same moment all await ONE request. A revisit is free.
- **Key-checked, not cancel-flagged.** A response arriving after the user has
  moved on is dropped by comparing the key it started under. The failure this
  replaces is an older player's awards landing on the newly selected one — the
  exact hazard of moving a fetch out of an effect whose cleanup used to cancel it.

The gate latches in state rather than reading `tab` directly, so leaving a
destination doesn't throw the data away, and it resets on player change.

**Why this needed the extraction rather than a flag.** Gating it inside the main
effect would have put the gate in that effect's dependency array — and that
effect is the one that RESOLVES THE PLAYER, so every tab change would have
refetched the roster and re-resolved the player underneath the user. The
`loadAggregate` reference is deliberately excluded from that array with a note,
because it's memoised on `(dynastyId, playerId)` which are already listed.

Verified end to end: click-to-hero **202 ms**; Overview renders complete
(profile + DNA) without the aggregate at all; Journey's honors and Performance's
career table both populate on first open; revisiting is instant with content
retained; and a deliberate rapid double Next-player switch left the correct
player in the hero with Journey rendering cleanly after — no stale crossover.

That closes Phase 7. Remaining from the brief: the Phase 8 QA matrix
(team-theme variety, responsive widths, historical/league-team/slow-IPC data
states) and the reconstructed `StatGroup` type worth a second look.

### Phase 8 QA — narrow width and empty data states (2026-07-31)

**At 1024px** (the app's enforced minimum): the five-destination nav fits on one
line with no wrap and no glider jitter, Performance's mode glider fits under it,
and the Overview grid keeps both rules with 1px on each axis. No dangling
vertical rule, no doubled borders.

Worth noting the grid stays TWO columns at 1024 because `lg:` is a viewport
query, not a container one — the modal is narrower than the viewport, so the
columns are ~450px each. It reads fine at that width; if the modal ever gets
narrower than about 800px the rules would want a container query rather than a
breakpoint.

**A player with nothing** (a freshman kicker, no games, no stats, no honors):
Overview renders in full with an honest "No stats recorded yet this season";
Performance shows no Recent Form (it needs two results) and no Best Game (it
needs two games), leaving just the game log's empty state. Every gate I added
held on the side that matters — the side where showing the thing would have been
a lie.

**Kicker ratings degrade honestly.** `POSITION_RATINGS` lists `kpw`/`kac` for K
and P, and those keys aren't in `RATING_SECTIONS` on this schema. `relevantRatings`
filters to keys that actually exist rather than trusting the map, so a kicker
gets a DNA built from what he really has instead of a confident 0 for a rating
the save never stored — which is exactly why that filter is there.

**Observed, NOT caused by this work and worth a look:** the teammate-rail
("Roster") button in the modal header is absent at 1024px, where Prev/Next and
Close remain. That's in `PlayerProfileModal`'s header, untouched by this
refactor, but the brief's QA asks that the rail stay usable at narrow widths —
so it needs confirming as intentional rather than a casualty of the header
running out of room.

**Still not covered:** team-theme variety (very bright / very dark primaries),
a genuinely historical multi-season player, a league-team player with limited
data, and slow or rejected IPC.

### QA corrections (2026-07-31)

**The ratings "hang" was NOT a bug.** Confirmed by the user in the real app:
Player DNA, the position-ordered grid and the "View all ratings (4 more groups)"
disclosure all render correctly, with the teammate rail open or closed. The
symptom was an artifact of my scratch verification environment. The `.catch`
added to both ratings reads stays — a rejected save read still ought to land on
the honest empty state rather than a permanent spinner — but it is a defensive
addition, not a fix for anything that was broken.

**A single save file can never produce a multi-season archive.** `DYNASTY-TESTER4`
imports as 2028 full + 2027 and 2026 HISTORY-ONLY, and no player has a
development arc longer than one season. This is not a property of that save: a
save carries only the CURRENT season's roster, so any single import yields one
full season plus history-only entries for prior years (the same finding the
past-season-backfill research reached from the other direction).

To exercise the multi-season paths — the development curve, the OVR-change
readouts in Player DNA and Ratings, and a genuinely historical player — the
archive needs SUCCESSIVE saves imported into the same dynasty. The repo has the
material: `Dynasty Save Test/Full Season Saves/DYNASTY-AUBURNW16` (season 1) and
`DYNASTY-AUBURNW31SEASON2W0` (season 2) are the same dynasty a year apart, so
importing both into one user-data dir builds a real two-season archive. That is
the outstanding QA, and it needs ~10 minutes of import before any of it can be
looked at.

**Teammate rail vanishing at 1024px is intentional** (confirmed by the user), so
that observation is closed rather than outstanding.

### Closing note — the philosophy this refactor established (2026-07-31)

User direction on closing: **fluidity and efficient navigation are the standing
approach**, not a one-off brief. Recorded to memory as
`feedback_fluid_navigation`.

The principle worth carrying forward is the test that drove every decision here:
**count the QUESTIONS, not the data sources.** Team Hub had 11 tabs and the
player modal had 10, and neither was 11 or 10 answers — Stats / Career / Game Log
were one question asked three ways, and Awards / Media / Notes / History were
another. A surface with more destinations than it has questions is making the
user do the consolidating.

Everything else followed from that: modes live inside a destination rather than
beside it; submenus speak the navigation language (glider, quiet) with a
ToggleSwitch reserved for genuine pairs; one owner per field; merged views need
one deterministic sort rather than sections that each sort themselves; sections
divide with rules, not boxes; content that swaps under a control needs a height
floor so the control doesn't move out from under the cursor; and nothing loads
that isn't on screen.

**Final state:** all eight phases of `docs/PlayerModal.md` implemented.
typecheck / lint / build clean. Two items carried forward, both documented above:
a two-season archive still needs building from successive Auburn saves before the
multi-season paths can be exercised, and the `StatGroup` union was reconstructed
from its call sites rather than recovered.

### Player switching — a regression I caused, and the fix (2026-07-31)

User reported Prev/Next feeling slower. It was, and it was mine.

**Cause.** `getPlayerEditData` re-opens and re-parses the ENTIRE 9.6 MB save file
on every call — measured at ~1,430 ms. That was tolerable while ratings were only
read when the user opened the Attributes tab. Phase 2 put a Player DNA module on
OVERVIEW, which reads the same thing — so every modal open and every Prev/Next
started paying a second and a half to answer one question about one player.

**Fix.** A one-entry franchise cache for READ paths, keyed on save path + file
mtime. Play a week in-game and the mtime moves, so the next read reopens the file
— the cache cannot serve a stale roster. Writes bypass it entirely and clear it
(`invalidateFranchiseCache`, called before all three `franchise.save` sites),
because a write must operate on a freshly-opened file it then saves back.

**Measured after:**

| | before | after |
|---|---|---|
| ratings read, first in session | ~1,430 ms | ~1,430 ms (unavoidable — the save must be parsed once) |
| ratings read, every one after | ~1,430 ms | **7 ms** |
| Prev/Next, click to new player rendered | — | **51 ms** |

The win generalises: the player and recruit editors read through the same path,
so opening an editor after the first read is now instant too.

### Sticky navigation + History team gating (2026-07-31)

**Both nav rows now pin.** The scroll container is `<main>` in app.tsx and the
nav rows lived inside it, so on a long page (History, Statistics) the section
tabs, the team tabs and the season switcher all scrolled out of reach — changing
any of them meant scrolling back to the top. The section nav pins at `top-0`
(keeping its `-mt-5` so it doesn't float above main's padding) and the Team Hub
sub-nav at `top-[4rem]` beneath it. Measured: section row holds at 73px through a
1,200px scroll, sub-nav at 137px, 1px overlap with the section row painting over
it (z-30 vs z-20) — flush rather than a hairline of content showing through.
Backgrounds match the panel (`bg-black` in dark is the panel's own value) so text
passes under rather than ghosting through.

**History stopped attributing the user's records to another school.** With Akron
selected the masthead correctly said Akron — and then the Golesh era block and
Auburn's record book rendered underneath it, so Stan White and Pat Sullivan
appeared as Akron records. `getHistory(dynastyId)` takes no team index and always
returns the user's own program; the page swapped the title without gating the
body. Those sections are now hidden when another team is viewed, which is what
the page's own copy already claimed ("tracked for your own program only").

**This is a stopgap and the real fix is cheap.** `extract-teams.ts` already reads
`Team.{Career,Season,Game}StatRecords` into `TeamData.schoolRecords` for EVERY
team, so each school's own record book is sitting in the snapshot unused.
Teaching `getHistory` to take a team index and read from there makes the section
real for any school, at which point the gate comes out. Wrong data stated as
fact is worse than missing data — that's the only reason to ship the gate first.

### Hero tightened again, and a conflict it exposed (2026-07-31)

**Hero 282px → 210px**, and the nav row now sits 322px from the dialog top. Three
changes: padding down a step, portrait 15rem → 11rem, and the identity column is
no longer `flex-1`. That last one is what closed the horizontal void — stretching
it pushed the OVR to the far wall, so on a 1,100px hero the number and the name
it belongs to had ~600px of nothing between them. The OVR now sits 32px from the
name and reads as one unit with it. Trailing space at the right of a wide bar is
quieter than a gap between two things that belong together.

House style, stated by the user and worth holding to: **tight and snug, bold
where boldness earns it** (the portrait, the OVR) — not padding stretched to fill
a container.

**REGRESSION FOUND, NOT FIXED — Overview's "Latest journey event" is now empty on
first open.** It reads "Nothing recorded yet" for a player who has a Week 2
National Offensive Player of the Week, and only fills in after Journey has been
visited.

Cause is two of this refactor's own phases meeting: Phase 2 put a latest-event
module on Overview, and Phase 7 deferred BOTH of that module's sources — honors
come from the all-seasons aggregate and milestones from career games, and neither
loads until Performance or Journey is opened. So the module promises a career
event and shows an empty state on the one destination that opens by default.

Three ways out, none of them large:
- give the module a CHEAP source — the current season's awards alone (one
  `getAwards`, ~130 KB) rather than every season's;
- let Overview trigger the aggregate after an idle callback, accepting the cost
  where it isn't blocking anything;
- or drop the module, which the layout would survive.

The first is the most honest — it shows what it can prove cheaply and stops
claiming nothing happened when something did.

### Masthead portrait + the latest-event fix (2026-07-31)

**Latest journey event is honest again.** Overview now reads THIS season's awards
directly — one `getAwards` — instead of waiting on the all-seasons aggregate that
Phase 7 defers to Journey. Byrum Brown's Overview reads "2026 · National
Offensive Player of the Week · Week 2" on first open again, where it had been
claiming nothing had happened. The aggregate still wins once it lands; this is
only the floor. ~130 KB against N × that, on the one destination everybody opens.

**The portrait is full size again, and the masthead ignores its bounds.** The
diagnosis was the user's: a portrait PNG is a 512² canvas with the subject
sitting low in it, so a third of the top of the file is transparent. Laid out
normally the box reserves height for that emptiness — which is what read as a fat
gap above the head — and shrinking the portrait "fixed" it by making the art
smaller, which was the wrong lever entirely.

So it's drawn large (15rem, 240px rendered) and the box is pulled back in with
`-my-8`, exactly as GameDetail's HelmetImg does. The overlap region is the PNG's
own transparent padding, so the hero's height reflects the visible art rather
than the canvas it was exported on. Measured: hero 210px, portrait 240px,
overhanging symmetrically 15px top and bottom.

**Residual, and worth naming.** The image BOX is now symmetric, but the art
inside it still sits low in its own canvas, so there is more clear space above
the head than below the shoulders. The box maths is right; the file's composition
isn't centred. The proper finish is the same trick the trading card already uses
in `PlayerPortrait`'s `fill` mode — `translateY(-23%) scale(1.08)`, derived from
the shared 512² composition — applied to the hero at a smaller magnitude. Not
done here; it wants a measured value rather than a guess.

### Masthead, second pass — OVR right, jersey bleeds, and where this stopped (2026-07-31)

**`items-end`, not `items-center`.** The portrait is anchored to the masthead's
floor and drawn taller than the row, so the torso bleeds off the bottom instead
of being sliced. Centring was the cause of the broken look: it re-split the PNG's
transparent top evenly above and below the box, which left a gap over the head
AND a hard cut through the jersey. The OVR went back to the far right where it
was, with the identity column stretching to push it there.

**A finding worth keeping: SIZE IS THE WRONG LEVER for vertical position.**
Trying to get the head to the masthead's top edge by drawing the portrait taller
(22rem) worked and simultaneously ruined it — `object-contain` scales the whole
512² image, so the head grew by the same factor and the bottom edge then landed
on the chin. A face sliced mid-jaw. Reverted to 17rem, which reads cleanly.

**So the "player reaches the top" ask is NOT delivered**, and it needs a
translate rather than a resize: shift the art up without scaling it. The app
already does exactly this for the trading card — `PlayerPortrait`'s `fill` mode
uses `translateY(-23%) scale(1.08)`, a value derived from the shared 512²
composition. The hero wants the same treatment at its own magnitude, measured
against several portraits rather than guessed at, because a wrong value there
crops heads.

### The jersey misalignment — cause and fix (2026-07-31)

Not a sizing problem. `PlayerPortrait` renders two images: the portrait `<img>`,
which receives `className`, and the team jersey `<img>`, positioned
`absolute inset-0` against the WRAPPER span the two share.

So passing `-mb-10` through `className` put a negative margin on the portrait
only. That shortened the wrapper by 40px while the portrait kept its own height —
and the jersey, sized to the wrapper, came up 40px short of the body it exists to
register against. The overlay is built to sit on a 512² portrait one-to-one, so
any desync between the two boxes reads instantly as a broken player.

Fix: the bleed moved to the hero's own wrapper `<div>`, where it belongs.
`className` goes to the image; anything that changes LAYOUT goes on your own
element. Measured after: portrait and jersey both 272×272 at the same top and
left, exact.

A caller warning now sits at the overlay in `PlayerPortrait` — this is a trap
worth signposting, because the two images look independent in the JSX and the
failure only shows up as art that doesn't line up.
