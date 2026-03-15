import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrintOptions, SectionDef } from "./types";

const {
  hooksOn,
  getGameMock,
  getUIMock,
  getExtractorMock,
  getRendererMock,
  showPrintOptionsDialogMock,
  openPrintWindowMock,
  openPreviewWindowMock,
  preloadPrintTemplatesMock,
  registerPrintHelpersMock,
  getPrintDefaultsMock,
  canUsePrintFeatureMock,
  showPrintOptionsDialogSettingMock,
} = vi.hoisted(() => ({
  hooksOn: vi.fn(),
  getGameMock: vi.fn(),
  getUIMock: vi.fn(),
  getExtractorMock: vi.fn(),
  getRendererMock: vi.fn(),
  showPrintOptionsDialogMock: vi.fn(),
  openPrintWindowMock: vi.fn(),
  openPreviewWindowMock: vi.fn(),
  preloadPrintTemplatesMock: vi.fn(),
  registerPrintHelpersMock: vi.fn(),
  getPrintDefaultsMock: vi.fn(),
  canUsePrintFeatureMock: vi.fn(),
  showPrintOptionsDialogSettingMock: vi.fn(),
}));

vi.mock("../logger", () => ({
  Log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../types", () => ({
  getHooks: () => ({ on: hooksOn }),
  getGame: getGameMock,
  getUI: getUIMock,
}));

vi.mock("../settings", () => ({
  getPrintDefaults: getPrintDefaultsMock,
  canUsePrintFeature: canUsePrintFeatureMock,
  showPrintOptionsDialog: showPrintOptionsDialogSettingMock,
}));

vi.mock("./extractors/base-extractor", () => ({
  getExtractor: getExtractorMock,
}));

vi.mock("./renderers/base-renderer", () => ({
  getRenderer: getRendererMock,
}));

vi.mock("./print-options-dialog", () => ({
  showPrintOptionsDialog: showPrintOptionsDialogMock,
}));

vi.mock("./print-window", () => ({
  openPrintWindow: openPrintWindowMock,
  openPreviewWindow: openPreviewWindowMock,
}));

vi.mock("./renderers/template-engine", () => ({
  preloadPrintTemplates: preloadPrintTemplatesMock,
  registerPrintHelpers: registerPrintHelpersMock,
}));

vi.mock("./extractors/dnd5e-extractor", () => ({}));
vi.mock("./renderers/dnd5e-renderer", () => ({}));

function makeOptions(): PrintOptions {
  return {
    paperSize: "letter",
    portrait: "token",
    sections: { stats: true, actions: true },
  };
}

function makeSections(): SectionDef[] {
  return [
    { key: "stats", label: "Stats", default: true },
    { key: "actions", label: "Actions", default: true },
  ];
}

function getHeaderHook(): (app: unknown, controls: Record<string, unknown>[]) => void {
  return hooksOn.mock.calls.find((call) => call[0] === "getHeaderControlsApplicationV2")?.[1] as
    (app: unknown, controls: Record<string, unknown>[]) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  getGameMock.mockReturnValue({ system: { id: "dnd5e" } });
  getUIMock.mockReturnValue({ notifications: { warn: vi.fn(), error: vi.fn() } });
  canUsePrintFeatureMock.mockReturnValue(true);
  showPrintOptionsDialogSettingMock.mockReturnValue(true);
  getPrintDefaultsMock.mockReturnValue(makeOptions());
  showPrintOptionsDialogMock.mockResolvedValue(makeOptions());
  preloadPrintTemplatesMock.mockResolvedValue(undefined);

  getExtractorMock.mockReturnValue({
    getSections: vi.fn(() => makeSections()),
    extractCharacter: vi.fn().mockResolvedValue({ kind: "character-data" }),
    extractNPC: vi.fn().mockResolvedValue({ kind: "npc-data" }),
    extractEncounterGroup: vi.fn().mockResolvedValue({ kind: "encounter-data" }),
    extractPartySummary: vi.fn().mockResolvedValue({ kind: "party-data" }),
  });

  getRendererMock.mockReturnValue({
    renderCharacter: vi.fn().mockResolvedValue("<article>character</article>"),
    renderNPC: vi.fn().mockResolvedValue("<article>npc</article>"),
    renderEncounterGroup: vi.fn().mockResolvedValue("<article>encounter</article>"),
    renderPartySummary: vi.fn().mockResolvedValue("<article>party</article>"),
    getStyles: vi.fn(() => ".sheet{}"),
  });
});

describe("print sheet shell", () => {
  it("registers helpers/templates and adds preview/print controls for printable actor sheets", async () => {
    const mod = await import("./print-sheet");
    mod.registerPrintSheetHooks();

    expect(registerPrintHelpersMock).toHaveBeenCalledTimes(1);
    expect(preloadPrintTemplatesMock).toHaveBeenCalledTimes(1);
    expect(hooksOn).toHaveBeenCalledWith("getHeaderControlsApplicationV2", expect.any(Function));

    const controls: Record<string, unknown>[] = [];
    getHeaderHook()({
      document: {
        name: "Arannis",
        type: "character",
        documentName: "Actor",
      },
      constructor: { name: "ActorSheetV2" },
    }, controls);

    expect(controls).toHaveLength(2);
    expect(controls.map((control) => control.action)).toEqual([
      "fth-print-sheet",
      "fth-preview-sheet",
    ]);
  });

  it("uses dialog options and opens a preview window for character sheets", async () => {
    const mod = await import("./print-sheet");
    mod.registerPrintSheetHooks();

    const controls: Record<string, unknown>[] = [];
    const app = {
      document: {
        name: "Arannis",
        type: "character",
        documentName: "Actor",
      },
      constructor: { name: "ActorSheetV2" },
    };
    getHeaderHook()(app, controls);

    const preview = controls.find((control) => control.action === "fth-preview-sheet");
    await (preview?.onClick as (() => Promise<void>))();

    expect(showPrintOptionsDialogMock).toHaveBeenCalledWith("character", makeSections(), makeOptions());
    expect(openPreviewWindowMock).toHaveBeenCalledWith(
      "<article>character</article>",
      ".sheet{}",
      "Arannis",
    );
  });

  it("detects party groups from character members and uses saved defaults for print", async () => {
    showPrintOptionsDialogSettingMock.mockReturnValue(false);

    const mod = await import("./print-sheet");
    mod.registerPrintSheetHooks();

    const controls: Record<string, unknown>[] = [];
    const partyApp = {
      document: {
        name: "Heroes",
        type: "group",
        documentName: "Actor",
        system: {
          type: { value: "" },
          members: [{ actor: { type: "character" } }],
        },
      },
      constructor: { name: "ActorSheetV2" },
    };
    getHeaderHook()(partyApp, controls);

    const print = controls.find((control) => control.action === "fth-print-sheet");
    await (print?.onClick as (() => Promise<void>))();

    const extractor = getExtractorMock.mock.results[0]?.value as {
      extractPartySummary: ReturnType<typeof vi.fn>;
    };
    expect(showPrintOptionsDialogMock).not.toHaveBeenCalled();
    expect(extractor.extractPartySummary).toHaveBeenCalledWith(partyApp.document, makeOptions());
    expect(openPrintWindowMock).toHaveBeenCalledWith(
      "<article>party</article>",
      ".sheet{}",
      "Heroes",
    );
  });
});
