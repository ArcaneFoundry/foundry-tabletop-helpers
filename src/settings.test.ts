import { afterEach, describe, expect, it } from "vitest";

import { MOD } from "./logger";
import {
  canUsePrintFeature,
  getDefaultPrintOptions,
  getKioskCanvasMode,
  getPrintDefaults,
  isKioskPlayer,
  rotateButtonPlayerIds,
  rotationMode,
  setPrintDefaults,
  shouldShowRotateButton,
  targetUserIds,
} from "./settings";
import { registerCoreSettings, registerMenuBackingSettings, registerPrintSettings } from "./settings-registrations";
import { printDefaultsSettingKey } from "./settings-utils";
import { FTH_THEME_MODE_SETTING_KEY } from "./ui/theme/fth-theme";

interface RegisteredSetting {
  module: string;
  key: string;
  data: Record<string, unknown>;
}

function createSettingsHarness(options?: {
  userId?: string;
  isGM?: boolean;
}) {
  const registrations: RegisteredSetting[] = [];
  const store = new Map<string, unknown>();

  const settings = {
    register(module: string, key: string, data: Record<string, unknown>) {
      registrations.push({ module, key, data });
      if ("default" in data) {
        store.set(`${module}.${key}`, data.default);
      }
    },
    get(module: string, key: string) {
      return store.get(`${module}.${key}`);
    },
    async set(module: string, key: string, value: unknown) {
      store.set(`${module}.${key}`, value);
      return value;
    },
  };

  const game = {
    user: {
      id: options?.userId ?? "user-1",
      isGM: options?.isGM ?? false,
    },
    settings,
  };

  return { game, settings, registrations, store };
}

describe("settings behavior", () => {
  const originalGame = (globalThis as Record<string, unknown>).game;

  afterEach(() => {
    (globalThis as Record<string, unknown>).game = originalGame;
  });

  it("registers serialized print defaults and round-trips saved print options", async () => {
    const { game, settings, registrations, store } = createSettingsHarness();
    (globalThis as Record<string, unknown>).game = game;

    registerPrintSettings(settings, getDefaultPrintOptions);

    expect(registrations).toContainEqual(expect.objectContaining({
      module: MOD,
      key: printDefaultsSettingKey("character"),
      data: expect.objectContaining({
        default: JSON.stringify(getDefaultPrintOptions("character")),
      }),
    }));

    expect(getPrintDefaults("character")).toEqual(getDefaultPrintOptions("character"));

    const updated = {
      paperSize: "a4" as const,
      portrait: "portrait" as const,
      sections: {
        ...getDefaultPrintOptions("character").sections,
        spells: false,
      },
    };

    await setPrintDefaults("character", updated);

    expect(store.get(`${MOD}.${printDefaultsSettingKey("character")}`)).toBe(JSON.stringify(updated));
    expect(getPrintDefaults("character")).toEqual(updated);
  });

  it("parses stored csv-backed menu settings and user gating through accessors", () => {
    const { game, settings } = createSettingsHarness({ userId: "user-2" });
    (globalThis as Record<string, unknown>).game = game;

    registerMenuBackingSettings(settings);
    void settings.set(MOD, "targetUserIds", " user-1, user-2 ,, user-3 ");
    void settings.set(MOD, "rotateButtonPlayerIds", "user-2");
    void settings.set(MOD, "kioskPlayerIds", "user-9, user-2");
    void settings.set(MOD, "rotationMode", "180");
    void settings.set(MOD, "kioskCanvasMode", "low");

    expect(targetUserIds()).toEqual(["user-1", "user-2", "user-3"]);
    expect(rotateButtonPlayerIds()).toEqual(["user-2"]);
    expect(shouldShowRotateButton()).toBe(true);
    expect(isKioskPlayer()).toBe(true);
    expect(rotationMode()).toBe(180);
    expect(getKioskCanvasMode()).toBe("low");
  });

  it("gates print access by gm status and falls back for invalid stored values", () => {
    const { game, settings } = createSettingsHarness({ isGM: false });
    (globalThis as Record<string, unknown>).game = game;

    registerPrintSettings(settings, getDefaultPrintOptions);
    void settings.set(MOD, "printAccess", "gm");
    void settings.set(MOD, "rotationMode", "weird");
    void settings.set(MOD, "kioskCanvasMode", "weird");

    expect(canUsePrintFeature()).toBe(false);
    expect(rotationMode()).toBe(90);
    expect(getKioskCanvasMode()).toBe("disable");

    game.user.isGM = true;
    expect(canUsePrintFeature()).toBe(true);
  });

  it("registers the per-user theme mode setting", () => {
    const { settings, registrations } = createSettingsHarness();

    registerCoreSettings(settings);

    expect(registrations).toContainEqual(expect.objectContaining({
      module: MOD,
      key: FTH_THEME_MODE_SETTING_KEY,
      data: expect.objectContaining({
        default: "system",
        scope: "client",
        choices: expect.objectContaining({
          system: "System",
          light: "Light",
          dark: "Dark",
        }),
      }),
    }));
  });
});
