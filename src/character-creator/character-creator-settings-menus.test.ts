import { beforeEach, describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn();
const getFormApplicationClassMock = vi.fn();
const getGameMock = vi.fn();
const getUIMock = vi.fn();
const setSettingMock = vi.fn(async () => {});
const getPackSourcesMock = vi.fn();
const setPackSourcesMock = vi.fn(async () => {});
const getAllowedAbilityMethodsMock = vi.fn();
const setAllowedAbilityMethodsMock = vi.fn(async () => {});
const getStartingLevelMock = vi.fn();
const setStartingLevelMock = vi.fn(async () => {});
const allowMulticlassMock = vi.fn();
const getEquipmentMethodMock = vi.fn();
const setEquipmentMethodMock = vi.fn(async () => {});
const getLevel1HpMethodMock = vi.fn();
const setLevel1HpMethodMock = vi.fn(async () => {});
const ccEnabledMock = vi.fn();
const ccAutoOpenMock = vi.fn();
const ccLevelUpEnabledMock = vi.fn();
const getMaxRerollsMock = vi.fn();
const setMaxRerollsMock = vi.fn(async () => {});
const loadPacksInvalidateMock = vi.fn();

vi.mock("../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
  },
}));

vi.mock("../types", () => ({
  getFormApplicationClass: getFormApplicationClassMock,
  getGame: getGameMock,
  getUI: getUIMock,
  setSetting: setSettingMock,
}));

vi.mock("./character-creator-settings-accessors", () => ({
  allowMulticlass: allowMulticlassMock,
  ccAutoOpen: ccAutoOpenMock,
  ccEnabled: ccEnabledMock,
  ccLevelUpEnabled: ccLevelUpEnabledMock,
  getAllowedAbilityMethods: getAllowedAbilityMethodsMock,
  getEquipmentMethod: getEquipmentMethodMock,
  getLevel1HpMethod: getLevel1HpMethodMock,
  getMaxRerolls: getMaxRerollsMock,
  getPackSources: getPackSourcesMock,
  getStartingLevel: getStartingLevelMock,
  setAllowedAbilityMethods: setAllowedAbilityMethodsMock,
  setEquipmentMethod: setEquipmentMethodMock,
  setLevel1HpMethod: setLevel1HpMethodMock,
  setMaxRerolls: setMaxRerollsMock,
  setPackSources: setPackSourcesMock,
  setStartingLevel: setStartingLevelMock,
}));

vi.mock("./data/compendium-indexer", () => ({
  compendiumIndexer: {
    invalidate: loadPacksInvalidateMock,
  },
}));

vi.mock("./character-creator-settings-shared", () => ({
  CC_SETTINGS: {
    ENABLED: "enabled",
    AUTO_OPEN: "autoOpen",
    LEVEL_UP_ENABLED: "levelUpEnabled",
    ALLOWED_ABILITY_METHODS: "allowedAbilityMethods",
    MAX_REROLLS: "maxRerolls",
    STARTING_LEVEL: "startingLevel",
    ALLOW_MULTICLASS: "allowMulticlass",
    EQUIPMENT_METHOD: "equipmentMethod",
    LEVEL1_HP_METHOD: "level1HpMethod",
  },
}));

class FakeFormApplication {
  static defaultOptions = { base: true };
  activateListeners(_html: unknown): void {}
  close = vi.fn(async () => {});
}

function installFoundryUtils(): void {
  (globalThis as Record<string, unknown>).foundry = {
    utils: {
      mergeObject: (
        base: Record<string, unknown>,
        extra: Record<string, unknown>,
      ) => ({ ...base, ...extra }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  installFoundryUtils();
  getFormApplicationClassMock.mockReturnValue(FakeFormApplication);
  getUIMock.mockReturnValue({
    notifications: {
      warn: vi.fn(),
      info: vi.fn(),
    },
  });
  getAllowedAbilityMethodsMock.mockReturnValue(["4d6", "pointBuy"]);
  getStartingLevelMock.mockReturnValue(2);
  allowMulticlassMock.mockReturnValue(true);
  getEquipmentMethodMock.mockReturnValue("both");
  getLevel1HpMethodMock.mockReturnValue("max");
  ccEnabledMock.mockReturnValue(true);
  ccAutoOpenMock.mockReturnValue(false);
  ccLevelUpEnabledMock.mockReturnValue(true);
  getMaxRerollsMock.mockReturnValue(3);
  getPackSourcesMock.mockReturnValue({
    classes: ["dnd-players-handbook.classes"],
    subclasses: [],
    races: [],
    backgrounds: [],
    feats: [],
    spells: [],
    items: [],
  });
  getGameMock.mockReturnValue({
    packs: [
      {
        collection: "dnd-players-handbook.classes",
        documentName: "Item",
        metadata: { label: "Character Classes", packageName: "dnd-players-handbook" },
        size: 12,
        getIndex: vi.fn(async () => [
          { _id: "class-1", name: "Wizard", type: "class" },
          { _id: "spell-1", name: "Shield", type: "spell" },
        ]),
      },
      {
        collection: "dnd-players-handbook.spells",
        documentName: "Item",
        metadata: { label: "Spells", packageName: "dnd-players-handbook" },
        size: 40,
        getIndex: vi.fn(async () => [
          { _id: "spell-2", name: "Magic Missile", type: "spell" },
          { _id: "spell-3", name: "Mage Armor", type: "spell" },
        ]),
      },
    ],
  });
});

describe("character creator settings menus", () => {
  it("registers both menu forms with merged default options", async () => {
    const registrations: Array<{ key: string; data: Record<string, unknown> }> = [];
    const mod = await import("./character-creator-settings-menus");

    mod.registerCharacterCreatorSettingsMenus({
      registerMenu: (_module, key, data) => {
        registrations.push({ key, data });
      },
    });

    expect(registrations.map((entry) => entry.key)).toEqual([
      "ccSettingsMenu",
      "ccCompendiumSelectMenu",
    ]);

    const SettingsForm = registrations[0]?.data.type as typeof FakeFormApplication;
    const CompendiumForm = registrations[1]?.data.type as typeof FakeFormApplication;
    expect(SettingsForm.defaultOptions).toMatchObject({
      id: "foundry-tabletop-helpers-cc-settings",
      template: "modules/foundry-tabletop-helpers/templates/character-creator/cc-settings.hbs",
    });
    expect(CompendiumForm.defaultOptions).toMatchObject({
      id: "foundry-tabletop-helpers-cc-compendium-select",
      template: "modules/foundry-tabletop-helpers/templates/character-creator/cc-compendium-select.hbs",
    });
  });

  it("builds settings form data and persists normalized rule settings", async () => {
    const registrations: Array<{ key: string; data: Record<string, unknown> }> = [];
    const notifications = { warn: vi.fn(), info: vi.fn() };
    getUIMock.mockReturnValue({ notifications });

    const mod = await import("./character-creator-settings-menus");
    mod.registerCharacterCreatorSettingsMenus({
      registerMenu: (_module, key, data) => {
        registrations.push({ key, data });
      },
    });

    const SettingsForm = registrations.find((entry) => entry.key === "ccSettingsMenu")?.data.type as
      new () => {
        getData(): Promise<Record<string, unknown>>;
        _updateObject(event: Event, formData: Record<string, unknown>): Promise<void>;
      };
    const form = new SettingsForm();

    await expect(form.getData()).resolves.toMatchObject({
      ccEnabled: true,
      ccAutoOpen: false,
      ccLevelUpEnabled: true,
      method_4d6: true,
      method_pointBuy: true,
      method_standardArray: false,
      maxRerolls: 3,
      startingLevel: 2,
      allowMulticlass: true,
      equipmentMethod: "both",
      level1HpMethod: "max",
    });

    await form._updateObject(new Event("submit"), {
      ccEnabled: true,
      ccAutoOpen: true,
      ccLevelUpEnabled: false,
      method_4d6: false,
      method_pointBuy: false,
      method_standardArray: false,
      maxRerolls: "4.7",
      startingLevel: "25",
      allowMulticlass: false,
      equipmentMethod: "gold",
      level1HpMethod: "roll",
    });

    expect(notifications.warn).toHaveBeenCalledWith(
      "At least one ability score method must be enabled. Defaulting to all standard methods.",
    );
    expect(setAllowedAbilityMethodsMock).toHaveBeenCalledWith(["4d6", "pointBuy", "standardArray"]);
    expect(setMaxRerollsMock).toHaveBeenCalledWith(4.7);
    expect(setStartingLevelMock).toHaveBeenCalledWith(25);
    expect(setEquipmentMethodMock).toHaveBeenCalledWith("gold");
    expect(setLevel1HpMethodMock).toHaveBeenCalledWith("roll");
    expect(notifications.info).toHaveBeenCalledWith("Character Creator settings saved.");
  });

  it("binds explicit submit handling so live form submission persists settings", async () => {
    const registrations: Array<{ key: string; data: Record<string, unknown> }> = [];
    const notifications = { warn: vi.fn(), info: vi.fn() };
    getUIMock.mockReturnValue({ notifications });

    const mod = await import("./character-creator-settings-menus");
    mod.registerCharacterCreatorSettingsMenus({
      registerMenu: (_module, key, data) => {
        registrations.push({ key, data });
      },
    });

    const SettingsForm = registrations.find((entry) => entry.key === "ccSettingsMenu")?.data.type as
      new () => FakeFormApplication & {
        activateListeners(html: unknown): void;
      };
    const formApp = new SettingsForm();

    const listeners = new Map<string, (event: Event) => void | Promise<void>>();
    const form = {
      dataset: {} as Record<string, string>,
      elements: [
        { name: "ccEnabled", disabled: false, type: "checkbox", checked: true },
        { name: "ccAutoOpen", disabled: false, type: "checkbox", checked: false },
        { name: "ccLevelUpEnabled", disabled: false, type: "checkbox", checked: true },
        { name: "method_4d6", disabled: false, type: "checkbox", checked: false },
        { name: "method_pointBuy", disabled: false, type: "checkbox", checked: false },
        { name: "method_standardArray", disabled: false, type: "checkbox", checked: true },
        { name: "maxRerolls", disabled: false, value: "2.9" },
        { name: "startingLevel", disabled: false, value: "6" },
        { name: "allowMulticlass", disabled: false, type: "checkbox", checked: true },
        { name: "equipmentMethod", disabled: false, value: "gold" },
        { name: "level1HpMethod", disabled: false, value: "roll" },
      ],
      addEventListener: vi.fn((type: string, listener: (event: Event) => void | Promise<void>) => {
        listeners.set(type, listener);
      }),
    };
    const host = {
      querySelector: vi.fn(() => form),
    };

    formApp.activateListeners(host);
    const submitEvent = { preventDefault: vi.fn() } as unknown as Event;
    await listeners.get("submit")?.(submitEvent);

    expect(setAllowedAbilityMethodsMock).toHaveBeenCalledWith(["standardArray"]);
    expect(setMaxRerollsMock).toHaveBeenCalledWith(2.9);
    expect(setStartingLevelMock).toHaveBeenCalledWith(6);
    expect(setEquipmentMethodMock).toHaveBeenCalledWith("gold");
    expect(setLevel1HpMethodMock).toHaveBeenCalledWith("roll");
    expect(formApp.close).toHaveBeenCalled();
    expect(notifications.info).toHaveBeenCalledWith("Character Creator settings saved.");
  });

  it("detects compendium groups and persists selected source packs", async () => {
    const registrations: Array<{ key: string; data: Record<string, unknown> }> = [];
    const notifications = { info: vi.fn() };
    getUIMock.mockReturnValue({ notifications });

    const mod = await import("./character-creator-settings-menus");
    mod.registerCharacterCreatorSettingsMenus({
      registerMenu: (_module, key, data) => {
        registrations.push({ key, data });
      },
    });

    const CompendiumForm = registrations.find((entry) => entry.key === "ccCompendiumSelectMenu")?.data.type as
      new () => {
        getData(): Promise<Record<string, unknown>>;
        _updateObject(event: Event, formData: Record<string, unknown>): Promise<void>;
      };
    const form = new CompendiumForm();

    const data = await form.getData();
    expect(data.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "classes",
        type: "class",
        packs: [expect.objectContaining({
          collection: "dnd-players-handbook.classes",
          enabled: true,
          itemCount: 2,
          sourceBadge: "Core 2024",
        })],
      }),
      expect.objectContaining({
        sourceKey: "spells",
        type: "spell",
        packs: expect.arrayContaining([
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
        ]),
      }),
    ]));

    await form._updateObject(new Event("submit"), {
      "pack__classes__dnd-players-handbook.classes": true,
      "pack__spells__dnd-players-handbook.spells": true,
      ignore_me: true,
    });

    expect(setPackSourcesMock).toHaveBeenCalledWith({
      classes: ["dnd-players-handbook.classes"],
      subclasses: [],
      races: [],
      backgrounds: [],
      feats: [],
      spells: ["dnd-players-handbook.spells"],
      items: [],
    });
    expect(loadPacksInvalidateMock).toHaveBeenCalled();
    expect(notifications.info).toHaveBeenCalledWith(
      "Compendium sources updated. Changes take effect on next wizard open.",
    );
  });
});
