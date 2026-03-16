import { describe, expect, it } from "vitest";

import { extractCardData } from "./party-summary-types";

describe("party summary card extraction", () => {
  it("extracts saves, class labels, spell dc, and passives from character data", () => {
    const actor = {
      id: "pc-1",
      name: "Seraphina",
      img: "seraphina.png",
      system: {
        attributes: {
          hp: { value: 21, max: 28, temp: 4 },
          ac: { value: 17 },
          movement: { walk: 35 },
          spelldc: 16,
        },
        abilities: {
          str: { mod: 1 },
          dex: { save: 5, proficient: true },
          con: { save: { value: 6 } },
          int: { mod: 3, savingThrow: { proficient: true } },
          wis: {},
          cha: { mod: -1 },
        },
        skills: {
          prc: { passive: 15 },
          inv: { passive: 13 },
          ins: { passive: 14 },
        },
        details: { level: 7 },
      },
      classes: {
        wizard: { name: "Wizard", system: { levels: 5 } },
        cleric: { name: "Cleric", system: { levels: 2 } },
      },
      effects: [],
    };

    const card = extractCardData(actor);

    expect(card).toMatchObject({
      actorId: "pc-1",
      name: "Seraphina",
      portraitUrl: "seraphina.png",
      classLabel: "Wizard 5 / Cleric 2",
      level: 7,
      ac: 17,
      hpValue: 21,
      hpMax: 28,
      hpTemp: 4,
      hpPercent: 75,
      speed: 35,
      passivePerception: 15,
      passiveInvestigation: 13,
      passiveInsight: 14,
      spellDC: 16,
      isConcentrating: false,
    });
    expect(card.saves).toEqual([
      { ability: "str", label: "STR", modifier: "+1", modValue: 1, proficient: false },
      { ability: "dex", label: "DEX", modifier: "+5", modValue: 5, proficient: true },
      { ability: "con", label: "CON", modifier: "+6", modValue: 6, proficient: false },
      { ability: "int", label: "INT", modifier: "+3", modValue: 3, proficient: true },
      { ability: "wis", label: "WIS", modifier: "+0", modValue: 0, proficient: false },
      { ability: "cha", label: "CHA", modifier: "-1", modValue: -1, proficient: false },
    ]);
  });

  it("falls back safely when class/effect/system data is sparse", () => {
    const actor = {
      id: "pc-2",
      name: "Fallback Hero",
      system: {
        attributes: {
          hp: { value: 0, max: 0 },
          spelldc: 0,
        },
        details: { level: 3 },
      },
      effects: [
        { statuses: new Set(["concentrating", "poisoned", "poisoned"]) },
        { statuses: ["blinded", "unknown-status"] },
      ],
    };

    const card = extractCardData(actor);

    expect(card.classLabel).toBe("Level 3");
    expect(card.hpPercent).toBe(0);
    expect(card.healthTier.id).toBe("defeated");
    expect(card.ac).toBe(10);
    expect(card.speed).toBe(30);
    expect(card.passivePerception).toBe(10);
    expect(card.passiveInvestigation).toBe(10);
    expect(card.passiveInsight).toBe(10);
    expect(card.spellDC).toBeNull();
    expect(card.isConcentrating).toBe(true);
    expect(card.conditions).toEqual([
      { id: "poisoned", label: "Poisoned" },
      { id: "blinded", label: "Blinded" },
    ]);
  });
});
