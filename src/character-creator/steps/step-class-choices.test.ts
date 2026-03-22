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
  it("builds selectable class skills", async () => {
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
        maxCount: 2,
      }),
    });
    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
    expect((vm.skillSection as { options: Array<{ label: string }> }).options.map((skill) => skill.label)).toEqual([
      "Acrobatics",
      "Athletics",
      "Survival",
    ]);
  });

  it("treats mirrored skill selections as completion state", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const step = createClassChoicesStep();
    const state = makeState();
    state.selections.skills = { chosen: ["ath", "sur"] };
    state.selections.classChoices = { chosenSkills: ["ath", "sur"] };

    expect(step.isComplete(state)).toBe(true);
    expect(step.getStatusHint?.(state)).toBe("");
  });
});
