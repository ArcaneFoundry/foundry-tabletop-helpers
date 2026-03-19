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
