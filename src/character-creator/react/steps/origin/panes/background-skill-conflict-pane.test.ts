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

import { BackgroundSkillConflictPane } from "./background-skill-conflict-pane";

describe("BackgroundSkillConflictPane", () => {
  it("renders a grouped decision surface with replacement counts and summaries", () => {
    const controller = {
      refresh: vi.fn(),
    };

    const markup = renderToStaticMarkup(createElement(BackgroundSkillConflictPane, {
      controller,
      shellContext: {
        stepViewModel: {
          backgroundName: "Sage",
          className: "Rogue",
          fixedBackgroundSkills: ["Arcana", "History"],
          conflictingSkills: ["Arcana"],
          retainedSkills: ["Stealth"],
          selectedReplacementSkills: ["Insight"],
          replacementCount: 1,
          requiredClassSkillCount: 2,
          replacementOptions: [
            { id: "acr", label: "Acrobatics", abilityAbbrev: "DEX" },
            { id: "ins", label: "Insight", abilityAbbrev: "WIS" },
          ],
        },
      },
      state: {
        selections: {
          skills: {
            chosen: ["ste", "ins"],
          },
          backgroundSkillConflicts: ["ins"],
          background: {
            name: "Sage",
            grants: {
              skillProficiencies: ["arc", "his"],
            },
          },
          class: {
            name: "Rogue",
            skillCount: 2,
            skillPool: ["acr", "ath", "ins", "ste"],
          },
        },
      },
    } as never));

    expect(markup).toContain("Resolve Skill Overlap");
    expect(markup).toContain("Replacements remaining");
    expect(markup).toContain("Chosen replacements");
    expect(markup).toContain("Decision Surface");
    expect(markup).toContain("cc-theme-panel--soft");
    expect(markup).toContain("cc-theme-card--selected");
    expect(markup).toContain("Fixed Background Skills (2)");
    expect(markup).toContain("Retained Class Skills (1)");
    expect(markup).toContain("Overlapping Skills (1)");
    expect(markup).toContain("Chosen Replacements (1 / 1)");
    expect(markup).toContain("Selected replacement");
    expect(markup).toContain("Available replacement");
    expect(markup.indexOf("Decision Surface")).toBeLessThan(markup.indexOf("Fixed Background Skills (2)"));
    expect(controller.refresh).not.toHaveBeenCalled();
  });
});
