/**
 * Character Creator — Step 9: Equipment
 *
 * Starting equipment selection or starting gold.
 * Shows equipment items from configured packs grouped by category.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
  EquipmentSelection,
  StepCallbacks,
  CreatorIndexEntry,
} from "../character-creator-types";
import { compendiumIndexer } from "../data/compendium-indexer";
import { getStartingGoldForSelections } from "../starting-resources";

/* ── Helpers ─────────────────────────────────────────────── */

function getAvailableEquipment(state: WizardState): CreatorIndexEntry[] {
  const entries = compendiumIndexer.getIndexedEntries("item", state.config.packSources);
  return entries.filter((e) => !state.config.disabledUUIDs.has(e.uuid));
}

function getStartingGold(state: WizardState): number {
  return getStartingGoldForSelections(state.selections);
}

function buildDefaultEquipmentSelection(state: WizardState): EquipmentSelection {
  const startingGold = getStartingGold(state);
  const preferredMethod = state.config.equipmentMethod === "gold" ? "gold" : "equipment";

  return {
    method: preferredMethod,
    goldAmount: preferredMethod === "gold" ? startingGold : undefined,
  };
}

/* ── Step Definition ─────────────────────────────────────── */

export function createEquipmentStep(): WizardStepDefinition {
  return {
    id: "equipment",
    label: "Equipment",
    icon: "fa-solid fa-sack",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-equipment.hbs`,
    dependencies: ["class"],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      const data = state.selections.equipment;
      if (!data) return false;
      return data.method === "gold" || data.method === "equipment";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      await compendiumIndexer.loadPacks(state.config.packSources);

      const data = state.selections.equipment ?? buildDefaultEquipmentSelection(state);
      const equipment = getAvailableEquipment(state);
      const startingGold = getStartingGold(state);
      const gmMethod = state.config.equipmentMethod;

      // Group equipment by category
      const weapons = equipment.filter((e) => e.weaponType);
      const armor = equipment.filter((e) => e.armorType);
      const other = equipment.filter((e) => !e.weaponType && !e.armorType);

      return {
        method: data?.method ?? "equipment",
        isEquipment: !data?.method || data.method === "equipment",
        isGold: data?.method === "gold",
        allowEquipment: gmMethod === "equipment" || gmMethod === "both",
        allowGold: gmMethod === "gold" || gmMethod === "both",
        startingGold,
        equipmentFallbackGold: startingGold,
        goldAmount: data?.goldAmount ?? startingGold,
        weapons: weapons.slice(0, 50), // Limit for performance
        armor: armor.slice(0, 50),
        other: other.slice(0, 50),
        hasWeapons: weapons.length > 0,
        hasArmor: armor.length > 0,
        hasOther: other.length > 0,
        className: state.selections.class?.name ?? "your class",
      };
    },

    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      if (!state.selections.equipment) {
        callbacks.setDataSilent(buildDefaultEquipmentSelection(state));
      }

      // Method tabs
      el.querySelectorAll("[data-equip-method]").forEach((tab) => {
        tab.addEventListener("click", () => {
          const method = (tab as HTMLElement).dataset.equipMethod as "equipment" | "gold";
          if (!method) return;
          const startingGold = getStartingGold(state);
          callbacks.setData({
            method,
            goldAmount: method === "gold" ? startingGold : undefined,
          } as EquipmentSelection);
        });
      });

      // Gold amount input — save silently (no layout change)
      const goldInput = el.querySelector("[data-gold-amount]") as HTMLInputElement | null;
      if (goldInput) {
        goldInput.addEventListener("change", () => {
          const amount = parseInt(goldInput.value, 10);
          if (isNaN(amount) || amount < 0) return;
          callbacks.setDataSilent({
            method: "gold",
            goldAmount: amount,
          } as EquipmentSelection);
        });
      }
    },
  };
}
