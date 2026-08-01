import { DynastyOSWordmark } from './DynastyOSWordmark';
import { PreferencesMenu } from './PreferencesMenu';
import { UserManualMenu } from './UserManualMenu';
import { AboutMenu } from './AboutMenu';
import { ShortcutsMenu } from './ShortcutsMenu';
import { BookIcon, GearIcon, InnerActivityIcon, KeyboardIcon } from './ToolbarIcons';

/**
 * Tool triggers in the title bar: the icon only, no chip or border, so they
 * read as window chrome rather than as buttons parked in it. `app-no-drag` is
 * mandatory — without it the drag region swallows the click and the button
 * silently does nothing.
 */
const TITLEBAR_ICON_BUTTON =
  'app-no-drag inline-flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-500 dark:hover:text-white';

export function Navbar() {
  /*
    The app identity lives ON the title-bar plane — the same 36px band Windows
    draws the minimise/maximise/close buttons into, left-justified against their
    right. It used to be a bordered card BELOW that band, which meant the window
    carried two stacked strips of chrome before any content: the empty title-bar
    reserve, then the header card, then a gap under it. Folding one into the
    other removed a whole band.

    (The utility controls — theme, Preferences, Help, Stadiums — moved to the
    bottom of the sidebar back in 2026-07-19, which is what left this strip free
    to be nothing but identity.)

    Three things to keep in mind before touching it:
      • This strip IS the window's drag handle (`app-drag`), so anything
        interactive added here must carry `app-no-drag` or it will silently stop
        responding to clicks. Nothing in it is interactive today.
      • Its height must not exceed `--titlebar-height` (globals.css, mirrored by
        TITLE_BAR_HEIGHT in main.ts) or content slides under the caption buttons.
      • `--titlebar-gutter` reserves the buttons' own width on the right. It only
        matters if something is ever right-aligned in here, but leaving it off
        would put that thing underneath them.
  */
  return (
    <header
      className="app-drag relative z-20 flex shrink-0 items-center gap-2.5 pl-2"
      style={{ height: 'var(--titlebar-height)', paddingRight: 'var(--titlebar-gutter)' }}
    >
      {/* Half its old 36px. At that size it was the loudest thing on every
          screen, competing with the page title right below it. A mark that sits
          quietly reads as more expensive than one that announces itself. */}
      <DynastyOSWordmark className="h-[1.125rem] w-auto max-w-full" />
      {/* Dropped to 10px alongside the mark. At 12px against a 36px wordmark
          the version was a footnote; against an 18px one it started competing
          with the thing it annotates. */}
      <span className="tnum text-[10px] font-light tracking-wide text-slate-400 dark:text-slate-500">
        v{__APP_VERSION__}
      </span>
      {/* Dev-only build stamp — empty (and hidden) on release builds. Lets a
          playtest session confirm at a glance it's running the newest build. */}
      {__BUILD_LABEL__ ? (
        <span className="tnum text-[10px] font-medium tracking-wide text-amber-500 dark:text-amber-400">
          {__BUILD_LABEL__}
        </span>
      ) : null}

      {/*
        The tools, moved out of the sidebar into the chrome — the pattern every
        browser uses, and it gives the sidebar its full height back for the
        thing it's actually for. They sit hard against the Windows caption
        buttons with a rule between, so it's clear which set belongs to the app
        and which to the OS.

        Each menu opens a CenteredModalPanel, which is why moving the triggers
        from the sidebar's bottom to the window's top needed no positioning work
        at all: nothing is anchored to them.
      */}
      <div className="ml-auto flex items-center gap-1">
        <PreferencesMenu triggerClassName={TITLEBAR_ICON_BUTTON} icon={<GearIcon className="h-[18px] w-[18px]" />} />
        <ShortcutsMenu triggerClassName={TITLEBAR_ICON_BUTTON} icon={<KeyboardIcon className="h-[18px] w-[18px]" />} />
        <UserManualMenu triggerClassName={TITLEBAR_ICON_BUTTON} icon={<BookIcon className="h-[18px] w-[18px]" />} />
        <AboutMenu triggerClassName={TITLEBAR_ICON_BUTTON} icon={<InnerActivityIcon className="h-[18px] w-[18px]" />} />
        <span aria-hidden className="ml-1.5 h-4 w-px bg-slate-300 dark:bg-white/15" />
      </div>
    </header>
  );
}
