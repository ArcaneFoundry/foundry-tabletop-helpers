import { MOD } from "../../logger";
import type { WizardState, WizardStepDefinition } from "../character-creator-types";
import { LANGUAGE_LABELS, SKILLS } from "../data/dnd5e-constants";
import { buildOriginSelectedGrantGroups, getAllFixedLanguages } from "./origin-flow-utils";

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function languageLabel(key: string): string {
  return LANGUAGE_LABELS[key] ?? key;
}

function toolLabel(key: string | null): string | null {
  if (!key) return null;
  return key.split(":").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(": ");
}

export function createOriginSummaryStep(): WizardStepDefinition {
  return {
    id: "originSummary",
    label: "Origin Summary",
    icon: "fa-solid fa-layer-group",
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-origin-summary.hbs`,
    dependencies: ["background", "species"],
    isApplicable: (state) => !!state.selections.background?.uuid && !!state.selections.species?.uuid,
    isComplete: (state) => !!state.selections.background?.uuid && !!state.selections.species?.uuid,
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const fixedLanguages = getAllFixedLanguages(state).map(languageLabel);
      return {
        stepId: "originSummary",
        stepTitle: "Origin Summary",
        stepLabel: "Origin Summary",
        stepIcon: "fa-solid fa-layer-group",
        nextButtonLabel: "Confirm",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--origin-flow",
        backgroundName: state.selections.background?.name ?? "",
        backgroundImage: state.selections.background?.img ?? "",
        speciesName: state.selections.species?.name ?? "",
        speciesImage: state.selections.species?.img ?? "",
        className: state.selections.class?.name ?? "",
        backgroundSkills: (state.selections.background?.grants.skillProficiencies ?? []).map(skillLabel),
        classSkills: (state.selections.skills?.chosen ?? []).map(skillLabel),
        speciesSkills: [
          ...(state.selections.species?.skillGrants ?? []),
          ...(state.selections.speciesChoices?.chosenSkills ?? []),
        ].map(skillLabel),
        speciesItems: Object.entries(state.selections.speciesChoices?.chosenItems ?? {})
          .flatMap(([, uuids]) => uuids)
          .map((uuid) => {
            const group = (state.selections.species?.itemChoiceGroups ?? [])
              .find((candidate) => candidate.options.some((option) => option.uuid === uuid));
            const option = group?.options.find((candidate) => candidate.uuid === uuid);
            return option?.name ?? uuid;
          }),
        toolProficiency: toolLabel(state.selections.background?.grants.toolProficiency ?? null),
        originFeatName: state.selections.originFeat?.name ?? state.selections.background?.grants.originFeatName ?? null,
        languages: [
          ...fixedLanguages,
          ...(state.selections.background?.languages.chosen ?? []).map(languageLabel),
          ...(state.selections.speciesChoices?.chosenLanguages ?? []).map(languageLabel),
        ],
        fixedLanguages,
        selectedGrantGroups: buildOriginSelectedGrantGroups(state),
        speciesTraits: state.selections.species?.traits ?? [],
      };
    },
  };
}
