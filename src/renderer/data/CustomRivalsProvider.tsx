import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { programArtUrl } from '../lib/programArt';
import { setCustomRivalryRegistry, setLeagueRivalryRegistry, type CustomRivalryEntry } from '../lib/rivalryAssetMapping';
import type { CustomRival } from '../../shared/types';

interface CustomRivalsContextValue {
  /** Every user-declared rivalry in the open dynasty. */
  rivals: CustomRival[];
  /** Bumped whenever the registry changes — what makes a schedule redraw after an edit. */
  version: number;
  /** The user's rivalries involving one team, either side of the matchup. */
  rivalsFor: (teamNameKey: string) => CustomRival[];
  /** Folds a saved row back in and republishes. Called by the Program editor. */
  applyRival: (row: CustomRival) => void;
  /** Drops a row after a delete and republishes. */
  removeRival: (pairKey: string) => void;
  reload: () => void;
}

const CustomRivalsContext = createContext<CustomRivalsContextValue | null>(null);

/** Builds what `rivalryAssetMapping` reads: pair key → the name and mark to use. */
function toRegistry(rows: CustomRival[]): Record<string, CustomRivalryEntry> {
  const registry: Record<string, CustomRivalryEntry> = {};
  for (const row of rows) {
    registry[row.pairKey] = {
      name: row.rivalryName,
      // Reuses the program-art URL builder rather than growing a second one: it
      // does the same two jobs — file:// for an absolute path, and a version
      // bust so REPLACING a logo (deterministic filename, identical URL)
      // actually redraws instead of showing the old image from cache.
      logo: row.logo?.path ? programArtUrl(row.logo.path, row.updatedAt) : null,
    };
  }
  return registry;
}

/**
 * Loads the open dynasty's user-declared rivalries and puts them in front of
 * the shipped pairing list.
 *
 * THE REGISTRY IS THE POINT, not this context — the same argument as
 * ProgramArtProvider. Rivalry art resolves through `getRivalryLogoPath`, a pure
 * function called from the Schedule table, the Scores list, the Game Info
 * header and the Media page's game grouping. Publishing into the module means a
 * rivalry someone declares appears on all four without any of them learning
 * that custom rivalries exist. What the context adds is a VERSION, because a
 * plain module variable cannot tell React that something changed.
 *
 * SCOPED TO ONE DYNASTY AT A TIME, which is what makes a name-derived pair key
 * safe: only one save's rows are ever loaded, so two dynasties can each declare
 * their own rivalry for the same two names without either reaching the other.
 */
export function CustomRivalsProvider({ children }: { children: ReactNode }) {
  /*
    MATCHED, not `useParams` — this sits ABOVE <Routes> for the same reason
    ProgramArtProvider does: the Game Info modal renders outside the dynasty
    route while still drawing a rivalry mark, and a provider mounted inside the
    route would fall through to its inert fallback exactly there.
  */
  const nested = useMatch('/dynasty/:id/*');
  const bare = useMatch('/dynasty/:id');
  const dynastyId = nested?.params.id ?? bare?.params.id;
  const [rivals, setRivals] = useState<CustomRival[]>([]);
  const [version, setVersion] = useState(0);

  const publish = useCallback((rows: CustomRival[]) => {
    setCustomRivalryRegistry(toRegistry(rows));
    setRivals(rows);
    setVersion((v) => v + 1);
  }, []);

  const reload = useCallback(() => {
    if (!dynastyId) {
      publish([]);
      return;
    }
    void window.api.rivals.list(dynastyId).then(publish);
  }, [dynastyId, publish]);

  useEffect(() => {
    // Clear first: until the new dynasty's rows arrive, the previous one's
    // rivalries must not be drawn on this one's schedule.
    setCustomRivalryRegistry({});
    setRivals([]);
    setVersion((v) => v + 1);
    if (!dynastyId) return;
    let cancelled = false;
    void window.api.rivals.list(dynastyId).then((rows) => {
      if (!cancelled) publish(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, publish]);

  /*
    THE SAVE'S OWN RIVALRIES, alongside the user's — loaded here rather than in a
    provider of its own because it feeds the same module registry, for the same
    pure resolver, on the same dynasty lifecycle. A second provider would have
    been a second copy of all of this to keep in step.

    Cleared on a dynasty change for exactly the reason the block above is: the
    previous save's 272 pairings must not light up rivalries on this one's
    schedule while the new list is in flight. Season-independent on purpose —
    rivalries are a property of the programs, not of the year being viewed, so
    the current season's list serves every season's schedule.
  */
  useEffect(() => {
    setLeagueRivalryRegistry([]);
    setVersion((v) => v + 1);
    if (!dynastyId) return;
    let cancelled = false;
    void window.api.db.getLeagueRivalries(dynastyId).then((rows) => {
      if (cancelled || !rows?.length) return;
      setLeagueRivalryRegistry(rows);
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId]);

  const applyRival = useCallback(
    (row: CustomRival) => {
      publish([...rivals.filter((r) => r.pairKey !== row.pairKey), row].sort((a, b) =>
        a.rivalryName.localeCompare(b.rivalryName),
      ));
    },
    [rivals, publish],
  );

  const removeRival = useCallback(
    (pairKey: string) => publish(rivals.filter((r) => r.pairKey !== pairKey)),
    [rivals, publish],
  );

  // EITHER SIDE of the matchup, because the rivalry belongs to both teams: the
  // row UCLA created names Oregon as the opponent, and Oregon's own Rivalries
  // page has to find it under `opponentNameKey` rather than under its own.
  const rivalsFor = useCallback(
    (teamNameKey: string) =>
      rivals.filter((r) => r.teamNameKey === teamNameKey || r.opponentNameKey === teamNameKey),
    [rivals],
  );

  const value = useMemo<CustomRivalsContextValue>(
    () => ({ rivals, version, rivalsFor, applyRival, removeRival, reload }),
    [rivals, version, rivalsFor, applyRival, removeRival, reload],
  );

  return <CustomRivalsContext.Provider value={value}>{children}</CustomRivalsContext.Provider>;
}

/**
 * Subscribes a component to custom-rivalry changes.
 *
 * Safe to call outside the provider (returns an inert value), because rivalry
 * marks are drawn on surfaces that can render above the dynasty route.
 */
export function useCustomRivals(): CustomRivalsContextValue {
  return (
    useContext(CustomRivalsContext) ?? {
      rivals: [],
      version: 0,
      rivalsFor: () => [],
      applyRival: () => undefined,
      removeRival: () => undefined,
      reload: () => undefined,
    }
  );
}
