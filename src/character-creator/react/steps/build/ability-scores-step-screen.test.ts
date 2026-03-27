import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AbilityScoresStepScreen } from "./ability-scores-step-screen";

describe("AbilityScoresStepScreen", () => {
  it("renders the point-buy method rail and budget HUD", () => {
    const markup = renderToStaticMarkup(createElement(AbilityScoresStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          method: "pointBuy",
          methodTabs: [
            { id: "4d6", label: "Roll 4d6", icon: "fa-solid fa-dice", active: false },
            { id: "pointBuy", label: "Point Buy", icon: "fa-solid fa-coins", active: true },
            { id: "standardArray", label: "Standard Array", icon: "fa-solid fa-list-ol", active: false },
          ],
          abilities: [
            {
              key: "str",
              label: "Strength",
              abbrev: "STR",
              value: 15,
              backgroundBonus: 0,
              total: 15,
              modifierStr: "+2",
              canIncrement: true,
              canDecrement: true,
            },
          ],
          isPointBuy: true,
          isRoll: false,
          isStandardArray: false,
          isAssignment: false,
          pointsRemaining: 7,
          pointsBudget: 27,
          budgetClass: "ok",
          hasRolled: false,
          rolledValues: [],
          assignmentOptions: [],
          pointBuyCosts: [{ score: 8, cost: 0 }, { score: 15, cost: 9 }],
        },
      },
      state: {
        selections: {
          abilities: {
            method: "pointBuy",
            scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
            assignments: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
            rerollCount: 0,
          },
        },
        config: {
          allowedAbilityMethods: ["4d6", "pointBuy", "standardArray"],
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Choose the ritual that forges your six abilities");
    expect(markup).toContain("Budget / Tuning-Driven");
    expect(markup).toContain("Point Buy");
    expect(markup).toContain("Remaining");
    expect(markup).toContain("Point Cost Reference");
  });

  it("renders the roll ritual and readiness summary", () => {
    const markup = renderToStaticMarkup(createElement(AbilityScoresStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          method: "4d6",
          methodTabs: [
            { id: "4d6", label: "Roll 4d6", icon: "fa-solid fa-dice", active: true },
            { id: "pointBuy", label: "Point Buy", icon: "fa-solid fa-coins", active: false },
            { id: "standardArray", label: "Standard Array", icon: "fa-solid fa-list-ol", active: false },
          ],
          abilities: [
            {
              key: "str",
              label: "Strength",
              abbrev: "STR",
              value: 15,
              backgroundBonus: 0,
              total: 15,
              modifierStr: "+2",
              canIncrement: false,
              canDecrement: false,
            },
          ],
          isPointBuy: false,
          isRoll: true,
          isStandardArray: false,
          isAssignment: true,
          pointsRemaining: 0,
          pointsBudget: 27,
          budgetClass: "ok",
          hasRolled: true,
          rolledValues: [15, 14, 13, 12, 10, 8],
          assignmentOptions: [],
          pointBuyCosts: [],
        },
      },
      state: {
        selections: {
          abilities: {
            method: "4d6",
            scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
            assignments: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 },
            rolledValues: [15, 14, 13, 12, 10, 8],
            rerollCount: 1,
          },
        },
        config: {
          allowedAbilityMethods: ["4d6", "pointBuy", "standardArray"],
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Ritual / Dice-Driven");
    expect(markup).toContain("Roll 4d6");
    expect(markup).toContain("Reroll All");
    expect(markup).toContain("Results ready for assignment");
    expect(markup).toContain("Dice Ritual");
  });

  it("renders assignment controls for the standard array path", () => {
    const markup = renderToStaticMarkup(createElement(AbilityScoresStepScreen, {
      controller: {
        updateCurrentStepData: vi.fn(),
      },
      shellContext: {
        stepViewModel: {
          method: "standardArray",
          methodTabs: [
            { id: "standardArray", label: "Standard Array", icon: "fa-solid fa-list-ol", active: true },
          ],
          abilities: [
            {
              key: "str",
              label: "Strength",
              abbrev: "STR",
              value: 15,
              backgroundBonus: 1,
              total: 16,
              modifierStr: "+3",
              canIncrement: false,
              canDecrement: false,
            },
          ],
          isPointBuy: false,
          isRoll: false,
          isStandardArray: true,
          isAssignment: true,
          pointsRemaining: 0,
          pointsBudget: 27,
          budgetClass: "ok",
          hasRolled: false,
          rolledValues: [],
          assignmentOptions: [
            {
              key: "str",
              label: "STR",
              currentIdx: 0,
              options: [
                { index: 0, value: 15, selected: true, disabled: false },
                { index: 1, value: 14, selected: false, disabled: true },
              ],
            },
          ],
          pointBuyCosts: [],
        },
      },
      state: {
        selections: {
          abilities: {
            method: "standardArray",
            scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
            assignments: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 },
          },
        },
        config: {
          allowedAbilityMethods: ["standardArray"],
        },
      },
      step: {},
    } as never));

    expect(markup).toContain("Disciplined Allocation");
    expect(markup).toContain("Assign each value from the standard array");
    expect(markup).toContain("Strength");
    expect(markup).toContain("STR");
    expect(markup).toContain("option");
  });
});
