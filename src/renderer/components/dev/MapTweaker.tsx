import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * DEV-ONLY dial-board for the record banner's map backdrop.
 *
 * WHY IT EXISTS. Tuning this by editing globals.css and rebuilding is a ~30s
 * round trip per guess, and the settings that matter (opacity against a dark
 * team colour, whether the drift reads as motion) can only be judged by looking
 * at them for a while. This puts the same controls the standalone HTML probe
 * had onto the real banner, over real team colours, with the real image.
 *
 * IT NEVER SHIPS. The whole component is behind
 * `process.env.NODE_ENV !== 'production'` at its single call site; webpack
 * replaces that with `false` under `--mode=production` and drops the branch and
 * this module with it. Verified by grepping the production bundle for
 * TWEAKER_MARKER — see DevLog.
 *
 * WHAT IT CANNOT CHANGE: the map STYLE and ZOOM. Those are baked into the
 * pre-rendered images by scripts/render-team-maps.js, so changing them means a
 * re-render, not a CSS edit. Everything here is compositing and motion.
 *
 * HOW IT APPLIES. It writes a real <style> element rather than inline styles,
 * because @keyframes cannot be expressed inline — and the drift's scale/translate
 * are the most interesting things to tune. That also means "Copy CSS" hands back
 * a block that can be pasted into globals.css verbatim.
 */

/** Present in the source so a production-bundle grep can prove this was stripped. */
const TWEAKER_MARKER = 'DYNASTYOS_MAP_TWEAKER';

/** The values currently shipped in globals.css — "Reset" returns here. */
const SHIPPED = {
  opacity: 30,
  blend: 'luminosity',
  duration: 240,
  easing: 'ease-in-out',
  scaleFrom: 1.02,
  scaleTo: 1.08,
  translate: 0.6,
  translateY: 0.35,
  falloff: 100,
  grid: 16,
};

type Settings = typeof SHIPPED;

const BLENDS = ['luminosity', 'overlay', 'soft-light', 'normal', 'multiply', 'screen', 'hard-light', 'color-dodge'];
const EASINGS = ['ease-in-out', 'linear', 'ease', 'cubic-bezier(0.4, 0, 0.6, 1)'];

function css(s: Settings): string {
  return `.team-map-backdrop {
  opacity: ${s.opacity / 100};
  mix-blend-mode: ${s.blend};
  animation: team-map-drift ${s.duration}s ${s.easing} infinite alternate;
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 ${s.falloff}px, #000 calc(100% - ${s.falloff}px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 ${s.falloff}px, #000 calc(100% - ${s.falloff}px), transparent 100%);
}
.team-map-grid { opacity: ${s.grid / 100}; }
@keyframes team-map-drift {
  from { transform: scale(${s.scaleFrom}) translate3d(-${s.translate}%, ${s.translateY}%, 0); }
  to   { transform: scale(${s.scaleTo}) translate3d(${s.translate}%, -${s.translateY}%, 0); }
}`;
}

/** Peak on-screen travel, so the "felt not seen" target can be judged numerically. */
function peakPxPerSec(s: Settings, widthPx: number): number {
  const fromX = -(s.translate / 100) * widthPx;
  const toX = (s.translate / 100) * widthPx;
  const edgeTravel = (Math.abs(s.scaleTo - s.scaleFrom) * widthPx) / 2 + Math.abs(toX - fromX);
  const average = edgeTravel / s.duration;
  // ease-in-out peaks at roughly twice its average rate; linear is flat.
  return s.easing === 'linear' ? average : average * 2;
}

export function MapTweaker() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(SHIPPED);
  const [copied, setCopied] = useState(false);
  const sheet = useMemo(() => css(s), [s]);

  useEffect(() => {
    const id = 'map-tweaker-style';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = sheet;
    // Restart the animation so a changed keyframe takes effect immediately
    // rather than at the end of a 240-second cycle.
    document.querySelectorAll<HTMLElement>('.team-map-backdrop').forEach((n) => {
      n.style.animation = 'none';
      void n.offsetHeight;
      n.style.animation = '';
    });
    return () => {
      el?.remove();
    };
  }, [sheet]);

  const width = typeof window !== 'undefined' ? Math.min(window.innerWidth - 340, 1500) : 1200;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  const num = (k: keyof Settings, min: number, max: number, step: number) => (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{k}</span>
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={s[k] as number}
          onChange={(e) => set(k, Number(e.target.value) as Settings[typeof k])}
          className="w-28"
        />
        <span className="w-10 text-right tabular-nums text-[11px] text-slate-200">{s[k] as number}</span>
      </span>
    </label>
  );

  /*
    PORTALLED TO <body>, and it has to be. The banner it sits inside wears
    `.corner-cut`, whose clip-path both CLIPS fixed descendants and makes the
    banner their containing block — so a `fixed bottom-3 right-3` panel rendered
    in place lands inside the banner and gets its right edge cut off. Same trap
    the playoff bracket's hover card hit; same fix.
  */
  if (!open) {
    return createPortal(
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-marker={TWEAKER_MARKER}
        className="fixed bottom-3 right-3 z-[200] border border-white/20 bg-black/80 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-slate-200 hover:border-white/40"
      >
        Map tweaker
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div
      data-marker={TWEAKER_MARKER}
      className="fixed bottom-3 right-3 z-[200] w-[300px] space-y-2 border border-white/20 bg-black/90 p-3 text-[11px] text-slate-200 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Map tweaker · dev only</span>
        <button type="button" onClick={() => setOpen(false)} className="px-1 text-slate-400 hover:text-white">
          ✕
        </button>
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">blend</span>
        <select
          value={s.blend}
          onChange={(e) => set('blend', e.target.value)}
          className="w-40 border border-white/15 bg-black px-1 py-0.5 text-[11px]"
        >
          {BLENDS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">easing</span>
        <select
          value={s.easing}
          onChange={(e) => set('easing', e.target.value)}
          className="w-40 border border-white/15 bg-black px-1 py-0.5 text-[11px]"
        >
          {EASINGS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>

      {num('opacity', 0, 100, 1)}
      {num('grid', 0, 60, 1)}
      {num('falloff', 0, 400, 5)}
      {num('duration', 20, 600, 10)}
      {num('scaleFrom', 1, 1.2, 0.01)}
      {num('scaleTo', 1, 1.4, 0.01)}
      {num('translate', 0, 5, 0.05)}
      {num('translateY', 0, 5, 0.05)}

      <p className="border-t border-white/10 pt-2 text-[10px] leading-4 text-slate-400">
        Peak travel ≈ <span className="tabular-nums text-slate-200">{peakPxPerSec(s, width).toFixed(2)} px/sec</span>
        <br />
        Under ~0.5 is felt, not seen. Style and zoom are baked into the image — re-render to change those.
      </p>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(css(s));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="flex-1 border border-white/20 px-2 py-1 hover:border-white/40"
        >
          {copied ? 'Copied' : 'Copy CSS'}
        </button>
        <button
          type="button"
          onClick={() => setS(SHIPPED)}
          className="border border-white/20 px-2 py-1 hover:border-white/40"
        >
          Reset
        </button>
      </div>
    </div>,
    document.body,
  );
}
