import { describe, expect, it, vi } from "vitest";

import {
  embedActionToFeatureData,
  extractGearFromSystem,
  extractNPCManual,
  extractSkillsFromContext,
} from "./dnd5e-npc-extractor";

describe("dnd5e npc extractor helpers", () => {
  it("uses embed context skills when present", () => {
    const result = extractSkillsFromContext({
      summary: { skills: "Deception +5, Stealth +6" },
    } as never, {
      system: {},
    }, {
      skillKeyToName: (key) => key,
    });

    expect(result).toEqual([
      { name: "Deception", mod: 5 },
      { name: "Stealth", mod: 6 },
    ]);
  });

  it("converts embed actions into feature data with stripped descriptions", () => {
    const actor = {
      name: "Dragon",
      getRollData: () => ({}),
      items: {
        get: vi.fn(() => ({ type: "feat", uuid: "Item.uuid" })),
      },
    };

    const feature = embedActionToFeatureData({
      name: "Breath Weapon",
      description: "deals damage",
      openingTag: "<p>",
      dataset: { id: "item-1" },
    } as never, new Set(["item-1"]), actor, {
      stripEnrichedText: (html) => html.toUpperCase(),
    });

    expect(feature).toMatchObject({
      name: "Breath Weapon",
      description: "<P>DEALS DAMAGE",
      isFavorite: true,
      itemType: "feat",
    });
  });

  it("uses system getGear when available before fallback extraction", () => {
    const extractGear = vi.fn(() => ["Fallback Gear"]);
    const actor = {
      system: {
        getGear: () => [
          { name: "Longsword", system: { quantity: 2 } },
          { name: "Shield", system: { quantity: 1 } },
        ],
      },
    };

    expect(extractGearFromSystem(actor, { extractGear })).toEqual(["Longsword (2)", "Shield"]);
    expect(extractGear).not.toHaveBeenCalled();
  });

  it("falls back to manual npc extraction and sorts multiattack before weapon actions", async () => {
    const result = await extractNPCManual({
      name: "Ogre",
      type: "npc",
      prototypeToken: { texture: { src: "ogre-token.webp" } },
      system: {
        details: {
          cr: 2,
          alignment: "chaotic evil",
          type: { value: "giant" },
          legendary: { description: "Legendary text" },
        },
        attributes: {
          prof: 2,
          ac: { value: 11, formula: "hide armor" },
          hp: { value: 59, max: 59, formula: "7d10+21" },
          init: { total: -1 },
          movement: { walk: 40 },
          senses: { passive: 8, darkvision: 60 },
        },
        abilities: {
          str: { mod: 4 },
          dex: { mod: -1 },
        },
        skills: {
          prc: { total: -2, ability: "wis" },
        },
        traits: {
          size: "lg",
          languages: { value: ["common"], custom: "Giant" },
        },
      },
      items: [
        { name: "Greatclub", type: "weapon" },
        { name: "Multiattack", type: "feat" },
      ],
    }, new Set(["Greatclub"]), {
      stripEnrichedText: (html) => html,
      skillKeyToName: (key) => key,
      extractGear: () => ["Greatclub"],
      itemToFeatureData: (item) => ({
        name: item.name ?? "",
        description: "",
        uses: null,
        isFavorite: item.name === "Greatclub",
        itemType: item.type,
      }),
      getActivationType: (item) => item.type === "weapon" ? "action" : "action",
      crToXP: (cr) => cr * 100,
      formatCR: (cr) => String(cr),
      sizeCodeToName: (code) => code.toUpperCase(),
    });

    expect(result).toMatchObject({
      name: "Ogre",
      tokenImg: "ogre-token.webp",
      cr: "2",
      xp: 200,
      proficiencyBonus: 2,
      type: "giant",
      size: "LG",
      alignment: "chaotic evil",
      gear: ["Greatclub"],
      passivePerception: 8,
      senses: [{ key: "darkvision", value: 60 }],
      languages: ["Giant", "common"],
    });
    expect(result.actions.map((action) => action.name)).toEqual(["Multiattack", "Greatclub"]);
  });
});
