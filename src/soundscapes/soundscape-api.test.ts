import { beforeEach, describe, expect, it, vi } from "vitest";

const getStoredSoundscapeLibrarySnapshotMock = vi.fn(() => ({ formatVersion: 2, profiles: {} }));
const resolveStoredSoundscapeStateMock = vi.fn(() => ({ profileId: "profile-1" }));
const getSoundscapeAmbienceRuntimeSnapshotMock = vi.fn(() => ({
  activeAmbienceKey: "forest:wind",
  activeLayerIds: ["wind"],
  loopAudioPaths: ["ambience/wind.ogg"],
  randomLayerIds: ["gusts"],
  activeRandomAudioPaths: ["ambience/gust-a.ogg"],
  pendingRandomLayerIds: ["gusts"],
  lastError: null,
}));
const playStoredSoundscapeMomentMock = vi.fn(async () => ({
  momentId: "sting",
  audioPath: "moments/sting.ogg",
  played: true,
  error: null,
}));
const stopStoredSoundscapeAmbienceMock = vi.fn(async () => {});
const syncStoredSoundscapeAmbienceMock = vi.fn(async () => ({
  activeAmbienceKey: "forest:wind",
  activeLayerIds: ["wind"],
  loopAudioPaths: ["ambience/wind.ogg"],
  randomLayerIds: ["gusts"],
  activeRandomAudioPaths: ["ambience/gust-a.ogg"],
  pendingRandomLayerIds: ["gusts"],
  lastError: null,
}));
const getSoundscapeMusicRuntimeSnapshotMock = vi.fn(() => ({
  activeProgramKey: "forest:program-1",
  activeProgramId: "program-1",
  activeAudioPath: "music/forest.ogg",
  pendingProgramKey: null,
  pendingDelayMs: 2500,
  lastError: null,
}));
const stopStoredSoundscapeMusicMock = vi.fn(async () => {});
const syncStoredSoundscapeMusicMock = vi.fn(async () => ({
  activeProgramKey: "forest:program-1",
  activeProgramId: "program-1",
  activeAudioPath: "music/forest.ogg",
  pendingProgramKey: null,
  pendingDelayMs: 2500,
  lastError: null,
}));
const openSoundscapeStudioMock = vi.fn();
const openSoundscapeLiveControlsMock = vi.fn();

vi.mock("./soundscape-accessors", () => ({
  getStoredSoundscapeLibrarySnapshot: getStoredSoundscapeLibrarySnapshotMock,
  resolveStoredSoundscapeState: resolveStoredSoundscapeStateMock,
}));

vi.mock("./soundscape-ambience-controller", () => ({
  getSoundscapeAmbienceRuntimeSnapshot: getSoundscapeAmbienceRuntimeSnapshotMock,
  playStoredSoundscapeMoment: playStoredSoundscapeMomentMock,
  stopStoredSoundscapeAmbience: stopStoredSoundscapeAmbienceMock,
  syncStoredSoundscapeAmbience: syncStoredSoundscapeAmbienceMock,
}));

vi.mock("./soundscape-music-controller", () => ({
  getSoundscapeMusicRuntimeSnapshot: getSoundscapeMusicRuntimeSnapshotMock,
  stopStoredSoundscapeMusic: stopStoredSoundscapeMusicMock,
  syncStoredSoundscapeMusic: syncStoredSoundscapeMusicMock,
}));

vi.mock("./soundscape-studio-app", () => ({
  openSoundscapeStudio: openSoundscapeStudioMock,
}));

vi.mock("./soundscape-live-controls-app", () => ({
  openSoundscapeLiveControls: openSoundscapeLiveControlsMock,
}));

describe("soundscape api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the operator-facing API surface for live controls and playback", async () => {
    const mod = await import("./soundscape-api");
    const api = mod.buildSoundscapeApi();

    expect(api.soundscapes.getLibrary()).toEqual({ formatVersion: 2, profiles: {} });
    expect(api.soundscapes.resolve("scene-1", { inCombat: true })).toEqual({ profileId: "profile-1" });
    api.soundscapes.openStudio();
    api.soundscapes.openLiveControls();
    await expect(api.soundscapes.syncMusic()).resolves.toEqual({
      activeProgramKey: "forest:program-1",
      activeProgramId: "program-1",
      activeAudioPath: "music/forest.ogg",
      pendingProgramKey: null,
      pendingDelayMs: 2500,
      lastError: null,
    });
    await api.soundscapes.stopMusic();
    expect(api.soundscapes.getMusicState()).toEqual({
      activeProgramKey: "forest:program-1",
      activeProgramId: "program-1",
      activeAudioPath: "music/forest.ogg",
      pendingProgramKey: null,
      pendingDelayMs: 2500,
      lastError: null,
    });
    await expect(api.soundscapes.syncAmbience()).resolves.toEqual({
      activeAmbienceKey: "forest:wind",
      activeLayerIds: ["wind"],
      loopAudioPaths: ["ambience/wind.ogg"],
      randomLayerIds: ["gusts"],
      activeRandomAudioPaths: ["ambience/gust-a.ogg"],
      pendingRandomLayerIds: ["gusts"],
      lastError: null,
    });
    await api.soundscapes.stopAmbience();
    expect(api.soundscapes.getAmbienceState()).toEqual({
      activeAmbienceKey: "forest:wind",
      activeLayerIds: ["wind"],
      loopAudioPaths: ["ambience/wind.ogg"],
      randomLayerIds: ["gusts"],
      activeRandomAudioPaths: ["ambience/gust-a.ogg"],
      pendingRandomLayerIds: ["gusts"],
      lastError: null,
    });
    await expect(api.soundscapes.playMoment("sting")).resolves.toEqual({
      momentId: "sting",
      audioPath: "moments/sting.ogg",
      played: true,
      error: null,
    });

    expect(getStoredSoundscapeLibrarySnapshotMock).toHaveBeenCalledTimes(1);
    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", { inCombat: true });
    expect(openSoundscapeStudioMock).toHaveBeenCalledTimes(1);
    expect(openSoundscapeLiveControlsMock).toHaveBeenCalledTimes(1);
    expect(syncStoredSoundscapeMusicMock).toHaveBeenCalledTimes(1);
    expect(stopStoredSoundscapeMusicMock).toHaveBeenCalledTimes(1);
    expect(getSoundscapeMusicRuntimeSnapshotMock).toHaveBeenCalledTimes(1);
    expect(syncStoredSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
    expect(stopStoredSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
    expect(getSoundscapeAmbienceRuntimeSnapshotMock).toHaveBeenCalledTimes(1);
    expect(playStoredSoundscapeMomentMock).toHaveBeenCalledWith("sting", undefined, undefined);
  });
});
