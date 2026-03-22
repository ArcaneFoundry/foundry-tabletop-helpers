import type { StepStatus, WizardState } from "../../character-creator-types";

export type ClassAggregatePresentationStatus =
  | "pending"
  | "selection-active"
  | "in-progress"
  | "complete"
  | "collapsed-complete"
  | "skipped";

export interface ClassAggregateMilestoneNode {
  id: "class" | "selections" | "classSummary";
  label: string;
  icon: string;
  active: boolean;
  status: ClassAggregatePresentationStatus;
}

export interface ClassAggregateSubstepNode {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  status: ClassAggregatePresentationStatus;
}

export interface ClassAggregateStepperModel {
  milestones: ClassAggregateMilestoneNode[];
  substeps: ClassAggregateSubstepNode[];
  showSubsteps: boolean;
}

const CLASS_SELECTION_STEP_IDS = [
  "classChoices",
  "classExpertise",
  "classLanguages",
  "classTools",
  "weaponMasteries",
  "classItemChoices",
] as const;

const CLASS_GROUP_STEP_IDS = new Set([...CLASS_SELECTION_STEP_IDS, "class", "classSummary"]);

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

function isSelectionStep(stepId: string): boolean {
  return CLASS_SELECTION_STEP_IDS.includes(stepId as typeof CLASS_SELECTION_STEP_IDS[number]);
}

export function buildClassAggregateStepperModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassAggregateStepperModel {
  const hasSelectedClass = Boolean(state.selections.class?.uuid);
  const inClassGroup = CLASS_GROUP_STEP_IDS.has(currentStepId);
  const selectionSteps = steps.filter((step) => isSelectionStep(step.id));
  const selectionComplete = selectionSteps.every((step) => step.status === "complete");
  const onSelectionStep = isSelectionStep(currentStepId);

  const milestones: ClassAggregateMilestoneNode[] = [
    {
      id: "class",
      label: "Class",
      icon: "fa-solid fa-shield-halved",
      active: currentStepId === "class",
      status: !hasSelectedClass
        ? "pending"
        : currentStepId === "class"
          ? "selection-active"
          : "complete",
    },
    {
      id: "selections",
      label: "Selections",
      icon: "fa-solid fa-compass-drafting",
      active: onSelectionStep,
      status: !hasSelectedClass
        ? "pending"
        : onSelectionStep
          ? "in-progress"
          : selectionComplete
            ? "complete"
            : inClassGroup
              ? "in-progress"
              : "pending",
    },
    {
      id: "classSummary",
      label: "Summary",
      icon: "fa-solid fa-scroll",
      active: currentStepId === "classSummary",
      status: currentStepId === "classSummary"
        ? "in-progress"
        : getStepStatus(steps, "classSummary") === "complete"
          ? "complete"
          : selectionComplete && hasSelectedClass
            ? "selection-active"
            : "pending",
    },
  ];

  const substeps: ClassAggregateSubstepNode[] = selectionSteps.map((step) => ({
    id: step.id,
    label: step.label,
    icon: step.icon,
    active: step.id === currentStepId,
    status: mapStepStatus(step.status, step.id === currentStepId),
  }));

  return {
    milestones,
    substeps,
    showSubsteps: hasSelectedClass && (currentStepId === "class" || onSelectionStep),
  };
}

export function getClassSelectionStepIds(): string[] {
  return [...CLASS_SELECTION_STEP_IDS];
}

export function isClassGroupStep(stepId: string): boolean {
  return CLASS_GROUP_STEP_IDS.has(stepId);
}
