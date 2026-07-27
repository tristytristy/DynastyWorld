import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { PlayerPortrait } from './PlayerPortrait';
import { TeamLogo } from './TeamLogo';
import { useTheme } from '../../theme/ThemeProvider';
import type { DynastyTheme, MediaItemResolved, RosterPlayer } from '../../../shared/types';

/**
 * Which stats headline the card, by default, when the user hasn't picked their
 * own. Higher wins; anything unlisted sits in the middle, and "Games" is pushed
 * to the bottom so a marquee line (Pass Yds, Pass TD, …) leads instead. A player
 * is only ever one side of the ball, so the shared 'INT' label is unambiguous
 * per card.
 */
const STAT_PRIORITY: Record<string, number> = {
  'Pass Yds': 100,
  'Pass TD': 96,
  'Rush Yds': 92,
  'Rush TD': 90,
  'Rec Yds': 88,
  'Rec TD': 86,
  Tackles: 100,
  Sacks: 96,
  TFL: 88,
  Rec: 74,
  'Pass Def.': 72,
  'Forced Fum.': 70,
  'Comp/Att': 68,
  'Fum. Rec.': 66,
  INT: 62,
  'Int Yds': 58,
  Assists: 56,
  'Rush Att': 40,
  'Pass Att': 30,
  Games: 0,
};

/** The default marquee stats (up to 3) for a card, most-notable first. */
function defaultStatLabels(stats: { label: string; value: string }[]): string[] {
  return [...stats]
    .sort((a, b) => (STAT_PRIORITY[b.label] ?? 50) - (STAT_PRIORITY[a.label] ?? 50))
    .slice(0, 3)
    .map((s) => s.label);
}

/** Humanize a dev-trait/scheme enum lightly (camelCase → spaced). */
function spaced(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * A premium, shareable player trading card — photo hero (portrait + team
 * jersey), the name running vertically up the left, OVR top-right, and a season
 * stat line along the bottom. Auto-themed to the active dynasty via the
 * --team-* CSS vars. `stats` are the same position-appropriate season tiles the
 * profile overview shows.
 */
export function PlayerCard({
  player,
  teamName,
  seasonYear,
  stats,
  photoUrl,
  photoTransform,
  onPhotoPointerDown,
}: {
  player: RosterPlayer;
  teamName: string | null;
  seasonYear?: number | null;
  stats: { label: string; value: string }[];
  /** A user-supplied custom photo (file:// URL). When set, it replaces the portrait as the hero. */
  photoUrl?: string | null;
  photoTransform?: { x: number; y: number; scale: number };
  /** When provided, the photo area is draggable to reposition the custom photo. */
  onPhotoPointerDown?: (e: React.PointerEvent) => void;
}) {
  const line = stats.slice(0, 4);
  const t = photoTransform ?? { x: 0, y: 0, scale: 1 };
  return (
    <div
      className="relative aspect-[330/496] w-full max-w-[340px] overflow-hidden rounded-2xl text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)]"
      style={{
        background: 'linear-gradient(160deg, var(--team-primary), color-mix(in srgb, var(--team-primary) 48%, #000))',
        boxShadow: '0 30px 70px -30px rgba(0,0,0,0.8), inset 0 0 0 3px color-mix(in srgb, var(--team-secondary) 32%, transparent)',
      }}
    >
      {/* Full-bleed photo — the player portrait+jersey by default, or the user's uploaded photo */}
      <div
        onPointerDown={onPhotoPointerDown}
        className={`absolute inset-0 overflow-hidden ${onPhotoPointerDown ? 'cursor-move touch-none' : ''}`}
      >
        {photoUrl ? (
          // object-contain so a wide (16:9) photo arrives whole — the user zooms
          // in and drags to frame it, and overflow-hidden keeps it in the card.
          <img
            src={photoUrl}
            draggable={false}
            alt=""
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: 'center' }}
          />
        ) : (
          <PlayerPortrait
            player={player}
            teamAssetName={teamName}
            size="lg"
            className="!absolute !inset-0 !h-full !w-full [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover [&_img]:!object-top"
          />
        )}
      </div>

      {/* Jersey-number watermark */}
      <span
        className="tnum pointer-events-none absolute right-1 top-16 z-[1] select-none font-black leading-none tracking-tighter"
        style={{ fontSize: '150px', color: 'rgba(255,255,255,0.10)' }}
      >
        {player.jerseyNumber}
      </span>

      {/* Bottom fade for legibility + foil sheen */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--team-primary) 55%, #000) 74%, color-mix(in srgb, var(--team-primary) 40%, #000) 100%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0.02) 56%, transparent 72%)' }}
      />

      {/* Position + OVR */}
      <span
        className="absolute left-4 top-4 z-10 rounded border px-2.5 py-1 text-xs font-extrabold tracking-widest"
        style={{ borderColor: 'var(--team-secondary)', color: 'var(--team-secondary)', background: 'rgba(0,0,0,0.28)' }}
      >
        {player.position}
      </span>
      <div className="absolute right-4 top-3 z-10 text-right leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
        <span className="text-[44px] font-extrabold" style={{ color: 'var(--team-secondary)' }}>
          {player.overallRating}
        </span>
        <span className="block text-[10px] tracking-[0.3em] opacity-85">OVR</span>
      </div>

      {/* Vertical name — first (smaller) hugging the last (bigger), rising up from the bottom-left */}
      <div className="absolute bottom-[100px] left-3 z-[4] flex items-end gap-1">
        <span className="[writing-mode:vertical-rl] rotate-180 pb-1 text-[21px] font-semibold tracking-wide drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]">
          {player.firstName}
        </span>
        <span className="[writing-mode:vertical-rl] rotate-180 text-[46px] font-extrabold tracking-wide drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]">
          {player.lastName.toUpperCase()}
        </span>
      </div>

      {/* Bottom band — meta line, a wide single-line stat row, and the gold team logo */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-2">
        <p className="mb-2 text-[11px] font-medium tracking-wide opacity-85">
          {[teamName, spaced(player.schoolYear), seasonYear].filter(Boolean).join(' · ')}
        </p>
        <div className="flex items-end justify-between gap-3">
          {line.length > 0 && (
            <div className="flex flex-1 items-end justify-between gap-2 pr-1">
              {line.map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="text-[19px] font-extrabold leading-none" style={{ color: 'var(--team-secondary)' }}>
                    {s.value}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-[0.11em] opacity-70">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          {teamName && (
            <TeamLogo
              team={{ assetName: teamName, label: teamName }}
              size="lg"
              variant="gold"
              className="!h-12 !w-12 shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface PhotoTransform {
  x: number;
  y: number;
  scale: number;
}
const DEFAULT_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1 };

/** A local file path as a renderer-loadable file:// URL (same scheme the media gallery uses). */
function fileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

const BTN =
  'border border-slate-300/80 bg-white/85 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white';

/**
 * The player-modal "Card" tab — the card plus its editor: drop your own photo
 * (a game screenshot), drag to reposition, zoom to frame, and download as PNG.
 * The photo lives in the app's userData (per player); the pan/zoom framing is
 * saved locally (localStorage), keyed by dynasty + player.
 */
export function PlayerCardTab({
  player,
  teamName,
  seasonYear,
  stats,
  playerName,
  dynastyId,
}: {
  player: RosterPlayer;
  teamName: string | null;
  seasonYear?: number | null;
  stats: { label: string; value: string }[];
  playerName: string;
  dynastyId: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // The modal is portaled to <body>, outside the dynasty container that sets the
  // --team-* vars, so resolve them here and apply to the card wrapper.
  const { resolveColorVars } = useTheme();
  const [theme, setTheme] = useState<DynastyTheme | null>(null);
  useEffect(() => {
    let cancelled = false;
    window.api.db.getDynastyTheme(dynastyId).then((t) => {
      if (!cancelled) setTheme(t);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId]);
  const colorVars = resolveColorVars({ primary: theme?.primaryColor ?? null, secondary: theme?.secondaryColor ?? null });

  // --- Which stats headline the card (per player, up to 4) ---
  const statsKey = `cfb.cardstats.${dynastyId}.${player.id}`;
  const statsSignature = stats.map((s) => s.label).join('|');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => defaultStatLabels(stats));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(statsKey);
      const saved = raw ? (JSON.parse(raw) as string[]) : null;
      const valid = Array.isArray(saved) ? saved.filter((l) => stats.some((s) => s.label === l)) : [];
      setSelectedLabels(valid.length > 0 ? valid.slice(0, 4) : defaultStatLabels(stats));
    } catch {
      setSelectedLabels(defaultStatLabels(stats));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey, statsSignature]);

  function toggleStat(label: string) {
    setSelectedLabels((prev) => {
      let next: string[];
      if (prev.includes(label)) next = prev.filter((l) => l !== label);
      else if (prev.length >= 4) next = prev; // cap the card at four stats
      else next = [...prev, label];
      try {
        localStorage.setItem(statsKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Selected stats, in the user's pick order.
  const selectedStats = selectedLabels
    .map((l) => stats.find((s) => s.label === l))
    .filter((s): s is { label: string; value: string } => Boolean(s));

  // --- Custom photo (per player) ---
  const transformKey = `cfb.cardphoto.${dynastyId}.${player.id}`;
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0); // cache-bust the <img> after a re-pick
  const [transform, setTransform] = useState<PhotoTransform>(DEFAULT_TRANSFORM);
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    let cancelled = false;
    setPhotoPath(null);
    setPhotoVersion((v) => v + 1);
    window.api.card.getPhoto(dynastyId, player.id).then((p) => {
      if (!cancelled) setPhotoPath(p);
    });
    try {
      const raw = localStorage.getItem(transformKey);
      setTransform(raw ? { ...DEFAULT_TRANSFORM, ...(JSON.parse(raw) as PhotoTransform) } : DEFAULT_TRANSFORM);
    } catch {
      setTransform(DEFAULT_TRANSFORM);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynastyId, player.id]);

  function saveTransform(next: PhotoTransform) {
    try {
      localStorage.setItem(transformKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function pickPhoto() {
    const p = await window.api.card.pickPhoto(dynastyId, player.id);
    if (p) {
      setPhotoPath(p);
      setPhotoVersion((v) => v + 1);
      setTransform(DEFAULT_TRANSFORM);
      saveTransform(DEFAULT_TRANSFORM);
    }
  }

  async function removePhoto() {
    await window.api.card.removePhoto(dynastyId, player.id);
    setPhotoPath(null);
  }

  // --- Reuse a photo already tagged to this player in the media gallery ---
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaImages, setMediaImages] = useState<MediaItemResolved[] | null>(null);
  async function toggleMediaPicker() {
    const next = !mediaOpen;
    setMediaOpen(next);
    if (next && mediaImages === null) {
      const items = await window.api.media.listForPlayer(dynastyId, player.id);
      setMediaImages(items.filter((m) => m.mediaType === 'image'));
    }
  }
  async function chooseMediaPhoto(absolutePath: string) {
    const p = await window.api.card.setPhotoFromPath(dynastyId, player.id, absolutePath);
    if (p) {
      setPhotoPath(p);
      setPhotoVersion((v) => v + 1);
      setTransform(DEFAULT_TRANSFORM);
      saveTransform(DEFAULT_TRANSFORM);
      setMediaOpen(false);
    }
  }

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  function onPhotoPointerDown(e: React.PointerEvent) {
    if (!photoPath) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: transformRef.current.x, origY: transformRef.current.y };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setTransform((prev) => ({ ...prev, x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) }));
  }
  function onPointerUp() {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    saveTransform(transformRef.current);
  }
  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onZoom(e: React.ChangeEvent<HTMLInputElement>) {
    const scale = Number(e.target.value);
    setTransform((prev) => {
      const next = { ...prev, scale };
      saveTransform(next);
      return next;
    });
  }

  async function download() {
    const el = cardRef.current;
    if (!el) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = el.getBoundingClientRect();
      const result = await window.api.export.playerCardToPng(playerName, {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
      });
      setMsg(result.message);
    } finally {
      setBusy(false);
    }
  }

  const photoUrl = photoPath ? `${fileUrl(photoPath)}?v=${photoVersion}` : null;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div ref={cardRef} className="w-full max-w-[340px]" style={colorVars as unknown as CSSProperties}>
        <PlayerCard
          player={player}
          teamName={teamName}
          seasonYear={seasonYear}
          stats={selectedStats}
          photoUrl={photoUrl}
          photoTransform={transform}
          onPhotoPointerDown={photoPath ? onPhotoPointerDown : undefined}
        />
      </div>

      {/* Photo controls */}
      {photoPath && (
        <div className="flex w-full max-w-[340px] items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.02}
            value={transform.scale}
            onChange={onZoom}
            className="flex-1 accent-[var(--team-primary)]"
            aria-label="Zoom photo"
          />
        </div>
      )}
      {photoPath && (
        <p className="-mt-1 text-xs text-slate-400 dark:text-slate-500">
          The full photo shows at first — zoom in to fill the card, then drag to frame it.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={pickPhoto} className={BTN}>
          {photoPath ? 'Change photo' : 'Add your photo'}
        </button>
        <button type="button" onClick={toggleMediaPicker} className={BTN}>
          From media
        </button>
        {photoPath && (
          <button type="button" onClick={removePhoto} className={BTN}>
            Remove photo
          </button>
        )}
        <button type="button" onClick={download} disabled={busy} className={BTN}>
          {busy ? 'Saving…' : 'Download card (PNG)'}
        </button>
      </div>

      {/* Pick from photos already tagged to this player in the media gallery */}
      {mediaOpen && (
        <div className="w-full max-w-[340px]">
          {mediaImages === null ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">Loading…</p>
          ) : mediaImages.length === 0 ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              No photos tagged with {player.firstName} yet. Tag them in the Media gallery to reuse here.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {mediaImages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => chooseMediaPhoto(m.absolutePath)}
                  title={m.description || m.gameLabel || 'Use this photo'}
                  className="group aspect-square overflow-hidden rounded border border-slate-300/70 transition hover:border-[var(--team-primary)] dark:border-slate-700"
                >
                  <img
                    src={fileUrl(m.absolutePath)}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat picker — choose which (up to 4) span the bottom of the card */}
      {stats.length > 0 && (
        <div className="w-full max-w-[340px]">
          <p className="mb-1.5 text-center text-xs text-slate-400 dark:text-slate-500">
            Card stats — pick up to 4 ({selectedLabels.length}/4)
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {stats.map((s) => {
              const on = selectedLabels.includes(s.label);
              const full = !on && selectedLabels.length >= 4;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => toggleStat(s.label)}
                  disabled={full}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    on
                      ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                      : 'border-slate-300/80 text-slate-600 hover:border-[var(--team-primary)] disabled:opacity-40 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-slate-400 dark:text-slate-500">{msg}</p>}
    </div>
  );
}
