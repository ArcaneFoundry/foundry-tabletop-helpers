import { beforeEach, describe, expect, it, vi } from "vitest";

const fromUuidMock = vi.fn();

vi.mock("../../types", () => ({
  fromUuid: fromUuidMock,
}));

describe("advancement parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses conservative species item choice groups and resolves missing option names", async () => {
    const { parseSpeciesItemChoices } = await import("./advancement-parser");

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.spells.light") return { name: "Light" };
      return { name: "Prestidigitation" };
    });

    const groups = await parseSpeciesItemChoices({
      system: {
        advancement: [
          {
            type: "ItemGrant",
            title: "Wizard Cantrip Choice",
            configuration: {
              count: 1,
              items: [
                { uuid: "Compendium.spells.light" },
                { uuid: "Compendium.spells.prestidigitation", name: "" },
              ],
            },
          },
          {
            type: "ItemGrant",
            title: "Darkvision",
            configuration: {
              items: [{ uuid: "Compendium.features.darkvision", name: "Darkvision" }],
            },
          },
        ],
      },
    } as never);

    expect(groups).toEqual([
      {
        id: "wizard-cantrip-choice-0",
        title: "Wizard Cantrip Choice",
        count: 1,
        options: [
          { uuid: "Compendium.spells.light", name: "Light" },
          { uuid: "Compendium.spells.prestidigitation", name: "Prestidigitation" },
        ],
      },
    ]);
  });

  it("parses explicit multi-pick item groups even when the title is generic", async () => {
    const { parseSpeciesItemChoices } = await import("./advancement-parser");

    const groups = await parseSpeciesItemChoices({
      system: {
        advancement: [
          {
            type: "ItemGrant",
            title: "Arcane Legacy",
            configuration: {
              count: 2,
              items: [
                { uuid: "Compendium.spells.dancing-lights", name: "Dancing Lights" },
                { uuid: "Compendium.spells.light", name: "Light" },
                { uuid: "Compendium.spells.mage-hand", name: "Mage Hand" },
              ],
            },
          },
        ],
      },
    } as never);

    expect(groups).toEqual([
      {
        id: "arcane-legacy-0",
        title: "Arcane Legacy",
        count: 2,
        options: [
          { uuid: "Compendium.spells.dancing-lights", name: "Dancing Lights" },
          { uuid: "Compendium.spells.light", name: "Light" },
          { uuid: "Compendium.spells.mage-hand", name: "Mage Hand" },
        ],
      },
    ]);
  });

  it("parses weapon mastery counts and pool keys through the configured starting level", async () => {
    const { parseClassWeaponMasteryAdvancement } = await import("./advancement-parser");

    const result = parseClassWeaponMasteryAdvancement({
      system: {
        advancement: [
          {
            type: "Trait",
            title: "Weapon Mastery",
            level: 1,
            configuration: {
              mode: "mastery",
              choices: [{ count: 3, pool: ["weapon:sim:*", "weapon:mar:*"] }],
            },
          },
          {
            type: "Trait",
            title: "Weapon Mastery",
            level: 4,
            configuration: {
              mode: "mastery",
              choices: [{ count: 1, pool: ["weapon:sim:*", "weapon:mar:*"] }],
            },
          },
        ],
      },
    } as never, 4);

    expect(result).toEqual({
      count: 4,
      pool: ["weapon:sim:*", "weapon:mar:*"],
    });
  });

  it("parses class skill pools when Foundry stores the pool as a Set", async () => {
    const { parseClassSkillAdvancement } = await import("./advancement-parser");

    const result = parseClassSkillAdvancement({
      system: {
        advancement: [
          {
            type: "Trait",
            title: "Skill Proficiencies",
            configuration: {
              mode: "default",
              choices: [{ count: 2, pool: new Set(["skills:ath", "skills:sur"]) }],
            },
          },
        ],
      },
    } as never);

    expect(result).toEqual({
      skillPool: ["ath", "sur"],
      skillCount: 2,
    });
  });

  it("normalizes rogue level-1 class advancement requirements", async () => {
    const { parseClassAdvancementRequirements } = await import("./advancement-parser");

    const result = await parseClassAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "skills",
            type: "Trait",
            title: "Skill Proficiencies",
            level: 1,
            configuration: {
              mode: "default",
              choices: [{ count: 4, pool: ["skills:acr", "skills:ste", "skills:inv", "skills:prc"] }],
            },
          },
          {
            _id: "expertise",
            type: "Trait",
            title: "Expertise",
            level: 1,
            configuration: {
              mode: "expertise",
              choices: [{ count: 2 }],
            },
          },
          {
            _id: "cant",
            type: "Trait",
            title: "Thieves' Cant",
            level: 1,
            configuration: {
              mode: "language",
              choices: [{ count: 1 }],
            },
          },
          {
            _id: "mastery",
            type: "Trait",
            title: "Weapon Mastery",
            level: 1,
            configuration: {
              mode: "mastery",
              choices: [{ count: 2, pool: ["weapon:sim:*"] }],
            },
          },
        ],
      },
    } as never, 1);

    expect(result).toEqual([
      expect.objectContaining({ id: "skills", type: "skills", requiredCount: 4, pool: ["skills:acr", "skills:ste", "skills:inv", "skills:prc"] }),
      expect.objectContaining({ id: "expertise", type: "expertise", requiredCount: 2, pool: ["skills:proficient"] }),
      expect.objectContaining({ id: "cant", type: "languages", requiredCount: 1, pool: ["languages:standard:*"] }),
      expect.objectContaining({ id: "mastery", type: "weaponMasteries", requiredCount: 2, pool: ["weapon:sim:*"] }),
    ]);
  });

  it("captures tool and item-choice advancements while filtering higher-level class choices", async () => {
    const { parseClassAdvancementRequirements } = await import("./advancement-parser");

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.features.protector") return { name: "Protector", img: "protector.webp" };
      if (uuid === "Compendium.features.thaumaturge") return { name: "Thaumaturge", img: "thaumaturge.webp" };
      return null;
    });

    const result = await parseClassAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "tools",
            type: "Trait",
            title: "Tool Proficiencies",
            level: 1,
            configuration: {
              choices: [{ count: 3 }],
            },
          },
          {
            _id: "divine-order",
            type: "ItemChoice",
            title: "Divine Order Choice",
            level: 1,
            configuration: {
              choices: [{ count: 1 }],
              pool: ["Compendium.features.protector", "Compendium.features.thaumaturge"],
            },
          },
          {
            _id: "late-language",
            type: "Trait",
            title: "Bonus Language",
            level: 2,
            configuration: {
              choices: [{ count: 1 }],
            },
          },
        ],
      },
    } as never, 1);

    expect(result).toEqual([
      expect.objectContaining({ id: "tools", type: "tools", requiredCount: 3, pool: ["tool:*"] }),
      expect.objectContaining({
        id: "divine-order",
        type: "itemChoices",
        requiredCount: 1,
        itemChoices: [
          { uuid: "Compendium.features.protector", name: "Protector", img: "protector.webp" },
          { uuid: "Compendium.features.thaumaturge", name: "Thaumaturge", img: "thaumaturge.webp" },
        ],
      }),
    ]);
  });

  it("derives effective item-choice levels from choice keys and resolves object-backed pools", async () => {
    const { parseClassAdvancementRequirements } = await import("./advancement-parser");

    fromUuidMock.mockImplementation(async (uuid: string) => {
      if (uuid === "Compendium.features.archery") return { name: "Archery", img: "archery.webp" };
      if (uuid === "Compendium.features.defense") return { name: "Defense", img: "defense.webp" };
      return null;
    });

    const fighterResult = await parseClassAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "fighting-style",
            type: "ItemChoice",
            title: "Fighting Style",
            configuration: {
              choices: {
                1: { count: 1 },
              },
              pool: [
                { uuid: "Compendium.features.archery" },
                { uuid: "Compendium.features.defense" },
              ],
            },
          },
        ],
      },
    } as never, 1);

    const paladinLevelOne = await parseClassAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "fighting-style",
            type: "ItemChoice",
            title: "Fighting Style",
            configuration: {
              choices: {
                2: { count: 1 },
              },
              pool: [
                { uuid: "Compendium.features.archery" },
                { uuid: "Compendium.features.defense" },
              ],
            },
          },
        ],
      },
    } as never, 1);

    const paladinLevelTwo = await parseClassAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "fighting-style",
            type: "ItemChoice",
            title: "Fighting Style",
            configuration: {
              choices: {
                2: { count: 1 },
              },
              pool: [
                { uuid: "Compendium.features.archery" },
                { uuid: "Compendium.features.defense" },
              ],
            },
          },
        ],
      },
    } as never, 2);

    expect(fighterResult).toEqual([
      expect.objectContaining({
        id: "fighting-style",
        title: "Fighting Style",
        level: 1,
        requiredCount: 1,
        itemChoices: [
          { uuid: "Compendium.features.archery", name: "Archery", img: "archery.webp" },
          { uuid: "Compendium.features.defense", name: "Defense", img: "defense.webp" },
        ],
      }),
    ]);
    expect(paladinLevelOne).toEqual([]);
    expect(paladinLevelTwo).toEqual([
      expect.objectContaining({
        id: "fighting-style",
        title: "Fighting Style",
        level: 2,
        requiredCount: 1,
      }),
    ]);
  });

  it("infers background language requirements when Foundry omits the choice pool", async () => {
    const { parseBackgroundAdvancementRequirements } = await import("./advancement-parser");

    const result = await parseBackgroundAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "choose-languages",
            type: "Trait",
            title: "Choose Languages",
            level: 0,
            hint: "Your character knows at least three languages: Common plus two languages you roll or choose from the Standard Languages table.",
            configuration: {
              choices: [{ count: 2, pool: {} }],
            },
          },
        ],
      },
    } as never, 1);

    expect(result).toEqual([
      expect.objectContaining({
        id: "choose-languages",
        type: "languages",
        requiredCount: 2,
        pool: ["languages:standard:*"],
      }),
    ]);
  });

  it("infers species skill choice pools from hint text when Foundry omits the pool", async () => {
    const { parseSpeciesAdvancementRequirements } = await import("./advancement-parser");

    const result = await parseSpeciesAdvancementRequirements({
      system: {
        advancement: [
          {
            _id: "skillful",
            type: "Trait",
            title: "Skillful",
            level: 0,
            hint: "You gain proficiency in one skill of your choice.",
            configuration: {
              choices: [{ count: 1, pool: {} }],
            },
          },
          {
            _id: "keen-senses",
            type: "Trait",
            title: "Keen Senses",
            level: 0,
            hint: "You have proficiency in the Insight, Perception, or Survival skill.",
            configuration: {
              choices: [{ count: 1, pool: {} }],
            },
          },
        ],
      },
    } as never, 1);

    expect(result).toEqual([
      expect.objectContaining({
        id: "skillful",
        type: "skills",
        requiredCount: 1,
        pool: ["skills:*"],
      }),
      expect.objectContaining({
        id: "keen-senses",
        type: "skills",
        requiredCount: 1,
        pool: ["skills:ins", "skills:prc", "skills:sur"],
      }),
    ]);
  });

  it("parses background weapon proficiency grants from trait advancements", async () => {
    const { parseBackgroundGrants } = await import("./advancement-parser");

    const result = await parseBackgroundGrants({
      system: {
        advancement: [
          {
            type: "Trait",
            title: "Battle Training",
            configuration: {
              grants: ["weapon:mar:*", "skills:ath"],
            },
          },
        ],
      },
    } as never);

    expect(result.weaponProficiencies).toEqual(["weapon:mar:*"]);
  });

  it("extracts a background's granted origin feat UUID without resolving feat display data", async () => {
    const { parseBackgroundGrantedOriginFeatUuid } = await import("./advancement-parser");

    const result = parseBackgroundGrantedOriginFeatUuid({
      system: {
        advancement: [
          {
            type: "ItemGrant",
            title: "Origin Feat",
            configuration: {
              items: [{ uuid: "Compendium.pack.feats.Item.alert" }],
            },
          },
        ],
      },
    } as never);

    expect(result).toBe("Compendium.pack.feats.Item.alert");
  });

  it("infers background skill and tool proficiencies from live hint text when grants are empty", async () => {
    const { parseBackgroundGrants } = await import("./advancement-parser");

    const result = await parseBackgroundGrants({
      system: {
        advancement: [
          {
            type: "Trait",
            title: "Background Proficiencies",
            hint: "Your background grants you proficiency in Insight and Religion. It also grants you proficiency in Calligrapher's Supplies.",
            configuration: {
              grants: {},
              choices: [],
              mode: "default",
            },
          },
        ],
      },
    } as never);

    expect(result.skillProficiencies).toEqual(["ins", "rel"]);
    expect(result.toolProficiency).toBe("calligrapher");
  });

  it("parses allowed background ASI abilities from hint text when config does not encode them", async () => {
    const { parseBackgroundGrants } = await import("./advancement-parser");

    const result = await parseBackgroundGrants({
      system: {
        advancement: [
          {
            type: "AbilityScoreImprovement",
            title: "Ability Scores",
            hint: "Your background allows you to increase your Constitution, Intelligence, and Wisdom scores.",
            configuration: {
              points: 3,
              cap: 2,
              locked: {},
            },
          },
        ],
      },
    } as never);

    expect(result.asiAllowed).toEqual(["con", "int", "wis"]);
    expect(result.asiSuggested).toEqual(["con", "int", "wis"]);
  });

  it("parses document weapon proficiencies from fixed traits and trait grants", async () => {
    const { parseDocumentWeaponProficiencies } = await import("./advancement-parser");

    const result = parseDocumentWeaponProficiencies({
      system: {
        traits: {
          weaponProf: {
            value: ["simpleM", "longsword"],
          },
        },
        advancement: [
          {
            type: "Trait",
            configuration: {
              grants: ["weapon:mar:*", "weapon:shortbow"],
            },
          },
        ],
      },
    } as never);

    expect(result).toEqual(["weapon:sim:*", "weapon:longsword", "weapon:mar:*", "weapon:shortbow"]);
  });

  it("parses document weapon proficiencies when trait grants are exposed as Sets", async () => {
    const { parseDocumentWeaponProficiencies } = await import("./advancement-parser");

    const result = parseDocumentWeaponProficiencies({
      system: {
        advancement: [
          {
            type: "Trait",
            configuration: {
              grants: new Set(["weapon:sim", "weapon:mar"]),
            },
          },
        ],
      },
    } as never);

    expect(result).toEqual(["weapon:sim", "weapon:mar"]);
  });

  it("parses species fixed weapon proficiencies", async () => {
    const { parseSpeciesProficiencies } = await import("./advancement-parser");

    const result = parseSpeciesProficiencies({
      system: {
        traits: {
          weaponProf: {
            value: ["martialR", "handcrossbow"],
          },
        },
        advancement: [],
      },
    } as never);

    expect(result.fixedWeaponProficiencies).toEqual(["weapon:mar:*", "weapon:handcrossbow"]);
  });
});
