import { describe, expect, it } from "vitest";

import { getInitialMonsterPreviewDisplayState } from "./monster-preview-display";

describe("monster preview display defaults", () => {
  const storage = {
    getItem(key: string): string | null {
      if (key === "mode") return "floating";
      if (key === "minimized") return "true";
      return null;
    },
  };

  it("uses explicit inline mode", () => {
    expect(getInitialMonsterPreviewDisplayState("inline", storage, "mode", "minimized")).toEqual({
      isFloating: false,
      isMinimized: false,
    });
  });

  it("uses explicit floating modes", () => {
    expect(getInitialMonsterPreviewDisplayState("floating", storage, "mode", "minimized")).toEqual({
      isFloating: true,
      isMinimized: false,
    });
    expect(getInitialMonsterPreviewDisplayState("floatingMinimized", storage, "mode", "minimized")).toEqual({
      isFloating: true,
      isMinimized: true,
    });
  });

  it("falls back to remembered local storage state", () => {
    expect(getInitialMonsterPreviewDisplayState("remember", storage, "mode", "minimized")).toEqual({
      isFloating: true,
      isMinimized: true,
    });
  });
});
