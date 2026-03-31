import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const fetchDocumentMock = vi.fn();
const getCachedDescriptionMock = vi.fn();

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    fetchDocument: fetchDocumentMock,
    getCachedDescription: getCachedDescriptionMock,
  },
}));

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classSummary", "review"],
    selections: {
      class: {
        uuid: "class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: ["ath", "sur", "acr"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        hitDie: "d10",
        savingThrowProficiencies: ["str", "con"],
        armorProficiencies: ["Light", "Medium", "Shield"],
        weaponProficiencies: ["Simple", "Martial"],
        classFeatures: [
          { title: "Hit Points", level: 1 },
          { title: "Fighting Style", level: 1 },
          { title: "Second Wind", level: 1 },
          { title: "Action Surge", level: 2 },
        ],
        classAdvancementRequirements: [
          {
            id: "fighter-expertise",
            type: "expertise",
            title: "Expertise",
            level: 1,
            advancementType: "Trait",
            requiredCount: 2,
            pool: ["skills:proficient"],
            groupKey: "expertise",
          },
          {
            id: "fighter-language",
            type: "languages",
            title: "Battle Tongue",
            level: 1,
            advancementType: "Trait",
            requiredCount: 1,
            pool: ["languages:standard:*"],
            groupKey: "languages",
          },
          {
            id: "fighter-tools",
            type: "tools",
            title: "Field Kit Training",
            level: 1,
            advancementType: "Trait",
            requiredCount: 1,
            pool: ["tool:*"],
            groupKey: "tools",
          },
          {
            id: "fighter-order",
            type: "itemChoices",
            title: "Martial Doctrine",
            level: 1,
            advancementType: "ItemChoice",
            requiredCount: 1,
            pool: ["Compendium.test.Item.guardian", "Compendium.test.Item.skirmisher"],
            groupKey: "itemChoices",
            itemChoices: [
              { uuid: "Compendium.test.Item.guardian", name: "Guardian", img: "guardian.webp" },
              { uuid: "Compendium.test.Item.skirmisher", name: "Skirmisher", img: "skirmisher.webp" },
            ],
          },
        ],
      },
      background: {
        uuid: "background.sailor",
        name: "Sailor",
        img: "sailor.png",
        grants: {
          skillProficiencies: ["sur"],
          weaponProficiencies: [],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiAllowed: [],
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: [], chosen: [] },
      },
      classChoices: {
        chosenSkills: ["ath", "sur"],
      },
      weaponMasteries: {
        chosenWeaponMasteries: ["longsword", "shortbow"],
        chosenWeaponMasteryDetails: [
          { id: "longsword", label: "Longsword", mastery: "Sap" },
          { id: "shortbow", label: "Shortbow", mastery: "Vex" },
        ],
      },
      skills: { chosen: ["ath", "acr"] },
      classAdvancements: {
        expertiseSkills: ["ath", "sur"],
        chosenLanguages: ["draconic"],
        chosenTools: ["thief"],
        itemChoices: {
          "fighter-order": ["Compendium.test.Item.skirmisher"],
        },
      },
      abilities: {
        method: "standardArray",
        scores: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
        assignments: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 },
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

beforeEach(() => {
  vi.clearAllMocks();

  fetchDocumentMock.mockResolvedValue({
    system: {
      description: { value: "" },
      advancement: [
        {
          type: "Trait",
          title: "Armor Training",
          configuration: { grants: ["armor:lgt", "armor:med", "armor:shl"] },
        },
        {
          type: "Trait",
          title: "Weapon Proficiencies",
          configuration: { grants: ["weapon:sim", "weapon:mar"] },
        },
        {
          type: "Trait",
          title: "Tool Proficiencies",
          configuration: { grants: ["tool:thief"] },
        },
        {
          type: "ItemGrant",
          title: "Class Features",
          configuration: {
            items: [
              { uuid: "Compendium.features.hit-points", name: "Hit Points" },
              { uuid: "Compendium.features.fighting-style", name: "Fighting Style" },
              { uuid: "Compendium.features.second-wind", name: "Second Wind" },
            ],
          },
        },
        {
          type: "ItemGrant",
          level: 2,
          title: "Class Features",
          configuration: {
            items: [
              { uuid: "Compendium.features.action-surge", name: "Action Surge" },
            ],
          },
        },
      ],
    },
  });

  getCachedDescriptionMock.mockImplementation(async (uuid: string) => {
    if (uuid === "Compendium.features.fighting-style") return "<p>Adopt a signature combat technique.</p>";
    if (uuid === "Compendium.features.second-wind") return "<p>Take &Reference[Dash], &Reference[Disengage], or &amp;Reference[Hide].</p>";
    if (uuid === "Compendium.features.action-surge") return "<p>Push beyond your normal limits.</p>";
    return "";
  });
});

describe("step class summary", () => {
  it("stays unavailable until every class substep is complete", async () => {
    const { createClassSummaryStep } = await import("./step-class-summary");
    const step = createClassSummaryStep();
    const state = makeState();
    state.selections.class!.classAdvancementRequirements = [
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
    ];
    state.selections.classAdvancements = {
      expertiseSkills: ["ath"],
      chosenLanguages: [],
      chosenTools: [],
      itemChoices: {},
    };

    expect(step.isApplicable(state)).toBe(false);
    expect(step.isComplete(state)).toBe(false);

    state.selections.classAdvancements.expertiseSkills = ["ath", "sur"];

    expect(step.isApplicable(state)).toBe(true);
    expect(step.isComplete(state)).toBe(true);
  });

  it("builds a compact class summary with advancement-backed proficiencies and feature descriptions", async () => {
    const { createClassSummaryStep } = await import("./step-class-summary");
    const step = createClassSummaryStep();
    const state = makeState();
    state.selections.skills = { chosen: ["ath", "sur"] };

    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeDefined();

    const viewModel = await step.buildViewModel(state);

    expect(fetchDocumentMock).toHaveBeenCalledWith("class.fighter");
    expect(viewModel).toMatchObject({
      className: "Fighter",
      nextButtonLabel: "Confirm",
      overview: "",
      primaryAbilitySummary: "STR / DEX",
      startingLevel: 1,
      featureHeading: "First-Level Features",
      hitDie: "d10",
      savingThrows: ["STR", "CON"],
      chosenSkills: ["Athletics"],
      chosenWeaponMasteries: ["Longsword (Sap)", "Shortbow (Vex)"],
      armorProficiencies: ["Light", "Medium", "Shields"],
      weaponProficiencies: ["Simple", "Martial"],
      toolProficiencies: ["Thieves' Tools"],
      selectedGrantGroups: [
        {
          id: "fighter-expertise",
          title: "Expertise",
          iconClass: "fa-solid fa-bullseye",
          entries: ["Athletics", "Survival"],
        },
        {
          id: "fighter-language",
          title: "Battle Tongue",
          iconClass: "fa-solid fa-comments",
          entries: ["Draconic"],
        },
        {
          id: "fighter-tools",
          title: "Field Kit Training",
          iconClass: "fa-solid fa-hammer",
          entries: ["Thieves' Tools"],
        },
        {
          id: "fighter-order",
          title: "Martial Doctrine",
          iconClass: "fa-solid fa-stars",
          entries: ["Skirmisher"],
        },
      ],
      hasFeatures: true,
      hasChosenSkills: true,
      hasChosenWeaponMasteries: true,
      hasToolProficiencies: true,
    });
    expect(viewModel.features).toEqual([
      { title: "Fighting Style", description: "<p>Adopt a signature combat technique.</p>" },
      { title: "Second Wind", description: "<p>Take Dash, Disengage, or Hide.</p>" },
    ]);
  });
});
