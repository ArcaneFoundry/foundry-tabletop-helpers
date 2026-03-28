import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, {
      get: (_target, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => {
        const {
          animate: _animate,
          initial: _initial,
          transition: _transition,
          variants: _variants,
          whileHover: _whileHover,
          whileTap: _whileTap,
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
    useReducedMotion: () => true,
  };
});

import type { WizardState } from "../../../character-creator-types";
import { ClassFlowRouteHost } from "./class-flow-route-host";

function createState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "classExpertise", "classLanguages", "classTools", "weaponMasteries", "classSummary"],
    selections: {
      class: {
        uuid: "Compendium.test.classes.Item.fighter",
        name: "Fighter",
        img: "fighter.webp",
        identifier: "fighter",
        skillPool: ["ath", "his", "int", "per"],
        skillCount: 2,
        isSpellcaster: false,
        spellcastingAbility: "",
        spellcastingProgression: "",
        hasWeaponMastery: false,
        weaponMasteryCount: 0,
        weaponMasteryPool: [],
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
      disabledUUIDs: new Set(),
      allowedAbilityMethods: ["standardArray"],
      maxRerolls: 0,
      startingLevel: 1,
      allowMulticlass: false,
      equipmentMethod: "equipment",
      level1HpMethod: "max",
      allowCustomBackgrounds: false,
    },
  } as WizardState;
}

function createSteps() {
  return [
    { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", status: "complete" as const, active: false },
    { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: true },
    { id: "classExpertise", label: "Expertise", icon: "fa-solid fa-bullseye", status: "pending" as const, active: false },
    { id: "classLanguages", label: "Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "classTools", label: "Tools", icon: "fa-solid fa-screwdriver-wrench", status: "pending" as const, active: false },
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Summary", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
  ];
}

function createAdvancementViewModel(type: "expertise" | "languages" | "tools") {
  const configurations = {
    expertise: {
      title: "Choose Your Expertise",
      description: "Refine the skills your class has already trained.",
      statusLabel: "Choose Expert Skills",
      summaryLabel: "Expertise Picks",
      selectedTitle: "Chosen Expertise",
      emptyMessage: "No expertise choices selected yet.",
      guidance: "Choose the expertise upgrades that define the class's strongest edge.",
      options: [
        { id: "acrobatics", label: "Acrobatics", description: "Already sharp.", iconClass: "fa-solid fa-person-running" },
        { id: "athletics", label: "Athletics", description: "Build this edge.", iconClass: "fa-solid fa-dumbbell" },
      ],
    },
    languages: {
      title: "Choose Your Languages",
      description: "Add the tongues this class can communicate in.",
      statusLabel: "Choose Languages",
      summaryLabel: "Languages Chosen",
      selectedTitle: "Chosen Languages",
      emptyMessage: "No class languages selected yet.",
      guidance: "Choose the languages your class features grant and keep the count readable.",
      options: [
        { id: "elvish", label: "Elvish", description: "Literate and fluent.", iconClass: "fa-solid fa-language" },
        { id: "dwarvish", label: "Dwarvish", description: "A useful second tongue.", iconClass: "fa-solid fa-language" },
      ],
    },
    tools: {
      title: "Choose Your Tools",
      description: "Select the tools this class teaches you to use.",
      statusLabel: "Choose Tool Proficiencies",
      summaryLabel: "Tool Picks",
      selectedTitle: "Chosen Tools",
      emptyMessage: "No class tools selected yet.",
      guidance: "Choose the tool proficiencies your class trains into your kit.",
      options: [
        { id: "smith", label: "Smith's Tools", description: "An earned trade.", iconClass: "fa-solid fa-screwdriver-wrench" },
        { id: "thieves", label: "Thieves' Tools", description: "A quieter option.", iconClass: "fa-solid fa-toolbox" },
      ],
    },
  }[type];

  return {
    classIdentifier: "fighter",
    className: "Fighter",
    type,
    title: configurations.title,
    description: configurations.description,
    selectedCount: 1,
    requiredCount: 2,
    selectedEntries: [{
      id: configurations.options[0].id,
      label: configurations.options[0].label,
      description: configurations.options[0].description,
      iconClass: configurations.options[0].iconClass,
    }],
    options: configurations.options.map((option, index) => ({
      id: option.id,
      key: option.id,
      label: option.label,
      abilityAbbrev: type === "expertise" ? "STR" : type === "languages" ? "INT" : "DEX",
      checked: index === 0,
      disabled: false,
      iconClass: option.iconClass,
      description: option.description,
      tooltip: `${option.label} tooltip`,
    })),
  } as never;
}

describe("ClassFlowRouteHost", () => {
  it("renders class skill groups in canonical order with nested row indentation", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassFlowRouteHost, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "classChoices",
          steps: createSteps(),
          stepViewModel: {
            classIdentifier: "fighter",
            primaryAbilityHint: "Strength first.",
            savingThrows: ["STR", "CON"],
            skillSection: {
              hasChoices: true,
              chosenCount: 0,
              maxCount: 2,
              selectedEntries: [],
              options: [
                { key: "con-1", label: "Resilience", abilityAbbrev: "CON", checked: false, disabled: false, iconClass: "fa-solid fa-heart", tooltip: "" },
                { key: "wis-1", label: "Insight", abilityAbbrev: "WIS", checked: false, disabled: false, iconClass: "fa-solid fa-eye", tooltip: "" },
                { key: "dex-1", label: "Acrobatics", abilityAbbrev: "DEX", checked: false, disabled: false, iconClass: "fa-solid fa-person-running", tooltip: "" },
                { key: "str-1", label: "Athletics", abilityAbbrev: "STR", checked: false, disabled: false, iconClass: "fa-solid fa-dumbbell", tooltip: "" },
                { key: "int-1", label: "History", abilityAbbrev: "INT", checked: false, disabled: false, iconClass: "fa-solid fa-landmark", tooltip: "" },
                { key: "cha-1", label: "Persuasion", abilityAbbrev: "CHA", checked: false, disabled: false, iconClass: "fa-solid fa-comments", tooltip: "" },
              ],
              emptyMessage: "No skills available.",
            },
          },
        },
        state: createState(),
        step: {} as never,
      } as never),
    );

    const groupOrder = [
      markup.indexOf('data-class-skill-group="STR"'),
      markup.indexOf('data-class-skill-group="DEX"'),
      markup.indexOf('data-class-skill-group="CON"'),
      markup.indexOf('data-class-skill-group="WIS"'),
      markup.indexOf('data-class-skill-group="INT"'),
      markup.indexOf('data-class-skill-group="CHA"'),
    ];

    expect(markup).toContain("cc-class-choice-layout");
    expect(groupOrder.every((value) => value >= 0)).toBe(true);
    expect(groupOrder).toEqual([...groupOrder].sort((left, right) => left - right));
    expect(markup).toContain('data-class-skill-row="true"');
    expect(markup).toContain("pl-5");
    expect(markup).toContain("md:pl-6");
  });

  it("renders the mounted class summary with explicit feature-row padding", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassFlowRouteHost, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "classSummary",
          steps: createSteps(),
          stepViewModel: {
            className: "Paladin",
            classImage: "",
            classIdentifier: "paladin",
            overview: "",
            primaryAbilitySummary: "STR / CHA",
            startingLevel: 1,
            hitDie: "d10",
            featureCount: 1,
            chosenSkills: ["Athletics"],
            chosenWeaponMasteries: ["Battleaxe (Topple)"],
            savingThrows: ["WIS", "CHA"],
            armorProficiencies: [],
            weaponProficiencies: [],
            toolProficiencies: [],
            selectedGrantGroups: [],
            features: [{ title: "Divine Sense", description: "<p>Sense celestial influence.</p>" }],
            hasChosenSkills: true,
            hasChosenWeaponMasteries: true,
            hasSavingThrows: true,
            hasArmorProficiencies: false,
            hasWeaponProficiencies: false,
            hasToolProficiencies: false,
            hasFeatures: true,
          },
        },
        state: createState(),
        step: {} as never,
      } as never),
    );

    expect(markup).toContain("Current-Level Features");
    expect(markup).toContain("cc-class-summary__feature-list");
    expect(markup).toContain('style="padding-block:1rem;padding-inline:1.25rem"');
    expect(markup).toContain("Hit Die");
  });

  it("renders the mounted weapon masteries pane with ordered groups and readable rails", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassFlowRouteHost, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "weaponMasteries",
          steps: createSteps(),
          stepViewModel: {
            classIdentifier: "fighter",
            className: "Fighter",
            weaponMasterySection: {
              hasChoices: true,
              chosenCount: 1,
              maxCount: 2,
              selectedEntries: [
                { id: "club", label: "Club", img: "club.webp", mastery: "Push", tooltip: "A simple bludgeon." },
              ],
              options: [
                {
                  id: "halberd",
                  uuid: "Compendium.test.items.Item.halberd",
                  identifier: "halberd",
                  name: "Halberd",
                  img: "halberd.webp",
                  weaponType: "Martial Melee",
                  mastery: "Topple",
                  masteryDescription: "Large sweeping strikes.",
                  weaponDescription: "A polearm for heavy blows.",
                  tooltip: "A martial polearm.",
                  checked: false,
                  disabled: false,
                },
                {
                  id: "club",
                  uuid: "Compendium.test.items.Item.club",
                  identifier: "club",
                  name: "Club",
                  img: "club.webp",
                  weaponType: "Simple Melee",
                  mastery: "Push",
                  masteryDescription: "Drive foes back.",
                  weaponDescription: "A basic club.",
                  tooltip: "A simple bludgeon.",
                  checked: true,
                  disabled: false,
                },
                {
                  id: "longsword",
                  uuid: "Compendium.test.items.Item.longsword",
                  identifier: "longsword",
                  name: "Longsword",
                  img: "longsword.webp",
                  weaponType: "Martial Melee",
                  mastery: "Vex",
                  masteryDescription: "Turn momentum into advantage.",
                  weaponDescription: "A knightly blade.",
                  tooltip: "A martial sword.",
                  checked: false,
                  disabled: false,
                },
              ],
              emptyMessage: "No weapon masteries available.",
            },
          },
        },
        state: createState(),
        step: {} as never,
      } as never),
    );

    const simpleIndex = markup.indexOf('data-weapon-mastery-group="Simple Weapons"');
    const martialIndex = markup.indexOf('data-weapon-mastery-group="Martial Weapons"');

    expect(markup).toContain("Weapon Masteries");
    expect(markup).toContain("Simple first, Martial second");
    expect(markup).toContain('data-weapon-mastery-row="true"');
    expect(markup).toContain("Chosen Weapons");
    expect(markup).toContain("Mastery Techniques");
    expect(simpleIndex).toBeGreaterThanOrEqual(0);
    expect(martialIndex).toBeGreaterThanOrEqual(0);
    expect(simpleIndex).toBeLessThan(martialIndex);
    expect(markup).toContain("md:px-4");
  });

  it.each([
    ["expertise", "Choose Expert Skills", "Expertise Picks", "Chosen Expertise"],
    ["languages", "Choose Languages", "Languages Chosen", "Chosen Languages"],
    ["tools", "Choose Tool Proficiencies", "Tool Picks", "Chosen Tools"],
  ] as const)("renders distinct advancement chrome for %s", (type, statusLabel, summaryLabel, selectedTitle) => {
    const markup = renderToStaticMarkup(
      createElement(ClassFlowRouteHost, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: type === "expertise" ? "classExpertise" : type === "languages" ? "classLanguages" : "classTools",
          steps: createSteps(),
          stepViewModel: createAdvancementViewModel(type),
        },
        state: createState(),
        step: {} as never,
      } as never),
    );

    expect(markup).toContain(statusLabel);
    expect(markup).toContain(summaryLabel);
    expect(markup).toContain(selectedTitle);
  });
});
