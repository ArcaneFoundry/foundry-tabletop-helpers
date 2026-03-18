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
});
