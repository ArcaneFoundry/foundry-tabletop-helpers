import { resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  SoundscapeAmbienceRuntime,
  type SoundscapeAmbienceRuntimeSnapshot,
  type SoundscapeMomentPlaybackResult,
} from "./soundscape-ambience-runtime";
import type { ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";

class SoundscapeAmbienceController {
  private readonly runtime: SoundscapeAmbienceRuntime;
  private lastResolvedState: ResolvedSoundscapeState | null = null;

  constructor(runtime = new SoundscapeAmbienceRuntime()) {
    this.runtime = runtime;
  }

  async syncResolvedState(state: ResolvedSoundscapeState | null): Promise<SoundscapeAmbienceRuntimeSnapshot> {
    this.lastResolvedState = state;
    return await this.runtime.sync(state);
  }

  async syncStoredState(
    sceneId?: string,
    context?: Partial<SoundscapeTriggerContext>,
  ): Promise<SoundscapeAmbienceRuntimeSnapshot> {
    return await this.syncResolvedState(resolveStoredSoundscapeState(sceneId, context));
  }

  async stop(): Promise<void> {
    this.lastResolvedState = null;
    await this.runtime.stop();
  }

  getSnapshot(): SoundscapeAmbienceRuntimeSnapshot {
    return this.runtime.getSnapshot();
  }

  async playMoment(
    momentId: string,
    sceneId?: string,
    context?: Partial<SoundscapeTriggerContext>,
  ): Promise<SoundscapeMomentPlaybackResult> {
    const nextState = sceneId !== undefined || context !== undefined
      ? resolveStoredSoundscapeState(sceneId, context)
      : (this.lastResolvedState ?? resolveStoredSoundscapeState());
    this.lastResolvedState = nextState;
    return await this.runtime.playMomentFromState(nextState, momentId);
  }
}

const singletonController = new SoundscapeAmbienceController();

export async function syncResolvedSoundscapeAmbience(
  state: ResolvedSoundscapeState | null,
): Promise<SoundscapeAmbienceRuntimeSnapshot> {
  return await singletonController.syncResolvedState(state);
}

export async function syncStoredSoundscapeAmbience(
  sceneId?: string,
  context?: Partial<SoundscapeTriggerContext>,
): Promise<SoundscapeAmbienceRuntimeSnapshot> {
  return await singletonController.syncStoredState(sceneId, context);
}

export async function stopStoredSoundscapeAmbience(): Promise<void> {
  await singletonController.stop();
}

export function getSoundscapeAmbienceRuntimeSnapshot(): SoundscapeAmbienceRuntimeSnapshot {
  return singletonController.getSnapshot();
}

export async function playStoredSoundscapeMoment(
  momentId: string,
  sceneId?: string,
  context?: Partial<SoundscapeTriggerContext>,
): Promise<SoundscapeMomentPlaybackResult> {
  return await singletonController.playMoment(momentId, sceneId, context);
}

export const __soundscapeAmbienceControllerInternals = {
  singletonController,
};
