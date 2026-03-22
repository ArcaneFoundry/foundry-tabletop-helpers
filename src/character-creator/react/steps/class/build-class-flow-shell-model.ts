import type { ClassSelection, StepStatus, WizardState } from "../../../character-creator-types";
import {
  buildClassAggregateStepperModel,
  type ClassAggregatePresentationStatus,
  type ClassAggregateStepperModel,
} from "../../progress/build-class-aggregate-stepper-model";

export type ClassFlowPaneId = "class" | "classChoices" | "weaponMasteries";
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

export function buildClassFlowShellModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassFlowShellModel {
  const currentPane: ClassFlowPaneId =
    currentStepId === "classChoices"
      ? "classChoices"
      : currentStepId === "weaponMasteries"
        ? "weaponMasteries"
        : "class";
  const aggregateStepper = buildClassAggregateStepperModel(state, steps, currentStepId);
  const classSelection = state.selections.class as ClassSelection | undefined;
  const classChoicesStatus = getStepStatus(steps, "classChoices");
  const hasSelectedClass = Boolean(classSelection?.uuid);

  let headerTone: ClassFlowHeaderTone = "default";
  if (hasSelectedClass && (isAccentStatus(aggregateStepper.main.status) || classChoicesStatus === "complete")) {
    headerTone = "accent";
  }

  return {
    currentPane,
    title:
      currentPane === "classChoices"
        ? "Choose Your Skills"
        : currentPane === "weaponMasteries"
          ? "Choose Your Weapon Masteries"
          : "Choose Your Class",
    headerTone,
    selectedClassIdentifier: classSelection?.identifier ?? null,
    aggregateStepper,
  };
}
