import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildFlowRouteHost, getBuildFlowTransitionKey, isBuildFlowStep } from "./build-flow-route-host";

describe("build flow route host", () => {
  it("recognizes the mounted build chapter steps", () => {
    expect(isBuildFlowStep("abilities")).toBe(true);
    expect(isBuildFlowStep("equipment")).toBe(true);
    expect(isBuildFlowStep("equipmentShop")).toBe(true);
  });

  it("keeps feats and spells outside the mounted build host", () => {
    expect(isBuildFlowStep("feats")).toBe(false);
    expect(isBuildFlowStep("spells")).toBe(false);
    expect(isBuildFlowStep("review")).toBe(false);
  });

  it("uses a stable transition key only for build flow steps", () => {
    expect(getBuildFlowTransitionKey("abilities")).toBe("build-flow");
    expect(getBuildFlowTransitionKey("equipment")).toBe("build-flow");
    expect(getBuildFlowTransitionKey("feats")).toBe("feats");
    expect(getBuildFlowTransitionKey(undefined)).toBe("");
  });

  it("renders the fallback shell with shared build tokens", () => {
    const markup = renderToStaticMarkup(createElement(BuildFlowRouteHost, {
      controller: {
        updateCurrentStepData: () => undefined,
      },
      shellContext: {
        stepContentHtml: "",
        stepViewModel: {
          stepTitle: "Build",
          stepLabel: "Equipment",
          stepDescription: "Fallback build screen.",
          derived: {
            baseGoldCp: 10000,
            remainingGoldCp: 9400,
            selectedClassOption: { label: "Wizard" },
            selectedBackgroundOption: { label: "Sage" },
          },
        },
      },
      state: {
        selections: {},
      },
      step: {
        renderMode: "react",
      },
    } as never));

    expect(markup).toContain("background-image:var(--cc-build-shell-image)");
    expect(markup).toContain("background-image:var(--cc-build-panel-image)");
    expect(markup).not.toContain("cc-theme-panel--soft");
  });
});
