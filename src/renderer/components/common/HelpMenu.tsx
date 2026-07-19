import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';

interface HelpTopic {
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * The living how-to guide for the app. Keep this current: whenever a real
 * use-case question comes up (a feature behaves in a way that isn't obvious,
 * a limitation trips someone up, a workflow has a "right way" to do it),
 * capture it here in plain language rather than leaving it to only exist in
 * DevLog.md or a chat transcript. DevLog.md explains what shipped and why,
 * for future development; this page explains how to actually use what
 * shipped, for the person playing the dynasty.
 */
const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Importing your dynasty',
    content: (
      <>
        <p>
          Head to the Dashboard and click <strong>Import Dynasty</strong>, then pick your save file. Don&apos;t worry
          about the file extension — EA&apos;s save files usually don&apos;t have one you&apos;ll recognize, so the
          picker shows everything by default.
        </p>
        <p>
          Importing reads your team, roster, coaching staff, schedule, stats, recruiting board, and more from that one
          moment in time. It never modifies your save file — reading a save and editing one (see{' '}
          <em>Editing players and coaches</em>) are two completely separate, deliberate actions in this app.
        </p>
      </>
    ),
  },
  {
    id: 'sync-cadence',
    title: 'Sync every season before you advance',
    content: (
      <>
        <p className="font-semibold text-slate-900 dark:text-white">
          This is the single most important habit for getting a complete dynasty archive.
        </p>
        <p>
          A sync captures your save exactly as it looks right now — this season&apos;s roster, schedule, stats, and
          standings. Once you sim into the next year, that snapshot is gone for good. There&apos;s no way to look back
          and rebuild it later — the save file only ever holds the current state of your dynasty, not a history of
          every season along the way.
        </p>
        <p>
          The habit that works: <strong>sync once near the end of each season</strong> — after your bowl game or
          playoff run wraps up and awards are announced — right before you advance to the next year. That&apos;s the
          moment your season&apos;s story is actually complete: final record, postseason result, and every award
          locked in.
        </p>
        <p>
          Syncing more than once during the same season is completely safe. Every sync just refreshes that
          season&apos;s data in place — nothing gets duplicated. So check in as often as you like mid-season; just
          make sure your <em>last</em> sync before advancing catches the finished product.
        </p>
        <p>
          Missed one anyway? You&apos;re not out of luck. The next time you sync, the app automatically recovers
          league-wide history for any season it skipped — see the next section.
        </p>
      </>
    ),
  },
  {
    id: 'season-switcher',
    title: 'The Season dropdown & "History Only" seasons',
    content: (
      <>
        <p>
          Once a dynasty has more than one tracked season, every dynasty page shows a Season selector next to the tab
          bar. Pick any season to see the app&apos;s data as it stood at that point in your dynasty.
        </p>
        <p>Seasons come in two kinds:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>A normal season</strong> — synced while it was current. Full detail: roster, schedule, standings,
            stats, awards, coaching staff, everything.
          </li>
          <li>
            <strong>A History Only season</strong> — recovered automatically after the fact, straight from the
            save&apos;s own league-wide records. You&apos;ll see that year&apos;s national champion, every
            conference&apos;s champion, and its major awards on the History tab — but not your own team&apos;s
            roster, schedule, or game-by-game stats. That detail genuinely doesn&apos;t exist anywhere once the save
            moves past a season without a sync, so it can&apos;t be faked or guessed at here.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'coach-vs-team-hub',
    title: 'Coach Hub vs. Team Hub',
    content: (
      <>
        <p>
          <strong>Coach Hub</strong> is your coach&apos;s career page — profile, lifetime record (tracked by the game
          itself across their entire coaching career, not just what you&apos;ve imported here), the staff around them,
          and a timeline of every season they&apos;ve coached, even across different schools if they&apos;ve been
          fired or hired elsewhere along the way.
        </p>
        <p>
          <strong>Team Hub</strong> is a snapshot of the currently selected season for your program — record,
          rankings, recent and upcoming games.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Simple way to remember it: Coach Hub answers &quot;who is this coach,&quot; Team Hub answers &quot;how is
          this season going.&quot;
        </p>
      </>
    ),
  },
  {
    id: 'sync-relink-backup',
    title: 'Sync, Relink, and Backup — which one do I need?',
    content: (
      <>
        <p>
          <strong>Sync Dynasty</strong> — the one you&apos;ll use constantly. One click, no file picker — it just
          re-reads the exact save file the app already has on record. Use it any time you want fresh data, and always
          before advancing to a new season.
        </p>
        <p>
          <strong>Relink</strong> — only needed if your save file&apos;s name or location changed (restored from a
          different backup, renamed, moved). Dynasties are matched by their exact file path, so a renamed file looks
          like a brand-new dynasty until you relink it. The app usually catches this itself during a normal import and
          offers to link automatically instead of creating a duplicate.
        </p>
        <p>
          <strong>Backup</strong> — makes a timestamped copy of your actual game save, stored safely outside your game
          folder. Worth doing before an editing session (see below), just for peace of mind. If you ever need to roll
          back, the backup sits in a known folder on your computer and can be copied back over your live save file
          manually through File Explorer.
        </p>
        <p>
          <strong>Export</strong> — saves a self-contained HTML page of your dynasty&apos;s history (record book,
          resume, season timeline, milestones) that opens in any browser, no login or app required. Handy for sharing
          your dynasty&apos;s story or keeping an offline record.
        </p>
      </>
    ),
  },
  {
    id: 'editing',
    title: 'Editing players and coaches',
    content: (
      <>
        <p>
          Click the pencil icon on any player card (Roster, Recruiting) or coach card (Coach Hub, Coaches) to open the
          editor — ratings, physical and mental attributes, skill caps, and portraits.
        </p>
        <p>
          Unlike the rest of the app, editing genuinely writes to your save file — it&apos;s the one place this app
          isn&apos;t read-only. Changes take effect the next time you load that save in-game. We&apos;d recommend
          running <strong>Backup</strong> before a big editing session, just in case.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          One honest limitation: a coach&apos;s portrait can be changed in the picker and updates here correctly, but
          the field that actually controls a coach&apos;s in-game appearance behaves inconsistently in the save
          format, so it isn&apos;t written — the change may not carry over into the game itself. Player portraits
          don&apos;t have this problem and update in-game reliably.
        </p>
      </>
    ),
  },
  {
    id: 'good-to-know',
    title: 'A few honest limitations',
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Box scores only show detailed stats for your own team — opponent player stats aren&apos;t in the save file.</li>
        <li>
          Poll rankings only reflect the current week at the moment you sync — there&apos;s no historical
          week-by-week trend before the app started tracking your dynasty.
        </li>
        <li>
          A History Only season can&apos;t become a full season after the fact. The underlying roster/schedule/stat
          data genuinely no longer exists in the save once the game has moved past that year.
        </li>
      </ul>
    ),
  },
];

export function HelpMenu() {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState(HELP_TOPICS[0].id);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const panelUnderlayClass = isDark
    ? 'bg-slate-950/78 shadow-[0_42px_120px_-44px_rgba(2,6,23,0.88)] backdrop-blur-[52px] backdrop-saturate-[1.55] backdrop-brightness-[0.28]'
    : 'bg-white/18 shadow-[0_42px_120px_-44px_rgba(15,23,42,0.72)] backdrop-blur-[44px] backdrop-saturate-[1.8] backdrop-brightness-[0.68]';
  const panelGradientClass = isDark
    ? 'border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(15,23,42,0.78)_18%,rgba(2,6,23,0.96)_100%)]'
    : 'border border-white/38 bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0.22)_16%,rgba(248,250,252,0.9)_100%)]';
  const panelShellClass = isDark
    ? 'border border-slate-800/90 bg-slate-950/96 shadow-[0_44px_120px_-44px_rgba(2,6,23,0.9)] backdrop-blur-2xl'
    : 'border border-white/72 bg-white/80 shadow-[0_40px_120px_-44px_rgba(15,23,42,0.45)] backdrop-blur-2xl';
  const sectionClass = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/84 p-4'
    : 'rounded-xl border border-slate-200/90 bg-white/72 p-4';
  const subtleTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const strongTextClass = isDark ? 'text-white' : 'text-slate-900';
  const closeButtonClass = isDark
    ? 'border border-slate-700/85 bg-slate-950/94 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-slate-900 hover:text-white'
    : 'border border-slate-300/85 bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800';
  const rowBaseClass = isDark ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-slate-100/70';
  const rowActiveClass = isDark
    ? 'bg-white/10 border-[var(--team-primary)]'
    : 'bg-slate-100 border-[var(--team-primary)]';

  const activeTopic = HELP_TOPICS.find((topic) => topic.id === activeTopicId) ?? HELP_TOPICS[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Help
      </button>

      {isOpen && (
        <div className={`absolute right-0 top-14 z-50 w-[46rem] max-w-[92vw] ${isDark ? 'dark' : ''}`}>
          <div className="relative isolate">
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${panelUnderlayClass}`} />
            <div aria-hidden="true" className={`pointer-events-none absolute inset-[1px] ${panelGradientClass}`} />
            <div className={`relative overflow-hidden p-5 ${panelShellClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`type-eyebrow ${subtleTextClass}`}>
                    Help &amp; How-To
                  </p>
                  <h2 className={`mt-2 text-xl font-semibold tracking-tight ${strongTextClass}`}>
                    Getting the most out of your dynasty archive.
                  </h2>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className={closeButtonClass} aria-label="Close help">
                  Close
                </button>
              </div>

              <div className="mt-5 grid grid-cols-[13rem,1fr] gap-4">
                <section className={`max-h-[28rem] space-y-1 overflow-y-auto ${sectionClass}`}>
                  {HELP_TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setActiveTopicId(topic.id)}
                      className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        activeTopicId === topic.id ? rowActiveClass : rowBaseClass
                      } ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                    >
                      {topic.title}
                    </button>
                  ))}
                </section>

                <section className={`max-h-[28rem] overflow-y-auto ${sectionClass}`}>
                  <h3 className={`text-base font-semibold ${strongTextClass}`}>{activeTopic.title}</h3>
                  <div className={`mt-3 space-y-3 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {activeTopic.content}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
