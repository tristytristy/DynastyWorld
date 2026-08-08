import { useCallback, useEffect, useState } from 'react';
import { CONTENT_LIBRARY } from '../../../shared/assetPacks';

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

  /*
    Through the update flow's link door — https and GitHub hosts only. Worth
    reusing rather than opening a second one: the check is the valuable part, and
    two of them is two places for it to be relaxed.
  */
  const download = useCallback(() => {
    void window.api.update.openLink(CONTENT_LIBRARY.downloadUrl);
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
          that installs once and stays put across app updates. The app couldn&apos;t find it. If you haven&apos;t
          installed it yet, download it below. If you already have the folder (for example after moving to a new PC),
          point the app to it instead.
        </p>
        {invalid && (
          <p className="mt-4 border-l-4 border-red-500 bg-red-500/10 p-3 text-sm text-red-300">
            That folder doesn&apos;t look like the image-data folder. Pick the folder that contains{' '}
            <span className="font-mono">playerportrait</span>, <span className="font-mono">3d_logos</span>, etc.
          </p>
        )}
        {/*
          THE DOWNLOAD LEADS, because it is the answer for almost everyone who
          reaches this screen: a first install, with no folder to locate yet.
          "Locate" is the recovery path for the smaller group who already have the
          library and moved it — real, but second. The old screen offered only
          that one, and told a brand-new user to go and run an "Asset Installer"
          it gave them no way to get.
        */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={download}
            className="border border-amber-500/60 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
          >
            Download content library ({CONTENT_LIBRARY.sizeLabel})
          </button>
          <button
            type="button"
            onClick={locate}
            disabled={busy}
            className="border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? 'Locating…' : 'I already have it — locate the folder…'}
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          The download opens in your browser. Run the installer, then click{' '}
          <strong className="font-semibold text-slate-400">locate the folder</strong> — or just restart DynastyOS, which
          finds it on its own. The app remembers the location, so you only do this once.
        </p>
      </div>
    </div>
  );
}
