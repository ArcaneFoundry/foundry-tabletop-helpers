import { beforeEach, describe, expect, it, vi } from "vitest";

const setLevelMock = vi.fn();
const openAssetManagerMock = vi.fn();
const buildCombatApiMock = vi.fn(() => ({
  batchInitiative: vi.fn(),
}));
const openCharacterCreatorWizardMock = vi.fn();
const openGMConfigAppMock = vi.fn();
const openLevelUpWizardMock = vi.fn();
const buildRotationApiMock = vi.fn(() => ({
  rotateAll: vi.fn(),
}));
const buildSoundscapeApiMock = vi.fn(() => ({
  soundscapes: {
    getLibrary: vi.fn(),
    resolve: vi.fn(),
    openStudio: vi.fn(),
    syncMusic: vi.fn(async () => ({})),
    stopMusic: vi.fn(async () => {}),
    getMusicState: vi.fn(() => ({})),
    syncAmbience: vi.fn(async () => ({})),
    stopAmbience: vi.fn(async () => {}),
    getAmbienceState: vi.fn(() => ({})),
    playMoment: vi.fn(async () => ({})),
  },
}));

vi.mock("./logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    setLevel: setLevelMock,
  },
}));

vi.mock("./asset-manager/asset-manager-picker", () => ({
  openAssetManager: openAssetManagerMock,
}));

vi.mock("./combat/combat-init", () => ({
  buildCombatApi: buildCombatApiMock,
}));

vi.mock("./character-creator/character-creator-init", () => ({
  openCharacterCreatorWizard: openCharacterCreatorWizardMock,
  openGMConfigApp: openGMConfigAppMock,
  openLevelUpWizard: openLevelUpWizardMock,
}));

vi.mock("./window-rotation/index", () => ({
  buildRotationApi: buildRotationApiMock,
}));

vi.mock("./soundscapes/soundscape-api", () => ({
  buildSoundscapeApi: buildSoundscapeApiMock,
}));

describe("fth api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (globalThis as Record<string, unknown>).game = {
      modules: new Map([
        ["foundry-tabletop-helpers", { version: "1.2.3" }],
      ]),
    };
    (globalThis as Record<string, unknown>).window = {};
  });

  it("builds the public api facade and routes commands to feature entry points", async () => {
    const mod = await import("./fth-api");
    const api = mod.buildFthApi();

    expect(buildRotationApiMock).toHaveBeenCalledTimes(1);
    expect(buildCombatApiMock).toHaveBeenCalledTimes(1);
    expect(buildSoundscapeApiMock).toHaveBeenCalledTimes(1);
    expect(api.version).toBe("1.2.3");

    api.setLevel("debug");
    api.assetManager();
    api.characterCreator();
    api.characterCreatorConfig();
    api.levelUp("actor-1");
    api.soundscapes.getLibrary();
    api.soundscapes.resolve();
    api.soundscapes.openStudio();
    await api.soundscapes.syncMusic();
    await api.soundscapes.stopMusic();
    api.soundscapes.getMusicState();
    await api.soundscapes.syncAmbience();
    await api.soundscapes.stopAmbience();
    api.soundscapes.getAmbienceState();
    await api.soundscapes.playMoment("sting");

    expect(setLevelMock).toHaveBeenCalledWith("debug");
    expect(openAssetManagerMock).toHaveBeenCalledTimes(1);
    expect(openCharacterCreatorWizardMock).toHaveBeenCalledTimes(1);
    expect(openGMConfigAppMock).toHaveBeenCalledTimes(1);
    expect(openLevelUpWizardMock).toHaveBeenCalledWith("actor-1");
  });

  it("attaches the built api to window.fth", async () => {
    const mod = await import("./fth-api");
    const api = mod.attachFthApi();

    expect(mod.__fthApiInternals.getWindow()?.fth).toBe(api);
  });

  it("returns an undefined version when the module entry is unavailable", async () => {
    (globalThis as Record<string, unknown>).game = {
      modules: new Map(),
    };

    const mod = await import("./fth-api");

    expect(mod.__fthApiInternals.getFthVersion()).toBeUndefined();
    expect(mod.buildFthApi().version).toBeUndefined();
  });
});
