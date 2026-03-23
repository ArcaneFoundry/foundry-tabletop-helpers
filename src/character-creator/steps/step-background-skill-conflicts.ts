import { MOD } from "../../logger";
import type { WizardState, WizardStepDefinition } from "../character-creator-types";
import { SKILLS } from "../data/dnd5e-constants";
import {
  getBackgroundSkillConflictKeys,
  getBackgroundSkillConflictOptions,
  getBackgroundSkillConflictReplacementCount,
  getRequiredClassSkillCount,
  getRetainedClassSkillKeys,
} from "./origin-flow-utils";

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function getSelectedReplacementSkills(state: WizardState): string[] {
  const value = state.selections.backgroundSkillConflicts;
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function createBackgroundSkillConflictsStep(): WizardStepDefinition {
  return {
    id: "backgroundSkillConflicts",
    label: "Skill Conflicts",
    icon: "fa-solid fa-shuffle",
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["background", "class"],
    isApplicable: (state) =>
      !!state.selections.background?.uuid
      && !!state.selections.class?.uuid
      && (state.selections.skills?.chosen?.length ?? 0) > 0
      && getBackgroundSkillConflictReplacementCount(state) > 0,
    isComplete: (state) =>
      !!state.selections.background?.uuid
      && !!state.selections.class?.uuid
      && getBackgroundSkillConflictReplacementCount(state) === 0
      && (state.selections.skills?.chosen?.length ?? 0) >= getRequiredClassSkillCount(state),
    getStatusHint: (state) => {
      const remaining = getBackgroundSkillConflictReplacementCount(state);
      return remaining > 0 ? `Choose ${remaining} more replacement skill${remaining === 1 ? "" : "s"}` : "";
    },
    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const conflictingSkills = getBackgroundSkillConflictKeys(state);
      const selectedReplacementSkills = getSelectedReplacementSkills(state);
      const selectedReplacementSet = new Set(selectedReplacementSkills);
      const retainedSkills = getRetainedClassSkillKeys(state).filter((skill) => !selectedReplacementSet.has(skill));
      const replacementOptions = getBackgroundSkillConflictOptions(state);
      const replacementCount = getBackgroundSkillConflictReplacementCount(state);

      return {
        stepId: "backgroundSkillConflicts",
        stepTitle: "Resolve Skill Overlap",
        stepLabel: "Resolve Skill Overlap",
        stepIcon: "fa-solid fa-shuffle",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--origin-flow",
        className: state.selections.class?.name ?? "Class",
        backgroundName: state.selections.background?.name ?? "Background",
        conflictingSkills: conflictingSkills.map(skillLabel),
        retainedSkills: retainedSkills.map(skillLabel),
        selectedReplacementSkills: selectedReplacementSkills.map(skillLabel),
        fixedBackgroundSkills: (state.selections.background?.grants.skillProficiencies ?? []).map(skillLabel),
        replacementCount,
        requiredClassSkillCount: getRequiredClassSkillCount(state),
        replacementOptions,
      };
    },
  };
}
