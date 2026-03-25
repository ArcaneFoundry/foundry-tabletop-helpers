import { describe, expect, it } from "vitest";

import { getBuildFlowTransitionKey, isBuildFlowStep } from "./build-flow-route-host";

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
});
