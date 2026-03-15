import { describe, expect, it } from "vitest";

import type { EncounterGroupData } from "../../extractors/dnd5e-types";
import type { PrintOptions } from "../../types";
import { transformEncounterGroupToViewModel } from "./encounter-transformer";

const options: PrintOptions = {
  paperSize: "a4",
  portrait: "portrait",
  sections: {},
};

describe("encounter transformer shell", () => {
  it("passes through rendered NPC blocks and escapes the group name", () => {
    const data: EncounterGroupData = {
      name: "Cult <Ambush>",
      actors: [],
    };

    const result = transformEncounterGroupToViewModel(data, options, ["<article>npc</article>"]);

    expect(result).toEqual({
      name: "Cult &lt;Ambush&gt;",
      npcBlocks: ["<article>npc</article>"],
      paperClass: "fth-paper-a4",
    });
  });
});
