import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
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

class FakeOption {
  disabled = false;
  constructor(public value: string) {}
}

class FakeElement {
  textContent: string | null = null;
  classList = new FakeClassList();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly selectorAllMap = new Map<string, unknown[]>();

  querySelector<T = FakeElement>(selector: string): T | null {
    return (this.selectorMap.get(selector) ?? null) as T | null;
  }

  querySelectorAll<T = unknown>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) ?? []) as T[];
  }

  setQuerySelector(selector: string, value: FakeElement | null): void {
    this.selectorMap.set(selector, value);
  }

  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

class FakeSelect extends FakeElement {
  dataset: Record<string, string> = {};
  value = "";
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

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "backgroundGrants", "review"],
    selections: {
      background: {
        uuid: "Compendium.background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc", "his"],
          toolProficiency: "art:calligrapher",
          originFeatUuid: "Compendium.feat.magic-initiate",
          originFeatName: "Magic Initiate",
          originFeatImg: "feat.png",
          asiPoints: 3,
          asiCap: 2,
          asiSuggested: ["int", "wis"],
          languageGrants: ["common"],
          languageChoiceCount: 1,
          languageChoicePool: ["languages:standard:*"],
        },
        asi: { assignments: {} },
        languages: { fixed: ["common"], chosen: [] },
      },
      species: {
        uuid: "Compendium.species.elf",
        name: "Elf",
        img: "elf.png",
        traits: [],
        languageGrants: ["elvish"],
        languageChoiceCount: 1,
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
        spells: [],
        items: [],
      },
      disabledUUIDs: new Set<string>(),
      allowedAbilityMethods: ["4d6"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).Element = FakeSelect;
});

describe("step background grants", () => {
  it("builds the grants view model and completion hints from combined species/background grants", async () => {
    const { createBackgroundGrantsStep } = await import("./step-background-grants");
    const step = createBackgroundGrantsStep();
    const getStatusHint = step.getStatusHint;
    expect(getStatusHint).toBeTypeOf("function");
    if (!getStatusHint) throw new Error("Expected background grants step to expose getStatusHint");

    const incompleteState = makeState();
    expect(step.isComplete(incompleteState)).toBe(false);
    expect(getStatusHint(incompleteState)).toBe("Assign 3 more ability score points");

    const completeState = makeState({
      selections: {
        ...makeState().selections,
        background: {
          ...makeState().selections.background!,
          asi: { assignments: { int: 2, wis: 1 } },
          languages: { fixed: ["common"], chosen: ["dwarvish", "giant"] },
        },
      },
    });

    expect(step.isComplete(completeState)).toBe(true);

    const viewModel = await step.buildViewModel(completeState);
    expect(viewModel).toMatchObject({
      hasGrants: true,
      backgroundName: "Sage",
      grantedSkills: ["Arcana", "History"],
      toolProficiency: "Art: Calligrapher",
      originFeatName: "Magic Initiate",
      hasASI: true,
      asiPointsUsed: 3,
      asiPoints: 3,
      asiComplete: true,
      hasLanguages: true,
      fixedLanguages: ["Common", "Elvish"],
    });
    expect((viewModel.languageSlots as Array<{ options: Array<{ id: string }> }>)).toHaveLength(2);
  });

  it("exposes combined language helpers through internals", async () => {
    const { __backgroundGrantsStepInternals } = await import("./step-background-grants");
    const state = makeState();

    expect(__backgroundGrantsStepInternals.getTotalLanguageChoiceCount(state)).toBe(2);
    expect(__backgroundGrantsStepInternals.getAllFixedLanguages(state)).toEqual(["common", "elvish"]);
  });

  it("patches asi and language dropdown interactions in place", async () => {
    const { createBackgroundGrantsStep } = await import("./step-background-grants");
    const step = createBackgroundGrantsStep();
    const state = makeState();
    const setDataSilent = vi.fn();

    const asiCounter = new FakeElement();
    const asiComplete = new FakeElement();
    const intSelect = new FakeSelect();
    intSelect.dataset.asiAbility = "int";
    intSelect.value = "2";
    intSelect.setQuerySelector('option[value="2"]', new FakeOption("2") as never);
    const wisSelect = new FakeSelect();
    wisSelect.dataset.asiAbility = "wis";
    wisSelect.value = "1";
    wisSelect.setQuerySelector('option[value="2"]', new FakeOption("2") as never);

    const lang0 = new FakeSelect();
    lang0.dataset.langSlot = "0";
    lang0.value = "dwarvish";
    const lang1 = new FakeSelect();
    lang1.dataset.langSlot = "1";
    lang1.value = "";
    const lang1Option = new FakeOption("dwarvish");
    lang1.setQuerySelectorAll("option", [new FakeOption(""), lang1Option, new FakeOption("giant")]);

    const root = new FakeElement();
    root.setQuerySelectorAll("[data-asi-ability]", [intSelect, wisSelect]);
    root.setQuerySelector("[data-asi-counter]", asiCounter);
    root.setQuerySelector("[data-asi-complete]", asiComplete);
    root.setQuerySelectorAll("[data-lang-slot]", [lang0, lang1]);

    const onActivate = step.onActivate;
    expect(onActivate).toBeTypeOf("function");
    if (!onActivate) throw new Error("Expected background grants step to expose onActivate");

    onActivate(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    intSelect.trigger("change");
    wisSelect.trigger("change");
    lang0.trigger("change");

    expect(state.selections.background?.asi.assignments).toEqual({ int: 2, wis: 1 });
    expect(asiCounter.textContent).toBe("3 / 3");
    expect(asiComplete.classList.contains("cc-grants-complete")).toBe(true);
    expect(setDataSilent).toHaveBeenCalledTimes(3);
    expect(state.selections.background?.languages.chosen).toEqual(["dwarvish"]);
    expect(lang1Option.disabled).toBe(true);
  });
});
