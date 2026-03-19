import { describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

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
    applicableSteps: ["class", "classChoices", "review"],
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
  it("builds selectable class skills", async () => {
    const { createClassChoicesStep } = await import("./step-class-choices");
    const vm = await createClassChoicesStep().buildViewModel(makeState());

    expect(vm).toMatchObject({
      className: "Fighter",
      primaryAbilityHint: "Strength or Dexterity recommended.",
      skillSection: expect.objectContaining({
        hasChoices: true,
        maxCount: 2,
      }),
    });
    expect((vm.skillSection as { options: Array<{ label: string }> }).options.map((skill) => skill.label)).toEqual([
      "Acrobatics",
      "Athletics",
      "Survival",
    ]);
  });

  it("updates class skill selections in place", async () => {
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

    const skillCount = new FakeHost();
    const skillChips = new FakeHost();
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-choice-section='skills']", [skillAth, skillSur]);
    root.setQuerySelector("[data-choice-count=\"skills\"]", skillCount);
    root.setQuerySelector("[data-selected-chips=\"skills\"]", skillChips);

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    skillAth.checked = true;
    skillAth.trigger("change");
    skillSur.checked = true;
    skillSur.trigger("change");

    expect(state.selections.skills).toEqual({ chosen: ["ath", "sur"] });
    expect(state.selections.classChoices).toEqual({
      chosenSkills: ["ath", "sur"],
    });
    expect(skillCount.textContent).toBe("2");
    expect(skillChips.innerHTML).toContain("Athletics");
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalled();
  });
});
