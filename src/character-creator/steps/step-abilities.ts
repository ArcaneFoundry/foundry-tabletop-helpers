/**
 * Character Creator — Step 1: Ability Scores
 *
 * Three generation methods: 4d6 Drop Lowest, Point Buy, Standard Array.
 * All methods produce 6 ability scores assigned to STR/DEX/CON/INT/WIS/CHA.
 */

import { MOD } from "../../logger";
import type {
  WizardStepDefinition,
  WizardState,
} from "../character-creator-types";
import { AbilityScoresStepScreen } from "../react/steps/build/ability-scores-step-screen";
import {
  buildAbilitiesVM,
  getAbilityState,
  isAbilityStateComplete,
} from "./step-abilities-model";

export {
  buildAbilitiesVM,
  createAbilityStateForMethod,
  defaultAssignments,
  defaultScores,
  getAbilityState,
  isAbilityStateComplete,
  pointBuySpent,
  rollAllAbilities,
} from "./step-abilities-model";

/* ── Step Definition ─────────────────────────────────────── */

export function createAbilitiesStep(): WizardStepDefinition {
  return {
    id: "abilities",
    label: "Ability Scores",
    icon: "fa-solid fa-dice-d20",
    renderMode: "react",
    reactComponent: AbilityScoresStepScreen,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-abilities.hbs`,
    dependencies: [],
    isApplicable: () => true,

    isComplete(state: WizardState): boolean {
      return isAbilityStateComplete(state.selections.abilities);
    },

    async buildViewModel(state: WizardState): Promise<Record<string, unknown>> {
      if (!state.selections.abilities) {
        state.selections.abilities = getAbilityState(state);
      }
      return buildAbilitiesVM(state);
    },
  };
}
