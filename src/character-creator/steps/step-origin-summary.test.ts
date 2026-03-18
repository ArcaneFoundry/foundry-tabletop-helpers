import { describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["originSummary", "review"],
    selections: {
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          toolProficiency: "art:calligrapher",
          originFeatUuid: "feat.magic-initiate",
          originFeatName: "Magic Initiate",
          originFeatImg: "feat.png",
          asiPoints: 3,
          asiCap: 2,
          asiSuggested: ["int", "wis"],
          languageGrants: ["common"],
          languageChoiceCount: 1,
          languageChoicePool: [],
        },
        asi: { assignments: { int: 2, wis: 1 } },
        languages: { fixed: ["common"], chosen: ["draconic"] },
      },
      species: {
        uuid: "species.elf",
        name: "Elf",
        img: "elf.png",
        traits: ["Darkvision"],
        languageGrants: ["elvish"],
        skillGrants: ["prc"],
        itemChoiceGroups: [
          {
            id: "wizard-cantrip",
            title: "Wizard Cantrip",
            count: 1,
            options: [{ uuid: "spell.light", name: "Light" }],
          },
        ],
        languageChoiceCount: 0,
      },
      speciesChoices: {
        hasChoices: true,
        chosenLanguages: ["Giant"],
        chosenSkills: ["nat"],
        chosenItems: {
          "wizard-cantrip": ["spell.light"],
        },
      },
      skills: { chosen: ["his", "ins"] },
      originFeat: { uuid: "feat.magic-initiate", name: "Magic Initiate", img: "feat.png", isCustom: false },
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

describe("step origin summary", () => {
  it("builds the combined background and species summary", async () => {
    const { createOriginSummaryStep } = await import("./step-origin-summary");
    const vm = await createOriginSummaryStep().buildViewModel(makeState());

    expect(vm).toMatchObject({
      backgroundName: "Sage",
      speciesName: "Elf",
      speciesSkills: ["Perception", "Nature"],
      speciesItems: ["Light"],
      toolProficiency: "Art: Calligrapher",
      originFeatName: "Magic Initiate",
      speciesTraits: ["Darkvision"],
    });
    expect(vm.languages).toEqual(["Common", "Elvish", "Draconic", "Giant"]);
  });
});
