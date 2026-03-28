import { afterEach, describe, expect, it, vi } from "vitest";

import { __soundscapeAudioPlaybackInternals, resolveAudioPathPlayback } from "./soundscape-audio-playback";

describe("soundscape audio playback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("refreshes duration metadata after load completes", async () => {
    let duration = 0;
    const sound = {
      get duration() {
        return duration;
      },
      load: vi.fn(async (): Promise<void> => {
        duration = 13.25;
      }),
      play: vi.fn(async (): Promise<void> => {}),
      stop: vi.fn(async (): Promise<void> => {}),
    };

    vi.stubGlobal("foundry", {
      audio: {
        Sound: {
          create: vi.fn(async () => sound),
        },
      },
    });

    const handle = await resolveAudioPathPlayback("music/runtime.ogg");

    expect(handle).not.toBeNull();
    expect(handle?.durationSeconds).toBe(0);

    await handle?.load();

    expect(handle?.durationSeconds).toBe(13.25);
  });

  it("uses the Foundry v13 constructor fallback with the raw string path", async () => {
    const constructorCalls: Array<{ src: string; options: Record<string, unknown> | undefined }> = [];

    class SoundConstructorFallback {
      duration = 4;

      constructor(src: string, options?: Record<string, unknown>) {
        constructorCalls.push({ src, options });
      }

      async load(): Promise<void> {}

      async play(): Promise<void> {}

      async stop(): Promise<void> {}
    }

    vi.stubGlobal("foundry", {
      audio: {
        Sound: SoundConstructorFallback,
      },
    });

    const sound = await __soundscapeAudioPlaybackInternals.createRuntimeSound("music/v13-track.ogg");
    const handle = await resolveAudioPathPlayback("music/v13-track.ogg");

    expect(sound).toBeInstanceOf(SoundConstructorFallback);
    expect(constructorCalls).toEqual([
      { src: "music/v13-track.ogg", options: undefined },
      { src: "music/v13-track.ogg", options: undefined },
    ]);
    expect(handle).not.toBeNull();
    expect(handle?.path).toBe("music/v13-track.ogg");
    expect(handle?.durationSeconds).toBe(4);
  });

  it("does not pass an object-shaped source through the constructor fallback", async () => {
    class GuardedSoundConstructor {
      duration = 2;

      constructor(src: string) {
        if (typeof src !== "string") {
          throw new Error(`Expected string source, received ${String(src)}`);
        }
      }

      async load(): Promise<void> {}

      async play(): Promise<void> {}

      async stop(): Promise<void> {}
    }

    vi.stubGlobal("foundry", {
      audio: {
        Sound: GuardedSoundConstructor,
      },
    });

    await expect(resolveAudioPathPlayback("moments/sting.ogg")).resolves.toMatchObject({
      path: "moments/sting.ogg",
      durationSeconds: 2,
    });
  });
});
