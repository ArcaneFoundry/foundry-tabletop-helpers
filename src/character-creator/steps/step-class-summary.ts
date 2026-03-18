import { MOD } from "../../logger";
import type { AbilityKey, WizardState, WizardStepDefinition } from "../character-creator-types";
import { SKILLS } from "../data/dnd5e-constants";

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

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function formatWeaponMasteryLabel(
  entry: { label?: string; mastery?: string } | string,
): string {
  if (typeof entry !== "string") {
    return entry.mastery ? `${entry.label ?? "Weapon"} (${entry.mastery})` : (entry.label ?? "Weapon");
  }

  return entry
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
        chosenSkills: (state.selections.skills?.chosen ?? []).map(skillLabel),
        chosenWeaponMasteries: (state.selections.classChoices?.chosenWeaponMasteryDetails ?? []).length > 0
          ? (state.selections.classChoices?.chosenWeaponMasteryDetails ?? []).map(formatWeaponMasteryLabel)
          : (state.selections.classChoices?.chosenWeaponMasteries ?? []).map(formatWeaponMasteryLabel),
        savingThrows: (classSelection?.savingThrowProficiencies ?? []).map(saveLabel),
        armorProficiencies: classSelection?.armorProficiencies ?? [],
        weaponProficiencies: classSelection?.weaponProficiencies ?? [],
        features,
        hasChosenSkills: (state.selections.skills?.chosen?.length ?? 0) > 0,
        hasChosenWeaponMasteries: (state.selections.classChoices?.chosenWeaponMasteries?.length ?? 0) > 0,
        hasSavingThrows: (classSelection?.savingThrowProficiencies?.length ?? 0) > 0,
        hasArmorProficiencies: (classSelection?.armorProficiencies?.length ?? 0) > 0,
        hasWeaponProficiencies: (classSelection?.weaponProficiencies?.length ?? 0) > 0,
        hasFeatures: features.length > 0,
      };
    },
  };
}
