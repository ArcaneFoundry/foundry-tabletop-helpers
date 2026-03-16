export interface MonsterPreviewAvailabilityState {
  isNPCTurn: boolean;
  persistBetweenTurns: boolean;
  pinned: boolean;
  hasCachedContent: boolean;
  dismissed: boolean;
}

export function shouldKeepMonsterPreviewVisible(state: MonsterPreviewAvailabilityState): boolean {
  if (state.isNPCTurn) return true;
  if (!state.persistBetweenTurns && !state.pinned) return false;
  if (!state.hasCachedContent) return false;
  return !state.dismissed;
}
