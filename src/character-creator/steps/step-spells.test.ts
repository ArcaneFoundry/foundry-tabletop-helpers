import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logDebugMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const resolveClassSpellUuidsMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    debug: logDebugMock,
  },
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

vi.mock("../data/spell-list-resolver", () => ({
  resolveClassSpellUuids: resolveClassSpellUuidsMock,
}));

class FakeClassList {
  private readonly values = new Set<string>();

  add(...tokens: string[]): void {
    for (const token of tokens) this.values.add(token);
  }

  remove(...tokens: string[]): void {
    for (const token of tokens) this.values.delete(token);
  }

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
  style = { display: "" };
  classList = new FakeClassList();
  textContent: string | null = null;
  className = "";
  readonly children: FakeElement[] = [];
  private readonly listeners = new Map<string, Array<() => void>>();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  constructor(public readonly tagName = "div") {}

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
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
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_m, letter: string) => letter.toUpperCase());
      this.dataset[camel] = value;
    }
  }

  remove(): void {
    this.className = "";
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "spells", "review"],
    selections: {
      class: {
        uuid: "Compendium.class.wizard",
        name: "Wizard",
        img: "wizard.png",
        identifier: "wizard",
        skillPool: [],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "int",
        spellcastingProgression: "half",
      },
      spells: {
        cantrips: [],
        spells: [],
      },
    },
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: [],
        subclasses: [],
        races: [],
        backgrounds: [],
        feats: [],
        spells: ["pack.spells"],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 5,
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
  (globalThis as Record<string, unknown>).document = {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  };

  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.spell.light",
      name: "Light",
      img: "light.png",
      packId: "pack.spells",
      packLabel: "PHB",
      type: "spell",
      spellLevel: 0,
      school: "evo",
    },
    {
      uuid: "Compendium.spell.magic-missile",
      name: "Magic Missile",
      img: "mm.png",
      packId: "pack.spells",
      packLabel: "PHB",
      type: "spell",
      spellLevel: 1,
      school: "evo",
    },
    {
      uuid: "Compendium.spell.fireball",
      name: "Fireball",
      img: "fb.png",
      packId: "pack.spells",
      packLabel: "PHB",
      type: "spell",
      spellLevel: 3,
      school: "evo",
    },
  ]);
});

describe("step spells", () => {
  it("filters available spells by resolved class spell list and max spell level", async () => {
    resolveClassSpellUuidsMock.mockResolvedValue(new Set([
      "Compendium.spell.light",
      "Compendium.spell.magic-missile",
      "Compendium.spell.fireball",
    ]));

    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();
    const viewModel = await step.buildViewModel(makeState());

    expect(loadPacksMock).toHaveBeenCalled();
    expect(resolveClassSpellUuidsMock).toHaveBeenCalledWith("wizard");
    expect(viewModel).toMatchObject({
      className: "Wizard",
      usingClassFilter: true,
      maxSpellLevel: 2,
      cantripCount: 0,
      spellCount: 0,
    });

    const cantrips = (viewModel.cantrips as Array<Record<string, unknown>>).map((s) => s.name);
    const levels = (viewModel.spellsByLevel as Array<{ level: number; spells: Array<Record<string, unknown>> }>)
      .map((group) => ({ level: group.level, names: group.spells.map((s) => s.name) }));

    expect(cantrips).toEqual(["Light"]);
    expect(levels).toEqual([{ level: 1, names: ["Magic Missile"] }]);
  });

  it("resets the cached class filter when the class identifier becomes unavailable", async () => {
    resolveClassSpellUuidsMock.mockResolvedValue(new Set(["Compendium.spell.magic-missile"]));

    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();

    const filtered = await step.buildViewModel(makeState());
    expect((filtered.spellsByLevel as Array<{ spells: unknown[] }>)[0]?.spells).toHaveLength(1);

    const unfiltered = await step.buildViewModel(makeState({
      selections: {
        class: {
          uuid: "Compendium.class.unknown",
          name: "Mystery Mage",
          img: "mystery.png",
          identifier: "",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: true,
          spellcastingAbility: "int",
          spellcastingProgression: "half",
        },
        spells: {
          cantrips: [],
          spells: [],
        },
      },
    }));

    const spellNames = (unfiltered.spellsByLevel as Array<{ spells: Array<Record<string, unknown>> }>)
      .flatMap((group) => group.spells.map((spell) => spell.name));
    expect(spellNames).toEqual(["Magic Missile"]);
  });

  it("patches spell selection and search filtering through onActivate", async () => {
    const { createSpellsStep, __spellsStepInternals } = await import("./step-spells");
    const step = createSpellsStep();
    const state = makeState();
    const setDataSilent = vi.fn();

    const cantripCard = new FakeElement("button");
    cantripCard.dataset.cantripUuid = "Compendium.spell.light";
    const spellCard = new FakeElement("button");
    spellCard.dataset.spellUuid = "Compendium.spell.magic-missile";
    const searchInput = new FakeElement("input") as FakeElement & { value: string };
    searchInput.value = "";
    const visibleRow = new FakeElement("div");
    visibleRow.dataset.spellName = "Magic Missile";
    const hiddenRow = new FakeElement("div");
    hiddenRow.dataset.spellName = "Shield";
    const cantripCount = new FakeElement("span");
    const summary = new FakeElement("span");
    summary.textContent = "0 cantrips, 0 spells";

    const root = new FakeElement("section");
    root.setQuerySelectorAll("[data-cantrip-uuid]", [cantripCard]);
    root.setQuerySelectorAll("[data-spell-uuid]", [spellCard]);
    root.setQuerySelector("[data-spell-search]", searchInput);
    root.setQuerySelectorAll("[data-spell-name]", [visibleRow, hiddenRow]);
    root.setQuerySelector(".cc-spell-section__count", cantripCount);
    root.setQuerySelector(".cc-spells-summary__value", summary);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    cantripCard.trigger("click");
    spellCard.trigger("click");
    searchInput.value = "magic";
    searchInput.trigger("input");

    expect(setDataSilent).toHaveBeenNthCalledWith(1, {
      cantrips: ["Compendium.spell.light"],
      spells: [],
    });
    expect(setDataSilent).toHaveBeenNthCalledWith(2, {
      cantrips: [],
      spells: ["Compendium.spell.magic-missile"],
    });
    expect(cantripCard.classList.contains("cc-spell-card--selected")).toBe(true);
    expect(spellCard.classList.contains("cc-spell-card--selected")).toBe(true);
    expect(cantripCount.textContent).toBe("1 selected");
    expect(summary.textContent).toBe("1 cantrips, 1 spells");
    expect(visibleRow.style.display).toBe("");
    expect(hiddenRow.style.display).toBe("none");

    __spellsStepInternals.patchSpellCounter(root as unknown as HTMLElement, "spell", 2);
    expect(summary.textContent).toBe("1 cantrips, 2 spells");
  });
});
