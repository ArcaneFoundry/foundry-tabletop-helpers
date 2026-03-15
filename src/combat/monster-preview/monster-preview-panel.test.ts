import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  hooksOn,
  getGameMock,
  getSettingMock,
  extractNPCMock,
  transformNPCToViewModelMock,
  buildContentHTMLMock,
  buildPanelHTMLMock,
  buildUpNextHTMLMock,
  injectMonsterPreviewIntoTrackerMock,
  findMonsterPreviewTrackerElementMock,
  attachInlineListenersMock,
  attachFloatingListenersMock,
  makeDraggableMock,
  restorePositionMock,
  savePositionMock,
} = vi.hoisted(() => ({
  hooksOn: vi.fn(),
  getGameMock: vi.fn(),
  getSettingMock: vi.fn(),
  extractNPCMock: vi.fn(),
  transformNPCToViewModelMock: vi.fn(),
  buildContentHTMLMock: vi.fn(),
  buildPanelHTMLMock: vi.fn(),
  buildUpNextHTMLMock: vi.fn(),
  injectMonsterPreviewIntoTrackerMock: vi.fn(),
  findMonsterPreviewTrackerElementMock: vi.fn(),
  attachInlineListenersMock: vi.fn(),
  attachFloatingListenersMock: vi.fn(),
  makeDraggableMock: vi.fn(),
  restorePositionMock: vi.fn(),
  savePositionMock: vi.fn(),
}));

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../types", () => ({
  getHooks: () => ({ on: hooksOn }),
  getGame: getGameMock,
  getSetting: getSettingMock,
  isGM: () => true,
  isDnd5eWorld: () => true,
  isObject: (value: unknown) => typeof value === "object" && value !== null,
}));

vi.mock("../../print-sheet/extractors/base-extractor", () => ({
  getExtractor: () => ({
    extractNPC: extractNPCMock,
  }),
}));

vi.mock("../../print-sheet/renderers/viewmodels/npc-transformer", () => ({
  transformNPCToViewModel: transformNPCToViewModelMock,
}));

vi.mock("./monster-preview-rendering", () => ({
  buildMonsterPreviewContentHTML: buildContentHTMLMock,
  buildMonsterPreviewPanelHTML: buildPanelHTMLMock,
  buildMonsterPreviewUpNextHTML: buildUpNextHTMLMock,
}));

vi.mock("./monster-preview-floating", () => ({
  makeMonsterPreviewDraggable: makeDraggableMock,
  restoreMonsterPreviewPosition: restorePositionMock,
  saveMonsterPreviewPosition: savePositionMock,
}));

vi.mock("./monster-preview-interactions", () => ({
  attachMonsterPreviewFloatingListeners: attachFloatingListenersMock,
  attachMonsterPreviewInlineListeners: attachInlineListenersMock,
}));

vi.mock("./monster-preview-tracker", () => ({
  findMonsterPreviewTrackerElement: findMonsterPreviewTrackerElementMock,
  injectMonsterPreviewIntoTracker: injectMonsterPreviewIntoTrackerMock,
}));

class FakeElement {
  id = "";
  className = "";
  innerHTML = "";
  style: Record<string, string> = {};
  removed = false;

  remove(): void {
    this.removed = true;
  }

  querySelector<T>(_selector: string): T | null {
    return null;
  }
}

class FakeDocument {
  body = {
    appendChild: vi.fn(),
  };
  inlineEl: FakeElement | null = null;

  createElement(): FakeElement {
    return new FakeElement();
  }

  querySelector<T>(selector: string): T | null {
    if (selector === "#fth-mp-inline") return (this.inlineEl as T | null);
    return null;
  }
}

function installDocument(): FakeDocument {
  const doc = new FakeDocument();
  (globalThis as Record<string, unknown>).document = doc;
  const storage = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
  return doc;
}

function makeCombat(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "combat-1",
    turn: 0,
    turns: [],
    combatant: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  installDocument();

  getSettingMock.mockReturnValue(true);
  getGameMock.mockReturnValue({
    combat: { id: "combat-1" },
    system: { id: "dnd5e" },
  });
  extractNPCMock.mockResolvedValue({ name: "Dragon NPC" });
  transformNPCToViewModelMock.mockReturnValue({ name: "Dragon VM" });
  buildContentHTMLMock.mockReturnValue("<section>dragon</section>");
  buildPanelHTMLMock.mockImplementation((content: string) => `<div class="panel">${content}</div>`);
  buildUpNextHTMLMock.mockImplementation((info: unknown) => `<aside>${JSON.stringify(info)}</aside>`);
  findMonsterPreviewTrackerElementMock.mockReturnValue(new FakeElement());
});

describe("monster preview panel shell", () => {
  it("registers hooks and renders an NPC turn inline through the extraction pipeline", async () => {
    const panel = await import("./monster-preview-panel");
    panel.registerMonsterPreviewHooks();

    expect(hooksOn).toHaveBeenCalledWith("updateCombat", expect.any(Function));
    expect(hooksOn).toHaveBeenCalledWith("renderCombatTracker", expect.any(Function));

    const onUpdateCombat = hooksOn.mock.calls.find((call) => call[0] === "updateCombat")?.[1] as
      (combat: Record<string, unknown>, change: { turn?: number }) => void;

    const npcActor = {
      id: "actor-npc",
      name: "Adult Red Dragon",
      type: "npc",
      system: {
        attributes: { ac: { value: 19 }, hp: { max: 256 } },
        details: { cr: 17 },
      },
    };
    const combat = makeCombat({
      combatant: { actor: npcActor },
      turns: [
        { actor: npcActor },
        { actor: { id: "pc-1", name: "Aric", type: "character" } },
      ],
    });

    onUpdateCombat(combat, { turn: 0 });
    await vi.waitFor(() => {
      expect(extractNPCMock).toHaveBeenCalledWith(npcActor, expect.any(Object));
    });

    expect(transformNPCToViewModelMock).toHaveBeenCalled();
    expect(buildContentHTMLMock).toHaveBeenCalled();
    expect(injectMonsterPreviewIntoTrackerMock).toHaveBeenCalledWith(expect.any(FakeElement), expect.objectContaining({
      cachedContentHTML: "<section>dragon</section>",
      dismissed: false,
    }));
  });

  it("hides and clears the inline preview when the active turn is not an NPC", async () => {
    const doc = installDocument();
    doc.inlineEl = new FakeElement();

    const panel = await import("./monster-preview-panel");
    panel.registerMonsterPreviewHooks();

    const onCombatStart = hooksOn.mock.calls.find((call) => call[0] === "combatStart")?.[1] as
      (combat: Record<string, unknown>) => void;

    onCombatStart(makeCombat({
      combatant: { actor: { id: "pc-1", name: "Aric", type: "character" } },
    }));

    await vi.waitFor(() => {
      expect(doc.inlineEl?.removed).toBe(true);
    });
    expect(extractNPCMock).not.toHaveBeenCalled();
  });

  it("creates and reuses the floating panel when floating mode is restored", async () => {
    const doc = installDocument();
    (globalThis.localStorage as { getItem(key: string): string | null }).getItem = (key: string) =>
      key.endsWith("monster-preview-mode") ? "floating" : null;

    const panel = await import("./monster-preview-panel");
    panel.registerMonsterPreviewHooks();

    const onCombatStart = hooksOn.mock.calls.find((call) => call[0] === "combatStart")?.[1] as
      (combat: Record<string, unknown>) => void;

    const npcActor = { id: "actor-npc", name: "Dragon", type: "npc", system: {} };
    onCombatStart(makeCombat({
      combatant: { actor: npcActor },
      turns: [{ actor: npcActor }],
    }));

    await vi.waitFor(() => {
      expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
    });
    expect(restorePositionMock).toHaveBeenCalledTimes(1);
    expect(makeDraggableMock).toHaveBeenCalledTimes(1);
    expect(attachFloatingListenersMock).toHaveBeenCalledTimes(1);

    onCombatStart(makeCombat({
      combatant: { actor: npcActor },
      turns: [{ actor: npcActor }],
    }));

    expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
  });
});
