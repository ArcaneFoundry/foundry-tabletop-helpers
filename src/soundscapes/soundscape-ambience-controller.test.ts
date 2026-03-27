import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStoredSoundscapeStateMock = vi.fn();
const runtimeSyncMock = vi.fn();
const runtimeStopMock = vi.fn();
const runtimeGetSnapshotMock = vi.fn(() => ({
  activeAmbienceKey: null,
  activeLayerIds: [],
  loopSoundUuids: [],
  randomLayerIds: [],
  activeRandomSoundUuids: [],
  pendingRandomLayerIds: [],
  lastError: null,
}));
const runtimePlayMomentFromStateMock = vi.fn();

vi.mock("./soundscape-accessors", () => ({
  resolveStoredSoundscapeState: resolveStoredSoundscapeStateMock,
}));

vi.mock("./soundscape-ambience-runtime", () => ({
  SoundscapeAmbienceRuntime: class {
    sync = runtimeSyncMock;
    stop = runtimeStopMock;
    getSnapshot = runtimeGetSnapshotMock;
    playMomentFromState = runtimePlayMomentFromStateMock;
  },
}));

describe("soundscape ambience controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveStoredSoundscapeStateMock.mockReturnValue({
      profileId: "forest",
      ambienceLayerIds: ["wind"],
      ambienceLayers: [{ id: "wind" }],
      soundMoments: [{ id: "sting" }],
    });
    runtimeSyncMock.mockResolvedValue(runtimeGetSnapshotMock());
    runtimeStopMock.mockResolvedValue(undefined);
    runtimePlayMomentFromStateMock.mockResolvedValue({
      momentId: "sting",
      soundUuid: "PlaylistSound.sting",
      played: true,
      error: null,
    });
  });

  it("resolves stored state and hands it to the singleton runtime", async () => {
    const mod = await import("./soundscape-ambience-controller");

    await mod.syncStoredSoundscapeAmbience("scene-1", { weather: "rain" });

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", { weather: "rain" });
    expect(runtimeSyncMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "forest",
      ambienceLayerIds: ["wind"],
    }));
  });

  it("plays moments from the cached active soundscape state", async () => {
    const mod = await import("./soundscape-ambience-controller");

    await mod.syncStoredSoundscapeAmbience("scene-1");
    await mod.playStoredSoundscapeMoment("sting");

    expect(runtimePlayMomentFromStateMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "forest",
    }), "sting");
  });

  it("stops playback and exposes the runtime snapshot", async () => {
    const mod = await import("./soundscape-ambience-controller");

    await mod.stopStoredSoundscapeAmbience();

    expect(runtimeStopMock).toHaveBeenCalledTimes(1);
    expect(mod.getSoundscapeAmbienceRuntimeSnapshot()).toEqual(runtimeGetSnapshotMock.mock.results[0]?.value);
  });
});
