import { beforeEach, describe, expect, it, vi } from "vitest";

type SceneTool = {
  name: string;
  title: string;
  icon: string;
  order: number;
  button: boolean;
  visible: boolean;
  onChange: () => void;
};

const setLevelMock = vi.fn();
const infoMock = vi.fn();
const debugMock = vi.fn();
const registerSettingsMock = vi.fn();
const registerWindowRotationHooksMock = vi.fn();
const initWindowRotationReadyMock = vi.fn();
const registerPrintSheetHooksMock = vi.fn();
const registerLPCSSettingsMock = vi.fn();
const registerLPCSSheetMock = vi.fn();
const preloadLPCSTemplatesMock = vi.fn(async () => {});
const autoOpenLPCSMock = vi.fn();
const registerInitiativeSettingsMock = vi.fn();
const registerInitiativeHooksMock = vi.fn();
const initKioskSetupMock = vi.fn();
const initKioskReadyMock = vi.fn();
const registerCombatSettingsMock = vi.fn();
const registerCombatHooksMock = vi.fn();
const initCombatReadyMock = vi.fn();
const registerAssetManagerSettingsMock = vi.fn();
const registerAssetManagerPickerMock = vi.fn();
const openAssetManagerMock = vi.fn();
const isAssetManagerEnabledMock = vi.fn(() => true);
const registerCharacterCreatorSettingsMock = vi.fn();
const registerCharacterCreatorHooksMock = vi.fn();
const initCharacterCreatorReadyMock = vi.fn();
const attachFthApiMock = vi.fn();
const registerSoundscapeSettingsMock = vi.fn();

vi.mock("./logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    setLevel: setLevelMock,
    info: infoMock,
    debug: debugMock,
  },
}));

vi.mock("./settings", () => ({
  registerSettings: registerSettingsMock,
}));

vi.mock("./print-sheet/print-sheet", () => ({
  registerPrintSheetHooks: registerPrintSheetHooksMock,
}));

vi.mock("./window-rotation/index", () => ({
  registerWindowRotationHooks: registerWindowRotationHooksMock,
  initWindowRotationReady: initWindowRotationReadyMock,
}));

vi.mock("./lpcs/lpcs-settings", () => ({
  registerLPCSSettings: registerLPCSSettingsMock,
}));

vi.mock("./lpcs/lpcs-sheet", () => ({
  registerLPCSSheet: registerLPCSSheetMock,
  preloadLPCSTemplates: preloadLPCSTemplatesMock,
}));

vi.mock("./lpcs/lpcs-auto-open", () => ({
  autoOpenLPCS: autoOpenLPCSMock,
}));

vi.mock("./initiative/initiative-dialog", () => ({
  registerInitiativeSettings: registerInitiativeSettingsMock,
  registerInitiativeHooks: registerInitiativeHooksMock,
}));

vi.mock("./kiosk/kiosk-init", () => ({
  initKioskSetup: initKioskSetupMock,
  initKioskReady: initKioskReadyMock,
}));

vi.mock("./combat/combat-settings", () => ({
  registerCombatSettings: registerCombatSettingsMock,
}));

vi.mock("./combat/combat-init", () => ({
  registerCombatHooks: registerCombatHooksMock,
  initCombatReady: initCombatReadyMock,
}));

vi.mock("./asset-manager/asset-manager-settings", () => ({
  registerAssetManagerSettings: registerAssetManagerSettingsMock,
  isAssetManagerEnabled: isAssetManagerEnabledMock,
  loadSavedPresets: vi.fn(),
}));

vi.mock("./asset-manager/asset-manager-picker", () => ({
  registerAssetManagerPicker: registerAssetManagerPickerMock,
  openAssetManager: openAssetManagerMock,
}));

vi.mock("./character-creator/character-creator-init", () => ({
  registerCharacterCreatorSettings: registerCharacterCreatorSettingsMock,
  registerCharacterCreatorHooks: registerCharacterCreatorHooksMock,
  initCharacterCreatorReady: initCharacterCreatorReadyMock,
}));

vi.mock("./fth-api", () => ({
  attachFthApi: attachFthApiMock,
}));

vi.mock("./soundscapes/soundscape-settings", () => ({
  registerSoundscapeSettings: registerSoundscapeSettingsMock,
}));

describe("index shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAssetManagerEnabledMock.mockReturnValue(true);

    (globalThis as Record<string, unknown>).Hooks = {
      on: vi.fn(),
    };
    (globalThis as Record<string, unknown>).game = {
      version: "13.0",
      system: { id: "dnd5e" },
      user: { id: "user-1", isGM: true },
      settings: {
        register: vi.fn(),
        registerMenu: vi.fn(),
        get: vi.fn((module: string, key: string) => {
          if (module === "foundry-tabletop-helpers" && key === "logLevel") return "debug";
          return undefined;
        }),
      },
    };
  });

  it("registers init/setup/ready hooks on import", async () => {
    await import("./index");

    const hooksOn = ((globalThis as Record<string, unknown>).Hooks as { on: ReturnType<typeof vi.fn> }).on;
    expect(hooksOn).toHaveBeenCalledWith("init", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("setup", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("ready", expect.any(Function));
  });

  it("runs init wiring and injects the asset manager scene control", async () => {
    const mod = await import("./index");
    const settings = ((globalThis as Record<string, unknown>).game as {
      settings: { register: ReturnType<typeof vi.fn>; registerMenu: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    }).settings;

    mod.__indexInternals.onInit();

    expect(registerSettingsMock).toHaveBeenCalledTimes(1);
    expect(registerWindowRotationHooksMock).toHaveBeenCalledTimes(1);
    expect(registerPrintSheetHooksMock).toHaveBeenCalledTimes(1);
    expect(registerLPCSSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerInitiativeSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerCombatSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerAssetManagerSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerCharacterCreatorSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerSoundscapeSettingsMock).toHaveBeenCalledWith(settings);
    expect(registerLPCSSheetMock).toHaveBeenCalledTimes(1);
    expect(preloadLPCSTemplatesMock).toHaveBeenCalledTimes(1);
    expect(registerInitiativeHooksMock).toHaveBeenCalledTimes(1);
    expect(registerCombatHooksMock).toHaveBeenCalledTimes(1);
    expect(registerCharacterCreatorHooksMock).toHaveBeenCalledTimes(1);
    expect(setLevelMock).toHaveBeenCalledWith("debug");
    expect(infoMock).toHaveBeenCalledWith("init");

    const controls = {
      tokens: {
        tools: {
          select: {
            name: "select",
            title: "Select",
            icon: "fa-solid fa-expand",
            order: 0,
            button: true,
            visible: true,
            onChange: () => undefined,
          },
        } as Record<string, SceneTool>,
      },
    };

    mod.__indexInternals.onGetSceneControlButtonsAssetManager(controls);

    expect(controls.tokens.tools["fth-asset-manager"]).toMatchObject({
      name: "fth-asset-manager",
      title: "Asset Manager",
      order: 1,
      button: true,
      visible: true,
    });

    controls.tokens.tools["fth-asset-manager"]?.onChange();
    expect(openAssetManagerMock).toHaveBeenCalledTimes(1);
  });

  it("runs setup and ready wiring", async () => {
    const mod = await import("./index");

    mod.__indexInternals.onSetup();
    expect(registerAssetManagerPickerMock).toHaveBeenCalledTimes(1);
    expect(initKioskSetupMock).toHaveBeenCalledTimes(1);

    mod.__indexInternals.onReady();
    expect(initWindowRotationReadyMock).toHaveBeenCalledTimes(1);
    expect(initKioskReadyMock).toHaveBeenCalledTimes(1);
    expect(autoOpenLPCSMock).toHaveBeenCalledTimes(1);
    expect(initCombatReadyMock).toHaveBeenCalledTimes(1);
    expect(initCharacterCreatorReadyMock).toHaveBeenCalledTimes(1);
    expect(attachFthApiMock).toHaveBeenCalledTimes(1);
    expect(debugMock).toHaveBeenCalledWith("window.fth API attached");
  });
});
