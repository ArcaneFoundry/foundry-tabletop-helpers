import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../../types", () => ({
  fromUuid: fromUuidMock,
}));

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "spells", "review"],
    selections: {
      review: { characterName: "Arannis Vale" },
      species: { uuid: "species.human", name: "Human", img: "human.png", traits: [] },
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: "Magic Initiate",
          originFeatImg: "feat.png",
          asiPoints: 3,
          asiCap: 2,
          asiSuggested: ["int", "wis"],
          languageGrants: ["common"],
          languageChoiceCount: 2,
          languageChoicePool: ["languages:standard:*"],
        },
        asi: { assignments: { int: 2, wis: 1 } },
        languages: { fixed: ["common"], chosen: ["draconic", "elvish"] },
      },
      originFeat: { uuid: "feat.magic-initiate", name: "Magic Initiate", img: "feat.png", isCustom: false },
      class: {
        uuid: "class.wizard",
        name: "Wizard",
        img: "wizard.png",
        identifier: "wizard",
        skillPool: ["arc", "his"],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "int",
        spellcastingProgression: "full",
      },
      abilities: { method: "standardArray", scores: { str: 8, dex: 14, con: 13, int: 14, wis: 12, cha: 10 }, assignments: { str: 5, dex: 0, con: 2, int: 1, wis: 3, cha: 4 } },
      skills: { chosen: ["arc", "his"] },
      spells: {
        cantrips: ["spell.fire-bolt", "spell.light", "spell.mage-hand", "spell.prestidigitation"],
        spells: Array.from({ length: 14 }, (_, index) => `spell.${index}`),
        preparedSpells: Array.from({ length: 9 }, (_, index) => `spell.${index}`),
      },
      equipment: { method: "gold", goldAmount: 100 },
    },
    stepStatus: new Map(),
    config: {
      packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["standardArray"],
      maxRerolls: 0,
      startingLevel: 5,
      allowMulticlass: false,
      equipmentMethod: "gold",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fromUuidMock.mockResolvedValue({
    system: {
      advancement: [
        {
          type: "ScaleValue",
          configuration: {
            identifier: "max-prepared",
            scale: {
              5: { value: 9 },
            },
          },
        },
      ],
      spellcasting: {
        preparation: {
          formula: "@scale.wizard.max-prepared",
        },
      },
    },
  });
});

describe("step review", () => {
  it("shows the prepared-spell policy in the spells summary for wizard creation", async () => {
    const { createReviewStep } = await import("./step-review");
    const step = createReviewStep();

    const viewModel = await step.buildViewModel(makeState());
    const sections = viewModel.sections as Array<Record<string, unknown>>;
    const spellsSection = sections.find((section) => section.id === "spells");

    expect(spellsSection).toMatchObject({
      summary: "4 cantrips, 14 spells, 9 prepared",
      detail: "Choose which 9 leveled spells start prepared for this Wizard. You can change them later on the sheet.",
    });
  });

  it("shows prepared counts for other prepared casters once explicit picks are enabled", async () => {
    fromUuidMock.mockResolvedValueOnce({
      system: {
        advancement: [
          {
            type: "ScaleValue",
            configuration: {
              identifier: "max-prepared",
              scale: {
                5: { value: 5 },
              },
            },
          },
        ],
        spellcasting: {
          preparation: {
            formula: "@scale.cleric.max-prepared",
          },
        },
      },
    });

    const { createReviewStep } = await import("./step-review");
    const step = createReviewStep();
    const state = makeState();
    state.selections.class = {
      uuid: "class.cleric",
      name: "Cleric",
      img: "cleric.png",
      identifier: "cleric",
      skillPool: ["his", "ins"],
      skillCount: 2,
      isSpellcaster: true,
      spellcastingAbility: "wis",
      spellcastingProgression: "full",
    };
    state.selections.spells = {
      cantrips: ["spell.guidance", "spell.light", "spell.resistance", "spell.sacred-flame"],
      spells: Array.from({ length: 7 }, (_, index) => `spell.${index}`),
      preparedSpells: Array.from({ length: 5 }, (_, index) => `spell.${index}`),
    };

    const viewModel = await step.buildViewModel(state);
    const sections = viewModel.sections as Array<Record<string, unknown>>;
    const spellsSection = sections.find((section) => section.id === "spells");

    expect(spellsSection).toMatchObject({
      summary: "4 cantrips, 7 spells, 5 prepared",
      detail: "Choose which 5 leveled spells start prepared for this Cleric. You can change them later on the sheet.",
    });
  });
});
