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

import { OriginDetailModal } from "../components/origin-pane-primitives";
import { BackgroundSelectionPane, getBackgroundArtTreatment } from "./background-selection-pane";

describe("BackgroundSelectionPane", () => {
  it("treats PHB icon-style background art differently from scenic or journal art", () => {
    expect(getBackgroundArtTreatment("modules/dnd-players-handbook/assets/icons/backgrounds/scribe.webp")).toBe("icon-bleed");
    expect(getBackgroundArtTreatment("modules/dnd-players-handbook/assets/icons/backgrounds/wayfarer.webp")).toBe("icon-bleed");
    expect(getBackgroundArtTreatment("modules/dnd-heroes-faerun/assets/journal-art/dead-magic-dweller-background.webp")).toBe("cover");
    expect(getBackgroundArtTreatment("")).toBe("cover");
  });

  it("renders the shared background gallery card system with a detail action", () => {
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
              packId: "phb",
              packLabel: "PHB",
              type: "background",
              blurb: "Keeper of sacred rites.",
            },
            {
              uuid: "background-2",
              name: "Soldier",
              img: "modules/dnd-heroes-faerun/assets/journal-art/dead-magic-dweller-background.webp",
              packId: "faerun",
              packLabel: "Heroes of Faerun",
              type: "background",
              blurb: "Veteran of hard campaigns.",
            },
            {
              uuid: "background-3",
              name: "Wayfarer",
              img: "modules/dnd-players-handbook/assets/icons/backgrounds/wayfarer.webp",
              packId: "phb",
              packLabel: "PHB",
              type: "background",
              blurb: "A traveler who knows the road.",
            },
          ],
        },
      },
      state: {
        selections: {
          background: {
            uuid: "background-2",
            grants: {
              asiSuggested: ["str", "con"],
              originFeatName: "Alert",
              skillProficiencies: ["ath", "sur"],
            },
          },
        },
      },
    } as never));

    expect(markup).toContain("cc-origin-selection-pane");
    expect(markup).not.toContain("cc-origin-selection-pane__intro");
    expect(markup).toContain("data-origin-gallery-card=\"true\"");
    expect(markup).toContain("Inspect background details for Acolyte");
    expect(markup).toContain("Inspect background details for Soldier");
    expect(markup).toContain("Inspect background details for Wayfarer");
    expect(markup).toContain("Ability Scores");
    expect(markup).toContain("Alert");
    expect(markup).toContain("Athletics, Survival");
    expect(markup).not.toContain("Choose Background");
    expect(markup).not.toContain("Selected Background");
    expect(markup).not.toContain("Select a Background");
    expect(markup.match(/data-background-art-treatment="icon-bleed"/g)).toHaveLength(2);
    expect(markup.match(/data-background-art-treatment="cover"/g)).toHaveLength(1);
  });

  it("renders the local background detail modal shell", () => {
    const markup = renderToStaticMarkup(createElement(OriginDetailModal, {
      entry: {
        uuid: "background-1",
        name: "Acolyte",
        img: "acolyte.webp",
        packId: "phb",
        packLabel: "PHB",
        type: "background",
        description: "<p>Detailed background text.</p>",
      },
      fallbackIcon: "fa-solid fa-scroll",
      onClose: vi.fn(),
      title: "Acolyte Background",
    }));

    expect(markup).toContain("data-origin-detail-modal=\"true\"");
    expect(markup).toContain("Acolyte Background");
    expect(markup).toContain("Detailed background text.");
    expect(markup).toContain("Close Acolyte Background");
  });
});
