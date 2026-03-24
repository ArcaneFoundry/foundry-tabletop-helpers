import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logDebugMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const resolveClassSpellUuidsMock = vi.fn();
const fromUuidMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    debug: logDebugMock,
  },
}));

vi.mock("../../types", () => ({
  fromUuid: fromUuidMock,
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
  private readonly listeners = new Map<string, Array<(event: { preventDefault(): void; stopPropagation(): void }) => void>>();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  constructor(public readonly tagName = "div") {}

  addEventListener(event: string, handler: (event: { preventDefault(): void; stopPropagation(): void }) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler({
        preventDefault() {},
        stopPropagation() {},
      });
    }
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

  fromUuidMock.mockResolvedValue({
    system: {
      advancement: [
        {
          type: "ScaleValue",
          title: "Cantrips Known",
          configuration: {
            scale: {
              1: { value: 3 },
              4: { value: 4 },
            },
          },
        },
        {
          type: "ScaleValue",
          title: "Max Prepared Spells",
          configuration: {
            identifier: "max-prepared",
            scale: {
              1: { value: 4 },
              2: { value: 5 },
              3: { value: 6 },
              4: { value: 7 },
              5: { value: 9 },
            },
          },
        },
      ],
      spellcasting: {
        preparation: {
          formula: "@scale.wizard.max-prepared",
        },
      },
    },
  });
});

describe("step spells", () => {
  it("uses the React rendering path for the grimoire selection screen", async () => {
    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();

    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeTypeOf("function");
  });

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
      maxCantrips: 4,
      maxSpells: 14,
    });

    const cantrips = (viewModel.cantrips as Array<Record<string, unknown>>).map((s) => s.name);
    const levels = (viewModel.spellsByLevel as Array<{ level: number; spells: Array<Record<string, unknown>> }>)
      .map((group) => ({ level: group.level, names: group.spells.map((s) => s.name) }));

    expect(cantrips).toEqual(["Light"]);
    expect(levels).toEqual([{ level: 1, names: ["Magic Missile"] }]);
  });

  it("uses spellbook counts for wizard creation instead of prepared spell counts", async () => {
    resolveClassSpellUuidsMock.mockResolvedValue(new Set([
      "Compendium.spell.light",
      "Compendium.spell.magic-missile",
      "Compendium.spell.fireball",
    ]));

    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();
    const viewModel = await step.buildViewModel(makeState({
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
          spellcastingProgression: "full",
        },
        spells: {
          cantrips: [],
          spells: [],
        },
      },
      config: {
        ...makeState().config,
        startingLevel: 5,
      },
    }));

    expect(viewModel).toMatchObject({
      maxSpellLevel: 3,
      maxCantrips: 4,
      maxSpells: 14,
      selectionSummary: "0 / 4 cantrips, 0 / 14 spells",
      hasPreparationNotice: true,
      preparationNotice: "Choose which leveled spells start prepared for this Wizard. You can change them later on the sheet.",
      showPreparedPicker: true,
      preparedCount: 0,
      preparedLimit: 9,
    });
  });

  it("shows the explicit prepared picker for prepared casters beyond wizard", async () => {
    resolveClassSpellUuidsMock.mockResolvedValue(new Set([
      "Compendium.spell.light",
      "Compendium.spell.magic-missile",
    ]));
    fromUuidMock.mockResolvedValueOnce({
      system: {
        advancement: [
          {
            type: "ScaleValue",
            title: "Cantrips Known",
            configuration: {
              scale: {
                1: { value: 3 },
                4: { value: 4 },
              },
            },
          },
          {
            type: "ScaleValue",
            configuration: {
              identifier: "max-prepared",
              scale: {
                5: { value: 9 },
              },
            },
          },
        ],
        spellcasting: {
          preparation: {
            formula: "@scale.cleric.max-prepared",
          },
        },
      },
    });

    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();
    const viewModel = await step.buildViewModel(makeState({
      selections: {
        class: {
          uuid: "Compendium.class.cleric",
          name: "Cleric",
          img: "cleric.png",
          identifier: "cleric",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: true,
          spellcastingAbility: "wis",
          spellcastingProgression: "full",
        },
        spells: {
          cantrips: [],
          spells: ["Compendium.spell.magic-missile"],
        },
      },
    }));

    expect(viewModel).toMatchObject({
      maxSpells: null,
      hasPreparationNotice: true,
      preparationNotice: "Choose which 1 leveled spell start prepared for this Cleric. You can change them later on the sheet.",
      showPreparedPicker: true,
      preparedCount: 0,
      preparedLimit: 9,
    });
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
    const setDataSilent = vi.fn((value: unknown) => {
      state.selections.spells = value as typeof state.selections.spells;
    });

    const cantripCard = new FakeElement("button");
    cantripCard.dataset.cantripUuid = "Compendium.spell.light";
    const spellCard = new FakeElement("button");
    spellCard.dataset.spellUuid = "Compendium.spell.magic-missile";
    const preparedToggle = new FakeElement("button");
    preparedToggle.dataset.preparedUuid = "Compendium.spell.magic-missile";
    const searchInput = new FakeElement("input") as FakeElement & { value: string };
    searchInput.value = "";
    const visibleRow = new FakeElement("div");
    visibleRow.dataset.spellName = "Magic Missile";
    const hiddenRow = new FakeElement("div");
    hiddenRow.dataset.spellName = "Shield";
    const cantripCount = new FakeElement("span");
    cantripCount.dataset.cantripLimit = "4";
    const summary = new FakeElement("span");
    summary.dataset.cantripLimit = "4";
    summary.dataset.spellLimit = "9";
    summary.dataset.preparedLimit = "4";
    summary.textContent = "0 / 4 cantrips, 0 / 9 spells";
    const preparedSummary = new FakeElement("div");
    preparedSummary.dataset.preparedPicker = "true";

    const root = new FakeElement("section");
    root.setQuerySelectorAll("[data-cantrip-uuid]", [cantripCard]);
    root.setQuerySelectorAll("[data-spell-uuid]", [spellCard]);
    root.setQuerySelectorAll("[data-prepared-uuid]", [preparedToggle]);
    root.setQuerySelector("[data-spell-search]", searchInput);
    root.setQuerySelectorAll("[data-spell-name]", [visibleRow, hiddenRow]);
    root.setQuerySelector(".cc-spell-section__count", cantripCount);
    root.setQuerySelector(".cc-spells-summary__value", summary);
    root.setQuerySelector("[data-prepared-picker='true']", preparedSummary);

    const setData = vi.fn((value: unknown) => {
      state.selections.spells = value as typeof state.selections.spells;
    });
    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData,
      setDataSilent,
      rerender: vi.fn(),
    });

    cantripCard.trigger("click");
    spellCard.trigger("click");
    preparedToggle.trigger("click");
    searchInput.value = "magic";
    searchInput.trigger("input");

    expect(setDataSilent).toHaveBeenNthCalledWith(1, {
      maxCantrips: 4,
      maxSpells: 9,
      maxPreparedSpells: 4,
      cantrips: [],
      spells: [],
      preparedSpells: [],
    });
    expect(setDataSilent).toHaveBeenNthCalledWith(2, {
      cantrips: ["Compendium.spell.light"],
      spells: [],
      preparedSpells: [],
      maxCantrips: 4,
      maxSpells: 9,
      maxPreparedSpells: 4,
    });
    expect(setData).toHaveBeenNthCalledWith(1, {
      cantrips: ["Compendium.spell.light"],
      spells: ["Compendium.spell.magic-missile"],
      preparedSpells: [],
      maxCantrips: 4,
      maxSpells: 9,
      maxPreparedSpells: 4,
    });
    expect(setData).toHaveBeenNthCalledWith(2, {
      cantrips: ["Compendium.spell.light"],
      spells: ["Compendium.spell.magic-missile"],
      preparedSpells: ["Compendium.spell.magic-missile"],
      maxCantrips: 4,
      maxSpells: 9,
      maxPreparedSpells: 4,
    });
    expect(cantripCard.classList.contains("cc-spell-card--selected")).toBe(true);
    expect(cantripCount.textContent).toBe("1 / 4 selected");
    expect(summary.textContent).toBe("1 / 4 cantrips, 0 / 9 spells");
    expect(visibleRow.style.display).toBe("");
    expect(hiddenRow.style.display).toBe("none");

    __spellsStepInternals.patchSpellCounter(root as unknown as HTMLElement, "spell", 2);
    expect(summary.textContent).toBe("1 / 4 cantrips, 2 / 9 spells");
  });

  it("uses class-driven selection targets for completion and over-selection prevention", async () => {
    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();
    const getStatusHint = step.getStatusHint;
    if (!getStatusHint) throw new Error("Expected getStatusHint to be defined");

    const completeState = makeState({
      config: {
        ...makeState().config,
        startingLevel: 3,
      },
      selections: {
        class: makeState().selections.class,
        spells: {
          cantrips: ["a", "b", "c"],
          spells: ["s1", "s2", "s3", "s4", "s5", "s6"],
          preparedSpells: ["s1", "s2", "s3", "s4", "s5", "s6"],
          maxCantrips: 3,
          maxSpells: 6,
          maxPreparedSpells: 6,
        },
      },
    });

    expect(step.isComplete(completeState)).toBe(true);
    expect(getStatusHint(completeState)).toBe("");

    const incompleteState = makeState({
      config: {
        ...makeState().config,
        startingLevel: 3,
      },
      selections: {
        class: makeState().selections.class,
        spells: {
          cantrips: ["a", "b"],
          spells: ["s1", "s2", "s3"],
          preparedSpells: ["s1"],
          maxCantrips: 3,
          maxSpells: 6,
          maxPreparedSpells: 3,
        },
      },
    });

    expect(step.isComplete(incompleteState)).toBe(false);
    expect(getStatusHint(incompleteState)).toBe("choose 1 more cantrip and choose 3 more spells and choose 2 more prepared spells");
  });

  it("requires prepared casters without known-spell caps to pick enough spells to fill their prepared limit", async () => {
    const { createSpellsStep } = await import("./step-spells");
    const step = createSpellsStep();
    const getStatusHint = step.getStatusHint;
    if (!getStatusHint) throw new Error("Expected getStatusHint to be defined");

    const incompleteState = makeState({
      selections: {
        class: {
          uuid: "Compendium.class.cleric",
          name: "Cleric",
          img: "cleric.png",
          identifier: "cleric",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: true,
          spellcastingAbility: "wis",
          spellcastingProgression: "full",
        },
        spells: {
          cantrips: ["a", "b", "c", "d"],
          spells: ["s1", "s2", "s3"],
          preparedSpells: ["s1"],
          maxCantrips: 4,
          maxPreparedSpells: 5,
        },
      },
    });

    expect(step.isComplete(incompleteState)).toBe(false);
    expect(getStatusHint(incompleteState)).toBe("choose 2 more spells and choose 4 more prepared spells");

    const completeState = makeState({
      selections: {
        class: {
          uuid: "Compendium.class.cleric",
          name: "Cleric",
          img: "cleric.png",
          identifier: "cleric",
          skillPool: [],
          skillCount: 2,
          isSpellcaster: true,
          spellcastingAbility: "wis",
          spellcastingProgression: "full",
        },
        spells: {
          cantrips: ["a", "b", "c", "d"],
          spells: ["s1", "s2", "s3", "s4", "s5"],
          preparedSpells: ["s1", "s2", "s3", "s4", "s5"],
          maxCantrips: 4,
          maxPreparedSpells: 5,
        },
      },
    });

    expect(step.isComplete(completeState)).toBe(true);
    expect(getStatusHint(completeState)).toBe("");
  });
});
