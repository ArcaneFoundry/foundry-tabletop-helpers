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
  };
});

import { BackgroundAsiPane } from "./background-asi-pane";

describe("BackgroundAsiPane", () => {
  it("renders a clearer allocation surface with spend, guidance, and invalid-state copy", () => {
    const markup = renderToStaticMarkup(createElement(BackgroundAsiPane, {
      controller: {
        refresh: vi.fn(),
      },
      prefersReducedMotion: true,
      shellContext: {
        stepViewModel: {
          backgroundName: "Sage",
          backgroundImg: "sage.webp",
          asiPoints: 3,
          asiPointsUsed: 3,
          asiAbilities: [
            {
              key: "int",
              label: "Intelligence",
              backgroundSuggested: true,
              classRecommended: true,
              emphasized: true,
              options: [
                { value: 0, label: "Reset", selected: false },
                { value: 1, label: "+1", selected: true },
                { value: 2, label: "+2", selected: false },
              ],
            },
            {
              key: "wis",
              label: "Wisdom",
              backgroundSuggested: false,
              classRecommended: false,
              emphasized: false,
              options: [
                { value: 0, label: "Reset", selected: false },
                { value: 1, label: "+1", selected: false },
                { value: 2, label: "+2", selected: false },
              ],
            },
            {
              key: "cha",
              label: "Charisma",
              backgroundSuggested: false,
              classRecommended: false,
              emphasized: false,
              options: [
                { value: 0, label: "Reset", selected: false },
                { value: 1, label: "+1", selected: false },
                { value: 2, label: "+2", selected: false },
              ],
            },
          ],
        },
      },
      state: {
        selections: {
          background: {
            name: "Sage",
            asi: {
              assignments: {
                int: 1,
                wis: 1,
                cha: 1,
              },
            },
            grants: {
              asiPoints: 3,
            },
          },
        },
      },
    } as never));

    expect(markup).toContain("Background Ability Scores");
    expect(markup).toContain("Spend guide");
    expect(markup).toContain("Invalid totals disabled");
    expect(markup).toContain("Background-aligned");
    expect(markup).toContain("Class synergy");
    expect(markup).toContain("Points Spent");
    expect(markup).toContain("Points Remaining");
    expect(markup).toContain("Current Spread");
    expect(markup).toContain("Not enough points left");
  });
});
