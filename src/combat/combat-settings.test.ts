import { describe, expect, it } from "vitest";

import { COMBAT_SETTINGS, registerCombatSettings } from "./combat-settings";
import { MOD } from "../logger";

describe("combat settings registration", () => {
  it("registers the monster preview quick actions as a hidden setting plus submenu", () => {
    const registered = new Map<string, Record<string, unknown>>();
    const registeredMenus = new Map<string, Record<string, unknown>>();

    registerCombatSettings({
      register: (_module, key, data) => {
        registered.set(key, data);
      },
      registerMenu: (_module, key, data) => {
        registeredMenus.set(key, data);
      },
    });

    expect(registered.get(COMBAT_SETTINGS.MONSTER_PREVIEW_QUICK_ACTIONS)).toMatchObject({
      name: "Monster Preview Quick Actions",
      config: false,
      default: "open-sheet,roll-initiative,roll-skill:prc,roll-skill:ste,roll-save:wis",
      restricted: true,
    });
    expect(registered.get(COMBAT_SETTINGS.MONSTER_PREVIEW_PERSIST_BETWEEN_TURNS)).toMatchObject({
      name: "Keep Monster Preview Between Turns",
      config: true,
      default: false,
      restricted: true,
    });
    expect(registered.get(COMBAT_SETTINGS.MONSTER_PREVIEW_PERSIST_BETWEEN_TURNS)?.hint).toContain("separate from the header pin");
    expect(registered.get(COMBAT_SETTINGS.ENABLE_MONSTER_PREVIEW)?.hint).toContain("local pin control");

    expect(registeredMenus.get("monsterPreviewQuickActionsMenu")).toMatchObject({
      name: "Monster Preview Quick Actions",
      label: "Configure",
      restricted: true,
    });
    expect(MOD).toBeTypeOf("string");
  });
});
