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
  it("is applicable only at feat or ASI levels and builds the feat/asi view model", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();

    expect(step.isApplicable(makeState())).toBe(true);
    expect(step.isApplicable(makeState({
      config: { ...makeState().config, startingLevel: 5 },
    }))).toBe(false);

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

  it("patches asi toggles and feat-card selection on activate", async () => {
    const { createFeatsStep } = await import("./step-feats");
    const step = createFeatsStep();
    const setData = vi.fn();
    const state = makeState();
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

    const countEl = new FakeElement();

    const alertCard = new FakeElement();
    alertCard.dataset.cardUuid = "Compendium.feat.alert";
    const toughCard = new FakeElement();
    toughCard.dataset.cardUuid = "Compendium.feat.tough";

    const root = new FakeElement();
    root.setQuerySelectorAll("[data-feat-choice]", [asiTab, featTab]);
    root.setQuerySelectorAll("[data-asi-ability]", [strBtn, conBtn, wisBtn]);
    root.setQuerySelector("[data-asi-count]", countEl);
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

    expect(setData).toHaveBeenCalledWith({ choice: "feat" });
    expect(setDataSilent).toHaveBeenNthCalledWith(1, {
      choice: "asi",
      asiAbilities: ["str"],
    });
    expect(setDataSilent).toHaveBeenNthCalledWith(2, {
      choice: "asi",
      asiAbilities: ["str", "con"],
    });
    expect(setDataSilent).toHaveBeenNthCalledWith(3, {
      choice: "asi",
      asiAbilities: ["str", "con"],
    });
    expect(setDataSilent).toHaveBeenNthCalledWith(4, {
      choice: "feat",
      featUuid: "Compendium.feat.tough",
      featName: "Tough",
      featImg: "tough.png",
    });
    expect(strBtn.classList.contains("cc-asi-btn--selected")).toBe(true);
    expect(conBtn.classList.contains("cc-asi-btn--selected")).toBe(true);
    expect(wisBtn.classList.contains("cc-asi-btn--selected")).toBe(false);
    expect(countEl.textContent).toBe("2");
    expect(alertCard.getAttribute("aria-selected")).toBe("false");
    expect(toughCard.getAttribute("aria-selected")).toBe("true");
  });
});
