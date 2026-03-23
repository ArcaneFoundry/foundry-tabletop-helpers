import type { StepStatus, WizardState } from "../../character-creator-types";
import type {
  ClassAggregatePresentationStatus,
  ClassAggregateStepperModel,
} from "./build-class-aggregate-stepper-model";
import { getClassPresentation } from "../steps/class/class-presentation";

const BUILD_STEP_IDS = [
  "abilities",
  "feats",
  "equipment",
  "equipmentShop",
  "spells",
] as const;

const BUILD_GROUP_STEP_IDS = new Set(BUILD_STEP_IDS);

const BUILD_SUBSTEP_LABELS: Record<string, string> = {
  abilities: "Abilities",
  feats: "Feats",
  equipment: "Equipment",
  equipmentShop: "Shop",
  spells: "Spells",
};

function isBuildStepId(stepId: string): stepId is typeof BUILD_STEP_IDS[number] {
  return BUILD_GROUP_STEP_IDS.has(stepId as typeof BUILD_STEP_IDS[number]);
}

function mapStepStatus(status: StepStatus, active: boolean): ClassAggregatePresentationStatus {
  if (active) return "in-progress";
  if (status === "complete") return "complete";
  return "pending";
}

function getStepStatus(
  steps: Array<{ id: string; status: StepStatus }>,
  stepId: string,
): StepStatus {
  return steps.find((step) => step.id === stepId)?.status ?? "pending";
}

export function buildBuildAggregateStepperModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassAggregateStepperModel {
  const classPresentation = getClassPresentation(state.selections.class?.identifier, state.selections.class?.name);
  const buildSteps = steps.filter((step) => isBuildStepId(step.id));
  const onBuildStep = isBuildStepId(currentStepId);
  const buildComplete = buildSteps.length > 0 && buildSteps.every((step) => step.status === "complete");
  const originsComplete = getStepStatus(steps, "originSummary") === "complete";
  const finalizeActive = currentStepId === "portrait" || currentStepId === "review";
  const finalizeReady = buildComplete || getStepStatus(steps, "spells") === "complete";

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
        id: "origins",
        label: "Origins",
        icon: "fa-solid fa-scroll",
        active: false,
        status: originsComplete || onBuildStep || finalizeActive ? "complete" : "pending",
      },
      {
        id: "build",
        label: "Build",
        icon: "fa-solid fa-hammer",
        active: onBuildStep,
        status: onBuildStep
          ? "in-progress"
          : buildComplete
            ? "complete"
            : originsComplete
              ? "selection-active"
              : "pending",
      },
      {
        id: "finalize",
        label: "Finalize",
        icon: "fa-solid fa-stars",
        active: finalizeActive,
        status: finalizeActive
          ? "in-progress"
          : finalizeReady
            ? "selection-active"
            : "pending",
      },
    ],
    substeps: buildSteps.map((step) => ({
      id: step.id,
      label: BUILD_SUBSTEP_LABELS[step.id] ?? step.label,
      icon: step.icon,
      active: step.id === currentStepId,
      status: mapStepStatus(step.status, step.id === currentStepId),
    })),
    showSubsteps: onBuildStep,
  };
}

export function isBuildGroupStep(stepId: string): boolean {
  return isBuildStepId(stepId);
}

export function getBuildStepIds(): string[] {
  return [...BUILD_STEP_IDS];
}
