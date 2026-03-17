import { beforeEach, describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn();
const logDebugMock = vi.fn();
const logInfoMock = vi.fn();
const logErrorMock = vi.fn();

const getGameMock = vi.fn();
const renderTemplateMock = vi.fn();
const applyLevelUpMock = vi.fn();
const shouldShowLevelUpMock = vi.fn();
const getStepAtmosphereMock = vi.fn();
const allowMulticlassMock = vi.fn();
const ccLevelUpEnabledMock = vi.fn();

const createClassChoiceStepMock = vi.fn();
const createHpStepMock = vi.fn();
const createFeaturesStepMock = vi.fn();
const createLuSubclassStepMock = vi.fn();
const createLuFeatsStepMock = vi.fn();
const createLuSpellsStepMock = vi.fn();
const createLuReviewStepMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
    debug: logDebugMock,
    info: logInfoMock,
    error: logErrorMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
  renderTemplate: renderTemplateMock,
}));

vi.mock("./actor-update-engine", () => ({
  applyLevelUp: applyLevelUpMock,
}));

vi.mock("./level-up-detection", () => ({
  shouldShowLevelUp: shouldShowLevelUpMock,
}));

vi.mock("../wizard/step-registry", () => ({
  getStepAtmosphere: getStepAtmosphereMock,
}));

vi.mock("../character-creator-settings", () => ({
  allowMulticlass: allowMulticlassMock,
  ccLevelUpEnabled: ccLevelUpEnabledMock,
}));

function makeStep(id: string, label: string) {
  return {
    id,
    label,
    icon: "fa-solid fa-arrow-up",
    templatePath: `${id}.hbs`,
    isComplete: () => true,
    buildViewModel: async () => ({ heading: `${label} Step` }),
  };
}

vi.mock("./steps/lu-step-class-choice", () => ({
  createClassChoiceStep: createClassChoiceStepMock,
}));

vi.mock("./steps/lu-step-hp", () => ({
  createHpStep: createHpStepMock,
}));

vi.mock("./steps/lu-step-features", () => ({
  createFeaturesStep: createFeaturesStepMock,
}));

vi.mock("./steps/lu-step-subclass", () => ({
  createLuSubclassStep: createLuSubclassStepMock,
}));

vi.mock("./steps/lu-step-feats", () => ({
  createLuFeatsStep: createLuFeatsStepMock,
}));

vi.mock("./steps/lu-step-spells", () => ({
  createLuSpellsStep: createLuSpellsStepMock,
}));

vi.mock("./steps/lu-step-review", () => ({
  createLuReviewStep: createLuReviewStepMock,
}));

class FakeElement {
  disabled = false;
  innerHTML = "";
  dataset: Record<string, string> = {};
  private readonly selectors = new Map<string, unknown>();

  constructor(public readonly tagName = "div") {}

  setQueryResult(selector: string, value: unknown): void {
    this.selectors.set(selector, value);
  }

  querySelector(selector: string): unknown {
    return this.selectors.get(selector) ?? null;
  }
}

class FakeBaseApplication {
  static instances: FakeBaseApplication[] = [];
  static DEFAULT_OPTIONS = {};
  static PARTS = {};

  element: FakeElement | null = null;
  title?: string;
  render = vi.fn();
  close = vi.fn(async () => {});

  constructor(..._args: unknown[]) {
    FakeBaseApplication.instances.push(this);
  }

  async _preparePartContext(_partId: string, _context: unknown, _options: unknown): Promise<Record<string, unknown>> {
    return {};
  }
}

class FakeLevelUpStateMachine {
  static instances: FakeLevelUpStateMachine[] = [];

  currentStepId = "classChoice";
  canGoBack = false;
  canGoNext = true;
  isReviewStep = false;
  state = {
    actorId: "actor-1",
    selections: { classChoice: { mode: "existing" } },
  };

  constructor(public readonly actor: unknown, public readonly allowMulticlass: boolean) {
    FakeLevelUpStateMachine.instances.push(this);
  }

  buildStepIndicatorData() {
    return [
      { id: "classChoice", label: "Class", status: "current" },
      { id: "review", label: "Review", status: "pending" },
    ];
  }

  goNext(): boolean {
    return true;
  }

  goBack(): boolean {
    return true;
  }

  jumpTo(_stepId: string): boolean {
    return true;
  }
}

function installFoundryAppClasses(): void {
  (globalThis as Record<string, unknown>).Element = FakeElement;
  (globalThis as Record<string, unknown>).HTMLButtonElement = FakeElement;
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      api: {
        ApplicationV2: FakeBaseApplication,
        HandlebarsApplicationMixin: <TBase extends new (...args: any[]) => FakeBaseApplication>(Base: TBase) =>
          class Mixed extends Base {},
      },
    },
  };
}

function makeActor(id = "actor-1") {
  return {
    id,
    name: "Tarin",
    type: "character",
    system: { details: { level: 1 } },
    items: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  installFoundryAppClasses();
  FakeBaseApplication.instances = [];
  FakeLevelUpStateMachine.instances = [];

  renderTemplateMock.mockResolvedValue("<section>Level Up</section>");
  applyLevelUpMock.mockResolvedValue(false);
  shouldShowLevelUpMock.mockReturnValue(true);
  getStepAtmosphereMock.mockReturnValue("cc-atmosphere--steel");
  allowMulticlassMock.mockReturnValue(true);
  ccLevelUpEnabledMock.mockReturnValue(true);

  createClassChoiceStepMock.mockReturnValue(makeStep("classChoice", "Class"));
  createHpStepMock.mockReturnValue(makeStep("hp", "HP"));
  createFeaturesStepMock.mockReturnValue(makeStep("features", "Features"));
  createLuSubclassStepMock.mockReturnValue(makeStep("subclass", "Subclass"));
  createLuFeatsStepMock.mockReturnValue(makeStep("feats", "Feats"));
  createLuSpellsStepMock.mockReturnValue(makeStep("spells", "Spells"));
  createLuReviewStepMock.mockReturnValue(makeStep("review", "Review"));

  const actor = makeActor();
  getGameMock.mockReturnValue({
    actors: {
      get(id: string) {
        return id === actor.id ? actor : null;
      },
    },
  });
});

vi.mock("./level-up-state-machine", () => ({
  LevelUpStateMachine: FakeLevelUpStateMachine,
}));

describe("level-up app shell", () => {
  it("builds the runtime class and opens the wizard for eligible actors", async () => {
    const mod = await import("./level-up-app");

    mod.buildLevelUpAppClass();
    const AppClass = mod.getLevelUpAppClass();
    expect(AppClass).not.toBeNull();

    mod.openLevelUpWizard("actor-1");

    const instance = FakeBaseApplication.instances.at(-1) as FakeBaseApplication & {
      _actorId?: string;
    };
    expect(instance.render).toHaveBeenCalledWith({ force: true });
    expect(instance._actorId).toBe("actor-1");
    expect(logDebugMock).toHaveBeenCalledWith("Level-Up Manager: LevelUpApp class built");
  });

  it("prepares shell context through the current step and actor snapshot", async () => {
    const mod = await import("./level-up-app");

    mod.buildLevelUpAppClass();
    const AppClass = mod.getLevelUpAppClass()!;
    const app = new AppClass() as FakeBaseApplication & {
      setActor(actorId: string): void;
      _prepareContext(options: unknown): Promise<Record<string, unknown>>;
    };
    app.setActor("actor-1");

    const context = await app._prepareContext({});

    expect(context).toMatchObject({
      currentStepId: "classChoice",
      currentStepLabel: "Class",
      atmosphereClass: "cc-atmosphere--steel",
      isLevelUp: true,
      stepContentHtml: "<section>Level Up</section>",
    });
    expect(FakeLevelUpStateMachine.instances.at(-1)?.actor).toMatchObject({ id: "actor-1" });
    expect(FakeLevelUpStateMachine.instances.at(-1)?.allowMulticlass).toBe(true);
  });

  it("applies level-up changes and closes the app on success", async () => {
    applyLevelUpMock.mockResolvedValue(true);

    const mod = await import("./level-up-app");
    mod.buildLevelUpAppClass();
    const AppClass = mod.getLevelUpAppClass()!;
    const app = new AppClass() as FakeBaseApplication & {
      _machine?: { state: Record<string, unknown> };
    };
    const button = new FakeElement("button");
    const root = new FakeElement("div");
    root.setQueryResult("[data-action='applyLevelUp']", button);
    app.element = root;
    app._machine = {
      state: { actorId: "actor-1", selections: { review: {} } },
    };

    const ctor = AppClass as typeof AppClass & {
      _onApplyLevelUp(this: FakeBaseApplication & {
        _machine?: { state: Record<string, unknown> };
      }): Promise<void>;
    };

    await ctor._onApplyLevelUp.call(app);

    expect(applyLevelUpMock).toHaveBeenCalledWith(app._machine?.state);
    expect(app.close).toHaveBeenCalled();
    expect(button.disabled).toBe(true);
    expect(logInfoMock).toHaveBeenCalledWith("Level-Up: Changes applied successfully");
  });

  it("does not open when the actor is missing or not eligible", async () => {
    const mod = await import("./level-up-app");
    mod.buildLevelUpAppClass();

    mod.openLevelUpWizard("missing");
    shouldShowLevelUpMock.mockReturnValue(false);
    mod.openLevelUpWizard("actor-1");

    expect(logWarnMock).toHaveBeenCalledWith("Level-Up Manager: Actor not found", { actorId: "missing" });
    expect(logInfoMock).toHaveBeenCalledWith("Level-Up Manager: Actor is not eligible to level up");
  });

  it("does not open when level-up is disabled in settings", async () => {
    ccLevelUpEnabledMock.mockReturnValue(false);

    const mod = await import("./level-up-app");
    mod.buildLevelUpAppClass();
    mod.openLevelUpWizard("actor-1");

    expect(FakeBaseApplication.instances).toHaveLength(0);
    expect(logInfoMock).toHaveBeenCalledWith("Level-Up Manager: feature disabled in settings");
  });
});
