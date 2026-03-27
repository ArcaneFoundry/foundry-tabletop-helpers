import type { PersistentSoundscapeLibrarySnapshot, ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";
import { getStoredSoundscapeLibrarySnapshot, resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  getSoundscapeMusicRuntimeSnapshot,
  stopStoredSoundscapeMusic,
  syncStoredSoundscapeMusic,
} from "./soundscape-music-controller";
import type { SoundscapeMusicRuntimeSnapshot } from "./soundscape-music-runtime";
import { openSoundscapeStudio } from "./soundscape-studio-app";

export interface FthSoundscapeDebugApi {
  getLibrary: () => PersistentSoundscapeLibrarySnapshot | null;
  resolve: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => ResolvedSoundscapeState | null;
  openStudio: () => void;
  syncMusic: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => Promise<SoundscapeMusicRuntimeSnapshot>;
  stopMusic: () => Promise<void>;
  getMusicState: () => SoundscapeMusicRuntimeSnapshot;
}

export interface FthSoundscapeApi {
  soundscapes: FthSoundscapeDebugApi;
}

export function buildSoundscapeApi(): FthSoundscapeApi {
  return {
    soundscapes: {
      getLibrary: () => getStoredSoundscapeLibrarySnapshot(),
      resolve: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => resolveStoredSoundscapeState(sceneId, context),
      openStudio: () => openSoundscapeStudio(),
      syncMusic: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => syncStoredSoundscapeMusic(sceneId, context),
      stopMusic: () => stopStoredSoundscapeMusic(),
      getMusicState: () => getSoundscapeMusicRuntimeSnapshot(),
    },
  };
}
