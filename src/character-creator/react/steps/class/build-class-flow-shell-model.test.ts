import { describe, expect, it } from "vitest";

import type { ClassSelection, WizardState } from "../../../character-creator-types";
import { buildClassFlowShellModel } from "./build-class-flow-shell-model";

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

function createSteps(overrides?: Partial<Record<string, { status: "pending" | "complete"; active: boolean }>>) {
  const base = [
    { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", status: "pending" as const, active: true },
    { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "classExpertise", label: "Expertise", icon: "fa-solid fa-bullseye", status: "pending" as const, active: false },
    { id: "classLanguages", label: "Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Summary", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
  ];

  return base.map((step) => ({
    ...step,
    ...(overrides?.[step.id] ?? {}),
  }));
}

function createClassSelection(overrides?: Partial<ClassSelection>): ClassSelection {
  return {
    uuid: "Compendium.test.classes.Item.rogue",
    name: "Rogue",
    img: "rogue.webp",
    identifier: "rogue",
    skillPool: ["acr", "ste", "inv", "prc"],
    skillCount: 4,
    isSpellcaster: false,
    spellcastingAbility: "",
    spellcastingProgression: "",
    hasWeaponMastery: true,
    weaponMasteryCount: 2,
    weaponMasteryPool: ["weapon:sim:*"],
    ...overrides,
  };
}

describe("buildClassFlowShellModel", () => {
  it("keeps the shell in its default tone before any class is selected", () => {
    const model = buildClassFlowShellModel(createState(), createSteps(), "class");

    expect(model.currentPane).toBe("class");
    expect(model.title).toBe("Choose Your Class");
    expect(model.headerTone).toBe("default");
    expect(model.selectedClassIdentifier).toBeNull();
    expect(model.hero).toMatchObject({
      title: "Choose Your Class",
      description: "Choose the class that sets your hero on the first steps of the build.",
      primaryBadgeLabel: "Class Flow",
      secondaryBadgeLabel: "Choose your class",
    });
  });

  it("switches into the accent tone once a class is selected", () => {
    const model = buildClassFlowShellModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps(),
      "class",
    );

    expect(model.headerTone).toBe("accent");
    expect(model.selectedClassIdentifier).toBe("rogue");
    expect(model.aggregateStepper.milestones[0]).toMatchObject({ id: "class", status: "selection-active" });
    expect(model.hero.title).toBe("Choose Your Class");
  });

  it("maps the expertise pane into the mounted class shell", () => {
    const model = buildClassFlowShellModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps({
        class: { status: "complete", active: false },
        classChoices: { status: "complete", active: false },
        classExpertise: { status: "pending", active: true },
      }),
      "classExpertise",
    );

    expect(model.currentPane).toBe("classExpertise");
    expect(model.title).toBe("Choose Your Expertise");
    expect(model.headerTone).toBe("accent");
    expect(model.aggregateStepper.milestones[0]).toMatchObject({ id: "class", status: "in-progress" });
    expect(model.aggregateStepper.showSubsteps).toBe(true);
    expect(model.hero).toMatchObject({
      title: "Choose Your Expertise",
      primaryBadgeLabel: "Class Flow",
      secondaryBadgeLabel: "Choose your expertise",
    });
  });

  it("keeps the mounted shell active through the class summary pane", () => {
    const model = buildClassFlowShellModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps({
        class: { status: "complete", active: false },
        classChoices: { status: "complete", active: false },
        classExpertise: { status: "complete", active: false },
        classLanguages: { status: "complete", active: false },
        weaponMasteries: { status: "complete", active: false },
        classSummary: { status: "pending", active: true },
      }),
      "classSummary",
    );

    expect(model.currentPane).toBe("classSummary");
    expect(model.title).toBe("Class Summary");
    expect(model.headerTone).toBe("accent");
    expect(model.aggregateStepper.milestones[1]).toMatchObject({ id: "species", status: "selection-active" });
    expect(model.aggregateStepper.showSubsteps).toBe(false);
    expect(model.hero.title).toBe("Class Summary");
  });
});
