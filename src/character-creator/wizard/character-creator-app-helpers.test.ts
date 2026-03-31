import { describe, expect, it, vi } from "vitest";

import type { GMConfig, WizardStepDefinition } from "../character-creator-types";
import { WizardStateMachine } from "./wizard-state-machine";
import {
  applyWizardAtmosphere,
  buildWizardShellContext,
  deactivateCurrentStep,
  patchWizardNavState,
  patchWizardStepIndicators,
} from "./character-creator-app-helpers";

function makeClassList(initial: string[] = []) {
  const classes = new Set(initial);
  return {
    add: (value: string) => { classes.add(value); },
    remove: (value: string) => { classes.delete(value); },
    toggle: (value: string, force?: boolean) => {
      if (force === true) {
        classes.add(value);
        return true;
      }
      if (force === false) {
        classes.delete(value);
        return false;
      }
      if (classes.has(value)) {
        classes.delete(value);
        return false;
      }
      classes.add(value);
      return true;
    },
    contains: (value: string) => classes.has(value),
    forEach: (callback: (value: string) => void) => Array.from(classes).forEach(callback),
  };
}

function makeConfig(): GMConfig {
  return {
    packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
    disabledUUIDs: new Set(),
    allowedAbilityMethods: ["4d6"],
    maxRerolls: 0,
    startingLevel: 1,
    allowMulticlass: false,
    equipmentMethod: "equipment",
    level1HpMethod: "max",
    allowCustomBackgrounds: false,
  };
}

function makeStep(id: string, extra: Partial<WizardStepDefinition> = {}): WizardStepDefinition {
  return {
    id,
    label: id,
    icon: "fa-solid fa-circle",
    templatePath: "step.hbs",
    dependencies: [],
    isApplicable: () => true,
    isComplete: () => true,
    buildViewModel: async () => ({}),
    ...extra,
  };
}

describe("character creator app helpers", () => {
  it("builds shell context from current step view model", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", {
        label: "Species",
        icon: "fa-solid fa-leaf",
        buildViewModel: async () => ({
          stepTitle: "Choose Species",
          stepLabel: "Origin",
          stepDescription: "Pick your ancestry",
          stepIcon: "fa-solid fa-leaf",
          selectedEntry: { name: "Elf", img: "elf.png", packLabel: "PHB" },
        }),
      }),
    ]);

    const context = await buildWizardShellContext(
      machine,
      machine.currentStepDef,
      async (_path, data) => `<div>${String(data.stepTitle)}</div>`,
      () => "cc-atmosphere--nature",
    );

    expect(context).toMatchObject({
      currentStepId: "species",
      currentStepLabel: "Species",
      currentStepIcon: "fa-solid fa-leaf",
      atmosphereClass: "cc-atmosphere--nature",
      chapterKey: "species",
      chapterSceneKey: "archives",
      chapterAccentToken: "origins",
      headerTitle: "Choose Species",
      headerSubtitle: "Origin",
      headerDescription: "Pick your ancestry",
      headerIcon: "fa-solid fa-leaf",
      selectedEntry: { name: "Elf", img: "elf.png", packLabel: "PHB" },
      stepContentHtml: "<div>Choose Species</div>",
    });
  });

  it("maps the final review step into the Lore chapter", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("review", {
        label: "Review",
        icon: "fa-solid fa-stars",
        buildViewModel: async () => ({
          stepTitle: "Final Review",
        }),
      }),
    ]);

    const context = await buildWizardShellContext(
      machine,
      machine.currentStepDef,
      async (_path, data) => `<div>${String(data.stepTitle)}</div>`,
      () => "cc-atmosphere--gold",
    );

    expect(context.chapterKey).toBe("lore");
    expect(context.chapterSceneKey).toBe("binding");
    expect(context.chapterAccentToken).toBe("lore");
  });

  it.each([
    ["classChoices", "skills", "ritual", "build"],
    ["speciesSkills", "species", "archives", "origins"],
    ["backgroundLanguages", "background", "archives", "origins"],
    ["feats", "abilities", "ritual", "build"],
    ["spells", "spells", "grimoire", "build"],
    ["equipment", "equipment", "arsenal", "build"],
  ] as const)("maps %s into the %s chapter with the expected scene and accent defaults", async (stepId, expectedChapter, expectedScene, expectedAccent) => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep(stepId, {
        label: stepId,
        icon: "fa-solid fa-circle",
        buildViewModel: async () => ({ stepTitle: stepId }),
      }),
    ]);

    const context = await buildWizardShellContext(
      machine,
      machine.currentStepDef,
      async (_path, data) => `<div>${String(data.stepTitle)}</div>`,
      () => "cc-atmosphere--nature",
    );

    expect(context.chapterKey).toBe(expectedChapter);
    expect(context.chapterSceneKey).toBe(expectedScene);
    expect(context.chapterAccentToken).toBe(expectedAccent);
  });

  it("defaults mounted class-flow steps to hidden shell chrome", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("class", {
        label: "Class",
        icon: "fa-solid fa-shield",
        renderMode: "react",
      }),
    ]);

    const context = await buildWizardShellContext(
      machine,
      machine.currentStepDef,
      async (_path, data) => `<div>${String(data.stepTitle ?? "")}</div>`,
      () => "cc-atmosphere--forge",
    );

    expect(context.hideStepIndicator).toBe(true);
    expect(context.hideShellHeader).toBe(true);
  });

  it("patches nav and step indicator state", () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", {
        isComplete: () => false,
        getStatusHint: () => "Select a species",
      }),
      makeStep("review"),
    ]);

    const nextBtn = { disabled: false };
    const hint = { textContent: "" };
    const stepA = { classList: makeClassList(["cc-step-indicator__step"]) };
    const stepB = { classList: makeClassList(["cc-step-indicator__step"]) };
    const root = {
      querySelector(selector: string) {
        if (selector === "[data-action='goNext']") return nextBtn;
        if (selector === "[data-status-hint]") return hint;
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".cc-step-indicator__step") return [stepA, stepB];
        return [];
      },
    } as unknown as HTMLElement;

    machine.markComplete("species");

    patchWizardNavState(root, machine);
    patchWizardStepIndicators(root, machine);

    expect(nextBtn.disabled).toBe(true);
    expect(hint.textContent).toBe("Select a species");
    expect(stepA.classList.contains("cc-step-indicator__step--complete")).toBe(true);
    expect(stepB.classList.contains("cc-step-indicator__step--pending")).toBe(true);
  });

  it("applies atmosphere and deactivates the current step", () => {
    const onDeactivate = vi.fn();
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("species", { onDeactivate }),
    ]);

    const shell = { classList: makeClassList(["cc-wizard-shell", "cc-atmosphere--shadow"]) };
    const stepContent = {};
    const root = {
      querySelector(selector: string) {
        if (selector === ".cc-wizard-shell") return shell;
        if (selector === ".cc-step-content") return stepContent;
        return null;
      },
    } as unknown as HTMLElement;

    applyWizardAtmosphere(root, "cc-atmosphere--nature");
    deactivateCurrentStep(machine.currentStepDef, machine, root);

    expect(shell.classList.contains("cc-atmosphere--shadow")).toBe(false);
    expect(shell.classList.contains("cc-atmosphere--nature")).toBe(true);
    expect(onDeactivate).toHaveBeenCalledWith(machine.state, stepContent);
  });
});
