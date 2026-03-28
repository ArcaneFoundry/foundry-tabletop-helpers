import { describe, expect, it, vi } from "vitest";

import { SoundscapeAmbienceRuntime } from "./soundscape-ambience-runtime";
import type { ResolvedSoundscapeState, SoundscapeAmbienceLayer, SoundscapeSoundMoment } from "./soundscape-types";

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

describe("soundscape ambience runtime", () => {
  it("starts loop layers and prevents duplicate playback for shared audio paths", async () => {
    const wind = createAudioHandle("ambience/wind.ogg");
    const birds = createAudioHandle("ambience/birds.ogg");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveAudioPath: async (path) => {
        if (path === wind.path) return wind;
        if (path === birds.path) return birds;
        return null;
      },
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [
        {
          id: "forest-loop",
          name: "Forest Loop",
          mode: "loop",
          audioPaths: [wind.path, birds.path],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
        {
          id: "mist-loop",
          name: "Mist Loop",
          mode: "loop",
          audioPaths: [wind.path],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      ],
    }));

    expect(wind.play).toHaveBeenCalledTimes(1);
    expect(birds.play).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["forest-loop", "mist-loop"],
      loopAudioPaths: ["ambience/birds.ogg", "ambience/wind.ogg"],
      randomLayerIds: [],
    });
  });

  it("restarts a shared loop for the remaining layer when the original owner is removed", async () => {
    const wind = createAudioHandle("ambience/wind.ogg");
    const runtime = new SoundscapeAmbienceRuntime({
      resolveAudioPath: async () => wind,
    });

    await runtime.sync(createResolvedState({
      ambienceLayers: [
        {
          id: "forest-loop",
          name: "Forest Loop",
          mode: "loop",
          audioPaths: [wind.path],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
        {
          id: "mist-loop",
          name: "Mist Loop",
          mode: "loop",
          audioPaths: [wind.path],
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
          audioPaths: [wind.path],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      ],
    }));

    expect(wind.play).toHaveBeenCalledTimes(2);
    expect(wind.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toMatchObject({
      activeLayerIds: ["mist-loop"],
      loopAudioPaths: ["ambience/wind.ogg"],
    });
  });

  it("schedules random ambience layers and avoids immediate repeats when alternatives exist", async () => {
    const timers = createFakeTimers();
    const gustA = createAudioHandle("ambience/gust-a.ogg", 2);
    const gustB = createAudioHandle("ambience/gust-b.ogg", 2);
    const randomValues = [0, 0, 0];
    const runtime = new SoundscapeAmbienceRuntime({
      resolveAudioPath: async (path) => {
        if (path === gustA.path) return gustA;
        if (path === gustB.path) return gustB;
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
        audioPaths: [gustA.path, gustB.path],
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
    }));

    timers.runNext();
    await flushAsyncWork();

    expect(runtime.getSnapshot()).toMatchObject({
      activeRandomAudioPaths: ["ambience/gust-a.ogg"],
    });

    timers.runNext();
    await flushAsyncWork();
    timers.runNext();
    await flushAsyncWork();

    expect(runtime.getSnapshot()).toMatchObject({
      activeRandomAudioPaths: ["ambience/gust-b.ogg"],
    });
  });

  it("plays manual moments using direct audio paths", async () => {
    const sting = createAudioHandle("moments/sting.ogg", 1);
    const runtime = new SoundscapeAmbienceRuntime({
      resolveAudioPath: async () => sting,
    });

    const result = await runtime.playMoment({
      id: "sting",
      name: "Sting",
      audioPaths: [sting.path],
      selectionMode: "single",
    });

    expect(result).toEqual({
      momentId: "sting",
      audioPath: "moments/sting.ogg",
      played: true,
      error: null,
    });
    expect(sting.play).toHaveBeenCalledTimes(1);
  });

  it("reports missing audio paths cleanly", async () => {
    const runtime = new SoundscapeAmbienceRuntime({
      resolveAudioPath: async () => null,
    });

    const result = await runtime.playMoment({
      id: "missing",
      name: "Missing",
      audioPaths: ["moments/missing.ogg"],
      selectionMode: "single",
    });

    expect(result).toEqual({
      momentId: "missing",
      audioPath: "moments/missing.ogg",
      played: false,
      error: 'Sound moment "Missing" could not resolve audio path "moments/missing.ogg".',
    });
  });
});
