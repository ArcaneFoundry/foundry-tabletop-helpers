import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStoredSoundscapeStateMock = vi.fn();
const runtimeSyncMock = vi.fn();
const runtimeStopMock = vi.fn();
const runtimeGetSnapshotMock = vi.fn(() => ({
  activeAmbienceKey: null,
  activeLayerIds: [],
  loopAudioPaths: [],
  randomLayerIds: [],
  activeRandomAudioPaths: [],
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
    resolveStoredSoundscapeStateMock.mockReturnValue({ profileId: "forest", soundMoments: [] });
    runtimeSyncMock.mockResolvedValue(runtimeGetSnapshotMock());
    runtimeStopMock.mockResolvedValue(undefined);
    runtimePlayMomentFromStateMock.mockResolvedValue({
      momentId: "sting",
      audioPath: "moments/sting.ogg",
      played: true,
      error: null,
    });
  });

  it("resolves stored state and hands it to the singleton runtime", async () => {
    const mod = await import("./soundscape-ambience-controller");

    await mod.syncStoredSoundscapeAmbience("scene-1", { inCombat: true });

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", { inCombat: true });
    expect(runtimeSyncMock).toHaveBeenCalledWith({ profileId: "forest", soundMoments: [] });
  });

  it("plays a moment against the last resolved state", async () => {
    const mod = await import("./soundscape-ambience-controller");

    await mod.syncStoredSoundscapeAmbience();
    const result = await mod.playStoredSoundscapeMoment("sting");

    expect(runtimePlayMomentFromStateMock).toHaveBeenCalledWith({ profileId: "forest", soundMoments: [] }, "sting");
    expect(result.audioPath).toBe("moments/sting.ogg");
  });
});
