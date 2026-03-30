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
  it("renders species cards with the shared gallery system and no top intro chrome", () => {
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
              packLabel: "PHB",
              blurb: "A graceful people of ancient memory.",
              traits: ["Keen Senses", "Fey Ancestry"],
            },
            {
              uuid: "species-2",
              name: "Dwarf",
              img: "dwarf.webp",
              packLabel: "PHB",
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
    expect(markup).not.toContain("cc-origin-selection-pane__intro");
    expect(markup).toContain("cc-theme-panel--soft");
    expect(markup).toContain("data-origin-gallery-card=\"true\"");
    expect(markup).toContain("PHB");
    expect(markup).toContain("Keen Senses");
    expect(markup).toContain("Fey Ancestry");
    expect(markup).toContain("Stonecunning");
    expect(markup).not.toContain("Select a Species");
    expect(markup).not.toContain("Choose Species");
    expect(markup).toContain("data-selected=\"true\"");
  });

  it("renders a visible duplicate disambiguator for same-name species entries", () => {
    const markup = renderToStaticMarkup(createElement(SpeciesSelectionPane, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          entries: [
            {
              uuid: "species-1",
              name: "Dragonborn",
              img: "dragonborn-1.webp",
              packLabel: "Character Origins",
              blurb: "Ancestry-forward dragonborn entry.",
              traits: ["Draconic Ancestry", "Draconic Flight"],
            },
            {
              uuid: "species-2",
              name: "Dragonborn",
              img: "dragonborn-2.webp",
              packLabel: "Character Origins",
              blurb: "Flight-only dragonborn entry.",
              traits: ["Draconic Flight"],
            },
          ],
        },
      },
      state: {
        selections: {},
      },
    } as never));

    expect(markup).toContain("data-origin-disambiguator=\"true\"");
    expect(markup).toContain("Draconic Ancestry + Draconic Flight");
    expect(markup).toContain("Draconic Flight");
  });
});
