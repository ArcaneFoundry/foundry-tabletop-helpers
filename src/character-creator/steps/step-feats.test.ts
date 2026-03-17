import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

class FakeClassList {
  private readonly values = new Set<string>();

  toggle(token: string, force?: boolean): boolean {
    if (force === true) {
      this.values.add(token);
      return true;
    }
    if (force === false) {
      this.values.delete(token);
      return false;
    }
    if (this.values.has(token)) {
      this.values.delete(token);
      return false;
    }
    this.values.add(token);
    return true;
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }
}

class FakeElement {
  dataset: Record<string, string> = {};
  textContent: string | null = null;
  classList = new FakeClassList();
  private readonly listeners = new Map<string, Array<() => void>>();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();
  private readonly attrs = new Map<string, string>();

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelector(selector: string, value: FakeElement | null): void {
    this.selectorMap.set(selector, value);
  }

  setQuerySelectorAll(selector: string, values: FakeElement[]): void {
    this.selectorAllMap.set(selector, values);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

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
  (globalThis as Record<string, unknown>).Element = FakeElement;

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

  it("exposes only enabled feats through the internal helper", async () => {
    const { __featsStepInternals } = await import("./step-feats");
    const entries = __featsStepInternals.getAvailableFeats(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.feat.alert"]),
      },
    }));

    expect(entries).toEqual([
      expect.objectContaining({ uuid: "Compendium.feat.tough" }),
    ]);
  });

  it("rerenders through setData when asi toggles and feat-card selection change", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();
    const state = makeState();
    const setData = vi.fn((value: unknown) => {
      state.selections.feats = value as WizardState["selections"]["feats"];
    });
    const setDataSilent = vi.fn((value: unknown) => {
      state.selections.feats = value as WizardState["selections"]["feats"];
    });

    const asiTab = new FakeElement();
    asiTab.dataset.featChoice = "asi";
    const featTab = new FakeElement();
    featTab.dataset.featChoice = "feat";

    const strBtn = new FakeElement();
    strBtn.dataset.asiAbility = "str";
    const conBtn = new FakeElement();
    conBtn.dataset.asiAbility = "con";
    const wisBtn = new FakeElement();
    wisBtn.dataset.asiAbility = "wis";

    const alertCard = new FakeElement();
    alertCard.dataset.cardUuid = "Compendium.feat.alert";
    const toughCard = new FakeElement();
    toughCard.dataset.cardUuid = "Compendium.feat.tough";

    const root = new FakeElement();
    root.setQuerySelectorAll("[data-feat-choice]", [asiTab, featTab]);
    root.setQuerySelectorAll("[data-asi-ability]", [strBtn, conBtn, wisBtn]);
    root.setQuerySelectorAll("[data-card-uuid]", [alertCard, toughCard]);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData,
      setDataSilent,
      rerender: vi.fn(),
    });

    featTab.trigger("click");
    strBtn.trigger("click");
    conBtn.trigger("click");
    wisBtn.trigger("click");
    toughCard.trigger("click");

    expect(setData).toHaveBeenNthCalledWith(1, { choice: "feat" });
    expect(setData).toHaveBeenNthCalledWith(2, {
      choice: "asi",
      asiAbilities: ["str"],
    });
    expect(setData).toHaveBeenNthCalledWith(3, {
      choice: "asi",
      asiAbilities: ["str", "con"],
    });
    expect(setData).toHaveBeenNthCalledWith(4, {
      choice: "asi",
      asiAbilities: ["str", "con"],
    });
    expect(setData).toHaveBeenNthCalledWith(5, {
      choice: "feat",
      featUuid: "Compendium.feat.tough",
      featName: "Tough",
      featImg: "tough.png",
    });
    expect(setDataSilent).not.toHaveBeenCalled();
  });
});
