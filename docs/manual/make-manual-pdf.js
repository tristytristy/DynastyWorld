// Renders docs/manual/manual.template.html to a styled PDF user manual.
//
//   npm run manual        (see package.json "manual" script)
//   or:  electron docs/manual/make-manual-pdf.js
//
// The template carries placeholders that this script inlines at build time so
// the PDF is fully self-contained (fonts + logo embedded as data URIs) and the
// version always matches package.json:
//   __INTER400/500/600/700__  -> public/assets/fonts/inter-latin-*.woff2
//   __LOGO_MARK__             -> public/assets/Logo/Logo-mark.png
//   __SPLASH__                -> public/assets/splash/spshscr.png
//   __VERSION__               -> package.json version
// All assets are baked in as data URIs so the PDF is a portable standalone file.
// (The in-app manual.html instead references these assets from the app bundle —
//  see the CopyWebpackPlugin transform in webpack.config.js.)
//
// Output: "Dynasty Hub - User Manual.pdf" in docs/manual/ (beside this script).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HERE = __dirname; // docs/manual
const ROOT = path.resolve(HERE, '..', '..'); // repo root
const FONTS = path.join(ROOT, 'public/assets/fonts');
const LOGO = path.join(ROOT, 'public/assets/Logo/Logo-mark.png');
const SPLASH = path.join(ROOT, 'public/assets/splash/spshscr.png');
const OUT_PDF = path.join(HERE, 'Dynasty Hub - User Manual.pdf');

function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const version = require(path.join(ROOT, 'package.json')).version;

let html = fs.readFileSync(path.join(HERE, 'manual.template.html'), 'utf8');
html = html
  .replace(/__INTER400__/g, dataUri(path.join(FONTS, 'inter-latin-400-normal.woff2'), 'font/woff2'))
  .replace(/__INTER500__/g, dataUri(path.join(FONTS, 'inter-latin-500-normal.woff2'), 'font/woff2'))
  .replace(/__INTER600__/g, dataUri(path.join(FONTS, 'inter-latin-600-normal.woff2'), 'font/woff2'))
  .replace(/__INTER700__/g, dataUri(path.join(FONTS, 'inter-latin-700-normal.woff2'), 'font/woff2'))
  .replace(/__LOGO_MARK__/g, dataUri(LOGO, 'image/png'))
  .replace(/__SPLASH__/g, dataUri(SPLASH, 'image/png'))
  .replace(/__VERSION__/g, version)
  // The standalone PDF is a shipped artifact — always clean, no dev build stamp.
  .replace(/__BUILD_LABEL__/g, '');

// Written next to the template but gitignored — a transient render input.
const MANUAL_HTML = path.join(HERE, 'manual.rendered.html');
fs.writeFileSync(MANUAL_HTML, html);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { offscreen: true } });
  await win.loadFile(MANUAL_HTML);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((r) => setTimeout(r, 400));

  const pdf = await win.webContents.printToPDF({
    pageSize: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    landscape: false,
  });
  fs.writeFileSync(OUT_PDF, pdf);
  try { fs.unlinkSync(MANUAL_HTML); } catch { /* best effort */ }
  console.log(`[manual] wrote ${OUT_PDF} (${(pdf.length / 1024).toFixed(0)} KB, v${version})`);
  app.quit();
});
