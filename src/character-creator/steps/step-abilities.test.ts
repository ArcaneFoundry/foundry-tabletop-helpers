import { describe, expect, it } from "vitest";

import {
  createAbilitiesStep,
  createAbilityStateForMethod,
  isAbilityStateComplete,
} from "./step-abilities";

describe("step abilities", () => {
  it("requires 4d6 scores to be rolled and assigned before completion", () => {
    const rolledState = createAbilityStateForMethod("4d6");
    expect(isAbilityStateComplete(rolledState)).toBe(false);

    rolledState.rolledValues = [16, 15, 14, 13, 12, 10];
    expect(isAbilityStateComplete(rolledState)).toBe(false);

    rolledState.assignments = {
      str: 0,
      dex: 1,
      con: 2,
      int: 3,
      wis: 4,
      cha: 5,
    };
    expect(isAbilityStateComplete(rolledState)).toBe(true);
  });

  it("treats point buy as complete once scores exist", () => {
    const pointBuyState = createAbilityStateForMethod("pointBuy");
    expect(isAbilityStateComplete(pointBuyState)).toBe(true);
  });

  it("uses method-aware completion in the step definition", () => {
    const step = createAbilitiesStep();
    const incompleteState = {
      selections: {
        abilities: createAbilityStateForMethod("standardArray"),
      },
    };
    expect(step.isComplete(incompleteState as never)).toBe(false);

    const completeState = {
      selections: {
        abilities: {
          ...createAbilityStateForMethod("standardArray"),
          assignments: {
            str: 0,
            dex: 1,
            con: 2,
            int: 3,
            wis: 4,
            cha: 5,
          },
        },
      },
    };
    expect(step.isComplete(completeState as never)).toBe(true);
  });

  it("routes the step through a dedicated React component", () => {
    const step = createAbilitiesStep();
    expect(step.renderMode).toBe("react");
    expect(step.reactComponent).toBeDefined();
  });
});
