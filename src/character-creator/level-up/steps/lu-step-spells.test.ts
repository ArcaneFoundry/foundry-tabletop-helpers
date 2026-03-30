import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LevelUpState } from "../level-up-types";

const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const resolveClassSpellUuidsMock = vi.fn(async () => null);
const fromUuidMock = vi.fn(async () => null);

vi.mock("../../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
}));

vi.mock("../../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
  },
}));

vi.mock("../../data/spell-list-resolver", () => ({
  resolveClassSpellUuids: resolveClassSpellUuidsMock,
}));

vi.mock("../../../types", async () => {
  const actual = await vi.importActual<typeof import("../../../types")>("../../../types");
  return {
    ...actual,
    fromUuid: fromUuidMock,
  };
});

class FakeElement {
  dataset: Record<string, string> = {};
  style = { display: "" };
  value = "";
  classList = {
    toggle: vi.fn(),
  };
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
    classItems: [
      {
        itemId: "class-1",
        name: "Wizard",
        identifier: "wizard",
        levels: 3,
        hitDie: "d6",
        advancement: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveClassSpellUuidsMock.mockResolvedValue(null);
  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.dnd5e.spells.Item.light",
      name: "Light",
      img: "light.png",
      spellLevel: 0,
      school: "evo",
    },
    {
      uuid: "Compendium.dnd5e.spells.Item.magicMissile",
      name: "Magic Missile",
      img: "magic-missile.png",
      spellLevel: 1,
      school: "evo",
    },
    {
      uuid: "Compendium.dnd5e.spells.Item.fireball",
      name: "Fireball",
      img: "fireball.png",
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
      hasCantripChoices: true,
      hasSpellChoices: true,
      hasCurrentSpells: true,
      maxSpellLevel: 2,
      className: "Wizard",
      targetLevel: 4,
      selectionSummary: "1 / 1 cantrips, 1 / 2 spells",
    });

    expect((viewModel.cantrips as Array<{ name: string; selected: boolean }>)).toEqual([
      expect.objectContaining({ name: "Light", selected: true, schoolLabel: "Evocation" }),
    ]);
    expect((viewModel.spellsByLevel as Array<{ spells: Array<{ name: string }> }>)[0]?.spells.map((spell) => spell.name)).toEqual(["Magic Missile"]);
    expect(viewModel.currentSpells).toEqual([
      expect.objectContaining({ id: "spell-1", name: "Shield", level: 1 }),
    ]);
  });

  it("exposes helper internals for normalization and actor item access", async () => {
    const { __luStepSpellsInternals } = await import("./lu-step-spells");

    expect(__luStepSpellsInternals.normalizeChoice({
      newSpellUuids: ["spell-a", "spell-a"],
      swappedOutUuids: ["old-a", "old-b"],
      swappedInUuids: ["new-a", "spell-a"],
      newCantripUuids: ["cantrip-a", "cantrip-a"],
    }, {
      newCantrips: 1,
      newSpells: 1,
      swapLimit: 1,
    })).toEqual({
      newSpellUuids: ["spell-a"],
      swappedOutUuids: ["old-a"],
      swappedInUuids: ["new-a"],
      newCantripUuids: ["cantrip-a"],
    });
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
    cantripCard.dataset.spellName = "light";
    cantripCard.dataset.spellSchool = "evo";
    const spellCard = new FakeElement();
    spellCard.dataset.spellUuid = "Compendium.dnd5e.spells.Item.magicMissile";
    spellCard.dataset.spellName = "magic missile";
    spellCard.dataset.spellSchool = "evo";
    const searchInput = new FakeElement();
    const visibleRow = new FakeElement();
    visibleRow.dataset.spellName = "magic missile";
    visibleRow.dataset.spellSchool = "evo";
    const hiddenRow = new FakeElement();
    hiddenRow.dataset.spellName = "fireball";
    hiddenRow.dataset.spellSchool = "evo";

    const root = new FakeElement();
    root.setQuerySelectorAll("[data-cantrip-uuid]", [cantripCard]);
    root.setQuerySelectorAll("[data-spell-uuid]", [spellCard]);
    root.setQuerySelectorAll("[data-filter-card]", [visibleRow, hiddenRow]);
    root.setQuerySelectorAll("[data-school-filter-button]", []);
    root.setQuerySelectorAll("[data-preview-uuid]", []);
    root.setQuerySelector("[data-spell-search]", searchInput);

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
