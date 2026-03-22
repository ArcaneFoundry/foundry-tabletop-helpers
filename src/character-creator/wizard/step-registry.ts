/**
 * Character Creator — Step Registry
 *
 * Central registry for wizard step definitions.
 * Steps register themselves during module init; the wizard
 * consumes them in canonical order.
 */

import { MOD } from "../../logger";
import type { WizardStepDefinition, WizardState } from "../character-creator-types";
import { createAbilitiesStep } from "../steps/step-abilities";
import { createSpeciesStep } from "../steps/step-species";
import { createBackgroundStep } from "../steps/step-background";
import { createBackgroundAsiStep } from "../steps/step-background-asi";
import { createBackgroundLanguagesStep } from "../steps/step-background-languages";
import { createClassStep } from "../steps/step-class";
import { createClassChoicesStep } from "../steps/step-class-choices";
import {
  createClassExpertiseStep,
  createClassItemChoicesStep,
  createClassLanguagesStep,
  createClassToolsStep,
} from "../steps/step-class-advancements";
import { createClassSummaryStep } from "../steps/step-class-summary";
import { createWeaponMasteriesStep } from "../steps/step-weapon-masteries";
import { createOriginChoicesStep } from "../steps/step-origin-choices";
import { createSubclassStep } from "../steps/step-subclass";
import {
  createSpeciesItemChoicesStep,
  createSpeciesLanguagesStep,
  createSpeciesSkillsStep,
} from "../steps/step-species-advancements";
import { createOriginSummaryStep } from "../steps/step-origin-summary";
import { createFeatsStep } from "../steps/step-feats";
import { createSpellsStep } from "../steps/step-spells";
import { createEquipmentStep } from "../steps/step-equipment";
import { createPortraitStep } from "../steps/step-portrait";
import { createReviewStep } from "../steps/step-review";

/* ── Step Definitions ────────────────────────────────────── */

/** Canonical step order. Steps not in this list sort to the end. */
const STEP_ORDER = [
  "class",
  "classChoices",
  "classExpertise",
  "classLanguages",
  "classTools",
  "weaponMasteries",
  "classItemChoices",
  "classSummary",
  "subclass",
  "background",
  "backgroundAsi",
  "backgroundLanguages",
  "originChoices",
  "species",
  "speciesSkills",
  "speciesLanguages",
  "speciesItemChoices",
  "originSummary",
  "abilities",
  "feats",
  "equipment",
  "spells",
  "portrait",
  "review",
];

/** All registered step definitions. */
const _steps: WizardStepDefinition[] = [];

/* ── Public API ──────────────────────────────────────────── */

/**
 * Register a wizard step definition.
 * Call during module init for each step.
 */
export function registerStep(step: WizardStepDefinition): void {
  // Prevent duplicate registration
  const existing = _steps.findIndex((s) => s.id === step.id);
  if (existing >= 0) {
    _steps[existing] = step;
  } else {
    _steps.push(step);
  }
}

/**
 * Get all registered steps in canonical order.
 */
export function getOrderedSteps(): WizardStepDefinition[] {
  return [..._steps].sort((a, b) => {
    const ai = STEP_ORDER.indexOf(a.id);
    const bi = STEP_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/**
 * Get a step definition by ID.
 */
export function getStep(id: string): WizardStepDefinition | undefined {
  return _steps.find((s) => s.id === id);
}

/* ── Atmospheric Gradients ───────────────────────────────── */

/** Atmospheric gradient class per step (maps to CSS). */
const STEP_ATMOSPHERES: Record<string, string> = {
  class: "cc-atmosphere--forge",
  classChoices: "cc-atmosphere--forge",
  classExpertise: "cc-atmosphere--forge",
  classLanguages: "cc-atmosphere--forge",
  classTools: "cc-atmosphere--forge",
  classSummary: "cc-atmosphere--gold",
  subclass: "cc-atmosphere--forge",
  background: "cc-atmosphere--shadow",
  backgroundAsi: "cc-atmosphere--shadow",
  backgroundLanguages: "cc-atmosphere--shadow",
  originChoices: "cc-atmosphere--crimson",
  species: "cc-atmosphere--nature",
  speciesSkills: "cc-atmosphere--nature",
  speciesLanguages: "cc-atmosphere--nature",
  speciesItemChoices: "cc-atmosphere--nature",
  originSummary: "cc-atmosphere--gold",
  weaponMasteries: "cc-atmosphere--forge",
  classItemChoices: "cc-atmosphere--forge",
  abilities: "cc-atmosphere--arcane",
  feats: "cc-atmosphere--crimson",
  spells: "cc-atmosphere--arcane",
  equipment: "cc-atmosphere--forge",
  portrait: "cc-atmosphere--shadow",
  review: "cc-atmosphere--gold",
};

/** Get the atmospheric CSS class for a step. */
export function getStepAtmosphere(stepId: string): string {
  return STEP_ATMOSPHERES[stepId] ?? "cc-atmosphere--arcane";
}

/* ── Placeholder Step Factory ────────────────────────────── */

/**
 * Create a placeholder step definition.
 * Used for steps not yet implemented.
 */
export function createPlaceholderStep(
  id: string,
  label: string,
  icon: string,
  dependencies: string[] = [],
  isApplicable: (state: WizardState) => boolean = () => true,
): WizardStepDefinition {
  return {
    id,
    label,
    icon,
    templatePath: `modules/${MOD}/templates/character-creator/cc-step-placeholder.hbs`,
    dependencies,
    isApplicable,
    isComplete: () => true, // Placeholders are always "complete" for navigation
    buildViewModel: async (state) => ({
      stepId: id,
      stepLabel: label,
      stepIcon: icon,
      isPlaceholder: true,
      atmosphere: getStepAtmosphere(id),
      stepNumber: state.applicableSteps.indexOf(id) + 1,
      totalSteps: state.applicableSteps.length,
    }),
  };
}

/**
 * Register all wizard steps.
 * Phases 3 & 4 steps are fully implemented; portrait remains as placeholder.
 */
export function registerAllSteps(): void {
  registerStep(createClassStep());
  registerStep(createClassChoicesStep());
  registerStep(createClassExpertiseStep());
  registerStep(createClassLanguagesStep());
  registerStep(createClassToolsStep());
  registerStep(createClassItemChoicesStep());
  registerStep(createClassSummaryStep());
  registerStep(createSubclassStep());
  registerStep(createBackgroundStep());
  registerStep(createBackgroundAsiStep());
  registerStep(createBackgroundLanguagesStep());
  registerStep(createOriginChoicesStep());
  registerStep(createSpeciesStep());
  registerStep(createSpeciesSkillsStep());
  registerStep(createSpeciesLanguagesStep());
  registerStep(createSpeciesItemChoicesStep());
  registerStep(createOriginSummaryStep());
  registerStep(createWeaponMasteriesStep());
  registerStep(createAbilitiesStep());
  registerStep(createFeatsStep());
  registerStep(createSpellsStep());
  registerStep(createEquipmentStep());

  // Portrait (AI generation or manual upload)
  registerStep(createPortraitStep());

  // Review
  registerStep(createReviewStep());
}
