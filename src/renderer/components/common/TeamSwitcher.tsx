import { useEffect, useMemo } from 'react';
import { TeamLogo } from './TeamLogo';
import { Select, type SelectOption } from '../ui/Select';
import { useViewedTeam } from '../../data/ViewedTeamProvider';

/**
 * The team dropdown shared by the team-scoped pages (Team Hub / Roster /
 * Schedule / Statistics / History) — "My Team" plus every team in this
 * season's league snapshot, with the active team's logo beside it. Hidden
 * entirely when the season has no league snapshot (synced before the league
 * browse feature) so pages just behave as before.
 *
 * **Shift + ← / →** steps through the same list and wraps at both ends. The
 * shortcut is bound HERE rather than in the provider deliberately: it should
 * only exist where a switcher is actually on screen, and this component's own
 * mounting is the most honest signal for that — no page list to keep in sync.
 */
export function TeamSwitcher({ userTeamName: userTeamNameProp }: { userTeamName?: string | null } = {}) {
  const { viewedTeamIndex, setViewedTeamIndex, leagueTeams, userTeamName: contextTeamName } = useViewedTeam();

  const userTeamName = userTeamNameProp ?? contextTeamName;
  // The user's team is the '' option below, carrying full data — so its
  // league-snapshot twin is skipped rather than listed twice.
  const otherTeams = useMemo(
    () => (leagueTeams ?? []).filter((t) => t.displayName !== userTeamName),
    [leagueTeams, userTeamName],
  );

  useEffect(() => {
    if (otherTeams.length === 0) return undefined;
    // Exactly the dropdown's order, user's team first, so cycling and reading
    // the list agree — the shortcut lands where the eye expects.
    const order: (number | null)[] = [null, ...otherTeams.map((t) => t.teamIndex)];

    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

      // Never steal the keystroke from a text field or from an open overlay.
      // Modals portal to <body>, so they are NOT ancestors of this component and
      // a focus/containment check wouldn't see them — but every overlay in the
      // app carries role="dialog", which is a reliable "something is on top".
      // Without this, Shift+Arrow would quietly change the team on the page
      // behind an open player card.
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? '')) return;
      if (document.querySelector('[role="dialog"]')) return;
      // An OPEN dropdown owns the arrow keys — including this one's own panel,
      // where Shift+Arrow would otherwise change the team behind the list you're
      // reading. The tag-name check above can't see it: the trigger is a button
      // and the panel is portalled to <body>.
      if (document.querySelector('[role="listbox"]')) return;

      event.preventDefault();
      const current = order.indexOf(viewedTeamIndex);
      const from = current === -1 ? 0 : current;
      // (i ± 1 + n) % n — wraps at both ends, so the list is a loop in either
      // direction rather than stopping at the last team.
      const next = (from + (event.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length;
      setViewedTeamIndex(order[next]);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [otherTeams, viewedTeamIndex, setViewedTeamIndex]);

  if (!leagueTeams || leagueTeams.length === 0) return null;

  // Every school carries its own mark — the list is 130+ teams long, and a name
  // alone makes it a reading exercise. `sm` (32px) is the app's smallest logo
  // step; the panel only mounts these while open, so the whole league's art is
  // never loading behind a closed dropdown.
  const options: SelectOption<string>[] = [
    {
      value: '',
      label: userTeamName ?? 'My Team',
      icon: <TeamLogo team={{ assetName: userTeamName ?? '', label: userTeamName ?? 'My Team' }} size="sm" className="shrink-0" />,
    },
    ...otherTeams.map((t) => ({
      value: String(t.teamIndex),
      label: t.displayName,
      icon: <TeamLogo team={{ assetName: t.displayName, label: t.displayName }} size="sm" className="shrink-0" />,
    })),
  ];

  return (
    <Select
      value={viewedTeamIndex === null ? '' : String(viewedTeamIndex)}
      onChange={(next) => setViewedTeamIndex(next === '' ? null : Number(next))}
      options={options}
      ariaLabel="Viewed team"
      // Typing beats scrolling at this length — searching is on for the same
      // reason the list has logos.
      searchable
      searchPlaceholder="Find a team…"
    />
  );
}
