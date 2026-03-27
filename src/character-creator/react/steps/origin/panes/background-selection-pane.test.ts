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

import { shouldShowOriginSelectionScrollShadow } from "../components/origin-pane-primitives";
import { BackgroundSelectionPane } from "./background-selection-pane";

describe("BackgroundSelectionPane", () => {
  it("toggles the origin selection scroll shadow from the scroll position helper", () => {
    expect(shouldShowOriginSelectionScrollShadow(0)).toBe(false);
    expect(shouldShowOriginSelectionScrollShadow(4)).toBe(true);
  });

  it("renders the extracted background selection shell with selected-state confidence", () => {
    const markup = renderToStaticMarkup(createElement(BackgroundSelectionPane, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      prefersReducedMotion: true,
      shellContext: {
        stepViewModel: {
          entries: [
            {
              uuid: "background-1",
              name: "Acolyte",
              img: "acolyte.webp",
              blurb: "Keeper of sacred rites.",
            },
            {
              uuid: "background-2",
              name: "Soldier",
              img: "soldier.webp",
              blurb: "Veteran of hard campaigns.",
            },
          ],
        },
      },
      state: {
        selections: {
          background: {
            uuid: "background-2",
          },
        },
      },
    } as never));

    expect(markup).toContain("cc-origin-selection-pane");
    expect(markup).toContain("cc-origin-selection-pane__intro");
    expect(markup).toContain("cc-origin-selection-pane__gallery-scroll");
    expect(markup).toContain("data-origins-selection-scroll=\"true\"");
    expect(markup).toContain("Select a Background");
    expect(markup).toContain("data-selected=\"true\"");
    expect(markup).toContain("Selected Background");
    expect(markup).toContain("Choose Background");
    expect(markup).toContain("flex h-full w-full flex-col");
    expect(markup).toContain("flex h-full min-h-0 flex-1 flex-col");
    expect(markup).toContain("min-h-[20rem] flex-1 overflow-hidden");
    expect(markup.indexOf("cc-origin-selection-pane__intro")).toBeLessThan(markup.indexOf("cc-origin-selection-pane__gallery-scroll"));
  });
});
