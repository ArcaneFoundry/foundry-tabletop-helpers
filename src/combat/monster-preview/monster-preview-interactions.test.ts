import { describe, expect, it, vi } from "vitest";

import {
  attachMonsterPreviewFloatingListeners,
  attachMonsterPreviewInlineListeners,
} from "./monster-preview-interactions";

class FakeButton {
  constructor(
    public dataset: { actorId?: string; mpAction?: string; skill?: string; ability?: string } = {},
  ) {}

  private listeners = new Map<string, () => void>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  click(): void {
    this.listeners.get("click")?.();
  }
}

describe("monster preview interactions", () => {
  it("wires inline dismiss and popout actions", () => {
    const close = new FakeButton();
    const pin = new FakeButton();
    const popout = new FakeButton();
    const actor = new FakeButton({ actorId: "npc-1" });
    const quickAction = new FakeButton({ actorId: "npc-1", mpAction: "roll-skill", skill: "prc" });
    const onDismiss = vi.fn();
    const onTogglePin = vi.fn();
    const onPopout = vi.fn();
    const onOpenActor = vi.fn();
    const onRunQuickAction = vi.fn();
    const el = {
      querySelector(selector: string) {
        if (selector === ".mp-close") return close;
        if (selector === ".mp-pin") return pin;
        if (selector === ".mp-popout") return popout;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".mp-open-actor") return [actor];
        if (selector === ".mp-quick-action") return [quickAction];
        return [];
      },
    } as unknown as HTMLElement;

    attachMonsterPreviewInlineListeners(el, { onDismiss, onTogglePin, onPopout, onOpenActor, onRunQuickAction });
    close.click();
    pin.click();
    popout.click();
    actor.click();
    quickAction.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onPopout).toHaveBeenCalledTimes(1);
    expect(onOpenActor).toHaveBeenCalledWith("npc-1");
    expect(onRunQuickAction).toHaveBeenCalledWith({
      action: "roll-skill",
      actorId: "npc-1",
      ability: undefined,
      skill: "prc",
    });
  });

  it("wires floating dismiss and dock actions", () => {
    const close = new FakeButton();
    const pin = new FakeButton();
    const dock = new FakeButton();
    const reset = new FakeButton();
    const minimize = new FakeButton();
    const actor = new FakeButton({ actorId: "pc-1" });
    const quickAction = new FakeButton({ actorId: "pc-1", mpAction: "roll-save", ability: "wis" });
    const onDismiss = vi.fn();
    const onTogglePin = vi.fn();
    const onDock = vi.fn();
    const onResetLayout = vi.fn();
    const onToggleMinimize = vi.fn();
    const onOpenActor = vi.fn();
    const onRunQuickAction = vi.fn();
    const el = {
      querySelector(selector: string) {
        if (selector === ".mp-close") return close;
        if (selector === ".mp-pin") return pin;
        if (selector === ".mp-dock") return dock;
        if (selector === ".mp-reset-layout") return reset;
        if (selector === ".mp-minimize, .mp-expand") return minimize;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".mp-open-actor") return [actor];
        if (selector === ".mp-quick-action") return [quickAction];
        return [];
      },
    } as unknown as HTMLElement;

    attachMonsterPreviewFloatingListeners(el, { onDismiss, onTogglePin, onDock, onResetLayout, onToggleMinimize, onOpenActor, onRunQuickAction });
    close.click();
    pin.click();
    dock.click();
    reset.click();
    minimize.click();
    actor.click();
    quickAction.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onDock).toHaveBeenCalledTimes(1);
    expect(onResetLayout).toHaveBeenCalledTimes(1);
    expect(onToggleMinimize).toHaveBeenCalledTimes(1);
    expect(onOpenActor).toHaveBeenCalledWith("pc-1");
    expect(onRunQuickAction).toHaveBeenCalledWith({
      action: "roll-save",
      actorId: "pc-1",
      ability: "wis",
      skill: undefined,
    });
  });
});
