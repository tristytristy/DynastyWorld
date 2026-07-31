import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { canonicalKey } from '../lib/assetMapping';
import { programArtUrl, setProgramArtRegistry, type ProgramArtRegistry } from '../lib/programArt';
import { useStadiumData } from './StadiumDataProvider';
import type { ProgramOverride } from '../../shared/types';
import type { StadiumInfo } from '../lib/stadiumData';

interface ProgramArtContextValue {
  /** Every override in the open dynasty, newest state. */
  overrides: ProgramOverride[];
  /** Bumped whenever the registry changes — what makes art components redraw. */
  version: number;
  /** The stadium name/city a user has set for a team, or null to use the built-in reference data. */
  stadiumOverrideFor: (teamName: string | null | undefined) => { name: string | null; city: string | null } | null;
  /** Folds a saved row back in and republishes the registry. Called by the Program editor. */
  applyOverride: (row: ProgramOverride) => void;
  reload: () => void;
}

const ProgramArtContext = createContext<ProgramArtContextValue | null>(null);

/** Builds what `programArt.ts` reads: canonical team key → the uploaded URLs it has. */
function toRegistry(rows: ProgramOverride[]): ProgramArtRegistry {
  const registry: ProgramArtRegistry = {};
  for (const row of rows) {
    const entry: ProgramArtRegistry[string] = {};
    if (row.art.logo?.path) entry.logo = programArtUrl(row.art.logo.path, row.updatedAt);
    if (row.art.helmet?.path) entry.helmet = programArtUrl(row.art.helmet.path, row.updatedAt);
    if (row.art.jersey?.path) entry.jersey = programArtUrl(row.art.jersey.path, row.updatedAt);
    if (row.art.polo?.path) entry.polo = programArtUrl(row.art.polo.path, row.updatedAt);
    if (Object.keys(entry).length > 0) registry[row.teamNameKey] = entry;
  }
  return registry;
}

/**
 * Loads the open dynasty's program overrides and puts them in front of the
 * shipped asset library.
 *
 * THE REGISTRY IS THE POINT, not this context. Team art resolves through four
 * pure functions called from a dozen components, so the overrides have to be
 * readable without hooks — `setProgramArtRegistry` is what actually makes an
 * uploaded logo appear on a masthead, a matchup graphic, a roster portrait and a
 * trading card at once. What the context adds is a VERSION: a plain module
 * variable can't tell React that a logo changed, so components that draw team
 * art subscribe to this and redraw when it bumps.
 *
 * SCOPED TO ONE DYNASTY AT A TIME. The registry is cleared and rebuilt whenever
 * the route's dynasty changes, which is what lets it be keyed by team NAME
 * safely: two saves can each have their own "Montana" and neither leaks into the
 * other, because only one save's rows are ever loaded.
 */
export function ProgramArtProvider({ children }: { children: ReactNode }) {
  /*
    MATCHED, not `useParams`. This provider has to sit ABOVE <Routes>, because
    the global modal hosts — the game box score especially — render outside the
    dynasty route while still showing a team's venue and artwork. Mounted inside
    the route, `useProgramStadium` fell through to its inert fallback there and
    a user-defined stadium came back blank in Game Info while working fine on
    the Schedule page behind it. `useMatch` reads the same id without needing to
    be a descendant of the route that declares it.
  */
  // Both matched unconditionally — `a ?? b` would skip the second hook whenever
  // the first matched, which is exactly the conditional-hook rule violation.
  const nested = useMatch('/dynasty/:id/*');
  const bare = useMatch('/dynasty/:id');
  const dynastyId = nested?.params.id ?? bare?.params.id;
  const [overrides, setOverrides] = useState<ProgramOverride[]>([]);
  const [version, setVersion] = useState(0);

  const publish = useCallback((rows: ProgramOverride[]) => {
    setProgramArtRegistry(toRegistry(rows));
    setOverrides(rows);
    setVersion((v) => v + 1);
  }, []);

  const reload = useCallback(() => {
    if (!dynastyId) {
      publish([]);
      return;
    }
    void window.api.program.list(dynastyId).then(publish);
  }, [dynastyId, publish]);

  useEffect(() => {
    // Clear first: until the new dynasty's rows arrive, the previous one's
    // uploads must not be drawn on this one's teams.
    setProgramArtRegistry({});
    setOverrides([]);
    setVersion((v) => v + 1);
    if (!dynastyId) return;
    let cancelled = false;
    void window.api.program.list(dynastyId).then((rows) => {
      if (!cancelled) publish(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, publish]);

  const applyOverride = useCallback(
    (row: ProgramOverride) => {
      publish([...overrides.filter((o) => o.teamIndex !== row.teamIndex), row]);
    },
    [overrides, publish],
  );

  const stadiumOverrideFor = useCallback(
    (teamName: string | null | undefined) => {
      if (!teamName) return null;
      const key = canonicalKey(teamName);
      const row = overrides.find((o) => o.teamNameKey === key);
      if (!row || (!row.stadiumName && !row.stadiumCity)) return null;
      return { name: row.stadiumName, city: row.stadiumCity };
    },
    [overrides],
  );

  const value = useMemo<ProgramArtContextValue>(
    () => ({ overrides, version, stadiumOverrideFor, applyOverride, reload }),
    [overrides, version, stadiumOverrideFor, applyOverride, reload],
  );

  return <ProgramArtContext.Provider value={value}>{children}</ProgramArtContext.Provider>;
}

/**
 * Subscribes a component to program-art changes.
 *
 * Safe to call outside the provider (returns an inert value) because team art is
 * drawn on surfaces that live above the dynasty route too — the dashboard's
 * dynasty cards, for one — and a hook that threw there would make TeamLogo
 * unusable outside a dynasty.
 */
export function useProgramArt(): ProgramArtContextValue {
  return (
    useContext(ProgramArtContext) ?? {
      overrides: [],
      version: 0,
      stadiumOverrideFor: () => null,
      applyOverride: () => undefined,
      reload: () => undefined,
    }
  );
}

/**
 * `getStadium`, with the user's own program on top.
 *
 * Everything that shows a venue — the Schedule page's Location column, a game's
 * info header — already resolves through a `getStadium(teamName)` callback, so
 * layering here means the Program editor's stadium fields reach both surfaces
 * without either of them learning that program overrides exist.
 *
 * A PARTIAL override is merged, not substituted: setting only the stadium name
 * keeps the built-in city, because "I renamed the field" and "I moved the
 * program" are different edits and the user only made one of them.
 */
export function useProgramStadium(): (teamName: string) => StadiumInfo | null {
  const { getStadium } = useStadiumData();
  const { stadiumOverrideFor } = useProgramArt();
  return useCallback(
    (teamName: string) => {
      const base = getStadium(teamName);
      const override = stadiumOverrideFor(teamName);
      if (!override) return base;
      return {
        team: base?.team ?? teamName,
        stadium: override.name ?? base?.stadium ?? '',
        city: override.city ?? base?.city ?? '',
        state: base?.state ?? '',
      };
    },
    [getStadium, stadiumOverrideFor],
  );
}
