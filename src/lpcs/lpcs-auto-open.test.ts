import { beforeEach, describe, expect, it, vi } from "vitest";

const infoMock = vi.fn();
const warnMock = vi.fn();
const debugMock = vi.fn();
const lpcsEnabledMock = vi.fn(() => true);
const lpcsAutoOpenMock = vi.fn(() => true);
const isKioskPlayerMock = vi.fn(() => false);

vi.mock("../logger", () => ({
  Log: {
    info: infoMock,
    warn: warnMock,
    debug: debugMock,
  },
}));

vi.mock("./lpcs-settings", () => ({
  lpcsEnabled: lpcsEnabledMock,
  lpcsAutoOpen: lpcsAutoOpenMock,
}));

vi.mock("../settings", () => ({
  isKioskPlayer: isKioskPlayerMock,
}));

describe("lpcs auto-open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lpcsEnabledMock.mockReturnValue(true);
    lpcsAutoOpenMock.mockReturnValue(true);
    isKioskPlayerMock.mockReturnValue(false);
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: {
        isGM: false,
        character: {
          name: "Mira",
          sheet: {
            render: vi.fn(),
          },
        },
      },
    };
  });

  it("opens the assigned character sheet for eligible non-GM players", async () => {
    const mod = await import("./lpcs-auto-open");
    const render = ((((globalThis as Record<string, unknown>).game as {
      user: { character: { sheet: { render: ReturnType<typeof vi.fn> } } };
    }).user.character.sheet.render));

    mod.autoOpenLPCS();

    expect(render).toHaveBeenCalledWith({ force: true });
    expect(infoMock).toHaveBeenCalledWith("LPCS auto-open: opened sheet for", "Mira");
  });

  it("reports skip reasons for disabled, GM, kiosk, and non-dnd5e conditions", async () => {
    const mod = await import("./lpcs-auto-open");

    lpcsEnabledMock.mockReturnValue(false);
    expect(mod.__lpcsAutoOpenInternals.getAutoOpenSkipReason()).toBe("LPCS auto-open: feature disabled");

    lpcsEnabledMock.mockReturnValue(true);
    lpcsAutoOpenMock.mockReturnValue(false);
    expect(mod.__lpcsAutoOpenInternals.getAutoOpenSkipReason()).toBe("LPCS auto-open: setting disabled");

    lpcsAutoOpenMock.mockReturnValue(true);
    (globalThis as Record<string, unknown>).game = {
      system: { id: "pf2e" },
      user: { isGM: false },
    };
    expect(mod.__lpcsAutoOpenInternals.getAutoOpenSkipReason()).toBe("LPCS auto-open: not a dnd5e world");

    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: true },
    };
    expect(mod.__lpcsAutoOpenInternals.getAutoOpenSkipReason()).toBe("LPCS auto-open: skipped for GM");

    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: false },
    };
    isKioskPlayerMock.mockReturnValue(true);
    expect(mod.__lpcsAutoOpenInternals.getAutoOpenSkipReason()).toBe(
      "LPCS auto-open: skipped for kiosk player (kiosk handles sheet)",
    );
  });

  it("returns null when no assigned character exists and logs the missing-character path", async () => {
    const mod = await import("./lpcs-auto-open");
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: { isGM: false, character: null },
    };

    expect(mod.__lpcsAutoOpenInternals.getAssignedCharacter()).toBeNull();

    mod.autoOpenLPCS();
    expect(debugMock).toHaveBeenCalledWith("LPCS auto-open: no assigned character");
  });

  it("warns when sheet rendering throws", async () => {
    const mod = await import("./lpcs-auto-open");
    (globalThis as Record<string, unknown>).game = {
      system: { id: "dnd5e" },
      user: {
        isGM: false,
        character: {
          name: "Mira",
          sheet: {
            render: vi.fn(() => {
              throw new Error("boom");
            }),
          },
        },
      },
    };

    mod.autoOpenLPCS();

    expect(warnMock).toHaveBeenCalledWith("LPCS auto-open: failed to open sheet", expect.any(Error));
  });
});
