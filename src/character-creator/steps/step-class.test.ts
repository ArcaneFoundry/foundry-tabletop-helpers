import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WizardState } from "../character-creator-types";

const logWarnMock = vi.fn();
const loadPacksMock = vi.fn(async () => {});
const getIndexedEntriesMock = vi.fn();
const getCachedDescriptionMock = vi.fn();
const fetchDocumentMock = vi.fn();
const parseClassSkillAdvancementMock = vi.fn();
const parseClassAdvancementRequirementsMock = vi.fn();
const parseClassSpellcastingMock = vi.fn();
const parseClassWeaponMasteryAdvancementMock = vi.fn();
const getEffectiveAdvancementLevelMock = vi.fn((entry: { level?: unknown; configuration?: { choices?: unknown } }) => {
  if (typeof entry.level === "number") return entry.level;
  const choices = entry.configuration?.choices;
  if (choices && typeof choices === "object" && !Array.isArray(choices)) {
    const levels = Object.entries(choices as Record<string, unknown>)
      .flatMap(([key, choice]) => {
        const level = Number(key);
        if (!Number.isFinite(level) || String(level) !== key) return [];
        const count = choice && typeof choice === "object" ? (choice as { count?: unknown }).count : 0;
        return typeof count === "number" && count > 0 ? [level] : [];
      });
    if (levels.length > 0) return Math.min(...levels);
  }
  return 1;
});
const renderTemplateMock = vi.fn();
const beginCardSelectionUpdateMock = vi.fn();
const isCurrentCardSelectionUpdateMock = vi.fn();
const patchCardDetailFromTemplateMock = vi.fn();

vi.mock("../../logger", () => ({
  MOD: "foundry-tabletop-helpers",
  Log: {
    warn: logWarnMock,
  },
}));

vi.mock("../../types", () => ({
  renderTemplate: renderTemplateMock,
}));

vi.mock("../data/compendium-indexer", () => ({
  compendiumIndexer: {
    loadPacks: loadPacksMock,
    getIndexedEntries: getIndexedEntriesMock,
    getCachedDescription: getCachedDescriptionMock,
    fetchDocument: fetchDocumentMock,
  },
}));

vi.mock("../data/advancement-parser", () => ({
  getEffectiveAdvancementLevel: getEffectiveAdvancementLevelMock,
  parseClassAdvancementRequirements: parseClassAdvancementRequirementsMock,
  parseClassSkillAdvancement: parseClassSkillAdvancementMock,
  parseClassSpellcasting: parseClassSpellcastingMock,
  parseClassWeaponMasteryAdvancement: parseClassWeaponMasteryAdvancementMock,
}));

vi.mock("./card-select-utils", () => ({
  beginCardSelectionUpdate: beginCardSelectionUpdateMock,
  isCurrentCardSelectionUpdate: isCurrentCardSelectionUpdateMock,
  patchCardDetailFromTemplate: patchCardDetailFromTemplateMock,
}));

class FakeElement {
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, Array<() => Promise<void> | void>>();
  private readonly selectorAllMap = new Map<string, FakeElement[]>();

  addEventListener(event: string, handler: () => Promise<void> | void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  async trigger(event: string): Promise<void> {
    for (const handler of this.listeners.get(event) ?? []) {
      await handler();
    }
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  setQuerySelectorAll(selector: string, values: FakeElement[]): void {
    this.selectorAllMap.set(selector, values);
  }
}

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "review"],
    selections: {},
    stepStatus: new Map(),
    config: {
      packSources: {
        classes: ["pack.classes"],
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
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).Element = FakeElement;

  getIndexedEntriesMock.mockReturnValue([
    {
      uuid: "Compendium.class.fighter",
      name: "Fighter",
      img: "fighter.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "fighter",
    },
    {
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "wizard",
    },
  ]);
  getCachedDescriptionMock.mockResolvedValue("<p>Class details</p>");
  renderTemplateMock.mockResolvedValue("<div>detail</div>");
  parseClassSkillAdvancementMock.mockReturnValue({
    skillPool: ["arc", "his"],
    skillCount: 2,
  });
  parseClassAdvancementRequirementsMock.mockResolvedValue([]);
  parseClassSpellcastingMock.mockReturnValue({
    isSpellcaster: true,
    ability: "int",
    progression: "full",
  });
  parseClassWeaponMasteryAdvancementMock.mockReturnValue({
    count: 2,
    pool: ["weapon:sim:*", "weapon:mar:*"],
  });
  fetchDocumentMock.mockResolvedValue({
    system: {
      description: {
        value: "<p>Scholars of war who stand as living bulwarks.</p><p>More details follow.</p>",
      },
      hitDice: "d10",
      saves: ["str", "con"],
      traits: {
        armorProf: { value: ["light", "medium", "shield"] },
        weaponProf: { value: ["simple", "martial"] },
      },
      advancement: [
        { title: "Fighting Style", level: 1 },
        { title: "Second Wind", level: 1 },
        { title: "Skill Proficiencies", level: 1 },
        { title: "Weapon Mastery", level: 1 },
        { title: "Action Surge", level: 2 },
      ],
    },
  });
  beginCardSelectionUpdateMock.mockReturnValue("request-1");
  isCurrentCardSelectionUpdateMock.mockReturnValue(true);
  patchCardDetailFromTemplateMock.mockResolvedValue(true);
});

describe("step class", () => {
  it("filters enabled classes and hydrates the selected description", async () => {
    const { createClassStep } = await import("./step-class");
    const step = createClassStep();

    const viewModel = await step.buildViewModel(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.class.fighter"]),
      },
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
      },
    }));

    expect(loadPacksMock).toHaveBeenCalled();
    expect((viewModel.entries as Array<{ name: string }>).map((entry) => entry.name)).toEqual(["Wizard"]);
    expect(viewModel).toMatchObject({
      stepLabel: "Choose Your Class",
      entries: [
        expect.objectContaining({
          name: "Wizard",
          hitDie: "d10",
          primaryAbilityText: "Intelligence",
          primaryAbilityBadgeText: "INT",
          savingThrowText: "Strength / Constitution",
          savingThrowBadgeText: "STR / CON",
        }),
      ],
      selectedEntry: expect.objectContaining({
        uuid: "Compendium.class.wizard",
        description: "<p>Class details</p>",
        heroImg: "systems/dnd5e/ui/official/classes/wizard.webp",
        subtitle: "Scholars of war who stand as living bulwarks.",
        primaryAbilityHint: "Intelligence recommended, with Constitution helping concentration.",
      }),
      hasEntries: true,
      emptyMessage: "No classes available. Check your GM configuration.",
    });
    expect((viewModel.entries as Array<Record<string, string>>)[0]?.primaryAbilityText).toBe("Intelligence");
  });

  it("exposes enabled classes through the internal helper", async () => {
    const { __classStepInternals } = await import("./step-class");
    const entries = __classStepInternals.getAvailableClasses(makeState({
      config: {
        ...makeState().config,
        disabledUUIDs: new Set(["Compendium.class.wizard"]),
      },
    }));

    expect(entries).toEqual([
      expect.objectContaining({ uuid: "Compendium.class.fighter" }),
    ]);
  });

  it("stores advancement-derived class data and falls back gracefully on parse errors", async () => {
    const { createClassStep } = await import("./step-class");
    const step = createClassStep();
    const setDataSilent = vi.fn();
    const card = new FakeElement();
    card.dataset.cardUuid = "Compendium.class.wizard";
    const root = new FakeElement();
    root.setQuerySelectorAll("[data-card-uuid]", [card]);

    fetchDocumentMock.mockResolvedValue({
      system: {
        hitDice: "d6",
        saves: ["int", "wis"],
        traits: {
          armorProf: { value: [] },
          weaponProf: { value: ["dagger", "quarterstaff"] },
        },
        advancement: [
          { title: "Spellcasting", level: 1 },
          { title: "Arcane Recovery", level: 1 },
        ],
      },
    });

    step.onActivate?.(makeState(), root as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent,
      rerender: vi.fn(),
    });

    await card.trigger("click");

    expect(fetchDocumentMock).toHaveBeenCalledWith("Compendium.class.wizard");
    expect(parseClassSkillAdvancementMock).toHaveBeenCalled();
    expect(parseClassSpellcastingMock).toHaveBeenCalled();
    expect(beginCardSelectionUpdateMock).toHaveBeenCalledWith(
      root,
      "Compendium.class.wizard",
      expect.objectContaining({ name: "Wizard" }),
    );
    expect(patchCardDetailFromTemplateMock).toHaveBeenCalledWith(
      root,
      expect.objectContaining({
        requestId: "request-1",
        templatePath: "modules/foundry-tabletop-helpers/templates/character-creator/cc-step-class-detail.hbs",
      }),
    );
    expect(setDataSilent).toHaveBeenCalledWith(expect.objectContaining({
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      identifier: "wizard",
      skillPool: ["arc", "his"],
      skillCount: 2,
      isSpellcaster: true,
      spellcastingAbility: "int",
      spellcastingProgression: "full",
      primaryAbilities: ["int"],
      primaryAbilityHint: "Intelligence recommended, with Constitution helping concentration.",
      hitDie: "d6",
      savingThrowProficiencies: ["int", "wis"],
      armorProficiencies: [],
      weaponProficiencies: ["Dagger", "Quarterstaff"],
      hasWeaponMastery: false,
      weaponMasteryCount: 2,
      weaponMasteryPool: ["weapon:sim:*", "weapon:mar:*"],
    }));

    vi.clearAllMocks();
    fetchDocumentMock.mockRejectedValue(new Error("boom"));
    beginCardSelectionUpdateMock.mockReturnValue("request-2");
    isCurrentCardSelectionUpdateMock.mockReturnValue(true);
    patchCardDetailFromTemplateMock.mockResolvedValue(true);
    const setDataSilentFallback = vi.fn();
    const fallbackCard = new FakeElement();
    fallbackCard.dataset.cardUuid = "Compendium.class.fighter";
    const fallbackRoot = new FakeElement();
    fallbackRoot.setQuerySelectorAll("[data-card-uuid]", [fallbackCard]);

    step.onActivate?.(makeState(), fallbackRoot as unknown as HTMLElement, {
      setData: vi.fn(),
      setDataSilent: setDataSilentFallback,
      rerender: vi.fn(),
    });

    await fallbackCard.trigger("click");

    expect(logWarnMock).toHaveBeenCalledWith("Failed to parse class advancement data", expect.any(Error));
    expect(setDataSilentFallback).toHaveBeenCalledWith({
      uuid: "Compendium.class.fighter",
      name: "Fighter",
      img: "fighter.png",
      identifier: "fighter",
      skillPool: [],
      skillCount: 2,
      isSpellcaster: false,
      spellcastingAbility: "",
      spellcastingProgression: "",
      primaryAbilities: ["str", "dex"],
      primaryAbilityHint: "Strength or Dexterity recommended.",
      hasWeaponMastery: true,
    });
  });

  it("exposes parsing helpers for recommendations, trait summaries, and feature filtering", async () => {
    const { __classStepInternals } = await import("./step-class");

    expect(__classStepInternals.getClassRecommendation("fighter")).toMatchObject({
      primaryAbilities: ["str", "dex"],
      hasWeaponMastery: true,
    });
    expect(__classStepInternals.getHitDie({
      system: {
        hd: { denomination: "d12" },
      },
    })).toBe("d12");
    expect(__classStepInternals.getSavingThrowProficiencies({
      system: {
        saves: { dex: true, wis: true, con: false },
      },
    })).toEqual(["dex", "wis"]);
    expect(__classStepInternals.getSavingThrowProficiencies({
      system: {
        advancement: [
          {
            type: "Trait",
            title: "Saving Throw Proficiencies",
            level: 1,
            configuration: {
              grants: ["saves:str", "saves:con", "weapon:mar"],
            },
          },
          {
            type: "Trait",
            title: "Saving Throws",
            level: 14,
            configuration: {
              grants: ["saves:wis"],
            },
          },
        ],
      },
    })).toEqual(["str", "con"]);
    expect(__classStepInternals.getTraitSummary({
      system: {
        traits: {
          weaponProf: { value: ["martial-weapons"], custom: "Firearms" },
        },
      },
    }, "weaponProf")).toEqual(["Martial Weapons", "Firearms"]);
    expect(__classStepInternals.getLeadingParagraphText("<p>Bound by oath.</p><h2>Features</h2>")).toBe("Bound by oath.");
    expect(__classStepInternals.getSubtitleFromDescription("<p>Bound by oath.</p><h2>Features</h2>")).toBe("Bound by oath.");
    expect(__classStepInternals.getClassSubtitle({
      system: {
        description: {
          value: "<p>Wield ancient magic.</p>",
        },
      },
    }, {
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "wizard",
    })).toBe("Wield ancient magic.");
    expect(__classStepInternals.getClassHeroImage({
      uuid: "Compendium.class.wizard",
      name: "Wizard",
      img: "wizard.png",
      packId: "pack.classes",
      packLabel: "PHB",
      type: "class",
      identifier: "wizard",
    })).toBe("systems/dnd5e/ui/official/classes/wizard.webp");
    expect(__classStepInternals.getFeatureSummary({
      system: {
        advancement: [
          { title: "Skill Proficiencies", level: 1 },
          { title: "Level 1 Class Features", level: 1 },
          { title: "Sneak Attack", level: 1 },
          { title: "Cunning Action", level: 2 },
          { title: "Uncanny Dodge", level: 5 },
        ],
      },
    }, 2)).toEqual([
      { title: "Sneak Attack", level: 1 },
      { title: "Cunning Action", level: 2 },
    ]);
    expect(__classStepInternals.getFeatureSummary({
      system: {
        advancement: [
          {
            type: "ItemChoice",
            title: "Fighting Style",
            configuration: {
              choices: {
                2: { count: 1 },
              },
            },
          },
          { title: "Lay on Hands", level: 1 },
        ],
      },
    }, 1)).toEqual([
      { title: "Lay on Hands", level: 1 },
    ]);
    expect(__classStepInternals.getFeatureSummary({
      system: {
        advancement: [
          {
            type: "ItemChoice",
            title: "Fighting Style",
            configuration: {
              choices: {
                1: { count: 1 },
              },
            },
          },
          { title: "Second Wind", level: 1 },
        ],
      },
    }, 1)).toEqual([
      { title: "Fighting Style", level: 1 },
      { title: "Second Wind", level: 1 },
    ]);
    expect(__classStepInternals.getHitPointFeatureLabel("d10", 1)).toBe("Hitpoints: 10");
    expect(__classStepInternals.getHitPointFeatureLabel("d10", 2)).toBe("Hitpoints: +10");
    expect(__classStepInternals.normalizeDescriptionText(
      "@UUID[Compendium.dnd-players-handbook.equipment.Item.phbarmChainMail0]{Chain Mail} and [[/award 11GP]] and Short\u00adsword",
    )).toBe("Chain Mail and 11 GP and Shortsword");
    expect(__classStepInternals.formatEquipmentChoicesInHtml(
      "<p>Choose A, B, or C: (A) Chain Mail; (B) Studded Leather; or (C) 155 GP</p>",
    )).toContain("<strong class=\"cc-card-detail__choice-marker\">(A)</strong>");
    expect(__classStepInternals.postprocessDescriptionHtml(
      "<p>Choose A, B, or C: (A) Chain Mail; (B) Studded Leather; or (C) 155 GP</p>",
    )).toContain("cc-card-detail__choice-heading");
  });
});
