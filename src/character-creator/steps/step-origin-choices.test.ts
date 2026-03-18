import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const loadPacksMock = vi.fn();
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const fetchDocumentMock = vi.fn();

vi.mock("../data/advancement-parser", () => ({
  parseBackgroundGrants: vi.fn(async (doc: { mockGrants?: unknown }) => doc.mockGrants ?? null),
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
    getCachedDescription: getCachedDescriptionMock,
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

class FakeRow {
  classList = new FakeClassList();
}

class FakeCheckbox {
  dataset: Record<string, string> = {};
  checked = false;
  disabled = false;
  row = new FakeRow();
  private readonly listeners = new Map<string, Array<() => void>>();
  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }
  closest(selector: string): FakeRow | null {
    return selector === ".cc-skill-row" ? this.row : null;
  }
}

class FakeElement {
  textContent: string | null = null;
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

class FakeCard {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => void>>();
  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  trigger(event: string): void {
    for (const handler of this.listeners.get(event) ?? []) handler();
  }
}

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "originChoices", "review"],
    selections: {
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          toolProficiency: "art:calligrapher",
          originFeatUuid: "feat.magic-initiate",
          originFeatName: "Magic Initiate",
          originFeatImg: "feat.png",
          asiPoints: 3,
          asiCap: 2,
          asiSuggested: ["int", "wis"],
          languageGrants: ["common"],
          languageChoiceCount: 1,
          languageChoicePool: ["languages:standard:*"],
        },
        asi: { assignments: { int: 2, wis: 1 } },
        languages: { fixed: ["common"], chosen: ["draconic"] },
      },
      species: {
        uuid: "species.elf",
        name: "Elf",
        img: "elf.png",
        traits: ["Darkvision"],
        languageGrants: ["elvish"],
        languageChoiceCount: 1,
        languageChoicePool: ["languages:standard:*"],
      },
      class: {
        uuid: "class.wizard",
        name: "Wizard",
        img: "wizard.png",
        identifier: "wizard",
        skillPool: ["arc", "his", "ins"],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "int",
        spellcastingProgression: "full",
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

describe("step origin choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPacksMock.mockResolvedValue(new Map());
    getIndexedEntriesMock.mockImplementation((type: string) => {
      if (type === "background") return [];
      if (type === "feat") return [];
      return [];
    });
    getCachedDescriptionMock.mockResolvedValue("");
    fetchDocumentMock.mockResolvedValue(null);
  });

  it("builds the merged origin choice view model", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const vm = await createOriginChoicesStep().buildViewModel(makeState());

    expect(vm).toMatchObject({
      className: "Wizard",
      backgroundName: "Sage",
      chosenCount: 0,
      maxPicks: 2,
      toolProficiency: "Art: Calligrapher",
      originFeatName: "Magic Initiate",
      skillSelectionMessage: "Choose 2 class skills. Background skills are locked out automatically.",
    });
    expect((vm.availableSkills as Array<{ key: string }>).map((skill) => skill.key)).toEqual(["his", "ins"]);
  });

  it("surfaces a validation warning when background overlap leaves too few class skill options", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      skillPool: ["arc", "his"],
      skillCount: 2,
    };

    const step = createOriginChoicesStep();
    const vm = await step.buildViewModel(state);

    expect(vm).toMatchObject({
      hasAvailableSkills: true,
      validationMessages: [
        "Only 1 legal class skill option remain, so this step will accept fewer picks than the class normally grants.",
      ],
      maxPicks: 1,
    });
    expect(step.getStatusHint?.(state)).toBe("Choose 1 more class skill");
  });

  it("treats reduced legal class skill pools as completable once the available picks are chosen", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const state = makeState();
    state.selections.class = {
      ...state.selections.class!,
      skillPool: ["arc", "his"],
      skillCount: 2,
    };
    state.selections.skills = { chosen: ["his"] };
    state.selections.originFeat = {
      uuid: "feat.magic-initiate",
      name: "Magic Initiate",
      img: "feat.png",
      isCustom: false,
    };

    const step = createOriginChoicesStep();
    expect(step.isComplete(state)).toBe(true);
  });

  it("shows custom origin feat choices when feat swapping is enabled", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const state = makeState();
    state.config.allowCustomBackgrounds = true;
    getIndexedEntriesMock.mockImplementation((type: string) => {
      if (type === "background") {
        return [
          { uuid: "background.sage", name: "Sage", img: "sage.png", packId: "dnd5e.backgrounds", packLabel: "Backgrounds", type: "background", itemType: "background" },
          { uuid: "background.guard", name: "Guard", img: "guard.png", packId: "dnd5e.backgrounds", packLabel: "Backgrounds", type: "background", itemType: "background" },
        ];
      }
      if (type === "feat") {
        return [
          {
            uuid: "feat.magic-initiate",
            name: "Magic Initiate",
            img: "feat.png",
            packId: "dnd5e.feats",
            packLabel: "Feats",
            type: "feat",
            itemType: "feat",
          },
          {
            uuid: "feat.alert",
            name: "Alert",
            img: "alert.png",
            packId: "dnd5e.feats",
            packLabel: "Feats",
            type: "feat",
            itemType: "feat",
          },
          {
            uuid: "feat.boon",
            name: "Boon of Combat Prowess",
            img: "boon.png",
            packId: "dnd5e.feats",
            packLabel: "Feats",
            type: "feat",
            itemType: "feat",
          },
        ];
      }
      return [];
    });
    getCachedDescriptionMock.mockResolvedValue("<p>Stay sharp.</p>");
    fetchDocumentMock.mockImplementation(async (uuid: string) => {
      if (uuid === "background.sage") {
        return {
          mockGrants: {
            originFeatUuid: "feat.magic-initiate",
          },
        };
      }
      if (uuid === "background.guard") {
        return {
          mockGrants: {
            originFeatUuid: "feat.alert",
          },
        };
      }
      if (uuid === "feat.magic-initiate") {
        return { system: { type: { value: "feat" }, prerequisites: { level: null } } };
      }
      if (uuid === "feat.alert") {
        return { system: { type: { value: "feat" }, prerequisites: { level: null } } };
      }
      if (uuid === "feat.boon") {
        return { system: { type: { value: "feat" }, prerequisites: { level: 19 } } };
      }
      return null;
    });

    const vm = await createOriginChoicesStep().buildViewModel(state);

    expect(loadPacksMock).toHaveBeenCalled();
    expect(vm).toMatchObject({
      allowOriginFeatSwap: true,
      defaultOriginFeatName: "Magic Initiate",
      originFeatName: "Magic Initiate",
      isCustomOriginFeat: false,
    });
    expect(vm.availableOriginFeats).toHaveLength(2);
    expect(vm.selectedOriginFeat).toMatchObject({
      uuid: "feat.magic-initiate",
      description: "<p>Stay sharp.</p>",
    });
  });

  it("updates class skills and default origin feat in place", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const step = createOriginChoicesStep();
    const state = makeState();
    const setDataSilent = vi.fn();
    const his = new FakeCheckbox();
    his.dataset.skill = "his";
    const ins = new FakeCheckbox();
    ins.dataset.skill = "ins";
    const countEl = new FakeElement();
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-skill]", [his, ins]);
    root.setQuerySelector("[data-skill-count]", countEl);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    his.checked = true;
    his.trigger("change");
    ins.checked = true;
    ins.trigger("change");

    expect(state.selections.originFeat).toMatchObject({ uuid: "feat.magic-initiate" });
    expect(state.selections.skills).toEqual({ chosen: ["his", "ins"] });
    expect(countEl.textContent).toBe("2");
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalled();
  });

  it("lets custom-background mode swap the origin feat from the card grid", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const step = createOriginChoicesStep();
    const state = makeState();
    state.config.allowCustomBackgrounds = true;

    const alertCard = new FakeCard();
    alertCard.dataset.cardUuid = "feat.alert";
    alertCard.dataset.cardName = "Alert";
    alertCard.dataset.cardImg = "alert.png";
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-skill]", []);
    root.setQuerySelectorAll("[data-card-uuid]", [alertCard]);

    const setDataSilent = vi.fn();
    const rerender = vi.fn();
    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender,
    });

    alertCard.trigger("click");

    expect(state.selections.originFeat).toMatchObject({
      uuid: "feat.alert",
      name: "Alert",
      isCustom: true,
    });
    expect(setDataSilent).toHaveBeenCalledWith({
      classSkills: [],
      chosenLanguages: [],
      originFeatUuid: "feat.alert",
    });
    expect(rerender).toHaveBeenCalled();
  });

  it("shows a fallback message when no alternative origin feats are available", async () => {
    const { createOriginChoicesStep } = await import("./step-origin-choices");
    const state = makeState();
    state.config.allowCustomBackgrounds = true;
    state.config.packSources = {
      ...state.config.packSources,
      backgrounds: ["test.backgrounds.empty"],
      feats: ["test.feats.empty"],
    };

    const vm = await createOriginChoicesStep().buildViewModel(state);

    expect(vm).toMatchObject({
      hasOriginFeats: false,
      originFeatEmptyMessage:
        "No alternative 2024 origin feats were found in the enabled feat packs, so the background's default feat will be used.",
    });
  });
});
