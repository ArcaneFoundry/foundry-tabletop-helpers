import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logWarnMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const fetchDocumentMock = vi.fn();
const parseBackgroundGrantsMock = vi.fn();
const renderTemplateMock = vi.fn();
const beginCardSelectionUpdateMock = vi.fn();
const isCurrentCardSelectionUpdateMock = vi.fn();
const patchCardDetailFromTemplateMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
  },
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
    getCachedDescription: getCachedDescriptionMock,
    fetchDocument: fetchDocumentMock,
  },
}));

vi.mock("../data/advancement-parser", () => ({
  parseBackgroundGrants: parseBackgroundGrantsMock,
}));

vi.mock("../../types", () => ({
  renderTemplate: renderTemplateMock,
}));

vi.mock("./card-select-utils", () => ({
  beginCardSelectionUpdate: beginCardSelectionUpdateMock,
  isCurrentCardSelectionUpdate: isCurrentCardSelectionUpdateMock,
  patchCardDetailFromTemplate: patchCardDetailFromTemplateMock,
}));

class FakeElement {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => Promise<void> | void>>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  addEventListener(event: string, handler: () => Promise<void> | void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  async trigger(event: string): Promise<void> {
    for (const handler of this.listeners.get(event) ?? []) {
      await handler();
    }
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelectorAll(selector: string, values: FakeElement[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "backgroundAsi", "originChoices", "species", "originSummary", "review"],
    selections: {},
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: ["pack.backgrounds"],
        feats: [],
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).Element = FakeElement;

  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.background.sage",
      name: "Sage",
      img: "sage.png",
      packId: "pack.backgrounds",
      packLabel: "PHB",
      type: "background",
    },
    {
      uuid: "Compendium.background.soldier",
      name: "Soldier",
      img: "soldier.png",
      packId: "pack.backgrounds",
      packLabel: "PHB",
      type: "background",
    },
  ]);
  getCachedDescriptionMock.mockResolvedValue("<p>Background details</p>");
  renderTemplateMock.mockResolvedValue("<div class=\"detail\">Background details</div>");
  beginCardSelectionUpdateMock.mockReturnValue("request-1");
  isCurrentCardSelectionUpdateMock.mockReturnValue(true);
  patchCardDetailFromTemplateMock.mockResolvedValue(true);
  parseBackgroundGrantsMock.mockResolvedValue({
    skillProficiencies: ["arc", "his"],
    toolProficiency: "art:calligrapher",
    originFeatUuid: "Compendium.feat.magic-initiate",
    originFeatName: "Magic Initiate",
    originFeatImg: "feat.png",
    asiPoints: 3,
    asiCap: 2,
    asiSuggested: ["int", "wis"],
    languageGrants: ["common"],
    languageChoiceCount: 2,
    languageChoicePool: ["languages:standard:*"],
  });
});

describe("step background", () => {
  it("filters enabled backgrounds and hydrates the selected description", async () => {
    const { createBackgroundStep } = await import("./step-background");
    const step = createBackgroundStep();

    const viewModel = await step.buildViewModel(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.background.soldier"]),
      },
      selections: {
        background: {
          uuid: "Compendium.background.sage",
          name: "Sage",
          img: "sage.png",
          grants: {
            skillProficiencies: ["arc", "his"],
            weaponProficiencies: [],
            toolProficiency: "art:calligrapher",
            originFeatUuid: "Compendium.feat.magic-initiate",
            originFeatName: "Magic Initiate",
            originFeatImg: "feat.png",
            asiPoints: 3,
            asiCap: 2,
            asiSuggested: ["int", "wis"],
            languageGrants: ["common"],
            languageChoiceCount: 2,
            languageChoicePool: ["languages:standard:*"],
          },
          asi: { assignments: {} },
          languages: { fixed: ["common"], chosen: [] },
        },
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect((viewModel.entries as Array<{ name: string }>).map((entry) => entry.name)).toEqual(["Sage"]);
    expect(viewModel).toMatchObject({
      emptySelectionPrompt: "Choose the past that forged your instincts, outlook, and place in the world.",
      detailPaneHtml: "<div class=\"detail\">Background details</div>",
      selectedEntry: expect.objectContaining({
        uuid: "Compendium.background.sage",
        description: "<p>Background details</p>",
      }),
      hasEntries: true,
      emptyMessage: "No backgrounds available. Check your GM configuration.",
    });
  });

  it("exposes enabled backgrounds through the internal helper", async () => {
    const { __backgroundStepInternals } = await import("./step-background");
    const entries = __backgroundStepInternals.getAvailableBackgrounds(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.background.sage"]),
      },
    }));

    expect(entries).toEqual([
      expect.objectContaining({ uuid: "Compendium.background.soldier" }),
    ]);
  });

  it("stores parsed grants and falls back gracefully when grant parsing fails", async () => {
    const { createBackgroundStep } = await import("./step-background");
    const step = createBackgroundStep();
    const setDataSilent = vi.fn();
    const card = new FakeElement();
    card.dataset.cardUuid = "Compendium.background.sage";
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-card-uuid]", [card]);

    fetchDocumentMock.mockResolvedValue({ id: "doc-sage" });

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    await card.trigger("click");

    expect(fetchDocumentMock).toHaveBeenCalledWith("Compendium.background.sage");
    expect(parseBackgroundGrantsMock).toHaveBeenCalled();
    expect(beginCardSelectionUpdateMock).toHaveBeenCalledWith(
      root,
      "Compendium.background.sage",
      expect.objectContaining({ name: "Sage" })
    );
    expect(patchCardDetailFromTemplateMock).toHaveBeenCalledWith(
      root,
      expect.objectContaining({
        requestId: "request-1",
        templatePath: "modules/foundry-tabletop-helpers/templates/character-creator/cc-step-card-detail-pane.hbs",
        data: {
          selectedEntry: expect.objectContaining({
            uuid: "Compendium.background.sage",
            description: "<p>Background details</p>",
          }),
        },
      }),
    );
    expect(setDataSilent).toHaveBeenCalledWith({
      uuid: "Compendium.background.sage",
      name: "Sage",
      img: "sage.png",
      grants: expect.objectContaining({
        skillProficiencies: ["arc", "his"],
        languageGrants: ["common"],
      }),
      asi: { assignments: {} },
      languages: {
        fixed: ["common"],
        chosen: [],
      },
    });

    vi.clearAllMocks();
    fetchDocumentMock.mockRejectedValue(new Error("boom"));
    const fallbackCard = new FakeElement();
    fallbackCard.dataset.cardUuid = "Compendium.background.soldier";
    const fallbackRoot = new FakeElement();
    fallbackRoot.setQuerySelectorAll("[data-card-uuid]", [fallbackCard]);

    step.onActivate?.(makeState(), fallbackRoot as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent: vi.fn(),
      rerender: vi.fn(),
    });

    await fallbackCard.trigger("click");

    expect(logWarnMock).toHaveBeenCalledWith("Failed to parse background grants", expect.any(Error));
  });
});
