import type { PersistentSoundscapeLibrarySnapshot, ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";
import { getStoredSoundscapeLibrarySnapshot, resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  getSoundscapeAmbienceRuntimeSnapshot,
  playStoredSoundscapeMoment,
  stopStoredSoundscapeAmbience,
  syncStoredSoundscapeAmbience,
} from "./soundscape-ambience-controller";
import type {
  SoundscapeAmbienceRuntimeSnapshot,
  SoundscapeMomentPlaybackResult,
} from "./soundscape-ambience-runtime";
import {
  getSoundscapeMusicRuntimeSnapshot,
  stopStoredSoundscapeMusic,
  syncStoredSoundscapeMusic,
} from "./soundscape-music-controller";
import type { SoundscapeMusicRuntimeSnapshot } from "./soundscape-music-runtime";
import { openSoundscapeLiveControls } from "./soundscape-live-controls-app";
import { openSoundscapeStudio } from "./soundscape-studio-app";

export interface FthSoundscapeDebugApi {
  getLibrary: () => PersistentSoundscapeLibrarySnapshot | null;
  resolve: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => ResolvedSoundscapeState | null;
  openStudio: () => void;
  openLiveControls: () => void;
  syncMusic: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => Promise<SoundscapeMusicRuntimeSnapshot>;
  stopMusic: () => Promise<void>;
  getMusicState: () => SoundscapeMusicRuntimeSnapshot;
  syncAmbience: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => Promise<SoundscapeAmbienceRuntimeSnapshot>;
  stopAmbience: () => Promise<void>;
  getAmbienceState: () => SoundscapeAmbienceRuntimeSnapshot;
  playMoment: (momentId: string, sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => Promise<SoundscapeMomentPlaybackResult>;
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
      openLiveControls: () => openSoundscapeLiveControls(),
      syncMusic: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => syncStoredSoundscapeMusic(sceneId, context),
      stopMusic: () => stopStoredSoundscapeMusic(),
      getMusicState: () => getSoundscapeMusicRuntimeSnapshot(),
      syncAmbience: (sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => syncStoredSoundscapeAmbience(sceneId, context),
      stopAmbience: () => stopStoredSoundscapeAmbience(),
      getAmbienceState: () => getSoundscapeAmbienceRuntimeSnapshot(),
      playMoment: (momentId: string, sceneId?: string, context?: Partial<SoundscapeTriggerContext>) => playStoredSoundscapeMoment(momentId, sceneId, context),
    },
  };
}
