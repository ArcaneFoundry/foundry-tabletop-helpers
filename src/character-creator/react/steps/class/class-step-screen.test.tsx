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
import { ClassStepScreen } from "./class-step-screen";

function createState(): WizardState {
  return {
    currentStep: 0,
    applicableSteps: ["class", "classChoices", "classExpertise", "classLanguages", "classTools", "weaponMasteries", "classSummary", "review"],
    selections: {},
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
    { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", status: "pending" as const, active: true },
    { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", status: "pending" as const, active: false },
    { id: "classExpertise", label: "Expertise", icon: "fa-solid fa-bullseye", status: "pending" as const, active: false },
    { id: "classLanguages", label: "Languages", icon: "fa-solid fa-language", status: "pending" as const, active: false },
    { id: "classTools", label: "Tools", icon: "fa-solid fa-screwdriver-wrench", status: "pending" as const, active: false },
    { id: "weaponMasteries", label: "Masteries", icon: "fa-solid fa-swords", status: "pending" as const, active: false },
    { id: "classSummary", label: "Summary", icon: "fa-solid fa-scroll", status: "pending" as const, active: false },
    { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending" as const, active: false },
  ];
}

describe("ClassStepScreen", () => {
  it("renders the token-backed hero banner and fantasy framing on the class step", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassStepScreen, {
        controller: {
          updateCurrentStepData: vi.fn(),
        },
        shellContext: {
          currentStepId: "class",
          steps: createSteps(),
          stepViewModel: {
            entries: [],
            emptyMessage: "No classes available. Check your GM configuration.",
          },
        },
        state: createState(),
        step: {} as never,
      } as never),
    );

    expect(markup).toContain('data-class-hero-banner="true"');
    expect(markup).toContain('data-class-flow-hero="true"');
    expect(markup).toContain('data-class-flow-hero-body="true"');
    expect(markup).toContain('data-class-flow-hero-description="true"');
    expect(markup).toContain('data-class-flow-hero-flourish="true"');
    expect(markup).toContain('data-class-stepper="true"');
    expect(markup).toContain('data-tone="default"');
    expect(markup).toContain("cc-class-flow-hero-banner");
    expect(markup).toContain("Character Creation");
    expect(markup).toContain("Choose Your Class");
    expect(markup).toContain("Class Flow");
    expect(markup).toContain("Choose your class");
    expect(markup).toContain("Choose the class that sets your hero on the first steps of the build.");
    expect(markup).toContain('data-class-flow-hero-description="true"');
    expect(markup).toContain('[@media(max-height:900px)]:hidden');
    expect(markup).toContain("fth-class-stepper--wide");
  });
});
