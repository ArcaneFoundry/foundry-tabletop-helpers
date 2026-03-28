import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  logWarnMock,
  logDebugMock,
  getHooksMock,
  loadTemplatesMock,
  isGMMock,
  getUIMock,
  getFoundryReactMountMock,
  foundryReactRenderMock,
  foundryReactUnmountMock,
  ensureNativeWindowResizeHandleMock,
  ensureWindowSizeConstraintsMock,
  getSoundscapeSceneByIdMock,
  resolveStoredSoundscapeStateMock,
  getSoundscapeAmbienceRuntimeSnapshotMock,
  playStoredSoundscapeMomentMock,
  stopStoredSoundscapeAmbienceMock,
  syncStoredSoundscapeAmbienceMock,
  getSoundscapeMusicRuntimeSnapshotMock,
  stopStoredSoundscapeMusicMock,
  syncStoredSoundscapeMusicMock,
  openSoundscapeStudioMock,
  listSoundscapeScenesMock,
  getSoundscapeTriggerContextMock,
} = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
  logDebugMock: vi.fn(),
  getHooksMock: vi.fn(),
  loadTemplatesMock: vi.fn(),
  isGMMock: vi.fn(() => true),
  getUIMock: vi.fn(),
  getFoundryReactMountMock: vi.fn(),
  foundryReactRenderMock: vi.fn(),
  foundryReactUnmountMock: vi.fn(),
  ensureNativeWindowResizeHandleMock: vi.fn(),
  ensureWindowSizeConstraintsMock: vi.fn(),
  getSoundscapeSceneByIdMock: vi.fn(() => ({ id: "scene-1" })),
  resolveStoredSoundscapeStateMock: vi.fn(() => null),
  getSoundscapeAmbienceRuntimeSnapshotMock: vi.fn(() => ({
    activeLayerIds: [],
    loopAudioPaths: [],
    activeRandomAudioPaths: [],
    pendingRandomLayerIds: [],
    lastError: null,
  })),
  stopStoredSoundscapeAmbienceMock: vi.fn(async () => {}),
  syncStoredSoundscapeAmbienceMock: vi.fn(async () => ({
    activeLayerIds: [],
    loopAudioPaths: [],
    activeRandomAudioPaths: [],
    pendingRandomLayerIds: [],
    lastError: null,
  })),
  playStoredSoundscapeMomentMock: vi.fn(async () => ({
    played: true,
    error: null,
    audioPath: "moments/sting.ogg",
    momentId: "sting",
  })),
  getSoundscapeMusicRuntimeSnapshotMock: vi.fn(() => ({
    activeProgramId: null,
    activeAudioPath: null,
    pendingDelayMs: null,
    lastError: null,
  })),
  stopStoredSoundscapeMusicMock: vi.fn(async () => {}),
  syncStoredSoundscapeMusicMock: vi.fn(async () => ({
    activeProgramId: null,
    activeAudioPath: null,
    pendingDelayMs: null,
    lastError: null,
  })),
  openSoundscapeStudioMock: vi.fn(),
  listSoundscapeScenesMock: vi.fn(() => [{ id: "scene-1", name: "Active Scene", active: true }]),
  getSoundscapeTriggerContextMock: vi.fn(() => ({
    manualPreview: false,
    inCombat: false,
    weather: null,
    timeOfDay: "day",
  })),
}));

vi.mock("../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
    debug: logDebugMock,
  },
}));

vi.mock("../types", () => ({
  getHooks: getHooksMock,
  getUI: getUIMock,
  isGM: isGMMock,
  loadTemplates: loadTemplatesMock,
}));

vi.mock("../ui/foundry/react/foundry-react-application", () => ({
  getFoundryReactMount: getFoundryReactMountMock,
  FoundryReactRenderer: class {
    render = foundryReactRenderMock;
    unmount = foundryReactUnmountMock;
  },
}));

vi.mock("../ui/foundry/application-v2/window-resize-handle", () => ({
  ensureNativeWindowResizeHandle: ensureNativeWindowResizeHandleMock,
}));

vi.mock("../ui/foundry/application-v2/window-size-constraints", () => ({
  ensureWindowSizeConstraints: ensureWindowSizeConstraintsMock,
}));

vi.mock("./soundscape-accessors", () => ({
  getSoundscapeSceneById: getSoundscapeSceneByIdMock,
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

vi.mock("./soundscape-studio-helpers", () => ({
  listSoundscapeScenes: listSoundscapeScenesMock,
}));

vi.mock("./soundscape-trigger-service", () => ({
  getSoundscapeTriggerContext: getSoundscapeTriggerContextMock,
}));

class FakeElement {
  public dataset: Record<string, string> = {};
  public attributes = [] as unknown as NamedNodeMap;
  private readonly selectors = new Map<string, unknown>();

  constructor(public readonly tagName = "div") {}

  setQueryResult(selector: string, value: unknown): void {
    this.selectors.set(selector, value);
  }

  querySelector(selector: string): unknown {
    return this.selectors.get(selector) ?? null;
  }

  getAttributeNames(): string[] {
    return Object.keys(this.dataset);
  }
}

class FakeBaseApplication {
  static instances: FakeBaseApplication[] = [];
  static DEFAULT_OPTIONS = {};
  static PARTS = {};

  element: FakeElement | null = null;
  render = vi.fn();
  close = vi.fn(async () => {});

  constructor(..._args: unknown[]) {
    FakeBaseApplication.instances.push(this);
  }

  async _preparePartContext(_partId: string, _context: unknown, _options: unknown): Promise<Record<string, unknown>> {
    return {};
  }
}

function installFoundryAppClasses(): void {
  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      api: {
        ApplicationV2: FakeBaseApplication,
        HandlebarsApplicationMixin: <TBase extends new (...args: any[]) => FakeBaseApplication>(Base: TBase) =>
          class Mixed extends Base {},
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeBaseApplication.instances = [];
  installFoundryAppClasses();

  getHooksMock.mockReturnValue({ on: vi.fn() });
  getUIMock.mockReturnValue({ notifications: { warn: vi.fn() } });
  getFoundryReactMountMock.mockImplementation((root: FakeElement | null | undefined) => {
    return root?.querySelector("[data-fth-react-root]") as HTMLElement | null;
  });
  resolveStoredSoundscapeStateMock.mockReturnValue(null);
});

describe("SoundscapeLiveControlsApp", () => {
  let modPromise: Promise<typeof import("./soundscape-live-controls-app")>;

  beforeAll(() => {
    installFoundryAppClasses();
    modPromise = import("./soundscape-live-controls-app");
  });

  it("builds the runtime class when ApplicationV2 is available", async () => {
    const mod = await modPromise;

    mod.buildSoundscapeLiveControlsAppClass();
    const AppClass = mod.getSoundscapeLiveControlsAppClass();

    expect(AppClass).not.toBeNull();
    expect((AppClass as { DEFAULT_OPTIONS?: { window?: { title?: string } } }).DEFAULT_OPTIONS?.window?.title)
      .toBe("Soundscape Live Controls");
    expect(logDebugMock).toHaveBeenCalledWith("Reactive Soundscapes: Soundscape Live Controls class built");
  });

  it("registers the template preload and scene control hook", async () => {
    const mod = await modPromise;
    const hooks = { on: vi.fn() };
    getHooksMock.mockReturnValue(hooks);

    mod.registerSoundscapeLiveControlsHooks();

    expect(loadTemplatesMock).toHaveBeenCalledWith([
      "modules/foundry-tabletop-helpers/templates/soundscapes/soundscape-live-controls-root.hbs",
    ]);
    expect(hooks.on).toHaveBeenCalledWith("getSceneControlButtons", expect.any(Function));
  });

  it("injects a scene control button that opens the live controls window", async () => {
    const mod = await modPromise;
    mod.buildSoundscapeLiveControlsAppClass();

    const controls: {
      tokens: {
        tools: Record<string, {
          name: string;
          title: string;
          icon: string;
          order: number;
          button: boolean;
          visible: boolean;
          onChange: () => void;
        }>;
      };
    } = {
      tokens: {
        tools: {
          select: {
            name: "select",
            title: "Select",
            icon: "fa-solid fa-expand",
            order: 0,
            button: true,
            visible: true,
            onChange: () => undefined,
          },
        },
      },
    };

    mod.__soundscapeLiveControlsAppInternals.onGetSceneControlButtonsSoundscapeLiveControls(controls);

    expect(controls.tokens.tools["fth-soundscape-live-controls"]).toMatchObject({
      name: "fth-soundscape-live-controls",
      title: "Soundscape Live Controls",
      order: 1,
      button: true,
      visible: true,
    });

    controls.tokens.tools["fth-soundscape-live-controls"].onChange();
    expect(FakeBaseApplication.instances.at(-1)?.render).toHaveBeenCalledWith({ force: true });
  });

  it("warns non-gm users instead of opening the live controls", async () => {
    const mod = await modPromise;
    isGMMock.mockReturnValue(false);
    const warn = vi.fn();
    getUIMock.mockReturnValue({ notifications: { warn } });

    mod.openSoundscapeLiveControls();

    expect(warn).toHaveBeenCalledWith("Soundscape Live Controls are only available to GMs.");
  });

  it("renders path-based runtime snapshot details and moment counts", async () => {
    const mod = await modPromise;
    mod.buildSoundscapeLiveControlsAppClass();
    resolveStoredSoundscapeStateMock.mockReturnValue({
      profileId: "forest",
      assignmentSource: "worldDefault",
      sceneId: "scene-1",
      context: {
        manualPreview: false,
        inCombat: false,
        weather: null,
        timeOfDay: "day",
      },
      musicProgramId: "calm",
      musicProgram: {
        id: "calm",
        name: "Calm",
        audioPaths: ["music/live.ogg"],
        selectionMode: "sequential",
        delaySeconds: 0,
      },
      musicRuleId: "base",
      ambienceLayerIds: [],
      ambienceLayers: [],
      ambienceRuleId: null,
      soundMoments: [{
        id: "sting",
        name: "Sting",
        audioPaths: ["moments/one.ogg", "moments/two.ogg"],
        selectionMode: "random",
      }],
    } as never);
    getSoundscapeMusicRuntimeSnapshotMock.mockReturnValue({
      activeProgramId: "calm",
      activeAudioPath: "music/live.ogg",
      pendingDelayMs: 1200,
      lastError: null,
    } as never);
    getSoundscapeAmbienceRuntimeSnapshotMock.mockReturnValue({
      activeLayerIds: ["wind"],
      loopAudioPaths: ["ambience/wind.ogg"],
      activeRandomAudioPaths: ["ambience/gust.ogg"],
      pendingRandomLayerIds: ["wind"],
      lastError: null,
    } as never);

    const AppClass = mod.getSoundscapeLiveControlsAppClass();
    const app = new (AppClass as unknown as new () => {
      element: FakeElement | null;
      _onRender: (_context: Record<string, never>, _options: unknown) => Promise<void>;
    })();
    const mount = new FakeElement("div");
    const root = new FakeElement("section");
    root.setQueryResult("[data-fth-react-root]", mount);
    app.element = root;

    await app._onRender({}, {});

    const renderedElement = foundryReactRenderMock.mock.calls.at(-1)?.[1];
    const markup = renderToStaticMarkup(renderedElement);

    expect(markup).toContain("Audio Path");
    expect(markup).toContain("music/live.ogg");
    expect(markup).toContain("Begin Scene");
    expect(markup).toContain("Stop Current Soundscape");
    expect(markup).toContain("sting · 2 sounds");
  });

  it("starts the current resolved scene soundscape through the live-controls helper", async () => {
    const mod = await modPromise;
    resolveStoredSoundscapeStateMock.mockReturnValue({
      profileId: "new-soundscape",
      assignmentSource: "scene",
      sceneId: "scene-1",
      context: {
        manualPreview: false,
        inCombat: false,
        weather: null,
        timeOfDay: "day",
      },
      musicProgramId: "new-music-program",
      musicProgram: {
        id: "new-music-program",
        name: "New Music Program",
        audioPaths: ["assets/shared/audio/test-track.ogg"],
        selectionMode: "sequential",
        delaySeconds: 0,
      },
      musicRuleId: "base",
      ambienceLayerIds: ["new-ambience-layer"],
      ambienceLayers: [{
        id: "new-ambience-layer",
        name: "New Ambience Layer",
        audioPaths: ["assets/shared/audio/test-ambience.ogg"],
        mode: "loop",
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
      ambienceRuleId: "base",
      soundMoments: [],
    } as never);
    syncStoredSoundscapeMusicMock.mockResolvedValue({
      activeProgramId: "new-music-program",
      activeAudioPath: "assets/shared/audio/test-track.ogg",
      pendingDelayMs: null,
      lastError: null,
    } as never);
    syncStoredSoundscapeAmbienceMock.mockResolvedValue({
      activeLayerIds: ["new-ambience-layer"],
      loopAudioPaths: ["assets/shared/audio/test-ambience.ogg"],
      activeRandomAudioPaths: [],
      pendingRandomLayerIds: [],
      lastError: null,
    } as never);

    const result = await mod.__soundscapeLiveControlsAppInternals.startCurrentSceneSoundscape();

    expect(syncStoredSoundscapeMusicMock).toHaveBeenCalledWith("scene-1", {
      manualPreview: false,
      inCombat: false,
      weather: null,
      timeOfDay: "day",
    });
    expect(syncStoredSoundscapeAmbienceMock).toHaveBeenCalledWith("scene-1", {
      manualPreview: false,
      inCombat: false,
      weather: null,
      timeOfDay: "day",
    });
    expect(result.status).toBe("Started new-soundscape for Active Scene.");
    expect(result.musicSnapshot.activeAudioPath).toBe("assets/shared/audio/test-track.ogg");
    expect(result.ambienceSnapshot.loopAudioPaths).toEqual(["assets/shared/audio/test-ambience.ogg"]);
  });

  it("reports when no current scene soundscape is assigned", async () => {
    const mod = await modPromise;

    const result = await mod.__soundscapeLiveControlsAppInternals.startCurrentSceneSoundscape();

    expect(syncStoredSoundscapeMusicMock).not.toHaveBeenCalled();
    expect(syncStoredSoundscapeAmbienceMock).not.toHaveBeenCalled();
    expect(result.status).toBe("No active soundscape assignment is resolving for this scene.");
  });

  it("stops the current live soundscape through the live-controls helper", async () => {
    const mod = await modPromise;
    resolveStoredSoundscapeStateMock.mockReturnValue({
      profileId: "forest",
      assignmentSource: "scene",
      sceneId: "scene-1",
      context: {
        manualPreview: false,
        inCombat: false,
        weather: null,
        timeOfDay: "day",
      },
      musicProgramId: "calm",
      musicProgram: {
        id: "calm",
        name: "Calm",
        audioPaths: ["music/live.ogg"],
        selectionMode: "sequential",
        delaySeconds: 0,
      },
      musicRuleId: "base",
      ambienceLayerIds: ["wind"],
      ambienceLayers: [{
        id: "wind",
        name: "Wind",
        audioPaths: ["ambience/wind.ogg"],
        mode: "loop",
        minDelaySeconds: 0,
        maxDelaySeconds: 0,
      }],
      ambienceRuleId: "base",
      soundMoments: [],
    } as never);
    getSoundscapeMusicRuntimeSnapshotMock.mockReturnValue({
      activeProgramId: null,
      activeAudioPath: null,
      pendingDelayMs: null,
      lastError: null,
    } as never);
    getSoundscapeAmbienceRuntimeSnapshotMock.mockReturnValue({
      activeLayerIds: [],
      loopAudioPaths: [],
      activeRandomAudioPaths: [],
      pendingRandomLayerIds: [],
      lastError: null,
    } as never);

    const result = await mod.__soundscapeLiveControlsAppInternals.stopCurrentSceneSoundscape();

    expect(stopStoredSoundscapeMusicMock).toHaveBeenCalledTimes(1);
    expect(stopStoredSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
    expect(result.resolvedState?.profileId).toBe("forest");
    expect(result.musicSnapshot.activeProgramId).toBeNull();
    expect(result.ambienceSnapshot.activeLayerIds).toEqual([]);
    expect(result.status).toBe("Stopped current soundscape playback for Active Scene.");
  });

  it("surfaces stop failures to the caller", async () => {
    const mod = await modPromise;
    stopStoredSoundscapeMusicMock.mockRejectedValueOnce(new Error("boom"));

    await expect(mod.__soundscapeLiveControlsAppInternals.stopCurrentSceneSoundscape()).rejects.toThrow("boom");
    expect(stopStoredSoundscapeAmbienceMock).toHaveBeenCalledTimes(1);
  });
});
