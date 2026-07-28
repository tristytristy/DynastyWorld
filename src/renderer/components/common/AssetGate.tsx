import { useCallback, useEffect, useState } from 'react';

type GateState = 'checking' | 'ok' | 'missing';

/**
 * Gates the app on the presence of the external image-data folder. The heavy
 * assets (portraits, logos, trophies) ship as a separate one-time installer the
 * user places wherever they like (see assetRoot.ts / the cfbmedia:// protocol).
 * If the app can't auto-detect that folder, this shows a friendly "locate it"
 * screen instead of rendering the app full of broken images. Once the user
 * points to a valid folder, the app reloads so every path re-resolves.
 */
export function AssetGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let active = true;
    window.api.assets
      .getStatus()
      .then((s) => active && setState(s.found ? 'ok' : 'missing'))
      .catch(() => active && setState('missing'));
    return () => {
      active = false;
    };
  }, []);

  const locate = useCallback(async () => {
    setBusy(true);
    setInvalid(false);
    try {
      const res = await window.api.assets.chooseFolder();
      if (res.invalid) {
        setInvalid(true);
      } else if (res.found) {
        window.location.reload();
        return;
      }
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === 'checking') return null;
  if (state === 'ok') return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
      <div className="w-full max-w-xl border border-white/10 bg-slate-900/70 p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-400">Setup</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Image data not found</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          DynastyOS&apos;s player faces, team logos, and trophies live in a separate <strong>image-data folder</strong>{' '}
          that installs once and stays put across app updates. The app couldn&apos;t find it — if you haven&apos;t
          installed it yet, run the <strong>Asset Installer</strong> first. If you already have the folder (for example
          after moving to a new PC), just point the app to it below.
        </p>
        {invalid && (
          <p className="mt-4 border-l-4 border-red-500 bg-red-500/10 p-3 text-sm text-red-300">
            That folder doesn&apos;t look like the image-data folder. Pick the folder that contains{' '}
            <span className="font-mono">playerportrait</span>, <span className="font-mono">3d_logos</span>, etc.
          </p>
        )}
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          className="mt-6 border border-amber-500/60 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
        >
          {busy ? 'Locating…' : 'Locate image data folder…'}
        </button>
        <p className="mt-4 text-xs text-slate-500">
          The app remembers this location, so you only pick it once.
        </p>
      </div>
    </div>
  );
}
