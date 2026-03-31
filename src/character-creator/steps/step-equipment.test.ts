import { describe, expect, it, vi, beforeEach } from "vitest";

import { createEquipmentShopStep, createEquipmentStep } from "./step-equipment";

const {
  ensureEquipmentShopMetadataReadyMock,
  resolveEquipmentFlowMock,
  syncEquipmentSelectionSnapshotMock,
  deriveEquipmentStateMock,
} = vi.hoisted(() => ({
  ensureEquipmentShopMetadataReadyMock: vi.fn(),
  resolveEquipmentFlowMock: vi.fn(),
  syncEquipmentSelectionSnapshotMock: vi.fn(),
  deriveEquipmentStateMock: vi.fn(),
}));

vi.mock("../character-creator-index-cache", () => ({
  ensureEquipmentShopMetadataReady: ensureEquipmentShopMetadataReadyMock,
}));

vi.mock("./equipment-flow-utils", () => ({
  buildDefaultEquipmentSelection: () => ({
    purchases: {},
    sales: {},
    shopMode: "buy",
    baseGoldCp: 0,
    remainingGoldCp: 0,
  }),
  getEquipmentSelection: (state: any) => state.selections.equipment ?? {},
  resolveEquipmentFlow: resolveEquipmentFlowMock,
  syncEquipmentSelectionSnapshot: syncEquipmentSelectionSnapshotMock,
  deriveEquipmentState: deriveEquipmentStateMock,
}));

function makeState(overrides?: Record<string, unknown>) {
  const selectionOverrides = (overrides?.selections as Record<string, unknown> | undefined) ?? {};
  const configOverrides = (overrides?.config as Record<string, unknown> | undefined) ?? {};
  const baseSelections = {
    class: {
      uuid: "class.wizard",
      identifier: "wizard",
      name: "Wizard",
    },
    background: {
      uuid: "background.sage",
      name: "Sage",
    },
    equipment: {
      purchases: {},
      sales: {},
      shopMode: "buy",
      ...((selectionOverrides.equipment as Record<string, unknown> | undefined) ?? {}),
    },
  };
  const baseConfig = {
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
    ...configOverrides,
  };

  return {
    currentStep: 0,
    applicableSteps: ["class", "background", "equipment", "equipmentShop"],
    stepStatus: new Map(),
    ...overrides,
    selections: {
      ...baseSelections,
      ...selectionOverrides,
    },
    config: baseConfig,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveEquipmentFlowMock.mockResolvedValue({
    classSource: {
      source: "class",
      label: "Wizard",
      img: "wizard.png",
      options: [{ id: "class-gold", source: "class", mode: "gold", title: "Take Gold Instead", description: "Gain 100 gp", items: [], goldCp: 0, totalValueCp: 10000 }],
    },
    backgroundSource: {
      source: "background",
      label: "Sage",
      img: "sage.png",
      options: [{ id: "background-kit", source: "background", mode: "equipment", title: "Sage Supplies", description: "Ink and references", items: [], goldCp: 0, totalValueCp: 0 }],
    },
    shopInventory: [],
  });
  deriveEquipmentStateMock.mockReturnValue({
    selectedClassOption: null,
    selectedBackgroundOption: null,
    baseGoldCp: 0,
    remainingGoldCp: 0,
    inventory: [],
    purchases: [],
    sales: [],
  });
});

describe("step equipment", () => {
  it("builds a source-aware view model for class and background provisions", async () => {
    const step = createEquipmentStep();
    const viewModel = await step.buildViewModel(makeState() as never);

    expect(step.reactComponent).toBeTypeOf("function");
    expect(ensureEquipmentShopMetadataReadyMock).toHaveBeenCalled();
    expect(resolveEquipmentFlowMock).toHaveBeenCalled();
    expect(viewModel).toMatchObject({
      stepId: "equipment",
      stepTitle: "Build",
      stepLabel: "Equipment",
      hideShellHeader: true,
      hideStepIndicator: true,
    });
  });

  it("requires both class and background choices before the step completes", () => {
    const step = createEquipmentStep();
    expect(step.isComplete(makeState() as never)).toBe(false);
    expect(step.getStatusHint?.(makeState() as never)).toBe("Choose your class provisions");
    expect(step.isComplete(makeState({
      selections: {
        equipment: {
          classOptionId: "class-gold",
          backgroundOptionId: "background-kit",
          purchases: {},
          sales: {},
          shopMode: "buy",
        },
      },
    }) as never)).toBe(true);
    expect(step.getStatusHint?.(makeState({
      selections: {
        equipment: {
          classOptionId: "class-gold",
          purchases: {},
          sales: {},
          shopMode: "buy",
        },
      },
    }) as never)).toBe("Choose your background provisions");
  });

  it("shows the shop step only when equipment selections leave spendable funds", () => {
    const step = createEquipmentShopStep();
    expect(step.isApplicable(makeState() as never)).toBe(false);
    expect(step.reactComponent).toBeTypeOf("function");
    expect(step.isApplicable(makeState({
      selections: {
        equipment: {
          classOptionId: "class-gold",
          backgroundOptionId: "background-kit",
          purchases: {},
          sales: {},
          shopMode: "buy",
          baseGoldCp: 10000,
          remainingGoldCp: 10000,
        },
      },
    }) as never)).toBe(true);
  });
});
