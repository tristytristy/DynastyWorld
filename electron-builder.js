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
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
