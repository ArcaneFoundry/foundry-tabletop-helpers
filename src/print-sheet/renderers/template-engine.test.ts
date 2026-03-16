import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  infoMock,
  warnMock,
  errorMock,
  getHandlebarsMock,
} = vi.hoisted(() => ({
  infoMock: vi.fn(),
  warnMock: vi.fn(),
  errorMock: vi.fn(),
  getHandlebarsMock: vi.fn(),
}));

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    debug: vi.fn(),
  },
}));

vi.mock("../../types", () => ({
  getHandlebars: getHandlebarsMock,
}));

function setGlobal(name: string, value: unknown): void {
  (globalThis as Record<string, unknown>)[name] = value;
}

describe("template engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).foundry;
    delete (globalThis as Record<string, unknown>).loadTemplates;
    delete (globalThis as Record<string, unknown>).renderTemplate;
  });

  it("registers print helpers only when they are missing", async () => {
    const registerHelper = vi.fn();
    const SafeString = vi.fn((value: string) => ({ value }));
    getHandlebarsMock.mockReturnValue({
      helpers: { eq: true },
      registerHelper,
      SafeString,
    });

    const { registerPrintHelpers } = await import("./template-engine");
    registerPrintHelpers();

    expect(registerHelper).toHaveBeenCalledTimes(4);
    expect(registerHelper).toHaveBeenCalledWith("neq", expect.any(Function));
    expect(registerHelper).toHaveBeenCalledWith("and", expect.any(Function));
    expect(registerHelper).toHaveBeenCalledWith("or", expect.any(Function));
    expect(registerHelper).toHaveBeenCalledWith("safeHtml", expect.any(Function));
  });

  it("preloads templates through the namespaced Foundry loader and falls back gracefully", async () => {
    const loadTemplates = vi.fn().mockResolvedValue(undefined);
    setGlobal("foundry", {
      applications: {
        handlebars: {
          loadTemplates,
        },
      },
    });

    const { preloadPrintTemplates } = await import("./template-engine");
    await preloadPrintTemplates();

    expect(loadTemplates).toHaveBeenCalledWith([
      "modules/foundry-tabletop-helpers/templates/print/npc/statblock.hbs",
      "modules/foundry-tabletop-helpers/templates/print/character/pro-sheet.hbs",
      "modules/foundry-tabletop-helpers/templates/print/party/summary.hbs",
      "modules/foundry-tabletop-helpers/templates/print/encounter/group.hbs",
    ]);
    expect(infoMock).toHaveBeenCalledWith("Print templates preloaded", { count: 4 });

    delete (globalThis as Record<string, unknown>).foundry;
    await preloadPrintTemplates();
    expect(warnMock).toHaveBeenCalledWith("loadTemplates not available - templates will load on demand");
  });

  it("renders template wrappers and rethrows rendering failures", async () => {
    const renderTemplate = vi.fn()
      .mockResolvedValueOnce("<article>npc</article>")
      .mockRejectedValueOnce(new Error("boom"));
    setGlobal("renderTemplate", renderTemplate);

    const {
      renderNPCStatBlock,
      renderCharacterSheet,
    } = await import("./template-engine");

    await expect(renderNPCStatBlock({ name: "Dragon" })).resolves.toBe("<article>npc</article>");
    expect(renderTemplate).toHaveBeenCalledWith(
      "modules/foundry-tabletop-helpers/templates/print/npc/statblock.hbs",
      { name: "Dragon" },
    );

    await expect(renderCharacterSheet({ name: "Hero" })).rejects.toThrow("boom");
    expect(errorMock).toHaveBeenCalledWith("Template render failed", expect.objectContaining({
      templatePath: "modules/foundry-tabletop-helpers/templates/print/character/pro-sheet.hbs",
    }));
  });
});
