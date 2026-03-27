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

const { fromUuidMock } = vi.hoisted(() => ({
  fromUuidMock: vi.fn(),
}));

vi.mock("../types", () => ({
  fromUuid: fromUuidMock,
  getGame: vi.fn(() => ({
    playlists: [
      { id: "playlist-1", name: "Town Themes", uuid: "Playlist.playlist-1" },
    ],
  })),
}));

function makeSnapshot(): PersistentSoundscapeLibrarySnapshot {
  return {
    formatVersion: 1,
    savedAt: "2026-03-27T00:00:00.000Z",
    profiles: {},
  };
}

describe("soundscape studio helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromUuidMock.mockResolvedValue({ id: "doc-1" });
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

  it("creates child entities with stable ids", () => {
    expect(createSoundscapeMusicProgram([]).id).toBe("new-music-program");
    expect(createSoundscapeAmbienceLayer([]).id).toBe("new-ambience-layer");
    expect(createSoundscapeSoundMoment([]).id).toBe("new-sound-moment");
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
    profile.musicPrograms["score"] = {
      id: "score",
      name: "Town Music",
      playlistUuids: ["Playlist.playlist-1"],
      selectionMode: "random",
      delaySeconds: 12,
    };
    profile.ambienceLayers["wind"] = {
      id: "wind",
      name: "Cold Wind",
      mode: "random",
      soundUuids: ["PlaylistSound.wind"],
      minDelaySeconds: 5,
      maxDelaySeconds: 15,
    };
    profile.soundMoments["stinger"] = {
      id: "stinger",
      name: "Door Slam",
      soundUuids: ["PlaylistSound.stinger"],
      selectionMode: "single",
    };
    profile.rules = [
      { id: "base", trigger: { type: "base" }, musicProgramId: "score", ambienceLayerIds: ["wind"] },
      { id: "combat", trigger: { type: "combat" }, musicProgramId: null },
      { id: "night", trigger: { type: "timeOfDay", timeOfDay: "night" }, ambienceLayerIds: ["wind"] },
      { id: "storm", trigger: { type: "weather", weatherKeys: ["storm"] }, ambienceLayerIds: null },
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

  it("resolves preview from scene assignments and world default fallback", () => {
    const directProfile = createSoundscapeProfile([], "Direct Score");
    directProfile.musicPrograms["direct-score"] = {
      id: "direct-score",
      name: "Direct Score",
      playlistUuids: ["Playlist.playlist-1"],
      selectionMode: "sequential",
      delaySeconds: 0,
    };
    directProfile.rules = [{ id: "base", trigger: { type: "base" }, musicProgramId: "direct-score" }];

    const worldProfile = createSoundscapeProfile([directProfile.id], "World Score");
    worldProfile.musicPrograms["world-score"] = {
      id: "world-score",
      name: "World Score",
      playlistUuids: ["Playlist.playlist-1"],
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

  it("reports malformed triggers, impossible timing, and missing references", async () => {
    const profile = createSoundscapeProfile([]);
    profile.musicPrograms["score"] = {
      id: "score",
      name: "Broken Music",
      playlistUuids: ["Playlist.missing"],
      selectionMode: "sequential",
      delaySeconds: -2,
    };
    profile.ambienceLayers["wind"] = {
      id: "wind",
      name: "",
      mode: "random",
      soundUuids: ["PlaylistSound.missing"],
      minDelaySeconds: 12,
      maxDelaySeconds: 2,
    };
    profile.soundMoments["stinger"] = {
      id: "stinger",
      name: "",
      soundUuids: [],
      selectionMode: "random",
    };
    profile.rules = [
      { id: "base", trigger: { type: "base" } },
      { id: "base-2", trigger: { type: "base" }, musicProgramId: "ghost" },
      { id: "storm-1", trigger: { type: "weather", weatherKeys: [] }, ambienceLayerIds: ["ghost-layer"] },
      { id: "storm-2", trigger: { type: "weather", weatherKeys: [] }, ambienceLayerIds: ["ghost-layer"] },
    ];

    fromUuidMock.mockResolvedValue(null);

    const snapshot = replaceProfileInLibrary(makeSnapshot(), profile);
    const result = await validateSoundscapeStudioData(snapshot, "missing-default", {
      sceneA: { profileId: "missing-scene-profile" },
    });

    expect(result.isValid).toBe(false);
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "worldDefaultProfileId" }),
      expect.objectContaining({ path: "sceneAssignments.sceneA.profileId" }),
      expect.objectContaining({ path: "rules", message: "Only one base rule is allowed per soundscape." }),
      expect.objectContaining({ path: "profiles.new-soundscape.rules.0", message: "Trigger rules must override music, ambience, or both." }),
      expect.objectContaining({ path: "profiles.new-soundscape.rules.1.musicProgramId" }),
      expect.objectContaining({ path: "profiles.new-soundscape.rules.2", message: "Weather rules need at least one weather key." }),
      expect.objectContaining({ path: "profiles.new-soundscape.rules.3", message: "Duplicate trigger rule detected for \"weather:\"." }),
      expect.objectContaining({ path: "profiles.new-soundscape.musicPrograms.score.delaySeconds" }),
      expect.objectContaining({ path: "profiles.new-soundscape.ambienceLayers.wind", message: "Ambience max delay must be greater than or equal to min delay." }),
      expect.objectContaining({ path: "profiles.new-soundscape.soundMoments.stinger.soundUuids" }),
    ]));
  });
});
