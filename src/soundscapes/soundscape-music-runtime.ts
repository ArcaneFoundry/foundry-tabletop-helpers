import { fromUuid, getGame } from "../types";
import type {
  ResolvedSoundscapeState,
  SoundscapeMusicProgram,
} from "./soundscape-types";

interface TimerApi {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface RuntimeDeps {
  getPlaylistByUuid?: (uuid: string) => Promise<RuntimePlaylistLike | null>;
  timers?: TimerApi;
  random?: () => number;
  now?: () => number;
}

interface RuntimePlaylistLike {
  id: string;
  uuid?: string;
  name?: string;
  sounds?: Iterable<RuntimePlaylistSoundLike>;
  playSound?: (sound: RuntimePlaylistSoundLike) => Promise<unknown>;
  stopSound?: (sound: RuntimePlaylistSoundLike) => Promise<unknown>;
  stopAll?: () => Promise<unknown>;
}

interface RuntimePlaylistSoundLike {
  id: string;
  uuid?: string;
  name?: string;
  path?: string;
  sort?: number;
  playing?: boolean;
  repeat?: boolean;
  load?: () => Promise<void>;
  sync?: () => void;
}

export interface SoundscapeMusicTrackCandidate {
  playlistId: string;
  playlistUuid: string;
  playlistName: string;
  soundId: string;
  soundUuid: string | null;
  soundName: string;
  sort: number;
  playlist: RuntimePlaylistLike;
  sound: RuntimePlaylistSoundLike;
}

export interface SoundscapeMusicRuntimeSnapshot {
  activeProgramKey: string | null;
  activeProgramId: string | null;
  activePlaylistUuid: string | null;
  activeSoundId: string | null;
  pendingProgramKey: string | null;
  pendingDelayMs: number | null;
  lastError: string | null;
}

export interface SoundscapeEndedTrackRef {
  playlistUuid?: string | null;
  playlistId?: string | null;
  soundId: string;
}

interface ActiveProgramContext {
  key: string;
  program: SoundscapeMusicProgram;
  profileId: string;
}

interface CandidateIdentity {
  playlistId: string;
  playlistUuid: string;
  soundId: string;
}

interface IgnoredEndedTrack {
  key: string;
  ignoreUntil: number;
}

const PROGRAM_SWITCH_STALE_END_GRACE_MS = 1_000;

const DEFAULT_TIMERS: TimerApi = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function sortPlaylistSounds(sounds: RuntimePlaylistSoundLike[]): RuntimePlaylistSoundLike[] {
  return [...sounds].sort((left, right) => {
    const sortDelta = (left.sort ?? 0) - (right.sort ?? 0);
    if (sortDelta !== 0) return sortDelta;
    const nameDelta = (left.name ?? "").localeCompare(right.name ?? "");
    if (nameDelta !== 0) return nameDelta;
    return left.id.localeCompare(right.id);
  });
}

function createProgramKey(profileId: string, musicProgramId: string): string {
  return `${profileId}:${musicProgramId}`;
}

async function defaultGetPlaylistByUuid(uuid: string): Promise<RuntimePlaylistLike | null> {
  const playlists = getGame()?.playlists;
  if (playlists) {
    for (const playlist of playlists) {
      if (playlist.uuid === uuid) return playlist as RuntimePlaylistLike;
    }
  }

  const resolved = await fromUuid(uuid);
  if (!resolved) return null;
  return resolved as RuntimePlaylistLike;
}

export async function resolveMusicTrackCandidates(
  program: SoundscapeMusicProgram,
  getPlaylistByUuid: (uuid: string) => Promise<RuntimePlaylistLike | null> = defaultGetPlaylistByUuid,
): Promise<SoundscapeMusicTrackCandidate[]> {
  const candidates: SoundscapeMusicTrackCandidate[] = [];

  for (const playlistUuid of program.playlistUuids) {
    const playlist = await getPlaylistByUuid(playlistUuid);
    if (!playlist) continue;

    const sounds = sortPlaylistSounds([...(playlist.sounds ?? [])])
      .filter((sound) => typeof sound.path === "string" && sound.path.trim().length > 0);

    for (const sound of sounds) {
      candidates.push({
        playlistId: playlist.id,
        playlistUuid: playlist.uuid ?? playlistUuid,
        playlistName: playlist.name?.trim() || "Untitled Playlist",
        soundId: sound.id,
        soundUuid: sound.uuid ?? null,
        soundName: sound.name?.trim() || "Untitled Track",
        sort: sound.sort ?? 0,
        playlist,
        sound,
      });
    }
  }

  return candidates;
}

export class SoundscapeMusicRuntime {
  private readonly deps: Required<RuntimeDeps>;
  private readonly nextSequentialIndexByProgram = new Map<string, number>();
  private readonly lastRandomIndexByProgram = new Map<string, number>();
  private activeProgram: ActiveProgramContext | null = null;
  private activeCandidate: SoundscapeMusicTrackCandidate | null = null;
  private pendingTimer: unknown = null;
  private pendingProgramKey: string | null = null;
  private pendingDelayMs: number | null = null;
  private lastError: string | null = null;

  constructor(deps: RuntimeDeps = {}) {
    this.deps = {
      getPlaylistByUuid: deps.getPlaylistByUuid ?? defaultGetPlaylistByUuid,
      timers: deps.timers ?? DEFAULT_TIMERS,
      random: deps.random ?? Math.random,
      now: deps.now ?? Date.now,
    };
  }

  getSnapshot(): SoundscapeMusicRuntimeSnapshot {
    return {
      activeProgramKey: this.activeProgram?.key ?? null,
      activeProgramId: this.activeProgram?.program.id ?? null,
      activePlaylistUuid: this.activeCandidate?.playlistUuid ?? null,
      activeSoundId: this.activeCandidate?.soundId ?? null,
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
      const stoppedCandidate = await this.stopActivePlayback();
      this.clearPendingTimer();
      this.activeProgram = {
        key: nextKey,
        program: nextProgram,
        profileId: state.profileId,
      };
      await this.playNextCandidate(nextProgram, nextKey);
      this.primeIgnoredStaleEndEvent(stoppedCandidate);
      return this.getSnapshot();
    }

    if (!this.activeCandidate && !this.pendingTimer) {
      await this.playNextCandidate(nextProgram, nextKey);
    }

    return this.getSnapshot();
  }

  handleTrackEnded(ref: SoundscapeEndedTrackRef): void {
    if (!this.activeProgram || !this.activeCandidate) return;
    if (ref.soundId !== this.activeCandidate.soundId) return;
    if (ref.playlistUuid && ref.playlistUuid !== this.activeCandidate.playlistUuid) return;
    if (ref.playlistId && ref.playlistId !== this.activeCandidate.playlistId) return;
    if (this.shouldIgnoreEndedTrack(ref)) return;

    const completedProgram = this.activeProgram;
    const programDelayMs = Math.max(0, completedProgram.program.delaySeconds * 1000);

    this.activeCandidate = null;
    this.clearPendingTimer();

    const scheduleNext = () => {
      void this.playNextCandidate(completedProgram.program, completedProgram.key);
    };

    if (programDelayMs <= 0) {
      scheduleNext();
      return;
    }

    this.pendingProgramKey = completedProgram.key;
    this.pendingDelayMs = programDelayMs;
    this.pendingTimer = this.deps.timers.setTimeout(() => {
      this.pendingTimer = null;
      this.pendingProgramKey = null;
      this.pendingDelayMs = null;
      scheduleNext();
    }, programDelayMs);
  }

  async stop(): Promise<void> {
    await this.stopActivePlayback();
    this.clearPendingTimer();
    this.activeProgram = null;
    this.ignoredEndedTrack = null;
    this.lastError = null;
  }

  private ignoredEndedTrack: IgnoredEndedTrack | null = null;

  private async stopActivePlayback(): Promise<CandidateIdentity | null> {
    const activeCandidate = this.activeCandidate;
    this.activeCandidate = null;

    if (!activeCandidate) return null;
    try {
      if (activeCandidate.playlist.stopSound) {
        await activeCandidate.playlist.stopSound(activeCandidate.sound);
      } else {
        await activeCandidate.playlist.stopAll?.();
      }
    } catch {
      this.lastError = "Failed to stop active music track cleanly.";
    }
    return {
      playlistId: activeCandidate.playlistId,
      playlistUuid: activeCandidate.playlistUuid,
      soundId: activeCandidate.soundId,
    };
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer !== null) {
      this.deps.timers.clearTimeout(this.pendingTimer);
    }
    this.pendingTimer = null;
    this.pendingProgramKey = null;
    this.pendingDelayMs = null;
  }

  private shouldIgnoreEndedTrack(ref: SoundscapeEndedTrackRef): boolean {
    if (!this.ignoredEndedTrack) return false;

    const activeCandidateKey = this.activeCandidate ? createCandidateKey(this.activeCandidate) : null;
    if (activeCandidateKey !== this.ignoredEndedTrack.key) {
      this.ignoredEndedTrack = null;
      return false;
    }

    const refKey = createEndedTrackKey(ref);
    if (refKey !== this.ignoredEndedTrack.key) return false;
    if (this.deps.now() > this.ignoredEndedTrack.ignoreUntil) {
      this.ignoredEndedTrack = null;
      return false;
    }

    this.ignoredEndedTrack = null;
    return true;
  }

  private primeIgnoredStaleEndEvent(stoppedCandidate: CandidateIdentity | null): void {
    if (!stoppedCandidate || !this.activeCandidate) {
      this.ignoredEndedTrack = null;
      return;
    }

    const stoppedKey = createCandidateKey(stoppedCandidate);
    const activeKey = createCandidateKey(this.activeCandidate);
    if (stoppedKey !== activeKey) {
      this.ignoredEndedTrack = null;
      return;
    }

    // Ignore one immediate stop echo when a program switch restarts the same track.
    this.ignoredEndedTrack = {
      key: activeKey,
      ignoreUntil: this.deps.now() + PROGRAM_SWITCH_STALE_END_GRACE_MS,
    };
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

    const candidates = await resolveMusicTrackCandidates(program, this.deps.getPlaylistByUuid);
    if (candidates.length === 0) {
      this.lastError = `No valid playlist tracks could be resolved for music program "${program.name}".`;
      this.activeCandidate = null;
      return;
    }

    const candidate = this.pickCandidate(programKey, program, candidates);
    this.lastError = null;

    try {
      await candidate.sound.load?.();
      if (!candidate.playlist.playSound) {
        this.lastError = `Playlist "${candidate.playlistName}" cannot start playback on this client.`;
        this.activeCandidate = null;
        return;
      }
      await candidate.playlist.playSound(candidate.sound);
      candidate.sound.sync?.();
      this.activeCandidate = candidate;
    } catch {
      this.lastError = `Failed to start track "${candidate.soundName}".`;
      this.activeCandidate = null;
    }
  }
}

export const __soundscapeMusicRuntimeInternals = {
  PROGRAM_SWITCH_STALE_END_GRACE_MS,
  createProgramKey,
  createCandidateKey,
  createEndedTrackKey,
  defaultGetPlaylistByUuid,
  sortPlaylistSounds,
};

function createCandidateKey(candidate: CandidateIdentity): string {
  return `${candidate.playlistUuid}:${candidate.playlistId}:${candidate.soundId}`;
}

function createEndedTrackKey(ref: SoundscapeEndedTrackRef): string | null {
  if (!ref.playlistUuid || !ref.playlistId) return null;
  return `${ref.playlistUuid}:${ref.playlistId}:${ref.soundId}`;
}
