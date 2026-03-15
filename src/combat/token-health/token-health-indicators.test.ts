import { beforeEach, describe, expect, it, vi } from "vitest";

const hooksOn = vi.fn();
const isGMMock = vi.fn();
const getVisibilityMock = vi.fn();

vi.mock("../../logger", () => ({
  Log: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../types", () => ({
  getHooks: () => ({ on: hooksOn }),
  isGM: isGMMock,
}));

vi.mock("./token-health-settings", () => ({
  getTokenHealthVisibility: getVisibilityMock,
}));

class FakeGraphics {
  beginFill = vi.fn();
  lineStyle = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  quadraticCurveTo = vi.fn();
  drawCircle = vi.fn();
  endFill = vi.fn();
}

class FakeText {
  anchor = { set: vi.fn() };
  position = { set: vi.fn() };

  constructor(
    public readonly value: string,
    public readonly style: Record<string, unknown>,
  ) {}
}

class FakeContainer {
  name = "";
  eventMode = "";
  interactiveChildren = true;
  children: unknown[] = [];
  removeChildren = vi.fn(() => {
    this.children = [];
  });
  destroy = vi.fn();
  addChild(child: unknown): void {
    this.children.push(child);
  }
}

class FakeToken {
  readonly children = new Map<string, FakeContainer>();

  constructor(
    public readonly actor: {
      hasPlayerOwner?: boolean;
      system?: {
        attributes?: {
          ac?: { value?: number };
          hp?: { value?: number; max?: number };
        };
      };
    } | undefined,
    public readonly w = 100,
    public readonly h = 100,
  ) {}

  addChild(child: FakeContainer): void {
    if (child.name) this.children.set(child.name, child);
  }

  removeChild(child: FakeContainer): void {
    this.children.delete(child.name);
  }

  getChildByName(name: string): FakeContainer | null {
    return this.children.get(name) ?? null;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  isGMMock.mockReturnValue(true);
  getVisibilityMock.mockReturnValue("everyone");
  (globalThis as Record<string, unknown>).PIXI = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Text: FakeText,
  };
});

describe("token health indicators", () => {
  it("registers draw/refresh/delete hooks", async () => {
    const mod = await import("./token-health-indicators");
    mod.registerTokenHealthHooks();

    expect(hooksOn).toHaveBeenCalledWith("drawToken", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("refreshToken", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("deleteToken", expect.any(Function));
  });

  it("draws indicators for NPC tokens and removes them on delete", async () => {
    const mod = await import("./token-health-indicators");
    mod.registerTokenHealthHooks();

    const onDrawToken = hooksOn.mock.calls.find((call) => call[0] === "drawToken")?.[1] as
      (token: FakeToken) => void;
    const onDeleteToken = hooksOn.mock.calls.find((call) => call[0] === "deleteToken")?.[1] as
      (token: FakeToken) => void;

    const token = new FakeToken({
      hasPlayerOwner: false,
      system: {
        attributes: {
          ac: { value: 15 },
          hp: { value: 18, max: 24 },
        },
      },
    });

    onDrawToken(token);

    const container = token.getChildByName("fth-health-indicators");
    expect(container).not.toBeNull();
    expect(container?.children).toHaveLength(4);

    onDeleteToken(token);

    expect(container?.removeChildren).toHaveBeenCalled();
    expect(container?.destroy).toHaveBeenCalled();
    expect(token.getChildByName("fth-health-indicators")).toBeNull();
  });

  it("removes or suppresses indicators when visibility or ownership disallows them", async () => {
    const mod = await import("./token-health-indicators");
    mod.registerTokenHealthHooks();

    const onDrawToken = hooksOn.mock.calls.find((call) => call[0] === "drawToken")?.[1] as
      (token: FakeToken) => void;
    const onRefreshToken = hooksOn.mock.calls.find((call) => call[0] === "refreshToken")?.[1] as
      (token: FakeToken) => void;

    const token = new FakeToken({
      hasPlayerOwner: false,
      system: {
        attributes: {
          ac: { value: 12 },
          hp: { value: 7, max: 10 },
        },
      },
    });

    onDrawToken(token);
    expect(token.getChildByName("fth-health-indicators")).not.toBeNull();

    getVisibilityMock.mockReturnValue("gm");
    isGMMock.mockReturnValue(false);
    onRefreshToken(token);
    expect(token.getChildByName("fth-health-indicators")).toBeNull();

    getVisibilityMock.mockReturnValue("everyone");
    isGMMock.mockReturnValue(true);
    const pcToken = new FakeToken({
      hasPlayerOwner: true,
      system: {
        attributes: {
          ac: { value: 16 },
          hp: { value: 20, max: 20 },
        },
      },
    });
    onDrawToken(pcToken);
    expect(pcToken.getChildByName("fth-health-indicators")).toBeNull();
  });
});
