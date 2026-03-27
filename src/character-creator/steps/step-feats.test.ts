import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getPackAnalysisMapMock = vi.fn();
const isEntryRelevantForWorkflowMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

vi.mock("../data/pack-analysis", () => ({
  getPackAnalysisMap: getPackAnalysisMapMock,
  isEntryRelevantForWorkflow: isEntryRelevantForWorkflowMock,
}));

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "abilities", "feats", "review"],
    selections: {
      abilities: {
        method: "4d6",
        scores: {
          str: 15,
          dex: 14,
          con: 13,
          int: 12,
          wis: 10,
          cha: 8,
        },
        assignments: {
          str: 0,
          dex: 1,
          con: 2,
          int: 3,
          wis: 4,
          cha: 5,
        },
      },
    },
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: ["pack.feats"],
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 4,
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
  getPackAnalysisMapMock.mockResolvedValue(new Map([
    ["pack.feats", { collection: "pack.feats" }],
  ]));
  isEntryRelevantForWorkflowMock.mockReturnValue(true);

  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.feat.alert",
      name: "Alert",
      img: "alert.png",
      packId: "pack.feats",
      packLabel: "PHB",
      type: "feat",
    },
    {
      uuid: "Compendium.feat.tough",
      name: "Tough",
      img: "tough.png",
      packId: "pack.feats",
      packLabel: "PHB",
      type: "feat",
    },
  ]);
});

describe("step feats", () => {
  it("uses the React rendering path for the feat and attunement screen", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();

    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
    expect(step.onActivate).toBeUndefined();
  });

  it("stays applicable once the creator has crossed the first feat or ASI level", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();

    expect(step.isApplicable(makeState())).toBe(true);
    expect(step.isApplicable(makeState({
      config: { ...makeState().config, startingLevel: 5 },
    }))).toBe(true);

    const viewModel = await step.buildViewModel(makeState({
      selections: {
        ...makeState().selections,
        feats: {
          choice: "asi",
          asiAbilities: ["str", "con"],
        },
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect(viewModel).toMatchObject({
      choice: "asi",
      isAsi: true,
      isFeat: false,
      asiCount: 2,
      maxAsiPicks: 2,
      hasFeats: true,
    });
    expect((viewModel.abilities as Array<{ key: string; selected: boolean; atMax: boolean }>).find((a) => a.key === "str"))
      .toMatchObject({ selected: true, atMax: false });
    expect((viewModel.feats as Array<{ name: string }>).map((feat) => feat.name)).toEqual(["Alert", "Tough"]);
  });

  it("marks feat and attunement completion using the existing selection rules", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();

    expect(step.isComplete(makeState())).toBe(false);
    expect(step.isComplete(makeState({
      selections: {
        ...makeState().selections,
        feats: {
          choice: "asi",
          asiAbilities: ["str"],
        },
      },
    }))).toBe(true);
    expect(step.isComplete(makeState({
      selections: {
        ...makeState().selections,
        feats: {
          choice: "feat",
          featUuid: "Compendium.feat.alert",
          featName: "Alert",
          featImg: "alert.png",
        },
      },
    }))).toBe(true);
  });

  it("exposes only enabled feats through the internal helper", async () => {
    const { __featsStepInternals } = await import("./step-feats");
    const entries = await __featsStepInternals.getAvailableFeats(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.feat.alert"]),
      },
    }));

    expect(entries).toEqual([
      expect.objectContaining({ uuid: "Compendium.feat.tough" }),
    ]);
    expect(isEntryRelevantForWorkflowMock).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: "Compendium.feat.tough" }),
      "creator-feat",
      expect.objectContaining({
        packAnalysis: expect.objectContaining({ collection: "pack.feats" }),
      }),
    );
  });

  it("filters out feats from packs that are not creator-feat relevant", async () => {
    isEntryRelevantForWorkflowMock.mockImplementation((entry: { uuid: string }) => entry.uuid === "Compendium.feat.tough");

    const { createFeatsStep } = await import("./step-feats");
    const viewModel = await createFeatsStep().buildViewModel(makeState());

    expect((viewModel.feats as Array<{ uuid: string }>)).toEqual([
      expect.objectContaining({ uuid: "Compendium.feat.tough" }),
    ]);
  });

  it("surfaces the selected feat details without changing filtering or choice mechanics", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const viewModel = await createFeatsStep().buildViewModel(makeState({
      selections: {
        ...makeState().selections,
        feats: {
          choice: "feat",
          featUuid: "Compendium.feat.tough",
          featName: "Tough",
          featImg: "tough.png",
        },
      },
    }));

    expect(viewModel).toMatchObject({
      choice: "feat",
      isAsi: false,
      isFeat: true,
      selectedFeat: expect.objectContaining({
        uuid: "Compendium.feat.tough",
        name: "Tough",
      }),
    });
    expect((viewModel.feats as Array<{ uuid: string; selected: boolean }>).find((entry) => entry.uuid === "Compendium.feat.tough"))
      .toMatchObject({ selected: true });
  });
});
