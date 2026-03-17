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

const infoMock = vi.fn();
const buildGMConfigAppClassMock = vi.fn();
const buildCharacterCreatorAppClassMock = vi.fn();
const openCharacterCreatorWizardMock = vi.fn();
const registerAllStepsMock = vi.fn();
const registerLevelUpHooksMock = vi.fn();
const registerSettingsMock = vi.fn();
const ccEnabledMock = vi.fn(() => true);
const ccAutoOpenMock = vi.fn(() => true);

vi.mock("../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    info: infoMock,
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("./character-creator-settings", () => ({
  registerCharacterCreatorSettings: registerSettingsMock,
  ccEnabled: ccEnabledMock,
  ccAutoOpen: ccAutoOpenMock,
}));

vi.mock("./gm-config/gm-config-app", () => ({
  buildGMConfigAppClass: buildGMConfigAppClassMock,
  openGMConfigApp: vi.fn(),
}));

vi.mock("./wizard/character-creator-app", () => ({
  buildCharacterCreatorAppClass: buildCharacterCreatorAppClassMock,
  openCharacterCreatorWizard: openCharacterCreatorWizardMock,
}));

vi.mock("./wizard/step-registry", () => ({
  registerAllSteps: registerAllStepsMock,
}));

vi.mock("./level-up/level-up-init", () => ({
  registerLevelUpHooks: registerLevelUpHooksMock,
  openLevelUpWizard: vi.fn(),
}));

vi.mock("./level-up/level-up-detection", () => ({
  shouldShowLevelUp: vi.fn(() => false),
}));

describe("character creator init shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const loadTemplatesMock = vi.fn();
    const namespacedLoadTemplatesMock = vi.fn();
    const hooksOn = vi.fn();

    (globalThis as Record<string, unknown>).loadTemplates = loadTemplatesMock;
    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        handlebars: {
          loadTemplates: namespacedLoadTemplatesMock,
        },
      },
    };
    (globalThis as Record<string, unknown>).Hooks = {
      on: hooksOn,
    };
    (globalThis as Record<string, unknown>).ui = {
      notifications: {
        info: vi.fn(),
      },
    };
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true, character: { id: "actor-1" } },
      socket: {
        on: vi.fn(),
      },
    };
  });

  it("builds app classes, registers steps/level-up hooks, preloads templates, and hooks scene controls", async () => {
    const mod = await import("./character-creator-init");
    const namespacedLoadTemplatesMock = (
      (globalThis as Record<string, unknown>).foundry as {
        applications: { handlebars: { loadTemplates: ReturnType<typeof vi.fn> } };
      }
    ).applications.handlebars.loadTemplates;
    const loadTemplatesMock = (globalThis as Record<string, unknown>).loadTemplates as ReturnType<typeof vi.fn>;
    const hooksOn = ((globalThis as Record<string, unknown>).Hooks as { on: ReturnType<typeof vi.fn> }).on;

    mod.registerCharacterCreatorHooks();

    expect(buildGMConfigAppClassMock).toHaveBeenCalledTimes(1);
    expect(buildCharacterCreatorAppClassMock).toHaveBeenCalledTimes(1);
    expect(registerAllStepsMock).toHaveBeenCalledTimes(1);
    expect(registerLevelUpHooksMock).toHaveBeenCalledTimes(1);
    expect(namespacedLoadTemplatesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "modules/foundry-tabletop-helpers/templates/character-creator/cc-shell.hbs",
        "modules/foundry-tabletop-helpers/templates/character-creator/cc-step-background-grants.hbs",
      ]),
    );
    expect(loadTemplatesMock).not.toHaveBeenCalled();
    expect(hooksOn).toHaveBeenCalledWith(
      "getSceneControlButtons",
      expect.any(Function),
    );
  });

  it("adds a character creator scene tool and routes clicks to the wizard", async () => {
    const mod = await import("./character-creator-init");

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

    mod.__characterCreatorInitInternals.onGetSceneControlButtons(controls);

    expect(controls.tokens.tools["fth-character-creator"]).toMatchObject({
      name: "fth-character-creator",
      title: "Character Creator",
      order: 1,
      button: true,
      visible: true,
    });

    controls.tokens.tools["fth-character-creator"]?.onChange();
    expect(openCharacterCreatorWizardMock).toHaveBeenCalledTimes(1);
  });

  it("registers the GM socket listener and shows notifications for character-created payloads", async () => {
    const socketOn = vi.fn();
    const notifyInfo = vi.fn();
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true, character: { id: "actor-1" } },
      socket: { on: socketOn },
    };
    (globalThis as Record<string, unknown>).ui = {
      notifications: { info: notifyInfo },
    };

    const mod = await import("./character-creator-init");
    mod.initCharacterCreatorReady();

    expect(socketOn).toHaveBeenCalledWith("module.foundry-tabletop-helpers", expect.any(Function));

    const handler = socketOn.mock.calls[0]?.[1] as ((payload: unknown) => void) | undefined;
    expect(handler).toBeTypeOf("function");
    if (!handler) throw new Error("Expected socket handler registration");

    handler({ action: "characterCreated", characterName: "Arannis", userName: "Player One" });

    expect(notifyInfo).toHaveBeenCalledWith("Player One created a new character: Arannis");
    expect(infoMock).toHaveBeenCalledWith('Character Creator: Player One created "Arannis"');
  });

  it("auto-opens the wizard only for characterless non-GM players when enabled", async () => {
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: false, character: null },
    };

    const mod = await import("./character-creator-init");
    mod.initCharacterCreatorReady();

    expect(openCharacterCreatorWizardMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith("Character Creator: auto-opening for characterless player");
  });
});
