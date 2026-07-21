import { useEditorModal } from '../../data/EditorModalProvider';
import { PlayerEditorModal } from './PlayerEditorModal';
import { CoachEditorModal } from './CoachEditorModal';
import { TeamBudgetModal } from './TeamBudgetModal';

/** Mounted once at the app root (see app.tsx) — same reasoning as PlayerProfileModal. */
export function EditorModalHost() {
  const { playerState, coachState, teamBudgetState, closeEditor } = useEditorModal();

  if (playerState) {
    return (
      <PlayerEditorModal
        dynastyId={playerState.dynastyId}
        playerId={playerState.playerId}
        playerLabel={playerState.playerLabel}
        onClose={closeEditor}
        onSaved={playerState.onSaved}
        initialTab={playerState.initialTab}
        isRecruit={playerState.isRecruit}
      />
    );
  }

  if (coachState) {
    return (
      <CoachEditorModal
        dynastyId={coachState.dynastyId}
        teamIndex={coachState.teamIndex}
        position={coachState.position}
        coachLabel={coachState.coachLabel}
        onClose={closeEditor}
        onSaved={coachState.onSaved}
      />
    );
  }

  if (teamBudgetState) {
    return (
      <TeamBudgetModal
        dynastyId={teamBudgetState.dynastyId}
        teamIndex={teamBudgetState.teamIndex}
        teamLabel={teamBudgetState.teamLabel}
        onClose={closeEditor}
        onSaved={teamBudgetState.onSaved}
      />
    );
  }

  return null;
}
