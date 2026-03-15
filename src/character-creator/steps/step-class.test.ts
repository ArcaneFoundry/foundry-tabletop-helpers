import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logWarnMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const fetchDocumentMock = vi.fn();
const parseClassSkillAdvancementMock = vi.fn();
const parseClassSpellcastingMock = vi.fn();
const patchCardSelectionMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
  },
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
    getCachedDescription: getCachedDescriptionMock,
    fetchDocument: fetchDocumentMock,
  },
}));

vi.mock("../data/advancement-parser", () => ({
  parseClassSkillAdvancement: parseClassSkillAdvancementMock,
  parseClassSpellcasting: parseClassSpellcastingMock,
}));

vi.mock("./card-select-utils", () => ({
  patchCardSelection: patchCardSelectionMock,
}));

class FakeElement {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => Promise<void> | void>>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  addEventListener(event: string, handler: () => Promise<void> | void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  async trigger(event: string): Promise<void> {
    for (const handler of this.listeners.get(event) ?? []) {
      await handler();
    }
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelectorAll(selector: string, values: FakeElement[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "review"],
    selections: {},
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: ["pack.classes"],
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
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).Element = FakeElement;

  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.class.fighter",
      name: "Fighter",
      img: "fighter.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "fighter",
    },
    {
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "wizard",
    },
  ]);
  getCachedDescriptionMock.mockResolvedValue("<p>Class details</p>");
  parseClassSkillAdvancementMock.mockReturnValue({
    skillPool: ["arc", "his"],
    skillCount: 2,
  });
  parseClassSpellcastingMock.mockReturnValue({
    isSpellcaster: true,
    ability: "int",
    progression: "full",
  });
});

describe("step class", () => {
  it("filters enabled classes and hydrates the selected description", async () => {
    const { createClassStep } = await import("./step-class");
    const step = createClassStep();

    const viewModel = await step.buildViewModel(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.class.fighter"]),
      },
      selections: {
        class: {
          uuid: "Compendium.class.wizard",
          name: "Wizard",
          img: "wizard.png",
          identifier: "wizard",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: true,
          spellcastingAbility: "int",
          spellcastingProgression: "full",
        },
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect((viewModel.entries as Array<{ name: string }>).map((entry) => entry.name)).toEqual(["Wizard"]);
    expect(viewModel).toMatchObject({
      selectedEntry: expect.objectContaining({
        uuid: "Compendium.class.wizard",
        description: "<p>Class details</p>",
      }),
      hasEntries: true,
      emptyMessage: "No classes available. Check your GM configuration.",
    });
  });

  it("exposes enabled classes through the internal helper", async () => {
    const { __classStepInternals } = await import("./step-class");
    const entries = __classStepInternals.getAvailableClasses(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.class.wizard"]),
      },
    }));

    expect(entries).toEqual([
      expect.objectContaining({ uuid: "Compendium.class.fighter" }),
    ]);
  });

  it("stores advancement-derived class data and falls back gracefully on parse errors", async () => {
    const { createClassStep } = await import("./step-class");
    const step = createClassStep();
    const setDataSilent = vi.fn();
    const card = new FakeElement();
    card.dataset.cardUuid = "Compendium.class.wizard";
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-card-uuid]", [card]);

    fetchDocumentMock.mockResolvedValue({ id: "doc-wizard" });

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    await card.trigger("click");

    expect(fetchDocumentMock).toHaveBeenCalledWith("Compendium.class.wizard");
    expect(parseClassSkillAdvancementMock).toHaveBeenCalled();
    expect(parseClassSpellcastingMock).toHaveBeenCalled();
    expect(patchCardSelectionMock).toHaveBeenCalledWith(
      root,
      "Compendium.class.wizard",
      expect.objectContaining({ name: "Wizard" })
    );
    expect(setDataSilent).toHaveBeenCalledWith({
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      identifier: "wizard",
      skillPool: ["arc", "his"],
      skillCount: 2,
      isSpellcaster: true,
      spellcastingAbility: "int",
      spellcastingProgression: "full",
    });

    vi.clearAllMocks();
    fetchDocumentMock.mockRejectedValue(new Error("boom"));
    const setDataSilentFallback = vi.fn();
    const fallbackCard = new FakeElement();
    fallbackCard.dataset.cardUuid = "Compendium.class.fighter";
    const fallbackRoot = new FakeElement();
    fallbackRoot.setQuerySelectorAll("[data-card-uuid]", [fallbackCard]);

    step.onActivate?.(makeState(), fallbackRoot as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent: setDataSilentFallback,
      rerender: vi.fn(),
    });

    await fallbackCard.trigger("click");

    expect(logWarnMock).toHaveBeenCalledWith("Failed to parse class advancement data", expect.any(Error));
    expect(setDataSilentFallback).toHaveBeenCalledWith({
      uuid: "Compendium.class.fighter",
      name: "Fighter",
      img: "fighter.png",
      identifier: "fighter",
      skillPool: [],
      skillCount: 2,
      isSpellcaster: false,
      spellcastingAbility: "",
      spellcastingProgression: "",
    });
  });
});
