import { MOD } from "../../logger";
import type { AbilityKey, WizardState, WizardStepDefinition } from "../character-creator-types";

function calculateStartingHpPreview(state: WizardState): number {
  const hitDie = state.selections.class?.hitDie ?? "d8";
  const dieSize = Number.parseInt(hitDie.replace("d", ""), 10);
  const safeDieSize = Number.isNaN(dieSize) ? 8 : dieSize;
  const conScore = state.selections.abilities?.scores?.con ?? 10;
  const conMod = Math.floor((conScore - 10) / 2);
  return Math.max(1, safeDieSize + conMod);
}

function saveLabel(key: AbilityKey): string {
  return key.toUpperCase();
}

export function createClassSummaryStep(): WizardStepDefinition {
  return {
    id: "classSummary",
    label: "Class Summary",
    icon: "fa-solid fa-scroll",
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-summary.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      return !!state.selections.class?.uuid;
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const features = (classSelection?.classFeatures ?? []).map((feature) => ({
        title: feature.level ? `${feature.title} (Level ${feature.level})` : feature.title,
      }));

      return {
        className: classSelection?.name ?? "Class",
        hitDie: classSelection?.hitDie ?? "d8",
        startingHpPreview: calculateStartingHpPreview(state),
        usesAssignedCon: !!state.selections.abilities?.scores?.con,
        savingThrows: (classSelection?.savingThrowProficiencies ?? []).map(saveLabel),
        armorProficiencies: classSelection?.armorProficiencies ?? [],
        weaponProficiencies: classSelection?.weaponProficiencies ?? [],
        features,
        hasSavingThrows: (classSelection?.savingThrowProficiencies?.length ?? 0) > 0,
        hasArmorProficiencies: (classSelection?.armorProficiencies?.length ?? 0) > 0,
        hasWeaponProficiencies: (classSelection?.weaponProficiencies?.length ?? 0) > 0,
        hasFeatures: features.length > 0,
      };
    },
  };
}
