import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { GliderNav } from '../ui/GliderNav';
import { PlayerPortrait } from './PlayerPortrait';
import { CoachPortrait } from './CoachPortrait';
import { TeamLogo } from './TeamLogo';
import { useModalLayer } from '../../lib/modalLayer';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useTeamModal } from '../../data/TeamModalProvider';
import { useRecruitingExperience } from '../../data/RecruitingExperienceProvider';
import { spaceCamelCase } from './CoachCard';
import type { GlobalSearchResults } from '../../../shared/types';

const EMPTY: GlobalSearchResults = { players: [], coaches: [], teams: [] };
const RECENTS_KEY = 'dynastyos:palette-recents';
const MAX_RECENTS = 5;

/** Pull the active dynasty id out of the URL (/dynasty/:id/...). Null on the Dashboard. */
function useDynastyId(): string | null {
  const { pathname } = useLocation();
  return pathname.match(/^\/dynasty\/([^/]+)/)?.[1] ?? null;
}

/**
 * Every page the palette can jump to, written out with HUMAN labels rather than
 * derived from the route table. "Program → Statistics" is what someone types
 * toward; `statistics` is what the router calls it, and the two are not the same
 * search target. `keywords` carries the words people actually reach for that
 * aren't in the label ("depth chart" for Roster, "polls" for Standings).
 */
const PAGES: { path: string; section: string; label: string; keywords?: string }[] = [
  // The five section landings are labelled with the words ON THE NAV — Coach,
  // Program, NCAA, Recruiting, Media. They were "Coach Hub" / "Team Hub" /
  // "NCAA Hub", which is vocabulary the app stopped using: someone who has only
  // ever seen this nav has no idea what "Team Hub" is, so typing "program" found
  // nothing. The retired names live on as keywords so they still resolve for
  // anyone who remembers them, and the sublabel says what the page actually
  // holds instead of repeating the section name back.
  // The Coach section's sublabel and keywords track what Overview ACTUALLY
  // holds now that career, staff and legacy are their own destinations below —
  // an entry that still promised "career résumé tree" would land you on a page
  // that no longer has any of them.
  { path: '', section: 'Record, contract, form', label: 'Coach', keywords: 'coach hub contract job security cardbook scandals' },
  { path: 'team-hub', section: 'Team overview', label: 'Program', keywords: 'team hub overview record program' },
  { path: 'ncaa-hub', section: 'National overview', label: 'NCAA', keywords: 'ncaa hub national league country' },
  { path: 'recruiting', section: 'Your board', label: 'Recruiting', keywords: 'recruit hub my board recruits commits' },
  { path: 'media', section: 'Photos and clips', label: 'Media', keywords: 'media hub screenshots photos gallery' },

  { path: 'coach/season', section: 'Coach', label: 'Season', keywords: 'this year form splits margin trends' },
  { path: 'coach/career', section: 'Coach', label: 'Career', keywords: 'record résumé resume accomplishments championships bowls' },
  { path: 'coach/staff', section: 'Coach', label: 'Staff', keywords: 'coordinators assistants oc dc units coaching tree branches where they went promoted' },
  { path: 'coach/milestones', section: 'Coach', label: 'Milestones', keywords: 'legacy achievements titles streaks firsts history' },
  { path: 'coach/trophy-room', section: 'Coach', label: 'Trophy Room', keywords: 'trophies championships bowls awards heisman silverware cabinet' },
  { path: 'hall', section: 'Coach', label: 'Hall of Champions', keywords: 'legends all time greatest players first team' },

  { path: 'roster', section: 'Program', label: 'Roster', keywords: 'players depth chart nil team' },
  { path: 'transfers', section: 'Program', label: 'Transfers', keywords: 'portal' },
  { path: 'schedule', section: 'Program', label: 'Schedule', keywords: 'games results' },
  { path: 'rivalries', section: 'Program', label: 'Rivalries', keywords: 'trophy games' },
  { path: 'statistics', section: 'Program', label: 'Statistics', keywords: 'stats leaders' },
  { path: 'trends', section: 'Program', label: 'Analytics', keywords: 'trends charts' },
  { path: 'team-awards', section: 'Program', label: 'Season Awards', keywords: 'honors trophies' },
  { path: 'weekly-honors', section: 'Program', label: 'Weekly Honors', keywords: 'player of the week' },
  // The backfill editor is a modal ON this page, not a route of its own, so it
  // is reachable by the words someone would actually type to look for it
  // rather than by a fake destination that would then need its own routing.
  {
    path: 'history',
    section: 'Program',
    label: 'History',
    keywords:
      'program record book past seasons timeline add earlier seasons backfill missing years before dynastyos my own records notes spreadsheet manual',
  },

  { path: 'scores', section: 'NCAA', label: 'Scores', keywords: 'box scores games week' },
  { path: 'national-stats', section: 'NCAA', label: 'National Statistics', keywords: 'leaders team stats' },
  { path: 'players', section: 'NCAA', label: 'National Players', keywords: 'every player country' },
  { path: 'standings', section: 'NCAA', label: 'Standings', keywords: 'conference polls rankings' },
  { path: 'annual-awards', section: 'NCAA', label: 'Annual Awards', keywords: 'heisman' },
  { path: 'all-america', section: 'NCAA', label: 'All-America & All-Conference', keywords: 'honors teams' },
  { path: 'ncaa-records', section: 'NCAA', label: 'Record Book', keywords: 'records' },

  { path: 'recruits', section: 'Recruiting', label: 'National Recruits', keywords: 'prospects class' },
  { path: 'watchlist', section: 'Recruiting', label: 'Watchlist', keywords: 'starred recruits' },
];

/**
 * How well a haystack matches what's been typed, lower is better: a label that
 * STARTS with the query beats one that merely contains it, and a word-start beats
 * a match buried mid-word. Without this, typing "sta" put "National Statistics"
 * above "Standings" purely by list order. -1 means no match at all.
 */
function score(label: string, keywords: string, query: string): number {
  const l = label.toLowerCase();
  const q = query.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s—·&-]+/).some((word) => word.startsWith(q))) return 1;
  if (l.includes(q)) return 2;
  if (keywords.toLowerCase().includes(q)) return 3;
  return -1;
}

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  trailing?: string;
  icon?: ReactNode;
  run: () => void;
}

interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/**
 * The command palette — Ctrl/Cmd+K from anywhere inside a dynasty.
 *
 * Replaces the old search modal, and the difference that matters is what it can
 * REACH: people and teams as before, plus every page and sub-page, so the fastest
 * route to Standings is three keystrokes rather than two clicks through a hub.
 *
 * The backdrop DARKENS AND NOTHING ELSE. The modal shell it used to borrow adds
 * `backdrop-blur-md` on the scrim and `backdrop-blur-2xl` on the panel, which is
 * what made the page behind read as grey mush — the reported complaint. A
 * palette should feel like a light switched on over a page that's still there.
 *
 * Everything else is the app's existing language rather than a new one: the
 * active row is the same sliding glider as the sidebar and the dropdowns (one
 * GliderNav per section, so only the section holding the cursor shows a mark),
 * the same easing, the same hairline borders.
 */
export function CommandPalette({ triggerClassName }: { triggerClassName?: string }) {
  const dynastyId = useDynastyId();
  const navigate = useNavigate();
  const { openPlayerModal } = usePlayerModal();
  const { openTeamModal } = useTeamModal();
  // The same lock set the Recruit Hub uses, so a prospect revealed there is
  // revealed here and nowhere else leaks the rating.
  const { ovr } = useRecruitingExperience();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const zIndex = useModalLayer(open);

  const close = useCallback(() => setOpen(false), []);

  // Ctrl/Cmd+K from anywhere in a dynasty — but never over an open editor. A
  // palette stacked on an unsaved player edit is a way to lose work by reflex.
  useEffect(() => {
    if (!dynastyId) return undefined;
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      if (!open && document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dynastyId, open]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setResults(EMPTY);
    setActiveIndex(0);
    setRecents(readRecents());
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  // People and teams come from the DB and are debounced; pages are local and
  // filter instantly, so the list never feels like it's waiting on a query.
  useEffect(() => {
    if (!open || !dynastyId) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      window.api.db.globalSearch(dynastyId, q).then((r) => {
        if (cancelled) return;
        setResults(r ?? EMPTY);
        setLoading(false);
      });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, dynastyId]);

  function remember(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...readRecents().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENTS);
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: recents simply won't persist.
    }
  }

  const go = useCallback(
    (path: string) => {
      if (!dynastyId) return;
      navigate(path ? `/dynasty/${dynastyId}/${path}` : `/dynasty/${dynastyId}`);
      close();
    },
    [dynastyId, navigate, close],
  );

  const sections = useMemo<PaletteSection[]>(() => {
    if (!dynastyId) return [];
    const q = query.trim();

    /*
      An empty palette shows RECENTS ONLY. It used to list every page under a
      "Jump to" heading as well — 28 rows on open, which reads as a wall rather
      than an invitation. The pages are all still one keystroke away the moment
      you type; they just don't greet you.
    */
    if (q.length === 0) {
      return recents.length
        ? [
            {
              title: 'Recent searches',
              items: recents.map<PaletteItem>((term) => ({
                id: `recent-${term}`,
                label: term,
                sublabel: 'Recent search',
                run: () => setQuery(term),
              })),
            },
          ]
        : [];
    }

    const pageItems = PAGES.map((p) => ({ p, s: score(p.label, p.keywords ?? '', q) }))
      .filter((entry) => entry.s !== -1)
      .sort((a, b) => a.s - b.s || a.p.label.localeCompare(b.p.label))
      .map<PaletteItem>(({ p }) => ({
        id: `page-${p.path || 'coach'}`,
        label: p.label,
        sublabel: p.section,
        run: () => {
          remember(q);
          go(p.path);
        },
      }));

    const out: PaletteSection[] = [];
    if (pageItems.length) out.push({ title: 'Pages', items: pageItems });

    if (results.players.length) {
      out.push({
        title: 'Players',
        /*
          A recruit row is not a player row. Prospects share the league roster
          this searches, so without the `isRecruit` split they listed as ordinary
          players on a placeholder team ("FCS West") with their overall rating
          printed in the trailing slot — which is the Recruit Hub's hidden-ratings
          rule bypassed entirely, from a box that is two keystrokes away.

          So: say "Recruit" rather than a school they haven't got, and withhold
          the rating unless that prospect has actually been revealed (the same
          `ovr` lock set the Recruit Hub reads, so revealing in one place is
          honoured in the other).
        */
        items: results.players.map<PaletteItem>((p) => ({
          id: `player-${p.id}`,
          label: `${p.firstName} ${p.lastName}`,
          sublabel: p.isRecruit ? `${p.position} · Recruit` : `${p.position} · ${p.teamName ?? 'Free agent'}`,
          trailing: p.isRecruit && !ovr.isUnlocked(p.id) ? 'OVR hidden' : `${p.overallRating} OVR`,
          icon: <PlayerPortrait player={p} size="sm" className="!h-8 !w-8 shrink-0" />,
          run: () => {
            remember(q);
            openPlayerModal(
              dynastyId,
              p.id,
              undefined,
              undefined,
              {
                name: `${p.firstName} ${p.lastName}`,
                position: p.position,
                teamDisplayName: p.teamName ?? '',
                portraitAssetName: p.portraitAssetName,
              },
              p.teamIndex,
            );
            close();
          },
        })),
      });
    }

    if (results.teams.length) {
      out.push({
        title: 'Teams',
        items: results.teams.map<PaletteItem>((t) => ({
          id: `team-${t.teamIndex}`,
          label: t.displayName,
          sublabel: t.conferenceName ?? undefined,
          icon: <TeamLogo team={{ assetName: t.displayName, label: t.displayName }} size="sm" className="!h-8 !w-8 shrink-0" />,
          run: () => {
            remember(q);
            openTeamModal(dynastyId, t.teamIndex);
            close();
          },
        })),
      });
    }

    if (results.coaches.length) {
      out.push({
        title: 'Coaches',
        items: results.coaches.map<PaletteItem>((c, i) => ({
          id: `coach-${c.teamIndex}-${i}`,
          label: `${c.firstName} ${c.lastName}`,
          sublabel: `${spaceCamelCase(c.position)}${c.teamName ? ` · ${c.teamName}` : ''}`,
          icon: <CoachPortrait coach={c} size="sm" className="!h-8 !w-8 shrink-0" />,
          run: () => {
            remember(q);
            openTeamModal(dynastyId, c.teamIndex);
            close();
          },
        })),
      });
    }

    return out;
    // `ovr` belongs here: revealing a prospect has to re-render the rows so the
    // hidden rating actually appears without retyping the search.
  }, [dynastyId, query, results, recents, go, openPlayerModal, openTeamModal, close, ovr]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // The top hit is always armed, so Enter never does nothing.
  useEffect(() => {
    setActiveIndex((prev) => (prev < flat.length ? prev : 0));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  /**
   * The inline completion. It is NOT written into the input — it's a muted span
   * layered underneath, and Tab copies it in. Rewriting the value as you type
   * means fighting the caret and the selection on every keystroke, and it lands
   * wrong the moment the guess is wrong; a ghost is honest about being a guess.
   * Only offered when what you've typed is a real prefix of the armed result.
   */
  const ghost = useMemo(() => {
    const q = query;
    if (!q.trim()) return '';
    const label = flat[activeIndex]?.label ?? '';
    return label.toLowerCase().startsWith(q.toLowerCase()) ? label.slice(q.length) : '';
  }, [query, flat, activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, flat.length - 1));
        break;
      case 'Tab':
        if (ghost) {
          event.preventDefault();
          setQuery(query + ghost);
        }
        break;
      case 'Enter':
        event.preventDefault();
        flat[activeIndex]?.run();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      default:
        break;
    }
  }

  if (!dynastyId) return null;

  const hasQuery = query.trim().length >= 2;
  const showEmpty = hasQuery && !loading && flat.length === 0;
  let offset = 0;

  return (
    <>
      {/*
        Icon only. The trigger used to be a search-BOX — a bordered field with a
        "Ctrl K" chip — which promised typing it never accepted: clicking it
        opened the palette, and the field itself was decoration. A glyph makes an
        honest button of it, and the shortcut lives in the tooltip instead of
        taking up a permanent chip.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Search"
        title="Search — Ctrl K"
      >
        <SearchGlyph />
      </button>

      {open &&
        createPortal(
          <div
            className="palette-scrim fixed inset-0 flex items-start justify-center bg-black/55 p-4 pt-[12vh]"
            style={{ zIndex }}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="palette-panel corner-cut-sm flex w-full max-w-[40rem] flex-col overflow-hidden border border-[color:var(--section-divider)] bg-white dark:bg-black"
              onKeyDown={onKeyDown}
            >
              <div className="relative flex items-center gap-3 border-b border-[color:var(--section-divider)] px-4 py-3">
                <SearchGlyph />
                {/* The ghost sits in the same box as the input, with the same
                    metrics, so the completion lines up with what's typed. */}
                <div className="relative min-w-0 flex-1">
                  <p aria-hidden className="pointer-events-none absolute inset-0 truncate text-sm leading-6 text-transparent">
                    {query}
                    <span className="text-slate-400 dark:text-slate-600">{ghost}</span>
                  </p>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search players, teams, or pages…"
                    aria-label="Search players, teams, or pages"
                    className="relative w-full bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
                {ghost && (
                  <span className="hidden shrink-0 border border-[color:var(--section-divider)] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 sm:inline">
                    Tab
                  </span>
                )}
                <span className="shrink-0 border border-[color:var(--section-divider)] px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Esc
                </span>
              </div>

              <div ref={listRef} className="max-h-[52vh] overflow-y-auto overflow-x-hidden py-1">
                {showEmpty ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No matches for “{query.trim()}”.
                  </p>
                ) : sections.length === 0 ? (
                  /* First run, before there are any recents — one line, not a
                     list. Something has to be here or the panel opens blank. */
                  <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    Type a player, a school, or where you want to go.
                  </p>
                ) : (
                  sections.map((section) => {
                    const start = offset;
                    offset += section.items.length;
                    return (
                      <div key={section.title} className="pb-1">
                        <p className="px-4 pb-1 pt-2 type-eyebrow text-slate-400 dark:text-slate-500">{section.title}</p>
                        {/* One GliderNav per section: the cursor lives in exactly
                            one of them, and the others pass -1, which hides their
                            mark. That's what lets the palette reuse the sidebar's
                            indicator across grouped results. */}
                        <GliderNav
                          activeIndex={activeIndex >= start && activeIndex < start + section.items.length ? activeIndex - start : -1}
                          orientation="vertical"
                          emphasis="quiet"
                          ariaLabel={section.title}
                        >
                          {section.items.map((item, i) => {
                            const index = start + i;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                data-index={index}
                                data-palette-item={item.id}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={item.run}
                                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-fast ${
                                  index === activeIndex
                                    ? 'text-[color:var(--glider-label)]'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {item.icon}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                                  {item.sublabel && (
                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                      {item.sublabel}
                                    </span>
                                  )}
                                </span>
                                {item.trailing && (
                                  <span className="tnum shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500">
                                    {item.trailing}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </GliderNav>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[color:var(--section-divider)] px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500">
                <span>↑↓ move · ↵ open{ghost ? ' · Tab complete' : ''}</span>
                <span>{loading ? 'Searching…' : `${flat.length} result${flat.length === 1 ? '' : 's'}`}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3 3" strokeLinecap="round" />
    </svg>
  );
}
