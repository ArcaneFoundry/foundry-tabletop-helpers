import { describe, expect, it } from "vitest";

import {
  CLASS_STEPPER_COMPACT_BREAKPOINT,
  getClassStepperLayoutMode,
  shouldShowClassStepperSubsteps,
} from "./class-stepper-layout";

describe("class stepper layout", () => {
  it("switches to compact mode at and below the compact breakpoint", () => {
    expect(CLASS_STEPPER_COMPACT_BREAKPOINT).toBe(520);
    expect(getClassStepperLayoutMode(521)).toBe("wide");
    expect(getClassStepperLayoutMode(520)).toBe("compact");
    expect(getClassStepperLayoutMode(319)).toBe("compact");
  });

  it("keeps substeps visible only when the layout is wide and substeps exist", () => {
    expect(shouldShowClassStepperSubsteps("wide", true)).toBe(true);
    expect(shouldShowClassStepperSubsteps("wide", false)).toBe(false);
    expect(shouldShowClassStepperSubsteps("compact", true)).toBe(false);
    expect(shouldShowClassStepperSubsteps("compact", false)).toBe(false);
  });
});
