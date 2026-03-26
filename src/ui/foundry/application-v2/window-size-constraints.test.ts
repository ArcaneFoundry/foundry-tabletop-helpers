import { describe, expect, it, vi } from "vitest";

import {
  clampApplicationPosition,
  ensureWindowSizeConstraints,
  type ApplicationPositionLike,
  type ApplicationV2PositionLike,
} from "./window-size-constraints";

function makeApp(overrides: Partial<ApplicationV2PositionLike> = {}): ApplicationV2PositionLike {
  return {
    position: { width: 860, height: 640, top: 24, left: 18 },
    setPosition: vi.fn(),
    ...overrides,
  };
}

describe("clampApplicationPosition", () => {
  it("returns the input position unchanged when no constraints are provided", () => {
    expect(clampApplicationPosition({ width: 640, height: 480 }, {})).toEqual({ width: 640, height: 480 });
  });

  it("clamps width below the configured minimum and above the configured maximum", () => {
    expect(clampApplicationPosition({ width: 640 }, { minWidth: 760 })).toEqual({ width: 760 });
    expect(clampApplicationPosition({ width: 1640 }, { maxWidth: 1480 })).toEqual({ width: 1480 });
  });

  it("clamps height below the configured minimum and above the configured maximum", () => {
    expect(clampApplicationPosition({ height: 420 }, { minHeight: 560 })).toEqual({ height: 560 });
    expect(clampApplicationPosition({ height: 1280 }, { maxHeight: 1000 })).toEqual({ height: 1000 });
  });

  it("preserves non-size position fields while clamping numeric width and height", () => {
    expect(clampApplicationPosition(
      { width: 500, height: 1200, top: 14, left: 10, scale: 0.9, zIndex: 200 },
      { minWidth: 760, maxHeight: 1000 },
    )).toEqual({
      width: 760,
      height: 1000,
      top: 14,
      left: 10,
      scale: 0.9,
      zIndex: 200,
    });
  });
});

describe("ensureWindowSizeConstraints", () => {
  it("is a no-op when no constraints are provided", () => {
    const originalUpdatePosition = vi.fn((position: ApplicationPositionLike) => ({ ...position }));
    const app = makeApp({ _updatePosition: originalUpdatePosition });

    ensureWindowSizeConstraints(app, {});

    expect(app._updatePosition).toBe(originalUpdatePosition);
    expect(app.setPosition).not.toHaveBeenCalled();
  });

  it("is idempotent across repeated wiring on the same app instance", () => {
    const originalUpdatePosition = vi.fn((position: ApplicationPositionLike) => ({ ...position }));
    const app = makeApp({ _updatePosition: originalUpdatePosition });

    ensureWindowSizeConstraints(app, { minWidth: 760 });
    const wrappedUpdatePosition = app._updatePosition;
    ensureWindowSizeConstraints(app, { minWidth: 760 });

    expect(app._updatePosition).toBe(wrappedUpdatePosition);
    expect(app.setPosition).not.toHaveBeenCalled();
    expect(app._updatePosition?.({ width: 500, height: 640 })).toEqual({ width: 760, height: 640 });
    expect(originalUpdatePosition).toHaveBeenCalledTimes(1);
  });

  it("honors the original _updatePosition implementation before applying clamps", () => {
    const originalUpdatePosition = vi.fn((position: ApplicationPositionLike) => ({
      ...position,
      width: (position.width ?? 0) + 80,
      height: (position.height ?? 0) + 40,
      top: 12,
    }));
    const app = makeApp({ _updatePosition: originalUpdatePosition });

    ensureWindowSizeConstraints(app, { maxWidth: 760, maxHeight: 560 });

    expect(app._updatePosition?.({ width: 720, height: 540, left: 20 })).toEqual({
      width: 760,
      height: 560,
      top: 12,
      left: 20,
    });
    expect(originalUpdatePosition).toHaveBeenCalledWith({ width: 720, height: 540, left: 20 });
  });

  it("immediately normalizes an out-of-bounds current position", () => {
    const app = makeApp({
      position: { width: 500, height: 1200, top: 10, left: 16, scale: 0.95 },
    });

    ensureWindowSizeConstraints(app, { minWidth: 760, maxHeight: 1000 });

    expect(app.setPosition).toHaveBeenCalledWith({
      width: 760,
      height: 1000,
      top: 10,
      left: 16,
      scale: 0.95,
    });
  });

  it("falls back to updating app.position when setPosition is unavailable", () => {
    const app = makeApp({
      position: { width: 520, height: 520, top: 5, left: 8 },
      setPosition: undefined,
    });

    ensureWindowSizeConstraints(app, { minWidth: 760, minHeight: 560 });

    expect(app.position).toEqual({ width: 760, height: 560, top: 5, left: 8 });
  });
});
