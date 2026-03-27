import { getHooks } from "../types";
import { resolveStoredSoundscapeState } from "./soundscape-accessors";
import {
  SoundscapeMusicRuntime,
  type SoundscapeMusicRuntimeSnapshot,
} from "./soundscape-music-runtime";
import type { ResolvedSoundscapeState, SoundscapeTriggerContext } from "./soundscape-types";

interface PlaylistSoundUpdateLike {
  id: string;
  playing?: boolean;
  parent?: {
    id?: string;
    uuid?: string;
  } | null;
}

class SoundscapeMusicController {
  private readonly runtime: SoundscapeMusicRuntime;
  private hooksRegistered = false;

  constructor(runtime = new SoundscapeMusicRuntime()) {
    this.runtime = runtime;
  }

  async syncResolvedState(state: ResolvedSoundscapeState | null): Promise<SoundscapeMusicRuntimeSnapshot> {
    this.ensureHooksRegistered();
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

  handlePlaylistSoundUpdate(sound: PlaylistSoundUpdateLike, changed: Record<string, unknown> | null | undefined): void {
    const playingChanged = typeof changed?.playing === "boolean" ? changed.playing : undefined;
    const isNowStopped = playingChanged === false || (playingChanged === undefined && sound.playing === false);
    if (!isNowStopped) return;
    this.runtime.handleTrackEnded({
      playlistUuid: sound.parent?.uuid ?? null,
      playlistId: sound.parent?.id ?? null,
      soundId: sound.id,
    });
  }

  private ensureHooksRegistered(): void {
    if (this.hooksRegistered) return;
    getHooks()?.on?.("updatePlaylistSound", (sound: PlaylistSoundUpdateLike, changed: Record<string, unknown>) => {
      this.handlePlaylistSoundUpdate(sound, changed);
    });
    this.hooksRegistered = true;
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
