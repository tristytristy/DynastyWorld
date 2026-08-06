import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useGameModal } from '../data/GameModalProvider';
import type { CustomAlbum, MediaAlbum, MediaFraming, MediaItemPatch, MediaItemWithPath, RosterPlayer, ScheduleGame, ScheduleOverview } from '../../shared/types';
import { InfoHint } from '../components/ui/InfoHint';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { TeamLogo } from '../components/common/TeamLogo';
import { getGameTypeImagePath } from '../lib/scheduleFormat';
import { getRivalryLogoPath } from '../lib/rivalryAssetMapping';
import { useTheme } from '../theme/ThemeProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useConfirm } from '../data/ConfirmDialogProvider';
import { AllPhotosIcon, CloseIcon, EditIcon, ExportIcon, GridViewIcon, ListViewIcon, PlusIcon, TrashIcon } from '../components/common/ActionIcons';
import { ModalCloseButton } from '../components/common/ModalCloseButton';
import { ZoomableImage, framingTransform } from '../components/common/ZoomableImage';
import { MediaBackdrop } from '../components/common/MediaBackdrop';
import {
  DEFAULT_MEDIA_LOOK,
  FILTER_PRESETS,
  filterCss,
  findPreset,
  isUntreated,
  resolveMediaLook,
  vignetteCss,
  washStyle,
  type MediaLook,
} from '../../shared/mediaLook';

/**
 * The batch panel's "take the game off these" option.
 *
 * A sentinel and not '', because '' already means "don't touch the game" — the
 * dropdown's resting state. Two different intentions cannot share one value:
 * without this, opening Select to tag a player would unfile every photo you had
 * selected.
 */
const CLEAR_GAME = '__clear__';

/** The dropdown row that opens the "name it" field rather than selecting an album. */
const NEW_ALBUM = '__new_album__';

const DELETE_MEDIA_CONFIRM = {
  eyebrow: 'Delete media',
  title: 'Delete this media?',
  message: 'The file is removed from this dynasty’s library and cannot be undone.',
  confirmLabel: 'Delete',
  tone: 'danger' as const,
};

/** Absolute on-disk path → a URL the (file://-origin) renderer can load. */
function fileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

function gameLabel(game: ScheduleGame): string {
  const score =
    game.teamScore !== null && game.opponentScore !== null
      ? ` ${game.result ?? ''} ${game.teamScore}-${game.opponentScore}`
      : '';
  return `Wk ${game.week} ${game.isHome ? 'vs' : '@'} ${game.opponent}${score}`;
}

function playerLabel(player: RosterPlayer): string {
  return `${player.firstName} ${player.lastName}`;
}

/**
 * Whether the plate's team mark wears its gold variant — an app-wide taste
 * setting, not a per-photo one, because it's a look you pick once for your
 * dynasty rather than a fact about a particular photograph.
 */
const GOLD_MARK_KEY = 'cfb.mediaPlateGoldMark';

/**
 * Which arrangement the library opens in.
 *
 * REMEMBERED (user direction) — picking Grid every single visit is a tax on a
 * preference that never changes. Per-machine like the other view preferences,
 * because it is about how this person likes to look at a page, not about the
 * dynasty; a shared archive should not carry one person's habit into someone
 * else's copy.
 */
const MEDIA_VIEW_KEY = 'cfb.mediaView';

const VIEW_LABELS: Record<'list' | 'grid' | 'all', string> = {
  list: 'List view',
  grid: 'Album view',
  all: 'All photos',
};

type MediaView = 'list' | 'grid' | 'all';

function loadMediaView(): MediaView {
  try {
    const stored = localStorage.getItem(MEDIA_VIEW_KEY);
    return stored === 'grid' || stored === 'all' ? stored : 'list';
  } catch {
    return 'list';
  }
}

function saveMediaView(view: MediaView): void {
  try {
    localStorage.setItem(MEDIA_VIEW_KEY, view);
  } catch {
    // A blocked localStorage just means it opens in List next time.
  }
}

function loadGoldMark(): boolean {
  try {
    return localStorage.getItem(GOLD_MARK_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * The emblem for the occasion, most specific first — the same resolution the
 * box score's hero uses, so a photo from the Iron Bowl carries the mark that
 * game carries everywhere else in the app.
 *
 * Rivalry outranks conference: the Iron Bowl is not "an SEC game" to anyone who
 * cares that it's being played. It does not outrank a bowl — if two rivals meet
 * in the Playoff, the round is the occasion.
 */
function occasionMarkSrc(game: ScheduleGame, appearance: 'light' | 'dark'): string | null {
  if (game.gameType !== 'bowl') {
    const rivalry = getRivalryLogoPath(game.teamName, game.opponent, game.isRivalryGame);
    if (rivalry) return rivalry;
  }
  return getGameTypeImagePath(game, appearance);
}

/**
 * The game, written as a sentence rather than a scoreboard fragment.
 *
 * "21-14 win vs Eastern Michigan in week 0." is what a caption says; "Wk 0 @
 * E. Michigan W 21-14 →" is what a button says. This plate is a caption, so the
 * abbreviations go.
 */
function gameSentence(game: ScheduleGame): string {
  const where = game.isHome ? 'vs' : 'at';
  const week = `week ${game.week}`;
  if (game.teamScore === null || game.opponentScore === null) {
    return `${where} ${game.opponent} in ${week}.`;
  }
  const outcome = game.result === 'W' ? 'win' : game.result === 'L' ? 'loss' : 'tie';
  return `${game.teamScore}-${game.opponentScore} ${outcome} ${where} ${game.opponent} in ${week}.`;
}

/**
 * ONE PHOTO IN A GRID — the tile, lifted out so the folder view and the flat
 * grid view draw exactly the same thing. They are two arrangements of the same
 * object, and a second copy of this markup would have drifted the first time
 * either one was touched.
 *
 * Everything it needs is passed in, including `index`, which is the item's
 * position in the FLAT season list rather than in whatever group is drawing it:
 * drag-to-reorder and the lightbox's Prev/Next both work across the whole
 * season, so the group a tile happens to sit in must not change its identity.
 */
function MediaTile({
  item,
  index,
  caption,
  selectMode,
  selected,
  onOpen,
  onToggleSelect,
  onDragStartTile,
  onDragEndTile,
  onDragOverTile,
  onDropTile,
  canReorder,
  onDelete,
  tileRef,
  dragging,
}: {
  item: MediaItemWithPath;
  index: number;
  caption: string;
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onDragStartTile: () => void;
  onDragEndTile: () => void;
  /** Fired when a dragged tile crosses this one — moves it here, live. */
  onDragOverTile: () => void;
  onDropTile: (event: ReactDragEvent) => void;
  canReorder: boolean;
  onDelete: () => void;
  /** Registers the element for the FLIP animation — see useReorderFlip. */
  tileRef?: (el: HTMLDivElement | null) => void;
  /** True while this tile is the one being dragged. */
  dragging?: boolean;
}) {
  return (
              <div
                key={item.id}
                ref={tileRef}
                data-media-id={item.id}
                role="button"
                tabIndex={0}
                draggable={!selectMode}
                onDragStart={(e) => {
                  onDragStartTile();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={onDragEndTile}
                onDragOver={(e) => {
                  // Only for an internal reorder — a FILE drag has to fall
                  // through to the page's own drop target.
                  if (!canReorder) return;
                  e.preventDefault();
                  onDragOverTile();
                }}
                onDrop={onDropTile}
                onClick={() => (selectMode ? onToggleSelect() : onOpen())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (selectMode) onToggleSelect();
                    else onOpen();
                  }
                }}
                aria-label={selectMode ? `Select media: ${caption}` : `Open media: ${caption}`}
                /*
                  `media-tile` owns the lift and the drop-into-place easing (see
                  globals.css). The transition is NOT a Tailwind `transition`
                  here: the FLIP animation writes `transition` and `transform`
                  on this element directly, and a class-level transition on the
                  same properties fights it — the tile would ease to its old
                  position and then jump.
                */
                className={`media-tile group relative aspect-video overflow-hidden border bg-slate-950 text-left ${
                  dragging ? 'media-tile--dragging' : ''
                } ${
                  selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                } ${
                  selected
                    ? 'border-[var(--team-primary)] outline outline-2 outline-[var(--team-primary)]'
                    : 'border-slate-200/80 hover:border-[var(--team-primary)] dark:border-slate-800'
                }`}
              >
                {item.mediaType === 'video' ? (
                  <>
                    <video src={fileUrl(item.absolutePath)} preload="metadata" muted className="pointer-events-none h-full w-full object-cover" />
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/60 bg-slate-950/60 px-3 py-1.5 text-sm font-semibold text-white">
                      ▶ Video
                    </span>
                  </>
                ) : (
                  <img
                    src={fileUrl(item.absolutePath)}
                    alt={caption}
                    loading="lazy"
                    /* A framed photo shows its framing here too — a crop you
                       saved and then didn't see anywhere would read as not
                       having saved. The tile stays object-cover (so nothing
                       letterboxes and un-framed tiles look exactly as before)
                       and the framing rides on top, which lands on the same
                       part of the photo cropped to the tile's shape. */
                    className={`pointer-events-none h-full w-full object-cover ${item.framing ? '' : 'transition duration-base ease-standard group-hover:scale-[1.03]'}`}
                    /* The tile wears the treatment too — a photo you took to
                       black and white should be black and white in the grid,
                       or the library stops being a picture of itself. */
                    style={{
                      transform: framingTransform(item.framing),
                      filter: filterCss(resolveMediaLook(item.look)) || undefined,
                    }}
                    draggable={false}
                  />
                )}

                {selectMode && (
                  <span
                    className={`pointer-events-none absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                      selected
                        ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                        : 'border-white/70 bg-slate-950/50 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                )}

                {/*
                  THE CAPTION BAR IS A HOVER STATE, not furniture. A wall of
                  thumbnails each wearing a dark gradient and a line of text is
                  a list of filenames; the same wall without them is a contact
                  sheet, which is what this page is for. Point at one and it
                  tells you what it is and offers the bin.

                  The WHOLE bar fades, gradient included — the gradient exists
                  only to keep the caption legible over a bright photo, so
                  leaving it lit under nothing would be a smudge with no job.
                  `group-focus-within` keeps the delete button reachable by
                  keyboard: tabbing into the tile reveals the bar it lives in,
                  rather than moving focus to something invisible.
                */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-6 opacity-0 transition-opacity duration-base ease-standard group-hover:opacity-100 group-focus-within:opacity-100">
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      aria-label={`Delete media: ${caption}`}
                      title="Delete"
                      className="pointer-events-auto shrink-0 border border-white/25 bg-slate-950/70 p-1.5 text-slate-200 transition hover:border-red-400/70 hover:bg-red-950/70 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]"
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100">{caption}</span>
                  {item.playerIds.length > 0 && (
                    <span className="tnum shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {item.playerIds.length} tagged
                    </span>
                  )}
                </div>
              </div>
  );
}

/**
 * The rename editor for one folder — used by the list row, the album box on
 * the shelf, and the header of an album opened in grid. Three places, one
 * control: a folder is renamed the same way wherever you happen to be looking
 * at it.
 */
function RollRenamer({
  roll,
  draft,
  onDraft,
  onSave,
  onUseGameName,
  onDelete,
  onCancel,
}: {
  roll: { defaultLabel: string; custom: string | null; albumId?: number };
  draft: string;
  onDraft: (next: string) => void;
  onSave: () => void;
  onUseGameName: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={roll.defaultLabel}
        aria-label={`Name for ${roll.defaultLabel}`}
        className="min-w-0 flex-1 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <Button compact onClick={onSave}>
        Save
      </Button>
      {/* Only a GAME folder can be handed back — an album you made has no other
          name to fall back to. */}
      {roll.custom && roll.albumId === undefined && (
        <Button variant="tertiary" compact onClick={onUseGameName}>
          Use game name
        </Button>
      )}
      {roll.albumId !== undefined && (
        <Button variant="tertiary" compact onClick={onDelete}>
          Delete
        </Button>
      )}
      <Button variant="secondary" compact onClick={onCancel}>
        Cancel
      </Button>
    </span>
  );
}

/**
 * The roster list with its search box — the same control the photo's own detail
 * editor uses, lifted out so batch tagging is the SAME interaction rather than
 * a second one that drifts. Number search (`#17`), position search and the
 * tagged-float-to-top ordering all come with it.
 */
function PlayerTagList({
  roster,
  selected,
  onToggle,
  maxHeightClass = 'max-h-48',
}: {
  roster: RosterPlayer[];
  selected: number[];
  onToggle: (playerId: number) => void;
  maxHeightClass?: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const raw = query.trim();
    const jerseyQuery = /^#?\d+$/.test(raw) ? raw.replace('#', '') : null;
    let matches: RosterPlayer[];
    if (jerseyQuery !== null) matches = roster.filter((p) => String(p.jerseyNumber).startsWith(jerseyQuery));
    else if (raw === '#') matches = roster;
    else if (raw) {
      const q = raw.toLowerCase();
      matches = roster.filter((p) => playerLabel(p).toLowerCase().includes(q) || p.position.toLowerCase() === q);
    } else matches = roster;
    return [...matches].sort((a, b) => {
      const at = selected.includes(a.id) ? 0 : 1;
      const bt = selected.includes(b.id) ? 0 : 1;
      if (at !== bt) return at - bt;
      if (jerseyQuery !== null) {
        const ae = String(a.jerseyNumber) === jerseyQuery ? 0 : 1;
        const be = String(b.jerseyNumber) === jerseyQuery ? 0 : 1;
        if (ae !== be) return ae - be;
        if (a.jerseyNumber !== b.jerseyNumber) return a.jerseyNumber - b.jerseyNumber;
      }
      return b.overallRating - a.overallRating;
    });
  }, [roster, query, selected]);

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, number or position..."
        aria-label="Search players to tag — by name, position, or jersey number"
        className="w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
      />
      <div className={`mt-1.5 ${maxHeightClass} overflow-y-auto border border-slate-200/80 dark:border-slate-800`}>
        {filtered.map((player) => {
          const tagged = selected.includes(player.id);
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onToggle(player.id)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition ${
                tagged
                  ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className={`tnum mr-1.5 ${tagged ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                  #{player.jerseyNumber}
                </span>
                {playerLabel(player)}
              </span>
              <span className={`shrink-0 text-xs ${tagged ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                {player.position} {player.overallRating}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-slate-400 dark:text-slate-500">No matching players.</p>
        )}
      </div>
    </>
  );
}

/** One labelled slider — the darkroom's only control shape, so the panel reads as one instrument. */
function LookSlider({
  label,
  value,
  onChange,
  suffix = '%',
  disabled = false,
  min = 0,
  max = 100,
  /** Where the value means "unchanged" — a tick under the track, for a slider whose neutral isn't its floor. */
  neutral,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  neutral?: number;
}) {
  return (
    <label className={`block ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex items-baseline justify-between">
        <span className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</span>
        <span className="tnum text-xs text-slate-500 dark:text-slate-400">
          {Math.round(value)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none bg-slate-200 accent-[var(--team-primary)] dark:bg-white/10"
      />
      {/* A slider whose neutral sits in the MIDDLE needs to show where that is,
          or "back to normal" becomes a guess. One hairline, no label. */}
      {neutral !== undefined && (
        <span aria-hidden className="relative block h-0">
          <span
            className="absolute top-0 h-1.5 w-px bg-slate-400/70 dark:bg-white/30"
            style={{ left: `${((neutral - min) / (max - min)) * 100}%` }}
          />
        </span>
      )}
    </label>
  );
}

/**
 * THE DARKROOM — a photo's colour treatment, its vignette, and which marks it
 * prints.
 *
 * Every control here is presentation, and none of it touches the file: the
 * treatment is a CSS filter chain over the same original pixels, so it applies
 * instantly at any size, comes off as cleanly as it went on, and a trading card
 * built from the same shot is unaffected. That is the same contract framing has
 * had since it shipped, extended to colour.
 *
 * PRESETS AS THUMBNAILS, not a dropdown of names. You pick a look by seeing it;
 * a list saying "Faded film" makes you audition each one blind. Each swatch is
 * the photo itself under that preset, which costs nothing — the browser is
 * already holding the image and the filter is a GPU pass.
 *
 * Live, not staged. Every change is applied to the plate behind the panel as it
 * happens and saved on release, because a photo editor whose changes appear
 * after a Save button isn't one.
 */
function LookPanel({
  item,
  look,
  onChange,
  hasTeamMark,
  hasOccasionMark,
}: {
  item: MediaItemWithPath;
  look: MediaLook;
  onChange: (next: MediaLook) => void;
  hasTeamMark: boolean;
  hasOccasionMark: boolean;
}) {
  const set = (patch: Partial<MediaLook>) => onChange({ ...look, ...patch });
  const src = fileUrl(item.absolutePath);

  return (
    <div className="space-y-4">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Treatment</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {FILTER_PRESETS.map((preset) => {
            const active = look.filter === preset.key;
            const swatch = resolveMediaLook({ filter: preset.key, intensity: 100 });
            const wash = washStyle(swatch);
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => set({ filter: preset.key, intensity: look.intensity === 0 ? 100 : look.intensity })}
                title={preset.hint}
                aria-pressed={active}
                className={`group relative overflow-hidden border text-left transition ${
                  active
                    ? 'border-[var(--team-primary)] ring-1 ring-[var(--team-primary)]'
                    : 'border-slate-200/80 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
                }`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-slate-950">
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="h-full w-full object-cover"
                    style={{ filter: filterCss(swatch) || undefined }}
                  />
                  {wash && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: wash.background,
                        mixBlendMode: wash.mixBlendMode as never,
                        opacity: wash.opacity,
                      }}
                    />
                  )}
                </span>
                <span className="block truncate px-1.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-400 dark:text-slate-500">
          {findPreset(look.filter).hint}
        </p>
      </div>

      <LookSlider
        label="Strength"
        value={look.intensity}
        onChange={(intensity) => set({ intensity })}
        disabled={look.filter === 'none'}
      />

      <div className="space-y-3 border-t border-slate-200/60 pt-3 dark:border-slate-800/60">
        <LookSlider label="Vignette" value={look.vignette} onChange={(vignette) => set({ vignette })} />
        <LookSlider
          label="Vignette softness"
          value={look.vignetteSoftness}
          onChange={(vignetteSoftness) => set({ vignetteSoftness })}
          disabled={look.vignette === 0}
        />
        <LookSlider label="Grain" value={look.grain} onChange={(grain) => set({ grain })} />
        {/* Neutral at 100 and headroom to 200: this is a correction as often as
            an effect, and a slider that could only ever drain colour would be
            half a control. */}
        <LookSlider
          label="Saturation"
          value={look.saturation}
          onChange={(saturation) => set({ saturation })}
          min={0}
          max={200}
          neutral={100}
        />
      </div>

      <div className="space-y-2 border-t border-slate-200/60 pt-3 dark:border-slate-800/60">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Marks on the plate</p>
        {/* Disabled rather than hidden when there's nothing to print, so the
            panel doesn't change shape from photo to photo — and the reason is
            in the label instead of being a mystery. */}
        <label className={`flex items-center gap-2 text-sm ${hasTeamMark ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
          <input
            type="checkbox"
            checked={look.showTeamMark && hasTeamMark}
            disabled={!hasTeamMark}
            onChange={(e) => set({ showTeamMark: e.target.checked })}
            className="h-4 w-4 accent-[var(--team-primary)]"
          />
          Team logo{!hasTeamMark && ' — none for this season'}
        </label>
        <label className={`flex items-center gap-2 text-sm ${hasOccasionMark ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
          <input
            type="checkbox"
            checked={look.showOccasionMark && hasOccasionMark}
            disabled={!hasOccasionMark}
            onChange={(e) => set({ showOccasionMark: e.target.checked })}
            className="h-4 w-4 accent-[var(--team-primary)]"
          />
          Game badge{!hasOccasionMark && ' — no badge for this game'}
        </label>
      </div>

      <Button variant="secondary" compact onClick={() => onChange(DEFAULT_MEDIA_LOOK)}>
        Reset the look
      </Button>
    </div>
  );
}

/**
 * Metadata editor shown inside the lightbox sidebar — pick the game, tag
 * players from that season's roster, write a description.
 */
function MediaDetailsForm({
  item,
  games,
  roster,
  albums,
  onCreateAlbum,
  onSave,
  onCancel,
}: {
  item: MediaItemWithPath;
  games: ScheduleGame[];
  roster: RosterPlayer[];
  albums: CustomAlbum[];
  /** Creates an album and hands back its id, so the photo can be filed into it immediately. */
  onCreateAlbum: (name: string) => Promise<number | null>;
  onSave: (patch: MediaItemPatch) => void;
  onCancel: () => void;
}) {
  const [gameId, setGameId] = useState<number | null>(item.gameId);
  const [albumId, setAlbumId] = useState<number | null>(item.albumId);
  /*
    Which side the switch opens on. An album wins when the photo has one,
    because that is where it actually lives; everything else — including a photo
    filed nowhere at all — opens on Game, which is how the overwhelming majority
    of these are filed.
  */
  const [filedUnder, setFiledUnder] = useState<'game' | 'album'>(item.albumId !== null ? 'album' : 'game');
  const [creatingHere, setCreatingHere] = useState(false);
  const [newAlbum, setNewAlbum] = useState('');
  const [description, setDescription] = useState(item.description);
  const [playerIds, setPlayerIds] = useState<number[]>(item.playerIds);

  async function addAlbum() {
    const name = newAlbum.trim();
    if (!name) return;
    const created = await onCreateAlbum(name);
    if (created === null) return;
    // Filed into it straight away — you named an album while looking at a
    // photograph, so that photograph is what it is for.
    setAlbumId(created);
    setNewAlbum('');
    setCreatingHere(false);
  }
  const inputClass =
    'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className="space-y-4">
      {/*
        WHERE THIS PHOTO IS FILED — a game, or one of your own albums. They are
        alternatives, not a pair (see schema_v22): a photograph lives in exactly
        one folder, so choosing GAME clears any album and choosing ALBUM clears
        the game. Anything else would put the same picture in two places on a
        shelf and count it twice.
      */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Filed under</p>
          <div className="inline-flex border border-slate-200/80 bg-slate-50/90 p-0.5 dark:border-slate-800 dark:bg-white/5">
            {(['game', 'album'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={filedUnder === mode}
                onClick={() => {
                  setFiledUnder(mode);
                  if (mode === 'game') setAlbumId(null);
                  else setGameId(null);
                }}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors duration-base ${
                  filedUnder === mode
                    ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {mode === 'game' ? 'Game' : 'Album'}
              </button>
            ))}
          </div>
        </div>

        {filedUnder === 'game' ? (
          <Select
            value={gameId === null ? '' : String(gameId)}
            onChange={(next) => setGameId(next === '' ? null : Number(next))}
            ariaLabel="Game this media is from"
            className="mt-1.5 w-full"
            options={[
              { value: '', label: 'Not from a specific game' },
              ...games.map((game) => ({ value: String(game.gameId), label: gameLabel(game) })),
            ]}
          />
        ) : (
          <>
            {/* CREATE NEW ALBUM IS ALWAYS THE LAST OPTION, and the only one when
                there are none yet — a dropdown whose sole entry is an action
                reads as "there is nothing here, make one", which is exactly the
                state it describes. */}
            <Select
              value={creatingHere ? NEW_ALBUM : albumId === null ? '' : String(albumId)}
              onChange={(next) => {
                if (next === NEW_ALBUM) {
                  setCreatingHere(true);
                  return;
                }
                setCreatingHere(false);
                setAlbumId(next === '' ? null : Number(next));
              }}
              ariaLabel="Album this media is filed in"
              className="mt-1.5 w-full"
              options={[
                ...(albums.length > 0 ? [{ value: '', label: 'Not in an album' }] : []),
                ...albums.map((album) => ({ value: String(album.id), label: album.name })),
                { value: NEW_ALBUM, label: 'Create new album…' },
              ]}
            />
            {creatingHere && (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newAlbum}
                  onChange={(e) => setNewAlbum(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addAlbum();
                    if (e.key === 'Escape') setCreatingHere(false);
                  }}
                  placeholder="Album name"
                  aria-label="New album name"
                  className={inputClass}
                />
                <Button compact onClick={() => void addAlbum()}>
                  Create
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Description</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What's happening in this shot?"
          aria-label="Media description"
          className={`${inputClass} mt-1.5 resize-none`}
        />
      </div>

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Players in this media {playerIds.length > 0 ? `(${playerIds.length})` : ''}
        </p>
        <div className="mt-1.5">
          <PlayerTagList
            roster={roster}
            selected={playerIds}
            onToggle={(playerId) =>
              setPlayerIds((prev) =>
                prev.includes(playerId) ? prev.filter((pid) => pid !== playerId) : [...prev, playerId],
              )
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() =>
            onSave({
              // The DAL enforces exclusivity too, but sending the pair already
              // resolved keeps the two ends agreeing about what was chosen.
              gameId: filedUnder === 'game' ? gameId : null,
              albumId: filedUnder === 'album' ? albumId : null,
              description: description.trim(),
              playerIds,
            })
          }
        >
          Save details
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Fullscreen lightbox — the media large, metadata + links beside it, prev/next navigation. */
function MediaLightbox({
  dynastyId,
  seasonId,
  items,
  index,
  games,
  roster,
  albums,
  onCreateAlbum,
  onNavigate,
  onClose,
  onSaved,
  onFramed,
  onLooked,
  onDeleted,
}: {
  dynastyId: string;
  seasonId: number | undefined;
  items: MediaItemWithPath[];
  index: number;
  games: ScheduleGame[];
  roster: RosterPlayer[];
  albums: CustomAlbum[];
  onCreateAlbum: (name: string) => Promise<number | null>;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onSaved: (item: MediaItemWithPath, patch: MediaItemPatch) => void;
  onFramed: (item: MediaItemWithPath, framing: MediaFraming | null) => void;
  onLooked: (item: MediaItemWithPath, look: MediaLook | null) => void;
  onDeleted: (item: MediaItemWithPath) => void;
}) {
  const { openPlayerModal } = usePlayerModal();
  const { openGameModal } = useGameModal();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editTab, setEditTab] = useState<'details' | 'look'>('details');
  // Set for the instant it takes to capture, so the hover chrome isn't in the
  // exported PNG — the mouse is necessarily over the button that started it.
  const [capturing, setCapturing] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [goldMark, setGoldMark] = useState(loadGoldMark);
  const plateRef = useRef<HTMLDivElement>(null);
  const { appearance } = useTheme();
  const item = items[index];

  /*
    The look is held locally and written through, so a slider drag repaints the
    plate on every tick without waiting on a round trip. `item.id` in the deps
    is what re-seeds it when Prev/Next swaps the photo underneath.
  */
  const [look, setLook] = useState<MediaLook>(() => resolveMediaLook(item?.look));
  useEffect(() => {
    setLook(resolveMediaLook(item?.look));
  }, [item?.id, item?.look]);

  const applyLook = useCallback(
    (next: MediaLook) => {
      setLook(next);
      if (!item) return;
      // An untreated look clears the column rather than storing a row full of
      // defaults — see schema_v16.
      void window.api.media.setLook(item.id, isUntreated(next) ? null : next);
      onLooked(item, isUntreated(next) ? null : next);
    },
    [item, onLooked],
  );

  useEffect(() => {
    try {
      localStorage.setItem(GOLD_MARK_KEY, String(goldMark));
    } catch {
      /* non-fatal: the mark simply reverts to gold next launch */
    }
  }, [goldMark]);

  const canGoPrevious = index > 0;
  const canGoNext = index < items.length - 1;

  // Reset edit mode when moving between items so a half-finished form never
  // silently carries over to a different photo.
  useEffect(() => {
    setEditing(false);
  }, [item?.id]);

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        onNavigate(index - 1);
      } else if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        onNavigate(index + 1);
      }
    }
    document.addEventListener('keydown', handleKeys);
    return () => document.removeEventListener('keydown', handleKeys);
  }, [index, canGoPrevious, canGoNext, onNavigate, onClose]);

  if (!item) return null;

  const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
  const taggedPlayers = item.playerIds
    .map((pid) => roster.find((p) => p.id === pid))
    .filter((p): p is RosterPlayer => !!p);

  /*
    THE PLATE — the photo with its caption under it, and nothing beside it.

    What this replaced was a photo sharing the panel with a 320px column of
    labelled boxes: DESCRIPTION, GAME, PLAYERS, each in its own bordered card.
    All of it was true and none of it was the photo. A gallery print doesn't
    put its label in a sidebar.

    So the caption goes UNDERNEATH, in the order the user asked for and the
    order a caption actually reads: who is in it, what happened, which game.
    Names and the game stay clickable — they're the same links as before, just
    written as words instead of drawn as buttons.

    Everything else — nav, close, edit, export, delete, the counter — is hover
    chrome over the photo, so at rest the viewer is the photograph and its
    caption. `focus-within` keeps it reachable without a mouse.

    EDIT is the exception, and deliberately: it brings back a working panel and
    turns zoom on, because framing a shot is the one time you need to see the
    controls. Viewing isn't editing (user's call).
  */
  // The program on the plate: the team this dynasty was coaching when the photo
  // was taken, which the linked game already carries. With no game linked, the
  // season's schedule is the same answer — every game in it is this team's.
  const plateTeamName = game?.teamName ?? games[0]?.teamName ?? null;
  const occasionSrc = game ? occasionMarkSrc(game, appearance) : null;
  // What CAN be printed, and what the photo says to print — both have to be true.
  const showTeamMark = look.showTeamMark && !!plateTeamName;
  const showOccasionMark = look.showOccasionMark && !!occasionSrc;

  // `!transition-none` is what makes the capture honest, and it is not
  // decoration: `!opacity-0` alone still ANIMATES to zero over --duration-base
  // (180ms), while exportPlate waits two animation frames (~32ms) before the
  // main process reads the window — so the arrows, the counter and the action
  // row were all photographed around 80% opaque and baked into the PNG. Turning
  // the transition off makes the drop instant, which is what the two-frame wait
  // below was always assuming.
  const chromeClass = `pointer-events-none absolute opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-within:opacity-100 ${
    capturing ? '!opacity-0 !transition-none' : ''
  }`;
  const chromeButtonClass =
    'pointer-events-auto flex h-9 w-9 items-center justify-center border border-white/15 bg-slate-950/70 text-slate-200 backdrop-blur-sm transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

  async function exportPlate() {
    const node = plateRef.current;
    if (!node) return;
    setExportNote(null);
    setCapturing(true);
    // Two frames: one for React to drop the chrome, one for the compositor to
    // have actually painted without it before the main process reads the window.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const rect = node.getBoundingClientRect();
      const base = [taggedPlayers.map(playerLabel).join(', '), item.description, game ? gameLabel(game) : '']
        .filter(Boolean)
        .join(' — ')
        .slice(0, 80);
      const result = await window.api.export.mediaPlateToPng(base || 'Dynasty photo', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      if (result.message && result.message !== 'Export canceled.') {
        setExportNote(result.message);
      }
    } finally {
      setCapturing(false);
    }
  }

  // Portal to <body>: the Media page lives inside the app shell's backdrop-blur
  // <main>, which creates a containing block that would trap a `fixed` overlay
  // and load it off-center (top/bottom) instead of centered in the viewport.
  return createPortal(
    <div
      className="modal-scrim modal-scrim-deep fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        className={`corner-cut flex max-h-full w-full flex-col overflow-hidden modal-panel ${
          editing ? 'max-w-6xl lg:flex-row' : 'max-w-5xl'
        }`}
      >
        {/* The plate: everything the export captures, and nothing that isn't
            part of the picture. */}
        <div ref={plateRef} className="flex min-h-0 flex-1 flex-col bg-slate-950">
          {/* group: the hover chrome hangs off this. overflow-hidden because a
              zoomed photo has to be clipped by something, and the stage is what
              it lives in. */}
          <div className="group relative flex min-h-[16rem] flex-1 items-center justify-center overflow-hidden lg:min-h-[30rem]">
            {item.mediaType === 'video' ? (
              <video
                key={item.id}
                src={fileUrl(item.absolutePath)}
                controls
                autoPlay={false}
                className="max-h-[74vh] max-w-full"
              />
            ) : editing ? (
              <ZoomableImage
                key={item.id}
                src={fileUrl(item.absolutePath)}
                alt={item.description || 'Dynasty media'}
                saved={item.framing}
                onSave={(framing) => onFramed(item, framing)}
                // The darkroom is open while this is on screen, so the treatment
                // has to be ON the photo you're treating.
                filter={filterCss(look)}
              />
            ) : (
              /* Viewing is not editing, so no zoom pill and no drag — just the
                 photo, wearing whatever framing and treatment were saved. */
              <img
                key={item.id}
                src={fileUrl(item.absolutePath)}
                alt={item.description || 'Dynasty media'}
                draggable={false}
                className="max-h-[74vh] w-full select-none object-contain"
                style={{ transform: framingTransform(item.framing), filter: filterCss(look) || undefined }}
              />
            )}

            {/*
              THE TREATMENT LAYERS, over the photo and under the chrome.

              They're separate elements rather than more filter primitives
              because none of them IS a filter: a wash is a blended colour, a
              vignette is a gradient, and grain is a texture. Each is
              pointer-events-none so the photo underneath still takes a drag
              while you're framing it.

              Grain is drawn as an inline SVG turbulence — a real noise field,
              generated by the browser at whatever size the frame happens to be,
              with no asset to ship and nothing to tile.
            */}
            {washStyle(look) && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: washStyle(look)?.background,
                  mixBlendMode: washStyle(look)?.mixBlendMode as never,
                  opacity: washStyle(look)?.opacity,
                }}
              />
            )}
            {vignetteCss(look) && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: vignetteCss(look) ?? undefined }}
              />
            )}
            {look.grain > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-overlay"
                style={{
                  /*
                    STRENGTHENED (user direction) — at the old settings you
                    genuinely could not tell it was on. Three things were
                    fighting it: the layer capped at 0.55 opacity, the noise
                    rect inside the SVG was itself only 0.6 opaque, so the
                    strongest possible grain was a third of one, and
                    `baseFrequency` 0.85 put the grain below one screen pixel
                    where it averaged out to flat grey. Now full opacity on both,
                    and a coarser 0.62 frequency so each grain is big enough to
                    survive being drawn.
                  */
                  opacity: look.grain / 100,
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
              />
            )}

            {/* Top-right: the actions, in the order they escalate. */}
            <div className={`${chromeClass} right-3 top-3 flex items-center gap-1.5`}>
              {plateTeamName && (
                <button
                  type="button"
                  onClick={() => setGoldMark((prev) => !prev)}
                  aria-pressed={goldMark}
                  aria-label={goldMark ? 'Use the standard team mark' : 'Use the gold team mark'}
                  title={goldMark ? 'Team mark: gold' : 'Team mark: standard'}
                  className={chromeButtonClass}
                >
                  {/* The control shows the mark itself rather than an icon of
                      one — you're picking a look, so the button is a preview of
                      it. */}
                  <TeamLogo
                    team={{ assetName: plateTeamName, label: plateTeamName }}
                    size="sm"
                    variant={goldMark ? 'gold' : undefined}
                    className="!h-5 !w-5"
                  />
                </button>
              )}
              <button
                type="button"
                onClick={exportPlate}
                aria-label="Export this photo with its caption"
                title="Export photo"
                className={chromeButtonClass}
              >
                <ExportIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                aria-label={editing ? 'Stop editing details' : 'Edit details and framing'}
                title={editing ? 'Done editing' : 'Edit details & framing'}
                className={chromeButtonClass}
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await confirm(DELETE_MEDIA_CONFIRM)) onDeleted(item);
                }}
                aria-label="Delete this media"
                title="Delete"
                className={`${chromeButtonClass} text-red-300 hover:text-red-200`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close media viewer"
                title="Close (Esc)"
                className={chromeButtonClass}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className={`${chromeClass} left-3 top-1/2 -translate-y-1/2`}>
              <button
                type="button"
                onClick={() => canGoPrevious && onNavigate(index - 1)}
                disabled={!canGoPrevious}
                aria-label="Previous media"
                title="Previous (←)"
                className={chromeButtonClass}
              >
                ←
              </button>
            </div>
            <div className={`${chromeClass} right-3 top-1/2 -translate-y-1/2`}>
              <button
                type="button"
                onClick={() => canGoNext && onNavigate(index + 1)}
                disabled={!canGoNext}
                aria-label="Next media"
                title="Next (→)"
                className={chromeButtonClass}
              >
                →
              </button>
            </div>

            {items.length > 1 && (
              <span className={`${chromeClass} tnum bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300`}>
                {index + 1} / {items.length}
              </span>
            )}
          </div>

          {/*
            THE CAPTION. Players, then description, then the game — the user's
            order, and the order a caption reads: who, what, where.

            Centred and generously spaced because this is the label under a
            print, not a form. Anything absent is simply not printed; an empty
            caption leaves the photo alone rather than reserving space to say
            "No description yet."
          */}
          {/*
            THE TWO MARKS, in the bottom corners, flanking the caption (user
            request). Left is the program, right is the occasion — the same
            reading order as a ticket stub: who, then what for.

            They're positioned absolutely against the caption row rather than
            placed in it, so a long caption wraps through the middle without
            ever pushing a mark off its corner. The caption keeps clear of them
            with its own horizontal padding.

            The occasion mark resolves exactly as it does on the box score, so
            it's the bowl's logo, the playoff round, the conference
            championship mark, the rivalry shield or the plain conference logo,
            in that order of occasion — and simply absent for a plain
            non-conference game, which has no emblem worth inventing.
          */}
          {(taggedPlayers.length > 0 || item.description || game || showTeamMark) && (
            <div className="relative shrink-0 px-28 py-6 text-center">
              {/* 84px, up from 56 — the marks were reading as footnotes at the
                  bottom of a large plate rather than as part of it. The caption's
                  horizontal padding grew with them so a long line still can't
                  reach either corner. */}
              {showTeamMark && plateTeamName && (
                <TeamLogo
                  team={{ assetName: plateTeamName, label: plateTeamName }}
                  size="lg"
                  variant={goldMark ? 'gold' : undefined}
                  className="!absolute bottom-5 left-6 !h-[5.25rem] !w-[5.25rem] opacity-90"
                />
              )}
              {showOccasionMark && occasionSrc && (
                <img
                  src={occasionSrc}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="absolute bottom-5 right-6 h-[5.25rem] w-[5.25rem] object-contain opacity-90"
                />
              )}
              {taggedPlayers.length > 0 && (
                <p className="text-[15px] font-semibold leading-7 text-white">
                  {taggedPlayers.map((player, i) => (
                    <span key={player.id}>
                      {i > 0 && <span className="text-slate-500">, </span>}
                      <button
                        type="button"
                        onClick={() => openPlayerModal(dynastyId, player.id, seasonId)}
                        className="transition hover:text-[var(--team-secondary)]"
                      >
                        <span className="tnum text-slate-400">#{player.jerseyNumber}</span> {playerLabel(player)}
                      </button>
                    </span>
                  ))}
                </p>
              )}
              {item.description && (
                <p className="mt-1 text-[15px] leading-7 text-slate-200">{item.description}</p>
              )}
              {game && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openGameModal(dynastyId, game.gameId, seasonId);
                  }}
                  className="mt-1 text-[15px] leading-7 text-slate-300 transition hover:text-[var(--team-secondary)]"
                >
                  {gameSentence(game)}
                </button>
              )}
            </div>
          )}
        </div>

        {/* The working panel — only while editing, which is also the only time
            the zoom control is on the photo. */}
        {editing && (
          <div className="flex w-full shrink-0 flex-col border-t border-slate-200/80 dark:border-white/10 lg:w-80 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Edit {item.mediaType === 'video' ? 'video' : 'photo'}
              </p>
              <ModalCloseButton label="media viewer" onClick={onClose} />
            </div>
            {/* Two tabs, because tagging and treating are different jobs done
                at different times — and stacking both in one scrolling column
                buried the darkroom under a roster list. */}
            <div className="flex items-center gap-1 border-b border-slate-200/80 px-4 pt-3 dark:border-white/10">
              {(['details', 'look'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  aria-pressed={editTab === tab}
                  className={`border-b-2 px-3 pb-2 text-sm font-semibold transition ${
                    editTab === tab
                      ? 'border-[var(--team-primary)] text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'details' ? 'Details' : 'Darkroom'}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {editTab === 'details' ? (
                <MediaDetailsForm
                  item={item}
                  games={games}
                  roster={roster}
                  albums={albums}
                  onCreateAlbum={onCreateAlbum}
                  onSave={(patch) => {
                    onSaved(item, patch);
                    setEditing(false);
                  }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <LookPanel
                  item={item}
                  look={look}
                  onChange={applyLook}
                  hasTeamMark={!!plateTeamName}
                  hasOccasionMark={!!occasionSrc}
                />
              )}
            </div>
          </div>
        )}

        {exportNote && (
          <p className="shrink-0 bg-slate-950 px-8 pb-4 text-center text-xs text-slate-400">{exportNote}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Media() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [items, setItems] = useState<MediaItemWithPath[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /** Which game's roll is open. Empty = all closed, which is where the page starts. */
  const [openRolls, setOpenRolls] = useState<Set<string>>(() => new Set());
  /*
    Which end of the season the shelf starts at.

    OLDEST FIRST IS THE DEFAULT because that is the order the season was played,
    and a library of a whole year reads as a story from week 0. Newest first is
    what you want mid-season, when the roll you're looking for is the one from
    Saturday and it would otherwise be at the bottom of twelve others.

    Held in state rather than persisted: it is a way of looking at THIS page
    right now, not a standing preference about the dynasty, and a sort direction
    silently remembered from a session weeks ago is a worse surprise than
    re-picking it.
  */
  /*
    LATER WEEKS FIRST, ALWAYS (user direction) — week 10, 9, 8, and so on. The
    OLDEST ⇄ NEWEST switch it replaces was a control for a question that has one
    good answer: the folder you want is nearly always the one from the game you
    just played, and putting week 0 at the top buried it under a season. Kept as
    a constant rather than deleted so the ordering below still reads as a
    decision rather than an accident of the comparator.
  */
  const ROLL_SORT_NEWEST_FIRST = true;
  /*
    HOW THE LIBRARY IS ARRANGED (user direction).

    LIST is the folder shelf this page has had — a collapsed row per game, which
    is what stops a season of several hundred screenshots burying the rest of
    the page. GRID drops the folders entirely and lays every photo out at once,
    for when you are looking for one picture and don't care which Saturday it
    came from.

    They are two arrangements of the SAME tiles (see MediaTile), so selection,
    drag-to-reorder, the bin and the lightbox behave identically in both.
    Session state, like the sort direction: it is how you want to look right
    now, not a standing preference.
  */
  const [view, setView] = useState<MediaView>(loadMediaView);
  /** Folder names and covers the user has chosen this season, by game id (null = the unfiled pile). */
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  /** Albums the user made — their own folders, filled by hand. */
  const [customAlbums, setCustomAlbums] = useState<CustomAlbum[]>([]);
  /** Which folder is being renamed, keyed the way the rolls are. */
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  /*
    WHICH ALBUM IS OPEN IN GRID VIEW (user direction) — opening one must not
    throw you into the list. The shelf steps aside and the album's own
    photographs take the grid; closing brings the shelf back, still in grid.
    Null is the shelf.
  */
  const [gridOpenKey, setGridOpenKey] = useState<string | null>(null);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchGameId, setBatchGameId] = useState('');
  /** Players to ADD to every selected photo. Empty = leave tags alone. */
  const [batchPlayerIds, setBatchPlayerIds] = useState<number[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  /** The media id under the cursor mid-drag — drives the lift, and nothing else. */
  const [dragId, setDragId] = useState<number | null>(null);
  /*
    FLIP, and it is what makes reordering feel like moving photographs rather
    than editing a list.

    The DOM is reordered the moment you drag ACROSS a tile, not on drop — so the
    grid shows you the arrangement you are about to get. But a browser
    re-flowing a grid is instantaneous and therefore invisible: tiles teleport,
    which reads as a glitch. FLIP fixes that by measuring every tile First,
    letting React reorder (Last), Inverting each one back to where it just was
    with a transform, and Playing that transform away. The result is that every
    tile slides to its new place while the one under your cursor stays put.

    Element refs rather than state, because this runs in a layout effect and
    must not itself cause a render.
  */
  const tileEls = useRef(new Map<number, HTMLDivElement>());
  const lastRects = useRef<Map<number, DOMRect> | null>(null);

  const registerTile = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) tileEls.current.set(id, el);
      else tileEls.current.delete(id);
    },
    [],
  );

  /** Freeze where every tile is, just before the order changes. */
  const captureTileRects = useCallback(() => {
    const rects = new Map<number, DOMRect>();
    tileEls.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    lastRects.current = rects;
  }, []);

  useLayoutEffect(() => {
    const before = lastRects.current;
    lastRects.current = null;
    if (!before) return;
    tileEls.current.forEach((el, id) => {
      const from = before.get(id);
      if (!from) return;
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      // Sub-pixel drift isn't movement; animating it just costs a frame.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });
  }, [items]);

  const seasonYear = seasons.find((s) => s.id === seasonId)?.seasonYear;
  /** Apply stays inert until the panel actually says to change something. */
  const canApplyBatch = selectedIds.size > 0 && (batchGameId !== '' || batchPlayerIds.length > 0);
  const importing = importProgress !== null;

  useEffect(() => {
    if (!id || seasonId === undefined) {
      setAlbums([]);
      return;
    }
    let cancelled = false;
    void window.api.media.listAlbums(id, seasonId).then((rows) => {
      if (!cancelled) setAlbums(rows);
    });
    void window.api.media.listCustomAlbums(id, seasonId).then((rows) => {
      if (!cancelled) setCustomAlbums(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  async function renameAlbum(gameId: number | null, name: string) {
    if (!id || seasonId === undefined) return;
    setAlbums(await window.api.media.renameAlbum(id, seasonId, gameId, name));
    setRenamingKey(null);
  }

  /** Renames a game folder or a user-made album, whichever this roll is. */
  async function renameRoll(roll: { game?: ScheduleGame; albumId?: number }, name: string) {
    if (!id || seasonId === undefined) return;
    if (roll.albumId !== undefined) {
      setCustomAlbums(await window.api.media.renameCustomAlbum(id, seasonId, roll.albumId, name));
      setRenamingKey(null);
      return;
    }
    await renameAlbum(roll.game?.gameId ?? null, name);
  }

  /**
   * Removes an album and RELEASES its photographs — they go back to the
   * unfiled pile rather than being deleted with it. Deleting a container must
   * never delete files the user imported.
   */
  async function deleteAlbum(albumId: number, name: string) {
    if (!id || seasonId === undefined) return;
    const ok = await confirm({
      eyebrow: 'Delete album',
      title: `Delete "${name}"?`,
      message: 'The album goes; its photos stay and return to "Not from a game".',
      confirmLabel: 'Delete album',
      tone: 'danger',
    });
    if (!ok) return;
    setCustomAlbums(await window.api.media.removeCustomAlbum(id, seasonId, albumId));
    setRenamingKey(null);
    refresh();
  }

  /**
   * Creates an album and returns its id, for the editor's "Create new album…"
   * — which needs to file the photo into it immediately, not just refresh a
   * list. The id is found by NAME against the returned rows rather than by
   * asking the DAL for a last-insert id: the list comes back sorted and
   * complete either way, and this avoids a second round trip.
   */
  async function createAlbumNamed(name: string): Promise<number | null> {
    if (!id || seasonId === undefined) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const before = new Set(customAlbums.map((a) => a.id));
    const rows = await window.api.media.createCustomAlbum(id, seasonId, trimmed);
    setCustomAlbums(rows);
    // The one that wasn't there before. Falls back to a name match, which
    // matters only if two albums share a name — in which case either is right.
    return rows.find((a) => !before.has(a.id))?.id ?? rows.find((a) => a.name === trimmed)?.id ?? null;
  }

  /** Opens the rename editor on a roll, seeded with whatever it is called now. */
  function startRename(roll: { key: string; label: string; custom: string | null; albumId?: number }) {
    setRenamingKey(roll.key);
    setRenameDraft(roll.albumId !== undefined ? roll.label : roll.custom ?? '');
  }

  async function createAlbum() {
    if (!id || seasonId === undefined) return;
    const name = newAlbumName.trim();
    if (!name) return;
    setCustomAlbums(await window.api.media.createCustomAlbum(id, seasonId, name));
    setNewAlbumName('');
    setCreatingAlbum(false);
    /*
      SHOW THE THING THAT WAS JUST MADE. The album was being created correctly
      and then landing somewhere the user could not see: "All photos" has no
      folders at all, and an album opened in grid hides the shelf the new one
      would appear on. Either way the button looked broken. Creating an album
      is a statement that you want to see albums, so this goes to the shelf.
    */
    setGridOpenKey(null);
    if (view === 'all') {
      setView('grid');
      saveMediaView('grid');
    }
  }

  const refresh = useCallback(() => {
    if (!id) return;
    window.api.media.list(id, seasonId).then((result) => setItems(result ?? null));
  }, [id, seasonId]);

  useEffect(() => {
    if (!id) return;
    setItems(undefined);
    setLightboxIndex(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    refresh();
    window.api.db.getSchedule(id, seasonId).then((result) => setSchedule(result ?? null));
    window.api.db.getRoster(id, seasonId).then((result) => setRoster(result ?? []));
  }, [id, seasonId, refresh]);

  // File-by-file import so a real progress bar is possible (file copies are fast;
  // the extra IPC round-trips for a batch of screenshots are negligible). Shared
  // by the picker button and the drag-and-drop drop zone.
  const importFiles = useCallback(
    async (paths: string[]) => {
      if (!id || seasonId === undefined || importing || paths.length === 0) return;
      setImportProgress({ done: 0, total: paths.length });
      try {
        for (let i = 0; i < paths.length; i++) {
          await window.api.media.addFiles(id, seasonId, [paths[i]]);
          setImportProgress({ done: i + 1, total: paths.length });
        }
        refresh();
      } finally {
        setImportProgress(null);
      }
    },
    [id, seasonId, importing, refresh],
  );

  async function handleUpload() {
    const picked = await window.api.media.pickFiles();
    if (picked) importFiles(picked);
  }

  // --- Drag-and-drop upload (drop OS files anywhere on the grid) ---
  function onGridDragOver(event: ReactDragEvent) {
    if (!importing && event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      setDragOverUpload(true);
    }
  }
  function onGridDrop(event: ReactDragEvent) {
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return; // an internal reorder drop — handled on the tile
    event.preventDefault();
    setDragOverUpload(false);
    /*
      EVERY FILE IN THE DROP, which is what makes this a batch import — a drop
      of forty screenshots is one gesture and forty rows.

      Paths come from the preload's `pathForFile`, not from `File.path`: the
      latter is an Electron extension that is deprecated now and gone in
      Electron 32, so the version that "works" would quietly start importing
      nothing. The fallback is there only for the case where the bridge is
      missing entirely.
    */
    const paths = files
      .map((f) => window.api.media.pathForFile?.(f) ?? (f as File & { path?: string }).path ?? '')
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (paths.length) importFiles(paths);
  }

  /*
    LIVE REORDER (user direction: "fluid and fun").

    The list used to change only on DROP, which meant dragging was a guess and
    the result arrived as a snap. Now crossing a tile moves the photograph
    there and then — the grid flows around your cursor, FLIP animates every
    displaced tile into place, and the drop is just where you stop.

    Nothing is written to the database until the drag ENDS: a drag across a
    dozen tiles would otherwise be a dozen writes of an order the user was
    still in the middle of choosing.
  */
  function onTileDragOverReorder(index: number) {
    const from = dragIndexRef.current;
    if (from === null || from === index || !items) return;
    captureTileRects();
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    dragIndexRef.current = index;
    setItems(next);
  }

  async function commitOrder() {
    const dragging = dragIndexRef.current !== null;
    dragIndexRef.current = null;
    setDragId(null);
    if (!dragging || !items || !id || seasonId === undefined) return;
    await window.api.media.reorder(id, seasonId, items.map((m) => m.id));
  }

  // The drop itself has nothing left to do — the order is already what you see.
  // It only has to stay out of the way of a FILE drop, which the page handles.
  function onTileDrop(event: ReactDragEvent) {
    if (Array.from(event.dataTransfer.files ?? []).length > 0) return;
    event.preventDefault();
    event.stopPropagation();
    void commitOrder();
  }

  // --- Batch selection ---
  function toggleSelect(mediaId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchGameId('');
    setBatchPlayerIds([]);
  }

  /**
   * Applies the batch panel to every selected photo.
   *
   * PLAYERS ARE ADDED, NOT REPLACED, and that asymmetry with the game is
   * deliberate. A photo is from exactly ONE game, so setting the game is a
   * choice between values and the last one wins. It can have any number of
   * players in it, and the reason you reach for batch tagging is "these forty
   * shots all have the quarterback in them" — replacing would wipe the tags you
   * already put on individual photos, which is the opposite of the intent.
   * Untagging stays a per-photo job, where you can see who you are removing.
   *
   * A blank game selection leaves the game ALONE rather than clearing it: the
   * dropdown starts empty, and "I only came here to tag players" must not
   * silently unfile every photo in the selection. Clearing is its own explicit
   * option in the list.
   */
  async function applyBatch() {
    if (!items || selectedIds.size === 0) return;
    const changeGame = batchGameId !== '';
    if (!changeGame && batchPlayerIds.length === 0) return;
    const gid = batchGameId === CLEAR_GAME ? null : Number(batchGameId);
    for (const m of items.filter((it) => selectedIds.has(it.id))) {
      await window.api.media.update(m.id, {
        gameId: changeGame ? gid : m.gameId,
        description: m.description,
        playerIds: [...new Set([...m.playerIds, ...batchPlayerIds])],
      });
    }
    refresh();
    exitSelectMode();
  }
  /** One photo, from a tile's bin — confirms, then removes it. */
  async function confirmDelete(item: MediaItemWithPath) {
    if (await confirm(DELETE_MEDIA_CONFIRM)) handleDeleted(item);
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      ...DELETE_MEDIA_CONFIRM,
      title: `Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`,
      message: 'These files are removed from this dynasty’s library and cannot be undone.',
    });
    if (!ok) return;
    for (const mediaId of selectedIds) await window.api.media.remove(mediaId);
    refresh();
    exitSelectMode();
  }

  function handleSaved(item: MediaItemWithPath, patch: MediaItemPatch) {
    window.api.media.update(item.id, patch).then(refresh);
    // Optimistic local update so the lightbox reflects the save instantly.
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, ...patch } : m)) ?? prev);
  }

  /**
   * Framing is saved on its own, not through `handleSaved`: it comes from
   * dragging the photo rather than from submitting the details form, and it
   * changes nothing else about the item. Local state updates optimistically so
   * the tile behind the viewer re-crops the moment you save.
   */
  function handleFramed(item: MediaItemWithPath, framing: MediaFraming | null) {
    void window.api.media.setFraming(item.id, framing);
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, framing } : m)) ?? prev);
  }

  // The viewer already wrote it through; this keeps the grid's own copy in step
  // so a treated photo reads the same on its tile the moment the viewer closes.
  function handleLooked(item: MediaItemWithPath, look: MediaLook | null) {
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, look } : m)) ?? prev);
  }

  function handleDeleted(item: MediaItemWithPath) {
    window.api.media.remove(item.id).then(refresh);
    setLightboxIndex(null);
  }

  if (!id) return null;

  const games = schedule?.games ?? [];
  const hasItems = !!items && items.length > 0;

  /*
    ROLLS, NOT A WALL.

    A season's worth of screenshots is hundreds of photos, and a flat grid of
    them buries the rest of the page — the user's words: "we don't need to
    clutter up media with massive amounts of photos on screen." So the grid is
    grouped by the game the photos came from and every group starts CLOSED,
    the way a shelf of rolls reads before you pull one down.

    A closed roll still shows what's in it: up to five overlapping thumbnails,
    the game it belongs to, and a count. That's the difference between
    collapsing and hiding.

    GROUPS RUN IN SCHEDULE ORDER; ITEMS INSIDE A GROUP KEEP THEIR OWN.

    Those are two different orderings and only one of them is the user's. The
    groups used to fall out in the order their first photo happened to be
    tagged, so someone who tagged their week 10 shots before their week 1 shots
    got a season that opened at week 10 — the shelf was in the order they
    reached for the rolls, not the order the games were played. Weeks are a
    sequence the season already fixed, so the app sorts them rather than
    preserving an accident.

    Within a roll the order stays exactly as it was, because THAT order is
    drag-reorderable and re-sorting it would silently undo the only arrangement
    the user actually made by hand. Each group still carries its items' real
    indices in the flat list, so drag, drop and the lightbox's Prev/Next keep
    working across the whole season.

    Photos from no game sort LAST IN BOTH DIRECTIONS: they belong to no week, so
    they are not part of the sequence being reversed, and floating the
    unplaceable pile to the top of a newest-first list would be the one thing
    neither order is asking for.
  */
  const UNFILED = 'unfiled';
  const rolls: {
    key: string;
    label: string;
    /** What the game itself is called — shown as a subtitle once renamed. */
    defaultLabel: string;
    /** The user's name, or null when the folder still uses the game's. */
    custom: string | null;
    /** Set when this roll is a user-made album rather than a game folder. */
    albumId?: number;
    /** The photo the folder shows, if one was chosen. */
    coverMediaId: number | null;
    game?: ScheduleGame;
    entries: { item: MediaItemWithPath; index: number }[];
  }[] = [];
  const rollByKey = new Map<string, (typeof rolls)[number]>();
  /*
    EVERY USER-MADE ALBUM GETS A ROLL UP FRONT, before any photo is placed —
    otherwise an album you just created would not exist on the shelf until you
    filed something into it, which is exactly backwards: you make the album so
    you have somewhere to put things.
  */
  for (const album of customAlbums) {
    const roll = {
      key: `album:${album.id}`,
      label: album.name,
      defaultLabel: album.name,
      custom: null,
      albumId: album.id,
      coverMediaId: album.coverMediaId,
      entries: [] as { item: MediaItemWithPath; index: number }[],
    };
    rollByKey.set(roll.key, roll);
    rolls.push(roll);
  }

  (items ?? []).forEach((item, index) => {
    const key =
      item.albumId !== null && rollByKey.has(`album:${item.albumId}`)
        ? `album:${item.albumId}`
        : item.gameId === null
          ? UNFILED
          : String(item.gameId);
    let roll = rollByKey.get(key);
    if (!roll) {
      const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
      /*
        THE USER'S NAME WINS, and the game's own label becomes the placeholder
        rather than disappearing — a folder called "Senior Day" still has to be
        findable as the Purdue game, so the game line stays underneath it.
      */
      const defaultLabel = game ? gameLabel(game) : 'Not from a game';
      const saved = albums.find((a) => a.gameId === item.gameId);
      const custom = saved?.name ? saved.name : null;
      roll = {
        key,
        label: custom ?? defaultLabel,
        defaultLabel,
        custom,
        coverMediaId: saved?.coverMediaId ?? null,
        game,
        entries: [],
      };
      rollByKey.set(key, roll);
      rolls.push(roll);
    }
    roll.entries.push({ item, index });
  });
  /*
    Week first, then the kickoff date, so two games in the same week still land
    in the order they were played. A game the schedule no longer knows about
    (deleted, or a season the roll outlived) has no week to sort by and joins
    the unfiled pile at the end rather than sorting as week 0 and jumping to the
    front.
  */
  const rollOrder = (roll: (typeof rolls)[number]): [number, string] =>
    roll.game ? [roll.game.week, roll.game.date ?? ''] : [Number.MAX_SAFE_INTEGER, ''];
  rolls.sort((a, b) => {
    /*
      THREE BANDS, in this order: the albums you made, then the season's games
      newest first, then the unfiled pile.

      Your own albums lead because you made them on purpose and the app did not
      — a folder someone built by hand should not be sorted in among forty
      derived ones. The unfiled pile is last in every arrangement: it belongs to
      no week, so it is not part of the sequence being ordered at all.
    */
    const band = (r: (typeof rolls)[number]) => (r.albumId !== undefined ? 0 : r.key === UNFILED ? 2 : 1);
    if (band(a) !== band(b)) return band(a) - band(b);
    if (a.albumId !== undefined) return a.label.localeCompare(b.label);
    if (a.key === UNFILED) return 0;
    const [aw, ad] = rollOrder(a);
    const [bw, bd] = rollOrder(b);
    const byWeek = aw - bw || ad.localeCompare(bd);
    return ROLL_SORT_NEWEST_FIRST ? -byWeek : byWeek;
  });

  return (
    /*
      THE WHOLE PAGE IS THE DROP TARGET (user direction — dropping files had
      stopped working in practice). It used to be only the photo grid, which was
      fine when the grid WAS the page; once photos moved into collapsed game
      folders the grid became a short stack of thin rows, and everything around
      it — the header, the space beside the folders, the empty area below them —
      silently rejected a drop. Nothing was broken, there was just almost
      nothing left to aim at.

      A full-panel overlay says so while you are dragging, rather than the
      one-pixel outline that was there before and that nobody reported seeing.
    */
    <div
      className="relative space-y-6"
      onDragOver={onGridDragOver}
      onDragLeave={(e) => {
        // Only when the pointer leaves the PANEL, not on every child boundary
        // it crosses on the way in — otherwise the overlay strobes.
        if (e.currentTarget === e.target) setDragOverUpload(false);
      }}
      onDrop={onGridDrop}
    >
      {dragOverUpload && !importing && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-[var(--team-primary)] bg-slate-950/70">
          <p className="type-eyebrow text-white">Drop to add to {seasonYear ?? 'this season'}</p>
        </div>
      )}
      {/*
        No headline (user's call). "The season, in pictures." was a title for a
        page whose content IS pictures — it said nothing the grid underneath
        doesn't say better, and it cost the first fifth of the screen on a page
        about filling the screen with photographs. The eyebrow keeps the page
        named, the hint keeps the instructions, and the actions move up into the
        space the title was using.
      */}
      {/*
        ONE ROW: the order switch hard left, the actions hard right (user
        direction). The switch used to sit on its own line above the shelf with
        an "Order" label in front of it; on the same row as the buttons it costs
        no vertical space at all, and OLDEST / NEWEST either side of the knob
        say what the label was saying.

        It is the app's own mode switch with the gold team mark as the knob —
        the same device the Coach Staff page uses for Current ⇄ Tree — rather
        than a segmented control, because this is a MODE (which way the season
        runs) and not a filter.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          THE "MEDIA" EYEBROW IS GONE FROM THIS ROW. With the switch on the left
          it landed immediately after the word NEWEST and the two read as one
          phrase — "NEWEST MEDIA" — which is a sentence the page doesn't mean.
          It was saying nothing new either: the nav tab above says Media and the
          button opposite now says + Media. The hint it carried is what mattered,
          so that moves across to the actions, where it still reaches everything
          it explained.
        */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {/* ICONS, NOT WORDS (user direction). Two arrangements of the same
              shelf need to be recognised, not read, and the shapes say it
              faster than the labels did. `title`/`aria-label` carry the names
              now that nothing else does. */}
          {hasItems && (
            <div className="inline-flex shrink-0 border border-slate-200/80 bg-slate-50/90 p-1 dark:border-slate-800 dark:bg-white/5">
              {(['list', 'grid', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={view === mode}
                  title={VIEW_LABELS[mode]}
                  aria-label={VIEW_LABELS[mode]}
                  onClick={() => {
                    setView(mode);
                    saveMediaView(mode);
                  }}
                  className={`px-2.5 py-1.5 transition-colors duration-base ${
                    view === mode
                      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {mode === 'list' ? <ListViewIcon /> : mode === 'grid' ? <GridViewIcon /> : <AllPhotosIcon />}
                </button>
              ))}
            </div>
          )}
          {/* Albums the user makes are the one thing on this page that has to be
              created before it can be filled, so the plus lives with the views
              rather than in the editor where you would only find it by accident. */}
          <button
            type="button"
            onClick={() => setCreatingAlbum(true)}
            title="New album"
            aria-label="New album"
            disabled={seasonId === undefined}
            className="shrink-0 border border-slate-200/80 bg-slate-50/90 p-1.5 text-slate-500 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-40 dark:border-slate-800 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white"
          >
            <PlusIcon />
          </button>
          {creatingAlbum && (
            <span className="flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createAlbum();
                  if (e.key === 'Escape') setCreatingAlbum(false);
                }}
                placeholder="Album name"
                aria-label="New album name"
                className="w-40 border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <Button compact onClick={() => void createAlbum()}>
                Create
              </Button>
              <Button variant="secondary" compact onClick={() => setCreatingAlbum(false)}>
                Cancel
              </Button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          <InfoHint label="About the media library">
            {`Game-day screenshots and clips for ${seasonYear !== undefined ? `the ${seasonYear} season` : 'this season'} — tag the game and the players, and everything links back to their pages. Photos group by game and open on click. Drag to reorder, drop files in to add, and use Select to tag or delete several at once. The switch on the left runs the game folders from the start of the season or from the most recent game.`}
          </InfoHint>
          {/* SELECT, not "Favorites" (user direction, reversing the earlier
              rename). The button opens multi-select — batch tagging and batch
              delete — and calling it Favorites hid that: nobody looks for
              "select several photos" under a word that means starred. */}
          {hasItems && (
            <Button variant="secondary" onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
          <Button onClick={handleUpload} disabled={importing || seasonId === undefined}>
            {importing ? 'Importing…' : '+ Media'}
          </Button>
        </div>
      </div>

      {/* Import progress bar */}
      {importProgress && (
        <SurfaceCard className="py-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Importing photos…</span>
            <span className="tnum">
              {importProgress.done} / {importProgress.total}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full bg-[var(--team-primary)] transition-all duration-base"
              style={{ width: `${importProgress.total ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%` }}
            />
          </div>
        </SurfaceCard>
      )}

      {/*
        THE BATCH PANEL. Everything you can do to a selection lives here, and it
        only exists while a selection is being made — the page is a gallery the
        rest of the time.
      */}
      {selectMode && (
        <SurfaceCard className="space-y-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set((items ?? []).map((m) => m.id)))}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              Select all
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
              >
                Clear
              </button>
            )}

            {/* THE BIN IS AN ICON AND IT SITS AT THE END (user direction) —
                away from Apply, because the two are one slip apart and only one
                of them can be undone. It still confirms first. */}
            <div className="ml-auto flex items-center gap-2">
              <Button onClick={() => void applyBatch()} disabled={!canApplyBatch}>
                Apply to {selectedIds.size}
              </Button>
              <button
                type="button"
                onClick={() => void batchDelete()}
                disabled={selectedIds.size === 0}
                aria-label={`Delete ${selectedIds.size} selected`}
                title={selectedIds.size === 0 ? 'Select photos to delete' : `Delete ${selectedIds.size} selected`}
                className="border border-slate-300/80 bg-white/85 p-2 text-red-600 transition hover:border-red-400/70 hover:bg-red-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                <TrashIcon />
              </button>
              <Button variant="secondary" onClick={exitSelectMode}>
                Done
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-200/60 pt-3 md:grid-cols-2 dark:border-slate-800/60">
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Set game</p>
              <Select
                value={batchGameId}
                onChange={setBatchGameId}
                disabled={selectedIds.size === 0}
                ariaLabel="Game to assign to the selected media"
                className="mt-1.5 w-full"
                options={[
                  { value: '', label: 'Leave the game as it is' },
                  { value: CLEAR_GAME, label: 'Not from a specific game' },
                  ...games.map((game) => ({ value: String(game.gameId), label: gameLabel(game) })),
                ]}
              />
            </div>
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Tag players {batchPlayerIds.length > 0 ? `(${batchPlayerIds.length})` : ''}
              </p>
              <div className="mt-1.5">
                <PlayerTagList
                  roster={roster}
                  selected={batchPlayerIds}
                  maxHeightClass="max-h-40"
                  onToggle={(playerId) =>
                    setBatchPlayerIds((prev) =>
                      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId],
                    )
                  }
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Added to every selected photo — tags already on a photo are kept.
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {items === undefined && (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">Loading media...</SurfaceCard>
      )}

      {items !== undefined && (items === null || items.length === 0) && (
        <div onDragOver={onGridDragOver} onDragLeave={() => setDragOverUpload(false)} onDrop={onGridDrop}>
          <SurfaceCard
            className={`py-14 text-center transition ${dragOverUpload ? 'outline outline-2 outline-offset-2 outline-[var(--team-primary)]' : ''}`}
          >
            {/* The button that was here is the same button already sitting at
                the top of the page, twelve pixels away. One of them was always
                going to be the wrong one to press. */}
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No media for this season yet. Drag &amp; drop photos or clips here, or use{' '}
              <strong className="font-semibold text-slate-600 dark:text-slate-300">Add photos / videos</strong> above.
            </p>
          </SurfaceCard>
        </div>
      )}

      {/*
        GRID VIEW IS THE SHELF ITSELF (user direction) — one box per album, not
        a wall of every photograph. The list answers "what is in this folder";
        the grid answers "what folders do I have", and a grid that just spilled
        every picture answered neither.

        Each box carries a slideshow of its OWN photographs, using the same
        component the Trophy Room's backdrop uses, so the two rooms move the
        same way. The title sits at the bottom over a scrim, where it is legible
        against whatever the picture happens to be doing.
      */}
      {items && items.length > 0 && view === 'grid' && gridOpenKey === null && (
        <div className="media-fade-in grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rolls.map((roll, rollIndex) => {
            const cover =
              roll.entries[0]?.item;
            /*
              THE COVER LEADS, then the rest. A folder with a chosen cover has
              to OPEN on it — a slideshow that starts somewhere else and reaches
              the cover eight seconds later is not showing you the cover.
            */
            const photos = [
              ...(cover ? [cover] : []),
              ...roll.entries.map(({ item }) => item).filter((item) => item.id !== cover?.id),
            ]
              .filter((item) => item.mediaType === 'image')
              .slice(0, 8)
              .map((item) => fileUrl(item.absolutePath));
            return (
              <div key={roll.key} className="group/roll relative">
              <button
                type="button"
                onClick={() => setGridOpenKey(roll.key)}
                className="corner-cut group/box relative aspect-[16/10] w-full overflow-hidden border border-slate-200/80 bg-slate-950 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800"
              >
                {photos.length > 0 ? (
                  /* 200ms apart, in shelf order, so the wall doesn't turn
                     over on one tick. */
                  <MediaBackdrop photos={photos} tone="cover" staggerMs={rollIndex * 200} />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-xs text-slate-500">Empty album</span>
                )}
                {/* The scrim is what makes the title readable over a moving
                    photograph; without it the type flickers as the slideshow
                    changes. */}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent px-4 pb-3 pt-10">
                  <span className="block truncate font-display text-base font-bold text-white">{roll.label}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="tnum">
                      {roll.entries.length} {roll.entries.length === 1 ? 'photo' : 'photos'}
                    </span>
                    {roll.custom && <span className="truncate opacity-70">{roll.defaultLabel}</span>}
                    {roll.albumId !== undefined && <span className="opacity-70">Album</span>}
                  </span>
                </span>
              </button>

              {/* RENAMEABLE FROM THE SHELF TOO (user direction) — outside the
                  box's own button for the usual reason, so it rides on top in
                  the corner rather than nesting. */}
              {renamingKey === roll.key ? (
                <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 bg-slate-950/90 p-1.5">
                  <RollRenamer
                    roll={roll}
                    draft={renameDraft}
                    onDraft={setRenameDraft}
                    onSave={() => void renameRoll(roll, renameDraft)}
                    onUseGameName={() => void renameAlbum(roll.game?.gameId ?? null, '')}
                    onDelete={() => void deleteAlbum(roll.albumId as number, roll.label)}
                    onCancel={() => setRenamingKey(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(roll)}
                  title={`Rename ${roll.label}`}
                  aria-label={`Rename ${roll.label}`}
                  className="absolute right-2 top-2 border border-white/25 bg-slate-950/70 p-1.5 text-slate-200 opacity-0 transition hover:border-[var(--team-primary)] focus-visible:opacity-100 group-hover/roll:opacity-100"
                >
                  <EditIcon />
                </button>
              )}
              </div>
            );
          })}
        </div>
      )}

      {/*
        ALL PHOTOS — every photograph in the season laid out at once, with no
        folders at all (user direction).

        Its reason for existing is CROSS-ALBUM work: Select can only reach what
        is on screen, so tidying up a handful of shots scattered across a dozen
        games meant opening a dozen folders. Here they are all in one place and
        one selection covers the lot.

        Deliberately in ITEM order rather than schedule order — with the
        grouping gone, the drag-reorder arrangement is the only arrangement
        left, and this is the view where you can see and change it.
      */}
      {items && items.length > 0 && view === 'all' && (
        <div className="media-fade-in grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item, index) => {
            const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
            return (
              <MediaTile
                key={item.id}
                item={item}
                index={index}
                caption={item.description || (game ? gameLabel(game) : 'Add details')}
                selectMode={selectMode}
                selected={selectedIds.has(item.id)}
                onOpen={() => setLightboxIndex(index)}
                onToggleSelect={() => toggleSelect(item.id)}
                onDragStartTile={() => {
                  dragIndexRef.current = index;
                  setDragId(item.id);
                }}
                onDragEndTile={() => void commitOrder()}
                onDragOverTile={() => onTileDragOverReorder(index)}
                onDropTile={onTileDrop}
                canReorder={dragIndexRef.current !== null}
                onDelete={() => void confirmDelete(item)}
                tileRef={registerTile(item.id)}
                dragging={dragId === item.id}
              />
            );
          })}
        </div>
      )}

      {/*
        AN ALBUM OPENED IN GRID. Its photographs take the whole grid and the
        shelf steps aside — the same tiles the folder view uses, so selection,
        drag-reorder, the bin and (crucially) the cover control are all here
        too. Choosing a cover used to be reachable only from an open folder in
        LIST view, which is why it looked like it did not work at all if this is
        the view you live in.
      */}
      {items && items.length > 0 && view === 'grid' && gridOpenKey !== null && (
        <div className="media-fade-in space-y-3">
          {(() => {
            const roll = rolls.find((r) => r.key === gridOpenKey);
            if (!roll) return null;
            return (
              <>
                <div className="group/roll flex flex-wrap items-center gap-3">
                  <Button variant="secondary" compact onClick={() => setGridOpenKey(null)}>
                    ← All albums
                  </Button>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-bold text-slate-950 dark:text-white">
                      {roll.label}
                    </span>
                    {roll.custom && (
                      <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                        {roll.defaultLabel}
                      </span>
                    )}
                  </span>
                  {renamingKey === roll.key ? (
                    <RollRenamer
                      roll={roll}
                      draft={renameDraft}
                      onDraft={setRenameDraft}
                      onSave={() => void renameRoll(roll, renameDraft)}
                      onUseGameName={() => void renameAlbum(roll.game?.gameId ?? null, '')}
                      onDelete={() => void deleteAlbum(roll.albumId as number, roll.label)}
                      onCancel={() => setRenamingKey(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(roll)}
                      title={`Rename ${roll.label}`}
                      aria-label={`Rename ${roll.label}`}
                      className="p-1 text-slate-400 transition hover:text-slate-800 dark:text-slate-500 dark:hover:text-white"
                    >
                      <EditIcon />
                    </button>
                  )}
                  <span className="tnum ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {roll.entries.length} {roll.entries.length === 1 ? 'photo' : 'photos'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {roll.entries.map(({ item, index }) => (
                    <MediaTile
                      key={item.id}
                      item={item}
                      index={index}
                      caption={item.description || (roll.game ? gameLabel(roll.game) : 'Add details')}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onOpen={() => setLightboxIndex(index)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onDragStartTile={() => {
                        dragIndexRef.current = index;
                        setDragId(item.id);
                      }}
                      onDragEndTile={() => void commitOrder()}
                      onDragOverTile={() => onTileDragOverReorder(index)}
                      onDropTile={onTileDrop}
                      canReorder={dragIndexRef.current !== null}
                      onDelete={() => void confirmDelete(item)}
                      tileRef={registerTile(item.id)}
                      dragging={dragId === item.id}
                    />
                  ))}
                  {roll.entries.length === 0 && (
                    <p className="col-span-full py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                      Nothing in this album yet. Open a photo, choose <strong>Album</strong> and pick this one.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {items && items.length > 0 && view === 'list' && (
        <div
          onDragOver={onGridDragOver}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOverUpload(false);
          }}
          onDrop={onGridDrop}
          className={`space-y-3 rounded p-1 transition ${
            dragOverUpload ? 'outline-dashed outline-2 outline-offset-2 outline-[var(--team-primary)]' : ''
          }`}
        >
          {rolls.map((roll) => {
            const open = openRolls.has(roll.key);
            const photos = roll.entries.length;
            // The chosen cover, else the first photo in the folder — which is
            // what every folder showed before covers existed, and what one
            // falls back to when its cover has since been deleted.
            const cover =
              roll.entries[0]?.item;
            return (
              <div
                key={roll.key}
                className="group/roll border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-white/[0.03]"
              >
                {/*
                  THE ROW IS A ROW, NOT ONE BIG BUTTON (user direction). The
                  pencil has to sit immediately after the title, and a <button>
                  cannot contain another button — so the toggle shrinks to just
                  the part that IS the toggle (arrow, cover, title) and the
                  pencil becomes its sibling. The count keeps the right edge
                  with `ml-auto`.
                */}
                <div className="flex w-full items-center gap-3 px-3 py-2.5 transition hover:bg-white/60 dark:hover:bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() =>
                    setOpenRolls((prev) => {
                      const next = new Set(prev);
                      if (next.has(roll.key)) next.delete(roll.key);
                      else next.add(roll.key);
                      return next;
                    })
                  }
                  aria-expanded={open}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`shrink-0 text-slate-400 transition-transform duration-base dark:text-slate-500 ${open ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  {/* ONE COVER, NOT FIVE (user direction). A stack of five
                      overlapping thumbnails down a list of fifteen folders was
                      seventy-five pictures, none of them big enough to see. A
                      single frame is what a folder on a shelf actually shows,
                      and which frame it is is now the user's choice — see
                      "Make cover" on each photo. */}
                  <span className="relative h-11 w-16 shrink-0 overflow-hidden border border-white/70 bg-slate-950 dark:border-slate-700">
                    {cover && cover.mediaType === 'image' && (
                      <img
                        src={fileUrl(cover.absolutePath)}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="h-full w-full object-cover"
                        style={{
                          transform: framingTransform(cover.framing),
                          filter: filterCss(resolveMediaLook(cover.look)) || undefined,
                        }}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {roll.label}
                    </span>
                    {/* Renaming a folder must not lose which game it is. The
                        game's own line stays underneath, but only once the name
                        no longer says it. */}
                    {roll.custom && (
                      <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                        {roll.defaultLabel}
                      </span>
                    )}
                  </span>
                </button>

                {renamingKey === roll.key ? (
                  <RollRenamer
                    roll={roll}
                    draft={renameDraft}
                    onDraft={setRenameDraft}
                    onSave={() => void renameRoll(roll, renameDraft)}
                    onUseGameName={() => void renameAlbum(roll.game?.gameId ?? null, '')}
                    onDelete={() => void deleteAlbum(roll.albumId as number, roll.label)}
                    onCancel={() => setRenamingKey(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(roll)}
                    title={`Rename ${roll.label}`}
                    aria-label={`Rename ${roll.label}`}
                    className="shrink-0 p-1 text-slate-400 opacity-0 transition hover:text-slate-800 focus-visible:opacity-100 group-hover/roll:opacity-100 dark:text-slate-500 dark:hover:text-white"
                  >
                    <EditIcon />
                  </button>
                )}

                <span className="tnum ml-auto shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {photos} {photos === 1 ? 'photo' : 'photos'}
                </span>
                </div>

                {/*
                  OUTSIDE THE HEADER BUTTON, not inside it — a <button> cannot
                  contain another button, and nesting one produces markup the
                  browser silently reflows and a keyboard cannot reach. It rides
                  the same row visually via the negative top margin.
                */}
                {open && (
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/80 p-3 md:grid-cols-3 xl:grid-cols-4 dark:border-slate-800">
                    {roll.entries.map(({ item, index }) => (
                      <MediaTile
                        key={item.id}
                        item={item}
                        index={index}
                        caption={item.description || (roll.game ? gameLabel(roll.game) : 'Add details')}
                        selectMode={selectMode}
                        selected={selectedIds.has(item.id)}
                        onOpen={() => setLightboxIndex(index)}
                        onToggleSelect={() => toggleSelect(item.id)}
                        onDragStartTile={() => {
                          dragIndexRef.current = index;
                          setDragId(item.id);
                        }}
                        onDragEndTile={() => void commitOrder()}
                        onDragOverTile={() => onTileDragOverReorder(index)}
                        onDropTile={onTileDrop}
                        canReorder={dragIndexRef.current !== null}
                        onDelete={() => void confirmDelete(item)}
                        tileRef={registerTile(item.id)}
                        dragging={dragId === item.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && items && items[lightboxIndex] && (
        <MediaLightbox
          dynastyId={id}
          seasonId={seasonId}
          items={items}
          index={lightboxIndex}
          games={games}
          roster={roster}
          albums={customAlbums}
          onCreateAlbum={createAlbumNamed}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSaved={handleSaved}
          onFramed={handleFramed}
          onLooked={handleLooked}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
