import { describe, expect, it } from "vitest";

import type { NPCData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import { transformNPCToViewModel } from "./npc-transformer";

const options: PrintOptions = {
  paperSize: "letter",
  portrait: "token",
  sections: {},
};

function makeNPCData(overrides: Partial<NPCData> = {}): NPCData {
  return {
    name: "Young Red Dragon",
    img: "dragon.webp",
    tokenImg: "dragon-token.webp",
    cr: "10",
    xp: 5900,
    proficiencyBonus: 4,
    type: "dragon",
    size: "Large",
    alignment: "chaotic evil",
    ac: 18,
    acFormula: "natural armor",
    hp: { value: 178, max: 178, formula: "17d10+85" },
    initiative: 0,
    speed: [{ key: "walk", value: 40 }, { key: "fly", value: 80 }],
    abilities: [
      { key: "str", label: "Strength", value: 23, mod: 6, save: 10, proficient: true, saveProficient: true },
      { key: "dex", label: "Dexterity", value: 10, mod: 0, save: 4, proficient: true, saveProficient: true },
      { key: "con", label: "Constitution", value: 21, mod: 5, save: 9, proficient: true, saveProficient: true },
      { key: "int", label: "Intelligence", value: 14, mod: 2, save: 2, proficient: false },
      { key: "wis", label: "Wisdom", value: 11, mod: 0, save: 0, proficient: false },
      { key: "cha", label: "Charisma", value: 19, mod: 4, save: 8, proficient: true, saveProficient: true },
    ],
    skills: [{ name: "Perception", mod: 8 }, { name: "Stealth", mod: 4 }],
    gear: ["Hoard Key"],
    traits: {
      size: "lg",
      resistances: [],
      immunities: ["fire"],
      vulnerabilities: [],
      conditionImmunities: [],
      languages: ["Common", "Draconic"],
    },
    senses: [{ key: "blindsight", value: 30 }, { key: "darkvision", value: 120 }],
    passivePerception: 18,
    languages: ["Common", "Draconic"],
    features: [{ name: "Legendary Resistance", description: "<p>3/day.</p>", uses: null, isFavorite: false }],
    actions: [{ name: "Fire Breath", description: "<p>Recharge 5-6.</p>", uses: { value: 1, max: 1, recovery: "Recharge 5-6" }, isFavorite: false }],
    bonusActions: [],
    reactions: [],
    legendaryActions: {
      description: "<p>The dragon can take 3 legendary actions.</p>",
      actions: [{ name: "Detect", description: "<p>The dragon makes a Wisdom (Perception) check.</p>", uses: null, isFavorite: false }],
    },
    lairActions: { description: "", actions: [] },
    spellcasting: null,
    ...overrides,
  };
}

describe("npc transformer shell", () => {
  it("builds the top-level NPC view model and encounter block class", () => {
    const result = transformNPCToViewModel(makeNPCData(), options, true);

    expect(result.name).toBe("Young Red Dragon");
    expect(result.portraitUrl).toBe("dragon-token.webp");
    expect(result.hasPortrait).toBe(true);
    expect(result.meta).toBe("Large dragon chaotic evil");
    expect(result.ac).toBe("18 (natural armor)");
    expect(result.hp).toBe("178 (17d10+85)");
    expect(result.speed).toBe("40 ft, 80 ft fly");
    expect(result.blockClass).toBe("fth-statblock fth-encounter-block");
    expect(result.featureSections.map((section) => section.title)).toEqual(["Traits", "Actions", "Legendary Actions"]);
    expect(result.featureSections[2].intro).toContain("The dragon can take 3 legendary actions.");
  });

  it("respects section toggles and action visibility rules", () => {
    const result = transformNPCToViewModel(makeNPCData({
      features: [],
      actions: [],
    }), {
      ...options,
      sections: {
        stats: false,
        abilities: false,
        features: false,
        actions: false,
      },
    });

    expect(result.showStats).toBe(false);
    expect(result.showAbilities).toBe(false);
    expect(result.showFeatures).toBe(false);
    expect(result.showActions).toBe(false);
  });
});
