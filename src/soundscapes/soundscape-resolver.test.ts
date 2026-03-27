import { describe, expect, it } from "vitest";

import { resolveSoundscapeState } from "./soundscape-resolver";
import type { PersistentSoundscapeLibrarySnapshot } from "./soundscape-types";

function makeLibrary(): PersistentSoundscapeLibrarySnapshot {
  return {
    formatVersion: 1,
    savedAt: "2026-03-27T00:00:00.000Z",
    profiles: {
      forest: {
        id: "forest",
        name: "Forest",
        musicPrograms: {
          calm: {
            id: "calm",
            name: "Calm",
            playlistUuids: ["Playlist.calm"],
            selectionMode: "sequential",
            delaySeconds: 0,
          },
          battle: {
            id: "battle",
            name: "Battle",
            playlistUuids: ["Playlist.battle"],
            selectionMode: "random",
            delaySeconds: 5,
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
          rain: {
            id: "rain",
            name: "Rain",
            mode: "loop",
            soundUuids: ["PlaylistSound.rain"],
            minDelaySeconds: 0,
            maxDelaySeconds: 0,
          },
        },
        soundMoments: {
          sting: {
            id: "sting",
            name: "Sting",
            soundUuids: ["PlaylistSound.sting"],
            selectionMode: "single",
          },
        },
        rules: [
          {
            id: "base",
            trigger: { type: "base" },
            musicProgramId: "calm",
            ambienceLayerIds: ["birds"],
          },
          {
            id: "night",
            trigger: { type: "timeOfDay", timeOfDay: "night" },
            ambienceLayerIds: [],
          },
          {
            id: "weather-rain",
            trigger: { type: "weather", weatherKeys: ["rain"] },
            ambienceLayerIds: ["rain"],
          },
          {
            id: "combat",
            trigger: { type: "combat" },
            musicProgramId: "battle",
          },
        ],
      },
    },
  };
}

describe("soundscape resolver", () => {
  it("resolves the base state", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      worldDefaultProfileId: "forest",
    })).toMatchObject({
      profileId: "forest",
      musicProgramId: "calm",
      ambienceLayerIds: ["birds"],
      musicRuleId: "base",
      ambienceRuleId: "base",
    });
  });

  it("uses precedence and per-channel fallback independently", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      worldDefaultProfileId: "forest",
      context: {
        inCombat: true,
        weather: "rain",
        timeOfDay: "night",
      },
    })).toMatchObject({
      musicProgramId: "battle",
      musicRuleId: "combat",
      ambienceLayerIds: ["rain"],
      ambienceRuleId: "weather-rain",
    });
  });

  it("supports explicit scene overrides for base fallback", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      sceneAssignment: {
        profileId: "forest",
        overrides: {
          musicProgramId: null,
        },
      },
    })).toMatchObject({
      assignmentSource: "scene",
      musicProgramId: null,
      musicRuleId: "scene-override",
      ambienceLayerIds: ["birds"],
    });
  });

  it("falls back to world default when the scene profile is missing", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      sceneAssignment: {
        profileId: "missing",
      },
      worldDefaultProfileId: "forest",
    })).toMatchObject({
      assignmentSource: "worldDefault",
      profileId: "forest",
    });
  });

  it("applies scene overrides even when the profile comes from world-default fallback", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      sceneAssignment: {
        profileId: null,
        overrides: {
          musicProgramId: null,
        },
      },
      worldDefaultProfileId: "forest",
    })).toMatchObject({
      assignmentSource: "worldDefault",
      profileId: "forest",
      musicProgramId: null,
      musicRuleId: "scene-override",
      ambienceLayerIds: ["birds"],
    });
  });

  it("returns null when no profile can be resolved", () => {
    expect(resolveSoundscapeState({
      library: makeLibrary(),
      worldDefaultProfileId: "missing",
    })).toBeNull();
  });
});
