import { describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

class FakeOption {
  disabled = false;
  constructor(public value: string) {}
}

class FakeSelect {
  dataset: Record<string, string> = {};
  value = "";
  private readonly listeners = new Map<string, Array<() => void>>();
  private readonly selectorAllMap = new Map<string, unknown[]>();

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }

  querySelectorAll<T = unknown>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) ?? []) as T[];
  }

  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

class FakeCheckbox {
  dataset: Record<string, string> = {};
  checked = false;
  disabled = false;
  private readonly listeners = new Map<string, Array<() => void>>();

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }
}

class FakeElement {
  private readonly selectorAllMap = new Map<string, unknown[]>();

  querySelectorAll<T = unknown>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) ?? []) as T[];
  }

  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["species", "speciesChoices", "review"],
    selections: {
      species: {
        uuid: "species.human",
        name: "Human",
        img: "human.png",
        traits: ["Resourceful"],
        languageGrants: ["common"],
        languageChoiceCount: 1,
        languageChoicePool: ["languages:standard:*"],
        skillChoiceCount: 1,
        skillChoicePool: ["arc", "prc", "sur"],
        itemChoiceGroups: [
          {
            id: "wizard-cantrip",
            title: "Wizard Cantrip",
            count: 2,
            options: [
              { uuid: "spell.light", name: "Light" },
              { uuid: "spell.prestidigitation", name: "Prestidigitation" },
              { uuid: "spell.mage-hand", name: "Mage Hand" },
            ],
          },
        ],
      },
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: [], chosen: [] },
      },
      skills: { chosen: ["sur"] },
    },
    stepStatus: new Map(),
    config: {
      packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["standardArray"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  };
}

describe("step species choices", () => {
  it("builds a real species language-choice view model", async () => {
    const { createSpeciesChoicesStep } = await import("./step-species-choices");
    const vm = await createSpeciesChoicesStep().buildViewModel(makeState());

    expect(vm).toMatchObject({
      speciesName: "Human",
      hasTraits: true,
      fixedLanguages: ["Common"],
      hasLanguageChoices: true,
      hasSkillChoices: true,
      hasItemChoices: true,
      note: "Choose the additional grants provided by Human.",
      requiredItemChoiceCount: 2,
      chosenItemChoiceCount: 0,
    });
    expect((vm.languageSlots as Array<unknown>)).toHaveLength(1);
    expect((vm.availableSpeciesSkills as Array<{ key: string }>).map((skill) => skill.key)).toEqual(["prc"]);
  });

  it("stores selected species languages, skills, and item choices and completes when the slots are filled", async () => {
    const { createSpeciesChoicesStep } = await import("./step-species-choices");
    const step = createSpeciesChoicesStep();
    const state = makeState();
    const setDataSilent = vi.fn();

    const lang0 = new FakeSelect();
    lang0.dataset.speciesLangSlot = "0";
    lang0.value = "elvish";
    lang0.setQuerySelectorAll("option", [new FakeOption(""), new FakeOption("elvish"), new FakeOption("dwarvish")]);
    const skill0 = new FakeCheckbox();
    skill0.dataset.speciesSkill = "prc";
    skill0.checked = true;
    skill0.disabled = false;
    const item0 = new FakeCheckbox();
    item0.dataset.speciesChoiceGroup = "wizard-cantrip";
    item0.dataset.speciesChoiceUuid = "spell.light";
    item0.checked = true;
    const item1 = new FakeCheckbox();
    item1.dataset.speciesChoiceGroup = "wizard-cantrip";
    item1.dataset.speciesChoiceUuid = "spell.prestidigitation";
    item1.checked = true;
    const item2 = new FakeCheckbox();
    item2.dataset.speciesChoiceGroup = "wizard-cantrip";
    item2.dataset.speciesChoiceUuid = "spell.mage-hand";
    item2.checked = true;
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-species-lang-slot]", [lang0]);
    root.setQuerySelectorAll("[data-species-skill]", [skill0]);
    root.setQuerySelectorAll("[data-species-choice-uuid]", [item0, item1, item2]);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    skill0.trigger("change");
    item0.trigger("change");
    item1.checked = true;
    item1.trigger("change");
    lang0.trigger("change");

    expect(state.selections.speciesChoices).toMatchObject({
      hasChoices: true,
      chosenLanguages: ["elvish"],
      chosenSkills: ["prc"],
      chosenItems: {
        "wizard-cantrip": ["spell.light", "spell.prestidigitation"],
      },
    });
    expect(item2.disabled).toBe(true);
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalled();
  });
});
