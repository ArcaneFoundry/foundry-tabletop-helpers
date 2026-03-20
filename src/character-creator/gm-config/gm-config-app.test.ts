import { beforeEach, describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn();
const logDebugMock = vi.fn();
const getGameMock = vi.fn();
const getUIMock = vi.fn();
const getPackSourcesMock = vi.fn();
const setPackSourcesMock = vi.fn(async () => {});
const setDisabledContentUUIDsMock = vi.fn(async () => {});
const getAllowedAbilityMethodsMock = vi.fn();
const setAllowedAbilityMethodsMock = vi.fn(async () => {});
const getStartingLevelMock = vi.fn();
const setStartingLevelMock = vi.fn(async () => {});
const allowMulticlassMock = vi.fn();
const getEquipmentMethodMock = vi.fn();
const setEquipmentMethodMock = vi.fn(async () => {});
const getLevel1HpMethodMock = vi.fn();
const setLevel1HpMethodMock = vi.fn(async () => {});
const allowCustomBackgroundsMock = vi.fn();
const setSettingMock = vi.fn(async () => {});
const loadPacksMock = vi.fn(async () => new Map());
const invalidateMock = vi.fn();
const getIndexedEntriesMock = vi.fn(() => []);
const contentFilterFromSettingsMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
    debug: logDebugMock,
  },
}));

vi.mock("../../types", () => ({
  getGame: getGameMock,
  getUI: getUIMock,
  setSetting: setSettingMock,
}));

vi.mock("../character-creator-settings", () => ({
  getPackSources: getPackSourcesMock,
  setPackSources: setPackSourcesMock,
  setDisabledContentUUIDs: setDisabledContentUUIDsMock,
  getAllowedAbilityMethods: getAllowedAbilityMethodsMock,
  setAllowedAbilityMethods: setAllowedAbilityMethodsMock,
  getStartingLevel: getStartingLevelMock,
  setStartingLevel: setStartingLevelMock,
  allowMulticlass: allowMulticlassMock,
  getEquipmentMethod: getEquipmentMethodMock,
  setEquipmentMethod: setEquipmentMethodMock,
  getLevel1HpMethod: getLevel1HpMethodMock,
  setLevel1HpMethod: setLevel1HpMethodMock,
  allowCustomBackgrounds: allowCustomBackgroundsMock,
  CC_SETTINGS: {
    STARTING_LEVEL: "startingLevel",
    ALLOW_MULTICLASS: "allowMulticlass",
    EQUIPMENT_METHOD: "equipmentMethod",
    LEVEL1_HP_METHOD: "level1HpMethod",
    ALLOW_CUSTOM_BACKGROUNDS: "allowCustomBackgrounds",
  },
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    invalidate: invalidateMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

vi.mock("../data/content-filter", () => ({
  ContentFilter: {
    fromSettings: contentFilterFromSettingsMock,
  },
}));

class FakeBaseApplication {
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  static instances: FakeBaseApplication[] = [];
  element: Element | null = null;
  tabGroups: Record<string, string> = {};
  render = vi.fn();

  constructor(..._args: unknown[]) {
    FakeBaseApplication.instances.push(this);
  }

  async _preparePartContext(_partId: string, _context: unknown, _options: unknown): Promise<Record<string, unknown>> {
    return {};
  }
}

function installFoundryAppClasses(): void {
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      api: {
        ApplicationV2: FakeBaseApplication,
        HandlebarsApplicationMixin: <TBase extends new (...args: any[]) => FakeBaseApplication>(Base: TBase) =>
          class Mixed extends Base {
            constructor(...args: any[]) {
              super(...args);
            }
          },
      },
    },
  };
}

function makePack(
  collection: string,
  label: string,
  size: number,
  entries: Array<Record<string, unknown>>,
  packageName = "dnd-players-handbook",
) {
  return {
    collection,
    documentName: "Item",
    metadata: { label, name: label, packageName, type: "Item" },
    size,
    getIndex: vi.fn(async () => entries),
  };
}

function checkbox(checked: boolean): Element & { checked: boolean } {
  return { checked } as Element & { checked: boolean };
}

function valueInput(value: string): Element & { value: string } {
  return { value } as Element & { value: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  installFoundryAppClasses();
  FakeBaseApplication.instances = [];

  getPackSourcesMock.mockReturnValue({
    classes: ["dnd-players-handbook.classes"],
    subclasses: [],
    races: [],
    backgrounds: [],
    feats: [],
    spells: [],
    items: [],
  });
  getAllowedAbilityMethodsMock.mockReturnValue(["4d6", "pointBuy"]);
  getStartingLevelMock.mockReturnValue(3);
  allowMulticlassMock.mockReturnValue(true);
  getEquipmentMethodMock.mockReturnValue("both");
  getLevel1HpMethodMock.mockReturnValue("max");
  allowCustomBackgroundsMock.mockReturnValue(false);
  getGameMock.mockReturnValue({
    packs: [
      makePack("dnd-players-handbook.classes", "Character Classes", 12, [
        { _id: "class-1", name: "Wizard", type: "class" },
        { _id: "spell-1", name: "Shield", type: "spell" },
      ]),
      makePack("dnd-players-handbook.spells", "Spells", 40, [
        { _id: "spell-2", name: "Magic Missile", type: "spell" },
        { _id: "spell-3", name: "Mage Armor", type: "spell" },
      ]),
    ],
  });
  getUIMock.mockReturnValue({
    notifications: {
      info: vi.fn(),
    },
  });
  contentFilterFromSettingsMock.mockReturnValue({
    isEnabled: vi.fn(() => true),
    toggle: vi.fn(),
    enableAll: vi.fn(),
    disableAll: vi.fn(),
    toArray: vi.fn(() => []),
  });
});

describe("gm config app shell", () => {
  it("builds the runtime class and opens the app", async () => {
    const mod = await import("./gm-config-app");

    mod.buildGMConfigAppClass();
    const AppClass = mod.getGMConfigAppClass();
    expect(AppClass).not.toBeNull();

    mod.openGMConfigApp();

    const instance = FakeBaseApplication.instances.at(-1);
    expect(instance?.render).toHaveBeenCalledWith({ force: true });
    expect(logDebugMock).toHaveBeenCalledWith("Character Creator: GMConfigApp class built");
  });

  it("builds source and rules contexts from settings and available packs", async () => {
    const mod = await import("./gm-config-app");
    mod.buildGMConfigAppClass();
    const AppClass = mod.getGMConfigAppClass()!;
    const app = new AppClass() as FakeBaseApplication & { _prepareContext(options: unknown): Promise<Record<string, unknown>> };

    app.tabGroups.main = "sources";
    const sourceContext = await app._prepareContext({});
    expect(sourceContext.sources).toEqual({
      groups: [
        {
          sourceKey: "classes",
          type: "class",
          label: "Classes",
          packs: [expect.objectContaining({
            collection: "dnd-players-handbook.classes",
            enabled: true,
            sourceBadge: "Core 2024",
          })],
        },
        {
          sourceKey: "spells",
          type: "spell",
          label: "Spells",
          packs: [
            expect.objectContaining({
              collection: "dnd-players-handbook.classes",
              enabled: false,
              previewSummary: "1 classes • 1 spells",
            }),
            expect.objectContaining({
              collection: "dnd-players-handbook.spells",
              enabled: false,
              label: "Spells",
            }),
          ],
        },
      ],
    });

    app.tabGroups.main = "rules";
    const rulesContext = await app._prepareContext({});
    expect(rulesContext.rules).toEqual({
      allowedAbilityMethods: {
        "4d6": true,
        pointBuy: true,
        standardArray: false,
      },
      startingLevel: 3,
      allowMulticlass: true,
      equipmentMethod: "both",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    });
  });

  it("toggles pack sources and resets curation state", async () => {
    const mod = await import("./gm-config-app");
    mod.buildGMConfigAppClass();
    const AppClass = mod.getGMConfigAppClass()!;

    const app = new AppClass() as FakeBaseApplication & { _curationLoaded: boolean };
    app._curationLoaded = true;

    const ctor = AppClass as typeof AppClass & {
      _onTogglePack(this: FakeBaseApplication & { _curationLoaded: boolean }, event: Event, target: HTMLElement): Promise<void>;
    };

    await ctor._onTogglePack.call(app, new Event("change"), {
      dataset: { packId: "dnd-players-handbook.spells", typeKey: "spells" },
      checked: true,
    } as unknown as HTMLElement);

    expect(setPackSourcesMock).toHaveBeenCalledWith(expect.objectContaining({
      spells: ["dnd-players-handbook.spells"],
    }));
    expect(invalidateMock).toHaveBeenCalled();
    expect(app._curationLoaded).toBe(false);
    expect(app.render).toHaveBeenCalledWith({ force: false });
  });

  it("saves rule settings from the form and shows a confirmation", async () => {
    const notifications = { info: vi.fn(), warn: vi.fn() };
    getUIMock.mockReturnValue({ notifications });

    const mod = await import("./gm-config-app");
    mod.buildGMConfigAppClass();
    const AppClass = mod.getGMConfigAppClass()!;
    const app = new AppClass() as FakeBaseApplication;

    const form = {
      querySelector: (selector: string) => {
        switch (selector) {
          case '[name="method-4d6"]': return checkbox(true);
          case '[name="method-pointBuy"]': return checkbox(false);
          case '[name="method-standardArray"]': return checkbox(true);
          case '[name="startingLevel"]': return valueInput("5");
          case '[name="allowMulticlass"]': return checkbox(true);
          case '[name="equipmentMethod"]:checked': return valueInput("gold");
          case '[name="level1HpMethod"]:checked': return valueInput("roll");
          case '[name="allowCustomBackgrounds"]': return checkbox(true);
          default: return null;
        }
      },
    };
    app.element = {
      querySelector: (selector: string) => (selector === ".cc-rules-form" ? (form as unknown as Element) : null),
    } as Element;

    const ctor = AppClass as typeof AppClass & {
      _onSaveRules(this: FakeBaseApplication, event: Event, target: HTMLElement): Promise<void>;
    };

    await ctor._onSaveRules.call(app, new Event("submit"), {} as HTMLElement);

    expect(setAllowedAbilityMethodsMock).toHaveBeenCalledWith(["4d6", "standardArray"]);
    expect(setStartingLevelMock).toHaveBeenCalledWith(5);
    expect(setSettingMock).toHaveBeenCalledWith("foundry-tabletop-helpers", "allowMulticlass", true);
    expect(setEquipmentMethodMock).toHaveBeenCalledWith("gold");
    expect(setLevel1HpMethodMock).toHaveBeenCalledWith("roll");
    expect(setSettingMock).toHaveBeenCalledWith("foundry-tabletop-helpers", "allowCustomBackgrounds", true);
    expect(notifications.info).toHaveBeenCalledWith("Character Creator configuration saved.");
  });

  it("normalizes invalid rule combinations before saving from the GM rules tab", async () => {
    const notifications = { info: vi.fn(), warn: vi.fn() };
    getUIMock.mockReturnValue({ notifications });

    const mod = await import("./gm-config-app");
    mod.buildGMConfigAppClass();
    const AppClass = mod.getGMConfigAppClass()!;
    const app = new AppClass() as FakeBaseApplication;

    const form = {
      querySelector: (selector: string) => {
        switch (selector) {
          case '[name="method-4d6"]': return checkbox(false);
          case '[name="method-pointBuy"]': return checkbox(false);
          case '[name="method-standardArray"]': return checkbox(false);
          case '[name="startingLevel"]': return valueInput("99");
          case '[name="allowMulticlass"]': return checkbox(false);
          case '[name="equipmentMethod"]:checked': return valueInput("weird");
          case '[name="level1HpMethod"]:checked': return valueInput("weird");
          case '[name="allowCustomBackgrounds"]': return checkbox(false);
          default: return null;
        }
      },
    };
    app.element = {
      querySelector: (selector: string) => (selector === ".cc-rules-form" ? (form as unknown as Element) : null),
    } as Element;

    const ctor = AppClass as typeof AppClass & {
      _onSaveRules(this: FakeBaseApplication, event: Event, target: HTMLElement): Promise<void>;
    };

    await ctor._onSaveRules.call(app, new Event("submit"), {} as HTMLElement);

    expect(setAllowedAbilityMethodsMock).toHaveBeenCalledWith(["4d6", "pointBuy", "standardArray"]);
    expect(setStartingLevelMock).toHaveBeenCalledWith(99);
    expect(setEquipmentMethodMock).toHaveBeenCalledWith("weird");
    expect(setLevel1HpMethodMock).toHaveBeenCalledWith("weird");
    expect(notifications.warn).toHaveBeenCalledWith(
      "At least one ability score method must remain enabled. Defaulting to all standard methods.",
    );
  });
});
