import type { StepStatus, WizardState } from "../../character-creator-types";
import type {
  ClassAggregatePresentationStatus,
  ClassAggregateStepperModel,
} from "./build-class-aggregate-stepper-model";

const BUILD_STEP_IDS = [
  "abilities",
  "feats",
  "spells",
  "equipment",
  "equipmentShop",
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
  _state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassAggregateStepperModel {
  const buildSteps = steps.filter((step) => isBuildStepId(step.id));
  const onBuildStep = isBuildStepId(currentStepId);
  const buildComplete = buildSteps.length > 0 && buildSteps.every((step) => step.status === "complete");
  const abilitiesComplete = getStepStatus(steps, "abilities") === "complete";
  const spellsComplete = getStepStatus(steps, "spells") === "complete";
  const equipmentComplete = getStepStatus(steps, "equipment") === "complete" || getStepStatus(steps, "equipmentShop") === "complete";
  const loreActive = currentStepId === "portrait" || currentStepId === "review";
  const loreReady = buildComplete || equipmentComplete || spellsComplete;

  return {
    milestones: [
      {
        id: "abilities",
        label: "Abilities",
        icon: "fa-solid fa-dice-d20",
        active: currentStepId === "abilities",
        status: currentStepId === "abilities"
          ? "in-progress"
          : abilitiesComplete
            ? "complete"
            : "selection-active",
      },
      {
        id: "spells",
        label: "Spells",
        icon: "fa-solid fa-wand-sparkles",
        active: currentStepId === "spells",
        status: currentStepId === "spells"
          ? "in-progress"
          : spellsComplete
            ? "complete"
            : abilitiesComplete
              ? "selection-active"
              : "pending",
      },
      {
        id: "equipment",
        label: "Equipment",
        icon: "fa-solid fa-sack",
        active: currentStepId === "equipment" || currentStepId === "equipmentShop",
        status: (currentStepId === "equipment" || currentStepId === "equipmentShop")
          ? "in-progress"
          : equipmentComplete
            ? "complete"
            : spellsComplete
              ? "selection-active"
              : "pending",
      },
      {
        id: "lore",
        label: "Finalize",
        icon: "fa-solid fa-stars",
        active: loreActive,
        status: loreActive
          ? "in-progress"
          : loreReady
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
