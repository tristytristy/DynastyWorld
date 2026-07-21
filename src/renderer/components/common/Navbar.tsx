export function Navbar() {
  // The utility controls (theme toggle, Preferences, Help, Stadiums) moved to
  // the bottom of the left sidebar (2026-07-19) so the top bar is just the
  // app identity and nothing competes with the title near "Dynasty".
  return (
    <header className="relative z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 border border-slate-900/10 bg-white/85 px-5 py-4 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] backdrop-blur-md dark:border-white/10 dark:bg-[#15181c]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--team-primary)] text-sm font-semibold tracking-[0.24em] text-[var(--team-on-primary)]">
          HUB
        </div>
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Dynasty Hub
        </h1>
      </div>
    </header>
  );
}
