import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn();
const logDebugMock = vi.fn();
const logInfoMock = vi.fn();
const logErrorMock = vi.fn();

const renderTemplateMock = vi.fn();
const createCharacterFromWizardMock = vi.fn();
const getOrderedStepsMock = vi.fn();
const getStepAtmosphereMock = vi.fn();

const getPackSourcesMock = vi.fn();
const getDisabledContentUUIDsMock = vi.fn();
const getAllowedAbilityMethodsMock = vi.fn();
const getStartingLevelMock = vi.fn();
const allowOriginFeatChoiceMock = vi.fn();
const allowUnrestrictedBackgroundAsiMock = vi.fn();
const allowFirearmsMock = vi.fn();
const allowMulticlassMock = vi.fn();
const getEquipmentMethodMock = vi.fn();
const getLevel1HpMethodMock = vi.fn();
const allowCustomBackgroundsMock = vi.fn();
const getMaxRerollsMock = vi.fn();

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
  renderTemplate: renderTemplateMock,
}));

vi.mock("../engine/actor-creation-engine", () => ({
  createCharacterFromWizard: createCharacterFromWizardMock,
}));

vi.mock("./step-registry", () => ({
  getOrderedSteps: getOrderedStepsMock,
  getStepAtmosphere: getStepAtmosphereMock,
}));

vi.mock("../character-creator-settings", () => ({
  getPackSources: getPackSourcesMock,
  getDisabledContentUUIDs: getDisabledContentUUIDsMock,
  getAllowedAbilityMethods: getAllowedAbilityMethodsMock,
  getStartingLevel: getStartingLevelMock,
  allowOriginFeatChoice: allowOriginFeatChoiceMock,
  allowUnrestrictedBackgroundAsi: allowUnrestrictedBackgroundAsiMock,
  allowFirearms: allowFirearmsMock,
  allowMulticlass: allowMulticlassMock,
  getEquipmentMethod: getEquipmentMethodMock,
  getLevel1HpMethod: getLevel1HpMethodMock,
  allowCustomBackgrounds: allowCustomBackgroundsMock,
  getMaxRerolls: getMaxRerollsMock,
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
  render = vi.fn();
  close = vi.fn(async () => {});

  constructor(..._args: unknown[]) {
    FakeBaseApplication.instances.push(this);
  }

  async _preparePartContext(_partId: string, _context: unknown, _options: unknown): Promise<Record<string, unknown>> {
    return {};
  }
}

class FakeWizardStateMachine {
  static instances: FakeWizardStateMachine[] = [];

  currentStepId = "species";
  currentStepDef: {
    id: string;
    label: string;
    icon: string;
    templatePath: string;
    buildViewModel: () => Promise<Record<string, unknown>>;
    onActivate?: (...args: unknown[]) => void;
  };
  canGoBack = false;
  canGoNext = true;
  isReviewStep = false;
  state = {
    applicableSteps: ["species", "review"],
    selections: {
      review: { characterName: "Aela" },
    },
  };

  constructor(public readonly config: Record<string, unknown>, steps: Array<Record<string, unknown>>) {
    this.currentStepDef = steps[0] as FakeWizardStateMachine["currentStepDef"];
    FakeWizardStateMachine.instances.push(this);
  }

  buildStepIndicatorData() {
    return [
      { id: "species", label: "Species", status: "current" },
      { id: "review", label: "Review", status: "pending" },
    ];
  }

  setStepData(_stepId: string, value: unknown): void {
    this.state.selections.review = value as { characterName: string };
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

beforeEach(() => {
  vi.clearAllMocks();
  installFoundryAppClasses();
  FakeBaseApplication.instances = [];
  FakeWizardStateMachine.instances = [];

  renderTemplateMock.mockResolvedValue("<section>Species</section>");
  createCharacterFromWizardMock.mockResolvedValue(null);
  getStepAtmosphereMock.mockReturnValue("cc-atmosphere--nature");
  getOrderedStepsMock.mockReturnValue([
    {
      id: "species",
      label: "Species",
      icon: "fa-solid fa-leaf",
      templatePath: "step.hbs",
      buildViewModel: async () => ({
        stepTitle: "Choose Species",
        stepLabel: "Origin",
      }),
    },
  ]);

  getPackSourcesMock.mockReturnValue({
    classes: ["pack.classes"],
    subclasses: [],
    races: ["pack.races"],
    backgrounds: [],
    feats: [],
    spells: [],
    items: [],
  });
  getDisabledContentUUIDsMock.mockReturnValue(["Compendium.test.disabled"]);
  getAllowedAbilityMethodsMock.mockReturnValue(["4d6", "pointBuy"]);
  getStartingLevelMock.mockReturnValue(2);
  allowOriginFeatChoiceMock.mockReturnValue(false);
  allowUnrestrictedBackgroundAsiMock.mockReturnValue(false);
  allowFirearmsMock.mockReturnValue(false);
  allowMulticlassMock.mockReturnValue(true);
  getEquipmentMethodMock.mockReturnValue("both");
  getLevel1HpMethodMock.mockReturnValue("max");
  allowCustomBackgroundsMock.mockReturnValue(false);
  getMaxRerollsMock.mockReturnValue(1);
});

vi.mock("./wizard-state-machine", () => ({
  WizardStateMachine: FakeWizardStateMachine,
}));

describe("character creator app shell", () => {
  let modPromise: Promise<typeof import("./character-creator-app")>;

  beforeAll(() => {
    installFoundryAppClasses();
    modPromise = import("./character-creator-app");
  });

  it("builds the runtime class and opens the wizard", async () => {
    const mod = await modPromise;

    mod.buildCharacterCreatorAppClass();
    const AppClass = mod.getCharacterCreatorAppClass();
    expect(AppClass).not.toBeNull();
    expect((AppClass as { DEFAULT_OPTIONS?: { window?: { title?: string } } }).DEFAULT_OPTIONS?.window?.title)
      .toBe("Character Creation");

    mod.openCharacterCreatorWizard();

    const instance = FakeBaseApplication.instances.at(-1);
    expect(instance?.render).toHaveBeenCalledWith({ force: true });
    expect(logDebugMock).toHaveBeenCalledWith(
      "Character Creator: CharacterCreatorApp class built"
    );
  }, 10000);

  it("prepares wizard shell context from the frozen config snapshot", async () => {
    const mod = await modPromise;

    mod.buildCharacterCreatorAppClass();
    const AppClass = mod.getCharacterCreatorAppClass()!;
    const app = new AppClass() as FakeBaseApplication & {
      _prepareContext(options: unknown): Promise<Record<string, unknown>>;
    };

    const context = await app._prepareContext({});

    expect(context).toMatchObject({
      currentStepId: "species",
      currentStepLabel: "Species",
      currentStepIcon: "fa-solid fa-leaf",
      headerTitle: "Choose Species",
      headerSubtitle: "Origin",
      atmosphereClass: "cc-atmosphere--nature",
      stepContentHtml: "<section>Species</section>",
    });
    expect(FakeWizardStateMachine.instances.at(-1)?.config).toMatchObject({
      packSources: expect.objectContaining({ classes: ["pack.classes"], races: ["pack.races"] }),
      disabledUUIDs: new Set(["Compendium.test.disabled"]),
      allowedAbilityMethods: ["4d6", "pointBuy"],
      startingLevel: 2,
      allowMulticlass: true,
      allowFirearms: false,
      equipmentMethod: "both",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
      allowOriginFeatChoice: false,
      allowUnrestrictedBackgroundAsi: false,
      maxRerolls: 1,
    });
  });

  it("creates the character, renders its sheet, and closes the wizard", async () => {
    const actorSheetRender = vi.fn();
    createCharacterFromWizardMock.mockResolvedValue({
      sheet: { render: actorSheetRender },
    });

    const mod = await modPromise;
    mod.buildCharacterCreatorAppClass();
    const AppClass = mod.getCharacterCreatorAppClass()!;
    const app = new AppClass() as FakeBaseApplication & {
      _machine?: { state: { selections: { review: { characterName: string } } } };
    };
    const button = new FakeElement("button");
    const root = new FakeElement("div");
    root.setQueryResult("[data-action='createCharacter']", button);
    app.element = root;
    app._machine = {
      state: { selections: { review: { characterName: "Aela" } } },
    };

    const ctor = AppClass as typeof AppClass & {
      _onCreateCharacter(this: FakeBaseApplication & {
        _machine?: { state: { selections: { review: { characterName: string } } } };
      }): Promise<void>;
    };

    await ctor._onCreateCharacter.call(app);

    expect(createCharacterFromWizardMock).toHaveBeenCalledWith(app._machine?.state);
    expect(actorSheetRender).toHaveBeenCalledWith({ force: true });
    expect(app.close).toHaveBeenCalled();
    expect(button.disabled).toBe(true);
    expect(logInfoMock).toHaveBeenCalledWith(
      'Character Creator: Successfully created "Aela"'
    );
  });

  it("warns instead of creating when the review step name is missing", async () => {
    const mod = await modPromise;
    mod.buildCharacterCreatorAppClass();
    const AppClass = mod.getCharacterCreatorAppClass()!;
    const app = new AppClass() as FakeBaseApplication & {
      _machine?: { state: { selections: { review: { characterName: string } } } };
    };
    app._machine = {
      state: { selections: { review: { characterName: "   " } } },
    };

    const ctor = AppClass as typeof AppClass & {
      _onCreateCharacter(this: FakeBaseApplication & {
        _machine?: { state: { selections: { review: { characterName: string } } } };
      }): Promise<void>;
    };

    await ctor._onCreateCharacter.call(app);

    expect(createCharacterFromWizardMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      "Character Creator: Please enter a character name"
    );
  });
});
