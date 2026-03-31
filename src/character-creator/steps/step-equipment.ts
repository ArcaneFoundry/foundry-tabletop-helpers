import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
} from "../character-creator-types";
import { ensureEquipmentShopMetadataReady } from "../character-creator-index-cache";
import {
  buildDefaultEquipmentSelection,
  deriveEquipmentState,
  getEquipmentSelection,
  resolveEquipmentFlow,
  syncEquipmentSelectionSnapshot,
} from "./equipment-flow-utils";
import { EquipmentStepScreen } from "../react/steps/build/equipment-step-screen";
import { EquipmentShopStepScreen } from "../react/steps/build/equipment-shop-step-screen";

function hasRequiredEquipmentSelections(state: WizardState): boolean {
  const selection = getEquipmentSelection(state);
  return Boolean(selection.classOptionId && selection.backgroundOptionId);
}

async function buildEquipmentViewModel(state: WizardState): Promise<Record<string, unknown>> {
  await ensureEquipmentShopMetadataReady(state.config.packSources, { persistIfMissing: false });
  const resolution = await resolveEquipmentFlow(state);
  syncEquipmentSelectionSnapshot(state, resolution);
  const selection = getEquipmentSelection(state);
  const derived = deriveEquipmentState(state, resolution);

  return {
    stepId: "equipment",
    stepTitle: "Build",
    stepLabel: "Equipment",
    stepIcon: "fa-solid fa-sack",
    hideStepIndicator: true,
    hideShellHeader: true,
    shellContentClass: "cc-step-content--build-flow",
    resolution,
    selection,
    derived,
  };
}

async function buildEquipmentShopViewModel(state: WizardState): Promise<Record<string, unknown>> {
  await ensureEquipmentShopMetadataReady(state.config.packSources, { persistIfMissing: false });
  const resolution = await resolveEquipmentFlow(state);
  syncEquipmentSelectionSnapshot(state, resolution);
  const selection = getEquipmentSelection(state);
  const derived = deriveEquipmentState(state, resolution);

  return {
    stepId: "equipmentShop",
    stepTitle: "Build",
    stepLabel: "Shop",
    stepIcon: "fa-solid fa-store",
    hideStepIndicator: true,
    hideShellHeader: true,
    shellContentClass: "cc-step-content--build-flow",
    resolution,
    selection,
    derived,
  };
}

export function createEquipmentStep(): WizardStepDefinition {
  return {
    id: "equipment",
    label: "Equipment",
    icon: "fa-solid fa-sack",
    renderMode: "react",
    reactComponent: EquipmentStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["class", "background"],
    isApplicable: (state) => Boolean(state.selections.class?.uuid && state.selections.background?.uuid),
    isComplete(state) {
      return hasRequiredEquipmentSelections(state);
    },
    getStatusHint(state) {
      if (!state.selections.class?.uuid || !state.selections.background?.uuid) return "";
      const selection = getEquipmentSelection(state);
      if (!selection.classOptionId) return "Choose your class provisions";
      if (!selection.backgroundOptionId) return "Choose your background provisions";
      return "";
    },
    async buildViewModel(state) {
      if (!state.selections.equipment) state.selections.equipment = buildDefaultEquipmentSelection();
      return buildEquipmentViewModel(state);
    },
  };
}

export function createEquipmentShopStep(): WizardStepDefinition {
  return {
    id: "equipmentShop",
    label: "Shop",
    icon: "fa-solid fa-store",
    renderMode: "react",
    reactComponent: EquipmentShopStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["equipment"],
    isApplicable: (state) => {
      if (!hasRequiredEquipmentSelections(state)) return false;
      const selection = getEquipmentSelection(state);
      return (selection.baseGoldCp ?? 0) > 0;
    },
    isComplete: (state) => hasRequiredEquipmentSelections(state),
    getStatusHint: (state) => (state.selections.equipment?.remainingGoldCp ?? 0) > 0 ? "Spend or save your remaining gold" : "",
    async buildViewModel(state) {
      if (!state.selections.equipment) state.selections.equipment = buildDefaultEquipmentSelection();
      return buildEquipmentShopViewModel(state);
    },
  };
}
