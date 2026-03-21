import { describe, expect, it, vi } from "vitest";

import type { GMConfig, WizardStepDefinition } from "../character-creator-types";
import { WizardStateMachine } from "../wizard/wizard-state-machine";
import { CharacterCreatorWizardController } from "./wizard-controller";

vi.mock("../engine/actor-creation-engine", () => ({
  createCharacterFromWizard: vi.fn(),
}));

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
    templatePath: `${id}.hbs`,
    dependencies: [],
    isApplicable: () => true,
    isComplete: (state) => Boolean(state.selections[id]),
    buildViewModel: async () => ({
      stepTitle: id,
      stepLabel: id,
    }),
    ...extra,
  };
}

describe("CharacterCreatorWizardController", () => {
  it("returns a stable snapshot object until the store changes", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("class"),
      makeStep("review"),
    ]);

    const controller = new CharacterCreatorWizardController(machine, {
      renderTemplate: async () => "<div>content</div>",
      getStepAtmosphere: () => "cc-atmosphere--forge",
      closeWizard: async () => undefined,
    });

    const beforeInitSnapshot = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(beforeInitSnapshot);

    await controller.initialize();

    const initializedSnapshot = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(initializedSnapshot);

    controller.updateCurrentStepData({ uuid: "Compendium.class.fighter" }, { silent: true });
    expect(controller.getSnapshot()).not.toBe(initializedSnapshot);
  });

  it("refreshes shell context and updates nav state on silent step changes", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("class", {
        getStatusHint: (state) => (state.selections.class ? "" : "Choose a class"),
      }),
      makeStep("review"),
    ]);

    const controller = new CharacterCreatorWizardController(machine, {
      renderTemplate: async (path, data) => `<div data-template="${path}">${String(data.stepTitle)}</div>`,
      getStepAtmosphere: () => "cc-atmosphere--forge",
      closeWizard: async () => undefined,
    });

    await controller.initialize();
    expect(controller.getSnapshot().shellContext?.canGoNext).toBe(false);
    expect(controller.getSnapshot().shellContext?.statusHint).toBe("Choose a class");

    const callbacks = (controller as unknown as {
      _createStepCallbacks(stepId: string): { setDataSilent: (value: unknown) => void };
    })._createStepCallbacks("class");

    callbacks.setDataSilent({ uuid: "Compendium.class.fighter" });

    expect(controller.getSnapshot().shellContext?.canGoNext).toBe(true);
    expect(controller.getSnapshot().shellContext?.statusHint).toBe("");
  });

  it("deactivates the active step before moving to the next step", async () => {
    const onDeactivate = vi.fn();
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("class", {
        onDeactivate,
      }),
      makeStep("review", {
        isComplete: () => true,
      }),
    ]);

    machine.setStepData("class", { uuid: "Compendium.class.fighter" });

    const controller = new CharacterCreatorWizardController(machine, {
      renderTemplate: async () => "<div>content</div>",
      getStepAtmosphere: () => "cc-atmosphere--forge",
      closeWizard: async () => undefined,
    });

    await controller.initialize();

    const element = {} as HTMLElement;
    controller.registerActiveStepElement(element);
    controller.goNext();

    expect(onDeactivate).toHaveBeenCalledWith(machine.state, element);
  });
});
