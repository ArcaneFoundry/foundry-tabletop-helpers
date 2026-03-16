import { describe, expect, it } from "vitest";

import { getMonsterPreviewContextInfo } from "./monster-preview-context";

describe("monster preview context", () => {
  it("returns token, initiative, and round cues when available", () => {
    const info = getMonsterPreviewContextInfo(
      {
        name: "Goblin 3",
        initiative: 17,
        actor: { name: "Goblin" },
        token: { name: "Goblin 3" },
      },
      { round: 2 },
    );

    expect(info).toEqual({
      tokenName: "Goblin 3",
      initiative: "17",
      roundLabel: "Round 2",
      turnLabel: "Acting now",
    });
  });

  it("omits token name when it matches the actor name", () => {
    const info = getMonsterPreviewContextInfo(
      {
        name: "Goblin",
        initiative: "12.5",
        actor: { name: "Goblin" },
      },
      { round: 1 },
    );

    expect(info.tokenName).toBeUndefined();
    expect(info.initiative).toBe("12.5");
    expect(info.roundLabel).toBe("Round 1");
  });

  it("handles missing combatant data", () => {
    const info = getMonsterPreviewContextInfo(undefined, undefined);

    expect(info).toEqual({
      tokenName: undefined,
      initiative: undefined,
      roundLabel: undefined,
      turnLabel: undefined,
    });
  });
});
