import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  logWarnMock,
  logDebugMock,
  logInfoMock,
  logErrorMock,
  buildLegacyCharacterCreatorAppClassMock,
  getFoundryReactMountMock,
  foundryReactRenderMock,
  foundryReactUnmountMock,
  ensureNativeWindowResizeHandleMock,
  ensureWindowSizeConstraintsMock,
} = vi.hoisted(() => ({
  logWarnMock: vi.fn(),
  logDebugMock: vi.fn(),
  logInfoMock: vi.fn(),
  logErrorMock: vi.fn(),
  buildLegacyCharacterCreatorAppClassMock: vi.fn(),
  getFoundryReactMountMock: vi.fn(),
  foundryReactRenderMock: vi.fn(),
  foundryReactUnmountMock: vi.fn(),
  ensureNativeWindowResizeHandleMock: vi.fn(),
  ensureWindowSizeConstraintsMock: vi.fn(),
}));

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
    debug: logDebugMock,
    info: logInfoMock,
    error: logErrorMock,
  },
}));

vi.mock("../wizard/character-creator-app", () => ({
  buildCharacterCreatorAppClass: buildLegacyCharacterCreatorAppClassMock,
  openCharacterCreatorWizard: vi.fn(),
}));

vi.mock("../../ui/foundry/react/foundry-react-application", () => ({
  getFoundryReactMount: getFoundryReactMountMock,
  FoundryReactRenderer: class {
    render = foundryReactRenderMock;
    unmount = foundryReactUnmountMock;
  },
}));

vi.mock("../../ui/foundry/application-v2/window-resize-handle", () => ({
  ensureNativeWindowResizeHandle: ensureNativeWindowResizeHandleMock,
}));

vi.mock("../../ui/foundry/application-v2/window-size-constraints", () => ({
  ensureWindowSizeConstraints: ensureWindowSizeConstraintsMock,
}));

class FakeElement {
  public dataset: Record<string, string> = {};
  public classList = makeClassList();
  public attributes = [] as unknown as NamedNodeMap;
  private readonly selectors = new Map<string, unknown>();

  constructor(public readonly tagName = "div") {}

  setQueryResult(selector: string, value: unknown): void {
    this.selectors.set(selector, value);
  }

  querySelector(selector: string): unknown {
    return this.selectors.get(selector) ?? null;
  }

  setAttribute(name: string, value: string): void {
    if (name === "data-fth-window-affordance") this.dataset.fthWindowAffordance = value;
  }

  getAttribute(name: string): string | null {
    if (name === "data-fth-window-affordance") return this.dataset.fthWindowAffordance ?? null;
    return null;
  }

  getAttributeNames(): string[] {
    return Object.keys(this.dataset);
  }
}

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (...values: string[]) => values.forEach((value) => classes.add(value)),
    remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
    contains: (value: string) => classes.has(value),
  };
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

  getFoundryReactMountMock.mockImplementation((root: FakeElement | null | undefined) => {
    return root?.querySelector("[data-fth-react-root]") as HTMLElement | null;
  });
  ensureNativeWindowResizeHandleMock.mockImplementation((app: { window?: { resize?: HTMLElement | null } }) => {
    return app.window?.resize ?? null;
  });
});

describe("CharacterCreatorReactApp", () => {
  installFoundryAppClasses();
  const modPromise = import("./character-creator-react-app");

  it("builds the runtime class when ApplicationV2 is available", async () => {
    const mod = await modPromise;

    mod.buildCharacterCreatorReactAppClass();
    const AppClass = mod.getCharacterCreatorReactAppClass();

    expect(AppClass).not.toBeNull();
    expect((AppClass as { DEFAULT_OPTIONS?: { window?: { title?: string } } }).DEFAULT_OPTIONS?.window?.title)
      .toBe("Character Creation");
    expect(buildLegacyCharacterCreatorAppClassMock).toHaveBeenCalled();
    expect(logDebugMock).toHaveBeenCalledWith("Character Creator: CharacterCreatorReactApp class built");
  }, 10000);

  it("delegates resize handle wiring and window constraint wiring on every render", async () => {
    const mod = await modPromise;

    mod.buildCharacterCreatorReactAppClass();
    const AppClass = mod.getCharacterCreatorReactAppClass();
    expect(AppClass).not.toBeNull();

    const app = new (AppClass as NonNullable<typeof AppClass>)() as FakeBaseApplication & {
      _ensureController: () => unknown;
      _reactRenderer: {
        render: typeof foundryReactRenderMock;
        unmount: typeof foundryReactUnmountMock;
      };
      _onRender(context: Record<string, never>, options: unknown): Promise<void>;
    };
    const root = new FakeElement("div");
    const mount = new FakeElement("div");
    root.setQueryResult("[data-fth-react-root]", mount);
    app.element = root;
    app._ensureController = vi.fn(() => ({ id: "controller" }));
    app._reactRenderer = {
      render: foundryReactRenderMock,
      unmount: foundryReactUnmountMock,
    };

    await app._onRender({}, {});
    await app._onRender({}, {});

    expect(getFoundryReactMountMock.mock.calls.length).toBe(2);
    expect(getFoundryReactMountMock.mock.calls[0]?.[0]).toBe(root);
    expect(ensureNativeWindowResizeHandleMock.mock.calls.length).toBe(2);
    expect(ensureNativeWindowResizeHandleMock.mock.calls[0]?.[0]).toBe(app);
    expect(ensureNativeWindowResizeHandleMock.mock.calls[1]?.[0]).toBe(app);
    expect(ensureWindowSizeConstraintsMock.mock.calls.length).toBe(2);
    expect(ensureWindowSizeConstraintsMock.mock.calls[0]?.[0]).toBe(app);
    expect(ensureWindowSizeConstraintsMock.mock.calls[1]?.[0]).toBe(app);
    expect(ensureWindowSizeConstraintsMock.mock.calls[0]?.[1]).toEqual({
      minWidth: 760,
      maxWidth: 1480,
      minHeight: 560,
    });
    expect(app._ensureController).toHaveBeenCalledTimes(2);
    expect(foundryReactRenderMock).toHaveBeenCalledTimes(2);
    expect(foundryReactRenderMock.mock.calls[0]?.[0]).toBe(mount);
    expect(foundryReactRenderMock.mock.calls[1]?.[0]).toBe(mount);
  });
});
