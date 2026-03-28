import { beforeEach, describe, expect, it, vi } from "vitest";

const getStoredSoundscapeLibrarySnapshotMock = vi.fn(() => ({ profiles: {} }));
const resolveStoredSoundscapeStateMock = vi.fn(() => ({ profileId: "profile-1" }));
const getSoundscapeAmbienceRuntimeSnapshotMock = vi.fn(() => ({ activeLayerIds: [] }));
const playStoredSoundscapeMomentMock = vi.fn(async () => ({ played: true }));
const stopStoredSoundscapeAmbienceMock = vi.fn(async () => {});
const syncStoredSoundscapeAmbienceMock = vi.fn(async () => ({ activeLayerIds: [] }));
const getSoundscapeMusicRuntimeSnapshotMock = vi.fn(() => ({ activeProgramId: "program-1" }));
const stopStoredSoundscapeMusicMock = vi.fn(async () => {});
const syncStoredSoundscapeMusicMock = vi.fn(async () => ({ activeProgramId: "program-1" }));
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

    api.soundscapes.getLibrary();
    api.soundscapes.resolve("scene-1", { inCombat: true });
    api.soundscapes.openStudio();
    api.soundscapes.openLiveControls();
    await api.soundscapes.syncMusic();
    await api.soundscapes.stopMusic();
    api.soundscapes.getMusicState();
    await api.soundscapes.syncAmbience();
    await api.soundscapes.stopAmbience();
    api.soundscapes.getAmbienceState();
    await api.soundscapes.playMoment("sting");

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
