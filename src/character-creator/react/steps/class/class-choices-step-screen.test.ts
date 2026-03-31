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

import { ClassChoicesStepScreen, groupSkillChoicesByAbility } from "./class-choices-step-screen";

describe("groupSkillChoicesByAbility", () => {
  it("returns only populated groups in canonical D&D ability order", () => {
    const grouped = groupSkillChoicesByAbility([
      { key: "wis-1", label: "Insight", abilityAbbrev: "WIS", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "dex-1", label: "Acrobatics", abilityAbbrev: "DEX", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "str-1", label: "Athletics", abilityAbbrev: "STR", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "int-1", label: "History", abilityAbbrev: "INT", checked: false, disabled: false, iconClass: "", tooltip: "" },
      { key: "cha-1", label: "Persuasion", abilityAbbrev: "CHA", checked: false, disabled: false, iconClass: "", tooltip: "" },
    ]);

    expect(grouped.map((group) => group.abilityAbbrev)).toEqual(["STR", "DEX", "WIS", "INT", "CHA"]);
    expect(grouped.some((group) => group.abilityAbbrev === "CON")).toBe(false);
    expect(grouped.find((group) => group.abilityAbbrev === "STR")?.entries.map((entry) => entry.label)).toEqual(["Athletics"]);
  });
});

describe("ClassChoicesStepScreen", () => {
  it("renders the skills step as a single-column layout with inline summary chips", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassChoicesStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "classChoices",
          steps: [],
          stepViewModel: {
            className: "Fighter",
            classIdentifier: "fighter",
            primaryAbilityHint: "Strength first, then Dexterity.",
            savingThrows: ["STR", "CON"],
            armorProficiencies: [],
            weaponProficiencies: [],
            skillSection: {
              hasChoices: true,
              chosenCount: 2,
              maxCount: 2,
              selectedEntries: [
                { label: "Athletics", tooltip: "Athletics" },
                { label: "Perception", tooltip: "Perception" },
              ],
              options: [
                { key: "athletics", label: "Athletics", abilityAbbrev: "STR", checked: true, disabled: false, iconClass: "fa-solid fa-dumbbell", tooltip: "Athletics" },
                { key: "perception", label: "Perception", abilityAbbrev: "WIS", checked: true, disabled: false, iconClass: "fa-solid fa-eye", tooltip: "Perception" },
                { key: "acrobatics", label: "Acrobatics", abilityAbbrev: "DEX", checked: false, disabled: false, iconClass: "fa-solid fa-person-running", tooltip: "Acrobatics" },
              ],
              emptyMessage: "No skills available.",
            },
            hideStepIndicator: true,
            hideShellHeader: true,
            shellContentClass: "cc-class-choice-layout",
            stepId: "classChoices",
            stepTitle: "Character Creation",
            stepLabel: "Skills",
            stepIcon: "fa-solid fa-hand-sparkles",
            stepDescription: "Choose your class skills.",
          },
        },
        state: {
          currentStep: 1,
          applicableSteps: ["class", "classChoices", "classSummary"],
          selections: {
            class: {
              uuid: "class-fighter",
              name: "Fighter",
              img: "fighter.webp",
              identifier: "fighter",
              skillPool: ["athletics", "perception", "acrobatics"],
              skillCount: 2,
              isSpellcaster: false,
              spellcastingAbility: "",
              spellcastingProgression: "",
            },
            skills: {
              chosen: ["athletics", "perception"],
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
        } as never,
        step: {} as never,
      } as never),
    );

    expect(markup).not.toContain("Selection Summary");
    expect(markup).toContain('data-class-hero-banner="true"');
    expect(markup).toContain("Character Creation");
    expect(markup).toContain("Choose Your Skills");
    expect(markup).toContain("Class Flow");
    expect(markup).toContain("Choose your skills");
    expect(markup).toContain("2/2");
    expect(markup).toContain("Prime Attribute Guidance");
    expect(markup).toContain("Saving Throws");
    expect(markup).toContain("STR");
    expect(markup).toContain("CON");
    expect(markup).toContain("Chosen Skills");
    expect(markup).toContain("Athletics");
    expect(markup).toContain("Perception");
    expect(markup).toContain("Strength first, then Dexterity.");
    expect(markup).not.toContain("md:grid-cols-[minmax(0,1.35fr)_minmax(15.5rem,0.72fr)]");
    expect(markup).not.toContain("<aside");
  });
});
