# Portrait Storage Assessment — Technical Recommendation

**Date:** 2026-07-18
**Status:** Assessment only — no implementation yet. All numbers below are real measurements from this machine, not estimates.

---

## 1. Current-state findings

### The asset library

| Folder | Files | Total | Avg/file | Format |
|---|---|---|---|---|
| `public/assets/playerportrait` | 25,527 | **4.70 GB** | 184 KB | 512×512 PNG, 8-bit RGBA (all have alpha) |
| `public/assets/coaches` | 695 | **698 MB** | 1,025 KB | 512×512 PNG, 8-bit RGBA |
| `public/assets/3d_logos` | 431 | 165 MB | — | (out of scope, but noted) |
| **Portrait total** | 26,222 | **5.39 GB** | | |

- Dimensions verified by reading PNG IHDR headers across a 200-file spread sample: **uniformly 512×512, color type 6 (truecolor + alpha)**. No mipmaps, no size variants — one master per asset.
- Coach PNGs are ~5.6× larger per file than player PNGs at the same dimensions — they are very inefficiently encoded PNGs, which is why they compress so spectacularly (see §5).
- **Zero byte-identical duplicates** — SHA-1 hashed all 25,527 player files: 0 duplicates, 0 MB wasted. Content-addressed dedupe storage would gain nothing.
- Filename suffix inconsistency (from the original offline export): 24,639 files end `_result.png`, 887 end `_result_result.png`, 1 ends `_result_result_result.png` (`Blank`). These are *not* duplicates — each asset exists exactly once, under exactly one of those suffix forms.

### Where the size actually hurts (multiplication)

The same bytes exist up to **four times** on this machine:

1. `public/assets/` — 5.4 GB (source of truth)
2. `dist/renderer/assets/` — copied by webpack on every build. **`dist/` is 7.4 GB and is never cleaned** — it currently contains ~2 GB of stale files deleted from `public/` long ago (e.g. an old 1.68 GB `3d_logos` set vs. today's 165 MB).
3. `release/win-unpacked/` — 2.6 GB (from an older, smaller asset set; a fresh package today would be ~7.4 GB unpacked).
4. electron-builder's installer output — `files: ['dist/**/*']` ships the entire library inside every installer.

### How portraits are resolved today (code audit)

- The SQLite database stores **only bare asset-name strings** (e.g. `Generic_0001_P_T0000_D_1_1`) — extracted from the save's `GenericHeadAssetName` field. No paths, no extensions, no blobs. This is true for current rosters, recruits, leaguewide portraits, and historical season snapshots alike.
- Renderer: [playerAssetMapping.ts](../src/renderer/lib/playerAssetMapping.ts) builds **3 candidate relative URLs** (`_result_result` / `_result` / bare) and `PlayerPortrait.tsx` walks them via `<img onError>` — meaning up to 2 failed requests per portrait render, purely because of the suffix inconsistency. [coachAssetMapping.ts](../src/renderer/lib/coachAssetMapping.ts) hardcodes the single `_result` form.
- Portraits load **directly via relative URLs** from `dist/renderer/assets/` — no IPC, no custom protocol, no base64, no runtime conversion of any kind. The main process touches the folder only for the Portrait Picker's search (`searchPortraits` in `editorWrite.ts` does `fs.readdirSync` and strips the suffixes with a regex).
- Missing files already fall back gracefully to an initials avatar.
- Backups (both the automatic DB backups in AppData and the manual save-file backup) contain **no image files** — correct, since the library ships with the app and is not user data. User data footprint is small and healthy: 26 MB live DB + 251 MB rolling backups.

## 2. DDS formats detected

**None — there are no DDS files anywhere on this machine.** This is the single most important audit finding, because it invalidates the premise of several requested options:

- Project tree: zero `.dds` files (the webpack `ignore: ['**/*.dds']` rule is vestigial — it guarded against a race with the *offline* conversion workflow that produced the PNGs, *while it was running*).
- Game install (`D:\Arcade\EA SPORTS College Football 27`): zero loose `.dds` files. Per the prior investigation recorded in [References/EA_FILES_FINDINGS.md](../References/EA_FILES_FINDINGS.md), the game stores all textures inside compressed Frostbite `.cas`/`.sb` superbundle archives (~46.6 GB, 214 files). Portraits inside them are not individually addressable files; extracting them requires a Frosty-Toolsuite-class Frostbite unpacker, which that investigation already assessed as out of scope for this app (specialized multi-year reverse-engineering effort, no product need, and bulk-extracting a commercial game's packed assets from inside the app is territory we deliberately declined).

**Implication:** the PNG library in `public/assets` is not a "cache" of a still-available source — it **is the master asset set**. The DDS intermediates it was converted from no longer exist. Any architecture built around "decode the original DDS on demand" has no source to decode.

## 3. Dependencies / tools evaluated

- System tools: no ImageMagick, no ffmpeg, no cwebp, no avifenc on this machine.
- **`sharp` v0.34 (libvips): installed as a devDependency during this assessment and verified working** on this exact Windows/Node setup (prebuilt binary, no build step, encodes WebP and AVIF with alpha). It does **not** decode DDS (libvips has no DDS loader) — irrelevant here since no DDS exists.
- Chromium (Electron renderer) decodes WebP and AVIF natively — zero new runtime dependencies needed to *display* either format.
- Production dependencies remain native-module-free (`sql.js` is WASM; `madden-franchise` is pure JS). `sharp` is needed only by the one-time offline conversion script and **never ships in the app**.

## 4. Option comparison

| Option | Verdict | Why |
|---|---|---|
| **A. Direct DDS decoding at runtime** | **Not buildable** | No DDS source exists at runtime — not in the game install (Frostbite archives), not on disk. Would require embedding a Frostbite unpacker (rejected previously for scope and appropriateness). |
| **B. Lazy DDS→WebP cache** | **Not buildable as specified; its goal is achievable more simply** | Same missing-source problem. A lazy cache also *requires shipping the full-size sources anyway* — it would save nothing here. A one-time, build-side conversion of the whole library achieves the identical end state (compact WebP on disk) with zero runtime machinery. |
| **C. Lazy DDS→AVIF cache** | **Not buildable / not worth it** | Same missing source. On merit: AVIF measured only ~25% smaller than WebP q80 at 2.1× the encode time, with slower decode on image-dense pages. Not worth the complexity for ~150 MB extra. |
| **D. In-memory conversion only** | **N/A** | Nothing to convert from at runtime. |
| **E. Archive/pack file** | **Partially useful, as a packaging detail only** | Zero byte-identical duplicates measured, so packing saves no *size* beyond what compression does. Reducing 25K loose files does help installer/copy speed — electron-builder's standard **asar** packaging gives this for free and should be considered *after* the size problem is fixed. |
| **F. SQLite BLOB storage** | **Rejected** | Would put ~850 MB into the database whose current healthy size is 26 MB, multiply every rolling backup (10 kept), and put the entire portrait library inside the corruption blast radius that the existing quarantine/restore flow exists to protect against. The DB storing bare asset-name strings is already the right model. |
| **G (emergent). One-time offline recompression of the master library to WebP** | **Recommended** | See §5-6. Real measured savings of ~85-90% with no runtime architecture change, no new production dependencies, no cache management, no custom protocol, and no migration of any database content. |

## 5. Measured storage savings (real conversions, this machine)

**Player portraits — 100-file representative spread sample (17.36 MB PNG, all with alpha):**

```text
Sample size: 100 portraits (spread-sampled across all 25,527)

Current PNG total:        17.36 MB   (avg 178 KB)
WebP lossless total:      10.93 MB   (63.0% of PNG)
WebP q90 512px total:      3.03 MB   (17.4% — avg ~31 KB)
WebP q80 512px total:      2.05 MB   (11.8% — avg ~21 KB)
WebP q80 256px total:      0.78 MB   ( 4.5%)
WebP q80 128px total:      0.31 MB   ( 1.8%)
AVIF q60 512px (n=20):     avg 16 KB ( 8.8%)
Encode speed: ~52 ms per WebP encode, ~111 ms per AVIF encode (single-threaded)
```

**Quality verification (not just size):** decoded the WebP back to raw pixels and compared against the original — mean absolute pixel error 1.45/255 (q90) and 1.75/255 (q80). A side-by-side visual check of original vs. q90 vs. q80 at full 512px shows no visible difference, including the alpha-edge hair fringe (the hardest region for lossy alpha). Transparency is fully preserved.

**Coach portraits — 40-file sample:** WebP q90 = **2.2%** of PNG; q80 = 1.5%. (Their source PNGs are extremely inefficient.)

**Projected full-library totals:**

| | Today (PNG) | WebP q90 | WebP q80 |
|---|---|---|---|
| Player portraits | 4.70 GB | **~820 MB** | ~555 MB |
| Coach portraits | 698 MB | **~15 MB** | ~10 MB |
| **Total** | **5.39 GB** | **~835 MB (−84.5%)** | **~565 MB (−89.5%)** |

And because the library is currently duplicated into `dist/` and the installer, real disk reclaimed on this machine is roughly **2× that** (~9 GB counting the stale `dist/`), and every future installer shrinks by ~4.5 GB.

Full-library conversion time at ~52 ms/file: ~22 min single-threaded, **~3-5 min with 8 parallel workers**. One-time cost.

## 6. Recommended architecture

**One-time, build-side recompression of the master library to WebP q90 at 512×512, with filename normalization. No runtime conversion, no cache tiers, no custom protocol.**

```text
public/assets/playerportrait/nilpp_<asset>.webp   (25,527 files, ~820 MB)
public/assets/coaches/nilcp_<asset>.webp          (695 files, ~15 MB)
        |
        |  (webpack CopyWebpackPlugin, unchanged)
        v
dist/renderer/assets/...                           (clean rebuild)
        |
        v
Renderer <img src="assets/playerportrait/nilpp_<asset>.webp">   (single candidate, no onError chain)
```

Rationale against the more elaborate tiering/caching designs in the original brief — each concern is *already satisfied* by the app's existing architecture once the sources are compact:

- **"Survive game uninstall"** — already true today: the app never reads game files at runtime. The library ships with the app. Historical seasons store asset-name strings that resolve against the app-shipped library forever.
- **"Preserve historically important portraits"** — already true: *every* portrait ships, so every historical player, award winner, and record holder resolves. At ~31 KB each, selective preservation machinery (importance tracking, finalization hooks, protected archives, cleanup confirmation flows) would add real complexity to save at most a few hundred MB over shipping everything — and would break the Portrait Picker, which legitimately needs the entire library to browse.
- **"Fast after first use"** — faster than today: Chromium decodes WebP natively, and files are ~6× smaller, so I/O drops. There is no first-use conversion at all.
- **"Don't bloat SQLite"** — unchanged: DB keeps storing bare asset names (26 MB total).
- **"Alpha + quality in modals"** — verified above at q90/512.
- **"Renderer security / custom protocol"** — no change needed: assets are static app files loaded by relative URL, same as today. There is no filesystem access to broker.
- **Missing-file fallback** — the existing initials avatar already handles this; it stays.

**Recommended parameters:** q90 (not q80) for the 15%-of-original safety margin on quality — the extra ~270 MB is cheap insurance; a single 512px master per asset (no thumbnail tier). Justification: the largest render target is the profile modal at `max-h-[22rem]` ≈ 352 CSS px, which at ~1.5-2× display scaling wants 512-704 device px — so 512 is the right master and is *already* the source ceiling. List thumbnails (64-112 px) downscale a 31 KB image in-GPU; a 60-portrait picker page is ~1.9 MB total, trivial. A second 128/256px tier would roughly double file count for marginal gains — add later only if a real profiling need appears.

**Filename normalization (fold into the same pass):** emit every file as `nilpp_<asset>.webp` — no `_result`/`_result_result` suffixes. This eliminates the 3-candidate `onError` chain (up to 2 failed HTTP-ish requests per portrait today), the doubled-suffix special case in `PortraitPicker.tsx`, and the suffix-stripping regex in `searchPortraits`.

### Code changes required (small, centralized)

1. [playerAssetMapping.ts](../src/renderer/lib/playerAssetMapping.ts) — return one `.webp` path instead of 3 PNG candidates.
2. [coachAssetMapping.ts](../src/renderer/lib/coachAssetMapping.ts) — `.webp`, drop `_result`.
3. `searchPortraits` in [editorWrite.ts](../src/main/editorWrite.ts) (~line 419) — accept `.webp`, simplify suffix regex.
4. [PortraitPicker.tsx](../src/renderer/components/common/PortraitPicker.tsx) — simplify `portraitPath()` (drop `doubleResultSuffix`), remove the double-suffix retry comment/logic.
5. Doc-comment touch-ups: `portraitTaxonomy.ts`, `extract-coaches.ts`.
6. New `scripts/convert-portraits.js` — the one-time sharp conversion script (stays in repo for reproducibility; sharp remains a devDependency only).

`PlayerPortrait.tsx`/`CoachPortrait.tsx` and every page consuming them: **no changes** (they already take whatever the mapping returns). Database: **no changes of any kind**.

## 7. Migration plan

1. **Archive the PNG masters first** (they are the only master — the DDS intermediates are gone): move `public/assets/playerportrait` and `public/assets/coaches` out of the project to e.g. `D:\PROJECT\portrait-master-png\` (external drive copy recommended too). Do **not** delete them. Note: today's `CFB27-Hub-Backups/2026-07-18_182325` deliberately excluded `public/`, so this archive step is the backup for these files.
2. Run `scripts/convert-portraits.js`: read archived PNGs → emit normalized `.webp` into fresh `public/assets/playerportrait/` + `coaches/` (parallel, ~3-5 min). Script verifies: output count == unique asset count (25,527 + 695), every output decodes, and spot-checks alpha preservation.
3. Apply the 5 code changes above; `npm run typecheck && npm run lint`.
4. **Delete `dist/` entirely and rebuild** (also purges the ~2 GB of unrelated stale files). Consider adding a `clean` step to the build script so dist rot doesn't recur.
5. Verify live (standing screenshot discipline): Roster grid, Portrait Picker (search + filters + current-portrait preview), player modal, coach cards, Awards pages, a historical season's roster, and a deliberately-missing asset name (initials fallback).
6. Only after verification: the archived PNG folder stays as the offline master (never shipped). Rollback path = restore archived PNGs + revert the 5-file code change.
7. Optional follow-ups, separate passes: asar packaging (file-count/installer speed), applying the same treatment to `3d_logos`/`rivalry`/`bowlgames` (~200 MB more available), `npm run clean` wiring.

## 8. Backup implications

- User-data backups (SQLite): unchanged — they never contained images and still shouldn't.
- The portrait library's backup is the **archived PNG master folder** (step 1) — a one-time external archive, not part of routine backups.
- App footprint per installed copy drops ~4.5 GB; `Productivity/`-style project backups get dramatically cheaper if `public/` is ever included in the future.

## 9. Risks and limitations

- **Lossy conversion is one-way** — mitigated by archiving the PNG masters before deletion (step 1 is mandatory, not optional).
- **q90 quality** — measured at 1.45/255 mean pixel error and visually verified, but the sample was 100 of 25,527; the conversion script's spot-check plus normal app usage is the practical guard. Any individually-bad portrait can be re-encoded lossless (63%) from the archive.
- **Future portrait additions** — new assets (e.g. a future game-version extraction) must go through the same convert-and-normalize script; the script staying in `scripts/` covers this.
- **DDS support** — genuinely not needed by this app today. If a future workflow re-introduces DDS extraction, that's an offline tooling concern (the conversion script gains a DDS decode step via a CLI tool like `texconv`), still never a runtime app feature.
- The `webpack.config.js` DDS-ignore comment should be updated to reflect reality (no DDS in the tree) rather than silently confusing a future audit — cheap doc fix during implementation.

## 10. Estimated implementation complexity

**Low — roughly one session.** ~30 lines of production code changed across 4 files + doc comments, one ~80-line offline script, one clean rebuild, and the standard verification pass. No schema migration, no IPC changes, no new production dependencies, no runtime subsystems. The bulk of the wall-clock time is the one-time conversion (~5 min) and verification screenshots.

---

**Bottom line:** the brief's preferred direction (lazy DDS→WebP cache with historical tiers) is built on a premise the audit disproved — there is no DDS source to lazily convert from, and the app already survives game uninstall by construction. The measured, simpler equivalent — a one-time WebP q90 recompression of the master library with normalized names — delivers the actual goal: **5.39 GB → ~835 MB (−84.5%)**, faster loads, less code than today (the fallback-chain hack disappears), and zero new runtime complexity.
