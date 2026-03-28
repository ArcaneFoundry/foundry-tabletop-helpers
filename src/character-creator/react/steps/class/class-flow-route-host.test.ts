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
    applicableSteps: ["class", "classChoices", "classExpertise", "classLanguages", "weaponMasteries", "classSummary"],
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
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Summary", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
  ];
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
});
