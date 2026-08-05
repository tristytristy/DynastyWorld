import { useEffect, useMemo, useState } from 'react';
import { PlayerPortrait } from '../../components/common/PlayerPortrait';
import { MediaBackdrop } from '../../components/common/MediaBackdrop';
import { TeamLogo } from '../../components/common/TeamLogo';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { formatAwardLabel } from '../../lib/awardFormat';
import { DEFAULT_HELMET_PATH, getHelmetPath } from '../../lib/helmetAssetMapping';
import {
  ALL_AWARD_TYPES,
  getAwardTrophyPath,
  getBowlTrophyPath,
  getConferenceChampionshipTrophyPath,
  getTrophyImagePath,
} from '../../lib/trophyAssetMapping';
import { useGameModal } from '../../data/GameModalProvider';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { useCachedFetch, useCoachHubReady, useCoachQuery } from './coachData';
import type {
  AwardsOverview,
  ProgramHistoryOverview,
  MediaItemResolved,
  ProgramHistorySeasonEntry,
  ScheduleGame,
  ScheduleOverview,
  TeamTrophies,
} from '../../../shared/types';

type Room = 'postseason' | 'awards';

/**
 * THE TROPHY ROOM — a museum, not a page of cards.
 *
 * The whole design rests on one decision: the trophy art is a flat PNG and is
 * never pretended otherwise. No rotation, no perspective, no WebGL. The ROOM
 * does the work instead — a spotlight above, a lit floor below, a mirrored
 * reflection, a vignette closing the walls in. Composition and lighting, which
 * is what a real display case is anyway, and which costs a laptop nothing.
 *
 * SCOPE IS TROPHIES ONLY. No records, no retired numbers, no coaching tree, no
 * statistics, no timeline. Those all have homes. A room that celebrates
 * everything celebrates nothing.
 *
 * EMPTY IS DESIGNED, NOT MISSING. An unwon trophy is a silhouette on a lit
 * pedestal, because a collection whose shape you can see is one you want to
 * finish. There are no blank boxes anywhere on this page.
 */
export function TrophyRoom() {
  const { dynastyId, overview } = useCoachHubReady();
  const { seasons } = useSelectedSeason();
  const [room, setRoom] = useState<Room>('postseason');
  const [trophiesBySeason, setTrophiesBySeason] = useState<Map<number, TeamTrophies>>(new Map());
  const cached = useCachedFetch();
  const history = useCoachQuery<ProgramHistoryOverview | null>(
    dynastyId ? `history:${dynastyId}` : null,
    () => window.api.db.getHistory(dynastyId),
  );

  // Per-season trophies: the only source that distinguishes a bowl WIN from a
  // bowl appearance, which is the difference between a trophy and a memory.
  const fullSeasons = useMemo(() => seasons.filter((s) => s.hasFullData), [seasons]);
  const seasonKey = useMemo(() => fullSeasons.map((s) => s.id).join(','), [fullSeasons]);

  useEffect(() => {
    if (!dynastyId || fullSeasons.length === 0) return;
    let cancelled = false;
    Promise.all(
      /*
        THROUGH THE SHARED CACHE, because this is the most expensive loop left
        in the hub. `getTrophies` reads that season's SCHEDULE (~0.95 MB) plus
        its TEAMS snapshot (~0.57 MB) plus the conference-championship rows —
        about 1.5 MB per season — and the room asked for every season, every
        time it was opened. Cached, a return visit costs nothing.
      */
      fullSeasons.map(
        async (s) =>
          [
            s.seasonYear,
            await cached(`trophies:${dynastyId}:${s.id}`, () => window.api.db.getTeamTrophies(dynastyId, s.id)),
          ] as const,
      ),
    ).then((pairs) => {
      if (cancelled) return;
      const map = new Map<number, TeamTrophies>();
      for (const [year, trophies] of pairs) if (trophies) map.set(year, trophies);
      setTrophiesBySeason(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynastyId, seasonKey, cached]);

  const seasonIdByYear = useMemo(
    () => new Map(fullSeasons.map((s) => [s.seasonYear, s.id])),
    [fullSeasons],
  );

  const seasonByYear = useMemo(() => {
    const map = new Map<number, ProgramHistorySeasonEntry>();
    for (const s of history?.seasons ?? []) map.set(s.seasonYear, s);
    return map;
  }, [history]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* NOT the team's name (user direction 2026-08-03). This room belongs to
            the COACH: a coach who moves schools keeps everything in it, because
            it's his legacy rather than the current programme's cabinet. Putting
            "UCLA" over the top would quietly claim otherwise. */}
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Trophy Room</p>
        {/* The app's own two-way switch, with the team's mark in gold as the
            knob — the same device as Roster|Transfers and Staff's Current|Tree.
            A SegmentedControl would have been a second costume for an identical
            interaction, which is exactly the drift these components exist to
            prevent. */}
        <ToggleSwitch
          value={room}
          onChange={(next) => setRoom(next as Room)}
          left={{ value: 'postseason', label: 'Postseason' }}
          right={{ value: 'awards', label: 'Annual Awards' }}
          ariaLabel="Postseason trophies or annual awards"
          knob={
            <TeamLogo
              team={{ assetName: overview.teamName, label: overview.teamName }}
              size="sm"
              variant="gold"
              className="h-[35px] w-[35px]"
            />
          }
        />
      </div>

      {history === undefined ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Opening the trophy room...</p>
      ) : room === 'postseason' ? (
        <PostseasonRoom
          trophiesBySeason={trophiesBySeason}
          seasonByYear={seasonByYear}
          seasonIdByYear={seasonIdByYear}
        />
      ) : (
        <AwardsRoom history={history} seasonIdByYear={seasonIdByYear} />
      )}
    </div>
  );
}

/* ── shared museum furniture ─────────────────────────────────────────────── */

/**
 * The display case: room, spotlight, lit floor, vignette, and a plinth that
 * holds whatever is being shown. Every hero on this page stands in one of these,
 * so the two rooms can't drift apart visually.
 */
function DisplayCase({
  children,
  sparks = false,
  photos,
}: {
  children: React.ReactNode;
  sparks?: boolean;
  photos?: string[];
}) {
  const lit = Boolean(photos && photos.length > 0);
  return (
    <div className="corner-cut trophy-room border border-white/10 px-6 py-10 md:px-10 md:py-14">
      {lit && <MediaBackdrop photos={photos!} />}
      {/*
        THE ROOM LIGHTS GO OUT WHEN THE WALL COMES ON (user direction). The
        spotlight and the floor pool exist to give an empty case something to be
        lit by; over a photograph they're just two grey washes fighting it for
        the same space. The trophy keeps ITS glow — that one is attached to the
        object rather than to the room — and the vignette stays, because it
        darkens rather than lights.
      */}
      {!lit && <span className="trophy-spotlight" aria-hidden="true" />}
      {!lit && <span className="trophy-floor" aria-hidden="true" />}
      {/* The drift of gold reserved for a NATIONAL title — the same field the box
          score flies behind a winning team's helmet, mirrored either side of the
          trophy. Reusing `.hero-sparks` rather than inventing a second particle
          system: fifty particles, two composited layers, zero DOM nodes each. */}
      {sparks && (
        <>
          <span className="trophy-sparks left-0" aria-hidden="true">
            <SparkColumn />
          </span>
          <span className="trophy-sparks right-0" data-side="right" aria-hidden="true">
            <SparkColumn />
          </span>
        </>
      )}
      <span className="trophy-vignette" aria-hidden="true" />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}


/**
 * Several copies of the box-score's spark field, stacked down the case.
 *
 * One field only fills the top of its own box, which is why the particles
 * bunched into the corners and stopped. Copies at uneven offsets with uneven
 * delays cover the full height — and because neither the spacing nor the timing
 * repeats, the seam between one copy and the next never becomes visible.
 */
function SparkColumn() {
  const layers = [
    { top: '-4%', delay: '0s' },
    { top: '18%', delay: '-4.5s' },
    { top: '37%', delay: '-9s' },
    { top: '58%', delay: '-13.5s' },
    { top: '76%', delay: '-6.5s' },
  ];
  return (
    <>
      {layers.map((layer) => (
        <span key={layer.top} className="hero-spark-field" style={{ top: layer.top, animationDelay: layer.delay }} />
      ))}
    </>
  );
}

/**
 * The lit object itself, with its own reflection beneath it.
 *
 * `key` is passed by callers so React REMOUNTS this on every selection change —
 * that is what replays the fade-and-settle. Reconciling in place would swap the
 * image instantly, and the swap is the one moment on this page worth animating.
 */
function Plinth({
  src,
  alt,
  locked = false,
  size = 'hero',
}: {
  src: string | null;
  alt: string;
  locked?: boolean;
  size?: 'hero' | 'shelf';
}) {
  const box = size === 'hero' ? 'h-72 md:h-[22.5rem]' : 'h-16';
  if (!src) {
    return (
      <div className={`flex ${box} items-end justify-center`}>
        <span className="font-display text-4xl text-white/15">—</span>
      </div>
    );
  }
  return (
    <div className="relative flex flex-col items-center">
      {/* The pool of light the piece stands in — behind the art, never on it. */}
      <span className="trophy-glow" data-size={size} data-locked={locked ? 'true' : undefined} aria-hidden="true" />
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`relative ${box} w-auto select-none object-contain ${locked ? 'trophy-locked' : ''}`}
        style={locked ? undefined : { filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.55))' }}
      />
      {/* The reflection is the same image again, flipped and masked away. */}
      {/* OUT OF THE FLOW, on purpose. The reflection used to sit below the
          trophy as a sibling, so a centred column centred the PAIR — which
          parks the object itself high by half the reflection, every time, and
          no amount of nudging padding fixes it because the offset scales with
          the art. Absolute, hung off the bottom edge: the column now centres
          the trophy and the reflection simply hangs beneath it. */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`trophy-reflection pointer-events-none absolute left-1/2 top-full -translate-x-1/2 ${
          size === 'hero' ? 'h-24 md:h-32' : 'h-5'
        } w-auto select-none object-contain ${locked ? 'trophy-locked' : ''}`}
      />
    </div>
  );
}

/** One selectable piece on the bottom shelf. */
function ShelfPiece({
  src,
  label,
  sublabel,
  selected,
  locked,
  onSelect,
}: {
  src: string | null;
  label: string;
  sublabel?: string;
  selected: boolean;
  locked?: boolean;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      <Plinth src={src} alt={label} size="shelf" locked={locked} />
      <p
        className={`mt-1 truncate text-center text-xs font-semibold ${
          locked ? 'text-white/25' : selected ? 'text-gold-300' : 'text-white/70'
        }`}
      >
        {label}
      </p>
      {sublabel && <p className="truncate text-center text-[10px] text-gold-300/60">{sublabel}</p>}
    </>
  );

  const shell = `trophy-plinth corner-cut-sm w-28 shrink-0 border px-2 pb-2 pt-3 ${
    selected ? 'border-gold-300/60 bg-gold-300/[0.07]' : 'border-white/10 hover:border-white/25'
  }`;

  if (!onSelect) {
    return (
      <div className={shell} aria-hidden={locked ? 'true' : undefined}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className={`${shell} text-left`}>
      {inner}
    </button>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-eyebrow mb-3 text-white/40">{title}</p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">{children}</div>
    </div>
  );
}

/** A labelled fact in the information column beside a hero. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-white/[0.07] py-2">
      <span className="type-eyebrow text-gold-300/60">{label}</span>
      <span className="tnum text-right text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

/**
 * The game a trophy was actually won in — opponent, score, and a way into the
 * box score.
 *
 * FETCHED FOR THE SELECTED TROPHY ONLY, not for all of them. The schedule is the
 * heaviest snapshot in the archive, and a cabinet of twelve championships would
 * otherwise read twelve of them to print one line. It also shares the Coach
 * hub's cache, so a season Overview or Season has already opened costs nothing.
 */
/**
 * Which game a trophy was won in.
 *
 * Shared by the information strip and the backdrop so they can never disagree
 * about it, and so the schedule — the heaviest snapshot in the archive — is read
 * once per season however many things need the answer.
 */
function useChampionshipGame(
  seasonId: number | undefined,
  kind: Champion['kind'],
  assetKey: string | null,
): ScheduleGame | null {
  const { dynastyId } = useCoachHubReady();
  const schedule = useCoachQuery<ScheduleOverview | null>(
    dynastyId && seasonId !== undefined ? `schedule:${dynastyId}:${seasonId}` : null,
    () => window.api.db.getSchedule(dynastyId, seasonId),
  );

  return useMemo(() => {
    const played = (schedule?.games ?? []).filter((g) => g.teamScore !== null && g.opponentScore !== null);
    if (kind === 'national') return played.find((g) => g.isNationalChampionship) ?? null;
    if (kind === 'conference') return played.find((g) => g.isConferenceChampionship) ?? null;
    /*
      MATCHED ON THE BOWL'S ASSET ID, not on its label. A bowl trophy's label is
      "<bowlName> Champions", so comparing it against the game's own `bowlName`
      never matched — every bowl trophy rendered without its game while the
      national championship, matched on a flag, worked.
    */
    if (assetKey) return played.find((g) => g.gameType === 'bowl' && g.bowlAssetName === assetKey) ?? null;
    return played.find((g) => g.gameType === 'bowl') ?? null;
  }, [schedule, kind, assetKey]);
}

function ChampionshipGame({
  seasonId,
  kind,
  assetKey,
  teamName,
}: {
  seasonId: number | undefined;
  kind: Champion['kind'];
  assetKey: string | null;
  teamName: string | null;
}) {
  const { dynastyId } = useCoachHubReady();
  const { openGameModal } = useGameModal();
  const game = useChampionshipGame(seasonId, kind, assetKey);

  if (!game) return null;


  /*
    The box score's own matchup shape, shrunk to fit: YOUR team on the left, the
    opponent on the right, the score between them.

    No heading above it. The trophy directly overhead already says which game
    this is, and printing "National Championship" over its own scoreline was the
    redundancy the user called out.
  */
  const mine = teamName ? getHelmetPath(teamName, 'left') : DEFAULT_HELMET_PATH.left;
  const theirs = getHelmetPath(game.opponent, 'right');

  return (
    <button
      type="button"
      onClick={() => openGameModal(dynastyId, game.gameId, seasonId)}
      title="Open the box score"
      className="mt-5 flex w-full items-center gap-4 border border-white/10 px-4 py-3 transition hover:border-gold-300/50 hover:bg-white/[0.03]"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <img src={mine} alt="" aria-hidden="true" draggable={false} className="h-[4.5rem] w-auto shrink-0 object-contain" />
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-semibold text-white">{teamName ?? 'Your team'}</span>
        </span>
      </span>

      <span className="shrink-0 text-center">
        <span className="tnum font-display text-2xl font-bold leading-none text-white">
          {game.teamScore}&thinsp;–&thinsp;{game.opponentScore}
        </span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-gold-300/60">Box score →</span>
      </span>

      <span className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <span className="min-w-0 text-right">
          <span className="block truncate text-sm font-semibold text-white">{game.opponent}</span>
        </span>
        <img src={theirs} alt="" aria-hidden="true" draggable={false} className="h-[4.5rem] w-auto shrink-0 object-contain" />
      </span>
    </button>

  );
}

/* ── ROOM 1 — POSTSEASON ─────────────────────────────────────────────────── */

type Champion = {
  key: string;
  seasonYear: number;
  kind: 'national' | 'conference' | 'bowl';
  label: string;
  image: string | null;
  /** The bowl's stable asset id — how a bowl trophy finds its own game. */
  assetKey: string | null;
};

function PostseasonRoom({
  trophiesBySeason,
  seasonByYear,
  seasonIdByYear,
}: {
  trophiesBySeason: Map<number, TeamTrophies>;
  seasonByYear: Map<number, ProgramHistorySeasonEntry>;
  seasonIdByYear: Map<number, number>;
}) {
  const champions = useMemo<Champion[]>(() => {
    const out: Champion[] = [];
    for (const [year, bundle] of [...trophiesBySeason.entries()].sort((a, b) => b[0] - a[0])) {
      for (const trophy of bundle.trophies) {
        if (trophy.kind === 'national-championship') {
          out.push({ key: `${year}-nc`, seasonYear: year, kind: 'national', label: 'National Championship', image: getTrophyImagePath(trophy), assetKey: null });
        } else if (trophy.kind === 'conference-championship') {
          out.push({
            key: `${year}-conf`,
            seasonYear: year,
            kind: 'conference',
            label: trophy.assetKey ? `${trophy.assetKey} Championship` : 'Conference Championship',
            image: trophy.assetKey ? getConferenceChampionshipTrophyPath(trophy.assetKey) : null,
            assetKey: trophy.assetKey,
          });
        } else if (trophy.kind === 'bowl-win') {
          out.push({ key: `${year}-bowl`, seasonYear: year, kind: 'bowl', label: trophy.label, image: getBowlTrophyPath(trophy.assetKey), assetKey: trophy.assetKey });
        }
      }
    }
    return out;
  }, [trophiesBySeason]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = champions.find((c) => c.key === selectedKey) ?? champions[0] ?? null;

  /*
    THE BACKDROP IS THE TROPHY'S OWN NIGHT (user direction 2026-08-03). A
    slideshow of the whole library behind a specific championship was atmosphere
    attached to nothing — these are the photographs tagged to the game that won
    THIS trophy, so changing the selection changes the room behind it.

    Keyed on the game, so a trophy with no photographs tagged to it falls back to
    the plain lit case rather than borrowing another game's night.
  */
  const selectedSeasonId = selected ? seasonIdByYear.get(selected.seasonYear) : undefined;
  const heroGame = useChampionshipGame(selectedSeasonId, selected?.kind ?? 'bowl', selected?.assetKey ?? null);
  const { dynastyId: roomDynastyId } = useCoachHubReady();
  const gameMedia = useCoachQuery<MediaItemResolved[]>(
    heroGame && selectedSeasonId !== undefined ? `media:game:${roomDynastyId}:${selectedSeasonId}:${heroGame.gameId}` : null,
    async () => (await window.api.media.listForGame(roomDynastyId, selectedSeasonId, heroGame!.gameId)) ?? [],
  );
  // The backdrop wants urls and the gallery wants the items themselves — both
  // off one request rather than two reads of the same photographs.
  const gamePhotos = useMemo(
    () => (gameMedia ?? []).map((item) => encodeURI(`file:///${item.absolutePath.replace(/\\/g, '/')}`)),
    [gameMedia],
  );

  if (champions.length === 0) {
    return (
      <DisplayCase>
        <div className="flex flex-col items-center">
          <Plinth src={getTrophyImagePath({ kind: 'national-championship', label: 'National Champions', assetKey: null })} alt="" locked />
          <p className="mt-8 text-center font-display text-2xl font-bold text-white/80">
            Your dynasty&apos;s first championship awaits.
          </p>
          <p className="mt-2 max-w-md text-center text-sm text-white/40">
            Win a bowl, a conference or the whole thing, and it will stand here — lit, and permanent.
          </p>
        </div>
      </DisplayCase>
    );
  }

  const season = selected ? seasonByYear.get(selected.seasonYear) : undefined;
  const nationals = champions.filter((c) => c.kind === 'national');
  const conferences = champions.filter((c) => c.kind === 'conference');
  const bowls = champions.filter((c) => c.kind === 'bowl');

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const wonSummary = [
    nationals.length > 0 ? plural(nationals.length, 'National Championship', 'National Championships') : null,
    conferences.length > 0 ? plural(conferences.length, 'Conference Championship', 'Conference Championships') : null,
    bowls.length > 0 ? plural(bowls.length, 'Bowl Win', 'Bowl Wins') : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <DisplayCase sparks={selected?.kind === 'national'} photos={gamePhotos}>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="flex items-center justify-center">
            {selected && <div key={selected.key} className="trophy-hero-in"><Plinth src={selected.image} alt={selected.label} /></div>}
          </div>

          {selected && (
            <div key={`${selected.key}-info`} className="trophy-hero-in">
              <p className="type-eyebrow text-gold-300/80">
                {selected.kind === 'national' ? 'National Champions' : selected.kind === 'conference' ? 'Conference Champions' : 'Bowl Champions'}
              </p>
              <h3 className="mt-2 font-display text-3xl font-bold leading-tight text-white">{selected.label}</h3>
              <p className="mt-1 text-lg font-semibold text-gold-300">{selected.seasonYear} Season</p>

              <div className="mt-6">
                {season && (
                  <div className="mb-3 flex items-center gap-2.5">
                    <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" className="!h-7 !w-7" />
                    <span className="text-sm font-semibold text-white">{season.teamName}</span>
                    <span className="tnum text-sm text-gold-300/75">
                      {season.wins}-{season.losses}
                    </span>
                  </div>
                )}
                {season?.headCoachName && <Line label="Coach" value={season.headCoachName} />}
                {season && season.mediaRank !== null && season.mediaRank > 0 && (
                  <Line label="Final ranking" value={`#${season.mediaRank}`} />
                )}
                {season?.conferenceChampionName && <Line label="Conference" value={season.conferenceChampionName} />}
                {season?.postseasonSummary && <Line label="Postseason" value={season.postseasonSummary} />}
              </div>

              <ChampionshipGame
                seasonId={seasonIdByYear.get(selected.seasonYear)}
                kind={selected.kind}
                assetKey={selected.assetKey}
                teamName={season?.teamName ?? null}
              />
            </div>
          )}
        </div>
      </DisplayCase>

      <div className="corner-cut trophy-room space-y-7 border border-white/10 p-6">
        <span className="trophy-vignette" aria-hidden="true" />
        <div className="relative z-[1] space-y-7">
          {nationals.length > 0 && (
            <Shelf title="National Championships">
              {nationals.map((c) => (
                <ShelfPiece
                  key={c.key}
                  src={c.image}
                  label={String(c.seasonYear)}
                  selected={selected?.key === c.key}
                  onSelect={() => setSelectedKey(c.key)}
                />
              ))}
            </Shelf>
          )}

          {conferences.length > 0 && (
            <Shelf title="Conference Championships">
              {conferences.map((c) => (
                <ShelfPiece
                  key={c.key}
                  src={c.image}
                  label={String(c.seasonYear)}
                  sublabel={c.label.replace(' Championship', '')}
                  selected={selected?.key === c.key}
                  onSelect={() => setSelectedKey(c.key)}
                />
              ))}
            </Shelf>
          )}

          {bowls.length > 0 && (
            <Shelf title="Bowl Victories">
              {bowls.map((c) => (
                <ShelfPiece
                  key={c.key}
                  src={c.image}
                  label={String(c.seasonYear)}
                  sublabel={c.label}
                  selected={selected?.key === c.key}
                  onSelect={() => setSelectedKey(c.key)}
                />
              ))}
            </Shelf>
          )}

          {/* WHAT WAS WON, and nothing else. This read "2 national · 2
              conference · 0 bowl wins across 3 tracked seasons" — reporting a
              zero and a denominator, which turns a trophy cabinet into a
              scorecard of what's missing. A count of nothing is not an
              achievement, so it simply isn't a line. */}
          {wonSummary.length > 0 && <p className="text-xs text-gold-300/45">{wonSummary.join(' · ')}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── ROOM 2 — ANNUAL AWARDS ──────────────────────────────────────────────── */

/**
 * The winner beside the trophy — the real portrait, in his jersey, and a name
 * that opens him.
 *
 * The program's award HISTORY carries a name and nothing else. The season's own
 * award payload carries the portrait asset, the position, the school and the
 * player id, so this fetches THAT season's awards — for the selected award only,
 * through the shared cache — and matches on award type. One request to turn a
 * string into a person, rather than an N-season sweep to decorate a line.
 *
 * It degrades honestly: no match, and the initials box the app already uses
 * stands in, with the name simply not clickable.
 */
function AwardWinner({
  awardType,
  playerName,
  seasonYear,
  seasonId,
}: {
  awardType: string;
  playerName: string;
  seasonYear: number;
  seasonId: number | undefined;
}) {
  const { dynastyId } = useCoachHubReady();
  const { openPlayerModal } = usePlayerModal();
  const awards = useCoachQuery<AwardsOverview | null>(
    dynastyId && seasonId !== undefined ? `awards:${dynastyId}:${seasonId}` : null,
    () => window.api.db.getAwards(dynastyId, seasonId),
  );

  const match = useMemo(() => {
    if (!awards) return null;
    if (awardType === 'HEISMAN') {
      const h = awards.heismanWinner;
      return h
        ? { playerId: h.playerId, portraitAssetName: h.portraitAssetName, position: h.position, team: h.teamDisplayName }
        : null;
    }
    const found = awards.leagueAwards?.find((a) => a.awardType === awardType);
    return found
      ? { playerId: found.playerId, portraitAssetName: found.portraitAssetName, position: found.position, team: found.teamDisplayName }
      : null;
  }, [awards, awardType]);

  const first = playerName.split(' ')[0] ?? '';
  const last = playerName.split(' ').slice(1).join(' ');
  const canOpen = match?.playerId != null;

  return (
    <div className="mt-6 flex items-center gap-3">
      <PlayerPortrait
        player={{ firstName: first, lastName: last, portraitAssetName: match?.portraitAssetName ?? null }}
        teamAssetName={match?.team ?? undefined}
        size="md"
      />
      <div className="min-w-0">
        {canOpen ? (
          <button
            type="button"
            onClick={() => openPlayerModal(dynastyId, match!.playerId!)}
            className="truncate font-display text-xl font-bold text-white underline-offset-4 transition hover:text-gold-300 hover:underline"
          >
            {playerName}
          </button>
        ) : (
          <p className="truncate font-display text-xl font-bold text-white">{playerName}</p>
        )}
        <p className="text-sm text-gold-300/75">
          {match?.position ? `${match.position} · ` : ''}
          {match?.team ? `${match.team} · ` : ''}
          {seasonYear}
        </p>
      </div>
    </div>
  );
}

function AwardsRoom({
  history,
  seasonIdByYear,
}: {
  history: ProgramHistoryOverview | null;
  seasonIdByYear: Map<number, number>;
}) {
  // One entry per award TYPE, holding every winner of it — so a programme with
  // four Heismans gets one trophy you can cycle through, not four trophies.
  const byType = useMemo(() => {
    const map = new Map<string, { seasonYear: number; playerName: string }[]>();
    for (const a of history?.nationalAwards ?? []) {
      const list = map.get(a.awardType) ?? [];
      list.push({ seasonYear: a.seasonYear, playerName: a.playerName });
      map.set(a.awardType, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.seasonYear - a.seasonYear);
    return map;
  }, [history]);

  // Only what has been won. The "Still to win" shelf that used to follow this
  // was the same checklist instinct as the locked trophy placeholders, and it
  // went for the same reason: this is a room about what happened.
  const wonTypes = ALL_AWARD_TYPES.filter((t) => byType.has(t));

  const { dynastyId: awardsDynastyId } = useCoachHubReady();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const activeType = selectedType && byType.has(selectedType) ? selectedType : (wonTypes[0] ?? null);
  const winners = activeType ? (byType.get(activeType) ?? []) : [];
  const [winnerIndex, setWinnerIndex] = useState(0);
  const winner = winners[Math.min(winnerIndex, Math.max(0, winners.length - 1))] ?? null;

  /*
    THE WINNER'S OWN PHOTOGRAPHS behind the award, on exactly the terms the
    trophy room uses — same grade, same jumbotron grid, same drift, same
    "no photographs means the plain lit case" fallback.

    NOT tied to a game, unlike the postseason room: an award is a season, not
    a night, so anything tagged to that player anywhere belongs behind it. The
    season's award payload is what turns a winner's NAME into a player id, and
    it is the same cached request the winner panel below already makes.
  */
  const activeSeasonId = winner ? seasonIdByYear.get(winner.seasonYear) : undefined;
  const seasonAwards = useCoachQuery<AwardsOverview | null>(
    awardsDynastyId && activeSeasonId !== undefined ? `awards:${awardsDynastyId}:${activeSeasonId}` : null,
    () => window.api.db.getAwards(awardsDynastyId, activeSeasonId),
  );
  const winnerPlayerId = useMemo(() => {
    if (!seasonAwards || !activeType) return null;
    if (activeType === 'HEISMAN') return seasonAwards.heismanWinner?.playerId ?? null;
    return seasonAwards.leagueAwards?.find((a) => a.awardType === activeType)?.playerId ?? null;
  }, [seasonAwards, activeType]);
  const winnerMedia = useCoachQuery<MediaItemResolved[]>(
    winnerPlayerId !== null ? `media:player:${awardsDynastyId}:${winnerPlayerId}` : null,
    async () => (await window.api.media.listForPlayer(awardsDynastyId, winnerPlayerId!)) ?? [],
  );
  const winnerPhotos = useMemo(
    () => (winnerMedia ?? []).map((item) => encodeURI(`file:///${item.absolutePath.replace(/\\/g, "/")}`)),
    [winnerMedia],
  );

  if (wonTypes.length === 0) {
    return (
      <DisplayCase>
        <div className="flex flex-col items-center">
          <Plinth src={getAwardTrophyPath('HEISMAN')} alt="" locked />
          <p className="mt-8 text-center font-display text-2xl font-bold text-white/80">
            No player has been honoured yet.
          </p>
          <p className="mt-2 max-w-md text-center text-sm text-white/40">
            Every national award one of your players wins is preserved here, with the season they won it.
          </p>
        </div>
      </DisplayCase>
    );
  }

  return (
    <div className="space-y-6">
      <DisplayCase photos={winnerPhotos}>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="flex items-center justify-center">
            {activeType && (
              <div key={`${activeType}-${winner?.seasonYear}`} className="trophy-hero-in">
                <Plinth src={getAwardTrophyPath(activeType)} alt={formatAwardLabel(activeType)} />
              </div>
            )}
          </div>

          {activeType && winner && (
            <div key={`${activeType}-${winner.seasonYear}-info`} className="trophy-hero-in">
              <p className="type-eyebrow text-gold-300/80">Annual Award</p>
              <h3 className="mt-2 font-display text-3xl font-bold leading-tight text-white">
                {formatAwardLabel(activeType)}
              </h3>
              <p className="mt-1 text-lg font-semibold text-gold-300">{winner.seasonYear} Season</p>

              <AwardWinner
                awardType={activeType}
                playerName={winner.playerName}
                seasonYear={winner.seasonYear}
                seasonId={seasonIdByYear.get(winner.seasonYear)}
              />

              {winners.length > 1 && (
                <div className="mt-6">
                  <p className="type-eyebrow mb-2 text-gold-300/60">
                    Won {winners.length} times — every winner
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {winners.map((w, i) => (
                      <button
                        key={`${w.seasonYear}-${w.playerName}`}
                        type="button"
                        onClick={() => setWinnerIndex(i)}
                        className={`corner-cut-sm border px-2.5 py-1 text-xs font-semibold transition ${
                          i === winnerIndex
                            ? 'border-gold-300/60 bg-gold-300/10 text-gold-300'
                            : 'border-white/12 text-white/60 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {w.seasonYear}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DisplayCase>

      <div className="corner-cut trophy-room space-y-7 border border-white/10 p-6">
        <span className="trophy-vignette" aria-hidden="true" />
        <div className="relative z-[1] space-y-7">
          <Shelf title="Awards won">
            {wonTypes.map((type) => (
              <ShelfPiece
                key={type}
                src={getAwardTrophyPath(type)}
                label={formatAwardLabel(type)}
                sublabel={`${byType.get(type)!.length}×`}
                selected={activeType === type}
                onSelect={() => {
                  setSelectedType(type);
                  setWinnerIndex(0);
                }}
              />
            ))}
          </Shelf>

        </div>
      </div>
    </div>
  );
}
