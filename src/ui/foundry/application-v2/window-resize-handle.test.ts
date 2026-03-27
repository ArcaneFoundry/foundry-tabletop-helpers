import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureNativeWindowResizeHandle } from "./window-resize-handle";

class FakeElement {
  public className = "";
  public classList = makeClassList();

  constructor(public tagName = "div") {}
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
  });

  it("returns null when the app has no native resize handle", () => {
    expect(ensureNativeWindowResizeHandle(makeApp({ window: {} }))).toBeNull();
  });

  it("returns the native resize handle without decorating it", () => {
    const app = makeApp();
    const resize = ensureNativeWindowResizeHandle(app);

    expect(resize).toBe(app.window.resize);
  });

  it("is idempotent across repeated calls", () => {
    const app = makeApp();
    const first = ensureNativeWindowResizeHandle(app);
    const second = ensureNativeWindowResizeHandle(app);

    expect(second).toBe(first);
  });
});
