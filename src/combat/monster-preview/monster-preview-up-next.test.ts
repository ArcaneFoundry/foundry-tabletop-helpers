import { describe, expect, it } from "vitest";

import { getMonsterPreviewUpNextData } from "./monster-preview-up-next";

describe("monster preview up next", () => {
  it("returns the next undefeated npc with current hp details", () => {
    const info = getMonsterPreviewUpNextData({
      turn: 0,
      turns: [
        { actor: { id: "pc-1", name: "Cleric", type: "character" } },
        { defeated: true, actor: { name: "Fallen Goblin", type: "npc" } },
        {
          actor: {
            id: "npc-2",
            name: "Goblin Boss",
            type: "npc",
            system: {
              attributes: {
                ac: { value: 17 },
                hp: { value: 9, max: 21 },
              },
              details: {
                cr: 1,
              },
            },
          },
        },
      ],
    });

    expect(info).toEqual({
      actorId: "npc-2",
      name: "Goblin Boss",
      isNPC: true,
      ac: 17,
      hpValue: 9,
      hpMax: 21,
      cr: "1",
    });
  });

  it("returns the next pc without npc stats", () => {
    const info = getMonsterPreviewUpNextData({
      turn: 0,
      turns: [
        { actor: { id: "npc-1", name: "Goblin Boss", type: "npc" } },
        { actor: { id: "pc-2", name: "Aric", type: "character" } },
      ],
    });

    expect(info).toEqual({
      actorId: "pc-2",
      name: "Aric",
      isNPC: false,
    });
  });

  it("returns null when every other combatant is defeated or missing", () => {
    const info = getMonsterPreviewUpNextData({
      turn: 0,
      turns: [
        { actor: { name: "Goblin Boss", type: "npc" } },
        { defeated: true, actor: { name: "Fallen Goblin", type: "npc" } },
        { isDefeated: true, actor: { name: "Downed Rogue", type: "character" } },
        {},
      ],
    });

    expect(info).toBeNull();
  });
});
