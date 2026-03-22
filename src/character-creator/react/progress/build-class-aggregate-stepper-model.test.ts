import { describe, expect, it } from "vitest";

import type { ClassSelection, WizardState } from "../../character-creator-types";
import { buildClassAggregateStepperModel } from "./build-class-aggregate-stepper-model";

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

function createSteps() {
  return [
    { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", status: "pending" as const, active: true },
    { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Features", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
  ];
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

describe("buildClassAggregateStepperModel", () => {
  it("keeps the class node pending before a class has been selected", () => {
    const model = buildClassAggregateStepperModel(createState(), createSteps(), "class");

    expect(model.main.status).toBe("pending");
    expect(model.main.children.map((child) => child.visible)).toEqual([false, false]);
  });

  it("enters selection-active and previews relevant children on the class screen", () => {
    const model = buildClassAggregateStepperModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      createSteps(),
      "class",
    );

    expect(model.main.status).toBe("selection-active");
    expect(model.main.glowActive).toBe(true);
    expect(model.main.children[0]).toMatchObject({ id: "classChoices", visible: true, status: "pending" });
    expect(model.main.children[1]).toMatchObject({ id: "weaponMasteries", visible: true, status: "pending" });
  });

  it("hides the mastery child for classes without weapon mastery choices", () => {
    const model = buildClassAggregateStepperModel(
      createState({
        selections: {
          class: createClassSelection({
            identifier: "wizard",
            name: "Wizard",
            hasWeaponMastery: false,
            weaponMasteryCount: 0,
            weaponMasteryPool: [],
          }),
        },
      }),
      createSteps(),
      "class",
    );

    expect(model.main.children[0]).toMatchObject({ id: "classChoices", visible: true });
    expect(model.main.children[1]).toMatchObject({ id: "weaponMasteries", visible: false, status: "skipped" });
  });

  it("collapses the class group once class-related work is complete and the wizard has moved on", () => {
    const steps = createSteps().map((step) => {
      if (step.id === "classChoices" || step.id === "weaponMasteries") {
        return { ...step, status: "complete" as const };
      }
      return step;
    });

    const model = buildClassAggregateStepperModel(
      createState({
        selections: { class: createClassSelection() },
      }),
      steps,
      "background",
    );

    expect(model.main.status).toBe("collapsed-complete");
  });
});
