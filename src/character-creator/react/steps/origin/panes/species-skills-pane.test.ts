import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
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

import { SpeciesSkillsPane } from "./species-skills-pane";

describe("SpeciesSkillsPane", () => {
  it("renders the extracted species skills decision shell with earlier claim context", () => {
    const markup = renderToStaticMarkup(createElement(SpeciesSkillsPane, {
      controller: {
        refresh: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          title: "Choose Species Skills",
          description: "Choose the skills granted by this species while keeping earlier background and class choices in mind.",
          requiredCount: 2,
          requestedSkillChoiceCount: 2,
          availableSpeciesSkills: [
            {
              key: "prc",
              label: "Perception",
              abilityAbbrev: "WIS",
              checked: true,
              disabled: false,
            },
            {
              key: "ins",
              label: "Insight",
              abilityAbbrev: "WIS",
              checked: false,
              disabled: false,
            },
          ],
        },
      },
      state: {
        selections: {
          background: {
            grants: {
              skillProficiencies: ["arc"],
            },
          },
          species: {
            skillGrants: ["his"],
          },
          speciesChoices: {
            chosenSkills: ["prc"],
            chosenLanguages: [],
            chosenItems: {},
            hasChoices: true,
          },
          skills: {
            chosen: ["sur"],
          },
        },
      },
    } as never));

    expect(markup).toContain("Choose Species Skills");
    expect(markup).toContain("1 / 2 chosen");
    expect(markup).toContain("1 remaining");
    expect(markup).toContain("Select Species Skills");
    expect(markup).toContain("Required Skills");
    expect(markup).toContain("Chosen Skills");
    expect(markup).toContain("Already Claimed");
    expect(markup).toContain("Background: Arcana");
    expect(markup).toContain("Class: Survival");
    expect(markup).toContain("Species: History");
    expect(markup).toContain("Available");
    expect(markup).toContain("data-selected=\"true\"");
    expect(markup).toContain("Background, class, and fixed species skill grants already remove illegal options");
  });
});
