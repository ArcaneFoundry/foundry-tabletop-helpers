import { resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  SoundscapeMusicRuntime,
  type SoundscapeMusicRuntimeSnapshot,
} from "./soundscape-music-runtime";
import type { ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";

class SoundscapeMusicController {
  private readonly runtime: SoundscapeMusicRuntime;

  constructor(runtime = new SoundscapeMusicRuntime()) {
    this.runtime = runtime;
  }

  async syncResolvedState(state: ResolvedSoundscapeState | null): Promise<SoundscapeMusicRuntimeSnapshot> {
    return await this.runtime.sync(state);
  }

  async syncStoredState(
    sceneId?: string,
    context?: Partial<SoundscapeTriggerContext>,
  ): Promise<SoundscapeMusicRuntimeSnapshot> {
    return await this.syncResolvedState(resolveStoredSoundscapeState(sceneId, context));
  }

  async stop(): Promise<void> {
    await this.runtime.stop();
  }

  getSnapshot(): SoundscapeMusicRuntimeSnapshot {
    return this.runtime.getSnapshot();
  }
}

const singletonController = new SoundscapeMusicController();

export async function syncResolvedSoundscapeMusic(
  state: ResolvedSoundscapeState | null,
): Promise<SoundscapeMusicRuntimeSnapshot> {
  return await singletonController.syncResolvedState(state);
}

export async function syncStoredSoundscapeMusic(
  sceneId?: string,
  context?: Partial<SoundscapeTriggerContext>,
): Promise<SoundscapeMusicRuntimeSnapshot> {
  return await singletonController.syncStoredState(sceneId, context);
}

export async function stopStoredSoundscapeMusic(): Promise<void> {
  await singletonController.stop();
}

export function getSoundscapeMusicRuntimeSnapshot(): SoundscapeMusicRuntimeSnapshot {
  return singletonController.getSnapshot();
}

export const __soundscapeMusicControllerInternals = {
  singletonController,
};
