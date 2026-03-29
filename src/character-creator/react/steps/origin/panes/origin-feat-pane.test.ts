import { createElement, isValidElement } from "react";
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

type TestElement = React.ReactElement<Record<string, unknown>>;

function flattenElements(node: unknown): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) return node.flatMap((child) => flattenElements(child));
  if (!isValidElement(node)) return [];
  const element = node as TestElement;
  return [element, ...flattenElements(element.props.children)];
}

function flattenText(node: unknown): string {
  if (Array.isArray(node)) return node.map((child) => flattenText(child)).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  return flattenText((node as TestElement).props.children);
}

describe("OriginFeatPane", () => {
  it("renders a simplified feat list, current selection summary, and the revert action", () => {
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

    expect(markup).not.toContain("Origin Feat");
    expect(markup).not.toContain("Default Recommendation");
    expect(markup).not.toContain("Selection Mode");
    expect(markup).not.toContain("Default: Magic Initiate (Cleric)");
    expect(markup).not.toContain("Custom feat active");
    expect(markup).not.toContain("Using background default");
    expect(markup).toContain("Background default");
    expect(markup).toContain("Current Selection");
    expect(markup).toContain("Revert To Background Default");
    expect(markup).toContain("data-origin-feat-list=\"true\"");
    expect(markup).toContain("data-origin-feat-option=\"true\"");
    expect(markup).toContain("data-origin-feat-state-row=\"true\"");
    expect(markup).toContain("Selected");
    expect(markup).toContain("Lucky");
  });

  it("omits the empty-description filler in the detail card", () => {
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

    expect(markup).not.toContain("No description is available in the current compendium data.");
  });

  it("supports choosing an alternate feat and reverting to the background default", () => {
    const refresh = vi.fn();
    const state = {
      selections: {
        background: {
          grants: {
            originFeatUuid: "feat-default",
            originFeatName: "Magic Initiate (Cleric)",
            originFeatImg: "default.webp",
          },
        },
        originFeat: {
          uuid: "feat-default",
          name: "Magic Initiate (Cleric)",
          img: "default.webp",
          isCustom: false,
        },
      },
    };

    const view = OriginFeatPane({
      controller: {
        refresh,
      },
      prefersReducedMotion: true,
      shellContext: {
        stepViewModel: {
          backgroundName: "Acolyte",
          className: "Fighter",
          allowOriginFeatSwap: true,
          defaultOriginFeatName: "Magic Initiate (Cleric)",
          originFeatName: "Magic Initiate (Cleric)",
          originFeatImg: "default.webp",
          isCustomOriginFeat: false,
          selectedOriginFeat: {
            uuid: "feat-default",
            name: "Magic Initiate (Cleric)",
            img: "default.webp",
          },
          availableOriginFeats: [
            { uuid: "feat-default", name: "Magic Initiate (Cleric)", img: "default.webp" },
            { uuid: "feat-custom", name: "Lucky", img: "lucky.webp" },
          ],
          hasOriginFeats: true,
          originFeatEmptyMessage: "",
        },
      },
      state,
    } as never);

    const elements = flattenElements(view);
    const featButtons = elements.filter((element) => element.props["data-origin-feat-option"] === "true");
    const luckyButton = featButtons.find((element) => element.key === "feat-custom");

    expect(luckyButton?.props.onClick).toBeTypeOf("function");
    (luckyButton?.props.onClick as (() => void) | undefined)?.();

    expect(state.selections.originFeat).toEqual({
      uuid: "feat-custom",
      name: "Lucky",
      img: "lucky.webp",
      isCustom: true,
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    const rerenderedView = OriginFeatPane({
      controller: {
        refresh,
      },
      prefersReducedMotion: true,
      shellContext: {
        stepViewModel: {
          backgroundName: "Acolyte",
          className: "Fighter",
          allowOriginFeatSwap: true,
          defaultOriginFeatName: "Magic Initiate (Cleric)",
          originFeatName: "Lucky",
          originFeatImg: "lucky.webp",
          isCustomOriginFeat: true,
          selectedOriginFeat: {
            uuid: "feat-custom",
            name: "Lucky",
            img: "lucky.webp",
          },
          availableOriginFeats: [
            { uuid: "feat-default", name: "Magic Initiate (Cleric)", img: "default.webp" },
            { uuid: "feat-custom", name: "Lucky", img: "lucky.webp" },
          ],
          hasOriginFeats: true,
          originFeatEmptyMessage: "",
        },
      },
      state,
    } as never);

    const rerenderedElements = flattenElements(rerenderedView);
    const revertButton = rerenderedElements.find((element) =>
      typeof element.props.onClick === "function"
      && flattenText(element.props.children).includes("Revert To Background Default"));

    expect(revertButton?.props.onClick).toBeTypeOf("function");
    (revertButton?.props.onClick as (() => void) | undefined)?.();

    expect(state.selections.originFeat).toEqual({
      uuid: "feat-default",
      name: "Magic Initiate (Cleric)",
      img: "default.webp",
      isCustom: false,
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
