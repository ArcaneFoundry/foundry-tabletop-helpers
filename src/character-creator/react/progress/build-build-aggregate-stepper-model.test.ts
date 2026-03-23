import { describe, expect, it } from "vitest";

import type { WizardState } from "../../character-creator-types";
import { buildBuildAggregateStepperModel } from "./build-build-aggregate-stepper-model";

function createState(overrides?: Partial<WizardState>): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["abilities", "feats", "equipment", "spells", "review"],
    selections: {
      class: {
        uuid: "Compendium.test.classes.Item.rogue",
        name: "Rogue",
        img: "rogue.webp",
        identifier: "rogue",
        skillPool: ["ath", "sur"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        hasWeaponMastery: true,
        weaponMasteryCount: 2,
        weaponMasteryPool: ["weapon:sim:*", "weapon:mar:*"],
      },
    },
    stepStatus: new Map(),
    config: {
      packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
      disabledUUIDs: new Set(),
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

function createSteps() {
  return [
    { id: "abilities", label: "Ability Scores", icon: "fa-solid fa-dice-d20", status: "pending" as const, active: true },
    { id: "feats", label: "Feats", icon: "fa-solid fa-star", status: "pending" as const, active: false },
    { id: "equipment", label: "Equipment", icon: "fa-solid fa-sack", status: "pending" as const, active: false },
    { id: "spells", label: "Spells", icon: "fa-solid fa-wand-sparkles", status: "pending" as const, active: false },
  ];
}

describe("buildBuildAggregateStepperModel", () => {
  it("shows class and origins locked complete while build is active", () => {
    const model = buildBuildAggregateStepperModel(createState(), createSteps(), "abilities");

    expect(model.milestones.map((milestone) => [milestone.id, milestone.status])).toEqual([
      ["class", "complete"],
      ["origins", "complete"],
      ["build", "in-progress"],
      ["finalize", "pending"],
    ]);
    expect(model.substeps.map((step) => step.id)).toEqual(["abilities", "feats", "equipment", "spells"]);
    expect(model.showSubsteps).toBe(true);
  });

  it("surfaces the conditional shop substep when the wizard includes it", () => {
    const model = buildBuildAggregateStepperModel(
      createState(),
      [
        ...createSteps().slice(0, 3),
        { id: "equipmentShop", label: "Shop", icon: "fa-solid fa-store", status: "pending" as const, active: false },
        createSteps()[3]!,
      ],
      "equipment",
    );

    expect(model.substeps.map((step) => step.id)).toEqual(["abilities", "feats", "equipment", "equipmentShop", "spells"]);
  });
});
