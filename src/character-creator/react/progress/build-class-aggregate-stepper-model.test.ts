import { describe, expect, it } from "vitest";

import type { ClassSelection, WizardState } from "../../character-creator-types";
import { buildClassAggregateStepperModel } from "./build-class-aggregate-stepper-model";

function createState(overrides?: Partial<WizardState>): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "classExpertise", "classLanguages", "weaponMasteries", "classSummary", "review"],
    selections: {},
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: [],
        items: [],
      },
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
    { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", status: "pending" as const, active: true },
    { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "classExpertise", label: "Expertise", icon: "fa-solid fa-bullseye", status: "pending" as const, active: false },
    { id: "classLanguages", label: "Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Summary", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
  ];
}

function createClassSelection(overrides?: Partial<ClassSelection>): ClassSelection {
  return {
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
    ...overrides,
  };
}

describe("buildClassAggregateStepperModel", () => {
  it("keeps milestones pending before a class has been selected", () => {
    const model = buildClassAggregateStepperModel(createState(), createSteps(), "class");

    expect(model.milestones.map((milestone) => [milestone.id, milestone.status])).toEqual([
      ["class", "pending"],
      ["origins", "pending"],
    ]);
    expect(model.showSubsteps).toBe(false);
  });

  it("shows the dynamic subrail once a class is selected", () => {
    const model = buildClassAggregateStepperModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps(),
      "class",
    );

    expect(model.milestones[0]).toMatchObject({ id: "class", status: "selection-active" });
    expect(model.milestones[1]).toMatchObject({ id: "origins", status: "pending" });
    expect(model.showSubsteps).toBe(true);
    expect(model.substeps.map((step) => step.id)).toEqual([
      "classChoices",
      "classExpertise",
      "classLanguages",
      "weaponMasteries",
      "classSummary",
    ]);
  });

  it("highlights origins once the class phase reaches summary", () => {
    const steps = createSteps().map((step) =>
      ["classChoices", "classExpertise", "classLanguages", "weaponMasteries"].includes(step.id)
        ? { ...step, status: "complete" as const, active: false }
        : step
    );

    const model = buildClassAggregateStepperModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      steps,
      "classSummary",
    );

    expect(model.milestones[0]).toMatchObject({ id: "class", status: "in-progress" });
    expect(model.milestones[1]).toMatchObject({ id: "origins", status: "selection-active" });
    expect(model.substeps.find((step) => step.id === "classSummary")).toMatchObject({ status: "in-progress" });
  });
});
