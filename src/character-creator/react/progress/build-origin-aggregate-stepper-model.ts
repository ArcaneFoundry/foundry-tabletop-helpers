import type { StepStatus, WizardState } from "../../character-creator-types";
import type { ClassAggregatePresentationStatus, ClassAggregateStepperModel } from "./build-class-aggregate-stepper-model";
import { getClassPresentation } from "../steps/class/class-presentation";

const BACKGROUND_STEP_IDS = [
  "background",
  "backgroundAsi",
  "backgroundLanguages",
  "originChoices",
] as const;

const SPECIES_STEP_IDS = [
  "species",
  "speciesSkills",
  "speciesLanguages",
  "speciesItemChoices",
] as const;

const ORIGIN_GROUP_STEP_IDS = new Set([
  ...BACKGROUND_STEP_IDS,
  ...SPECIES_STEP_IDS,
  "originSummary",
]);

function getStepStatus(
  steps: Array<{ id: string; status: StepStatus; active: boolean }>,
  stepId: string,
): StepStatus {
  return steps.find((step) => step.id === stepId)?.status ?? "pending";
}

function mapStepStatus(
  status: StepStatus,
  active: boolean,
): ClassAggregatePresentationStatus {
  if (active) return "in-progress";
  if (status === "complete") return "complete";
  return "pending";
}

function isBackgroundStep(stepId: string): boolean {
  return BACKGROUND_STEP_IDS.includes(stepId as typeof BACKGROUND_STEP_IDS[number]);
}

function isSpeciesStep(stepId: string): boolean {
  return SPECIES_STEP_IDS.includes(stepId as typeof SPECIES_STEP_IDS[number]);
}

export function buildOriginAggregateStepperModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassAggregateStepperModel {
  const classPresentation = getClassPresentation(state.selections.class?.identifier, state.selections.class?.name);
  const backgroundSteps = steps.filter((step) => isBackgroundStep(step.id));
  const speciesSteps = steps.filter((step) => isSpeciesStep(step.id));
  const backgroundComplete = backgroundSteps.length > 0 && backgroundSteps.every((step) => step.status === "complete");
  const speciesComplete = speciesSteps.length > 0 && speciesSteps.every((step) => step.status === "complete");
  const onBackgroundStep = isBackgroundStep(currentStepId);
  const onSpeciesStep = isSpeciesStep(currentStepId);
  const hasBackground = Boolean(state.selections.background?.uuid);
  const hasSpecies = Boolean(state.selections.species?.uuid);

  return {
    milestones: [
      {
        id: "class",
        label: classPresentation.label,
        icon: classPresentation.icon,
        active: false,
        status: "complete",
      },
      {
        id: "background",
        label: "Background",
        icon: "fa-solid fa-scroll",
        active: onBackgroundStep,
        status: onBackgroundStep
          ? (hasBackground ? "in-progress" : "selection-active")
          : backgroundComplete
            ? "complete"
            : hasBackground
              ? "selection-active"
              : "pending",
      },
      {
        id: "species",
        label: "Species",
        icon: "fa-solid fa-dna",
        active: onSpeciesStep,
        status: !backgroundComplete && !onSpeciesStep
          ? "pending"
          : onSpeciesStep
            ? (hasSpecies ? "in-progress" : "selection-active")
            : speciesComplete
              ? "complete"
              : hasSpecies
                ? "selection-active"
                : backgroundComplete
                  ? "selection-active"
                  : "pending",
      },
      {
        id: "originSummary",
        label: "Summary",
        icon: "fa-solid fa-layer-group",
        active: currentStepId === "originSummary",
        status: currentStepId === "originSummary"
          ? "in-progress"
          : getStepStatus(steps, "originSummary") === "complete"
            ? "complete"
            : backgroundComplete && speciesComplete
              ? "selection-active"
              : "pending",
      },
    ],
    substeps: onSpeciesStep
      ? speciesSteps.map((step) => ({
        id: step.id,
        label: step.label,
        icon: step.icon,
        active: step.id === currentStepId,
        status: mapStepStatus(step.status, step.id === currentStepId),
      }))
      : backgroundSteps.map((step) => ({
        id: step.id,
        label: step.label,
        icon: step.icon,
        active: step.id === currentStepId,
        status: mapStepStatus(step.status, step.id === currentStepId),
      })),
    showSubsteps: ORIGIN_GROUP_STEP_IDS.has(currentStepId) && currentStepId !== "originSummary",
  };
}

export function isOriginGroupStep(stepId: string): boolean {
  return ORIGIN_GROUP_STEP_IDS.has(stepId);
}

export function getOriginBackgroundStepIds(): string[] {
  return [...BACKGROUND_STEP_IDS];
}

export function getOriginSpeciesStepIds(): string[] {
  return [...SPECIES_STEP_IDS];
}
