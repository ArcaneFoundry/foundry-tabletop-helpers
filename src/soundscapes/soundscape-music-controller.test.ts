import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStoredSoundscapeStateMock = vi.fn();
const runtimeSyncMock = vi.fn();
const runtimeStopMock = vi.fn();
const runtimeGetSnapshotMock = vi.fn(() => ({
  activeProgramKey: null,
  activeProgramId: null,
  activeAudioPath: null,
  pendingProgramKey: null,
  pendingDelayMs: null,
  lastError: null,
}));

vi.mock("./soundscape-accessors", () => ({
  resolveStoredSoundscapeState: resolveStoredSoundscapeStateMock,
}));

vi.mock("./soundscape-music-runtime", () => ({
  SoundscapeMusicRuntime: class {
    sync = runtimeSyncMock;
    stop = runtimeStopMock;
    getSnapshot = runtimeGetSnapshotMock;
  },
}));

describe("soundscape music controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveStoredSoundscapeStateMock.mockReturnValue({ musicProgramId: "calm" });
    runtimeSyncMock.mockResolvedValue({
      activeProgramKey: "forest:calm",
      activeProgramId: "calm",
      activeAudioPath: "music/calm.ogg",
      pendingProgramKey: null,
      pendingDelayMs: null,
      lastError: null,
    });
    runtimeStopMock.mockResolvedValue(undefined);
  });

  it("resolves stored state and hands it to the singleton runtime", async () => {
    const mod = await import("./soundscape-music-controller");

    await mod.syncStoredSoundscapeMusic("scene-1", { inCombat: true });

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", { inCombat: true });
    expect(runtimeSyncMock).toHaveBeenCalledWith({ musicProgramId: "calm" });
  });

  it("stops playback and exposes the runtime snapshot", async () => {
    const mod = await import("./soundscape-music-controller");

    await mod.stopStoredSoundscapeMusic();

    expect(runtimeStopMock).toHaveBeenCalledTimes(1);
    expect(mod.getSoundscapeMusicRuntimeSnapshot()).toEqual(runtimeGetSnapshotMock.mock.results[0]?.value);
  });
});
