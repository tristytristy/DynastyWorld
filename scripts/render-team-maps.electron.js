/**
 * The Electron half of scripts/render-team-maps.js — kept separate because
 * MapLibre needs a real WebGL context, which only the Electron runtime provides.
 * Not part of the app; never packaged (scripts/ is excluded from the asar).
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'teammaps');
const cfg = JSON.parse(fs.readFileSync(path.join(OUT_DIR, '_targets.json'), 'utf8'));

// SwiftShader so this works on a machine with no usable GPU, and identically in CI.
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

/*
  `areTilesLoaded()` is TRUE THE INSTANT 'load' FIRES, before a single tile has
  been requested — polling it naively captured 138 identical black rectangles.
  So the wait is: style loaded, AND tiles report loaded, AND a floor of 1.5s has
  passed. `overflow:hidden` kills the scrollbars that were otherwise painted
  into the capture.
*/
const PAGE = `<!doctype html><html><head><meta charset="utf-8" />
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet" />
<style>html,body{margin:0;padding:0;overflow:hidden;background:#000}
#m{width:${cfg.width}px;height:${cfg.height}px}
.maplibregl-ctrl-attrib,.maplibregl-ctrl-bottom-right,.maplibregl-ctrl-bottom-left{display:none!important}</style>
</head><body><div id="m"></div><script>
let map=null;
window.render=(lat,lon)=>new Promise((resolve)=>{
  if(map){map.remove();map=null;}
  map=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/${cfg.style}',
    center:[lon,lat],zoom:${cfg.zoom},interactive:false,attributionControl:false,fadeDuration:0});
  let settled=false, failed=false;
  const done=(ok)=>{if(settled)return;settled=true;resolve(ok&&!failed);};
  map.on('error',()=>{failed=true;});
  map.on('load',()=>{
    const t0=Date.now();
    const poll=()=>{
      if(settled)return;
      const elapsed=Date.now()-t0;
      if(elapsed>25000) return done(false);
      if(map.areTilesLoaded() && elapsed>1500) return done(true);
      setTimeout(poll,300);
    };
    poll();
  });
  setTimeout(()=>done(false),30000);
});
</script></body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: cfg.width,
    height: cfg.height,
    show: false,
    useContentSize: true,
  });
  // A real file rather than a data: URL — MapLibre spawns its workers from blob
  // URLs, which a null origin can refuse.
  const pagePath = path.join(OUT_DIR, '_render.html');
  fs.writeFileSync(pagePath, PAGE);
  await win.loadFile(pagePath);

  let ok = 0;
  const failed = [];
  for (let i = 0; i < cfg.targets.length; i++) {
    const t = cfg.targets[i];
    const dest = path.join(OUT_DIR, `${t.key}.webp`);
    process.stdout.write(`[${String(i + 1).padStart(3)}/${cfg.targets.length}] ${t.label} ... `);
    let loaded = false;
    try {
      loaded = await win.webContents.executeJavaScript(`window.render(${t.lat},${t.lon})`);
    } catch (e) {
      console.log('render threw: ' + String(e.message).slice(0, 60));
      failed.push(t.label);
      continue;
    }
    if (!loaded) {
      console.log('TILES FAILED — skipped');
      failed.push(t.label);
      continue;
    }
    // A beat for the last tiles to paint before the read.
    await new Promise((r) => setTimeout(r, 900));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: cfg.width, height: cfg.height });
    await sharp(img.toPNG()).webp({ quality: 82 }).toFile(dest);
    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(`${kb} KB`);
    ok++;
  }

  fs.rmSync(pagePath, { force: true });
  console.log(`\nrendered ${ok}, failed ${failed.length}`);
  if (failed.length) console.log('failed: ' + failed.join(', '));
  app.quit();
});
