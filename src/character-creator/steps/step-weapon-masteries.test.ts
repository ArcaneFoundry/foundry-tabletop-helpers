import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPackMock = vi.fn();
const fetchDocumentMock = vi.fn();

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPack: loadPackMock,
    fetchDocument: fetchDocumentMock,
  },
}));

class FakeClassList {
  private readonly values = new Set<string>();
  toggle(token: string, force?: boolean): boolean {
    if (force === true) return this.values.add(token), true;
    if (force === false) return this.values.delete(token), false;
    if (this.values.has(token)) return this.values.delete(token), false;
    this.values.add(token);
    return true;
  }
}

class FakeOption {
  dataset: Record<string, string> = {};
  checked = false;
  disabled = false;
  classList = new FakeClassList();
  private readonly listeners = new Map<string, Array<() => void>>();
  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }
  closest(selector: string): FakeOption | null {
    return selector === ".cc-choice-option" ? this : null;
  }
}

class FakeHost {
  innerHTML = "";
  textContent: string | null = null;
}

class FakeElement {
  private readonly selectorMap = new Map<string, unknown>();
  private readonly selectorAllMap = new Map<string, unknown[]>();
  querySelector<T = unknown>(selector: string): T | null {
    return (this.selectorMap.get(selector) ?? null) as T | null;
  }
  querySelectorAll<T = unknown>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) ?? []) as T[];
  }
  setQuerySelector(selector: string, value: unknown): void {
    this.selectorMap.set(selector, value);
  }
  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "weaponMasteries", "classSummary", "review"],
    selections: {
      class: {
        uuid: "class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: ["acr", "ath"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        hasWeaponMastery: true,
        weaponMasteryCount: 2,
        weaponMasteryPool: ["weapon:sim:*", "weapon:mar:*"],
        weaponProficiencyKeys: ["weapon:sim:*"],
      },
      background: {
        uuid: "background.soldier",
        name: "Soldier",
        img: "soldier.png",
        grants: {
          skillProficiencies: [],
          toolProficiency: null,
          weaponProficiencies: ["weapon:longsword"],
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiAllowed: [],
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: [], chosen: [] },
      },
      species: {
        uuid: "species.human",
        name: "Human",
        img: "human.png",
        traits: [],
        weaponProficiencies: [],
      },
    },
    stepStatus: new Map(),
    config: {
      packSources: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [], items: [] },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["standardArray"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      allowFirearms: false,
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  };
}

describe("step weapon masteries", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    loadPackMock.mockImplementation(async (packId: string) => {
      if (packId !== "dnd-players-handbook.equipment") return [];
      return [
        {
          uuid: "weapon.longsword",
          name: "Longsword",
          img: "longsword.png",
          packId,
          packLabel: "Equipment",
          type: "item",
          itemType: "weapon",
          weaponType: "martialM",
          identifier: "longsword",
        },
        {
          uuid: "weapon.shortbow",
          name: "Shortbow",
          img: "shortbow.png",
          packId,
          packLabel: "Equipment",
          type: "item",
          itemType: "weapon",
          weaponType: "simpleR",
          identifier: "shortbow",
        },
        {
          uuid: "weapon.dagger-of-venom",
          name: "Dagger of Venom",
          img: "dagger-of-venom.png",
          packId,
          packLabel: "Equipment",
          type: "item",
          itemType: "weapon",
          weaponType: "simpleM",
          identifier: "dagger",
        },
        {
          uuid: "weapon.pistol",
          name: "Pistol",
          img: "pistol.png",
          packId,
          packLabel: "Equipment",
          type: "item",
          itemType: "weapon",
          weaponType: "martialR",
          identifier: "pistol",
          mastery: "vex",
          isFirearm: true,
        },
      ];
    });

    fetchDocumentMock.mockImplementation(async (uuid: string) => {
      if (uuid === "weapon.longsword") {
        return {
          system: {
            mastery: "sap",
            description: { value: "<p>Reliable martial blade.</p>" },
            identifier: "longsword",
            weaponType: "martialM",
          },
        };
      }
      if (uuid === "weapon.shortbow") {
        return {
          system: {
            mastery: "vex",
            description: { value: "<p>Simple ranged weapon.</p>" },
            identifier: "shortbow",
            weaponType: "simpleR",
          },
        };
      }
      if (uuid === "weapon.dagger-of-venom") {
        return {
          system: {
            mastery: "nick",
            description: { value: "<p>A poisoned magic dagger.</p>" },
            identifier: "dagger",
            weaponType: "simpleM",
            rarity: "rare",
            magicalBonus: 1,
            properties: new Set(["fin", "mgc"]),
          },
        };
      }
      return null;
    });
  });

  it("is not applicable when the class grants no masteries", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      hasWeaponMastery: false,
      weaponMasteryCount: 0,
      weaponMasteryPool: [],
    };

    expect(createWeaponMasteriesStep().isApplicable?.(state)).toBe(false);
  });

  it("shows only mastery options the character is proficient with and includes mastery details", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const vm = await createWeaponMasteriesStep().buildViewModel(makeState());
    const section = vm.weaponMasterySection as {
      maxCount: number;
      options: Array<{ id: string; mastery: string; masteryDescription: string }>;
    };

    expect(section.maxCount).toBe(1);
    expect(section.options).toEqual([
      expect.objectContaining({
        id: "shortbow",
        mastery: "Vex",
        masteryDescription: expect.stringContaining("Advantage"),
      }),
    ]);
    expect(fetchDocumentMock).not.toHaveBeenCalledWith("weapon.longsword");
  });

  it("does not surface mastery options unlocked only by later origin or background proficiencies", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      weaponProficiencyKeys: [],
    };

    const vm = await createWeaponMasteriesStep().buildViewModel(state);
    const section = vm.weaponMasterySection as {
      options: Array<{ id: string }>;
      emptyMessage: string;
    };

    expect(section.options).toEqual([]);
    expect(section.emptyMessage).toContain("current class and item data");
  });

  it("filters out magical weapon variants even when they share a valid weapon identifier", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      weaponProficiencyKeys: ["weapon:sim:*", "weapon:mar:*"],
    };

    const vm = await createWeaponMasteriesStep().buildViewModel(state);
    const section = vm.weaponMasterySection as {
      options: Array<{ id: string; name: string }>;
    };

    expect(section.options.map((option) => option.name)).toEqual([
      "Longsword",
      "Shortbow",
    ]);
  });

  it("hides firearms from weapon mastery options by default", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      weaponProficiencyKeys: ["weapon:sim:*", "weapon:mar:*"],
    };

    const vm = await createWeaponMasteriesStep().buildViewModel(state);
    const section = vm.weaponMasterySection as {
      options: Array<{ name: string }>;
    };

    expect(section.options.map((option) => option.name)).toEqual([
      "Longsword",
      "Shortbow",
    ]);
  });

  it("surfaces firearms when the GM explicitly enables them", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.config.allowFirearms = true;
    state.selections.class = {
      ...state.selections.class!,
      weaponProficiencyKeys: ["weapon:sim:*", "weapon:mar:*"],
    };

    const vm = await createWeaponMasteriesStep().buildViewModel(state);
    const section = vm.weaponMasterySection as {
      options: Array<{ name: string }>;
    };

    expect(section.options.map((option) => option.name)).toEqual([
      "Longsword",
      "Pistol",
      "Shortbow",
    ]);
  });

  it("uses indexed mastery data directly when the pack index already exposes the needed mundane fields", async () => {
    loadPackMock.mockImplementationOnce(async (packId: string) => {
      if (packId !== "dnd-players-handbook.equipment") return [];
      return [
        {
          uuid: "weapon.shortbow",
          name: "Shortbow",
          img: "shortbow.png",
          packId,
          packLabel: "Equipment",
          type: "item",
          itemType: "weapon",
          weaponType: "simpleR",
          identifier: "shortbow",
          mastery: "vex",
          isFirearm: false,
        },
      ];
    });

    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const vm = await createWeaponMasteriesStep().buildViewModel(makeState());
    const section = vm.weaponMasterySection as {
      options: Array<{ id: string; mastery: string }>;
    };

    expect(section.options).toEqual([
      expect.objectContaining({
        id: "shortbow",
        mastery: "Vex",
      }),
    ]);
    expect(fetchDocumentMock).not.toHaveBeenCalled();
  });

  it("surfaces class-proficient weapons when the mastery pool is the all-weapons wildcard", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      identifier: "barbarian",
      name: "Barbarian",
      weaponMasteryPool: ["weapon:*"],
      weaponProficiencyKeys: ["weapon:sim", "weapon:mar"],
    };

    const vm = await createWeaponMasteriesStep().buildViewModel(state);
    const section = vm.weaponMasterySection as {
      options: Array<{ id: string; name: string }>;
    };

    expect(section.options.map((option) => option.name)).toEqual([
      "Longsword",
      "Shortbow",
    ]);
  });

  it("updates mastery selections, counters, and chips in place", async () => {
    const { createWeaponMasteriesStep } = await import("./step-weapon-masteries");
    const step = createWeaponMasteriesStep();
    const state = makeState();
    const setDataSilent = vi.fn();

    const masteryLongsword = new FakeOption();
    masteryLongsword.dataset.choiceSection = "weaponMasteries";
    masteryLongsword.dataset.choiceValue = "longsword";
    masteryLongsword.dataset.choiceLabel = "Longsword";
    masteryLongsword.dataset.choiceTooltip = "Longsword";
    masteryLongsword.dataset.choiceImg = "longsword.png";
    masteryLongsword.dataset.choiceMastery = "Sap";

    const masteryShortbow = new FakeOption();
    masteryShortbow.dataset.choiceSection = "weaponMasteries";
    masteryShortbow.dataset.choiceValue = "shortbow";
    masteryShortbow.dataset.choiceLabel = "Shortbow";
    masteryShortbow.dataset.choiceTooltip = "Shortbow";
    masteryShortbow.dataset.choiceImg = "shortbow.png";
    masteryShortbow.dataset.choiceMastery = "Vex";

    const masteryCount = new FakeHost();
    const masteryChips = new FakeHost();
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-choice-section='weaponMasteries']", [masteryLongsword, masteryShortbow]);
    root.setQuerySelector("[data-choice-count=\"weaponMasteries\"]", masteryCount);
    root.setQuerySelector("[data-selected-chips=\"weaponMasteries\"]", masteryChips);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    masteryLongsword.checked = true;
    masteryLongsword.trigger("change");
    masteryShortbow.checked = true;
    masteryShortbow.trigger("change");

    expect(state.selections.weaponMasteries).toEqual({
      chosenWeaponMasteries: ["longsword", "shortbow"],
      chosenWeaponMasteryDetails: [
        { id: "longsword", label: "Longsword", img: "longsword.png", mastery: "Sap", tooltip: "Longsword" },
        { id: "shortbow", label: "Shortbow", img: "shortbow.png", mastery: "Vex", tooltip: "Shortbow" },
      ],
      availableWeaponMasteries: 2,
    });
    expect(masteryCount.textContent).toBe("2");
    expect(masteryChips.innerHTML).toContain("Longsword");
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalled();
  });
});
