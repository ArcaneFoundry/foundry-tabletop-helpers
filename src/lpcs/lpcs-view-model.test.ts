import { describe, expect, it } from "vitest";

import { buildLPCSViewModel } from "./lpcs-view-model";

describe("lpcs view model", () => {
  it("returns an empty fallback view model when actor system data is missing", () => {
    expect(buildLPCSViewModel({ name: "Mystery" })).toEqual(
      expect.objectContaining({
        name: "Mystery",
        classLabel: "Unknown",
        level: 0,
        ac: 10,
        weapons: [],
        actions: [],
        spellcasting: null,
        inventory: [],
      }),
    );
  });

  it("builds the top-level view model from array-backed actor items", () => {
    const actor = {
      name: "Arannis",
      img: "portrait.webp",
      system: {
        details: {
          level: 3,
          race: "Elf",
          background: "Sage",
          xp: { value: 300, max: 900 },
        },
        attributes: {
          prof: 2,
          init: { total: 3 },
          ac: { value: 15 },
          hp: { value: 18, max: 24, temp: 2 },
          movement: { walk: 30, fly: 60 },
          spellcasting: "int",
          senses: { darkvision: 60, special: "Keen hearing" },
          inspiration: true,
          death: { success: 1, failure: 0 },
        },
        abilities: {
          str: { value: 10, mod: 0, save: 0, proficient: 0 },
          dex: { value: 16, mod: 3, save: 5, proficient: 1 },
          con: { value: 14, mod: 2, save: 2, proficient: 0 },
          int: { value: 17, mod: 3, save: 3, proficient: 0 },
          wis: { value: 12, mod: 1, save: 1, proficient: 0 },
          cha: { value: 8, mod: -1, save: -1, proficient: 0 },
        },
        skills: {
          arc: { total: 5, value: 1, ability: "int", passive: 15, label: "Arcana" },
          prc: { total: 3, value: 1, ability: "wis", passive: 13, label: "Perception" },
        },
        spells: {
          spell1: { value: 2, max: 4 },
        },
        currency: { gp: 12, sp: 8 },
        traits: {
          languages: { value: ["common"], custom: "Elvish" },
          armorProf: { value: ["lgt"] },
          weaponProf: { value: ["sim"] },
          toolProf: { custom: "Flute" },
        },
      },
      items: [
        { type: "race", name: "Elf" },
        { type: "class", name: "Wizard", system: { levels: 3, hd: { denomination: "d6", value: 3, max: 3 } } },
        {
          id: "weapon-1",
          type: "weapon",
          name: "Quarterstaff",
          img: "staff.webp",
          system: {
            equipped: true,
            type: { value: "simpleM" },
            range: { value: 5 },
            damage: { base: { number: 1, denomination: 6, bonus: "@mod", types: new Set(["bludgeoning"]) } },
            properties: new Set(["ver"]),
          },
        },
        {
          id: "action-1",
          type: "consumable",
          name: "Healing Potion",
          img: "potion.webp",
          system: {
            activation: { type: "action" },
            description: { value: "<p>Drink to heal.</p>" },
            uses: { value: 1, max: 1 },
          },
        },
        {
          id: "spell-1",
          type: "spell",
          name: "Shield",
          img: "shield.webp",
          system: {
            level: 1,
            school: "abj",
            prepared: true,
            properties: new Set(["somatic"]),
            activation: { type: "reaction" },
            range: { value: 60 },
            description: { value: "<p>A magical barrier appears.</p>" },
          },
        },
      ],
      allApplicableEffects: () => [],
    };

    const result = buildLPCSViewModel(actor);

    expect(result).toMatchObject({
      name: "Arannis",
      img: "portrait.webp",
      subtitle: "Elf Wizard",
      classLabel: "Wizard 3",
      level: 3,
      species: "Elf",
      background: "Sage",
      inspiration: true,
      ac: 15,
      initiative: "+3",
      proficiencyBonus: "+2",
      hp: { value: 18, max: 24, temp: 2, pct: 75 },
      speed: { primary: 60, label: "fly" },
      xp: { value: 300, max: 900, pct: 33 },
      spellcasting: { ability: "INT", attackBonus: "+5", saveDC: 13 },
    });
    expect(result.weapons.map((weapon) => weapon.name)).toContain("Quarterstaff");
    expect(result.actions).toEqual([
      expect.objectContaining({
        name: "Healing Potion",
        uses: { value: 1, max: 1 },
      }),
    ]);
    expect(result.spells).toEqual([
      expect.objectContaining({
        level: 1,
        spells: [expect.objectContaining({ name: "Shield", prepared: true })],
      }),
    ]);
    expect(result.currency).toEqual([
      { key: "pp", amount: 0 },
      { key: "gp", amount: 12 },
      { key: "ep", amount: 0 },
      { key: "sp", amount: 8 },
      { key: "cp", amount: 0 },
    ]);
  });
});
