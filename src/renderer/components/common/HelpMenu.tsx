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
          Head to the Dashboard and click <strong>Import</strong>. The app looks in the folder the game keeps
          its saves in and lists what it finds by <strong>school and coach</strong> — &quot;Sac State — Patrick Evanz,
          2026, Week 1&quot; — rather than making you guess from filenames like{' '}
          <span className="font-mono text-xs">DYNASTY-EVANZSYNC</span>. Pick yours and it imports.
        </p>
        <p>
          If your saves live somewhere unusual, <strong>Change folder…</strong> points the app at them and remembers it.
          There&apos;s also <strong>Pick a file myself…</strong> for browsing directly. Autosaves and older backups of
          the same dynasty are tucked behind <em>Show older versions</em> — there if you need to recover from a bad
          save, out of the way if you don&apos;t.
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
            <strong>The End of Season Recap — lock in the season.</strong> After your bowl/playoff and the awards
            ceremony. This captures your final record, postseason result, and every award, and locks the season so
            nothing can overwrite it later.
          </li>
          <li>
            <strong>The &quot;Players Leaving&quot; step — capture who&apos;s moving on.</strong> Just after the recap,
            the offseason reaches the step where the game decides who declares for the NFL, who graduates, and who&apos;s
            transferring out (and why). Sync here to record it all on your Transfers &amp; Departures page — it&apos;s
            the only moment that data exists, and the app locks the roster shortly after, so don&apos;t advance past it
            without syncing.
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
    id: 'dynasty-backups',
    title: 'Backing up a dynasty (and putting it back)',
    content: (
      <>
        <p>
          Every dynasty card has a <strong>Back up this dynasty</strong> button. It saves that one dynasty into a single{' '}
          <strong>.zip</strong> file, wherever you choose — your Documents, a USB stick, a cloud folder. Keep that file
          and you can bring the dynasty back on any computer, years later.
        </p>
        <p>You choose what goes in, and see what each part costs before you commit:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>The dynasty itself</strong> — always included. Every season of history: stats, awards, recruits,
            notes and photo captions.
          </li>
          <li>
            <strong>Photos and videos</strong> from the Media Hub.
          </li>
          <li>
            <strong>Trading-card photos</strong>, with the framing you set.
          </li>
          <li>
            <strong>Your latest game save</strong> (~10 MB) — so you can carry on <em>playing</em>, not just browsing.
          </li>
        </ul>
        <p>
          <strong>To put one back:</strong> <strong>Restore Backup</strong> on the Dashboard, next to Import. It reads
          the file and tells you what&apos;s inside before changing anything. If that dynasty is already here,
          it&apos;ll say so and ask before replacing it — and a safety copy of everything you currently have is taken
          first, every time.
        </p>
        <p>
          It&apos;s a normal zip file on purpose. Even with no app installed, you can open it and see your photos, and
          read <span className="font-mono text-xs">README.txt</span> inside for what everything is. Your memories
          shouldn&apos;t depend on a program still existing.
        </p>
        <p>
          Not included: player faces, team logos and trophy art. That&apos;s shared artwork rather than your data, and
          it reinstalls with the app — leaving it out keeps backups small.
        </p>
      </>
    ),
  },
  {
    id: 'disk-space',
    title: 'What the app is using on your disk',
    content: (
      <>
        <p>
          <strong>Preferences → Storage</strong> shows everything the app has written and where, in plain language:
          your dynasty archive, your photos, trading-card images, automatic recovery copies, and copies of your game
          saves. Nothing it stores is hidden from you.
        </p>
        <p>
          Two buttons keep it tidy. <strong>Delete old copies</strong> keeps the most recent recovery copy of your
          archive and of each game save, and clears the older spares. <strong>Clear cache</strong> reclaims space still
          held inside the archive by dynasties you&apos;ve deleted. Neither touches your dynasties, photos or cards.
        </p>
        <p>
          Deleting a dynasty removes it completely and gives the space straight back, so that cache figure should stay
          at or near zero from now on.
        </p>
      </>
    ),
  },
  {
    id: 'media-storage',
    title: 'Where your photos are stored (and how to move them)',
    content: (
      <>
        <p>
          Anything you add in the Media Hub is <strong>copied</strong> into the app&apos;s own library — it never just
          points at the file you picked. Delete, rename or move the original afterwards and the app is unaffected.
        </p>
        <p>
          By default the library lives in <span className="font-mono text-xs">%APPDATA%\DynastyOS\media</span>,
          one folder per dynasty, with each file keeping its original name behind a timestamp so nothing collides. That
          works with zero setup, but it&apos;s buried where nobody browses — so you can put it anywhere you like under{' '}
          <strong>Preferences → Storage → Media library folder</strong>: your Pictures folder, an external drive, or a
          synced Dropbox/OneDrive folder if you want your screenshots backed up off the machine.
        </p>
        <p>
          Changing the folder <strong>moves your existing library across</strong> — nothing is left behind. The move
          copies everything first and only switches over once it&apos;s all landed, so if it fails part-way (drive full,
          folder gone) nothing moves at all and your current folder keeps working. There&apos;s an <strong>Open
          folder</strong> button there too, for when you just want the files.
        </p>
        <p>
          One thing to know: the app&apos;s own backups cover the database — your captions, tags and game links — but
          not the image files themselves. If you&apos;re moving to a new machine, copy the media folder as well.
        </p>
      </>
    ),
  },
  {
    id: 'no-spoilers',
    title: 'Why this week’s other scores are blank',
    content: (
      <>
        <p>
          The hub never shows you a result the game hasn&apos;t shown you yet. Sync in the middle of a week — before
          you&apos;ve played your own game — and every <em>other</em> game that week reads as unplayed, with a note on
          the Scores page saying so.
        </p>
        <p>
          That&apos;s deliberate, not missing data. Your save actually resolves the entire week&apos;s slate the moment
          you enter it; the game just keeps those scores hidden until your own game is done. Showing them would hand you
          the whole weekend early, including your rivals&apos; upsets and the top-10 result you were about to watch.
        </p>
        <p>
          <strong>How to get them back:</strong> play your game and sync again — the rest of the week unlocks
          immediately, exactly as it does in-game. Advancing to the next week and syncing works too. On a bye week
          there&apos;s no game to play, so that week stays held until you advance.
        </p>
        <p>
          Everything else is unaffected: records, standings, polls, stat leaders and box scores never included the
          hidden week in the first place — the game itself doesn&apos;t roll those forward until the week is complete.
          Nothing is lost either way; the next sync fills in the real scores.
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
          <strong>Back up this dynasty</strong> — saves the dynasty into one <strong>.zip</strong> file you choose the
          location of, with your photos and your game save if you tick them (see <em>Backing up a dynasty</em>). Worth
          doing before an editing session, and essential before moving to a new computer. Restoring is a button on the
          Dashboard rather than a manual file-copy.
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
    id: 'roster-tiles',
    title: 'The Roster page — the tiles, and filtering by class',
    content: (
      <>
        <p>
          <strong>Team</strong>, <strong>Offense</strong> and <strong>Defense</strong> are the average overall of the
          players currently shown, with the count underneath. Kickers and punters belong to neither unit, so offense
          and defense together come up a few short of the team count.
        </p>
        <p>
          They are the <em>roster&apos;s</em> averages, not the team rating the game itself shows — that one is built
          from the depth chart, which the save doesn&apos;t store, so there&apos;s nothing more faithful to use. Read
          them as &quot;how good is this group&quot;, and compare them between teams and seasons rather than against
          the in-game number.
        </p>
        <p>
          <strong>The class row filters.</strong> Click <em>21 Freshman</em> to see only them; click more than one to
          combine (freshmen and RS freshmen together are a recruiting class; seniors and RS seniors are who&apos;s
          leaving). A <strong>Clear</strong> button appears at the end of the row while anything is selected.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          The tiles follow whatever is on screen, so filtering to one class tells you how good that class is, and the
          counts read &quot;21 of 85 players&quot; so it&apos;s always clear what the average is over.
        </p>
      </>
    ),
  },
  {
    id: 'roster-export',
    title: 'Getting a roster into a spreadsheet',
    content: (
      <>
        <p>
          <strong>Export Roster</strong> on the Roster page saves whatever that page is showing — the team in the team
          switcher, at the season you have selected — as a file. The save dialog offers two formats:
        </p>
        <p>
          <strong>CSV</strong> (the default) is the one to pick for <strong>Google Sheets</strong>,{' '}
          <strong>Excel</strong>, or <strong>OpenOffice/LibreOffice Calc</strong>. One row per player, one column per
          field, ready to sort, filter, and chart. Team and season are on every row, so several exports can be pasted
          into a single sheet and still be told apart.
        </p>
        <p>
          <strong>XML</strong> keeps the nested structure and is meant for other tools, not spreadsheets — no
          spreadsheet app opens it directly.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          The 50-odd individual ratings come from your save file, which only ever holds the current season, so
          exporting a past season fills the profile columns and leaves the rating columns blank. The message under the
          button tells you how many players came out with full ratings.
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
          Open photos <strong>zoom</strong>, the same way a trading-card photo does: drag the slider at the bottom-left
          (or scroll the wheel over the picture) to go in up to 5×, then drag the photo to move around it.
          Double-click to snap back to fit.
        </p>
        <p>
          Found a crop you like? <strong>Save framing</strong> keeps it — the photo then opens that way every time, and
          its thumbnail shows the same crop. <strong>Reset</strong> gives the whole picture back. Nothing is done to the
          file itself: the framing is just a note about how to show it, so the full original is always there
          underneath.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          That&apos;s also why a <strong>trading card is unaffected</strong>. Putting a media photo on a card takes its
          own copy with its own zoom, so the same shot can be cropped one way in the gallery and framed a completely
          different way on the card — changing either one never touches the other.
        </p>
        <p>
          When tagging players, if you don&apos;t know a name, <strong>type the jersey number</strong> — just the
          digits. It matches from the front, so <em>5</em> brings up #5 and the whole fifties, and typing the second
          digit narrows it. Handy when you recognize the number in the picture but not the face. (A leading
          <strong>#</strong> still works if you prefer it.)
        </p>
        <p>
          Tags do double duty: anything you tag automatically shows up under <strong>Showcase → Media on each tagged
          player&apos;s profile</strong> (across every season they appear in) and in a <strong>Media section on the
          linked game&apos;s page</strong> — no extra work needed.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Uploads land in whichever season the Season dropdown is set to — switch seasons first if you&apos;re
          backfilling older memories. Supported: PNG/JPG/WebP/GIF images and MP4/WebM video.
        </p>
      </>
    ),
  },
  {
    id: 'program-editor',
    title: 'Imported teams, and the Program editor',
    content: (
      <>
        <p>
          If you brought a team in from Teambuilder, the game writes it over an existing school&apos;s spot — your team
          keeps that slot, but its name, colours and art token are all new. The app has artwork for the real schools,
          not for a school it&apos;s never seen, so an imported program shows a placeholder logo, a generic helmet, and
          no uniform or coach polo.
        </p>
        <p>
          <strong>Program editor</strong>, on any team&apos;s hub above <strong>Program budget</strong>, is where you
          fix that — your own program and every other team in the league, so a save full of imported schools can all
          be dressed properly rather than only the one you coach. <strong>Identity</strong> sets the stadium name and
          city, which show on the schedule and on every game&apos;s info page. <strong>Artwork</strong> takes four
          uploads:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Program logo</strong> — 1024 × 1024, transparent</li>
          <li><strong>Helmet</strong> — 1024 × 1024, transparent, facing left (the other side is mirrored for you)</li>
          <li><strong>Uniform</strong> — 512 × 512, sits over a player portrait</li>
          <li><strong>Coach polo</strong> — 512 × 512, sits over a coach portrait</li>
        </ul>
        <p>
          The uniform and polo are the fussy ones: they lay directly on top of a portrait, so the collar and shoulders
          have to line up with the portrait&apos;s or every player will look slightly wrong. Upload, look at a few
          players, adjust.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Your files are copied into the app&apos;s own storage, so moving or deleting the originals won&apos;t break
          anything, and nothing here is written to your save file. Remove an upload and the built-in artwork comes
          back. Edits belong to <strong>this dynasty only</strong> — an imported team that happens to share a name with
          a real school never changes that school in your other saves.
        </p>
      </>
    ),
  },
  {
    id: 'custom-rivalries',
    title: 'Naming your own rivalries',
    content: (
      <>
        <p>
          Your save keeps three rival slots per team and a fixed list of names for them, and neither can be changed
          from inside the game. A long dynasty grows rivalries it has no room for — the team you keep meeting in the
          conference title game, the one that keeps taking your recruits, a Teambuilder school that has no history
          because it didn&apos;t exist last season. The <strong>Rivals</strong> tab of the Program editor is where you
          name those yourself.
        </p>
        <p>
          Your save&apos;s own rivals sit at the top, marked <strong>EA</strong> and read-only. Below them, pick a
          team, give the rivalry a name, and — if you want one — add a logo at{' '}
          <strong>1024 × 1024, transparent</strong>, the same size as the ones that ship with the app. Without a logo
          the rivalry still gets the generic shield, which is a perfectly good place to stop.
        </p>
        <p>
          A rivalry belongs to <strong>both</strong> teams, so you only ever create it once. Whichever program you
          declare it from, the name and the mark turn up on both teams&apos; schedules, in each game&apos;s info page,
          and on the <strong>Rivalries</strong> page — where a rivalry you&apos;ve named but not yet played shows at
          0-0 until you meet.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          This is decoration for DynastyOS and nothing more: <strong>nothing is written to your save file</strong>,
          your save&apos;s own rivals are left exactly as they are, and the in-game scheduling and commentary that
          depend on them are untouched. Delete a rivalry and everything goes back to how the save has it.
        </p>
      </>
    ),
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    content: (
      <>
        <p>
          The keyboard icon in the title bar opens <strong>Shortcuts</strong>. A few keys are fixed and always work:{' '}
          <strong>Ctrl + K</strong> opens global search, <strong>Esc</strong> closes whatever panel is open, and{' '}
          <strong>Shift + ←</strong> / <strong>Shift + →</strong> step through teams. They&apos;re listed at the top of
          the panel under <strong>Built in</strong> so you can see them without having to find them by accident.
        </p>
        <p>
          One shortcut arrives already set: <strong>Ctrl + Shift + Z</strong> flips between dark and light mode. You
          can move it, or clear it and take the keys back — and if you change your mind, <strong>Restore</strong> on
          that row puts it back without disturbing anything else you&apos;ve set.
        </p>
        <p>
          Everything else — every page in the app — ships with no key at all, deliberately. Which page deserves a
          shortcut depends entirely on how you play, so the panel offers the list and you spend the keys. Click a
          shortcut field, press the combination you want, and it&apos;s bound. It needs <strong>Ctrl</strong>,{' '}
          <strong>Alt</strong> or <strong>Cmd</strong>, or a function key.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Shortcuts never fire while you&apos;re typing, and a shortcut to a page inside a dynasty does nothing on the
          Dashboard, where there&apos;s no dynasty to open it for. They&apos;re stored on this machine rather than in
          the dynasty, so they follow you between saves instead of following a save between people.
        </p>
      </>
    ),
  },
  {
    id: 'trading-cards',
    title: 'Trading cards and the card book',
    content: (
      <>
        <p>
          Every player profile ends on <strong>Showcase</strong>, which opens on that player&apos;s cards, three to a
          row — click one to open it full size, or click the <strong>+</strong> to start another. A player can have as
          many as you like; the small dot under a card marks the one that pops up when you hover their name anywhere in
          the app. (The <strong>Media</strong> half of the same switch holds every photo you&apos;ve tagged him in.)
        </p>
        <p>
          With a card open, the <strong>pencil</strong> opens its editor. <strong>Upload Photo</strong> takes a
          screenshot from your computer and <strong>Media Photo</strong> reuses anything already tagged to that player
          in the Media gallery; then drag the photo to frame it and use <strong>Zoom</strong> to fill the card.{' '}
          <strong>Show on card</strong> turns the overall, the name, the profile line, the stat row and the team logo on
          or off, so you can make a clean photo-and-name card if that&apos;s the look you want.
        </p>
        <p>
          The stat line can come from the <strong>season</strong> or from <strong>one game</strong> — pick the game from
          the dropdown and the card celebrates that Saturday instead of the year. Choose up to four stats to run across
          the bottom.
        </p>
        <p>
          The <strong>star</strong> puts a card in your <strong>card book</strong> — the card icon at the right-hand end
          of the Coach tabs, which collects every starred card in the dynasty, a page per season. The{' '}
          <strong>export</strong> icon saves a card as a PNG.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          A card is a printed moment: the year, the school and the profile line are locked in when you make it, and
          nothing later — a transfer, a class change, a re-sync — rewrites them. That&apos;s why cards don&apos;t change
          when you switch seasons, and why the stat line can only be re-picked from the season the card was made in.
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
