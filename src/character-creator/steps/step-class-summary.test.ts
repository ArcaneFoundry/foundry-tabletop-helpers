import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classSummary", "review"],
    selections: {
      class: {
        uuid: "class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        hitDie: "d10",
        savingThrowProficiencies: ["str", "con"],
        armorProficiencies: ["Light", "Medium", "Shield"],
        weaponProficiencies: ["Simple", "Martial"],
        classFeatures: [
          { title: "Fighting Style", level: 1 },
          { title: "Second Wind", level: 1 },
        ],
      },
      classChoices: {
        chosenSkills: ["ath", "sur"],
        chosenWeaponMasteries: ["longsword", "shortbow"],
        chosenWeaponMasteryDetails: [
          { id: "longsword", label: "Longsword", mastery: "Sap" },
          { id: "shortbow", label: "Shortbow", mastery: "Vex" },
        ],
      },
      skills: { chosen: ["ath", "sur"] },
      abilities: {
        method: "standardArray",
        scores: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
        assignments: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 },
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

describe("step class summary", () => {
  it("builds a class grants summary with hp preview and features", async () => {
    const { createClassSummaryStep } = await import("./step-class-summary");
    const step = createClassSummaryStep();

    const viewModel = await step.buildViewModel(makeState());

    expect(viewModel).toMatchObject({
      className: "Fighter",
      hitDie: "d10",
      startingHpPreview: 12,
      usesAssignedCon: true,
      savingThrows: ["STR", "CON"],
      chosenSkills: ["Athletics", "Survival"],
      chosenWeaponMasteries: ["Longsword (Sap)", "Shortbow (Vex)"],
      armorProficiencies: ["Light", "Medium", "Shield"],
      weaponProficiencies: ["Simple", "Martial"],
      hasFeatures: true,
      hasChosenSkills: true,
      hasChosenWeaponMasteries: true,
    });
    expect((viewModel.features as Array<{ title: string }>).map((feature) => feature.title)).toEqual([
      "Fighting Style (Level 1)",
      "Second Wind (Level 1)",
    ]);
  });
});
