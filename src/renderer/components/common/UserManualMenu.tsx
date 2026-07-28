import { useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';

/**
 * Opens the User Manual in a modal. The manual itself is a self-contained HTML
 * page (docs/manual/manual.template.html) that webpack emits to `manual.html`
 * in the bundle, referencing the app's own fonts/logo/splash so it stays tiny.
 * Rendered in an <iframe> so its document styles stay fully sealed off from the
 * app's CSS (and vice versa); on screen the manual uses its fluid, responsive
 * layout. Same origin as the app, so it loads with no network and no CSP fuss.
 */
export function UserManualMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        User Manual
      </button>

      <CenteredModalPanel open={isOpen} onClose={() => setIsOpen(false)} widthRem={64} eyebrow="Guide" title="User Manual">
        <iframe
          src="manual.html"
          title="DynastyOS User Manual"
          className="h-[82vh] w-full border-0 bg-[#FBF9F4]"
        />
      </CenteredModalPanel>
    </div>
  );
}
