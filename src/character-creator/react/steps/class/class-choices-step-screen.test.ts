import { describe, expect, it } from "vitest";

import { groupSkillChoicesByAbility } from "./class-choices-step-screen";

describe("groupSkillChoicesByAbility", () => {
  it("returns only populated groups in canonical D&D ability order", () => {
    const grouped = groupSkillChoicesByAbility([
      { key: "wis-1", label: "Insight", abilityAbbrev: "WIS", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "dex-1", label: "Acrobatics", abilityAbbrev: "DEX", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "str-1", label: "Athletics", abilityAbbrev: "STR", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "int-1", label: "History", abilityAbbrev: "INT", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "cha-1", label: "Persuasion", abilityAbbrev: "CHA", checked: false, disabled: false, iconClass: "", tooltip: "" },
    ]);

    expect(grouped.map((group) => group.abilityAbbrev)).toEqual(["STR", "DEX", "WIS", "INT", "CHA"]);
    expect(grouped.some((group) => group.abilityAbbrev === "CON")).toBe(false);
    expect(grouped.find((group) => group.abilityAbbrev === "STR")?.entries.map((entry) => entry.label)).toEqual(["Athletics"]);
  });
});
