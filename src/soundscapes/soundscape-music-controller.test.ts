import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStoredSoundscapeStateMock = vi.fn();
const getHooksMock = vi.fn();
const runtimeSyncMock = vi.fn();
const runtimeStopMock = vi.fn();
const runtimeGetSnapshotMock = vi.fn(() => ({
  activeProgramKey: null,
  activeProgramId: null,
  activePlaylistUuid: null,
  activeSoundId: null,
  pendingProgramKey: null,
  pendingDelayMs: null,
  lastError: null,
}));
const runtimeHandleTrackEndedMock = vi.fn();

vi.mock("./soundscape-accessors", () => ({
  resolveStoredSoundscapeState: resolveStoredSoundscapeStateMock,
}));

vi.mock("../types", () => ({
  getHooks: getHooksMock,
}));

vi.mock("./soundscape-music-runtime", () => ({
  SoundscapeMusicRuntime: class {
    sync = runtimeSyncMock;
    stop = runtimeStopMock;
    getSnapshot = runtimeGetSnapshotMock;
    handleTrackEnded = runtimeHandleTrackEndedMock;
  },
}));

describe("soundscape music controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveStoredSoundscapeStateMock.mockReturnValue({ musicProgramId: "calm" });
    runtimeSyncMock.mockResolvedValue({
      activeProgramKey: "forest:calm",
      activeProgramId: "calm",
      activePlaylistUuid: "Playlist.calm",
      activeSoundId: "track-1",
      pendingProgramKey: null,
      pendingDelayMs: null,
      lastError: null,
    });
    runtimeStopMock.mockResolvedValue(undefined);
    getHooksMock.mockReturnValue({ on: vi.fn() });
  });

  it("resolves stored state and hands it to the singleton runtime", async () => {
    const mod = await import("./soundscape-music-controller");

    await mod.syncStoredSoundscapeMusic("scene-1", { inCombat: true });

    expect(resolveStoredSoundscapeStateMock).toHaveBeenCalledWith("scene-1", { inCombat: true });
    expect(runtimeSyncMock).toHaveBeenCalledWith({ musicProgramId: "calm" });
    expect(getHooksMock().on).toHaveBeenCalledWith("updatePlaylistSound", expect.any(Function));
  });

  it("stops playback and exposes the runtime snapshot", async () => {
    const mod = await import("./soundscape-music-controller");

    await mod.stopStoredSoundscapeMusic();

    expect(runtimeStopMock).toHaveBeenCalledTimes(1);
    expect(mod.getSoundscapeMusicRuntimeSnapshot()).toEqual(runtimeGetSnapshotMock.mock.results[0]?.value);
  });

  it("treats updatePlaylistSound playback-off transitions as track completion", async () => {
    const mod = await import("./soundscape-music-controller");
    const controller = mod.__soundscapeMusicControllerInternals.singletonController as {
      handlePlaylistSoundUpdate(
        sound: {
          id: string;
          playing?: boolean;
          parent?: { id?: string; uuid?: string };
        },
        changed: Record<string, unknown>,
      ): void;
    };

    controller.handlePlaylistSoundUpdate({ id: "track-1", playing: false, parent: { id: "playlist-1", uuid: "Playlist.playlist-1" } }, {});
    controller.handlePlaylistSoundUpdate({ id: "track-1", playing: true, parent: { id: "playlist-1", uuid: "Playlist.playlist-1" } }, { playing: false });
    controller.handlePlaylistSoundUpdate({ id: "track-1", playing: true, parent: { id: "playlist-1", uuid: "Playlist.playlist-1" } }, { playing: true });

    expect(runtimeHandleTrackEndedMock).toHaveBeenCalledTimes(2);
    expect(runtimeHandleTrackEndedMock).toHaveBeenNthCalledWith(1, {
      playlistId: "playlist-1",
      playlistUuid: "Playlist.playlist-1",
      soundId: "track-1",
    });
    expect(runtimeHandleTrackEndedMock).toHaveBeenNthCalledWith(2, {
      playlistId: "playlist-1",
      playlistUuid: "Playlist.playlist-1",
      soundId: "track-1",
    });
  });
});
