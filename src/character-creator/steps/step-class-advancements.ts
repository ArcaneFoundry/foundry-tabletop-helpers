import { MOD } from "../../logger";
import type {
  ClassAdvancementRequirementType,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import {
  buildEmptyClassAdvancementSelections,
  getClassAdvancementRequiredCount,
  getClassAdvancementRequirements,
  getExpertisePool,
  getLanguagePool,
  getToolPool,
  isClassAdvancementStepComplete,
  languageLabel,
  toolLabel,
} from "./class-advancement-utils";

type SelectableOption = {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  description?: string;
  iconClass?: string;
};

function buildOptionState(
  allOptions: Array<{ id: string; label: string; description?: string; iconClass?: string }>,
  selected: string[],
  limit: number,
): SelectableOption[] {
  const selectedSet = new Set(selected);
  return allOptions.map((entry) => ({
    ...entry,
    checked: selectedSet.has(entry.id),
    disabled: !selectedSet.has(entry.id) && selectedSet.size >= limit,
  }));
}

function buildCommonViewModel(
  state: WizardState,
  type: ClassAdvancementRequirementType,
  title: string,
  description: string,
  selected: string[],
  options: SelectableOption[],
): Record<string, unknown> {
  const requiredCount = getClassAdvancementRequiredCount(state, type);
  return {
    stepId: stepIdForType(type),
    stepTitle: title,
    stepLabel: title,
    stepIcon: iconForType(type),
    hideStepIndicator: true,
    hideShellHeader: true,
    shellContentClass: "cc-step-content--class-choices",
    classIdentifier: state.selections.class?.identifier ?? "",
    className: state.selections.class?.name ?? "Class",
    type,
    title,
    description,
    selectedCount: selected.length,
    requiredCount,
    selectedEntries: options.filter((entry) => entry.checked),
    options,
    requirements: getClassAdvancementRequirements(state, type),
  };
}

function stepIdForType(type: ClassAdvancementRequirementType): string {
  switch (type) {
    case "expertise": return "classExpertise";
    case "languages": return "classLanguages";
    case "tools": return "classTools";
    case "itemChoices": return "classItemChoices";
    default: return "classChoices";
  }
}

function iconForType(type: ClassAdvancementRequirementType): string {
  switch (type) {
    case "expertise": return "fa-solid fa-bullseye";
    case "languages": return "fa-solid fa-language";
    case "tools": return "fa-solid fa-screwdriver-wrench";
    case "itemChoices": return "fa-solid fa-hand-sparkles";
    default: return "fa-solid fa-list-check";
  }
}

function buildStepDefinition(
  type: ClassAdvancementRequirementType,
  label: string,
  dependencies: string[] = ["class"],
): WizardStepDefinition {
  return {
    id: stepIdForType(type),
    label,
    icon: iconForType(type),
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies,
    isApplicable: (state) => !!state.selections.class?.uuid && getClassAdvancementRequiredCount(state, type) > 0,
    isComplete: (state) => !!state.selections.class?.uuid && isClassAdvancementStepComplete(state, type),
    getStatusHint: (state) => {
      const requiredCount = getClassAdvancementRequiredCount(state, type);
      const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();
      const selectedCount =
        type === "expertise"
          ? selections.expertiseSkills.length
          : type === "languages"
            ? selections.chosenLanguages.length
            : type === "tools"
              ? selections.chosenTools.length
              : getClassAdvancementRequirements(state, "itemChoices").reduce(
                (sum, entry) => sum + (selections.itemChoices[entry.id]?.length ?? 0),
                0,
              );
      if (selectedCount >= requiredCount) return "";
      const remaining = requiredCount - selectedCount;
      return `Choose ${remaining} more ${label.toLowerCase()}${remaining === 1 ? "" : ""}`;
    },
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const selections = state.selections.classAdvancements ?? buildEmptyClassAdvancementSelections();

      if (type === "expertise") {
        const options = buildOptionState(
          getExpertisePool(state).map((entry) => ({
            ...entry,
            description: "Choose a proficient skill to elevate to expertise.",
            iconClass: "fa-solid fa-star",
          })),
          selections.expertiseSkills,
          getClassAdvancementRequiredCount(state, type),
        );
        return buildCommonViewModel(
          state,
          type,
          "Choose Your Expertise",
          "Select the class-granted expertise picks available at your current starting level.",
          selections.expertiseSkills,
          options,
        );
      }

      if (type === "languages") {
        const options = buildOptionState(
          getLanguagePool(state).map((entry) => ({
            ...entry,
            description: "Add a new language granted by your class.",
            iconClass: "fa-solid fa-comments",
          })),
          selections.chosenLanguages,
          getClassAdvancementRequiredCount(state, type),
        );
        return buildCommonViewModel(
          state,
          type,
          "Choose Your Languages",
          "Select the additional languages granted by your class features.",
          selections.chosenLanguages,
          options,
        );
      }

      if (type === "tools") {
        const options = buildOptionState(
          getToolPool(state).map((entry) => ({
            ...entry,
            description: "Add a new tool proficiency granted by your class.",
            iconClass: "fa-solid fa-hammer",
          })),
          selections.chosenTools,
          getClassAdvancementRequiredCount(state, type),
        );
        return buildCommonViewModel(
          state,
          type,
          "Choose Your Tools",
          "Select the class-granted tool proficiencies available at your starting level.",
          selections.chosenTools,
          options,
        );
      }

      const requirements = getClassAdvancementRequirements(state, "itemChoices");
      return {
        stepId: stepIdForType(type),
        stepTitle: "Choose Your Class Features",
        stepLabel: "Choose Your Class Features",
        stepIcon: iconForType(type),
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--class-choices",
        classIdentifier: state.selections.class?.identifier ?? "",
        className: state.selections.class?.name ?? "Class",
        type,
        title: "Choose Your Class Features",
        description: "Select the class feature options granted by your class at the current starting level.",
        requirements: requirements.map((requirement) => ({
          ...requirement,
          selectedIds: selections.itemChoices[requirement.id] ?? [],
          options: buildOptionState(
            (requirement.itemChoices ?? []).map((entry) => ({
              id: entry.uuid,
              label: entry.name,
              description: requirement.title,
              iconClass: "fa-solid fa-stars",
            })),
            selections.itemChoices[requirement.id] ?? [],
            requirement.requiredCount,
          ),
        })),
      };
    },
  };
}

export function createClassExpertiseStep(): WizardStepDefinition {
  return buildStepDefinition("expertise", "Expertise");
}

export function createClassLanguagesStep(): WizardStepDefinition {
  return buildStepDefinition("languages", "Languages");
}

export function createClassToolsStep(): WizardStepDefinition {
  return buildStepDefinition("tools", "Tools");
}

export function createClassItemChoicesStep(): WizardStepDefinition {
  return buildStepDefinition("itemChoices", "Class Choices");
}

export const __classAdvancementStepInternals = {
  buildCommonViewModel,
  stepIdForType,
  iconForType,
  languageLabel,
  toolLabel,
};
