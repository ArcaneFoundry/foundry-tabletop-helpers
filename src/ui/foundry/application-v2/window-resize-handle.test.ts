import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureNativeWindowResizeHandle } from "./window-resize-handle";

class FakeElement {
  public dataset: Record<string, string> = {};
  public className = "";
  public classList = makeClassList();

  constructor(public tagName = "div") {}

  setAttribute(name: string, value: string): void {
    if (name === "data-fth-window-affordance") this.dataset.fthWindowAffordance = value;
  }

  getAttribute(name: string): string | null {
    if (name === "data-fth-window-affordance") return this.dataset.fthWindowAffordance ?? null;
    return null;
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

function makeApp(extra: Record<string, unknown> = {}) {
  return {
    hasFrame: true,
    window: {
      resize: new FakeElement("button") as unknown as HTMLElement,
    },
    ...extra,
  };
}

describe("ensureNativeWindowResizeHandle", () => {
  const originalHTMLElement = globalThis.HTMLElement;

  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLElement", {
      value: FakeElement,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "HTMLElement", {
      value: originalHTMLElement,
      configurable: true,
      writable: true,
    });
  });

  it("returns null when the app has no frame", () => {
    expect(ensureNativeWindowResizeHandle(makeApp({ hasFrame: false }))).toBeNull();
  });

  it("treats omitted hasFrame as a resizable app", () => {
    const app = makeApp({ hasFrame: undefined });

    expect(ensureNativeWindowResizeHandle(app)).toBe(app.window.resize);
    expect(app.window.resize.classList.contains("fth-window-resize-handle")).toBe(true);
    expect(app.window.resize.getAttribute("data-fth-window-affordance")).toBe("native");
  });

  it("returns null when the app has no native resize handle", () => {
    expect(ensureNativeWindowResizeHandle(makeApp({ window: {} }))).toBeNull();
  });

  it("decorates the native resize handle with a stable class and future theming seam", () => {
    const app = makeApp();
    const resize = ensureNativeWindowResizeHandle(app);

    expect(resize).toBe(app.window.resize);
    expect(resize?.classList.contains("fth-window-resize-handle")).toBe(true);
    expect(resize?.getAttribute("data-fth-window-affordance")).toBe("native");
  });

  it("is idempotent across repeated calls", () => {
    const app = makeApp();
    const first = ensureNativeWindowResizeHandle(app);
    const second = ensureNativeWindowResizeHandle(app);

    expect(second).toBe(first);
    expect(second?.classList.contains("fth-window-resize-handle")).toBe(true);
    expect(second?.getAttribute("data-fth-window-affordance")).toBe("native");
  });
});
