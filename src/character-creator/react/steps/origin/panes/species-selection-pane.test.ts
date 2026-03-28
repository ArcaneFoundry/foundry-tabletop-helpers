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

import { SpeciesSelectionPane } from "./species-selection-pane";

describe("SpeciesSelectionPane", () => {
  it("renders the extracted species gallery shell with stronger selected-state confidence", () => {
    const markup = renderToStaticMarkup(createElement(SpeciesSelectionPane, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          entries: [
            {
              uuid: "species-1",
              name: "Elf",
              img: "elf.webp",
              blurb: "A graceful people of ancient memory.",
              traits: ["Keen Senses", "Fey Ancestry"],
            },
            {
              uuid: "species-2",
              name: "Dwarf",
              img: "dwarf.webp",
              blurb: "A resilient folk of stone and craft.",
              traits: ["Darkvision", "Stonecunning"],
            },
          ],
        },
      },
      state: {
        selections: {
          species: {
            uuid: "species-2",
          },
        },
      },
    } as never));

    expect(markup).toContain("cc-origin-selection-pane");
    expect(markup).toContain("cc-origin-selection-pane__intro");
    expect(markup).not.toContain("cc-origin-selection-pane__gallery-scroll");
    expect(markup).toContain("Select a Species");
    expect(markup).toContain("Selected Species");
    expect(markup).toContain("Choose Species");
    expect(markup).toContain("Keen Senses");
    expect(markup).toContain("Stonecunning");
    expect(markup).toContain("Mythic lineage");
    expect(markup).toContain("data-selected=\"true\"");
    expect(markup).toContain("Selected Species");
    expect(markup.indexOf("cc-origin-selection-pane__intro")).toBeLessThan(markup.indexOf("cc-origin-selection-pane__gallery-inner"));
  });
});
