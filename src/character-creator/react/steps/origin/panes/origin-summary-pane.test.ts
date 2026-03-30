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

import { OriginSummaryPane } from "./origin-summary-pane";

describe("OriginSummaryPane", () => {
  it("renders the extracted origin recap with hero anchors and grouped grants", () => {
    const markup = renderToStaticMarkup(createElement(OriginSummaryPane, {
      shellContext: {
        stepViewModel: {
          className: "Wizard",
          backgroundName: "Sage",
          backgroundImage: "sage.webp",
          speciesName: "Elf",
          speciesImage: "elf.webp",
          fixedLanguages: ["Common", "Elvish"],
          selectedGrantGroups: [
            {
              id: "background-languages",
              title: "Background Languages",
              iconClass: "fa-solid fa-language",
              entries: ["Draconic"],
              source: "background",
            },
            {
              id: "species-skills",
              title: "Keen Senses",
              iconClass: "fa-solid fa-feather-pointed",
              entries: ["Perception"],
              source: "species",
            },
          ],
          backgroundSkills: ["Arcana", "History"],
          speciesTraits: ["Darkvision", "Fey Ancestry"],
          speciesSkills: ["Perception"],
          speciesItems: ["Light"],
          toolProficiency: "Calligrapher's Supplies",
          originFeatName: "Magic Initiate",
        },
      },
    } as never));

    expect(markup).toContain("Origin Summary");
    expect(markup).toContain("Origins Recap");
    expect(markup).toContain("cc-theme-panel--soft");
    expect(markup).toContain("cc-theme-card--raised");
    expect(markup).toContain("cc-theme-card--soft");
    expect(markup).toContain("Fixed Origin Grants");
    expect(markup).toContain("Chosen Origin Grants");
    expect(markup).toContain("Origin Feat");
    expect(markup).toContain("Background");
    expect(markup).toContain("Species");
    expect(markup).toContain("Sage");
    expect(markup).toContain("Elf");
    expect(markup).toContain("Magic Initiate");
    expect(markup).toContain("Background Languages");
    expect(markup).toContain("Keen Senses");
    expect(markup).toContain("Background choice");
    expect(markup).toContain("Species choice");
  });
});
