import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  logWarnMock,
  logDebugMock,
  getHooksMock,
  loadTemplatesMock,
  isGMMock,
  getUIMock,
  getGameMock,
  getFoundryReactMountMock,
  foundryReactRenderMock,
  foundryReactUnmountMock,
  ensureNativeWindowResizeHandleMock,
  ensureWindowSizeConstraintsMock,
  getSoundscapeLibrarySnapshotMock,
  getSoundscapeWorldDefaultProfileIdMock,
} = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
  logDebugMock: vi.fn(),
  getHooksMock: vi.fn(),
  loadTemplatesMock: vi.fn(),
  isGMMock: vi.fn(() => true),
  getUIMock: vi.fn(),
  getGameMock: vi.fn(),
  getFoundryReactMountMock: vi.fn(),
  foundryReactRenderMock: vi.fn(),
  foundryReactUnmountMock: vi.fn(),
  ensureNativeWindowResizeHandleMock: vi.fn(),
  ensureWindowSizeConstraintsMock: vi.fn(),
  getSoundscapeLibrarySnapshotMock: vi.fn(),
  getSoundscapeWorldDefaultProfileIdMock: vi.fn(),
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
  getGame: getGameMock,
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
  getSoundscapeLibrarySnapshot: getSoundscapeLibrarySnapshotMock,
  getSoundscapeWorldDefaultProfileId: getSoundscapeWorldDefaultProfileIdMock,
  getSceneSoundscapeAssignment: vi.fn(() => null),
  getSoundscapeSceneById: vi.fn(() => null),
  setSceneSoundscapeAssignment: vi.fn(async () => {}),
  setSoundscapeLibrarySnapshot: vi.fn(async () => {}),
  setSoundscapeWorldDefaultProfileId: vi.fn(async () => {}),
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
  getSoundscapeWorldDefaultProfileIdMock.mockReturnValue(null);
  getSoundscapeLibrarySnapshotMock.mockReturnValue({
    formatVersion: 2,
    savedAt: "2026-03-30T00:00:00.000Z",
    profiles: {
      "test-soundscape": {
        id: "test-soundscape",
        name: "Test Soundscape",
        musicPrograms: {},
        ambienceLayers: {},
        soundMoments: {},
        rules: [
          {
            id: "base",
            trigger: { type: "base" },
          },
        ],
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SoundscapeStudioApp", () => {
  let modPromise: Promise<typeof import("./soundscape-studio-app")>;

  beforeAll(() => {
    installFoundryAppClasses();
    modPromise = import("./soundscape-studio-app");
  });

  it("builds the runtime class when ApplicationV2 is available", async () => {
    const mod = await modPromise;

    mod.buildSoundscapeStudioAppClass();
    const AppClass = mod.getSoundscapeStudioAppClass();

    expect(AppClass).not.toBeNull();
    expect((AppClass as { DEFAULT_OPTIONS?: { window?: { title?: string } } }).DEFAULT_OPTIONS?.window?.title)
      .toBe("Soundscape Studio");
    expect(logDebugMock).toHaveBeenCalledWith("Reactive Soundscapes: Soundscape Studio class built");
  });

  it("registers the template preload and scene control hook", async () => {
    const mod = await modPromise;
    const hooks = { on: vi.fn() };
    getHooksMock.mockReturnValue(hooks);

    mod.registerSoundscapeStudioHooks();

    expect(loadTemplatesMock).toHaveBeenCalledWith([
      "modules/foundry-tabletop-helpers/templates/soundscapes/soundscape-studio-root.hbs",
    ]);
    expect(hooks.on).toHaveBeenCalledWith("getSceneControlButtons", expect.any(Function));
  });

  it("injects a scene control button that opens the studio", async () => {
    const mod = await modPromise;
    mod.buildSoundscapeStudioAppClass();

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

    mod.__soundscapeStudioAppInternals.onGetSceneControlButtonsSoundscapeStudio(controls);

    expect(controls.tokens.tools["fth-soundscape-studio"]).toMatchObject({
      name: "fth-soundscape-studio",
      title: "Soundscape Studio",
      order: 1,
      button: true,
      visible: true,
    });

    controls.tokens.tools["fth-soundscape-studio"].onChange();
    expect(FakeBaseApplication.instances.at(-1)?.render).toHaveBeenCalledWith({ force: true });
  });

  it("warns non-gm users instead of opening the studio", async () => {
    const mod = await modPromise;
    isGMMock.mockReturnValue(false);
    const warn = vi.fn();
    getUIMock.mockReturnValue({ notifications: { warn } });

    mod.openSoundscapeStudio();

    expect(warn).toHaveBeenCalledWith("Soundscape Studio is only available to GMs.");
  });

  it("appends trimmed audio paths without duplicating existing entries", async () => {
    const mod = await modPromise;

    expect(mod.__soundscapeStudioAppInternals.appendAudioPath([
      "music/existing.ogg",
    ], "  music/new-track.ogg  ")).toEqual([
      "music/existing.ogg",
      "music/new-track.ogg",
    ]);

    expect(mod.__soundscapeStudioAppInternals.appendAudioPath([
      "music/existing.ogg",
    ], " music/existing.ogg ")).toEqual([
      "music/existing.ogg",
    ]);
  });

  it("removes and reorders authored audio paths", async () => {
    const mod = await modPromise;
    const audioPaths = ["a.ogg", "b.ogg", "c.ogg"];

    expect(mod.__soundscapeStudioAppInternals.removeAudioPath(audioPaths, 1)).toEqual([
      "a.ogg",
      "c.ogg",
    ]);
    expect(mod.__soundscapeStudioAppInternals.moveAudioPath(audioPaths, 1, "up")).toEqual([
      "b.ogg",
      "a.ogg",
      "c.ogg",
    ]);
    expect(mod.__soundscapeStudioAppInternals.moveAudioPath(audioPaths, 1, "down")).toEqual([
      "a.ogg",
      "c.ogg",
      "b.ogg",
    ]);
  });

  it("opens the Foundry audio picker through CONFIG.ux.FilePicker and trims the selected path", async () => {
    const mod = await modPromise;
    const render = vi.fn();
    const onSelect = vi.fn();
    class Picker {
      static calls: Array<{ type: string; current: string }> = [];

      constructor(options: { type: string; current: string; callback: (path: string) => void }) {
        Picker.calls.push({ type: options.type, current: options.current });
        options.callback("  sounds/forest/wind.ogg  ");
      }

      render(force?: boolean): void {
        render(force);
      }
    }

    vi.stubGlobal("CONFIG", { ux: { FilePicker: Picker } });

    const opened = mod.__soundscapeStudioAppInternals.openAudioPathPicker({
      currentPath: "sounds/forest",
      onSelect,
    });

    expect(opened).toBe(true);
    expect(Picker.calls).toEqual([{
      type: "audio",
      current: "sounds/forest",
    }]);
    expect(onSelect).toHaveBeenCalledWith("sounds/forest/wind.ogg");
    expect(render).toHaveBeenCalledWith(true);
  });

  it("renders the manager toggle in the header without making profile management a persistent rail", async () => {
    const mod = await modPromise;
    const SoundscapeStudioView = mod.__soundscapeStudioAppInternals.SoundscapeStudioView;

    const markup = renderToStaticMarkup(<SoundscapeStudioView />);

    expect(markup).toContain("Manage Profiles");
    expect(markup).toContain('aria-controls="fth-soundscape-profile-manager"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('id="fth-soundscape-profile-manager"');
    expect(markup).not.toContain('aria-label="Profile manager"');
    expect(markup).not.toContain("fth-soundscape-manager-grid");
  });

  it("marks the profile manager tray as a disclosure region when opened", async () => {
    const mod = await modPromise;
    const SoundscapeStudioView = mod.__soundscapeStudioAppInternals.SoundscapeStudioView;
    const markup = renderToStaticMarkup(<SoundscapeStudioView initialProfileManagerOpen />);

    expect(markup).toContain("Hide Profiles");
    expect(markup).toContain('aria-controls="fth-soundscape-profile-manager"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('id="fth-soundscape-profile-manager"');
    expect(markup).toContain('aria-label="Profile manager"');
    expect(markup).toContain("Profiles");
    expect(markup).toContain("Test Soundscape");
  });

  it("renders the shared Soundscapes theme utility classes in the studio surface", async () => {
    const mod = await modPromise;
    const SoundscapeStudioView = mod.__soundscapeStudioAppInternals.SoundscapeStudioView;

    getGameMock.mockReturnValue({
      scenes: [
        {
          id: "scene-1",
          name: "Active Scene",
          active: true,
        },
      ],
    });

    const markup = renderToStaticMarkup(<SoundscapeStudioView />);

    expect(markup).toContain("fth-soundscape-panel--raised");
    expect(markup).toContain("fth-soundscape-title");
    expect(markup).toContain("fth-soundscape-text");
  });

  it("summarizes compact music and atmosphere sections with preview counts", async () => {
    const mod = await modPromise;

    const profile = {
      id: "soundscape-1",
      name: "Soundscape 1",
      musicPrograms: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          audioPaths: ["music/a.ogg", "music/b.ogg"],
          selectionMode: "sequential",
          delaySeconds: 4,
        },
        beta: {
          id: "beta",
          name: "Beta",
          audioPaths: ["music/c.ogg"],
          selectionMode: "random",
          delaySeconds: 0,
        },
        gamma: {
          id: "gamma",
          name: "Gamma",
          audioPaths: [],
          selectionMode: "sequential",
          delaySeconds: 1,
        },
      },
      ambienceLayers: {
        drift: {
          id: "drift",
          name: "Drift",
          mode: "loop",
          audioPaths: ["ambience/drift.ogg"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
        rain: {
          id: "rain",
          name: "Rain",
          mode: "random",
          audioPaths: ["ambience/rain-1.ogg", "ambience/rain-2.ogg"],
          minDelaySeconds: 2,
          maxDelaySeconds: 6,
        },
        wind: {
          id: "wind",
          name: "Wind",
          mode: "loop",
          audioPaths: ["ambience/wind.ogg"],
          minDelaySeconds: 0,
          maxDelaySeconds: 0,
        },
      },
      soundMoments: {},
      rules: [],
    };

    expect(mod.__soundscapeStudioAppInternals.summarizeSoundscapeMusicPrograms(profile as never)).toEqual({
      count: 3,
      trackCount: 3,
      previewPrograms: [
        profile.musicPrograms.alpha,
        profile.musicPrograms.beta,
      ],
    });

    expect(mod.__soundscapeStudioAppInternals.summarizeSoundscapeAmbienceLayers(profile as never)).toEqual({
      count: 3,
      soundCount: 4,
      previewLayers: [
        profile.ambienceLayers.drift,
        profile.ambienceLayers.rain,
      ],
    });
  });
});
