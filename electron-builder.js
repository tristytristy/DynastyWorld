/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.antigracity.cfb-dynasty-hub',
  productName: 'CFB Dynasty Hub',
  files: ['dist/**/*', 'package.json'],
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
