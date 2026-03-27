import { fromUuid } from "../types";
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
  resolveSoundByUuid?: (uuid: string) => Promise<RuntimeSoundDocumentLike | null>;
  timers?: TimerApi;
  random?: () => number;
}

interface RuntimeSoundLike {
  duration?: number;
  playing?: boolean;
  play?: (options?: Record<string, unknown>) => Promise<unknown>;
  stop?: () => Promise<unknown> | void;
}

interface RuntimeSoundDocumentLike {
  id: string;
  uuid?: string;
  name?: string;
  path?: string;
  sound?: RuntimeSoundLike | null;
  load?: () => Promise<void>;
  sync?: () => void;
}

interface ActiveLoopSound {
  soundUuid: string;
  doc: RuntimeSoundDocumentLike;
}

interface ActiveRandomSound {
  soundUuid: string;
  doc: RuntimeSoundDocumentLike;
  cleanupTimer: unknown | null;
}

interface LoopLayerRuntimeState {
  type: "loop";
  layer: SoundscapeAmbienceLayer;
  fingerprint: string;
  generation: number;
  loopSounds: Map<string, ActiveLoopSound>;
  pendingSoundUuids: Set<string>;
}

interface RandomLayerRuntimeState {
  type: "random";
  layer: SoundscapeAmbienceLayer;
  fingerprint: string;
  scheduleTimer: unknown | null;
  activeSound: ActiveRandomSound | null;
  lastPlayedSoundUuid: string | null;
  pendingStartSoundUuid: string | null;
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
  loopSoundUuids: string[];
  randomLayerIds: string[];
  activeRandomSoundUuids: string[];
  pendingRandomLayerIds: string[];
  lastError: string | null;
}

export interface SoundscapeMomentPlaybackResult {
  momentId: string;
  soundUuid: string | null;
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
    ...layer.soundUuids,
  ].join("|");
}

function randomDelayMs(layer: SoundscapeAmbienceLayer, random: () => number): number {
  const minMs = Math.max(0, layer.minDelaySeconds * 1000);
  const maxMs = Math.max(minMs, layer.maxDelaySeconds * 1000);
  if (maxMs <= minMs) return minMs;
  return Math.round(minMs + ((maxMs - minMs) * random()));
}

async function defaultResolveSoundByUuid(uuid: string): Promise<RuntimeSoundDocumentLike | null> {
  const resolved = await fromUuid(uuid);
  if (!resolved || typeof resolved.id !== "string") return null;
  return resolved as RuntimeSoundDocumentLike;
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
      resolveSoundByUuid: deps.resolveSoundByUuid ?? defaultResolveSoundByUuid,
      timers: deps.timers ?? DEFAULT_TIMERS,
      random: deps.random ?? Math.random,
    };
  }

  getSnapshot(): SoundscapeAmbienceRuntimeSnapshot {
    const activeLayerIds = [...this.activeLayers.keys()].sort();
    const loopSoundUuids = [...this.activeAmbienceOwners.entries()]
      .filter(([soundUuid, layerId]) => {
        void soundUuid;
        const state = this.activeLayers.get(layerId);
        return state?.type === "loop";
      })
      .map(([soundUuid]) => soundUuid)
      .sort();
    const randomLayerIds = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .map((state) => state.layer.id)
      .sort();
    const activeRandomSoundUuids = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .flatMap((state) => state.activeSound ? [state.activeSound.soundUuid] : [])
      .sort();
    const pendingRandomLayerIds = [...this.activeLayers.values()]
      .filter((state): state is RandomLayerRuntimeState => state.type === "random")
      .flatMap((state) => state.scheduleTimer ? [state.layer.id] : [])
      .sort();

    return {
      activeAmbienceKey: this.activeAmbienceKey,
      activeLayerIds,
      loopSoundUuids,
      randomLayerIds,
      activeRandomSoundUuids,
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
          pendingSoundUuids: new Set(),
        };
        this.activeLayers.set(layer.id, loopState);
      } else if (!activeState) {
        const randomState: RandomLayerRuntimeState = {
          type: "random",
          layer,
          fingerprint: createLayerFingerprint(layer),
          scheduleTimer: null,
          activeSound: null,
          lastPlayedSoundUuid: null,
          pendingStartSoundUuid: null,
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
        soundUuid: null,
        played: false,
        error: "No sound moment is available to play.",
      };
    }

    const selected = this.selectMomentSoundUuid(moment);
    if (!selected) {
      return {
        momentId: moment.id,
        soundUuid: null,
        played: false,
        error: `Sound moment "${moment.name}" has no playable sounds.`,
      };
    }

    const doc = await this.deps.resolveSoundByUuid(selected);
    if (!doc) {
      return {
        momentId: moment.id,
        soundUuid: selected,
        played: false,
        error: `Sound moment "${moment.name}" could not resolve audio document "${selected}".`,
      };
    }

    const started = await this.startSoundPlayback(doc, false);
    if (!started) {
      return {
        momentId: moment.id,
        soundUuid: selected,
        played: false,
        error: `Sound moment "${moment.name}" could not start playback.`,
      };
    }

    return {
      momentId: moment.id,
      soundUuid: selected,
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
        soundUuid: null,
        played: false,
        error: "No active soundscape state is available.",
      };
    }

    const moment = state.soundMoments.find((entry) => entry.id === momentId);
    if (!moment) {
      return {
        momentId,
        soundUuid: null,
        played: false,
        error: `Sound moment "${momentId}" is not available in the active soundscape.`,
      };
    }

    return await this.playMoment(moment);
  }

  private async startLoopLayer(state: LoopLayerRuntimeState): Promise<void> {
    const generation = state.generation;
    for (const soundUuid of state.layer.soundUuids) {
      if (state.loopSounds.has(soundUuid) || state.pendingSoundUuids.has(soundUuid)) continue;

      state.pendingSoundUuids.add(soundUuid);
      if (!this.claimAmbienceOwner(soundUuid, state.layer.id)) {
        state.pendingSoundUuids.delete(soundUuid);
        continue;
      }

      const doc = await this.deps.resolveSoundByUuid(soundUuid);
      if (!doc) {
        this.releaseAmbienceOwner(soundUuid, state.layer.id);
        state.pendingSoundUuids.delete(soundUuid);
        this.lastError = `Ambience layer "${state.layer.name}" could not resolve audio document "${soundUuid}".`;
        continue;
      }

      if (!this.isCurrentLoopLayer(state.layer.id, generation) || this.activeAmbienceOwners.get(soundUuid) !== state.layer.id) {
        this.releaseAmbienceOwner(soundUuid, state.layer.id);
        state.pendingSoundUuids.delete(soundUuid);
        continue;
      }

      const started = await this.startSoundPlayback(doc, true);
      if (!started || !this.isCurrentLoopLayer(state.layer.id, generation) || this.activeAmbienceOwners.get(soundUuid) !== state.layer.id) {
        this.releaseAmbienceOwner(soundUuid, state.layer.id);
        state.pendingSoundUuids.delete(soundUuid);
        if (started) await this.stopSoundPlayback(doc);
        this.lastError = `Ambience layer "${state.layer.name}" could not start loop "${soundUuid}".`;
        continue;
      }

      const currentState = this.activeLayers.get(state.layer.id);
      if (!currentState || currentState.type !== "loop" || currentState.generation !== generation) {
        this.releaseAmbienceOwner(soundUuid, state.layer.id);
        state.pendingSoundUuids.delete(soundUuid);
        await this.stopSoundPlayback(doc);
        continue;
      }

      currentState.loopSounds.set(soundUuid, { soundUuid, doc });
      currentState.pendingSoundUuids.delete(soundUuid);
    }
  }

  private scheduleRandomLayer(state: RandomLayerRuntimeState, explicitDelayMs?: number): void {
    if (state.scheduleTimer || state.activeSound || state.pendingStartSoundUuid || !this.activeLayers.has(state.layer.id)) return;

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

    const selectedSoundUuid = this.selectRandomLayerSoundUuid(state);
    if (!selectedSoundUuid) {
      this.scheduleRandomLayer(state, Math.max(0, state.layer.minDelaySeconds * 1000));
      return;
    }
    if (!this.claimAmbienceOwner(selectedSoundUuid, state.layer.id)) {
      this.scheduleRandomLayer(state, Math.max(0, state.layer.minDelaySeconds * 1000));
      return;
    }
    state.pendingStartSoundUuid = selectedSoundUuid;

    const doc = await this.deps.resolveSoundByUuid(selectedSoundUuid);
    if (!doc) {
      this.releaseAmbienceOwner(selectedSoundUuid, state.layer.id);
      state.pendingStartSoundUuid = null;
      this.lastError = `Ambience layer "${state.layer.name}" could not resolve audio document "${selectedSoundUuid}".`;
      this.scheduleRandomLayer(state);
      return;
    }

    if (!this.isCurrentRandomLayer(layerId, generation) || this.activeAmbienceOwners.get(selectedSoundUuid) !== state.layer.id) {
      this.releaseAmbienceOwner(selectedSoundUuid, state.layer.id);
      state.pendingStartSoundUuid = null;
      return;
    }

    const started = await this.startSoundPlayback(doc, false);
    if (!started || !this.isCurrentRandomLayer(layerId, generation) || this.activeAmbienceOwners.get(selectedSoundUuid) !== state.layer.id) {
      this.releaseAmbienceOwner(selectedSoundUuid, state.layer.id);
      state.pendingStartSoundUuid = null;
      if (started) await this.stopSoundPlayback(doc);
      this.lastError = `Ambience layer "${state.layer.name}" could not start "${selectedSoundUuid}".`;
      const currentState = this.activeLayers.get(layerId);
      if (currentState && currentState.type === "random" && currentState.generation === generation) {
        this.scheduleRandomLayer(currentState);
      }
      return;
    }

    const currentState = this.activeLayers.get(layerId);
    if (!currentState || currentState.type !== "random" || currentState.generation !== generation) {
      this.releaseAmbienceOwner(selectedSoundUuid, state.layer.id);
      state.pendingStartSoundUuid = null;
      await this.stopSoundPlayback(doc);
      return;
    }

    currentState.lastPlayedSoundUuid = selectedSoundUuid;
    currentState.pendingStartSoundUuid = null;

    const durationMs = Math.max(0, Math.round((doc.sound?.duration ?? 0) * 1000));
    const cleanupTimer = this.deps.timers.setTimeout(() => {
      void this.finishRandomLayerSound(layerId, generation, selectedSoundUuid);
    }, durationMs);

    currentState.activeSound = {
      soundUuid: selectedSoundUuid,
      doc,
      cleanupTimer,
    };
  }

  private async finishRandomLayerSound(layerId: string, generation: number, soundUuid: string): Promise<void> {
    const state = this.activeLayers.get(layerId);
    if (!state || state.type !== "random" || state.generation !== generation) return;
    if (!state.activeSound || state.activeSound.soundUuid !== soundUuid) return;

    if (state.activeSound.cleanupTimer !== null) {
      this.deps.timers.clearTimeout(state.activeSound.cleanupTimer);
    }

    this.activeAmbienceOwners.delete(soundUuid);
    state.activeSound = null;
    this.scheduleRandomLayer(state);
  }

  private selectRandomLayerSoundUuid(state: RandomLayerRuntimeState): string | null {
    const candidates = state.layer.soundUuids.filter((soundUuid) => !this.activeAmbienceOwners.has(soundUuid));
    if (candidates.length === 0) return null;

    const lastIndex = state.lastPlayedSoundUuid ? candidates.indexOf(state.lastPlayedSoundUuid) : -1;
    return candidates[pickRandomIndex(this.deps.random, candidates.length, lastIndex)] ?? null;
  }

  private selectMomentSoundUuid(moment: SoundscapeSoundMoment): string | null {
    if (moment.soundUuids.length === 0) return null;
    if (moment.selectionMode === "single") return moment.soundUuids[0] ?? null;

    const lastIndex = this.lastRandomMomentIndexByMoment.get(moment.id) ?? -1;
    const nextIndex = pickRandomIndex(this.deps.random, moment.soundUuids.length, lastIndex);
    this.lastRandomMomentIndexByMoment.set(moment.id, nextIndex);
    return moment.soundUuids[nextIndex] ?? null;
  }

  private async startSoundPlayback(doc: RuntimeSoundDocumentLike, loop: boolean): Promise<boolean> {
    try {
      await doc.load?.();
      if (!doc.sound?.play) return false;
      await doc.sound.play({ loop });
      doc.sync?.();
      return true;
    } catch {
      return false;
    }
  }

  private async stopSoundPlayback(doc: RuntimeSoundDocumentLike | null | undefined): Promise<void> {
    if (!doc?.sound?.stop) return;
    try {
      await doc.sound.stop();
    } catch {
      this.lastError = "Failed to stop ambience playback cleanly.";
    }
  }

  private async teardownLayer(layerId: string, state: ActiveLayerRuntimeState): Promise<void> {
    if (state.type === "loop") {
      state.generation += 1;
      this.releaseAmbienceOwnersForLayer(layerId);
      state.pendingSoundUuids.clear();
      for (const [, activeSound] of state.loopSounds.entries()) {
        await this.stopSoundPlayback(activeSound.doc);
      }
      state.loopSounds.clear();
    } else {
      state.generation += 1;
      this.releaseAmbienceOwnersForLayer(layerId);
      state.pendingStartSoundUuid = null;
      if (state.scheduleTimer !== null) {
        this.deps.timers.clearTimeout(state.scheduleTimer);
        state.scheduleTimer = null;
      }
      if (state.activeSound) {
        if (state.activeSound.cleanupTimer !== null) {
          this.deps.timers.clearTimeout(state.activeSound.cleanupTimer);
        }
        await this.stopSoundPlayback(state.activeSound.doc);
      }
      state.activeSound = null;
    }

    this.activeLayers.delete(layerId);
    if (this.activeLayers.size === 0) {
      this.activeAmbienceKey = null;
    }
  }

  private claimAmbienceOwner(soundUuid: string, layerId: string): boolean {
    const currentOwner = this.activeAmbienceOwners.get(soundUuid);
    if (currentOwner && currentOwner !== layerId) return false;
    this.activeAmbienceOwners.set(soundUuid, layerId);
    return true;
  }

  private releaseAmbienceOwner(soundUuid: string, layerId: string): void {
    if (this.activeAmbienceOwners.get(soundUuid) === layerId) {
      this.activeAmbienceOwners.delete(soundUuid);
    }
  }

  private releaseAmbienceOwnersForLayer(layerId: string): void {
    for (const [soundUuid, ownerLayerId] of [...this.activeAmbienceOwners.entries()]) {
      if (ownerLayerId === layerId) {
        this.activeAmbienceOwners.delete(soundUuid);
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
  defaultResolveSoundByUuid,
  randomDelayMs,
};
