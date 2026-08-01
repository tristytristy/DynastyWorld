/**
 * Everywhere a keyboard shortcut can take you.
 *
 * Deliberately ships with NO keys assigned. Which destinations deserve a
 * shortcut depends entirely on how someone plays — a recruiting-heavy dynasty
 * wants the board on a key, a stats reader wants Statistics — and guessing
 * would both be wrong for most people and quietly occupy combinations they'd
 * rather spend themselves. The catalogue is the offer; the binding is theirs.
 *
 * Grouped to mirror the app's own two-level scope nav (Coach / Team / NCAA /
 * Recruit / Media), so the list reads like the thing it navigates.
 */
export interface ShortcutTarget {
  id: string;
  label: string;
  group: string;
  /**
   * Path within a dynasty, or an absolute path when `dynastyScoped` is false.
   * Dynasty-scoped targets need a dynasty open; the binding simply does nothing
   * on the dashboard rather than guessing which dynasty was meant.
   */
  path: string;
  dynastyScoped: boolean;
}

export const SHORTCUT_TARGETS: ShortcutTarget[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'App', path: '/', dynastyScoped: false },

  { id: 'coach-hub', label: 'Coach Hub', group: 'Coach', path: '', dynastyScoped: true },

  { id: 'team-overview', label: 'Overview', group: 'Team', path: 'team-hub', dynastyScoped: true },
  { id: 'team-roster', label: 'Roster', group: 'Team', path: 'roster', dynastyScoped: true },
  { id: 'team-transfers', label: 'Transfers', group: 'Team', path: 'transfers', dynastyScoped: true },
  { id: 'team-schedule', label: 'Schedule', group: 'Team', path: 'schedule', dynastyScoped: true },
  { id: 'team-rivalries', label: 'Rivalries', group: 'Team', path: 'rivalries', dynastyScoped: true },
  { id: 'team-statistics', label: 'Statistics', group: 'Team', path: 'statistics', dynastyScoped: true },
  { id: 'team-trends', label: 'Analytics', group: 'Team', path: 'trends', dynastyScoped: true },
  { id: 'team-awards', label: 'Season Awards', group: 'Team', path: 'team-awards', dynastyScoped: true },
  { id: 'team-weekly-honors', label: 'Weekly Honors', group: 'Team', path: 'weekly-honors', dynastyScoped: true },
  { id: 'team-history', label: 'History', group: 'Team', path: 'history', dynastyScoped: true },

  { id: 'ncaa-hub', label: 'Overview', group: 'NCAA', path: 'ncaa-hub', dynastyScoped: true },
  { id: 'ncaa-scores', label: 'Scores', group: 'NCAA', path: 'scores', dynastyScoped: true },
  { id: 'ncaa-stats', label: 'National Statistics', group: 'NCAA', path: 'national-stats', dynastyScoped: true },
  { id: 'ncaa-players', label: 'National Players', group: 'NCAA', path: 'players', dynastyScoped: true },
  { id: 'ncaa-standings', label: 'Standings', group: 'NCAA', path: 'standings', dynastyScoped: true },
  { id: 'ncaa-annual-awards', label: 'Annual Awards', group: 'NCAA', path: 'annual-awards', dynastyScoped: true },
  { id: 'ncaa-all-america', label: 'All-America & All-Conf', group: 'NCAA', path: 'all-america', dynastyScoped: true },
  { id: 'ncaa-records', label: 'Record Book', group: 'NCAA', path: 'ncaa-records', dynastyScoped: true },

  { id: 'recruit-board', label: 'My Board', group: 'Recruiting', path: 'recruiting', dynastyScoped: true },
  { id: 'recruit-national', label: 'National Recruits', group: 'Recruiting', path: 'recruits', dynastyScoped: true },
  { id: 'recruit-watchlist', label: 'Watchlist', group: 'Recruiting', path: 'watchlist', dynastyScoped: true },

  { id: 'media', label: 'Media Hub', group: 'Media', path: 'media', dynastyScoped: true },
];

/** Catalogue order, but grouped — what the editor renders. */
export function shortcutTargetsByGroup(): { group: string; targets: ShortcutTarget[] }[] {
  const groups: { group: string; targets: ShortcutTarget[] }[] = [];
  for (const target of SHORTCUT_TARGETS) {
    const existing = groups.find((g) => g.group === target.group);
    if (existing) existing.targets.push(target);
    else groups.push({ group: target.group, targets: [target] });
  }
  return groups;
}

/** The route a target resolves to, or null when it needs a dynasty and none is open. */
export function resolveTargetPath(target: ShortcutTarget, dynastyId: string | null): string | null {
  if (!target.dynastyScoped) return target.path;
  if (!dynastyId) return null;
  return target.path ? `/dynasty/${dynastyId}/${target.path}` : `/dynasty/${dynastyId}`;
}
