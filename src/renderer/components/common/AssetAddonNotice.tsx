import { useEffect, useState } from 'react';
import { PRIMARY_BTN, SECONDARY_BTN } from './UpdatePanel';
import type { AssetAddonStatus } from '../../../shared/types';

/** Remembers which packs the user waved off, so the card doesn't reappear every launch. */
const DISMISS_KEY = 'cfbhub.dismissedAssetAddons';

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * "NEW ARTWORK IS AVAILABLE" — the notice the slim-install split makes necessary.
 *
 * Portraits and logos live outside the app installer, so when a game patch adds
 * some, no app update can deliver them and the user has no way to find out. They
 * would simply keep seeing a generic capped model where Bill Belichick should be,
 * with nothing anywhere telling them a fix exists.
 *
 * A CARD IN THE CORNER, for the same reason UpdateNotice is one: this is
 * optional, small, and not worth a dialog across the middle of somebody's
 * dynasty. It also deliberately shows ONE pack at a time — a stack of cards in
 * the corner is a to-do list, and the newest missing pack is the one worth
 * asking about.
 *
 * There is no in-app download. The app has an updater for ITSELF, and none for
 * artwork; pretending otherwise with a progress bar that ends at "now go run this
 * installer" would be worse than the honest handoff of opening the release page.
 * The link goes through the same narrow, GitHub-only door the update flow uses.
 */
export function AssetAddonNotice() {
  const [pack, setPack] = useState<AssetAddonStatus | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  useEffect(() => {
    let cancelled = false;
    /*
      ONE CARD IN THE CORNER AT A TIME. UpdateNotice claims the same fixed
      position, so without this the two would sit on top of each other on any
      launch that has both an app update and missing artwork.

      The app update wins, and not arbitrarily: it is time-sensitive, it is one
      click, and it is the only one of the two that changes what the app can do.
      Artwork waits a launch. Asking the updater directly — rather than trying to
      re-derive whether that card is on screen — means this cannot fall out of
      step with UpdateNotice's own conditions; the worst case is being one launch
      shy, which is the right way to be wrong about a card nobody asked for.
    */
    Promise.all([window.api.assets.getAddons(), window.api.update.getState().catch(() => null)])
      .then(([addons, update]) => {
        if (cancelled) return;
        if (update?.status === 'available' || update?.status === 'downloaded') return;
        setPack(addons.find((a) => !a.installed) ?? null);
      })
      .catch(() => {
        /* leave the card hidden rather than guessing at what's on disk */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pack || dismissed.includes(pack.id)) return null;

  const dismiss = () => {
    const next = [...dismissed, pack.id];
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* non-fatal — it just means we ask again next launch */
    }
    setDismissed(next);
  };

  /*
    Dismiss on download too. The user has been handed the installer, and the card
    has done its job — leaving it up would nag someone who is mid-way through
    doing exactly what it asked. If they close the browser without installing,
    the probe finds the files still missing and the card returns next launch.
  */
  const download = () => {
    void window.api.update.openLink(pack.downloadUrl);
    dismiss();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="corner-cut fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] border border-[var(--surface-raised-border)] bg-[var(--surface-raised)] p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]"
    >
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">New artwork</p>
      <h2 className="mt-1 font-display text-base font-semibold text-slate-950 dark:text-white">
        {pack.label}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pack.blurb}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={download} className={PRIMARY_BTN}>
          Download ({pack.sizeLabel})
        </button>
        <button type="button" onClick={dismiss} className={SECONDARY_BTN}>
          Not now
        </button>
      </div>
    </div>
  );
}
