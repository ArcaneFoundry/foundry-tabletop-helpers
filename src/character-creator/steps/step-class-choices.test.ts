import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "review"],
    selections: {
      class: {
        uuid: "class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: ["acr", "ath", "sur"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        primaryAbilities: ["str", "dex"],
        primaryAbilityHint: "Strength or Dexterity recommended.",
        savingThrowProficiencies: ["str", "con"],
        armorProficiencies: ["Light", "Medium", "Shields"],
        weaponProficiencies: ["Simple", "Martial"],
      },
      background: {
        uuid: "background.sailor",
        name: "Sailor",
        img: "sailor.png",
        grants: {
          skillProficiencies: ["ath"],
          weaponProficiencies: [],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiAllowed: [],
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: [], chosen: [] },
      },
      species: {
        uuid: "species.elf",
        name: "Elf",
        img: "elf.png",
        skillGrants: ["sur"],
      },
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

describe("step class choices", () => {
  it("builds selectable class skills from the legal pool only", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const step = createClassChoicesStep();
    const vm = await step.buildViewModel(makeState());

    expect(vm).toMatchObject({
      stepId: "classChoices",
      hideStepIndicator: true,
      hideShellHeader: true,
      className: "Fighter",
      classIdentifier: "fighter",
      primaryAbilityHint: "Strength or Dexterity recommended.",
      savingThrows: ["STR", "CON"],
      skillSection: expect.objectContaining({
        hasChoices: true,
        maxCount: 1,
      }),
    });
    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
    expect((vm.skillSection as { options: Array<{ label: string }> }).options.map((skill) => skill.label)).toEqual([
      "Acrobatics",
    ]);
  });

  it("treats filtered legal skill selections as completion state", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const step = createClassChoicesStep();
    const state = makeState();
    state.selections.skills = { chosen: ["ath", "acr"] };
    state.selections.classChoices = { chosenSkills: ["ath", "acr"] };

    expect(step.isComplete(state)).toBe(true);
    expect(step.getStatusHint?.(state)).toBe("");
  });
});
