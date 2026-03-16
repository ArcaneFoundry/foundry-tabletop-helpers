import { describe, expect, it, vi } from "vitest";

import type { PrintOptions } from "../types";
import { Dnd5eExtractor } from "./dnd5e-extractor";

const options: PrintOptions = {
  paperSize: "letter",
  portrait: "portrait",
  sections: {},
};

describe("dnd5e extractor shell", () => {
  it("extracts character data through the top-level character shell", async () => {
    const extractor = new Dnd5eExtractor();
    const actor = {
      name: "Arannis",
      img: "portrait.webp",
      prototypeToken: { texture: { src: "token.webp" } },
      favorites: [{ id: "spell-1" }],
      system: {
        details: {
          level: 2,
          race: "Elf",
          background: "Sage",
          biography: { value: "Scholar of ancient ruins" },
        },
        attributes: {
          prof: 2,
          ac: { value: 14 },
          hp: { value: 12, max: 16, temp: 1 },
          init: { total: 3 },
          movement: { walk: 30 },
          spellcasting: "int",
        },
        abilities: {
          str: { value: 10, mod: 0, save: 0, proficient: 0 },
          dex: { value: 16, mod: 3, save: 5, proficient: 1 },
          con: { value: 12, mod: 1, save: 1, proficient: 0 },
          int: { value: 14, mod: 2, save: 2, proficient: 0 },
          wis: { value: 10, mod: 0, save: 0, proficient: 0 },
          cha: { value: 8, mod: -1, save: -1, proficient: 0 },
        },
        skills: {
          arc: { total: 4, value: 1, ability: "int", passive: 14 },
        },
        traits: {
          languages: { value: ["common"], custom: "Elvish" },
          armorProf: { value: ["lgt"] },
          weaponProf: { value: ["sim"] },
        },
        spells: {
          spell1: { value: 2, max: 3 },
        },
        currency: { gp: 15, sp: 4 },
      },
      items: [
        { type: "class", name: "Wizard", system: { levels: 2, identifier: "wizard", hd: { denomination: "d6", value: 2, max: 2 } } },
        { type: "feat", name: "Arcane Recovery", system: { type: { value: "class" }, description: { value: "<p>Recover slots.</p>" } } },
        { id: "spell-1", type: "spell", name: "Shield", system: { level: 1, school: "abj", prepared: true, properties: new Set(["somatic"]) } },
      ],
    };

    const result = await extractor.extractCharacter(actor, options);

    expect(result).toMatchObject({
      name: "Arannis",
      img: "portrait.webp",
      tokenImg: "token.webp",
      backstory: "Scholar of ancient ruins",
      details: { level: 2, race: "Elf", background: "Sage" },
      currency: { gp: 15, sp: 4 },
    });
    expect(result.favorites.has("spell-1")).toBe(true);
    expect(result.spellcasting?.ability).toBe("Intelligence");
  });

  it("extracts encounter members via getMembers and de-duplicates actors", async () => {
    const extractor = new Dnd5eExtractor();
    const extractNPC = vi.spyOn(extractor, "extractNPC").mockImplementation(async (actor) => ({
      name: (actor as { name?: string }).name ?? "Unknown",
      img: "",
      tokenImg: "",
      cr: "1",
      xp: 200,
      proficiencyBonus: 2,
      type: "humanoid",
      size: "Medium",
      alignment: "unaligned",
      ac: 12,
      acFormula: "",
      hp: { value: 7, max: 7, formula: "" },
      initiative: 1,
      speed: [],
      abilities: [],
      skills: [],
      gear: [],
      traits: { size: "med", resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [], languages: [] },
      senses: [],
      passivePerception: 10,
      languages: [],
      features: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: { description: "", actions: [] },
      lairActions: { description: "", actions: [] },
      spellcasting: null,
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    }));

    const goblin = { id: "goblin-1", uuid: "Actor.goblin", name: "Goblin" };
    const result = await extractor.extractEncounterGroup({
      name: "Ambush",
      type: "encounter",
      system: {
        async getMembers() {
          return [
            { actor: goblin, quantity: 2 },
            { actor: goblin, quantity: 1 },
          ];
        },
      },
    }, options);

    expect(extractNPC).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      name: "Ambush",
      actors: [expect.objectContaining({ name: "Goblin" })],
    });
  });

  it("extracts party summaries from group members and builds compact save/slot data", async () => {
    const extractor = new Dnd5eExtractor();
    const result = await extractor.extractPartySummary({
      name: "Heroes",
      system: {
        members: [
          {
            actor: {
              name: "Mira",
              system: {
                details: { level: 3, race: "Human", background: "Acolyte" },
                attributes: {
                  ac: { value: 15 },
                  hp: { value: 20, max: 24 },
                  prof: 2,
                  init: { total: 1 },
                  movement: { walk: 30 },
                  spellcasting: "wis",
                },
                abilities: {
                  str: { value: 10, mod: 0, save: 0, proficient: 0 },
                  dex: { value: 12, mod: 1, save: 1, proficient: 0 },
                  con: { value: 14, mod: 2, save: 2, proficient: 0 },
                  int: { value: 10, mod: 0, save: 0, proficient: 0 },
                  wis: { value: 16, mod: 3, save: 5, proficient: 1 },
                  cha: { value: 13, mod: 1, save: 1, proficient: 0 },
                },
                skills: {
                  prc: { total: 5, passive: 15, value: 1, ability: "wis", label: "Perception" },
                  ins: { total: 5, passive: 15, value: 1, ability: "wis", label: "Insight" },
                },
                spells: {
                  spell1: { max: 4 },
                  pact: { max: 1, level: 2 },
                },
              },
              items: [{ type: "class", name: "Cleric", system: { levels: 3, hd: { denomination: "d8", value: 3, max: 3 } } }],
            },
          },
        ],
      },
    }, options);

    expect(result).toEqual({
      name: "Heroes",
      members: [
        expect.objectContaining({
          name: "Mira",
          classes: "Cleric 3",
          level: 3,
          species: "Human",
          background: "Acolyte",
          ac: 15,
          proficiency: 2,
          initiative: 1,
          spellDC: 13,
          passives: { perception: 15, insight: 15, investigation: 10 },
          spellSlots: [{ level: 1, max: 4 }],
          pactSlots: { max: 1, level: 2 },
        }),
      ],
    });
  });

  it("normalizes activity damage and recovery internals for feature extraction", () => {
    const extractor = new Dnd5eExtractor() as unknown as {
      itemToFeatureData: (
        item: Record<string, unknown>,
        favorites: Set<string>,
        actor?: Record<string, unknown>,
      ) => {
        description: string;
        uses: { value: number; max: number; recovery: string } | null;
        attack?: {
          type: string;
          save: string;
          damage: Array<{ avg: number; formula: string; type: string }>;
        };
      };
    };

    const recoveryCollection = {
      forEach(callback: (value: { period: string; formula?: string }) => void) {
        callback({ period: "recharge", formula: "5" });
      },
    };

    const item = {
      id: "breath-1",
      name: "Lightning Breath",
      type: "feat",
      system: {
        description: {
          value: "<p>The dragon exhales lightning in a 30-foot line. Each creature takes 7 ().</p>",
        },
        uses: {
          value: 1,
          max: 1,
          recovery: recoveryCollection,
        },
        activities: {
          breath: {
            type: "save",
            activation: { type: "action" },
            damage: {
              parts: {
                main: { number: 2, denomination: 6, bonus: "@mod", types: new Set(["lightning"]) },
              },
            },
            save: {
              ability: new Set(["dex"]),
              dc: { value: 13 },
            },
          },
        },
      },
    };

    const actor = {
      name: "Blue Dragon",
      system: {
        abilities: {
          str: { mod: 4 },
        },
        attributes: {
          prof: 3,
        },
      },
      getRollData() {
        return {
          prof: 3,
        };
      },
    };

    const result = extractor.itemToFeatureData(item, new Set(), actor);

    expect(result.description).toContain("7 (2d6 + 4)");
    expect(result.uses).toEqual({ value: 1, max: 1, recovery: "Recharge 5–6" });
    expect(result.attack).toEqual({
      type: "save",
      toHit: "",
      reach: "",
      save: "DC 13 DEX",
      damage: [{ avg: 11, formula: "2d6 + 4", type: "Lightning" }],
    });
  });
});
