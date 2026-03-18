import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPacksMock = vi.fn(async () => new Map());
const loadPackMock = vi.fn();
const getIndexedEntriesMock = vi.fn();
const fetchDocumentMock = vi.fn();

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    loadPack: loadPackMock,
    getIndexedEntries: getIndexedEntriesMock,
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
    applicableSteps: ["class", "classChoices", "originChoices", "review"],
    selections: {
      class: {
        uuid: "class.fighter",
        name: "Fighter",
        img: "fighter.png",
        identifier: "fighter",
        skillPool: ["acr", "ath", "sur"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        primaryAbilities: ["str", "dex"],
        primaryAbilityHint: "Strength or Dexterity recommended.",
        hasWeaponMastery: true,
        weaponMasteryCount: 2,
        weaponMasteryPool: ["weapon:sim:*", "weapon:mar:*"],
        weaponProficiencies: ["Simple", "Martial"],
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
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  };
}

describe("step class choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIndexedEntriesMock.mockReturnValue([
      {
        uuid: "weapon.longsword",
        name: "Longsword",
        img: "longsword.png",
        packId: "dnd-players-handbook.equipment",
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
        packId: "dnd-players-handbook.equipment",
        packLabel: "Equipment",
        type: "item",
        itemType: "weapon",
        weaponType: "simpleR",
        identifier: "shortbow",
      },
    ]);
    loadPackMock.mockResolvedValue([
      {
        uuid: "weapon.longsword",
        name: "Longsword",
        img: "longsword.png",
        packId: "dnd5e.items",
        packLabel: "Items",
        type: "item",
        itemType: "weapon",
        weaponType: "martialM",
        identifier: "longsword",
      },
      {
        uuid: "weapon.shortbow",
        name: "Shortbow",
        img: "shortbow.png",
        packId: "dnd5e.items",
        packLabel: "Items",
        type: "item",
        itemType: "weapon",
        weaponType: "simpleR",
        identifier: "shortbow",
      },
    ]);
    fetchDocumentMock.mockImplementation(async (uuid: string) => ({
      system: {
        mastery: uuid === "weapon.longsword" ? "sap" : "vex",
        description: { value: `<p>${uuid} description.</p>` },
        identifier: uuid === "weapon.longsword" ? "longsword" : "shortbow",
      },
    }));
  });

  it("builds selectable class skills and weapon mastery sections", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const vm = await createClassChoicesStep().buildViewModel(makeState());

    expect(vm).toMatchObject({
      className: "Fighter",
      primaryAbilityHint: "Strength or Dexterity recommended.",
      skillSection: expect.objectContaining({
        hasChoices: true,
        maxCount: 2,
      }),
      weaponMasterySection: expect.objectContaining({
        hasChoices: true,
        maxCount: 2,
      }),
    });
    expect((vm.skillSection as { options: Array<{ label: string }> }).options.map((skill) => skill.label)).toEqual([
      "Acrobatics",
      "Athletics",
      "Survival",
    ]);
    expect((vm.weaponMasterySection as { options: Array<{ name: string }> }).options).toHaveLength(2);
  });

  it("updates class skill and weapon mastery selections in place", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const step = createClassChoicesStep();
    const state = makeState();
    const setDataSilent = vi.fn();

    const skillAth = new FakeOption();
    skillAth.dataset.choiceSection = "skills";
    skillAth.dataset.choiceValue = "ath";
    skillAth.dataset.choiceLabel = "Athletics";
    skillAth.dataset.choiceTooltip = "Athletics";

    const skillSur = new FakeOption();
    skillSur.dataset.choiceSection = "skills";
    skillSur.dataset.choiceValue = "sur";
    skillSur.dataset.choiceLabel = "Survival";
    skillSur.dataset.choiceTooltip = "Survival";

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

    const skillCount = new FakeHost();
    const masteryCount = new FakeHost();
    const skillChips = new FakeHost();
    const masteryChips = new FakeHost();
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-choice-section='skills']", [skillAth, skillSur]);
    root.setQuerySelectorAll("[data-choice-section='weaponMasteries']", [masteryLongsword, masteryShortbow]);
    root.setQuerySelector("[data-choice-count=\"skills\"]", skillCount);
    root.setQuerySelector("[data-choice-count=\"weaponMasteries\"]", masteryCount);
    root.setQuerySelector("[data-selected-chips=\"skills\"]", skillChips);
    root.setQuerySelector("[data-selected-chips=\"weaponMasteries\"]", masteryChips);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    skillAth.checked = true;
    skillAth.trigger("change");
    skillSur.checked = true;
    skillSur.trigger("change");
    masteryLongsword.checked = true;
    masteryLongsword.trigger("change");
    masteryShortbow.checked = true;
    masteryShortbow.trigger("change");

    expect(state.selections.skills).toEqual({ chosen: ["ath", "sur"] });
    expect(state.selections.classChoices).toEqual({
      chosenSkills: ["ath", "sur"],
      chosenWeaponMasteries: ["longsword", "shortbow"],
      chosenWeaponMasteryDetails: [
        { id: "longsword", label: "Longsword", img: "longsword.png", mastery: "Sap", tooltip: "Longsword" },
        { id: "shortbow", label: "Shortbow", img: "shortbow.png", mastery: "Vex", tooltip: "Shortbow" },
      ],
      availableWeaponMasteries: 2,
    });
    expect(skillCount.textContent).toBe("2");
    expect(masteryCount.textContent).toBe("2");
    expect(skillChips.innerHTML).toContain("Athletics");
    expect(masteryChips.innerHTML).toContain("Longsword");
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalled();
  });
});
