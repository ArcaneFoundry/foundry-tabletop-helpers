import type { PersistentSoundscapeLibrarySnapshot, ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";
import { getStoredSoundscapeLibrarySnapshot, resolveStoredSoundscapeState } from "./soundscape-accessors";

export interface FthSoundscapeDebugApi {
  getLibrary: () => PersistentSoundscapeLibrarySnapshot | null;
  resolve: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => ResolvedSoundscapeState | null;
}

export interface FthSoundscapeApi {
  soundscapes: FthSoundscapeDebugApi;
}

export function buildSoundscapeApi(): FthSoundscapeApi {
  return {
    soundscapes: {
      getLibrary: () => getStoredSoundscapeLibrarySnapshot(),
      resolve: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => resolveStoredSoundscapeState(sceneId, context),
    },
  };
}
