export function Navbar() {
  // The utility controls (theme toggle, Preferences, Help, Stadiums) moved to
  // the bottom of the left sidebar (2026-07-19) so the top bar is just the
  // app identity and nothing competes with the title near "Dynasty".
  return (
    <header className="relative z-20 px-4 pt-4 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 border border-white/65 bg-white/72 px-5 py-4 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/72">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--team-primary)] text-sm font-semibold tracking-[0.24em] text-[var(--team-on-primary)] shadow-[0_18px_40px_-22px_rgba(37,99,235,0.9)]">
          HUB
        </div>
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          College Football 27 Dynasty Hub
        </h1>
      </div>
    </header>
  );
}
