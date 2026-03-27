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

import { OriginFeatPane } from "./origin-feat-pane";

describe("OriginFeatPane", () => {
  it("renders default framing, current selection confidence, and the revert action", () => {
    const markup = renderToStaticMarkup(createElement(OriginFeatPane, {
      controller: {
        refresh: vi.fn(),
      },
      prefersReducedMotion: true,
      shellContext: {
        stepViewModel: {
          backgroundName: "Acolyte",
          className: "Fighter",
          allowOriginFeatSwap: true,
          defaultOriginFeatName: "Magic Initiate (Cleric)",
          originFeatName: "Lucky",
          originFeatImg: "",
          isCustomOriginFeat: true,
          selectedOriginFeat: {
            uuid: "feat-custom",
            name: "Lucky",
            img: "",
          },
          availableOriginFeats: [
            { uuid: "feat-default", name: "Magic Initiate (Cleric)", img: "" },
            { uuid: "feat-custom", name: "Lucky", img: "" },
          ],
          hasOriginFeats: true,
          originFeatEmptyMessage: "",
        },
      },
      state: {
        selections: {
          background: {
            grants: {
              originFeatUuid: "feat-default",
              originFeatName: "Magic Initiate (Cleric)",
              originFeatImg: "",
            },
          },
          originFeat: {
            uuid: "feat-custom",
            name: "Lucky",
            img: "",
            isCustom: true,
          },
        },
      },
    } as never));

    expect(markup).toContain("Origin Feat");
    expect(markup).toContain("Default Recommendation");
    expect(markup).toContain("Background default");
    expect(markup).toContain("Custom feat active");
    expect(markup).toContain("Current Selection");
    expect(markup).toContain("Revert To Background Default");
    expect(markup).toContain("Selected feat");
    expect(markup).toContain("Lucky");
  });
});
