import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmOptions {
  /** Bold heading — the question, short. */
  title: string;
  /** Supporting detail beneath the title. */
  message?: ReactNode;
  /** Small uppercase label above the title (e.g. "Delete media"). */
  eyebrow?: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** 'danger' paints the confirm button red for destructive actions. */
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

/**
 * App-styled replacement for the native `window.confirm` (which renders an
 * out-of-place OS dialog). Provides an async `confirm()` that resolves to a
 * boolean, so call sites read almost identically — just `await`ed. The dialog
 * itself matches the app's modal language (corner-cut panel, blurred scrim,
 * team-colored primary / red danger action) and portals to document.body so
 * it escapes <main>'s clip-path, same as the other root modals.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const settle = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    if (!pending) return;
    confirmButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        settle(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [pending, settle]);

  const value = useMemo(() => confirm, [confirm]);

  const options = pending?.options;
  const isDanger = options?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending &&
        options &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onMouseDown={() => settle(false)}
              aria-hidden="true"
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={options.title}
              className="corner-cut content-enter relative w-full max-w-md border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            >
              {options.eyebrow && (
                <p className={`type-eyebrow ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {options.eyebrow}
                </p>
              )}
              <h2 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">{options.title}</h2>
              {options.message && (
                <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{options.message}</div>
              )}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => settle(true)}
                  className={
                    isDanger
                      ? 'border border-red-500/60 bg-red-500/[0.12] px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/[0.22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:text-red-400'
                      : 'bg-[var(--team-primary)] px-5 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-primary)]'
                  }
                >
                  {options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider.');
  }
  return ctx;
}
