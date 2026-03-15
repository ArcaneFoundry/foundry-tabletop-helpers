import { describe, expect, it } from "vitest";

import type { PartySummaryData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import { transformPartySummaryToViewModel } from "./party-transformer";

const options: PrintOptions = {
  paperSize: "letter",
  portrait: "portrait",
  sections: {},
};

function makePartySummary(overrides: Partial<PartySummaryData> = {}): PartySummaryData {
  return {
    name: "The <Vanguard>",
    members: [
      {
        name: "Mira",
        classes: "Cleric 5",
        level: 5,
        species: "Human",
        background: "Acolyte",
        senses: "darkvision 60 ft",
        ac: 18,
        hp: { max: 42 },
        proficiency: 3,
        initiative: 1,
        passives: { perception: 15, insight: 15, investigation: 11 },
        spellDC: 14,
        saves: [
          { key: "WIS", mod: 6, proficient: true },
          { key: "CHA", mod: 3, proficient: false },
        ],
        proficientSkills: [
          { name: "Insight", abbr: "Insi", mod: 5, ability: "WIS" },
          { name: "Religion", abbr: "Reli", mod: 4, ability: "INT" },
        ],
        spellSlots: [
          { level: 1, max: 4 },
          { level: 2, max: 3 },
        ],
        pactSlots: { max: 1, level: 3 },
      },
    ],
    ...overrides,
  };
}

describe("party transformer shell", () => {
  it("builds party rows and tracking cards from the summary shell", () => {
    const result = transformPartySummaryToViewModel(makePartySummary(), options);

    expect(result.name).toBe("The &lt;Vanguard&gt;");
    expect(result.paperClass).toBe("fth-paper-letter");
    expect(result.members[0]).toMatchObject({
      name: "Mira",
      classInfo: "Cleric 5 • Lvl 5",
      speciesBackground: "Human • Acolyte",
      proficiency: "+3",
      initiative: "+1",
      spellDcDisplay: "DC 14",
      skillsDisplay: "Insi +5, Reli +4",
    });
    expect(result.trackingCards[0]).toMatchObject({
      name: "Mira",
      hasSpellSlots: true,
      pactSlotDisplay: "P3 ☐",
      hasPactSlot: true,
    });
    expect(result.trackingCards[0].spellSlots).toEqual([
      { level: 1, checkboxes: "☐☐☐☐" },
      { level: 2, checkboxes: "☐☐☐" },
    ]);
  });
});
