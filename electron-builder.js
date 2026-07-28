// The heavy image data (portraits, logos, trophies, helmets, jerseys) can ship
// two ways:
//   • COMPLETE (default): everything bundled in one installer — app + graphics.
//   • SLIM (SLIM_INSTALLER=1): the media is EXCLUDED and ships separately via the
//     one-time Asset Installer (build/assets-installer.nsi + npm run package:assets);
//     the app then serves it over cfbmedia:// from the user's external folder.
// 0.6.0 ships COMPLETE (the graphics library just expanded — helmets + jerseys —
// so one download is simpler); the slim path stays wired for a future update.
const SLIM = process.env.SLIM_INSTALLER === '1';
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
  win: {
    target: ['nsis', 'portable'],
    // Generated from public/Icon/ICON.png by scripts/make-icon.js — rerun that after changing the source art.
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
