import { describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

class FakeSelect {
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

  querySelector(): null {
    return null;
  }
}

class FakeRoot {
  private readonly selectorAllMap = new Map<string, unknown[]>();

  querySelectorAll<T = unknown>(selector: string): T[] {
    return (this.selectorAllMap.get(selector) ?? []) as T[];
  }

  setQuerySelectorAll(selector: string, values: unknown[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["background", "backgroundAsi", "review"],
    selections: {
      class: {
        uuid: "class.wizard",
        name: "Wizard",
        img: "wizard.png",
        identifier: "wizard",
        skillPool: ["arc", "his"],
        skillCount: 2,
        isSpellcaster: true,
        spellcastingAbility: "int",
        spellcastingProgression: "full",
        primaryAbilities: ["int", "con"],
        primaryAbilityHint: "Intelligence recommended, with Constitution helping concentration.",
      },
      background: {
        uuid: "background.sage",
        name: "Sage",
        img: "sage.png",
        grants: {
          skillProficiencies: ["arc"],
          weaponProficiencies: [],
          toolProficiency: null,
          originFeatUuid: null,
          originFeatName: null,
          originFeatImg: null,
          asiPoints: 3,
          asiCap: 2,
          asiSuggested: ["int", "wis"],
          languageGrants: ["common"],
          languageChoiceCount: 0,
          languageChoicePool: [],
        },
        asi: { assignments: {} },
        languages: { fixed: ["common"], chosen: [] },
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

describe("step background asi", () => {
  it("builds and updates background ASI assignments", async () => {
    const { createBackgroundAsiStep } = await import("./step-background-asi");
    const step = createBackgroundAsiStep();
    const state = makeState();

    const vm = await step.buildViewModel(state);
    expect(vm).toMatchObject({
      backgroundName: "Sage",
      asiPoints: 3,
      asiPointsUsed: 0,
      hasASI: true,
      hasClassRecommendations: true,
    });
    expect(vm).toHaveProperty("asiAbilities");
    const asiAbilities = (vm as { asiAbilities: Array<Record<string, unknown>> }).asiAbilities;
    expect(asiAbilities.find((entry) => entry.key === "int")).toMatchObject({
      classRecommended: true,
      backgroundSuggested: true,
    });
    expect(asiAbilities.some((entry) => entry.key === "con")).toBe(false);

    const intSelect = new FakeSelect();
    intSelect.dataset.asiAbility = "int";
    intSelect.value = "2";
    const wisSelect = new FakeSelect();
    wisSelect.dataset.asiAbility = "wis";
    wisSelect.value = "1";
    const root = new FakeRoot();
    root.setQuerySelectorAll("[data-asi-ability]", [intSelect, wisSelect]);
    const setDataSilent = vi.fn();

    step.onActivate?.(state, root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    intSelect.trigger("change");
    wisSelect.trigger("change");

    expect(state.selections.background?.asi.assignments).toEqual({ int: 2, wis: 1 });
    expect(step.isComplete(state)).toBe(true);
    expect(setDataSilent).toHaveBeenCalledTimes(2);
  });

  it("restricts background ASI assignments to the background's allowed abilities by default", async () => {
    const { createBackgroundAsiStep } = await import("./step-background-asi");
    const step = createBackgroundAsiStep();
    const state = makeState();

    const vm = await step.buildViewModel(state);
    const asiAbilities = (vm as { asiAbilities: Array<Record<string, unknown>> }).asiAbilities;
    expect(asiAbilities.map((entry) => entry.key)).toEqual(["int", "wis"]);
    expect(asiAbilities.find((entry) => entry.key === "str")).toBeUndefined();
    expect(asiAbilities.find((entry) => entry.key === "int")).toMatchObject({
      allowedByBackground: true,
    });
  });

  it("allows unrestricted background ASI assignments when the module rule is enabled", async () => {
    const { createBackgroundAsiStep } = await import("./step-background-asi");
    const step = createBackgroundAsiStep();
    const state = makeState();
    state.config.allowUnrestrictedBackgroundAsi = true;

    const vm = await step.buildViewModel(state);
    const asiAbilities = (vm as { asiAbilities: Array<Record<string, unknown>> }).asiAbilities;
    expect(asiAbilities).toHaveLength(6);
    expect(asiAbilities.find((entry) => entry.key === "str")).toMatchObject({
      allowedByBackground: true,
      options: expect.arrayContaining([{ value: 1, label: "+1", selected: false }]),
    });
  });
});
