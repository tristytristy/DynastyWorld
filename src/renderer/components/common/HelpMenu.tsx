import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { CenteredModalPanel } from './CenteredModalPanel';

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
    title: 'When to sync (read this first)',
    content: (
      <>
        <p className="font-semibold text-slate-900 dark:text-white">
          Syncing is how the app captures your dynasty. These are the moments that matter.
        </p>
        <p>Starting a brand-new dynasty, here&apos;s the order — walking through a season front to back:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Week 0 — your first sync of every season.</strong> Before any games are played, the game names its
            Preseason All-America teams; syncing now captures them and sets which school your coach belongs to. On a
            fresh dynasty, this is where your archive begins.
          </li>
          <li>
            <strong>During the season — any time you like.</strong> Totally safe; every sync just refreshes that
            season in place, nothing is ever duplicated. Sync on an <strong>awards week</strong> to record each honor
            the moment the game hands it out.
          </li>
          <li>
            <strong>The End of Season Recap — the one that matters most.</strong> After your bowl/playoff and the
            awards ceremony, right before you advance. This locks in your final record, postseason result, and every
            award. Never skip it.
          </li>
        </ul>
        <p className="font-semibold text-slate-900 dark:text-white">You can&apos;t sync at the wrong time.</p>
        <p>
          The moment a season finishes, the app locks it. So if you sync again later — deep in the offseason,
          mid-coaching-carousel, on National Signing Day — that finished season stays exactly as you left it, and
          nothing good is overwritten. You&apos;ll just see the normal &quot;Synced&quot; confirmation. Even changing
          schools is handled for you: your finished season stays with your old school, and your new school picks up at
          Week 0. Sync freely.
        </p>
        <p>
          Why it matters: the save file only ever holds the <em>current</em> state of your dynasty, never a history of
          every season. Miss a season entirely and the next sync can still recover that year&apos;s{' '}
          <em>league-wide</em> facts — national champion, conference champions, major awards — as a &quot;History
          Only&quot; season (see the next topic), but your own team&apos;s roster and game-by-game stats for a skipped
          year are gone for good. A complete archive only happens if you sync every season.
        </p>
        <p>
          For the fullest experience, start the app on a <strong>fresh dynasty</strong> and sync from season one. If
          you first import a save that&apos;s already several years deep, only the current season comes in with full
          detail — every year before it can be recovered as History Only at best.
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
    id: 'media',
    title: 'The Media gallery',
    content: (
      <>
        <p>
          The <strong>Media</strong> tab is a per-season gallery for your dynasty&apos;s screenshots and clips. Use{' '}
          <strong>Add photos / videos</strong> to pick files — they&apos;re copied into the app&apos;s own library, so
          the gallery keeps working even if you move or delete the originals.
        </p>
        <p>
          Click any thumbnail to open the viewer, then <strong>Edit details</strong> to pick which game it&apos;s from,
          tag the players in it, and write a description. Tagged players link straight to their player bios, and a
          linked game jumps to that game&apos;s page. Use the arrow keys (or the on-screen arrows) to move through the
          gallery. To delete a shot without opening it, use the small <strong>trash button</strong> on the
          bottom-left of its thumbnail.
        </p>
        <p>
          When tagging players, if you don&apos;t know a name, search by jersey number instead: start your search
          with <strong>#</strong> (e.g. <em>#17</em>) and the roster filters to whoever wears that number — handy when
          you recognize the number in the picture but not the face.
        </p>
        <p>
          Tags do double duty: anything you tag automatically shows up on the <strong>Media tab of each tagged
          player&apos;s bio</strong> (across every season they appear in) and in a <strong>Media section on the linked
          game&apos;s page</strong> — no extra work needed.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Uploads land in whichever season the Season dropdown is set to — switch seasons first if you&apos;re
          backfilling older memories. Supported: PNG/JPG/WebP/GIF images and MP4/WebM video.
        </p>
      </>
    ),
  },
  {
    id: 'player-notes',
    title: 'Notes on a player',
    content: (
      <>
        <p>
          Every player profile has a <strong>Notes</strong> tab — a place to jot down whatever you want to remember
          about them: a scouting read, a position idea, a recruiting angle, an injury to keep an eye on. Open a player,
          go to <strong>Notes</strong>, and click <strong>Add note</strong> — each note has a title and a freeform body.
        </p>
        <p>
          The title field <strong>remembers titles you&apos;ve used before</strong>, so recurring kinds of note (say
          &quot;Injury history&quot; or &quot;Position change&quot;) come back with a keystroke instead of retyping.
          Notes can be edited or deleted any time.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Notes are saved to that specific player and <strong>persist across seasons and sessions</strong> — they live
          on your computer alongside your dynasty data, never in the save file, so syncing never touches them.
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

export function HelpMenu({ triggerClassName }: { triggerClassName?: string } = {}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState(HELP_TOPICS[0].id);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const sectionClass = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/84 p-4'
    : 'rounded-xl border border-slate-200/90 bg-white/72 p-4';
  const strongTextClass = isDark ? 'text-white' : 'text-slate-900';
  const rowBaseClass = isDark ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-slate-100/70';
  const rowActiveClass = isDark
    ? 'bg-white/10 border-[var(--team-primary)]'
    : 'bg-slate-100 border-[var(--team-primary)]';

  const activeTopic = HELP_TOPICS.find((topic) => topic.id === activeTopicId) ?? HELP_TOPICS[0];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={triggerClassName ?? 'border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Quick Help
      </button>

      <CenteredModalPanel open={isOpen} onClose={() => setIsOpen(false)} widthRem={46} eyebrow="Quick Help" title="Getting the most out of your dynasty archive.">
              <div className="grid grid-cols-[13rem,1fr] gap-4">
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
      </CenteredModalPanel>
    </div>
  );
}
