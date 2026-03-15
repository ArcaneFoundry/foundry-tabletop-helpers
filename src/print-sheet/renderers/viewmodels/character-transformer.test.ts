import { describe, expect, it } from "vitest";

import type { CharacterData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import { transformCharacterToViewModel } from "./character-transformer";

const defaultOptions: PrintOptions = {
  paperSize: "letter",
  portrait: "portrait",
  sections: {},
};

function makeCharacterData(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    name: "Aela <Scout>",
    img: "portrait.webp",
    tokenImg: "token.webp",
    details: {
      race: "Elf",
      background: "Outlander",
      alignment: "Chaotic Good",
      level: 5,
      classes: [
        { name: "Ranger", level: 5, subclass: "Hunter" },
      ],
    },
    abilities: [
      { key: "str", label: "Strength", value: 10, mod: 0, save: 0, proficient: false },
      { key: "dex", label: "Dexterity", value: 18, mod: 4, save: 7, proficient: true, saveProficient: true },
      { key: "con", label: "Constitution", value: 14, mod: 2, save: 2, proficient: false },
      { key: "int", label: "Intelligence", value: 12, mod: 1, save: 1, proficient: false },
      { key: "wis", label: "Wisdom", value: 16, mod: 3, save: 6, proficient: true, saveProficient: true },
      { key: "cha", label: "Charisma", value: 8, mod: -1, save: -1, proficient: false },
    ],
    skills: [
      { key: "prc", label: "Perception", total: 6, passive: 16, proficiency: 1, ability: "wis" },
      { key: "ins", label: "Insight", total: 6, passive: 16, proficiency: 1, ability: "wis" },
      { key: "inv", label: "Investigation", total: 1, passive: 11, proficiency: 0, ability: "int" },
      { key: "ste", label: "Stealth", total: 7, passive: 17, proficiency: 1, ability: "dex" },
    ],
    combat: {
      ac: 15,
      hp: { value: 38, max: 38, temp: 2, tempmax: 0 },
      death: { success: 0, failure: 0 },
      initiative: 4,
      speed: [{ key: "walk", value: 35 }],
      proficiency: 3,
      inspiration: false,
      senses: [{ key: "darkvision", value: 60 }],
      hitDice: { d10: { value: 5, max: 5 } },
    },
    actions: {
      weapons: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      other: [],
    },
    spellcasting: null,
    inventory: [],
    features: [],
    proficiencies: {
      armor: ["Light Armor"],
      weapons: ["Martial Weapons"],
      tools: [],
      weaponMasteries: ["Longbow"],
    },
    favorites: new Set(),
    backstory: "<p>Wanderer of the deep wood.</p>",
    traits: {
      size: "Medium",
      resistances: ["cold"],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: ["charmed"],
      languages: ["Common", "Elvish"],
    },
    currency: { pp: 0, gp: 12, ep: 0, sp: 5, cp: 0 },
    ...overrides,
  };
}

describe("character transformer shell", () => {
  it("builds the top-level view model with escaped identity and portrait selection", () => {
    const result = transformCharacterToViewModel(makeCharacterData(), defaultOptions);

    expect(result.name).toBe("Aela &lt;Scout&gt;");
    expect(result.portraitUrl).toBe("portrait.webp");
    expect(result.hasPortrait).toBe(true);
    expect(result.subtitle).toContain("Level 5 Ranger 5 (Hunter)");
    expect(result.subtitle).toContain("Elf");
    expect(result.sensesLine).toBe("darkvision 60 ft");
    expect(result.defensesLine).toContain("<strong>Resist:</strong> cold");
    expect(result.hasDefenses).toBe(true);
    expect(result.hasProficiencies).toBe(true);
    expect(result.hasCurrency).toBe(true);
    expect(result.paperClass).toBe("fth-paper-letter");
  });

  it("honors token portraits and section visibility toggles", () => {
    const result = transformCharacterToViewModel(makeCharacterData({
      img: "",
      backstory: "",
    }), {
      paperSize: "a4",
      portrait: "token",
      sections: {
        abilities: false,
        skills: false,
        actions: false,
        spells: false,
        features: false,
        inventory: false,
        backstory: false,
      },
    });

    expect(result.portraitUrl).toBe("token.webp");
    expect(result.hasPortrait).toBe(true);
    expect(result.showAbilities).toBe(false);
    expect(result.showSkills).toBe(false);
    expect(result.showActions).toBe(false);
    expect(result.showSpells).toBe(false);
    expect(result.showFeatures).toBe(false);
    expect(result.showInventory).toBe(false);
    expect(result.showBackstory).toBe(false);
    expect(result.hasBackstory).toBe(false);
    expect(result.paperClass).toBe("fth-paper-a4");
  });
});
