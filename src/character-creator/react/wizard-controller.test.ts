import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GMConfig, WizardStepDefinition } from "../character-creator-types";
import { WizardStateMachine } from "../wizard/wizard-state-machine";
import { CharacterCreatorWizardController } from "./wizard-controller";

const {
  ensureCharacterCreatorIndexesReadyMock,
  ensureOriginFeatMetadataReadyMock,
  warmOriginFeatChoicesMock,
} = vi.hoisted(() => ({
  ensureCharacterCreatorIndexesReadyMock: vi.fn(async () => {}),
  ensureOriginFeatMetadataReadyMock: vi.fn(async () => {}),
  warmOriginFeatChoicesMock: vi.fn(async () => []),
}));

vi.mock("../engine/actor-creation-engine", () => ({
  createCharacterFromWizard: vi.fn(),
}));

vi.mock("../character-creator-index-cache", () => ({
  ensureCharacterCreatorIndexesReady: ensureCharacterCreatorIndexesReadyMock,
  ensureOriginFeatMetadataReady: ensureOriginFeatMetadataReadyMock,
}));

vi.mock("../steps/step-origin-choices", () => ({
  warmOriginFeatChoices: warmOriginFeatChoicesMock,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CharacterCreatorWizardController", () => {
  it("prewarms origin feat choices before advancing from background languages", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("backgroundLanguages", {
        isComplete: () => true,
      }),
      makeStep("originChoices"),
      makeStep("review"),
    ]);

    const controller = new CharacterCreatorWizardController(machine, {
      renderTemplate: async () => "<div>content</div>",
      getStepAtmosphere: () => "cc-atmosphere--forge",
      closeWizard: async () => undefined,
    });

    await controller.initialize();
    controller.goNext();
    await Promise.resolve();
    await Promise.resolve();

    expect(ensureOriginFeatMetadataReadyMock).toHaveBeenCalledWith(machine.state.config.packSources, {
      persistIfMissing: true,
    });
    expect(warmOriginFeatChoicesMock).toHaveBeenCalledWith(machine.state);
    const perfCall = infoSpy.mock.calls.find((call) => call[3] === "CC Perf: goNext triggered refresh");
    expect(perfCall?.[4]).toMatchObject({
      fromStepId: "backgroundLanguages",
      toStepId: "originChoices",
      originFeatWarmupMs: expect.any(Number),
    });
  });

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

  it("can update a different step key while keeping the current mounted step active", async () => {
    const machine = new WizardStateMachine(makeConfig(), [
      makeStep("equipment", {
        isComplete: (state) => Boolean(state.selections.equipment),
      }),
      makeStep("equipmentShop", {
        getStatusHint: (state) => (state.selections.equipment?.remainingGoldCp ?? 0) > 0 ? "Spend or save your remaining gold" : "",
      }),
      makeStep("review"),
    ]);

    machine.setStepData("equipment", {
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      remainingGoldCp: 10000,
    });

    const controller = new CharacterCreatorWizardController(machine, {
      renderTemplate: async (path, data) => `<div data-template="${path}">${String(data.stepTitle)}</div>`,
      getStepAtmosphere: () => "cc-atmosphere--forge",
      closeWizard: async () => undefined,
    });

    await controller.initialize();
    controller.goNext();
    await Promise.resolve();
    await Promise.resolve();

    expect(machine.currentStepId).toBe("equipmentShop");

    controller.updateStepData("equipment", {
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      remainingGoldCp: 9400,
    }, { silent: true });

    expect(machine.currentStepId).toBe("equipmentShop");
    expect(machine.state.selections.equipment).toMatchObject({
      classOptionId: "class-gold",
      backgroundOptionId: "background-kit",
      remainingGoldCp: 9400,
    });
    expect(controller.getSnapshot().shellContext?.statusHint).toBe("Spend or save your remaining gold");
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
