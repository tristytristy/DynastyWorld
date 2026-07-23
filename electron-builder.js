/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.antigracity.cfb-dynasty-hub',
  productName: 'CFB Dynasty Hub',
  // The heavy image data (portraits, logos, trophies — ~900 MB) ships as a
  // SEPARATE one-time Asset Installer (build/assets-installer.nsi), so it is
  // excluded here to keep the app installer small. The app serves those over
  // cfbmedia:// from the user's external image-data folder (see assetRoot.ts).
  // Tiny assets the app needs to boot + render the fallback screen (fonts,
  // splash, wordmark, conference SVGs) stay bundled.
  files: [
    'dist/**/*',
    '!dist/renderer/assets/playerportrait/**',
    '!dist/renderer/assets/coaches/**',
    '!dist/renderer/assets/3d_logos/**',
    '!dist/renderer/assets/bowlgames/**',
    '!dist/renderer/assets/awards/**',
    '!dist/renderer/assets/confchamp/**',
    '!dist/renderer/assets/playoffs/**',
    '!dist/renderer/assets/icons/**',
    'package.json',
  ],
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
