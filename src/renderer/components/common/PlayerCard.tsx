import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { PlayerPortrait } from './PlayerPortrait';
import { useTheme } from '../../theme/ThemeProvider';
import type { DynastyTheme, RosterPlayer } from '../../../shared/types';

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
  stats,
}: {
  player: RosterPlayer;
  teamName: string | null;
  stats: { label: string; value: string }[];
}) {
  const line = stats.slice(0, 3);
  return (
    <div
      className="relative aspect-[330/496] w-full max-w-[340px] overflow-hidden rounded-2xl text-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)]"
      style={{
        background: 'linear-gradient(160deg, var(--team-primary), color-mix(in srgb, var(--team-primary) 48%, #000))',
        boxShadow: '0 30px 70px -30px rgba(0,0,0,0.8), inset 0 0 0 3px color-mix(in srgb, var(--team-secondary) 32%, transparent)',
      }}
    >
      {/* Photo hero — portrait + jersey, plus jersey-number watermark and a foil sheen */}
      <div className="absolute inset-x-0 top-0 flex h-[66%] items-end justify-center overflow-hidden">
        <span
          className="tnum absolute -right-2 top-2 select-none font-black leading-none tracking-tighter"
          style={{ fontSize: '150px', color: 'rgba(255,255,255,0.08)' }}
        >
          {player.jerseyNumber}
        </span>
        <PlayerPortrait player={player} teamAssetName={teamName} size="lg" className="!h-[92%] !w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.14) 46%, rgba(255,255,255,0.02) 56%, transparent 72%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--team-primary) 60%, #000) 100%)' }}
        />
      </div>

      {/* Position + OVR */}
      <span
        className="absolute left-4 top-4 z-10 rounded border px-2.5 py-1 text-xs font-extrabold tracking-widest"
        style={{ borderColor: 'var(--team-secondary)', color: 'var(--team-secondary)', background: 'rgba(0,0,0,0.25)' }}
      >
        {player.position}
      </span>
      <div className="absolute right-4 top-3 z-10 text-right leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        <span className="text-[44px] font-extrabold" style={{ color: 'var(--team-secondary)' }}>
          {player.overallRating}
        </span>
        <span className="block text-[10px] tracking-[0.3em] opacity-80">OVR</span>
      </div>

      {/* Vertical name — first (smaller) beside last (bigger), rising up the left */}
      <div className="pointer-events-none absolute left-0 top-0 z-[2] h-[66%] w-24" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.55), transparent)' }} />
      <div className="absolute left-2 top-0 z-[4] flex h-[66%] items-end gap-4">
        <span className="[writing-mode:vertical-rl] rotate-180 pb-0.5 text-[22px] font-semibold tracking-wide opacity-90 drop-shadow-[0_3px_16px_rgba(0,0,0,0.85)]">
          {player.firstName}
        </span>
        <span className="[writing-mode:vertical-rl] rotate-180 text-[46px] font-extrabold tracking-wide drop-shadow-[0_3px_16px_rgba(0,0,0,0.85)]">
          {player.lastName.toUpperCase()}
        </span>
      </div>

      {/* Bottom band — meta + season stats */}
      <div className="absolute inset-x-0 bottom-0 h-[34%] pb-8 pl-[86px] pr-5 pt-4">
        <p className="text-[11.5px] opacity-75">
          {teamName ? `${teamName} · ` : ''}
          {spaced(player.schoolYear)}
          {player.developmentTrait ? ` · ${spaced(player.developmentTrait)} dev` : ''}
        </p>
        {line.length > 0 && (
          <div className="mt-4 flex gap-2">
            {line.map((s) => (
              <div key={s.label} className="flex-1 rounded-md border border-white/15 bg-black/30 px-1 py-2.5 text-center">
                <p className="text-lg font-extrabold" style={{ color: 'var(--team-secondary)' }}>{s.value}</p>
                <p className="mt-0.5 text-[9px] tracking-[0.14em] opacity-65">{s.label.toUpperCase()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="absolute inset-x-0 bottom-2.5 z-10 text-center text-[9px] tracking-[0.15em] opacity-50">
        College Football 27 Dynasty Hub
      </p>
    </div>
  );
}

/** The player-modal "Card" tab — renders the card centered with a Download (PNG) action. */
export function PlayerCardTab({
  player,
  teamName,
  stats,
  playerName,
  dynastyId,
}: {
  player: RosterPlayer;
  teamName: string | null;
  stats: { label: string; value: string }[];
  playerName: string;
  dynastyId: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // The player modal is portaled to <body>, outside the dynasty container that
  // sets the --team-* vars, so resolve them here and apply to the card wrapper.
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

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div ref={cardRef} className="w-full max-w-[340px]" style={colorVars as unknown as CSSProperties}>
        <PlayerCard player={player} teamName={teamName} stats={stats} />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
        >
          {busy ? 'Saving…' : 'Download card (PNG)'}
        </button>
        {msg && <p className="text-xs text-slate-400 dark:text-slate-500">{msg}</p>}
      </div>
    </div>
  );
}
