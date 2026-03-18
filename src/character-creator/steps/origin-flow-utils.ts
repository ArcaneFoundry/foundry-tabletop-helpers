import type { WizardState } from "../character-creator-types";

export function getTotalLanguageChoiceCount(state: WizardState): number {
  const bgCount = state.selections.background?.grants?.languageChoiceCount ?? 0;
  const speciesCount = state.selections.species?.languageChoiceCount ?? 0;
  return bgCount + speciesCount;
}

export function getAllFixedLanguages(state: WizardState): string[] {
  const bgFixed = state.selections.background?.grants?.languageGrants ?? [];
  const speciesFixed = state.selections.species?.languageGrants ?? [];
  return [...new Set([...bgFixed, ...speciesFixed])];
}
