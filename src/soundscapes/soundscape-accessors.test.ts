import { afterEach, describe, expect, it, vi } from "vitest";

import { MOD } from "../logger";
import {
  getSceneSoundscapeAssignment,
  getStoredSoundscapeLibrarySnapshot,
  getSoundscapeLibrarySnapshot,
  getSoundscapeWorldDefaultProfileId,
  resolveStoredSoundscapeState,
  setSceneSoundscapeAssignment,
  setSoundscapeLibrarySnapshot,
  setSoundscapeWorldDefaultProfileId,
} from "./soundscape-accessors";
import { SOUNDSCAPE_FLAGS, SOUNDSCAPE_SETTINGS } from "./soundscape-settings-shared";

describe("soundscape accessors", () => {
  const originalGame = (globalThis as Record<string, unknown>).game;

  afterEach(() => {
    (globalThis as Record<string, unknown>).game = originalGame;
  });

  it("round-trips the hidden world settings", async () => {
    const store = new Map<string, unknown>();
    (globalThis as Record<string, unknown>).game = {
      version: "13.351",
      system: { id: "dnd5e", version: "5.3.1" },
      modules: new Map([[MOD, { version: "1.2.1", active: true, id: MOD }]]),
      settings: {
        get(module: string, key: string) {
          return store.get(`${module}.${key}`);
        },
        async set(module: string, key: string, value: unknown) {
          store.set(`${module}.${key}`, value);
          return value;
        },
      },
    };

    await setSoundscapeLibrarySnapshot({
      profiles: {
        forest: {
          id: "forest",
          name: "Forest",
          musicPrograms: {},
          ambienceLayers: {},
          soundMoments: {},
          rules: [],
        },
      },
    });
    await setSoundscapeWorldDefaultProfileId("forest");

    expect(getStoredSoundscapeLibrarySnapshot()).toMatchObject({
      formatVersion: 2,
      profiles: {
        forest: {
          id: "forest",
        },
      },
    });
    expect(getSoundscapeWorldDefaultProfileId()).toBe("forest");
    expect(store.get(`${MOD}.${SOUNDSCAPE_SETTINGS.LIBRARY}`)).toEqual(expect.any(String));
    expect(store.get(`${MOD}.${SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID}`)).toBe("forest");
  });

  it("falls back to an empty snapshot for invalid stored json", () => {
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === SOUNDSCAPE_SETTINGS.LIBRARY) return "{bad";
          return undefined;
        },
      },
    };

    expect(getStoredSoundscapeLibrarySnapshot()).toBeNull();
    expect(getSoundscapeLibrarySnapshot().profiles).toEqual({});
  });

  it("falls back to an empty snapshot for unsupported stored snapshot versions", () => {
    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === SOUNDSCAPE_SETTINGS.LIBRARY) {
            return JSON.stringify({
              formatVersion: 999,
              savedAt: "2026-03-27T00:00:00.000Z",
              profiles: {},
            });
          }
          return undefined;
        },
      },
    };

    expect(getStoredSoundscapeLibrarySnapshot()).toBeNull();
    expect(getSoundscapeLibrarySnapshot().profiles).toEqual({});
  });

  it("reads and writes scene assignment flags", async () => {
    const flags = new Map<string, unknown>();
    const setFlagMock = vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags.set(key, value);
      return value;
    });
    const unsetFlagMock = vi.fn(async (_scope: string, key: string) => {
      flags.delete(key);
      return true;
    });
    const scene = {
      id: "scene-1",
      getFlag(_scope: string, key: string) {
        return flags.get(key);
      },
      setFlag: setFlagMock,
      unsetFlag: unsetFlagMock,
    };

    await setSceneSoundscapeAssignment(scene, {
      profileId: "forest",
      overrides: {
        musicProgramId: null,
        ambienceLayerIds: ["birds"],
      },
    });

    expect(getSceneSoundscapeAssignment(scene)).toEqual({
      profileId: "forest",
      overrides: {
        musicProgramId: null,
        ambienceLayerIds: ["birds"],
      },
    });

    await setSceneSoundscapeAssignment(scene, null);

    expect(unsetFlagMock).toHaveBeenCalledWith(MOD, SOUNDSCAPE_FLAGS.PROFILE_ID);
    expect(unsetFlagMock).toHaveBeenCalledWith(MOD, SOUNDSCAPE_FLAGS.OVERRIDES);
    expect(getSceneSoundscapeAssignment(scene)).toBeNull();
  });

  it("resolves against world default when a scene has no direct assignment", () => {
    const store = new Map<string, unknown>();
    store.set(`${MOD}.${SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID}`, "forest");
    store.set(`${MOD}.${SOUNDSCAPE_SETTINGS.LIBRARY}`, JSON.stringify({
      formatVersion: 2,
      savedAt: "2026-03-27T00:00:00.000Z",
      profiles: {
        forest: {
          id: "forest",
          name: "Forest",
          musicPrograms: {
            calm: {
              id: "calm",
              name: "Calm",
              audioPaths: ["music/forest.ogg"],
              selectionMode: "sequential",
              delaySeconds: 0,
            },
          },
          ambienceLayers: {},
          soundMoments: {},
          rules: [
            {
              id: "base",
              trigger: { type: "base" },
              musicProgramId: "calm",
            },
          ],
        },
      },
    }));

    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          return store.get(`${module}.${key}`);
        },
      },
      scenes: {
        get: () => undefined,
        find: () => undefined,
      },
    };

    expect(resolveStoredSoundscapeState()).toMatchObject({
      assignmentSource: "worldDefault",
      profileId: "forest",
      musicProgramId: "calm",
    });
  });

  it("applies scene overrides when resolution falls back to the world default profile", () => {
    const store = new Map<string, unknown>();
    store.set(`${MOD}.${SOUNDSCAPE_SETTINGS.WORLD_DEFAULT_PROFILE_ID}`, "forest");
    store.set(`${MOD}.${SOUNDSCAPE_SETTINGS.LIBRARY}`, JSON.stringify({
      formatVersion: 2,
      savedAt: "2026-03-27T00:00:00.000Z",
      profiles: {
        forest: {
          id: "forest",
          name: "Forest",
          musicPrograms: {
            calm: {
              id: "calm",
              name: "Calm",
              audioPaths: ["music/calm.ogg"],
              selectionMode: "sequential",
              delaySeconds: 0,
            },
          },
          ambienceLayers: {
            birds: {
              id: "birds",
              name: "Birds",
              mode: "loop",
              audioPaths: ["ambience/birds.ogg"],
              minDelaySeconds: 0,
              maxDelaySeconds: 0,
            },
          },
          soundMoments: {},
          rules: [
            {
              id: "base",
              trigger: { type: "base" },
              musicProgramId: "calm",
              ambienceLayerIds: ["birds"],
            },
          ],
        },
      },
    }));

    const flags = new Map<string, unknown>([
      [SOUNDSCAPE_FLAGS.OVERRIDES, { musicProgramId: null }],
    ]);

    (globalThis as Record<string, unknown>).game = {
      settings: {
        get(module: string, key: string) {
          return store.get(`${module}.${key}`);
        },
      },
      scenes: {
        get: () => undefined,
        find: () => ({
          id: "scene-1",
          active: true,
          getFlag(_scope: string, key: string) {
            return flags.get(key);
          },
        }),
      },
    };

    expect(resolveStoredSoundscapeState()).toMatchObject({
      assignmentSource: "worldDefault",
      profileId: "forest",
      musicProgramId: null,
      musicRuleId: "scene-override",
      ambienceLayerIds: ["birds"],
    });
  });
});
