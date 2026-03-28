import { describe, expect, it, vi } from "vitest";

import { resolveMusicTrackCandidates, SoundscapeMusicRuntime } from "./soundscape-music-runtime";
import type { ResolvedSoundscapeState, SoundscapeMusicProgram } from "./soundscape-types";

interface FakeTimerHandle {
  callback: () => void;
  delay: number;
  cleared: boolean;
}

interface FakeAudioHandle {
  path: string;
  durationSeconds: number;
  load: () => Promise<void>;
  play: (options?: { loop?: boolean }) => Promise<boolean>;
  stop: () => Promise<void>;
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

function createAudioHandle(path: string, durationSeconds = 1): FakeAudioHandle {
  return {
    path,
    durationSeconds,
    load: vi.fn(async (): Promise<void> => {}),
    play: vi.fn(async (): Promise<boolean> => true),
    stop: vi.fn(async (): Promise<void> => {}),
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
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("soundscape music runtime", () => {
  it("resolves authored audio paths into ordered track candidates", async () => {
    const calm = createAudioHandle("music/calm.ogg", 12);
    const battle = createAudioHandle("music/battle.ogg", 15);

    const candidates = await resolveMusicTrackCandidates({
      id: "program",
      name: "Program",
      audioPaths: ["music/calm.ogg", "music/battle.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }, async (path) => {
      if (path === "music/calm.ogg") return calm;
      if (path === "music/battle.ogg") return battle;
      return null;
    });

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      "music/calm.ogg",
      "music/battle.ogg",
    ]);
  });

  it("plays sequential tracks and respects delay before the next track", async () => {
    const timers = createFakeTimers();
    const first = createAudioHandle("music/town-a.ogg", 1);
    const second = createAudioHandle("music/town-b.ogg", 1);
    const program: SoundscapeMusicProgram = {
      id: "calm",
      name: "Calm",
      audioPaths: ["music/town-a.ogg", "music/town-b.ogg"],
      selectionMode: "sequential",
      delaySeconds: 5,
    };
    const runtime = new SoundscapeMusicRuntime({
      resolveAudioPath: async (path) => path === first.path ? first : second,
      timers: timers.api,
    });

    await runtime.sync(createResolvedState(program));

    expect(first.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "calm",
      activeAudioPath: "music/town-a.ogg",
      pendingDelayMs: null,
    });

    timers.runNext();
    await flushAsyncWork();

    expect(runtime.getSnapshot()).toMatchObject({
      activeAudioPath: null,
      pendingDelayMs: 5000,
    });

    timers.runNext();
    await flushAsyncWork();

    expect(second.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeAudioPath: "music/town-b.ogg",
      pendingDelayMs: null,
    });
  });

  it("uses duration populated during load when scheduling track completion", async () => {
    const timers = createFakeTimers();
    let durationSeconds = 0;
    const track = {
      path: "music/runtime-duration.ogg",
      get durationSeconds() {
        return durationSeconds;
      },
      load: vi.fn(async (): Promise<void> => {
        durationSeconds = 1.5;
      }),
      play: vi.fn(async (): Promise<boolean> => true),
      stop: vi.fn(async (): Promise<void> => {}),
    };
    const program: SoundscapeMusicProgram = {
      id: "runtime-duration",
      name: "Runtime Duration",
      audioPaths: [track.path],
      selectionMode: "sequential",
      delaySeconds: 0,
    };
    const runtime = new SoundscapeMusicRuntime({
      resolveAudioPath: async () => track,
      timers: timers.api,
    });

    await runtime.sync(createResolvedState(program));

    expect(timers.handles).toHaveLength(1);
    expect(timers.handles[0]?.delay).toBe(1500);
  });

  it("uses deterministic random selection without repeating immediately when alternatives exist", async () => {
    const timers = createFakeTimers();
    const handles = [
      createAudioHandle("music/a.ogg", 1),
      createAudioHandle("music/b.ogg", 1),
      createAudioHandle("music/c.ogg", 1),
    ];
    const rngValues = [0, 0];
    const runtime = new SoundscapeMusicRuntime({
      resolveAudioPath: async (path) => handles.find((entry) => entry.path === path) ?? null,
      random: () => rngValues.shift() ?? 0,
      timers: timers.api,
    });
    const program: SoundscapeMusicProgram = {
      id: "wild",
      name: "Wild",
      audioPaths: handles.map((handle) => handle.path),
      selectionMode: "random",
      delaySeconds: 0,
    };

    await runtime.sync(createResolvedState(program));
    timers.runNext();
    await flushAsyncWork();

    const playedPaths = handles
      .filter((handle) => (handle.play as unknown as { mock: { calls: unknown[][] } }).mock.calls.length > 0)
      .map((handle) => handle.path);
    expect(playedPaths).toEqual(["music/a.ogg", "music/b.ogg"]);
  });

  it("stops the previous track when switching programs", async () => {
    const calm = createAudioHandle("music/calm.ogg", 10);
    const battle = createAudioHandle("music/battle.ogg", 10);

    const runtime = new SoundscapeMusicRuntime({
      resolveAudioPath: async (path) => path === calm.path ? calm : battle,
    });

    await runtime.sync(createResolvedState({
      id: "calm",
      name: "Calm",
      audioPaths: [calm.path],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    await runtime.sync(createResolvedState({
      id: "battle",
      name: "Battle",
      audioPaths: [battle.path],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    expect(calm.stop).toHaveBeenCalledTimes(1);
    expect(battle.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeProgramId: "battle",
      activeAudioPath: "music/battle.ogg",
    });
  });

  it("reports a runtime error when no playable audio files can be resolved", async () => {
    const runtime = new SoundscapeMusicRuntime({
      resolveAudioPath: async () => null,
    });

    await runtime.sync(createResolvedState({
      id: "missing",
      name: "Missing",
      audioPaths: ["music/missing.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    }));

    expect(runtime.getSnapshot()).toMatchObject({
      activeAudioPath: null,
      lastError: 'No valid audio files could be resolved for music program "Missing".',
    });
  });
});
