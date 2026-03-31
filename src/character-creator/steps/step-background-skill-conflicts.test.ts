import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";
import {
  applyLegalClassSkillSelections,
  getAvailableClassSkillKeys,
  getBackgroundSkillConflictOptions,
  getLegalClassSkillKeys,
} from "./origin-flow-utils";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "backgroundSkillConflicts", "backgroundAsi", "review"],
    selections: {
      class: {
        uuid: "class.rogue",
        name: "Rogue",
        img: "rogue.png",
        identifier: "rogue",
        skillPool: ["acr", "arc", "ath", "ins", "prc", "ste"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
      },
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc", "his"],
          weaponProficiencies: [],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 3,
          asiCap: 2,
          asiAllowed: ["con", "int", "wis"],
          asiSuggested: ["int", "wis"],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: [], chosen: [] },
      },
      species: {
        uuid: "species.elf",
        name: "Elf",
        img: "elf.png",
        skillGrants: ["prc"],
      },
      speciesChoices: {
        hasChoices: true,
        chosenLanguages: [],
        chosenSkills: ["ins"],
        chosenItems: {},
      },
      skills: {
        chosen: ["arc", "ste", "ins"],
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
  };
}

describe("step background skill conflicts", () => {
  it("keeps the retired conflict step out of the active flow", async () => {
    const { createBackgroundSkillConflictsStep } = await import("./step-background-skill-conflicts");
    const step = createBackgroundSkillConflictsStep();
    const state = makeState();

    expect(step.isApplicable(state)).toBe(false);
    expect(step.isComplete(state)).toBe(true);
    expect(step.getStatusHint?.(state)).toBe("");

    const viewModel = await step.buildViewModel(state);
    expect(viewModel).toMatchObject({
      stepId: "backgroundSkillConflicts",
      retired: true,
    });
  });

  it("filters class skills against origin-granted and species-choice skills", () => {
    const state = makeState();

    expect(getAvailableClassSkillKeys(state)).toEqual(["acr", "ath", "ste"]);
    expect(getLegalClassSkillKeys(state)).toEqual(["ste"]);
    expect(getBackgroundSkillConflictOptions(state).map((option) => option.id)).toEqual(["acr", "ath"]);
    expect(applyLegalClassSkillSelections(state, ["arc", "ste", "ins", "ste"])).toEqual(["ste"]);
    expect(state.selections.skills).toEqual({
      chosen: ["ste"],
    });
  });
});
