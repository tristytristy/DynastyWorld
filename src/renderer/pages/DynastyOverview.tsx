import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GRADIENT_TEAM_BLOCK } from '../lib/gradients';
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { buildTeamColorVars, type TeamColorVars } from '../lib/teamTheme';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { MASTHEAD_ART_SLOT } from '../components/common/PageMasthead';
import { boundsFor, markGeometry } from '../lib/markBounds';
import { getLogoPath } from '../lib/assetMapping';
import { schoolLocationLabel } from '../lib/schoolLocations';
import { getTeamMapPath } from '../lib/teamMapAssetMapping';
import { MapTweaker } from '../components/dev/MapTweaker';
import { TopPlayersCard } from '../components/common/TopPlayersCard';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { ProgramEditorModal } from '../components/common/ProgramEditorModal';
import { useTheme } from '../theme/ThemeProvider';
import { getBowlLogoPath, getTrophyImagePath } from '../lib/trophyAssetMapping';
import type { GameSummary, LeagueTeamRoster, RankingsOverview, RosterPlayer, SeasonOverview, TeamTrophies, Trophy } from '../../shared/types';

function rankLabel(rank: number | null): string {
  return rank === null ? 'Unranked' : `#${rank}`;
}

/**
 * Bowl asset matching is a normalized-name guess (see trophyAssetMapping.ts) —
 * a handful of real bowls (confirmed: Bahamas Bowl, Camellia Bowl) aren't in
 * the asset pack under any matching filename. Rather than showing a broken
 * image icon, fail over to the generic bowl mark at render time.
 */
function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

/**
 * A trophy in the masthead's case, at the FULL height of the row.
 *
 * No caption. The name under a 64px thumbnail was carrying the whole message,
 * which meant the trophy itself was decoration next to it — the wrong way round
 * for the one thing on this page worth celebrating. Sized to the same slot as
 * the team mark so the two read as equals, with the name moved to the tooltip
 * rather than deleted (it's still the accessible label).
 */
function TrophyBadge({ trophy, height, onLoad }: { trophy: Trophy; height: number; onLoad: () => void }) {
  const imagePath = getTrophyImagePath(trophy);
  if (!imagePath) return null;

  return (
    <img
      src={imagePath}
      alt={trophy.label}
      title={trophy.label}
      onLoad={onLoad}
      onError={(event) => {
        if (trophy.kind === 'bowl-win') fallbackToDefaultBowlLogo(event);
        // A swapped src re-measures too: the fallback bowl mark is a different
        // shape from the one that failed, so the row's width changed.
        onLoad();
      }}
      style={{ height }}
      className="w-auto shrink-0 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.25)]"
      draggable={false}
    />
  );
}

const TROPHY_GAP = 20; // gap-5 — part of the row's width that does NOT scale with height.
const TROPHY_RULE = 24; // pl-6, the inset past the divider — also fixed.
const TROPHY_MIN_HEIGHT = 56;
/**
 * Below this much room beside the name, staying inline stops being worth it and
 * the case takes its own line instead. Under roughly this width the fixed
 * furniture (the rule plus the gaps between trophies) is most of the space and
 * the art gets what's left, which is how a case ends up a clipped sliver.
 */
const TROPHY_MIN_INLINE = 340;

/**
 * The case: every trophy on ONE row, at FULL SIZE wherever there is room for it.
 *
 * WHY NOT `flex-wrap` ON THE TROPHIES. At 170px a five-trophy case is most of a
 * thousand pixels, so a narrower window folded it into a ragged two-column
 * block — trophies at different heights stacked over each other, reading as a
 * grid of unrelated objects rather than as a shelf. A trophy case is a row.
 *
 * WHY MEASURED AND NOT A MEDIA QUERY. The room this row gets depends on the
 * window, on how many trophies there are, on how wide the school's NAME is, on
 * whether the sidebar is open, and on whether the header has already wrapped the
 * group onto its own line — none of which a breakpoint knows.
 *
 * THE CASE ASKS FOR THE ROOM THAT IS ACTUALLY BESIDE IT, which is the only way
 * it comes out big on a wide window (user direction). Two earlier attempts got
 * this wrong in opposite directions and both were caught in a real capture:
 *
 *   • `flex-1` plus `ml-auto` on the buttons. An auto margin on the main axis
 *     absorbs ALL free space BEFORE flex-grow is distributed, so the case never
 *     grew past its basis however wide the window got — 110px at 1700.
 *   • A basis equal to the full-size width. That made the group wrap onto its
 *     own line the moment full size didn't fit inline, and once wrapped, `grow`
 *     filled the whole line and pushed the buttons down to a THIRD row.
 *
 * So the width is computed here rather than negotiated with flexbox: the room
 * beside this element is its parent's width less its siblings and the gaps, and
 * the basis is the smaller of that and what full size needs. It is therefore
 * always satisfiable, so the group never wraps and never overflows, and the
 * buttons keep their auto margin and their place on the identity row. Only when
 * that room drops under `TROPHY_MIN_INLINE` — the narrow breakpoints — does it
 * ask for full size on purpose, which is what makes it wrap to its own line
 * instead of collapsing to a sliver.
 *
 * The maths is a closed form rather than a loop, because width scales LINEARLY
 * with height for a row of fixed-aspect images: subtract the gaps and the rule
 * (which don't scale), and the remainder is directly proportional. `artAtMax`
 * is a property of the IMAGES and so is invariant under layout — which is what
 * makes it safe to feed the result back into the basis without oscillating. The
 * basis is never larger than the room its siblings left, so it cannot squeeze
 * them and re-trigger itself either.
 */
function TrophyCase({ trophies }: { trophies: Trophy[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Widened off the `as const` literal: this is the row's ceiling, not its only
  // legal value, and the state below has to be able to hold anything under it.
  const max: number = MASTHEAD_ART_SLOT.logo.maxHeight;
  const [height, setHeight] = useState(max);
  /** The width to claim on the row. Null until the first measurement lands. */
  const [basis, setBasis] = useState<number | null>(null);

  const fit = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    // Zero while the card is still being laid out (or hidden); measuring then
    // would collapse every trophy to the floor and leave them there.
    if (!node.clientWidth) return;
    const fixed = TROPHY_GAP * Math.max(0, node.children.length - 1) + TROPHY_RULE;
    const artNow = node.scrollWidth - fixed;
    if (artNow <= 0) return;
    // What the art alone would span at full height, from what it spans now.
    const artAtMax = (artNow * max) / height;
    if (artAtMax <= 0) return;
    const needed = artAtMax + fixed;

    // The room left on the identity row once the name and the buttons have
    // taken theirs. Measured from the siblings rather than assumed, because the
    // name is as wide as the school's name happens to be.
    const parent = node.parentElement;
    let inlineRoom = Number.POSITIVE_INFINITY;
    if (parent) {
      const gap = parseFloat(getComputedStyle(parent).columnGap) || 0;
      let siblings = 0;
      for (const child of Array.from(parent.children)) {
        if (child !== node) siblings += child.getBoundingClientRect().width;
      }
      inlineRoom = parent.clientWidth - siblings - gap * Math.max(0, parent.children.length - 1);
    }

    const ownLine = inlineRoom < TROPHY_MIN_INLINE;
    const nextBasis = ownLine ? needed : Math.min(needed, inlineRoom);
    // On its own line the element spans the row, so the row is what it gets;
    // inline, the basis IS what it gets, because it always fits.
    const available = ownLine ? (parent?.clientWidth ?? node.clientWidth) : nextBasis;

    setBasis(Math.floor(nextBasis));
    setHeight(Math.max(TROPHY_MIN_HEIGHT, Math.floor(Math.min(max, ((available - fixed) * max) / artAtMax))));
  }, [height, max]);

  useLayoutEffect(() => {
    fit();
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div
      ref={ref}
      /*
        No `grow`: the basis above is already exactly the width to take, and
        growing would only re-introduce the fight with the buttons' auto margin.
        `min-w-0` keeps it shrinkable on a line that has already wrapped;
        `overflow-hidden` is a last-resort guard, not the mechanism.

        The first paint uses the full-size ceiling, which errs towards its own
        line — the state that settles to the right answer without a visible
        jump, since a too-small first guess would have to grow into place.
      */
      className="flex min-w-0 flex-nowrap items-end gap-5 overflow-hidden border-l border-slate-200/80 pl-6 dark:border-slate-800"
      style={{ flexBasis: basis ?? max * trophies.length }}
    >
      {trophies.map((trophy) => (
        <TrophyBadge key={trophy.id ?? trophy.kind} trophy={trophy} height={height} onLoad={fit} />
      ))}
    </div>
  );
}

/** Shared affordance for opening the program-budget editor (Program Points / NIL funding). */
/** The masthead's action buttons. One class, so the stack can't drift apart. */
const MASTHEAD_BTN =
  'inline-flex w-full shrink-0 items-center justify-center gap-2 border border-slate-300/80 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition duration-fast ease-standard hover:border-[var(--team-primary)] hover:text-[var(--team-accent-text)] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300';

/**
 * Program editor above Program budget, both the same width.
 *
 * `w-full` inside a stretched column rather than each sizing to its own text —
 * two buttons of different widths stacked on top of each other reads as an
 * accident, and "Program editor" and "Program budget" are near enough in length
 * that matching them costs nothing.
 */
function MastheadActions({ onEditor, onBudget }: { onEditor: () => void; onBudget: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2">
      <button type="button" onClick={onEditor} className={MASTHEAD_BTN}>
        Program editor
      </button>
      <button type="button" onClick={onBudget} className={MASTHEAD_BTN}>
        Program budget
      </button>
    </div>
  );
}

/**
 * The team mark at the SAME size every other team page's masthead uses. This
 * page's header is hand-rolled rather than a `PageMasthead` (it carries
 * trophies and the record banner, which that component has no slot for), and it
 * had been rendering a plain 128px `TeamLogo` — visibly smaller than the marks
 * on Roster, Schedule and the rest.
 *
 * It borrows PageMasthead's own slot and geometry rather than picking a bigger
 * number: the art floats inside a much larger transparent canvas and fills a
 * different fraction of it for every school (a 3.19x spread), so matching by
 * raw box size would leave Auburn and Texas State visibly different heights.
 * See lib/markBounds.ts. `slotLeft: 0` because here the slot IS this element,
 * not a position inside a wider card.
 */
function MastheadMark({ teamAssetName }: { teamAssetName: string }) {
  const { appearance } = useTheme();
  const src = getLogoPath(teamAssetName, appearance);
  const geometry = markGeometry(boundsFor(src, 'logo'), {
    ...MASTHEAD_ART_SLOT.logo,
    slotLeft: 0,
    textGap: 0,
  });

  return (
    <div
      className="relative shrink-0"
      style={{ width: MASTHEAD_ART_SLOT.logo.maxWidth, height: MASTHEAD_ART_SLOT.logo.maxHeight }}
    >
      <img src={src} alt={teamAssetName} draggable={false} className="absolute max-w-none" style={geometry.style} />
    </div>
  );
}

/**
 * Team Hub's header, shared by the user's own hub and a browsed league team so
 * the two can't drift.
 *
 * The row is `items-end`: the actions column (Program budget) lines up with the
 * BOTTOM of the identity block — i.e. with the coach line — instead of floating
 * at the vertical centre of a header whose height is set by the mark.
 */
function TeamHubMasthead({
  teamName,
  headCoach,
  trophies,
  actions,
}: {
  teamName: string;
  headCoach?: { firstName: string; lastName: string } | null;
  trophies?: Trophy[];
  actions?: ReactNode;
}) {
  // Resolved from the display name, exactly as the logo above it is — same
  // canonicalKey, so an alias like "App St." lands on the same school here and
  // there. Null for a TeamBuilder school we have no location for, and the line
  // simply doesn't render.
  const locationLabel = schoolLocationLabel(teamName);
  return (
    <SurfaceCard>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
        <MastheadMark teamAssetName={teamName} />
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-6">
          <div className="min-w-0">
            {/* The "Team Hub" eyebrow is gone: the nav above already says where
                you are, and a label naming the page was the least interesting
                thing that could sit above a program's name. Where the school
                actually is says something instead. */}
            <h2 className="font-display text-page-title font-bold text-slate-950 dark:text-white">{teamName}</h2>
            {locationLabel && (
              /* The CAMPUS town, not the stadium's — see schoolLocations.ts.
                 UCLA is Los Angeles even though the Rose Bowl is in Pasadena. */
              <p className="mt-1 type-eyebrow text-slate-400 dark:text-slate-500">{locationLabel}</p>
            )}
            {headCoach && (
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {headCoach.firstName} {headCoach.lastName} · Head Coach
              </p>
            )}
          </div>
          {trophies && trophies.length > 0 && <TrophyCase trophies={trophies} />}
          {/*
            `ml-auto` survives BECAUSE the trophy case no longer relies on
            flex-grow — an auto margin on the main axis absorbs all free space
            before grow is distributed, and that interaction is exactly what
            kept the trophies small on a wide window. TrophyCase computes its
            own width now (see there), so there is no free space left to fight
            over and these keep their place at the right of the identity row on
            every layout, wrapped or not.
          */}
          {actions && <div className="ml-auto shrink-0">{actions}</div>}
        </div>
      </div>
    </SurfaceCard>
  );
}

/**
 * The record banner is a SIBLING of the masthead card, not a child of it
 * (2026-07-29, user direction). Inside the card it inherited the card's `p-5`,
 * so it sat 20px inside the stat tiles below it on both edges — the one block
 * on the page that didn't line up with anything. As its own block it spans the
 * same column as everything else.
 *
 * Hard edges with the signature cut corner, matching the tiles it now aligns
 * with; the old `rounded-xl` was the only rounded surface left on the page. The
 * drop-shadow went with it — clip-path clips box-shadow (see `.corner-cut`).
 */
function OverallRecordBanner({
  record,
  conferenceRecord,
  teamName,
  colors,
}: {
  record: { wins: number; losses: number };
  conferenceRecord: { wins: number; losses: number };
  /** Drives the map backdrop. Omitted or unknown → the plain gradient. */
  teamName?: string | null;
  /*
    THE BAR WEARS THE PROGRAM IT IS ABOUT, not the one the user coaches.
    Browsing to Ohio State and reading their record off a UCLA-blue slab said
    the page belonged to UCLA, which is exactly backwards — this block is the
    single largest colour on the page and it is the page's subject line.

    Omitted means "the user's own team", which is what every other surface in
    the app means by the inherited `--team-primary`, so the user's own hub is
    unchanged and stays on the global theme (including a custom theme they
    chose in Preferences — overriding that here would ignore their setting).
  */
  colors?: TeamColorVars;
}) {
  /*
    A map of where this program PLAYS, drifting slowly behind the record.

    THE FALLBACK IS THE BANNER AS IT ALWAYS WAS — the team gradient, untouched.
    17 programs have no stadium coordinate and a TeamBuilder school never will,
    and for those the absence should read as "this banner has no map" rather
    than as something that failed to load. No grey placeholder, no empty frame.
  */
  const mapSrc = getTeamMapPath(teamName);
  return (
    <div
      className={`corner-cut relative overflow-hidden ${GRADIENT_TEAM_BLOCK} p-5 text-[var(--team-on-primary)]`}
      /* Local overrides only — every var the gradient and its text read is
         redefined on this element, so nothing outside the banner shifts and
         `--team-on-primary` still lands on the fill it was computed against. */
      style={colors as CSSProperties | undefined}
    >
      {mapSrc && (
        <>
          {/* `luminosity` at 0.30 keeps the team's own colour as the subject and
              lets the map read as texture inside it — a black-primary school
              would swallow a normally-blended map entirely. */}
          <img
            src={mapSrc}
            alt=""
            aria-hidden
            className="team-map-backdrop"
            /* Decorative and heavy-ish; never worth blocking first paint for. */
            loading="lazy"
            decoding="async"
          />
          <span aria-hidden className="team-map-grid" />
          {/*
            DEV ONLY, and gated so it cannot ship: webpack replaces
            process.env.NODE_ENV with a literal under --mode=production, so this
            whole branch — and the imported module with it — is dropped from the
            release bundle. Verified by grepping the built bundle for the
            component's marker string.
          */}
          {process.env.NODE_ENV !== 'production' && <MapTweaker />}
        </>
      )}
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <p className="proportional-nums text-5xl font-semibold tracking-tight">
              {record.wins}-{record.losses}
            </p>
            <p className="text-sm opacity-80">
              Conference {conferenceRecord.wins}-{conferenceRecord.losses}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Recent | Upcoming, split by a hairline (2026-07-29, user direction). The
 * divider is a real 1px grid column rather than a border on either card, so it
 * sits centred in the gap and spans the taller of the two — and it collapses
 * with the columns at narrow widths, where the two cards stack and a vertical
 * rule would mean nothing.
 */
function GamesPair({ recent, upcoming }: { recent: ReactNode; upcoming: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1px_1fr]">
      {recent}
      <div aria-hidden className="hidden bg-[color:var(--section-divider)] xl:block" />
      {upcoming}
    </div>
  );
}

/** The rule closing off a stacked-then-paired run of sections, where the automatic card-to-card divider can't reach (see globals.css). */
function SectionRule() {
  return <div aria-hidden className="h-px bg-[color:var(--section-divider)]" />;
}

function GameRow({ game }: { game: GameSummary }) {
  const resultColor =
    game.result === 'W'
      ? 'text-green-600 dark:text-green-400'
      : game.result === 'L'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5">
      <span className="text-slate-700 dark:text-slate-200">
        Week {game.week} {game.isHome ? 'vs' : '@'} {game.opponent}
      </span>
      {game.result ? (
        <span className={`font-semibold ${resultColor}`}>
          {game.result} {game.teamScore}-{game.opponentScore}
        </span>
      ) : (
        <span className={resultColor}>Upcoming</span>
      )}
    </li>
  );
}

/**
 * League-mode Team Hub — now identical in layout to the user's own Team Hub:
 * the full overview (record, conference record, poll ranks, recruiting-class
 * rank, prestige, recent/upcoming games, top players, trophies), all sourced
 * from the same per-season snapshots via getLeagueTeamOverview. The only thing
 * still user-team-only is season-high ranking history (not tracked leaguewide).
 */
function LeagueTeamHub({ dynastyId, teamIndex, teamName, seasonId }: { dynastyId: string; teamIndex: number; teamName: string; seasonId?: number }) {
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<LeagueTeamRoster | null | undefined>(undefined);
  const [trophies, setTrophies] = useState<TeamTrophies | null>(null);
  /*
    NULL UNTIL IT ARRIVES, and null is meaningful: the banner falls back to the
    inherited theme, which is what it rendered before this existed. So a team
    whose colours the save doesn't carry (an FCS placeholder, a TeamBuilder
    school) gets the old behaviour rather than a grey slab, and there is no
    flash of the wrong colour on a team that has them — the bar simply arrives
    in the user's theme and settles into the browsed team's.
  */
  const [colors, setColors] = useState<TeamColorVars | undefined>(undefined);
  const [programEditorOpen, setProgramEditorOpen] = useState(false);
  const { openPlayerModal } = usePlayerModal();
  const { openTeamBudgetEditor } = useEditorModal();

  useEffect(() => {
    let cancelled = false;
    setOverview(undefined);
    setRoster(undefined);
    setTrophies(null);
    setColors(undefined);
    // Switching teams under an open editor would leave it pointed at the team
    // you just navigated away from, with the new team's name in the masthead
    // behind it.
    setProgramEditorOpen(false);
    window.api.db.getLeagueTeamOverview(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setOverview(r));
    window.api.db.getLeagueTeamRoster(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setRoster(r));
    /*
      THE SAME QUERY THE USER'S OWN HUB RUNS, with this program's index (user
      direction). It used to read `getLeagueTeamHonors`, which only knows about
      conference and national titles — so a browsed team's case was missing
      every bowl it won and every rivalry trophy it holds, while the user's own
      showed all of them. getTrophies was never user-specific in anything but
      its filter: the leaguewide schedule, the teams snapshot and the rivalry
      pairing map all cover all 143 programs.
    */
    window.api.db.getTeamTrophies(dynastyId, seasonId, teamIndex).then((r) => !cancelled && setTrophies(r));
    // Keyed by NAME, which is what getTeamTheme takes; the same key the logo,
    // helmet and stadium-map lookups already use for this team.
    window.api.db.getTeamTheme(dynastyId, teamName, seasonId).then((theme) => {
      if (cancelled || !theme?.primaryColor) return;
      setColors(buildTeamColorVars(theme.primaryColor, theme.secondaryColor));
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, teamName, seasonId]);

  const topPlayers = [...(roster?.players ?? [])].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10);
  const avgOvr =
    roster && roster.players.length > 0
      ? (roster.players.reduce((s, p) => s + p.overallRating, 0) / roster.players.length).toFixed(1)
      : '—';

  const teamTrophies: Trophy[] = trophies?.trophies ?? [];

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Hub...</p>;
  }

  return (
    <div className="space-y-6">
      <TeamHubMasthead
        teamName={teamName}
        headCoach={overview?.headCoach}
        trophies={teamTrophies}
        actions={
          /*
            THE SAME PAIR AS THE USER'S OWN HUB (user direction). The editor was
            held back to the user's own program while the storage was unproven;
            it was ALWAYS keyed by the save's team SLOT rather than by "mine",
            so opening it here is the entry point the original note anticipated
            rather than a change of shape — `teamIndex` is the only thing that
            differs, and it was already a parameter.

            This is what makes a TeamBuilder-heavy league usable: someone who
            imported a dozen custom schools can give every one of them its
            stadium name and its artwork, not only the one they coach. Still
            nothing written to the save — see ProgramEditorModal.
          */
          <MastheadActions
            onEditor={() => setProgramEditorOpen(true)}
            onBudget={() => openTeamBudgetEditor({ dynastyId, teamIndex, teamLabel: teamName })}
          />
        }
      />

      <OverallRecordBanner
        record={overview?.record ?? { wins: 0, losses: 0 }}
        conferenceRecord={overview?.conferenceRecord ?? { wins: 0, losses: 0 }}
        teamName={teamName}
        colors={colors}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Conference record" value={`${overview?.conferenceRecord.wins ?? 0}-${overview?.conferenceRecord.losses ?? 0}`} />
        <StatTile label="Media poll" value={rankLabel(overview?.rankings.media ?? null)} />
        <StatTile label="Coaches poll" value={rankLabel(overview?.rankings.coaches ?? null)} />
        <StatTile label="CFP rank" value={rankLabel(overview?.rankings.cfp ?? null)} />
        <StatTile label="Recruiting class" value={rankLabel(overview?.recruitingClassRank ?? null)} />
        <StatTile label="Program prestige" value={overview?.teamPrestige == null ? 'Not available' : String(overview.teamPrestige)} />
        <StatTile label="Roster" value={String(roster?.players.length ?? 0)} />
        <StatTile label="Average OVR" value={avgOvr} />
      </div>

      <GamesPair
        recent={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recent games</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Latest results</h3>
            {!overview || overview.recentGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games played yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.recentGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
        upcoming={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Upcoming games</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">What is next</h3>
            {!overview || overview.upcomingGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.upcomingGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
      />

      <SectionRule />

      <TopPlayersCard
        players={roster?.players ?? []}
        teamAssetName={teamName}
        onSelect={(p) =>
          openPlayerModal(
            dynastyId,
            p.id,
            roster?.seasonId,
            topPlayers.map((x) => x.id),
            {
              name: `${p.firstName} ${p.lastName}`,
              position: p.position,
              teamDisplayName: teamName,
              portraitAssetName: p.portraitAssetName,
            },
            teamIndex,
          )
        }
      />

      <ProgramEditorModal
        open={programEditorOpen}
        onClose={() => setProgramEditorOpen(false)}
        dynastyId={dynastyId}
        teamIndex={teamIndex}
        teamName={teamName}
      />
    </div>
  );
}

export function DynastyOverview() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [trophies, setTrophies] = useState<TeamTrophies | null | undefined>(undefined);
  const [rankings, setRankings] = useState<RankingsOverview | null | undefined>(undefined);
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();
  const { openTeamBudgetEditor } = useEditorModal();
  const { openPlayerModal } = usePlayerModal();
  const [yearbookMsg, setYearbookMsg] = useState<string | null>(null);
  const [yearbookBusy, setYearbookBusy] = useState(false);
  const [programEditorOpen, setProgramEditorOpen] = useState(false);

  async function exportYearbook() {
    if (!id || seasonId === undefined) return;
    setYearbookBusy(true);
    setYearbookMsg(null);
    try {
      const result = await window.api.export.seasonYearbookToHtml(id, seasonId);
      setYearbookMsg(result.message);
    } finally {
      setYearbookBusy(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getTeamTrophies(id, seasonId).then((result) => {
      if (!cancelled) setTrophies(result);
    });
    window.api.db.getRankings(id, seasonId).then((result) => {
      if (!cancelled) setRankings(result);
    });
    window.api.db.getRoster(id, seasonId).then((result) => {
      if (!cancelled) setRoster(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (id && viewedTeamIndex !== null) {
    const teamName = leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team';
    return <LeagueTeamHub dynastyId={id} teamIndex={viewedTeamIndex} teamName={teamName} seasonId={seasonId} />;
  }

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Hub...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // The user's own teamIndex isn't on SeasonOverview, but overview.teamName IS
  // userTeam.displayName (see getSeasonOverview) — the same field leagueTeams
  // carries — so this resolves the index for the budget editor. Null (button
  // hidden) only when league snapshots predate this season.
  const userTeamIndex = id ? (leagueTeams?.find((t) => t.displayName === overview.teamName)?.teamIndex ?? null) : null;

  return (
    <div className="space-y-6">
      {/* Season Yearbook moved to the foot of the page — see the export row at
          the bottom. It's an end-of-visit action, not part of the team's
          identity header, and stacked up here it crowded the masthead. */}
      <TeamHubMasthead
        teamName={overview.teamName}
        headCoach={overview.headCoach}
        trophies={trophies?.trophies}
        actions={
          userTeamIndex !== null && id ? (
            <MastheadActions
              onEditor={() => setProgramEditorOpen(true)}
              onBudget={() => openTeamBudgetEditor({ dynastyId: id, teamIndex: userTeamIndex, teamLabel: overview.teamName })}
            />
          ) : undefined
        }
      />

      {/*
        NO POSTSEASON MARK IN THE BAR (user direction). The bowl / playoff logo
        used to ride the right end of the record banner, which put a second
        piece of event artwork on a page that already carries the trophy for
        winning that same event twelve pixels above it. The bar is the record;
        the masthead is the silverware.
      */}
      <OverallRecordBanner
        record={overview.record}
        conferenceRecord={overview.conferenceRecord}
        teamName={overview.teamName}
      />

      {/* ONE grid, not two. The season-high tiles used to be their own grid, so
          the gap above that row was the page's 24px section spacing while the
          rows inside each grid were 12px apart — the third row visibly sat lower
          than the first two. Same grid, same gap everywhere. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Conference record"
          value={`${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses}`}
        />
        <StatTile label="Media poll" value={rankLabel(overview.rankings.media)} />
        <StatTile label="Coaches poll" value={rankLabel(overview.rankings.coaches)} />
        <StatTile label="CFP rank" value={rankLabel(overview.rankings.cfp)} />
        <StatTile label="Recruiting class" value={rankLabel(overview.recruitingClassRank)} />
        <StatTile
          label="Program prestige"
          value={overview.teamPrestige === null ? 'Not available' : String(overview.teamPrestige)}
        />
        {rankings && (
          <>
            <StatTile label="Season-High Media/AP" value={rankLabel(rankings.highestMediaPollRank)} />
            <StatTile label="Season-High Coaches" value={rankLabel(rankings.highestCoachesPollRank)} />
            <StatTile label="Season-High CFP" value={rankLabel(rankings.highestCfpRank)} />
          </>
        )}
      </div>

      <GamesPair
        recent={
          <SurfaceCard>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Recent games
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Latest results
                </h3>
              </div>
              <Link to={`/dynasty/${id}/schedule`} className="text-sm font-medium text-[var(--team-accent-text)] hover:underline">
                Schedule
              </Link>
            </div>
            {overview.recentGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games played yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.recentGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
        upcoming={
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Upcoming games
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              What is next
            </h3>
            {overview.upcomingGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {overview.upcomingGames.map((game) => (
                  <GameRow key={`${game.week}-${game.opponent}`} game={game} />
                ))}
              </ul>
            )}
          </SurfaceCard>
        }
      />

      {/* Top players — the same shared card the league-team view uses (Phase 4 unification). */}
      {roster && roster.length > 0 && userTeamIndex !== null && (
        <SectionRule />
      )}
      {roster && roster.length > 0 && userTeamIndex !== null && (
        <TopPlayersCard
          players={roster}
          teamAssetName={overview.teamName}
          onSelect={(p) =>
            openPlayerModal(
              id ?? '',
              p.id,
              seasonId,
              [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10).map((x) => x.id),
              {
                name: `${p.firstName} ${p.lastName}`,
                position: p.position,
                teamDisplayName: overview.teamName,
                portraitAssetName: p.portraitAssetName,
              },
              userTeamIndex,
            )
          }
        />
      )}

      {/* Export row — the last thing on the page, where "I'm done reading this
          season, now save it" naturally belongs. */}
      {id && seasonId !== undefined && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200/70 pt-6 dark:border-white/10">
          <button
            type="button"
            onClick={exportYearbook}
            disabled={yearbookBusy}
            title={`Export a shareable ${overview.seasonYear} Season in Review page`}
            className="inline-flex items-center gap-2 border border-slate-300/80 bg-white/85 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
          >
            {yearbookBusy ? 'Exporting…' : `Export ${overview.seasonYear} Season Yearbook ↗`}
          </button>
          {yearbookMsg && <p className="text-xs text-slate-400 dark:text-slate-500">{yearbookMsg}</p>}
        </div>
      )}

      {id && userTeamIndex !== null && (
        <ProgramEditorModal
          open={programEditorOpen}
          onClose={() => setProgramEditorOpen(false)}
          dynastyId={id}
          teamIndex={userTeamIndex}
          teamName={overview.teamName}
        />
      )}
    </div>
  );
}
