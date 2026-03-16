import { describe, expect, it } from "vitest";

import {
  extractCharacterActions,
  extractCharacterProficiencies,
  extractCurrency,
} from "./dnd5e-character-extractor";

describe("dnd5e character extractor helpers", () => {
  it("extracts proficiencies from traits, tools, and mastery entries", () => {
    const result = extractCharacterProficiencies({
      system: {
        traits: {
          armorProf: { value: new Set(["lgt", "shl"]) },
          weaponProf: {
            value: new Set(["sim", "mar"]),
            mastery: { value: new Set(["longsword", "war-hammer"]) },
          },
          toolProf: { custom: "Dragonchess Set" },
        },
      },
      items: [
        { type: "tool", name: "Thieves' Tools", system: { proficient: 1 } },
      ] as never,
    });

    expect(result).toEqual({
      armor: ["Light Armor", "Shields"],
      weapons: ["Simple Weapons", "Martial Weapons"],
      tools: ["Dragonchess Set"],
      weaponMasteries: ["Longsword", "War hammer"],
    });
  });

  it("falls back to tool proficiencies from actor tools and tool items", () => {
    const fromTools = extractCharacterProficiencies({
      system: {
        tools: {
          thief: { value: 1 },
        },
        traits: {},
      },
    });
    const fromItems = extractCharacterProficiencies({
      system: {
        traits: {},
      },
      items: [
        { type: "tool", name: "Poisoner's Kit", system: { prof: { hasProficiency: true } } },
      ] as never,
    });

    expect(fromTools.tools).toEqual(["Thieves' Tools"]);
    expect(fromItems.tools).toEqual(["Poisoner's Kit"]);
  });

  it("extracts currency safely from partial actor data", () => {
    expect(extractCurrency({
      system: {
        currency: { gp: 12, sp: 5 },
      },
    })).toEqual({
      pp: 0,
      gp: 12,
      ep: 0,
      sp: 5,
      cp: 0,
    });
  });

  it("builds weapon and feature actions with activation routing and cleaned descriptions", async () => {
    const actor = {
      name: "Rogue",
      system: {
        abilities: {
          str: { mod: 1 },
          dex: { mod: 4 },
        },
        traits: {
          weaponProf: { mastery: { value: new Set(["rapier"]) } },
        },
      },
      getRollData: () => ({ level: 5 }),
      items: {
        contents: [
          {
            id: "weapon-1",
            uuid: "weapon-uuid",
            type: "weapon",
            name: "Rapier",
            labels: { modifier: "7" },
            system: {
              attackType: "melee",
              mastery: "vex",
              type: { value: "martialM", baseItem: "rapier" },
              range: { reach: 5 },
              properties: new Set(["fin"]),
              activities: {
                attack: {
                  _id: "attack",
                  type: "attack",
                  damage: {
                    parts: [{ number: 1, denomination: 8, bonus: "@mod", types: new Set(["piercing"]) }],
                  },
                },
              },
            },
          },
          {
            id: "feat-1",
            uuid: "feat-uuid",
            type: "feat",
            name: "Second Wind",
            system: {
              activation: { type: "bonus" },
              description: { value: "<p>Recover [[lookup @level]] HP.</p>" },
              uses: { max: 1 },
            },
          },
          {
            id: "feat-2",
            type: "feat",
            name: "Sneak Attack",
            system: {
              description: { value: "<p>Deal extra damage.</p>" },
              type: { value: "class" },
              activities: {
                passive: {
                  _id: "passive",
                  type: "utility",
                },
              },
            },
          },
          {
            id: "loot-1",
            type: "loot",
            name: "Torch",
            system: {},
          },
        ],
      },
    };

    const result = await extractCharacterActions(actor, new Set(["weapon-uuid", "feat-uuid"]), {
      stripEnrichedText: (html) => html.replace(/<[^>]+>/g, "").replace("[[lookup @level]]", "5").trim(),
      extractItemUses: () => ({ value: 1, max: 1, recovery: "sr" }),
    });

    expect(result.weapons).toEqual([
      expect.objectContaining({
        name: "Rapier",
        mastery: "Vex",
        hasMastery: true,
        toHit: "+7",
        damage: "1d8+4",
        damageType: "Piercing",
        properties: "Martial, Finesse, Vex",
        isFavorite: true,
      }),
    ]);
    expect(result.bonusActions).toEqual([
      expect.objectContaining({
        name: "Second Wind",
        description: "Recover 5 HP.",
        uses: { value: 1, max: 1, recovery: "sr" },
        isFavorite: true,
      }),
    ]);
    expect(result.other).toEqual([
      expect.objectContaining({
        name: "Sneak Attack",
        itemType: "feat",
      }),
    ]);
  });
});
