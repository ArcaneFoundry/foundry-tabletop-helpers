import { describe, expect, it } from "vitest";

import {
  createEmptySoundscapeLibrarySnapshot,
  createPersistedSoundscapeLibrarySnapshot,
  normalizeSoundscapeLibrarySnapshot,
  normalizeSoundscapeSceneAssignment,
  normalizeSoundscapeTriggerContext,
  parseStoredSoundscapeLibrarySnapshot,
} from "./soundscape-normalization";
import { SOUNDSCAPE_LIBRARY_FORMAT_VERSION } from "./soundscape-types";

describe("soundscape normalization", () => {
  it("creates an empty snapshot fallback", () => {
    expect(createEmptySoundscapeLibrarySnapshot()).toMatchObject({
      formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
      profiles: {},
    });
  });

  it("normalizes malformed library data to safe defaults while preserving authored path order", () => {
    const snapshot = normalizeSoundscapeLibrarySnapshot({
      formatVersion: 1,
      profiles: {
        forest: {
          name: "Forest",
          musicPrograms: {
            calm: {
              audioPaths: ["sounds/one.ogg", "sounds/two.ogg", "sounds/one.ogg", 42, "sounds/three.ogg"],
              selectionMode: "weird",
              delaySeconds: -5,
            },
          },
          ambienceLayers: {
            birds: {
              mode: "random",
              audioPaths: ["sounds/wind.ogg", "", "sounds/rain.ogg", "sounds/wind.ogg"],
              minDelaySeconds: 8,
              maxDelaySeconds: 2,
            },
          },
          soundMoments: {
            sting: {
              audioPaths: ["sounds/sting.ogg", "sounds/chime.ogg", "sounds/sting.ogg"],
              selectionMode: "weird",
            },
          },
          rules: [
            {
              trigger: { type: "weather", weatherKeys: ["rain", "", "rain"] },
              musicProgramId: "calm",
            },
            {
              trigger: { type: "timeOfDay", timeOfDay: "bad" },
              ambienceLayerIds: null,
            },
          ],
        },
      },
    });

    expect(snapshot.formatVersion).toBe(SOUNDSCAPE_LIBRARY_FORMAT_VERSION);
    expect(snapshot.profiles.forest?.musicPrograms.calm).toMatchObject({
      audioPaths: ["sounds/one.ogg", "sounds/two.ogg", "sounds/three.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    });
    expect(snapshot.profiles.forest?.ambienceLayers.birds).toMatchObject({
      audioPaths: ["sounds/wind.ogg", "sounds/rain.ogg"],
      minDelaySeconds: 8,
      maxDelaySeconds: 8,
    });
    expect(snapshot.profiles.forest?.soundMoments.sting).toMatchObject({
      audioPaths: ["sounds/sting.ogg", "sounds/chime.ogg"],
      selectionMode: "single",
    });
    expect(snapshot.profiles.forest?.rules[0]?.trigger).toEqual({
      type: "weather",
      weatherKeys: ["rain"],
    });
    expect(snapshot.profiles.forest?.rules[1]?.trigger).toEqual({
      type: "timeOfDay",
      timeOfDay: "day",
    });
  });

  it("parses stored snapshots only at format version 2", () => {
    expect(parseStoredSoundscapeLibrarySnapshot({
      formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
      savedAt: "2026-03-27T00:00:00.000Z",
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
    })).toMatchObject({
      formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
      profiles: {
        forest: {
          id: "forest",
        },
      },
    });

    expect(parseStoredSoundscapeLibrarySnapshot({
      formatVersion: 1,
      savedAt: "2026-03-27T00:00:00.000Z",
      profiles: {},
    })).toBeNull();
  });

  it("drops invalid rule references during normalization", () => {
    const snapshot = normalizeSoundscapeLibrarySnapshot({
      profiles: {
        forest: {
          id: "forest",
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
              id: "combat",
              trigger: { type: "combat" },
              musicProgramId: "missing-program",
              ambienceLayerIds: ["birds", "missing-layer"],
            },
          ],
        },
      },
    });

    expect(snapshot.profiles.forest?.rules[0]).toEqual({
      id: "combat",
      trigger: { type: "combat" },
      ambienceLayerIds: ["birds"],
    });
  });

  it("normalizes scene assignment and preserves explicit null overrides", () => {
    expect(normalizeSoundscapeSceneAssignment({
      profileId: "forest",
      overrides: {
        musicProgramId: null,
        ambienceLayerIds: ["birds", "birds", ""],
      },
    })).toEqual({
      profileId: "forest",
      overrides: {
        musicProgramId: null,
        ambienceLayerIds: ["birds"],
      },
    });
  });

  it("normalizes trigger context defaults", () => {
    expect(normalizeSoundscapeTriggerContext({
      manualPreview: 1 as unknown as boolean,
      weather: "rain",
      timeOfDay: "weird" as unknown as "day",
    })).toEqual({
      manualPreview: true,
      inCombat: false,
      weather: "rain",
      timeOfDay: null,
    });
  });

  it("rejects unsupported stored snapshot versions", () => {
    expect(parseStoredSoundscapeLibrarySnapshot({
      formatVersion: 999,
      savedAt: "2026-03-27T00:00:00.000Z",
      profiles: {},
    })).toBeNull();
  });

  it("creates persisted snapshots in format version 2", () => {
    expect(createPersistedSoundscapeLibrarySnapshot({
      formatVersion: 1,
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
    }, "2026-03-28T00:00:00.000Z")).toMatchObject({
      formatVersion: SOUNDSCAPE_LIBRARY_FORMAT_VERSION,
      savedAt: "2026-03-28T00:00:00.000Z",
      profiles: {
        forest: {
          id: "forest",
        },
      },
    });
  });
});
