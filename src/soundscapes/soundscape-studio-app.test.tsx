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
});
