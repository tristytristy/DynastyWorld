import { DynastyOSWordmark } from './DynastyOSWordmark';

export function Navbar() {
  // The utility controls (theme toggle, Preferences, Help, Stadiums) moved to
  // the bottom of the left sidebar (2026-07-19) so the top bar is just the
  // app identity — now the DynastyOS wordmark, inlined as SVG (it replaced a
  // raster PNG loaded from an asset path, so it also stays crisp at any scale).
  return (
    <header className="relative z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 border border-slate-900/10 bg-white/85 px-5 py-3.5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] backdrop-blur-md dark:border-white/10 dark:bg-black">
        <DynastyOSWordmark className="h-9 w-auto max-w-full" />
        <span className="tnum self-end pb-0.5 text-xs font-light tracking-wide text-slate-400 dark:text-slate-500">
          v{__APP_VERSION__}
        </span>
        {/* Dev-only build stamp — empty (and hidden) on release builds. Lets a
            playtest session confirm at a glance it's running the newest build. */}
        {__BUILD_LABEL__ ? (
          <span className="tnum self-end pb-0.5 text-xs font-medium tracking-wide text-amber-500 dark:text-amber-400">
            {__BUILD_LABEL__}
          </span>
        ) : null}
      </div>
    </header>
  );
}
