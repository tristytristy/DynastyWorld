export function Navbar() {
  // The utility controls (theme toggle, Preferences, Help, Stadiums) moved to
  // the bottom of the left sidebar (2026-07-19) so the top bar is just the
  // app identity. The wordmark logo (assets/Logo/Logo-mark.png — the source art
  // tightly trimmed to its content bounds) replaces the old HUB chip + text.
  return (
    <header className="relative z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 border border-slate-900/10 bg-white/85 px-5 py-3.5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] backdrop-blur-md dark:border-white/10 dark:bg-[#0e0f12]">
        <img
          src="assets/Logo/Logo-mark.png"
          alt="College Football 27 Dynasty Hub"
          className="h-11 w-auto max-w-full object-contain"
          draggable={false}
        />
        <span className="tnum self-end pb-0.5 text-xs font-light tracking-wide text-slate-400 dark:text-slate-500">
          v{__APP_VERSION__}
        </span>
      </div>
    </header>
  );
}
