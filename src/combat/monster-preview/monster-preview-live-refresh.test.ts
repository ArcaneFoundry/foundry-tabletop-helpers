import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMonsterPreviewLiveRefreshController,
  shouldRefreshMonsterPreviewActor,
} from "./monster-preview-live-refresh";

describe("monster preview live refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).game;
  });

  it("refreshes the active npc preview after actor updates settle", async () => {
    const refreshActiveActorPreview = vi.fn().mockResolvedValue(undefined);
    const activeActor = { id: "npc-1", type: "npc", name: "Dragon" };

    (globalThis as Record<string, unknown>).game = {
      combat: {
        combatant: {
          actor: activeActor,
        },
      },
    };

    const controller = createMonsterPreviewLiveRefreshController({
      getCurrentActorId: () => "npc-1",
      isDismissed: () => false,
      hasCachedContent: () => true,
      isEnabled: () => true,
      refreshActiveActorPreview,
      debounceMs: 100,
    });

    controller.handleActorUpdate(activeActor);
    controller.handleActorUpdate(activeActor);

    await vi.advanceTimersByTimeAsync(100);

    expect(refreshActiveActorPreview).toHaveBeenCalledTimes(1);
    const game = (globalThis as unknown as { game: { combat: unknown } }).game;
    expect(refreshActiveActorPreview).toHaveBeenCalledWith(
      activeActor,
      game.combat,
    );
  });

  it("refreshes from active-effect changes on the active npc", async () => {
    const refreshActiveActorPreview = vi.fn().mockResolvedValue(undefined);
    const activeActor = { id: "npc-1", type: "npc", name: "Dragon" };

    (globalThis as Record<string, unknown>).game = {
      combat: {
        combatant: {
          actor: activeActor,
        },
      },
    };

    const controller = createMonsterPreviewLiveRefreshController({
      getCurrentActorId: () => "npc-1",
      isDismissed: () => false,
      hasCachedContent: () => true,
      isEnabled: () => true,
      refreshActiveActorPreview,
      debounceMs: 100,
    });

    controller.handleEffectChange({ parent: activeActor });

    await vi.advanceTimersByTimeAsync(100);

    expect(refreshActiveActorPreview).toHaveBeenCalledTimes(1);
  });

  it("ignores updates when the preview is not eligible to refresh", async () => {
    const refreshActiveActorPreview = vi.fn().mockResolvedValue(undefined);

    (globalThis as Record<string, unknown>).game = {
      combat: {
        combatant: {
          actor: { id: "npc-1", type: "npc" },
        },
      },
    };

    const controller = createMonsterPreviewLiveRefreshController({
      getCurrentActorId: () => "npc-1",
      isDismissed: () => true,
      hasCachedContent: () => true,
      isEnabled: () => true,
      refreshActiveActorPreview,
      debounceMs: 100,
    });

    controller.handleActorUpdate({ id: "npc-1", type: "npc" });
    controller.handleEffectChange({ parent: { id: "npc-2", type: "npc" } });

    await vi.advanceTimersByTimeAsync(100);

    expect(refreshActiveActorPreview).not.toHaveBeenCalled();
    expect(shouldRefreshMonsterPreviewActor(
      { id: "npc-1", type: "npc" },
      {
        getCurrentActorId: () => "npc-1",
        isDismissed: () => false,
        hasCachedContent: () => false,
        isEnabled: () => true,
      },
    )).toBe(false);
  });
});
