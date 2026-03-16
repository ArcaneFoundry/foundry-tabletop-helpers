import { describe, expect, it } from "vitest";

import { getMonsterPreviewStatusInfo } from "./monster-preview-status";

describe("monster preview status", () => {
  it("extracts defeated, concentration, and known conditions", () => {
    const info = getMonsterPreviewStatusInfo(
      {
        system: {
          attributes: {
            hp: { value: 0 },
          },
        },
        effects: [
          { statuses: new Set(["concentrating", "poisoned"]) },
          { statuses: new Set(["prone", "poisoned"]) },
        ],
      },
      { defeated: false },
    );

    expect(info).toEqual({
      isDefeated: true,
      isConcentrating: true,
      conditions: [
        { id: "poisoned", label: "Poisoned" },
        { id: "prone", label: "Prone" },
      ],
    });
  });

  it("prefers combatant defeated flags even when hp is above zero", () => {
    const info = getMonsterPreviewStatusInfo(
      {
        system: {
          attributes: {
            hp: { value: 12 },
          },
        },
        effects: [],
      },
      { isDefeated: true },
    );

    expect(info.isDefeated).toBe(true);
  });

  it("ignores unknown statuses and handles missing data", () => {
    const info = getMonsterPreviewStatusInfo({
      effects: [{ statuses: new Set(["custom-status"]) }],
    });

    expect(info).toEqual({
      isDefeated: false,
      isConcentrating: false,
      conditions: [],
    });
  });
});
