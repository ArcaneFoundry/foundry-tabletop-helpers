import { afterEach, describe, expect, it } from "vitest";

import type { WizardState } from "../character-creator-types";
import { getLanguagePool } from "./class-advancement-utils";

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: [],
    selections: {
      background: {
        uuid: "bg",
        name: "Sage",
        img: "sage.webp",
        grants: {
          skillProficiencies: [],
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
        languageGrants: [],
        skillChoiceCount: 0,
        skillGrants: [],
        skillChoicePool: [],
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

afterEach(() => {
  delete (globalThis as typeof globalThis & { CONFIG?: unknown }).CONFIG;
});

describe("class advancement utils", () => {
  it("flattens string-backed dnd5e language leaves into selectable class language options", () => {
    (globalThis as typeof globalThis & { CONFIG?: unknown }).CONFIG = {
      DND5E: {
        languages: {
          standard: {
            label: "Standard Languages",
            selectable: false,
            children: {
              common: "Common",
              draconic: "Draconic",
              sign: "Common Sign Language",
            },
          },
          exotic: {
            label: "Rare Languages",
            selectable: false,
            children: {
              cant: "Thieves' Cant",
              deep: "Deep Speech",
            },
          },
        },
      },
    };

    const pool = getLanguagePool(makeState());

    expect(pool).toEqual([
      { id: "common-sign", label: "Common Sign Language" },
      { id: "deep-speech", label: "Deep Speech" },
      { id: "draconic", label: "Draconic" },
    ]);
  });
});
