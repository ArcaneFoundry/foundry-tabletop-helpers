import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logWarnMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const fetchDocumentMock = vi.fn();
const parseSpeciesTraitsMock = vi.fn();
const parseSpeciesLanguagesMock = vi.fn();
const parseSpeciesProficienciesMock = vi.fn();
const parseSpeciesItemChoicesMock = vi.fn();
const parseSpeciesAdvancementRequirementsMock = vi.fn();
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
  parseSpeciesTraits: parseSpeciesTraitsMock,
  parseSpeciesLanguages: parseSpeciesLanguagesMock,
  parseSpeciesProficiencies: parseSpeciesProficienciesMock,
  parseSpeciesItemChoices: parseSpeciesItemChoicesMock,
  parseSpeciesAdvancementRequirements: parseSpeciesAdvancementRequirementsMock,
}));

vi.mock("./card-select-utils", () => ({
  patchCardSelection: patchCardSelectionMock,
}));

class FakeElement {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => Promise<void> | void>>();
  private readonly selectorMap = new Map<string, unknown>();
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

  querySelector<T = unknown>(selector: string): T | null {
    return (this.selectorMap.get(selector) ?? null) as T | null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelector(selector: string, value: unknown): void {
    this.selectorMap.set(selector, value);
  }

  setQuerySelectorAll(selector: string, values: FakeElement[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["species", "speciesSkills", "speciesLanguages", "speciesItemChoices", "originSummary", "review"],
    selections: {},
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: ["pack.species"],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["standardArray"],
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
      uuid: "Compendium.species.human",
      name: "Human",
      img: "human.png",
      packId: "pack.species",
      packLabel: "PHB",
      type: "race",
    },
    {
      uuid: "Compendium.species.elf.high",
      name: "Elf, High",
      img: "high-elf.png",
      packId: "pack.species",
      packLabel: "PHB",
      type: "race",
    },
  ]);
  getCachedDescriptionMock.mockResolvedValue("<p>Species details</p>");
  parseSpeciesTraitsMock.mockReturnValue(["Darkvision"]);
  parseSpeciesLanguagesMock.mockReturnValue({
    fixed: ["common"],
    choiceCount: 1,
    choicePool: ["languages:standard:*"],
  });
  parseSpeciesProficienciesMock.mockReturnValue({
    fixedSkills: ["prc"],
    fixedWeaponProficiencies: [],
    skillChoiceCount: 1,
    skillChoicePool: ["skills:ins", "skills:sur"],
  });
  parseSpeciesItemChoicesMock.mockResolvedValue([]);
  parseSpeciesAdvancementRequirementsMock.mockResolvedValue([]);
});

describe("step species", () => {
  it("builds an art-led species view model without description dependencies", async () => {
    const { createSpeciesStep } = await import("./step-species");
    const step = createSpeciesStep();

    expect(step.renderMode).toBe("react");

    const viewModel = await step.buildViewModel(makeState({
      selections: {
        species: {
          uuid: "Compendium.species.human",
          name: "Human",
          img: "human.png",
        },
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect((viewModel.entries as Array<{ name: string; blurb?: string }>).map((entry) => entry.name)).toEqual(["Elf, High", "Human"]);
    expect((viewModel.entries as Array<{ blurb?: string }>).every((entry) => entry.blurb == null)).toBe(true);
    expect(getCachedDescriptionMock).not.toHaveBeenCalled();
    expect(viewModel).toMatchObject({
      hasEntries: true,
      emptyMessage: "No species available. Check your GM configuration.",
    });
  });

  it("selects a species and rebuilds the staged species choices payload", async () => {
    const { createSpeciesStep } = await import("./step-species");
    const step = createSpeciesStep();
    const setDataSilent = vi.fn();
    const card = new FakeElement();
    card.dataset.cardUuid = "Compendium.species.human";
    const root = new FakeElement();
    root.setQuerySelector(".cc-card-detail-pane", null);
    root.setQuerySelectorAll("[data-card-uuid]", [card]);

    fetchDocumentMock.mockResolvedValue({ id: "human-doc" });

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    await card.trigger("click");

    expect(fetchDocumentMock).toHaveBeenCalledWith("Compendium.species.human");
    expect(setDataSilent).toHaveBeenCalledWith(expect.objectContaining({
      uuid: "Compendium.species.human",
      name: "Human",
      traits: ["Darkvision"],
      languageGrants: ["common"],
      skillGrants: ["prc"],
    }));
    expect(patchCardSelectionMock).toHaveBeenCalledWith(
      root,
      "Compendium.species.human",
      expect.objectContaining({ name: "Human" }),
    );
  });
});
