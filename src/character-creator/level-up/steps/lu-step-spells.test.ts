import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LevelUpState } from "../level-up-types";

const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();

vi.mock("../../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

class FakeElement {
  dataset: Record<string, string> = {};
  style = { display: "" };
  value = "";
  private readonly listeners = new Map<string, Array<() => void>>();
  private readonly selectorMap = new Map<string, unknown>();
  private readonly selectorAllMap = new Map<string, unknown[]>();

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }

  querySelector(selector: string): unknown {
    return this.selectorMap.get(selector) ?? null;
  }

  querySelectorAll(selector: string): unknown[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelector(selector: string, value: unknown): void {
    this.selectorMap.set(selector, value);
  }

  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(overrides: Partial<LevelUpState> = {}): LevelUpState {
  return {
    actorId: "actor-1",
    currentLevel: 4,
    targetLevel: 5,
    applicableSteps: ["classChoice", "spells", "review"],
    currentStep: 1,
    selections: {
      classChoice: {
        mode: "existing",
        classItemId: "class-1",
        className: "Wizard",
        classIdentifier: "wizard",
      },
      spells: {
        newSpellUuids: [],
        swappedOutUuids: [],
        swappedInUuids: [],
        newCantripUuids: [],
      },
    },
    stepStatus: new Map(),
    classItems: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.dnd5e.spells.Item.light",
      name: "Light",
      spellLevel: 0,
      school: "evo",
    },
    {
      uuid: "Compendium.dnd5e.spells.Item.magicMissile",
      name: "Magic Missile",
      spellLevel: 1,
      school: "evo",
    },
    {
      uuid: "Compendium.dnd5e.spells.Item.fireball",
      name: "Fireball",
      spellLevel: 3,
      school: "evo",
    },
  ]);
});

describe("level-up step spells", () => {
  it("builds spell/cantrip view data with current actor spells and target-level filtering", async () => {
    const { createLuSpellsStep } = await import("./lu-step-spells");
    const step = createLuSpellsStep();
    const viewModel = await step.buildViewModel(
      makeState({
        targetLevel: 4,
        selections: {
          ...makeState().selections,
          spells: {
            newSpellUuids: ["Compendium.dnd5e.spells.Item.magicMissile"],
            swappedOutUuids: [],
            swappedInUuids: [],
            newCantripUuids: ["Compendium.dnd5e.spells.Item.light"],
          },
        },
      }),
      {
        id: "actor-1",
        items: [
          { id: "spell-1", type: "spell", name: "Shield", system: { level: 1 } },
          { id: "feat-1", type: "feat", name: "Arcane Recovery" },
        ],
        update: vi.fn(),
        createEmbeddedDocuments: vi.fn(),
        toObject: vi.fn(() => ({})),
      },
    );

    expect(loadPacksMock).toHaveBeenCalled();
    expect(viewModel).toMatchObject({
      newSpellCount: 1,
      newCantripCount: 1,
      hasCantrips: true,
      hasSpells: true,
      hasCurrentSpells: true,
      maxSpellLevel: 2,
      className: "Wizard",
      targetLevel: 4,
    });

    expect((viewModel.cantrips as Array<{ name: string; selected: boolean }>)).toEqual([
      expect.objectContaining({ name: "Light", selected: true, schoolLabel: "Evocation" }),
    ]);
    expect((viewModel.spells as Array<{ name: string }>).map((spell) => spell.name)).toEqual(["Magic Missile"]);
    expect(viewModel.currentSpells).toEqual([{ id: "spell-1", name: "Shield", level: 1 }]);
  });

  it("exposes helper internals for max spell level and actor item normalization", async () => {
    const { __luStepSpellsInternals } = await import("./lu-step-spells");

    expect(__luStepSpellsInternals.getMaxSpellLevel(17)).toBe(9);
    expect(__luStepSpellsInternals.getMaxSpellLevel(5)).toBe(3);
    expect(__luStepSpellsInternals.getActorItems({
      id: "actor-1",
      items: new Set([{ id: "spell-1", type: "spell" }]),
      update: vi.fn(),
      createEmbeddedDocuments: vi.fn(),
      toObject: vi.fn(() => ({})),
    })).toEqual([{ id: "spell-1", type: "spell" }]);
  });

  it("patches cantrip/spell selection and search filtering in place", async () => {
    const { createLuSpellsStep } = await import("./lu-step-spells");
    const step = createLuSpellsStep();
    const setData = vi.fn();

    const cantripCard = new FakeElement();
    cantripCard.dataset.cantripUuid = "Compendium.dnd5e.spells.Item.light";
    const spellCard = new FakeElement();
    spellCard.dataset.spellUuid = "Compendium.dnd5e.spells.Item.magicMissile";
    const searchInput = new FakeElement();
    const visibleRow = new FakeElement();
    visibleRow.dataset.spellName = "magic missile";
    const hiddenRow = new FakeElement();
    hiddenRow.dataset.spellName = "fireball";

    const root = new FakeElement();
    root.setQuerySelectorAll("[data-cantrip-uuid]", [cantripCard]);
    root.setQuerySelectorAll("[data-spell-uuid]", [spellCard]);
    root.setQuerySelector("[data-spell-search]", searchInput);
    root.setQuerySelectorAll("[data-spell-name]", [visibleRow, hiddenRow]);

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData,
      rerender: vi.fn(),
    });

    cantripCard.trigger("click");
    spellCard.trigger("click");
    searchInput.value = "magic";
    searchInput.trigger("input");

    expect(setData).toHaveBeenNthCalledWith(1, {
      newSpellUuids: [],
      swappedOutUuids: [],
      swappedInUuids: [],
      newCantripUuids: ["Compendium.dnd5e.spells.Item.light"],
    });
    expect(setData).toHaveBeenNthCalledWith(2, {
      newSpellUuids: ["Compendium.dnd5e.spells.Item.magicMissile"],
      swappedOutUuids: [],
      swappedInUuids: [],
      newCantripUuids: [],
    });
    expect(visibleRow.style.display).toBe("");
    expect(hiddenRow.style.display).toBe("none");
  });
});
