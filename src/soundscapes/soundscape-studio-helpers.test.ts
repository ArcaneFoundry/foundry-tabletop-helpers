import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistentSoundscapeLibrarySnapshot, SoundscapeSceneAssignment } from "./soundscape-types";
import {
  createSoundscapeAmbienceLayer,
  createSoundscapeMusicProgram,
  createSoundscapeProfile,
  createSoundscapeRule,
  createSoundscapeSoundMoment,
  duplicateSoundscapeProfile,
  removeProfileFromLibrary,
  replaceProfileInLibrary,
  resolveSoundscapeStudioPreview,
  sanitizeSceneAssignmentsForProfileDeletion,
  updateStudioSceneAssignmentProfile,
  validateSoundscapeStudioData,
} from "./soundscape-studio-helpers";

const { isAudioPathResolvableMock } = vi.hoisted(() => ({
  isAudioPathResolvableMock: vi.fn(),
}));

vi.mock("./soundscape-audio-playback", () => ({
  isAudioPathResolvable: isAudioPathResolvableMock,
}));

vi.mock("../types", () => ({
  getGame: vi.fn(() => ({
    playlists: [],
  })),
}));

function makeSnapshot(): PersistentSoundscapeLibrarySnapshot {
  return {
    formatVersion: 2,
    savedAt: "2026-03-27T00:00:00.000Z",
    profiles: {},
  };
}

describe("soundscape studio helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAudioPathResolvableMock.mockResolvedValue(true);
  });

  it("creates and duplicates profiles with base rules and unique ids", () => {
    const profile = createSoundscapeProfile([]);
    expect(profile.id).toBe("new-soundscape");
    expect(profile.rules).toEqual([{ id: "base", trigger: { type: "base" } }]);

    const duplicate = duplicateSoundscapeProfile(profile, [profile.id]);
    expect(duplicate.id).toBe("new-soundscape-copy");
    expect(duplicate.name).toBe("New Soundscape Copy");
    expect(duplicate.rules).toEqual(profile.rules);
  });

  it("creates child entities with stable ids and audio path arrays", () => {
    expect(createSoundscapeMusicProgram([])).toMatchObject({ id: "new-music-program", audioPaths: [] });
    expect(createSoundscapeAmbienceLayer([])).toMatchObject({ id: "new-ambience-layer", audioPaths: [] });
    expect(createSoundscapeSoundMoment([])).toMatchObject({ id: "new-sound-moment", audioPaths: [] });
    expect(createSoundscapeRule([]).id).toBe("soundscape-rule");
  });

  it("replaces and removes profiles in library snapshots", () => {
    const profile = createSoundscapeProfile([]);
    const snapshot = replaceProfileInLibrary(makeSnapshot(), profile);

    expect(snapshot.profiles[profile.id]).toEqual(profile);

    const removed = removeProfileFromLibrary(snapshot, profile.id);
    expect(removed.profiles).toEqual({});
  });

  it("clears scene assignments that pointed at a deleted profile", () => {
    const assignments: Record<string, SoundscapeSceneAssignment | null> = {
      sceneA: { profileId: "alpha" },
      sceneB: { profileId: "beta" },
      sceneC: null,
    };

    expect(sanitizeSceneAssignmentsForProfileDeletion(assignments, "alpha")).toEqual({
      sceneA: null,
      sceneB: { profileId: "beta" },
      sceneC: null,
    });
  });

  it("preserves scene overrides when changing assignment targets", () => {
    expect(updateStudioSceneAssignmentProfile({
      profileId: "alpha",
      overrides: { musicProgramId: "music-1" },
    }, "beta")).toEqual({
      profileId: "beta",
      overrides: { musicProgramId: "music-1" },
    });

    expect(updateStudioSceneAssignmentProfile({
      profileId: "alpha",
      overrides: { ambienceLayerIds: ["wind"] },
    }, null)).toEqual({
      profileId: null,
      overrides: { ambienceLayerIds: ["wind"] },
    });
  });

  it("accepts a valid authored soundscape payload", async () => {
    const profile = createSoundscapeProfile([]);
    profile.musicPrograms.score = {
      id: "score",
      name: "Town Music",
      audioPaths: ["music/town.ogg"],
      selectionMode: "random",
      delaySeconds: 12,
    };
    profile.ambienceLayers.wind = {
      id: "wind",
      name: "Cold Wind",
      mode: "random",
      audioPaths: ["ambience/wind.ogg"],
      minDelaySeconds: 5,
      maxDelaySeconds: 15,
    };
    profile.soundMoments.stinger = {
      id: "stinger",
      name: "Door Slam",
      audioPaths: ["moments/stinger.ogg"],
      selectionMode: "single",
    };
    profile.rules = [
      { id: "base", trigger: { type: "base" }, musicProgramId: "score", ambienceLayerIds: ["wind"] },
      { id: "combat", trigger: { type: "combat" }, musicProgramId: null },
    ];

    const snapshot = replaceProfileInLibrary(makeSnapshot(), profile);
    const result = await validateSoundscapeStudioData(snapshot, profile.id, {
      sceneA: { profileId: profile.id },
    });

    expect(result).toEqual({
      isValid: true,
      messages: [],
    });
  });

  it("validates audio paths by indexed path and only resolves each unique path once", async () => {
    const profile = createSoundscapeProfile([]);
    profile.musicPrograms.score = {
      id: "score",
      name: "Town Music",
      audioPaths: ["  ", "shared/audio.ogg", "music/missing.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    };
    profile.ambienceLayers.wind = {
      id: "wind",
      name: "Cold Wind",
      mode: "loop",
      audioPaths: ["shared/audio.ogg", "ambience/missing.ogg"],
      minDelaySeconds: 0,
      maxDelaySeconds: 0,
    };
    profile.soundMoments.stinger = {
      id: "stinger",
      name: "Door Slam",
      audioPaths: ["shared/audio.ogg", " "],
      selectionMode: "single",
    };
    profile.rules = [
      { id: "base", trigger: { type: "base" }, musicProgramId: "score", ambienceLayerIds: ["wind"] },
    ];

    const snapshot = replaceProfileInLibrary(makeSnapshot(), profile);
    isAudioPathResolvableMock.mockImplementation(async (audioPath: string) => audioPath === "shared/audio.ogg");

    const result = await validateSoundscapeStudioData(snapshot, null, {});

    expect(result.isValid).toBe(false);
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "profiles.new-soundscape.musicPrograms.score.audioPaths.0",
        message: "Music program audio paths cannot be blank.",
      }),
      expect.objectContaining({
        path: "profiles.new-soundscape.musicPrograms.score.audioPaths.2",
        message: 'Selected audio path "music/missing.ogg" could not be loaded by Foundry.',
      }),
      expect.objectContaining({
        path: "profiles.new-soundscape.ambienceLayers.wind.audioPaths.1",
        message: 'Selected audio path "ambience/missing.ogg" could not be loaded by Foundry.',
      }),
      expect.objectContaining({
        path: "profiles.new-soundscape.soundMoments.stinger.audioPaths.1",
        message: "Sound moment audio paths cannot be blank.",
      }),
    ]));
    expect(isAudioPathResolvableMock).toHaveBeenCalledTimes(3);
    expect(isAudioPathResolvableMock).toHaveBeenNthCalledWith(1, "shared/audio.ogg");
    expect(isAudioPathResolvableMock).toHaveBeenNthCalledWith(2, "music/missing.ogg");
    expect(isAudioPathResolvableMock).toHaveBeenNthCalledWith(3, "ambience/missing.ogg");
  });

  it("resolves preview from scene assignments and world default fallback", () => {
    const directProfile = createSoundscapeProfile([], "Direct Score");
    directProfile.musicPrograms["direct-score"] = {
      id: "direct-score",
      name: "Direct Score",
      audioPaths: ["music/direct.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    };
    directProfile.rules = [{ id: "base", trigger: { type: "base" }, musicProgramId: "direct-score" }];

    const worldProfile = createSoundscapeProfile([directProfile.id], "World Score");
    worldProfile.musicPrograms["world-score"] = {
      id: "world-score",
      name: "World Score",
      audioPaths: ["music/world.ogg"],
      selectionMode: "sequential",
      delaySeconds: 0,
    };
    worldProfile.rules = [{ id: "base", trigger: { type: "base" }, musicProgramId: "world-score" }];

    const snapshot = replaceProfileInLibrary(
      replaceProfileInLibrary(makeSnapshot(), directProfile),
      worldProfile,
    );

    expect(resolveSoundscapeStudioPreview({
      library: snapshot,
      selectedProfileId: directProfile.id,
      previewSceneId: "scene-direct",
      sceneAssignments: {
        "scene-direct": { profileId: directProfile.id, overrides: { ambienceLayerIds: null } },
        "scene-inherit": null,
      },
      worldDefaultProfileId: worldProfile.id,
      context: {},
    })?.profileId).toBe(directProfile.id);

    expect(resolveSoundscapeStudioPreview({
      library: snapshot,
      selectedProfileId: directProfile.id,
      previewSceneId: "scene-inherit",
      sceneAssignments: {
        "scene-direct": { profileId: directProfile.id },
        "scene-inherit": null,
      },
      worldDefaultProfileId: worldProfile.id,
      context: {},
    })?.profileId).toBe(worldProfile.id);
  });

  it("reports malformed triggers, impossible timing, and missing audio paths", async () => {
    const profile = createSoundscapeProfile([]);
    profile.musicPrograms.score = {
      id: "score",
      name: "Broken Music",
      audioPaths: ["music/missing.ogg"],
      selectionMode: "sequential",
      delaySeconds: -2,
    };
    profile.ambienceLayers.wind = {
      id: "wind",
      name: "",
      mode: "random",
      audioPaths: ["ambience/missing.ogg"],
      minDelaySeconds: 12,
      maxDelaySeconds: 2,
    };
    profile.soundMoments.stinger = {
      id: "stinger",
      name: "",
      audioPaths: [],
      selectionMode: "random",
    };
    profile.rules = [
      { id: "combat-a", trigger: { type: "combat" }, musicProgramId: "missing-program" },
      { id: "combat-b", trigger: { type: "combat" }, ambienceLayerIds: ["missing-layer"] },
      { id: "weather", trigger: { type: "weather", weatherKeys: [] }, musicProgramId: "score" },
    ];

    const snapshot = replaceProfileInLibrary(makeSnapshot(), profile);
    isAudioPathResolvableMock.mockResolvedValue(false);

    const result = await validateSoundscapeStudioData(snapshot, "missing-world", {
      sceneA: { profileId: "missing-profile" },
    });

    expect(result.isValid).toBe(false);
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "worldDefaultProfileId" }),
      expect.objectContaining({ path: "sceneAssignments.sceneA.profileId" }),
      expect.objectContaining({ path: "profiles.new-soundscape.rules.0.musicProgramId" }),
      expect.objectContaining({
        path: "profiles.new-soundscape.musicPrograms.score.audioPaths.0",
        message: 'Selected audio path "music/missing.ogg" could not be loaded by Foundry.',
      }),
      expect.objectContaining({ path: "profiles.new-soundscape.soundMoments.stinger.audioPaths" }),
    ]));
  });
});
