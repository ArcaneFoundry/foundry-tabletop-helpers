/**
 * Combat Command Center — Settings Registration
 *
 * Registers all module settings for combat features:
 * - Advantage Initiative Dialog (Phase 1)
 * - Token Health Indicators (Phase 2) — placeholder
 * - Damage Workflows (Phase 3) — placeholder
 * - Monster Preview (Phase 4) — placeholder
 * - Party Summary (Phase 5) — placeholder
 */

import { Log, MOD } from "../logger";
import { getFormApplicationClass, getUI, setSetting, getSetting } from "../types";
import {
  getMonsterPreviewQuickActionChoices,
  serializeMonsterPreviewQuickActionSelection,
} from "./monster-preview/monster-preview-quick-actions";

/* ── Setting Keys ─────────────────────────────────────────── */

export const COMBAT_SETTINGS = {
  /** Show advantage/disadvantage dialog when batch-rolling initiative from the Combat Tracker. */
  ENABLE_ADVANTAGE_INITIATIVE: "enableAdvantageInitiative",
  /** Token health indicator visibility: "everyone", "gm", or "off". */
  TOKEN_HEALTH_VISIBILITY: "tokenHealthVisibility",
  /** Enable the Quick Damage/Save Workflows feature. */
  ENABLE_DAMAGE_WORKFLOWS: "enableDamageWorkflows",
  /** Auto-show damage panel when tokens are selected. */
  AUTO_DAMAGE_PANEL: "autoDamagePanel",
  /** Auto-show NPC stat block panel on their combat turn. */
  ENABLE_MONSTER_PREVIEW: "enableMonsterPreview",
  /** Default display mode for the combat monster preview panel. */
  MONSTER_PREVIEW_DEFAULT_DISPLAY: "monsterPreviewDefaultDisplay",
  /** Keep the last monster preview visible between NPC turns. */
  MONSTER_PREVIEW_PERSIST_BETWEEN_TURNS: "monsterPreviewPersistBetweenTurns",
  /** Comma-separated quick action ids shown in the monster preview. */
  MONSTER_PREVIEW_QUICK_ACTIONS: "monsterPreviewQuickActions",
  /** Enable the Party Summary quick-reference panel. */
  ENABLE_PARTY_SUMMARY: "enablePartySummary",
  /** Party source: "primaryParty" (dnd5e group) or "playerOwned" (all player-owned characters). */
  PARTY_SOURCE: "partySource",
  /** Enable the Quick Rules Reference panel. */
  ENABLE_RULES_REFERENCE: "enableRulesReference",
} as const;

/* ── Registration ─────────────────────────────────────────── */

/**
 * Register all combat feature settings.
 * Called from Hooks.once("init") via src/index.ts.
 */
export function registerCombatSettings(settings: {
  register(module: string, key: string, data: Record<string, unknown>): void;
  registerMenu?(module: string, key: string, data: { type: new () => unknown } & Record<string, unknown>): void;
}): void {
  try {
    settings.register(MOD, COMBAT_SETTINGS.ENABLE_ADVANTAGE_INITIATIVE, {
      name: "Advantage Initiative Dialog",
      hint: "Show a Normal / Advantage / Disadvantage dialog when using Roll All, Roll NPCs, or Roll PCs in the Combat Tracker. Also adds a Roll PCs button.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.TOKEN_HEALTH_VISIBILITY, {
      name: "Token Health Indicators",
      hint: "Show AC badge and health tier icon on NPC tokens. 'Everyone' shows to all players, 'GM Only' shows only to the GM, 'Off' disables indicators.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        everyone: "Everyone",
        gm: "GM Only",
        off: "Off",
      },
      default: "everyone",
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_DAMAGE_WORKFLOWS, {
      name: "Quick Damage/Save Workflows",
      hint: "Adds a token control button for quick damage, healing, and save workflows against selected tokens.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.AUTO_DAMAGE_PANEL, {
      name: "Auto-Show Damage Panel",
      hint: "Automatically show the Quick Damage panel when tokens are selected. When off, use the Combat Tracker button instead.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_MONSTER_PREVIEW, {
      name: "Combat Monster Preview",
      hint: "Auto-show the GM-facing NPC preview during monster turns. Use the local pin control to keep one preview open for yourself, or enable the between-turn setting below to keep previews visible world-wide between turns.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_DEFAULT_DISPLAY, {
      name: "Monster Preview Default Display",
      hint: "How the GM-facing monster preview should appear by default when the world loads. This controls layout only. Local pinning and the between-turn setting below control whether the preview stays visible off-turn.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        remember: "Remember Last",
        inline: "Inline",
        floating: "Floating",
        floatingMinimized: "Floating (Minimized)",
      },
      default: "remember",
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_PERSIST_BETWEEN_TURNS, {
      name: "Keep Monster Preview Between Turns",
      hint: "When enabled, all GMs keep the last monster preview visible on non-NPC turns instead of auto-hiding immediately. This is separate from the header pin, which only keeps a preview open locally for one GM/browser.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_QUICK_ACTIONS, {
      name: "Monster Preview Quick Actions",
      hint: "Stored quick-action selection for the Monster Preview submenu.",
      scope: "world",
      config: false,
      type: String,
      default: "open-sheet,roll-initiative,roll-skill:prc,roll-skill:ste,roll-save:wis",
      restricted: true,
    });

    registerMonsterPreviewQuickActionsMenu(settings);

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_PARTY_SUMMARY, {
      name: "Party Summary Panel",
      hint: "GM-only quick-reference panel showing PC stats, saves, and conditions. Toggle via Combat Tracker button or window.fth.partySummary().",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.ENABLE_RULES_REFERENCE, {
      name: "Quick Rules Reference",
      hint: "Floating D&D 5e (2024) rules reference panel. Toggle via Combat Tracker button, / keybind, or window.fth.rulesReference().",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true,
    });

    settings.register(MOD, COMBAT_SETTINGS.PARTY_SOURCE, {
      name: "Party Source",
      hint: "Where the Party Summary gets its members. 'Primary Party' uses the dnd5e assigned primary party group (falls back to player-owned if none is set). 'Player Owned' shows all player-owned characters.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        primaryParty: "Primary Party (dnd5e group)",
        playerOwned: "Player Owned Characters",
      },
      default: "primaryParty",
      restricted: true,
    });

    Log.debug("Combat settings registered");
  } catch (err) {
    Log.warn("Combat: failed to register settings", err);
  }
}

function registerMonsterPreviewQuickActionsMenu(settings: {
  registerMenu?(module: string, key: string, data: { type: new () => unknown } & Record<string, unknown>): void;
}): void {
  if (typeof settings.registerMenu !== "function") return;

  try {
    const FormAppBase = getFormApplicationClass() ?? class {};
    const BaseWithDefaults = FormAppBase as {
      defaultOptions?: Record<string, unknown>;
      new (): {
        getData?(): Promise<Record<string, unknown>>;
        _updateObject?(_event: Event, formData: Record<string, unknown>): Promise<void>;
      };
    };

    class MonsterPreviewQuickActionsForm extends BaseWithDefaults {
      static get defaultOptions() {
        const base = BaseWithDefaults.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
          id: `${MOD}-monster-preview-quick-actions`,
          title: "Monster Preview Quick Actions",
          template: `modules/${MOD}/templates/combat/monster-preview-quick-actions.hbs`,
          width: 460,
          height: "auto",
        }, { inplace: false });
      }

      async getData() {
        const storedValue = getSetting<string>(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_QUICK_ACTIONS);
        return {
          actions: getMonsterPreviewQuickActionChoices(storedValue),
        };
      }

      async _updateObject(_event: Event, formData: Record<string, unknown>) {
        const serialized = serializeMonsterPreviewQuickActionSelection(formData.actionIds);
        await setSetting(MOD, COMBAT_SETTINGS.MONSTER_PREVIEW_QUICK_ACTIONS, serialized);
        getUI()?.notifications?.info?.("Monster preview quick actions saved.");
      }
    }

    settings.registerMenu(MOD, "monsterPreviewQuickActionsMenu", {
      name: "Monster Preview Quick Actions",
      label: "Configure",
      hint: "Choose which quick actions appear in the monster preview. The action order stays compact and fixed.",
      icon: "fa-solid fa-bolt",
      type: MonsterPreviewQuickActionsForm,
      restricted: true,
    });
  } catch (err) {
    Log.warn("Combat: failed to register Monster Preview Quick Actions submenu", err);
  }
}
