import type { StepStatus, WizardState } from "../../../character-creator-types";
import { buildOriginAggregateStepperModel } from "../../progress/build-origin-aggregate-stepper-model";
import type { ClassAggregateStepperModel } from "../../progress/build-class-aggregate-stepper-model";

export type OriginFlowPaneId =
  | "background"
  | "backgroundAsi"
  | "backgroundLanguages"
  | "originChoices"
  | "species"
  | "speciesSkills"
  | "speciesLanguages"
  | "speciesItemChoices"
  | "originSummary";

export interface OriginFlowShellModel {
  currentPane: OriginFlowPaneId;
  title: string;
  selectedClassIdentifier: string | null;
  aggregateStepper: ClassAggregateStepperModel;
}

function getCurrentPane(currentStepId: string): OriginFlowPaneId {
  switch (currentStepId) {
    case "backgroundAsi":
    case "backgroundLanguages":
    case "originChoices":
    case "species":
    case "speciesSkills":
    case "speciesLanguages":
    case "speciesItemChoices":
    case "originSummary":
      return currentStepId;
    default:
      return "background";
  }
}

function getPaneTitle(currentPane: OriginFlowPaneId): string {
  switch (currentPane) {
    case "backgroundAsi":
      return "Shape Your Aptitudes";
    case "backgroundLanguages":
      return "Choose Your Background Languages";
    case "originChoices":
      return "Confirm Your Origin Feat";
    case "species":
      return "Choose Your Species";
    case "speciesSkills":
      return "Choose Your Species Skills";
    case "speciesLanguages":
      return "Choose Your Species Languages";
    case "speciesItemChoices":
      return "Choose Your Species Gifts";
    case "originSummary":
      return "Origin Summary";
    default:
      return "Choose Your Background";
  }
}

export function buildOriginFlowShellModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): OriginFlowShellModel {
  const currentPane = getCurrentPane(currentStepId);
  return {
    currentPane,
    title: getPaneTitle(currentPane),
    selectedClassIdentifier: state.selections.class?.identifier ?? null,
    aggregateStepper: buildOriginAggregateStepperModel(state, steps, currentStepId),
  };
}
