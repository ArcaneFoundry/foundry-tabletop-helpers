import { MOD } from "../../logger";
import type { WizardState, WizardStepDefinition } from "../character-creator-types";
import { getBackgroundLanguageChoiceTitle } from "./origin-flow-utils";

function getRequiredLanguageCount(state: WizardState): number {
  return state.selections.background?.grants.languageChoiceCount ?? 0;
}

export function createBackgroundLanguagesStep(): WizardStepDefinition {
  return {
    id: "backgroundLanguages",
    label: "Background Languages",
    icon: "fa-solid fa-language",
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["background"],
    isApplicable: (state) => !!state.selections.background?.uuid && getRequiredLanguageCount(state) > 0,
    isComplete: (state) => !!state.selections.background?.uuid
      && (state.selections.background?.languages.chosen.length ?? 0) >= getRequiredLanguageCount(state),
    getStatusHint: (state) => {
      const remaining = Math.max(0, getRequiredLanguageCount(state) - (state.selections.background?.languages.chosen.length ?? 0));
      return remaining > 0 ? `Choose ${remaining} more language${remaining === 1 ? "" : "s"}` : "";
    },
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      return {
        stepId: "backgroundLanguages",
        stepTitle: getBackgroundLanguageChoiceTitle(state),
        stepLabel: "Background Languages",
        stepIcon: "fa-solid fa-language",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--class-choices",
        backgroundName: state.selections.background?.name ?? "Background",
        className: state.selections.class?.name ?? "Class",
        title: getBackgroundLanguageChoiceTitle(state),
        description: "Choose the additional languages granted by your background.",
        requiredCount: getRequiredLanguageCount(state),
        selectedLanguages: state.selections.background?.languages.chosen ?? [],
      };
    },
  };
}
