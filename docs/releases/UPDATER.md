# In-app auto-updates — how it works, how to ship it

DynastyOS updates itself. The app checks GitHub Releases, downloads the
installer **inside the app** with visible progress, saves everything that is
still in flight, closes, installs, and reopens. No browser, no Save dialog, no
hunting for a file in Downloads.

---

## The pieces

| Piece | File |
| --- | --- |
| State machine, GitHub wiring, safe shutdown | `src/main/updater/updateService.ts` |
| IPC handlers (4 calls + 1 link opener) | `src/main/updater/updateIpc.ts` |
| "Is a long job running?" registry | `src/main/updater/taskRegistry.ts` |
| Shared state types | `src/shared/updateTypes.ts` |
| Renderer hook | `src/renderer/data/useUpdater.ts` |
| The panel (every state) | `src/renderer/components/common/UpdatePanel.tsx` |
| The corner notice on launch | `src/renderer/components/common/UpdateNotice.tsx` |
| Size/speed formatting | `src/renderer/lib/updateFormat.ts` |
| Publish + installer config | `electron-builder.js` |

**The state lives in the main process.** A download outlives a renderer reload,
so the renderer asks for the current state when it mounts and then listens for
pushes. It never holds the truth.

### State flow

```
idle ──check──▶ checking ──▶ not-available ──▶ (idle)
                     │
                     └──▶ available ──download──▶ downloading ──▶ downloaded
                                                                      │
                                                              install │
                                                                      ▼
                                                     [safe-shutdown check]
                                                        ok │        │ refused
                                                           ▼        ▼
                                                      installing   downloaded
                                                     (quit+relaunch) (+reason)

any step can fail ──▶ error (with a human message, and "Try again" when it makes sense)
```

### The safe-shutdown check

Before the installer is allowed anywhere near the app, `prepareForInstall()`:

1. asks `taskRegistry` whether an import, sync, backup, restore, export or media
   import is running — if so it **refuses** and names the job;
2. asks the database whether a batched write is open (`isDatabaseWriteInProgress`)
   — during a batch the file on disk is deliberately behind memory, and quitting
   there loses the batch;
3. flushes anything a batch left pending (`flushPendingWrites`);
4. only then calls `autoUpdater.quitAndInstall(false, true)` — visible installer,
   relaunch after.

It refuses rather than waits. A backup of a large dynasty can run for a minute,
and silently hanging the update on it is worse than saying "not yet" — the user
keeps a working app and a clear reason either way.

### Turning it off

**Preferences → Check for updates on startup.** Off means the main process makes
no request at launch at all — it is enforced in `scheduleStartupCheck()`, not by
hiding the result, and the log line says `startup check skipped — turned off in
Preferences`. The manual check in About still works, because asking is different
from being asked, and nothing ever downloads or installs without a click either
way.

The setting lives in `<userData>/update-prefs.json`, owned by the main process —
it has to, because the launch check runs before any renderer exists to be asked.
A user who had already turned off the old localStorage flag keeps that choice:
`migrateLegacyUpdatePref()` carries an explicit `false` across once and then
removes the old key.

---

## Building a release

```bash
# 1. bump the version (this is the single source — everything else reads it)
npm version 4.0.1 --no-git-tag-version

# 2. production build + installer (COMPLETE: app + all artwork, ~1 GB)
npm run package

# 2b. or the slim installer (app only; artwork ships separately, ~105 MB)
SLIM_INSTALLER=1 npx electron-builder      # bash
$env:SLIM_INSTALLER=1; npx electron-builder # PowerShell
```

Artifacts land in `release/`.

## Publishing a release

The updater needs **all three** of these on the same GitHub Release, and the tag
must match the version in `package.json`:

| Asset | Why |
| --- | --- |
| `DynastyOS-Setup-<version>.exe` | the installer the updater downloads |
| `latest.yml` | **the update feed** — without it the app finds nothing |
| `DynastyOS-Setup-<version>.exe.blockmap` | lets the updater fetch only changed chunks |

### The filename is not cosmetic — it broke 4.2.0

`latest.yml` names the installer it expects, and the name must match **exactly**.
Builds are hyphenated (`artifactName` in `electron-builder.js`) precisely so this
cannot drift, because the two upload paths disagree about spaces: electron-builder
converts them to **hyphens**, while GitHub's web uploader converts them to
**periods**. 4.2.0 shipped with `DynastyOS.Setup.4.2.0.exe` attached against a feed
asking for `DynastyOS-Setup-4.2.0.exe`; every update check 404'd and the app
reported *"No update information has been published yet"* — which reads as a
missing feed and was really a missing binary. If you ever see that message, check
the asset name on the release **before** suspecting the feed.

Renaming the file is enough to fix it; the checksum is unaffected.

```bash
# option A — let electron-builder create and upload the release (preferred)
npx electron-builder --publish always
# Uploads to a DRAFT (publish.releaseType), so nothing reaches users until you
# press Publish on the release page. Reads GH_TOKEN from the environment.

# option B — build locally, upload by hand
npx electron-builder                          # then attach all three assets
gh release create v4.0.1 \
  release/DynastyOS-Setup-4.0.1.exe \
  release/DynastyOS-Setup-4.0.1.exe.blockmap \
  release/latest.yml \
  --title "DynastyOS 4.0.1" --notes-file docs/releases/GITHUB_RELEASE_v4.0.1.md
```

Publishing creates a **draft**. Drafts are invisible to installed copies — not
because of `releaseType` (electron-updater never reads that field) but because
GitHub's `releases.atom`, which the updater polls, cannot list a draft. Press
Publish when the notes are ready and it goes live. Prereleases are a separate
question, gated on `allowPrerelease` (default false).

**Set `GH_TOKEN` as a user environment variable, not in a shell you might screenshot.**
A fine-grained token scoped to this one repository with `Contents: Read and write`
is enough. Note that such a token can publish an installer that every existing
copy will download and install automatically — treat it like a signing key, not
like a config value.

> The GH_TOKEN is only ever used on the machine doing the publishing. It is
> never read by the app, never bundled, and never needed by a user.

---

## Testing an update end to end

1. Build and install **the older version** (e.g. 4.0.0) with its NSIS installer.
2. Bump to 4.0.1, build, and publish the release with all three assets.
3. Launch the installed 4.0.0.
4. Wait ~6 seconds — the quiet startup check runs, and the corner card appears.
   (Or open **About → Check for updates**.)
5. Click **Update DynastyOS** and watch the progress bar, size and speed.
6. Click **Restart and Update** when it says *Ready to install*.
7. Confirm: the app closes, the installer runs, DynastyOS reopens, and About
   shows 4.0.1.
8. Confirm your dynasties, media, cards and preferences are all still there.
9. Confirm no Save dialog appeared, no browser opened, and nothing was left in
   a Downloads folder.

**Also worth exercising:** decline with *Later* (the card stays dismissed for
that version); pull the network cable mid-download; start an import and then try
to install (it should refuse and name the import); click *Restart and Update*
twice.

---

## Known limitations

- **The app is unsigned.** Updates download and install fine, but Windows
  SmartScreen may warn on the installer, and Windows will not silently elevate
  it. Code-signing (an EV or OV certificate) is the only fix; nothing in the
  updater can work around it.
- **The repository must be public**, or every installed copy would need a
  GitHub token to read the feed — and a token shipped inside an app is a token
  given away. If DynastyHub is ever made private, updates need a different
  distribution channel (a plain HTTPS host with `latest.yml`), not a token.
- **Existing 3.x installs cannot auto-update to 4.0.0.** Those builds shipped
  before this updater existed, and no earlier release contains a `latest.yml`.
  The first release published with these assets is the last one anybody has to
  install by hand.
- **Portable builds do not self-update.** `DynastyOS <version>.exe` has no
  installer to run; the updater is for the NSIS installation.
