// The heavy image data (portraits, logos, trophies, helmets, jerseys) can ship
// two ways:
//   • SLIM (the default): the media is EXCLUDED and ships separately via the
//     one-time Asset Installer (build/assets-installer.nsi + npm run
//     package:assets); the app serves it over cfbmedia:// from the user's
//     external folder. ~105 MB.
//   • COMPLETE (COMPLETE_INSTALLER=1): everything in one installer, app +
//     graphics. ~1 GB.
//
// SLIM IS THE DEFAULT BECAUSE IT IS WHAT SHIPS. Every release since 3.0.1 has
// been slim — the ~927 MB library is published once (last at v3.0) and survives
// app updates, so re-shipping it on every point release costs a gigabyte of
// download to change nothing. It used to be the other way round, with slim
// behind an opt-in env var and a comment claiming "0.6.0 ships COMPLETE"; that
// comment outlived the decision by five releases and duly produced a 1 GB
// 4.3.0 build. The default now matches reality, and the exception is the thing
// you have to ask for.
//
// Rebuild the asset installer ONLY when a folder in MEDIA_GLOBS actually gained
// or changed files. Art that lives outside those globs (teammaps, rivalry,
// conf, fonts, splash) travels inside the app either way and needs nothing.
const SLIM = process.env.COMPLETE_INSTALLER !== '1';
const MEDIA_GLOBS = [
  'dist/renderer/assets/playerportrait/**',
  'dist/renderer/assets/coaches/**',
  'dist/renderer/assets/3d_logos/**',
  'dist/renderer/assets/bowlgames/**',
  'dist/renderer/assets/awards/**',
  'dist/renderer/assets/confchamp/**',
  'dist/renderer/assets/playoffs/**',
  'dist/renderer/assets/icons/**',
  'dist/renderer/assets/helmet/**',
  'dist/renderer/assets/jersey/**',
  // Coach polos — the staff counterpart to the player jerseys, so they belong
  // in the same image-data bucket rather than being the one team-art folder
  // that stays baked into a slim app build.
  'dist/renderer/assets/coachpolos/**',
];

/** @type {import('electron-builder').Configuration} */
module.exports = {
  // Deliberately UNCHANGED across the DynastyOS rename: Windows identifies an
  // installed app by this id, so changing it would make the next installer look
  // like a different program — users would end up with two entries in Add/Remove
  // Programs and two Start Menu shortcuts rather than an update. Invisible to
  // users either way.
  appId: 'com.antigracity.cfb-dynasty-hub',
  productName: 'DynastyOS',
  // '!**/*.map' keeps sourcemaps OUT of what ships. webpack emits them in every
  // mode, and a source-map carries `sourcesContent` — the original TypeScript,
  // comments and all — so shipping them put the whole renderer source inside the
  // installer (2+ MB of it). They're still written to dist/ for local debugging;
  // they just don't leave this machine.
  files: ['dist/**/*', '!**/*.map', ...(SLIM ? MEDIA_GLOBS.map((g) => `!${g}`) : []), 'package.json'],
  // In the COMPLETE build the media is bundled — unpack it from the asar so the
  // cfbmedia:// handler (fs.readFile in the main process) serves real files, and
  // getAssetsRoot's bundled-fallback sentinel check resolves. No-op in a slim
  // build (those folders aren't packaged).
  asarUnpack: MEDIA_GLOBS,
  directories: {
    output: 'release',
  },
  /*
    WHERE THE UPDATER LOOKS. electron-updater reads this same block at runtime
    (electron-builder writes it into app-update.yml inside the package), so the
    app and the publisher can never disagree about which repository is
    authoritative — which is exactly the bug you get from hardcoding the repo in
    two places.

    `releaseType` ONLY AFFECTS WHAT PUBLISHING CREATES, not what the app accepts.
    An earlier note here claimed it kept drafts out of the update feed; that is
    not the mechanism. electron-updater's GitHubProvider never reads this field —
    checked in node_modules, zero references. It works off GitHub's
    `releases.atom`, which cannot list drafts because drafts are not public, and
    it gates prereleases separately on `allowPrerelease` (default false).

    So `draft` is the safe setting AND the useful one: `--publish always` uploads
    the artifacts to a draft that no installed copy can see, and going live stays
    a human decision made on the release page. With `release` here, a publish
    command would put a build in front of every user the moment it finished
    uploading — which is the wrong default for a step that cannot be undone once
    someone's app has started downloading.
  */
  publish: [
    {
      provider: 'github',
      owner: 'matevanz',
      repo: 'DynastyHub',
      releaseType: 'draft',
    },
  ],
  win: {
    /*
      NSIS ONLY (user direction, 4.3.0). The portable exe was dropped: it runs
      noticeably worse — every launch unpacks the whole app to a temp folder
      first — and it cannot be updated in place, so it also sits outside the
      in-app updater this project spent real effort on. One artifact, one
      install path, one update story.
    */
    target: ['nsis'],
    // Generated from public/Icon/ICON.png by scripts/make-icon.js — rerun that after changing the source art.
    icon: 'build/icon.ico',
  },
  /*
    ARTIFACT NAMES MUST NOT CONTAIN SPACES, and this is not cosmetic.

    electron-builder's defaults are "DynastyOS Setup 4.2.0.exe", but its GitHub
    publisher replaces spaces with HYPHENS when uploading — which is why the
    generated `latest.yml` asks for `DynastyOS-Setup-4.2.0.exe`. Upload the same
    file by hand through the web UI instead and GitHub substitutes PERIODS,
    producing `DynastyOS.Setup.4.2.0.exe`. The feed then points at a filename
    that does not exist, every update check 404s, and the app reports "No update
    information has been published yet" — which sounds like a missing feed and
    is actually a missing binary. That cost a released 4.2.0 its updates until
    the assets were renamed by hand.

    Naming them with hyphens up front makes the two paths agree: what is built,
    what the feed asks for, and what lands on the release are the same string
    whether the upload is automated or manual.

    Set PER TARGET rather than globally — the shape this had when nsis and
    portable would otherwise have collided on one name. Single-quoted so
    `${...}` reaches electron-builder as its own template syntax rather than
    being interpolated by JavaScript.
  */
  nsis: {
    artifactName: '${productName}-Setup-${version}.${ext}',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    /*
      The updater relaunches the app itself after installing (see
      updateService.ts), so the installer must not also try to start it — two
      launches race each other and the second one loses to the single-instance
      lock, which reads to the user as "the update didn't reopen".
    */
    runAfterFinish: false,
  },
};
