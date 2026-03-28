import { resolveAudioPathPlayback, type SoundscapeAudioHandle } from "./soundscape-audio-playback";
import type {
  ResolvedSoundscapeState,
  SoundscapeAmbienceLayer,
  SoundscapeSoundMoment,
} from "./soundscape-types";

interface TimerApi {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface RuntimeDeps {
  resolveAudioPath?: (path: string) => Promise<SoundscapeAudioHandle | null>;
  timers?: TimerApi;
  random?: () => number;
}

interface ActiveLoopSound {
  audioPath: string;
  handle: SoundscapeAudioHandle;
}

interface ActiveRandomSound {
  audioPath: string;
  handle: SoundscapeAudioHandle;
  cleanupTimer: unknown | null;
}

interface LoopLayerRuntimeState {
  type: "loop";
  layer: SoundscapeAmbienceLayer;
  fingerprint: string;
  generation: number;
  loopSounds: Map<string, ActiveLoopSound>;
  pendingAudioPaths: Set<string>;
}

interface RandomLayerRuntimeState {
  type: "random";
  layer: SoundscapeAmbienceLayer;
  fingerprint: string;
  scheduleTimer: unknown | null;
  activeSound: ActiveRandomSound | null;
  lastPlayedAudioPath: string | null;
  pendingStartAudioPath: string | null;
  generation: number;
}

type ActiveLayerRuntimeState = LoopLayerRuntimeState | RandomLayerRuntimeState;

const DEFAULT_TIMERS: TimerApi = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface SoundscapeAmbienceRuntimeSnapshot {
  activeAmbienceKey: string | null;
  activeLayerIds: string[];
  loopAudioPaths: string[];
  randomLayerIds: string[];
  activeRandomAudioPaths: string[];
  pendingRandomLayerIds: string[];
  lastError: string | null;
}

export interface SoundscapeMomentPlaybackResult {
  momentId: string;
  audioPath: string | null;
  played: boolean;
  error: string | null;
}

function createAmbienceKey(profileId: string, layerIds: string[]): string {
  return `${profileId}:${[...layerIds].sort().join("|")}`;
}

function createLayerFingerprint(layer: SoundscapeAmbienceLayer): string {
  return [
    layer.mode,
    layer.minDelaySeconds,
    layer.maxDelaySeconds,
    ...layer.audioPaths,
  ].join("|");
}

function randomDelayMs(layer: SoundscapeAmbienceLayer, random: () => number): number {
  const minMs = Math.max(0, layer.minDelaySeconds * 1000);
  const maxMs = Math.max(minMs, layer.maxDelaySeconds * 1000);
  if (maxMs <= minMs) return minMs;
  return Math.round(minMs + ((maxMs - minMs) * random()));
}

function pickRandomIndex(random: () => number, length: number, lastIndex: number): number {
  const rawIndex = Math.floor(random() * length);
  if (length > 1 && rawIndex === lastIndex) return (rawIndex + 1) % length;
  return rawIndex;
}

export class SoundscapeAmbienceRuntime {
  private readonly deps: Required<RuntimeDeps>;
  private readonly activeLayers = new Map<string, ActiveLayerRuntimeState>();
  private readonly activeAmbienceOwners = new Map<string, string>();
  private readonly lastRandomMomentIndexByMoment = new Map<string, number>();
  private activeAmbienceKey: string | null = null;
  private lastError: string | null = null;

  constructor(deps: RuntimeDeps = {}) {
    this.deps = {
      resolveAudioPath: deps.resolveAudioPath ?? resolveAudioPathPlayback,
      timers: deps.timers ?? DEFAULT_TIMERS,
      random: deps.random ?? Math.random,
    };
  }

  getSnapshot(): SoundscapeAmbienceRuntimeSnapshot {
    const activeLayerIds = [...this.activeLayers.keys()].sort();
    const loopAudioPaths = [...this.activeAmbienceOwners.entries()]
      .filter(([audioPath, layerId]) => {
        void audioPath;
        const state = this.activeLayers.get(layerId);
        return state?.type === "loop";
      })
      .map(([audioPath]) => audioPath)
      .sort();
    const randomLayerIds = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .map((state) => state.layer.id)
      .sort();
    const activeRandomAudioPaths = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .flatMap((state) => state.activeSound ? [state.activeSound.audioPath] : [])
      .sort();
    const pendingRandomLayerIds = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .flatMap((state) => state.scheduleTimer ? [state.layer.id] : [])
      .sort();

    return {
      activeAmbienceKey: this.activeAmbienceKey,
      activeLayerIds,
      loopAudioPaths,
      randomLayerIds,
      activeRandomAudioPaths,
      pendingRandomLayerIds,
      lastError: this.lastError,
    };
  }

  async sync(state: ResolvedSoundscapeState | null): Promise<SoundscapeAmbienceRuntimeSnapshot> {
    const nextLayers = state?.ambienceLayers ?? [];
    if (!state || nextLayers.length === 0) {
      await this.stop();
      return this.getSnapshot();
    }

    const nextLayerIds = new Set(nextLayers.map((layer) => layer.id));
    for (const [layerId, activeState] of [...this.activeLayers.entries()]) {
      const nextLayer = nextLayers.find((layer) => layer.id === layerId);
      if (!nextLayer || createLayerFingerprint(nextLayer) !== activeState.fingerprint) {
        await this.teardownLayer(layerId, activeState);
      }
    }

    for (const layer of nextLayers) {
      const activeState = this.activeLayers.get(layer.id);
      if (!activeState && layer.mode === "loop") {
        const loopState: LoopLayerRuntimeState = {
          type: "loop",
          layer,
          fingerprint: createLayerFingerprint(layer),
          generation: 0,
          loopSounds: new Map(),
          pendingAudioPaths: new Set(),
        };
        this.activeLayers.set(layer.id, loopState);
      } else if (!activeState) {
        const randomState: RandomLayerRuntimeState = {
          type: "random",
          layer,
          fingerprint: createLayerFingerprint(layer),
          scheduleTimer: null,
          activeSound: null,
          lastPlayedAudioPath: null,
          pendingStartAudioPath: null,
          generation: 0,
        };
        this.activeLayers.set(layer.id, randomState);
      }

      const nextState = this.activeLayers.get(layer.id);
      if (!nextState) continue;
      if (nextState.type === "loop") {
        await this.startLoopLayer(nextState);
      } else {
        nextState.layer = layer;
        nextState.fingerprint = createLayerFingerprint(layer);
        this.scheduleRandomLayer(nextState);
      }
    }

    for (const layerId of [...this.activeLayers.keys()]) {
      if (!nextLayerIds.has(layerId)) {
        const activeState = this.activeLayers.get(layerId);
        if (activeState) await this.teardownLayer(layerId, activeState);
      }
    }

    this.activeAmbienceKey = createAmbienceKey(state.profileId, nextLayers.map((layer) => layer.id));
    return this.getSnapshot();
  }

  async stop(): Promise<void> {
    for (const [layerId, activeState] of [...this.activeLayers.entries()]) {
      await this.teardownLayer(layerId, activeState);
    }
    this.activeAmbienceKey = null;
    this.lastError = null;
  }

  async playMoment(moment: SoundscapeSoundMoment | null | undefined): Promise<SoundscapeMomentPlaybackResult> {
    if (!moment) {
      return {
        momentId: "",
        audioPath: null,
        played: false,
        error: "No sound moment is available to play.",
      };
    }

    const selected = this.selectMomentAudioPath(moment);
    if (!selected) {
      return {
        momentId: moment.id,
        audioPath: null,
        played: false,
        error: `Sound moment "${moment.name}" has no playable sounds.`,
      };
    }

    const handle = await this.deps.resolveAudioPath(selected);
    if (!handle) {
      return {
        momentId: moment.id,
        audioPath: selected,
        played: false,
        error: `Sound moment "${moment.name}" could not resolve audio path "${selected}".`,
      };
    }

    const started = await this.startSoundPlayback(handle, false);
    if (!started) {
      return {
        momentId: moment.id,
        audioPath: selected,
        played: false,
        error: `Sound moment "${moment.name}" could not start playback.`,
      };
    }

    return {
      momentId: moment.id,
      audioPath: selected,
      played: true,
      error: null,
    };
  }

  async playMomentFromState(
    state: ResolvedSoundscapeState | null,
    momentId: string,
  ): Promise<SoundscapeMomentPlaybackResult> {
    if (!state) {
      return {
        momentId,
        audioPath: null,
        played: false,
        error: "No active soundscape state is available.",
      };
    }

    const moment = state.soundMoments.find((entry) => entry.id === momentId);
    if (!moment) {
      return {
        momentId,
        audioPath: null,
        played: false,
        error: `Sound moment "${momentId}" is not available in the active soundscape.`,
      };
    }

    return await this.playMoment(moment);
  }

  private async startLoopLayer(state: LoopLayerRuntimeState): Promise<void> {
    const generation = state.generation;
    for (const audioPath of state.layer.audioPaths) {
      if (state.loopSounds.has(audioPath) || state.pendingAudioPaths.has(audioPath)) continue;

      state.pendingAudioPaths.add(audioPath);
      if (!this.claimAmbienceOwner(audioPath, state.layer.id)) {
        state.pendingAudioPaths.delete(audioPath);
        continue;
      }

      const handle = await this.deps.resolveAudioPath(audioPath);
      if (!handle) {
        this.releaseAmbienceOwner(audioPath, state.layer.id);
        state.pendingAudioPaths.delete(audioPath);
        this.lastError = `Ambience layer "${state.layer.name}" could not resolve audio path "${audioPath}".`;
        continue;
      }

      if (!this.isCurrentLoopLayer(state.layer.id, generation) || this.activeAmbienceOwners.get(audioPath) !== state.layer.id) {
        this.releaseAmbienceOwner(audioPath, state.layer.id);
        state.pendingAudioPaths.delete(audioPath);
        continue;
      }

      const started = await this.startSoundPlayback(handle, true);
      if (!started || !this.isCurrentLoopLayer(state.layer.id, generation) || this.activeAmbienceOwners.get(audioPath) !== state.layer.id) {
        this.releaseAmbienceOwner(audioPath, state.layer.id);
        state.pendingAudioPaths.delete(audioPath);
        if (started) await this.stopSoundPlayback(handle);
        this.lastError = `Ambience layer "${state.layer.name}" could not start loop "${audioPath}".`;
        continue;
      }

      const currentState = this.activeLayers.get(state.layer.id);
      if (!currentState || currentState.type !== "loop" || currentState.generation !== generation) {
        this.releaseAmbienceOwner(audioPath, state.layer.id);
        state.pendingAudioPaths.delete(audioPath);
        await this.stopSoundPlayback(handle);
        continue;
      }

      currentState.loopSounds.set(audioPath, { audioPath, handle });
      currentState.pendingAudioPaths.delete(audioPath);
    }
  }

  private scheduleRandomLayer(state: RandomLayerRuntimeState, explicitDelayMs?: number): void {
    if (state.scheduleTimer || state.activeSound || state.pendingStartAudioPath || !this.activeLayers.has(state.layer.id)) return;

    const delayMs = explicitDelayMs ?? randomDelayMs(state.layer, this.deps.random);
    const generation = state.generation;
    state.scheduleTimer = this.deps.timers.setTimeout(() => {
      state.scheduleTimer = null;
      void this.handleRandomLayerTimer(state.layer.id, generation);
    }, delayMs);
  }

  private async handleRandomLayerTimer(layerId: string, generation: number): Promise<void> {
    const state = this.activeLayers.get(layerId);
    if (!state || state.type !== "random" || state.generation !== generation || state.activeSound) return;

    const selectedAudioPath = this.selectRandomLayerAudioPath(state);
    if (!selectedAudioPath) {
      this.scheduleRandomLayer(state, Math.max(0, state.layer.minDelaySeconds * 1000));
      return;
    }
    if (!this.claimAmbienceOwner(selectedAudioPath, state.layer.id)) {
      this.scheduleRandomLayer(state, Math.max(0, state.layer.minDelaySeconds * 1000));
      return;
    }
    state.pendingStartAudioPath = selectedAudioPath;

    const handle = await this.deps.resolveAudioPath(selectedAudioPath);
    if (!handle) {
      this.releaseAmbienceOwner(selectedAudioPath, state.layer.id);
      state.pendingStartAudioPath = null;
      this.lastError = `Ambience layer "${state.layer.name}" could not resolve audio path "${selectedAudioPath}".`;
      this.scheduleRandomLayer(state);
      return;
    }

    if (!this.isCurrentRandomLayer(layerId, generation) || this.activeAmbienceOwners.get(selectedAudioPath) !== state.layer.id) {
      this.releaseAmbienceOwner(selectedAudioPath, state.layer.id);
      state.pendingStartAudioPath = null;
      return;
    }

    const started = await this.startSoundPlayback(handle, false);
    if (!started || !this.isCurrentRandomLayer(layerId, generation) || this.activeAmbienceOwners.get(selectedAudioPath) !== state.layer.id) {
      this.releaseAmbienceOwner(selectedAudioPath, state.layer.id);
      state.pendingStartAudioPath = null;
      if (started) await this.stopSoundPlayback(handle);
      this.lastError = `Ambience layer "${state.layer.name}" could not start "${selectedAudioPath}".`;
      const currentState = this.activeLayers.get(layerId);
      if (currentState && currentState.type === "random" && currentState.generation === generation) {
        this.scheduleRandomLayer(currentState);
      }
      return;
    }

    const currentState = this.activeLayers.get(layerId);
    if (!currentState || currentState.type !== "random" || currentState.generation !== generation) {
      this.releaseAmbienceOwner(selectedAudioPath, state.layer.id);
      state.pendingStartAudioPath = null;
      await this.stopSoundPlayback(handle);
      return;
    }

    currentState.lastPlayedAudioPath = selectedAudioPath;
    currentState.pendingStartAudioPath = null;

    const durationMs = Math.max(0, Math.round(handle.durationSeconds * 1000));
    const cleanupTimer = this.deps.timers.setTimeout(() => {
      void this.finishRandomLayerSound(layerId, generation, selectedAudioPath);
    }, durationMs);

    currentState.activeSound = {
      audioPath: selectedAudioPath,
      handle,
      cleanupTimer,
    };
  }

  private async finishRandomLayerSound(layerId: string, generation: number, audioPath: string): Promise<void> {
    const state = this.activeLayers.get(layerId);
    if (!state || state.type !== "random" || state.generation !== generation) return;
    if (!state.activeSound || state.activeSound.audioPath !== audioPath) return;

    if (state.activeSound.cleanupTimer !== null) {
      this.deps.timers.clearTimeout(state.activeSound.cleanupTimer);
    }

    this.activeAmbienceOwners.delete(audioPath);
    state.activeSound = null;
    this.scheduleRandomLayer(state);
  }

  private selectRandomLayerAudioPath(state: RandomLayerRuntimeState): string | null {
    const candidates = state.layer.audioPaths.filter((audioPath) => !this.activeAmbienceOwners.has(audioPath));
    if (candidates.length === 0) return null;

    const lastIndex = state.lastPlayedAudioPath ? candidates.indexOf(state.lastPlayedAudioPath) : -1;
    return candidates[pickRandomIndex(this.deps.random, candidates.length, lastIndex)] ?? null;
  }

  private selectMomentAudioPath(moment: SoundscapeSoundMoment): string | null {
    if (moment.audioPaths.length === 0) return null;
    if (moment.selectionMode === "single") return moment.audioPaths[0] ?? null;

    const lastIndex = this.lastRandomMomentIndexByMoment.get(moment.id) ?? -1;
    const nextIndex = pickRandomIndex(this.deps.random, moment.audioPaths.length, lastIndex);
    this.lastRandomMomentIndexByMoment.set(moment.id, nextIndex);
    return moment.audioPaths[nextIndex] ?? null;
  }

  private async startSoundPlayback(handle: SoundscapeAudioHandle, loop: boolean): Promise<boolean> {
    try {
      await handle.load();
      return await handle.play({ loop });
    } catch {
      return false;
    }
  }

  private async stopSoundPlayback(handle: SoundscapeAudioHandle | null | undefined): Promise<void> {
    if (!handle) return;
    try {
      await handle.stop();
    } catch {
      this.lastError = "Failed to stop ambience playback cleanly.";
    }
  }

  private async teardownLayer(layerId: string, state: ActiveLayerRuntimeState): Promise<void> {
    if (state.type === "loop") {
      state.generation += 1;
      this.releaseAmbienceOwnersForLayer(layerId);
      state.pendingAudioPaths.clear();
      for (const [, activeSound] of state.loopSounds.entries()) {
        await this.stopSoundPlayback(activeSound.handle);
      }
      state.loopSounds.clear();
    } else {
      state.generation += 1;
      this.releaseAmbienceOwnersForLayer(layerId);
      state.pendingStartAudioPath = null;
      if (state.scheduleTimer !== null) {
        this.deps.timers.clearTimeout(state.scheduleTimer);
        state.scheduleTimer = null;
      }
      if (state.activeSound) {
        if (state.activeSound.cleanupTimer !== null) {
          this.deps.timers.clearTimeout(state.activeSound.cleanupTimer);
        }
        await this.stopSoundPlayback(state.activeSound.handle);
      }
      state.activeSound = null;
    }

    this.activeLayers.delete(layerId);
    if (this.activeLayers.size === 0) {
      this.activeAmbienceKey = null;
    }
  }

  private claimAmbienceOwner(audioPath: string, layerId: string): boolean {
    const currentOwner = this.activeAmbienceOwners.get(audioPath);
    if (currentOwner && currentOwner !== layerId) return false;
    this.activeAmbienceOwners.set(audioPath, layerId);
    return true;
  }

  private releaseAmbienceOwner(audioPath: string, layerId: string): void {
    if (this.activeAmbienceOwners.get(audioPath) === layerId) {
      this.activeAmbienceOwners.delete(audioPath);
    }
  }

  private releaseAmbienceOwnersForLayer(layerId: string): void {
    for (const [audioPath, ownerLayerId] of [...this.activeAmbienceOwners.entries()]) {
      if (ownerLayerId === layerId) {
        this.activeAmbienceOwners.delete(audioPath);
      }
    }
  }

  private isCurrentLoopLayer(layerId: string, generation: number): boolean {
    const currentState = this.activeLayers.get(layerId);
    return !!currentState && currentState.type === "loop" && currentState.generation === generation;
  }

  private isCurrentRandomLayer(layerId: string, generation: number): boolean {
    const currentState = this.activeLayers.get(layerId);
    return !!currentState && currentState.type === "random" && currentState.generation === generation;
  }
}

export const __soundscapeAmbienceRuntimeInternals = {
  createAmbienceKey,
  createLayerFingerprint,
  randomDelayMs,
};
