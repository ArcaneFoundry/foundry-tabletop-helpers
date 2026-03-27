import { describe, expect, it } from "vitest";

import {
  createEmptySoundscapeLibrarySnapshot,
  normalizeSoundscapeLibrarySnapshot,
  normalizeSoundscapeSceneAssignment,
  normalizeSoundscapeTriggerContext,
  parseStoredSoundscapeLibrarySnapshot,
} from "./soundscape-normalization";

describe("soundscape normalization", () => {
  it("creates an empty snapshot fallback", () => {
    expect(createEmptySoundscapeLibrarySnapshot()).toMatchObject({
      formatVersion: 1,
      profiles: {},
    });
  });

  it("normalizes malformed library data to safe defaults", () => {
    const snapshot = normalizeSoundscapeLibrarySnapshot({
      profiles: {
        forest: {
          name: "Forest",
          musicPrograms: {
            calm: {
              playlistUuids: ["Playlist.one", "Playlist.one", 42],
              selectionMode: "weird",
              delaySeconds: -5,
            },
          },
          ambienceLayers: {
            birds: {
              mode: "random",
              soundUuids: ["PlaylistSound.one", "", "PlaylistSound.one"],
              minDelaySeconds: 8,
              maxDelaySeconds: 2,
            },
          },
          soundMoments: {
            sting: {
              soundUuids: ["PlaylistSound.sting"],
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

    expect(snapshot.profiles.forest?.musicPrograms.calm).toMatchObject({
      playlistUuids: ["Playlist.one"],
      selectionMode: "sequential",
      delaySeconds: 0,
    });
    expect(snapshot.profiles.forest?.ambienceLayers.birds).toMatchObject({
      soundUuids: ["PlaylistSound.one"],
      minDelaySeconds: 8,
      maxDelaySeconds: 8,
    });
    expect(snapshot.profiles.forest?.soundMoments.sting?.selectionMode).toBe("single");
    expect(snapshot.profiles.forest?.rules[0]?.trigger).toEqual({
      type: "weather",
      weatherKeys: ["rain"],
    });
    expect(snapshot.profiles.forest?.rules[1]?.trigger).toEqual({
      type: "timeOfDay",
      timeOfDay: "day",
    });
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
              playlistUuids: ["Playlist.calm"],
              selectionMode: "sequential",
              delaySeconds: 0,
            },
          },
          ambienceLayers: {
            birds: {
              id: "birds",
              name: "Birds",
              mode: "loop",
              soundUuids: ["PlaylistSound.birds"],
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
});
