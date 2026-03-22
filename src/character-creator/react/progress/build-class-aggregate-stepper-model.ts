import type { ClassSelection, StepStatus, WizardState } from "../../character-creator-types";

export type ClassAggregatePresentationStatus =
  | "pending"
  | "selection-active"
  | "in-progress"
  | "complete"
  | "collapsed-complete"
  | "skipped";

export interface ClassAggregateChildNode {
  id: "classChoices" | "weaponMasteries";
  label: string;
  icon: string;
  visible: boolean;
  status: ClassAggregatePresentationStatus;
}

export interface ClassAggregateMainNode {
  id: "class";
  label: string;
  icon: string;
  status: ClassAggregatePresentationStatus;
  selected: boolean;
  glowActive: boolean;
  children: ClassAggregateChildNode[];
}

export interface ClassAggregateTailNode {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  status: StepStatus | "skipped";
}

export interface ClassAggregateStepperModel {
  main: ClassAggregateMainNode;
  tail: ClassAggregateTailNode[];
}

const CLASS_GROUP_STEP_IDS = new Set(["class", "classChoices", "weaponMasteries", "classSummary"]);
function getStepStatus(steps: Array<{ id: string; status: StepStatus; active: boolean }>, stepId: string): StepStatus {
  return steps.find((step) => step.id === stepId)?.status ?? "pending";
}

function isStepPresent(steps: Array<{ id: string }>, stepId: string): boolean {
  return steps.some((step) => step.id === stepId);
}

function buildChildStatus(
  visible: boolean,
  present: boolean,
  stepStatus: StepStatus,
  active: boolean,
  currentStepId: string,
): ClassAggregatePresentationStatus {
  if (!present) return "skipped";
  if (!visible) return "pending";
  if (currentStepId === "class" && stepStatus !== "complete") return "pending";
  if (active) return "in-progress";
  if (stepStatus === "complete") return "complete";
  return "pending";
}

export function buildClassAggregateStepperModel(
  state: WizardState,
  steps: Array<{ id: string; label: string; icon: string; status: StepStatus; active: boolean }>,
  currentStepId: string,
): ClassAggregateStepperModel {
  const classSelection = state.selections.class as ClassSelection | undefined;
  const hasSelectedClass = Boolean(classSelection?.uuid);
  const inClassGroup = CLASS_GROUP_STEP_IDS.has(currentStepId);
  const onClassScreen = currentStepId === "class";

  const classChoicesPresent = isStepPresent(steps, "classChoices");
  const weaponMasteriesPresent = isStepPresent(steps, "weaponMasteries");
  const weaponMasteriesVisible = Boolean(classSelection?.hasWeaponMastery);
  const previewChildren = hasSelectedClass && onClassScreen;
  const showChildren = previewChildren || (inClassGroup && !onClassScreen);

  const classChoicesStatus = getStepStatus(steps, "classChoices");
  const weaponMasteriesStatus = getStepStatus(steps, "weaponMasteries");
  const classSummaryStatus = getStepStatus(steps, "classSummary");
  const reviewStatus = getStepStatus(steps, "review");

  let mainStatus: ClassAggregatePresentationStatus = "pending";
  if (hasSelectedClass && onClassScreen) {
    mainStatus = "selection-active";
  } else if (hasSelectedClass && inClassGroup) {
    mainStatus = "in-progress";
  } else if (
    hasSelectedClass
    && !inClassGroup
    && (!classChoicesPresent || classChoicesStatus === "complete")
    && (!weaponMasteriesVisible || !weaponMasteriesPresent || weaponMasteriesStatus === "complete")
  ) {
    mainStatus = "collapsed-complete";
  }

  const children: ClassAggregateChildNode[] = [
    {
      id: "classChoices",
      label: "Skills",
      icon: "fa-solid fa-hand-sparkles",
      visible: classChoicesPresent && showChildren,
      status: buildChildStatus(
        classChoicesPresent && showChildren,
        classChoicesPresent,
        classChoicesStatus,
        currentStepId === "classChoices",
        currentStepId,
      ),
    },
    {
      id: "weaponMasteries",
      label: "Masteries",
      icon: "fa-solid fa-swords",
      visible: weaponMasteriesPresent && weaponMasteriesVisible && showChildren,
      status: buildChildStatus(
        weaponMasteriesPresent && weaponMasteriesVisible && showChildren,
        weaponMasteriesPresent && weaponMasteriesVisible,
        weaponMasteriesStatus,
        currentStepId === "weaponMasteries",
        currentStepId,
      ),
    },
  ];

  return {
    main: {
      id: "class",
      label: "Class",
      icon: "fa-solid fa-shield-halved",
      status: mainStatus,
      selected: hasSelectedClass,
      glowActive: mainStatus === "selection-active" || mainStatus === "in-progress",
      children,
    },
    tail: [
      {
        id: "classSummary",
        label: "Features",
        icon: "fa-solid fa-stars",
        active: currentStepId === "classSummary",
        status: classSummaryStatus,
      },
      {
        id: "review",
        label: "Review",
        icon: "fa-solid fa-scroll",
        active: currentStepId === "review",
        status: reviewStatus,
      },
    ],
  };
}
