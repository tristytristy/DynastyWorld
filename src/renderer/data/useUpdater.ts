import { useCallback, useEffect, useState } from 'react';
import type { UpdateState } from '../../shared/updateTypes';

/**
 * The renderer's view of the updater.
 *
 * It holds no truth of its own: the state is asked for once on mount and then
 * arrives by push. That is deliberate — a download runs in the main process and
 * survives this component being unmounted, remounted or hot-reloaded, and any
 * local copy of "we're at 40%" would be a lie the moment that happened.
 */
export function useUpdater(): {
  state: UpdateState | null;
  check: () => void;
  download: () => void;
  install: () => void;
} {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Subscribe BEFORE asking for the current state: the other order has a gap
    // between the answer and the subscription where a push can be dropped, and
    // a dropped push here is a progress bar that stops moving.
    const unsubscribe = window.api.update.onStateChanged((next) => {
      if (!cancelled) setState(next);
    });

    window.api.update
      .getState()
      .then((initial) => {
        if (!cancelled) setState((current) => current ?? initial);
      })
      .catch(() => {
        /* the panel simply stays in its loading shape */
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /*
    Every action is fire-and-forget. The main process answers with the new
    state on the same channel every other change arrives on, so awaiting the
    return value here would just be a second, racier path to the same update.
  */
  const check = useCallback(() => {
    void window.api.update.check();
  }, []);
  const download = useCallback(() => {
    void window.api.update.download();
  }, []);
  const install = useCallback(() => {
    void window.api.update.install();
  }, []);

  return { state, check, download, install };
}
