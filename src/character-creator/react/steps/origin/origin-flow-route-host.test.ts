import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, {
      get: (_target, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => {
        const {
          animate: _animate,
          exit: _exit,
          initial: _initial,
          transition: _transition,
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

import { OriginFlowRouteHost, getOriginFlowTransitionKey, isOriginFlowStep } from "./origin-flow-route-host";

describe("OriginFlowRouteHost", () => {
  it("renders the origin shell header with shared theme overlays", () => {
    const markup = renderToStaticMarkup(createElement(OriginFlowRouteHost, {
      controller: {
        refresh: vi.fn(),
      },
      shellContext: {
        currentStepId: "background",
        currentStepLabel: "Choose Your Background",
        currentStepIcon: "fa-solid fa-scroll",
        steps: [
          { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "complete", active: false, index: 0 },
          { id: "background", label: "Background", icon: "fa-solid fa-scroll", status: "pending", active: true, index: 1 },
          { id: "species", label: "Species", icon: "fa-solid fa-dna", status: "pending", active: false, index: 2 },
        ],
        stepViewModel: {
          entries: [
            {
              uuid: "acolyte",
              name: "Acolyte",
              img: "",
              packId: "phb",
              packLabel: "PHB",
              type: "background",
              blurb: "A devoted background for the testing surface.",
            },
          ],
          emptyMessage: "No backgrounds available.",
        },
        canGoBack: false,
        canGoNext: true,
        isReviewStep: false,
        statusHint: "",
        atmosphereClass: "cc-atmosphere--nature",
        chapterKey: "background",
      } as never,
      state: {
        selections: {},
      } as never,
    } as never));

    expect(markup).toContain("cc-origin-flow-shell");
    expect(markup).toContain("cc-theme-header--hero");
    expect(markup).toContain("cc-theme-hero-shell");
    expect(markup).not.toContain("radial-gradient(circle_at_top,color-mix(in_srgb,var(--cc-surface-accent-soft)_18%,transparent),transparent_38%)");
    expect(markup).not.toContain("text-shadow");
  });

  it("preserves the origin flow transition key contract", () => {
    expect(isOriginFlowStep("backgroundAsi")).toBe(true);
    expect(isOriginFlowStep("class")).toBe(false);
    expect(getOriginFlowTransitionKey("backgroundAsi")).toBe("origin-flow");
    expect(getOriginFlowTransitionKey("class")).toBe("class");
  });
});
