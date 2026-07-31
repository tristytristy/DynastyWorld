import { useEffect, useState } from 'react';
import { TrendLineChart, type ChartSeries } from '../../charts/TrendCharts';
import { playerDna } from './playerRatingRelevance';
import type { PlayerJourneyEvent } from './playerJourneyEvents';
import type { PlayerDevelopmentSeason, PlayerEditFields, RosterPlayer } from '../../../../shared/types';


function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

/**
 * A titled Overview module.
 *
 * Not a boxed tile and no longer a `SurfaceCard`: the four modules sit in a 2x2
 * grid separated by RULES rather than by gaps (user direction) — a vertical
 * hairline down the middle and a horizontal one between the rows. Cards would
 * have drawn four full outlines on top of that, which is two systems saying the
 * same thing. The border colour is `--section-divider`, the same token the
 * between-sections rule uses, so these lines are the app's line.
 */
function Module({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 text-xs font-medium text-[var(--team-accent-text)] transition duration-fast ease-standard hover:underline"
          >
            {action.label} →
          </button>
        )}
      </div>
      <div className="mt-3 min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A label/value pair on one line — the editorial alternative to a wall of bordered tiles. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-200/60 py-1.5 last:border-0 dark:border-white/5">
      <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

/**
 * The Overview destination — the answer to "who is this player", in the order
 * the brief settled on:
 *
 *     Player Profile   |  Development
 *     Season Snapshot  |  Player DNA
 *     Latest Journey Event
 *
 * WHAT CHANGED, and why. This replaced six `BioTile` boxes stacked above three
 * `OverviewCard` boxes above a chart — eleven bordered rectangles competing at
 * the same visual weight, which is a wall, not a hierarchy. Modules now carry
 * their structure in a heading and a hairline, and each one owns exactly one
 * question.
 *
 * IDENTITY HAS ONE OWNER. The hero keeps number, team, position, class, name and
 * overall; this keeps height, weight, archetype, hometown and development trait.
 * Nothing appears in both — the old Overview repeated the archetype and the
 * trait that the hero line had already said.
 */
export function PlayerOverview({
  player,
  dynastyId,
  playerId,
  ratingsAvailable,
  seasonTiles,
  development,
  latestGameLabel,
  latestGameSupport,
  latestEvent,
  totalHonors,
  latestHonor,
  onGoToPerformance,
  onGoToJourney,
  onGoToShowcase,
  onGoToRatings,
}: {
  player: RosterPlayer;
  dynastyId: string;
  playerId: number;
  /** False for a historical player — live ratings only exist in the current save state. */
  ratingsAvailable: boolean;
  seasonTiles: { label: string; value: string }[];
  development: PlayerDevelopmentSeason[];
  latestGameLabel: string | null;
  latestGameSupport: string | null;
  latestEvent: PlayerJourneyEvent | null;
  totalHonors: number;
  latestHonor: string | null;
  onGoToPerformance: (mode: 'season' | 'career' | 'games') => void;
  onGoToJourney: (mode: 'all' | 'milestones' | 'honors' | 'notes') => void;
  /** Media moved into Showcase, so the empty-state prompt sends people there. */
  onGoToShowcase: () => void;
  onGoToRatings: () => void;
}) {
  /*
    TIER 2, and deliberately not gating anything. Player DNA wants live ratings,
    which are a separate IPC read — so the module renders its own honest state
    while the read is in flight and the rest of Overview never waits on it. The
    hero and every other module are already on screen by the time this resolves.
  */
  const [fields, setFields] = useState<PlayerEditFields | null | undefined>(ratingsAvailable ? undefined : null);
  useEffect(() => {
    if (!ratingsAvailable) {
      setFields(null);
      return;
    }
    let cancelled = false;
    setFields(undefined);
    // `.catch` is not optional. Reading ratings opens the live SAVE FILE, which
    // can be missing, moved, or locked — and a rejected promise never reaches
    // `.then`, so without this the module sits on "Reading ratings…" forever.
    // Found on a dynasty whose save path no longer resolved: both this and the
    // Ratings destination hung indefinitely instead of saying so.
    void window.api.editor
      .getPlayer(dynastyId, playerId)
      .then((result) => {
        if (!cancelled) setFields(result?.fields ?? null);
      })
      .catch(() => {
        if (!cancelled) setFields(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, playerId, ratingsAvailable]);

  const dna = playerDna(player.position, fields ?? null);

  const first = development[0];
  const last = development[development.length - 1];
  const change = first && last ? last.overallRating - first.overallRating : 0;
  const series: ChartSeries[] = [
    {
      key: 'ovr',
      label: 'OVR',
      color: 'blue',
      points: development.map((d) => ({ x: d.seasonYear, y: d.overallRating })),
    },
  ];

  return (
    <div>
      {/*
        The rules ARE the layout. `divide-*` doesn't apply to grid tracks, so
        each cell carries its own edge: the left column a right-hand rule, the
        top row a bottom rule. Padding on the inside of each rule is what keeps
        the columns from crowding the line.
      */}
      <div className="grid lg:grid-cols-2 [&>*]:py-5 lg:[&>*:nth-child(odd)]:pr-6 lg:[&>*:nth-child(even)]:pl-6 [&>*:nth-child(-n+2)]:border-b [&>*]:border-[var(--section-divider)] lg:[&>*:nth-child(odd)]:border-r">
        {/* 1. Who is he — the supporting half of identity. */}
        <Module title="Player profile">
          <div className="-mt-1.5">
            <Row label="Height" value={formatHeight(player.heightInches)} />
            <Row label="Weight" value={`${player.weightPounds} lb`} />
            <Row label="Archetype" value={player.archetype || '—'} />
            <Row label="Development" value={player.developmentTrait || '—'} />
            <Row
              label="Hometown"
              value={[player.hometown, player.homeState].filter(Boolean).join(', ') || '—'}
            />
          </div>
        </Module>

        {/* 2. Is he getting better — the chart IS the answer, not a row of
               numbers that repeats what the chart already shows. */}
        <Module title="Development" hint="Overall rating across every synced season.">
          {development.length > 1 ? (
            <>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="type-stat-sm">{last.overallRating}</span>{' '}
                  <span className="text-xs text-slate-500 dark:text-slate-400">OVR</span>
                </span>
                <span>
                  <span
                    className={`type-stat-sm ${
                      change > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : change < 0
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                    }`}
                  >
                    {change > 0 ? `+${change}` : change}
                  </span>{' '}
                  <span className="text-xs text-slate-500 dark:text-slate-400">since {first.seasonYear}</span>
                </span>
              </div>
              <TrendLineChart
                series={series}
                xTicks={development.map((d) => d.seasonYear)}
                formatX={(x) => String(x)}
                formatY={(y) => String(Math.round(y))}
                yMinHint={Math.max(0, Math.min(...development.map((d) => d.overallRating)) - 3)}
                height={150}
              />
            </>
          ) : first ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              One season tracked so far — {first.seasonYear}: {first.overallRating} OVR as a {first.schoolYear}. Sync
              each season and this becomes a development curve.
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No tracked seasons yet. A player&apos;s rating arc appears once more than one season is synced.
            </p>
          )}
        </Module>

        {/* 3. How is he playing right now. */}
        <Module
          title="Season snapshot"
          action={{ label: 'Performance', onClick: () => onGoToPerformance('season') }}
        >
          {seasonTiles.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {seasonTiles.slice(0, 4).map((t) => (
                  <div key={t.label} className="min-w-0">
                    <p className="type-stat-sm text-slate-950 dark:text-white">{t.value}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{t.label}</p>
                  </div>
                ))}
              </div>
              {latestGameLabel && (
                <p className="mt-3 border-t border-slate-200/60 pt-2 text-xs text-slate-400 dark:border-white/5 dark:text-slate-500">
                  Latest: <span className="text-slate-600 dark:text-slate-300">{latestGameLabel}</span>
                  {latestGameSupport ? ` · ${latestGameSupport}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No stats recorded yet this season.</p>
          )}
        </Module>

        {/* 4. How good is he — three numbers, not a rating grid. */}
        <Module title="Player DNA" action={{ label: 'Ratings', onClick: onGoToRatings }}>
          {fields === undefined ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Reading ratings…</p>
          ) : dna.strength ? (
            <div className="-mt-1.5">
              <Row label="Strength" value={`${dna.strength.abbr} ${dna.strength.value}`} />
              {dna.weakness && dna.weakness.key !== dna.strength.key && (
                <Row label="Weakness" value={`${dna.weakness.abbr} ${dna.weakness.value}`} />
              )}
              {dna.priority && <Row label="Develop next" value={dna.priority.abbr} />}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {ratingsAvailable
                ? "This player couldn't be found in the save file, so there are no ratings to read."
                : 'Ratings are read live from the save, so they only exist for the current season. This is a past-season profile.'}
            </p>
          )}
        </Module>
      </div>

      {/* 5. What has happened lately — one event, not a full timeline. Its own
             rule above it, so the full-width row reads as a third band rather
             than as a fifth cell that lost its neighbour. */}
      <div className="border-t border-[var(--section-divider)] pt-5">
      <Module
        title="Latest journey event"
        action={{ label: 'Journey', onClick: () => onGoToJourney('all') }}
      >
        {latestEvent ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="type-stat-sm text-slate-400 dark:text-slate-500">{latestEvent.seasonYear}</span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{latestEvent.title}</span>
            {latestEvent.detail && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{latestEvent.detail}</span>
            )}
          </div>
        ) : totalHonors > 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="type-stat-sm text-slate-800 dark:text-slate-100">{totalHonors}</span> career honor
            {totalHonors === 1 ? '' : 's'}
            {latestHonor ? ` — most recently ${latestHonor}.` : '.'}
          </p>
        ) : (
          // Compact and actionable, not a full-page empty state: there IS a
          // player here, and the page is not empty.
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nothing recorded yet.{' '}
            <button
              type="button"
              onClick={() => onGoToJourney('notes')}
              className="font-medium text-[var(--team-accent-text)] hover:underline"
            >
              Add a scouting note
            </button>{' '}
            or{' '}
            <button
              type="button"
              onClick={onGoToShowcase}
              className="font-medium text-[var(--team-accent-text)] hover:underline"
            >
              tag a photo
            </button>
            .
          </p>
        )}
      </Module>
      </div>
    </div>
  );
}
