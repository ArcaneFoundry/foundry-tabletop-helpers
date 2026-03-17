import { describe, expect, it, vi } from "vitest";

import { createEquipmentStep } from "./step-equipment";

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: vi.fn(async () => undefined),
    getIndexedEntries: vi.fn(() => []),
  },
}));

function makeState() {
  return {
    currentStep: 0,
    applicableSteps: ["class", "equipment"],
    stepStatus: new Map(),
    selections: {
      class: {
        identifier: "fighter",
        name: "Fighter",
      },
      equipment: {
        method: "equipment",
      },
    },
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      equipmentMethod: "both",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  };
}

describe("step equipment", () => {
  it("surfaces the recommended gold fallback when equipment packages are selected", async () => {
    const step = createEquipmentStep();
    const viewModel = await step.buildViewModel(makeState() as never);

    expect(viewModel).toMatchObject({
      isEquipment: true,
      startingGold: 150,
      equipmentFallbackGold: 150,
      goldAmount: 150,
      className: "Fighter",
    });
  });

  it("initializes the default equipment selection so the wizard is not stranded on entry", () => {
    const step = createEquipmentStep();
    const state = makeState();
    delete (state.selections as { equipment?: { method: string } }).equipment;

    const setDataSilent = vi.fn();
    step.onActivate?.(
      state as never,
      {
        querySelectorAll: vi.fn(() => []),
        querySelector: vi.fn(() => null),
      } as unknown as HTMLElement,
      {
        setData: vi.fn(),
        setDataSilent,
        rerender: vi.fn(),
      },
    );

    expect(setDataSilent).toHaveBeenCalledWith({
      method: "equipment",
      goldAmount: undefined,
    });
  });
});
