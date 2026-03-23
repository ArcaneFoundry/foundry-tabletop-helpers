import type {
  OriginAdvancementRequirement,
  OriginAdvancementRequirementType,
  SpeciesChoicesState,
  WizardState,
} from "../character-creator-types";
import { ABILITY_ABBREVS, LANGUAGE_LABELS, SKILLS, STANDARD_LANGUAGES } from "../data/dnd5e-constants";
import { isSelectableLanguageId, languageLabel, normalizeLanguageId, toolLabel } from "./class-advancement-utils";

type LabeledOption = {
  id: string;
  label: string;
};

export function getRequiredClassSkillCount(state: WizardState): number {
  return Math.min(state.selections.class?.skillCount ?? 0, state.selections.class?.skillPool?.length ?? 0);
}

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

export function getOriginAdvancementRequirements(
  state: WizardState,
  source: "background" | "species",
  type?: OriginAdvancementRequirementType,
): OriginAdvancementRequirement[] {
  const requirements = source === "background"
    ? (state.selections.background?.advancementRequirements ?? [])
    : (state.selections.species?.advancementRequirements ?? []);
  return type ? requirements.filter((requirement) => requirement.type === type) : requirements;
}

export function getOriginRequirementCount(
  state: WizardState,
  source: "background" | "species",
  type: OriginAdvancementRequirementType,
): number {
  return getOriginAdvancementRequirements(state, source, type)
    .reduce((sum, requirement) => sum + requirement.requiredCount, 0);
}

export function buildEmptySpeciesChoicesState(state: WizardState): SpeciesChoicesState {
  const speciesName = state.selections.species?.name ?? "this species";
  const hasSkillChoices = getOriginRequirementCount(state, "species", "skills") > 0;
  const hasLanguageChoices = getOriginRequirementCount(state, "species", "languages") > 0;
  const hasItemChoices = getOriginRequirementCount(state, "species", "itemChoices") > 0;

  return {
    hasChoices: hasSkillChoices || hasLanguageChoices || hasItemChoices,
    chosenLanguages: state.selections.speciesChoices?.chosenLanguages ?? [],
    chosenSkills: state.selections.speciesChoices?.chosenSkills ?? [],
    chosenItems: state.selections.speciesChoices?.chosenItems ?? {},
    note: hasSkillChoices || hasLanguageChoices || hasItemChoices
      ? `Choose the additional grants provided by ${speciesName}.`
      : `No additional ${speciesName} selections are currently required.`,
  };
}

export function getKnownOriginSkillKeys(state: WizardState): Set<string> {
  return new Set([
    ...(state.selections.background?.grants.skillProficiencies ?? []),
    ...(state.selections.skills?.chosen ?? []),
    ...(state.selections.species?.skillGrants ?? []),
    ...(state.selections.speciesChoices?.chosenSkills ?? []),
  ]);
}

export function getBackgroundSkillConflictKeys(state: WizardState): string[] {
  const backgroundSkills = new Set(state.selections.background?.grants.skillProficiencies ?? []);
  return (state.selections.skills?.chosen ?? []).filter((skill) => backgroundSkills.has(skill));
}

export function getRetainedClassSkillKeys(state: WizardState): string[] {
  const conflictKeys = new Set(getBackgroundSkillConflictKeys(state));
  return (state.selections.skills?.chosen ?? []).filter((skill) => !conflictKeys.has(skill));
}

export function getBackgroundSkillConflictReplacementCount(state: WizardState): number {
  const requiredClassSkillCount = getRequiredClassSkillCount(state);
  const retainedCount = getRetainedClassSkillKeys(state).length;
  return Math.max(0, requiredClassSkillCount - retainedCount);
}

export function getBackgroundSkillConflictOptions(state: WizardState): Array<{
  id: string;
  label: string;
  abilityAbbrev: string;
}> {
  const retained = new Set(getRetainedClassSkillKeys(state));
  const backgroundSkills = new Set(state.selections.background?.grants.skillProficiencies ?? []);
  const otherKnown = new Set([
    ...(state.selections.species?.skillGrants ?? []),
    ...(state.selections.speciesChoices?.chosenSkills ?? []),
  ]);

  return dedupeLabeledOptions(
    (state.selections.class?.skillPool ?? [])
      .filter((skill) => !backgroundSkills.has(skill))
      .filter((skill) => !retained.has(skill))
      .filter((skill) => !otherKnown.has(skill))
      .filter((skill) => skill in SKILLS)
      .map((skill) => ({
        id: skill,
        label: SKILLS[skill]?.label ?? skill,
      })),
  )
    .map((entry) => ({
      ...entry,
      abilityAbbrev: ABILITY_ABBREVS[SKILLS[entry.id]?.ability ?? "int"],
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function applyBackgroundSkillConflictSelections(state: WizardState, selectedReplacementSkills: string[]): string[] {
  const retainedSkills = getRetainedClassSkillKeys(state);
  const nextChosenSkills = [...retainedSkills, ...selectedReplacementSkills];
  state.selections.skills = { chosen: nextChosenSkills };
  return nextChosenSkills;
}

export function getBackgroundLanguageOptions(state: WizardState): LabeledOption[] {
  const known = new Set([
    ...(state.selections.background?.languages.fixed ?? []),
    ...(state.selections.background?.languages.chosen ?? []),
    ...(state.selections.species?.languageGrants ?? []),
    ...(state.selections.speciesChoices?.chosenLanguages ?? []),
  ]);

  return dedupeLabeledOptions(
    STANDARD_LANGUAGES
      .filter((language) => isSelectableLanguageId(language.id))
      .map((language) => ({ id: language.id, label: language.label })),
  )
    .filter((entry) => !known.has(entry.id))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getSpeciesLanguageOptions(state: WizardState): LabeledOption[] {
  const fixedLanguages = new Set(state.selections.species?.languageGrants ?? []);
  const chosenLanguages = new Set(state.selections.speciesChoices?.chosenLanguages ?? []);

  return dedupeLabeledOptions(
    STANDARD_LANGUAGES
      .filter((language) => isSelectableLanguageId(language.id))
      .map((language) => ({ id: language.id, label: language.label })),
  )
    .filter((entry) => !fixedLanguages.has(entry.id))
    .filter((entry) => !chosenLanguages.has(entry.id))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getAvailableSpeciesSkillOptions(state: WizardState): Array<{
  id: string;
  label: string;
  abilityAbbrev: string;
}> {
  const chosen = new Set(state.selections.speciesChoices?.chosenSkills ?? []);
  const taken = getKnownOriginSkillKeys(state);
  const requirements = getOriginAdvancementRequirements(state, "species", "skills");
  const pool = requirements.flatMap((requirement) => requirement.pool)
    .map((entry) => entry.replace(/^skills:/u, ""))
    .flatMap((entry) => entry === "*" ? Object.keys(SKILLS) : [entry])
    .filter((entry) => entry in SKILLS);

  return dedupeLabeledOptions(
    pool
      .filter((entry) => chosen.has(entry) || !taken.has(entry))
      .map((entry) => ({ id: entry, label: SKILLS[entry]?.label ?? entry })),
  )
    .map((entry) => ({
      ...entry,
      abilityAbbrev: ABILITY_ABBREVS[SKILLS[entry.id]?.ability ?? "int"],
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getAvailableSpeciesSkillCount(state: WizardState): number {
  return getAvailableSpeciesSkillOptions(state).length;
}

export function getRequiredSpeciesSkillChoiceCount(state: WizardState): number {
  return Math.min(getOriginRequirementCount(state, "species", "skills"), getAvailableSpeciesSkillCount(state));
}

export function getRequiredSpeciesLanguageChoiceCount(state: WizardState): number {
  return getOriginRequirementCount(state, "species", "languages");
}

export function getRequiredSpeciesItemChoiceCount(state: WizardState): number {
  return getOriginAdvancementRequirements(state, "species", "itemChoices")
    .reduce((sum, requirement) => sum + Math.min(requirement.requiredCount, requirement.itemChoices?.length ?? 0), 0);
}

export function getSpeciesChoiceValidationMessages(state: WizardState): string[] {
  const messages: string[] = [];
  const availableSkillCount = getAvailableSpeciesSkillCount(state);
  const requiredSkillCount = getOriginRequirementCount(state, "species", "skills");

  if (requiredSkillCount > 0 && availableSkillCount === 0) {
    messages.push("No legal species skill options remain after your background and class picks, so this step will no longer block progression.");
  } else if (availableSkillCount > 0 && availableSkillCount < requiredSkillCount) {
    messages.push(`Only ${availableSkillCount} legal species skill option${availableSkillCount === 1 ? "" : "s"} remain, so this step will accept fewer picks than the species normally grants.`);
  }

  for (const requirement of getOriginAdvancementRequirements(state, "species", "itemChoices")) {
    const optionCount = requirement.itemChoices?.length ?? 0;
    if (optionCount === 0) {
      messages.push(`${requirement.title} has no selectable options in the enabled compendium data, so it will not block progression.`);
      continue;
    }
    if (optionCount < requirement.requiredCount) {
      messages.push(`${requirement.title} only exposes ${optionCount} option${optionCount === 1 ? "" : "s"}, so this step will accept the available selections.`);
    }
  }

  return messages;
}

export function getBackgroundLanguageChoiceTitle(state: WizardState): string {
  return getOriginAdvancementRequirements(state, "background", "languages")[0]?.title ?? "Choose Languages";
}

export function getSpeciesRequirementTitle(
  state: WizardState,
  type: OriginAdvancementRequirementType,
  fallback: string,
): string {
  return getOriginAdvancementRequirements(state, "species", type)[0]?.title ?? fallback;
}

export function getSpeciesItemChoiceRequirements(state: WizardState) {
  const chosenItems = state.selections.speciesChoices?.chosenItems ?? {};
  return getOriginAdvancementRequirements(state, "species", "itemChoices").map((requirement) => ({
    ...requirement,
    itemChoices: requirement.itemChoices ?? [],
    selectedIds: chosenItems[requirement.id] ?? [],
  }));
}

export function buildOriginSelectedGrantGroups(state: WizardState): Array<{
  id: string;
  title: string;
  iconClass: string;
  entries: string[];
  source: "background" | "species";
}> {
  const groups: Array<{
    id: string;
    title: string;
    iconClass: string;
    entries: string[];
    source: "background" | "species";
  }> = [];
  const background = state.selections.background;
  const species = state.selections.species;
  const speciesChoices: SpeciesChoicesState = state.selections.speciesChoices ?? {
    hasChoices: false,
    chosenLanguages: [],
    chosenSkills: [],
    chosenItems: {},
  };

  if ((background?.grants.skillProficiencies.length ?? 0) > 0 || background?.grants.toolProficiency) {
    groups.push({
      id: "background-proficiencies",
      title: "Background Proficiencies",
      iconClass: "fa-solid fa-scroll",
      entries: [
        ...(background?.grants.skillProficiencies ?? []).map((entry) => SKILLS[entry]?.label ?? entry),
        ...(background?.grants.toolProficiency ? [toolLabel(background.grants.toolProficiency)] : []),
      ],
      source: "background",
    });
  }

  if (background?.grants.toolProficiency) {
    const backgroundProficiencies = groups.find((group) => group.id === "background-proficiencies");
    if (backgroundProficiencies) {
      backgroundProficiencies.entries = [
        ...(background?.grants.skillProficiencies ?? []).map((entry) => SKILLS[entry]?.label ?? entry),
        toolLabel(background.grants.toolProficiency),
      ];
    }
  }

  const backgroundLanguageRequirements = getOriginAdvancementRequirements(state, "background", "languages");
  let backgroundLanguageIndex = 0;
  for (const requirement of backgroundLanguageRequirements) {
    const entries = (background?.languages.chosen ?? [])
      .slice(backgroundLanguageIndex, backgroundLanguageIndex + requirement.requiredCount)
      .map(languageLabel);
    backgroundLanguageIndex += requirement.requiredCount;
    if (entries.length > 0) {
      groups.push({
        id: requirement.id,
        title: requirement.title,
        iconClass: "fa-solid fa-language",
        entries,
        source: "background",
      });
    }
  }

  if (background?.uuid && (state.selections.originFeat?.name ?? background.grants.originFeatName)) {
    groups.push({
      id: "background-origin-feat",
      title: "Background Feat",
      iconClass: "fa-solid fa-stars",
      entries: [state.selections.originFeat?.name ?? background.grants.originFeatName ?? "Origin Feat"],
      source: "background",
    });
  }

  if ((species?.traits?.length ?? 0) > 0) {
    groups.push({
      id: "species-traits",
      title: "Species Traits",
      iconClass: "fa-solid fa-dna",
      entries: species?.traits ?? [],
      source: "species",
    });
  }

  let speciesSkillIndex = 0;
  let speciesLanguageIndex = 0;
  for (const requirement of getOriginAdvancementRequirements(state, "species")) {
    let entries: string[] = [];
    if (requirement.type === "skills") {
      entries = (speciesChoices.chosenSkills ?? [])
        .slice(speciesSkillIndex, speciesSkillIndex + requirement.requiredCount)
        .map((entry) => SKILLS[entry]?.label ?? entry);
      speciesSkillIndex += requirement.requiredCount;
    } else if (requirement.type === "languages") {
      entries = (speciesChoices.chosenLanguages ?? [])
        .slice(speciesLanguageIndex, speciesLanguageIndex + requirement.requiredCount)
        .map(languageLabel);
      speciesLanguageIndex += requirement.requiredCount;
    } else if (requirement.type === "itemChoices") {
      const selectedIds = new Set(speciesChoices.chosenItems?.[requirement.id] ?? []);
      entries = (requirement.itemChoices ?? [])
        .filter((option) => selectedIds.has(option.uuid))
        .map((option) => option.name);
    }

    if (entries.length === 0) continue;
    groups.push({
      id: requirement.id,
      title: requirement.title,
      iconClass: requirement.type === "itemChoices"
        ? "fa-solid fa-hand-sparkles"
        : requirement.type === "languages"
          ? "fa-solid fa-language"
          : "fa-solid fa-list-check",
      entries,
      source: "species",
    });
  }
  return groups.filter((group) => group.entries.length > 0);
}

export function getOriginLanguageLabel(id: string): string {
  return LANGUAGE_LABELS[normalizeLanguageId(id)] ?? languageLabel(id);
}

function dedupeLabeledOptions(entries: LabeledOption[]): LabeledOption[] {
  const map = new Map<string, LabeledOption>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return [...map.values()];
}
