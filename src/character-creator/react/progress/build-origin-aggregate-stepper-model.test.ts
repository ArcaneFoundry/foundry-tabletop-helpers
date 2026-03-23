import { describe, expect, it } from "vitest";

import type { WizardState } from "../../character-creator-types";
import { buildOriginAggregateStepperModel } from "./build-origin-aggregate-stepper-model";

function createState(overrides?: Partial<WizardState>): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "backgroundSkillConflicts", "backgroundAsi", "backgroundLanguages", "originChoices", "species", "speciesSkills", "speciesLanguages", "speciesItemChoices", "originSummary", "review"],
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
    { id: "background", label: "Background", icon: "fa-solid fa-scroll", status: "pending" as const, active: true },
    { id: "backgroundSkillConflicts", label: "Skill Conflicts", icon: "fa-solid fa-shuffle", status: "pending" as const, active: false },
    { id: "backgroundAsi", label: "Background Ability Scores", icon: "fa-solid fa-chart-line", status: "pending" as const, active: false },
    { id: "backgroundLanguages", label: "Background Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "originChoices", label: "Origin Feat", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "species", label: "Species", icon: "fa-solid fa-dna", status: "pending" as const, active: false },
    { id: "speciesSkills", label: "Species Skills", icon: "fa-solid fa-list-check", status: "pending" as const, active: false },
    { id: "speciesLanguages", label: "Species Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "speciesItemChoices", label: "Species Gifts", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "originSummary", label: "Origin Summary", icon: "fa-solid fa-layer-group", status: "pending" as const, active: false },
  ];
}

describe("buildOriginAggregateStepperModel", () => {
  it("renders the chosen class as the locked first milestone", () => {
    const model = buildOriginAggregateStepperModel(createState(), createSteps(), "background");

    expect(model.milestones[0]).toMatchObject({
      id: "class",
      label: "Rogue",
      icon: "fa-solid fa-mask",
      status: "complete",
    });
  });

  it("shows origins as the active second milestone with the full origin subrail", () => {
    const model = buildOriginAggregateStepperModel(
      createState({
        selections: {
          class: createState().selections.class,
          background: {
            uuid: "background.sage",
            name: "Sage",
            img: "sage.png",
            grants: {
              skillProficiencies: [],
              weaponProficiencies: [],
              toolProficiency: null,
              originFeatUuid: "feat.magic-initiate",
              originFeatName: "Magic Initiate",
              originFeatImg: "feat.png",
              asiPoints: 3,
              asiCap: 2,
              asiAllowed: ["con", "int", "wis"],
              asiSuggested: ["int", "wis"],
              languageGrants: [],
              languageChoiceCount: 2,
              languageChoicePool: [],
            },
            asi: { assignments: {} },
            languages: { fixed: [], chosen: [] },
          },
        },
      }),
      createSteps(),
      "backgroundLanguages",
    );

    expect(model.milestones[1]).toMatchObject({ id: "origin", active: true, status: "in-progress" });
    expect(model.showSubsteps).toBe(true);
    expect(model.substeps.map((step) => step.id)).toEqual([
      "background",
      "backgroundSkillConflicts",
      "backgroundAsi",
      "backgroundLanguages",
      "originChoices",
      "species",
      "speciesSkills",
      "speciesLanguages",
      "speciesItemChoices",
      "originSummary",
    ]);
  });

  it("keeps origin as a single active milestone through species steps", () => {
    const steps = createSteps().map((step) =>
      ["background", "backgroundSkillConflicts", "backgroundAsi", "backgroundLanguages", "originChoices"].includes(step.id)
        ? { ...step, status: "complete" as const, active: false }
        : step.id === "speciesSkills"
          ? { ...step, active: true }
          : step
    );

    const model = buildOriginAggregateStepperModel(
      createState({
        selections: {
          class: createState().selections.class,
          background: {
            uuid: "background.sage",
            name: "Sage",
            img: "sage.png",
            grants: {
              skillProficiencies: [],
              weaponProficiencies: [],
              toolProficiency: null,
              originFeatUuid: "feat.magic-initiate",
              originFeatName: "Magic Initiate",
              originFeatImg: "feat.png",
              asiPoints: 3,
              asiCap: 2,
              asiAllowed: ["con", "int", "wis"],
              asiSuggested: ["int", "wis"],
              languageGrants: [],
              languageChoiceCount: 2,
              languageChoicePool: [],
            },
            asi: { assignments: { int: 2, wis: 1 } },
            languages: { fixed: [], chosen: ["elvish", "giant"] },
          },
          species: {
            uuid: "species.human",
            name: "Human",
            img: "human.png",
          },
        },
      }),
      steps,
      "speciesSkills",
    );

    expect(model.milestones[1]).toMatchObject({ id: "origin", active: true, status: "in-progress" });
    expect(model.substeps.map((step) => step.id)).toEqual([
      "background",
      "backgroundSkillConflicts",
      "backgroundAsi",
      "backgroundLanguages",
      "originChoices",
      "species",
      "speciesSkills",
      "speciesLanguages",
      "speciesItemChoices",
      "originSummary",
    ]);
  });

  it("omits the conflict substep when the wizard does not surface it", () => {
    const steps = createSteps().filter((step) => step.id !== "backgroundSkillConflicts");
    const model = buildOriginAggregateStepperModel(createState(), steps, "background");

    expect(model.substeps.map((step) => step.id)).toEqual([
      "background",
      "backgroundAsi",
      "backgroundLanguages",
      "originChoices",
      "species",
      "speciesSkills",
      "speciesLanguages",
      "speciesItemChoices",
      "originSummary",
    ]);
  });
});
