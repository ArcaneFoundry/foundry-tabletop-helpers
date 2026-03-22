import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";
import {
  createClassExpertiseStep,
  createClassItemChoicesStep,
  createClassLanguagesStep,
  createClassToolsStep,
} from "./step-class-advancements";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "classExpertise", "classLanguages", "classTools", "classItemChoices", "classSummary", "review"],
    selections: {
      class: {
        uuid: "Compendium.test.classes.Item.rogue",
        name: "Rogue",
        img: "rogue.webp",
        identifier: "rogue",
        skillPool: ["acr", "ath", "inv", "prc", "ste"],
        skillCount: 4,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        classAdvancementRequirements: [
          {
            id: "expertise",
            type: "expertise",
            title: "Expertise",
            level: 1,
            advancementType: "Trait",
            requiredCount: 2,
            pool: ["skills:proficient"],
            groupKey: "expertise",
          },
          {
            id: "cant",
            type: "languages",
            title: "Thieves' Cant",
            level: 1,
            advancementType: "Trait",
            requiredCount: 1,
            pool: ["languages:standard:*"],
            groupKey: "languages",
          },
          {
            id: "tools",
            type: "tools",
            title: "Tool Proficiencies",
            level: 1,
            advancementType: "Trait",
            requiredCount: 1,
            pool: ["tool:*"],
            groupKey: "tools",
          },
          {
            id: "divine-order",
            type: "itemChoices",
            title: "Divine Order Choice",
            level: 1,
            advancementType: "ItemChoice",
            requiredCount: 1,
            pool: ["Compendium.test.Item.protector"],
            groupKey: "itemChoices",
            itemChoices: [
              { uuid: "Compendium.test.Item.protector", name: "Protector", img: "protector.webp" },
            ],
          },
        ],
      },
      background: {
        uuid: "bg",
        name: "Sage",
        img: "sage.webp",
        grants: {
          skillProficiencies: ["arc", "his"],
          weaponProficiencies: [],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: ["common"], chosen: [] },
      },
      species: {
        uuid: "species",
        name: "Human",
        img: "human.webp",
        traits: [],
        languageChoiceCount: 0,
        languageGrants: ["common"],
        skillChoiceCount: 0,
        skillGrants: [],
        skillChoicePool: [],
      },
      skills: { chosen: ["acr", "prc", "ste", "inv"] },
      classAdvancements: {
        expertiseSkills: [],
        chosenLanguages: [],
        chosenTools: [],
        itemChoices: {},
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

describe("class advancement steps", () => {
  it("keeps expertise and language steps incomplete until their required picks are filled", async () => {
    const state = makeState();
    const expertiseStep = createClassExpertiseStep();
    const languagesStep = createClassLanguagesStep();

    expect(expertiseStep.isApplicable(state)).toBe(true);
    expect(expertiseStep.isComplete(state)).toBe(false);
    expect(languagesStep.isApplicable(state)).toBe(true);
    expect(languagesStep.isComplete(state)).toBe(false);

    state.selections.classAdvancements!.expertiseSkills = ["acr", "ste"];
    state.selections.classAdvancements!.chosenLanguages = ["draconic"];

    expect(expertiseStep.isComplete(state)).toBe(true);
    expect(languagesStep.isComplete(state)).toBe(true);
  });

  it("builds grouped item-choice and tool view models from normalized requirements", async () => {
    const state = makeState();
    const toolsStep = createClassToolsStep();
    const itemChoicesStep = createClassItemChoicesStep();

    const toolsViewModel = await toolsStep.buildViewModel(state);
    const itemChoicesViewModel = await itemChoicesStep.buildViewModel(state);

    expect(toolsViewModel).toMatchObject({
      stepId: "classTools",
      requiredCount: 1,
      type: "tools",
    });
    expect(itemChoicesViewModel).toMatchObject({
      stepId: "classItemChoices",
      type: "itemChoices",
      requirements: [
        expect.objectContaining({
          id: "divine-order",
          title: "Divine Order Choice",
          requiredCount: 1,
        }),
      ],
    });
  });
});
