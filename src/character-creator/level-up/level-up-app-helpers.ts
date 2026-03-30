import type { FoundryDocument } from "../../types";
import type { WizardShellContext } from "../character-creator-types";
import type { LevelUpStateMachine } from "./level-up-state-machine";
import type { LevelUpStepDef } from "./steps/lu-step-class-choice";

export interface LevelUpShellContext extends WizardShellContext {
  isLevelUp: boolean;
}

export function createLevelUpStepCallbacks(
  machine: LevelUpStateMachine,
  render: () => void,
  getStepDef?: (stepId: string) => LevelUpStepDef | undefined,
): {
  setData: (value: unknown) => void;
  rerender: () => void;
} {
  return {
    setData: (value: unknown) => {
      const stepId = machine.currentStepId;
      machine.setStepData(stepId, value);
      const stepDef = getStepDef?.(stepId);
      if (stepDef?.isComplete(machine.state) ?? true) machine.markComplete(stepId);
      else machine.markPending(stepId);
      render();
    },
    rerender: () => {
      render();
    },
  };
}

export async function buildLevelUpShellContext(
  machine: LevelUpStateMachine,
  stepId: string,
  stepDef: LevelUpStepDef | undefined,
  actor: FoundryDocument | null,
  renderTemplateFn: (path: string, data: Record<string, unknown>) => Promise<string>,
  getStepAtmosphere: (stepId: string) => string,
): Promise<LevelUpShellContext> {
  let stepContentHtml = "";
  let vmData: Record<string, unknown> = {};

  if (stepDef && actor) {
    vmData = await stepDef.buildViewModel(machine.state, actor);
    if (stepDef.isComplete(machine.state)) machine.markComplete(stepId);
    else machine.markPending(stepId);
    stepContentHtml = await renderTemplateFn(stepDef.templatePath, vmData);
  }

  return {
    steps: machine.buildStepIndicatorData(),
    stepContentHtml,
    currentStepId: stepId,
    currentStepLabel: stepDef?.label ?? "",
    currentStepIcon: stepDef?.icon ?? "",
    canGoBack: machine.canGoBack,
    canGoNext: machine.canGoNext,
    isReviewStep: machine.isReviewStep,
    statusHint: stepDef?.getStatusHint?.(machine.state) ?? "",
    localProgress: {
      current: machine.state.currentStep + 1,
      total: machine.state.applicableSteps.length,
      percent: machine.state.applicableSteps.length > 0
        ? Math.round(((machine.state.currentStep + 1) / machine.state.applicableSteps.length) * 100)
        : 0,
      label: `Step ${machine.state.currentStep + 1} of ${machine.state.applicableSteps.length}`,
      detail: vmData.localProgressDetail as string | undefined,
    },
    atmosphereClass: getStepAtmosphere(stepId),
    isLevelUp: true,
  };
}

export function activateLevelUpStep(
  stepDef: LevelUpStepDef | undefined,
  machine: LevelUpStateMachine,
  root: ParentNode | null | undefined,
  callbacks: {
    setData: (value: unknown) => void;
    rerender: () => void;
  },
): void {
  if (!stepDef?.onActivate) return;
  const stepEl = root?.querySelector?.(".cc-step-content");
  if (stepEl) {
    stepDef.onActivate(machine.state, stepEl as HTMLElement, callbacks);
  }
}

export function applyLevelUpAtmosphere(root: ParentNode | null | undefined, atmosphereClass: string): void {
  const shell = root?.querySelector?.(".cc-wizard-shell") as HTMLElement | null;
  if (!shell) return;

  shell.classList.forEach((cls: string) => {
    if (cls.startsWith("cc-atmosphere--")) shell.classList.remove(cls);
  });
  shell.classList.add(atmosphereClass);
}

export function updateLevelUpWindowTitle(
  target: { title?: string },
  actor: FoundryDocument | null,
): void {
  if (actor?.name) {
    target.title = `Level Up — ${actor.name}`;
  }
}

export function setApplyLevelUpButtonPending(button: HTMLButtonElement | null): void {
  if (!button) return;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Applying...</span>';
}

export function resetApplyLevelUpButton(button: HTMLButtonElement | null): void {
  if (!button) return;
  button.disabled = false;
  button.innerHTML = '<i class="fa-solid fa-arrow-up"></i> <span>Apply Level Up</span>';
}
