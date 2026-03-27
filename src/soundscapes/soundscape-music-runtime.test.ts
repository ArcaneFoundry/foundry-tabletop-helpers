import { describe, expect, it, vi } from "vitest";

import { resolveMusicTrackCandidates, SoundscapeMusicRuntime } from "./soundscape-music-runtime";
import type { ResolvedSoundscapeState, SoundscapeMusicProgram } from "./soundscape-types";

interface FakeTimerHandle {
  callback: () => void;
  delay: number;
  cleared: boolean;
}

interface FakePlaylistSound {
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

interface FakePlaylist {
  id: string;
  uuid: string;
  name: string;
  sounds: FakePlaylistSound[];
  playSound: (sound: FakePlaylistSound) => Promise<unknown>;
  stopSound?: (sound: FakePlaylistSound) => Promise<unknown>;
  stopAll?: () => Promise<unknown>;
}

function createFakeTimers() {
  const handles: FakeTimerHandle[] = [];
  return {
    handles,
    api: {
      setTimeout(callback: () => void, delay: number) {
        const handle = { callback, delay, cleared: false };
        handles.push(handle);
        return handle;
      },
      clearTimeout(handle: unknown) {
        const timer = handle as FakeTimerHandle | undefined;
        if (timer) timer.cleared = true;
      },
    },
    runNext() {
      const handle = handles.find((entry) => !entry.cleared);
      if (!handle) return;
      handle.cleared = true;
      handle.callback();
    },
  };
}

function createPlaylist(
  uuid: string,
  name: string,
  soundIds: string[],
): FakePlaylist {
  const sounds = soundIds.map((soundId, index) => {
    const load = vi.fn(async (): Promise<void> => {});
    const sync = vi.fn((): void => {});

    return {
      id: soundId,
      uuid: `${uuid}.${soundId}`,
      name: soundId,
      path: `sounds/${soundId}.ogg`,
      sort: index,
      load,
      sync,
    };
  });

  const playSound = vi.fn(async (_sound: FakePlaylistSound): Promise<void> => {});
  const stopSound = vi.fn(async (_sound: FakePlaylistSound): Promise<void> => {});

  return {
    id: uuid.split(".").at(-1) ?? uuid,
    uuid,
    name,
    sounds,
    playSound,
    stopSound,
  };
}

function createResolvedState(program: SoundscapeMusicProgram): ResolvedSoundscapeState {
  return {
    profileId: "forest",
    assignmentSource: "worldDefault",
    sceneId: "scene-1",
    context: {
      manualPreview: false,
      inCombat: false,
      weather: null,
      timeOfDay: null,
    },
    musicProgramId: program.id,
    musicProgram: program,
    musicRuleId: "base",
    ambienceLayerIds: [],
    ambienceLayers: [],
    ambienceRuleId: null,
    soundMoments: [],
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("soundscape music runtime", () => {
  it("flattens authored playlists into deterministic track candidates", async () => {
    const town = createPlaylist("Playlist.town", "Town", ["a", "b"]);
    const battle = createPlaylist("Playlist.battle", "Battle", ["c"]);

    const candidates = await resolveMusicTrackCandidates({
      id: "program",
      name: "Program",
      playlistUuids: ["Playlist.town", "Playlist.battle"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }, async (uuid) => {
      if (uuid === "Playlist.town") return town;
      if (uuid === "Playlist.battle") return battle;
      return null;
    });

    expect(candidates.map((candidate) => `${candidate.playlistUuid}:${candidate.soundId}`)).toEqual([
      "Playlist.town:a",
      "Playlist.town:b",
      "Playlist.battle:c",
    ]);
  });

  it("plays sequential tracks and respects cooldown before the next track", async () => {
    const timers = createFakeTimers();
    const playlist = createPlaylist("Playlist.town", "Town", ["a", "b"]);
    const program: SoundscapeMusicProgram = {
      id: "calm",
      name: "Calm",
      playlistUuids: ["Playlist.town"],
      selectionMode: "sequential",
      delaySeconds: 5,
    };
    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async () => playlist,
      timers: timers.api,
    });

    await runtime.sync(createResolvedState(program));

    expect(playlist.playSound).toHaveBeenCalledTimes(1);
    expect(playlist.playSound).toHaveBeenLastCalledWith(playlist.sounds[0]);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "calm",
      activeSoundId: "a",
      pendingDelayMs: null,
    });

    runtime.handleTrackEnded({ playlistUuid: "Playlist.town", playlistId: playlist.id, soundId: "a" });
    expect(runtime.getSnapshot()).toMatchObject({
      activeSoundId: null,
      pendingDelayMs: 5000,
    });

    timers.runNext();
    await flushAsyncWork();

    expect(playlist.playSound).toHaveBeenCalledTimes(2);
    expect(playlist.playSound).toHaveBeenLastCalledWith(playlist.sounds[1]);
  });

  it("uses deterministic random selection without repeating immediately when alternatives exist", async () => {
    const playlist = createPlaylist("Playlist.town", "Town", ["a", "b", "c"]);
    const rngValues = [0, 0];
    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async () => playlist,
      random: () => rngValues.shift() ?? 0,
    });
    const program: SoundscapeMusicProgram = {
      id: "wild",
      name: "Wild",
      playlistUuids: ["Playlist.town"],
      selectionMode: "random",
      delaySeconds: 0,
    };

    await runtime.sync(createResolvedState(program));
    runtime.handleTrackEnded({ playlistUuid: "Playlist.town", playlistId: playlist.id, soundId: "a" });
    await flushAsyncWork();

  const playedIds = ((playlist.playSound as unknown as { mock: { calls: unknown[][] } }).mock.calls)
    .map((call) => (call[0] as { id: string }).id);
    expect(playedIds).toEqual(["a", "b"]);
  });

  it("ignores track-ended updates from a different playlist with the same local sound id", async () => {
    const firstPlaylist = createPlaylist("Playlist.one", "One", ["shared"]);
    const secondPlaylist = createPlaylist("Playlist.two", "Two", ["shared"]);
    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async (uuid) => uuid === "Playlist.one" ? firstPlaylist : secondPlaylist,
    });

    await runtime.sync(createResolvedState({
      id: "calm",
      name: "Calm",
      playlistUuids: ["Playlist.one"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    runtime.handleTrackEnded({
      playlistUuid: "Playlist.two",
      playlistId: secondPlaylist.id,
      soundId: "shared",
    });
    await flushAsyncWork();

    expect(firstPlaylist.playSound).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activePlaylistUuid: "Playlist.one",
      activeSoundId: "shared",
      pendingDelayMs: null,
    });
  });

  it("clears pending timers and stops old playback when switching programs", async () => {
    const timers = createFakeTimers();
    const calmPlaylist = createPlaylist("Playlist.calm", "Calm", ["calm-a"]);
    const battlePlaylist = createPlaylist("Playlist.battle", "Battle", ["battle-a"]);

    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async (uuid) => {
        if (uuid === "Playlist.calm") return calmPlaylist;
        if (uuid === "Playlist.battle") return battlePlaylist;
        return null;
      },
      timers: timers.api,
    });

    await runtime.sync(createResolvedState({
      id: "calm",
      name: "Calm",
      playlistUuids: ["Playlist.calm"],
      selectionMode: "sequential",
      delaySeconds: 10,
    }));

    await runtime.sync(createResolvedState({
      id: "battle",
      name: "Battle",
      playlistUuids: ["Playlist.battle"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    expect(calmPlaylist.stopSound).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "battle",
      pendingDelayMs: null,
      activeSoundId: "battle-a",
    });

    timers.runNext();
    expect(battlePlaylist.playSound).toHaveBeenCalledTimes(1);
  });

  it("ignores one stale end event when a program switch restarts the same track", async () => {
    let now = 0;
    const playlist = createPlaylist("Playlist.shared", "Shared", ["shared"]);
    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async () => playlist,
      now: () => now,
    });

    await runtime.sync(createResolvedState({
      id: "calm",
      name: "Calm",
      playlistUuids: ["Playlist.shared"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    await runtime.sync(createResolvedState({
      id: "battle",
      name: "Battle",
      playlistUuids: ["Playlist.shared"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    runtime.handleTrackEnded({
      playlistUuid: "Playlist.shared",
      playlistId: playlist.id,
      soundId: "shared",
    });
    await flushAsyncWork();

    expect((playlist.playSound as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(2);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "battle",
      activePlaylistUuid: "Playlist.shared",
      activeSoundId: "shared",
      pendingDelayMs: null,
    });

    now = 2_000;
    runtime.handleTrackEnded({
      playlistUuid: "Playlist.shared",
      playlistId: playlist.id,
      soundId: "shared",
    });
    await flushAsyncWork();

    expect((playlist.playSound as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(3);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "battle",
      activePlaylistUuid: "Playlist.shared",
      activeSoundId: "shared",
      pendingDelayMs: null,
    });
  });

  it("falls back to stopAll when a playlist cannot stop an individual sound", async () => {
    const playlist = createPlaylist("Playlist.calm", "Calm", ["calm-a"]);
    const stopAll = vi.fn(async () => {});
    playlist.stopSound = undefined;
    playlist.stopAll = stopAll;

    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async () => playlist,
    });

    await runtime.sync(createResolvedState({
      id: "calm",
      name: "Calm",
      playlistUuids: ["Playlist.calm"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));
    await runtime.stop();

    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("fails gracefully when music program playlists cannot be resolved", async () => {
    const runtime = new SoundscapeMusicRuntime({
      getPlaylistByUuid: async () => null,
    });

    await runtime.sync(createResolvedState({
      id: "missing",
      name: "Missing",
      playlistUuids: ["Playlist.missing"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "missing",
      activeSoundId: null,
      lastError: 'No valid playlist tracks could be resolved for music program "Missing".',
    });
  });
});
