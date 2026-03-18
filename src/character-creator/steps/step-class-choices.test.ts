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
        hasWeaponMastery: true,
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
  it("builds the class choice preview from class metadata", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const step = createClassChoicesStep();

    const viewModel = await step.buildViewModel(makeState());

    expect(viewModel).toMatchObject({
      className: "Fighter",
      skillCount: 2,
      hasSkillChoices: true,
      hasWeaponMastery: true,
      primaryAbilityHint: "Strength or Dexterity recommended.",
    });
    expect((viewModel.skillPool as Array<{ label: string }>).map((skill) => skill.label)).toEqual([
      "Acrobatics",
      "Athletics",
      "Survival",
    ]);
  });
});
