import { formatAudioPathLabel, resolveAudioPathPlayback, type SoundscapeAudioHandle } from "./soundscape-audio-playback";
import type { ResolvedSoundscapeState, SoundscapeMusicProgram } from "./soundscape-types";

interface TimerApi {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface RuntimeDeps {
  resolveAudioPath?: (path: string) => Promise<SoundscapeAudioHandle | null>;
  timers?: TimerApi;
  random?: () => number;
}

export interface SoundscapeMusicTrackCandidate {
  path: string;
  label: string;
  durationSeconds: number;
  handle: SoundscapeAudioHandle;
}

export interface SoundscapeMusicRuntimeSnapshot {
  activeProgramKey: string | null;
  activeProgramId: string | null;
  activeAudioPath: string | null;
  pendingProgramKey: string | null;
  pendingDelayMs: number | null;
  lastError: string | null;
}

interface ActiveProgramContext {
  key: string;
  program: SoundscapeMusicProgram;
  profileId: string;
}

interface ActiveTrackContext {
  path: string;
  label: string;
  handle: SoundscapeAudioHandle;
}

const DEFAULT_TIMERS: TimerApi = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function createProgramKey(profileId: string, musicProgramId: string): string {
  return `${profileId}:${musicProgramId}`;
}

export async function resolveMusicTrackCandidates(
  program: SoundscapeMusicProgram,
  resolveAudioPath: (path: string) => Promise<SoundscapeAudioHandle | null> = resolveAudioPathPlayback,
): Promise<SoundscapeMusicTrackCandidate[]> {
  const candidates: SoundscapeMusicTrackCandidate[] = [];

  for (const path of program.audioPaths) {
    const handle = await resolveAudioPath(path);
    if (!handle) continue;
    await handle.load();
    candidates.push({
      path: handle.path,
      label: formatAudioPathLabel(handle.path),
      durationSeconds: handle.durationSeconds,
      handle,
    });
  }

  return candidates;
}

export class SoundscapeMusicRuntime {
  private readonly deps: Required<RuntimeDeps>;
  private readonly nextSequentialIndexByProgram = new Map<string, number>();
  private readonly lastRandomIndexByProgram = new Map<string, number>();
  private activeProgram: ActiveProgramContext | null = null;
  private activeTrack: ActiveTrackContext | null = null;
  private pendingTimer: unknown = null;
  private trackCompletionTimer: unknown = null;
  private pendingProgramKey: string | null = null;
  private pendingDelayMs: number | null = null;
  private lastError: string | null = null;

  constructor(deps: RuntimeDeps = {}) {
    this.deps = {
      resolveAudioPath: deps.resolveAudioPath ?? resolveAudioPathPlayback,
      timers: deps.timers ?? DEFAULT_TIMERS,
      random: deps.random ?? Math.random,
    };
  }

  getSnapshot(): SoundscapeMusicRuntimeSnapshot {
    return {
      activeProgramKey: this.activeProgram?.key ?? null,
      activeProgramId: this.activeProgram?.program.id ?? null,
      activeAudioPath: this.activeTrack?.path ?? null,
      pendingProgramKey: this.pendingProgramKey,
      pendingDelayMs: this.pendingDelayMs,
      lastError: this.lastError,
    };
  }

  async sync(state: ResolvedSoundscapeState | null): Promise<SoundscapeMusicRuntimeSnapshot> {
    const nextProgram = state?.musicProgram;
    if (!state || !nextProgram || !state.musicProgramId) {
      await this.stop();
      return this.getSnapshot();
    }

    const nextKey = createProgramKey(state.profileId, state.musicProgramId);
    if (this.activeProgram?.key !== nextKey) {
      await this.stopActivePlayback();
      this.clearPendingTimer();
      this.clearTrackCompletionTimer();
      this.activeProgram = {
        key: nextKey,
        program: nextProgram,
        profileId: state.profileId,
      };
      await this.playNextCandidate(nextProgram, nextKey);
      return this.getSnapshot();
    }

    if (!this.activeTrack && !this.pendingTimer) {
      await this.playNextCandidate(nextProgram, nextKey);
    }

    return this.getSnapshot();
  }

  handleTrackEnded(): void {
    if (!this.activeProgram || !this.activeTrack) return;

    this.activeTrack = null;
    this.clearTrackCompletionTimer();

    const completedProgram = this.activeProgram;
    const delayMs = Math.max(0, completedProgram.program.delaySeconds * 1000);
    const scheduleNext = () => {
      void this.playNextCandidate(completedProgram.program, completedProgram.key);
    };

    if (delayMs <= 0) {
      scheduleNext();
      return;
    }

    this.pendingProgramKey = completedProgram.key;
    this.pendingDelayMs = delayMs;
    this.pendingTimer = this.deps.timers.setTimeout(() => {
      this.pendingTimer = null;
      this.pendingProgramKey = null;
      this.pendingDelayMs = null;
      scheduleNext();
    }, delayMs);
  }

  async stop(): Promise<void> {
    await this.stopActivePlayback();
    this.clearPendingTimer();
    this.clearTrackCompletionTimer();
    this.activeProgram = null;
    this.lastError = null;
  }

  private async stopActivePlayback(): Promise<void> {
    const activeTrack = this.activeTrack;
    this.activeTrack = null;

    if (!activeTrack) return;
    try {
      await activeTrack.handle.stop();
    } catch {
      this.lastError = "Failed to stop active music track cleanly.";
    }
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer !== null) {
      this.deps.timers.clearTimeout(this.pendingTimer);
    }
    this.pendingTimer = null;
    this.pendingProgramKey = null;
    this.pendingDelayMs = null;
  }

  private clearTrackCompletionTimer(): void {
    if (this.trackCompletionTimer !== null) {
      this.deps.timers.clearTimeout(this.trackCompletionTimer);
    }
    this.trackCompletionTimer = null;
  }

  private pickCandidate(
    programKey: string,
    program: SoundscapeMusicProgram,
    candidates: SoundscapeMusicTrackCandidate[],
  ): SoundscapeMusicTrackCandidate {
    if (program.selectionMode === "random") {
      const lastIndex = this.lastRandomIndexByProgram.get(programKey) ?? -1;
      const rawIndex = Math.floor(this.deps.random() * candidates.length);
      const nextIndex = candidates.length > 1 && rawIndex === lastIndex
        ? (rawIndex + 1) % candidates.length
        : rawIndex;
      this.lastRandomIndexByProgram.set(programKey, nextIndex);
      return candidates[nextIndex]!;
    }

    const nextIndex = this.nextSequentialIndexByProgram.get(programKey) ?? 0;
    const normalizedIndex = nextIndex % candidates.length;
    this.nextSequentialIndexByProgram.set(programKey, normalizedIndex + 1);
    return candidates[normalizedIndex]!;
  }

  private async playNextCandidate(program: SoundscapeMusicProgram, programKey: string): Promise<void> {
    if (this.activeProgram?.key !== programKey) return;

    const candidates = await resolveMusicTrackCandidates(program, this.deps.resolveAudioPath);
    if (candidates.length === 0) {
      this.lastError = `No valid audio files could be resolved for music program "${program.name}".`;
      this.activeTrack = null;
      return;
    }

    const candidate = this.pickCandidate(programKey, program, candidates);

    try {
      const started = await candidate.handle.play({ loop: false });
      if (!started) {
        this.lastError = `Audio file "${candidate.label}" cannot start playback on this client.`;
        this.activeTrack = null;
        return;
      }

      this.activeTrack = {
        path: candidate.path,
        label: candidate.label,
        handle: candidate.handle,
      };
      this.lastError = null;

      const durationMs = Math.max(0, Math.round(candidate.durationSeconds * 1000));
      if (durationMs > 0) {
        this.trackCompletionTimer = this.deps.timers.setTimeout(() => {
          this.trackCompletionTimer = null;
          this.handleTrackEnded();
        }, durationMs);
      }
    } catch {
      this.lastError = `Failed to start track "${candidate.label}".`;
      this.activeTrack = null;
    }
  }
}

export const __soundscapeMusicRuntimeInternals = {
  createProgramKey,
};
