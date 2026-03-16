import { describe, expect, it, vi } from "vitest";

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

class FakeRow {
  classList = new FakeClassList();
}

class FakeCheckbox {
  dataset: Record<string, string> = {};
  checked = false;
  disabled = false;
  private readonly listeners = new Map<string, Array<() => void>>();
  readonly row = new FakeRow();

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
  classList = new FakeClassList();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly selectorAllMap = new Map<string, FakeCheckbox[]>();

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeCheckbox[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelector(selector: string, value: FakeElement | null): void {
    this.selectorMap.set(selector, value);
  }

  setQuerySelectorAll(selector: string, value: FakeCheckbox[]): void {
    this.selectorAllMap.set(selector, value);
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "class", "skills", "review"],
    selections: {
      background: {
        uuid: "Compendium.background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 0,
          asiCap: 0,
          asiSuggested: [],
          languageGrants: [],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: {
          assignments: {},
        },
        languages: {
          fixed: [],
          chosen: [],
        },
      },
      class: {
        uuid: "Compendium.class.wizard",
        name: "Wizard",
        img: "wizard.png",
        identifier: "wizard",
        skillPool: ["arc", "his", "ins", "inv"],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "int",
        spellcastingProgression: "full",
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

describe("step skills", () => {
  it("builds view model with background skills removed from the class pool", async () => {
    const { createSkillsStep } = await import("./step-skills");
    const step = createSkillsStep();

    const viewModel = await step.buildViewModel(makeState({
      selections: {
        ...makeState().selections,
        skills: { chosen: ["his"] },
      },
    }));

    expect(viewModel).toMatchObject({
      chosenCount: 1,
      maxPicks: 2,
      atMax: false,
      className: "Wizard",
      backgroundSkillChips: ["Arcana"],
    });
    expect((viewModel.availableSkills as Array<{ key: string }>).map((skill) => skill.key)).toEqual([
      "his",
      "ins",
      "inv",
    ]);
  });

  it("exposes background, pool, and skill-count helpers and completion gating", async () => {
    const { createSkillsStep, __skillsStepInternals } = await import("./step-skills");
    const state = makeState({
      selections: {
        ...makeState().selections,
        skills: { chosen: ["his", "ins"] },
      },
    });
    const step = createSkillsStep();

    expect(__skillsStepInternals.getBackgroundSkills(state)).toEqual(["arc"]);
    expect(__skillsStepInternals.getClassPool(state)).toEqual(["arc", "his", "ins", "inv"]);
    expect(__skillsStepInternals.getSkillCount(state)).toBe(2);
    expect(step.isComplete(state)).toBe(true);
    expect(step.isComplete(makeState({
      selections: {
        ...makeState().selections,
        skills: { chosen: ["his"] },
      },
    }))).toBe(false);
  });

  it("patches skill selection, enforces max picks, and ignores background skills", async () => {
    const { createSkillsStep, __skillsStepInternals } = await import("./step-skills");
    const step = createSkillsStep();
    const state = makeState();
    (globalThis as Record<string, unknown>).Element = FakeCheckbox;
    const setDataSilent = vi.fn((value: unknown) => {
      state.selections.skills = value as WizardState["selections"]["skills"];
    });

    const his = new FakeCheckbox();
    his.dataset.skill = "his";
    const ins = new FakeCheckbox();
    ins.dataset.skill = "ins";
    const arc = new FakeCheckbox();
    arc.dataset.skill = "arc";
    const countEl = new FakeElement();
    const counterEl = new FakeElement();
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-skill]", [his, ins, arc]);
    root.setQuerySelector("[data-skill-count]", countEl);
    root.setQuerySelector(".cc-skills__counter", counterEl);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    his.checked = true;
    his.trigger("change");
    ins.checked = true;
    ins.trigger("change");
    arc.checked = true;
    arc.trigger("change");

    expect(setDataSilent).toHaveBeenNthCalledWith(1, { chosen: ["his"] });
    expect(setDataSilent).toHaveBeenNthCalledWith(2, { chosen: ["his", "ins"] });
    expect(setDataSilent).toHaveBeenCalledTimes(2);
    expect(arc.checked).toBe(false);
    expect(his.disabled).toBe(false);
    expect(ins.disabled).toBe(false);
    expect(arc.disabled).toBe(true);
    expect(his.row.classList.contains("cc-skill-row--checked")).toBe(true);
    expect(ins.row.classList.contains("cc-skill-row--checked")).toBe(true);
    expect(countEl.textContent).toBe("2");
    expect(counterEl.classList.contains("cc-skills__counter--full")).toBe(true);

    __skillsStepInternals.patchSkillsDOM(root as unknown as HTMLElement, new Set(["ins"]), 2);
    expect(his.checked).toBe(false);
    expect(ins.checked).toBe(true);
    expect(countEl.textContent).toBe("1");
  });
});
