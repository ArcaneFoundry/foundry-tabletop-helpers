import { MOD } from "../../logger";
import type { SpeciesChoicesState, StepCallbacks, WizardState, WizardStepDefinition } from "../character-creator-types";
import { ABILITY_ABBREVS, LANGUAGE_LABELS, SKILLS, STANDARD_LANGUAGES } from "../data/dnd5e-constants";

function buildSpeciesChoicesState(state: WizardState): SpeciesChoicesState {
  const chosenLanguages = state.selections.speciesChoices?.chosenLanguages ?? [];
  const chosenSkills = state.selections.speciesChoices?.chosenSkills ?? [];
  const chosenItems = state.selections.speciesChoices?.chosenItems ?? {};
  const languageChoiceCount = state.selections.species?.languageChoiceCount ?? 0;
  const skillChoiceCount = state.selections.species?.skillChoiceCount ?? 0;
  const itemChoiceCount = (state.selections.species?.itemChoiceGroups ?? []).length;
  const speciesName = state.selections.species?.name ?? "this species";
  return {
    hasChoices: languageChoiceCount > 0 || skillChoiceCount > 0 || itemChoiceCount > 0,
    chosenLanguages,
    chosenSkills,
    chosenItems,
    note: languageChoiceCount > 0
      ? `Choose the additional grants provided by ${speciesName}.`
      : skillChoiceCount > 0
        ? `Choose ${skillChoiceCount} additional skill${skillChoiceCount === 1 ? "" : "s"} granted by ${speciesName}.`
        : itemChoiceCount > 0
          ? `Choose the additional ${speciesName} spell or item options.`
          : `No additional ${speciesName} selections are wired yet. Future work will land species-specific options here, such as Human bonus selections or Elf spell choices.`,
  };
}

function getRequiredSpeciesItemChoiceCount(state: WizardState): number {
  return (state.selections.species?.itemChoiceGroups ?? [])
    .reduce((sum, group) => sum + group.count, 0);
}

function getSpeciesChoiceValidationMessages(state: WizardState): string[] {
  const messages: string[] = [];
  const chosenSkills = state.selections.speciesChoices?.chosenSkills ?? [];
  const fixedSkills = new Set(state.selections.species?.skillGrants ?? []);
  const takenSkills = new Set([
    ...(state.selections.background?.grants.skillProficiencies ?? []),
    ...(state.selections.skills?.chosen ?? []),
    ...fixedSkills,
  ]);
  const availableSkillCount = (state.selections.species?.skillChoicePool ?? [])
    .filter((skill) => skill in SKILLS)
    .filter((skill) => chosenSkills.includes(skill) || !takenSkills.has(skill))
    .length;
  const requiredSkillCount = state.selections.species?.skillChoiceCount ?? 0;

  if (requiredSkillCount > 0 && availableSkillCount === 0) {
    messages.push("No legal species skill options remain after your background and class picks. Choose a different species, class, or background to continue.");
  } else if (availableSkillCount > 0 && availableSkillCount < requiredSkillCount) {
    messages.push(`Only ${availableSkillCount} legal species skill option${availableSkillCount === 1 ? "" : "s"} remain, but ${requiredSkillCount} selection${requiredSkillCount === 1 ? "" : "s"} are required.`);
  }

  for (const group of state.selections.species?.itemChoiceGroups ?? []) {
    if (group.options.length === 0) {
      messages.push(`${group.title} has no selectable options in the enabled compendium data.`);
      continue;
    }
    if (group.options.length < group.count) {
      messages.push(`${group.title} only exposes ${group.options.length} option${group.options.length === 1 ? "" : "s"}, but ${group.count} selection${group.count === 1 ? "" : "s"} are required.`);
    }
  }

  return messages;
}

interface SelectElementLike {
  dataset: DOMStringMap;
  value: string;
  addEventListener(event: string, handler: () => void): void;
  querySelectorAll<TElement extends Element>(selector: string): ArrayLike<TElement>;
}

function languageLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id;
}

function skillLabel(id: string): string {
  return SKILLS[id]?.label ?? id;
}

export function createSpeciesChoicesStep(): WizardStepDefinition {
  return {
    id: "speciesChoices",
    label: "Species Choices",
    icon: "fa-solid fa-wand-magic-sparkles",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-species-choices.hbs`,
    dependencies: ["species"],
    isApplicable: (state) => !!state.selections.species?.uuid,
    isComplete: (state) => {
      if (!state.selections.species?.uuid) return false;
      const neededLanguages = state.selections.species.languageChoiceCount ?? 0;
      const neededSkills = state.selections.species.skillChoiceCount ?? 0;
      const itemGroups = state.selections.species.itemChoiceGroups ?? [];
      const chosenItems = state.selections.speciesChoices?.chosenItems ?? {};
      return (state.selections.speciesChoices?.chosenLanguages?.length ?? 0) >= neededLanguages
        && (state.selections.speciesChoices?.chosenSkills?.length ?? 0) >= neededSkills
        && itemGroups.every((group) => (chosenItems[group.id]?.length ?? 0) >= group.count);
    },
    getStatusHint(state) {
      const validationMessages = getSpeciesChoiceValidationMessages(state);
      if (validationMessages.length > 0) return validationMessages[0];

      const neededLanguages = state.selections.species?.languageChoiceCount ?? 0;
      const chosenLanguages = state.selections.speciesChoices?.chosenLanguages?.length ?? 0;
      if (chosenLanguages < neededLanguages) {
        const remaining = neededLanguages - chosenLanguages;
        return `Choose ${remaining} more species language${remaining === 1 ? "" : "s"}`;
      }

      const neededSkills = state.selections.species?.skillChoiceCount ?? 0;
      const chosenSkills = state.selections.speciesChoices?.chosenSkills?.length ?? 0;
      if (chosenSkills < neededSkills) {
        const remaining = neededSkills - chosenSkills;
        return `Choose ${remaining} more species skill${remaining === 1 ? "" : "s"}`;
      }

      const itemGroups = state.selections.species?.itemChoiceGroups ?? [];
      for (const group of itemGroups) {
        const chosenCount = state.selections.speciesChoices?.chosenItems?.[group.id]?.length ?? 0;
        if (chosenCount < group.count) {
          const remaining = group.count - chosenCount;
          return `Choose ${remaining} more option${remaining === 1 ? "" : "s"} for ${group.title}`;
        }
      }

      return "";
    },
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const stepState = buildSpeciesChoicesState(state);
      const fixedLanguages = new Set(state.selections.species?.languageGrants ?? []);
      const chosenLanguages = state.selections.speciesChoices?.chosenLanguages ?? [];
      const chosenSkills = state.selections.speciesChoices?.chosenSkills ?? [];
      const languageChoiceCount = state.selections.species?.languageChoiceCount ?? 0;
      const fixedSkills = new Set(state.selections.species?.skillGrants ?? []);
      const takenSkills = new Set([
        ...(state.selections.background?.grants.skillProficiencies ?? []),
        ...(state.selections.skills?.chosen ?? []),
        ...fixedSkills,
      ]);
      const skillChoiceCount = state.selections.species?.skillChoiceCount ?? 0;
      const itemChoiceGroups = (state.selections.species?.itemChoiceGroups ?? []).map((group) => ({
        id: group.id,
        title: group.title,
        count: group.count,
        options: group.options.map((option) => ({
          ...option,
          selected: (state.selections.speciesChoices?.chosenItems?.[group.id] ?? []).includes(option.uuid),
          disabled: !(state.selections.speciesChoices?.chosenItems?.[group.id] ?? []).includes(option.uuid)
            && (state.selections.speciesChoices?.chosenItems?.[group.id] ?? []).length >= group.count,
        })),
        selectedCount: (state.selections.speciesChoices?.chosenItems?.[group.id] ?? []).length,
      }));
      const languageSlots = Array.from({ length: languageChoiceCount }, (_, index) => {
        const currentValue = chosenLanguages[index] ?? "";
        return {
          index,
          options: STANDARD_LANGUAGES
            .filter((language) => !fixedLanguages.has(language.id))
            .map((language) => ({
              id: language.id,
              label: language.label,
              selected: language.id === currentValue,
              disabled: language.id !== currentValue && chosenLanguages.includes(language.id),
            })),
        };
      });
      const availableSpeciesSkills = (state.selections.species?.skillChoicePool ?? [])
        .filter((skill) => skill in SKILLS)
        .filter((skill) => chosenSkills.includes(skill) || !takenSkills.has(skill))
        .map((skill) => ({
          key: skill,
          label: SKILLS[skill].label,
          abilityAbbrev: ABILITY_ABBREVS[SKILLS[skill].ability],
          checked: chosenSkills.includes(skill),
          disabled: !chosenSkills.includes(skill) && chosenSkills.length >= skillChoiceCount,
        }));

      return {
        speciesName: state.selections.species?.name ?? "Species",
        traits: state.selections.species?.traits ?? [],
        hasTraits: (state.selections.species?.traits?.length ?? 0) > 0,
        fixedLanguages: [...fixedLanguages].map(languageLabel),
        hasLanguageChoices: languageChoiceCount > 0,
        languageSlots,
        fixedSkills: [...fixedSkills].map(skillLabel),
        hasSkillChoices: skillChoiceCount > 0,
        skillChoiceCount,
        chosenSkillCount: chosenSkills.length,
        availableSpeciesSkills,
        hasAvailableSpeciesSkills: availableSpeciesSkills.length > 0,
        hasItemChoices: itemChoiceGroups.length > 0,
        requiredItemChoiceCount: getRequiredSpeciesItemChoiceCount(state),
        chosenItemChoiceCount: Object.values(state.selections.speciesChoices?.chosenItems ?? {})
          .reduce((sum, group) => sum + group.length, 0),
        itemChoiceGroups,
        itemChoiceEmptyMessage: "This species grants extra spell or item picks, but no selectable options were found in the enabled compendium data.",
        validationMessages: getSpeciesChoiceValidationMessages(state),
        ...stepState,
      };
    },
    onActivate(state: WizardState, el: HTMLElement, callbacks: StepCallbacks): void {
      getSkillCheckboxes(el).forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const key = checkbox.dataset.speciesSkill;
          if (!key) return;
          const chosen = new Set(state.selections.speciesChoices?.chosenSkills ?? []);
          const limit = state.selections.species?.skillChoiceCount ?? 0;
          if (checkbox.checked) {
            if (chosen.size >= limit) {
              checkbox.checked = false;
              return;
            }
            chosen.add(key);
          } else {
            chosen.delete(key);
          }

          state.selections.speciesChoices = {
            ...buildSpeciesChoicesState(state),
            chosenSkills: [...chosen],
            chosenLanguages: state.selections.speciesChoices?.chosenLanguages ?? [],
          };
          patchSkillDisableState(el, [...chosen], limit);
          callbacks.setDataSilent(state.selections.speciesChoices);
        });
      });

      getLanguageSelects(el).forEach((select) => {
        select.addEventListener("change", () => {
          const chosenLanguages = getLanguageSelects(el)
            .map((langSelect) => langSelect.value)
            .filter((value) => value.trim().length > 0);
          state.selections.speciesChoices = {
            ...buildSpeciesChoicesState(state),
            chosenSkills: state.selections.speciesChoices?.chosenSkills ?? [],
            chosenLanguages,
            chosenItems: state.selections.speciesChoices?.chosenItems ?? {},
          };
          patchLanguageDisableState(el, chosenLanguages);
          callbacks.setDataSilent(state.selections.speciesChoices);
        });
      });

      getItemChoiceElements(el).forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const groupId = checkbox.dataset.speciesChoiceGroup;
          const uuid = checkbox.dataset.speciesChoiceUuid;
          if (!groupId || !uuid) return;

          const currentGroups = {
            ...(state.selections.speciesChoices?.chosenItems ?? {}),
          };
          const current = new Set(currentGroups[groupId] ?? []);
          const group = (state.selections.species?.itemChoiceGroups ?? [])
            .find((candidate) => candidate.id === groupId);
          const limit = group?.count ?? 1;
          if (checkbox.checked) {
            if (current.size >= limit) {
              checkbox.checked = false;
              return;
            }
            current.add(uuid);
          } else {
            current.delete(uuid);
          }
          currentGroups[groupId] = [...current];

          state.selections.speciesChoices = {
            ...buildSpeciesChoicesState(state),
            chosenSkills: state.selections.speciesChoices?.chosenSkills ?? [],
            chosenLanguages: state.selections.speciesChoices?.chosenLanguages ?? [],
            chosenItems: currentGroups,
          };
          patchItemChoiceState(el, groupId, [...current], limit);
          callbacks.setDataSilent(state.selections.speciesChoices);
        });
      });

      if (!state.selections.speciesChoices) {
        state.selections.speciesChoices = buildSpeciesChoicesState(state);
      }
      callbacks.setDataSilent(state.selections.speciesChoices);
    },
  };
}

function getLanguageSelects(root: ParentNode): SelectElementLike[] {
  return Array.from(root.querySelectorAll("[data-species-lang-slot]"))
    .filter((value) => typeof value === "object" && value !== null && "dataset" in value && "value" in value)
    .map((value) => value as unknown as SelectElementLike);
}

function patchLanguageDisableState(el: HTMLElement, chosenValues: string[]): void {
  const chosenSet = new Set(chosenValues);
  getLanguageSelects(el).forEach((select) => {
    const currentValue = select.value;
    Array.from(select.querySelectorAll<HTMLOptionElement>("option")).forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }
      option.disabled = option.value !== currentValue && chosenSet.has(option.value);
    });
  });
}

interface SkillCheckboxLike {
  dataset: DOMStringMap;
  checked: boolean;
  disabled: boolean;
  addEventListener(event: string, handler: () => void): void;
}

function getSkillCheckboxes(root: ParentNode): SkillCheckboxLike[] {
  return Array.from(root.querySelectorAll("[data-species-skill]"))
    .filter((value) => typeof value === "object" && value !== null && "dataset" in value && "checked" in value)
    .map((value) => value as unknown as SkillCheckboxLike);
}

function patchSkillDisableState(el: HTMLElement, chosenValues: string[], limit: number): void {
  const chosenSet = new Set(chosenValues);
  const atMax = chosenValues.length >= limit;
  getSkillCheckboxes(el).forEach((checkbox) => {
    const key = checkbox.dataset.speciesSkill;
    if (!key) return;
    checkbox.checked = chosenSet.has(key);
    checkbox.disabled = !chosenSet.has(key) && atMax;
  });
}

interface ItemChoiceLike {
  dataset: DOMStringMap;
  checked: boolean;
  disabled: boolean;
  addEventListener(event: string, handler: () => void): void;
}

function getItemChoiceElements(root: ParentNode): ItemChoiceLike[] {
  return Array.from(root.querySelectorAll("[data-species-choice-uuid]"))
    .filter((value) => typeof value === "object" && value !== null && "dataset" in value && "checked" in value)
    .map((value) => value as unknown as ItemChoiceLike);
}

function patchItemChoiceState(
  el: HTMLElement,
  groupId: string,
  selectedUuids: string[],
  limit: number,
): void {
  const selectedSet = new Set(selectedUuids);
  const atMax = selectedSet.size >= limit;
  getItemChoiceElements(el).forEach((checkbox) => {
    if (checkbox.dataset.speciesChoiceGroup !== groupId) return;
    const optionUuid = checkbox.dataset.speciesChoiceUuid;
    if (!optionUuid) return;
    checkbox.checked = selectedSet.has(optionUuid);
    checkbox.disabled = !selectedSet.has(optionUuid) && atMax;
  });
}
