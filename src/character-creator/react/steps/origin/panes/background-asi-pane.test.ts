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

import { BackgroundAsiPane, __backgroundAsiPaneInternals } from "./background-asi-pane";

describe("BackgroundAsiPane", () => {
  it("renders the simplified allocator with budget-aware option copy", () => {
    const currentAssignments = {
      int: 1,
      wis: 1,
      cha: 1,
    };
    const rewrittenAssignments = __backgroundAsiPaneInternals.buildBackgroundAsiQuickPickAssignments(
      [
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
            { value: 1, label: "+1", selected: true },
            { value: 2, label: "+2", selected: false },
          ],
        },
        {
          key: "cha",
          label: "Charisma",
          backgroundSuggested: false,
          classRecommended: true,
          emphasized: true,
          options: [
            { value: 0, label: "Reset", selected: false },
            { value: 1, label: "+1", selected: true },
            { value: 2, label: "+2", selected: false },
          ],
        },
      ],
      3,
      "class",
    );

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
          hasClassRecommendations: true,
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
              assignments: currentAssignments,
            },
            grants: {
              asiPoints: 3,
            },
          },
        },
      },
    } as never));

    expect(markup).toContain("Background Ability Scores");
    expect(markup).toContain("3/3 spent");
    expect(markup).toContain("Fully assigned");
    expect(markup).toContain("Current value");
    expect(markup).toContain("Background-aligned");
    expect(markup).toContain("Class synergy");
    expect(markup).toContain("Pick");
    expect(markup).toContain("Apply Background Suggestions");
    expect(markup).toContain("Apply Class Synergy");
    expect(markup).toContain("<button class=");
    expect(markup.match(/Apply Background Suggestions<\/button>/)?.[0]).not.toContain("disabled");
    expect(markup.match(/Apply Class Synergy<\/button>/)?.[0]).not.toContain("disabled");
    expect(markup).toContain("min-[420px]:grid-cols-3");
    expect(markup).toContain("xl:grid-cols-3");
    expect(markup).not.toContain("Current Spread");
    expect(markup).not.toContain("Points Spent");
    expect(markup).not.toContain("Points Remaining");
    expect(markup).toContain("Not enough points left");
    expect(Object.values(currentAssignments).reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(rewrittenAssignments).toMatchObject({
      int: 1,
      wis: 1,
      cha: 1,
    });
    expect(rewrittenAssignments).not.toBe(currentAssignments);
  });

  it("renders the aptitude content without a dedicated pane scroll owner", () => {
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
          asiPointsUsed: 1,
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
              },
            },
            grants: {
              asiPoints: 3,
            },
          },
        },
      },
    } as never));

    expect(markup).toContain("relative isolate rounded-[1.45rem]");
    expect(markup).toContain("relative z-10 p-3");
    expect(markup).not.toContain("data-origins-background-asi-scroll");
    expect(markup).not.toContain("overflow-y-auto");
  });

  it("builds a legal quick-pick spread that prefers the requested priority mode", () => {
    const assignments = __backgroundAsiPaneInternals.buildBackgroundAsiQuickPickAssignments(
      [
        {
          key: "int",
          label: "Intelligence",
          backgroundSuggested: true,
          classRecommended: true,
          emphasized: true,
          options: [
            { value: 0, label: "+0", selected: false },
            { value: 1, label: "+1", selected: false },
            { value: 2, label: "+2", selected: false },
          ],
        },
        {
          key: "wis",
          label: "Wisdom",
          backgroundSuggested: true,
          classRecommended: false,
          emphasized: true,
          options: [
            { value: 0, label: "+0", selected: false },
            { value: 1, label: "+1", selected: false },
            { value: 2, label: "+2", selected: false },
          ],
        },
        {
          key: "cha",
          label: "Charisma",
          backgroundSuggested: false,
          classRecommended: true,
          emphasized: true,
          options: [
            { value: 0, label: "+0", selected: false },
            { value: 1, label: "+1", selected: false },
            { value: 2, label: "+2", selected: false },
          ],
        },
      ],
      3,
      "background",
    );

    expect(Object.values(assignments).reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(assignments).toMatchObject({
      int: 1,
      wis: 1,
      cha: 1,
    });
  });
});
