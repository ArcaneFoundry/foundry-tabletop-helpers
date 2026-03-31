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

export interface ClassFlowHeroCopy {
  title: string;
  description: string;
  primaryBadgeLabel: string;
  secondaryBadgeLabel: string;
}

export interface ClassFlowShellModel {
  currentPane: ClassFlowPaneId;
  title: string;
  headerTone: ClassFlowHeaderTone;
  selectedClassIdentifier: string | null;
  aggregateStepper: ClassAggregateStepperModel;
  hero: ClassFlowHeroCopy;
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

function getPaneHeroCopy(currentPane: ClassFlowPaneId): ClassFlowHeroCopy {
  switch (currentPane) {
    case "classChoices":
      return {
        title: "Choose Your Skills",
        description: "Select the class skills that best support your build.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your skills",
      };
    case "classExpertise":
      return {
        title: "Choose Your Expertise",
        description: "Choose the class expertise options that sharpen your training.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your expertise",
      };
    case "classLanguages":
      return {
        title: "Choose Your Languages",
        description: "Select the languages granted by your class features.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your languages",
      };
    case "classTools":
      return {
        title: "Choose Your Tools",
        description: "Pick the tool proficiencies your class hands you at the start.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your tools",
      };
    case "weaponMasteries":
      return {
        title: "Choose Your Weapon Masteries",
        description: "Select the weapon masteries your class training unlocks.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your masteries",
      };
    case "classItemChoices":
      return {
        title: "Choose Your Class Options",
        description: "Choose the feature options granted by your class at this level.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your class options",
      };
    case "classSummary":
      return {
        title: "Class Summary",
        description: "Review the class details and feature choices before moving on.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Review class choices",
      };
    default:
      return {
        title: "Choose Your Class",
        description: "Choose the class that sets your hero on the first steps of the build.",
        primaryBadgeLabel: "Class Flow",
        secondaryBadgeLabel: "Choose your class",
      };
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
  const skillsMilestone = aggregateStepper.milestones.find((milestone) => milestone.id === "skills");

  let headerTone: ClassFlowHeaderTone = "default";
  if (
    hasSelectedClass
    && (isAccentStatus(classMilestone?.status ?? "pending")
      || isAccentStatus(skillsMilestone?.status ?? "pending")
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
    hero: getPaneHeroCopy(currentPane),
  };
}
