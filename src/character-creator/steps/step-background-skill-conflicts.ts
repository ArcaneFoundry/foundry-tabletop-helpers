import { MOD } from "../../logger";
import type { WizardState, WizardStepDefinition } from "../character-creator-types";

export function createBackgroundSkillConflictsStep(): WizardStepDefinition {
  return {
    id: "backgroundSkillConflicts",
    label: "Skill Conflicts",
    icon: "fa-solid fa-shuffle",
    renderMode: "react",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies: ["background", "class"],
    isApplicable: () => false,
    isComplete: () => true,
    getStatusHint: () => "",
    async buildViewModel(_state: WizardState): Promise<Record<string, unknown>> {
      return {
        stepId: "backgroundSkillConflicts",
        stepTitle: "Skill Conflicts",
        stepLabel: "Skill Conflicts",
        stepIcon: "fa-solid fa-shuffle",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--origin-flow",
        retired: true,
        note: "This conflict-resolution step has been retired because class skill options are now filtered against origin-granted proficiencies.",
      };
    },
  };
}
