import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlayerEditorTab } from '../components/common/PlayerEditorModal';

interface PlayerEditorState {
  dynastyId: string;
  playerId: number;
  playerLabel: string;
  onSaved?: () => void;
  /** Which tab the editor opens on — defaults to 'profile'. Used to jump straight to the Portrait tab from contexts (like the recruit profile modal) that only care about the photo. */
  initialTab?: PlayerEditorTab;
  /**
   * True when this player is also an active recruit — the editor additionally
   * fetches and shows a "Recruiting Info" tab (hometown, star rating, class,
   * ranks) and saves it together with the regular player fields on one Save
   * click. Recruits are `Player` rows, so every other tab (Profile, Ratings,
   * Portrait, etc.) already works identically whether or not this is set;
   * this only controls whether the recruiting-specific tab appears.
   */
  isRecruit?: boolean;
}

interface CoachEditorState {
  dynastyId: string;
  teamIndex: number;
  position: string;
  coachLabel: string;
  onSaved?: () => void;
}

interface EditorModalContextValue {
  playerState: PlayerEditorState | null;
  coachState: CoachEditorState | null;
  openPlayerEditor: (state: PlayerEditorState) => void;
  openCoachEditor: (state: CoachEditorState) => void;
  closeEditor: () => void;
}

const EditorModalContext = createContext<EditorModalContextValue | null>(null);

/**
 * Holds editor-modal state only — same split as PlayerModalProvider/
 * PlayerProfileModal. The actual modal (EditorModalHost) must be mounted
 * once at the app root, outside <main>'s clip-path (see app.tsx): a
 * `position: fixed` element nested inside an ancestor with a `clip-path` is
 * positioned relative to that ancestor instead of the viewport per the CSS
 * spec, not the true viewport — confirmed via a real screenshot where an
 * earlier, page-local version of this modal rendered thousands of pixels
 * off-screen instead of centered.
 *
 * Recruit editing used to be a fully separate third state/modal here
 * (RecruitEditorState/openRecruitEditor) — removed in favor of folding it
 * into PlayerEditorState.isRecruit, since a recruit editor and a player
 * editor were two entry points editing overlapping/adjacent data on the same
 * underlying `Player` record, which read as genuinely redundant rather than
 * two different concerns.
 */
export function EditorModalProvider({ children }: { children: ReactNode }) {
  const [playerState, setPlayerState] = useState<PlayerEditorState | null>(null);
  const [coachState, setCoachState] = useState<CoachEditorState | null>(null);

  const openPlayerEditor = useCallback((state: PlayerEditorState) => {
    setCoachState(null);
    setPlayerState(state);
  }, []);

  const openCoachEditor = useCallback((state: CoachEditorState) => {
    setPlayerState(null);
    setCoachState(state);
  }, []);

  const closeEditor = useCallback(() => {
    setPlayerState(null);
    setCoachState(null);
  }, []);

  const value = useMemo<EditorModalContextValue>(
    () => ({ playerState, coachState, openPlayerEditor, openCoachEditor, closeEditor }),
    [playerState, coachState, openPlayerEditor, openCoachEditor, closeEditor],
  );

  return <EditorModalContext.Provider value={value}>{children}</EditorModalContext.Provider>;
}

export function useEditorModal(): EditorModalContextValue {
  const ctx = useContext(EditorModalContext);
  if (!ctx) {
    throw new Error('useEditorModal must be used within an EditorModalProvider.');
  }
  return ctx;
}
