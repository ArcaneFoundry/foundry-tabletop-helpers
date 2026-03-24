import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const patchCardSelectionMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
    getCachedDescription: getCachedDescriptionMock,
  },
}));

vi.mock("./card-select-utils", () => ({
  patchCardSelection: patchCardSelectionMock,
}));

class FakeElement {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => void>>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
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
    applicableSteps: ["class", "subclass", "review"],
    selections: {
      class: {
        uuid: "Compendium.class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
    },
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: ["pack.subclasses"],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 3,
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
      uuid: "Compendium.subclass.champion",
      name: "Champion",
      img: "champion.png",
      packId: "pack.subclasses",
      packLabel: "PHB",
      type: "subclass",
      classIdentifier: "fighter",
    },
    {
      uuid: "Compendium.subclass.evoker",
      name: "School of Evocation",
      img: "evoker.png",
      packId: "pack.subclasses",
      packLabel: "PHB",
      type: "subclass",
      classIdentifier: "wizard",
    },
  ]);
  getCachedDescriptionMock.mockResolvedValue("<p>Subclass details</p>");
});

describe("step subclass", () => {
  it("uses the React rendering path for the subclass selection experience", async () => {
    const { createSubclassStep } = await import("./step-subclass");
    const step = createSubclassStep();

    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
  });

  it("only applies subclass selection once the class reaches level 3", async () => {
    const { createSubclassStep } = await import("./step-subclass");
    const step = createSubclassStep();

    for (const classSelection of [
      {
        uuid: "Compendium.class.barbarian",
        name: "Barbarian",
        img: "barbarian.png",
        identifier: "barbarian",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
      {
        uuid: "Compendium.class.bard",
        name: "Bard",
        img: "bard.png",
        identifier: "bard",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "cha",
        spellcastingProgression: "full",
      },
      {
        uuid: "Compendium.class.cleric",
        name: "Cleric",
        img: "cleric.png",
        identifier: "cleric",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "wis",
        spellcastingProgression: "full",
      },
      {
        uuid: "Compendium.class.druid",
        name: "Druid",
        img: "druid.png",
        identifier: "druid",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "wis",
        spellcastingProgression: "full",
      },
      {
        uuid: "Compendium.class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
      {
        uuid: "Compendium.class.monk",
        name: "Monk",
        img: "monk.png",
        identifier: "monk",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
      {
        uuid: "Compendium.class.paladin",
        name: "Paladin",
        img: "paladin.png",
        identifier: "paladin",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "cha",
        spellcastingProgression: "half",
      },
      {
        uuid: "Compendium.class.ranger",
        name: "Ranger",
        img: "ranger.png",
        identifier: "ranger",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "wis",
        spellcastingProgression: "half",
      },
      {
        uuid: "Compendium.class.rogue",
        name: "Rogue",
        img: "rogue.png",
        identifier: "rogue",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
      {
        uuid: "Compendium.class.sorcerer",
        name: "Sorcerer",
        img: "sorcerer.png",
        identifier: "sorcerer",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "cha",
        spellcastingProgression: "full",
      },
      {
        uuid: "Compendium.class.warlock",
        name: "Warlock",
        img: "warlock.png",
        identifier: "warlock",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "cha",
        spellcastingProgression: "pact",
      },
      {
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
    ]) {
      expect(step.isApplicable(makeState({
        config: { ...makeState().config, startingLevel: 1 },
        selections: { class: classSelection },
      }))).toBe(false);

      expect(step.isApplicable(makeState({
        config: { ...makeState().config, startingLevel: 2 },
        selections: { class: classSelection },
      }))).toBe(false);

      expect(step.isApplicable(makeState({
        config: { ...makeState().config, startingLevel: 3 },
        selections: { class: classSelection },
      }))).toBe(true);
    }
  });

  it("filters subclasses to the selected class and builds selected-entry details", async () => {
    const { createSubclassStep } = await import("./step-subclass");
    const step = createSubclassStep();

    const viewModel = await step.buildViewModel(makeState({
      selections: {
        class: {
          uuid: "Compendium.class.fighter",
          name: "Fighter",
          img: "fighter.png",
          identifier: "fighter",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: false,
          spellcastingAbility: "",
          spellcastingProgression: "",
        },
        subclass: {
          uuid: "Compendium.subclass.champion",
          name: "Champion",
          img: "champion.png",
          classIdentifier: "fighter",
        },
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect(viewModel).toMatchObject({
      stepId: "subclass",
      stepLabel: "Choose Your Subclass",
      hasEntries: true,
      emptyMessage: "No subclasses available for Fighter. Check your GM configuration.",
      selectedEntry: expect.objectContaining({
        uuid: "Compendium.subclass.champion",
        description: "<p>Subclass details</p>",
      }),
    });
    expect((viewModel.entries as Array<{ name: string }>).map((entry) => entry.name)).toEqual(["Champion"]);
  });

  it("exposes filtered subclasses through the internal helper", async () => {
    const { __subclassStepInternals } = await import("./step-subclass");
    const entries = __subclassStepInternals.getAvailableSubclasses(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.subclass.champion"]),
      },
    }));

    expect(entries).toEqual([]);
  });

  it("patches selection and stores the chosen subclass on click", async () => {
    const { createSubclassStep } = await import("./step-subclass");
    const step = createSubclassStep();
    const card = new FakeElement();
    card.dataset.cardUuid = "Compendium.subclass.champion";
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-card-uuid]", [card]);
    const setDataSilent = vi.fn();

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    card.trigger("click");

    expect(patchCardSelectionMock).toHaveBeenCalledWith(
      root,
      "Compendium.subclass.champion",
      expect.objectContaining({ name: "Champion" })
    );
    expect(setDataSilent).toHaveBeenCalledWith({
      uuid: "Compendium.subclass.champion",
      name: "Champion",
      img: "champion.png",
      classIdentifier: "fighter",
    });
  });
});
