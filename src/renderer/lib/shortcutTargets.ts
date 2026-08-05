/**
 * Everywhere a keyboard shortcut can take you, and everything one can do.
 *
 * DESTINATIONS SHIP WITH NO KEY. Which page deserves a shortcut depends
 * entirely on how someone plays — a recruiting-heavy dynasty wants the board on
 * a key, a stats reader wants Statistics — and guessing would both be wrong for
 * most people and quietly occupy combinations they'd rather spend themselves.
 * The catalogue is the offer; the binding is theirs.
 *
 * ACTIONS ARE DIFFERENT, and one of them ships bound (user direction). Dark ⇄
 * light isn't a destination someone might prefer; it's the same single switch
 * for everyone, it's reached often, and it has no wrong answer to guess at — so
 * it arrives on Ctrl+Shift+Z rather than sitting unbound behind a panel most
 * people never open. `defaultCombo` is a DEFAULT and not a fixture: the row is
 * rebindable and clearable like any other, and a user who wants those keys back
 * takes them.
 *
 * Grouped to mirror the app's own two-level scope nav (Coach / Team / NCAA /
 * Recruit / Media), so the list reads like the thing it navigates.
 */

/** Things a shortcut can do in place, rather than navigate to. */
export type ShortcutAction = 'toggle-appearance';

interface ShortcutTargetBase {
  id: string;
  label: string;
  group: string;
  /**
   * What this target is bound to out of the box. Absent means unbound, which is
   * every destination. A user binding, or an explicit clear, always wins over
   * this — see shortcutPrefs.effectiveCombo.
   */
  defaultCombo?: string;
}

export interface ShortcutNavTarget extends ShortcutTargetBase {
  kind: 'navigate';
  /**
   * Path within a dynasty, or an absolute path when `dynastyScoped` is false.
   * Dynasty-scoped targets need a dynasty open; the binding simply does nothing
   * on the dashboard rather than guessing which dynasty was meant.
   */
  path: string;
  dynastyScoped: boolean;
}

export interface ShortcutActionTarget extends ShortcutTargetBase {
  kind: 'action';
  action: ShortcutAction;
  /** One line under the label — an action's effect isn't self-evident from a page name. */
  hint: string;
}

export type ShortcutTarget = ShortcutNavTarget | ShortcutActionTarget;

export const SHORTCUT_TARGETS: ShortcutTarget[] = [
  {
    id: 'toggle-appearance',
    label: 'Dark / light mode',
    group: 'App',
    kind: 'action',
    action: 'toggle-appearance',
    hint: 'Flips the app between its dark and light appearance.',
    defaultCombo: 'Ctrl+Shift+Z',
  },
  { id: 'dashboard', label: 'Dashboard', group: 'App', kind: 'navigate', path: '/', dynastyScoped: false },

  { id: 'coach-hub', label: 'Overview', group: 'Coach', kind: 'navigate', path: '', dynastyScoped: true },
  { id: 'coach-season', label: 'Season', group: 'Coach', kind: 'navigate', path: 'coach/season', dynastyScoped: true },
  { id: 'coach-career', label: 'Career', group: 'Coach', kind: 'navigate', path: 'coach/career', dynastyScoped: true },
  { id: 'coach-staff', label: 'Staff', group: 'Coach', kind: 'navigate', path: 'coach/staff', dynastyScoped: true },
  { id: 'coach-legacy', label: 'Milestones', group: 'Coach', kind: 'navigate', path: 'coach/milestones', dynastyScoped: true },
  { id: 'coach-trophy-room', label: 'Trophy Room', group: 'Coach', kind: 'navigate', path: 'coach/trophy-room', dynastyScoped: true },
  { id: 'coach-hall', label: 'Hall of Champions', group: 'Coach', kind: 'navigate', path: 'hall', dynastyScoped: true },

  { id: 'team-overview', label: 'Overview', group: 'Team', kind: 'navigate', path: 'team-hub', dynastyScoped: true },
  { id: 'team-roster', label: 'Roster', group: 'Team', kind: 'navigate', path: 'roster', dynastyScoped: true },
  { id: 'team-transfers', label: 'Transfers', group: 'Team', kind: 'navigate', path: 'transfers', dynastyScoped: true },
  { id: 'team-schedule', label: 'Schedule', group: 'Team', kind: 'navigate', path: 'schedule', dynastyScoped: true },
  { id: 'team-rivalries', label: 'Rivalries', group: 'Team', kind: 'navigate', path: 'rivalries', dynastyScoped: true },
  { id: 'team-statistics', label: 'Statistics', group: 'Team', kind: 'navigate', path: 'statistics', dynastyScoped: true },
  { id: 'team-trends', label: 'Analytics', group: 'Team', kind: 'navigate', path: 'trends', dynastyScoped: true },
  { id: 'team-awards', label: 'Season Awards', group: 'Team', kind: 'navigate', path: 'team-awards', dynastyScoped: true },
  { id: 'team-weekly-honors', label: 'Weekly Honors', group: 'Team', kind: 'navigate', path: 'weekly-honors', dynastyScoped: true },
  { id: 'team-history', label: 'History', group: 'Team', kind: 'navigate', path: 'history', dynastyScoped: true },

  { id: 'ncaa-hub', label: 'Overview', group: 'NCAA', kind: 'navigate', path: 'ncaa-hub', dynastyScoped: true },
  { id: 'ncaa-scores', label: 'Scores', group: 'NCAA', kind: 'navigate', path: 'scores', dynastyScoped: true },
  { id: 'ncaa-stats', label: 'National Statistics', group: 'NCAA', kind: 'navigate', path: 'national-stats', dynastyScoped: true },
  { id: 'ncaa-players', label: 'National Players', group: 'NCAA', kind: 'navigate', path: 'players', dynastyScoped: true },
  { id: 'ncaa-standings', label: 'Standings', group: 'NCAA', kind: 'navigate', path: 'standings', dynastyScoped: true },
  { id: 'ncaa-annual-awards', label: 'Annual Awards', group: 'NCAA', kind: 'navigate', path: 'annual-awards', dynastyScoped: true },
  { id: 'ncaa-all-america', label: 'All-America & All-Conf', group: 'NCAA', kind: 'navigate', path: 'all-america', dynastyScoped: true },
  { id: 'ncaa-records', label: 'Record Book', group: 'NCAA', kind: 'navigate', path: 'ncaa-records', dynastyScoped: true },

  { id: 'recruit-board', label: 'My Board', group: 'Recruiting', kind: 'navigate', path: 'recruiting', dynastyScoped: true },
  { id: 'recruit-national', label: 'National Recruits', group: 'Recruiting', kind: 'navigate', path: 'recruits', dynastyScoped: true },
  { id: 'recruit-watchlist', label: 'Watchlist', group: 'Recruiting', kind: 'navigate', path: 'watchlist', dynastyScoped: true },

  { id: 'media', label: 'Media Hub', group: 'Media', kind: 'navigate', path: 'media', dynastyScoped: true },
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
export function resolveTargetPath(target: ShortcutNavTarget, dynastyId: string | null): string | null {
  if (!target.dynastyScoped) return target.path;
  if (!dynastyId) return null;
  return target.path ? `/dynasty/${dynastyId}/${target.path}` : `/dynasty/${dynastyId}`;
}
