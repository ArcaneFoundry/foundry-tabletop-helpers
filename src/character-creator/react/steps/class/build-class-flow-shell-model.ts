import type { ClassSelection, StepStatus, WizardState } from "../../../character-creator-types";
import {
  buildClassAggregateStepperModel,
  type ClassAggregatePresentationStatus,
  type ClassAggregateStepperModel,
  getClassSelectionStepIds,
} from "../../progress/build-class-aggregate-stepper-model";

export type ClassFlowPaneId =
  | "class"
  | "classChoices"
  | "classExpertise"
  | "classLanguages"
  | "classTools"
  | "weaponMasteries"
  | "classItemChoices"
  | "classSummary";
export type ClassFlowHeaderTone = "default" | "accent";

export interface ClassFlowShellModel {
  currentPane: ClassFlowPaneId;
  title: string;
  headerTone: ClassFlowHeaderTone;
  selectedClassIdentifier: string | null;
  aggregateStepper: ClassAggregateStepperModel;
}

function getStepStatus(
  steps: Array<{ id: string; status: StepStatus }>,
  stepId: string,
): StepStatus {
  return steps.find((step) => step.id === stepId)?.status ?? "pending";
}

function isAccentStatus(status: ClassAggregatePresentationStatus): boolean {
  return status === "selection-active" || status === "in-progress" || status === "complete";
}

function getCurrentPane(currentStepId: string): ClassFlowPaneId {
  switch (currentStepId) {
    case "classChoices":
    case "classExpertise":
    case "classLanguages":
    case "classTools":
    case "weaponMasteries":
    case "classItemChoices":
    case "classSummary":
      return currentStepId;
    default:
      return "class";
  }
}

function getPaneTitle(currentPane: ClassFlowPaneId): string {
  switch (currentPane) {
    case "classChoices":
      return "Choose Your Skills";
    case "classExpertise":
      return "Choose Your Expertise";
    case "classLanguages":
      return "Choose Your Languages";
    case "classTools":
      return "Choose Your Tools";
    case "weaponMasteries":
      return "Choose Your Weapon Masteries";
    case "classItemChoices":
      return "Choose Your Class Options";
    case "classSummary":
      return "Class Summary";
    default:
      return "Choose Your Class";
  }
}

export function buildClassFlowShellModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassFlowShellModel {
  const currentPane = getCurrentPane(currentStepId);
  const aggregateStepper = buildClassAggregateStepperModel(state, steps, currentStepId);
  const classSelection = state.selections.class as ClassSelection | undefined;
  const selectionStepStatuses = getClassSelectionStepIds().map((stepId) => getStepStatus(steps, stepId));
  const anySelectionComplete = selectionStepStatuses.some((status) => status === "complete");
  const hasSelectedClass = Boolean(classSelection?.uuid);
  const classMilestone = aggregateStepper.milestones.find((milestone) => milestone.id === "class");
  const selectionsMilestone = aggregateStepper.milestones.find((milestone) => milestone.id === "selections");

  let headerTone: ClassFlowHeaderTone = "default";
  if (
    hasSelectedClass
    && (isAccentStatus(classMilestone?.status ?? "pending")
      || isAccentStatus(selectionsMilestone?.status ?? "pending")
      || anySelectionComplete)
  ) {
    headerTone = "accent";
  }

  return {
    currentPane,
    title: getPaneTitle(currentPane),
    headerTone,
    selectedClassIdentifier: classSelection?.identifier ?? null,
    aggregateStepper,
  };
}
