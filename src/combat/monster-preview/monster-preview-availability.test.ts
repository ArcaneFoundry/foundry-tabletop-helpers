import { describe, expect, it } from "vitest";

import { shouldKeepMonsterPreviewVisible } from "./monster-preview-availability";

describe("monster preview availability", () => {
  it("always keeps the preview visible on npc turns", () => {
    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: true,
      persistBetweenTurns: false,
      pinned: false,
      hasCachedContent: false,
      dismissed: false,
    })).toBe(true);
  });

  it("does not keep the preview visible on non-npc turns by default", () => {
    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: false,
      persistBetweenTurns: false,
      pinned: false,
      hasCachedContent: true,
      dismissed: false,
    })).toBe(false);
  });

  it("keeps the preview visible on non-npc turns when persistence is enabled and content exists", () => {
    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: false,
      persistBetweenTurns: true,
      pinned: false,
      hasCachedContent: true,
      dismissed: false,
    })).toBe(true);
  });

  it("does not keep the preview visible when it was dismissed or there is no cached content", () => {
    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: false,
      persistBetweenTurns: true,
      pinned: false,
      hasCachedContent: true,
      dismissed: true,
    })).toBe(false);

    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: false,
      persistBetweenTurns: true,
      pinned: false,
      hasCachedContent: false,
      dismissed: false,
    })).toBe(false);
  });

  it("keeps the preview visible on non-npc turns when the preview is pinned", () => {
    expect(shouldKeepMonsterPreviewVisible({
      isNPCTurn: false,
      persistBetweenTurns: false,
      pinned: true,
      hasCachedContent: true,
      dismissed: false,
    })).toBe(true);
  });
});
