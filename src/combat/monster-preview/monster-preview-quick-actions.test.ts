import { describe, expect, it } from "vitest";

import {
  DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS,
  getMonsterPreviewQuickActionChoices,
  resolveMonsterPreviewQuickActions,
  serializeMonsterPreviewQuickActionSelection,
} from "./monster-preview-quick-actions";

describe("monster preview quick action settings", () => {
  it("resolves the default quick actions in stable display order", () => {
    const actions = resolveMonsterPreviewQuickActions(DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS.join(","));

    expect(actions.map((action) => action.id)).toEqual([...DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS]);
  });

  it("supports a trimmed subset and ignores unknown action ids", () => {
    const actions = resolveMonsterPreviewQuickActions(" roll-skill:ste , unknown-action , open-sheet ");

    expect(actions.map((action) => action.id)).toEqual(["open-sheet", "roll-skill:ste"]);
  });

  it("supports hiding the quick action row entirely with none", () => {
    expect(resolveMonsterPreviewQuickActions("none")).toEqual([]);
  });

  it("falls back to the default action set when no valid ids remain", () => {
    const actions = resolveMonsterPreviewQuickActions("bad-value");

    expect(actions.map((action) => action.id)).toEqual([...DEFAULT_MONSTER_PREVIEW_QUICK_ACTION_IDS]);
  });

  it("builds submenu choices with enabled state from the stored setting", () => {
    const choices = getMonsterPreviewQuickActionChoices("roll-skill:ste,open-sheet");

    expect(choices.map((choice) => [choice.id, choice.enabled])).toEqual([
      ["open-sheet", true],
      ["roll-initiative", false],
      ["roll-skill:prc", false],
      ["roll-skill:ste", true],
      ["roll-save:wis", false],
    ]);
  });

  it("serializes selected submenu actions in stable display order", () => {
    expect(serializeMonsterPreviewQuickActionSelection(["roll-skill:ste", "open-sheet"])).toBe(
      "open-sheet,roll-skill:ste",
    );
  });

  it("serializes an empty submenu selection to none", () => {
    expect(serializeMonsterPreviewQuickActionSelection([])).toBe("none");
  });
});
