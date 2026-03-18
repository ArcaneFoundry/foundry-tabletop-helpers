import { MOD } from "../../logger";
import type { WizardStepDefinition, WizardState } from "../character-creator-types";
import { SKILLS } from "../data/dnd5e-constants";

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

export function createClassChoicesStep(): WizardStepDefinition {
  return {
    id: "classChoices",
    label: "Class Choices",
    icon: "fa-solid fa-list-check",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-choices.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const skillPool = (classSelection?.skillPool ?? []).map((key) => ({
        key,
        label: skillLabel(key),
      }));

      return {
        className: classSelection?.name ?? "Class",
        skillCount: classSelection?.skillCount ?? 0,
        skillPool,
        hasSkillChoices: skillPool.length > 0,
        hasWeaponMastery: !!classSelection?.hasWeaponMastery,
        primaryAbilityHint: classSelection?.primaryAbilityHint ?? "",
        implementationNote:
          "Class-first skill commitment will move fully into this step once the background and origin flow is split in Phase 3.",
      };
    },
  };
}
