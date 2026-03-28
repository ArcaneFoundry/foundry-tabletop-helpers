import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAudioPathPlayback } from "./soundscape-audio-playback";

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
});
