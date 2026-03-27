import { describe, expect, it, vi } from "vitest";

import { SoundscapeAmbienceRuntime } from "./soundscape-ambience-runtime";
import type { ResolvedSoundscapeState, SoundscapeAmbienceLayer, SoundscapeSoundMoment } from "./soundscape-types";

interface FakeTimerHandle {
  callback: () => void;
  delay: number;
  cleared: boolean;
}

interface FakeSound {
  duration?: number;
  playing?: boolean;
  play: (options?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<unknown>;
}

interface FakeSoundDocument {
  id: string;
  uuid: string;
  name: string;
  path: string;
  sound: FakeSound;
  load: () => Promise<void>;
  sync: () => void;
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

function createSoundDocument(uuid: string, durationSeconds = 1): FakeSoundDocument {
  const play = vi.fn(async (_options?: Record<string, unknown>): Promise<void> => {});
  const stop = vi.fn(async (): Promise<void> => {});
  const load = vi.fn(async (): Promise<void> => {});
  const sync = vi.fn((): void => {});

  return {
    id: uuid.split(".").at(-1) ?? uuid,
    uuid,
    name: uuid,
    path: `sounds/${uuid}.ogg`,
    sound: {
      duration: durationSeconds,
      play,
      stop,
    },
    load,
    sync,
  };
}

function createResolvedState(options: {
  profileId?: string;
  ambienceLayers?: SoundscapeAmbienceLayer[];
  soundMoments?: SoundscapeSoundMoment[];
} = {}): ResolvedSoundscapeState {
  return {
    profileId: options.profileId ?? "forest",
    assignmentSource: "worldDefault",
    sceneId: "scene-1",
    context: {
      manualPreview: false,
      inCombat: false,
      weather: null,
      timeOfDay: null,
    },
    musicProgramId: null,
    musicProgram: null,
    musicRuleId: null,
    ambienceLayerIds: (options.ambienceLayers ?? []).map((layer) => layer.id),
    ambienceLayers: options.ambienceLayers ?? [],
    ambienceRuleId: "base",
    soundMoments: options.soundMoments ?? [],
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("soundscape ambience runtime", () => {
  it("starts loop layers and prevents duplicate ambience playback for shared sources", async () => {
    const wind = createSoundDocument("PlaylistSound.wind");
    const birds = createSoundDocument("PlaylistSound.birds");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async (uuid) => {
        if (uuid === "PlaylistSound.wind") return wind;
        if (uuid === "PlaylistSound.birds") return birds;
        return null;
      },
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [
        {
          id: "forest-loop",
          name: "Forest Loop",
          mode: "loop",
          soundUuids: ["PlaylistSound.wind", "PlaylistSound.birds"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
        {
          id: "mist-loop",
          name: "Mist Loop",
          mode: "loop",
          soundUuids: ["PlaylistSound.wind"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      ],
    }));

    expect(wind.sound.play).toHaveBeenCalledTimes(1);
    expect(birds.sound.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["forest-loop", "mist-loop"],
      loopSoundUuids: ["PlaylistSound.birds", "PlaylistSound.wind"],
      randomLayerIds: [],
    });
  });

  it("restarts a shared loop for the remaining layer when the original owner is removed", async () => {
    const wind = createSoundDocument("PlaylistSound.wind");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => wind,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [
        {
          id: "forest-loop",
          name: "Forest Loop",
          mode: "loop",
          soundUuids: ["PlaylistSound.wind"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
        {
          id: "mist-loop",
          name: "Mist Loop",
          mode: "loop",
          soundUuids: ["PlaylistSound.wind"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      ],
    }));

    await runtime.sync(createResolvedState({
      ambienceLayers: [
        {
          id: "mist-loop",
          name: "Mist Loop",
          mode: "loop",
          soundUuids: ["PlaylistSound.wind"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      ],
    }));

    expect(wind.sound.play).toHaveBeenCalledTimes(2);
    expect(wind.sound.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["mist-loop"],
      loopSoundUuids: ["PlaylistSound.wind"],
    });
  });

  it("schedules random ambience layers and avoids immediate repeats when alternatives exist", async () => {
    const timers = createFakeTimers();
    const gustA = createSoundDocument("PlaylistSound.gust-a", 2);
    const gustB = createSoundDocument("PlaylistSound.gust-b", 2);
    const randomValues = [0, 0, 0];
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async (uuid) => {
        if (uuid === "PlaylistSound.gust-a") return gustA;
        if (uuid === "PlaylistSound.gust-b") return gustB;
        return null;
      },
      timers: timers.api,
      random: () => randomValues.shift() ?? 0,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [{
        id: "winds",
        name: "Winds",
        mode: "random",
        soundUuids: ["PlaylistSound.gust-a", "PlaylistSound.gust-b"],
        minDelaySeconds: 1,
        maxDelaySeconds: 3,
      }],
    }));

    expect(timers.handles[0]?.delay).toBe(1000);

    timers.runNext();
    await flushAsyncWork();

    expect(gustA.sound.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeRandomSoundUuids: ["PlaylistSound.gust-a"],
      pendingRandomLayerIds: [],
    });

    timers.runNext();
    await flushAsyncWork();

    expect(timers.handles.find((handle) => !handle.cleared)?.delay).toBe(1000);

    timers.runNext();
    await flushAsyncWork();

    expect(gustB.sound.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeRandomSoundUuids: ["PlaylistSound.gust-b"],
    });
  });

  it("cleans up obsolete loops, active random playback, and timers when ambience changes", async () => {
    const timers = createFakeTimers();
    const rain = createSoundDocument("PlaylistSound.rain", 10);
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => rain,
      timers: timers.api,
      random: () => 0,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [{
        id: "rain-loop",
        name: "Rain Loop",
        mode: "loop",
        soundUuids: ["PlaylistSound.rain"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }, {
        id: "rain-hits",
        name: "Rain Hits",
        mode: "random",
        soundUuids: ["PlaylistSound.rain"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    }));

    timers.runNext();
    await flushAsyncWork();

    await runtime.sync(createResolvedState({
      ambienceLayers: [],
    }));

    expect(rain.sound.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeAmbienceKey: null,
      activeLayerIds: [],
      loopSoundUuids: [],
      pendingRandomLayerIds: [],
    });
    expect(timers.handles.every((handle) => handle.cleared)).toBe(true);
  });

  it("plays manual sound moments on demand without mutating ambience state", async () => {
    const sting = createSoundDocument("PlaylistSound.sting");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => sting,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [{
        id: "forest-loop",
        name: "Forest Loop",
        mode: "loop",
        soundUuids: ["PlaylistSound.sting"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
      soundMoments: [{
        id: "sting",
        name: "Sting",
        soundUuids: ["PlaylistSound.sting"],
        selectionMode: "single",
      }],
    }));

    const before = runtime.getSnapshot();
    const result = await runtime.playMomentFromState(createResolvedState({
      soundMoments: [{
        id: "sting",
        name: "Sting",
        soundUuids: ["PlaylistSound.sting"],
        selectionMode: "single",
      }],
    }), "sting");

    expect(result).toEqual({
      momentId: "sting",
      soundUuid: "PlaylistSound.sting",
      played: true,
      error: null,
    });
    expect(sting.sound.play).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual(before);
  });

  it("does not start a loop after its layer is removed while sound resolution is still pending", async () => {
    const deferred = createDeferred<FakeSoundDocument | null>();
    const wind = createSoundDocument("PlaylistSound.wind");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => await deferred.promise,
    });

    const startingSync = runtime.sync(createResolvedState({
      ambienceLayers: [{
        id: "forest-loop",
        name: "Forest Loop",
        mode: "loop",
        soundUuids: ["PlaylistSound.wind"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    }));
    await flushAsyncWork();

    const stoppingSync = runtime.sync(createResolvedState({ ambienceLayers: [] }));
    deferred.resolve(wind);

    await startingSync;
    await stoppingSync;

    expect(wind.sound.play).not.toHaveBeenCalled();
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: [],
      loopSoundUuids: [],
    });
  });

  it("does not start random ambience after its layer is removed while sound resolution is still pending", async () => {
    const timers = createFakeTimers();
    const deferred = createDeferred<FakeSoundDocument | null>();
    const rain = createSoundDocument("PlaylistSound.rain");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => await deferred.promise,
      timers: timers.api,
      random: () => 0,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [{
        id: "rain-hits",
        name: "Rain Hits",
        mode: "random",
        soundUuids: ["PlaylistSound.rain"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    }));

    timers.runNext();
    await flushAsyncWork();

    const stoppingSync = runtime.sync(createResolvedState({ ambienceLayers: [] }));
    deferred.resolve(rain);

    await stoppingSync;
    await flushAsyncWork();

    expect(rain.sound.play).not.toHaveBeenCalled();
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: [],
      activeRandomSoundUuids: [],
      pendingRandomLayerIds: [],
    });
  });

  it("does not double-start the same loop when sync is called again during pending startup", async () => {
    const deferred = createDeferred<FakeSoundDocument | null>();
    const wind = createSoundDocument("PlaylistSound.wind");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => await deferred.promise,
    });
    const state = createResolvedState({
      ambienceLayers: [{
        id: "forest-loop",
        name: "Forest Loop",
        mode: "loop",
        soundUuids: ["PlaylistSound.wind"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    });

    const firstSync = runtime.sync(state);
    await flushAsyncWork();
    const secondSync = runtime.sync(state);
    deferred.resolve(wind);

    await firstSync;
    await secondSync;

    expect(wind.sound.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["forest-loop"],
      loopSoundUuids: ["PlaylistSound.wind"],
    });
  });

  it("does not reschedule the same random layer while startup is already pending", async () => {
    const timers = createFakeTimers();
    const deferred = createDeferred<FakeSoundDocument | null>();
    const rain = createSoundDocument("PlaylistSound.rain");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveSoundByUuid: async () => await deferred.promise,
      timers: timers.api,
      random: () => 0,
    });
    const state = createResolvedState({
      ambienceLayers: [{
        id: "rain-hits",
        name: "Rain Hits",
        mode: "random",
        soundUuids: ["PlaylistSound.rain"],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    });

    await runtime.sync(state);
    timers.runNext();
    await flushAsyncWork();

    await runtime.sync(state);

    deferred.resolve(rain);
    await flushAsyncWork();
    await flushAsyncWork();

    expect(rain.sound.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["rain-hits"],
      activeRandomSoundUuids: ["PlaylistSound.rain"],
      pendingRandomLayerIds: [],
    });
  });
});
