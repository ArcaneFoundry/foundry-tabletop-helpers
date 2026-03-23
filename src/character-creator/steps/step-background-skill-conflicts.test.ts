import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";
import { applyBackgroundSkillConflictSelections, getBackgroundSkillConflictOptions } from "./origin-flow-utils";

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
      skills: {
        chosen: ["arc", "ste"],
      },
      species: {
        uuid: "species.elf",
        name: "Elf",
        img: "elf.png",
        skillGrants: ["prc"],
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
  it("surfaces the conflict step only when background skills overlap class picks", async () => {
    const { createBackgroundSkillConflictsStep } = await import("./step-background-skill-conflicts");
    const step = createBackgroundSkillConflictsStep();
    const state = makeState();

    expect(step.isApplicable(state)).toBe(true);
    expect(step.isComplete(state)).toBe(false);

    const viewModel = await step.buildViewModel(state);
    expect(viewModel).toMatchObject({
      backgroundName: "Sage",
      className: "Rogue",
      conflictingSkills: ["Arcana"],
      retainedSkills: ["Stealth"],
      fixedBackgroundSkills: ["Arcana", "History"],
      replacementCount: 1,
    });
  });

  it("filters replacement options against background, retained, and already-known skills", () => {
    const options = getBackgroundSkillConflictOptions(makeState());
    expect(options.map((option) => option.id)).toEqual(["acr", "ath", "ins"]);
  });

  it("rewrites class skills to a de-duplicated replacement set", async () => {
    const { createBackgroundSkillConflictsStep } = await import("./step-background-skill-conflicts");
    const step = createBackgroundSkillConflictsStep();
    const state = makeState();

    applyBackgroundSkillConflictSelections(state, ["ins"]);
    state.selections.backgroundSkillConflicts = ["ins"];

    expect(state.selections.skills).toEqual({
      chosen: ["ste", "ins"],
    });
    expect(step.isApplicable(state)).toBe(false);
    expect(step.isComplete(state)).toBe(true);
  });

  it("keeps chosen replacements distinct from retained class skills in the view model", async () => {
    const { createBackgroundSkillConflictsStep } = await import("./step-background-skill-conflicts");
    const step = createBackgroundSkillConflictsStep();
    const state = makeState();

    applyBackgroundSkillConflictSelections(state, ["ins"]);
    state.selections.backgroundSkillConflicts = ["ins"];

    const viewModel = await step.buildViewModel(state);
    expect(viewModel).toMatchObject({
      retainedSkills: ["Stealth"],
      selectedReplacementSkills: ["Insight"],
    });
  });
});
