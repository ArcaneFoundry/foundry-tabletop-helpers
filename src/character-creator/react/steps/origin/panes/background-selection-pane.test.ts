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

import { BackgroundSelectionPane, getBackgroundArtTreatment } from "./background-selection-pane";

describe("BackgroundSelectionPane", () => {
  it("defaults PHB background assets to cover unless they are explicitly allowlisted", () => {
    expect(getBackgroundArtTreatment("modules/dnd-players-handbook/assets/icons/backgrounds/scribe.webp")).toBe("cover");
    expect(getBackgroundArtTreatment("modules/dnd-players-handbook/assets/icons/backgrounds/wayfarer.webp")).toBe("cover");
    expect(getBackgroundArtTreatment("modules/dnd-heroes-faerun/assets/journal-art/dead-magic-dweller-background.webp")).toBe("cover");
    expect(getBackgroundArtTreatment("")).toBe("cover");
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
              img: "modules/dnd-players-handbook/assets/icons/backgrounds/acolyte.webp",
              blurb: "Keeper of sacred rites.",
            },
            {
              uuid: "background-2",
              name: "Soldier",
              img: "modules/dnd-heroes-faerun/assets/journal-art/dead-magic-dweller-background.webp",
              blurb: "Veteran of hard campaigns.",
            },
            {
              uuid: "background-3",
              name: "Wayfarer",
              img: "modules/dnd-players-handbook/assets/icons/backgrounds/wayfarer.webp",
              blurb: "A traveler who knows the road.",
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
    expect(markup).not.toContain("cc-origin-selection-pane__gallery-scroll");
    expect(markup).not.toContain("data-origins-selection-scroll");
    expect(markup).toContain("data-selected=\"true\"");
    expect(markup).toContain("Selected Background");
    expect(markup).toContain("Choose Background");
    expect(markup).toContain("flex h-full w-full flex-row");
    expect(markup).not.toContain("flex h-full w-full flex-col");
    expect(markup).toContain("flex h-full min-h-0 flex-1 flex-col");
    expect(markup).toContain("min-h-[20rem] flex-1 overflow-hidden");
    expect(markup.match(/data-background-art-treatment="cover"/g)).toHaveLength(3);
    expect(markup).not.toContain("data-background-art-treatment=\"icon-bleed\"");
    expect(markup).not.toContain("scale-[1.45] object-cover opacity-70 blur-xl");
    expect(markup).not.toContain("scale-[1.14] group-hover:scale-[1.18]");
    expect(markup).not.toContain("cc-origin-selection-pane__intro");
    expect(markup).not.toContain("Select a Background");
  });
});
