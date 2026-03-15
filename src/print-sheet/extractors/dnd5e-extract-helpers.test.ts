/**
 * Smoke tests for dnd5e-extract-helpers.ts.
 *
 * These tests exercise the core data-transformation functions against synthetic
 * actor objects, verifying that the extractor pipeline produces the correct
 * shape even when optional dnd5e system data is absent.
 *
 * Foundry globals required:
 *   - globalThis.CONFIG  — used by abilityLabel/skillLabel for system-localised
 *                          labels; stubbed to undefined so built-in fallbacks are exercised.
 *   - globalThis.foundry.utils.getProperty — used by resolveRollDataPath inside
 *                          stripEnrichedText; not called by the functions under
 *                          test here, but stubbed for completeness.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  ABILITY_KEYS,
  resolveTraitSet,
  buildFavoritesSet,
  extractAbilities,
  extractCombat,
  extractDetails,
  extractFeatures,
  extractInventory,
  extractSkills,
  extractSpellcasting,
} from "./dnd5e-extract-helpers";

/* ── Foundry global stubs ─────────────────────────────────── */

beforeAll(() => {
  // CONFIG is absent — label functions fall back to built-in ABILITY_LABELS / SKILL_LABELS
  (globalThis as Record<string, unknown>).CONFIG = undefined;

  // Provide a minimal foundry.utils stub so any indirect calls to getProperty don't throw
  (globalThis as Record<string, unknown>).foundry = {
    utils: {
      getProperty(obj: Record<string, unknown>, key: string): unknown {
        return key.split(".").reduce((cur: unknown, seg: string) => {
          if (cur == null || typeof cur !== "object") return undefined;
          return (cur as Record<string, unknown>)[seg];
        }, obj as unknown);
      },
    },
  };
});

/* ── ABILITY_KEYS constant ────────────────────────────────── */

describe("ABILITY_KEYS", () => {
  it("contains all 6 standard D&D ability score keys in order", () => {
    expect(ABILITY_KEYS).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });
});

/* ── resolveTraitSet ──────────────────────────────────────── */

describe("resolveTraitSet", () => {
  it("returns an empty array for null", () => {
    expect(resolveTraitSet(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(resolveTraitSet(undefined)).toEqual([]);
  });

  it("extracts values from a Set<string>", () => {
    expect(resolveTraitSet({ value: new Set(["bludgeoning", "piercing"]), custom: "" }))
      .toEqual(["bludgeoning", "piercing"]);
  });

  it("extracts values from a string[]", () => {
    expect(resolveTraitSet({ value: ["fire", "cold"], custom: "" }))
      .toEqual(["fire", "cold"]);
  });

  it("parses semicolon-separated custom entries and trims whitespace", () => {
    expect(resolveTraitSet({ value: new Set<string>(), custom: "Silver; Cold iron" }))
      .toEqual(["Silver", "Cold iron"]);
  });

  it("places custom entries before standard values", () => {
    expect(resolveTraitSet({ value: new Set(["fire"]), custom: "Custom" }))
      .toEqual(["Custom", "fire"]);
  });
});

/* ── buildFavoritesSet ────────────────────────────────────── */

describe("buildFavoritesSet", () => {
  it("returns an empty Set when actor has no favorites property", () => {
    expect(buildFavoritesSet({}).size).toBe(0);
  });

  it("collects favourite IDs from the id field", () => {
    const favs = buildFavoritesSet({ favorites: [{ id: "abc" }, { id: "def" }] });
    expect(favs.has("abc")).toBe(true);
    expect(favs.has("def")).toBe(true);
  });

  it("falls back to the source field when id is absent", () => {
    const favs = buildFavoritesSet({ favorites: [{ source: "xyz" }] });
    expect(favs.has("xyz")).toBe(true);
  });
});

/* ── extractAbilities ─────────────────────────────────────── */

describe("extractAbilities", () => {
  it("returns exactly 6 entries regardless of input", () => {
    expect(extractAbilities({ system: {} })).toHaveLength(6);
  });

  it("defaults to value 10 and mod 0 when ability data is absent", () => {
    const result = extractAbilities({ system: { abilities: {} } });
    for (const ab of result) {
      expect(ab.value).toBe(10);
      expect(ab.mod).toBe(0);
    }
  });

  it("calculates the ability modifier from value correctly", () => {
    const result = extractAbilities({ system: { abilities: { str: { value: 18 } } } });
    expect(result.find(a => a.key === "str")?.mod).toBe(4); // (18-10)/2 = 4
  });

  it("adds proficiency bonus to save when proficient", () => {
    const actor = {
      system: {
        attributes: { prof: 3 },
        abilities: { wis: { value: 14, proficient: 1 } },
      },
    };
    const wis = extractAbilities(actor).find(a => a.key === "wis");
    expect(wis?.save).toBe(5); // mod 2 + prof 3
  });

  it("uses an explicit numeric save value when provided", () => {
    const actor = { system: { abilities: { con: { value: 16, save: 7 } } } };
    expect(extractAbilities(actor).find(a => a.key === "con")?.save).toBe(7);
  });
});

/* ── extractSkills ────────────────────────────────────────── */

describe("extractSkills", () => {
  it("returns an empty array when the actor has no skills", () => {
    expect(extractSkills({ system: { skills: {} } })).toEqual([]);
  });

  it("maps skill keys to built-in labels when CONFIG is absent", () => {
    const actor = { system: { skills: { prc: { total: 5, value: 1, ability: "wis" } } } };
    const prc = extractSkills(actor).find(s => s.key === "prc");
    expect(prc?.label).toBe("Perception");
  });

  it("returns skills sorted alphabetically by label", () => {
    const actor = {
      system: {
        skills: {
          ste: { total: 3, value: 1, ability: "dex" },
          acr: { total: 5, value: 2, ability: "dex" },
        },
      },
    };
    const result = extractSkills(actor);
    expect(result[0].key).toBe("acr"); // Acrobatics < Stealth
    expect(result[1].key).toBe("ste");
  });

  it("calculates passive score as 10 + total when not explicitly provided", () => {
    const actor = { system: { skills: { prc: { total: 4, ability: "wis" } } } };
    expect(extractSkills(actor)[0].passive).toBe(14);
  });
});

describe("extractCombat", () => {
  it("builds default movement and aggregates hit dice by denomination", () => {
    const actor = {
      system: {
        attributes: {
          ac: { value: 16 },
          hp: { value: 21, max: 30, temp: 4 },
          death: { success: 1, failure: 2 },
          init: { total: 3 },
          prof: 3,
          inspiration: true,
          senses: { darkvision: 60, special: "Keen smell" },
        },
      },
      items: [
        { type: "class", system: { levels: 3, hd: { denomination: "d10", value: 2, max: 3 } } },
        { type: "class", system: { levels: 2, hd: { denomination: "d10", value: 1, max: 2 } } },
      ],
    };

    expect(extractCombat(actor)).toEqual({
      ac: 16,
      hp: { value: 21, max: 30, temp: 4, tempmax: 0 },
      death: { success: 1, failure: 2 },
      initiative: 3,
      speed: [{ key: "walk", value: 30 }],
      proficiency: 3,
      inspiration: true,
      senses: [
        { key: "darkvision", value: 60 },
        { key: "special", value: "Keen smell" },
      ],
      hitDice: { d10: { value: 3, max: 5 } },
    });
  });
});

describe("extractDetails", () => {
  it("falls back to linked race/background items and pairs subclasses to classes", () => {
    const actor = {
      system: {
        details: {
          alignment: "Neutral Good",
        },
      },
      items: [
        { type: "race", name: "Elf" },
        { type: "background", name: "Sage" },
        { type: "class", name: "Wizard", system: { identifier: "wizard", levels: 3 } },
        { type: "subclass", name: "Evoker", system: { classIdentifier: "wizard" } },
      ],
    };

    expect(extractDetails(actor)).toEqual({
      race: "Elf",
      background: "Sage",
      alignment: "Neutral Good",
      level: 3,
      classes: [{ name: "Wizard", level: 3, subclass: "Evoker" }],
    });
  });
});

describe("extractSpellcasting", () => {
  it("extracts spell rows, save metadata, slots, and higher-level text", () => {
    const favorites = new Set(["spell-1"]);
    const actor = {
      system: {
        attributes: { spellcasting: "int", prof: 3 },
        abilities: { int: { mod: 4 } },
        spells: {
          spell1: { value: 2, max: 4 },
          pact: { value: 1, max: 2, level: 3 },
        },
      },
      items: [
        {
          id: "spell-1",
          type: "spell",
          name: "Burning Hands",
          img: "burning-hands.webp",
          system: {
            level: 1,
            school: "evo",
            properties: new Set(["vocal", "somatic", "material", "concentration", "ritual"]),
            activation: { type: "action", value: 1 },
            range: { value: 15 },
            duration: { value: 1, units: "minute" },
            materials: { value: "A tiny ball of bat guano and sulfur" },
            sourceClass: "Wizard",
            description: {
              value: "<p><strong>At Higher Levels.</strong> Add 1d6 per slot above 1st.</p>",
            },
            activities: {
              cast1: {
                _id: "cast1",
                type: "save",
                damage: { parts: [{ types: new Set(["fire"]), bonus: "@mod" }] },
                save: { ability: new Set(["dex"]), dc: { calculation: "spellcasting" } },
              },
            },
            prepared: true,
          },
        },
      ],
    };

    const result = extractSpellcasting(actor, favorites);
    expect(result?.ability).toBe("Intelligence");
    expect(result?.attackMod).toBe(7);
    expect(result?.dc).toBe(15);
    expect(result?.slots).toEqual([
      { level: 1, max: 4, value: 2, label: "Level 1" },
      { level: 3, max: 2, value: 1, label: "Pact (Level 3)" },
    ]);
    expect(result?.spellsByLevel.get(1)).toEqual([
      expect.objectContaining({
        name: "Burning Hands",
        components: "V/S/M",
        concentration: true,
        ritual: true,
        attackSave: "DC 15 DEX",
        effect: "4",
        source: "Wizard",
        higherLevel: "Add 1d6 per slot above 1st.",
        isFavorite: true,
      }),
    ]);
  });
});

describe("extractInventory", () => {
  it("sorts equipped favorites first and nests contained items", () => {
    const result = extractInventory({
      items: [
        { id: "2", type: "loot", name: "Torch", system: { quantity: 2 } },
        { id: "1", uuid: "fav-1", type: "weapon", name: "Longsword", system: { equipped: true } },
        { id: "bag", type: "container", name: "Backpack", system: {} },
        { id: "3", type: "loot", name: "Rope", system: { container: "bag" } },
      ],
    }, new Set(["fav-1"]));

    expect(result.map((item) => item.name)).toEqual(["Longsword", "Torch", "Backpack"]);
    expect(result[2].contents.map((item) => item.name)).toEqual(["Rope"]);
  });
});

describe("extractFeatures", () => {
  it("cleans enriched text, resolves roll data placeholders, and formats recovery", () => {
    const actor = {
      getRollData: () => ({ prof: 4 }),
      items: [
        {
          id: "feat-1",
          uuid: "feat-uuid",
          type: "feat",
          name: "Breath Weapon",
          system: {
            type: { value: "feat" },
            description: {
              value: "<p>@UUID[Compendium.test]{Dragon Breath} deals [[lookup @prof]]d6 damage.</p>",
            },
            uses: {
              value: 1,
              max: 1,
              recovery: [{ period: "recharge", formula: "5" }],
            },
          },
        },
      ],
    };

    expect(extractFeatures(actor, new Set(["feat-uuid"]))).toEqual([
      {
        category: "Feat",
        features: [
          {
            name: "Breath Weapon",
            description: "Dragon Breath deals 4d6 damage.",
            uses: { value: 1, max: 1, recovery: "Recharge 5–6" },
            isFavorite: true,
          },
        ],
      },
    ]);
  });
});
