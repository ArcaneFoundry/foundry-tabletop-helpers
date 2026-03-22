import { MOD } from "../../logger";
import type {
  AbilityKey,
  WizardState,
  WizardStepDefinition,
} from "../character-creator-types";
import { ABILITY_ABBREVS, SKILLS } from "../data/dnd5e-constants";
import { ClassChoicesStepScreen } from "../react/steps/class/class-choices-step-screen";

const SKILL_META: Record<string, { icon: string; description: string }> = {
  acr: { icon: "fa-person-running", description: "Balance, tumble, dive, and keep your footing when the battlefield turns treacherous." },
  ani: { icon: "fa-paw", description: "Read and calm beasts, mount up, or guide animals through danger." },
  arc: { icon: "fa-stars", description: "Recall magical lore, arcane traditions, and the hidden logic of spells." },
  ath: { icon: "fa-dumbbell", description: "Climb, jump, grapple, swim, and force your way through physical challenges." },
  dec: { icon: "fa-masks-theater", description: "Bluff, mislead, and sell the lie when words are your sharpest weapon." },
  his: { icon: "fa-landmark", description: "Recall legends, lineages, wars, and the long memory of the world." },
  ins: { icon: "fa-eye", description: "Read motives, catch falsehoods, and sense what others are trying to hide." },
  itm: { icon: "fa-bolt", description: "Project menace, force the issue, and make your presence impossible to ignore." },
  inv: { icon: "fa-magnifying-glass", description: "Piece together clues, examine details, and uncover what others missed." },
  med: { icon: "fa-staff-snake", description: "Diagnose wounds, stabilize the fallen, and understand the body under strain." },
  nat: { icon: "fa-leaf", description: "Recall the laws of the wild: terrain, plants, beasts, and natural phenomena." },
  prc: { icon: "fa-binoculars", description: "Spot danger, hear the hidden approach, and notice what the room is trying to conceal." },
  prf: { icon: "fa-music", description: "Command attention through song, dance, drama, and force of stage presence." },
  per: { icon: "fa-comments", description: "Charm, negotiate, inspire, and move others with conviction." },
  rel: { icon: "fa-book-bible", description: "Recall rites, deities, sacred histories, and the doctrines of faith." },
  slt: { icon: "fa-hand-sparkles", description: "Palm objects, slip tools into place, and work delicate tricks without notice." },
  ste: { icon: "fa-user-ninja", description: "Move in silence, melt into shadow, and strike without warning." },
  sur: { icon: "fa-compass", description: "Track, forage, navigate, and keep the party alive beyond the last road." },
};

function skillLabel(key: string): string {
  return SKILLS[key]?.label ?? key;
}

function getChosenSkills(state: WizardState): string[] {
  return state.selections.skills?.chosen ?? [];
}

function getAvailableSkillKeys(state: WizardState): string[] {
  return state.selections.class?.skillPool ?? [];
}

function getRequiredSkillCount(state: WizardState): number {
  return Math.min(state.selections.class?.skillCount ?? 0, getAvailableSkillKeys(state).length);
}

function abilityLabel(key: AbilityKey): string {
  return key.toUpperCase();
}

export function createClassChoicesStep(): WizardStepDefinition {
  return {
    id: "classChoices",
    label: "Class Skills",
    icon: "fa-solid fa-list-check",
    renderMode: "react",
    reactComponent: ClassChoicesStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-class-choices.hbs`,
    dependencies: ["class"],
    isApplicable: (state) => !!state.selections.class?.uuid,

    isComplete(state: WizardState): boolean {
      if (!state.selections.class?.uuid) return false;
      return getChosenSkills(state).length >= getRequiredSkillCount(state);
    },

    getStatusHint(state: WizardState): string {
      const chosenSkills = getChosenSkills(state).length;
      const requiredSkills = getRequiredSkillCount(state);
      if (chosenSkills < requiredSkills) {
        const remaining = requiredSkills - chosenSkills;
        return `Choose ${remaining} more class skill${remaining === 1 ? "" : "s"}`;
      }
      return "";
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      const classSelection = state.selections.class;
      const chosenSkills = new Set(getChosenSkills(state));
      const requiredSkillCount = getRequiredSkillCount(state);
      const skillPool = getAvailableSkillKeys(state).map((key) => ({
        key,
        label: skillLabel(key),
        abilityAbbrev: ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"],
        checked: chosenSkills.has(key),
        disabled: !chosenSkills.has(key) && chosenSkills.size >= requiredSkillCount,
        iconClass: SKILL_META[key]?.icon ?? "fa-book",
        tooltip: `${skillLabel(key)} (${ABILITY_ABBREVS[SKILLS[key]?.ability ?? "int"]}) — ${SKILL_META[key]?.description ?? "Class skill option."}`,
      }));

      return {
        stepId: "classChoices",
        stepTitle: "Class Skills",
        stepLabel: "Choose Your Skills",
        stepIcon: "fa-solid fa-list-check",
        stepDescription: "Choose the talents your class teaches from the outset.",
        hideStepIndicator: true,
        hideShellHeader: true,
        shellContentClass: "cc-step-content--class-choices",
        className: classSelection?.name ?? "Class",
        classIdentifier: classSelection?.identifier ?? "",
        primaryAbilityHint: classSelection?.primaryAbilityHint ?? "",
        savingThrows: (classSelection?.savingThrowProficiencies ?? []).map(abilityLabel),
        armorProficiencies: classSelection?.armorProficiencies ?? [],
        weaponProficiencies: classSelection?.weaponProficiencies ?? [],
        skillSection: {
          hasChoices: requiredSkillCount > 0,
          chosenCount: chosenSkills.size,
          maxCount: requiredSkillCount,
          selectedEntries: skillPool
            .filter((entry) => entry.checked)
            .map((entry) => ({
              label: entry.label,
              iconClass: entry.iconClass,
              tooltip: entry.tooltip,
              abilityAbbrev: entry.abilityAbbrev,
            })),
          options: skillPool,
          emptyMessage: "This class does not expose additional class skill choices.",
        },
      };
    },
  };
}
