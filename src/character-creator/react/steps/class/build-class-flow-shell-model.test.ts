import { describe, expect, it } from "vitest";

import type { ClassSelection, WizardState } from "../../../character-creator-types";
import { buildClassFlowShellModel } from "./build-class-flow-shell-model";

function createState(overrides?: Partial<WizardState>): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "classSummary", "weaponMasteries", "review"],
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
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Features", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
  ];

  return base.map((step) => ({
    ...step,
    ...(overrides?.[step.id] ?? {}),
  }));
}

function createClassSelection(overrides?: Partial<ClassSelection>): ClassSelection {
  return {
    uuid: "Compendium.test.classes.Item.fighter",
    name: "Fighter",
    img: "fighter.webp",
    identifier: "fighter",
    skillPool: ["ath", "sur"],
    skillCount: 2,
    isSpellcaster: false,
    spellcastingAbility: "",
    spellcastingProgression: "",
    hasWeaponMastery: true,
    weaponMasteryCount: 3,
    weaponMasteryPool: ["weapon:sim:*", "weapon:mar:*"],
    ...overrides,
  };
}

describe("buildClassFlowShellModel", () => {
  it("keeps the class shell in its default tone before any class is selected", () => {
    const model = buildClassFlowShellModel(createState(), createSteps(), "class");

    expect(model.currentPane).toBe("class");
    expect(model.title).toBe("Choose Your Class");
    expect(model.headerTone).toBe("default");
    expect(model.selectedClassIdentifier).toBeNull();
  });

  it("switches the class shell into the accent tone once a class is selected", () => {
    const model = buildClassFlowShellModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps(),
      "class",
    );

    expect(model.currentPane).toBe("class");
    expect(model.headerTone).toBe("accent");
    expect(model.selectedClassIdentifier).toBe("fighter");
    expect(model.aggregateStepper.main.status).toBe("selection-active");
  });

  it("tracks the skills pane and keeps the shell accented while class work is in progress", () => {
    const model = buildClassFlowShellModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps({
        class: { status: "complete", active: false },
        classChoices: { status: "pending", active: true },
      }),
      "classChoices",
    );

    expect(model.currentPane).toBe("classChoices");
    expect(model.title).toBe("Choose Your Skills");
    expect(model.headerTone).toBe("accent");
    expect(model.aggregateStepper.main.status).toBe("in-progress");
  });
});
