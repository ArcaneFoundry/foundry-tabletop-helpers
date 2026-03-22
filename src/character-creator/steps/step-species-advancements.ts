import { MOD } from "../../logger";
import type { WizardState, WizardStepDefinition } from "../character-creator-types";
import {
  getRequiredSpeciesItemChoiceCount,
  getRequiredSpeciesLanguageChoiceCount,
  getRequiredSpeciesSkillChoiceCount,
  getSpeciesChoiceValidationMessages,
  getSpeciesItemChoiceRequirements,
  getSpeciesRequirementTitle,
} from "./origin-flow-utils";

function buildStepDefinition(
  stepId: "speciesSkills" | "speciesLanguages" | "speciesItemChoices",
  label: string,
  icon: string,
): WizardStepDefinition {
  return {
    id: stepId,
    label,
    icon,
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["species", "background", "class"],
    isApplicable: (state) => {
      if (!state.selections.species?.uuid) return false;
      if (stepId === "speciesSkills") return getRequiredSpeciesSkillChoiceCount(state) > 0;
      if (stepId === "speciesLanguages") return getRequiredSpeciesLanguageChoiceCount(state) > 0;
      return getSpeciesItemChoiceRequirements(state).length > 0;
    },
    isComplete: (state) => {
      if (!state.selections.species?.uuid) return false;
      if (stepId === "speciesSkills") {
        return (state.selections.speciesChoices?.chosenSkills?.length ?? 0) >= getRequiredSpeciesSkillChoiceCount(state);
      }
      if (stepId === "speciesLanguages") {
        return (state.selections.speciesChoices?.chosenLanguages?.length ?? 0) >= getRequiredSpeciesLanguageChoiceCount(state);
      }

      const chosenItems = state.selections.speciesChoices?.chosenItems ?? {};
      return getSpeciesItemChoiceRequirements(state).every((requirement) =>
        (chosenItems[requirement.id]?.length ?? 0) >= Math.min(requirement.requiredCount, requirement.itemChoices.length)
      );
    },
    getStatusHint: (state) => {
      if (stepId === "speciesSkills") {
        const remaining = Math.max(0, getRequiredSpeciesSkillChoiceCount(state) - (state.selections.speciesChoices?.chosenSkills?.length ?? 0));
        return remaining > 0 ? `Choose ${remaining} more species skill${remaining === 1 ? "" : "s"}` : "";
      }
      if (stepId === "speciesLanguages") {
        const remaining = Math.max(0, getRequiredSpeciesLanguageChoiceCount(state) - (state.selections.speciesChoices?.chosenLanguages?.length ?? 0));
        return remaining > 0 ? `Choose ${remaining} more species language${remaining === 1 ? "" : "s"}` : "";
      }

      for (const requirement of getSpeciesItemChoiceRequirements(state)) {
        const selectedCount = state.selections.speciesChoices?.chosenItems?.[requirement.id]?.length ?? 0;
        const requiredCount = Math.min(requirement.requiredCount, requirement.itemChoices.length);
        if (selectedCount < requiredCount) {
          const remaining = requiredCount - selectedCount;
          return `Choose ${remaining} more option${remaining === 1 ? "" : "s"} for ${requirement.title}`;
        }
      }

      return getSpeciesChoiceValidationMessages(state)[0] ?? "";
    },
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const speciesName = state.selections.species?.name ?? "Species";
      return {
        stepId,
        stepTitle: label,
        stepLabel: label,
        stepIcon: icon,
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--class-choices",
        speciesName,
        title: stepId === "speciesSkills"
          ? getSpeciesRequirementTitle(state, "skills", "Choose Species Skills")
          : stepId === "speciesLanguages"
            ? getSpeciesRequirementTitle(state, "languages", "Choose Species Languages")
            : "Choose Your Species Gifts",
        description: stepId === "speciesSkills"
          ? `Choose the additional skills granted by ${speciesName}.`
          : stepId === "speciesLanguages"
            ? `Choose the additional languages granted by ${speciesName}.`
            : `Choose the lineage, ancestry, or feature options granted by ${speciesName}.`,
        requiredCount: stepId === "speciesSkills"
          ? getRequiredSpeciesSkillChoiceCount(state)
          : stepId === "speciesLanguages"
            ? getRequiredSpeciesLanguageChoiceCount(state)
            : getRequiredSpeciesItemChoiceCount(state),
        selectedSkills: state.selections.speciesChoices?.chosenSkills ?? [],
        selectedLanguages: state.selections.speciesChoices?.chosenLanguages ?? [],
        itemChoiceRequirements: getSpeciesItemChoiceRequirements(state),
        validationMessages: getSpeciesChoiceValidationMessages(state),
      };
    },
  };
}

export function createSpeciesSkillsStep(): WizardStepDefinition {
  return buildStepDefinition("speciesSkills", "Species Skills", "fa-solid fa-list-check");
}

export function createSpeciesLanguagesStep(): WizardStepDefinition {
  return buildStepDefinition("speciesLanguages", "Species Languages", "fa-solid fa-language");
}

export function createSpeciesItemChoicesStep(): WizardStepDefinition {
  return buildStepDefinition("speciesItemChoices", "Species Gifts", "fa-solid fa-hand-sparkles");
}
