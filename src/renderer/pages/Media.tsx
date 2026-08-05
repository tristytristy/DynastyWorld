import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useGameModal } from '../data/GameModalProvider';
import type { MediaFraming, MediaItemPatch, MediaItemWithPath, RosterPlayer, ScheduleGame, ScheduleOverview } from '../../shared/types';
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
import { CloseIcon, EditIcon, ExportIcon, TrashIcon } from '../components/common/ActionIcons';
import { ModalCloseButton } from '../components/common/ModalCloseButton';
import { ZoomableImage, framingTransform } from '../components/common/ZoomableImage';
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

/** One labelled slider — the darkroom's only control shape, so the panel reads as one instrument. */
function LookSlider({
  label,
  value,
  onChange,
  suffix = '%',
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
  disabled?: boolean;
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
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none bg-slate-200 accent-[var(--team-primary)] dark:bg-white/10"
      />
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
  onSave,
  onCancel,
}: {
  item: MediaItemWithPath;
  games: ScheduleGame[];
  roster: RosterPlayer[];
  onSave: (patch: MediaItemPatch) => void;
  onCancel: () => void;
}) {
  const [gameId, setGameId] = useState<number | null>(item.gameId);
  const [description, setDescription] = useState(item.description);
  const [playerIds, setPlayerIds] = useState<number[]>(item.playerIds);
  const [playerQuery, setPlayerQuery] = useState('');

  const filteredRoster = useMemo(() => {
    const raw = playerQuery.trim();
    /*
      JERSEY SEARCH, TYPED THE WAY PEOPLE TYPE IT (user request, 2026-08-02).

      Two changes, both about not making someone spell the query the app's way:

      · The `#` is optional. Digits ARE a jersey number — no name on a roster is
        "27" — so typing 27 means the same thing as typing #27. The `#` still
        works, because it's in the manual and because it's an unambiguous way to
        say "I mean the number" if a roster ever holds a numeral in a name.

      · PREFIX, not exact. Typing 5 was matching only #5 and hiding #50 through
        #59, which is the opposite of how a number half-remembered off a jersey
        arrives: you get the first digit, then the second. Now 5 opens the whole
        fifties and keeps narrowing as you type.

      Exact matches still sort first, so 5 lists #5 above #50 — the number you
      typed in full is the one you most likely meant.
    */
    const jerseyQuery = /^#?\d+$/.test(raw) ? raw.replace('#', '') : null;
    let matches: RosterPlayer[];
    if (jerseyQuery !== null) {
      matches = roster.filter((p) => String(p.jerseyNumber).startsWith(jerseyQuery));
    } else if (raw === '#') {
      matches = roster;
    } else if (raw) {
      const q = raw.toLowerCase();
      matches = roster.filter((p) => playerLabel(p).toLowerCase().includes(q) || p.position.toLowerCase() === q);
    } else {
      matches = roster;
    }
    // Tagged players float to the top so the current selection is always visible.
    return [...matches].sort((a, b) => {
      const at = playerIds.includes(a.id) ? 0 : 1;
      const bt = playerIds.includes(b.id) ? 0 : 1;
      if (at !== bt) return at - bt;
      if (jerseyQuery !== null) {
        const ae = String(a.jerseyNumber) === jerseyQuery ? 0 : 1;
        const be = String(b.jerseyNumber) === jerseyQuery ? 0 : 1;
        // Then numerically, so the fifties read 50, 51, 52 rather than by rating.
        if (ae !== be) return ae - be;
        if (a.jerseyNumber !== b.jerseyNumber) return a.jerseyNumber - b.jerseyNumber;
      }
      return b.overallRating - a.overallRating;
    });
  }, [roster, playerQuery, playerIds]);

  const inputClass =
    'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className="space-y-4">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game</p>
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
        <input
          type="text"
          value={playerQuery}
          onChange={(e) => setPlayerQuery(e.target.value)}
          placeholder="Search by name, number or position..."
          aria-label="Search players to tag — by name, position, or jersey number"
          className={`${inputClass} mt-1.5`}
        />
        <div className="mt-1.5 max-h-48 overflow-y-auto border border-slate-200/80 dark:border-slate-800">
          {filteredRoster.map((player) => {
            const tagged = playerIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() =>
                  setPlayerIds((prev) => (tagged ? prev.filter((pid) => pid !== player.id) : [...prev, player.id]))
                }
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
          {filteredRoster.length === 0 && (
            <p className="px-2.5 py-3 text-xs text-slate-400 dark:text-slate-500">No matching players.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => onSave({ gameId, description: description.trim(), playerIds })}>Save details</Button>
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
                  opacity: (look.grain / 100) * 0.55,
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
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
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchGameId, setBatchGameId] = useState('');
  const dragIndexRef = useRef<number | null>(null);

  const seasonYear = seasons.find((s) => s.id === seasonId)?.seasonYear;
  const importing = importProgress !== null;

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
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (paths.length) importFiles(paths);
  }

  // --- Drag-to-reorder (normal mode) ---
  async function onTileDrop(event: ReactDragEvent, index: number) {
    if (Array.from(event.dataTransfer.files ?? []).length > 0) return; // file drop → let the grid upload
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index || !items || !id || seasonId === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setItems(next);
    await window.api.media.reorder(id, seasonId, next.map((m) => m.id));
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
  }

  async function batchSetGame() {
    if (!items || selectedIds.size === 0) return;
    const gid = batchGameId === '' ? null : Number(batchGameId);
    for (const m of items.filter((it) => selectedIds.has(it.id))) {
      await window.api.media.update(m.id, { gameId: gid, description: m.description, playerIds: m.playerIds });
    }
    refresh();
    exitSelectMode();
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

    Order is the ITEM order, not the schedule's — the grid is drag-reorderable,
    and a group that jumped to a different place after a drag would undo the
    only arrangement the user actually made. Each group carries its items' real
    indices in the flat list so drag, drop and the lightbox's Prev/Next all keep
    working across the whole season exactly as before.
  */
  const UNFILED = 'unfiled';
  const rolls: { key: string; label: string; game?: ScheduleGame; entries: { item: MediaItemWithPath; index: number }[] }[] = [];
  const rollByKey = new Map<string, (typeof rolls)[number]>();
  (items ?? []).forEach((item, index) => {
    const key = item.gameId === null ? UNFILED : String(item.gameId);
    let roll = rollByKey.get(key);
    if (!roll) {
      const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
      roll = { key, label: game ? gameLabel(game) : 'Not from a game', game, entries: [] };
      rollByKey.set(key, roll);
      rolls.push(roll);
    }
    roll.entries.push({ item, index });
  });

  return (
    <div className="space-y-6">
      {/*
        No headline (user's call). "The season, in pictures." was a title for a
        page whose content IS pictures — it said nothing the grid underneath
        doesn't say better, and it cost the first fifth of the screen on a page
        about filling the screen with photographs. The eyebrow keeps the page
        named, the hint keeps the instructions, and the actions move up into the
        space the title was using.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-eyebrow flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
          Media
          <InfoHint label="About the media library">
            {`Game-day screenshots and clips for ${seasonYear !== undefined ? `the ${seasonYear} season` : 'this season'} — tag the game and the players, and everything links back to their pages. Photos group by game and open on click. Drag to reorder, drop files in to add, and use Select for batch edits.`}
          </InfoHint>
        </p>
        <div className="flex items-center gap-2">
          {hasItems && (
            <Button variant="secondary" onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
          <Button onClick={handleUpload} disabled={importing || seasonId === undefined}>
            {importing ? 'Importing…' : 'Add photos / videos'}
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

      {/* Batch toolbar (Select mode) */}
      {selectMode && (
        <SurfaceCard className="flex flex-wrap items-center gap-3 py-3">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set((items ?? []).map((m) => m.id)))}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Select all
          </button>
          <div className="h-5 w-px bg-slate-300/70 dark:bg-slate-700/70" aria-hidden="true" />
          {/* A span, not a <label>: a label wrapping a BUTTON doesn't forward
              clicks the way it does for a native control, so the text would look
              clickable and do nothing. */}
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Set game
            <Select
              value={batchGameId}
              onChange={setBatchGameId}
              disabled={selectedIds.size === 0}
              ariaLabel="Game to assign to the selected media"
              options={[
                { value: '', label: 'Not from a specific game' },
                ...games.map((game) => ({ value: String(game.gameId), label: gameLabel(game) })),
              ]}
            />
          </span>
          <Button onClick={batchSetGame} disabled={selectedIds.size === 0}>
            Apply to {selectedIds.size}
          </Button>
          <button
            type="button"
            onClick={batchDelete}
            disabled={selectedIds.size === 0}
            className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-red-400 dark:hover:bg-red-950/60"
          >
            Delete selected
          </button>
          <div className="ml-auto">
            <Button variant="secondary" onClick={exitSelectMode}>
              Done
            </Button>
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

      {items && items.length > 0 && (
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
            return (
              <div key={roll.key} className="border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-white/[0.03]">
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
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/60 dark:hover:bg-white/[0.04]"
                >
                  <span
                    aria-hidden
                    className={`shrink-0 text-slate-400 transition-transform duration-base dark:text-slate-500 ${open ? 'rotate-90' : ''}`}
                  >
                    ▶
                  </span>
                  {/* The peek: what's in the roll, without opening it. Overlapped
                      rather than laid in a row, so five thumbnails read as a
                      stack of photographs and cost the width of two. */}
                  <span className="flex shrink-0 items-center">
                    {roll.entries.slice(0, 5).map(({ item }, i) => (
                      <span
                        key={item.id}
                        className="relative -ml-3 h-9 w-12 shrink-0 overflow-hidden border border-white/70 bg-slate-950 first:ml-0 dark:border-slate-700"
                        style={{ zIndex: 5 - i }}
                      >
                        {item.mediaType === 'image' && (
                          <img
                            src={fileUrl(item.absolutePath)}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            className="h-full w-full object-cover"
                            style={{
                              transform: framingTransform(item.framing),
                              filter: filterCss(resolveMediaLook(item.look)) || undefined,
                            }}
                          />
                        )}
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {roll.label}
                  </span>
                  <span className="tnum shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {photos} {photos === 1 ? 'photo' : 'photos'}
                  </span>
                </button>

                {open && (
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/80 p-3 md:grid-cols-3 xl:grid-cols-4 dark:border-slate-800">
                    {roll.entries.map(({ item, index }) => {
                      const game = roll.game;
                      const caption = item.description || (game ? gameLabel(game) : 'Add details');
                      const selected = selectedIds.has(item.id);
                      return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                draggable={!selectMode}
                onDragStart={(e) => {
                  dragIndexRef.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                }}
                onDragOver={(e) => {
                  if (dragIndexRef.current !== null) e.preventDefault();
                }}
                onDrop={(e) => onTileDrop(e, index)}
                onClick={() => (selectMode ? toggleSelect(item.id) : setLightboxIndex(index))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (selectMode) toggleSelect(item.id);
                    else setLightboxIndex(index);
                  }
                }}
                aria-label={selectMode ? `Select media: ${caption}` : `Open media: ${caption}`}
                className={`group relative aspect-video overflow-hidden border bg-slate-950 text-left transition ${
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

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-6">
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await confirm(DELETE_MEDIA_CONFIRM)) handleDeleted(item);
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
                    })}
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
